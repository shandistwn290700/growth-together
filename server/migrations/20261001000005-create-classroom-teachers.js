'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Satu kelas bisa punya lebih dari satu wali kelas.
    await queryInterface.createTable('ClassroomTeachers', {
      id: { allowNull: false, autoIncrement: true, primaryKey: true, type: Sequelize.INTEGER },
      classroomId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'Classrooms', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      teacherId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'Users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      createdAt: { allowNull: false, type: Sequelize.DATE },
      updatedAt: { allowNull: false, type: Sequelize.DATE },
    });
    await queryInterface.addConstraint('ClassroomTeachers', {
      fields: ['classroomId', 'teacherId'],
      type: 'unique',
      name: 'classroom_teachers_unique',
    });
  },
  async down(queryInterface) {
    await queryInterface.dropTable('ClassroomTeachers');
  },
};
