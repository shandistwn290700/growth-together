'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class PostStudent extends Model {
    static associate(models) {
      PostStudent.belongsTo(models.Post, { foreignKey: 'postId' });
      PostStudent.belongsTo(models.Student, { foreignKey: 'studentId' });
      PostStudent.belongsTo(models.Classroom, { foreignKey: 'classroomId' });
    }
  }

  PostStudent.init(
    {
      postId: { type: DataTypes.INTEGER, allowNull: false },
      studentId: { type: DataTypes.INTEGER, allowNull: false },
      classroomId: { type: DataTypes.INTEGER, allowNull: false },
    },
    { sequelize, modelName: 'PostStudent' },
  );

  return PostStudent;
};
