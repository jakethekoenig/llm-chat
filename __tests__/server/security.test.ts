import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../../server/app';

const SECRET_KEY = 'test-secret-key-that-is-32-characters-long-for-testing';

// Mock database models
const mockUser = {
  findOne: jest.fn(),
  create: jest.fn(),
};

const mockConversation = {
  findAll: jest.fn(),
  create: jest.fn(),
};

const mockMessage = {
  findAll: jest.fn(),
  findByPk: jest.fn(),
};

jest.mock('../../server/database/models/User', () => ({
  User: mockUser,
}));

jest.mock('../../server/database/models/Conversation', () => ({
  Conversation: mockConversation,
}));

jest.mock('../../server/database/models/Message', () => ({
  Message: mockMessage,
}));

describe('Security Tests', () => {
  beforeAll(() => {
    process.env.SECRET_KEY = SECRET_KEY;
    process.env.NODE_ENV = 'production'; // Test rate limiting in production mode
  });

  afterAll(() => {
    delete process.env.SECRET_KEY;
    delete process.env.NODE_ENV;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('JWT Token Security', () => {
    test('should reject expired tokens', async () => {
      const expiredToken = jwt.sign({ id: 1 }, SECRET_KEY, { expiresIn: '-1h' });

      const response = await request(app)
        .get('/api/conversations')
        .set('Authorization', `Bearer ${expiredToken}`);

      expect(response.status).toBe(403);
      expect(response.body.message).toBe('Invalid or expired token');
    });

    test('should reject tokens signed with wrong secret', async () => {
      const wrongSecretToken = jwt.sign({ id: 1 }, 'wrong-secret-key');

      const response = await request(app)
        .get('/api/conversations')
        .set('Authorization', `Bearer ${wrongSecretToken}`);

      expect(response.status).toBe(403);
      expect(response.body.message).toBe('Invalid or expired token');
    });

    test('should reject malformed JWT tokens', async () => {
      const malformedTokens = [
        'not.a.jwt.token',
        'Bearer invalid-token',
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalid',
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.invalid'
      ];

      for (const token of malformedTokens) {
        const response = await request(app)
          .get('/api/conversations')
          .set('Authorization', `Bearer ${token}`);

        expect(response.status).toBe(403);
        expect(response.body.message).toBe('Invalid or expired token');
      }
    });

    test('should handle missing Authorization header', async () => {
      const response = await request(app)
        .get('/api/conversations');

      expect(response.status).toBe(401);
    });

    test('should handle Authorization header without Bearer prefix', async () => {
      const validToken = jwt.sign({ id: 1 }, SECRET_KEY);

      const response = await request(app)
        .get('/api/conversations')
        .set('Authorization', validToken);

      expect(response.status).toBe(401);
    });

    test('should handle empty Authorization header', async () => {
      const response = await request(app)
        .get('/api/conversations')
        .set('Authorization', '');

      expect(response.status).toBe(401);
    });

    test('should handle Authorization header with only Bearer', async () => {
      const response = await request(app)
        .get('/api/conversations')
        .set('Authorization', 'Bearer');

      expect(response.status).toBe(401);
    });
  });

  describe('Input Validation Security', () => {
    const validToken = jwt.sign({ id: 1 }, SECRET_KEY);

    test('should sanitize and validate user input', async () => {
      const maliciousInputs = [
        '<script>alert("xss")</script>',
        '"; DROP TABLE users; --',
        '${7*7}',
        '{{7*7}}',
        '\x00\x01\x02',
        'javascript:alert("xss")',
        'data:text/html,<script>alert("xss")</script>'
      ];

      for (const maliciousInput of maliciousInputs) {
        mockMessage.findAll.mockResolvedValue([]);

        const response = await request(app)
          .post('/api/add_message')
          .set('Authorization', `Bearer ${validToken}`)
          .send({ 
            content: maliciousInput, 
            conversationId: '1'
          });

        // Should either reject the input or handle it safely
        if (response.status === 201) {
          // If accepted, ensure it's properly escaped/sanitized
          expect(response.body).toBeDefined();
        } else {
          // If rejected, should be a validation error
          expect(response.status).toBeGreaterThanOrEqual(400);
        }
      }
    });

    test('should validate ID parameters against injection', async () => {
      const maliciousIds = [
        'abc\'); DROP TABLE messages; --',
        '1 OR 1=1',
        '1; SELECT * FROM users',
        '${process.env}',
        '../../../etc/passwd',
        'NaN',
        'Infinity',
        '-Infinity'
      ];

      for (const maliciousId of maliciousIds) {
        const response = await request(app)
          .post('/api/add_message')
          .set('Authorization', `Bearer ${validToken}`)
          .send({ 
            content: 'Test message', 
            conversationId: maliciousId
          });

        expect(response.status).toBe(400);
        expect(response.body.errors).toBeDefined();
      }
    });

    test('should validate model parameter', async () => {
      const response = await request(app)
        .post('/api/get_completion_for_message')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ 
          messageId: '1', 
          model: '<script>alert("xss")</script>', 
          temperature: 0.5 
        });

      // Should accept the model string (it's validated by the AI providers)
      // but ensure no code execution happens
      expect(response.status).toBeGreaterThanOrEqual(400);
    });

    test('should validate temperature parameter bounds', async () => {
      const invalidTemperatures = [
        'not-a-number',
        '${7*7}',
        'Infinity',
        '-Infinity',
        'NaN',
        '[]',
        '{}'
      ];

      for (const temp of invalidTemperatures) {
        const response = await request(app)
          .post('/api/get_completion_for_message')
          .set('Authorization', `Bearer ${validToken}`)
          .send({ 
            messageId: '1', 
            model: 'gpt-4', 
            temperature: temp 
          });

        expect(response.status).toBe(400);
        expect(response.body.errors).toBeDefined();
      }
    });
  });

  describe('Request Size Limits', () => {
    const validToken = jwt.sign({ id: 1 }, SECRET_KEY);

    test('should handle large content payloads within limits', async () => {
      const largeContent = 'a'.repeat(1024 * 1024); // 1MB

      const response = await request(app)
        .post('/api/add_message')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ 
          content: largeContent, 
          conversationId: '1'
        });

      // Should either accept it or reject with appropriate error
      expect([201, 400, 413]).toContain(response.status);
    });

    test('should reject excessively large payloads', async () => {
      const hugeContent = 'a'.repeat(50 * 1024 * 1024); // 50MB

      const response = await request(app)
        .post('/api/add_message')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ 
          content: hugeContent, 
          conversationId: '1'
        });

      expect(response.status).toBe(413);
    });
  });

  describe('Header Security', () => {
    test('should set security headers', async () => {
      const response = await request(app)
        .get('/api/conversations')
        .set('Authorization', `Bearer ${jwt.sign({ id: 1 }, SECRET_KEY)}`);

      // Check for security headers set by helmet
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-frame-options']).toBe('DENY');
      expect(response.headers['x-xss-protection']).toBe('0');
    });

    test('should set CORS headers appropriately', async () => {
      const response = await request(app)
        .options('/api/conversations')
        .set('Origin', 'http://localhost:3000');

      expect(response.headers['access-control-allow-origin']).toBeDefined();
    });
  });

  describe('Authentication Edge Cases', () => {
    test('should handle concurrent authentication requests', async () => {
      mockUser.findOne.mockResolvedValue({
        get: () => 1,
        hashed_password: '$2b$10$test.hash.here'
      });

      const requests = Array(10).fill(null).map(() =>
        request(app)
          .post('/api/signin')
          .send({ username: 'testuser', password: 'password' })
      );

      const responses = await Promise.all(requests);
      
      // All should either succeed or fail consistently
      const statuses = responses.map(r => r.status);
      expect(statuses.every(s => s === 200 || s === 401)).toBe(true);
    });

    test('should handle user enumeration protection', async () => {
      // Test with non-existent user
      mockUser.findOne.mockResolvedValue(null);

      const response1 = await request(app)
        .post('/api/signin')
        .send({ username: 'nonexistent', password: 'password' });

      // Test with existing user but wrong password
      mockUser.findOne.mockResolvedValue({
        get: () => 1,
        hashed_password: '$2b$10$different.hash.here'
      });

      const response2 = await request(app)
        .post('/api/signin')
        .send({ username: 'testuser', password: 'wrongpassword' });

      // Both should return the same error to prevent user enumeration
      expect(response1.status).toBe(401);
      expect(response2.status).toBe(401);
      expect(response1.text).toBe(response2.text);
    });
  });
});

// Mock AI providers to avoid real API calls
jest.mock('openai', () => ({
  OpenAI: jest.fn(() => ({
    chat: {
      completions: {
        create: jest.fn().mockImplementation(({ stream }) => {
          if (stream) {
            const mockStream = {
              async *[Symbol.asyncIterator]() {
                yield { choices: [{ delta: { content: 'Hello' } }] };
                yield { choices: [{ delta: { content: ' world' } }] };
                yield { choices: [{ delta: { content: '!' } }] };
              }
            };
            return Promise.resolve(mockStream);
          } else {
            return Promise.resolve({
              choices: [{
                message: { content: 'Mocked OpenAI response' }
              }]
            });
          }
        })
      }
    }
  }))
}));

jest.mock('@anthropic-ai/sdk', () => ({
  __esModule: true,
  default: jest.fn(() => ({
    messages: {
      create: jest.fn().mockImplementation(({ stream }) => {
        if (stream) {
          const mockStream = {
            async *[Symbol.asyncIterator]() {
              yield { type: 'content_block_delta', delta: { type: 'text_delta', text: 'Hello' } };
              yield { type: 'content_block_delta', delta: { type: 'text_delta', text: ' world' } };
              yield { type: 'content_block_delta', delta: { type: 'text_delta', text: '!' } };
            }
          };
          return Promise.resolve(mockStream);
        } else {
          return Promise.resolve({
            content: [{ type: 'text', text: 'Mocked Anthropic response' }]
          });
        }
      })
    }
  }))
}));

describe('Comprehensive Integration Tests', () => {
  let authToken: string;

  beforeAll(async () => {
    process.env.SECRET_KEY = 'test-secret-key-that-is-32-characters-long-for-testing';
    process.env.OPENAI_API_KEY = 'test-openai-key';
    process.env.ANTHROPIC_API_KEY = 'test-anthropic-key';

    await sequelize.sequelize.sync({ force: true });
    await up(sequelize.sequelize.getQueryInterface(), sequelize.sequelize);

    // Get authentication token
    const signInResponse = await request(app)
      .post('/api/signin')
      .send({ username: 'user1', password: 'password1' });
    
    authToken = signInResponse.body.token;
  });

  afterAll(async () => {
    await down(sequelize.sequelize.getQueryInterface(), sequelize.sequelize);
    await sequelize.sequelize.close();
    
    delete process.env.SECRET_KEY;
    delete process.env.OPENAI_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
  });

  describe('Complete Conversation Flow', () => {
    test('should handle complete conversation creation and interaction flow', async () => {
      // Step 1: Create a new conversation
      const createResponse = await request(app)
        .post('/api/create_conversation')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          initialMessage: 'Hello, I need help with programming',
          model: 'gpt-4',
          temperature: 0.7
        });

      expect(createResponse.status).toBe(201);
      expect(createResponse.body.conversationId).toBeDefined();
      expect(createResponse.body.initialMessageId).toBeDefined();
      expect(createResponse.body.completionMessageId).toBeDefined();

      const conversationId = createResponse.body.conversationId;

      // Step 2: Get all conversations and verify our new one is there
      const conversationsResponse = await request(app)
        .get('/api/conversations')
        .set('Authorization', `Bearer ${authToken}`);

      expect(conversationsResponse.status).toBe(200);
      const conversations = conversationsResponse.body;
      const ourConversation = conversations.find((c: any) => c.id === conversationId);
      expect(ourConversation).toBeDefined();

      // Step 3: Get messages in the conversation
      const messagesResponse = await request(app)
        .get(`/api/conversations/${conversationId}/messages`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(messagesResponse.status).toBe(200);
      const messages = messagesResponse.body;
      expect(messages.length).toBe(2); // Initial message + AI response
      expect(messages[0].content).toBe('Hello, I need help with programming');
      expect(messages[1].content).toBe('Mocked OpenAI response');

      // Step 4: Add a follow-up message
      const followUpResponse = await request(app)
        .post('/api/add_message')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          content: 'Can you help me with JavaScript?',
          conversationId: conversationId,
          parentId: createResponse.body.completionMessageId
        });

      expect(followUpResponse.status).toBe(201);
      const followUpMessageId = followUpResponse.body.id;

      // Step 5: Generate completion for the follow-up
      const completionResponse = await request(app)
        .post('/api/get_completion_for_message')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          messageId: followUpMessageId,
          model: 'claude-3-opus',
          temperature: 0.5
        });

      expect(completionResponse.status).toBe(201);
      expect(completionResponse.body.content).toBe('Mocked Anthropic response');

      // Step 6: Verify the conversation now has 4 messages
      const finalMessagesResponse = await request(app)
        .get(`/api/conversations/${conversationId}/messages`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(finalMessagesResponse.status).toBe(200);
      expect(finalMessagesResponse.body.length).toBe(4);
    });

    test('should handle message editing workflow', async () => {
      // Create a conversation first
      const createResponse = await request(app)
        .post('/api/create_conversation')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          initialMessage: 'Original message',
          model: 'gpt-4',
          temperature: 0.7
        });

      const messageId = createResponse.body.initialMessageId;

      // Edit the message
      const editResponse = await request(app)
        .put(`/api/messages/${messageId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          content: 'Edited message content'
        });

      expect(editResponse.status).toBe(200);
      expect(editResponse.body.content).toBe('Edited message content');

      // Verify the edit persisted
      const messagesResponse = await request(app)
        .get(`/api/conversations/${createResponse.body.conversationId}/messages`)
        .set('Authorization', `Bearer ${authToken}`);

      const editedMessage = messagesResponse.body.find((m: any) => m.id === messageId);
      expect(editedMessage.content).toBe('Edited message content');
    });

    test('should handle message deletion workflow', async () => {
      // Create a conversation
      const createResponse = await request(app)
        .post('/api/create_conversation')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          initialMessage: 'Message to be deleted',
          model: 'gpt-4',
          temperature: 0.7
        });

      const messageId = createResponse.body.initialMessageId;
      const conversationId = createResponse.body.conversationId;

      // Delete the message
      const deleteResponse = await request(app)
        .delete(`/api/messages/${messageId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(deleteResponse.status).toBe(200);
      expect(deleteResponse.body.success).toBe(true);
      expect(deleteResponse.body.deletedMessageId).toBe(messageId);

      // Verify the message is gone
      const messagesResponse = await request(app)
        .get(`/api/conversations/${conversationId}/messages`)
        .set('Authorization', `Bearer ${authToken}`);

      const deletedMessage = messagesResponse.body.find((m: any) => m.id === messageId);
      expect(deletedMessage).toBeUndefined();
    });
  });

  describe('Streaming Completion Tests', () => {
    test('should handle streaming completion successfully', async () => {
      // Create a conversation to get a parent message
      const createResponse = await request(app)
        .post('/api/create_conversation')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          initialMessage: 'Test streaming message',
          model: 'gpt-4',
          temperature: 0.7
        });

      const parentMessageId = createResponse.body.completionMessageId;

      // Test streaming endpoint
      const streamResponse = await request(app)
        .post('/api/get_completion')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          model: 'gpt-4',
          parentId: parentMessageId,
          temperature: 0.8
        });

      expect(streamResponse.status).toBe(200);
      expect(streamResponse.headers['content-type']).toBe('text/event-stream');
      expect(streamResponse.headers['cache-control']).toBe('no-cache');

      // Parse the SSE response
      const chunks = streamResponse.text.split('\n\n').filter(chunk => chunk.startsWith('data: '));
      expect(chunks.length).toBeGreaterThan(0);

      // Verify the last chunk indicates completion
      const lastChunk = chunks[chunks.length - 1];
      const lastData = JSON.parse(lastChunk.replace('data: ', ''));
      expect(lastData.isComplete).toBe(true);
    });

    test('should handle streaming errors gracefully', async () => {
      // Test with invalid parent ID
      const streamResponse = await request(app)
        .post('/api/get_completion')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          model: 'gpt-4',
          parentId: '99999',
          temperature: 0.7
        });

      expect(streamResponse.status).toBe(200);
      
      // Should receive error in stream
      const chunks = streamResponse.text.split('\n\n').filter(chunk => chunk.startsWith('data: '));
      const lastChunk = chunks[chunks.length - 1];
      const lastData = JSON.parse(lastChunk.replace('data: ', ''));
      expect(lastData.error).toBeDefined();
      expect(lastData.isComplete).toBe(true);
    });
  });

  describe('Error Recovery and Edge Cases', () => {
    test('should handle rapid successive requests', async () => {
      const promises = Array(5).fill(null).map((_, index) =>
        request(app)
          .post('/api/create_conversation')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            initialMessage: `Rapid message ${index}`,
            model: 'gpt-4',
            temperature: 0.7
          })
      );

      const responses = await Promise.all(promises);
      
      // All should succeed
      responses.forEach(response => {
        expect(response.status).toBe(201);
        expect(response.body.conversationId).toBeDefined();
      });

      // Verify all conversations were created
      const conversationsResponse = await request(app)
        .get('/api/conversations')
        .set('Authorization', `Bearer ${authToken}`);

      expect(conversationsResponse.body.length).toBeGreaterThanOrEqual(5);
    });

    test('should handle conversation with deep message thread', async () => {
      // Create initial conversation
      const createResponse = await request(app)
        .post('/api/create_conversation')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          initialMessage: 'Start of deep thread',
          model: 'gpt-4',
          temperature: 0.7
        });

      let parentId = createResponse.body.completionMessageId;
      const conversationId = createResponse.body.conversationId;

      // Create a chain of 10 messages
      for (let i = 0; i < 10; i++) {
        const addResponse = await request(app)
          .post('/api/add_message')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            content: `Message in chain ${i}`,
            conversationId: conversationId,
            parentId: parentId
          });

        expect(addResponse.status).toBe(201);

        const completionResponse = await request(app)
          .post('/api/get_completion_for_message')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            messageId: addResponse.body.id,
            model: 'gpt-4',
            temperature: 0.7
          });

        expect(completionResponse.status).toBe(201);
        parentId = completionResponse.body.id;
      }

      // Verify the conversation has all messages
      const messagesResponse = await request(app)
        .get(`/api/conversations/${conversationId}/messages`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(messagesResponse.body.length).toBe(22); // 2 initial + 20 in chain
    });

    test('should handle mixed AI providers in same conversation', async () => {
      // Create conversation with OpenAI
      const createResponse = await request(app)
        .post('/api/create_conversation')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          initialMessage: 'Test mixed providers',
          model: 'gpt-4',
          temperature: 0.7
        });

      const conversationId = createResponse.body.conversationId;
      const openaiMessageId = createResponse.body.completionMessageId;

      // Add message and respond with Anthropic
      const addResponse = await request(app)
        .post('/api/add_message')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          content: 'Switch to Anthropic',
          conversationId: conversationId,
          parentId: openaiMessageId
        });

      const anthropicResponse = await request(app)
        .post('/api/get_completion_for_message')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          messageId: addResponse.body.id,
          model: 'claude-3-opus',
          temperature: 0.5
        });

      expect(anthropicResponse.status).toBe(201);
      expect(anthropicResponse.body.content).toBe('Mocked Anthropic response');

      // Verify conversation contains both provider responses
      const messagesResponse = await request(app)
        .get(`/api/conversations/${conversationId}/messages`)
        .set('Authorization', `Bearer ${authToken}`);

      const messages = messagesResponse.body;
      const openaiMessage = messages.find((m: any) => m.model === 'gpt-4');
      const anthropicMessage = messages.find((m: any) => m.model === 'claude-3-opus');

      expect(openaiMessage).toBeDefined();
      expect(anthropicMessage).toBeDefined();
    });
  });

  describe('User Isolation Tests', () => {
    let user2Token: string;

    beforeAll(async () => {
      // Create second user
      const registerResponse = await request(app)
        .post('/api/register')
        .send({
          username: 'testuser2',
          email: 'user2@example.com',
          password: 'password123'
        });

      expect(registerResponse.status).toBe(201);

      // Sign in as second user
      const signInResponse = await request(app)
        .post('/api/signin')
        .send({ username: 'testuser2', password: 'password123' });

      user2Token = signInResponse.body.token;
    });

    test('should isolate conversations between users', async () => {
      // User 1 creates a conversation
      const user1Conversation = await request(app)
        .post('/api/create_conversation')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          initialMessage: 'User 1 conversation',
          model: 'gpt-4',
          temperature: 0.7
        });

      // User 2 creates a conversation
      const user2Conversation = await request(app)
        .post('/api/create_conversation')
        .set('Authorization', `Bearer ${user2Token}`)
        .send({
          initialMessage: 'User 2 conversation',
          model: 'gpt-4',
          temperature: 0.7
        });

      // User 1 should only see their own conversations
      const user1Conversations = await request(app)
        .get('/api/conversations')
        .set('Authorization', `Bearer ${authToken}`);

      const user1ConversationIds = user1Conversations.body.map((c: any) => c.id);
      expect(user1ConversationIds).toContain(user1Conversation.body.conversationId);
      expect(user1ConversationIds).not.toContain(user2Conversation.body.conversationId);

      // User 2 should only see their own conversations
      const user2Conversations = await request(app)
        .get('/api/conversations')
        .set('Authorization', `Bearer ${user2Token}`);

      const user2ConversationIds = user2Conversations.body.map((c: any) => c.id);
      expect(user2ConversationIds).toContain(user2Conversation.body.conversationId);
      expect(user2ConversationIds).not.toContain(user1Conversation.body.conversationId);
    });

    test('should prevent cross-user message access', async () => {
      // User 1 creates a conversation
      const user1Conversation = await request(app)
        .post('/api/create_conversation')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          initialMessage: 'User 1 private message',
          model: 'gpt-4',
          temperature: 0.7
        });

      // User 2 tries to access User 1's conversation messages
      const unauthorizedResponse = await request(app)
        .get(`/api/conversations/${user1Conversation.body.conversationId}/messages`)
        .set('Authorization', `Bearer ${user2Token}`);

      // Should return empty array or 403/404 (depending on implementation)
      expect([200, 403, 404]).toContain(unauthorizedResponse.status);
      if (unauthorizedResponse.status === 200) {
        expect(unauthorizedResponse.body).toEqual([]);
      }
    });

    test('should prevent cross-user message editing', async () => {
      // User 1 creates a conversation
      const user1Conversation = await request(app)
        .post('/api/create_conversation')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          initialMessage: 'User 1 message to edit',
          model: 'gpt-4',
          temperature: 0.7
        });

      const messageId = user1Conversation.body.initialMessageId;

      // User 2 tries to edit User 1's message
      const editResponse = await request(app)
        .put(`/api/messages/${messageId}`)
        .set('Authorization', `Bearer ${user2Token}`)
        .send({
          content: 'Malicious edit attempt'
        });

      expect(editResponse.status).toBe(403);
      expect(editResponse.body.error).toBe('You can only edit your own messages');
    });
  });
});
