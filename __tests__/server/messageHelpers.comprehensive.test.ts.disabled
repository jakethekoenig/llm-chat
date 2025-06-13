import { jest } from '@jest/globals';

// Mock database models
const mockMessage = {
  findByPk: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  destroy: jest.fn(),
  get: jest.fn()
} as any;

jest.mock('../../server/database/models/Message', () => ({
  Message: mockMessage
}));

// Mock OpenAI
const mockOpenAICreate = jest.fn() as any;
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
const mockAnthropicCreate = jest.fn() as any;
jest.mock('@anthropic-ai/sdk', () => ({
  __esModule: true,
  default: jest.fn(() => ({
    messages: {
      create: mockAnthropicCreate
    }
  }))
}));

import { 
  addMessage, 
  generateCompletion, 
  generateStreamingCompletion,
  logger
} from '../../server/helpers/messageHelpers';

describe('messageHelpers - Comprehensive Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Set up environment variables
    process.env.OPENAI_API_KEY = 'test-openai-key';
    process.env.ANTHROPIC_API_KEY = 'test-anthropic-key';
  });

  afterEach(() => {
    delete process.env.OPENAI_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
  });

  describe('addMessage', () => {
    test('should create a new message successfully', async () => {
      const mockCreatedMessage = { id: 123, content: 'Test message' };
      mockMessage.create.mockResolvedValue(mockCreatedMessage);

      const result = await addMessage('Test message', 1, null, 1);

      expect(mockMessage.create).toHaveBeenCalledWith({
        content: 'Test message',
        conversation_id: 1,
        parent_id: null,
        user_id: 1,
      });
      expect(result).toEqual(mockCreatedMessage);
    });

    test('should create a message with parent ID', async () => {
      const mockCreatedMessage = { id: 124, content: 'Reply message' };
      mockMessage.create.mockResolvedValue(mockCreatedMessage);

      const result = await addMessage('Reply message', 1, 123, 1);

      expect(mockMessage.create).toHaveBeenCalledWith({
        content: 'Reply message',
        conversation_id: 1,
        parent_id: 123,
        user_id: 1,
      });
      expect(result).toEqual(mockCreatedMessage);
    });

    test('should handle database errors', async () => {
      mockMessage.create.mockRejectedValue(new Error('Database error'));

      await expect(addMessage('Test message', 1, null, 1))
        .rejects.toThrow('Database error');
    });
  });

  describe('generateCompletion - OpenAI', () => {
    beforeEach(() => {
      const mockParentMessage = {
        get: jest.fn((field: string) => {
          switch (field) {
            case 'content': return 'Test message content';
            case 'conversation_id': return 1;
            case 'user_id': return 1;
            case 'id': return 123;
            default: return null;
          }
        })
      };

      const mockCompletionMessage = {
        get: jest.fn((field: string) => field === 'id' ? 124 : null)
      };

      mockMessage.findByPk.mockResolvedValue(mockParentMessage);
      mockMessage.create.mockResolvedValue(mockCompletionMessage);
    });

    test('should generate OpenAI completion successfully', async () => {
      mockOpenAICreate.mockResolvedValue({
        choices: [{
          message: { content: 'OpenAI response' }
        }]
      });

      const result = await generateCompletion(123, 'gpt-4', 0.7);

      expect(mockMessage.findByPk).toHaveBeenCalledWith(123);
      expect(mockOpenAICreate).toHaveBeenCalledWith({
        model: 'gpt-4',
        messages: [{ role: "user", content: 'Test message content' }],
        temperature: 0.7,
      });
      expect(mockMessage.create).toHaveBeenCalledWith({
        content: 'OpenAI response',
        parent_id: 123,
        conversation_id: 1,
        user_id: 1,
        model: 'gpt-4',
        temperature: 0.7,
      });
    });

    test('should handle empty OpenAI response', async () => {
      mockOpenAICreate.mockResolvedValue({
        choices: [{
          message: { content: null }
        }]
      });

      const result = await generateCompletion(123, 'gpt-4', 0.7);

      expect(mockMessage.create).toHaveBeenCalledWith({
        content: '',
        parent_id: 123,
        conversation_id: 1,
        user_id: 1,
        model: 'gpt-4',
        temperature: 0.7,
      });
    });

    test('should handle OpenAI API errors', async () => {
      mockOpenAICreate.mockRejectedValue(new Error('OpenAI API error'));

      await expect(generateCompletion(123, 'gpt-4', 0.7))
        .rejects.toThrow(); // Just check that it throws an error
    });

    test('should handle missing OpenAI API key', async () => {
      delete process.env.OPENAI_API_KEY;

      await expect(generateCompletion(123, 'gpt-4', 0.7))
        .rejects.toThrow(); // Just check that it throws an error
    });
  });

  describe('generateCompletion - Anthropic', () => {
    beforeEach(() => {
      const mockParentMessage = {
        get: jest.fn((field: string) => {
          switch (field) {
            case 'content': return 'Test message content';
            case 'conversation_id': return 1;
            case 'user_id': return 1;
            case 'id': return 123;
            default: return null;
          }
        })
      };

      const mockCompletionMessage = {
        get: jest.fn((field: string) => field === 'id' ? 124 : null)
      };

      mockMessage.findByPk.mockResolvedValue(mockParentMessage);
      mockMessage.create.mockResolvedValue(mockCompletionMessage);
    });

    test('should generate Anthropic completion successfully', async () => {
      mockAnthropicCreate.mockResolvedValue({
        content: [{ type: 'text', text: 'Anthropic response' }]
      });

      const result = await generateCompletion(123, 'claude-3-opus', 0.7);

      expect(mockMessage.findByPk).toHaveBeenCalledWith(123);
      expect(mockAnthropicCreate).toHaveBeenCalledWith({
        model: 'claude-3-opus',
        max_tokens: 1024,
        temperature: 0.7,
        messages: [{ role: 'user', content: 'Test message content' }],
      });
      expect(mockMessage.create).toHaveBeenCalledWith({
        content: 'Anthropic response',
        parent_id: 123,
        conversation_id: 1,
        user_id: 1,
        model: 'claude-3-opus',
        temperature: 0.7,
      });
    });

    test('should detect various Anthropic model names', async () => {
      mockAnthropicCreate.mockResolvedValue({
        content: [{ type: 'text', text: 'Anthropic response' }]
      });

      const anthropicModels = [
        'claude-3-opus',
        'claude-3-sonnet', 
        'claude-3-haiku',
        'CLAUDE-MODEL',
        'some-model-with-sonnet-in-name'
      ];

      for (const model of anthropicModels) {
        await generateCompletion(123, model, 0.7);
        expect(mockAnthropicCreate).toHaveBeenCalled();
        mockAnthropicCreate.mockClear();
      }
    });

    test('should handle unexpected Anthropic content format', async () => {
      mockAnthropicCreate.mockResolvedValue({
        content: [{ type: 'image', data: 'some-data' }]
      });

      await expect(generateCompletion(123, 'claude-3-opus', 0.7))
        .rejects.toThrow('Failed to generate completion');
    });

    test('should handle Anthropic API errors', async () => {
      mockAnthropicCreate.mockRejectedValue(new Error('Anthropic API error'));

      await expect(generateCompletion(123, 'claude-3-opus', 0.7))
        .rejects.toThrow(); // Just check that it throws an error
    });

    test('should handle missing Anthropic API key', async () => {
      delete process.env.ANTHROPIC_API_KEY;

      await expect(generateCompletion(123, 'claude-3-opus', 0.7))
        .rejects.toThrow(); // Just check that it throws an error
    });
  });

  describe('generateCompletion - Error Cases', () => {
    test('should handle non-existent parent message', async () => {
      mockMessage.findByPk.mockResolvedValue(null);

      await expect(generateCompletion(999, 'gpt-4', 0.7))
        .rejects.toThrow('Parent message with ID 999 not found');
    });

    test('should handle parent message with no content', async () => {
      const mockParentMessage = {
        get: jest.fn((field: string) => {
          if (field === 'content') return '';
          return null;
        })
      };

      mockMessage.findByPk.mockResolvedValue(mockParentMessage);

      await expect(generateCompletion(123, 'gpt-4', 0.7))
        .rejects.toThrow('Parent message has no content');
    });

    test('should handle parent message with null content', async () => {
      const mockParentMessage = {
        get: jest.fn((field: string) => {
          if (field === 'content') return null;
          return null;
        })
      };

      mockMessage.findByPk.mockResolvedValue(mockParentMessage);

      await expect(generateCompletion(123, 'gpt-4', 0.7))
        .rejects.toThrow('Parent message has no content');
    });
  });

  describe('generateStreamingCompletion - Error Handling', () => {
    test('should clean up completion message on streaming error', async () => {
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
        get: jest.fn((field: string) => field === 'id' ? 124 : null),
        update: jest.fn(),
        destroy: jest.fn()
      };

      mockMessage.findByPk.mockResolvedValue(mockParentMessage);
      mockMessage.create.mockResolvedValue(mockCompletionMessage);
      mockOpenAICreate.mockRejectedValue(new Error('Streaming API error'));

      const generator = generateStreamingCompletion(123, 'gpt-4', 0.7);
      const iterator = generator[Symbol.asyncIterator]();

      await expect(iterator.next()).rejects.toThrow('Failed to generate streaming completion');
      expect(mockCompletionMessage.destroy).toHaveBeenCalled();
    });

    test('should handle streaming completion with OpenAI chunks containing no content', async () => {
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
        get: jest.fn((field: string) => field === 'id' ? 124 : null),
        update: jest.fn()
      };

      mockMessage.findByPk.mockResolvedValue(mockParentMessage);
      mockMessage.create.mockResolvedValue(mockCompletionMessage);

      const mockStream = {
        async *[Symbol.asyncIterator]() {
          yield { choices: [{ delta: { content: null } }] };
          yield { choices: [{ delta: { content: '' } }] };
          yield { choices: [{ delta: { content: 'Hello' } }] };
        }
      };

      mockOpenAICreate.mockResolvedValue(mockStream);

      const chunks: any[] = [];
      for await (const chunk of generateStreamingCompletion(123, 'gpt-4', 0.7)) {
        chunks.push(chunk);
      }

      expect(chunks.length).toBe(2); // Only chunks with content + completion marker
      expect(chunks[0].chunk).toBe('Hello');
      expect(chunks[1].isComplete).toBe(true);
    });
  });

  describe('logger', () => {
    test('should be properly configured', () => {
      expect(logger).toBeDefined();
      expect(logger.level).toBe('error');
    });
  });
});
