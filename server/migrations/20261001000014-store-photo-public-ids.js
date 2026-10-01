'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  // Foto profil disimpan sebagai ID file Cloudinary (privat), bukan URL publik.
  // URL bertanda tangan dibuat saat data dikirim ke user yang berhak.
  async up(queryInterface) {
    await queryInterface.renameColumn('Students', 'photoUrl', 'photoPublicId');
    await queryInterface.renameColumn('Users', 'avatarUrl', 'avatarPublicId');
  },
  async down(queryInterface) {
    await queryInterface.renameColumn('Students', 'photoPublicId', 'photoUrl');
    await queryInterface.renameColumn('Users', 'avatarPublicId', 'avatarUrl');
  },
};
