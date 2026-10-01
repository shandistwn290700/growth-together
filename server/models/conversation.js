'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Conversation extends Model {
    static associate(models) {
      Conversation.belongsTo(models.User, { foreignKey: 'teacherId', as: 'teacher' });
      Conversation.belongsTo(models.User, { foreignKey: 'parentId', as: 'parent' });
      Conversation.hasMany(models.Message, { foreignKey: 'conversationId', as: 'messages' });
    }

    hasParticipant(userId) {
      return this.teacherId === userId || this.parentId === userId;
    }

    otherParticipantId(userId) {
      return this.teacherId === userId ? this.parentId : this.teacherId;
    }
  }

  Conversation.init(
    {
      teacherId: { type: DataTypes.INTEGER, allowNull: false },
      parentId: { type: DataTypes.INTEGER, allowNull: false },
      lastMessageAt: DataTypes.DATE,
    },
    { sequelize, modelName: 'Conversation' },
  );

  return Conversation;
};
