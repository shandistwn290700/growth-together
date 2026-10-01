'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class ChatKey extends Model {
    static associate(models) {
      ChatKey.belongsTo(models.User, { foreignKey: 'userId' });
    }

    // Data publik yang boleh dilihat lawan bicara.
    toPublic() {
      return { id: this.id, userId: this.userId, publicKey: this.publicKey };
    }
  }

  ChatKey.init(
    {
      userId: { type: DataTypes.INTEGER, allowNull: false },
      publicKey: { type: DataTypes.TEXT, allowNull: false },
      wrappedPrivateKey: DataTypes.TEXT,
      salt: DataTypes.STRING,
      iv: DataTypes.STRING,
      iterations: DataTypes.INTEGER,
      isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    },
    { sequelize, modelName: 'ChatKey' },
  );

  return ChatKey;
};
