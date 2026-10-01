'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Kunci enkripsi chat per user. Kunci privat disimpan dalam keadaan terkunci (dienkripsi
    // di browser dengan kunci turunan password), jadi server tidak bisa membacanya.
    await queryInterface.createTable('ChatKeys', {
      id: { allowNull: false, autoIncrement: true, primaryKey: true, type: Sequelize.INTEGER },
      userId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'Users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      publicKey: { type: Sequelize.TEXT, allowNull: false }, // JWK (JSON)
      // Null setelah password di-reset admin: kunci lama tidak bisa dibuka lagi,
      // tapi kunci publiknya tetap disimpan untuk riwayat.
      wrappedPrivateKey: { type: Sequelize.TEXT },
      salt: { type: Sequelize.STRING },
      iv: { type: Sequelize.STRING },
      iterations: { type: Sequelize.INTEGER },
      isActive: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      createdAt: { allowNull: false, type: Sequelize.DATE },
      updatedAt: { allowNull: false, type: Sequelize.DATE },
    });
    await queryInterface.addIndex('ChatKeys', ['userId', 'isActive']);
  },
  async down(queryInterface) {
    await queryInterface.dropTable('ChatKeys');
  },
};
