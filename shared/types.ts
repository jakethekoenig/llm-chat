// Shared type definitions for frontend and backend
// These ensure consistency across the full stack

export interface User {
  id: number;
  username: string;
  email: string;
}

export interface Message {
  id: number;
  conversationId: number;
  parentId?: number | null;
  userId: number;
  content: string;
  model?: string | null;
  temperature?: number | null;
  cost?: number | null;
  timestamp: string;
}

export interface Conversation {
  id: number;
  title: string;
  userId: number;
  messages?: Message[];
}

// API Request/Response types
export interface CreateConversationRequest {
  initialMessage: string;
  model: string;
  temperature: number;
}

export interface CreateConversationResponse {
  conversationId: number;
  initialMessageId: number;
  completionMessageId: number;
}

export interface AddMessageRequest {
  content: string;
  conversationId: number;
  parentId?: number | null;
}

export interface AddMessageResponse {
  id: number;
}

export interface GetCompletionRequest {
  messageId: number;
  model: string;
  temperature: number;
}

export interface GetCompletionResponse {
  id: number;
  content: string;
}

export interface EditMessageRequest {
  content: string;
}

export interface EditMessageResponse {
  id: number;
  content: string;
  timestamp: string;
}

export interface DeleteMessageResponse {
  success: boolean;
  deletedMessageId: number;
}

export interface AuthResponse {
  token: string;
}

export interface RegisterRequest {
  username: string;
  email: string;
  password: string;
}

export interface SignInRequest {
  username: string;
  password: string;
}

export interface UpdateConversationRequest {
  title: string;
}

export interface UpdateConversationResponse {
  id: number;
  title: string;
  userId: number;
  messages?: Message[];
}
