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
      // 'tagged' = momen siswa yang ditandai; 'classes' / 'school' = pengumuman admin.
      audience: {
        type: DataTypes.STRING(10),
        allowNull: false,
        defaultValue: 'tagged',
        validate: { isIn: { args: [['tagged', 'classes', 'school']], msg: 'Sasaran postingan tidak dikenal' } },
      },
      caption: {
        type: DataTypes.TEXT,
        validate: { len: { args: [0, 5000], msg: 'Caption maksimal 5000 karakter' } },
      },
    },
    { sequelize, modelName: 'Post' },
  );

  return Post;
};
