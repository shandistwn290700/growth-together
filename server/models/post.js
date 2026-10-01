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
      classroomId: DataTypes.INTEGER,
      caption: {
        type: DataTypes.TEXT,
        validate: { len: { args: [0, 5000], msg: 'Caption maksimal 5000 karakter' } },
      },
    },
    { sequelize, modelName: 'Post' },
  );

  return Post;
};
