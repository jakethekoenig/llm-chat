import {
  convertMessageToApiFormat,
  convertConversationToApiFormat,
  convertUserToApiFormat,
  convertIdToNumber,
  convertApiMessageToDbFormat
} from '../../server/helpers/typeConverters';

describe('Type Converters', () => {
  describe('convertMessageToApiFormat', () => {
    it('should convert message from database format to API format', () => {
      const dbMessage = {
        id: 123,
        conversation_id: 456,
        parent_id: 789,
        user_id: 101,
        content: 'Test message',
        model: 'gpt-4o',
        temperature: 0.7,
        cost: 0.001234,
        timestamp: new Date('2023-01-01T00:00:00Z')
      };

      const result = convertMessageToApiFormat(dbMessage);

      expect(result).toEqual({
        id: '123',
        conversationId: '456',
        parentId: '789',
        userId: '101',
        content: 'Test message',
        model: 'gpt-4o',
        temperature: 0.7,
        cost: 0.001234,
        timestamp: '2023-01-01T00:00:00.000Z'
      });
    });

    it('should handle null parent_id and model', () => {
      const dbMessage = {
        id: 123,
        conversation_id: 456,
        parent_id: null,
        user_id: 101,
        content: 'Test message',
        model: null,
        temperature: null,
        cost: null,
        timestamp: new Date('2023-01-01T00:00:00Z')
      };

      const result = convertMessageToApiFormat(dbMessage);

      expect(result).toEqual({
        id: '123',
        conversationId: '456',
        parentId: null,
        userId: '101',
        content: 'Test message',
        model: null,
        temperature: null,
        cost: null,
        timestamp: '2023-01-01T00:00:00.000Z'
      });
    });
  });

  describe('convertConversationToApiFormat', () => {
    it('should convert conversation from database format to API format', () => {
      const dbConversation = {
        id: 123,
        title: 'Test Conversation',
        user_id: 456
      };

      const result = convertConversationToApiFormat(dbConversation);

      expect(result).toEqual({
        id: '123',
        title: 'Test Conversation',
        userId: '456'
      });
    });

    it('should convert conversation with messages', () => {
      const dbConversation = {
        id: 123,
        title: 'Test Conversation',
        user_id: 456,
        Messages: [{
          id: 789,
          conversation_id: 123,
          parent_id: null,
          user_id: 456,
          content: 'Test message',
          model: null,
          temperature: null,
          cost: null,
          timestamp: new Date('2023-01-01T00:00:00Z')
        }]
      };

      const result = convertConversationToApiFormat(dbConversation);

      expect(result).toEqual({
        id: '123',
        title: 'Test Conversation',
        userId: '456',
        messages: [{
          id: '789',
          conversationId: '123',
          parentId: null,
          userId: '456',
          content: 'Test message',
          model: null,
          temperature: null,
          cost: null,
          timestamp: '2023-01-01T00:00:00.000Z'
        }]
      });
    });
  });

  describe('convertUserToApiFormat', () => {
    it('should convert user from database format to API format', () => {
      const dbUser = {
        id: 123,
        username: 'testuser',
        email: 'test@example.com'
      };

      const result = convertUserToApiFormat(dbUser);

      expect(result).toEqual({
        id: '123',
        username: 'testuser',
        email: 'test@example.com'
      });
    });
  });

  describe('convertIdToNumber', () => {
    it('should convert string ID to number', () => {
      expect(convertIdToNumber('123')).toBe(123);
    });

    it('should return number ID as-is', () => {
      expect(convertIdToNumber(123)).toBe(123);
    });

    it('should throw error for invalid ID', () => {
      expect(() => convertIdToNumber('invalid')).toThrow('Invalid ID format: invalid');
    });

    it('should throw error for NaN', () => {
      expect(() => convertIdToNumber('NaN')).toThrow('Invalid ID format: NaN');
    });
  });

  describe('convertApiMessageToDbFormat', () => {
    it('should convert API message format to database format', () => {
      const apiMessage = {
        id: 123,
        conversationId: 456,
        parentId: 789,
        userId: 101,
        content: 'Test message',
        model: 'gpt-4o',
        temperature: 0.7,
        timestamp: '2023-01-01T00:00:00.000Z'
      };

      const result = convertApiMessageToDbFormat(apiMessage);

      expect(result).toEqual({
        id: 123,
        conversation_id: 456,
        parent_id: 789,
        user_id: 101,
        content: 'Test message',
        model: 'gpt-4o',
        temperature: 0.7,
        timestamp: new Date('2023-01-01T00:00:00.000Z')
      });
    });

    it('should handle null values correctly', () => {
      const apiMessage = {
        conversationId: 456,
        parentId: null,
        userId: 101,
        content: 'Test message',
        model: null,
        temperature: null
      };

      const result = convertApiMessageToDbFormat(apiMessage);

      expect(result).toEqual({
        conversation_id: 456,
        parent_id: null,
        user_id: 101,
        content: 'Test message',
        model: null,
        temperature: null
      });
    });

    it('should handle partial message data', () => {
      const apiMessage = {
        content: 'Test message'
      };

      const result = convertApiMessageToDbFormat(apiMessage);

      expect(result).toEqual({
        content: 'Test message'
      });
    });
  });
});
