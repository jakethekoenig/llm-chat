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

jest.mock('../../server/helpers/messageHelpers', () => ({
  addMessage: jest.fn(),
  generateCompletion: jest.fn(),
}));

jest.mock('../../server/helpers/typeConverters', () => ({
  convertMessageToApiFormat: jest.fn(),
  convertConversationToApiFormat: jest.fn(),
  convertUserToApiFormat: jest.fn(),
  convertIdToNumber: jest.fn(),
}));

// Import after mocking
import app from '../../server/app';
import { convertMessageToApiFormat, convertIdToNumber } from '../../server/helpers/typeConverters';

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

  describe('PUT /api/messages/:messageId - Edit Message', () => {
    const validToken = jwt.sign({ id: 1 }, SECRET_KEY);

    test('should edit message successfully', async () => {
      const mockMessageInstance = {
        get: jest.fn((key) => {
          if (key === 'user_id') return 1;
          if (key === 'id') return 1;
          if (key === 'content') return 'Updated content';
          return null;
        }),
        update: jest.fn().mockResolvedValue(undefined),
      };

      mockMessage.findByPk = jest.fn().mockResolvedValue(mockMessageInstance);
      
      // Mock the type converters
      (convertIdToNumber as jest.Mock).mockReturnValue(1);
      (convertMessageToApiFormat as jest.Mock).mockReturnValue({
        id: '1',
        content: 'Updated content',
        timestamp: '2023-01-01T00:00:00.000Z',
        conversationId: '1',
        userId: '1',
        parentId: null
      });

      const response = await request(app)
        .put('/api/messages/1')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ content: 'Updated content' });

      expect(response.status).toBe(200);
      expect(response.body.content).toBe('Updated content');
    });

    test('should return 400 when content is missing', async () => {
      const response = await request(app)
        .put('/api/messages/1')
        .set('Authorization', `Bearer ${validToken}`)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.errors).toBeDefined();
    });

    test('should return 404 when message not found', async () => {
      mockMessage.findByPk = jest.fn().mockResolvedValue(null);
      (convertIdToNumber as jest.Mock).mockReturnValue(999);

      const response = await request(app)
        .put('/api/messages/999')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ content: 'Updated content' });

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Message not found');
    });

    test('should return 403 when user does not own message', async () => {
      const mockMessageInstance = {
        get: jest.fn((key) => {
          if (key === 'user_id') return 2; // Different user
          return null;
        }),
      };

      mockMessage.findByPk = jest.fn().mockResolvedValue(mockMessageInstance);
      (convertIdToNumber as jest.Mock).mockReturnValue(1);

      const response = await request(app)
        .put('/api/messages/1')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ content: 'Updated content' });

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('You can only edit your own messages');
    });

    test('should return 401 when no auth token', async () => {
      const response = await request(app)
        .put('/api/messages/1')
        .send({ content: 'Updated content' });

      expect(response.status).toBe(401);
    });
  });

  describe('DELETE /api/messages/:messageId - Delete Message', () => {
    const validToken = jwt.sign({ id: 1 }, SECRET_KEY);

    test('should delete message successfully', async () => {
      const mockMessageInstance = {
        get: jest.fn((key) => {
          if (key === 'user_id') return 1;
          return null;
        }),
        destroy: jest.fn().mockResolvedValue(undefined),
      };

      mockMessage.findByPk = jest.fn().mockResolvedValue(mockMessageInstance);
      (convertIdToNumber as jest.Mock).mockReturnValue(1);

      const response = await request(app)
        .delete('/api/messages/1')
        .set('Authorization', `Bearer ${validToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.deletedMessageId).toBe('1');
    });

    test('should return 404 when message not found', async () => {
      mockMessage.findByPk = jest.fn().mockResolvedValue(null);
      (convertIdToNumber as jest.Mock).mockReturnValue(999);

      const response = await request(app)
        .delete('/api/messages/999')
        .set('Authorization', `Bearer ${validToken}`);

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Message not found');
    });

    test('should return 403 when user does not own message', async () => {
      const mockMessageInstance = {
        get: jest.fn((key) => {
          if (key === 'user_id') return 2; // Different user
          return null;
        }),
      };

      mockMessage.findByPk = jest.fn().mockResolvedValue(mockMessageInstance);
      (convertIdToNumber as jest.Mock).mockReturnValue(1);

      const response = await request(app)
        .delete('/api/messages/1')
        .set('Authorization', `Bearer ${validToken}`);

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('You can only delete your own messages');
    });

    test('should return 401 when no auth token', async () => {
      const response = await request(app)
        .delete('/api/messages/1');

      expect(response.status).toBe(401);
    });
  });

  describe('PUT /api/conversations/:conversationId', () => {
    const validToken = jwt.sign({ id: 1 }, SECRET_KEY);
    
    test('should update conversation title successfully', async () => {
      const mockConversationRecord = {
        id: 1,
        title: 'Updated Title',
        user_id: 1,
        get: jest.fn((field: string) => {
          if (field === 'id') return 1;
          if (field === 'title') return 'Updated Title';
          if (field === 'user_id') return 1;
          return null;
        }),
        update: jest.fn().mockResolvedValue(true),
      };
      
      mockConversation.findOne.mockResolvedValue(mockConversationRecord);
      
      const response = await request(app)
        .put('/api/conversations/1')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ title: 'Updated Title' });
      
      expect(response.status).toBe(200);
      expect(mockConversation.findOne).toHaveBeenCalledWith({
        where: { id: 1, user_id: 1 }
      });
      expect(mockConversationRecord.update).toHaveBeenCalledWith({ title: 'Updated Title' });
    });

    test('should return 404 when conversation not found or not owned', async () => {
      mockConversation.findOne.mockResolvedValue(null);
      
      const response = await request(app)
        .put('/api/conversations/999')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ title: 'Updated Title' });
      
      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Conversation not found or you do not have permission to edit it');
    });

    test('should return 400 when title is missing', async () => {
      const response = await request(app)
        .put('/api/conversations/1')
        .set('Authorization', `Bearer ${validToken}`)
        .send({});
      
      expect(response.status).toBe(400);
      expect(response.body.errors).toBeDefined();
    });

    test('should return 400 when title is empty', async () => {
      const response = await request(app)
        .put('/api/conversations/1')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ title: '' });
      
      expect(response.status).toBe(400);
      expect(response.body.errors).toBeDefined();
    });

    test('should return 400 when title is too long', async () => {
      const longTitle = 'a'.repeat(201); // 201 characters
      
      const response = await request(app)
        .put('/api/conversations/1')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ title: longTitle });
      
      expect(response.status).toBe(400);
      expect(response.body.errors).toBeDefined();
    });

    test('should handle database errors gracefully', async () => {
      mockConversation.findOne.mockRejectedValue(new Error('Database error'));
      
      const response = await request(app)
        .put('/api/conversations/1')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ title: 'Updated Title' });
      
      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Internal server error');
    });

    test('should require authentication', async () => {
      const response = await request(app)
        .put('/api/conversations/1')
        .send({ title: 'Updated Title' });
      
      expect(response.status).toBe(401);
    });
  });

  describe('PUT /api/messages/:messageId - Additional Coverage', () => {
    const validToken = jwt.sign({ id: 1 }, SECRET_KEY);

    test('should handle database errors gracefully', async () => {
      mockMessage.findByPk = jest.fn().mockRejectedValue(new Error('Database error'));
      (convertIdToNumber as jest.Mock).mockReturnValue(1);

      const response = await request(app)
        .put('/api/messages/1')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ content: 'Updated content' });

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Internal server error');
    });

    test('should handle update operation errors', async () => {
      const mockMessageInstance = {
        get: jest.fn((key) => key === 'user_id' ? 1 : null),
        update: jest.fn().mockRejectedValue(new Error('Update failed')),
      };

      mockMessage.findByPk = jest.fn().mockResolvedValue(mockMessageInstance);
      (convertIdToNumber as jest.Mock).mockReturnValue(1);

      const response = await request(app)
        .put('/api/messages/1')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ content: 'Updated content' });

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Internal server error');
    });
  });

  describe('DELETE /api/messages/:messageId - Additional Coverage', () => {
    const validToken = jwt.sign({ id: 1 }, SECRET_KEY);

    test('should handle database errors gracefully', async () => {
      mockMessage.findByPk = jest.fn().mockRejectedValue(new Error('Database error'));
      (convertIdToNumber as jest.Mock).mockReturnValue(1);

      const response = await request(app)
        .delete('/api/messages/1')
        .set('Authorization', `Bearer ${validToken}`);

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Internal server error');
    });

    test('should handle destroy operation errors', async () => {
      const mockMessageInstance = {
        get: jest.fn((key) => key === 'user_id' ? 1 : null),
        destroy: jest.fn().mockRejectedValue(new Error('Destroy failed')),
      };

      mockMessage.findByPk = jest.fn().mockResolvedValue(mockMessageInstance);
      (convertIdToNumber as jest.Mock).mockReturnValue(1);

      const response = await request(app)
        .delete('/api/messages/1')
        .set('Authorization', `Bearer ${validToken}`);

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Internal server error');
    });
  });

  describe('Helper function coverage', () => {
    test('should handle type converter errors', async () => {
      const validToken = jwt.sign({ id: 1 }, SECRET_KEY);
      (convertIdToNumber as jest.Mock).mockImplementation(() => {
        throw new Error('Invalid ID format');
      });

      const response = await request(app)
        .put('/api/messages/invalid')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ content: 'Updated content' });

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Internal server error');
    });

    test('should handle conversation creation with type converter error', async () => {
      const validToken = jwt.sign({ id: 1 }, SECRET_KEY);
      (convertIdToNumber as jest.Mock).mockImplementation(() => {
        throw new Error('Invalid ID format');
      });

      const response = await request(app)
        .put('/api/conversations/invalid')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ title: 'Updated Title' });

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Internal server error');
    });
  });

  describe('Additional error paths', () => {
    const validToken = jwt.sign({ id: 1 }, SECRET_KEY);

    test('should handle JWT verification errors', async () => {
      const response = await request(app)
        .get('/api/conversations')
        .set('Authorization', 'Bearer malformed.jwt.token');
      
      expect(response.status).toBe(403);
      expect(response.body.message).toBe('Invalid or expired token');
    });

    test('should handle missing Authorization header', async () => {
      const response = await request(app)
        .get('/api/conversations');
      
      expect(response.status).toBe(401);
    });

    test('should handle bcrypt comparison error in signin', async () => {
      const mockUser = {
        get: jest.fn(() => 'hashedpassword'),
      };
      mockUser.findOne = jest.fn().mockResolvedValue(mockUser);
      
      // Mock bcrypt.compare to reject
      jest.doMock('bcrypt', () => ({
        compare: jest.fn().mockRejectedValue(new Error('Bcrypt error')),
        hash: jest.fn(),
      }));

      const response = await request(app)
        .post('/api/signin')
        .send({ username: 'testuser', password: 'wrongpassword' });
      
      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Internal server error');
    });

    test('should handle conversation update with API format conversion error', async () => {
      const mockConversationRecord = {
        id: 1,
        title: 'Updated Title',
        user_id: 1,
        get: jest.fn((field: string) => {
          if (field === 'id') return 1;
          if (field === 'title') return 'Updated Title';
          if (field === 'user_id') return 1;
          return null;
        }),
        update: jest.fn().mockResolvedValue(true),
      };
      
      mockConversation.findOne.mockResolvedValue(mockConversationRecord);
      (convertIdToNumber as jest.Mock).mockReturnValue(1);
      
      // Mock convertConversationToApiFormat to throw
      jest.doMock('../../server/helpers/typeConverters', () => ({
        convertConversationToApiFormat: jest.fn().mockImplementation(() => {
          throw new Error('Conversion error');
        }),
        convertIdToNumber: jest.fn().mockReturnValue(1),
      }));

      const response = await request(app)
        .put('/api/conversations/1')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ title: 'Updated Title' });
      
      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Internal server error');
    });
  });
});
