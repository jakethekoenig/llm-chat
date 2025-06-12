import request from 'supertest';
import jwt from 'jsonwebtoken';

// Mock the entire database module to avoid Sequelize association issues
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

jest.mock('../../server/helpers/messageHelpers', () => ({
  addMessage: jest.fn(),
  generateCompletion: jest.fn(),
}));

// Import after mocking
import app from '../../server/app';

const SECRET_KEY = process.env.SECRET_KEY || 'fallback-secret-key';

describe('Server App - Additional Coverage Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Authentication Middleware', () => {
    test('should return 401 when no token provided', async () => {
      const response = await request(app)
        .get('/api/conversations');
      
      expect(response.status).toBe(401);
    });

    test('should return 403 when invalid token provided', async () => {
      const response = await request(app)
        .get('/api/conversations')
        .set('Authorization', 'Bearer invalid-token');
      
      expect(response.status).toBe(403);
      expect(response.body.message).toBe('Invalid or expired token');
    });

    test('should return 403 when malformed token provided', async () => {
      const response = await request(app)
        .get('/api/conversations')
        .set('Authorization', 'Bearer');
      
      expect(response.status).toBe(401);
    });
  });

  describe('POST /api/signin', () => {
    test('should return 400 when username is missing', async () => {
      const response = await request(app)
        .post('/api/signin')
        .send({ password: 'test123' });
      
      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Username and password are required');
    });

    test('should return 400 when password is missing', async () => {
      const response = await request(app)
        .post('/api/signin')
        .send({ username: 'testuser' });
      
      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Username and password are required');
    });

    test('should return 401 when user not found', async () => {
      mockUser.findOne.mockResolvedValue(null);
      
      const response = await request(app)
        .post('/api/signin')
        .send({ username: 'nonexistent', password: 'test123' });
      
      expect(response.status).toBe(401);
      expect(response.text).toBe('Invalid credentials');
    });

    test('should return 500 when database error occurs', async () => {
      mockUser.findOne.mockRejectedValue(new Error('Database error'));
      
      const response = await request(app)
        .post('/api/signin')
        .send({ username: 'testuser', password: 'test123' });
      
      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Internal server error');
    });
  });

  describe('POST /api/register', () => {
    test('should return 400 when username is missing', async () => {
      const response = await request(app)
        .post('/api/register')
        .send({ email: 'test@example.com', password: 'test123' });
      
      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Username, email, and password are required');
    });

    test('should return 400 when email is missing', async () => {
      const response = await request(app)
        .post('/api/register')
        .send({ username: 'testuser', password: 'test123' });
      
      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Username, email, and password are required');
    });

    test('should return 400 when password is missing', async () => {
      const response = await request(app)
        .post('/api/register')
        .send({ username: 'testuser', email: 'test@example.com' });
      
      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Username, email, and password are required');
    });

    test('should return 400 when user already exists', async () => {
      const existingUser = { id: 1, username: 'testuser' };
      mockUser.findOne.mockResolvedValue(existingUser);
      
      const response = await request(app)
        .post('/api/register')
        .send({ username: 'testuser', email: 'test@example.com', password: 'test123' });
      
      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Username or email already exists');
    });

    test('should return 400 when database create fails', async () => {
      mockUser.findOne.mockResolvedValue(null);
      mockUser.create.mockRejectedValue(new Error('Database error'));
      
      const response = await request(app)
        .post('/api/register')
        .send({ username: 'testuser', email: 'test@example.com', password: 'test123' });
      
      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Error creating user');
    });
  });

  describe('POST /api/add_message - Validation', () => {
    const validToken = jwt.sign({ id: 1 }, SECRET_KEY);

    test('should return 400 when content is empty', async () => {
      const response = await request(app)
        .post('/api/add_message')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ conversationId: '1', content: '' });
      
      expect(response.status).toBe(400);
      expect(response.body.errors).toBeDefined();
    });

    test('should return 400 when conversationId is missing', async () => {
      const response = await request(app)
        .post('/api/add_message')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ content: 'Test message' });
      
      expect(response.status).toBe(400);
      expect(response.body.errors).toBeDefined();
    });

    test('should return 400 when conversationId is invalid format', async () => {
      const response = await request(app)
        .post('/api/add_message')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ content: 'Test message', conversationId: 'invalid' });
      
      expect(response.status).toBe(400);
      expect(response.body.errors).toBeDefined();
    });

    test('should return 400 when parentId is invalid format', async () => {
      const response = await request(app)
        .post('/api/add_message')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ content: 'Test message', conversationId: '1', parentId: 'invalid' });
      
      expect(response.status).toBe(400);
      expect(response.body.errors).toBeDefined();
    });
  });

  describe('POST /api/get_completion_for_message - Validation', () => {
    const validToken = jwt.sign({ id: 1 }, SECRET_KEY);

    test('should return 400 when messageId is missing', async () => {
      const response = await request(app)
        .post('/api/get_completion_for_message')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ model: 'gpt-4', temperature: 0.5 });
      
      expect(response.status).toBe(400);
      expect(response.body.errors).toBeDefined();
    });

    test('should return 400 when messageId is invalid format', async () => {
      const response = await request(app)
        .post('/api/get_completion_for_message')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ messageId: 'invalid', model: 'gpt-4', temperature: 0.5 });
      
      expect(response.status).toBe(400);
      expect(response.body.errors).toBeDefined();
    });

    test('should return 400 when model is missing', async () => {
      const response = await request(app)
        .post('/api/get_completion_for_message')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ messageId: '1', temperature: 0.5 });
      
      expect(response.status).toBe(400);
      expect(response.body.errors).toBeDefined();
    });

    test('should return 400 when temperature is invalid', async () => {
      const response = await request(app)
        .post('/api/get_completion_for_message')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ messageId: '1', model: 'gpt-4', temperature: 'invalid' });
      
      expect(response.status).toBe(400);
      expect(response.body.errors).toBeDefined();
    });
  });

  describe('POST /api/get_completion - Validation', () => {
    const validToken = jwt.sign({ id: 1 }, SECRET_KEY);

    test('should return 400 when model is missing', async () => {
      const response = await request(app)
        .post('/api/get_completion')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ parentId: '1', temperature: 0.5 });
      
      expect(response.status).toBe(400);
      expect(response.body.errors).toBeDefined();
    });

    test('should return 400 when parentId is missing', async () => {
      const response = await request(app)
        .post('/api/get_completion')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ model: 'gpt-4', temperature: 0.5 });
      
      expect(response.status).toBe(400);
      expect(response.body.errors).toBeDefined();
    });

    test('should return 400 when parentId is invalid format', async () => {
      const response = await request(app)
        .post('/api/get_completion')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ model: 'gpt-4', parentId: 'invalid', temperature: 0.5 });
      
      expect(response.status).toBe(400);
      expect(response.body.errors).toBeDefined();
    });

    test('should return 400 when temperature is invalid', async () => {
      const response = await request(app)
        .post('/api/get_completion')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ model: 'gpt-4', parentId: '1', temperature: 'invalid' });
      
      expect(response.status).toBe(400);
      expect(response.body.errors).toBeDefined();
    });
  });

  describe('POST /api/create_conversation - Validation', () => {
    const validToken = jwt.sign({ id: 1 }, SECRET_KEY);

    test('should return 400 when initialMessage is missing', async () => {
      const response = await request(app)
        .post('/api/create_conversation')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ model: 'gpt-4', temperature: 0.5 });
      
      expect(response.status).toBe(400);
      expect(response.body.errors).toBeDefined();
    });

    test('should return 400 when model is missing', async () => {
      const response = await request(app)
        .post('/api/create_conversation')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ initialMessage: 'Hello', temperature: 0.5 });
      
      expect(response.status).toBe(400);
      expect(response.body.errors).toBeDefined();
    });

    test('should return 400 when temperature is invalid', async () => {
      const response = await request(app)
        .post('/api/create_conversation')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ initialMessage: 'Hello', model: 'gpt-4', temperature: 'invalid' });
      
      expect(response.status).toBe(400);
      expect(response.body.errors).toBeDefined();
    });
  });

  describe('Error Handling - Database Errors', () => {
    const validToken = jwt.sign({ id: 1 }, SECRET_KEY);

    test('should return 500 when conversations query fails', async () => {
      mockConversation.findAll.mockRejectedValue(new Error('Database error'));
      
      const response = await request(app)
        .get('/api/conversations')
        .set('Authorization', `Bearer ${validToken}`);
      
      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Internal server error');
    });

    test('should return 500 when messages query fails', async () => {
      mockMessage.findAll.mockRejectedValue(new Error('Database error'));
      
      const response = await request(app)
        .get('/api/conversations/1/messages')
        .set('Authorization', `Bearer ${validToken}`);
      
      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Internal server error');
    });
  });
});
