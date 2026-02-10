import axios, { AxiosError } from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// Response types
export interface LoginResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
}

export interface User {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  is_superadmin: boolean;
  locale: string;
  permissions?: string[];
}

export interface Membership {
  id: string;
  organization_id: string;
  organization_name: string;
  role_name: string;
  status: string;
}

export interface UserProfile {
  user: User;
  memberships: Membership[];
}

export interface ApiError {
  detail: string;
}

class ApiClient {
  /**
   * Get authorization headers with Bearer token from localStorage
   */
  private static getAuthHeaders(): Record<string, string> {
    if (typeof window === 'undefined') {
      return {};
    }

    const token = localStorage.getItem('token');
    if (!token) {
      return {};
    }

    return {
      'Authorization': `Bearer ${token}`,
    };
  }

  /**
   * Login with email and password
   * Backend expects OAuth2 form format (application/x-www-form-urlencoded)
   */
  static async login(email: string, password: string): Promise<LoginResponse> {
    try {
      const formData = new URLSearchParams();
      formData.append('username', email); // OAuth2 expects 'username' field
      formData.append('password', password);

      const response = await axios.post<LoginResponse>(
        `${API_URL}/auth/login`,
        formData,
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      );

      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError<ApiError>;
        throw new Error(
          axiosError.response?.data?.detail || 'Login failed'
        );
      }
      throw new Error('An unexpected error occurred');
    }
  }

  /**
   * Refresh access token using refresh token
   */
  static async refreshToken(refreshToken: string): Promise<LoginResponse> {
    try {
      const response = await axios.post<LoginResponse>(
        `${API_URL}/auth/refresh`,
        { refresh_token: refreshToken },
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError<ApiError>;
        throw new Error(
          axiosError.response?.data?.detail || 'Token refresh failed'
        );
      }
      throw new Error('An unexpected error occurred');
    }
  }

  /**
   * Get current user profile with memberships
   */
  static async getUserProfile(): Promise<UserProfile> {
    try {
      const response = await axios.get<UserProfile>(
        `${API_URL}/auth/me`,
        {
          headers: this.getAuthHeaders(),
        }
      );

      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError<ApiError>;
        throw new Error(
          axiosError.response?.data?.detail || 'Failed to fetch user profile'
        );
      }
      throw new Error('An unexpected error occurred');
    }
  }

  /**
   * Logout (revoke token on backend)
   */
  static async logout(): Promise<void> {
    try {
      await axios.post(
        `${API_URL}/auth/logout`,
        {},
        {
          headers: this.getAuthHeaders(),
        }
      );
    } catch (error) {
      // Ignore errors on logout, we'll clear local state anyway
      console.error('Logout error:', error);
    }
  }
}

export default ApiClient;
