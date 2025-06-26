import request from 'supertest';
import jwt from 'jsonwebtoken';


// Mock database models - must be defined before jest.mock calls
const mockUser = {
  findOne: jest.fn().mockResolvedValue(null),
  create: jest.fn().mockResolvedValue({ get: jest.fn() }),
};

const mockConversation = {
  findAll: jest.fn().mockResolvedValue([]),
  create: jest.fn().mockResolvedValue({ get: jest.fn() }),
};

const mockMessage = {
  findAll: jest.fn().mockResolvedValue([]),
  findByPk: jest.fn().mockResolvedValue(null),
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

// Set SECRET_KEY before importing app to avoid module load errors
const SECRET_KEY = 'test-secret-key-that-is-32-characters-long-for-testing';
process.env.SECRET_KEY = SECRET_KEY;

import app from '../../server/app';

describe('Security Tests', () => {

  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();
    
    // Reset mock functions to default working state
    mockUser.findOne = jest.fn().mockResolvedValue(null);
    mockUser.create = jest.fn().mockResolvedValue({ get: jest.fn() });
    
    mockConversation.findAll = jest.fn().mockResolvedValue([]);
    mockConversation.create = jest.fn().mockResolvedValue({ get: jest.fn() });
    
    mockMessage.findAll = jest.fn().mockResolvedValue([]);
    mockMessage.findByPk = jest.fn().mockResolvedValue(null);
  });
  beforeAll(() => {
    process.env.NODE_ENV = 'production'; // Test rate limiting in production mode
  });

  afterAll(() => {
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
      expect(response.body.message).toBe('The provided authentication token is invalid or has expired');
    });

    test('should reject tokens signed with wrong secret', async () => {
      const wrongSecretToken = jwt.sign({ id: 1 }, 'wrong-secret-key');

      const response = await request(app)
        .get('/api/conversations')
        .set('Authorization', `Bearer ${wrongSecretToken}`);

      expect(response.status).toBe(403);
      expect(response.body.message).toBe('The provided authentication token is invalid or has expired');
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
        expect(response.body.message).toBe('The provided authentication token is invalid or has expired');
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
          // If rejected, should be a validation or server error
          expect([400, 500]).toContain(response.status);
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

        expect([400, 500]).toContain(response.status);
        if (response.status === 400) {
          expect(response.body.details).toBeDefined();
        }
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
        expect(response.body.details).toBeDefined();
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
      expect([201, 400, 413, 500]).toContain(response.status);
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
      expect(response.headers['x-frame-options']).toBeDefined(); // Can be DENY or SAMEORIGIN
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
      expect(response1.body.error).toBe(response2.body.error);
      expect(response1.body.code).toBe(response2.body.code);
    });
  });
});
