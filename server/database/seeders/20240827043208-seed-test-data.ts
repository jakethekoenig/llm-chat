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
  const now = new Date().toISOString();
  const hashedPassword1 = await bcrypt.hash('password1', 10);
  const hashedPassword2 = await bcrypt.hash('password2', 10);

  // Create Users
  await sequelize.query(`
    INSERT INTO Users (username, email, hashed_password, createdAt, updatedAt)
    VALUES 
      ('user1', 'test1@example.com', '${hashedPassword1}', '${now}', '${now}'),
      ('user2', 'test2@example.com', '${hashedPassword2}', '${now}', '${now}')
  `);

  // Create first conversation
  await sequelize.query(`
    INSERT INTO Conversations (title, user_id, createdAt, updatedAt)
    VALUES ('Sample Conversation 1', 1, '${now}', '${now}')
  `);
  const [conv1Result] = await sequelize.query('SELECT last_insert_rowid() as id');
  const conv1Id = (conv1Result as any[])[0].id;

  // Create second conversation
  await sequelize.query(`
    INSERT INTO Conversations (title, user_id, createdAt, updatedAt)
    VALUES ('Sample Conversation 2', 2, '${now}', '${now}')
  `);
  const [conv2Result] = await sequelize.query('SELECT last_insert_rowid() as id');
  const conv2Id = (conv2Result as any[])[0].id;

  testData.conversationIds = [conv1Id, conv2Id];

  // Create Messages
  await sequelize.query(`
    INSERT INTO Messages (content, conversation_id, user_id, createdAt, updatedAt)
    VALUES ('Sample Message 1', ${testData.conversationIds[0]}, 1, '${now}', '${now}')
  `);
  const [firstMessageResult] = await sequelize.query('SELECT last_insert_rowid() as id');
  testData.firstMessageId = (firstMessageResult as any[])[0].id;

  await sequelize.query(`
    INSERT INTO Messages (content, conversation_id, user_id, parent_id, model, temperature, createdAt, updatedAt)
    VALUES ('Assistant Response 1', ${testData.conversationIds[0]}, 1, ${testData.firstMessageId}, 'test-model', 0.5, '${now}', '${now}')
  `);
  const [assistantResponseResult] = await sequelize.query('SELECT last_insert_rowid() as id');
  testData.assistantResponseId = (assistantResponseResult as any[])[0].id;

  await sequelize.query(`
    INSERT INTO Messages (content, conversation_id, user_id, createdAt, updatedAt)
    VALUES ('Sample Message 2', ${testData.conversationIds[1]}, 2, '${now}', '${now}')
  `);
  const [secondMessageResult] = await sequelize.query('SELECT last_insert_rowid() as id');
  testData.secondMessageId = (secondMessageResult as any[])[0].id;
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
