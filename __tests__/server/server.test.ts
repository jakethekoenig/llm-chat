import request from 'supertest';
import express from 'express';
import { jest } from '@jest/globals';
import 'jest-styled-components';
import { OpenAI } from 'openai';
import Anthropic from '@anthropic-ai/sdk';

import app, { authenticateToken } from '../../server/app';
import { sequelize } from '../../server/database/models';
import { up, down } from '../../server/database/seeders/20240827043208-seed-test-data';
import { Conversation } from '../../server/database/models/Conversation';
import { Message } from '../../server/database/models/Message';
import { logger } from '../../server/helpers/messageHelpers';
import * as messageHelpers from '../../server/helpers/messageHelpers';

const obtainAuthToken = async () => {
  const response = await request(app)
    .post('/api/signin')
    .send({ username: 'user1', password: 'password1' });
  return response.body.token;
};

// Define mock response types
interface OpenAIResponse {
  choices: Array<{
    message: {
      role: string;
      content: string;
    };
  }>;
}

interface AnthropicResponse {
  content: Array<{
    type: string;
    text: string;
  }>;
}

// Mock OpenAI
const mockOpenAICreate = jest.fn(async (params: any) => {
  if (params.stream) {
    const stream = {
      async *[Symbol.asyncIterator]() {
        yield { choices: [{ delta: { content: 'Test response chunk' } }] };
      }
    };
    return stream;
  }
  return {
    choices: [{
      message: { role: "assistant", content: 'Mocked OpenAI response' }
    }]
  } as OpenAIResponse;
});

jest.mock('openai', () => ({
  OpenAI: jest.fn(() => ({
    chat: {
      completions: {
        create: mockOpenAICreate
      }
    }
  }))
}));

// Mock Anthropic
const mockAnthropicCreate = jest.fn(async (params: any) => {
  if (params.stream) {
    const stream = {
      async *[Symbol.asyncIterator]() {
        yield { type: 'content_block_delta', delta: { text: 'Test response chunk' } };
      }
    };
    return stream;
  }
  return {
    content: [{ type: 'text', text: 'Mocked Anthropic response' }]
  } as AnthropicResponse;
});

jest.mock('@anthropic-ai/sdk', () => ({
  __esModule: true,
  default: jest.fn(() => ({
    messages: {
      create: mockAnthropicCreate
    }
  }))
}));

beforeAll(async () => {
  await sequelize.sequelize.sync({ force: true });
  await up(sequelize.sequelize.getQueryInterface(), sequelize.sequelize);
});

afterAll(async () => {
  await down(sequelize.sequelize.getQueryInterface(), sequelize.sequelize);
  await sequelize.sequelize.close();
  delete process.env.OPENAI_API_KEY;
  delete process.env.ANTHROPIC_API_KEY;
});

beforeEach(() => {
  mockOpenAICreate.mockClear();
  mockAnthropicCreate.mockClear();
  process.env.OPENAI_API_KEY = 'test-openai-key';
  process.env.ANTHROPIC_API_KEY = 'test-anthropic-key';
});

afterEach(async () => {
  await Message.destroy({ where: {} });
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

    const response = await request(app)
      .post('/api/get_completion_for_message')
      .set('Authorization', `Bearer ${token}`)
      .send({ messageId: 1, model: 'test-model', temperature: 0.5 });
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
        .send({ messageId: 1, model: 'gpt-4', temperature: 0.7 });
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
      const message = await Message.create({
        content: 'Test message',
        conversation_id: 1,
        user_id: 1
      });

      const originalKey = process.env.ANTHROPIC_API_KEY;
      delete process.env.ANTHROPIC_API_KEY;

      mockAnthropicCreate.mockImplementationOnce(() => Promise.reject(new Error('Anthropic API key is not set')) as Promise<AnthropicResponse>);

      const response = await request(app)
        .post('/api/get_completion_for_message')
        .set('Authorization', `Bearer ${token}`)
        .send({ messageId: message.get('id'), model: 'claude-3-opus', temperature: 0.7 });
      
      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Anthropic API key is not set');

      process.env.ANTHROPIC_API_KEY = originalKey;
      await message.destroy();
    });

    it('should handle streaming API errors', async () => {
      const conversation = await Conversation.create({ title: 'Test Conversation', user_id: 1 });
      const message = await Message.create({
        content: 'Test message',
        conversation_id: conversation.get('id'),
        user_id: 1
      });

      mockOpenAICreate.mockImplementationOnce(async () => {
        throw new Error('Stream error');
      });

      const response = await request(app)
        .post('/api/get_completion')
        .set('Authorization', `Bearer ${token}`)
        .send({ parentId: message.get('id'), model: 'gpt-4', temperature: 0.7 });

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Stream error');

      await message.destroy();
      await conversation.destroy();
    });

    it('should return 400 for invalid temperature in streaming request', async () => {
      const conversation = await Conversation.create({ title: 'Test Conversation', user_id: 1 });
      const message = await Message.create({
        content: 'Test message',
        conversation_id: conversation.get('id'),
        user_id: 1
      });

      const response = await request(app)
        .post('/api/get_completion')
        .set('Authorization', `Bearer ${token}`)
        .send({ parentId: message.get('id'), model: 'gpt-4', temperature: 1.5 });

      expect(response.status).toBe(400);
      expect(response.body.errors[0].msg).toBe('Temperature must be between 0 and 1');

      await message.destroy();
      await conversation.destroy();
    });

    it('should validate temperature range', async () => {
      const message = await Message.create({
        content: 'Test message',
        conversation_id: 1,
        user_id: 1
      });

      const response = await request(app)
        .post('/api/get_completion')
        .set('Authorization', `Bearer ${token}`)
        .send({ parentId: message.get('id'), model: 'gpt-4', temperature: 1.5 });

      expect(response.status).toBe(400);
      expect(response.body.errors[0].msg).toBe('Temperature must be between 0 and 1');

      await message.destroy();
    }, 30000);

    it('should handle non-streaming Anthropic completions', async () => {
      const anthropicModels = ['claude-3-opus', 'claude-3-sonnet', 'claude-3-haiku'];
      const conversation = await Conversation.create({ title: 'Test Conversation', user_id: 1 });
      
      for (const model of anthropicModels) {
        mockAnthropicCreate.mockImplementationOnce(async () => ({
          content: [{ type: 'text', text: `Mocked ${model} response` }]
        } as AnthropicResponse));

        const message = await Message.create({
          content: 'Test message',
          conversation_id: conversation.get('id'),
          user_id: 1
        });

        const response = await request(app)
          .post('/api/get_completion_for_message')
          .set('Authorization', `Bearer ${token}`)
          .send({ messageId: message.get('id'), model, temperature: 0.7 });
        
        expect(response.status).toBe(201);
        expect(response.body.content).toBe(`Mocked ${model} response`);

        await message.destroy();
      }

      await conversation.destroy();
    }, 30000);

    it('should handle Anthropic streaming responses', async () => {
      const conversation = await Conversation.create({ title: 'Test Conversation', user_id: 1 });
      const message = await Message.create({
        content: 'Test message',
        conversation_id: conversation.get('id'),
        user_id: 1
      });

      mockAnthropicCreate.mockImplementationOnce(async () => ({
        [Symbol.asyncIterator]: async function* () {
          yield { type: 'content_block_delta', delta: { text: 'Test response chunk' } };
          yield { type: 'content_block_delta', delta: { text: ' part 2' } };
        }
      }));

      const response = await request(app)
        .post('/api/get_completion')
        .set('Authorization', `Bearer ${token}`)
        .send({ parentId: message.get('id'), model: 'claude-3-opus', temperature: 0.7, stream: true });

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toBe('text/event-stream');
      expect(response.headers['connection']).toBe('keep-alive');

      await message.destroy();
      await conversation.destroy();
    }, 30000);

    it('should handle Anthropic streaming errors', async () => {
      const conversation = await Conversation.create({ title: 'Test Conversation', user_id: 1 });
      const message = await Message.create({
        content: 'Test message',
        conversation_id: conversation.get('id'),
        user_id: 1
      });

      mockAnthropicCreate.mockImplementationOnce(async () => ({
        [Symbol.asyncIterator]: async function* () {
          throw new Error('Anthropic stream error');
        }
      }));

      const response = await request(app)
        .post('/api/get_completion')
        .set('Authorization', `Bearer ${token}`)
        .send({ parentId: message.get('id'), model: 'claude-3-opus', temperature: 0.7, stream: true });

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Anthropic stream error');

      await message.destroy();
      await conversation.destroy();
    }, 30000);

    it('should handle streaming responses', async () => {
      const conversation = await Conversation.create({ title: 'Test Conversation', user_id: 1 });
      const message = await Message.create({
        content: 'Test message',
        conversation_id: conversation.get('id'),
        user_id: 1
      });

      mockOpenAICreate.mockImplementationOnce(async (params: any) => {
        if (params.stream) {
          return {
            [Symbol.asyncIterator]: async function* () {
              yield { choices: [{ delta: { content: 'Test response chunk' } }] };
              yield { choices: [{ delta: { content: ' part 2' } }] };
            }
          };
        }
        return {
          choices: [{ message: { role: "assistant", content: 'Non-streaming response' } }]
        };
      });

      const response = await request(app)
        .post('/api/get_completion')
        .set('Authorization', `Bearer ${token}`)
        .send({ parentId: message.get('id'), model: 'gpt-4', temperature: 0.7, stream: true });

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toBe('text/event-stream');
      expect(response.headers['connection']).toBe('keep-alive');

      await message.destroy();
      await conversation.destroy();
    }, 30000);

    it('should handle streaming errors gracefully', async () => {
      const conversation = await Conversation.create({ title: 'Test Conversation', user_id: 1 });
      const message = await Message.create({
        content: 'Test message',
        conversation_id: conversation.get('id'),
        user_id: 1
      });

      mockOpenAICreate.mockImplementationOnce(async () => {
        throw new Error('Stream connection error');
      });

      const response = await request(app)
        .post('/api/get_completion')
        .set('Authorization', `Bearer ${token}`)
        .send({ parentId: message.get('id'), model: 'gpt-4', temperature: 0.7, stream: true });

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Stream connection error');

      await message.destroy();
      await conversation.destroy();
    }, 30000);

    it('should validate temperature for streaming requests', async () => {
      const conversation = await Conversation.create({ title: 'Test Conversation', user_id: 1 });
      const message = await Message.create({
        content: 'Test message',
        conversation_id: conversation.get('id'),
        user_id: 1
      });

      const response = await request(app)
        .post('/api/get_completion')
        .set('Authorization', `Bearer ${token}`)
        .send({ parentId: message.get('id'), model: 'gpt-4', temperature: 2.0 });

      expect(response.status).toBe(400);
      expect(response.body.errors[0].msg).toBe('Temperature must be between 0 and 1');

      await message.destroy();
      await conversation.destroy();
    }, 30000);

    it('should return 500 when generating completion fails', async () => {
      const conversation = await Conversation.create({ title: 'Test Conversation', user_id: 1 });
      const message = await Message.create({
        content: 'Test message',
        conversation_id: conversation.get('id'),
        user_id: 1
      });

      mockOpenAICreate.mockImplementationOnce(() => Promise.reject(new Error('Completion service unavailable')));

      const response = await request(app)
        .post('/api/get_completion_for_message')
        .set('Authorization', `Bearer ${token}`)
        .send({ messageId: message.get('id'), model: 'gpt-4', temperature: 0.7 });

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Completion service unavailable');

      await message.destroy();
      await conversation.destroy();
    }, 30000);

    describe('Add Message and Get Completion for Message Endpoints', () => {
      it('should add a new message', async () => {
        const conversation = await Conversation.create({ title: 'Test Conversation', user_id: 1 });
        const parentMessage = await Message.create({
          content: 'Parent message',
          conversation_id: conversation.get('id'),
          user_id: 1
        });

        const response = await request(app)
          .post('/api/add_message')
          .set('Authorization', `Bearer ${token}`)
          .send({
            content: 'New Test Message',
            conversationId: conversation.get('id'),
            parentId: parentMessage.get('id')
          });

        expect(response.status).toBe(201);
        expect(response.body.id).toBeDefined();

        await parentMessage.destroy();
        await conversation.destroy();
      }, 30000);

      it('should return 400 for invalid add_message request', async () => {
        const conversation = await Conversation.create({ title: 'Test Conversation', user_id: 1 });

        const response = await request(app)
          .post('/api/add_message')
          .set('Authorization', `Bearer ${token}`)
          .send({ content: '', conversationId: 'invalid', parentId: null });

        expect(response.status).toBe(400);
        expect(response.body.errors).toBeDefined();
        expect(response.body.errors[0].msg).toBe('Content is required');

        await conversation.destroy();
      }, 30000);

      it('should get completion for a message', async () => {
        const conversation = await Conversation.create({ title: 'Test Conversation', user_id: 1 });
        const message = await Message.create({
          content: 'Test message',
          conversation_id: conversation.get('id'),
          user_id: 1
        });

        mockOpenAICreate.mockImplementationOnce(async (params: any) => {
          return {
            choices: [{
              message: { role: "assistant", content: 'Mocked completion response' }
            }]
          } as OpenAIResponse;
        });

        const response = await request(app)
          .post('/api/get_completion_for_message')
          .set('Authorization', `Bearer ${token}`)
          .send({ messageId: message.get('id'), model: 'gpt-4', temperature: 0.5 });

        expect(response.status).toBe(201);
        expect(response.body.id).toBeDefined();
        expect(response.body.content).toBe('Mocked completion response');

        await message.destroy();
        await conversation.destroy();
      }, 30000);

      it('should return 400 for invalid get_completion_for_message request', async () => {
        const response = await request(app)
          .post('/api/get_completion_for_message')
          .set('Authorization', `Bearer ${token}`)
          .send({ messageId: 'invalid', model: '', temperature: 'invalid' });

        expect(response.status).toBe(400);
        expect(response.body.errors).toBeDefined();
        expect(response.body.errors).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ msg: 'Message ID must be an integer' }),
            expect.objectContaining({ msg: 'Model is required' }),
            expect.objectContaining({ msg: 'Temperature must be between 0 and 1' })
          ])
        );
      });

      it('should return 400 for invalid temperature value', async () => {
        const message = await Message.create({
          content: 'Test message',
          conversation_id: 1,
          user_id: 1
        });

        const response = await request(app)
          .post('/api/get_completion_for_message')
          .set('Authorization', `Bearer ${token}`)
          .send({ messageId: message.get('id'), model: 'gpt-4', temperature: 2.5 });

        expect(response.status).toBe(400);
        expect(response.body.errors).toBeDefined();
        expect(response.body.errors[0].msg).toBe('Temperature must be between 0 and 1');

        await message.destroy();
      }, 30000);

      it('should create a new conversation with valid data', async () => {
        mockOpenAICreate.mockImplementationOnce(async (params: any) => {
          return {
            choices: [{
              message: { role: "assistant", content: 'Mocked completion response' }
            }]
          } as OpenAIResponse;
        });

        const response = await request(app)
          .post('/api/create_conversation')
          .set('Authorization', `Bearer ${token}`)
          .send({ initialMessage: 'Hello, world!', model: 'gpt-4', temperature: 0.7 });

        expect(response.status).toBe(201);
        expect(response.body.conversationId).toBeDefined();
        expect(response.body.initialMessageId).toBeDefined();
        expect(response.body.completionMessageId).toBeDefined();

        // Cleanup
        await Conversation.destroy({ where: { id: response.body.conversationId } });
        await Message.destroy({ where: { conversation_id: response.body.conversationId } });
      }, 30000);

      it('should return 400 for missing initialMessage', async () => {
        const response = await request(app)
          .post('/api/create_conversation')
          .set('Authorization', `Bearer ${token}`)
          .send({ model: 'gpt-4', temperature: 0.7 });

        expect(response.status).toBe(400);
        expect(response.body.errors).toBeDefined();
        expect(response.body.errors[0].msg).toBe('Initial message is required');
      }, 30000);

      it('should return 400 for missing model', async () => {
        const response = await request(app)
          .post('/api/create_conversation')
          .set('Authorization', `Bearer ${token}`)
          .send({ initialMessage: 'Hello, world!', temperature: 0.7 });

        expect(response.status).toBe(400);
        expect(response.body.errors).toBeDefined();
        expect(response.body.errors[0].msg).toBe('Model is required');
      }, 30000);

      it('should return 400 for invalid temperature', async () => {
        const response = await request(app)
          .post('/api/create_conversation')
          .set('Authorization', `Bearer ${token}`)
          .send({ initialMessage: 'Hello, world!', model: 'gpt-4', temperature: 2.5 });

        expect(response.status).toBe(400);
        expect(response.body.errors).toBeDefined();
        expect(response.body.errors[0].msg).toBe('Temperature must be between 0 and 1');
      }, 30000);

      it('should handle database errors gracefully', async () => {
        const createSpy = jest.spyOn(Conversation, 'create').mockImplementationOnce(() => {
          throw new Error('Database connection failed');
        });
        
        const response = await request(app)
          .post('/api/create_conversation')
          .set('Authorization', `Bearer ${token}`)
          .send({ 
            initialMessage: 'Hello, world!', 
            model: 'gpt-4', 
            temperature: 0.7 
          });
        
        expect(response.status).toBe(500);
        expect(response.body.error).toBe('Database connection failed');

        createSpy.mockRestore();
      });

      it('should handle database errors in message creation', async () => {
        const conversation = await Conversation.create({ title: 'Test Conversation', user_id: 1 });
        const createSpy = jest.spyOn(Message, 'create').mockRejectedValueOnce(new Error('Database error'));

        const response = await request(app)
          .post('/api/add_message')
          .set('Authorization', `Bearer ${token}`)
          .send({ 
            content: 'Test message',
            conversationId: conversation.get('id'),
            parentId: null
          });

        expect(response.status).toBe(500);
        expect(response.body.error).toBe('Database error');

        createSpy.mockRestore();
        await conversation.destroy();
      });

      it('should handle database errors in completion creation', async () => {
        const conversation = await Conversation.create({ title: 'Test Conversation', user_id: 1 });
        const message = await Message.create({
          content: 'Test message',
          conversation_id: conversation.get('id'),
          user_id: 1
        });

        const createSpy = jest.spyOn(Message, 'create').mockRejectedValueOnce(new Error('Database error'));

        const response = await request(app)
          .post('/api/get_completion_for_message')
          .set('Authorization', `Bearer ${token}`)
          .send({ 
            messageId: message.get('id'),
            model: 'gpt-4',
            temperature: 0.7
          });

        expect(response.status).toBe(500);
        expect(response.body.error).toBe('Database error');

        createSpy.mockRestore();
        await message.destroy();
        await conversation.destroy();
      });

      it('should handle invalid message creation requests', async () => {
        const conversation = await Conversation.create({ title: 'Test Conversation', user_id: 1 });

        const response = await request(app)
          .post('/api/add_message')
          .set('Authorization', `Bearer ${token}`)
          .send({ 
            content: '', 
            conversationId: conversation.get('id'),
            parentId: null 
          });

        expect(response.status).toBe(400);
        expect(response.body.errors[0].msg).toBe('Content is required');

        await conversation.destroy();
      });

      it('should handle completion service errors gracefully', async () => {
        const conversation = await Conversation.create({ title: 'Test Conversation', user_id: 1 });
        const message = await Message.create({
          content: 'Test message',
          conversation_id: conversation.get('id'),
          user_id: 1
        });

        mockOpenAICreate.mockImplementationOnce(async () => {
          throw new Error('Service unavailable');
        });

        const response = await request(app)
          .post('/api/get_completion_for_message')
          .set('Authorization', `Bearer ${token}`)
          .send({ messageId: message.get('id'), model: 'gpt-4', temperature: 0.7 });

        expect(response.status).toBe(500);
        expect(response.body.error).toBe('Service unavailable');

        await message.destroy();
        await conversation.destroy();
      });

      it('should handle streaming service errors gracefully', async () => {
        const conversation = await Conversation.create({ title: 'Test Conversation', user_id: 1 });
        const message = await Message.create({
          content: 'Test message',
          conversation_id: conversation.get('id'),
          user_id: 1
        });

        mockOpenAICreate.mockImplementationOnce(async () => {
          throw new Error('Service unavailable');
        });

        const response = await request(app)
          .post('/api/get_completion')
          .set('Authorization', `Bearer ${token}`)
          .send({ parentId: message.get('id'), model: 'gpt-4', temperature: 0.7, stream: true });

        expect(response.status).toBe(500);
        expect(response.body.error).toBe('Service unavailable');

        await message.destroy();
        await conversation.destroy();
      }, 30000);

      it('should handle streaming response errors', async () => {
        const conversation = await Conversation.create({ title: 'Test Conversation', user_id: 1 });
        const message = await Message.create({
          content: 'Test message',
          conversation_id: conversation.get('id'),
          user_id: 1
        });

        mockOpenAICreate.mockImplementationOnce(async () => ({
          [Symbol.asyncIterator]: async function* () {
            throw new Error('Stream error during processing');
          }
        }));

        const response = await request(app)
          .post('/api/get_completion')
          .set('Authorization', `Bearer ${token}`)
          .send({ parentId: message.get('id'), model: 'gpt-4', temperature: 0.7, stream: true });

        expect(response.status).toBe(500);
        expect(response.body.error).toBe('Stream error during processing');

        await message.destroy();
        await conversation.destroy();
      }, 30000);

      it('should handle missing OpenAI API key', async () => {
        const conversation = await Conversation.create({ title: 'Test Conversation', user_id: 1 });
        const message = await Message.create({
          content: 'Test message',
          conversation_id: conversation.get('id'),
          user_id: 1
        });

        const originalApiKey = process.env.OPENAI_API_KEY;
        delete process.env.OPENAI_API_KEY;

        const response = await request(app)
          .post('/api/get_completion_for_message')
          .set('Authorization', `Bearer ${token}`)
          .send({ messageId: message.get('id'), model: 'gpt-4', temperature: 0.5 });

        expect(response.status).toBe(500);
        expect(response.body.error).toBe('OpenAI API key is not set');

        process.env.OPENAI_API_KEY = originalApiKey;
        await message.destroy();
        await conversation.destroy();
      });

      it('should handle missing Anthropic API key', async () => {
        const conversation = await Conversation.create({ title: 'Test Conversation', user_id: 1 });
        const message = await Message.create({
          content: 'Test message',
          conversation_id: conversation.get('id'),
          user_id: 1
        });

        const originalKey = process.env.ANTHROPIC_API_KEY;
        delete process.env.ANTHROPIC_API_KEY;

        const response = await request(app)
          .post('/api/get_completion_for_message')
          .set('Authorization', `Bearer ${token}`)
          .send({ messageId: message.get('id'), model: 'claude-3-opus', temperature: 0.5 });

        expect(response.status).toBe(500);
        expect(response.body.error).toBe('Anthropic API key is not set');

        process.env.ANTHROPIC_API_KEY = originalKey;
        await message.destroy();
        await conversation.destroy();
      });

      it('should handle OpenAI API rate limits', async () => {
        const conversation = await Conversation.create({ title: 'Test Conversation', user_id: 1 });
        const message = await Message.create({
          content: 'Test message',
          conversation_id: conversation.get('id'),
          user_id: 1
        });

        mockOpenAICreate.mockImplementationOnce(async () => {
          throw new Error('OpenAI API rate limit exceeded');
        });

        const response = await request(app)
          .post('/api/get_completion_for_message')
          .set('Authorization', `Bearer ${token}`)
          .send({ messageId: message.get('id'), model: 'gpt-4', temperature: 0.5 });

        expect(response.status).toBe(500);
        expect(response.body.error).toBe('OpenAI API rate limit exceeded');

        await message.destroy();
        await conversation.destroy();
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
        const invalidMessageResponse = await request(app)
          .post('/api/get_completion_for_message')
          .set('Authorization', `Bearer ${token}`)
          .send({ messageId: 99999, model: 'test-model', temperature: 0.5 });

        expect(invalidMessageResponse.status).toBe(500);
        expect(invalidMessageResponse.body.error).toBe('Parent message with ID 99999 not found');
      });

      it('should return 500 when message is deleted before completion', async () => {
        const message = await Message.create({
          content: 'Test message',
          conversation_id: 1,
          user_id: 1
        });

        const messageId = message.get('id');
        await message.destroy();

        const response = await request(app)
          .post('/api/get_completion_for_message')
          .set('Authorization', `Bearer ${token}`)
          .send({ messageId, model: 'test-model', temperature: 0.5 });

        expect(response.status).toBe(500);
        expect(response.body.error).toBe(`Parent message with ID ${messageId} not found`);
      });

      // New test for invalid temperature parameter
      it('should return 400 for invalid temperature parameter', async () => {
        const token = await obtainAuthToken();

        let response = await request(app)
          .post('/api/get_completion_for_message')
          .set('Authorization', `Bearer ${token}`)
          .send({ messageId: 1, model: 'test-model', temperature: 'invalid' });

        expect(response.status).toBe(400);
        expect(response.body.errors).toBeDefined();
        expect(response.body.errors[0].msg).toBe('Temperature must be between 0 and 1');
      });

      // Restore original mocks after tests
      afterEach(() => {
        jest.restoreAllMocks();
      });
    });
  });
});
