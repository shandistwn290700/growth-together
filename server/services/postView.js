const { Classroom, Comment, PostMedia, PostStudent, Reaction, Student, User, sequelize } = require('../models');
const { visibleTags } = require('./access');
const { deliveryUrls } = require('../helpers/media');

const STUDENT_ATTRS = ['id', 'fullName', 'nickname'];

const authorInclude = (as = 'author') => ({
  model: User,
  as,
  attributes: ['id', 'role', 'fullName', 'avatarUrl', 'studentId'],
  include: { model: Student, as: 'student', attributes: STUDENT_ATTRS.concat('photoUrl') },
});

// Include standar untuk memuat postingan beserta media dan tag-nya.
const POST_INCLUDES = [
  authorInclude(),
  { model: Classroom, attributes: ['id', 'grade', 'name'] },
  { model: PostMedia, as: 'media', separate: true, order: [['position', 'ASC']] },
  { model: PostStudent, separate: true, include: { model: Student, attributes: STUDENT_ATTRS } },
];

const isStaff = (user) => user.role === 'admin' || user.role === 'teacher';

function authorDto(user) {
  if (!user) return null;
  const isParent = user.role === 'parent';
  return {
    id: user.id,
    role: user.role,
    displayName: isParent ? user.student?.fullName : user.fullName,
    avatarUrl: isParent ? user.student?.photoUrl : user.avatarUrl,
  };
}

function summarizeReactions(reactions, userId) {
  const counts = {};
  reactions.forEach((r) => (counts[r.type] = (counts[r.type] ?? 0) + 1));
  return { total: reactions.length, counts, mine: reactions.find((r) => r.userId === userId)?.type ?? null };
}

async function reactionSummary(postId, userId) {
  const reactions = await Reaction.findAll({ where: { postId }, attributes: ['userId', 'type'] });
  return summarizeReactions(reactions, userId);
}

// Ubah daftar Post (dengan POST_INCLUDES) menjadi data yang aman dikirim ke user ini.
async function serializePosts(posts, user, scope) {
  if (posts.length === 0) return [];
  const postIds = posts.map((p) => p.id);

  const [reactions, commentCounts] = await Promise.all([
    Reaction.findAll({ where: { postId: postIds }, attributes: ['postId', 'userId', 'type'] }),
    Comment.findAll({
      where: { postId: postIds },
      attributes: ['postId', 'studentId', [sequelize.fn('COUNT', sequelize.col('id')), 'count']],
      group: ['postId', 'studentId'],
      raw: true,
    }),
  ]);

  return posts.map((post) => {
    const tags = visibleTags(post, user, scope);
    const tagStudentIds = new Set(tags.map((t) => t.studentId));
    const commentCount = commentCounts
      .filter((c) => c.postId === post.id && tagStudentIds.has(c.studentId))
      .reduce((sum, c) => sum + Number(c.count), 0);

    return {
      id: post.id,
      caption: post.caption,
      createdAt: post.createdAt,
      updatedAt: post.updatedAt,
      author: authorDto(post.author),
      // Untuk orang tua, kelas yang ditampilkan adalah kelas anaknya sendiri.
      classroom: post.Classroom ? { id: post.Classroom.id, label: post.Classroom.label } : null,
      students: tags.map((t) => t.Student),
      totalTagged: isStaff(user) ? (post.PostStudents ?? []).length : undefined,
      media: post.media.map((m) => ({
        id: m.id,
        type: m.type,
        width: m.width,
        height: m.height,
        duration: m.duration,
        ...deliveryUrls(m),
      })),
      reactions: summarizeReactions(
        reactions.filter((r) => r.postId === post.id),
        user.id,
      ),
      commentCount,
      canEdit: post.authorId === user.id,
      canDelete: post.authorId === user.id || user.role === 'admin',
    };
  });
}

module.exports = { POST_INCLUDES, STUDENT_ATTRS, authorInclude, authorDto, isStaff, reactionSummary, serializePosts };
