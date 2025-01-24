// server/models/index.ts
import { User } from './User';
import { Conversation } from './Conversation';
import { Message } from './Message';
import sequelize from '../index';

// Initialize associations
User.hasMany(Message, { foreignKey: 'user_id', as: 'messages' });
Message.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

User.hasMany(Conversation, { foreignKey: 'user_id', as: 'conversations' });
Conversation.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

Conversation.hasMany(Message, { foreignKey: 'conversation_id', as: 'messages' });
Message.belongsTo(Conversation, { foreignKey: 'conversation_id', as: 'conversation' });

Message.hasMany(Message, { as: 'children', foreignKey: 'parent_id' });
Message.belongsTo(Message, { as: 'parent', foreignKey: 'parent_id' });

export { User, Conversation, Message, sequelize };
