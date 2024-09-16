// server/helpers/messageHelpers.ts
import { Message as MessageModel } from '../database/models/Message';
import 'openai/shims/node'
import OpenAI from 'openai';
import { createLogger, transports, format } from 'winston';

const logger = createLogger({
  level: 'error',
  format: format.combine(
    format.timestamp(),
    format.json()
  ),
  transports: [
    new transports.Console()
  ]
});

interface Message {
  id: number;
  content: string;
  conversation_id: number;
  parent_id: number | null;
  user_id: number;
  model?: string;
  temperature?: number;
}
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

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OpenAI API key is not set');
  }

  const openai = new OpenAI(apiKey);

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
      conversation_id: parentMessage.conversation_id,
      user_id: parentMessage.user_id,
      model,
      temperature,
    });
    return completionMessage;
  } catch (error) {
    if (error instanceof Error) {
      logger.error('Error generating completion:', { message: error.message });
    } else {
      logger.error('Error generating completion:', { error });
    }
    throw new Error('Failed to generate completion');
  }
};
