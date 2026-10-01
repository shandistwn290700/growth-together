'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class PostMedia extends Model {
    static associate(models) {
      PostMedia.belongsTo(models.Post, { foreignKey: 'postId' });
    }
  }

  PostMedia.init(
    {
      postId: { type: DataTypes.INTEGER, allowNull: false },
      type: {
        type: DataTypes.ENUM('image', 'video'),
        allowNull: false,
        validate: { isIn: { args: [['image', 'video']], msg: 'Media harus berupa foto atau video' } },
      },
      publicId: { type: DataTypes.STRING, allowNull: false },
      width: DataTypes.INTEGER,
      height: DataTypes.INTEGER,
      duration: DataTypes.FLOAT,
      position: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    },
    { sequelize, modelName: 'PostMedia', tableName: 'PostMedia' },
  );

  return PostMedia;
};
