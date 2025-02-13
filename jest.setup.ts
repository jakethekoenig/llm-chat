// jest.setup.ts
import { Sequelize } from 'sequelize';
import '@testing-library/jest-dom';
import 'jest-styled-components';
import { cleanup } from '@testing-library/react';

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