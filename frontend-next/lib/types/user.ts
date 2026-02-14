// SSoT: User type definitions
// Import from @/lib/types - NEVER define locally

export interface User {
  id: number;
  name: string;
  email: string;
  role?: string;
  role_id?: number;
  role_names?: string[];
  permissions?: string[];
  avatar_url?: string;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
}
