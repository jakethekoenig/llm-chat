// server/models/User.ts
import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../database';

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

export { User };