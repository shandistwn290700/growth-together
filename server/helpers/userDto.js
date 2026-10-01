const { photoUrl } = require('./media');

// Bentuk data user yang dikirim ke client.
// Akun orang tua ditampilkan dengan nama dan foto anaknya.
module.exports = (user) => {
  const student = user.student;
  return {
    id: user.id,
    username: user.username,
    role: user.role,
    mustChangePassword: user.mustChangePassword,
    displayName: user.role === 'parent' ? student?.fullName : user.fullName,
    avatarUrl: photoUrl(user.role === 'parent' ? student?.photoPublicId : user.avatarPublicId),
    student: student
      ? {
          id: student.id,
          nis: student.nis,
          fullName: student.fullName,
          nickname: student.nickname,
          status: student.status,
        }
      : null,
  };
};
