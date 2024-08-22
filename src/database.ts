// src/database.ts
import { Sequelize } from 'sequelize';
import { DATABASE_URL } from './config';

const sequelize = new Sequelize(DATABASE_URL, {
  dialect: 'sqlite',
  storage: './test.db',
});

export { sequelize };