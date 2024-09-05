// jest.setup.ts
import { Sequelize } from 'sequelize';

// Suppress Sequelize logging during tests
Sequelize.prototype.log = () => {};