'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Siswa yang ditandai di postingan. Postingan hanya terlihat oleh orang tua
    // siswa yang ditandai, guru kelasnya, dan admin.
    await queryInterface.createTable('PostStudents', {
      id: { allowNull: false, autoIncrement: true, primaryKey: true, type: Sequelize.INTEGER },
      postId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'Posts', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      studentId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'Students', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      createdAt: { allowNull: false, type: Sequelize.DATE },
      updatedAt: { allowNull: false, type: Sequelize.DATE },
    });
    await queryInterface.addConstraint('PostStudents', {
      fields: ['postId', 'studentId'],
      type: 'unique',
      name: 'post_students_unique',
    });
    await queryInterface.addIndex('PostStudents', ['studentId']);
  },
  async down(queryInterface) {
    await queryInterface.dropTable('PostStudents');
  },
};
