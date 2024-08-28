// src/types/Message.ts
import { Renderer } from '../renderers/Renderer';

export interface Message {
  id: string;
  content: string | AsyncIterable<string>;
  author?: string;
  timestamp?: string;
  buttons?: {
    copy?: string | undefined;
    share?: string | undefined;
    delete?: string | undefined;
    edit?: string | undefined;
  };
  onCopy?: () => void;
  onShare?: () => void;
  onDelete?: () => void;
  onEdit?: () => void;
  onClick?: () => void;
  renderers?: Renderer[];
  parentId?: string | null;
  onPrev?: () => void;
  onNext?: () => void;
  children?: { [key: string]: Message };
}