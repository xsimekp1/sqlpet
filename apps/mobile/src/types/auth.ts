export interface User {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  is_superadmin: boolean;
  created_at: string;
}

export interface MembershipInfo {
  id: string;
  organization_id: string;
  organization_name: string;
  role_name: string | null;
  status: string;
}

export interface CurrentUserResponse {
  user: User;
  memberships: MembershipInfo[];
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
}

export interface LoginRequest {
  email: string;
  password: string;
}
