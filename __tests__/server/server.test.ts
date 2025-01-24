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

    it('should validate request parameters', async () => {
      const response = await request(app)
        .post('/api/get_completion')
        .set('Authorization', `Bearer ${token}`)
        .send({ parentId: 'invalid', model: '', temperature: 1.5 });

      expect(response.status).toBe(400);
      expect(response.body.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ msg: 'Parent ID must be an integer' }),
          expect.objectContaining({ msg: 'Model is required' }),
          expect.objectContaining({ msg: 'Temperature must be between 0 and 1' })
        ])
      );
    });

    it('should validate model parameter', async () => {
      const conversation = await Conversation.create({ title: 'Test Conversation', user_id: 1 });
      const message = await Message.create({
        content: 'Test message',
        conversation_id: conversation.get('id'),
        user_id: 1
      });

      const response = await request(app)
        .post('/api/get_completion')
        .set('Authorization', `Bearer ${token}`)
        .send({ parentId: message.get('id'), model: '', temperature: 0.7 });

      expect(response.status).toBe(400);
      expect(response.body.errors[0].msg).toBe('Model is required');

      await message.destroy();
      await conversation.destroy();
    });

    it('should validate parent message exists', async () => {
      const response = await request(app)
        .post('/api/get_completion')
        .set('Authorization', `Bearer ${token}`)
        .send({ parentId: 99999, model: 'gpt-4', temperature: 0.7 });

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Parent message with ID 99999 not found');
    });

    it('should validate conversation exists', async () => {
      const response = await request(app)
        .post('/api/add_message')
        .set('Authorization', `Bearer ${token}`)
        .send({ content: 'Test message', conversationId: 99999, parentId: null });

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Conversation with ID 99999 not found');
    });

    it('should handle successful streaming responses', async () => {
      const conversation = await Conversation.create({ title: 'Test Conversation', user_id: 1 });
      const message = await Message.create({
        content: 'Test message',
        conversation_id: conversation.get('id'),
        user_id: 1
      });

      try {
        mockOpenAICreate.mockImplementationOnce(async () => ({
          [Symbol.asyncIterator]: async function* () {
            yield { choices: [{ delta: { content: 'Test' } }] };
            yield { choices: [{ delta: { content: ' response' } }] };
          }
        }));

        const response = await request(app)
          .post('/api/get_completion')
          .set('Authorization', `Bearer ${token}`)
          .send({ parentId: message.get('id'), model: 'gpt-4', temperature: 0.7 });

        expect(response.status).toBe(200);
        expect(response.headers['content-type']).toBe('text/event-stream');
        expect(response.headers['connection']).toBe('keep-alive');
      } finally {
        await message.destroy();
        await conversation.destroy();
      }
    }, 60000);

    it('should handle empty streaming responses', async () => {
      const conversation = await Conversation.create({ title: 'Test Conversation', user_id: 1 });
      const message = await Message.create({
        content: 'Test message',
        conversation_id: conversation.get('id'),
        user_id: 1
      });

      try {
        mockOpenAICreate.mockImplementationOnce(async () => ({
          [Symbol.asyncIterator]: async function* () {
            // Empty stream
          }
        }));

        const response = await request(app)
          .post('/api/get_completion')
          .set('Authorization', `Bearer ${token}`)
          .send({ parentId: message.get('id'), model: 'gpt-4', temperature: 0.7 });

        expect(response.status).toBe(200);
        expect(response.headers['content-type']).toBe('text/event-stream');
        expect(response.headers['connection']).toBe('keep-alive');
      } finally {
        await message.destroy();
        await conversation.destroy();
      }
    }, 60000);

    it('should handle streaming errors before headers sent', async () => {
      const conversation = await Conversation.create({ title: 'Test Conversation', user_id: 1 });
      const message = await Message.create({
        content: 'Test message',
        conversation_id: conversation.get('id'),
        user_id: 1
      });

      try {
        mockOpenAICreate.mockImplementationOnce(async () => {
          throw new Error('Service unavailable');
        });

        const response = await request(app)
          .post('/api/get_completion')
          .set('Authorization', `Bearer ${token}`)
          .send({ parentId: message.get('id'), model: 'gpt-4', temperature: 0.7 });

        expect(response.status).toBe(500);
        expect(response.body.error).toBe('Service unavailable');
      } finally {
        await message.destroy();
        await conversation.destroy();
      }
    }, 60000);

    it('should handle database errors in message lookup', async () => {
      const findSpy = jest.spyOn(Message, 'findByPk').mockRejectedValueOnce(new Error('Database lookup failed'));

      const response = await request(app)
        .post('/api/get_completion')
        .set('Authorization', `Bearer ${token}`)
        .send({ parentId: 1, model: 'gpt-4', temperature: 0.7 });

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Database lookup failed');

      findSpy.mockRestore();
    });

    it('should handle non-streaming responses', async () => {
      const conversation = await Conversation.create({ title: 'Test Conversation', user_id: 1 });
      const message = await Message.create({
        content: 'Test message',
        conversation_id: conversation.get('id'),
        user_id: 1
      });

      mockOpenAICreate.mockImplementationOnce(async () => ({
        choices: [{ message: { role: "assistant", content: 'Test response' } }]
      }));

      const response = await request(app)
        .post('/api/get_completion_for_message')
        .set('Authorization', `Bearer ${token}`)
        .send({ messageId: message.get('id'), model: 'gpt-4', temperature: 0.7 });

      expect(response.status).toBe(201);
      expect(response.body.content).toBe('Test response');

      await message.destroy();
      await conversation.destroy();
    });

    it('should validate temperature range', async () => {
      const conversation = await Conversation.create({ title: 'Test Conversation', user_id: 1 });
      const message = await Message.create({
        content: 'Test message',
        conversation_id: conversation.get('id'),
        user_id: 1
      });

      const response = await request(app)
        .post('/api/get_completion_for_message')
        .set('Authorization', `Bearer ${token}`)
        .send({ messageId: message.get('id'), model: 'gpt-4', temperature: 1.5 });

      expect(response.status).toBe(400);
      expect(response.body.errors[0].msg).toBe('Temperature must be between 0 and 1');

      await message.destroy();
      await conversation.destroy();
    });

    it('should handle streaming connection errors', async () => {
      const conversation = await Conversation.create({ title: 'Test Conversation', user_id: 1 });
      const message = await Message.create({
        content: 'Test message',
        conversation_id: conversation.get('id'),
        user_id: 1
      });

      mockOpenAICreate.mockImplementationOnce(async () => {
        throw new Error('Connection error');
      });

      const response = await request(app)
        .post('/api/get_completion')
        .set('Authorization', `Bearer ${token}`)
        .send({ parentId: message.get('id'), model: 'gpt-4', temperature: 0.7 });

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Connection error');

      await message.destroy();
      await conversation.destroy();
    });

    it('should handle streaming data errors', async () => {
      const conversation = await Conversation.create({ title: 'Test Conversation', user_id: 1 });
      const message = await Message.create({
        content: 'Test message',
        conversation_id: conversation.get('id'),
        user_id: 1
      });

      try {
        mockOpenAICreate.mockImplementationOnce(async () => ({
          [Symbol.asyncIterator]: async function* () {
            yield { choices: [{ delta: { content: 'Test' } }] };
            throw new Error('Stream data error');
          }
        }));

        const response = await request(app)
          .post('/api/get_completion')
          .set('Authorization', `Bearer ${token}`)
          .send({ parentId: message.get('id'), model: 'gpt-4', temperature: 0.7 });

        expect(response.status).toBe(500);
        expect(response.body.error).toBe('Stream data error');
      } finally {
        await message.destroy();
        await conversation.destroy();
      }
    }, 60000);

    it('should validate temperature for streaming requests', async () => {
      const conversation = await Conversation.create({ title: 'Test Conversation', user_id: 1 });
      const message = await Message.create({
        content: 'Test message',
        conversation_id: conversation.get('id'),
        user_id: 1
      });

      try {
        const response = await request(app)
          .post('/api/get_completion')
          .set('Authorization', `Bearer ${token}`)
          .send({ parentId: message.get('id'), model: 'gpt-4', temperature: 2.0 });

        expect(response.status).toBe(400);
        expect(response.body.errors).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ msg: 'Temperature must be between 0 and 1' })
          ])
        );
      } finally {
        await message.destroy();
        await conversation.destroy();
      }
    }, 60000);

    it('should validate all streaming request parameters', async () => {
      const response = await request(app)
        .post('/api/get_completion')
        .set('Authorization', `Bearer ${token}`)
        .send({ parentId: 'invalid', model: '', temperature: 2.0 });

      expect(response.status).toBe(400);
      expect(response.body.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ msg: 'Parent ID must be an integer' }),
          expect.objectContaining({ msg: 'Model is required' }),
          expect.objectContaining({ msg: 'Temperature must be between 0 and 1' })
        ])
      );
    }, 60000);

    it('should return 500 when generating completion fails', async () => {
      const conversation = await Conversation.create({ title: 'Test Conversation', user_id: 1 });
      const message = await Message.create({
        content: 'Test message',
        conversation_id: conversation.get('id'),
        user_id: 1
      });

      try {
        mockOpenAICreate.mockImplementationOnce(async () => {
          throw new Error('Completion service unavailable');
        });

        const response = await request(app)
          .post('/api/get_completion_for_message')
          .set('Authorization', `Bearer ${token}`)
          .send({ messageId: message.get('id'), model: 'gpt-4', temperature: 0.7 });

        expect(response.status).toBe(500);
        expect(response.body.error).toBe('Completion service unavailable');
      } finally {
        await message.destroy();
        await conversation.destroy();
      }
    }, 60000);

    it('should handle database errors in completion creation', async () => {
      const conversation = await Conversation.create({ title: 'Test Conversation', user_id: 1 });
      const message = await Message.create({
        content: 'Test message',
        conversation_id: conversation.get('id'),
        user_id: 1
      });

      try {
        const createSpy = jest.spyOn(Message, 'create').mockRejectedValueOnce(new Error('Database error'));

        const response = await request(app)
          .post('/api/get_completion_for_message')
          .set('Authorization', `Bearer ${token}`)
          .send({ messageId: message.get('id'), model: 'gpt-4', temperature: 0.7 });

        expect(response.status).toBe(500);
        expect(response.body.error).toBe('Database error');

        createSpy.mockRestore();
      } finally {
        await message.destroy();
        await conversation.destroy();
      }
    }, 60000);

    describe('Add Message and Get Completion for Message Endpoints', () => {
      it('should add a new message', async () => {
        const conversation = await Conversation.create({ title: 'Test Conversation', user_id: 1 });
        const parentMessage = await Message.create({
          content: 'Parent message',
          conversation_id: conversation.get('id'),
          user_id: 1
        });

        try {
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
        } finally {
          await parentMessage.destroy();
          await conversation.destroy();
        }
      }, 60000);

      it('should handle invalid conversation ID', async () => {
        const response = await request(app)
          .post('/api/add_message')
          .set('Authorization', `Bearer ${token}`)
          .send({
            content: 'Test message',
            conversationId: 99999,
            parentId: null
          });

        expect(response.status).toBe(404);
        expect(response.body.error).toBe('Conversation with ID 99999 not found');
      }, 60000);

      it('should validate message request parameters', async () => {
        const conversation = await Conversation.create({ title: 'Test Conversation', user_id: 1 });

        try {
          const response = await request(app)
            .post('/api/add_message')
            .set('Authorization', `Bearer ${token}`)
            .send({ content: '', conversationId: 'invalid', parentId: 'invalid' });

          expect(response.status).toBe(400);
          expect(response.body.errors).toEqual(
            expect.arrayContaining([
              expect.objectContaining({ msg: 'Content is required' }),
              expect.objectContaining({ msg: 'Conversation ID must be an integer' }),
              expect.objectContaining({ msg: 'Parent ID must be an integer' })
            ])
          );
        } finally {
          await conversation.destroy();
        }
      }, 60000);

      it('should validate message content', async () => {
        const conversation = await Conversation.create({ title: 'Test Conversation', user_id: 1 });

        try {
          const response = await request(app)
            .post('/api/add_message')
            .set('Authorization', `Bearer ${token}`)
            .send({ 
              content: '',
              conversationId: conversation.get('id'),
              parentId: null
            });

          expect(response.status).toBe(400);
          expect(response.body.errors).toEqual(
            expect.arrayContaining([
              expect.objectContaining({ msg: 'Content is required' })
            ])
          );
        } finally {
          await conversation.destroy();
        }
      }, 60000);

      it('should get completion for a message', async () => {
        const conversation = await Conversation.create({ title: 'Test Conversation', user_id: 1 });
        const message = await Message.create({
          content: 'Test message',
          conversation_id: conversation.get('id'),
          user_id: 1
        });

        try {
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
        } finally {
          await message.destroy();
          await conversation.destroy();
        }
      }, 60000);

      it('should validate completion request parameters', async () => {
        const response = await request(app)
          .post('/api/get_completion_for_message')
          .set('Authorization', `Bearer ${token}`)
          .send({ messageId: 'invalid', model: '', temperature: 'invalid' });

        expect(response.status).toBe(400);
        expect(response.body.errors).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ msg: 'Message ID must be an integer' }),
            expect.objectContaining({ msg: 'Model is required' }),
            expect.objectContaining({ msg: 'Temperature must be between 0 and 1' })
          ])
        );
      }, 60000);

      it('should validate completion request parameters', async () => {
        const response = await request(app)
          .post('/api/get_completion_for_message')
          .set('Authorization', `Bearer ${token}`)
          .send({ messageId: 'invalid', model: '', temperature: 'invalid' });

        expect(response.status).toBe(400);
        expect(response.body.errors).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ msg: 'Message ID must be an integer' }),
            expect.objectContaining({ msg: 'Model is required' }),
            expect.objectContaining({ msg: 'Temperature must be between 0 and 1' })
          ])
        );
      }, 60000);

      it('should validate message ID format', async () => {
        const response = await request(app)
          .post('/api/get_completion_for_message')
          .set('Authorization', `Bearer ${token}`)
          .send({ messageId: 'not-a-number', model: 'gpt-4', temperature: 0.7 });

        expect(response.status).toBe(400);
        expect(response.body.errors).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ msg: 'Message ID must be an integer' })
          ])
        );
      }, 60000);

      it('should validate temperature range for completion', async () => {
        const conversation = await Conversation.create({ title: 'Test Conversation', user_id: 1 });
        const message = await Message.create({
          content: 'Test message',
          conversation_id: conversation.get('id'),
          user_id: 1
        });

        try {
          const response = await request(app)
            .post('/api/get_completion_for_message')
            .set('Authorization', `Bearer ${token}`)
            .send({ messageId: message.get('id'), model: 'gpt-4', temperature: 2.5 });

          expect(response.status).toBe(400);
          expect(response.body.errors).toEqual(
            expect.arrayContaining([
              expect.objectContaining({ msg: 'Temperature must be between 0 and 1' })
            ])
          );
        } finally {
          await message.destroy();
          await conversation.destroy();
        }
      }, 60000);

      it('should validate model parameter for completion', async () => {
        const conversation = await Conversation.create({ title: 'Test Conversation', user_id: 1 });
        const message = await Message.create({
          content: 'Test message',
          conversation_id: conversation.get('id'),
          user_id: 1
        });

        try {
          const response = await request(app)
            .post('/api/get_completion_for_message')
            .set('Authorization', `Bearer ${token}`)
            .send({ messageId: message.get('id'), model: '', temperature: 0.7 });

          expect(response.status).toBe(400);
          expect(response.body.errors).toEqual(
            expect.arrayContaining([
              expect.objectContaining({ msg: 'Model is required' })
            ])
          );
        } finally {
          await message.destroy();
          await conversation.destroy();
        }
      }, 60000);

      it('should create a new conversation with valid data', async () => {
        let conversationId: number | null = null;

        try {
          mockOpenAICreate.mockImplementationOnce(async () => ({
            choices: [{
              message: { role: "assistant", content: 'Mocked completion response' }
            }]
          } as OpenAIResponse));

          const response = await request(app)
            .post('/api/create_conversation')
            .set('Authorization', `Bearer ${token}`)
            .send({ initialMessage: 'Hello, world!', model: 'gpt-4', temperature: 0.7 });

          expect(response.status).toBe(201);
          expect(response.body.conversationId).toBeDefined();
          expect(response.body.initialMessageId).toBeDefined();
          expect(response.body.completionMessageId).toBeDefined();

          conversationId = response.body.conversationId;
        } finally {
          if (conversationId) {
            await Message.destroy({ where: { conversation_id: conversationId } });
            await Conversation.destroy({ where: { id: conversationId } });
          }
        }
      }, 60000);

      it('should validate conversation creation parameters', async () => {
        const response = await request(app)
          .post('/api/create_conversation')
          .set('Authorization', `Bearer ${token}`)
          .send({ initialMessage: '', model: '', temperature: 2.0 });

        expect(response.status).toBe(400);
        expect(response.body.errors).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ msg: 'Initial message is required' }),
            expect.objectContaining({ msg: 'Model is required' }),
            expect.objectContaining({ msg: 'Temperature must be between 0 and 1' })
          ])
        );
      }, 60000);

      it('should validate individual conversation parameters', async () => {
        const testCases = [
          {
            data: { model: 'gpt-4', temperature: 0.7 },
            expectedError: 'Initial message is required'
          },
          {
            data: { initialMessage: 'Hello, world!', temperature: 0.7 },
            expectedError: 'Model is required'
          },
          {
            data: { initialMessage: 'Hello, world!', model: 'gpt-4', temperature: 2.5 },
            expectedError: 'Temperature must be between 0 and 1'
          }
        ];

        for (const testCase of testCases) {
          const response = await request(app)
            .post('/api/create_conversation')
            .set('Authorization', `Bearer ${token}`)
            .send(testCase.data);

          expect(response.status).toBe(400);
          expect(response.body.errors).toEqual(
            expect.arrayContaining([
              expect.objectContaining({ msg: testCase.expectedError })
            ])
          );
        }
      }, 60000);

      it('should validate conversation creation with missing parameters', async () => {
        const response = await request(app)
          .post('/api/create_conversation')
          .set('Authorization', `Bearer ${token}`)
          .send({});

        expect(response.status).toBe(400);
        expect(response.body.errors).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ msg: 'Initial message is required' }),
            expect.objectContaining({ msg: 'Model is required' }),
            expect.objectContaining({ msg: 'Temperature must be between 0 and 1' })
          ])
        );
      }, 60000);

      it('should handle database errors in conversation creation', async () => {
        const createSpy = jest.spyOn(Conversation, 'create').mockRejectedValueOnce(new Error('Database connection failed'));
        
        try {
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
        } finally {
          createSpy.mockRestore();
        }
      }, 60000);

      it('should handle database errors in initial message creation', async () => {
        const conversation = await Conversation.create({ title: 'Test Conversation', user_id: 1 });
        const createSpy = jest.spyOn(Message, 'create').mockRejectedValueOnce(new Error('Database error'));

        try {
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
        } finally {
          createSpy.mockRestore();
          await conversation.destroy();
        }
      }, 60000);

      it('should handle database errors in completion message creation', async () => {
        const conversation = await Conversation.create({ title: 'Test Conversation', user_id: 1 });
        const message = await Message.create({
          content: 'Test message',
          conversation_id: conversation.get('id'),
          user_id: 1
        });

        const createSpy = jest.spyOn(Message, 'create').mockRejectedValueOnce(new Error('Database error'));

        try {
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
        } finally {
          createSpy.mockRestore();
          await message.destroy();
          await conversation.destroy();
        }
      }, 60000);

      it('should handle database errors in conversation lookup', async () => {
        const findSpy = jest.spyOn(Conversation, 'findByPk').mockRejectedValueOnce(new Error('Database lookup failed'));

        try {
          const response = await request(app)
            .post('/api/add_message')
            .set('Authorization', `Bearer ${token}`)
            .send({ 
              content: 'Test message',
              conversationId: 1,
              parentId: null
            });

          expect(response.status).toBe(500);
          expect(response.body.error).toBe('Database lookup failed');
        } finally {
          findSpy.mockRestore();
        }
      }, 60000);

      it('should handle database errors in message lookup', async () => {
        const findSpy = jest.spyOn(Message, 'findByPk').mockRejectedValueOnce(new Error('Database lookup failed'));

        try {
          const response = await request(app)
            .post('/api/get_completion_for_message')
            .set('Authorization', `Bearer ${token}`)
            .send({ 
              messageId: 1,
              model: 'gpt-4',
              temperature: 0.7
            });

          expect(response.status).toBe(500);
          expect(response.body.error).toBe('Database lookup failed');
        } finally {
          findSpy.mockRestore();
        }
      }, 60000);

      it('should handle database errors in message parent lookup', async () => {
        const conversation = await Conversation.create({ title: 'Test Conversation', user_id: 1 });
        const findSpy = jest.spyOn(Message, 'findByPk').mockRejectedValueOnce(new Error('Database lookup failed'));

        try {
          const response = await request(app)
            .post('/api/add_message')
            .set('Authorization', `Bearer ${token}`)
            .send({ 
              content: 'Test message',
              conversationId: conversation.get('id'),
              parentId: 1
            });

          expect(response.status).toBe(500);
          expect(response.body.error).toBe('Database lookup failed');
        } finally {
          findSpy.mockRestore();
          await conversation.destroy();
        }
      }, 60000);

      it('should validate message creation parameters', async () => {
        const conversation = await Conversation.create({ title: 'Test Conversation', user_id: 1 });

        try {
          const testCases = [
            {
              data: { content: '', conversationId: conversation.get('id'), parentId: null },
              expectedError: 'Content is required'
            },
            {
              data: { content: 'Test', conversationId: 'invalid', parentId: null },
              expectedError: 'Conversation ID must be an integer'
            },
            {
              data: { content: 'Test', conversationId: conversation.get('id'), parentId: 'invalid' },
              expectedError: 'Parent ID must be an integer'
            }
          ];

          for (const testCase of testCases) {
            const response = await request(app)
              .post('/api/add_message')
              .set('Authorization', `Bearer ${token}`)
              .send(testCase.data);

            expect(response.status).toBe(400);
            expect(response.body.errors).toEqual(
              expect.arrayContaining([
                expect.objectContaining({ msg: testCase.expectedError })
              ])
            );
          }
        } finally {
          await conversation.destroy();
        }
      }, 60000);

      it('should handle completion service errors', async () => {
        const conversation = await Conversation.create({ title: 'Test Conversation', user_id: 1 });
        const message = await Message.create({
          content: 'Test message',
          conversation_id: conversation.get('id'),
          user_id: 1
        });

        try {
          mockOpenAICreate.mockImplementationOnce(async () => {
            throw new Error('Service unavailable');
          });

          const response = await request(app)
            .post('/api/get_completion_for_message')
            .set('Authorization', `Bearer ${token}`)
            .send({ messageId: message.get('id'), model: 'gpt-4', temperature: 0.7 });

          expect(response.status).toBe(500);
          expect(response.body.error).toBe('Service unavailable');
        } finally {
          await message.destroy();
          await conversation.destroy();
        }
      }, 60000);

      it('should handle completion service rate limits', async () => {
        const conversation = await Conversation.create({ title: 'Test Conversation', user_id: 1 });
        const message = await Message.create({
          content: 'Test message',
          conversation_id: conversation.get('id'),
          user_id: 1
        });

        try {
          mockOpenAICreate.mockImplementationOnce(async () => {
            throw new Error('Rate limit exceeded');
          });

          const response = await request(app)
            .post('/api/get_completion_for_message')
            .set('Authorization', `Bearer ${token}`)
            .send({ messageId: message.get('id'), model: 'gpt-4', temperature: 0.7 });

          expect(response.status).toBe(500);
          expect(response.body.error).toBe('Rate limit exceeded');
        } finally {
          await message.destroy();
          await conversation.destroy();
        }
      }, 60000);

      it('should handle service errors in streaming requests', async () => {
        const conversation = await Conversation.create({ title: 'Test Conversation', user_id: 1 });
        const message = await Message.create({
          content: 'Test message',
          conversation_id: conversation.get('id'),
          user_id: 1
        });

        try {
          mockOpenAICreate.mockImplementationOnce(async () => {
            throw new Error('Service unavailable');
          });

          const response = await request(app)
            .post('/api/get_completion')
            .set('Authorization', `Bearer ${token}`)
            .send({ parentId: message.get('id'), model: 'gpt-4', temperature: 0.7 });

          expect(response.status).toBe(500);
          expect(response.body.error).toBe('Service unavailable');
        } finally {
          await message.destroy();
          await conversation.destroy();
        }
      }, 60000);

      it('should validate parent message existence', async () => {
        const testCases = [
          {
            data: { parentId: 99999, model: 'gpt-4', temperature: 0.7 },
            expectedStatus: 404,
            expectedError: 'Parent message with ID 99999 not found'
          },
          {
            data: { parentId: 'invalid', model: 'gpt-4', temperature: 0.7 },
            expectedStatus: 400,
            expectedError: 'Parent ID must be an integer'
          }
        ];

        for (const testCase of testCases) {
          const response = await request(app)
            .post('/api/get_completion')
            .set('Authorization', `Bearer ${token}`)
            .send(testCase.data);

          expect(response.status).toBe(testCase.expectedStatus);
          if (testCase.expectedStatus === 400) {
            expect(response.body.errors).toEqual(
              expect.arrayContaining([
                expect.objectContaining({ msg: testCase.expectedError })
              ])
            );
          } else {
            expect(response.body.error).toBe(testCase.expectedError);
          }
        }
      }, 60000);

      it('should handle missing API keys', async () => {
        const testCases = [
          {
            model: 'gpt-4',
            envVar: 'OPENAI_API_KEY',
            expectedError: 'OpenAI API key is not set'
          },
          {
            model: 'claude-3-opus',
            envVar: 'ANTHROPIC_API_KEY',
            expectedError: 'Anthropic API key is not set'
          }
        ];

        for (const testCase of testCases) {
          const conversation = await Conversation.create({ title: 'Test Conversation', user_id: 1 });
          const message = await Message.create({
            content: 'Test message',
            conversation_id: conversation.get('id'),
            user_id: 1
          });

          const originalKey = process.env[testCase.envVar];
          delete process.env[testCase.envVar];

          try {
            const response = await request(app)
              .post('/api/get_completion_for_message')
              .set('Authorization', `Bearer ${token}`)
              .send({ messageId: message.get('id'), model: testCase.model, temperature: 0.5 });

            expect(response.status).toBe(500);
            expect(response.body.error).toBe(testCase.expectedError);
          } finally {
            process.env[testCase.envVar] = originalKey;
            await message.destroy();
            await conversation.destroy();
          }
        }
      }, 60000);

      it('should handle API key validation in streaming requests', async () => {
        const testCases = [
          {
            model: 'gpt-4',
            envVar: 'OPENAI_API_KEY',
            expectedError: 'OpenAI API key is not set'
          },
          {
            model: 'claude-3-opus',
            envVar: 'ANTHROPIC_API_KEY',
            expectedError: 'Anthropic API key is not set'
          }
        ];

        for (const testCase of testCases) {
          const conversation = await Conversation.create({ title: 'Test Conversation', user_id: 1 });
          const message = await Message.create({
            content: 'Test message',
            conversation_id: conversation.get('id'),
            user_id: 1
          });

          const originalKey = process.env[testCase.envVar];
          delete process.env[testCase.envVar];

          try {
            const response = await request(app)
              .post('/api/get_completion')
              .set('Authorization', `Bearer ${token}`)
              .send({ parentId: message.get('id'), model: testCase.model, temperature: 0.5 });

            expect(response.status).toBe(500);
            expect(response.body.error).toBe(testCase.expectedError);
          } finally {
            process.env[testCase.envVar] = originalKey;
            await message.destroy();
            await conversation.destroy();
          }
        }
      }, 60000);

      it('should handle API rate limits', async () => {
        const testCases = [
          {
            model: 'gpt-4',
            mockFn: mockOpenAICreate,
            error: 'OpenAI API rate limit exceeded'
          },
          {
            model: 'claude-3-opus',
            mockFn: mockAnthropicCreate,
            error: 'Anthropic API rate limit exceeded'
          }
        ];

        for (const testCase of testCases) {
          const conversation = await Conversation.create({ title: 'Test Conversation', user_id: 1 });
          const message = await Message.create({
            content: 'Test message',
            conversation_id: conversation.get('id'),
            user_id: 1
          });

          try {
            testCase.mockFn.mockImplementationOnce(async () => {
              throw new Error(testCase.error);
            });

            const response = await request(app)
              .post('/api/get_completion_for_message')
              .set('Authorization', `Bearer ${token}`)
              .send({ messageId: message.get('id'), model: testCase.model, temperature: 0.5 });

            expect(response.status).toBe(500);
            expect(response.body.error).toBe(testCase.error);
          } finally {
            await message.destroy();
            await conversation.destroy();
          }
        }
      }, 60000);

      it('should handle streaming API rate limits', async () => {
        const testCases = [
          {
            model: 'gpt-4',
            mockFn: mockOpenAICreate,
            error: 'OpenAI API rate limit exceeded'
          },
          {
            model: 'claude-3-opus',
            mockFn: mockAnthropicCreate,
            error: 'Anthropic API rate limit exceeded'
          }
        ];

        for (const testCase of testCases) {
          const conversation = await Conversation.create({ title: 'Test Conversation', user_id: 1 });
          const message = await Message.create({
            content: 'Test message',
            conversation_id: conversation.get('id'),
            user_id: 1
          });

          try {
            testCase.mockFn.mockImplementationOnce(async () => {
              throw new Error(testCase.error);
            });

            const response = await request(app)
              .post('/api/get_completion')
              .set('Authorization', `Bearer ${token}`)
              .send({ parentId: message.get('id'), model: testCase.model, temperature: 0.5 });

            expect(response.status).toBe(500);
            expect(response.body.error).toBe(testCase.error);
          } finally {
            await message.destroy();
            await conversation.destroy();
          }
        }
      }, 60000);

      it('should validate model parameter in completion requests', async () => {
        const testCases = [
          {
            data: { messageId: 1, model: '', temperature: 0.5 },
            expectedStatus: 400,
            expectedError: 'Model is required'
          },
          {
            data: { messageId: 1, model: 'invalid-model', temperature: 0.5 },
            expectedStatus: 400,
            expectedError: 'Invalid model specified'
          }
        ];

        for (const testCase of testCases) {
          const response = await request(app)
            .post('/api/get_completion_for_message')
            .set('Authorization', `Bearer ${token}`)
            .send(testCase.data);

          expect(response.status).toBe(testCase.expectedStatus);
          expect(response.body.errors).toEqual(
            expect.arrayContaining([
              expect.objectContaining({ msg: testCase.expectedError })
            ])
          );
        }
      }, 60000);

      it('should validate message existence in completion requests', async () => {
        const testCases = [
          {
            data: { messageId: 99999, model: 'gpt-4', temperature: 0.5 },
            expectedStatus: 404,
            expectedError: 'Parent message with ID 99999 not found'
          },
          {
            data: { messageId: 'invalid', model: 'gpt-4', temperature: 0.5 },
            expectedStatus: 400,
            expectedError: 'Message ID must be an integer'
          }
        ];

        for (const testCase of testCases) {
          const response = await request(app)
            .post('/api/get_completion_for_message')
            .set('Authorization', `Bearer ${token}`)
            .send(testCase.data);

          expect(response.status).toBe(testCase.expectedStatus);
          if (testCase.expectedStatus === 400) {
            expect(response.body.errors).toEqual(
              expect.arrayContaining([
                expect.objectContaining({ msg: testCase.expectedError })
              ])
            );
          } else {
            expect(response.body.error).toBe(testCase.expectedError);
          }
        }
      }, 60000);

      it('should handle message deletion during completion', async () => {
        const conversation = await Conversation.create({ title: 'Test Conversation', user_id: 1 });
        const message = await Message.create({
          content: 'Test message',
          conversation_id: conversation.get('id'),
          user_id: 1
        });

        try {
          const messageId = message.get('id');
          await message.destroy();

          const response = await request(app)
            .post('/api/get_completion_for_message')
            .set('Authorization', `Bearer ${token}`)
            .send({ messageId, model: 'gpt-4', temperature: 0.5 });

          expect(response.status).toBe(404);
          expect(response.body.error).toBe(`Parent message with ID ${messageId} not found`);
        } finally {
          await conversation.destroy();
        }
      }, 60000);

      it('should validate temperature parameter', async () => {
        const testCases = [
          {
            data: { messageId: 1, model: 'gpt-4', temperature: 'invalid' },
            expectedError: 'Temperature must be between 0 and 1'
          },
          {
            data: { messageId: 1, model: 'gpt-4', temperature: 2.5 },
            expectedError: 'Temperature must be between 0 and 1'
          },
          {
            data: { messageId: 1, model: 'gpt-4', temperature: -1 },
            expectedError: 'Temperature must be between 0 and 1'
          }
        ];

        for (const testCase of testCases) {
          const response = await request(app)
            .post('/api/get_completion_for_message')
            .set('Authorization', `Bearer ${token}`)
            .send(testCase.data);

          expect(response.status).toBe(400);
          expect(response.body.errors).toEqual(
            expect.arrayContaining([
              expect.objectContaining({ msg: testCase.expectedError })
            ])
          );
        }
      }, 60000);

      it('should validate temperature in streaming requests', async () => {
        const testCases = [
          {
            data: { parentId: 1, model: 'gpt-4', temperature: 'invalid' },
            expectedError: 'Temperature must be between 0 and 1'
          },
          {
            data: { parentId: 1, model: 'gpt-4', temperature: 2.5 },
            expectedError: 'Temperature must be between 0 and 1'
          },
          {
            data: { parentId: 1, model: 'gpt-4', temperature: -1 },
            expectedError: 'Temperature must be between 0 and 1'
          }
        ];

        for (const testCase of testCases) {
          const response = await request(app)
            .post('/api/get_completion')
            .set('Authorization', `Bearer ${token}`)
            .send(testCase.data);

          expect(response.status).toBe(400);
          expect(response.body.errors).toEqual(
            expect.arrayContaining([
              expect.objectContaining({ msg: testCase.expectedError })
            ])
          );
        }
      }, 60000);

      afterEach(async () => {
        // Restore all mocks
        jest.restoreAllMocks();
        mockOpenAICreate.mockClear();
        mockAnthropicCreate.mockClear();

        // Reset environment variables
        process.env.OPENAI_API_KEY = 'test-openai-key';
        process.env.ANTHROPIC_API_KEY = 'test-anthropic-key';

        // Clean up any remaining test data
        await Message.destroy({ where: {} });
        await Conversation.destroy({ where: {} });
      });
    });
  });
});
