// server/models/Conversation.ts
import { DataTypes, Model, Optional } from 'sequelize';
import db from '../index';

interface ConversationAttributes {
  id: number;
  title: string;
}

interface ConversationCreationAttributes extends Optional<ConversationAttributes, 'id'> {
  user_id: number;
}

class Conversation extends Model<ConversationAttributes, ConversationCreationAttributes> implements ConversationAttributes {
  public id!: number;
  public title!: string;
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
}, {
  sequelize: db.sequelize,
  modelName: 'Conversation',
});

export { Conversation };
