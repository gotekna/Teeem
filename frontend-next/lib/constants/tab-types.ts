// SSoT: Tab Type System for Warehouse Folders (Feb 2026)
// THE ONE field for folder behavior - replaces is_photo_category, is_cad_category, is_mailbox booleans

export const TAB_TYPES = {
  SYSTEM: 'system',
  DOCUMENT: 'document',
  MAILBOX: 'mailbox',
  REVIT: 'revit',
  PHOTO: 'photo',
} as const;

export type TabType = (typeof TAB_TYPES)[keyof typeof TAB_TYPES];

export interface TabTypeConfig {
  label: string;
  shortLabel: string; // 3-char abbreviation for compact badges
  icon: string; // Lucide icon name
  color: string; // Badge bg color (Tailwind)
  darkColor: string; // Dark mode badge color
  textColor: string; // Badge text color
  description: string;
}

export const TAB_TYPE_CONFIG: Record<TabType, TabTypeConfig> = {
  system: {
    label: 'System',
    shortLabel: 'SYS',
    icon: 'Settings',
    color: 'bg-purple-100',
    darkColor: 'dark:bg-purple-900/30',
    textColor: 'text-purple-700 dark:text-purple-300',
    description: 'Navigation or data tab',
  },
  document: {
    label: 'Document',
    shortLabel: 'DOC',
    icon: 'FolderArchive',
    color: 'bg-blue-100',
    darkColor: 'dark:bg-blue-900/30',
    textColor: 'text-blue-700 dark:text-blue-300',
    description: 'File upload and storage',
  },
  mailbox: {
    label: 'Mailbox',
    shortLabel: 'MBX',
    icon: 'Mail',
    color: 'bg-green-100',
    darkColor: 'dark:bg-green-900/30',
    textColor: 'text-green-700 dark:text-green-300',
    description: 'Synced email mailbox',
  },
  revit: {
    label: 'Revit',
    shortLabel: 'CAD',
    icon: 'PenTool',
    color: 'bg-orange-100',
    darkColor: 'dark:bg-orange-900/30',
    textColor: 'text-orange-700 dark:text-orange-300',
    description: 'CAD files with local sync',
  },
  photo: {
    label: 'Photo',
    shortLabel: 'PHO',
    icon: 'Camera',
    color: 'bg-pink-100',
    darkColor: 'dark:bg-pink-900/30',
    textColor: 'text-pink-700 dark:text-pink-300',
    description: 'Photo gallery view',
  },
};

// All tab type values as an array (for selectors)
export const TAB_TYPE_VALUES = Object.values(TAB_TYPES);

// Helper to derive tab_type from legacy boolean fields (for backward compatibility)
export function deriveTabType(folder: {
  is_mailbox?: boolean;
  is_photo_category?: boolean;
  is_cad_category?: boolean;
  tab_group?: string | null;
  tab_type?: string;
}): TabType {
  // Prefer explicit tab_type if set
  if (folder.tab_type && TAB_TYPE_VALUES.includes(folder.tab_type as TabType)) {
    return folder.tab_type as TabType;
  }
  // Fallback to legacy booleans
  if (folder.is_mailbox) return 'mailbox';
  if (folder.is_photo_category) return 'photo';
  if (folder.is_cad_category) return 'revit';
  if (folder.tab_group === 'documents') return 'document';
  return 'system';
}

// Auto-derive tab_group from tab_type (system → 'data', everything else → 'documents')
export function tabGroupFromTabType(tabType: TabType): 'data' | 'documents' {
  return tabType === 'system' ? 'data' : 'documents';
}
