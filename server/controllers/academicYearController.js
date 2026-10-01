const { AcademicYear, sequelize } = require('../models');

class AcademicYearController {
  static async list(req, res) {
    const years = await AcademicYear.findAll({ order: [['startDate', 'DESC']] });
    res.json(years);
  }

  static async create(req, res) {
    const { name, startDate, endDate } = req.body ?? {};
    if (!startDate || !endDate || startDate >= endDate) {
      throw { name: 'BadRequest', message: 'Tanggal mulai harus sebelum tanggal selesai' };
    }
    const year = await AcademicYear.create({ name, startDate, endDate, isActive: false });
    res.status(201).json(year);
  }

  // Hanya satu tahun ajaran yang aktif dalam satu waktu.
  static async activate(req, res) {
    const year = await AcademicYear.findByPk(req.params.id);
    if (!year) throw { name: 'NotFound', message: 'Tahun ajaran tidak ditemukan' };

    await sequelize.transaction(async (transaction) => {
      await AcademicYear.update({ isActive: false }, { where: { isActive: true }, transaction });
      await year.update({ isActive: true }, { transaction });
    });
    res.json(year);
  }
}

module.exports = AcademicYearController;
