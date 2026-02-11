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

// Animal types
export interface Animal {
  id: string;
  organization_id: string;
  public_code: string;
  name: string;
  species: 'DOG' | 'CAT' | 'RABBIT' | 'OTHER';
  sex: 'MALE' | 'FEMALE' | 'UNKNOWN';
  color: string | null;
  estimated_age_years: number | null;
  intake_date: string;
  status: 'AVAILABLE' | 'ADOPTED' | 'FOSTERED' | 'TRANSFERRED' | 'DECEASED' | 'ESCAPED';
  created_at: string;
  updated_at: string;
}

export interface CreateAnimalRequest {
  name: string;
  species: 'DOG' | 'CAT' | 'RABBIT' | 'OTHER';
  sex: 'MALE' | 'FEMALE' | 'UNKNOWN';
  color?: string | null;
  estimated_age_years?: number | null;
  intake_date: string;
  status?: string;
}

class ApiClient {
  /**
   * Get authorization headers with Bearer token from localStorage
   */
  private static getAuthHeaders(): Record<string, string> {
    if (typeof window === 'undefined') {
      console.warn('getAuthHeaders: running on server, no localStorage');
      return {};
    }

    const token = localStorage.getItem('token');
    if (!token) {
      console.warn('getAuthHeaders: no token in localStorage');
      return {};
    }

    console.log('getAuthHeaders: token found, length:', token.length);
    return {
      'Authorization': `Bearer ${token}`,
    };
  }

  /**
   * Login with email and password
   * Backend expects JSON with email and password fields
   */
  static async login(email: string, password: string): Promise<LoginResponse> {
    try {
      const response = await axios.post<LoginResponse>(
        `${API_URL}/auth/login`,
        { email, password },
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

  /**
   * Get all kennels for current organization
   * M4+: Kennels Management
   */
  static async getKennels(): Promise<any[]> {
    try {
      // Get current organization from localStorage
      const organizationId = typeof window !== 'undefined' 
        ? localStorage.getItem('currentOrganizationId') 
        : null;
      
      if (!organizationId) {
        throw new Error('No organization selected. Please select an organization first.');
      }

      const response = await axios.get<any[]>(
        `${API_URL}/kennels`,
        {
          headers: {
            ...this.getAuthHeaders(),
            'x-organization-id': organizationId,
          },
        }
      );
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError<ApiError>;
        throw new Error(
          axiosError.response?.data?.detail || 'Failed to fetch kennels'
        );
      }
      throw new Error('An unexpected error occurred');
    }
  }

  /**
   * Get single kennel by ID
   * M4+: Kennels Management
   */
  static async getKennel(id: string): Promise<any> {
    try {
      const response = await axios.get<any>(
        `${API_URL}/kennels/${id}`,
        {
          headers: this.getAuthHeaders(),
        }
      );
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError<ApiError>;
        throw new Error(
          axiosError.response?.data?.detail || 'Failed to fetch kennel'
        );
      }
      throw new Error('An unexpected error occurred');
    }
  }

  /**
   * Move animal between kennels
   * M4+: Kennels Management
   */
  static async moveAnimal(animalId: string, targetKennelId: string | null): Promise<any> {
    try {
      const params = new URLSearchParams({
        animal_id: animalId,
        target_kennel_id: targetKennelId || '',
      });
      
      const response = await axios.post<any>(
        `${API_URL}/kennels/move?${params.toString()}`,
        {},
        {
          headers: this.getAuthHeaders(),
        }
      );
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError<ApiError>;
        throw new Error(
          axiosError.response?.data?.detail || 'Failed to move animal'
        );
      }
      throw new Error('An unexpected error occurred');
    }
  }

  /**
   * Get all animals for current organization
   * M3: Animals CRUD
   */
  static async getAnimals(): Promise<Animal[]> {
    try {
      const response = await axios.get<Animal[]>(
        `${API_URL}/animals`,
        {
          headers: this.getAuthHeaders(),
        }
      );
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError<ApiError>;
        throw new Error(
          axiosError.response?.data?.detail || 'Failed to fetch animals'
        );
      }
      throw new Error('An unexpected error occurred');
    }
  }

  /**
   * Get single animal by ID
   * M3: Animals CRUD
   */
  static async getAnimal(id: string): Promise<Animal> {
    try {
      const response = await axios.get<Animal>(
        `${API_URL}/animals/${id}`,
        {
          headers: this.getAuthHeaders(),
        }
      );
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError<ApiError>;
        throw new Error(
          axiosError.response?.data?.detail || 'Failed to fetch animal'
        );
      }
      throw new Error('An unexpected error occurred');
    }
  }

  /**
   * Create new animal
   * M3: Animals CRUD
   */
  static async createAnimal(data: CreateAnimalRequest): Promise<Animal> {
    try {
      const response = await axios.post<Animal>(
        `${API_URL}/animals`,
        data,
        {
          headers: {
            ...this.getAuthHeaders(),
            'Content-Type': 'application/json',
          },
        }
      );
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError<ApiError>;
        throw new Error(
          axiosError.response?.data?.detail || 'Failed to create animal'
        );
      }
      throw new Error('An unexpected error occurred');
    }
  }

  /**
   * Update existing animal
   * M3: Animals CRUD
   */
  static async updateAnimal(id: string, data: Partial<CreateAnimalRequest>): Promise<Animal> {
    try {
      const response = await axios.put<Animal>(
        `${API_URL}/animals/${id}`,
        data,
        {
          headers: {
            ...this.getAuthHeaders(),
            'Content-Type': 'application/json',
          },
        }
      );
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError<ApiError>;
        throw new Error(
          axiosError.response?.data?.detail || 'Failed to update animal'
        );
      }
      throw new Error('An unexpected error occurred');
    }
  }

  /**
   * Delete animal
   * M3: Animals CRUD
   */
  static async deleteAnimal(id: string): Promise<void> {
    try {
      await axios.delete(
        `${API_URL}/animals/${id}`,
        {
          headers: this.getAuthHeaders(),
        }
      );
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError<ApiError>;
        throw new Error(
          axiosError.response?.data?.detail || 'Failed to delete animal'
        );
      }
      throw new Error('An unexpected error occurred');
    }
  }
}

export default ApiClient;
