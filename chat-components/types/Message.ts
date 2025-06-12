// chat-components/types/Message.ts
import { Renderer } from '../renderers/Renderer';
import { Message as BaseMessage } from '../../shared/types';

// Extend the shared Message type with UI-specific properties
export interface Message extends BaseMessage {
  author?: string; // UI field - maps to userId from base type
  buttons?: {
    copy?: string | undefined;
    share?: string | undefined;
    delete?: string | undefined;
    edit?: string | undefined;
  };
  onCopy?: () => void;
  onShare?: () => void;
  onDelete?: (messageId: string) => Promise<void>;
  onEdit?: (messageId: string, newContent: string) => Promise<void>;
  onClick?: () => void;
  renderers?: Renderer[];
  onPrev?: () => void;
  onNext?: () => void;
}
