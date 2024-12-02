// server/helpers/messageHelpers.ts
import { Message } from '../database/models/Message';
import 'openai/shims/node';
import { OpenAI } from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { createLogger, transports, format } from 'winston';

const anthropicClient = new Anthropic({
  apiKey: process.env['ANTHROPIC_API_KEY'], // Ensure this environment variable is set
});

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

  const content = parentMessage.get('content') as string;

  if (!content) {
    throw new Error('Parent message has no content');
  }

  const openaiApiKey = process.env.OPENAI_API_KEY;
  const anthropicApiKey = process.env.ANTHROPIC_API_KEY;

  let completionContent = '';

  try {
    const isAnthropicModel = /claude|sonnet|haiku|opus/i.test(model);
    
    if (isAnthropicModel) {
      if (!anthropicApiKey) {
        throw new Error('Anthropic API key is not set');
      }
      const response = await anthropicClient.messages.create({
        max_tokens: 1024,
        messages: [{ role: 'user', content }],
        model,
      });
      completionContent = response.content[0]?.type === 'text' ? response.content[0].text : '';
    } else {
      if (!openaiApiKey) {
        throw new Error('OpenAI API key is not set');
      }
      const openai = new OpenAI({ apiKey: openaiApiKey });
      const response = await openai.chat.completions.create({
        model,
        messages: [{ "role": "user", "content": content }],
        temperature,
      });
      completionContent = response.choices[0].message?.content || '';
    }
    
    console.log('completionContent:', completionContent);
    const completionMessage: Message = await Message.create({
      content: completionContent,
      parent_id: messageId,
      conversation_id: parentMessage.get('conversation_id') as number,
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
