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

  // Create Messages sequentially to get proper IDs
  const firstMessage = await Message.create({ 
    content: 'Sample Message 1', 
    conversation_id: conversations[0].get('id'), 
    user_id: 1, 
    createdAt: new Date(), 
    updatedAt: new Date() 
  });

  const assistantResponse = await Message.create({ 
    content: 'Assistant Response 1', 
    conversation_id: conversations[0].get('id'), 
    user_id: 1, 
    parent_id: firstMessage.get('id'),
    model: 'test-model',
    temperature: 0.5,
    createdAt: new Date(Date.now() + 1000), 
    updatedAt: new Date(Date.now() + 1000) 
  });

  const secondMessage = await Message.create({ 
    content: 'Sample Message 2', 
    conversation_id: conversations[1].get('id'), 
    user_id: 2, 
    createdAt: new Date(), 
    updatedAt: new Date() 
  });

  // Store all messages for reference
  const messages = [firstMessage, assistantResponse, secondMessage];
}

export async function down(queryInterface: QueryInterface, sequelize: Sequelize) {
  await queryInterface.bulkDelete('Messages', {});
  await queryInterface.bulkDelete('Conversations', {});
  await queryInterface.bulkDelete('Users', {});
}
