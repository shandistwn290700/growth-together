'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Post extends Model {
    static associate(models) {
      Post.belongsTo(models.User, { foreignKey: 'authorId', as: 'author' });
      Post.belongsTo(models.Classroom, { foreignKey: 'classroomId' });
      Post.hasMany(models.PostMedia, { foreignKey: 'postId', as: 'media' });
      Post.belongsToMany(models.Student, { through: models.PostStudent, foreignKey: 'postId', as: 'taggedStudents' });
      Post.hasMany(models.PostStudent, { foreignKey: 'postId' });
      Post.hasMany(models.Comment, { foreignKey: 'postId', as: 'comments' });
      Post.hasMany(models.Reaction, { foreignKey: 'postId', as: 'reactions' });
    }
  }

  Post.init(
    {
      authorId: { type: DataTypes.INTEGER, allowNull: false },
      classroomId: { type: DataTypes.INTEGER, allowNull: false },
      caption: DataTypes.TEXT,
    },
    { sequelize, modelName: 'Post' },
  );

  return Post;
};
