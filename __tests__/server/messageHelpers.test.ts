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

import { generateStreamingCompletion, generateCompletion, addMessage, isGeminiModel, isAnthropicModel } from '../../server/helpers/messageHelpers';
import { Message } from '../../server/database/models/Message';

// Mock OpenAI
jest.mock('openai', () => ({
  OpenAI: jest.fn().mockImplementation((config) => {
    const isOpenRouter = config?.baseURL === 'https://openrouter.ai/api/v1';
    const responseContent = isOpenRouter ? 'Mocked OpenRouter response' : 'Mocked OpenAI response';
    
    return {
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
                  message: { role: "assistant", content: responseContent }
                }]
              });
            }
          })
        }
      }
    };
  })
}));

// Mock Google GenerativeAI
const mockGenerateContent = jest.fn();
const mockGenerateContentStream = jest.fn();
const mockGetGenerativeModel = jest.fn();

jest.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: jest.fn().mockImplementation(() => ({
    getGenerativeModel: mockGetGenerativeModel
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
    process.env.OPENROUTER_API_KEY = 'test-openrouter-key';
    
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
    delete process.env.OPENROUTER_API_KEY;
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

    test('should stream OpenRouter completion successfully', async () => {
      process.env.OPENROUTER_API_KEY = 'test-openrouter-key';
      const chunks: any[] = [];
      
      for await (const chunk of generateStreamingCompletion(1, 'meta-llama/llama-3.1-70b-instruct', 0.7)) {
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
        get: jest.fn((field: string) => {
          switch (field) {
            case 'id': return 123;
            case 'content': return 'Mocked OpenAI response';
            default: return null;
          }
        })
      };
      
      (Message.create as jest.Mock).mockResolvedValue(mockCompletionMessage);
      
      const result = await generateCompletion(1, 'gpt-4', 0.7);
      
      expect(result).toBe(mockCompletionMessage);
      expect(Message.findByPk).toHaveBeenCalledWith(1);
      expect(Message.create).toHaveBeenCalled();
    });

    test('should generate Anthropic completion successfully', async () => {
      const mockCompletionMessage = {
        get: jest.fn((field: string) => {
          switch (field) {
            case 'id': return 123;
            case 'content': return 'Mocked Anthropic response';
            default: return null;
          }
        })
      };
      
      (Message.create as jest.Mock).mockResolvedValue(mockCompletionMessage);
      
      const result = await generateCompletion(1, 'claude-3-opus', 0.7);
      
      expect(result).toBe(mockCompletionMessage);
      expect(Message.findByPk).toHaveBeenCalledWith(1);
      expect(Message.create).toHaveBeenCalled();
    });

    test('should generate Llama completion successfully via OpenRouter', async () => {
      const mockCompletionMessage = {
        get: jest.fn((field: string) => {
          switch (field) {
            case 'id': return 123;
            case 'content': return 'Mocked OpenRouter response';
            default: return null;
          }
        })
      };
      
      (Message.create as jest.Mock).mockResolvedValue(mockCompletionMessage);
      
      const result = await generateCompletion(1, 'meta-llama/llama-3.1-70b-instruct', 0.7);
      
      expect(result).toBe(mockCompletionMessage);
      expect(Message.findByPk).toHaveBeenCalledWith(1);
      expect(Message.create).toHaveBeenCalled();
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

  describe('Model Detection', () => {
    test('should use OpenAI for unknown model types', async () => {
      const mockCompletionMessage = {
        get: jest.fn((field: string) => {
          switch (field) {
            case 'id': return 123;
            case 'content': return 'Mocked OpenAI response';
            default: return null;
          }
        })
      };
      
      (Message.create as jest.Mock).mockResolvedValue(mockCompletionMessage);
      
      const result = await generateCompletion(1, 'unknown-model', 0.7);
      
      expect(result).toBe(mockCompletionMessage);
      expect(Message.findByPk).toHaveBeenCalledWith(1);
      expect(Message.create).toHaveBeenCalled();
    });

    test('should use OpenAI for streaming unknown model types', async () => {
      const chunks: any[] = [];
      
      for await (const chunk of generateStreamingCompletion(1, 'unknown-model', 0.7)) {
        chunks.push(chunk);
      }
      
      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks[chunks.length - 1].isComplete).toBe(true);
      expect(Message.findByPk).toHaveBeenCalledWith(1);
      expect(Message.create).toHaveBeenCalled();
    });

    test('should handle edge case with different Llama model naming', async () => {
      const chunks: any[] = [];
      
      for await (const chunk of generateStreamingCompletion(1, 'llama3-custom', 0.7)) {
        chunks.push(chunk);
      }
      
      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks[chunks.length - 1].isComplete).toBe(true);
    });

  });

  describe('addMessage', () => {
    test('should create message with all parameters', async () => {
      const mockMessage = {
        get: jest.fn(() => 'test message'),
        content: 'Test content',
        conversation_id: 1,
        parent_id: null,
        user_id: 1
      };
      
      (Message.create as jest.Mock).mockResolvedValue(mockMessage);
      
      const result = await addMessage('Test content', 1, null, 1);
      
      expect(Message.create).toHaveBeenCalledWith({
        content: 'Test content',
        conversation_id: 1,
        parent_id: null,
        user_id: 1
      });
      expect(result).toBe(mockMessage);
    });

    test('should create message with parent ID', async () => {
      const mockMessage = {
        get: jest.fn(() => 'test message'),
        content: 'Reply content',
        conversation_id: 1,
        parent_id: 5,
        user_id: 2
      };
      
      (Message.create as jest.Mock).mockResolvedValue(mockMessage);
      
      const result = await addMessage('Reply content', 1, 5, 2);
      
      expect(Message.create).toHaveBeenCalledWith({
        content: 'Reply content',
        conversation_id: 1,
        parent_id: 5,
        user_id: 2
      });
      expect(result).toBe(mockMessage);
    });

    test('should add message with parent id', async () => {
      const mockMessage = {
        get: jest.fn((field: string) => {
          switch (field) {
            case 'id': return 10;
            case 'content': return 'Reply content';
            case 'conversation_id': return 1;
            case 'parent_id': return 5;
            case 'user_id': return 2;
            default: return null;
          }
        }),
        update: jest.fn(),
        destroy: jest.fn()
      };
      
      (Message.create as jest.Mock).mockResolvedValue(mockMessage);
      
      const result = await addMessage('Reply content', 1, 5, 2);
      
      expect(Message.create).toHaveBeenCalledWith({
        content: 'Reply content',
        conversation_id: 1,
        parent_id: 5,
        user_id: 2
      });
      expect(result).toBe(mockMessage);
    });
  });

  describe('Model Detection', () => {
    test('should detect Gemini models correctly', () => {
      expect(isGeminiModel('gemini-pro')).toBe(true);
      expect(isGeminiModel('gemini-1.5-pro')).toBe(true);
      expect(isGeminiModel('gemini-flash')).toBe(true);
      expect(isGeminiModel('text-bison')).toBe(true);
      expect(isGeminiModel('chat-bison')).toBe(true);
      expect(isGeminiModel('palm-2')).toBe(true);
      expect(isGeminiModel('GEMINI-PRO')).toBe(true); // case insensitive
      expect(isGeminiModel('gpt-4')).toBe(false);
      expect(isGeminiModel('claude-3')).toBe(false);
    });

    test('should detect Anthropic models correctly', () => {
      expect(isAnthropicModel('claude-3-5-sonnet')).toBe(true);
      expect(isAnthropicModel('claude-3-haiku')).toBe(true);
      expect(isAnthropicModel('claude-3-opus')).toBe(true);
      expect(isAnthropicModel('CLAUDE-SONNET')).toBe(true); // case insensitive
      expect(isAnthropicModel('gpt-4')).toBe(false);
      expect(isAnthropicModel('gemini-pro')).toBe(false);
    });
  });

  describe('Gemini Integration', () => {
    beforeEach(() => {
      process.env.GOOGLE_API_KEY = 'test-google-key';
      
      // Set up Gemini mocks
      mockGetGenerativeModel.mockReturnValue({
        generateContent: mockGenerateContent,
        generateContentStream: mockGenerateContentStream
      });
      
      mockGenerateContent.mockResolvedValue({
        response: {
          text: () => 'Gemini response'
        }
      });
      
      mockGenerateContentStream.mockResolvedValue({
        stream: (async function* () {
          yield { text: () => 'Gemini ' };
          yield { text: () => 'streaming ' };
          yield { text: () => 'response' };
        })()
      });
    });

    afterEach(() => {
      delete process.env.GOOGLE_API_KEY;
      jest.clearAllMocks();
    });

    test('should generate completion for Gemini model', async () => {
      const completion = await generateCompletion(1, 'gemini-pro', 0.7);
      
      expect(Message.create).toHaveBeenCalledWith({
        content: 'Gemini response',
        parent_id: 1,
        conversation_id: 1,
        user_id: 1,
        model: 'gemini-pro',
        temperature: 0.7
      });
      expect(completion).toBe(mockMessage);
    });

    test('should handle missing Google API key', async () => {
      delete process.env.GOOGLE_API_KEY;
      
      await expect(generateCompletion(1, 'gemini-pro', 0.7))
        .rejects.toThrow('Failed to generate completion');
    });

    test('should generate streaming completion for Gemini model', async () => {
      const chunks: string[] = [];
      const generator = generateStreamingCompletion(1, 'gemini-pro', 0.7);
      
      for await (const chunk of generator) {
        chunks.push(chunk.chunk);
        if (chunk.isComplete) break;
      }
      
      expect(chunks).toEqual(['Gemini ', 'streaming ', 'response', '']);
    });

    test('should handle Gemini API errors', async () => {
      mockGenerateContent.mockRejectedValue(new Error('Gemini API error'));
      
      await expect(generateCompletion(1, 'gemini-pro', 0.7))
        .rejects.toThrow('Failed to generate completion');
    });

    test('should handle streaming API errors', async () => {
      mockGenerateContentStream.mockRejectedValue(new Error('Streaming error'));
      
      const generator = generateStreamingCompletion(1, 'gemini-pro', 0.7);
      
      await expect(async () => {
        for await (const chunk of generator) {
          // Should throw error
        }
      }).rejects.toThrow('Failed to generate streaming completion');
    });
  });

  describe('Provider Function Testing', () => {
    test('should test Anthropic completion function directly', async () => {
      process.env.ANTHROPIC_API_KEY = 'test-anthropic-key';
      
      // Reset mocks to test actual function
      jest.clearAllMocks();
      
      const completion = await generateCompletion(1, 'claude-3-haiku', 0.5);
      expect(completion).toBeDefined();
      expect(Message.create).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'claude-3-haiku',
          temperature: 0.5
        })
      );
    });

    test('should test Gemini completion function directly', async () => {
      process.env.GOOGLE_API_KEY = 'test-google-key';
      
      // Set up Gemini mocks properly
      mockGetGenerativeModel.mockReturnValue({
        generateContent: mockGenerateContent,
        generateContentStream: mockGenerateContentStream
      });
      
      mockGenerateContent.mockResolvedValue({
        response: {
          text: () => 'Test Gemini response'
        }
      });
      
      const completion = await generateCompletion(1, 'gemini-1.5-pro', 0.8);
      expect(completion).toBeDefined();
      expect(mockGetGenerativeModel).toHaveBeenCalledWith({ model: 'gemini-1.5-pro' });
    });

    test('should test OpenAI completion with different temperatures', async () => {
      process.env.OPENAI_API_KEY = 'test-openai-key';
      
      const completion = await generateCompletion(1, 'gpt-3.5-turbo', 1.0);
      expect(completion).toBeDefined();
      expect(Message.create).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'gpt-3.5-turbo',
          temperature: 1.0
        })
      );
    });

    test('should test OpenRouter completion for Llama models', async () => {
      process.env.OPENROUTER_API_KEY = 'test-openrouter-key';
      
      const completion = await generateCompletion(1, 'meta-llama/llama-3.2-90b-vision-instruct', 0.3);
      expect(completion).toBeDefined();
      expect(Message.create).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'meta-llama/llama-3.2-90b-vision-instruct',
          temperature: 0.3
        })
      );
    });

    test('should test streaming with various chunk sizes', async () => {
      const chunks: any[] = [];
      
      // Test Anthropic streaming
      for await (const chunk of generateStreamingCompletion(1, 'claude-3-sonnet', 0.6)) {
        chunks.push(chunk);
        if (chunk.isComplete) break;
      }
      
      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks.some(c => c.chunk.length > 0)).toBe(true);
      expect(chunks[chunks.length - 1].isComplete).toBe(true);
    });

    test('should test all model detection edge cases', async () => {
      // Test Bison models (Gemini family)
      const bison1 = await generateCompletion(1, 'text-bison-001', 0.7);
      expect(bison1).toBeDefined();
      
      // Test Palm models (Gemini family)  
      const palm = await generateCompletion(1, 'palm-2-chat-bison', 0.7);
      expect(palm).toBeDefined();
      
      // Test various Claude models
      const haiku = await generateCompletion(1, 'claude-3-haiku-20240307', 0.7);
      expect(haiku).toBeDefined();
      
      // Test Meta Llama variants
      process.env.OPENROUTER_API_KEY = 'test-key';
      const llama = await generateCompletion(1, 'llama-3.1-8b-instruct', 0.7);
      expect(llama).toBeDefined();
    });
  });

  describe('Comprehensive Provider Testing', () => {
    test('should handle API errors for all providers', async () => {
      // Mock all providers to throw errors
      const mockError = new Error('API Error');
      
      // Mock OpenAI error
      (require('openai').OpenAI as jest.Mock).mockImplementation(() => ({
        chat: { completions: { create: jest.fn().mockRejectedValue(mockError) } }
      }));
      
      // Mock Anthropic error
      (require('@anthropic-ai/sdk').default as jest.Mock).mockImplementation(() => ({
        messages: { create: jest.fn().mockRejectedValue(mockError) }
      }));
      
      // Mock Gemini error
      mockGenerateContent.mockRejectedValue(mockError);
      
      // Test all providers handle errors
      await expect(generateCompletion(1, 'gpt-4', 0.7)).rejects.toThrow('Failed to generate completion');
      await expect(generateCompletion(1, 'claude-3', 0.7)).rejects.toThrow('Failed to generate completion');
      await expect(generateCompletion(1, 'gemini-pro', 0.7)).rejects.toThrow('Failed to generate completion');
      
      process.env.OPENROUTER_API_KEY = 'test-key';
      await expect(generateCompletion(1, 'llama-3', 0.7)).rejects.toThrow('Failed to generate completion');
    });

    test('should handle missing API keys for all providers', async () => {
      delete process.env.OPENAI_API_KEY;
      delete process.env.ANTHROPIC_API_KEY;
      delete process.env.GOOGLE_API_KEY;
      delete process.env.OPENROUTER_API_KEY;
      
      await expect(generateCompletion(1, 'gpt-4', 0.7)).rejects.toThrow('Failed to generate completion');
      await expect(generateCompletion(1, 'claude-3', 0.7)).rejects.toThrow('Failed to generate completion');
      await expect(generateCompletion(1, 'gemini-pro', 0.7)).rejects.toThrow('Failed to generate completion');
      await expect(generateCompletion(1, 'llama-3', 0.7)).rejects.toThrow('Failed to generate completion');
    });

    test('should handle streaming errors and cleanup', async () => {
      const mockMessage = {
        get: jest.fn(() => 123),
        update: jest.fn().mockRejectedValue(new Error('Update error')),
        destroy: jest.fn()
      };
      (Message.create as jest.Mock).mockResolvedValue(mockMessage);
      
      const generator = generateStreamingCompletion(1, 'gpt-4', 0.7);
      
      await expect(async () => {
        for await (const chunk of generator) {
          // Should fail on update
        }
      }).rejects.toThrow('Failed to generate streaming completion');
      
      expect(mockMessage.destroy).toHaveBeenCalled();
    });

    test('should handle edge cases in provider responses', async () => {
      // Test OpenAI with null content
      (require('openai').OpenAI as jest.Mock).mockImplementation(() => ({
        chat: {
          completions: {
            create: jest.fn().mockResolvedValue({
              choices: [{ message: { content: null } }]
            })
          }
        }
      }));
      
      const completion = await generateCompletion(1, 'gpt-4', 0.7);
      expect(Message.create).toHaveBeenCalledWith(
        expect.objectContaining({
          content: '',
          model: 'gpt-4'
        })
      );
      
      // Test Anthropic with non-text content
      (require('@anthropic-ai/sdk').default as jest.Mock).mockImplementation(() => ({
        messages: {
          create: jest.fn().mockResolvedValue({
            content: [{ type: 'image', source: 'base64data' }]
          })
        }
      }));
      
      await expect(generateCompletion(1, 'claude-3', 0.7))
        .rejects.toThrow('Failed to generate completion');
    });

    test('should preserve API key errors for user experience', async () => {
      delete process.env.OPENAI_API_KEY;
      
      // Mock to throw specific API key error
      (require('openai').OpenAI as jest.Mock).mockImplementation(() => ({
        chat: {
          completions: {
            create: jest.fn().mockRejectedValue(new Error('OpenAI API key is not set'))
          }
        }
      }));
      
      await expect(generateCompletion(1, 'gpt-4', 0.7))
        .rejects.toThrow('OpenAI API key is not set');
    });

    test('should handle all streaming providers', async () => {
      // Test all providers can stream
      let chunks = [];
      for await (const chunk of generateStreamingCompletion(1, 'gpt-4', 0.7)) {
        chunks.push(chunk);
        if (chunk.isComplete) break;
      }
      expect(chunks.length).toBeGreaterThan(0);

      chunks = [];
      for await (const chunk of generateStreamingCompletion(1, 'claude-3', 0.7)) {
        chunks.push(chunk);
        if (chunk.isComplete) break;
      }
      expect(chunks.length).toBeGreaterThan(0);

      chunks = [];
      for await (const chunk of generateStreamingCompletion(1, 'gemini-pro', 0.7)) {
        chunks.push(chunk);
        if (chunk.isComplete) break;
      }
      expect(chunks.length).toBeGreaterThan(0);

      process.env.OPENROUTER_API_KEY = 'test-key';
      chunks = [];
      for await (const chunk of generateStreamingCompletion(1, 'llama-3', 0.7)) {
        chunks.push(chunk);
        if (chunk.isComplete) break;
      }
      expect(chunks.length).toBeGreaterThan(0);
    });
  });

});
