// services/errorMessages.ts
export const ERROR_MESSAGES = {
  API_KEY_MISSING: (provider: string) => `API key for ${provider} is not configured. Please check your settings.`,
  API_KEY_INVALID: (provider: string) => `Invalid API key for ${provider}. Please verify your credentials.`,
  RATE_LIMIT: (provider: string) => `Rate limit exceeded for ${provider}. Please wait before trying again.`,
  NETWORK_ERROR: 'Network error. Please check your internet connection.',
  UNKNOWN_ERROR: 'An unexpected error occurred. Please try again.',
} as const;
