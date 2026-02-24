export interface OrgMember {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  roles: { name: string }[];
  created_at: string;
}

export interface Contact {
  id: string;
  first_name: string | null;
  last_name: string | null;
  type: string;
  email: string | null;
  phone: string | null;
  organization_name: string | null;
}
