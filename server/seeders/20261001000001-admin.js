'use strict';
require('dotenv').config({ quiet: true });
const { hashPassword } = require('../helpers/bcrypt');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  // Aman dijalankan berulang kali (misalnya setiap server produksi menyala):
  // akun admin hanya dibuat jika belum ada admin sama sekali.
  async up(queryInterface) {
    const [admins] = await queryInterface.sequelize.query(`SELECT id FROM "Users" WHERE role = 'admin' LIMIT 1`);
    if (admins.length > 0) {
      console.log('Akun admin sudah ada, seeder dilewati.');
      return;
    }

    const username = (process.env.SEED_ADMIN_USERNAME || 'admin').trim().toLowerCase();
    const password = process.env.SEED_ADMIN_PASSWORD;
    if (!password || password.length < 8) {
      throw new Error('Isi SEED_ADMIN_PASSWORD (minimal 8 karakter) di .env sebelum menjalankan seeder');
    }

    const now = new Date();
    await queryInterface.bulkInsert('Users', [
      {
        username,
        password: await hashPassword(password),
        role: 'admin',
        fullName: 'Administrator',
        mustChangePassword: true,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      },
    ]);
  },
  async down(queryInterface) {
    await queryInterface.bulkDelete('Users', { username: (process.env.SEED_ADMIN_USERNAME || 'admin').trim().toLowerCase() });
  },
};
