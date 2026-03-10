// SSoT: Permission level constants for section-level permissions
// Matches backend PermissionSection::LEVELS

export const PERMISSION_LEVELS = {
  NO_ACCESS: 0,
  VIEW_OWN: 1,
  VIEW_ALL: 2,
  EDIT: 3,
  FULL: 4,
} as const;

export type PermissionLevel =
  (typeof PERMISSION_LEVELS)[keyof typeof PERMISSION_LEVELS];

export const PERMISSION_LEVEL_LABELS: Record<PermissionLevel, string> = {
  [PERMISSION_LEVELS.NO_ACCESS]: "No Access",
  [PERMISSION_LEVELS.VIEW_OWN]: "View Own",
  [PERMISSION_LEVELS.VIEW_ALL]: "View All",
  [PERMISSION_LEVELS.EDIT]: "Edit",
  [PERMISSION_LEVELS.FULL]: "Full",
};

export const PERMISSION_LEVEL_DESCRIPTIONS: Record<PermissionLevel, string> = {
  [PERMISSION_LEVELS.NO_ACCESS]: "Cannot access this feature",
  [PERMISSION_LEVELS.VIEW_OWN]: "Can view records they own or are assigned to",
  [PERMISSION_LEVELS.VIEW_ALL]: "Can view all records",
  [PERMISSION_LEVELS.EDIT]: "Can view and edit records",
  [PERMISSION_LEVELS.FULL]: "Full access including delete and admin actions",
};

// All possible levels for the matrix header
export const ALL_LEVELS: PermissionLevel[] = [0, 1, 2, 3, 4];

// Permission section interface matching backend API response
export interface PermissionSectionData {
  key: string;
  section: string;
  subFeature: string | null;
  displayName: string;
  description: string;
  position: number;
  isSectionHeader: boolean;
  availableLevels: PermissionLevel[];
}

// Grouped sections for UI display
export interface PermissionSectionGroup {
  header: PermissionSectionData;
  subFeatures: PermissionSectionData[];
}
