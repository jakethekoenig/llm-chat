// server/database/seeders/20240913212233-add-sample-messages.js
'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Add sample conversations
    const conversations = await queryInterface.bulkInsert('Conversations', [
      { title: 'Sample Conversation 1', user_id: 1, createdAt: new Date(), updatedAt: new Date() },
      { title: 'Sample Conversation 2', user_id: 2, createdAt: new Date(), updatedAt: new Date() },
    ], { returning: true });

    // Add sample messages
    await queryInterface.bulkInsert('Messages', [
      { content: 'Sample Message 1', conversation_id: conversations[0].id, user_id: 1, createdAt: new Date(), updatedAt: new Date() },
      { content: 'Sample Message 2', conversation_id: conversations[1].id, user_id: 2, createdAt: new Date(), updatedAt: new Date() },
    ]);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete('Messages', null, {});
    await queryInterface.bulkDelete('Conversations', null, {});
  }
};