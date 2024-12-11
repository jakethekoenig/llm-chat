'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('messages', 'model', {
      type: Sequelize.STRING,
      allowNull: false,
      defaultValue: 'gpt-4',
    });
    await queryInterface.addColumn('messages', 'temperature', {
      type: Sequelize.FLOAT,
      allowNull: false,
      defaultValue: 0.7,
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('messages', 'model');
    await queryInterface.removeColumn('messages', 'temperature');
  }
};