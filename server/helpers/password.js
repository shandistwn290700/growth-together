const { randomInt } = require('crypto');

// Tanpa karakter yang mudah tertukar (0/O, 1/l/I) karena password ini dibagikan lewat kertas/WhatsApp.
const ALPHABET = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';

const generateTempPassword = (length = 10) =>
  Array.from({ length }, () => ALPHABET[randomInt(ALPHABET.length)]).join('');

module.exports = { generateTempPassword };
