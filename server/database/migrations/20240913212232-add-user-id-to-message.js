'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Add user_id column to Conversations table
    await queryInterface.addColumn('Conversations', 'user_id', {
      type: Sequelize.INTEGER,
      allowNull: false,
    });

    // Add model column to Messages table
    await queryInterface.addColumn('Messages', 'model', {
      type: Sequelize.STRING,
      allowNull: true,
    });

    // Add temperature column to Messages table
    await queryInterface.addColumn('Messages', 'temperature', {
      type: Sequelize.FLOAT,
      allowNull: true,
    });
  },

  async down(queryInterface, Sequelize) {
    // Remove user_id column from Conversations table
    await queryInterface.removeColumn('Conversations', 'user_id');

    // Remove model column from Messages table
    await queryInterface.removeColumn('Messages', 'model');

    // Remove temperature column from Messages table
    await queryInterface.removeColumn('Messages', 'temperature');
  }
};
