'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class ClassroomTeacher extends Model {
    static associate(models) {
      ClassroomTeacher.belongsTo(models.Classroom, { foreignKey: 'classroomId' });
      ClassroomTeacher.belongsTo(models.User, { foreignKey: 'teacherId', as: 'teacher' });
    }
  }

  ClassroomTeacher.init(
    {
      classroomId: { type: DataTypes.INTEGER, allowNull: false },
      teacherId: { type: DataTypes.INTEGER, allowNull: false },
    },
    { sequelize, modelName: 'ClassroomTeacher' },
  );

  return ClassroomTeacher;
};
