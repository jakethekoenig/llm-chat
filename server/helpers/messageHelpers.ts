// server/helpers/messageHelpers.ts
import { Message } from '../database/models/Message';
import { User } from '../database/models/User';
import 'openai/shims/node';
import { OpenAI } from 'openai';
import { createLogger, transports, format } from 'winston';

const ASSISTANT_USER_ID = 2; // Replace with the actual assistant user ID from your database
const USER_ID = 1; // Replace with the actual user ID or fetch dynamically as needed

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
// Removed duplicate logger declaration

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

  const content = parentMessage.get('content') as string;

  if (!content) {
    throw new Error('Parent message has no content');
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OpenAI API key is not set');
  }

  const openai = new OpenAI({ apiKey: apiKey});

  try {
    const response = await openai.chat.completions.create({
      model,
      messages: [{"role": "user", "content": content}],
      temperature,
    });

    const completionContent = response.choices[0].message?.content || '';
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

export const buildConversation = async (messageId: number): Promise<Array<{ role: string, content: string }>> => {
  const conversation: Array<{ role: string, content: string }> = [];
  let currentMessage = await Message.findByPk(messageId, { include: [{ model: User }] });
  
  while (currentMessage) {
    const user = await User.findByPk(currentMessage.get('user_id'));
    const isAssistant = user?.username === 'LLM_Model_Username'; // Replace with actual LLM model identifier
    conversation.unshift({
      role: isAssistant ? 'assistant' : 'user',
      content: currentMessage.get('content') as string,
    });
    if (currentMessage.get('parent_id')) {
      currentMessage = await Message.findByPk(currentMessage.get('parent_id'), { include: [{ model: User }] });
    } else {
      currentMessage = null;
    }
  }
  
  return conversation;
};

export const generateCompletionFromConversation = async (
  conversation: Array<{ role: string, content: string }>,
  model: string,
  temperature: number
) => {
  const conversationId = /* Fetch or pass the conversation ID */;
  const userId = /* Determine the user ID based on roles */;
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OpenAI API key is not set');
  }

  const openai = new OpenAI({ apiKey: apiKey });

  try {
    const response = await openai.chat.completions.create({
      model,
      messages: conversation,
      temperature,
    });

    const completionContent = response.choices[0].message?.content || '';
    const lastUserMessage = conversation[conversation.length - 1];
    const userId = lastUserMessage.role === 'assistant' ? ASSISTANT_USER_ID : USER_ID;

    const completionMessage: Message = await Message.create({
      content: completionContent,
      parent_id: lastUserMessage.id, // Ensure this links correctly
      conversation_id: conversationId,
      user_id: ASSISTANT_USER_ID,
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
