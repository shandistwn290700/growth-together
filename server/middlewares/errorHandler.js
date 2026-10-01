// Error yang sengaja dilempar dari controller: throw { name: 'NotFound', message: '...' }
const KNOWN_ERRORS = {
  BadRequest: 400,
  Unauthorized: 401,
  Forbidden: 403,
  NotFound: 404,
};

// eslint-disable-next-line no-unused-vars
module.exports = (err, req, res, next) => {
  if (err.name === 'SequelizeValidationError' || err.name === 'SequelizeUniqueConstraintError') {
    return res.status(400).json({ message: err.errors[0].message, errors: err.errors.map((e) => e.message) });
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
