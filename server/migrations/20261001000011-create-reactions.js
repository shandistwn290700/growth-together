'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('Reactions', {
      id: { allowNull: false, autoIncrement: true, primaryKey: true, type: Sequelize.INTEGER },
      postId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'Posts', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      userId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'Users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      type: {
        type: Sequelize.ENUM('like', 'love', 'care', 'haha', 'wow', 'sad'),
        allowNull: false,
        defaultValue: 'like',
      },
      createdAt: { allowNull: false, type: Sequelize.DATE },
      updatedAt: { allowNull: false, type: Sequelize.DATE },
    });
    // Satu orang hanya bisa memberi satu reaksi per postingan (bisa diganti jenisnya).
    await queryInterface.addConstraint('Reactions', {
      fields: ['postId', 'userId'],
      type: 'unique',
      name: 'reactions_post_user_unique',
    });
  },
  async down(queryInterface) {
    await queryInterface.dropTable('Reactions');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_Reactions_type";');
  },
};
