// server/helpers/messageHelpers.ts
import { Message } from '../database/models/Message';
import 'openai/shims/node';
import OpenAI from 'openai';
import { createLogger, transports, format } from 'winston';
import * as messageHelpers from './messageHelpers';
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

export { logger }; // Removed generateCompletion to prevent duplicate export

export const addMessage = async (
  content: string,
  conversationId: number,
  parentId: number | null,
  userId: number
) => {
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

  const conversationId = parentMessage.get('conversation_id');

  // Fetch all messages in the conversation
  const conversationMessages = await Message.findAll({
    where: {
      conversation_id: conversationId,
    },
    order: [['timestamp', 'ASC']], // Order messages chronologically
  });

  // Build the conversation history for the API
  const apiMessages = conversationMessages
    .filter(msg => (msg.get('id') as number) <= messageId) // Only include messages up to the current one
    .map(msg => {
      const hasModel = msg.get('model') !== null; // Check if the message is from the assistant
      const role = hasModel ? "assistant" as const : "user" as const;
      return {
        role,
        content: msg.get('content') as string
      };
    });

  if (apiMessages.length === 0 || !apiMessages[apiMessages.length - 1].content) {
    throw new Error('No valid messages found in conversation');
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OpenAI API key is not set');
  }

  const openai = new OpenAI({ apiKey: apiKey});

  try {
    const response = await openai.chat.completions.create({
      model,
      messages: apiMessages as OpenAI.Chat.Completions.ChatCompletionMessageParam[],
      temperature,
    });

    const completionContent = response.choices[0].message?.content || '';
    console.log('completionContent:', completionContent);
    const completionMessage: Message = await Message.create({
      content: completionContent,
      parent_id: messageId,
      conversation_id: conversationId,
      user_id: parentMessage.get('user_id') as number,
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
