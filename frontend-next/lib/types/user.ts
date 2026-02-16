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
  job_title?: string;
  mobile_phone?: string;
  preferred_theme?: string;
  force_password_change?: boolean;
  created_at?: string;
  updated_at?: string;
  // Computed fields (API may split name into first_name/last_name)
  first_name?: string;
  last_name?: string;
  full_name?: string; // Alias for name in some contexts
  display_name?: string; // Alias for name in some contexts
  photo_url?: string; // Alias for avatar_url
  assigned_role?: string; // Legacy field
  last_login_at?: string;
  last_seen_at?: string;
  last_email_sync_at?: string;
  presence_status?: 'online' | 'away' | 'offline';
  integrations?: string[];
  integrations_count?: number;
  status?: string;
  role_ids?: Array<{ id: number; display_value: string; name: string }>;
  // Contact relationship (for UserDetailSheet)
  contact_id?: number | null;
  contact?: { id: number; display_name?: string; first_name?: string; last_name?: string } | null;
  // Primary role (Jan 2026)
  primary_role_id?: number | null;
  // Email signature style (Jan 2026)
  email_signature_style?: string;
  // QBCC and signature fields (profile page)
  qbcc_licence_number?: string;
  qbcc_licence_class?: string;
  signature_url?: string | null;
  can_sign_certificates?: boolean;
  // AI writing assistant preference
  enable_ai_writing_assistant?: boolean;
  [key: string]: unknown; // Allow additional properties from API
}
