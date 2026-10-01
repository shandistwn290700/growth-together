'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Student extends Model {
    static associate(models) {
      Student.hasOne(models.User, { foreignKey: 'studentId', as: 'parentAccount' });
      Student.hasMany(models.Enrollment, { foreignKey: 'studentId' });
      Student.belongsToMany(models.Classroom, { through: models.Enrollment, foreignKey: 'studentId' });
      Student.belongsToMany(models.Post, { through: models.PostStudent, foreignKey: 'studentId', as: 'taggedPosts' });
    }
  }

  Student.init(
    {
      nis: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: { msg: 'NIS sudah terdaftar' },
        validate: { notEmpty: { msg: 'NIS wajib diisi' } },
      },
      fullName: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: { notEmpty: { msg: 'Nama lengkap wajib diisi' } },
      },
      nickname: DataTypes.STRING,
      gender: {
        type: DataTypes.ENUM('L', 'P'),
        allowNull: false,
        validate: { isIn: { args: [['L', 'P']], msg: 'Jenis kelamin harus L atau P' } },
      },
      birthDate: DataTypes.DATEONLY,
      photoUrl: DataTypes.STRING,
      entryYear: {
        type: DataTypes.INTEGER,
        allowNull: false,
        validate: { isInt: { msg: 'Tahun masuk harus berupa angka' } },
      },
      status: {
        type: DataTypes.ENUM('active', 'graduated', 'inactive'),
        allowNull: false,
        defaultValue: 'active',
      },
    },
    { sequelize, modelName: 'Student' },
  );

  return Student;
};
