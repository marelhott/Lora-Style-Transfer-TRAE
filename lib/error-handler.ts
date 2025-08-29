// Error handling utilities for Neural Art Studio

export interface AppError {
  message: string;
  code?: string;
  details?: string;
  timestamp: number;
}

export class NetworkError extends Error {
  constructor(message: string, public details?: string) {
    super(message);
    this.name = 'NetworkError';
  }
}

export class BackendError extends Error {
  constructor(message: string, public status?: number, public details?: string) {
    super(message);
    this.name = 'BackendError';
  }
}

export class ValidationError extends Error {
  constructor(message: string, public field?: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export function createAppError(error: unknown): AppError {
  const timestamp = Date.now();

  if (error instanceof NetworkError) {
    return {
      message: 'Network connection failed',
      code: 'NETWORK_ERROR',
      details: error.details || 'Please check your internet connection and try again.',
      timestamp,
    };
  }

  if (error instanceof BackendError) {
    return {
      message: 'Backend service error',
      code: 'BACKEND_ERROR',
      details: error.details || `Server returned status ${error.status}`,
      timestamp,
    };
  }

  if (error instanceof ValidationError) {
    return {
      message: 'Validation failed',
      code: 'VALIDATION_ERROR',
      details: error.field ? `Invalid value for field: ${error.field}` : error.message,
      timestamp,
    };
  }

  if (error instanceof Error) {
    return {
      message: error.message,
      code: 'UNKNOWN_ERROR',
      details: 'An unexpected error occurred. Please try again.',
      timestamp,
    };
  }

  return {
    message: 'Unknown error occurred',
    code: 'UNKNOWN_ERROR',
    details: 'An unexpected error occurred. Please try again.',
    timestamp,
  };
}

export function logError(error: AppError, context?: string) {
  console.error(`[${new Date(error.timestamp).toISOString()}] ${context || 'Error'}:`, {
    message: error.message,
    code: error.code,
    details: error.details,
  });
}

// Retry utility for network requests
export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  delay: number = 1000
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      if (attempt === maxRetries) {
        break;
      }

      // Exponential backoff
      const waitTime = delay * Math.pow(2, attempt - 1);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }

  throw lastError;
}

// API request wrapper with error handling
export async function apiRequest<T>(
  url: string,
  options: RequestInit = {}
): Promise<T> {
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new BackendError(
        errorData.error || 'Request failed',
        response.status,
        errorData.details
      );
    }

    return await response.json();
  } catch (error) {
    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new NetworkError('Failed to connect to server', 'Please check if the backend is running');
    }
    throw error;
  }
}