import { Message as MessageModel } from '../database/models/Message';
import { Conversation as ConversationModel } from '../database/models/Conversation';
import { User as UserModel } from '../database/models/User';
import { Message, Conversation, User } from '../../shared/types';

// Convert database models to API format
export function convertMessageToApiFormat(message: any): Message {
  return {
    id: message.id.toString(),
    conversationId: message.conversation_id.toString(),
    parentId: message.parent_id ? message.parent_id.toString() : null,
    userId: message.user_id.toString(),
    content: message.content,
    model: message.model || null,
    temperature: message.temperature || null,
    timestamp: message.timestamp.toISOString(),
  };
}

export function convertConversationToApiFormat(conversation: any): Conversation {
  const result: Conversation = {
    id: conversation.id.toString(),
    title: conversation.title,
    userId: conversation.user_id.toString(),
  };

  // If messages are included, convert them too
  if (conversation.Messages && Array.isArray(conversation.Messages)) {
    result.messages = conversation.Messages.map(convertMessageToApiFormat);
  }

  return result;
}

export function convertUserToApiFormat(user: any): User {
  return {
    id: user.id.toString(),
    username: user.username,
    email: user.email,
  };
}

// Convert API input to database format
export function convertIdToNumber(id: string | number): number {
  if (typeof id === 'number') return id;
  const num = parseInt(id, 10);
  if (isNaN(num)) {
    throw new Error(`Invalid ID format: ${id}`);
  }
  return num;
}

export function convertApiMessageToDbFormat(message: Partial<Message>): any {
  const result: any = {};
  
  if (message.id) result.id = convertIdToNumber(message.id);
  if (message.conversationId) result.conversation_id = convertIdToNumber(message.conversationId);
  if (message.parentId !== undefined) {
    result.parent_id = message.parentId ? convertIdToNumber(message.parentId) : null;
  }
  if (message.userId) result.user_id = convertIdToNumber(message.userId);
  if (message.content) result.content = message.content;
  if (message.model !== undefined) result.model = message.model;
  if (message.temperature !== undefined) result.temperature = message.temperature;
  if (message.timestamp) result.timestamp = new Date(message.timestamp);
  
  return result;
}
