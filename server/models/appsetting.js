'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class AppSetting extends Model {}

  AppSetting.init(
    {
      key: { type: DataTypes.STRING, primaryKey: true, allowNull: false },
      value: { type: DataTypes.JSONB, allowNull: false },
    },
    { sequelize, modelName: 'AppSetting' },
  );

  return AppSetting;
};
