// Periode laporan: bulanan (YYYY-MM) atau semester (ganjil Jul–Des / genap Jan–Jun) dari sebuah tahun ajaran.
// Batas waktu memakai zona waktu sekolah (default WIB, +07:00), bukan zona waktu server.
const { Op } = require('sequelize');
const { AcademicYear } = require('../models');

const OFFSET = process.env.REPORT_UTC_OFFSET || '+07:00';
const at = (year, month) => new Date(`${year}-${String(month).padStart(2, '0')}-01T00:00:00${OFFSET}`);
const MONTHS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

async function yearContaining(dateOnly) {
  return (
    (await AcademicYear.findOne({ where: { startDate: { [Op.lte]: dateOnly }, endDate: { [Op.gte]: dateOnly } } })) ??
    (await AcademicYear.findOne({ where: { isActive: true } }))
  );
}

/**
 * query: { type: 'month', month: '2026-10' } atau { type: 'semester', academicYearId, half: 'ganjil' | 'genap' }
 * Hasil: { type, label, slug, start, end, academicYear } — end bersifat eksklusif.
 */
async function parsePeriod(query = {}) {
  if (query.type === 'month') {
    const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(query.month ?? '');
    if (!match) throw { name: 'BadRequest', message: 'Pilih bulan laporan' };
    const year = Number(match[1]);
    const month = Number(match[2]);
    return {
      type: 'month',
      label: `${MONTHS[month - 1]} ${year}`,
      slug: `${year}-${match[2]}`,
      start: at(year, month),
      end: month === 12 ? at(year + 1, 1) : at(year, month + 1),
      academicYear: await yearContaining(`${year}-${match[2]}-01`),
    };
  }

  if (query.type === 'semester') {
    const academicYear = await AcademicYear.findByPk(Number(query.academicYearId) || 0);
    if (!academicYear) throw { name: 'BadRequest', message: 'Pilih tahun ajaran' };
    if (!['ganjil', 'genap'].includes(query.half)) throw { name: 'BadRequest', message: 'Pilih semester ganjil atau genap' };
    const firstYear = Number(academicYear.name.slice(0, 4));
    const ganjil = query.half === 'ganjil';
    return {
      type: 'semester',
      label: `Semester ${ganjil ? 'Ganjil' : 'Genap'} ${academicYear.name}`,
      slug: `${academicYear.name.replace('/', '-')}-${query.half}`,
      start: ganjil ? at(firstYear, 7) : at(firstYear + 1, 1),
      end: ganjil ? at(firstYear + 1, 1) : at(firstYear + 1, 7),
      academicYear,
    };
  }

  throw { name: 'BadRequest', message: 'Jenis laporan harus bulanan atau semester' };
}

module.exports = { parsePeriod, MONTHS };
