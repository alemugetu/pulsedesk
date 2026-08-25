/**
 * Environment configuration for PulseDesk frontend.
 * 
 * IMPORTANT: Frontend environment variables are public to the browser.
 * Never place secrets (JWT secrets, database credentials, private API keys) here.
 */

const getEnvVar = (key: string, defaultValue?: string): string => {
  const value = import.meta.env[key];
  if (value === undefined && defaultValue === undefined) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value ?? defaultValue;
};

export const env = {
  // API Configuration
  API_BASE_URL: getEnvVar('VITE_API_BASE_URL', 'http://localhost:8000'),
  WS_BASE_URL: getEnvVar('VITE_WS_BASE_URL', 'ws://localhost:8000'),
  
  // Application Configuration
  APP_NAME: getEnvVar('VITE_APP_NAME', 'PulseDesk'),
  APP_VERSION: getEnvVar('VITE_APP_VERSION', '1.0.0'),
  
  // Feature Flags (future use)
  ENABLE_WEBSOCKETS: getEnvVar('VITE_ENABLE_WEBSOCKETS', 'true') === 'true',
  ENABLE_ANALYTICS: getEnvVar('VITE_ENABLE_ANALYTICS', 'false') === 'true',
} as const;

export type Env = typeof env;
