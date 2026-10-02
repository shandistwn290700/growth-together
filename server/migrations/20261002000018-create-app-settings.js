'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Pengaturan aplikasi untuk seluruh sekolah (misalnya tema warna), disimpan sebagai key → value JSON.
    await queryInterface.createTable('AppSettings', {
      key: { type: Sequelize.STRING, primaryKey: true, allowNull: false },
      value: { type: Sequelize.JSONB, allowNull: false },
      createdAt: { allowNull: false, type: Sequelize.DATE },
      updatedAt: { allowNull: false, type: Sequelize.DATE },
    });
  },
  async down(queryInterface) {
    await queryInterface.dropTable('AppSettings');
  },
};
