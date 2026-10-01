'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Kelas siswa saat ditandai. Postingan admin bisa menandai siswa dari beberapa kelas,
    // jadi kelas disimpan per tag, bukan per postingan.
    await queryInterface.addColumn('PostStudents', 'classroomId', {
      type: Sequelize.INTEGER,
      allowNull: false,
      references: { model: 'Classrooms', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'RESTRICT',
    });
    await queryInterface.addIndex('PostStudents', ['classroomId']);

    // Sekarang hanya informasi tambahan: diisi jika semua siswa yang ditandai berasal dari satu kelas.
    await queryInterface.changeColumn('Posts', 'classroomId', { type: Sequelize.INTEGER, allowNull: true });
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.changeColumn('Posts', 'classroomId', { type: Sequelize.INTEGER, allowNull: false });
    await queryInterface.removeColumn('PostStudents', 'classroomId');
  },
};
