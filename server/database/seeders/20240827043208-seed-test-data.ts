'use strict';

import bcrypt from 'bcrypt';
import { User, Conversation, Message } from '../models';
import { QueryInterface, Sequelize } from 'sequelize';

// Export test data IDs for use in tests
export let testData: {
  firstMessageId?: number;
  assistantResponseId?: number;
  secondMessageId?: number;
  conversationIds: number[];
} = {
  conversationIds: []
};

export async function up(queryInterface: QueryInterface, sequelize: Sequelize) {
  const now = new Date();

  // Reset sequences
  await sequelize.query('DELETE FROM sqlite_sequence');

  // Create Users
  await queryInterface.bulkInsert('Users', [
    { username: 'user1', email: 'test1@example.com', hashed_password: await bcrypt.hash('password1', 10), createdAt: now, updatedAt: now },
    { username: 'user2', email: 'test2@example.com', hashed_password: await bcrypt.hash('password2', 10), createdAt: now, updatedAt: now }
  ]);

  // Create Conversations
  await queryInterface.bulkInsert('Conversations', [
    { title: 'Sample Conversation 1', user_id: 1, createdAt: now, updatedAt: now },
    { title: 'Sample Conversation 2', user_id: 2, createdAt: now, updatedAt: now }
  ]);

  // Set conversation IDs (SQLite auto-increments from 1)
  testData.conversationIds = [1, 2];

  // Create Messages sequentially
  await queryInterface.bulkInsert('Messages', [
    {
      content: 'Sample Message 1',
      conversation_id: 1,
      user_id: 1,
      createdAt: now,
      updatedAt: now
    }
  ]);
  testData.firstMessageId = 1;

  await queryInterface.bulkInsert('Messages', [
    {
      content: 'Assistant Response 1',
      conversation_id: 1,
      user_id: 1,
      parent_id: 1,
      model: 'test-model',
      temperature: 0.5,
      createdAt: now,
      updatedAt: now
    }
  ]);
  testData.assistantResponseId = 2;

  await queryInterface.bulkInsert('Messages', [
    {
      content: 'Sample Message 2',
      conversation_id: 2,
      user_id: 2,
      createdAt: now,
      updatedAt: now
    }
  ]);
  testData.secondMessageId = 3;
}

export async function down(queryInterface: QueryInterface, sequelize: Sequelize) {
  try {
    await sequelize.query('PRAGMA foreign_keys = OFF;');
    await sequelize.query('DELETE FROM Messages;');
    await sequelize.query('DELETE FROM Conversations;');
    await sequelize.query('DELETE FROM Users;');
    await sequelize.query('PRAGMA foreign_keys = ON;');
  } catch (error) {
    console.error('Error cleaning up test data:', error);
  }
}
