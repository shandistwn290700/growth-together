const { Post, Reaction } = require('../models');
const { getViewerScope, canViewPost, visibleTags } = require('../services/access');
const { POST_INCLUDES, authorInclude, authorDto, isStaff, reactionSummary } = require('../services/postView');

async function loadVisiblePost(postId, user) {
  const scope = await getViewerScope(user);
  const post = await Post.findByPk(postId, { include: POST_INCLUDES });
  if (!post || !canViewPost(post, user, scope)) throw { name: 'NotFound', message: 'Postingan tidak ditemukan' };
  return { post, scope };
}

const assertCanView = async (postId, user) => (await loadVisiblePost(postId, user)).post;

class ReactionController {
  // PUT /posts/:id/reaction  body: { type }
  static async upsert(req, res) {
    const post = await assertCanView(req.params.id, req.user);
    const type = req.body?.type ?? 'like';
    const existing = await Reaction.findOne({ where: { postId: post.id, userId: req.user.id } });
    if (existing) await existing.update({ type });
    else await Reaction.create({ postId: post.id, userId: req.user.id, type });
    res.json(await reactionSummary(post.id, req.user.id));
  }

  static async remove(req, res) {
    const post = await assertCanView(req.params.id, req.user);
    await Reaction.destroy({ where: { postId: post.id, userId: req.user.id } });
    res.json(await reactionSummary(post.id, req.user.id));
  }

  // GET /posts/:id/reactions — daftar siapa saja yang bereaksi (hanya guru/admin,
  // berguna untuk melihat orang tua mana yang sudah membaca pemberitahuan).
  static async list(req, res) {
    if (!isStaff(req.user)) throw { name: 'Forbidden', message: 'Anda tidak memiliki akses' };
    const { post, scope } = await loadVisiblePost(req.params.id, req.user);
    const reactions = await Reaction.findAll({
      where: { postId: post.id },
      include: authorInclude('user'),
      order: [['createdAt', 'ASC']],
    });
    // Guru hanya melihat reaksi orang tua dari siswa yang terlihat olehnya.
    const visibleStudentIds = new Set(visibleTags(post, req.user, scope).map((t) => t.studentId));
    res.json(
      reactions
        .filter((r) => r.user.role !== 'parent' || visibleStudentIds.has(r.user.studentId))
        .map((r) => ({ type: r.type, user: authorDto(r.user) })),
    );
  }
}

module.exports = ReactionController;
