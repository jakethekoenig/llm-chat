// chat-components/types/Conversation.ts

import { Message as MessageType } from './Message';

export interface Conversation {
  id: number;
  title: string;
  user_id: string;
  messages: MessageType[];
}