'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Comment extends Model {
    static associate(models) {
      Comment.belongsTo(models.Post, { foreignKey: 'postId' });
      Comment.belongsTo(models.User, { foreignKey: 'authorId', as: 'author' });
      Comment.belongsTo(models.Student, { foreignKey: 'studentId' });
      Comment.belongsTo(models.Comment, { foreignKey: 'parentId', as: 'parent' });
      Comment.hasMany(models.Comment, { foreignKey: 'parentId', as: 'replies' });
    }
  }

  Comment.init(
    {
      postId: { type: DataTypes.INTEGER, allowNull: false },
      authorId: { type: DataTypes.INTEGER, allowNull: false },
      studentId: { type: DataTypes.INTEGER, allowNull: false },
      parentId: DataTypes.INTEGER,
      content: {
        type: DataTypes.TEXT,
        allowNull: false,
        validate: {
          notEmpty: { msg: 'Komentar tidak boleh kosong' },
          len: { args: [1, 2000], msg: 'Komentar maksimal 2000 karakter' },
        },
      },
    },
    { sequelize, modelName: 'Comment' },
  );

  return Comment;
};
