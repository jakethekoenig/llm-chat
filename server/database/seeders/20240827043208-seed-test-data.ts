'use strict';

import bcrypt from 'bcrypt';
import { User, Conversation, Message } from '../models';
import { QueryInterface, Sequelize } from 'sequelize';

export async function up(queryInterface: QueryInterface, sequelize: Sequelize) {
  // Create Users
  const hashedPassword1 = await bcrypt.hash('password1', 10);
  const hashedPassword2 = await bcrypt.hash('password2', 10);
  const users = await User.bulkCreate([
    { username: 'user1', email: 'test1@example.com', hashed_password: hashedPassword1 },
    { username: 'user2', email: 'test2@example.com', hashed_password: hashedPassword2 }
  ]);

  // Create Conversations
  const conversations = await Conversation.bulkCreate([
    { title: 'Test Conversation 1' },
    { title: 'Test Conversation 2' }
  ]);

  // Create Messages
  await Message.bulkCreate([
    { conversation_id: conversations[0].get('id'), user_id: users[0].get('id'), content: 'Test message 1' },
    { conversation_id: conversations[1].get('id'), user_id: users[1].get('id'), content: 'Test message 2' }
  ]);
}

export async function down(queryInterface: QueryInterface, sequelize: Sequelize) {
  await queryInterface.bulkDelete('Messages', {});
  await queryInterface.bulkDelete('Conversations', {});
  await queryInterface.bulkDelete('Users', {});
}
