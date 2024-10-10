import request from 'supertest';
import express from 'express';
import app, { authenticateToken } from '../../server/app';
import { sequelize } from '../../server/database/models';
import { up, down } from '../../server/database/seeders/20240827043208-seed-test-data';
import { Conversation } from '../../server/database/models/Conversation';
import { Message } from '../../server/database/models/Message';
import { OpenAI } from 'openai';

jest.mock('openai', () => {
  return {
    OpenAI: jest.fn().mockImplementation(() => ({
      completions: {
        create: jest.fn().mockResolvedValue({
          choices: [{ text: 'Mocked completion response' }]
        })
      }
    }))
  };
});
process.env.OPENAI_API_KEY = 'test';

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

  it('should stream data for authenticated users', async () => {
    const signInResponse = await request(app)
      .post('/api/signin')
      .send({ username: 'user1', password: 'password1' });
    const token = signInResponse.body.token;

    const response = await request(app)
      .get('/api/get_completion')
      .set('Authorization', `Bearer ${token}`)
      .expect('Content-Type', /text\/event-stream/)
      .expect(200);

    expect(response.text).toContain('data: Example stream data part 1');
    expect(response.text).toContain('data: Example stream data part 2');
    expect(response.text).toContain('data: Example stream data part 3');
  });

  it('should return 401 for unauthenticated users', async () => {
    const response = await request(app).get('/api/get_completion');
    expect(response.status).toBe(401);
  });

  it('should return 403 for invalid token', async () => {
    const signInResponse = await request(app)
      .post('/api/signin')
      .send({ username: 'user1', password: 'password1' });
    const token = signInResponse.body.token;

    // Tamper the token to make it invalid
    const invalidToken = token ? token.slice(0, -1) + 'x' : 'invalidToken';

    const response = await request(app)
      .get('/api/get_completion')
      .set('Authorization', `Bearer ${invalidToken}`);
    expect(response.status).toBe(403);
  });

  it('should generate a completion for a valid message', async () => {
    const signInResponse = await request(app)
      .post('/api/signin')
      .send({ username: 'user1', password: 'password1' });
    const token = signInResponse.body.token;

    const response = await request(app)
      .post('/api/get_completion_for_message')
      .set('Authorization', `Bearer ${token}`)
      .send({ messageId: 1, model: 'test-model', temperature: 0.5 });
    expect(response.status).toBe(201);
    expect(response.body.id).toBeDefined();
    expect(response.body.content).toBe('Mocked completion response');
  });

  it('should return 400 for invalid messageId', async () => {
    const signInResponse = await request(app)
      .post('/api/signin')
      .send({ username: 'user1', password: 'password1' });
    const token = signInResponse.body.token;

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

    describe('Add Message and Get Completion for Message Endpoints', () => {
      it('should add a new message', async () => {
        const response = await request(app)
          .post('/api/add_message')
          .set('Authorization', `Bearer ${token}`)
          .send({ content: 'New Test Message', conversationId: 1, parentId: 1 });
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
          .send({ messageId: 1, model: 'test-model', temperature: 0.5 });
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
          .post('/create_conversation')
          .set('Authorization', `Bearer ${token}`)
          .send({ initialMessage: 'Hello, world!', model: 'gpt-4o', temperature: 0.0 });
        expect(response.status).toBe(201);
        expect(response.body.conversationId).toBeDefined();
        expect(response.body.initialMessageId).toBeDefined();
        expect(response.body.completionMessageId).toBeDefined();
      });

      it('should return 400 for missing initialMessage', async () => {
        const response = await request(app)
          .post('/create_conversation')
          .set('Authorization', `Bearer ${token}`)
          .send({ model: 'gpt-4o', temperature: 0.0 });
        expect(response.status).toBe(400);
        expect(response.body.errors).toBeDefined();
        expect(response.body.errors[0].msg).toBe('Initial message is required');
      });

      it('should return 400 for missing model', async () => {
        const response = await request(app)
          .post('/create_conversation')
          .set('Authorization', `Bearer ${token}`)
          .send({ initialMessage: 'Hello, world!', temperature: 0.0 });
        expect(response.status).toBe(400);
        expect(response.body.errors).toBeDefined();
        expect(response.body.errors[0].msg).toBe('Model is required');
      });

      it('should return 400 for invalid temperature', async () => {
        const response = await request(app)
          .post('/create_conversation')
          .set('Authorization', `Bearer ${token}`)
          .send({ initialMessage: 'Hello, world!', model: 'gpt-4o', temperature: 'invalid' });
        expect(response.status).toBe(400);
        expect(response.body.errors).toBeDefined();
        expect(response.body.errors[0].msg).toBe('Temperature must be a float');
      });

      it('should return 401 for unauthenticated users', async () => {
        const response = await request(app)
          .post('/create_conversation')
          .send({ initialMessage: 'Hello, world!', model: 'gpt-4o', temperature: 0.0 });
        expect(response.status).toBe(401);
      });

      it('should handle server errors gracefully', async () => {
        // Mock Conversation.create to throw an error
        jest.spyOn(Conversation, 'create').mockImplementationOnce(() => {
          throw new Error('Database error');
        });
        
        const response = await request(app)
          .post('/create_conversation')
          .set('Authorization', `Bearer ${token}`)
          .send({ initialMessage: 'Hello, world!', model: 'gpt-4o', temperature: 0.0 });
        
        expect(response.status).toBe(500);
        expect(response.body.error).toBe('Internal server error');
      });
    });
  });
});
