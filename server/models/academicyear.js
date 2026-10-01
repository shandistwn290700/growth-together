'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class AcademicYear extends Model {
    static associate(models) {
      AcademicYear.hasMany(models.Classroom, { foreignKey: 'academicYearId' });
      AcademicYear.hasMany(models.Enrollment, { foreignKey: 'academicYearId' });
    }
  }

  AcademicYear.init(
    {
      name: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: { msg: 'Tahun ajaran sudah ada' },
        validate: { is: { args: /^\d{4}\/\d{4}$/, msg: 'Format tahun ajaran harus seperti 2026/2027' } },
      },
      startDate: { type: DataTypes.DATEONLY, allowNull: false },
      endDate: { type: DataTypes.DATEONLY, allowNull: false },
      isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    },
    { sequelize, modelName: 'AcademicYear' },
  );

  return AcademicYear;
};
