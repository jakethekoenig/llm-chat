// server/models/Message.ts
import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../database';
import { User } from './User';
import { Conversation } from './Conversation';

class Message extends Model {}
Message.init({
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  conversation_id: {
    type: DataTypes.INTEGER,
    references: {
      model: Conversation,
      key: 'id',
    },
  },
  parent_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'Messages', // self-reference
      key: 'id',
    },
  },
  user_id: {
    type: DataTypes.INTEGER,
    references: {
      model: User,
      key: 'id',
    },
  },
  content: {
    type: DataTypes.TEXT,
  },
  timestamp: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
}, {
  sequelize,
  modelName: 'Message',
});

User.hasMany(Message, { foreignKey: 'user_id' });
Message.belongsTo(User, { foreignKey: 'user_id' });

Conversation.hasMany(Message, { foreignKey: 'conversation_id' });
Message.belongsTo(Conversation, { foreignKey: 'conversation_id' });

Message.hasMany(Message, { as: 'Replies', foreignKey: 'parent_id' });
Message.belongsTo(Message, { as: 'Parent', foreignKey: 'parent_id' });

export { Message };