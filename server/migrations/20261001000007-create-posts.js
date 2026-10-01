'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('Posts', {
      id: { allowNull: false, autoIncrement: true, primaryKey: true, type: Sequelize.INTEGER },
      authorId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'Users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      // Kelas saat postingan dibuat, agar timeline tetap terkelompok benar setelah siswa naik kelas.
      classroomId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'Classrooms', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      caption: { type: Sequelize.TEXT },
      createdAt: { allowNull: false, type: Sequelize.DATE },
      updatedAt: { allowNull: false, type: Sequelize.DATE },
    });
    // Feed diurutkan dari yang terbaru.
    await queryInterface.addIndex('Posts', ['classroomId', 'createdAt']);
  },
  async down(queryInterface) {
    await queryInterface.dropTable('Posts');
  },
};
