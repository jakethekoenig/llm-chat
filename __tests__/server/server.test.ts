import request from 'supertest';
import express from 'express';
import { jest } from '@jest/globals';
import 'jest-styled-components';
import { OpenAI } from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import app, { authenticateToken } from '../../server/app';
import { sequelize } from '../../server/database/models';
import { Message } from '../../server/database/models/Message';
import { User } from '../../server/database/models/User';
import { Conversation } from '../../server/database/models/Conversation';
import { up, down, testData } from '../../server/database/seeders/20240827043208-seed-test-data';
import { logger } from '../../server/helpers/messageHelpers';
import * as messageHelpers from '../../server/helpers/messageHelpers';

const obtainAuthToken = async () => {
  const response = await request(app)
    .post('/api/signin')
    .send({ username: 'user1', password: 'password1' });
  return response.body.token;
};

let connection: any;

beforeAll(async () => {
  connection = await sequelize.sequelize.sync({ force: true });
  process.env.OPENAI_API_KEY = 'test-openai-key';
  process.env.ANTHROPIC_API_KEY = 'test-anthropic-key';
  await up(sequelize.sequelize.getQueryInterface(), sequelize.sequelize);
});

afterAll(async () => {
  delete process.env.OPENAI_API_KEY;
  delete process.env.ANTHROPIC_API_KEY;
  if (connection) {
    await connection.close();
  }
});

// Reset database state between tests
beforeEach(async () => {
  await Message.destroy({ where: {}, truncate: true, cascade: true });
  await Conversation.destroy({ where: {}, truncate: true, cascade: true });
  await User.destroy({ where: {}, truncate: true, cascade: true });
  await up(sequelize.sequelize.getQueryInterface(), sequelize.sequelize);
});

// Mock OpenAI
jest.mock('openai', () => {
  const mockCreate = async (params: any) => {
    // Validate that messages is an array and has at least one message
    if (!Array.isArray(params.messages) || params.messages.length === 0) {
      throw new Error('Invalid messages format');
    }

    // Validate required parameters
    if (!params.model) {
      throw new Error('Model is required');
    }

    // Return successful mock response
    return {
      id: 'mock-completion-id',
      object: 'chat.completion',
      created: Date.now(),
      model: params.model,
      choices: [{
        index: 0,
        message: { role: "assistant", content: 'Mocked OpenAI response' },
        finish_reason: 'stop'
      }]
    };
  };

  return {
    OpenAI: jest.fn(() => ({
      chat: {
        completions: {
          create: jest.fn().mockImplementation(mockCreate)
        }
      }
    }))
  };
});

// Mock Anthropic
jest.mock('@anthropic-ai/sdk', () => ({
  __esModule: true,
  default: jest.fn(() => ({
    messages: {
      create: jest.fn().mockImplementation(async (params: any) => {
        // Validate required parameters
        if (!params.model) {
          throw new Error('Model is required');
        }

        // Return successful mock response
        return {
          content: [{ type: 'text', text: 'Mocked Anthropic response' }]
        } as any;
      })
    }
  }))
}));
// API keys are set in beforeAll

beforeAll(async () => {
  await sequelize.sequelize.sync({ force: true });
  await up(sequelize.sequelize.getQueryInterface(), sequelize.sequelize);
});

afterAll(async () => {
  await down(sequelize.sequelize.getQueryInterface(), sequelize.sequelize);
  await sequelize.sequelize.close();
});

// Streaming endpoint
app.get('/api/get_completion', authenticateToken, (req: express.Request, res: express.Response) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  // Example stream data with delays
  const messages = [
    'data: Example stream data part 1\n\n',
    'data: Example stream data part 2\n\n',
    'data: Example stream data part 3\n\n'
  ];

  let index = 0;
  const interval = setInterval(() => {
    if (index < messages.length) {
      res.write(messages[index]);
      index++;
    } else {
      clearInterval(interval);
      res.end();
    }
  }, 1000);
});

describe('Server Tests', () => {
  it('should sign in and return a token', async () => {
    const response = await request(app)
      .post('/api/signin')
      .send({ username: 'user1', password: 'password1' });
    expect(response.status).toBe(200);
    expect(response.body.token).toBeDefined();
  });

  it('should return 401 for invalid credentials', async () => {
    const response = await request(app)
      .post('/api/signin')
      .send({ username: 'user1', password: 'wrongpassword' });
    expect(response.status).toBe(401);
  });

  it('should return 400 for invalid parentId in add_message', async () => {
    const signInResponse = await request(app)
      .post('/api/signin')
      .send({ username: 'user1', password: 'password1' });
    const token = signInResponse.body.token;

    const envResponse = await request(app)
      .post('/api/add_message')
      .set('Authorization', `Bearer ${token}`)
      .send({ content: 'Test message', conversationId: 1, parentId: 'invalid' });
    expect(envResponse.status).toBe(400);
    expect(envResponse.body.errors[0].msg).toBe('Parent ID must be an integer');
  });

  it('should return 401 for unauthenticated users', async () => {
    const response = await request(app).get('/api/get_completion');
    expect(response.status).toBe(401);
  });

  it('should return 403 for invalid token', async () => {
    const token = await obtainAuthToken(); // Implement a helper to retrieve a valid token

    // Tamper the token to make it invalid
    const invalidToken = token ? token.slice(0, -1) + 'x' : 'invalidToken';

    const response = await request(app)
      .get('/api/get_completion')
      .set('Authorization', `Bearer ${invalidToken}`);
    expect(response.status).toBe(403);
  });

  it('should handle missing content in add_message', async () => {
    const token = await obtainAuthToken(); // Implement a helper to retrieve a valid token

    const response = await request(app)
      .post('/api/add_message')
      .set('Authorization', `Bearer ${token}`)
      .send({ content: '', conversationId: 1 });
    expect(response.status).toBe(400);
    expect(response.body.errors[0].msg).toBe('Content is required');
  });

  it('should generate a completion for a valid message', async () => {
    const token = await obtainAuthToken();

    // Log test data state
    console.log('Test data:', {
      firstMessageId: testData.firstMessageId,
      conversationIds: testData.conversationIds
    });

    // Verify message exists
    const message = await Message.findByPk(testData.firstMessageId);
    console.log('Test message:', {
      exists: !!message,
      content: message?.get('content'),
      conversationId: message?.get('conversation_id')
    });

    const response = await request(app)
      .post('/api/get_completion_for_message')
      .set('Authorization', `Bearer ${token}`)
      .send({ messageId: testData.firstMessageId, model: 'test-model', temperature: 0.5 });
    
    // Log response for debugging
    console.log('Response:', {
      status: response.status,
      body: response.body,
      error: response.body.error
    });

    if (response.status === 500) {
      console.error('Test failed with error:', response.body.error);
    }

    expect(response.status).toBe(201);
    expect(response.body.id).toBeDefined();
    expect(response.body.content).toBe('Mocked OpenAI response');
  });

  it('should return 400 for invalid messageId', async () => {
    const token = await obtainAuthToken();

    const response = await request(app)
      .post('/api/get_completion_for_message')
      .set('Authorization', `Bearer ${token}`)
      .send({ messageId: 'invalid', model: 'test-model', temperature: 0.5 });
    expect(response.status).toBe(400);
  });

  // Add new test cases for conversations and messages routes
  describe('Conversations and Messages Routes', () => {
    let token: string;
    beforeAll(async () => {
      const signInResponse = await request(app)
        .post('/api/signin')
        .send({ username: 'user1', password: 'password1' });
      token = signInResponse.body.token;
    });

    it('should fetch all conversations for a logged-in user', async () => {
      const response = await request(app)
        .get('/api/conversations')
        .set('Authorization', `Bearer ${token}`);
      expect(response.status).toBe(200);
      expect(response.body).toBeInstanceOf(Array);
    });

    it('should fetch all messages in a specific conversation', async () => {
      // Create a conversation and messages for testing
      const conversation: Conversation = await Conversation.create({ title: 'Test Conversation', user_id: 1 });
      await Message.create({ conversation_id: conversation.get('id'), user_id: 1, content: 'Test Message' });

      const response = await request(app)
        .get(`/api/conversations/${conversation.get('id')}/messages`)
        .set('Authorization', `Bearer ${token}`);
      expect(response.status).toBe(200);
      expect(response.body).toBeInstanceOf(Array);
      expect(response.body[0].content).toBe('Test Message');
    });

    it('should return 401 for unauthorized access to conversations', async () => {
      const response = await request(app).get('/api/conversations');
    });

    it('should return 401 for unauthorized access to messages', async () => {
      const response = await request(app).get('/api/conversations/1/messages');
      expect(response.status).toBe(401);
    });

    it('should generate completion with OpenAI model', async () => {
      const response = await request(app)
        .post('/api/get_completion_for_message')
        .set('Authorization', `Bearer ${token}`)
        .send({ messageId: testData.firstMessageId, model: 'gpt-4', temperature: 0.7 });
      expect(response.status).toBe(201);
      expect(response.body.id).toBeDefined();
      expect(response.body.content).toBe('Mocked OpenAI response');
    });

    it('should generate completion with Anthropic model', async () => {
      const response = await request(app)
        .post('/api/get_completion_for_message')
        .set('Authorization', `Bearer ${token}`)
        .send({ messageId: 1, model: 'claude-3-opus', temperature: 0.7 });
      expect(response.status).toBe(201);
      expect(response.body.id).toBeDefined();
      expect(response.body.content).toBe('Mocked Anthropic response');
    });


    it('should handle Anthropic API errors and missing API key', async () => {
      // Test with missing API key
      const originalKey = process.env.ANTHROPIC_API_KEY;
      delete process.env.ANTHROPIC_API_KEY;

      const response = await request(app)
        .post('/api/get_completion_for_message')
        .set('Authorization', `Bearer ${token}`)
        .send({ messageId: 1, model: 'claude-3-opus', temperature: 0.7 });
      
      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Anthropic API key is not set');

      // Restore API key
      process.env.ANTHROPIC_API_KEY = originalKey;
    });

    it('should detect different Anthropic model variants', async () => {
      const anthropicModels = ['claude-3-opus', 'claude-3-sonnet', 'claude-3-haiku'];
      
      for (const model of anthropicModels) {
        const response = await request(app)
          .post('/api/get_completion_for_message')
          .set('Authorization', `Bearer ${token}`)
          .send({ messageId: 1, model, temperature: 0.7 });
        
        expect(response.status).toBe(201);
        expect(response.body.content).toBe('Mocked Anthropic response');
      }
    });

    it('should return 500 when generating completion fails', async () => {
      // Mock generateCompletion to throw an error
      jest.spyOn(messageHelpers, 'generateCompletion').mockImplementationOnce(() => {
        throw new Error('Completion service unavailable');
      });

      const response = await request(app)
        .post('/api/get_completion_for_message')
        .set('Authorization', `Bearer ${token}`)
        .send({ messageId: 1, model: 'gpt-4', temperature: 0.7 });
      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Completion service unavailable');
    });

    describe('Add Message and Get Completion for Message Endpoints', () => {
      it('should add a new message', async () => {
        const response = await request(app)
          .post('/api/add_message')
          .set('Authorization', `Bearer ${token}`)
          .send({ 
            content: 'New Test Message', 
            conversationId: testData.conversationIds[0], 
            parentId: testData.firstMessageId 
          });
        expect(response.status).toBe(201);
        expect(response.body.id).toBeDefined();
      });

      it('should return 400 for invalid add_message request', async () => {
        const response = await request(app)
          .post('/api/add_message')
          .set('Authorization', `Bearer ${token}`)
          .send({ content: '', conversationId: 'invalid', parentId: null });
        expect(response.status).toBe(400);
      });

      it('should get completion for a message', async () => {
        const response = await request(app)
          .post('/api/get_completion_for_message')
          .set('Authorization', `Bearer ${token}`)
          .send({ messageId: testData.firstMessageId, model: 'test-model', temperature: 0.5 });
        expect(response.status).toBe(201);
        expect(response.body.id).toBeDefined();
      });

      it('should return 400 for invalid get_completion_for_message request', async () => {
        const response = await request(app)
          .post('/api/get_completion_for_message')
          .set('Authorization', `Bearer ${token}`)
          .send({ messageId: 'invalid', model: '', temperature: 'invalid' });
        expect(response.status).toBe(400);
      });

      it('should create a new conversation with valid data', async () => {
        const response = await request(app)
          .post('/api/create_conversation')
          .set('Authorization', `Bearer ${token}`)
          .send({ initialMessage: 'Hello, world!', model: 'gpt-4o', temperature: 0.0 });
        expect(response.status).toBe(201);
        expect(response.body.conversationId).toBeDefined();
        expect(response.body.initialMessageId).toBeDefined();
        expect(response.body.completionMessageId).toBeDefined();
      });

      it('should return 400 for missing initialMessage', async () => {
        const response = await request(app)
          .post('/api/create_conversation')
          .set('Authorization', `Bearer ${token}`)
          .send({ model: 'gpt-4o', temperature: 0.0 });
        expect(response.status).toBe(400);
        expect(response.body.errors).toBeDefined();
        expect(response.body.errors[0].msg).toBe('Initial message is required');
      });

      it('should return 400 for missing model', async () => {
        const response = await request(app)
          .post('/api/create_conversation')
          .set('Authorization', `Bearer ${token}`)
          .send({ initialMessage: 'Hello, world!', temperature: 0.0 });
        expect(response.status).toBe(400);
        expect(response.body.errors).toBeDefined();
        expect(response.body.errors[0].msg).toBe('Model is required');
      });

      it('should return 400 for invalid temperature', async () => {
        const response = await request(app)
          .post('/api/create_conversation')
          .set('Authorization', `Bearer ${token}`)
          .send({ initialMessage: 'Hello, world!', model: 'gpt-4o', temperature: 'invalid' });
        expect(response.status).toBe(400);
        expect(response.body.errors).toBeDefined();
        expect(response.body.errors[0].msg).toBe('Temperature must be a float');
      });

      it('should handle server errors gracefully', async () => {
        // Mock Conversation.create to throw an error
        jest.spyOn(Conversation, 'create').mockImplementationOnce(() => {
          throw new Error('Database error');
        });
        
        const response = await request(app)
          .post('/api/create_conversation')
          .set('Authorization', `Bearer ${token}`)
          .send({ initialMessage: 'Hello, world!', model: 'gpt-4o', temperature: 0.0 });
        
        expect(response.status).toBe(500);
        expect(response.body.error).toBe('Internal server error');
      });

      // New test for handling missing environment variables
      it('should return 500 if OPENAI_API_KEY is not set', async () => {
        // Temporarily unset the API key
        const originalApiKey = process.env.OPENAI_API_KEY;
        delete process.env.OPENAI_API_KEY;

        const token = await obtainAuthToken();

        const response = await request(app)
          .post('/api/get_completion_for_message')
          .set('Authorization', `Bearer ${token}`)
          .send({ messageId: 1, model: 'test-model', temperature: 0.5 });

        expect(response.status).toBe(500);
        expect(response.body.error).toBe('OpenAI API key is not set');

        // Restore the API key
        process.env.OPENAI_API_KEY = originalApiKey;
      });

      // New test for invalid model parameter
      it('should return 400 for invalid model parameter', async () => {
        const token = await obtainAuthToken();

        const response = await request(app)
          .post('/api/get_completion_for_message')
          .set('Authorization', `Bearer ${token}`)
          .send({ messageId: 1, model: '', temperature: 0.5 });

        expect(response.status).toBe(400);
        expect(response.body.errors).toBeDefined();
        expect(response.body.errors[0].msg).toBe('Model is required');
      });

      // New test for generating completion with non-existent messageId
      it('should return 500 when parent message is not found', async () => {
        const token = await obtainAuthToken();

        const invalidMessageResponse = await request(app)
          .post('/api/get_completion_for_message')
          .set('Authorization', `Bearer ${token}`)
          .send({ messageId: 9999, model: 'test-model', temperature: 0.5 });

        expect(invalidMessageResponse.status).toBe(500);
        expect(invalidMessageResponse.body.error).toBe('Parent message with ID 9999 not found');
      });

      it('should return 500 when generating completion with non-existent messageId', async () => {
        const invalidMessageResponse = await request(app)
          .post('/api/get_completion_for_message')
          .set('Authorization', `Bearer ${token}`)
          .send({ messageId: 9999, model: 'test-model', temperature: 0.5 });

        expect(invalidMessageResponse.status).toBe(500);
        expect(invalidMessageResponse.body.error).toBe('Parent message with ID 9999 not found');
      });

      // Test cases for error handling and edge cases
      describe('Error handling and edge cases', () => {
        it('should return 400 for invalid temperature parameter', async () => {
          const token = await obtainAuthToken();

          let response = await request(app)
            .post('/api/get_completion_for_message')
            .set('Authorization', `Bearer ${token}`)
            .send({ messageId: 1, model: 'test-model', temperature: 'invalid' });

          expect(response.status).toBe(400);
          expect(response.body.errors).toBeDefined();
          expect(response.body.errors[0].msg).toBe('Temperature must be a float');
        });

        it('should handle empty message content', async () => {
          const token = await obtainAuthToken();
          const emptyMessage = await Message.create({
            content: '',
            conversation_id: testData.conversationIds[0],
            user_id: 1
          });

          const response = await request(app)
            .post('/api/get_completion_for_message')
            .set('Authorization', `Bearer ${token}`)
            .send({ messageId: emptyMessage.get('id'), model: 'test-model', temperature: 0.5 });

          expect(response.status).toBe(500);
          expect(response.body.error).toBe('Message has no content');
        });

        it('should handle missing conversation_id', async () => {
          const token = await obtainAuthToken();
          const messageWithoutConversation = await Message.create({
            content: 'Test message',
            user_id: 1
          });

          const response = await request(app)
            .post('/api/get_completion_for_message')
            .set('Authorization', `Bearer ${token}`)
            .send({ messageId: messageWithoutConversation.get('id'), model: 'test-model', temperature: 0.5 });

          expect(response.status).toBe(500);
          expect(response.body.error).toBe('Parent message has no conversation_id');
        });

        it('should handle unknown model type', async () => {
          const token = await obtainAuthToken();

          const response = await request(app)
            .post('/api/get_completion_for_message')
            .set('Authorization', `Bearer ${token}`)
            .send({ messageId: testData.firstMessageId, model: 'unknown-model', temperature: 0.5 });

          expect(response.status).toBe(500);
          expect(response.body.error).toBeDefined();
        });
      });

      // Restore original mocks after tests
      afterEach(() => {
        jest.restoreAllMocks();
      });
    });
  });
});
