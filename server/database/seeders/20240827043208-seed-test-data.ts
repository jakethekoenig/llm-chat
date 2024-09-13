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
    { title: 'Sample Conversation 1', user_id: 1, createdAt: new Date(), updatedAt: new Date() },
    { title: 'Sample Conversation 2', user_id: 2, createdAt: new Date(), updatedAt: new Date() },
  ]);

  // Create Messages
  const messages = await Message.bulkCreate([
     { content: 'Sample Message 1', conversation_id: conversations[0].get('id'), user_id: 1, createdAt: new Date(), updatedAt: new Date() },
    { content: 'Sample Message 2', conversation_id: conversations[1].get('id'), user_id: 2, createdAt: new Date(), updatedAt: new Date() },
  ]);
}

export async function down(queryInterface: QueryInterface, sequelize: Sequelize) {
  await queryInterface.bulkDelete('Messages', {});
  await queryInterface.bulkDelete('Conversations', {});
  await queryInterface.bulkDelete('Users', {});
}
