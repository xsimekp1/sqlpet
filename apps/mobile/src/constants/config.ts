export const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || 
  'https://sqlpet-production.up.railway.app';

export const ENV = process.env.EXPO_PUBLIC_ENV || 'production';

export const STORAGE_KEYS = {
  ACCESS_TOKEN: 'access_token',
  REFRESH_TOKEN: 'refresh_token',
};
