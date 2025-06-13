import { ApiError } from './api';
import { AlertColor } from '@mui/material';

export interface ErrorDisplayOptions {
  showToast?: boolean;
  showInline?: boolean;
  severity?: AlertColor;
  duration?: number;
}

export interface FormattedError {
  message: string;
  severity: AlertColor;
  code?: string;
  isRetryable?: boolean;
}

/**
 * Maps API errors to user-friendly messages with appropriate severity levels
 */
export const formatApiError = (error: unknown): FormattedError => {
  // Handle non-API errors
  if (!(error instanceof Error)) {
    return {
      message: 'An unexpected error occurred. Please try again.',
      severity: 'error',
    };
  }

  const apiError = error as ApiError;

  // Handle network and connectivity errors
  if (apiError.code === 'NETWORK_ERROR') {
    return {
      message: 'Network error. Please check your internet connection and try again.',
      severity: 'error',
      code: apiError.code,
      isRetryable: true,
    };
  }

  if (apiError.code === 'TIMEOUT') {
    return {
      message: 'Request timed out. Please try again.',
      severity: 'warning',
      code: apiError.code,
      isRetryable: true,
    };
  }

  // Handle authentication errors
  if (apiError.status === 401) {
    if (apiError.code === 'TOKEN_REQUIRED') {
      return {
        message: 'You need to sign in to access this feature.',
        severity: 'warning',
        code: apiError.code,
      };
    }
    if (apiError.code === 'INVALID_CREDENTIALS') {
      return {
        message: 'Invalid username or password. Please check your credentials and try again.',
        severity: 'error',
        code: apiError.code,
      };
    }
    return {
      message: 'Authentication failed. Please sign in again.',
      severity: 'error',
      code: apiError.code,
    };
  }

  if (apiError.status === 403) {
    if (apiError.code === 'TOKEN_INVALID') {
      return {
        message: 'Your session has expired. Please sign in again.',
        severity: 'warning',
        code: apiError.code,
      };
    }
    return {
      message: 'You do not have permission to perform this action.',
      severity: 'error',
      code: apiError.code,
    };
  }

  // Handle validation errors
  if (apiError.code === 'VALIDATION_ERROR') {
    const details = apiError.details;
    if (details && Array.isArray(details) && details.length > 0) {
      // Extract first validation error message
      const firstError = details[0];
      const fieldError = firstError.msg || firstError.message;
      return {
        message: fieldError || 'Please check your input and try again.',
        severity: 'warning',
        code: apiError.code,
      };
    }
    return {
      message: 'Please check your input and try again.',
      severity: 'warning',
      code: apiError.code,
    };
  }

  // Handle specific business logic errors
  if (apiError.code === 'USER_EXISTS') {
    return {
      message: 'A user with this username or email already exists. Please try different credentials.',
      severity: 'error',
      code: apiError.code,
    };
  }

  if (apiError.code === 'CONVERSATION_NOT_FOUND') {
    return {
      message: 'The requested conversation could not be found.',
      severity: 'error',
      code: apiError.code,
    };
  }

  if (apiError.code === 'MESSAGE_NOT_FOUND') {
    return {
      message: 'The requested message could not be found.',
      severity: 'error',
      code: apiError.code,
    };
  }

  // Handle rate limiting
  if (apiError.status === 429) {
    if (apiError.code === 'AUTH_RATE_LIMIT_EXCEEDED') {
      return {
        message: 'Too many login attempts. Please wait 15 minutes before trying again.',
        severity: 'warning',
        code: apiError.code,
        isRetryable: true,
      };
    }
    return {
      message: 'Too many requests. Please wait a moment before trying again.',
      severity: 'warning',
      code: apiError.code,
      isRetryable: true,
    };
  }

  // Handle server errors
  if (apiError.status && apiError.status >= 500) {
    return {
      message: 'A server error occurred. Please try again in a few moments.',
      severity: 'error',
      code: apiError.code,
      isRetryable: true,
    };
  }

  // Use server-provided message if available and meaningful
  if (apiError.message && apiError.message !== 'Internal server error') {
    return {
      message: apiError.message,
      severity: 'error',
      code: apiError.code,
      isRetryable: apiError.isRetryable,
    };
  }

  // Default fallback
  return {
    message: 'An error occurred. Please try again.',
    severity: 'error',
    code: apiError.code,
    isRetryable: apiError.isRetryable,
  };
};

/**
 * Hook to handle errors consistently across components
 */
export const useErrorHandler = () => {
  return {
    formatError: formatApiError,
    
    /**
     * Handle an error with consistent formatting and display
     */
    handleError: (
      error: unknown,
      options: ErrorDisplayOptions = {}
    ): FormattedError => {
      const formattedError = formatApiError(error);
      
      // Log error for debugging
      console.error('Handled error:', {
        originalError: error,
        formattedError,
        options,
      });

      return formattedError;
    },
  };
};

/**
 * Context-specific error handlers for common scenarios
 */
export const ErrorHandlers = {
  /**
   * Handle authentication-related errors (login, register)
   */
  auth: (error: unknown): FormattedError => {
    const formatted = formatApiError(error);
    
    // For auth errors, we might want to provide more specific guidance
    if (formatted.code === 'INVALID_CREDENTIALS') {
      return {
        ...formatted,
        message: 'Invalid username or password. Please double-check your credentials.',
      };
    }
    
    if (formatted.code === 'USER_EXISTS') {
      return {
        ...formatted,
        message: 'This username or email is already taken. Please try different credentials or sign in instead.',
      };
    }

    return formatted;
  },

  /**
   * Handle conversation/message-related errors
   */
  conversation: (error: unknown): FormattedError => {
    const formatted = formatApiError(error);
    
    // Provide more context for conversation errors
    if (formatted.code === 'CONVERSATION_NOT_FOUND') {
      return {
        ...formatted,
        message: 'This conversation no longer exists or you do not have access to it.',
      };
    }

    return formatted;
  },

  /**
   * Handle form submission errors
   */
  form: (error: unknown): FormattedError => {
    const formatted = formatApiError(error);
    
    // For form errors, emphasize what the user should do
    if (formatted.code === 'VALIDATION_ERROR') {
      return {
        ...formatted,
        severity: 'warning' as AlertColor,
      };
    }

    return formatted;
  },
};
