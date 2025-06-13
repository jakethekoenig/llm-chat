// server/helpers/messageHelpers.ts
import { Message } from '../database/models/Message';
import 'openai/shims/node';
import '@anthropic-ai/sdk/shims/node';
import { OpenAI } from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { Mistral } from '@mistralai/mistralai';
import { createLogger, transports, format } from 'winston';
import * as messageHelpers from './messageHelpers';
const logger = createLogger({
  level: 'error',
  format: format.combine(
    format.timestamp(),
    format.json()
  ),
  transports: process.env.NODE_ENV === 'test' ? [] : [
    new transports.Console()
  ]
});

export { logger };

// Cost calculation utilities
const calculateOpenAICost = (model: string, usage: any): number => {
  if (!usage || !usage.prompt_tokens || !usage.completion_tokens) {
    return 0;
  }

  // OpenAI pricing as of 2024 (per 1K tokens)
  const pricing: { [key: string]: { input: number; output: number } } = {
    'gpt-4': { input: 0.03, output: 0.06 },
    'gpt-4-turbo': { input: 0.01, output: 0.03 },
    'gpt-4-turbo-preview': { input: 0.01, output: 0.03 },
    'gpt-3.5-turbo': { input: 0.0015, output: 0.002 },
    'gpt-3.5-turbo-0125': { input: 0.0005, output: 0.0015 },
  };

  const modelPricing = pricing[model] || pricing['gpt-3.5-turbo']; // fallback
  const inputCost = (usage.prompt_tokens / 1000) * modelPricing.input;
  const outputCost = (usage.completion_tokens / 1000) * modelPricing.output;
  
  return inputCost + outputCost;
};

const calculateAnthropicCost = (model: string, usage: any): number => {
  if (!usage || !usage.input_tokens || !usage.output_tokens) {
    return 0;
  }

  // Anthropic pricing as of 2024 (per 1K tokens)
  const pricing: { [key: string]: { input: number; output: number } } = {
    'claude-3-opus-20240229': { input: 0.015, output: 0.075 },
    'claude-3-sonnet-20240229': { input: 0.003, output: 0.015 },
    'claude-3-haiku-20240307': { input: 0.00025, output: 0.00125 },
    'claude-3-5-sonnet-20241022': { input: 0.003, output: 0.015 },
  };

  const modelPricing = pricing[model] || pricing['claude-3-haiku-20240307']; // fallback to cheapest
  const inputCost = (usage.input_tokens / 1000) * modelPricing.input;
  const outputCost = (usage.output_tokens / 1000) * modelPricing.output;
  
  return inputCost + outputCost;
};

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

export const isAnthropicModel = (model: string): boolean => {
  const anthropicIdentifiers = ['claude', 'sonnet', 'haiku', 'opus'];
  return anthropicIdentifiers.some(identifier => model.toLowerCase().includes(identifier));
};

export const isGeminiModel = (model: string): boolean => {
  const geminiIdentifiers = ['gemini', 'bison', 'palm'];
  return geminiIdentifiers.some(identifier => model.toLowerCase().includes(identifier));
};

const isMistralModel = (model: string): boolean => {
  const mistralIdentifiers = ['mistral', 'mixtral', 'codestral'];
  return mistralIdentifiers.some(identifier => model.toLowerCase().includes(identifier));
};

const isLlamaModel = (model: string): boolean => {
  const llamaIdentifiers = ['llama', 'meta-llama'];
  return llamaIdentifiers.some(identifier => model.toLowerCase().includes(identifier));
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
    const cost = calculateAnthropicCost(model, response.usage);
    return { text: contentBlock.text, cost };
  } else {
    logger.error('Unexpected content block type from Anthropic API');
    throw new Error('Unexpected response format from Anthropic API');
  }
};

const generateAnthropicStreamingCompletion = async function* (
  content: string, 
  model: string, 
  temperature: number
): AsyncIterable<{ text: string; cost?: number; isComplete: boolean }> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('Anthropic API key is not set');
  }

  const client = new Anthropic({
    apiKey: apiKey,
  });

  const stream = await client.messages.create({
    model,
    max_tokens: 1024,
    temperature,
    messages: [{ role: 'user', content }],
    stream: true,
  });

  let usage: any = null;

  for await (const chunk of stream) {
    if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
      yield { text: chunk.delta.text, isComplete: false };
    } else if (chunk.type === 'message_delta' && chunk.usage) {
      usage = chunk.usage;
    }
  }

  // Calculate final cost when stream is complete
  const cost = usage ? calculateAnthropicCost(model, usage) : 0;
  yield { text: '', cost, isComplete: true };
};

const generateGeminiCompletion = async (content: string, model: string, temperature: number) => {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    throw new Error('Google API key is not set');
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const geminiModel = genAI.getGenerativeModel({ model });

  const result = await geminiModel.generateContent({
    contents: [{ role: 'user', parts: [{ text: content }] }],
    generationConfig: {
      temperature,
      maxOutputTokens: 1024,
    },
  });

  const response = await result.response;
  const text = response.text();
  
  // Gemini may not provide usage data, so cost defaults to 0
  const cost = 0; // TODO: Add Gemini cost calculation when usage data is available
  return { text, cost };
};

const generateGeminiStreamingCompletion = async function* (
  content: string, 
  model: string, 
  temperature: number
): AsyncIterable<{ text: string; cost?: number; isComplete: boolean }> {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    throw new Error('Google API key is not set');
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const geminiModel = genAI.getGenerativeModel({ model });

  const result = await geminiModel.generateContentStream({
    contents: [{ role: 'user', parts: [{ text: content }] }],
    generationConfig: {
      temperature,
      maxOutputTokens: 1024,
    },
  });

  for await (const chunk of result.stream) {
    const chunkText = chunk.text();
    if (chunkText) {
      yield { text: chunkText, isComplete: false };
    }
  }

  // Gemini may not provide usage data, so cost defaults to 0
  yield { text: '', cost: 0, isComplete: true };
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

  const text = response.choices[0].message?.content || '';
  const cost = calculateOpenAICost(model, response.usage);
  return { text, cost };
};

const generateOpenAIStreamingCompletion = async function* (
  content: string, 
  model: string, 
  temperature: number
): AsyncIterable<{ text: string; cost?: number; isComplete: boolean }> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OpenAI API key is not set');
  }

  const openai = new OpenAI({ apiKey });
  const stream = await openai.chat.completions.create({
    model,
    messages: [{ role: "user", content }],
    temperature,
    stream: true,
  });

  let usage: any = null;

  for await (const chunk of stream) {
    const textContent = chunk.choices[0]?.delta?.content || '';
    if (textContent) {
      yield { text: textContent, isComplete: false };
    }
    
    // OpenAI sends usage in the final chunk
    if (chunk.usage) {
      usage = chunk.usage;
    }
  }

  // Calculate final cost when stream is complete
  const cost = usage ? calculateOpenAICost(model, usage) : 0;
  yield { text: '', cost, isComplete: true };
};

const generateMistralCompletion = async (content: string, model: string, temperature: number) => {
  const apiKey = process.env.MISTRAL_API_KEY;
  if (!apiKey) {
    throw new Error('Mistral API key is not set');
  }

  const client = new Mistral({
    apiKey: apiKey,
  });

  const response = await client.chat.complete({
    model,
    messages: [{ role: 'user', content }],
    temperature,
  });

  const messageContent = response.choices[0].message?.content;
  let text = '';
  if (typeof messageContent === 'string') {
    text = messageContent;
  } else if (Array.isArray(messageContent)) {
    // Extract text from ContentChunk array
    text = messageContent.map(chunk => 
      typeof chunk === 'string' ? chunk : (chunk.type === 'text' && 'text' in chunk ? chunk.text : '')
    ).join('');
  }
  
  // Mistral may not provide usage data, so cost defaults to 0
  const cost = 0; // TODO: Add Mistral cost calculation when usage data is available
  return { text, cost };
};

const generateOpenRouterCompletion = async (content: string, model: string, temperature: number) => {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error('OpenRouter API key is not set');
  }

  const openai = new OpenAI({
    apiKey,
    baseURL: 'https://openrouter.ai/api/v1',
    defaultHeaders: {
      'HTTP-Referer': 'https://github.com/jakethekoenig/llm-chat',
      'X-Title': 'LLM Chat',
    },
  });

  const response = await openai.chat.completions.create({
    model,
    messages: [{ role: "user", content }],
    temperature,
  });

  const text = response.choices[0].message?.content || '';
  // OpenRouter may not provide usage data, so cost defaults to 0
  const cost = 0; // TODO: Add OpenRouter cost calculation when usage data is available
  return { text, cost };
};

const generateMistralStreamingCompletion = async function* (
  content: string, 
  model: string, 
  temperature: number
): AsyncIterable<{ text: string; cost?: number; isComplete: boolean }> {
  const apiKey = process.env.MISTRAL_API_KEY;
  if (!apiKey) {
    throw new Error('Mistral API key is not set');
  }

  const client = new Mistral({
    apiKey: apiKey,
  });

  const stream = await client.chat.stream({
    model,
    messages: [{ role: 'user', content }],
    temperature,
  });

  for await (const chunk of stream) {
    const deltaContent = chunk.data.choices[0]?.delta?.content;
    if (deltaContent) {
      let textContent = '';
      if (typeof deltaContent === 'string') {
        textContent = deltaContent;
      } else if (Array.isArray(deltaContent)) {
        // Extract text from ContentChunk array
        textContent = deltaContent.map(chunk => 
          typeof chunk === 'string' ? chunk : (chunk.type === 'text' && 'text' in chunk ? chunk.text : '')
        ).join('');
      }
      if (textContent) {
        yield { text: textContent, isComplete: false };
      }
    }
  }

  // Mistral may not provide usage data, so cost defaults to 0
  yield { text: '', cost: 0, isComplete: true };
};

const generateOpenRouterStreamingCompletion = async function* (
  content: string, 
  model: string, 
  temperature: number
): AsyncIterable<{ text: string; cost?: number; isComplete: boolean }> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error('OpenRouter API key is not set');
  }

  const openai = new OpenAI({
    apiKey,
    baseURL: 'https://openrouter.ai/api/v1',
    defaultHeaders: {
      'HTTP-Referer': 'https://github.com/jakethekoenig/llm-chat',
      'X-Title': 'LLM Chat',
    },
  });

  const stream = await openai.chat.completions.create({
    model,
    messages: [{ role: "user", content }],
    temperature,
    stream: true,
  });

  for await (const chunk of stream) {
    const textContent = chunk.choices[0]?.delta?.content || '';
    if (textContent) {
      yield { text: textContent, isComplete: false };
    }
  }

  // OpenRouter may not provide usage data, so cost defaults to 0
  yield { text: '', cost: 0, isComplete: true };
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
    let completion: { text: string; cost: number };
    if (isAnthropicModel(model)) {
      completion = await generateAnthropicCompletion(content, model, temperature);
    } else if (isGeminiModel(model)) {
      completion = await generateGeminiCompletion(content, model, temperature);
    } else if (isMistralModel(model)) {
      completion = await generateMistralCompletion(content, model, temperature);
    } else if (isLlamaModel(model)) {
      completion = await generateOpenRouterCompletion(content, model, temperature);
    } else {
      completion = await generateOpenAICompletion(content, model, temperature);
    }

    // Log completion in non-test environments
    if (process.env.NODE_ENV !== 'test') {
      console.log('completion:', completion);
    }
    const completionMessage: Message = await Message.create({
      content: completion.text,
      parent_id: messageId,
      conversation_id: parentMessage.get('conversation_id') as number,
      user_id: parentMessage.get('user_id') as number,
      model,
      temperature,
      cost: completion.cost,
    });
    return completionMessage;
  } catch (error) {
    if (error instanceof Error) {
      logger.error('Error generating completion:', { message: error.message });
      // Preserve API key errors for better user experience
      if (error.message.includes('API key is not set')) {
        throw error;
      }
    } else {
      logger.error('Error generating completion:', { error });
    }
    throw new Error('Failed to generate completion');
  }
};

export const generateStreamingCompletion = async function* (
  messageId: number, 
  model: string, 
  temperature: number
): AsyncIterable<{ messageId: number; chunk: string; isComplete: boolean }> {
  const parentMessage: Message | null = await Message.findByPk(messageId);
  if (!parentMessage) {
    throw new Error(`Parent message with ID ${messageId} not found`);
  }

  const content = parentMessage.get('content') as string;
  if (!content) {
    throw new Error('Parent message has no content');
  }

  const completionMessage: Message = await Message.create({
    content: '',
    parent_id: messageId,
    conversation_id: parentMessage.get('conversation_id') as number,
    user_id: parentMessage.get('user_id') as number,
    model,
    temperature,
  });

  const completionMessageId = completionMessage.get('id') as number;
  let fullContent = '';

  try {
    let streamGenerator: AsyncIterable<{ text: string; cost?: number; isComplete: boolean }>;
    if (isAnthropicModel(model)) {
      streamGenerator = generateAnthropicStreamingCompletion(content, model, temperature);
    } else if (isGeminiModel(model)) {
      streamGenerator = generateGeminiStreamingCompletion(content, model, temperature);
    } else if (isMistralModel(model)) {
      streamGenerator = generateMistralStreamingCompletion(content, model, temperature);
    } else if (isLlamaModel(model)) {
      streamGenerator = generateOpenRouterStreamingCompletion(content, model, temperature);
    } else {
      streamGenerator = generateOpenAIStreamingCompletion(content, model, temperature);
    }

    for await (const chunk of streamGenerator) {
      if (!chunk.isComplete) {
        fullContent += chunk.text;
        await completionMessage.update({ content: fullContent });
        yield { messageId: completionMessageId, chunk: chunk.text, isComplete: false };
      } else {
        // Final chunk with cost information
        await completionMessage.update({ 
          content: fullContent,
          cost: chunk.cost || 0
        });
        yield { messageId: completionMessageId, chunk: '', isComplete: true };
      }
    }
  } catch (error) {
    if (error instanceof Error) {
      logger.error('Error generating streaming completion:', { message: error.message });
    } else {
      logger.error('Error generating streaming completion:', { error });
    }
    await completionMessage.destroy();
    throw new Error('Failed to generate streaming completion');
  }
};
