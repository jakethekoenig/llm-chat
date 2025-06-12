import { Sequelize } from 'sequelize';
import { User } from '../../server/database/models/User';
import { Conversation } from '../../server/database/models/Conversation';
import { Message } from '../../server/database/models/Message';

describe('Database Models', () => {
  let sequelize: Sequelize;

  beforeAll(async () => {
    // Use in-memory SQLite for testing
    sequelize = new Sequelize('sqlite::memory:', {
      logging: false,
    });

    // Reinitialize models with test database
    User.init((User as any).rawAttributes, {
      sequelize,
      modelName: 'User'
    });

    Conversation.init((Conversation as any).rawAttributes, {
      sequelize,
      modelName: 'Conversation'
    });

    Message.init((Message as any).rawAttributes, {
      sequelize,
      modelName: 'Message'
    });

    // Set up associations
    User.hasMany(Message, { foreignKey: 'user_id' });
    Message.belongsTo(User, { foreignKey: 'user_id' });

    Conversation.hasMany(Message, { foreignKey: 'conversation_id' });
    Message.belongsTo(Conversation, { foreignKey: 'conversation_id' });

    Message.hasMany(Message, { as: 'Replies', foreignKey: 'parent_id' });
    Message.belongsTo(Message, { as: 'Parent', foreignKey: 'parent_id' });

    await sequelize.sync({ force: true });
  });

  afterAll(async () => {
    await sequelize.close();
  });

  beforeEach(async () => {
    // Clean up data before each test
    await Message.destroy({ where: {}, force: true });
    await Conversation.destroy({ where: {}, force: true });
    await User.destroy({ where: {}, force: true });
  });

  describe('User Model', () => {
    test('should create a user successfully', async () => {
      const user = await User.create({
        username: 'testuser',
        email: 'test@example.com',
        hashed_password: 'hashedpassword123'
      });

      expect(user.get('username')).toBe('testuser');
      expect(user.get('email')).toBe('test@example.com');
      expect(user.get('hashed_password')).toBe('hashedpassword123');
      expect(user.get('id')).toBeDefined();
    });

    test('should enforce unique username constraint', async () => {
      await User.create({
        username: 'testuser',
        email: 'test1@example.com',
        hashed_password: 'hashedpassword123'
      });

      await expect(User.create({
        username: 'testuser',
        email: 'test2@example.com',
        hashed_password: 'hashedpassword456'
      })).rejects.toThrow();
    });

    test('should enforce unique email constraint', async () => {
      await User.create({
        username: 'testuser1',
        email: 'test@example.com',
        hashed_password: 'hashedpassword123'
      });

      await expect(User.create({
        username: 'testuser2',
        email: 'test@example.com',
        hashed_password: 'hashedpassword456'
      })).rejects.toThrow();
    });
  });

  describe('Conversation Model', () => {
    let testUser: any;

    beforeEach(async () => {
      testUser = await User.create({
        username: 'testuser',
        email: 'test@example.com',
        hashed_password: 'hashedpassword123'
      });
    });

    test('should create a conversation successfully', async () => {
      const conversation = await Conversation.create({
        title: 'Test Conversation',
        user_id: testUser.get('id')
      });

      expect(conversation.get('title')).toBe('Test Conversation');
      expect(conversation.get('user_id')).toBe(testUser.get('id'));
      expect(conversation.get('id')).toBeDefined();
    });

    test('should require user_id', async () => {
      await expect(Conversation.create({
        title: 'Test Conversation'
      })).rejects.toThrow();
    });

    test('should allow null title', async () => {
      const conversation = await Conversation.create({
        title: null,
        user_id: testUser.get('id')
      });

      expect(conversation.get('title')).toBeNull();
      expect(conversation.get('user_id')).toBe(testUser.get('id'));
    });
  });

  describe('Message Model', () => {
    let testUser: any;
    let testConversation: any;

    beforeEach(async () => {
      testUser = await User.create({
        username: 'testuser',
        email: 'test@example.com',
        hashed_password: 'hashedpassword123'
      });

      testConversation = await Conversation.create({
        title: 'Test Conversation',
        user_id: testUser.get('id')
      });
    });

    test('should create a message successfully', async () => {
      const message = await Message.create({
        content: 'Test message content',
        conversation_id: testConversation.get('id'),
        user_id: testUser.get('id'),
        model: 'gpt-4',
        temperature: 0.7
      });

      expect(message.get('content')).toBe('Test message content');
      expect(message.get('conversation_id')).toBe(testConversation.get('id'));
      expect(message.get('user_id')).toBe(testUser.get('id'));
      expect(message.get('model')).toBe('gpt-4');
      expect(message.get('temperature')).toBe(0.7);
      expect(message.get('parent_id')).toBeNull();
      expect(message.get('timestamp')).toBeDefined();
    });

    test('should create a reply message with parent_id', async () => {
      const parentMessage = await Message.create({
        content: 'Parent message',
        conversation_id: testConversation.get('id'),
        user_id: testUser.get('id')
      });

      const replyMessage = await Message.create({
        content: 'Reply message',
        conversation_id: testConversation.get('id'),
        user_id: testUser.get('id'),
        parent_id: parentMessage.get('id')
      });

      expect(replyMessage.get('parent_id')).toBe(parentMessage.get('id'));
    });

    test('should allow null model and temperature', async () => {
      const message = await Message.create({
        content: 'User message',
        conversation_id: testConversation.get('id'),
        user_id: testUser.get('id'),
        model: null,
        temperature: null
      });

      expect(message.get('model')).toBeNull();
      expect(message.get('temperature')).toBeNull();
    });

    test('should set timestamp automatically', async () => {
      const beforeCreate = new Date();
      
      const message = await Message.create({
        content: 'Test message',
        conversation_id: testConversation.get('id'),
        user_id: testUser.get('id')
      });

      const afterCreate = new Date();
      const timestamp = new Date(message.get('timestamp') as string);

      expect(timestamp.getTime()).toBeGreaterThanOrEqual(beforeCreate.getTime());
      expect(timestamp.getTime()).toBeLessThanOrEqual(afterCreate.getTime());
    });
  });

  describe('Model Associations', () => {
    let testUser: any;
    let testConversation: any;

    beforeEach(async () => {
      testUser = await User.create({
        username: 'testuser',
        email: 'test@example.com',
        hashed_password: 'hashedpassword123'
      });

      testConversation = await Conversation.create({
        title: 'Test Conversation',
        user_id: testUser.get('id')
      });
    });

    test('should load user messages through association', async () => {
      await Message.create({
        content: 'Message 1',
        conversation_id: testConversation.get('id'),
        user_id: testUser.get('id')
      });

      await Message.create({
        content: 'Message 2',
        conversation_id: testConversation.get('id'),
        user_id: testUser.get('id')
      });

      const userWithMessages = await User.findByPk(testUser.get('id'), {
        include: [Message]
      });

      const messages = userWithMessages!.get('Messages') as any[];
      expect(messages).toHaveLength(2);
      expect(messages[0].get('content')).toBe('Message 1');
      expect(messages[1].get('content')).toBe('Message 2');
    });

    test('should load conversation messages through association', async () => {
      await Message.create({
        content: 'Message 1',
        conversation_id: testConversation.get('id'),
        user_id: testUser.get('id')
      });

      await Message.create({
        content: 'Message 2',
        conversation_id: testConversation.get('id'),
        user_id: testUser.get('id')
      });

      const conversationWithMessages = await Conversation.findByPk(testConversation.get('id'), {
        include: [Message]
      });

      const messages = conversationWithMessages!.get('Messages') as any[];
      expect(messages).toHaveLength(2);
    });

    test('should load parent-child message relationships', async () => {
      const parentMessage = await Message.create({
        content: 'Parent message',
        conversation_id: testConversation.get('id'),
        user_id: testUser.get('id')
      });

      const childMessage = await Message.create({
        content: 'Child message',
        conversation_id: testConversation.get('id'),
        user_id: testUser.get('id'),
        parent_id: parentMessage.get('id')
      });

      // Load parent with replies
      const parentWithReplies = await Message.findByPk(parentMessage.get('id') as number, {
        include: [{ association: 'Replies' }]
      });

      const replies = parentWithReplies!.get('Replies') as any[];
      expect(replies).toHaveLength(1);
      expect(replies[0].get('content')).toBe('Child message');

      // Load child with parent
      const childWithParent = await Message.findByPk(childMessage.get('id') as number, {
        include: [{ association: 'Parent' }]
      });

      const parent = childWithParent!.get('Parent') as any;
      expect(parent.get('content')).toBe('Parent message');
    });
  });
});
