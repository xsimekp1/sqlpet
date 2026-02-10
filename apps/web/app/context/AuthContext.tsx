'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import ApiClient, { User, Membership, UserProfile } from '../lib/api';

interface SelectedOrg {
  id: string;
  name: string;
  role: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  refreshToken: string | null;
  memberships: Membership[];
  selectedOrg: SelectedOrg | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  selectOrganization: (orgId: string) => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [refreshTokenState, setRefreshTokenState] = useState<string | null>(null);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [selectedOrg, setSelectedOrg] = useState<SelectedOrg | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  // Initialize from localStorage on mount
  useEffect(() => {
    const initAuth = async () => {
      try {
        const storedToken = localStorage.getItem('token');
        const storedRefreshToken = localStorage.getItem('refreshToken');
        const storedSelectedOrg = localStorage.getItem('selectedOrg');

        if (storedToken) {
          setToken(storedToken);

          // Verify token by fetching user profile
          const profile = await ApiClient.getUserProfile();
          setUser(profile.user);
          setMemberships(profile.memberships);

          // Restore selected org if available
          if (storedSelectedOrg) {
            const orgData = JSON.parse(storedSelectedOrg);
            setSelectedOrg(orgData);
          }
        }

        if (storedRefreshToken) {
          setRefreshTokenState(storedRefreshToken);
        }
      } catch (error) {
        // Token is invalid, clear everything
        console.error('Auth initialization failed:', error);
        localStorage.removeItem('token');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('selectedOrg');
        setToken(null);
        setRefreshTokenState(null);
        setUser(null);
        setMemberships([]);
        setSelectedOrg(null);
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();
  }, []);

  /**
   * Login with email and password
   */
  const login = useCallback(async (email: string, password: string) => {
    try {
      const response = await ApiClient.login(email, password);

      // Store tokens
      localStorage.setItem('token', response.access_token);
      localStorage.setItem('refreshToken', response.refresh_token);
      setToken(response.access_token);
      setRefreshTokenState(response.refresh_token);

      // Fetch user profile
      const profile = await ApiClient.getUserProfile();
      setUser(profile.user);
      setMemberships(profile.memberships);

      // Auto-select if only one membership
      if (profile.memberships.length === 1) {
        const membership = profile.memberships[0];
        const orgData = {
          id: membership.organization_id,
          name: membership.organization_name,
          role: membership.role_name,
        };
        setSelectedOrg(orgData);
        localStorage.setItem('selectedOrg', JSON.stringify(orgData));
        router.push('/dashboard');
      } else {
        // Navigate to org selection
        router.push('/select-org');
      }
    } catch (error) {
      // Clear any partial state
      localStorage.removeItem('token');
      localStorage.removeItem('refreshToken');
      setToken(null);
      setRefreshTokenState(null);
      throw error;
    }
  }, [router]);

  /**
   * Select an organization
   */
  const selectOrganization = useCallback((orgId: string) => {
    const membership = memberships.find(m => m.organization_id === orgId);
    if (!membership) {
      throw new Error('Invalid organization');
    }

    const orgData = {
      id: membership.organization_id,
      name: membership.organization_name,
      role: membership.role_name,
    };

    setSelectedOrg(orgData);
    localStorage.setItem('selectedOrg', JSON.stringify(orgData));
    router.push('/dashboard');
  }, [memberships, router]);

  /**
   * Logout and clear all state
   */
  const logout = useCallback(async () => {
    try {
      await ApiClient.logout();
    } catch (error) {
      // Ignore errors, we'll clear state anyway
      console.error('Logout error:', error);
    }

    // Clear all state
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('selectedOrg');
    setToken(null);
    setRefreshTokenState(null);
    setUser(null);
    setMemberships([]);
    setSelectedOrg(null);
    router.push('/login');
  }, [router]);

  /**
   * Refresh user profile (e.g., after organization changes)
   */
  const refreshUser = useCallback(async () => {
    if (!token) {
      throw new Error('Not authenticated');
    }

    const profile = await ApiClient.getUserProfile();
    setUser(profile.user);
    setMemberships(profile.memberships);
  }, [token]);

  const value: AuthContextType = {
    user,
    token,
    refreshToken: refreshTokenState,
    memberships,
    selectedOrg,
    isAuthenticated: !!token && !!user,
    isLoading,
    login,
    logout,
    selectOrganization,
    refreshUser,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
