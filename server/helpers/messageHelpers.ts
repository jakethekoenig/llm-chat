// server/helpers/messageHelpers.ts
import { Message } from '../database/models/Message';
import 'openai/shims/node';
import '@anthropic-ai/sdk/shims/node';
import { OpenAI } from 'openai';
import Anthropic from '@anthropic-ai/sdk';
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

export { logger };

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

const isAnthropicModel = (model: string): boolean => {
  const anthropicIdentifiers = ['claude', 'sonnet', 'haiku', 'opus'];
  return anthropicIdentifiers.some(identifier => model.toLowerCase().includes(identifier));
};

const generateAnthropicCompletion = async (content: string, model: string, temperature: number) => {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('Anthropic API key is not set');
  }

  const client = new Anthropic({
    apiKey: apiKey,
  });

  const response = await client.messages.create({
    model,
    max_tokens: 1024,
    temperature,
    messages: [{ role: 'user', content }],
  });

  // Handle different content block types
  const contentBlock = response.content[0];
  if ('text' in contentBlock) {
    return contentBlock.text;
  } else {
    logger.error('Unexpected content block type from Anthropic API');
    throw new Error('Unexpected response format from Anthropic API');
  }
};

const generateOpenAICompletion = async (content: string, model: string, temperature: number) => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OpenAI API key is not set');
  }

  const openai = new OpenAI({ apiKey });
  const response = await openai.chat.completions.create({
    model,
    messages: [{ role: "user", content }],
    temperature,
  });

  return response.choices[0].message?.content || '';
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

  try {
    const completionContent = isAnthropicModel(model)
      ? await generateAnthropicCompletion(content, model, temperature)
      : await generateOpenAICompletion(content, model, temperature);

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
