// server/models/User.ts
import { DataTypes, Model } from 'sequelize';
import db from '../index';

// Ensure 'username' is defined in the User model
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
  sequelize: db.sequelize,
  modelName: 'User',
});

export { User };
