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
            }
          };
          return Promise.resolve(mockStream);
        } else {
          return Promise.resolve({
            content: [{ type: 'text', text: 'Mocked Anthropic response' }]
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
    process.env.XAI_API_KEY = 'test-xai-key';
    
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
    delete process.env.XAI_API_KEY;
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

    test('should stream xAI completion successfully', async () => {
      const chunks: any[] = [];
      
      for await (const chunk of generateStreamingCompletion(1, 'grok-beta', 0.7)) {
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
    test('should generate OpenAI completion successfully', async () => {
      const mockCompletionMessage = {
        get: jest.fn((field: string) => field === 'id' ? 124 : null)
      };
      
      (Message.create as jest.Mock).mockResolvedValue(mockCompletionMessage);
      
      const result = await generateCompletion(1, 'gpt-4', 0.7);
      
      expect(Message.findByPk).toHaveBeenCalledWith(1);
      expect(Message.create).toHaveBeenCalled();
      expect(result).toEqual(mockCompletionMessage);
    });

    test('should generate Anthropic completion successfully', async () => {
      const mockCompletionMessage = {
        get: jest.fn((field: string) => field === 'id' ? 124 : null)
      };
      
      (Message.create as jest.Mock).mockResolvedValue(mockCompletionMessage);
      
      const result = await generateCompletion(1, 'claude-3-opus', 0.7);
      
      expect(Message.findByPk).toHaveBeenCalledWith(1);
      expect(Message.create).toHaveBeenCalled();
      expect(result).toEqual(mockCompletionMessage);
    });

    test('should generate xAI completion successfully', async () => {
      const mockCompletionMessage = {
        get: jest.fn((field: string) => field === 'id' ? 124 : null)
      };
      
      (Message.create as jest.Mock).mockResolvedValue(mockCompletionMessage);
      
      const result = await generateCompletion(1, 'grok-beta', 0.7);
      
      expect(Message.findByPk).toHaveBeenCalledWith(1);
      expect(Message.create).toHaveBeenCalled();
      expect(result).toEqual(mockCompletionMessage);
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

    test('should handle missing OpenAI API key', async () => {
      const originalKey = process.env.OPENAI_API_KEY;
      delete process.env.OPENAI_API_KEY;
      
      await expect(generateCompletion(1, 'gpt-4', 0.7)).rejects.toThrow('OpenAI API key is not set');
      
      // Restore the key
      if (originalKey) process.env.OPENAI_API_KEY = originalKey;
    });

    test('should handle missing Anthropic API key', async () => {
      const originalKey = process.env.ANTHROPIC_API_KEY;
      delete process.env.ANTHROPIC_API_KEY;
      
      await expect(generateCompletion(1, 'claude-3-opus', 0.7)).rejects.toThrow('Anthropic API key is not set');
      
      // Restore the key
      if (originalKey) process.env.ANTHROPIC_API_KEY = originalKey;
    });

    test('should handle missing xAI API key', async () => {
      const originalKey = process.env.XAI_API_KEY;
      delete process.env.XAI_API_KEY;
      
      await expect(generateCompletion(1, 'grok-beta', 0.7)).rejects.toThrow('xAI API key is not set');
      
      // Restore the key
      if (originalKey) process.env.XAI_API_KEY = originalKey;
    });

    test('should handle missing API keys in streaming', async () => {
      const originalOpenAI = process.env.OPENAI_API_KEY;
      const originalAnthropic = process.env.ANTHROPIC_API_KEY;
      const originalXAI = process.env.XAI_API_KEY;
      
      delete process.env.OPENAI_API_KEY;
      const generator1 = generateStreamingCompletion(1, 'gpt-4', 0.7);
      await expect(generator1[Symbol.asyncIterator]().next()).rejects.toThrow('OpenAI API key is not set');

      delete process.env.ANTHROPIC_API_KEY;
      const generator2 = generateStreamingCompletion(1, 'claude-3-opus', 0.7);
      await expect(generator2[Symbol.asyncIterator]().next()).rejects.toThrow('Anthropic API key is not set');

      delete process.env.XAI_API_KEY;
      const generator3 = generateStreamingCompletion(1, 'grok-beta', 0.7);
      await expect(generator3[Symbol.asyncIterator]().next()).rejects.toThrow('xAI API key is not set');
      
      // Restore all keys
      if (originalOpenAI) process.env.OPENAI_API_KEY = originalOpenAI;
      if (originalAnthropic) process.env.ANTHROPIC_API_KEY = originalAnthropic;
      if (originalXAI) process.env.XAI_API_KEY = originalXAI;
    });
  });
});
