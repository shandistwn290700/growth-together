const { Op } = require('sequelize');
const { Post, PostMedia, PostStudent, sequelize } = require('../models');
const { getViewerScope, canViewPost, feedWhere, parentCanPost, resolvePostTags } = require('../services/access');
const { POST_INCLUDES, serializePosts } = require('../services/postView');
const { createUploadSignature, validateUploadedMedia, deleteFromCloudinary } = require('../helpers/media');

const PAGE_SIZE = 10;

async function findVisiblePost(id, user) {
  const scope = await getViewerScope(user);
  const post = await Post.findByPk(id, { include: POST_INCLUDES });
  // Postingan yang tidak boleh dilihat dianggap tidak ada, agar keberadaannya tidak bocor.
  if (!post || !canViewPost(post, user, scope)) throw { name: 'NotFound', message: 'Postingan tidak ditemukan' };
  return { post, scope };
}

async function serializeOne(post, user, scope) {
  const [item] = await serializePosts([post], user, scope);
  return item;
}

class PostController {
  // POST /uploads/signature  body: { resourceType: 'image' | 'video', purpose?: 'post' | 'avatar' }
  static async uploadSignature(req, res) {
    const purpose = req.body?.purpose ?? 'post';
    if (purpose === 'post' && req.user.role === 'parent' && !parentCanPost(req.user.student)) {
      throw { name: 'Forbidden', message: 'Ananda sudah lulus/pindah. Timeline hanya bisa dilihat sebagai arsip' };
    }
    res.json(createUploadSignature(req.user.id, req.body?.resourceType, purpose));
  }

  // GET /posts?cursor=<id terakhir>  — feed Beranda, terbaru di atas.
  static async feed(req, res) {
    const scope = await getViewerScope(req.user);
    const where = feedWhere(req.user, scope);
    const cursor = Number(req.query.cursor);
    if (Number.isInteger(cursor) && cursor > 0) where.id = { [Op.lt]: cursor };

    const posts = await Post.findAll({ where, include: POST_INCLUDES, order: [['id', 'DESC']], limit: PAGE_SIZE + 1 });
    const page = posts.slice(0, PAGE_SIZE);
    res.json({
      items: await serializePosts(page, req.user, scope),
      nextCursor: posts.length > PAGE_SIZE ? page.at(-1).id : null,
    });
  }

  static async show(req, res) {
    const { post, scope } = await findVisiblePost(req.params.id, req.user);
    res.json(await serializeOne(post, req.user, scope));
  }

  // POST /posts  body: { caption, classroomId?, studentIds?, media: [...] }
  // Pengumuman admin: { audience: 'classes', classroomIds: [...] } atau { audience: 'school' }.
  static async create(req, res) {
    const { caption = '', classroomId, studentIds, audience, classroomIds, media = [] } = req.body ?? {};
    const text = String(caption).trim();
    const mediaRows = validateUploadedMedia(req.user.id, media);
    if (!text && mediaRows.length === 0) {
      throw { name: 'BadRequest', message: 'Tulis sesuatu atau tambahkan foto/video' };
    }
    const resolved = await resolvePostTags(req.user, { classroomId, studentIds, audience, classroomIds });
    const { tags, classroomId: postClassroomId } = resolved;

    const created = await sequelize.transaction(async (transaction) => {
      const post = await Post.create(
        { authorId: req.user.id, classroomId: postClassroomId, audience: resolved.audience, caption: text || null },
        { transaction },
      );
      await PostMedia.bulkCreate(
        mediaRows.map((m) => ({ ...m, postId: post.id })),
        { transaction },
      );
      await PostStudent.bulkCreate(
        tags.map((t) => ({ ...t, postId: post.id })),
        { transaction },
      );
      return post;
    });

    const { post, scope } = await findVisiblePost(created.id, req.user);
    res.status(201).json(await serializeOne(post, req.user, scope));
  }

  // PATCH /posts/:id  body: { caption } — hanya penulis.
  static async update(req, res) {
    const { post, scope } = await findVisiblePost(req.params.id, req.user);
    if (post.authorId !== req.user.id) throw { name: 'Forbidden', message: 'Hanya penulis yang bisa mengedit postingan' };

    const text = String(req.body?.caption ?? '').trim();
    if (!text && post.media.length === 0) throw { name: 'BadRequest', message: 'Caption tidak boleh kosong' };
    await post.update({ caption: text || null });
    res.json(await serializeOne(post, req.user, scope));
  }

  // DELETE /posts/:id — penulis atau admin.
  static async destroy(req, res) {
    const { post } = await findVisiblePost(req.params.id, req.user);
    if (post.authorId !== req.user.id && req.user.role !== 'admin') {
      throw { name: 'Forbidden', message: 'Anda tidak bisa menghapus postingan ini' };
    }

    const media = post.media.map((m) => ({ type: m.type, publicId: m.publicId }));
    await post.destroy();
    // File di Cloudinary dihapus setelah data terhapus. Jika gagal, postingan tetap terhapus.
    deleteFromCloudinary(media).catch((err) =>
      console.error('Gagal menghapus media Cloudinary:', err.error?.message ?? err.message),
    );
    res.json({ message: 'Postingan dihapus' });
  }
}

module.exports = PostController;
