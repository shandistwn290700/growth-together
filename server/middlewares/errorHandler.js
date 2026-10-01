// Error yang sengaja dilempar dari controller: throw { name: 'NotFound', message: '...' }
const KNOWN_ERRORS = {
  BadRequest: 400,
  Unauthorized: 401,
  Forbidden: 403,
  NotFound: 404,
  Conflict: 409,
};

// Pesan untuk constraint unik gabungan (dibuat di migrasi, jadi tidak punya pesan bawaan di model).
const CONSTRAINT_MESSAGES = {
  classrooms_year_grade_name_unique: 'Kelas dengan tingkat dan nama ini sudah ada di tahun ajaran tersebut',
  enrollments_student_year_unique: 'Siswa sudah terdaftar di kelas lain pada tahun ajaran tersebut',
  classroom_teachers_unique: 'Guru sudah menjadi wali kelas ini',
};

// eslint-disable-next-line no-unused-vars
module.exports = (err, req, res, next) => {
  const constraintMessage = CONSTRAINT_MESSAGES[err.parent?.constraint];
  if (err.name === 'SequelizeUniqueConstraintError' && constraintMessage) {
    return res.status(400).json({ message: constraintMessage });
  }
  if (err.name === 'SequelizeValidationError' || err.name === 'SequelizeUniqueConstraintError') {
    return res.status(400).json({ message: err.errors[0].message, errors: err.errors.map((e) => e.message) });
  }
  if (err.name === 'MulterError') {
    const message = err.code === 'LIMIT_FILE_SIZE' ? 'Ukuran file terlalu besar' : 'Upload file gagal';
    return res.status(400).json({ message });
  }
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ message: 'Format data tidak valid' });
  }
  if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    return res.status(401).json({ message: 'Sesi tidak valid, silakan login kembali' });
  }
  if (KNOWN_ERRORS[err.name]) {
    return res.status(KNOWN_ERRORS[err.name]).json({ message: err.message });
  }

  console.error(err);
  res.status(500).json({ message: 'Terjadi kesalahan pada server' });
};
