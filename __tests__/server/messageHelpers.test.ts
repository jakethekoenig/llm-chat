// Mock database models first
jest.mock('../../server/database/models/Message', () => ({
  Message: {
    findByPk: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    destroy: jest.fn(),
    get: jest.fn()
  }
}));

import { generateStreamingCompletion, generateCompletion } from '../../server/helpers/messageHelpers';
import { Message } from '../../server/database/models/Message';

// Mock OpenAI
jest.mock('openai', () => ({
  OpenAI: jest.fn(() => ({
    chat: {
      completions: {
        create: jest.fn().mockImplementation(({ stream }) => {
          if (stream) {
            // Mock streaming response
            const mockStream = {
              async *[Symbol.asyncIterator]() {
                yield { choices: [{ delta: { content: 'Hello' } }] };
                yield { choices: [{ delta: { content: ' world' } }] };
                yield { choices: [{ delta: { content: '!' } }] };
                yield { choices: [{ delta: { content: '' } }], usage: { prompt_tokens: 100, completion_tokens: 50 } };
              }
            };
            return Promise.resolve(mockStream);
          } else {
            return Promise.resolve({
              choices: [{
                message: { role: "assistant", content: 'Mocked OpenAI response' }
              }],
              usage: { prompt_tokens: 100, completion_tokens: 50 }
            });
          }
        })
      }
    }
  }))
}));

// Mock Anthropic
jest.mock('@anthropic-ai/sdk', () => ({
  __esModule: true,
  default: jest.fn(() => ({
    messages: {
      create: jest.fn().mockImplementation(({ stream }) => {
        if (stream) {
          // Mock streaming response
          const mockStream = {
            async *[Symbol.asyncIterator]() {
              yield { type: 'content_block_delta', delta: { type: 'text_delta', text: 'Hello' } };
              yield { type: 'content_block_delta', delta: { type: 'text_delta', text: ' world' } };
              yield { type: 'content_block_delta', delta: { type: 'text_delta', text: '!' } };
              yield { type: 'message_delta', usage: { input_tokens: 100, output_tokens: 50 } };
            }
          };
          return Promise.resolve(mockStream);
        } else {
          return Promise.resolve({
            content: [{ type: 'text', text: 'Mocked Anthropic response' }],
            usage: { input_tokens: 100, output_tokens: 50 }
          });
        }
      })
    }
  }))
}));


describe('messageHelpers - Streaming Functions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Set up environment variables
    process.env.OPENAI_API_KEY = 'test-openai-key';
    process.env.ANTHROPIC_API_KEY = 'test-anthropic-key';
    
    // Mock message structure
    const mockParentMessage = {
      get: jest.fn((field: string) => {
        switch (field) {
          case 'content': return 'Test message content';
          case 'conversation_id': return 1;
          case 'user_id': return 1;
          default: return null;
        }
      })
    };
    
    const mockCompletionMessage = {
      get: jest.fn((field: string) => {
        switch (field) {
          case 'id': return 123;
          default: return null;
        }
      }),
      update: jest.fn(),
      destroy: jest.fn()
    };
    
    (Message.findByPk as jest.Mock).mockResolvedValue(mockParentMessage);
    (Message.create as jest.Mock).mockResolvedValue(mockCompletionMessage);
  });

  afterEach(() => {
    delete process.env.OPENAI_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
  });

  describe('generateStreamingCompletion', () => {
    test('should stream OpenAI completion successfully', async () => {
      const chunks: any[] = [];
      
      for await (const chunk of generateStreamingCompletion(1, 'gpt-4', 0.7)) {
        chunks.push(chunk);
      }
      
      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks[chunks.length - 1].isComplete).toBe(true);
      expect(Message.findByPk).toHaveBeenCalledWith(1);
      expect(Message.create).toHaveBeenCalled();
    });

    test('should stream Anthropic completion successfully', async () => {
      const chunks: any[] = [];
      
      for await (const chunk of generateStreamingCompletion(1, 'claude-3-opus', 0.7)) {
        chunks.push(chunk);
      }
      
      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks[chunks.length - 1].isComplete).toBe(true);
      expect(Message.findByPk).toHaveBeenCalledWith(1);
      expect(Message.create).toHaveBeenCalled();
    });

    test('should throw error when parent message not found', async () => {
      (Message.findByPk as jest.Mock).mockResolvedValue(null);
      
      const generator = generateStreamingCompletion(999, 'gpt-4', 0.7);
      const iterator = generator[Symbol.asyncIterator]();
      
      await expect(iterator.next()).rejects.toThrow('Parent message with ID 999 not found');
    });

    test('should throw error when message has no content', async () => {
      const mockParentMessage = {
        get: jest.fn((field: string) => {
          switch (field) {
            case 'content': return '';
            case 'conversation_id': return 1;
            case 'user_id': return 1;
            default: return null;
          }
        })
      };
      
      (Message.findByPk as jest.Mock).mockResolvedValue(mockParentMessage);
      
      const generator = generateStreamingCompletion(1, 'gpt-4', 0.7);
      const iterator = generator[Symbol.asyncIterator]();
      
      await expect(iterator.next()).rejects.toThrow('Parent message has no content');
    });

  });

  describe('generateCompletion', () => {
    test('should generate OpenAI completion with cost', async () => {
      const result = await generateCompletion(1, 'gpt-4', 0.7);
      
      expect(Message.findByPk).toHaveBeenCalledWith(1);
      expect(Message.create).toHaveBeenCalledWith(
        expect.objectContaining({
          content: 'Mocked OpenAI response',
          model: 'gpt-4',
          temperature: 0.7,
          cost: expect.any(Number)
        })
      );
    });

    test('should generate Anthropic completion with cost', async () => {
      const result = await generateCompletion(1, 'claude-3-opus', 0.7);
      
      expect(Message.findByPk).toHaveBeenCalledWith(1);
      expect(Message.create).toHaveBeenCalledWith(
        expect.objectContaining({
          content: 'Mocked Anthropic response',
          model: 'claude-3-opus',
          temperature: 0.7,
          cost: expect.any(Number)
        })
      );
    });

    test('should throw error when parent message not found', async () => {
      (Message.findByPk as jest.Mock).mockResolvedValue(null);
      
      await expect(generateCompletion(999, 'gpt-4', 0.7)).rejects.toThrow('Parent message with ID 999 not found');
    });

    test('should throw error when message has no content', async () => {
      const mockParentMessage = {
        get: jest.fn((field: string) => {
          switch (field) {
            case 'content': return '';
            case 'conversation_id': return 1;
            case 'user_id': return 1;
            default: return null;
          }
        })
      };
      
      (Message.findByPk as jest.Mock).mockResolvedValue(mockParentMessage);
      
      await expect(generateCompletion(1, 'gpt-4', 0.7)).rejects.toThrow('Parent message has no content');
    });
  });

  describe('Cost Calculation', () => {
    // We'll test cost calculation indirectly through the completion functions
    // since the cost calculation functions are not exported
    test('should calculate cost for different OpenAI models', async () => {
      const models = ['gpt-4', 'gpt-3.5-turbo', 'gpt-4-turbo'];
      
      for (const model of models) {
        await generateCompletion(1, model, 0.7);
        expect(Message.create).toHaveBeenCalledWith(
          expect.objectContaining({
            cost: expect.any(Number)
          })
        );
      }
    });

    test('should calculate cost for different Anthropic models', async () => {
      const models = ['claude-3-opus-20240229', 'claude-3-sonnet-20240229', 'claude-3-haiku-20240307'];
      
      for (const model of models) {
        await generateCompletion(1, model, 0.7);
        expect(Message.create).toHaveBeenCalledWith(
          expect.objectContaining({
            cost: expect.any(Number)
          })
        );
      }
    });

    test('should handle missing usage data gracefully', async () => {
      // Mock OpenAI without usage data
      const OpenAI = require('openai').OpenAI;
      const mockCreate = jest.fn().mockResolvedValue({
        choices: [{
          message: { role: "assistant", content: 'Response without usage' }
        }]
        // No usage field
      });
      
      OpenAI.mockImplementation(() => ({
        chat: {
          completions: {
            create: mockCreate
          }
        }
      }));

      await generateCompletion(1, 'gpt-4', 0.7);
      expect(Message.create).toHaveBeenCalledWith(
        expect.objectContaining({
          cost: 0 // Should default to 0 when no usage data
        })
      );
    });
  });
});
