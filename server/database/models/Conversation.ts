// server/models/Conversation.ts
import { DataTypes, Model, Optional } from 'sequelize';
import db from '../index';

interface ConversationAttributes {
  id: number;
  title: string;
  user_id: number;
}

interface ConversationCreationAttributes extends Optional<ConversationAttributes, 'id'> {
}

class Conversation extends Model<ConversationAttributes, ConversationCreationAttributes> implements ConversationAttributes {
  public id!: number;
  public title!: string;
  public user_id!: number;
}

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
