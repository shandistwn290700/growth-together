// Aturan privasi Growth Together, dikumpulkan di satu tempat:
// - Admin melihat semua postingan.
// - Orang tua hanya melihat postingan yang menandai anaknya sendiri.
// - Guru melihat postingan yang menandai siswa di kelasnya (sekarang), atau yang dibuat
//   saat siswa itu berada di kelas yang pernah ia ampu.
// - Daftar tag dan utas komentar ikut disaring: orang tua tidak pernah melihat nama siswa lain.
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

/**
 * Tentukan siswa yang ditandai dan kelasnya masing-masing.
 * Hasil: { tags: [{ studentId, classroomId }], classroomId } — classroomId diisi jika semua dari satu kelas.
 */
async function resolvePostTags(user, { classroomId, studentIds }) {
  const year = await getActiveYear();

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

  const classroomIds = new Set(enrollments.map((e) => e.classroomId));
  return {
    tags: enrollments.map((e) => ({ studentId: e.studentId, classroomId: e.classroomId })),
    classroomId: classroomIds.size === 1 ? [...classroomIds][0] : null,
  };
}

module.exports = {
  getViewerScope,
  visibleTags,
  canViewPost,
  feedWhere,
  studentsVisibleTo,
  parentCanPost,
  resolvePostTags,
};
