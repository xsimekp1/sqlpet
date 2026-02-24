import * as SecureStore from 'expo-secure-store';
import { API_BASE_URL, STORAGE_KEYS } from '../constants/config';
import type { TokenResponse, LoginRequest, CurrentUserResponse } from '../types/auth';

let isRefreshing = false;
let failedQueue: Array<{
  resolve: (token: string) => void;
  reject: (error: Error) => void;
}> = [];

const processQueue = (error: Error | null, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token!);
    }
  });
  failedQueue = [];
};

async function fetchWithAuth(url: string, options: RequestInit = {}): Promise<Response> {
  const token = await SecureStore.getItemAsync(STORAGE_KEYS.ACCESS_TOKEN);
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const response = await fetch(`${API_BASE_URL}${url}`, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    if (!isRefreshing) {
      isRefreshing = true;
      try {
        const refreshToken = await SecureStore.getItemAsync(STORAGE_KEYS.REFRESH_TOKEN);
        if (!refreshToken) {
          throw new Error('No refresh token');
        }

        const tokenResponse = await authApi.refresh(refreshToken);
        await SecureStore.setItemAsync(STORAGE_KEYS.ACCESS_TOKEN, tokenResponse.access_token);
        await SecureStore.setItemAsync(STORAGE_KEYS.REFRESH_TOKEN, tokenResponse.refresh_token);

        processQueue(null, tokenResponse.access_token);

        const newToken = tokenResponse.access_token;
        const retryResponse = await fetch(`${API_BASE_URL}${url}`, {
          ...options,
          headers: {
            ...headers,
            Authorization: `Bearer ${newToken}`,
          },
        });
        return retryResponse;
      } catch (refreshError) {
        processQueue(refreshError as Error, null);
        await SecureStore.deleteItemAsync(STORAGE_KEYS.ACCESS_TOKEN);
        await SecureStore.deleteItemAsync(STORAGE_KEYS.REFRESH_TOKEN);
        throw refreshError;
      } finally {
        isRefreshing = false;
      }
    } else {
      return new Promise((resolve, reject) => {
        failedQueue.push({
          resolve: async (token: string) => {
            const retryResponse = await fetch(`${API_BASE_URL}${url}`, {
              ...options,
              headers: {
                ...headers,
                Authorization: `Bearer ${token}`,
              },
            });
            resolve(retryResponse);
          },
          reject,
        });
      });
    }
  }

  return response;
}

export const authApi = {
  login: async (data: LoginRequest): Promise<TokenResponse> => {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error('Login failed');
    return response.json();
  },

  refresh: async (refreshToken: string): Promise<TokenResponse> => {
    const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    if (!response.ok) throw new Error('Refresh failed');
    return response.json();
  },

  getMe: async (): Promise<CurrentUserResponse> => {
    const response = await fetchWithAuth('/auth/me');
    if (!response.ok) throw new Error('Failed to get user');
    return response.json();
  },

  logout: async (): Promise<void> => {
    await fetchWithAuth('/auth/logout', { method: 'POST' });
  },
};

export interface BreedOption {
  id: string;
  name: string;
  species: string;
  display_name?: string | null;
}

export interface BreedColorImage {
  color: string;
  image_url: string;
}

const api = {
  get: async <T>(url: string, headers?: Record<string, string>): Promise<T> => {
    const response = await fetchWithAuth(url, headers ? { headers } : {});
    if (!response.ok) throw new Error(`Request failed: ${response.status}`);
    return response.json();
  },

  post: async <T>(url: string, data?: unknown, headers?: Record<string, string>): Promise<T> => {
    const response = await fetchWithAuth(url, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
      headers,
    });
    if (!response.ok) throw new Error(`Request failed: ${response.status}`);
    return response.json();
  },

  put: async <T>(url: string, data?: unknown, headers?: Record<string, string>): Promise<T> => {
    const response = await fetchWithAuth(url, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
      headers,
    });
    if (!response.ok) throw new Error(`Request failed: ${response.status}`);
    return response.json();
  },

  delete: async <T>(url: string, headers?: Record<string, string>): Promise<T> => {
    const response = await fetchWithAuth(url, { method: 'DELETE', headers });
    if (!response.ok) throw new Error(`Request failed: ${response.status}`);
    return response.json();
  },

  getBreeds: async (species: string, orgId: string): Promise<BreedOption[]> => {
    const response = await fetchWithAuth(`/breeds?species=${species}&locale=cs&page_size=200`, {
      headers: { 'x-organization-id': orgId },
    });
    if (!response.ok) throw new Error(`Request failed: ${response.status}`);
    const data = await response.json();
    // API may return paginated { items: [...] } or plain array
    return Array.isArray(data) ? data : (data.items ?? []);
  },

  getBreedColorImages: async (breedId: string, orgId: string): Promise<BreedColorImage[]> => {
    const response = await fetchWithAuth(`/breeds/${breedId}/color-images`, {
      headers: { 'x-organization-id': orgId },
    });
    if (!response.ok) throw new Error(`Request failed: ${response.status}`);
    const data = await response.json();
    return Array.isArray(data) ? data : (data.items ?? []);
  },
};

export default api;

export interface NearbyShelter {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  distance_km: number;
  accepts_dogs: boolean | null;
  accepts_cats: boolean | null;
}

export const publicApi = {
  getNearbyShelters: async (params: {
    lat: number;
    lng: number;
    species: 'dog' | 'cat' | 'other';
    radius_km?: number;
  }): Promise<NearbyShelter[]> => {
    const { lat, lng, species, radius_km = 50 } = params;
    const url = `${API_BASE_URL}/admin/registered-shelters/nearby?lat=${lat}&lng=${lng}&radius_km=${radius_km}&species=${species}`;
    const response = await fetch(url, {
      headers: { 'Content-Type': 'application/json' },
    });
    if (!response.ok) throw new Error(`Request failed: ${response.status}`);
    return response.json();
  },
};
