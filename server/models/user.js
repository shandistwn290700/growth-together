'use strict';
const { Model } = require('sequelize');
const { hashPassword } = require('../helpers/bcrypt');

module.exports = (sequelize, DataTypes) => {
  class User extends Model {
    static associate(models) {
      User.belongsTo(models.Student, { foreignKey: 'studentId', as: 'student' });
      User.belongsToMany(models.Classroom, {
        through: models.ClassroomTeacher,
        foreignKey: 'teacherId',
        otherKey: 'classroomId',
        as: 'teachingClassrooms',
      });
      User.hasMany(models.Post, { foreignKey: 'authorId', as: 'posts' });
    }

    // Jangan pernah kirim hash password ke client.
    toJSON() {
      const { password, ...rest } = this.get();
      return rest;
    }
  }

  User.init(
    {
      username: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: { msg: 'Username sudah dipakai' },
        validate: { notEmpty: { msg: 'Username wajib diisi' } },
      },
      password: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
          notEmpty: { msg: 'Password wajib diisi' },
          len: { args: [8, 128], msg: 'Password minimal 8 karakter' },
        },
      },
      role: {
        type: DataTypes.ENUM('admin', 'teacher', 'parent'),
        allowNull: false,
        validate: { isIn: { args: [['admin', 'teacher', 'parent']], msg: 'Role tidak valid' } },
      },
      fullName: DataTypes.STRING,
      studentId: DataTypes.INTEGER,
      avatarUrl: DataTypes.STRING,
      mustChangePassword: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    },
    {
      sequelize,
      modelName: 'User',
      validate: {
        parentMustHaveStudent() {
          if (this.role === 'parent' && !this.studentId) {
            throw new Error('Akun orang tua harus terhubung dengan data siswa');
          }
          if (this.role !== 'parent' && !this.fullName) {
            throw new Error('Nama lengkap wajib diisi untuk guru dan admin');
          }
        },
      },
      hooks: {
        async beforeSave(user) {
          if (user.changed('password')) {
            user.password = await hashPassword(user.password);
          }
        },
      },
    },
  );

  return User;
};
