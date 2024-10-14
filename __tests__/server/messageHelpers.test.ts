// __tests__/server/messageHelpers.test.ts
import { buildConversation, generateCompletionFromConversation } from '../../server/helpers/messageHelpers';
import { Message } from '../../server/database/models/Message';
import { User } from '../../server/database/models/User';

describe('Message Helpers', () => {
  test('buildConversation should retrieve the full conversation chain', async () => {
    // Setup mock messages and users
    const user = await User.create({ username: 'testUser', email: 'test@example.com', hashed_password: 'hashed' });
    const assistant = await User.create({ username: 'LLM_Model_Username', email: 'llm@example.com', hashed_password: 'hashed' });

    const msg1 = await Message.create({ content: 'Hello', user_id: user.id, conversation_id: 1 });
    const msg2 = await Message.create({ content: 'Hi there!', user_id: assistant.id, parent_id: msg1.id, conversation_id: 1 });

    const conversation = await buildConversation(msg2.id);

    expect(conversation).toEqual([
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'Hi there!' }
    ]);
  });

  test('generateCompletionFromConversation should create a completion message', async () => {
    // Mock OpenAI response and create conversation array
    const conversation = [
      { role: 'user', content: 'Hello', conversationId: 1 },
      { role: 'assistant', content: 'Hi there!', conversationId: 1 }
    ];
    // Additional assertions can be added here to verify the completion message
    const conversationId = 1; // Example conversation ID
    const userId = 1; // Example user ID
    const completion = await generateCompletionFromConversation(conversation, 'gpt-3', 0.7, conversationId, userId);
    expect(completion).toEqual(expect.any(Object)); // Assuming it returns a Message instance
    expect(completion.get('content')).toBeDefined();
    expect(completion.get('conversation_id')).toBe(conversationId);
    expect(completion.get('user_id')).toBe(ASSISTANT_USER_ID); // Ensure it uses the assistant user ID
  });

  test('generateCompletionFromConversation should throw error if message id is missing', async () => {
    const conversation = [
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'Hi there!' }
    ];
    await expect(generateCompletionFromConversation(conversation, 'gpt-3', 0.7, 1, 1)).rejects.toThrow('lastUserMessage.id is undefined');
  });
});