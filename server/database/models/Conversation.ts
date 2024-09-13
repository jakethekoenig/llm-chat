// server/models/Conversation.ts
import { DataTypes, Model, Optional } from 'sequelize';
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
  user_id: { // Add this block
    type: DataTypes.INTEGER,
    allowNull: false,
  },
}, {
  sequelize: db.sequelize,
  modelName: 'Conversation',
});
export { Conversation };
