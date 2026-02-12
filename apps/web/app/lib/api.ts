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

// Task types
export interface Task {
  id: string;
  organization_id: string;
  created_by_id: string;
  assigned_to_id: string | null;
  title: string;
  description: string | null;
  type: 'general' | 'feeding' | 'medical' | 'cleaning' | 'maintenance' | 'administrative';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  due_at: string | null;
  completed_at: string | null;
  task_metadata: Record<string, any> | null;
  related_entity_type: string | null;
  related_entity_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateTaskRequest {
  title: string;
  description?: string;
  type?: string;
  priority?: string;
  assigned_to_id?: string;
  due_at?: string;
  task_metadata?: Record<string, any>;
  related_entity_type?: string;
  related_entity_id?: string;
}

export interface TaskListResponse {
  items: Task[];
  total: number;
  page: number;
  page_size: number;
}

// Animal types
export interface Animal {
  id: string;
  organization_id: string;
  public_code: string;
  name: string;
  species: 'dog' | 'cat' | 'rabbit' | 'bird' | 'other';
  sex: 'male' | 'female' | 'unknown';
  color: string | null;
  estimated_age_years: number | null;
  intake_date: string;
  status: 'intake' | 'available' | 'reserved' | 'adopted' | 'fostered' | 'returned' | 'deceased' | 'transferred' | 'hold' | 'quarantine' | 'returned_to_owner' | 'euthanized' | 'escaped';
  created_at: string;
  updated_at: string;
}

export interface CreateAnimalRequest {
  name: string;
  species: 'dog' | 'cat' | 'rabbit' | 'bird' | 'other';
  sex: 'male' | 'female' | 'unknown';
  color?: string | null;
  intake_date: string;
  status?: string;
  // Note: Backend uses birth_date_estimated and age_group instead of estimated_age_years
  // For now, omit age fields - will be added in future milestone
}

// Kennel types
export interface Kennel {
  id: string;
  code: string;
  name: string;
  zone_id: string;
  zone_name: string;
  status: 'available' | 'maintenance' | 'closed';
  type: 'indoor' | 'outdoor' | 'isolation' | 'quarantine';
  size_category: 'small' | 'medium' | 'large' | 'xlarge';
  capacity: number;
  capacity_rules?: { by_species?: Record<string, number> };
  primary_photo_path?: string;
  occupied_count: number;
  animals_preview: KennelAnimal[];
  alerts: string[];
}

export interface KennelAnimal {
  id: string;
  name: string;
  photo_url?: string | null;
  species: string;
}

export interface MoveAnimalRequest {
  animal_id: string;
  target_kennel_id?: string | null;
  reason?: string;
  notes?: string | null;
  allow_overflow?: boolean;
}

export interface KennelStay {
  id: string;
  animal_id: string;
  animal_name: string;
  animal_species: string;
  start_at: string;
  end_at?: string | null;
  reason?: string | null;
  notes?: string | null;
  moved_by?: string | null;
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
    
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${token}`,
    };
    
    // Add organization ID if available
    const orgId = this.getOrganizationId();
    if (orgId) {
      headers['x-organization-id'] = orgId;
    }
    
    return headers;
  }

  /**
   * Generic GET request
   */
  static async get<T = any>(endpoint: string, params?: Record<string, any>): Promise<T> {
    try {
      const response = await axios.get<T>(`${API_URL}${endpoint}`, {
        params,
        headers: this.getAuthHeaders(),
      });
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError<ApiError>;
        throw new Error(
          axiosError.response?.data?.detail || `Failed to fetch ${endpoint}`
        );
      }
      throw new Error('An unexpected error occurred');
    }
  }

  /**
   * Generic POST request
   */
  static async post<T = any>(endpoint: string, data?: any): Promise<T> {
    try {
      const response = await axios.post<T>(`${API_URL}${endpoint}`, data, {
        headers: {
          ...this.getAuthHeaders(),
          'Content-Type': 'application/json',
        },
      });
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError<ApiError>;
        throw new Error(
          axiosError.response?.data?.detail || `Failed to post to ${endpoint}`
        );
      }
      throw new Error('An unexpected error occurred');
    }
  }

  /**
   * Generic PUT request
   */
  static async put<T = any>(endpoint: string, data?: any): Promise<T> {
    try {
      const response = await axios.put<T>(`${API_URL}${endpoint}`, data, {
        headers: {
          ...this.getAuthHeaders(),
          'Content-Type': 'application/json',
        },
      });
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError<ApiError>;
        throw new Error(
          axiosError.response?.data?.detail || `Failed to update ${endpoint}`
        );
      }
      throw new Error('An unexpected error occurred');
    }
  }

  /**
   * Generic PATCH request
   */
  static async patch<T = any>(endpoint: string, data?: any): Promise<T> {
    try {
      const response = await axios.patch<T>(`${API_URL}${endpoint}`, data, {
        headers: {
          ...this.getAuthHeaders(),
          'Content-Type': 'application/json',
        },
      });
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError<ApiError>;
        throw new Error(
          axiosError.response?.data?.detail || `Failed to patch ${endpoint}`
        );
      }
      throw new Error('An unexpected error occurred');
    }
  }

  /**
   * Generic DELETE request
   */
  static async delete<T = any>(endpoint: string): Promise<T> {
    try {
      const response = await axios.delete<T>(`${API_URL}${endpoint}`, {
        headers: this.getAuthHeaders(),
      });
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError<ApiError>;
        throw new Error(
          axiosError.response?.data?.detail || `Failed to delete ${endpoint}`
        );
      }
      throw new Error('An unexpected error occurred');
    }
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
   * Helper to get organization ID from selectedOrg in localStorage
   */
  private static getOrganizationId(): string | null {
    const selectedOrgData = typeof window !== 'undefined'
      ? localStorage.getItem('selectedOrg')
      : null;

    console.log('[API] getOrganizationId - selectedOrgData:', selectedOrgData);

    if (!selectedOrgData) {
      console.log('[API] getOrganizationId - NO selectedOrg in localStorage!');
      return null;
    }

    try {
      const parsed = JSON.parse(selectedOrgData);
      console.log('[API] getOrganizationId - parsed:', parsed);
      console.log('[API] getOrganizationId - returning id:', parsed.id);
      return parsed.id;
    } catch (e) {
      console.error('[API] getOrganizationId - parse error:', e);
      return null;
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
   * Select organization and get new token with org context
   */
  static async selectOrganization(organizationId: string): Promise<LoginResponse> {
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
      const response = await axios.post<LoginResponse>(
        `${API_URL}/auth/select-organization`,
        {},
        {
          params: { organization_id: organizationId },
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError<ApiError>;
        throw new Error(
          axiosError.response?.data?.detail || 'Failed to select organization'
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
  static async getKennels(params?: {
    zone_id?: string;
    status?: string;
    type?: string;
    size_category?: string;
    q?: string;
  }): Promise<Kennel[]> {
    try {
      // Get current organization from localStorage
      const organizationId = this.getOrganizationId();
      
      if (!organizationId) {
        throw new Error('No organization selected. Please select an organization first.');
      }

      const searchParams = new URLSearchParams();
      if (params?.zone_id) searchParams.append('zone_id', params.zone_id);
      if (params?.status) searchParams.append('status', params.status);
      if (params?.type) searchParams.append('type', params.type);
      if (params?.size_category) searchParams.append('size_category', params.size_category);
      if (params?.q) searchParams.append('q', params.q);
      
      const url = `${API_URL}/kennels${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;
      
      const response = await axios.get<Kennel[]>(
        url,
        {
          headers: {
            ...this.getAuthHeaders(),
            'x-organization-id': organizationId,
          },
        }
      );
      return response.data;
    } catch (error) {
      console.error('getKennels error:', error);
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError<ApiError>;
        console.error('getKennels axios error:', {
          status: axiosError.response?.status,
          data: axiosError.response?.data,
          detail: axiosError.response?.data?.detail
        });
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
  static async getKennel(id: string): Promise<Kennel> {
    try {
      const organizationId = this.getOrganizationId();
      
      const response = await axios.get<Kennel>(
        `${API_URL}/kennels/${id}`,
        {
          headers: {
            ...this.getAuthHeaders(),
            'x-organization-id': organizationId || '',
          },
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
  static async moveAnimal(request: MoveAnimalRequest): Promise<any> {
    try {
      const organizationId = this.getOrganizationId();
      
      const response = await axios.post<any>(
        `${API_URL}/stays/move`,
        request,
        {
          headers: {
            ...this.getAuthHeaders(),
            'x-organization-id': organizationId || '',
            'Content-Type': 'application/json',
          },
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
   * Get kennel stays (history)
   * M4+: Kennels Management
   */
  static async getKennelStays(kennelId: string, activeOnly: boolean = false): Promise<KennelStay[]> {
    try {
      const organizationId = typeof window !== 'undefined' 
        ? localStorage.getItem('currentOrganizationId') 
        : null;
      
      const params = new URLSearchParams();
      if (activeOnly) params.append('active_only', 'true');
      
      const url = `${API_URL}/stays/${kennelId}/stays${params.toString() ? `?${params.toString()}` : ''}`;
      
      const response = await axios.get<KennelStay[]>(
        url,
        {
          headers: {
            ...this.getAuthHeaders(),
            'x-organization-id': organizationId || '',
          },
        }
      );
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError<ApiError>;
        throw new Error(
          axiosError.response?.data?.detail || 'Failed to fetch kennel stays'
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
      // Get current organization from localStorage
      const organizationId = this.getOrganizationId();

      if (!organizationId) {
        throw new Error('No organization selected. Please select an organization first.');
      }

      const response = await axios.get<{ items: Animal[], total: number, page: number, page_size: number }>(
        `${API_URL}/animals`,
        {
          headers: {
            ...this.getAuthHeaders(),
            'x-organization-id': organizationId,
          },
        }
      );
      return response.data.items;
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
      const organizationId = this.getOrganizationId();

      const response = await axios.get<Animal>(
        `${API_URL}/animals/${id}`,
        {
          headers: {
            ...this.getAuthHeaders(),
            'x-organization-id': organizationId || '',
          },
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
      console.log('[API] createAnimal - starting');
      const organizationId = this.getOrganizationId();
      console.log('[API] createAnimal - organizationId:', organizationId);

      if (!organizationId) {
        console.error('[API] createAnimal - NO ORGANIZATION ID!');
        throw new Error('No organization selected. Please select an organization first.');
      }

      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'x-organization-id': organizationId,
      };

      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      console.log('[API] createAnimal - headers:', headers);
      console.log('[API] createAnimal - making POST request to:', `${API_URL}/animals`);

      // Use fetch instead of axios
      const response = await fetch(`${API_URL}/animals`, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(data),
      });

      console.log('[API] createAnimal - response status:', response.status);

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to create animal' }));
        throw new Error(error.detail || 'Failed to create animal');
      }

      const result = await response.json();
      console.log('[API] createAnimal - success:', result);
      return result;
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
      const organizationId = this.getOrganizationId();

      const response = await axios.put<Animal>(
        `${API_URL}/animals/${id}`,
        data,
        {
          headers: {
            ...this.getAuthHeaders(),
            'x-organization-id': organizationId || '',
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
      const organizationId = this.getOrganizationId();

      await axios.delete(
        `${API_URL}/animals/${id}`,
        {
          headers: {
            ...this.getAuthHeaders(),
            'x-organization-id': organizationId || '',
          },
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

  // ========================================
  // TASK METHODS
  // ========================================

  /**
   * Get all tasks for organization with filters
   */
  static async getTasks(params?: {
    status?: string;
    type?: string;
    assigned_to_id?: string;
    due_date?: string;
    page?: number;
    page_size?: number;
  }): Promise<TaskListResponse> {
    try {
      const organizationId = this.getOrganizationId();

      const response = await axios.get<TaskListResponse>(
        `${API_URL}/tasks`,
        {
          params,
          headers: {
            ...this.getAuthHeaders(),
            'x-organization-id': organizationId || '',
          },
        }
      );
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError<ApiError>;
        throw new Error(
          axiosError.response?.data?.detail || 'Failed to fetch tasks'
        );
      }
      throw new Error('An unexpected error occurred');
    }
  }

  /**
   * Get single task by ID
   */
  static async getTask(id: string): Promise<Task> {
    try {
      const organizationId = this.getOrganizationId();

      const response = await axios.get<Task>(
        `${API_URL}/tasks/${id}`,
        {
          headers: {
            ...this.getAuthHeaders(),
            'x-organization-id': organizationId || '',
          },
        }
      );
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError<ApiError>;
        throw new Error(
          axiosError.response?.data?.detail || 'Failed to fetch task'
        );
      }
      throw new Error('An unexpected error occurred');
    }
  }

  /**
   * Create new task
   */
  static async createTask(data: CreateTaskRequest): Promise<Task> {
    try {
      const organizationId = this.getOrganizationId();

      const response = await axios.post<Task>(
        `${API_URL}/tasks`,
        data,
        {
          headers: {
            ...this.getAuthHeaders(),
            'x-organization-id': organizationId || '',
            'Content-Type': 'application/json',
          },
        }
      );
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError<ApiError>;
        throw new Error(
          axiosError.response?.data?.detail || 'Failed to create task'
        );
      }
      throw new Error('An unexpected error occurred');
    }
  }

  /**
   * Complete a task
   */
  static async completeTask(id: string, data?: { notes?: string; completion_data?: any }): Promise<Task> {
    try {
      const organizationId = this.getOrganizationId();

      const response = await axios.post<Task>(
        `${API_URL}/tasks/${id}/complete`,
        data || {},
        {
          headers: {
            ...this.getAuthHeaders(),
            'x-organization-id': organizationId || '',
            'Content-Type': 'application/json',
          },
        }
      );
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError<ApiError>;
        throw new Error(
          axiosError.response?.data?.detail || 'Failed to complete task'
        );
      }
      throw new Error('An unexpected error occurred');
    }
  }

  /**
   * Complete a feeding task (special endpoint)
   */
  static async completeFeedingTask(taskId: string, notes?: string): Promise<any> {
    try {
      const organizationId = this.getOrganizationId();

      const response = await axios.post(
        `${API_URL}/feeding/tasks/${taskId}/complete`,
        { notes },
        {
          headers: {
            ...this.getAuthHeaders(),
            'x-organization-id': organizationId || '',
            'Content-Type': 'application/json',
          },
        }
      );
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError<ApiError>;
        throw new Error(
          axiosError.response?.data?.detail || 'Failed to complete feeding task'
        );
      }
      throw new Error('An unexpected error occurred');
    }
  }

  /**
   * Update task
   */
  static async updateTask(id: string, data: Partial<CreateTaskRequest>): Promise<Task> {
    try {
      const organizationId = this.getOrganizationId();

      const response = await axios.put<Task>(
        `${API_URL}/tasks/${id}`,
        data,
        {
          headers: {
            ...this.getAuthHeaders(),
            'x-organization-id': organizationId || '',
            'Content-Type': 'application/json',
          },
        }
      );
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError<ApiError>;
        throw new Error(
          axiosError.response?.data?.detail || 'Failed to update task'
        );
      }
      throw new Error('An unexpected error occurred');
    }
  }

  /**
   * Cancel task
   */
  static async cancelTask(id: string, reason?: string): Promise<void> {
    try {
      const organizationId = this.getOrganizationId();

      await axios.delete(
        `${API_URL}/tasks/${id}`,
        {
          params: { reason },
          headers: {
            ...this.getAuthHeaders(),
            'x-organization-id': organizationId || '',
          },
        }
      );
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError<ApiError>;
        throw new Error(
          axiosError.response?.data?.detail || 'Failed to cancel task'
        );
      }
      throw new Error('An unexpected error occurred');
    }
  }
}

export { ApiClient };
export default ApiClient;
