'use strict';
const { Model } = require('sequelize');

const REACTION_TYPES = ['like', 'love', 'care', 'haha', 'wow', 'sad'];

module.exports = (sequelize, DataTypes) => {
  class Reaction extends Model {
    static associate(models) {
      Reaction.belongsTo(models.Post, { foreignKey: 'postId' });
      Reaction.belongsTo(models.User, { foreignKey: 'userId', as: 'user' });
    }
  }

  Reaction.init(
    {
      postId: { type: DataTypes.INTEGER, allowNull: false },
      userId: { type: DataTypes.INTEGER, allowNull: false },
      type: {
        type: DataTypes.ENUM(...REACTION_TYPES),
        allowNull: false,
        defaultValue: 'like',
        validate: { isIn: { args: [REACTION_TYPES], msg: 'Jenis reaksi tidak valid' } },
      },
    },
    { sequelize, modelName: 'Reaction' },
  );

  return Reaction;
};
