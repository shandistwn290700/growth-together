// Aturan privasi Growth Together, dikumpulkan di satu tempat:
// - Admin melihat semua postingan.
// - Orang tua hanya melihat postingan yang menandai anaknya sendiri.
// - Guru melihat postingan yang menandai siswa di kelasnya (sekarang), atau yang dibuat
//   saat siswa itu berada di kelas yang pernah ia ampu.
// - Daftar tag dan utas komentar ikut disaring: orang tua tidak pernah melihat nama siswa lain.
// - Pengumuman admin (kelas tertentu / seluruh sekolah) menandai semua siswa aktif di sasarannya
//   saat diposting, jadi aturan di atas tetap berlaku. Pengumuman tidak masuk timeline siswa.
const { Op } = require('sequelize');
const { AcademicYear, Classroom, ClassroomTeacher, Enrollment, Student, sequelize } = require('../models');

async function getViewerScope(user) {
  if (user.role === 'admin') return { all: true, studentIds: new Set(), classroomIds: new Set() };
  if (user.role === 'parent') {
    return { all: false, studentIds: new Set(user.studentId ? [user.studentId] : []), classroomIds: new Set() };
  }

  const links = await ClassroomTeacher.findAll({ where: { teacherId: user.id }, attributes: ['classroomId'] });
  const classroomIds = links.map((l) => l.classroomId);
  const current = await Enrollment.findAll({
    where: { classroomId: classroomIds, status: 'active' },
    attributes: ['studentId'],
  });
  return { all: false, studentIds: new Set(current.map((e) => e.studentId)), classroomIds: new Set(classroomIds) };
}

// Tag (PostStudent) yang boleh dilihat user pada sebuah postingan.
function visibleTags(post, user, scope) {
  const tags = post.PostStudents ?? [];
  if (scope.all || post.authorId === user.id) return tags;
  return tags.filter((t) => scope.studentIds.has(t.studentId) || scope.classroomIds.has(t.classroomId));
}

function canViewPost(post, user, scope) {
  return scope.all || post.authorId === user.id || visibleTags(post, user, scope).length > 0;
}

// Filter SQL untuk feed: hanya postingan yang boleh dilihat user.
function feedWhere(user, scope) {
  if (scope.all) return {};
  const conditions = [];
  const ids = (set) => [...set].map(Number).join(',');
  if (scope.studentIds.size) conditions.push(`"studentId" IN (${ids(scope.studentIds)})`);
  if (scope.classroomIds.size) conditions.push(`"classroomId" IN (${ids(scope.classroomIds)})`);

  const or = [{ authorId: user.id }];
  if (conditions.length) {
    or.push({
      id: { [Op.in]: sequelize.literal(`(SELECT "postId" FROM "PostStudents" WHERE ${conditions.join(' OR ')})`) },
    });
  }
  return { [Op.or]: or };
}

// ---------- Profil siswa ----------

// Admin: semua siswa. Orang tua: anaknya sendiri. Guru: siswa yang pernah/sedang ada di kelasnya.
async function canViewStudent(user, studentId, scope) {
  if (scope.all) return true;
  if (user.role === 'parent') return user.studentId === studentId;
  if (scope.studentIds.has(studentId)) return true;
  if (!scope.classroomIds.size) return false;
  return (await Enrollment.count({ where: { studentId, classroomId: [...scope.classroomIds] } })) > 0;
}

/**
 * SQL (subquery) berisi ID postingan di timeline seorang siswa yang boleh dilihat user.
 * Yang dihitung adalah tag siswa itu sendiri: guru hanya melihat momen siswa saat berada
 * di kelas yang ia ampu (atau siswa yang sekarang di kelasnya), ditambah postingannya sendiri.
 * Pengumuman admin bukan momen siswa, jadi tidak ikut.
 */
function timelinePostIdsSql(user, scope, studentId, classroomId) {
  const sid = Number(studentId);
  const cid = classroomId ? Number(classroomId) : null;
  if (!Number.isInteger(sid) || (cid !== null && !Number.isInteger(cid))) {
    throw { name: 'BadRequest', message: 'Parameter tidak valid' };
  }

  const base = [`ps."studentId" = ${sid}`, `p."audience" = 'tagged'`];
  if (cid) base.push(`ps."classroomId" = ${cid}`);
  const from = 'FROM "PostStudents" ps JOIN "Posts" p ON p.id = ps."postId"';
  if (scope.all) return `SELECT ps."postId" ${from} WHERE ${base.join(' AND ')}`;

  const ids = (set) => [...set].map(Number).join(',');
  const access = [];
  if (scope.studentIds.has(sid)) access.push('TRUE');
  if (scope.classroomIds.size) access.push(`ps."classroomId" IN (${ids(scope.classroomIds)})`);
  access.push(`p."authorId" = ${Number(user.id)}`);

  return `SELECT ps."postId" ${from} WHERE ${base.join(' AND ')} AND (${access.join(' OR ')})`;
}

// Siswa yang tampil di sebuah postingan menurut sudut pandang user.
function studentsVisibleTo(post, user, scope) {
  return visibleTags(post, user, scope).map((t) => t.Student).filter(Boolean);
}

// ---------- Memposting ----------

async function getActiveYear() {
  const year = await AcademicYear.findOne({ where: { isActive: true } });
  if (!year) throw { name: 'BadRequest', message: 'Belum ada tahun ajaran aktif. Hubungi admin sekolah' };
  return year;
}

// Keputusan sekolah (belum final): orang tua dari siswa yang sudah lulus/pindah
// hanya bisa melihat arsip. Ubah fungsi ini jika aturannya berubah.
function parentCanPost(student) {
  return student?.status === 'active';
}

const AUDIENCES = ['tagged', 'classes', 'school'];

// Pengumuman admin: tandai semua siswa aktif di kelas yang dipilih, atau di seluruh sekolah.
async function resolveAnnouncementTags(year, audience, classroomIds) {
  let classIds = null;
  if (audience === 'classes') {
    if (!Array.isArray(classroomIds) || classroomIds.length === 0) {
      throw { name: 'BadRequest', message: 'Pilih minimal satu kelas' };
    }
    classIds = [...new Set(classroomIds.map(Number))];
    const found = classIds.every(Number.isInteger)
      ? await Classroom.count({ where: { id: classIds, academicYearId: year.id } })
      : 0;
    if (found !== classIds.length) throw { name: 'BadRequest', message: 'Ada kelas yang tidak ada di tahun ajaran aktif' };
  }

  const enrollments = await Enrollment.findAll({
    where: { academicYearId: year.id, status: 'active', ...(classIds && { classroomId: classIds }) },
    include: { model: Student, where: { status: 'active' }, attributes: [] },
    attributes: ['studentId', 'classroomId'],
  });
  if (enrollments.length === 0) {
    throw { name: 'BadRequest', message: 'Belum ada siswa aktif di kelas yang dipilih' };
  }

  return {
    audience,
    tags: enrollments.map((e) => ({ studentId: e.studentId, classroomId: e.classroomId })),
    classroomId: classIds?.length === 1 ? classIds[0] : null,
  };
}

/**
 * Tentukan siswa yang ditandai dan kelasnya masing-masing.
 * Hasil: { audience, tags: [{ studentId, classroomId }], classroomId } — classroomId diisi jika semua dari satu kelas.
 */
async function resolvePostTags(user, { classroomId, studentIds, audience = 'tagged', classroomIds }) {
  if (!AUDIENCES.includes(audience)) throw { name: 'BadRequest', message: 'Sasaran postingan tidak dikenal' };
  if (audience !== 'tagged' && user.role !== 'admin') {
    throw { name: 'Forbidden', message: 'Hanya admin yang bisa membuat pengumuman untuk kelas atau seluruh sekolah' };
  }
  const year = await getActiveYear();
  if (audience !== 'tagged') return resolveAnnouncementTags(year, audience, classroomIds);

  if (user.role === 'parent') {
    if (!parentCanPost(user.student)) {
      throw { name: 'Forbidden', message: 'Ananda sudah lulus/pindah. Timeline hanya bisa dilihat sebagai arsip' };
    }
    studentIds = [user.studentId];
  } else {
    if (!Array.isArray(studentIds) || studentIds.length === 0) {
      throw { name: 'BadRequest', message: 'Tandai minimal satu siswa' };
    }
    studentIds = [...new Set(studentIds.map(Number))];
  }

  const enrollments = await Enrollment.findAll({
    where: { studentId: studentIds, academicYearId: year.id },
    include: [Student, Classroom],
  });
  if (enrollments.length !== studentIds.length || enrollments.some((e) => e.Student.status !== 'active')) {
    throw { name: 'BadRequest', message: 'Ada siswa yang tidak terdaftar aktif di tahun ajaran ini' };
  }

  if (user.role === 'teacher') {
    if (!Number.isInteger(Number(classroomId))) throw { name: 'BadRequest', message: 'Pilih kelas terlebih dahulu' };
    const teaches = await ClassroomTeacher.findOne({ where: { teacherId: user.id, classroomId: Number(classroomId) } });
    const inClass = enrollments.every((e) => e.classroomId === Number(classroomId));
    if (!teaches || !inClass) {
      throw { name: 'Forbidden', message: 'Anda hanya bisa menandai siswa di kelas yang Anda ampu' };
    }
  }

  const enrolledClassIds = new Set(enrollments.map((e) => e.classroomId));
  return {
    audience,
    tags: enrollments.map((e) => ({ studentId: e.studentId, classroomId: e.classroomId })),
    classroomId: enrolledClassIds.size === 1 ? [...enrolledClassIds][0] : null,
  };
}

module.exports = {
  getViewerScope,
  visibleTags,
  canViewPost,
  feedWhere,
  studentsVisibleTo,
  canViewStudent,
  timelinePostIdsSql,
  parentCanPost,
  resolvePostTags,
};
