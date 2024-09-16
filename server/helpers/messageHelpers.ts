// server/helpers/messageHelpers.ts
import { Message } from '../database/models/Message';
import OpenAI from 'openai';
import config from 'config';
import dotenv from 'dotenv';
dotenv.config();

interface CompletionResponse {
  choices: { text: string }[];
}

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
  const parentMessage: Message | null = await Message.findByPk(messageId);
  if (!parentMessage) {
    throw new Error(`Parent message with ID ${messageId} not found`);
  }

  const openai = new OpenAI({
    apiKey: config.apiKeys.openai,
  });

  try {
    const response: CompletionResponse = await openai.completions.create({
      model,
      prompt: parentMessage.content,
      temperature,
    });

    const completionContent = response.choices[0].text || '';
    const completionMessage: Message = await Message.create({
      content: completionContent,
      parent_id: messageId,
      conversation_id: parentMessage.get('conversation_id'),
      user_id: parentMessage.get('user_id'),
      model,
      temperature,
    });
    return completionMessage;
  } catch (error) {
    if (error instanceof Error) {
      console.error('Error generating completion:', error.message);
    } else {
      console.error('Error generating completion:', error);
    }
    throw new Error('Failed to generate completion');
  }
};