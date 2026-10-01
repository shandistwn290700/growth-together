'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Percakapan selalu antara satu guru dan satu orang tua.
    await queryInterface.createTable('Conversations', {
      id: { allowNull: false, autoIncrement: true, primaryKey: true, type: Sequelize.INTEGER },
      teacherId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'Users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      parentId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'Users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      lastMessageAt: { type: Sequelize.DATE },
      createdAt: { allowNull: false, type: Sequelize.DATE },
      updatedAt: { allowNull: false, type: Sequelize.DATE },
    });
    await queryInterface.addConstraint('Conversations', {
      fields: ['teacherId', 'parentId'],
      type: 'unique',
      name: 'conversations_teacher_parent_unique',
    });
    await queryInterface.addIndex('Conversations', ['parentId']);
  },
  async down(queryInterface) {
    await queryInterface.dropTable('Conversations');
  },
};
