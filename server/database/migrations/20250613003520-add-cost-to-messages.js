'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    // Add cost column to Messages table
    await queryInterface.addColumn('Messages', 'cost', {
      type: Sequelize.DECIMAL(10, 6),
      allowNull: true,
      comment: 'Cost in USD for API call to generate this message'
    });
  },

  async down (queryInterface, Sequelize) {
    // Remove cost column from Messages table
    await queryInterface.removeColumn('Messages', 'cost');
  }
};
