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
  permissions: string[];
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  selectOrganization: (orgId: string) => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [refreshTokenState, setRefreshTokenState] = useState<string | null>(null);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [selectedOrg, setSelectedOrg] = useState<SelectedOrg | null>(null);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  // Initialize from localStorage on mount
  useEffect(() => {
    const initAuth = async () => {
      try {
        const storedToken = localStorage.getItem('token');
        const storedRefreshToken = localStorage.getItem('refreshToken');
        const storedSelectedOrg = localStorage.getItem('selectedOrg');
        console.log('[Auth] Init - storedToken:', !!storedToken, 'storedSelectedOrg:', storedSelectedOrg);

        if (storedToken) {
          setToken(storedToken);

          // Verify token by fetching user profile
          const profile = await ApiClient.getUserProfile();
          console.log('[Auth] Profile loaded:', profile.user.email, 'memberships:', profile.memberships.length);
          setUser(profile.user);
          setMemberships(profile.memberships);

          // Restore selected org if available
          if (storedSelectedOrg) {
            const orgData = JSON.parse(storedSelectedOrg);
            console.log('[Auth] Restoring org:', orgData);
            setSelectedOrg(orgData);
            
            // IMPORTANT: Need to get a fresh token with org_id claim first
            // The old token from localStorage doesn't have org_id
            try {
              const orgResponse = await ApiClient.selectOrganization(orgData.id);
              console.log('[Auth] Got new token with org_id');
              localStorage.setItem('token', orgResponse.access_token);
              localStorage.setItem('refreshToken', orgResponse.refresh_token);
              setToken(orgResponse.access_token);
              setRefreshTokenState(orgResponse.refresh_token);
              
              // Now fetch permissions with the new token
              const permResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/auth/permissions`, {
                headers: { 'Authorization': `Bearer ${orgResponse.access_token}` },
              });
              if (permResponse.ok) {
                const permData = await permResponse.json();
                console.log('[Auth] Permissions loaded:', permData.permissions.length);
                setPermissions(permData.permissions || []);
              }
            } catch (e) {
              console.error('[Auth] Failed to refresh token or fetch permissions:', e);
              setPermissions([]);
            }
          }
        }

        if (storedRefreshToken) {
          setRefreshTokenState(storedRefreshToken);
        }
      } catch (error) {
        // Token is invalid, clear everything
        console.error('[Auth] Initialization failed:', error);
        localStorage.removeItem('token');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('selectedOrg');
        setToken(null);
        setRefreshTokenState(null);
        setUser(null);
        setMemberships([]);
        setSelectedOrg(null);
        setPermissions([]);
      } finally {
        setIsLoading(false);
        console.log('[Auth] Init complete');
      }
    };

    initAuth();
  }, []);

  /**
   * Login with email and password
   */
  const login = useCallback(async (email: string, password: string, totpCode?: string) => {
    try {
      const response = await ApiClient.login(email, password, totpCode);

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

        // Get new token with organization context
        const orgResponse = await ApiClient.selectOrganization(membership.organization_id);
        localStorage.setItem('token', orgResponse.access_token);
        localStorage.setItem('refreshToken', orgResponse.refresh_token);
        setToken(orgResponse.access_token);
        setRefreshTokenState(orgResponse.refresh_token);

        // Fetch permissions for the new organization
        try {
          const permResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/auth/permissions`, {
            headers: { 'Authorization': `Bearer ${orgResponse.access_token}` },
          });
          if (permResponse.ok) {
            const permData = await permResponse.json();
            setPermissions(permData.permissions || []);
          }
        } catch (e) {
          console.error('Failed to fetch permissions:', e);
          setPermissions([]);
        }

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
  const selectOrganization = useCallback(async (orgId: string) => {
    const membership = memberships.find(m => m.organization_id === orgId);
    if (!membership) {
      throw new Error('Invalid organization');
    }

    // Get new token from backend with organization context
    const response = await ApiClient.selectOrganization(orgId);
    localStorage.setItem('token', response.access_token);
    localStorage.setItem('refreshToken', response.refresh_token);
    setToken(response.access_token);
    setRefreshTokenState(response.refresh_token);

    // Fetch permissions for the new organization
    try {
      const permResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/auth/permissions`, {
        headers: { 'Authorization': `Bearer ${response.access_token}` },
      });
      if (permResponse.ok) {
        const permData = await permResponse.json();
        setPermissions(permData.permissions || []);
      }
    } catch (e) {
      console.error('Failed to fetch permissions:', e);
      setPermissions([]);
    }

    // Store org info
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
    setPermissions([]);
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
    permissions,
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
