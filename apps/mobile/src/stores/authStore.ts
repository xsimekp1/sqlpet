import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { authApi } from '../lib/api';
import { STORAGE_KEYS } from '../constants/config';
import type { User, MembershipInfo, CurrentUserResponse, TokenResponse } from '../types/auth';

interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: User | null;
  memberships: MembershipInfo[];
  selectedOrganizationId: string | null;
  error: string | null;

  hydrate: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  selectOrganization: (orgId: string) => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  isAuthenticated: false,
  isLoading: true,
  user: null,
  memberships: [],
  selectedOrganizationId: null,
  error: null,

  hydrate: async () => {
    try {
      const accessToken = await SecureStore.getItemAsync(STORAGE_KEYS.ACCESS_TOKEN);
      if (!accessToken) {
        set({ isLoading: false, isAuthenticated: false });
        return;
      }

      const response = await authApi.getMe();
      set({
        user: response.user,
        memberships: response.memberships,
        isAuthenticated: true,
        isLoading: false,
        selectedOrganizationId: response.memberships[0]?.organization_id || null,
      });
    } catch (error) {
      await SecureStore.deleteItemAsync(STORAGE_KEYS.ACCESS_TOKEN);
      await SecureStore.deleteItemAsync(STORAGE_KEYS.REFRESH_TOKEN);
      set({ isLoading: false, isAuthenticated: false });
    }
  },

  login: async (email: string, password: string) => {
    set({ isLoading: true, error: null });
    try {
      const tokens: TokenResponse = await authApi.login({ email, password });

      await SecureStore.setItemAsync(STORAGE_KEYS.ACCESS_TOKEN, tokens.access_token);
      await SecureStore.setItemAsync(STORAGE_KEYS.REFRESH_TOKEN, tokens.refresh_token);

      const userResponse: CurrentUserResponse = await authApi.getMe();

      set({
        user: userResponse.user,
        memberships: userResponse.memberships,
        isAuthenticated: true,
        isLoading: false,
        selectedOrganizationId: userResponse.memberships[0]?.organization_id || null,
      });
    } catch (error: any) {
      const message = error.response?.data?.detail || 'Login failed. Please try again.';
      set({ isLoading: false, error: message });
      throw new Error(message);
    }
  },

  logout: async () => {
    try {
      await authApi.logout();
    } catch {
      // Ignore logout errors
    } finally {
      await SecureStore.deleteItemAsync(STORAGE_KEYS.ACCESS_TOKEN);
      await SecureStore.deleteItemAsync(STORAGE_KEYS.REFRESH_TOKEN);
      set({
        isAuthenticated: false,
        user: null,
        memberships: [],
        selectedOrganizationId: null,
        error: null,
      });
    }
  },

  selectOrganization: async (orgId: string) => {
    const { user } = get();
    if (!user) return;

    try {
      const response = await authApi.refresh(
        (await SecureStore.getItemAsync(STORAGE_KEYS.REFRESH_TOKEN)) || ''
      );
      await SecureStore.setItemAsync(STORAGE_KEYS.ACCESS_TOKEN, response.access_token);
      await SecureStore.setItemAsync(STORAGE_KEYS.REFRESH_TOKEN, response.refresh_token);

      set({ selectedOrganizationId: orgId });
    } catch (error) {
      console.error('Failed to select organization:', error);
    }
  },

  clearError: () => set({ error: null }),
}));
