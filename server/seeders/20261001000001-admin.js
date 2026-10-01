'use strict';
require('dotenv').config({ quiet: true });
const { hashPassword } = require('../helpers/bcrypt');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const username = process.env.SEED_ADMIN_USERNAME || 'admin';
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
    await queryInterface.bulkDelete('Users', { username: process.env.SEED_ADMIN_USERNAME || 'admin' });
  },
};
