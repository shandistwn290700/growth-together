'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('Students', {
      id: { allowNull: false, autoIncrement: true, primaryKey: true, type: Sequelize.INTEGER },
      nis: { type: Sequelize.STRING, allowNull: false, unique: true },
      fullName: { type: Sequelize.STRING, allowNull: false },
      nickname: { type: Sequelize.STRING },
      gender: { type: Sequelize.ENUM('L', 'P'), allowNull: false },
      birthDate: { type: Sequelize.DATEONLY },
      photoUrl: { type: Sequelize.STRING },
      entryYear: { type: Sequelize.INTEGER, allowNull: false },
      // active = masih bersekolah, graduated = lulus kelas 6, inactive = pindah/keluar
      status: { type: Sequelize.ENUM('active', 'graduated', 'inactive'), allowNull: false, defaultValue: 'active' },
      createdAt: { allowNull: false, type: Sequelize.DATE },
      updatedAt: { allowNull: false, type: Sequelize.DATE },
    });
  },
  async down(queryInterface) {
    await queryInterface.dropTable('Students');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_Students_gender";');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_Students_status";');
  },
};
