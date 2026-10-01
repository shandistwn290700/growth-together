'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Isi pesan hanya tersimpan dalam bentuk terenkripsi (AES-GCM). Server tidak pernah melihat teks aslinya.
    await queryInterface.createTable('Messages', {
      id: { allowNull: false, autoIncrement: true, primaryKey: true, type: Sequelize.INTEGER },
      conversationId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'Conversations', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      senderId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'Users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      // Kunci yang dipakai saat pesan dienkripsi, agar pesan lama tetap bisa dibuka
      // (atau diketahui tidak bisa dibuka) setelah kunci seseorang berganti.
      senderKeyId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'ChatKeys', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      recipientKeyId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'ChatKeys', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      ciphertext: { type: Sequelize.TEXT, allowNull: false },
      iv: { type: Sequelize.STRING, allowNull: false },
      readAt: { type: Sequelize.DATE },
      createdAt: { allowNull: false, type: Sequelize.DATE },
      updatedAt: { allowNull: false, type: Sequelize.DATE },
    });
    await queryInterface.addIndex('Messages', ['conversationId', 'id']);
  },
  async down(queryInterface) {
    await queryInterface.dropTable('Messages');
  },
};
