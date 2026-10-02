// Kumpulkan seluruh data laporan untuk satu periode: angka ringkasan, rekap per kelas & per siswa,
// daftar postingan, video, dan foto (beserta lokasinya di dalam ZIP).
const { Op } = require('sequelize');
const {
  Classroom,
  Comment,
  Enrollment,
  Message,
  Post,
  PostMedia,
  PostStudent,
  Reaction,
  Student,
  User,
  sequelize,
} = require('../models');
const { authorInclude, authorDto } = require('./postView');
const { archiveImageUrl, deliveryUrls } = require('../helpers/media');

const ROLE_LABELS = { teacher: 'Guru', parent: 'Orang tua', admin: 'Admin' };

// Nama folder/file yang aman di Windows, macOS, dan Linux.
const safeName = (text) => String(text).replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, ' ').trim().slice(0, 80) || 'Tanpa nama';

const dateKey = (date) => {
  // Tanggal menurut zona waktu sekolah (sama dengan periode laporan).
  const offset = process.env.REPORT_UTC_OFFSET || '+07:00';
  const [sign, hh, mm] = /([+-])(\d{2}):(\d{2})/.exec(offset).slice(1);
  const minutes = (sign === '-' ? -1 : 1) * (Number(hh) * 60 + Number(mm));
  return new Date(date.getTime() + minutes * 60_000).toISOString().slice(0, 10);
};

async function countBy(model, column, where) {
  const rows = await model.findAll({
    where,
    attributes: [column, [sequelize.fn('COUNT', sequelize.col('id')), 'count']],
    group: [column],
    raw: true,
  });
  return new Map(rows.map((r) => [r[column], Number(r.count)]));
}

async function buildReport(period) {
  const range = { [Op.gte]: period.start, [Op.lt]: period.end };
  const yearId = period.academicYear?.id ?? 0;

  const [posts, classrooms, enrollments, chatMessages] = await Promise.all([
    Post.findAll({
      where: { createdAt: range },
      include: [
        authorInclude(),
        { model: PostMedia, as: 'media', separate: true, order: [['position', 'ASC']] },
        {
          model: PostStudent,
          separate: true,
          include: [
            { model: Student, attributes: ['id', 'fullName', 'nickname', 'nis'] },
            { model: Classroom, attributes: ['id', 'grade', 'name'] },
          ],
        },
      ],
      order: [['createdAt', 'ASC']],
    }),
    Classroom.findAll({
      where: { academicYearId: yearId },
      include: { model: User, as: 'teachers', attributes: ['fullName'], through: { attributes: [] } },
      order: [
        ['grade', 'ASC'],
        ['name', 'ASC'],
      ],
    }),
    Enrollment.findAll({
      where: { academicYearId: yearId },
      include: [
        {
          model: Student,
          include: { model: User, as: 'parentAccount', attributes: ['isActive', 'mustChangePassword'] },
        },
        { model: Classroom, attributes: ['id', 'grade', 'name'] },
      ],
      order: [[Student, 'fullName', 'ASC']],
    }),
    Message.count({ where: { createdAt: range } }),
  ]);

  const postIds = posts.map((p) => p.id);
  const [commentsByPost, reactionsByPost, commentsByStudent] = await Promise.all([
    countBy(Comment, 'postId', { postId: postIds }),
    countBy(Reaction, 'postId', { postId: postIds }),
    countBy(Comment, 'studentId', { postId: postIds }),
  ]);

  // ---------- Per postingan ----------
  const photos = [];
  const videos = [];
  const postRows = posts.map((post) => {
    const author = authorDto(post.author);
    const tags = post.PostStudents;
    const images = post.media.filter((m) => m.type === 'image');
    const clips = post.media.filter((m) => m.type === 'video');
    const day = dateKey(post.createdAt);
    const classLabels = [...new Map(tags.map((t) => [t.Classroom.id, t.Classroom.label])).values()];
    const tagged = tags.length <= 5 ? tags.map((t) => t.Student.fullName).join(', ') : `${tags.length} siswa`;

    // Lokasi foto di ZIP: folder siswa jika hanya menandai satu siswa di kelas itu,
    // selain itu folder "_Kegiatan kelas" (tidak disalin ke setiap siswa agar ZIP tidak membengkak).
    const byClass = new Map();
    tags.forEach((t) => byClass.set(t.Classroom.id, [...(byClass.get(t.Classroom.id) ?? []), t]));
    for (const classTags of byClass.values()) {
      const folder = `Foto/${safeName(classTags[0].Classroom.label)}/${
        classTags.length === 1 ? safeName(classTags[0].Student.fullName) : '_Kegiatan kelas'
      }`;
      images.forEach((m, i) =>
        photos.push({ url: archiveImageUrl(m.publicId), path: `${folder}/${day}_post${post.id}_${i + 1}.jpg` }),
      );
    }

    clips.forEach((m) =>
      videos.push({
        date: day,
        classes: classLabels.join(', '),
        students: tagged,
        caption: post.caption ?? '',
        duration: m.duration ? Math.round(m.duration) : null,
        url: deliveryUrls(m).url,
      }),
    );

    return {
      id: post.id,
      date: day,
      authorName: author.role === 'parent' ? `Ortu ${author.displayName}` : author.displayName,
      authorRole: ROLE_LABELS[author.role],
      role: author.role,
      classes: classLabels.join(', '),
      tagged,
      caption: post.caption ?? '',
      photos: images.length,
      videos: clips.length,
      reactions: reactionsByPost.get(post.id) ?? 0,
      comments: commentsByPost.get(post.id) ?? 0,
      tags,
    };
  });

  // ---------- Per siswa ----------
  const studentRows = enrollments.map((e) => {
    const mine = postRows.filter((p) => p.tags.some((t) => t.studentId === e.studentId));
    const parent = e.Student.parentAccount;
    return {
      studentId: e.studentId,
      classroomId: e.classroomId,
      nis: e.Student.nis,
      fullName: e.Student.fullName,
      classLabel: e.Classroom.label,
      moments: mine.length,
      fromTeacher: mine.filter((p) => p.role === 'teacher').length,
      fromParent: mine.filter((p) => p.role === 'parent').length,
      photos: mine.reduce((sum, p) => sum + p.photos, 0),
      videos: mine.reduce((sum, p) => sum + p.videos, 0),
      comments: commentsByStudent.get(e.studentId) ?? 0,
      parentStatus: !parent ? '—' : !parent.isActive ? 'Nonaktif' : parent.mustChangePassword ? 'Belum login' : 'Aktif',
    };
  });

  // ---------- Per kelas ----------
  const classRows = classrooms.map((c) => {
    const classPosts = postRows.filter((p) => p.tags.some((t) => t.classroomId === c.id));
    const students = studentRows.filter((s) => s.classroomId === c.id);
    return {
      id: c.id,
      label: c.label,
      teachers: c.teachers.map((t) => t.fullName).join(', ') || '—',
      students: students.length,
      posts: classPosts.length,
      photos: classPosts.reduce((sum, p) => sum + p.photos, 0),
      videos: classPosts.reduce((sum, p) => sum + p.videos, 0),
      comments: classPosts.reduce((sum, p) => sum + p.comments, 0),
      reactions: classPosts.reduce((sum, p) => sum + p.reactions, 0),
      withoutMoments: students.filter((s) => s.moments === 0).map((s) => s.fullName),
    };
  });

  const parents = studentRows.filter((s) => s.parentStatus !== '—');
  const totals = {
    posts: postRows.length,
    postsByTeacher: postRows.filter((p) => p.role === 'teacher').length,
    postsByParent: postRows.filter((p) => p.role === 'parent').length,
    postsByAdmin: postRows.filter((p) => p.role === 'admin').length,
    photos: postRows.reduce((sum, p) => sum + p.photos, 0),
    videos: postRows.reduce((sum, p) => sum + p.videos, 0),
    comments: postRows.reduce((sum, p) => sum + p.comments, 0),
    reactions: postRows.reduce((sum, p) => sum + p.reactions, 0),
    students: studentRows.length,
    studentsWithMoments: studentRows.filter((s) => s.moments > 0).length,
    parents: parents.length,
    parentsActive: parents.filter((s) => s.parentStatus === 'Aktif').length,
    chatMessages,
  };

  return { period, totals, classRows, studentRows, postRows, videos, photos };
}

module.exports = { buildReport, safeName };
