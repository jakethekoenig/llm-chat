// jest.setup.ts
import { Sequelize } from 'sequelize';
import 'jest-styled-components';

// Extend Sequelize type to include the log property
declare module 'sequelize' {
  interface Sequelize {
    log: () => void;
  }
}

// Suppress Sequelize logging during tests
Sequelize.prototype.log = () => {};