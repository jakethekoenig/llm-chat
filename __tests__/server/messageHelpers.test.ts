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
                  // Only OpenAI (not OpenRouter) provides usage data
                  if (!isOpenRouter) {
                    yield { choices: [{ delta: { content: '' } }], usage: { prompt_tokens: 100, completion_tokens: 50 } };
                  }
                }
              };
              return Promise.resolve(mockStream);
            } else {
              return Promise.resolve({
                choices: [{
                  message: { role: "assistant", content: responseContent }
                }],
                // Only OpenAI (not OpenRouter) provides usage data
                usage: isOpenRouter ? undefined : { prompt_tokens: 100, completion_tokens: 50 }
              });
            }
          })
        }
      }
    };
  })
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

// Mock Mistral
jest.mock('@mistralai/mistralai', () => ({
  Mistral: jest.fn(() => ({
    chat: {
      complete: jest.fn().mockResolvedValue({
        choices: [{
          message: { content: 'Mocked Mistral response' }
        }]
      }),
      stream: jest.fn().mockResolvedValue({
        async *[Symbol.asyncIterator]() {
          yield { data: { choices: [{ delta: { content: 'Hello' } }] } };
          yield { data: { choices: [{ delta: { content: ' from' } }] } };
          yield { data: { choices: [{ delta: { content: ' Mistral!' } }] } };
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
    process.env.MISTRAL_API_KEY = 'test-mistral-key';
    process.env.OPENROUTER_API_KEY = 'test-openrouter-key';
    
    // Re-setup OpenAI mock after clearAllMocks
    const OpenAI = require('openai').OpenAI;
    OpenAI.mockImplementation((config: any) => {
      const isOpenRouter = config?.baseURL === 'https://openrouter.ai/api/v1';
      const responseContent = isOpenRouter ? 'Mocked OpenRouter response' : 'Mocked OpenAI response';
      
      return {
        chat: {
          completions: {
            create: jest.fn().mockImplementation(({ stream }: any) => {
              if (stream) {
                const mockStream = {
                  async *[Symbol.asyncIterator]() {
                    yield { choices: [{ delta: { content: 'Hello' } }] };
                    yield { choices: [{ delta: { content: ' world' } }] };
                    yield { choices: [{ delta: { content: '!' } }] };
                    if (!isOpenRouter) {
                      yield { choices: [{ delta: { content: '' } }], usage: { prompt_tokens: 100, completion_tokens: 50 } };
                    }
                  }
                };
                return Promise.resolve(mockStream);
              } else {
                return Promise.resolve({
                  choices: [{
                    message: { role: "assistant", content: responseContent }
                  }],
                  usage: isOpenRouter ? undefined : { prompt_tokens: 100, completion_tokens: 50 }
                });
              }
            })
          }
        }
      };
    });
    
    // Re-setup Anthropic mock after clearAllMocks
    const Anthropic = require('@anthropic-ai/sdk').default;
    Anthropic.mockImplementation(() => ({
      messages: {
        create: jest.fn().mockImplementation(({ stream }: any) => {
          if (stream) {
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
    }));
    
    // Re-setup Mistral mock after clearAllMocks
    const Mistral = require('@mistralai/mistralai').Mistral;
    Mistral.mockImplementation(() => ({
      chat: {
        complete: jest.fn().mockResolvedValue({
          choices: [{
            message: { content: 'Mocked Mistral response' }
          }]
        }),
        stream: jest.fn().mockResolvedValue({
          async *[Symbol.asyncIterator]() {
            yield { data: { choices: [{ delta: { content: 'Hello' } }] } };
            yield { data: { choices: [{ delta: { content: ' from' } }] } };
            yield { data: { choices: [{ delta: { content: ' Mistral!' } }] } };
          }
        })
      }
    }));
    
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
    delete process.env.MISTRAL_API_KEY;
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

    test('should stream Mistral completion successfully', async () => {
      const chunks: any[] = [];
      
      for await (const chunk of generateStreamingCompletion(1, 'mistral-large', 0.7)) {
        chunks.push(chunk);
      }
      
      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks[chunks.length - 1].isComplete).toBe(true);
      expect(Message.findByPk).toHaveBeenCalledWith(1);
      expect(Message.create).toHaveBeenCalled();
    });

    test('should stream Llama completion successfully via OpenRouter', async () => {
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
    test('should generate OpenAI completion with cost', async () => {
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
      expect(Message.create).toHaveBeenCalledWith(
        expect.objectContaining({
          content: 'Mocked Anthropic response',
          model: 'claude-3-opus',
          temperature: 0.7,
          cost: expect.any(Number)
        })
      );
    });

    test('should generate Mistral completion with cost', async () => {
      const mockCompletionMessage = {
        get: jest.fn((field: string) => {
          switch (field) {
            case 'id': return 123;
            case 'content': return 'Mocked Mistral response';
            default: return null;
          }
        })
      };
      
      (Message.create as jest.Mock).mockResolvedValue(mockCompletionMessage);
      
      const result = await generateCompletion(1, 'mistral-large', 0.7);
      
      expect(result).toBe(mockCompletionMessage);
      expect(Message.findByPk).toHaveBeenCalledWith(1);
      expect(Message.create).toHaveBeenCalledWith(
        expect.objectContaining({
          content: 'Mocked Mistral response',
          model: 'mistral-large',
          temperature: 0.7,
          cost: 0 // Mistral defaults to 0 cost for now
        })
      );
    });

    test('should generate Llama completion via OpenRouter with cost', async () => {
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
      expect(Message.create).toHaveBeenCalledWith(
        expect.objectContaining({
          content: 'Mocked OpenRouter response',
          model: 'meta-llama/llama-3.1-70b-instruct',
          temperature: 0.7,
          cost: 0 // OpenRouter defaults to 0 cost for now
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

  describe('addMessage', () => {
    test('should create a new message successfully', async () => {
      const mockMessage = {
        get: jest.fn((field: string) => {
          switch (field) {
            case 'id': return 456;
            case 'content': return 'Test content';
            default: return null;
          }
        })
      };
      
      (Message.create as jest.Mock).mockResolvedValue(mockMessage);
      
      const result = await addMessage('Test content', 1, null, 1);
      
      expect(result).toBe(mockMessage);
      expect(Message.create).toHaveBeenCalledWith({
        content: 'Test content',
        conversation_id: 1,
        parent_id: null,
        user_id: 1
      });
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
      // Ensure OpenAI API key is set
      process.env.OPENAI_API_KEY = 'test-openai-key';
      
      const chunks: any[] = [];
      
      try {
        for await (const chunk of generateStreamingCompletion(1, 'unknown-model', 0.7)) {
          chunks.push(chunk);
        }
        
        expect(chunks.length).toBeGreaterThan(0);
        expect(chunks[chunks.length - 1].isComplete).toBe(true);
        expect(Message.findByPk).toHaveBeenCalledWith(1);
        expect(Message.create).toHaveBeenCalled();
      } catch (error) {
        console.error('Streaming test failed:', error);
        throw error;
      }
    });

    test('should handle edge case with different Llama model naming', async () => {
      // Ensure OpenRouter API key is set for Llama models
      process.env.OPENROUTER_API_KEY = 'test-openrouter-key';
      
      const chunks: any[] = [];
      
      try {
        for await (const chunk of generateStreamingCompletion(1, 'llama3-custom', 0.7)) {
          chunks.push(chunk);
        }
        
        expect(chunks.length).toBeGreaterThan(0);
        expect(chunks[chunks.length - 1].isComplete).toBe(true);
      } catch (error) {
        console.error('Llama streaming test failed:', error);
        throw error;
      }
    });

    test('should handle Mistral model variants', async () => {
      const chunks: any[] = [];
      
      // Test mixtral variant
      for await (const chunk of generateStreamingCompletion(1, 'mixtral-8x7b', 0.7)) {
        chunks.push(chunk);
      }
      
      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks[chunks.length - 1].isComplete).toBe(true);
    });

    test('should handle Codestral model', async () => {
      const mockCompletionMessage = {
        get: jest.fn((field: string) => {
          switch (field) {
            case 'id': return 123;
            case 'content': return 'Mocked Mistral response';
            default: return null;
          }
        })
      };
      
      (Message.create as jest.Mock).mockResolvedValue(mockCompletionMessage);
      
      const result = await generateCompletion(1, 'codestral-latest', 0.7);
      
      expect(result).toBe(mockCompletionMessage);
      expect(Message.findByPk).toHaveBeenCalledWith(1);
      expect(Message.create).toHaveBeenCalled();
    });

    test('should handle API key errors gracefully', async () => {
      delete process.env.MISTRAL_API_KEY;
      
      await expect(generateCompletion(1, 'mistral-large', 0.7))
        .rejects.toThrow();
    });

    test('should handle streaming API key errors gracefully', async () => {
      delete process.env.ANTHROPIC_API_KEY;
      
      const generator = generateStreamingCompletion(1, 'claude-3-opus', 0.7);
      const iterator = generator[Symbol.asyncIterator]();
      
      await expect(iterator.next()).rejects.toThrow();
    });

    test('should handle Mistral content array format', async () => {
      // Mock Mistral to return array content format
      const mockMistral = require('@mistralai/mistralai');
      mockMistral.Mistral.mockImplementation(() => ({
        chat: {
          complete: jest.fn().mockResolvedValue({
            choices: [{
              message: { 
                content: [
                  { type: 'text', text: 'Hello ' },
                  { type: 'text', text: 'from array!' }
                ]
              }
            }]
          })
        }
      }));

      const mockCompletionMessage = {
        get: jest.fn((field: string) => {
          switch (field) {
            case 'id': return 123;
            case 'content': return 'Hello from array!';
            default: return null;
          }
        })
      };
      
      (Message.create as jest.Mock).mockResolvedValue(mockCompletionMessage);
      
      const result = await generateCompletion(1, 'mistral-large', 0.7);
      
      expect(result).toBe(mockCompletionMessage);
    });

    test('should handle Mistral streaming content array format', async () => {
      // Mock Mistral streaming to return array content format
      const mockMistral = require('@mistralai/mistralai');
      mockMistral.Mistral.mockImplementation(() => ({
        chat: {
          stream: jest.fn().mockResolvedValue({
            async *[Symbol.asyncIterator]() {
              yield { 
                data: { 
                  choices: [{ 
                    delta: { 
                      content: [
                        { type: 'text', text: 'Hello' }
                      ]
                    } 
                  }] 
                } 
              };
              yield { 
                data: { 
                  choices: [{ 
                    delta: { 
                      content: [
                        { type: 'text', text: ' world' }
                      ]
                    } 
                  }] 
                } 
              };
            }
          })
        }
      }));

      const chunks: any[] = [];
      
      for await (const chunk of generateStreamingCompletion(1, 'mistral-large', 0.7)) {
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
  });
});
