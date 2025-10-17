import { LLMProvider } from '../types';
import { logger } from './logger';
import { ERROR_MESSAGES } from './errorMessages';

/**
 * An error class that includes an HTTP status code.
 */
export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

/**
 * Type guard to check if an error is an ApiError or has an HTTP status.
 */
export function isApiError(error: unknown): error is { message: string, status: number } {
  return error instanceof ApiError || (error instanceof Error && typeof (error as any).status === 'number');
}

/**
 * Analyzes an error from an LLM service call and returns a standardized, user-friendly ApiError.
 * @param error The original error object.
 * @param provider The LLM provider that threw the error.
 * @returns An ApiError instance.
 */
export function handleApiError(error: unknown, provider: LLMProvider): ApiError {
  logger.error(`${provider} API call failed`, { error });

  if (isApiError(error)) {
    const status = error.status;
    // Standardize messages for common HTTP status codes
    if (status === 401 || status === 403) {
      return new ApiError(ERROR_MESSAGES.API_KEY_INVALID(provider), status);
    }
    if (status === 429) {
      return new ApiError(ERROR_MESSAGES.RATE_LIMIT(provider), status);
    }
    if (status === 404) {
      return new ApiError(`Model not found or API endpoint is incorrect for ${provider}.`, status);
    }
    // For other ApiErrors, pass the message through but ensure it's an ApiError instance
    return new ApiError(error.message, status);
  }

  if (error instanceof Error) {
    const message = error.message.toLowerCase();

    // Check for common network or SDK-specific error messages
    if (message.includes('api key not valid') || message.includes('permission denied')) {
      return new ApiError(ERROR_MESSAGES.API_KEY_INVALID(provider), 401);
    }
    if (message.includes('rate limit')) {
      return new ApiError(ERROR_MESSAGES.RATE_LIMIT(provider), 429);
    }
    if (message.includes('model not found')) {
      return new ApiError(`Model not found for ${provider}. Please check your settings.`, 404);
    }
    if (message.includes('failed to fetch') || message.includes('network request failed')) {
      return new ApiError(ERROR_MESSAGES.NETWORK_ERROR, 503);
    }
    // Generic fallback for other Error instances
    return new ApiError(error.message, 500);
  }

  // Fallback for non-Error types
  return new ApiError(ERROR_MESSAGES.UNKNOWN_ERROR, 500);
}
