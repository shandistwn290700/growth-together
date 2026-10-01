'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Token yang dibuat sebelum waktu ini dianggap tidak berlaku,
    // sehingga reset password oleh admin langsung mengeluarkan sesi lama.
    await queryInterface.addColumn('Users', 'passwordChangedAt', {
      type: Sequelize.DATE,
      allowNull: false,
      defaultValue: Sequelize.fn('NOW'),
    });
  },
  async down(queryInterface) {
    await queryInterface.removeColumn('Users', 'passwordChangedAt');
  },
};
