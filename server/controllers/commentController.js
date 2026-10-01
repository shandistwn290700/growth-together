const { Comment, Post } = require('../models');
const { getViewerScope, canViewPost, visibleTags } = require('../services/access');
const { POST_INCLUDES, authorInclude, authorDto } = require('../services/postView');

// Komentar dikelompokkan per siswa ("utas"). Orang tua hanya melihat utas anaknya sendiri;
// guru melihat utas siswa di kelasnya; admin dan penulis postingan melihat semuanya.
async function loadContext(postId, user) {
  const scope = await getViewerScope(user);
  const post = await Post.findByPk(postId, { include: POST_INCLUDES });
  if (!post || !canViewPost(post, user, scope)) throw { name: 'NotFound', message: 'Postingan tidak ditemukan' };
  return { post, tags: visibleTags(post, user, scope) };
}

function commentDto(comment) {
  return {
    id: comment.id,
    studentId: comment.studentId,
    parentId: comment.parentId,
    content: comment.content,
    createdAt: comment.createdAt,
    author: authorDto(comment.author),
  };
}

class CommentController {
  // GET /posts/:id/comments
  static async list(req, res) {
    const { post, tags } = await loadContext(req.params.id, req.user);
    const comments = await Comment.findAll({
      where: { postId: post.id, studentId: tags.map((t) => t.studentId) },
      include: authorInclude(),
      order: [['createdAt', 'ASC']],
    });

    const threads = tags
      .map((t) => {
        const inThread = comments.filter((c) => c.studentId === t.studentId).map(commentDto);
        const roots = inThread.filter((c) => !c.parentId);
        return {
          student: t.Student,
          comments: roots.map((root) => ({ ...root, replies: inThread.filter((c) => c.parentId === root.id) })),
        };
      })
      .filter((thread) => thread.comments.length > 0);

    res.json({ students: tags.map((t) => t.Student), threads });
  }

  // POST /posts/:id/comments  body: { content, studentId?, parentId? }
  static async create(req, res) {
    const { post, tags } = await loadContext(req.params.id, req.user);
    const { content, parentId } = req.body ?? {};
    let studentId = Number(req.body?.studentId);

    // Jika hanya ada satu utas yang terlihat (misalnya orang tua), utasnya otomatis.
    if (!studentId && tags.length === 1) studentId = tags[0].studentId;
    if (!tags.some((t) => t.studentId === studentId)) {
      throw { name: 'BadRequest', message: 'Pilih siswa yang ingin dikomentari' };
    }

    let rootId = null;
    if (parentId) {
      const parent = await Comment.findByPk(parentId);
      if (!parent || parent.postId !== post.id || parent.studentId !== studentId) {
        throw { name: 'BadRequest', message: 'Komentar yang dibalas tidak ditemukan' };
      }
      // Balasan hanya satu tingkat seperti Facebook: balasan dari balasan tetap di bawah komentar utama.
      rootId = parent.parentId ?? parent.id;
    }

    const comment = await Comment.create({
      postId: post.id,
      authorId: req.user.id,
      studentId,
      parentId: rootId,
      content: String(content ?? '').trim(),
    });
    await comment.reload({ include: authorInclude() });
    res.status(201).json(commentDto(comment));
  }

  // DELETE /comments/:id — penulis komentar atau admin.
  static async destroy(req, res) {
    const comment = await Comment.findByPk(req.params.id);
    if (!comment) throw { name: 'NotFound', message: 'Komentar tidak ditemukan' };
    if (comment.authorId !== req.user.id && req.user.role !== 'admin') {
      throw { name: 'Forbidden', message: 'Anda tidak bisa menghapus komentar ini' };
    }
    await comment.destroy();
    res.json({ message: 'Komentar dihapus' });
  }
}

module.exports = CommentController;
