// chat-components/types/Conversation.ts

import { Message as MessageType } from './Message';
import { Conversation as BaseConversation } from '../../shared/types';

// Extend the shared Conversation type with UI-specific properties
export interface Conversation extends Omit<BaseConversation, 'messages'> {
  messages: MessageType[]; // Use the UI-extended Message type
}