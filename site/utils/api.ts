import { useAuth } from '../components/AuthContext';

interface FetchOptions extends RequestInit {
  requiresAuth?: boolean;
}

export interface StreamingOptions {
  onChunk?: (chunk: { chunk: string; messageId: number }) => void;
  onDone?: (data: { messageId: number }) => void;
  onError?: (error: Error) => void;
}

let authInstance: ReturnType<typeof useAuth> | null = null;

export const setAuthInstance = (instance: ReturnType<typeof useAuth>) => {
  authInstance = instance;
};

export const fetchStreamingCompletion = async (
  parentId: number,
  model: string,
  temperature: number,
  options: StreamingOptions
) => {
  if (!authInstance) {
    throw new Error('Auth instance not set. Make sure to call setAuthInstance first.');
  }

  const { token, logout } = authInstance;
  if (!token) {
    logout();
    throw new Error('No authentication token available');
  }

  const response = await fetch('/api/get_completion', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ parentId, model, temperature }),
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error('Response body is not readable');
  }

  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.trim() === '') continue;
        if (!line.startsWith('data: ') && !line.startsWith('event: ')) continue;

        const [type, ...rest] = line.split(': ');
        const data = rest.join(': ');

        if (type === 'event') {
          continue; // Event name is handled in the next line with the data
        }

        try {
          const parsedData = JSON.parse(data);
          if (parsedData.error) {
            options.onError?.(new Error(parsedData.error));
            return;
          }

          const eventName = lines[lines.indexOf(line) - 1]?.split(': ')[1];
          switch (eventName) {
            case 'chunk':
              options.onChunk?.(parsedData);
              break;
            case 'done':
              options.onDone?.(parsedData);
              break;
            case 'error':
              options.onError?.(new Error(parsedData.error));
              break;
          }
        } catch (e) {
          console.error('Error parsing SSE data:', e);
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
};

export const fetchWithAuth = async (url: string, options: FetchOptions = {}) => {
  if (!authInstance) {
    throw new Error('Auth instance not set. Make sure to call setAuthInstance first.');
  }

  const { token, logout } = authInstance;
  const { requiresAuth = true, ...fetchOptions } = options;

  if (requiresAuth) {
    if (!token) {
      logout();
      throw new Error('No authentication token available');
    }

    fetchOptions.headers = {
      ...fetchOptions.headers,
      'Authorization': `Bearer ${token}`,
    };
  }

  try {
    const response = await fetch(url, fetchOptions);
    
    if (response.status === 401 || response.status === 403) {
      logout();
      throw new Error('Authentication failed');
    }

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return response;
  } catch (error) {
    if ((error as Error).message === 'Authentication failed') {
      logout();
    }
    throw error;
  }
};