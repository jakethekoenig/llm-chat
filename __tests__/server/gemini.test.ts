import { isGeminiModel, generateCompletion, generateStreamingCompletion, isAnthropicModel, addMessage } from '../../server/helpers/messageHelpers';
import { Message } from '../../server/database/models/Message';

// Mock winston logger
jest.mock('winston', () => ({
  createLogger: jest.fn(() => ({
    error: jest.fn()
  })),
  transports: {
    Console: jest.fn()
  },
  format: {
    combine: jest.fn(),
    timestamp: jest.fn(),
    json: jest.fn()
  }
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

// Mock OpenAI
const mockOpenAICreate = jest.fn();
jest.mock('openai', () => ({
  OpenAI: jest.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: mockOpenAICreate
      }
    }
  }))
}));

// Mock Anthropic
const mockAnthropicCreate = jest.fn();
jest.mock('@anthropic-ai/sdk', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    messages: {
      create: mockAnthropicCreate
    }
  }))
}));

// Mock Message model
jest.mock('../../server/database/models/Message', () => ({
  Message: {
    findByPk: jest.fn(),
    create: jest.fn()
  }
}));

const mockMessage = {
  get: jest.fn((field: string) => {
    switch (field) {
      case 'content': return 'Test message content';
      case 'conversation_id': return 1;
      case 'user_id': return 1;
      case 'id': return 123;
      default: return null;
    }
  }),
  update: jest.fn(),
  destroy: jest.fn()
};

describe('Model Detection', () => {
  test('should detect Gemini models correctly', () => {
    expect(isGeminiModel('gemini-pro')).toBe(true);
    expect(isGeminiModel('gemini-1.5-pro')).toBe(true);
    expect(isGeminiModel('Gemini-Flash')).toBe(true);
    expect(isGeminiModel('text-bison')).toBe(true);
    expect(isGeminiModel('chat-bison')).toBe(true);
    expect(isGeminiModel('palm-2')).toBe(true);
    
    expect(isGeminiModel('gpt-4')).toBe(false);
    expect(isGeminiModel('claude-3')).toBe(false);
    expect(isGeminiModel('davinci')).toBe(false);
  });

  test('should detect Anthropic models correctly', () => {
    expect(isAnthropicModel('claude-3')).toBe(true);
    expect(isAnthropicModel('claude-sonnet')).toBe(true);
    expect(isAnthropicModel('claude-haiku')).toBe(true);
    expect(isAnthropicModel('claude-opus')).toBe(true);
    
    expect(isAnthropicModel('gpt-4')).toBe(false);
    expect(isAnthropicModel('gemini-pro')).toBe(false);
    expect(isAnthropicModel('davinci')).toBe(false);
  });
});

describe('Gemini Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.GOOGLE_API_KEY = 'test-google-api-key';
    (Message.findByPk as jest.Mock).mockResolvedValue(mockMessage);
    (Message.create as jest.Mock).mockResolvedValue(mockMessage);
    
    // Set up default mock behavior
    mockGenerateContent.mockResolvedValue({
      response: {
        text: () => 'Mock Gemini response'
      }
    });
    
    mockGenerateContentStream.mockResolvedValue({
      stream: (async function* () {
        yield { text: () => 'Mock ' };
        yield { text: () => 'streaming ' };
        yield { text: () => 'response' };
      })()
    });
    
    mockGetGenerativeModel.mockReturnValue({
      generateContent: mockGenerateContent,
      generateContentStream: mockGenerateContentStream
    });
  });

  afterEach(() => {
    delete process.env.GOOGLE_API_KEY;
  });

  test('should generate completion for Gemini model', async () => {
    const completion = await generateCompletion(1, 'gemini-pro', 0.7);
    
    expect(Message.findByPk).toHaveBeenCalledWith(1);
    expect(Message.create).toHaveBeenCalledWith({
      content: 'Mock Gemini response',
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
    
    expect(chunks).toEqual(['Mock ', 'streaming ', 'response', '']);
    expect(Message.findByPk).toHaveBeenCalledWith(1);
    expect(Message.create).toHaveBeenCalled();
  });

  test('should handle missing parent message', async () => {
    (Message.findByPk as jest.Mock).mockResolvedValue(null);
    
    await expect(generateCompletion(999, 'gemini-pro', 0.7))
      .rejects.toThrow('Parent message with ID 999 not found');
  });

  test('should handle message with no content', async () => {
    const messageWithNoContent = {
      ...mockMessage,
      get: jest.fn((field: string) => {
        if (field === 'content') return null;
        return mockMessage.get(field);
      })
    };
    (Message.findByPk as jest.Mock).mockResolvedValue(messageWithNoContent);
    
    await expect(generateCompletion(1, 'gemini-pro', 0.7))
      .rejects.toThrow('Parent message has no content');
  });

  test('should handle Gemini API errors', async () => {
    mockGenerateContent.mockRejectedValue(new Error('Gemini API error'));
    
    await expect(generateCompletion(1, 'gemini-pro', 0.7))
      .rejects.toThrow('Failed to generate completion');
  });

  test('should handle streaming API errors', async () => {
    mockGenerateContentStream.mockRejectedValue(new Error('Streaming API error'));
    
    const generator = generateStreamingCompletion(1, 'gemini-pro', 0.7);
    
    await expect(async () => {
      for await (const chunk of generator) {
        // Should throw error before yielding
      }
    }).rejects.toThrow('Failed to generate streaming completion');
  });

  test('should generate completion for OpenAI model', async () => {
    process.env.OPENAI_API_KEY = 'test-openai-key';
    mockOpenAICreate.mockResolvedValue({
      choices: [{ message: { content: 'OpenAI response' } }]
    });
    
    const completion = await generateCompletion(1, 'gpt-4', 0.7);
    
    expect(Message.create).toHaveBeenCalledWith({
      content: 'OpenAI response',
      parent_id: 1,
      conversation_id: 1,
      user_id: 1,
      model: 'gpt-4',
      temperature: 0.7
    });
    expect(completion).toBe(mockMessage);
    
    delete process.env.OPENAI_API_KEY;
  });

  test('should generate completion for Anthropic model', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-anthropic-key';
    mockAnthropicCreate.mockResolvedValue({
      content: [{ text: 'Anthropic response' }]
    });
    
    const completion = await generateCompletion(1, 'claude-3', 0.7);
    
    expect(Message.create).toHaveBeenCalledWith({
      content: 'Anthropic response',
      parent_id: 1,
      conversation_id: 1,
      user_id: 1,
      model: 'claude-3',
      temperature: 0.7
    });
    expect(completion).toBe(mockMessage);
    
    delete process.env.ANTHROPIC_API_KEY;
  });

  test('should handle OpenAI streaming completion', async () => {
    process.env.OPENAI_API_KEY = 'test-openai-key';
    
    // Mock async iterator for OpenAI streaming
    const mockStream = (async function* () {
      yield { choices: [{ delta: { content: 'Open' } }] };
      yield { choices: [{ delta: { content: 'AI' } }] };
      yield { choices: [{ delta: { content: ' response' } }] };
    })();
    
    mockOpenAICreate.mockResolvedValue(mockStream);
    
    const chunks: string[] = [];
    const generator = generateStreamingCompletion(1, 'gpt-4', 0.7);
    
    for await (const chunk of generator) {
      chunks.push(chunk.chunk);
      if (chunk.isComplete) break;
    }
    
    expect(chunks).toEqual(['Open', 'AI', ' response', '']);
    
    delete process.env.OPENAI_API_KEY;
  });

  test('should handle Anthropic streaming completion', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-anthropic-key';
    
    // Mock async iterator for Anthropic streaming
    const mockStream = (async function* () {
      yield { type: 'content_block_delta', delta: { type: 'text_delta', text: 'Anthrop' } };
      yield { type: 'content_block_delta', delta: { type: 'text_delta', text: 'ic' } };
      yield { type: 'content_block_delta', delta: { type: 'text_delta', text: ' response' } };
    })();
    
    mockAnthropicCreate.mockResolvedValue(mockStream);
    
    const chunks: string[] = [];
    const generator = generateStreamingCompletion(1, 'claude-3', 0.7);
    
    for await (const chunk of generator) {
      chunks.push(chunk.chunk);
      if (chunk.isComplete) break;
    }
    
    expect(chunks).toEqual(['Anthrop', 'ic', ' response', '']);
    
    delete process.env.ANTHROPIC_API_KEY;
  });

  test('should handle missing OpenAI API key', async () => {
    delete process.env.OPENAI_API_KEY;
    
    await expect(generateCompletion(1, 'gpt-4', 0.7))
      .rejects.toThrow('Failed to generate completion');
  });

  test('should handle missing Anthropic API key', async () => {
    delete process.env.ANTHROPIC_API_KEY;
    
    await expect(generateCompletion(1, 'claude-3', 0.7))
      .rejects.toThrow('Failed to generate completion');
  });

  test('should handle OpenAI response with empty content', async () => {
    process.env.OPENAI_API_KEY = 'test-openai-key';
    mockOpenAICreate.mockResolvedValue({
      choices: [{ message: { content: '' } }]
    });
    
    const completion = await generateCompletion(1, 'gpt-4', 0.7);
    
    expect(Message.create).toHaveBeenCalledWith({
      content: '',
      parent_id: 1,
      conversation_id: 1,
      user_id: 1,
      model: 'gpt-4',
      temperature: 0.7
    });
    
    delete process.env.OPENAI_API_KEY;
  });

  test('should handle OpenAI response with null content', async () => {
    process.env.OPENAI_API_KEY = 'test-openai-key';
    mockOpenAICreate.mockResolvedValue({
      choices: [{ message: { content: null } }]
    });
    
    const completion = await generateCompletion(1, 'gpt-4', 0.7);
    
    expect(Message.create).toHaveBeenCalledWith({
      content: '',
      parent_id: 1,
      conversation_id: 1,
      user_id: 1,
      model: 'gpt-4',
      temperature: 0.7
    });
    
    delete process.env.OPENAI_API_KEY;
  });

  test('should handle Anthropic response with non-text content', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-anthropic-key';
    mockAnthropicCreate.mockResolvedValue({
      content: [{ type: 'image', source: 'base64data' }]
    });
    
    await expect(generateCompletion(1, 'claude-3', 0.7))
      .rejects.toThrow('Failed to generate completion');
    
    delete process.env.ANTHROPIC_API_KEY;
  });

  test('should handle non-Error exceptions in completion', async () => {
    mockGenerateContent.mockRejectedValue('String error');
    
    await expect(generateCompletion(1, 'gemini-pro', 0.7))
      .rejects.toThrow('Failed to generate completion');
  });

  test('should handle non-Error exceptions in streaming completion', async () => {
    mockGenerateContentStream.mockRejectedValue('String error');
    
    const generator = generateStreamingCompletion(1, 'gemini-pro', 0.7);
    
    await expect(async () => {
      for await (const chunk of generator) {
        // Should throw error
      }
    }).rejects.toThrow('Failed to generate streaming completion');
  });

  test('should add message successfully', async () => {
    const result = await addMessage('Test content', 1, null, 1);
    
    expect(Message.create).toHaveBeenCalledWith({
      content: 'Test content',
      conversation_id: 1,
      parent_id: null,
      user_id: 1
    });
    expect(result).toBe(mockMessage);
  });

  test('should add message with parent', async () => {
    const result = await addMessage('Reply content', 1, 123, 1);
    
    expect(Message.create).toHaveBeenCalledWith({
      content: 'Reply content',
      conversation_id: 1,
      parent_id: 123,
      user_id: 1
    });
    expect(result).toBe(mockMessage);
  });

  test('should destroy completion message on streaming error', async () => {
    // Mock message update to fail after creation
    const destroyMock = jest.fn();
    const errorMessage = {
      ...mockMessage,
      destroy: destroyMock,
      update: jest.fn().mockRejectedValue(new Error('Update error'))
    };
    (Message.create as jest.Mock).mockResolvedValueOnce(errorMessage);
    
    const generator = generateStreamingCompletion(1, 'gemini-pro', 0.7);
    
    await expect(async () => {
      for await (const chunk of generator) {
        // Should fail on message update
      }
    }).rejects.toThrow('Failed to generate streaming completion');
    
    expect(destroyMock).toHaveBeenCalled();
    
    // Reset mock
    (Message.create as jest.Mock).mockResolvedValue(mockMessage);
  });
});
