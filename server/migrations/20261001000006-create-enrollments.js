'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Riwayat kelas siswa. Saat naik kelas, baris lama TIDAK diubah kelasnya;
    // statusnya ditutup dan dibuat baris baru untuk tahun ajaran berikutnya.
    await queryInterface.createTable('Enrollments', {
      id: { allowNull: false, autoIncrement: true, primaryKey: true, type: Sequelize.INTEGER },
      studentId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'Students', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      classroomId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'Classrooms', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      // Disimpan juga di sini agar satu siswa hanya punya satu kelas per tahun ajaran.
      academicYearId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'AcademicYears', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      status: {
        type: Sequelize.ENUM('active', 'promoted', 'retained', 'graduated', 'moved'),
        allowNull: false,
        defaultValue: 'active',
      },
      createdAt: { allowNull: false, type: Sequelize.DATE },
      updatedAt: { allowNull: false, type: Sequelize.DATE },
    });
    await queryInterface.addConstraint('Enrollments', {
      fields: ['studentId', 'academicYearId'],
      type: 'unique',
      name: 'enrollments_student_year_unique',
    });
  },
  async down(queryInterface) {
    await queryInterface.dropTable('Enrollments');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_Enrollments_status";');
  },
};
