'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Enrollment extends Model {
    static associate(models) {
      Enrollment.belongsTo(models.Student, { foreignKey: 'studentId' });
      Enrollment.belongsTo(models.Classroom, { foreignKey: 'classroomId' });
      Enrollment.belongsTo(models.AcademicYear, { foreignKey: 'academicYearId' });
    }
  }

  Enrollment.init(
    {
      studentId: { type: DataTypes.INTEGER, allowNull: false },
      classroomId: { type: DataTypes.INTEGER, allowNull: false },
      academicYearId: { type: DataTypes.INTEGER, allowNull: false },
      status: {
        type: DataTypes.ENUM('active', 'promoted', 'retained', 'graduated', 'moved'),
        allowNull: false,
        defaultValue: 'active',
      },
    },
    { sequelize, modelName: 'Enrollment' },
  );

  return Enrollment;
};
