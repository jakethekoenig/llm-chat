// server/helpers/messageHelpers.ts
import { Message } from '../database/models/Message';
import OpenAI from 'openai'; // Fix import for OpenAI
import config from 'config'; // Correct import for config
import dotenv from 'dotenv';
dotenv.config();

// Remove global initialization
// const openai = new OpenAIApi(new Configuration({
//   apiKey: config.apiKeys.openai,
// }));

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

  // Initialize OpenAI API client inside the function
  const openai = new OpenAI({
    apiKey: config.apiKeys.openai,
  });

  try {
    const response = await openai.completions.create({
      model,
      prompt: parentMessage.content,
      temperature,
    });

    const completionContent = response.data.choices[0].text || '';
    const completionMessage = await Message.create({
      content: completionContent,
      parent_id: messageId,
      conversation_id: parentMessage.get('conversation_id'),
      user_id: parentMessage.get('user_id'),
      model,
      temperature,
    });
    return completionMessage;
  } catch (error) {
    console.error('Error generating completion:', error.response ? error.response.data : error.message);
    throw new Error('Failed to generate completion');
  }
};