'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('Classrooms', {
      id: { allowNull: false, autoIncrement: true, primaryKey: true, type: Sequelize.INTEGER },
      academicYearId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'AcademicYears', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      grade: { type: Sequelize.INTEGER, allowNull: false }, // 1-6
      name: { type: Sequelize.STRING, allowNull: false }, // contoh: "Abu Bakar"
      createdAt: { allowNull: false, type: Sequelize.DATE },
      updatedAt: { allowNull: false, type: Sequelize.DATE },
    });
    await queryInterface.addConstraint('Classrooms', {
      fields: ['academicYearId', 'grade', 'name'],
      type: 'unique',
      name: 'classrooms_year_grade_name_unique',
    });
  },
  async down(queryInterface) {
    await queryInterface.dropTable('Classrooms');
  },
};
