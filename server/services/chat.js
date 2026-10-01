// Aturan chat: hanya guru ↔ orang tua, dan hanya jika guru itu wali kelas anaknya
// di tahun ajaran aktif. Percakapan lama tetap bisa dibaca setelah siswa naik kelas,
// tapi tidak bisa dibalas lagi.
const { AcademicYear, Classroom, ClassroomTeacher, Enrollment, Student, User } = require('../models');
const { authorInclude, authorDto } = require('./postView');

const CHAT_ROLES = ['teacher', 'parent'];

function assertChatRole(user) {
  if (!CHAT_ROLES.includes(user.role)) {
    throw { name: 'Forbidden', message: 'Chat hanya tersedia untuk guru dan orang tua' };
  }
}

// Daftar orang yang boleh diajak chat oleh user, beserta keterangan kelasnya.
// Hasil: Map<userId, { user, classLabels: string[] }>
async function getContacts(user) {
  assertChatRole(user);
  const year = await AcademicYear.findOne({ where: { isActive: true } });
  const contacts = new Map();
  if (!year) return contacts;

  const add = (contactUser, label) => {
    if (!contactUser?.isActive) return;
    const entry = contacts.get(contactUser.id) ?? { user: contactUser, classLabels: [] };
    if (!entry.classLabels.includes(label)) entry.classLabels.push(label);
    contacts.set(contactUser.id, entry);
  };

  if (user.role === 'parent') {
    if (user.student?.status !== 'active') return contacts;
    const enrollment = await Enrollment.findOne({
      where: { studentId: user.studentId, academicYearId: year.id },
      include: { model: Classroom, include: { model: User, as: 'teachers', through: { attributes: [] }, ...withAuthorFields() } },
    });
    enrollment?.Classroom.teachers.forEach((t) => add(t, `Wali ${enrollment.Classroom.label}`));
    return contacts;
  }

  const classrooms = await Classroom.findAll({
    where: { academicYearId: year.id },
    include: [
      { model: ClassroomTeacher, where: { teacherId: user.id }, attributes: [] },
      {
        model: Enrollment,
        include: { model: Student, where: { status: 'active' }, include: { model: User, as: 'parentAccount', ...withAuthorFields() } },
      },
    ],
  });
  classrooms.forEach((c) => c.Enrollments.forEach((e) => add(e.Student.parentAccount, c.label)));
  return contacts;
}

// Atribut user yang sama dengan penulis postingan (nama tampilan, foto, siswa).
function withAuthorFields() {
  const { attributes, include } = authorInclude();
  return { attributes: [...attributes, 'isActive'], include };
}

async function canChatWith(user, otherUserId) {
  return (await getContacts(user)).has(otherUserId);
}

function contactDto({ user, classLabels }) {
  return { ...authorDto(user), subtitle: classLabels.join(', ') };
}

module.exports = { CHAT_ROLES, assertChatRole, getContacts, canChatWith, contactDto };
