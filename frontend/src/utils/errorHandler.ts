/**
 * Error Handler Utility
 * 
 * Centralized error handling with user-friendly messages and actionable next steps.
 * Maps technical errors to human-readable explanations.
 * 
 * Features:
 * - User-friendly error messages
 * - Actionable next steps
 * - Error logging for debugging
 * - Retry logic support
 * - Network error detection
 */

export interface ErrorDetails {
  /** User-friendly error message */
  message: string;
  /** Actionable next steps for the user */
  action?: string;
  /** Technical error details (for logging) */
  technical?: string;
  /** Whether to show a "Try Again" button */
  canRetry?: boolean;
  /** Error code for tracking */
  code?: string;
}

/**
 * Common error codes and their user-friendly messages
 */
const ERROR_MESSAGES: Record<string, ErrorDetails> = {
  // Network errors
  NETWORK_ERROR: {
    message: "Can't connect to the server",
    action: "Check your internet connection and try again.",
    canRetry: true,
    code: 'NETWORK_ERROR',
  },
  OFFLINE: {
    message: "You're offline",
    action: "Your changes will be saved when you reconnect.",
    canRetry: false,
    code: 'OFFLINE',
  },
  TIMEOUT: {
    message: 'Request timed out',
    action: 'The server is taking too long to respond. Please try again.',
    canRetry: true,
    code: 'TIMEOUT',
  },

  // HTTP errors
  400: {
    message: 'Invalid request',
    action: 'Please check your input and try again.',
    canRetry: false,
    code: '400',
  },
  401: {
    message: 'Access denied',
    action: 'You need to sign in to continue.',
    canRetry: false,
    code: '401',
  },
  403: {
    message: 'Access forbidden',
    action: "You don't have permission to perform this action.",
    canRetry: false,
    code: '403',
  },
  404: {
    message: 'Not found',
    action: 'The item you\'re looking for doesn\'t exist.',
    canRetry: false,
    code: '404',
  },
  409: {
    message: 'Conflict detected',
    action: 'This item has been modified by someone else. Please refresh and try again.',
    canRetry: true,
    code: '409',
  },
  429: {
    message: 'Too many requests',
    action: 'Please slow down and try again in a moment.',
    canRetry: true,
    code: '429',
  },
  500: {
    message: 'Server error',
    action: 'Something went wrong on our end. Please try again later.',
    canRetry: true,
    code: '500',
  },
  502: {
    message: 'Server unavailable',
    action: 'The server is temporarily unavailable. Please try again in a moment.',
    canRetry: true,
    code: '502',
  },
  503: {
    message: 'Service unavailable',
    action: 'The service is temporarily down for maintenance. Please try again later.',
    canRetry: true,
    code: '503',
  },

  // Feature-specific errors
  MEMBER_NOT_FOUND: {
    message: "Member not found",
    action: "The member you're looking for doesn't exist or has been removed.",
    canRetry: false,
    code: 'MEMBER_NOT_FOUND',
  },
  EVENT_NOT_FOUND: {
    message: "Event not found",
    action: "The event you're looking for doesn't exist or has ended.",
    canRetry: false,
    code: 'EVENT_NOT_FOUND',
  },
  CHECKIN_FAILED: {
    message: "Check-in failed",
    action: "Couldn't complete your check-in. Please try again.",
    canRetry: true,
    code: 'CHECKIN_FAILED',
  },
  CHECKOUT_FAILED: {
    message: "Check-out failed",
    action: "Couldn't complete your check-out. Please try again.",
    canRetry: true,
    code: 'CHECKOUT_FAILED',
  },
  DELETE_FAILED: {
    message: "Couldn't delete",
    action: "This item may have related data. Please check and try again.",
    canRetry: true,
    code: 'DELETE_FAILED',
  },
  UPLOAD_FAILED: {
    message: "Upload failed",
    action: "The file couldn't be uploaded. Check your connection and file size.",
    canRetry: true,
    code: 'UPLOAD_FAILED',
  },
  LOAD_MEMBERS_FAILED: {
    message: "Couldn't load members",
    action: "Failed to load the member list. Check your connection and try again.",
    canRetry: true,
    code: 'LOAD_MEMBERS_FAILED',
  },
  LOAD_EVENTS_FAILED: {
    message: "Couldn't load events",
    action: "Failed to load events. Check your connection and try again.",
    canRetry: true,
    code: 'LOAD_EVENTS_FAILED',
  },
  CREATE_EVENT_FAILED: {
    message: "Couldn't create event",
    action: "Failed to create the event. Please try again.",
    canRetry: true,
    code: 'CREATE_EVENT_FAILED',
  },
  END_EVENT_FAILED: {
    message: "Couldn't end event",
    action: "Failed to end the event. Please try again.",
    canRetry: true,
    code: 'END_EVENT_FAILED',
  },
  
  // Generic fallback
  UNKNOWN: {
    message: 'Something went wrong',
    action: 'An unexpected error occurred. Please try again.',
    canRetry: true,
    code: 'UNKNOWN',
  },
};

/**
 * Parse error from various sources and return ErrorDetails
 */
export function parseError(error: unknown): ErrorDetails {
  // Network errors
  if (error instanceof TypeError && error.message.includes('fetch')) {
    return ERROR_MESSAGES.NETWORK_ERROR;
  }

  // Check if it's a Response object (fetch error)
  if (error && typeof error === 'object' && 'status' in error) {
    const status = String((error as { status: number }).status);
    if (ERROR_MESSAGES[status]) {
      const errorDetails = ERROR_MESSAGES[status];
      return {
        ...errorDetails,
        technical: `HTTP ${status}`,
      };
    }
  }

  // Error object with message
  if (error instanceof Error) {
    const message = error.message.toLowerCase();

    // Check for known error codes in message
    for (const [code, details] of Object.entries(ERROR_MESSAGES)) {
      if (message.includes(code.toLowerCase().replace('_', ' '))) {
        return {
          ...details,
          technical: error.message,
        };
      }
    }

    // Special cases
    if (message.includes('network') || message.includes('connection')) {
      return { ...ERROR_MESSAGES.NETWORK_ERROR, technical: error.message };
    }
    if (message.includes('timeout')) {
      return { ...ERROR_MESSAGES.TIMEOUT, technical: error.message };
    }
    if (message.includes('offline')) {
      return { ...ERROR_MESSAGES.OFFLINE, technical: error.message };
    }
    if (message.includes('member')) {
      return { ...ERROR_MESSAGES.MEMBER_NOT_FOUND, technical: error.message };
    }
    if (message.includes('event')) {
      return { ...ERROR_MESSAGES.EVENT_NOT_FOUND, technical: error.message };
    }

    // Return generic error with original message
    return {
      message: error.message,
      action: 'Please try again or contact support if the problem persists.',
      canRetry: true,
      technical: error.message,
      code: 'ERROR',
    };
  }

  // String error
  if (typeof error === 'string') {
    return {
      message: error,
      action: 'Please try again.',
      canRetry: true,
      technical: error,
      code: 'STRING_ERROR',
    };
  }

  // Unknown error
  return {
    ...ERROR_MESSAGES.UNKNOWN,
    technical: String(error),
  };
}

/**
 * Log error details for debugging
 */
export function logError(error: unknown, context?: string): void {
  const details = parseError(error);
  
  console.error('Error:', {
    context,
    userMessage: details.message,
    action: details.action,
    technical: details.technical,
    code: details.code,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Format error for display
 */
export function formatErrorMessage(error: unknown): string {
  const details = parseError(error);
  if (details.action) {
    return `${details.message}. ${details.action}`;
  }
  return details.message;
}

/**
 * Check if error is retryable
 */
export function canRetryError(error: unknown): boolean {
  const details = parseError(error);
  return details.canRetry ?? false;
}

/**
 * Get error code for tracking
 */
export function getErrorCode(error: unknown): string {
  const details = parseError(error);
  return details.code || 'UNKNOWN';
}
