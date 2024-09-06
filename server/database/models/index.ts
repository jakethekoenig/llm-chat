// server/models/index.ts
import { User } from './User';
import { Conversation } from './Conversation';
import { Message } from './Message';
import { sequelize } from '../index';

export { User, Conversation, Message, sequelize };