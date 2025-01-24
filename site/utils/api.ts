import { useAuth } from '../components/AuthContext';

interface FetchOptions extends RequestInit {
  requiresAuth?: boolean;
}

let authInstance: ReturnType<typeof useAuth> | null = null;

export const setAuthInstance = (instance: ReturnType<typeof useAuth>) => {
  authInstance = instance;
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