import { useAuth } from '../components/AuthContext';

interface FetchOptions extends RequestInit {
  requiresAuth?: boolean;
  retries?: number;
  retryDelay?: number;
  timeout?: number;
}

export interface ApiError extends Error {
  status?: number;
  code?: string;
  details?: any;
  isRetryable?: boolean;
}

export interface ApiErrorResponse {
  error: string;
  message?: string;
  code?: string;
  details?: any;
  timestamp?: string;
}

// Create standardized API error
const createApiError = (
  message: string, 
  status?: number, 
  code?: string, 
  details?: any,
  isRetryable = false
): ApiError => {
  const error = new Error(message) as ApiError;
  error.status = status;
  error.code = code;
  error.details = details;
  error.isRetryable = isRetryable;
  return error;
};

// Check if error is retryable based on status code
const isRetryableError = (status: number): boolean => {
  return [408, 429, 500, 502, 503, 504].includes(status);
};

// Sleep utility for retry delays
const sleep = (ms: number): Promise<void> => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

let authInstance: ReturnType<typeof useAuth> | null = null;

export const setAuthInstance = (instance: ReturnType<typeof useAuth>) => {
  authInstance = instance;
};

export const fetchWithAuth = async (url: string, options: FetchOptions = {}): Promise<Response> => {
  if (!authInstance) {
    throw createApiError('Auth instance not set. Make sure to call setAuthInstance first.');
  }

  const { token, logout } = authInstance;
  const { 
    requiresAuth = true, 
    retries = 3, 
    retryDelay = 1000,
    timeout = 30000,
    ...fetchOptions 
  } = options;

  if (requiresAuth) {
    if (!token) {
      logout();
      throw createApiError('No authentication token available', 401, 'AUTH_TOKEN_MISSING');
    }

    fetchOptions.headers = {
      ...fetchOptions.headers,
      'Authorization': `Bearer ${token}`,
    };
  }

  // Add timeout to request
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  fetchOptions.signal = controller.signal;

  let lastError: ApiError;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, fetchOptions);
      clearTimeout(timeoutId);
      
      // Handle authentication errors
      if (response.status === 401 || response.status === 403) {
        logout();
        throw createApiError('Authentication failed', response.status, 'AUTH_FAILED');
      }

      // Handle other HTTP errors
      if (!response.ok) {
        let errorData: ApiErrorResponse | null = null;
        
        try {
          const contentType = response.headers.get('content-type');
          if (contentType && contentType.includes('application/json')) {
            errorData = await response.json();
          }
        } catch {
          // Ignore JSON parsing errors
        }

        const isRetryable = isRetryableError(response.status);
        const errorMessage = errorData?.message || errorData?.error || `HTTP error! status: ${response.status}`;
        
        const apiError = createApiError(
          errorMessage,
          response.status,
          errorData?.code,
          errorData?.details,
          isRetryable
        );

        // Don't retry on final attempt or non-retryable errors
        if (attempt === retries || !isRetryable) {
          throw apiError;
        }

        lastError = apiError;
        console.warn(`Request failed (attempt ${attempt + 1}/${retries + 1}):`, apiError.message);
        
        // Exponential backoff delay
        const delay = retryDelay * Math.pow(2, attempt);
        await sleep(delay);
        continue;
      }

      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      
      // Handle fetch errors (network, timeout, etc.)
      if (error instanceof Error) {
        const isNetworkError = error.name === 'TypeError' || error.message.includes('Failed to fetch');
        const isTimeoutError = error.name === 'AbortError';
        
        let apiError: ApiError;
        
        if (isTimeoutError) {
          apiError = createApiError('Request timed out', 408, 'TIMEOUT', null, true);
        } else if (isNetworkError) {
          apiError = createApiError('Network error', 0, 'NETWORK_ERROR', null, true);
        } else if ((error as ApiError).status !== undefined) {
          // Already an ApiError, re-throw as is
          throw error;
        } else {
          apiError = createApiError(error.message, 0, 'UNKNOWN_ERROR');
        }

        // Don't retry on final attempt or non-retryable errors
        if (attempt === retries || !apiError.isRetryable) {
          throw apiError;
        }

        lastError = apiError;
        console.warn(`Request failed (attempt ${attempt + 1}/${retries + 1}):`, apiError.message);
        
        // Exponential backoff delay
        const delay = retryDelay * Math.pow(2, attempt);
        await sleep(delay);
        continue;
      }

      // Unexpected error type
      throw createApiError('Unexpected error occurred', 0, 'UNEXPECTED_ERROR');
    }
  }

  // This should never be reached, but TypeScript requires it
  throw lastError!;
};

// Convenience methods for common API operations
export const apiGet = async (url: string, options: FetchOptions = {}): Promise<any> => {
  const response = await fetchWithAuth(url, { ...options, method: 'GET' });
  return response.json();
};

export const apiPost = async (url: string, data: any, options: FetchOptions = {}): Promise<any> => {
  const response = await fetchWithAuth(url, {
    ...options,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    body: JSON.stringify(data),
  });
  return response.json();
};

export const apiPut = async (url: string, data: any, options: FetchOptions = {}): Promise<any> => {
  const response = await fetchWithAuth(url, {
    ...options,
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    body: JSON.stringify(data),
  });
  return response.json();
};

export const apiDelete = async (url: string, options: FetchOptions = {}): Promise<any> => {
  const response = await fetchWithAuth(url, { ...options, method: 'DELETE' });
  return response.json();
};