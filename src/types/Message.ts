// src/types/Message.ts
import { Renderer } from '../renderers/Renderer';

export interface Message {
  id: string;
  content: string | AsyncIterable<string>;
  author?: string;
  timestamp?: string;
  buttons?: {
    copy?: boolean;
    share?: boolean;
    delete?: boolean;
    edit?: boolean;
  };
  onCopy?: () => void;
  onShare?: () => void;
  onDelete?: () => void;
  onEdit?: () => void;
  renderers?: Renderer[];
  parentId?: string | null;
  conversationId?: string;
}