// server/helpers/messageHelpers.ts
import { Message } from '../database/models/Message';
import 'openai/shims/node';
import '@anthropic-ai/sdk/shims/node';
import { OpenAI } from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { createLogger, transports, format } from 'winston';
import * as messageHelpers from './messageHelpers';
import { EventEmitter } from 'events';

interface MessageContent {
  type: 'content_block_delta';
  delta: {
    text?: string;
  };
}

export interface StreamingResponse extends EventEmitter {
  on(event: 'data', listener: (data: { chunk: string; messageId: number }) => void): this;
  on(event: 'error', listener: (error: Error) => void): this;
  on(event: 'end', listener: (data: { messageId: number }) => void): this;
  removeAllListeners(): this;
}

export function isStreamingResponse(obj: any): obj is StreamingResponse {
  return obj instanceof EventEmitter;
}
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

const generateAnthropicCompletion = async (content: string, model: string, temperature: number, stream = false): Promise<string | StreamingResponse> => {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('Anthropic API key is not set');
  }

  const client = new Anthropic({
    apiKey: apiKey,
  });

  if (!stream) {
    const response = await client.messages.create({
      model,
      max_tokens: 1024,
      temperature,
      messages: [{ role: 'user', content }],
    });

    const contentBlock = response.content[0];
    if ('text' in contentBlock) {
      return contentBlock.text;
    } else {
      logger.error('Unexpected content block type from Anthropic API');
      throw new Error('Unexpected response format from Anthropic API');
    }
  }

  const emitter = new EventEmitter();
  
  (async () => {
    try {
      const stream = await client.messages.create({
        model,
        max_tokens: 1024,
        temperature,
        messages: [{ role: 'user', content }],
        stream: true,
      });

      for await (const chunk of stream) {
        const messageContent = chunk as MessageContent;
        if (
          messageContent.type === 'content_block_delta' &&
          messageContent.delta &&
          messageContent.delta.text
        ) {
          emitter.emit('data', { chunk: messageContent.delta.text, messageId: -1 });
        }
      }
      emitter.emit('end', { messageId: -1 });
    } catch (error) {
      emitter.emit('error', error instanceof Error ? error : new Error(String(error)));
    }
  })();

  return emitter;
};

const generateOpenAICompletion = async (content: string, model: string, temperature: number, stream = false): Promise<string | StreamingResponse> => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OpenAI API key is not set');
  }

  const openai = new OpenAI({ apiKey });

  if (!stream) {
    const response = await openai.chat.completions.create({
      model,
      messages: [{ role: "user", content }],
      temperature,
    });

    return response.choices[0].message?.content || '';
  }

  const emitter = new EventEmitter();
  
  (async () => {
    try {
      const stream = await openai.chat.completions.create({
        model,
        messages: [{ role: "user", content }],
        temperature,
        stream: true,
      });

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content;
        if (content) {
          emitter.emit('data', { chunk: content, messageId: -1 });
        }
      }
      emitter.emit('end', { messageId: -1 });
    } catch (error) {
      emitter.emit('error', error instanceof Error ? error : new Error(String(error)));
    }
  })();

  return emitter;
};

export const generateCompletion = async (messageId: number, model: string, temperature: number, stream = false): Promise<Message | StreamingResponse> => {
  const parentMessage: Message | null = await Message.findByPk(messageId);
  if (!parentMessage) {
    throw new Error(`Parent message with ID ${messageId} not found`);
  }

  const content = parentMessage.get('content') as string;
  if (!content) {
    throw new Error('Parent message has no content');
  }

  try {
    if (stream) {
      const streamingResponse = isAnthropicModel(model)
        ? await generateAnthropicCompletion(content, model, temperature, true)
        : await generateOpenAICompletion(content, model, temperature, true);

      if (isStreamingResponse(streamingResponse)) {
        // Create an empty message that will be updated as the stream progresses
        const completionMessage = await Message.create({
          content: '',
          parent_id: messageId,
          conversation_id: parentMessage.get('conversation_id') as number,
          user_id: parentMessage.get('user_id') as number,
          model,
          temperature,
        });

        let fullContent = '';
        const enhancedEmitter = new EventEmitter();

        streamingResponse.on('data', (data: { chunk: string; messageId: number }) => {
          fullContent += data.chunk;
          enhancedEmitter.emit('data', { chunk: data.chunk, messageId: completionMessage.get('id') as number });
        });

        streamingResponse.on('end', async () => {
          await completionMessage.update({ content: fullContent });
          enhancedEmitter.emit('end', { messageId: completionMessage.get('id') as number });
        });

        streamingResponse.on('error', (error: Error) => {
          enhancedEmitter.emit('error', error);
        });

        return enhancedEmitter;
      }
      throw new Error('Unexpected response type from streaming completion');
    }

    const completionContent = isAnthropicModel(model)
      ? await generateAnthropicCompletion(content, model, temperature)
      : await generateOpenAICompletion(content, model, temperature);

    if (typeof completionContent !== 'string') {
      throw new Error('Unexpected response type from non-streaming completion');
    }

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
      throw error;
    } else {
      logger.error('Error generating completion:', { error });
      throw new Error('Failed to generate completion');
    }
  }
};
