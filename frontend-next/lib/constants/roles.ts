/**
 * Role and Permission Constants (SSoT)
 *
 * System-wide role names and permission levels used across the application.
 * Backend SSoT: User model (role methods), Role model (database)
 *
 * CRITICAL: These are string constants for TYPE SAFETY only.
 * The actual roles are stored in the `roles` table in the database.
 * Do NOT add new roles here without creating them in the database first.
 */

// =============================================================================
// System User Roles (from User model)
// =============================================================================

/**
 * System-level user roles
 * SSoT: User model role methods, Role model database table
 *
 * Note: Actual available roles come from the database (Role.for_select)
 * These constants are for type safety in the frontend.
 */
export const SYSTEM_ROLES = {
  /** Super admin - TEEEM staff with god-mode access to all tenants */
  SUPER_ADMIN: "super_admin",
  /** Admin - Full system access within tenant */
  ADMIN: "admin",
  /** Product owner - Can create templates, edit schedule, god view */
  PRODUCT_OWNER: "product_owner",
  /** Estimator - Can edit schedule and projects */
  ESTIMATOR: "estimator",
  /** Supervisor - Can view supervisor tasks */
  SUPERVISOR: "supervisor",
  /** Builder - Can view builder tasks */
  BUILDER: "builder",
  /** User - Default role for new users */
  USER: "user",
} as const;

export type SystemRole = typeof SYSTEM_ROLES[keyof typeof SYSTEM_ROLES];

/**
 * Helper to check if a role name is a valid system role
 */
export function isSystemRole(role: string): role is SystemRole {
  return Object.values(SYSTEM_ROLES).includes(role as SystemRole);
}

// =============================================================================
// Notebook Sharing Permission Levels
// =============================================================================

/**
 * Permission levels for notebook sharing
 * SSoT: NotebookShare model
 *
 * These are NOT user roles - they are permission levels for shared notebooks.
 */
export const NOTEBOOK_PERMISSIONS = {
  /** Read-only access to notebook */
  VIEW: "view",
  /** Can edit pages in notebook */
  EDIT: "edit",
  /** Full control over notebook (including sharing) */
  ADMIN: "admin",
} as const;

export type NotebookPermission = typeof NOTEBOOK_PERMISSIONS[keyof typeof NOTEBOOK_PERMISSIONS];

/**
 * Helper to check if a permission is valid for notebooks
 */
export function isNotebookPermission(permission: string): permission is NotebookPermission {
  return Object.values(NOTEBOOK_PERMISSIONS).includes(permission as NotebookPermission);
}

/**
 * UI labels and metadata for notebook permissions
 */
export const NOTEBOOK_PERMISSION_LABELS = {
  [NOTEBOOK_PERMISSIONS.VIEW]: {
    label: "Can view",
    description: "Read-only access",
  },
  [NOTEBOOK_PERMISSIONS.EDIT]: {
    label: "Can edit",
    description: "Can edit pages",
  },
  [NOTEBOOK_PERMISSIONS.ADMIN]: {
    label: "Admin",
    description: "Full control",
  },
} as const;

// =============================================================================
// Plan Email Recipient Types
// =============================================================================

/**
 * Recipient types for emailing plans
 * SSoT: Job plan email system
 *
 * These categorize suggested recipients when emailing plans from a job.
 */
export const PLAN_RECIPIENT_TYPES = {
  /** Client/customer contact */
  CLIENT: "client",
  /** Job supervisor */
  SUPERVISOR: "supervisor",
  /** Contractor/subcontractor */
  CONTRACTOR: "contractor",
  /** Generic contact */
  CONTACT: "contact",
} as const;

export type PlanRecipientType = typeof PLAN_RECIPIENT_TYPES[keyof typeof PLAN_RECIPIENT_TYPES];

/**
 * Helper to check if a type is a valid plan recipient type
 */
export function isPlanRecipientType(type: string): type is PlanRecipientType {
  return Object.values(PLAN_RECIPIENT_TYPES).includes(type as PlanRecipientType);
}

/**
 * UI labels for plan recipient types
 */
export const PLAN_RECIPIENT_TYPE_LABELS = {
  [PLAN_RECIPIENT_TYPES.CLIENT]: "Client",
  [PLAN_RECIPIENT_TYPES.SUPERVISOR]: "Supervisor",
  [PLAN_RECIPIENT_TYPES.CONTRACTOR]: "Contractor",
  [PLAN_RECIPIENT_TYPES.CONTACT]: "Contact",
} as const;

// =============================================================================
// Legacy Role Constants (Deprecated - use SYSTEM_ROLES instead)
// =============================================================================

/**
 * @deprecated Use SYSTEM_ROLES.ADMIN instead
 * Kept for backward compatibility during migration
 */
export const ROLE_ADMIN = SYSTEM_ROLES.ADMIN;

/**
 * @deprecated Use SYSTEM_ROLES.USER instead
 * Kept for backward compatibility during migration
 */
export const ROLE_USER = SYSTEM_ROLES.USER;

/**
 * @deprecated Use SYSTEM_ROLES.PRODUCT_OWNER instead
 * Kept for backward compatibility during migration
 */
export const ROLE_PRODUCT_OWNER = SYSTEM_ROLES.PRODUCT_OWNER;
