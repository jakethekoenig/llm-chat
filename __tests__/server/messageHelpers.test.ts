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

import { generateStreamingCompletion, generateCompletion, addMessage } from '../../server/helpers/messageHelpers';
import { Message } from '../../server/database/models/Message';

// Import the helper functions for testing
const messageHelpers = require('../../server/helpers/messageHelpers');

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
              }
            };
            return Promise.resolve(mockStream);
          } else {
            return Promise.resolve({
              choices: [{
                message: { role: "assistant", content: 'Mocked OpenAI response' }
              }]
            });
          }
        })
      }
    }
  }))
}));

// Mock Anthropic with variable response
let anthropicCreateMock = jest.fn();
jest.mock('@anthropic-ai/sdk', () => ({
  __esModule: true,
  default: jest.fn(() => ({
    messages: {
      create: anthropicCreateMock
    }
  }))
}));


describe('messageHelpers - Streaming Functions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Set up environment variables
    process.env.OPENAI_API_KEY = 'test-openai-key';
    process.env.ANTHROPIC_API_KEY = 'test-anthropic-key';
    process.env.DEEPSEEK_API_KEY = 'test-deepseek-key';

    // Set up default Anthropic mock behavior
    anthropicCreateMock.mockImplementation(({ stream }) => {
      if (stream) {
        // Mock streaming response
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
    });
    
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
    delete process.env.DEEPSEEK_API_KEY;
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

    test('should stream DeepSeek completion successfully', async () => {
      const chunks: any[] = [];
      
      for await (const chunk of generateStreamingCompletion(1, 'deepseek-chat', 0.7)) {
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

    test('should throw error when DeepSeek API key is not set', async () => {
      delete process.env.DEEPSEEK_API_KEY;
      
      const generator = generateStreamingCompletion(1, 'deepseek-chat', 0.7);
      const iterator = generator[Symbol.asyncIterator]();
      
      await expect(iterator.next()).rejects.toThrow();
    });

    test('should throw error when OpenAI API key is not set for streaming', async () => {
      delete process.env.OPENAI_API_KEY;
      
      const generator = generateStreamingCompletion(1, 'gpt-4', 0.7);
      const iterator = generator[Symbol.asyncIterator]();
      
      await expect(iterator.next()).rejects.toThrow('Failed to generate streaming completion');
    });

    test('should throw error when Anthropic API key is not set for streaming', async () => {
      delete process.env.ANTHROPIC_API_KEY;
      
      const generator = generateStreamingCompletion(1, 'claude-3-opus', 0.7);
      const iterator = generator[Symbol.asyncIterator]();
      
      await expect(iterator.next()).rejects.toThrow('Failed to generate streaming completion');
    });

    test('should handle unexpected Anthropic content block type', async () => {
      // Mock an unexpected content block type
      anthropicCreateMock.mockImplementation(() => {
        return Promise.resolve({
          content: [{ type: 'unexpected_type', data: 'some data' }]
        });
      });

      await expect(generateCompletion(1, 'claude-3-opus', 0.7)).rejects.toThrow('Failed to generate completion');
    });

  });

  describe('generateCompletion', () => {
    test('should generate OpenAI completion successfully', async () => {
      process.env.OPENAI_API_KEY = 'test-openai-key';
      
      const result = await generateCompletion(1, 'gpt-4', 0.7);
      
      expect(result).toBeDefined();
      expect(Message.findByPk).toHaveBeenCalledWith(1);
      expect(Message.create).toHaveBeenCalled();
    });

    test('should generate Anthropic completion successfully', async () => {
      process.env.ANTHROPIC_API_KEY = 'test-anthropic-key';
      
      const result = await generateCompletion(1, 'claude-3-opus', 0.7);
      
      expect(result).toBeDefined();
      expect(Message.findByPk).toHaveBeenCalledWith(1);
      expect(Message.create).toHaveBeenCalled();
    });

    test('should generate DeepSeek completion successfully', async () => {
      process.env.DEEPSEEK_API_KEY = 'test-deepseek-key';
      
      const result = await generateCompletion(1, 'deepseek-chat', 0.7);
      
      expect(result).toBeDefined();
      expect(Message.findByPk).toHaveBeenCalledWith(1);
      expect(Message.create).toHaveBeenCalled();
    });

    test('should generate DeepSeek completion with deep-seek model name', async () => {
      process.env.DEEPSEEK_API_KEY = 'test-deepseek-key';
      
      const result = await generateCompletion(1, 'deep-seek-v2', 0.7);
      
      expect(result).toBeDefined();
      expect(Message.findByPk).toHaveBeenCalledWith(1);
      expect(Message.create).toHaveBeenCalled();
    });

    test('should throw error when DeepSeek API key is not set', async () => {
      delete process.env.DEEPSEEK_API_KEY;
      
      await expect(generateCompletion(1, 'deepseek-chat', 0.7)).rejects.toThrow('Failed to generate completion');
    });

    test('should throw error when OpenAI API key is not set', async () => {
      delete process.env.OPENAI_API_KEY;
      
      await expect(generateCompletion(1, 'gpt-4', 0.7)).rejects.toThrow('Failed to generate completion');
    });

    test('should throw error when Anthropic API key is not set', async () => {
      delete process.env.ANTHROPIC_API_KEY;
      
      await expect(generateCompletion(1, 'claude-3-opus', 0.7)).rejects.toThrow('Failed to generate completion');
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

  describe('addMessage', () => {
    test('should add message successfully', async () => {
      const mockMessage = {
        get: jest.fn((field: string) => {
          switch (field) {
            case 'id': return 123;
            case 'content': return 'Test message';
            default: return null;
          }
        })
      };
      
      (Message.create as jest.Mock).mockResolvedValue(mockMessage);
      
      const result = await addMessage('Test message', 1, null, 1);
      
      expect(result).toBeDefined();
      expect(Message.create).toHaveBeenCalledWith({
        content: 'Test message',
        conversation_id: 1,
        parent_id: null,
        user_id: 1,
      });
    });

    test('should add message with parent successfully', async () => {
      const mockMessage = {
        get: jest.fn((field: string) => {
          switch (field) {
            case 'id': return 124;
            case 'content': return 'Reply message';
            default: return null;
          }
        })
      };
      
      (Message.create as jest.Mock).mockResolvedValue(mockMessage);
      
      const result = await addMessage('Reply message', 1, 123, 1);
      
      expect(result).toBeDefined();
      expect(Message.create).toHaveBeenCalledWith({
        content: 'Reply message',
        conversation_id: 1,
        parent_id: 123,
        user_id: 1,
      });
    });
  });
});
