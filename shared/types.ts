// Shared type definitions for frontend and backend
// These ensure consistency across the full stack

export interface User {
  id: string;
  username: string;
  email: string;
}

export interface Message {
  id: string;
  conversationId: string;
  parentId?: string | null;
  userId: string;
  content: string;
  model?: string | null;
  temperature?: number | null;
  timestamp: string;
}

export interface Conversation {
  id: string;
  title: string;
  userId: string;
  messages?: Message[];
}

// API Request/Response types
export interface CreateConversationRequest {
  initialMessage: string;
  model: string;
  temperature: number;
}

export interface CreateConversationResponse {
  conversationId: string;
  initialMessageId: string;
  completionMessageId: string;
}

export interface AddMessageRequest {
  content: string;
  conversationId: string;
  parentId?: string | null;
}

export interface AddMessageResponse {
  id: string;
}

export interface GetCompletionRequest {
  messageId: string;
  model: string;
  temperature: number;
}

export interface GetCompletionResponse {
  id: string;
  content: string;
}

export interface EditMessageRequest {
  content: string;
}

export interface EditMessageResponse {
  id: string;
  content: string;
  timestamp: string;
}

export interface DeleteMessageResponse {
  success: boolean;
  deletedMessageId: string;
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
  id: string;
  title: string;
  userId: string;
  messages?: Message[];
}
