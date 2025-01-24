// server/helpers/messageHelpers.ts
import { Message } from '../database/models/Message';
import 'openai/shims/node';
import '@anthropic-ai/sdk/shims/node';
import { OpenAI } from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { createLogger, transports, format } from 'winston';
import * as messageHelpers from './messageHelpers';
const logger = createLogger({
  level: 'info',
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

const generateAnthropicCompletion = async (messages: { role: string; content: string }[], model: string, temperature: number) => {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    logger.error('Anthropic API key not set');
    throw new Error('Anthropic API key is not set');
  }

  const client = new Anthropic({
    apiKey: apiKey,
  });

  logger.info('Sending request to Anthropic API:', { model, temperature, messageCount: messages.length });
  const response = await client.messages.create({
    model,
    max_tokens: 1024,
    temperature,
    messages: messages.map(msg => ({
      role: msg.role === 'assistant' ? 'assistant' : 'user',
      content: msg.content
    })),
  });

  // Handle different content block types
  const contentBlock = response.content[0];
  if ('text' in contentBlock) {
    logger.info('Received response from Anthropic API');
    return contentBlock.text;
  } else {
    logger.error('Unexpected content block type from Anthropic API');
    throw new Error('Unexpected response format from Anthropic API');
  }
};

const generateOpenAICompletion = async (messages: { role: string; content: string }[], model: string, temperature: number) => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    logger.error('OpenAI API key not set');
    throw new Error('OpenAI API key is not set');
  }

  const openai = new OpenAI({ apiKey });
  logger.info('Sending request to OpenAI API:', { model, temperature, messageCount: messages.length });
  const response = await openai.chat.completions.create({
    model,
    messages: messages as OpenAI.Chat.Completions.ChatCompletionMessageParam[],
    temperature,
  });

  logger.info('Received response from OpenAI API');
  return response.choices[0].message?.content || '';
};

export const generateCompletion = async (messageId: number, model: string, temperature: number) => {
  try {
    logger.info('Starting generateCompletion:', { messageId, model, temperature });

    const parentMessage: Message | null = await Message.findByPk(messageId);
    if (!parentMessage) {
      logger.error('Parent message not found:', { messageId });
      throw new Error(`Parent message with ID ${messageId} not found`);
    }

    const parentContent = parentMessage.get('content');
    logger.info('Found parent message:', { 
      messageId, 
      content: parentContent,
      conversationId: parentMessage.get('conversation_id'),
      userId: parentMessage.get('user_id')
    });

    const conversationId = parentMessage.get('conversation_id');
    if (!conversationId) {
      logger.error('Parent message has no conversation_id:', { messageId });
      throw new Error('Parent message has no conversation_id');
    }

    // Fetch all messages in the conversation
    const conversationMessages = await Message.findAll({
      where: {
        conversation_id: conversationId,
      },
      order: [['createdAt', 'ASC']], // Order messages chronologically
    });
    logger.info('Found conversation messages:', { 
      count: conversationMessages.length,
      messageIds: conversationMessages.map(msg => msg.get('id'))
    });

    // Build the conversation history
    const conversationHistory = conversationMessages
      .filter(msg => (msg.get('id') as number) <= messageId) // Only include messages up to the current one
      .map(msg => {
        const hasModel = msg.get('model') !== null; // Check if the message is from the assistant
        const content = msg.get('content');
        if (!content) {
          logger.error('Message has no content:', { messageId: msg.get('id') });
          throw new Error('Message has no content');
        }
        return {
          role: hasModel ? "assistant" as const : "user" as const,
          content: content as string
        };
      });

    logger.info('Built conversation history:', { 
      count: conversationHistory.length,
      messages: conversationHistory
    });

    if (conversationHistory.length === 0) {
      logger.error('No messages found in conversation');
      throw new Error('No messages found in conversation');
    }

    // Generate completion using either Anthropic or OpenAI
    const completionContent = isAnthropicModel(model)
      ? await generateAnthropicCompletion(conversationHistory, model, temperature)
      : await generateOpenAICompletion(conversationHistory, model, temperature);

    logger.info('Generated completion:', { completionContent });

    const completionMessage: Message = await Message.create({
      content: completionContent,
      parent_id: messageId,
      conversation_id: conversationId,
      user_id: parentMessage.get('user_id') as number,
      model,
      temperature,
    });
    logger.info('Created completion message:', { messageId: completionMessage.get('id') });

    return completionMessage;
  } catch (error) {
    if (error instanceof Error) {
      logger.error('Error in generateCompletion:', { 
        message: error.message,
        messageId,
        model,
        temperature
      });
    } else {
      logger.error('Unknown error in generateCompletion:', { 
        error,
        messageId,
        model,
        temperature
      });
    }
    throw new Error('Failed to generate completion');
  }
};
