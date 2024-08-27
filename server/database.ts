// server/database.ts
import { Sequelize } from 'sequelize';
import { DATABASE_URL } from './config';

const sequelize = new Sequelize(DATABASE_URL, {
  dialect: DATABASE_URL.startsWith('postgres') ? 'postgres' : 'sqlite',
  storage: DATABASE_URL.startsWith('sqlite') ? './test.db' : undefined,
});

export { sequelize };