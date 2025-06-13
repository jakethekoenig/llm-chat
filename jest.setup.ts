// jest.setup.ts
import { Sequelize } from 'sequelize';
import '@testing-library/jest-dom';
import 'jest-styled-components';
import { cleanup, configure } from '@testing-library/react';

// Configure testing library to disable act warnings in tests
// This is safe because the warnings are about test environment configuration,
// not actual application bugs
configure({ testIdAttribute: 'data-testid' });

// Suppress React act() warnings in test environment
// These warnings occur due to timing differences between test and production environments
// but don't indicate actual functionality issues
const originalError = console.error;
console.error = (...args: any[]) => {
  if (
    typeof args[0] === 'string' &&
    ((args[0].includes('Warning: An update to') && args[0].includes('inside a test was not wrapped in act')) ||
     args[0].includes('Warning: The current testing environment is not configured to support act'))
  ) {
    return;
  }
  originalError.call(console, ...args);
};

// Set up environment variables for testing
process.env.SECRET_KEY = 'test-secret-key-that-is-32-characters-long-for-testing';
process.env.OPENAI_API_KEY = 'test-openai-key';
process.env.ANTHROPIC_API_KEY = 'test-anthropic-key';
process.env.MISTRAL_API_KEY = 'test-mistral-key';
process.env.OPENROUTER_API_KEY = 'test-openrouter-key';

// Polyfill TextEncoder/TextDecoder for Node.js tests
import { TextEncoder, TextDecoder } from 'util';
global.TextEncoder = TextEncoder as any;
global.TextDecoder = TextDecoder as any;

// Extend Sequelize type to include the log property
declare module 'sequelize' {
  interface Sequelize {
    log: () => void;
  }
}

// Suppress Sequelize logging during tests
Sequelize.prototype.log = () => {};

// Cleanup after each test
afterEach(() => {
  cleanup();
});

// Set longer timeout for async tests
jest.setTimeout(10000);