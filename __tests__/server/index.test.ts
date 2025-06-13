import { jest } from '@jest/globals';

// Mock the app module to prevent actual server startup
jest.mock('../../server/app', () => ({
  __esModule: true,
  default: {
    listen: jest.fn((port: any, callback?: () => void) => {
      if (callback) callback();
      return { close: jest.fn() };
    })
  }
}));

describe('Server Index - Environment Validation', () => {
  let originalEnv: NodeJS.ProcessEnv;
  let mockExit: any;
  let mockConsoleError: any;
  let mockConsoleLog: any;

  beforeEach(() => {
    originalEnv = { ...process.env };
    mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    });
    mockConsoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    mockConsoleLog = jest.spyOn(console, 'log').mockImplementation(() => {});
    
    // Clear all modules from cache
    jest.resetModules();
  });

  afterEach(() => {
    process.env = originalEnv;
    mockExit.mockRestore();
    mockConsoleError.mockRestore();
    mockConsoleLog.mockRestore();
  });

  test('should validate environment successfully with all required variables', async () => {
    process.env.SECRET_KEY = 'a-very-long-secret-key-that-is-32-characters-long-for-testing';
    process.env.OPENAI_API_KEY = 'test-openai-key';
    process.env.PORT = '3000';

    expect(() => require('../../server/index')).not.toThrow();
    expect(mockConsoleLog).toHaveBeenCalledWith('✅ Environment validation passed');
    expect(mockConsoleLog).toHaveBeenCalledWith('🚀 Server is running on port 3000');
  });

  test('should validate environment successfully with Anthropic API key only', async () => {
    process.env.SECRET_KEY = 'a-very-long-secret-key-that-is-32-characters-long-for-testing';
    process.env.ANTHROPIC_API_KEY = 'test-anthropic-key';
    delete process.env.OPENAI_API_KEY;

    expect(() => require('../../server/index')).not.toThrow();
    expect(mockConsoleLog).toHaveBeenCalledWith('✅ Environment validation passed');
  });

  test('should exit when SECRET_KEY is missing', async () => {
    delete process.env.SECRET_KEY;
    process.env.OPENAI_API_KEY = 'test-openai-key';

    expect(() => require('../../server/index')).toThrow('process.exit called');
    expect(mockConsoleError).toHaveBeenCalledWith('❌ Missing required environment variables:');
    expect(mockConsoleError).toHaveBeenCalledWith('  - SECRET_KEY (JWT secret key for authentication)');
    expect(mockExit).toHaveBeenCalledWith(1);
  });

  test('should exit when SECRET_KEY is too short', async () => {
    process.env.SECRET_KEY = 'short-key';
    process.env.OPENAI_API_KEY = 'test-openai-key';

    expect(() => require('../../server/index')).toThrow('process.exit called');
    expect(mockConsoleError).toHaveBeenCalledWith('❌ SECRET_KEY must be at least 32 characters long for security');
    expect(mockExit).toHaveBeenCalledWith(1);
  });

  test('should exit when no AI API keys are provided', async () => {
    process.env.SECRET_KEY = 'a-very-long-secret-key-that-is-32-characters-long-for-testing';
    delete process.env.OPENAI_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;

    expect(() => require('../../server/index')).toThrow('process.exit called');
    expect(mockConsoleError).toHaveBeenCalledWith('❌ Missing required environment variables:');
    expect(mockConsoleError).toHaveBeenCalledWith('  - OPENAI_API_KEY, ANTHROPIC_API_KEY, or GOOGLE_API_KEY (at least one LLM API key is required)');
    expect(mockExit).toHaveBeenCalledWith(1);
  });

  test('should use default port when PORT is not set', async () => {
    process.env.SECRET_KEY = 'a-very-long-secret-key-that-is-32-characters-long-for-testing';
    process.env.OPENAI_API_KEY = 'test-openai-key';
    delete process.env.PORT;

    expect(() => require('../../server/index')).not.toThrow();
    expect(mockConsoleLog).toHaveBeenCalledWith('🚀 Server is running on port 3000');
  });

  test('should show API key status correctly', async () => {
    process.env.SECRET_KEY = 'a-very-long-secret-key-that-is-32-characters-long-for-testing';
    process.env.OPENAI_API_KEY = 'test-openai-key';
    process.env.ANTHROPIC_API_KEY = 'test-anthropic-key';

    expect(() => require('../../server/index')).not.toThrow();
    expect(mockConsoleLog).toHaveBeenCalledWith('📊 OpenAI API: ✅ configured');
    expect(mockConsoleLog).toHaveBeenCalledWith('📊 Anthropic API: ✅ configured');
  });

  test('should show API key status when keys are missing', async () => {
    process.env.SECRET_KEY = 'a-very-long-secret-key-that-is-32-characters-long-for-testing';
    process.env.OPENAI_API_KEY = 'test-openai-key';
    delete process.env.ANTHROPIC_API_KEY;

    expect(() => require('../../server/index')).not.toThrow();
    expect(mockConsoleLog).toHaveBeenCalledWith('📊 OpenAI API: ✅ configured');
    expect(mockConsoleLog).toHaveBeenCalledWith('📊 Anthropic API: ❌ not set');
  });
});
