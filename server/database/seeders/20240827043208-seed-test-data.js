'use strict';

import { User, Conversation, Message } from '../models';

export async function up(queryInterface, Sequelize) {
  // Create Users
  const users = await User.bulkCreate([
    { username: 'testuser1', email: 'test1@example.com', hashed_password: 'hashedpassword1' },
    { username: 'testuser2', email: 'test2@example.com', hashed_password: 'hashedpassword2' }
  ]);

  // Create Conversations
  const conversations = await Conversation.bulkCreate([
    { title: 'Test Conversation 1' },
    { title: 'Test Conversation 2' }
  ]);

  // Create Messages
  await Message.bulkCreate([
    { conversation_id: conversations[0].id, user_id: users[0].id, content: 'Test message 1' },
    { conversation_id: conversations[1].id, user_id: users[1].id, content: 'Test message 2' }
  ]);
}

export async function down(queryInterface) {
  await queryInterface.bulkDelete('Messages', null, {});
  await queryInterface.bulkDelete('Conversations', null, {});
  await queryInterface.bulkDelete('Users', null, {});
}