'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('PostMedia', {
      id: { allowNull: false, autoIncrement: true, primaryKey: true, type: Sequelize.INTEGER },
      postId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'Posts', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      type: { type: Sequelize.ENUM('image', 'video'), allowNull: false },
      // ID file di Cloudinary. URL tayang dibuat (dan ditandatangani) saat dibutuhkan,
      // jadi tidak ada URL publik permanen yang tersimpan.
      publicId: { type: Sequelize.STRING, allowNull: false },
      width: { type: Sequelize.INTEGER },
      height: { type: Sequelize.INTEGER },
      duration: { type: Sequelize.FLOAT }, // detik, khusus video
      position: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      createdAt: { allowNull: false, type: Sequelize.DATE },
      updatedAt: { allowNull: false, type: Sequelize.DATE },
    });
  },
  async down(queryInterface) {
    await queryInterface.dropTable('PostMedia');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_PostMedia_type";');
  },
};
