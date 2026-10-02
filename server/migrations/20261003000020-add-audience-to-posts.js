'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  // Sasaran postingan: 'tagged' (momen siswa yang ditandai), atau pengumuman admin untuk
  // 'classes' (kelas tertentu) / 'school' (seluruh sekolah).
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('Posts', 'audience', {
      type: Sequelize.STRING(10),
      allowNull: false,
      defaultValue: 'tagged',
    });
  },
  async down(queryInterface) {
    await queryInterface.removeColumn('Posts', 'audience');
  },
};
