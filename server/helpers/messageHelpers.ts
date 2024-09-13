// server/helpers/messageHelpers.ts
import { Message } from '../database/models/Message';

export const addMessage = async (content: string, conversationId: number, parentId: number | null, userId: number) => {
  const message = await Message.create({
    content,
    conversation_id: conversationId,
    parent_id: parentId,
    user_id: userId,
  });
  return message;
};

export const generateCompletion = async (messageId: number, model: string, temperature: number) => {
  // Fetch parent message to get conversation_id and user_id
  const parentMessage = await Message.findByPk(messageId);
  if (!parentMessage) {
    throw new Error(`Parent message with ID ${messageId} not found`);
  }

  const completionContent = `Generated completion for message ${messageId} using model ${model} with temperature ${temperature}`;
  const completionMessage = await Message.create({
    content: completionContent,
    parent_id: messageId,
    conversation_id: parentMessage.get('conversation_id'),
    user_id: parentMessage.get('user_id'),
    model,
    temperature,
  });
  return completionMessage;
};