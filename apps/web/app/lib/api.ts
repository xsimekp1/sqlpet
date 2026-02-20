import axios, { AxiosError } from 'axios';

const _rawApiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
const API_URL = _rawApiUrl.replace(/^http:\/\/([^/]+)/, (_, host) =>
  host.includes('localhost') ? _rawApiUrl : `https://${host}`
);

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
  created_by_name: string | null;
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
  linked_inventory_item_id: string | null;
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
  linked_inventory_item_id?: string;
}

export interface TaskListResponse {
  items: Task[];
  total: number;
  page: number;
  page_size: number;
}

// Animal types
export interface AnimalBreed {
  breed_id: string;
  breed_name: string;
  breed_species: string;
  percent: number | null;
  display_name?: string;  // Localized name
}

export interface AnimalIdentifier {
  id: string;
  type: 'microchip' | 'tattoo' | 'tag' | 'passport' | 'other';
  value: string;
}

export interface Animal {
  id: string;
  organization_id: string;
  public_code: string;
  name: string;
  species: 'dog' | 'cat' | 'rabbit' | 'bird' | 'other';
  sex: 'male' | 'female' | 'unknown';
  altered_status: 'intact' | 'neutered' | 'spayed' | 'unknown';
  color: string | null;
  estimated_age_years: number | null;
  current_intake_date: string | null;
  status: 'intake' | 'available' | 'reserved' | 'adopted' | 'fostered' | 'returned' | 'deceased' | 'transferred' | 'hold' | 'quarantine' | 'returned_to_owner' | 'euthanized' | 'escaped';
  primary_photo_url: string | null;
  thumbnail_url: string | null;
  default_image_url: string | null;
  current_kennel_id: string | null;
  current_kennel_name: string | null;
  current_kennel_code: string | null;
  last_walked_at: string | null;
  is_dewormed: boolean;
  is_aggressive: boolean;
  is_pregnant: boolean;
  is_lactating: boolean;
  is_critical: boolean;
  is_diabetic: boolean;
  is_cancer: boolean;
  intake_date: string | null;
  bcs: number | null;
  expected_litter_date: string | null;
  behavior_notes: string | null;
  is_special_needs: boolean;
  weight_current_kg: number | null;
  mer_kcal_per_day: number | null;
  weight_estimated_kg: number | null;
  age_group: 'baby' | 'young' | 'adult' | 'senior' | 'unknown';
  breeds?: AnimalBreed[];
  tags?: { id: string; name: string; color?: string }[];
  identifiers?: AnimalIdentifier[];
  created_at: string;
  updated_at: string;
}

export interface WeightLog {
  id: string;
  animal_id: string;
  weight_kg: number;
  measured_at: string;
  notes?: string | null;
  created_at: string;
}

export interface BCSLog {
  id: string;
  animal_id: string;
  bcs: number;
  measured_at: string;
  notes?: string | null;
  created_at: string;
}

// MER / RER calculation types
export interface MERFactor {
  value: number;
  label: string;
}

export interface MERFoodRecommendation {
  food_id: string | null;
  kcal_per_100g: number;
  amount_g_per_day: number;
  meals_per_day: number;
  amount_g_per_meal: number;
}

export interface MERCalculation {
  weight_kg: number;
  rer: number;
  factors: {
    activity: MERFactor;
    bcs?: MERFactor;
    age: MERFactor;
    health: MERFactor;
    environment: MERFactor;
    breed_size: MERFactor;
    weight_goal: MERFactor;
  };
  mer_total_factor: number;
  mer_kcal: number;
  food_recommendation?: MERFoodRecommendation;
  calculated_at: string;
}

export interface MERCalculateRequest {
  animal_id: string;
  health_modifier?: string;
  environment?: string;
  weight_goal?: string;
  food_id?: string;
  food_kcal_per_100g?: number;
  meals_per_day?: number;
}

export interface CreateAnimalRequest {
  name: string;
  species: 'dog' | 'cat' | 'rabbit' | 'bird' | 'other';
  sex: 'male' | 'female' | 'unknown';
  color?: string | null;
  status?: string;
}

// Walk types
export interface WalkAnimal {
  id: string;
  name: string;
  public_code: string;
}

export interface Walk {
  id: string;
  organization_id: string;
  animal_ids: string[];
  walk_type: string;
  status: string;
  started_at: string;
  ended_at: string | null;
  duration_minutes: number | null;
  distance_km: number | null;
  notes: string | null;
  started_by_id: string | null;
  ended_by_id: string | null;
  animals?: WalkAnimal[];
}

export interface WalkListResponse {
  items: Walk[];
  total: number;
  page: number;
  page_size: number;
}

export interface CreateWalkRequest {
  animal_ids: string[];
  walk_type: string;
  started_at?: string;
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
  allowed_species?: string[] | null;
  dimensions?: { length?: number; width?: number; height?: number } | null;
  primary_photo_path?: string;
  notes?: string | null;
  occupied_count: number;
  animals_preview: KennelAnimal[];
  alerts: string[];
  last_cleaned_at?: string | null;
  map_x: number;
  map_y: number;
  map_w: number;
  map_h: number;
  maintenance_start_at?: string | null;
  maintenance_end_at?: string | null;
  maintenance_reason?: string | null;
}

export interface KennelAnimal {
  id: string;
  name: string;
  public_code?: string | null;
  photo_url?: string | null;
  species: string;
  is_aggressive?: boolean;
  sex?: string;
  altered_status?: string;
  start_at?: string | null;
}

export interface KennelZone {
  id: string;
  name: string;
  code: string;
}

export interface CreateKennelRequest {
  name: string;
  zone_id: string;
  type: 'indoor' | 'outdoor' | 'isolation' | 'quarantine';
  size_category: 'small' | 'medium' | 'large' | 'xlarge';
  capacity: number;
  allowed_species?: string[] | null;
  notes?: string | null;
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
  animal_public_code?: string | null;
  start_at: string;
  end_at?: string | null;
  reason?: string | null;
  notes?: string | null;
  moved_by?: string | null;
}

export interface UpcomingOutcome {
  id: string;
  animal_id: string;
  animal_name: string;
  animal_species: string;
  animal_photo_url?: string | null;
  animal_public_code?: string | null;
  planned_outcome_date: string | null;
  planned_person_id?: string | null;
  planned_person_name?: string | null;
  reason?: string | null;
  intake_date?: string | null;
}

export interface KennelTimelineStay {
  id: string;
  animal_id: string;
  animal_name: string;
  animal_species: string;
  animal_public_code?: string | null;
  animal_photo_url?: string | null;
  start_at: string;
  end_at?: string | null;
  reason?: string | null;
  notes?: string | null;
  is_hotel: boolean;
  lane?: number;
  has_conflict?: boolean;
  conflicting_with_id?: string | null;
}

export interface KennelTimelineKennel {
  kennel_id: string;
  kennel_name: string;
  kennel_code: string;
  capacity: number;
  allowed_species?: string | null;
  zone_id?: string | null;
  zone_name?: string | null;
  zone_color?: string | null;
  stays: KennelTimelineStay[];
  maintenance_start_at?: string | null;
  maintenance_end_at?: string | null;
  maintenance_reason?: string | null;
}

export interface KennelTimelineData {
  from_date: string;
  to_date: string;
  kennels: KennelTimelineKennel[];
}

class ApiClient {
  /**
   * Get authorization headers with Bearer token + organization ID from localStorage.
   * This is the single source of truth for auth headers — do not duplicate org ID handling in individual methods.
   */
  private static getAuthHeaders(): Record<string, string> {
    if (typeof window === 'undefined') return {};

    const token = localStorage.getItem('token');
    if (!token) return {};

    const headers: Record<string, string> = {
      'Authorization': `Bearer ${token}`,
    };

    const orgId = this.getOrganizationId();
    if (orgId) {
      headers['x-organization-id'] = orgId;
    }

    return headers;
  }

  /**
   * Read organization ID from localStorage (no logging).
   */
  private static getOrganizationId(): string | null {
    if (typeof window === 'undefined') return null;
    const raw = localStorage.getItem('selectedOrg');
    if (!raw) return null;
    try {
      return JSON.parse(raw).id ?? null;
    } catch {
      return null;
    }
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
  static async post<T = any>(endpoint: string, data?: any, options?: { headers?: Record<string, string> }): Promise<T> {
    try {
      const headers = {
        ...this.getAuthHeaders(),
        ...options?.headers,
      };
      if (!(data instanceof FormData)) {
        headers['Content-Type'] = 'application/json';
      }

      const response = await axios.post<T>(`${API_URL}${endpoint}`, data, {
        headers,
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

  static async login(email: string, password: string): Promise<LoginResponse> {
    try {
      const response = await axios.post<LoginResponse>(
        `${API_URL}/auth/login`,
        { email, password },
        { headers: { 'Content-Type': 'application/json' } }
      );
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError<ApiError>;
        throw new Error(axiosError.response?.data?.detail || 'Login failed');
      }
      throw new Error('An unexpected error occurred');
    }
  }

  static async refreshToken(refreshToken: string): Promise<LoginResponse> {
    try {
      const response = await axios.post<LoginResponse>(
        `${API_URL}/auth/refresh`,
        { refresh_token: refreshToken },
        { headers: { 'Content-Type': 'application/json' } }
      );
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError<ApiError>;
        throw new Error(axiosError.response?.data?.detail || 'Token refresh failed');
      }
      throw new Error('An unexpected error occurred');
    }
  }

  static async getUserProfile(): Promise<UserProfile> {
    try {
      const response = await axios.get<UserProfile>(
        `${API_URL}/auth/me`,
        { headers: this.getAuthHeaders() }
      );
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError<ApiError>;
        throw new Error(axiosError.response?.data?.detail || 'Failed to fetch user profile');
      }
      throw new Error('An unexpected error occurred');
    }
  }

  static async selectOrganization(organizationId: string): Promise<LoginResponse> {
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
      const response = await axios.post<LoginResponse>(
        `${API_URL}/auth/select-organization`,
        {},
        {
          params: { organization_id: organizationId },
          headers: { 'Authorization': `Bearer ${token}` },
        }
      );
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError<ApiError>;
        throw new Error(axiosError.response?.data?.detail || 'Failed to select organization');
      }
      throw new Error('An unexpected error occurred');
    }
  }

  static async logout(): Promise<void> {
    try {
      await axios.post(`${API_URL}/auth/logout`, {}, { headers: this.getAuthHeaders() });
    } catch (error) {
      console.error('Logout error:', error);
    }
  }

  // ========================================
  // KENNELS
  // ========================================

  static async getKennels(params?: {
    zone_id?: string;
    status?: string;
    type?: string;
    size_category?: string;
    q?: string;
  }): Promise<Kennel[]> {
    if (!this.getOrganizationId()) {
      throw new Error('No organization selected. Please select an organization first.');
    }
    try {
      const searchParams = new URLSearchParams();
      if (params?.zone_id) searchParams.append('zone_id', params.zone_id);
      if (params?.status) searchParams.append('status', params.status);
      if (params?.type) searchParams.append('type', params.type);
      if (params?.size_category) searchParams.append('size_category', params.size_category);
      if (params?.q) searchParams.append('q', params.q);
      const url = `${API_URL}/kennels${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;
      const response = await axios.get<Kennel[]>(url, { headers: this.getAuthHeaders() });
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError<ApiError>;
        throw new Error(axiosError.response?.data?.detail || 'Failed to fetch kennels');
      }
      throw new Error('An unexpected error occurred');
    }
  }

  static async getZones(): Promise<KennelZone[]> {
    const response = await axios.get<KennelZone[]>(
      `${API_URL}/kennels/zones`,
      { headers: this.getAuthHeaders() }
    );
    return response.data;
  }

  static async createKennel(data: CreateKennelRequest): Promise<Kennel> {
    try {
      const response = await axios.post<Kennel>(
        `${API_URL}/kennels`,
        data,
        { headers: { ...this.getAuthHeaders(), 'Content-Type': 'application/json' } }
      );
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError<ApiError>;
        throw new Error(axiosError.response?.data?.detail || 'Failed to create kennel');
      }
      throw new Error('An unexpected error occurred');
    }
  }

  static async getKennel(id: string): Promise<Kennel> {
    try {
      const response = await axios.get<Kennel>(
        `${API_URL}/kennels/${id}`,
        { headers: this.getAuthHeaders() }
      );
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError<ApiError>;
        throw new Error(axiosError.response?.data?.detail || 'Failed to fetch kennel');
      }
      throw new Error('An unexpected error occurred');
    }
  }

  static async updateKennel(
    id: string,
    data: Partial<CreateKennelRequest> & {
      status?: string;
      allowed_species?: string[] | null;
      dimensions?: { length?: number; width?: number; height?: number } | null;
    }
  ): Promise<Kennel> {
    try {
      const response = await axios.patch<Kennel>(
        `${API_URL}/kennels/${id}`,
        data,
        { headers: { ...this.getAuthHeaders(), 'Content-Type': 'application/json' } }
      );
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError<ApiError>;
        throw new Error(axiosError.response?.data?.detail || 'Failed to update kennel');
      }
      throw new Error('An unexpected error occurred');
    }
  }

  static async deleteKennel(id: string): Promise<void> {
    try {
      await axios.delete(`${API_URL}/kennels/${id}`, { headers: this.getAuthHeaders() });
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError<ApiError>;
        throw new Error(axiosError.response?.data?.detail || 'Failed to delete kennel');
      }
      throw new Error('An unexpected error occurred');
    }
  }

  static async updateKennelMapPosition(
    id: string,
    pos: { map_x: number; map_y: number; map_w: number; map_h: number }
  ): Promise<void> {
    try {
      await axios.patch(
        `${API_URL}/kennels/${id}/layout`,
        pos,
        { headers: { ...this.getAuthHeaders(), 'Content-Type': 'application/json' } }
      );
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError<ApiError>;
        throw new Error(axiosError.response?.data?.detail || 'Failed to update kennel map position');
      }
      throw new Error('An unexpected error occurred');
    }
  }

  static async setKennelMaintenance(
    id: string,
    data: { start_at?: string | null; end_at?: string | null; reason?: string | null }
  ): Promise<void> {
    try {
      await axios.patch(
        `${API_URL}/kennels/${id}/maintenance`,
        data,
        { headers: { ...this.getAuthHeaders(), 'Content-Type': 'application/json' } }
      );
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError<ApiError>;
        throw new Error(axiosError.response?.data?.detail || 'Failed to set maintenance');
      }
      throw new Error('An unexpected error occurred');
    }
  }

  static async moveAnimal(request: MoveAnimalRequest): Promise<any> {
    try {
      const response = await axios.post<any>(
        `${API_URL}/stays/move`,
        request,
        { headers: { ...this.getAuthHeaders(), 'Content-Type': 'application/json' } }
      );
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError<ApiError>;
        throw new Error(axiosError.response?.data?.detail || 'Failed to move animal');
      }
      throw new Error('An unexpected error occurred');
    }
  }

  static async getKennelStays(kennelId: string, activeOnly: boolean = false): Promise<KennelStay[]> {
    try {
      const params = new URLSearchParams();
      if (activeOnly) params.append('active_only', 'true');
      const url = `${API_URL}/kennels/${kennelId}/stays${params.toString() ? `?${params.toString()}` : ''}`;
      const response = await axios.get<KennelStay[]>(url, { headers: this.getAuthHeaders() });
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError<ApiError>;
        if (axiosError.response?.status === 404) return [];
        throw new Error(axiosError.response?.data?.detail || 'Failed to fetch kennel stays');
      }
      throw new Error('An unexpected error occurred');
    }
  }

  // Timeline types
  static async getStaysTimeline(params?: { from_date?: string; to_date?: string }): Promise<KennelTimelineData> {
    try {
      const searchParams = new URLSearchParams();
      if (params?.from_date) searchParams.append('from_date', params.from_date);
      if (params?.to_date) searchParams.append('to_date', params.to_date);
      const url = `${API_URL}/stays/timeline${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;
      const response = await axios.get<KennelTimelineData>(url, { headers: this.getAuthHeaders() });
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(error.response?.data?.detail || 'Failed to fetch timeline');
      }
      throw new Error('An unexpected error occurred');
    }
  }

  // ========================================
  // CALENDAR
  // ========================================

  static async getCalendarEvents(year: number, month: number): Promise<{
    intakes: Array<{ date: string; animal_id: string; animal_name: string; animal_photo_url: string | null }>;
    litters: Array<{ date: string; animal_id: string; animal_name: string; animal_photo_url: string | null }>;
    escapes: Array<{ date: string; animal_id: string; animal_name: string; animal_photo_url: string | null }>;
    outcomes: Array<{ date: string; animal_id: string; animal_name: string; animal_photo_url: string | null; outcome_type: string }>;
  }> {
    if (!this.getOrganizationId()) {
      throw new Error('No organization selected');
    }
    try {
      const response = await axios.get(
        `${API_URL}/calendar/events?year=${year}&month=${month}`,
        { headers: this.getAuthHeaders() }
      );
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(error.response?.data?.detail || 'Failed to fetch calendar events');
      }
      throw new Error('An unexpected error occurred');
    }
  }

  // ========================================
  // ANIMALS
  // ========================================

  static async getAnimals(params?: { status?: string; species?: string; search?: string; page_size?: number }): Promise<{ items: Animal[]; total: number }> {
    if (!this.getOrganizationId()) {
      throw new Error('No organization selected. Please select an organization first.');
    }
    try {
      const queryParams = new URLSearchParams();
      if (params?.status) queryParams.append('status', params.status);
      if (params?.species) queryParams.append('species', params.species);
      if (params?.search) queryParams.append('search', params.search);
      if (params?.page_size) queryParams.append('page_size', String(params.page_size));
      const queryString = queryParams.toString() ? `?${queryParams.toString()}` : '';
      const response = await axios.get<{ items: Animal[]; total: number; page: number; page_size: number }>(
        `${API_URL}/animals${queryString}`,
        { headers: this.getAuthHeaders() }
      );
      return { items: response.data.items, total: response.data.total };
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError<ApiError>;
        throw new Error(axiosError.response?.data?.detail || 'Failed to fetch animals');
      }
      throw new Error('An unexpected error occurred');
    }
  }

  static async getAnimal(id: string): Promise<Animal> {
    try {
      const response = await axios.get<Animal>(
        `${API_URL}/animals/${id}`,
        { headers: this.getAuthHeaders() }
      );
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError<ApiError>;
        throw new Error(axiosError.response?.data?.detail || 'Failed to fetch animal');
      }
      throw new Error('An unexpected error occurred');
    }
  }

  static async getAnimalIds(): Promise<string[]> {
    try {
      const response = await axios.get<{ ids: string[] }>(
        `${API_URL}/animals/ids`,
        { headers: this.getAuthHeaders() }
      );
      return response.data.ids || [];
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError<ApiError>;
        throw new Error(axiosError.response?.data?.detail || 'Failed to fetch animal IDs');
      }
      throw new Error('An unexpected error occurred');
    }
  }

  static async getAnimalsLightweightForKennels(): Promise<Animal[]> {
    try {
      const response = await axios.get<Animal[]>(
        `${API_URL}/animals/lightweight-for-kennels`,
        { headers: this.getAuthHeaders() }
      );
      return response.data || [];
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError<ApiError>;
        throw new Error(axiosError.response?.data?.detail || 'Failed to fetch animals for kennels');
      }
      throw new Error('An unexpected error occurred');
    }
  }

  static async createAnimal(data: CreateAnimalRequest): Promise<Animal> {
    const organizationId = this.getOrganizationId();
    if (!organizationId) {
      throw new Error('No organization selected. Please select an organization first.');
    }
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'x-organization-id': organizationId,
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const response = await fetch(`${API_URL}/animals`, {
      method: 'POST',
      headers,
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({ detail: 'Failed to create animal' }));
      throw new Error(err.detail || 'Failed to create animal');
    }
    return response.json();
  }

  static async updateAnimal(id: string, data: Partial<CreateAnimalRequest>): Promise<Animal> {
    try {
      const response = await axios.patch<Animal>(
        `${API_URL}/animals/${id}`,
        data,
        { headers: { ...this.getAuthHeaders(), 'Content-Type': 'application/json' } }
      );
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError<ApiError>;
        throw new Error(axiosError.response?.data?.detail || 'Failed to update animal');
      }
      throw new Error('An unexpected error occurred');
    }
  }

  static async deleteAnimal(id: string): Promise<void> {
    try {
      await axios.delete(`${API_URL}/animals/${id}`, { headers: this.getAuthHeaders() });
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError<ApiError>;
        throw new Error(axiosError.response?.data?.detail || 'Failed to delete animal');
      }
      throw new Error('An unexpected error occurred');
    }
  }

  static async deleteStay(stayId: string): Promise<void> {
    try {
      await axios.delete(`${API_URL}/stays/${stayId}`, { headers: this.getAuthHeaders() });
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError<ApiError>;
        throw new Error(axiosError.response?.data?.detail || 'Failed to delete stay');
      }
      throw new Error('An unexpected error occurred');
    }
  }

  static async markAnimalWalked(id: string): Promise<Animal> {
    try {
      const response = await axios.patch<Animal>(
        `${API_URL}/animals/${id}/walked`,
        {},
        { headers: this.getAuthHeaders() }
      );
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError<ApiError>;
        throw new Error(axiosError.response?.data?.detail || 'Failed to mark animal as walked');
      }
      throw new Error('An unexpected error occurred');
    }
  }

  // ========================================
  // WALKS
  // ========================================

  static async getWalks(params?: { page?: number; page_size?: number; status?: string }): Promise<WalkListResponse> {
    try {
      const queryParams = new URLSearchParams();
      if (params?.page) queryParams.append('page', String(params.page));
      if (params?.page_size) queryParams.append('page_size', String(params.page_size));
      if (params?.status) queryParams.append('status', params.status);
      const queryString = queryParams.toString() ? `?${queryParams.toString()}` : '';
      const response = await axios.get<WalkListResponse>(
        `${API_URL}/walks${queryString}`,
        { headers: this.getAuthHeaders() }
      );
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError<ApiError>;
        throw new Error(axiosError.response?.data?.detail || 'Failed to fetch walks');
      }
      throw new Error('An unexpected error occurred');
    }
  }

  static async getTodayWalks(): Promise<WalkListResponse> {
    try {
      const response = await axios.get<WalkListResponse>(
        `${API_URL}/walks/today`,
        { headers: this.getAuthHeaders() }
      );
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError<ApiError>;
        throw new Error(axiosError.response?.data?.detail || 'Failed to fetch today walks');
      }
      throw new Error('An unexpected error occurred');
    }
  }

  static async createWalk(data: CreateWalkRequest): Promise<Walk> {
    try {
      const response = await axios.post<Walk>(
        `${API_URL}/walks`,
        data,
        { headers: { ...this.getAuthHeaders(), 'Content-Type': 'application/json' } }
      );
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError<ApiError>;
        throw new Error(axiosError.response?.data?.detail || 'Failed to create walk');
      }
      throw new Error('An unexpected error occurred');
    }
  }

  static async completeWalk(walkId: string, distance_km?: number, notes?: string): Promise<Walk> {
    try {
      const params = new URLSearchParams();
      if (distance_km !== undefined) params.append('distance_km', String(distance_km));
      if (notes) params.append('notes', notes);
      const queryString = params.toString() ? `?${params.toString()}` : '';
      const response = await axios.post<Walk>(
        `${API_URL}/walks/${walkId}/complete${queryString}`,
        {},
        { headers: this.getAuthHeaders() }
      );
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError<ApiError>;
        throw new Error(axiosError.response?.data?.detail || 'Failed to complete walk');
      }
      throw new Error('An unexpected error occurred');
    }
  }

  // ========================================
  // BREEDS & COLORS
  // ========================================

  static async getBreeds(species?: string, locale?: string): Promise<Array<{ id: string; name: string; species: string; display_name: string }>> {
    try {
      const params = new URLSearchParams();
      if (species) params.set('species', species);
      if (locale) params.set('locale', locale);
      const queryString = params.toString() ? `?${params.toString()}` : '';
      const response = await axios.get(`${API_URL}/breeds${queryString}`, { headers: this.getAuthHeaders() });
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError<ApiError>;
        throw new Error(axiosError.response?.data?.detail || 'Failed to fetch breeds');
      }
      throw new Error('An unexpected error occurred');
    }
  }

  static async getBreedColorImages(breedId: string): Promise<Array<{ color: string; image_url: string }>> {
    try {
      const response = await axios.get(
        `${API_URL}/breeds/${breedId}/color-images`,
        { headers: this.getAuthHeaders() }
      );
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError<ApiError>;
        throw new Error(axiosError.response?.data?.detail || 'Failed to fetch breed colors');
      }
      throw new Error('An unexpected error occurred');
    }
  }

  static async getAdminColors(): Promise<Array<{ code: string; cs: string | null; en: string | null; used_count: number }>> {
    try {
      const response = await axios.get(`${API_URL}/admin/colors`, { headers: this.getAuthHeaders() });
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError<ApiError>;
        throw new Error(axiosError.response?.data?.detail || 'Failed to fetch colors');
      }
      throw new Error('An unexpected error occurred');
    }
  }

  static async updateColorTranslation(code: string, data: { cs?: string | null; en?: string | null }): Promise<void> {
    try {
      await axios.put(
        `${API_URL}/admin/colors/${encodeURIComponent(code)}/translations`,
        data,
        { headers: { ...this.getAuthHeaders(), 'Content-Type': 'application/json' } }
      );
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError<ApiError>;
        throw new Error(axiosError.response?.data?.detail || 'Failed to update color translation');
      }
      throw new Error('An unexpected error occurred');
    }
  }

  static async createColor(data: { code: string; cs?: string; en?: string }): Promise<{ ok: boolean; code: string }> {
    try {
      const response = await axios.post(
        `${API_URL}/admin/colors`,
        data,
        { headers: { ...this.getAuthHeaders(), 'Content-Type': 'application/json' } }
      );
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError<ApiError>;
        throw new Error(axiosError.response?.data?.detail || 'Failed to create color');
      }
      throw new Error('An unexpected error occurred');
    }
  }

  static async deleteColor(code: string): Promise<void> {
    try {
      await axios.delete(
        `${API_URL}/admin/colors/${encodeURIComponent(code)}`,
        { headers: this.getAuthHeaders() }
      );
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError<ApiError>;
        throw new Error(axiosError.response?.data?.detail || 'Failed to delete color');
      }
      throw new Error('An unexpected error occurred');
    }
  }

  // ========================================
  // TASKS
  // ========================================

  static async getTasks(params?: {
    status?: string;
    type?: string;
    assigned_to_id?: string;
    due_date?: string;
    related_entity_id?: string;
    page?: number;
    page_size?: number;
  }): Promise<TaskListResponse> {
    try {
      const response = await axios.get<TaskListResponse>(
        `${API_URL}/tasks`,
        { params, headers: this.getAuthHeaders() }
      );
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError<ApiError>;
        throw new Error(axiosError.response?.data?.detail || 'Failed to fetch tasks');
      }
      throw new Error('An unexpected error occurred');
    }
  }

  static async getTask(id: string): Promise<Task> {
    try {
      const response = await axios.get<Task>(
        `${API_URL}/tasks/${id}`,
        { headers: this.getAuthHeaders() }
      );
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError<ApiError>;
        throw new Error(axiosError.response?.data?.detail || 'Failed to fetch task');
      }
      throw new Error('An unexpected error occurred');
    }
  }

  static async createTask(data: CreateTaskRequest): Promise<Task> {
    try {
      const response = await axios.post<Task>(
        `${API_URL}/tasks`,
        data,
        { headers: { ...this.getAuthHeaders(), 'Content-Type': 'application/json' } }
      );
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError<ApiError>;
        throw new Error(axiosError.response?.data?.detail || 'Failed to create task');
      }
      throw new Error('An unexpected error occurred');
    }
  }

  static async completeTask(id: string, data?: { notes?: string; completion_data?: any }): Promise<Task> {
    try {
      const response = await axios.post<Task>(
        `${API_URL}/tasks/${id}/complete`,
        data || {},
        { headers: { ...this.getAuthHeaders(), 'Content-Type': 'application/json' } }
      );
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError<ApiError>;
        throw new Error(axiosError.response?.data?.detail || 'Failed to complete task');
      }
      throw new Error('An unexpected error occurred');
    }
  }

  static async completeFeedingTask(taskId: string, notes?: string): Promise<any> {
    try {
      const response = await axios.post(
        `${API_URL}/feeding/tasks/${taskId}/complete`,
        { notes },
        { headers: { ...this.getAuthHeaders(), 'Content-Type': 'application/json' } }
      );
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError<ApiError>;
        throw new Error(axiosError.response?.data?.detail || 'Failed to complete feeding task');
      }
      throw new Error('An unexpected error occurred');
    }
  }

  static async updateTask(id: string, data: Partial<CreateTaskRequest>): Promise<Task> {
    try {
      const response = await axios.put<Task>(
        `${API_URL}/tasks/${id}`,
        data,
        { headers: { ...this.getAuthHeaders(), 'Content-Type': 'application/json' } }
      );
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError<ApiError>;
        throw new Error(axiosError.response?.data?.detail || 'Failed to update task');
      }
      throw new Error('An unexpected error occurred');
    }
  }

  static async cancelTask(id: string, reason?: string): Promise<void> {
    try {
      await axios.delete(
        `${API_URL}/tasks/${id}`,
        { params: { reason }, headers: this.getAuthHeaders() }
      );
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError<ApiError>;
        throw new Error(axiosError.response?.data?.detail || 'Failed to cancel task');
      }
      throw new Error('An unexpected error occurred');
    }
  }

  // ========================================
  // WEIGHT / BCS
  // ========================================

  static async logWeight(animalId: string, weight_kg: number, notes?: string, measured_at?: string): Promise<WeightLog> {
    const body: Record<string, any> = { weight_kg };
    if (notes) body.notes = notes;
    if (measured_at) body.measured_at = measured_at;
    const response = await axios.post<WeightLog>(
      `${API_URL}/animals/${animalId}/weight`,
      body,
      { headers: { ...this.getAuthHeaders(), 'Content-Type': 'application/json' } }
    );
    return response.data;
  }

  static async getWeightHistory(animalId: string): Promise<WeightLog[]> {
    const response = await axios.get<WeightLog[]>(
      `${API_URL}/animals/${animalId}/weight`,
      { headers: this.getAuthHeaders() }
    );
    return response.data;
  }

  static async getAnimalKennelHistory(animalId: string): Promise<{ kennel_code: string; assigned_at: string; released_at: string | null }[]> {
    const response = await axios.get(
      `${API_URL}/animals/${animalId}/kennel-history`,
      { headers: this.getAuthHeaders() }
    );
    return response.data;
  }

  static async registerBirth(animalId: string, litter_count: number, birth_date?: string): Promise<{ created: number; offspring: { id: string; public_code: string; name: string }[] }> {
    const body: Record<string, any> = { litter_count };
    if (birth_date) body.birth_date = birth_date;
    const response = await axios.post(
      `${API_URL}/animals/${animalId}/birth`,
      body,
      { headers: { ...this.getAuthHeaders(), 'Content-Type': 'application/json' } }
    );
    return response.data;
  }

  static async logBCS(animalId: string, bcs: number, notes?: string, measured_at?: string): Promise<BCSLog> {
    const body: Record<string, any> = { bcs };
    if (notes) body.notes = notes;
    if (measured_at) body.measured_at = measured_at;
    const response = await axios.post<BCSLog>(
      `${API_URL}/animals/${animalId}/bcs`,
      body,
      { headers: { ...this.getAuthHeaders(), 'Content-Type': 'application/json' } }
    );
    return response.data;
  }

  static async getBCSHistory(animalId: string): Promise<BCSLog[]> {
    const response = await axios.get<BCSLog[]>(
      `${API_URL}/animals/${animalId}/bcs`,
      { headers: this.getAuthHeaders() }
    );
    return response.data;
  }

  // ========================================
  // MER CALCULATION
  // ========================================

  static async calculateMER(params: MERCalculateRequest): Promise<MERCalculation> {
    const response = await axios.post<MERCalculation>(
      `${API_URL}/feeding/calculate-mer`,
      params,
      { headers: { ...this.getAuthHeaders(), 'Content-Type': 'application/json' } }
    );
    return response.data;
  }

  // ========================================
  // REPORTS
  // ========================================

  static async getAnimalDailyCount(days: number = 90): Promise<{ date: string; count: number }[]> {
    const response = await axios.get<{ date: string; count: number }[]>(
      `${API_URL}/animals/stats/daily-count?days=${days}`,
      { headers: this.getAuthHeaders() }
    );
    return response.data;
  }

  // PERFORMANCE METRICS
  static async getMetricsSummary(hours: number = 24, limit: number = 20): Promise<{
    total_requests: number;
    avg_duration_ms: number;
    avg_queries: number;
    slowest_requests: Array<{
      method: string;
      path: string;
      status_code: number;
      duration_ms: number;
      query_count: number | null;
      created_at: string;
    }>;
    top_endpoints: Array<{
      path: string;
      count: number;
      avg_duration_ms: number;
      avg_queries: number;
    }>;
    requests_by_hour: Array<{ hour: string; count: number }>;
  }> {
    const response = await axios.get(
      `${API_URL}/metrics`,
      { params: { hours, limit }, headers: this.getAuthHeaders() }
    );
    return response.data;
  }

  static async globalSearch(q: string, limit = 5): Promise<SearchResults> {
    const response = await axios.get<SearchResults>(
      `${API_URL}/search`,
      { params: { q, limit }, headers: this.getAuthHeaders() }
    );
    return response.data;
  }

  static async closeIntake(
    intakeId: string,
    data: { outcome: 'adopted' | 'deceased' | 'lost' | 'hotel_end'; notes?: string },
  ): Promise<any> {
    return this.post(`/intakes/${intakeId}/close`, data);
  }

  // Upcoming outcomes types
  static async getUpcomingOutcomes(days: number = 30): Promise<UpcomingOutcome[]> {
    try {
      const response = await axios.get<UpcomingOutcome[]>(
        `${API_URL}/intakes/upcoming-outcomes?days=${days}`,
        { headers: this.getAuthHeaders() }
      );
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(error.response?.data?.detail || 'Failed to fetch upcoming outcomes');
      }
      throw new Error('An unexpected error occurred');
    }
  }

  static async createIncident(data: {
    animal_id: string;
    incident_type: string;
    incident_date: string;
    description?: string;
  }): Promise<any> {
    return this.post('/incidents', data);
  }

  static async getIncidents(params?: { animal_id?: string; incident_type?: string }): Promise<any[]> {
    return this.get('/incidents', params);
  }

  static async uploadAnimalPhoto(animalId: string, file: File): Promise<{ file_url: string; thumbnail_url: string }> {
    const formData = new FormData();
    formData.append('file', file);
    const response = await axios.post<{ file_url: string; thumbnail_url: string }>(
      `${API_URL}/files/animal/${animalId}/upload-primary-photo`,
      formData,
      { headers: { ...this.getAuthHeaders() } }
    );
    return response.data;
  }

  static async getOrganizationInfo(): Promise<{ id: string; name: string; slug: string; timezone: string; logo_url: string | null }> {
    return this.get('/organization/current');
  }

  static async getCurrentOrganization(): Promise<{
    id: string;
    name: string;
    slug: string;
    timezone: string;
    logo_url: string | null;
    hotel_price_per_day: number | null;
    registration_number: string | null;
    address: string | null;
    lat: number | null;
    lng: number | null;
    capacity_dogs: number | null;
    capacity_cats: number | null;
    capacity_rabbits: number | null;
    capacity_small: number | null;
    capacity_birds: number | null;
  }> {
    return this.get('/organization/current');
  }

  static async updateOrganization(data: {
    name?: string;
    registration_number?: string;
    address?: string;
    lat?: number;
    lng?: number;
    capacity_dogs?: number;
    capacity_cats?: number;
    capacity_rabbits?: number;
    capacity_small?: number;
    capacity_birds?: number;
  }): Promise<any> {
    return this.patch('/organization/current', data);
  }

  static async deleteInventoryItem(itemId: string): Promise<void> {
    await ApiClient.delete(`/inventory/items/${itemId}`);
  }

  static async updateInventoryItem(itemId: string, data: {
    name?: string;
    kcal_per_100g?: number;
    reorder_threshold?: number;
    category?: string;
    unit?: string;
  }): Promise<any> {
    const response = await ApiClient.put(`/inventory/items/${itemId}`, data);
    return response;
  }

  static async deleteInventoryLot(lotId: string): Promise<void> {
    await ApiClient.delete(`/inventory/lots/${lotId}`);
  }

  static async createInventoryTransaction(data: {
    item_id: string;
    lot_id?: string;
    reason: 'opening_balance' | 'purchase' | 'donation' | 'consumption' | 'writeoff';
    quantity: number;
    note?: string;
    related_entity_type?: string;
    related_entity_id?: string;
  }): Promise<any> {
    return ApiClient.post('/inventory/transactions', data);
  }

  static async getInventoryTransactions(params?: {
    item_id?: string;
    page?: number;
    page_size?: number;
  }): Promise<any> {
    return ApiClient.get('/inventory/transactions', params);
  }

  static async uploadOrgLogo(file: File): Promise<{ file_url: string }> {
    const formData = new FormData();
    formData.append('file', file);
    const response = await axios.post<{ file_url: string }>(
      `${API_URL}/files/organization/logo`,
      formData,
      { headers: { ...this.getAuthHeaders() } }
    );
    return response.data;
  }

  static async getFindings(params?: {
    page?: number;
    page_size?: number;
    animal_id?: string;
    who_found_id?: string;
    date_from?: string;
    date_to?: string;
    lat?: number;
    lng?: number;
    radius_km?: number;
  }): Promise<FindingListResponse> {
    return ApiClient.get('/findings', params);
  }

  static async getFindingsMapData(): Promise<{
    organization: { lat: number | null; lng: number | null; name: string | null };
    findings: {
      id: string;
      animal_id: string | null;
      animal_name: string | null;
      animal_public_code: string | null;
      species: string | null;
      when_found: string | null;
      where_lat: number | null;
      where_lng: number | null;
      status: 'current' | 'past';
    }[];
  }> {
    return ApiClient.get('/findings/map-data');
  }

  // Registered Shelters (superadmin only)
  static async getRegisteredShelters(region?: string): Promise<{
    id: string;
    registration_number: string;
    name: string;
    address: string;
    region: string;
    activity_type: string | null;
    capacity: string | null;
    lat: number | null;
    lng: number | null;
    registration_date: string | null;
  }[]> {
    const params = region ? `?region=${encodeURIComponent(region)}` : '';
    return ApiClient.get(`/admin/registered-shelters${params}`);
  }

  static async getShelterRegions(): Promise<{ region: string }[]> {
    return ApiClient.get('/admin/registered-shelters/regions');
  }

  static async importRegisteredShelters(file: File): Promise<{
    imported: number;
    skipped?: number;
    errors?: Array<{ row: number; error: string }>;
    total_errors?: number;
  }> {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${API_URL}/admin/registered-shelters/import`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
      throw { response: { data: error } };
    }

    return response.json();
  }

  static async createRegisteredShelter(data: {
    registration_number: string;
    name: string;
    address: string;
    region: string;
    activity_type?: string;
    capacity?: string;
    lat?: number | null;
    lng?: number | null;
    notes?: string;
  }): Promise<any> {
    return ApiClient.post('/admin/registered-shelters', data);
  }

  static async updateShelterNotes(shelterId: string, notes: string): Promise<void> {
    return ApiClient.patch(`/admin/registered-shelters/${shelterId}/notes`, { notes });
  }

  static async getSheltersForMap(): Promise<Array<{
    id: string;
    name: string;
    lat: number;
    lng: number;
  }>> {
    return ApiClient.get('/admin/registered-shelters/map');
  }

  static async getNearbyShelters(
    lat: number,
    lng: number,
    radiusKm: number = 25
  ): Promise<Array<{
    id: string;
    name: string;
    address: string;
    lat: number;
    lng: number;
    distance_km: number;
  }>> {
    return ApiClient.get('/admin/registered-shelters/nearby', {
      lat,
      lng,
      radius_km: radiusKm
    });
  }

  static async searchContacts(q: string): Promise<{ id: string; name: string; email: string | null }[]> {
    const result = await ApiClient.get<SearchResults>('/search', { q, limit: 10 });
    return result.contacts;
  }

  // Vaccinations
  static async createVaccination(data: {
    animal_id: string;
    vaccination_type: string;
    lot_id?: string;
    administered_at: string;
    task_id?: string;
    notes?: string;
  }): Promise<any> {
    return this.post('/vaccinations', data);
  }

  static async getVaccinations(params?: {
    page?: number;
    page_size?: number;
    animal_id?: string;
    vaccination_type?: string;
    lot_id?: string;
    lot_number?: string;
  }): Promise<any> {
    return this.get('/vaccinations', params);
  }

  static async getAvailableLots(vaccinationType?: string): Promise<Array<{ id: string; lot_number: string | null; quantity: number; expires_at: string | null }>> {
    const params = vaccinationType ? { vaccination_type: vaccinationType } : {};
    return this.get('/vaccinations/lots/available', params);
  }
}

// Search types
export interface SearchResults {
  animals: { id: string; name: string; public_code: string; status: string; species: string; primary_photo_url: string | null; thumbnail_url: string | null }[];
  kennels: { id: string; code: string; name: string; status: string; zone_name: string | null }[];
  contacts: { id: string; name: string; email: string | null }[];
  inventory: { id: string; name: string; category: string; unit: string | null }[];
}

export { ApiClient };
export default ApiClient;

// Findings types
export interface Finding {
  id: string;
  organization_id: string;
  who_found_id: string | null;
  where_lat: number | null;
  where_lng: number | null;
  when_found: string;
  notes: string | null;
  animal_id: string | null;
  created_at: string;
  updated_at: string;
  animal_name?: string | null;
  animal_public_code?: string | null;
  who_found_name?: string | null;
}

export interface FindingListResponse {
  items: Finding[];
  total: number;
  page: number;
  page_size: number;
}
