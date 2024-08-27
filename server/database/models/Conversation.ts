// server/models/Conversation.ts
import { DataTypes, Model } from 'sequelize';
import db from '../index';

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
  sequelize: db.sequelize,
  modelName: 'Conversation',
});

export { Conversation };
