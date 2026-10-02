'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  // Waktu login terakhir, untuk statistik di dashboard admin (pengguna aktif 7 hari terakhir).
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('Users', 'lastLoginAt', { type: Sequelize.DATE });
  },
  async down(queryInterface) {
    await queryInterface.removeColumn('Users', 'lastLoginAt');
  },
};
