// src/models.ts
import { DataTypes, Model } from 'sequelize';
import { sequelize } from './database';

class User extends Model {}
User.init({
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  username: {
    type: DataTypes.STRING,
    unique: true,
  },
  email: {
    type: DataTypes.STRING,
    unique: true,
  },
  hashed_password: {
    type: DataTypes.STRING,
  },
}, {
  sequelize,
  modelName: 'User',
});

class Chat extends Model {}
Chat.init({
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  owner_id: {
    type: DataTypes.INTEGER,
    references: {
      model: User,
      key: 'id',
    },
  },
  message: {
    type: DataTypes.TEXT,
  },
}, {
  sequelize,
  modelName: 'Chat',
});

User.hasMany(Chat, { foreignKey: 'owner_id' });
Chat.belongsTo(User, { foreignKey: 'owner_id' });

export { User, Chat };