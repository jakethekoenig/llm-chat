import request from 'supertest';
import app from '../../server/app';

// Mock AI providers for performance testing
jest.mock('openai', () => ({
  OpenAI: jest.fn(() => ({
    chat: {
      completions: {
        create: jest.fn().mockResolvedValue({
          choices: [{ message: { content: 'Fast mock response' } }]
        })
      }
    }
  }))
}));

jest.mock('@anthropic-ai/sdk', () => ({
  __esModule: true,
  default: jest.fn(() => ({
    messages: {
      create: jest.fn().mockResolvedValue({
        content: [{ type: 'text', text: 'Fast mock response' }]
      })
    }
  }))
}));

// Mock database models for faster testing
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
  create: jest.fn(),
};

jest.mock('../../server/database/models/User', () => ({ User: mockUser }));
jest.mock('../../server/database/models/Conversation', () => ({ Conversation: mockConversation }));
jest.mock('../../server/database/models/Message', () => ({ Message: mockMessage }));

jest.mock('../../server/helpers/messageHelpers', () => ({
  addMessage: jest.fn().mockResolvedValue({ get: () => 123 }),
  generateCompletion: jest.fn().mockResolvedValue({ get: () => 124 }),
}));

jest.mock('../../server/helpers/typeConverters', () => ({
  convertMessageToApiFormat: jest.fn().mockReturnValue({ id: '123' }),
  convertConversationToApiFormat: jest.fn().mockReturnValue({ id: '123' }),
  convertUserToApiFormat: jest.fn().mockReturnValue({ id: '123' }),
  convertIdToNumber: jest.fn().mockReturnValue(123),
}));

describe('Performance Tests', () => {
  const SECRET_KEY = 'test-secret-key-that-is-32-characters-long-for-testing';
  let authToken: string;

  beforeAll(async () => {
    process.env.SECRET_KEY = SECRET_KEY;
    process.env.OPENAI_API_KEY = 'test-key';
    
    // Mock successful user authentication
    mockUser.findOne.mockResolvedValue({
      get: () => 1,
      hashed_password: '$2b$10$test.hash.here'
    });

    const bcrypt = require('bcrypt');
    jest.spyOn(bcrypt, 'compare').mockResolvedValue(true);

    const signInResponse = await request(app)
      .post('/api/signin')
      .send({ username: 'testuser', password: 'password' });

    authToken = signInResponse.body.token;
  });

  afterAll(() => {
    delete process.env.SECRET_KEY;
    delete process.env.OPENAI_API_KEY;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockConversation.findAll.mockResolvedValue([]);
    mockMessage.findAll.mockResolvedValue([]);
    mockMessage.findByPk.mockResolvedValue({ get: () => 'test content' });
    mockConversation.create.mockResolvedValue({ get: () => 123 });
    mockMessage.create.mockResolvedValue({ get: () => 123 });
  });

  describe('Response Time Tests', () => {
    test('authentication should respond quickly', async () => {
      const startTime = Date.now();
      
      const response = await request(app)
        .post('/api/signin')
        .send({ username: 'testuser', password: 'password' });
      
      const duration = Date.now() - startTime;
      
      expect(response.status).toBe(200);
      expect(duration).toBeLessThan(500); // Should respond in under 500ms
    });

    test('conversation listing should respond quickly', async () => {
      const startTime = Date.now();
      
      const response = await request(app)
        .get('/api/conversations')
        .set('Authorization', `Bearer ${authToken}`);
      
      const duration = Date.now() - startTime;
      
      expect(response.status).toBe(200);
      expect(duration).toBeLessThan(300); // Should respond in under 300ms
    });

    test('message creation should respond quickly', async () => {
      const startTime = Date.now();
      
      const response = await request(app)
        .post('/api/add_message')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          content: 'Test message',
          conversationId: '1'
        });
      
      const duration = Date.now() - startTime;
      
      expect(response.status).toBe(201);
      expect(duration).toBeLessThan(400); // Should respond in under 400ms
    });
  });

  describe('Concurrent Request Handling', () => {
    test('should handle multiple authentication requests concurrently', async () => {
      const concurrentRequests = 20;
      const startTime = Date.now();
      
      const promises = Array(concurrentRequests).fill(null).map(() =>
        request(app)
          .post('/api/signin')
          .send({ username: 'testuser', password: 'password' })
      );
      
      const responses = await Promise.all(promises);
      const duration = Date.now() - startTime;
      
      // All requests should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });
      
      // Should handle all requests in reasonable time
      expect(duration).toBeLessThan(2000);
      
      // Average response time should be reasonable
      const avgResponseTime = duration / concurrentRequests;
      expect(avgResponseTime).toBeLessThan(200);
    });

    test('should handle concurrent conversation operations', async () => {
      const concurrentRequests = 15;
      const startTime = Date.now();
      
      const promises = Array(concurrentRequests).fill(null).map((_, index) =>
        request(app)
          .post('/api/create_conversation')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            initialMessage: `Concurrent message ${index}`,
            model: 'gpt-4',
            temperature: 0.7
          })
      );
      
      const responses = await Promise.all(promises);
      const duration = Date.now() - startTime;
      
      // All requests should succeed
      responses.forEach(response => {
        expect(response.status).toBe(201);
      });
      
      expect(duration).toBeLessThan(3000);
    });

    test('should handle concurrent message additions to same conversation', async () => {
      const concurrentRequests = 10;
      const conversationId = '1';
      
      const promises = Array(concurrentRequests).fill(null).map((_, index) =>
        request(app)
          .post('/api/add_message')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            content: `Concurrent message ${index}`,
            conversationId: conversationId
          })
      );
      
      const responses = await Promise.all(promises);
      
      // All requests should succeed or fail gracefully
      responses.forEach(response => {
        expect([200, 201, 400, 500]).toContain(response.status);
      });
    });
  });

  describe('Memory Usage Tests', () => {
    test('should handle large message content without memory issues', async () => {
      const largeContent = 'A'.repeat(100000); // 100KB message
      
      const response = await request(app)
        .post('/api/add_message')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          content: largeContent,
          conversationId: '1'
        });
      
      expect([201, 400, 413]).toContain(response.status);
    });

    test('should handle multiple large requests sequentially', async () => {
      const largeContent = 'B'.repeat(50000); // 50KB message
      const numberOfRequests = 10;
      
      for (let i = 0; i < numberOfRequests; i++) {
        const response = await request(app)
          .post('/api/add_message')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            content: `${largeContent} - Request ${i}`,
            conversationId: '1'
          });
        
        expect([201, 400, 413]).toContain(response.status);
      }
    });
  });

  describe('Stress Tests', () => {
    test('should handle burst of requests without crashing', async () => {
      const burstSize = 50;
      const requests = [];
      
      // Create burst of different types of requests
      for (let i = 0; i < burstSize; i++) {
        const requestType = i % 4;
        
        switch (requestType) {
          case 0:
            requests.push(
              request(app)
                .get('/api/conversations')
                .set('Authorization', `Bearer ${authToken}`)
            );
            break;
          case 1:
            requests.push(
              request(app)
                .post('/api/add_message')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                  content: `Burst message ${i}`,
                  conversationId: '1'
                })
            );
            break;
          case 2:
            requests.push(
              request(app)
                .get('/api/conversations/1/messages')
                .set('Authorization', `Bearer ${authToken}`)
            );
            break;
          case 3:
            requests.push(
              request(app)
                .post('/api/get_completion_for_message')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                  messageId: '1',
                  model: 'gpt-4',
                  temperature: 0.7
                })
            );
            break;
        }
      }
      
      const startTime = Date.now();
      const responses = await Promise.allSettled(requests);
      const duration = Date.now() - startTime;
      
      // Most requests should succeed
      const successful = responses.filter(r => r.status === 'fulfilled').length;
      const successRate = successful / burstSize;
      
      expect(successRate).toBeGreaterThan(0.8); // At least 80% success rate
      expect(duration).toBeLessThan(10000); // Should complete within 10 seconds
    });

    test('should maintain performance under sustained load', async () => {
      const duration = 5000; // 5 seconds
      const requestInterval = 100; // Request every 100ms
      const startTime = Date.now();
      const responses: any[] = [];
      
      const makeRequest = async () => {
        try {
          const response = await request(app)
            .get('/api/conversations')
            .set('Authorization', `Bearer ${authToken}`);
          responses.push({ status: response.status, time: Date.now() });
        } catch (error) {
          responses.push({ status: 'error', time: Date.now() });
        }
      };
      
      // Send requests at regular intervals
      while (Date.now() - startTime < duration) {
        makeRequest();
        await new Promise(resolve => setTimeout(resolve, requestInterval));
      }
      
      // Wait for all requests to complete
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Analyze performance
      const successfulRequests = responses.filter(r => r.status === 200);
      const successRate = successfulRequests.length / responses.length;
      
      expect(successRate).toBeGreaterThan(0.7); // At least 70% success rate under load
      expect(responses.length).toBeGreaterThan(30); // Should have made reasonable number of requests
    });
  });

  describe('Rate Limiting Performance', () => {
    test('should handle rate limiting gracefully', async () => {
      // Test with production-like rate limiting
      process.env.NODE_ENV = 'production';
      
      const rapidRequests = 120; // Exceed typical rate limit
      const promises = Array(rapidRequests).fill(null).map(() =>
        request(app)
          .get('/api/conversations')
          .set('Authorization', `Bearer ${authToken}`)
      );
      
      const responses = await Promise.allSettled(promises);
      
      // Should have mix of successful and rate-limited responses
      const successful = responses.filter(
        r => r.status === 'fulfilled' && (r.value as any).status === 200
      ).length;
      
      const rateLimited = responses.filter(
        r => r.status === 'fulfilled' && (r.value as any).status === 429
      ).length;
      
      expect(successful).toBeGreaterThan(0);
      expect(successful + rateLimited).toBe(rapidRequests);
      
      // Reset environment
      delete process.env.NODE_ENV;
    });
  });
});
