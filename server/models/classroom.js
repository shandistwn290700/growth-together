'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Classroom extends Model {
    static associate(models) {
      Classroom.belongsTo(models.AcademicYear, { foreignKey: 'academicYearId' });
      Classroom.belongsToMany(models.User, {
        through: models.ClassroomTeacher,
        foreignKey: 'classroomId',
        otherKey: 'teacherId',
        as: 'teachers',
      });
      Classroom.hasMany(models.ClassroomTeacher, { foreignKey: 'classroomId' });
      Classroom.hasMany(models.Enrollment, { foreignKey: 'classroomId' });
      Classroom.belongsToMany(models.Student, { through: models.Enrollment, foreignKey: 'classroomId' });
      Classroom.hasMany(models.Post, { foreignKey: 'classroomId' });
    }

    // Contoh: "Kelas 3 Abu Bakar"
    get label() {
      return `Kelas ${this.grade} ${this.name}`;
    }
  }

  Classroom.init(
    {
      academicYearId: { type: DataTypes.INTEGER, allowNull: false },
      grade: {
        type: DataTypes.INTEGER,
        allowNull: false,
        validate: {
          min: { args: [1], msg: 'Tingkat kelas SD antara 1 sampai 6' },
          max: { args: [6], msg: 'Tingkat kelas SD antara 1 sampai 6' },
        },
      },
      name: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: { notEmpty: { msg: 'Nama kelas wajib diisi' } },
      },
    },
    { sequelize, modelName: 'Classroom' },
  );

  return Classroom;
};
