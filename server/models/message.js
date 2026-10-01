'use strict';
const { Model } = require('sequelize');

// Batas panjang ciphertext (base64) — cukup untuk sekitar 4000 karakter teks.
const MAX_CIPHERTEXT = 24000;

module.exports = (sequelize, DataTypes) => {
  class Message extends Model {
    static associate(models) {
      Message.belongsTo(models.Conversation, { foreignKey: 'conversationId' });
      Message.belongsTo(models.User, { foreignKey: 'senderId', as: 'sender' });
    }

    toDto() {
      return {
        id: this.id,
        conversationId: this.conversationId,
        senderId: this.senderId,
        senderKeyId: this.senderKeyId,
        recipientKeyId: this.recipientKeyId,
        ciphertext: this.ciphertext,
        iv: this.iv,
        readAt: this.readAt,
        createdAt: this.createdAt,
      };
    }
  }

  Message.init(
    {
      conversationId: { type: DataTypes.INTEGER, allowNull: false },
      senderId: { type: DataTypes.INTEGER, allowNull: false },
      senderKeyId: { type: DataTypes.INTEGER, allowNull: false },
      recipientKeyId: { type: DataTypes.INTEGER, allowNull: false },
      ciphertext: {
        type: DataTypes.TEXT,
        allowNull: false,
        validate: {
          is: { args: /^[A-Za-z0-9+/=]+$/, msg: 'Format pesan tidak valid' },
          len: { args: [1, MAX_CIPHERTEXT], msg: 'Pesan terlalu panjang' },
        },
      },
      iv: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: { is: { args: /^[A-Za-z0-9+/=]{16}$/, msg: 'Format pesan tidak valid' } },
      },
      readAt: DataTypes.DATE,
    },
    { sequelize, modelName: 'Message' },
  );

  return Message;
};
