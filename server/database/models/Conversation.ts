// server/models/Conversation.ts
import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../database';

class Conversation extends Model {}
Conversation.init({
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  title: {
    type: DataTypes.STRING,
  },
}, {
  sequelize,
  modelName: 'Conversation',
});

export { Conversation };