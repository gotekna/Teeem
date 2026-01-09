/**
 * Email Folder Utilities
 *
 * SSoT for folder hierarchy building, type inference, and sorting.
 * Used by FolderTree component for email folder display.
 */

export type FolderType =
  | "inbox"
  | "sent"
  | "drafts"
  | "trash"
  | "archive"
  | "junk"
  | "custom";

export interface FolderTreeItem {
  id: string;
  name: string;  // Full path for filtering (e.g., "Inbox/Investments")
  displayName?: string;  // Display name for UI (e.g., "Investments") - uses name if not set
  type: FolderType;
  parentId?: string;
  childFolderCount?: number;
  unreadCount?: number;
  totalItems?: number;
  depth?: number;
}

// System folder names (case-insensitive matching)
const SYSTEM_FOLDER_PATTERNS: Record<FolderType, RegExp> = {
  inbox: /^(inbox|eingang|posteingang)$/i,
  sent: /^(sent|sent items|sent mail|gesendet|gesendete objekte)$/i,
  drafts: /^(drafts|draft|entwürfe)$/i,
  trash: /^(trash|deleted|deleted items|bin|papierkorb|gelöschte objekte)$/i,
  archive: /^(archive|archiv|all mail)$/i,
  junk: /^(junk|spam|junk e-mail|junk mail)$/i,
  custom: /^$/,
};

// System folder sort priority (lower = first)
const FOLDER_TYPE_PRIORITY: Record<FolderType, number> = {
  inbox: 0,
  drafts: 1,
  sent: 2,
  archive: 3,
  junk: 4,
  trash: 5,
  custom: 10,
};

/**
 * Infer folder type from folder name
 */
export function inferFolderType(name: string): FolderType {
  for (const [type, pattern] of Object.entries(SYSTEM_FOLDER_PATTERNS)) {
    if (type !== "custom" && pattern.test(name)) {
      return type as FolderType;
    }
  }
  return "custom";
}

/**
 * Detect IMAP delimiter from folder names
 * Common delimiters: '/', '.', '\'
 */
export function detectDelimiter(folderNames: string[]): string {
  const delimiters = ["/", ".", "\\"];
  const counts: Record<string, number> = {};

  for (const delim of delimiters) {
    counts[delim] = folderNames.filter((name) => name.includes(delim)).length;
  }

  // Return most common delimiter, or '/' as default
  let maxDelim = "/";
  let maxCount = 0;
  for (const [delim, count] of Object.entries(counts)) {
    if (count > maxCount) {
      maxCount = count;
      maxDelim = delim;
    }
  }

  return maxDelim;
}

/**
 * Build hierarchical folder structure from flat list
 *
 * Handles both:
 * - MS365 folders with parentId already set
 * - IMAP folders with delimiter-based names (e.g., "INBOX/Work/Projects")
 */
export function buildFolderHierarchy(
  folders: Array<{
    id: string;
    name: string;
    type?: string;
    parent_id?: string | null;
    parentId?: string | null;
    child_folder_count?: number;
    childFolderCount?: number;
    unread_count?: number;
    unreadCount?: number;
    total_items?: number;
    totalItems?: number;
    depth?: number;
  }>
): FolderTreeItem[] {
  // If folders already have parent_id, use them directly
  const hasHierarchy = folders.some((f) => f.parent_id || f.parentId);

  if (hasHierarchy) {
    return folders.map((f) => {
      // Extract display name: just the last part after "/" (e.g., "Inbox/A - Sales" → "A - Sales")
      const nameParts = f.name.split("/");
      const displayName = nameParts.length > 1 ? nameParts[nameParts.length - 1] : f.name;

      return {
        id: f.id,
        name: f.name,  // Keep full path for filtering
        displayName,   // Show just the folder name
        type: (f.type as FolderType) || inferFolderType(f.name),
        parentId: f.parent_id || f.parentId || undefined,
        childFolderCount: f.child_folder_count ?? f.childFolderCount ?? 0,
        unreadCount: f.unread_count ?? f.unreadCount ?? 0,
        totalItems: f.total_items ?? f.totalItems ?? 0,
        depth: f.depth ?? 0,
      };
    });
  }

  // IMAP folders - infer hierarchy from delimiter
  const delimiter = detectDelimiter(folders.map((f) => f.name));
  const result: FolderTreeItem[] = [];
  const pathToId = new Map<string, string>();

  // First pass: create entries for all folder paths
  for (const folder of folders) {
    const parts = folder.name.split(delimiter);
    let currentPath = "";

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const parentPath = currentPath;
      currentPath = currentPath ? `${currentPath}${delimiter}${part}` : part;

      if (!pathToId.has(currentPath)) {
        const id = folder.name === currentPath ? folder.id : currentPath;
        pathToId.set(currentPath, id);

        result.push({
          id,
          name: part,
          type: inferFolderType(part),
          parentId: parentPath ? pathToId.get(parentPath) : undefined,
          childFolderCount: 0,
          unreadCount:
            folder.name === currentPath
              ? (folder.unread_count ?? folder.unreadCount ?? 0)
              : 0,
          totalItems:
            folder.name === currentPath
              ? (folder.total_items ?? folder.totalItems ?? 0)
              : 0,
          depth: i,
        });
      }
    }
  }

  // Second pass: count children
  for (const item of result) {
    item.childFolderCount = result.filter((f) => f.parentId === item.id).length;
  }

  return result;
}

/**
 * Sort folders: system folders first (by priority), then alphabetical
 */
export function sortFolders(folders: FolderTreeItem[]): FolderTreeItem[] {
  return [...folders].sort((a, b) => {
    // Same parent - sort by type priority, then alphabetically
    const priorityA = FOLDER_TYPE_PRIORITY[a.type];
    const priorityB = FOLDER_TYPE_PRIORITY[b.type];

    if (priorityA !== priorityB) {
      return priorityA - priorityB;
    }

    return a.name.localeCompare(b.name);
  });
}

/**
 * Build a tree structure from flat folder list
 * Returns only root folders with children nested
 */
export function buildFolderTree(
  folders: FolderTreeItem[]
): (FolderTreeItem & { children?: FolderTreeItem[] })[] {
  const sorted = sortFolders(folders);
  const byId = new Map(sorted.map((f) => [f.id, { ...f, children: [] as FolderTreeItem[] }]));
  const roots: (FolderTreeItem & { children?: FolderTreeItem[] })[] = [];

  for (const folder of sorted) {
    const node = byId.get(folder.id)!;
    if (folder.parentId && byId.has(folder.parentId)) {
      byId.get(folder.parentId)!.children!.push(node);
    } else {
      roots.push(node);
    }
  }

  // Remove empty children arrays
  const cleanTree = (
    nodes: (FolderTreeItem & { children?: FolderTreeItem[] })[]
  ): (FolderTreeItem & { children?: FolderTreeItem[] })[] => {
    return nodes.map((node) => {
      if (node.children && node.children.length === 0) {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { children, ...rest } = node;
        return rest;
      }
      return {
        ...node,
        children: cleanTree(node.children!),
      };
    });
  };

  return cleanTree(roots);
}

/**
 * Get localStorage key for folder expanded state
 */
export function getFolderExpandedKey(accountId: string): string {
  return `teeem_email_folders_expanded_${accountId}`;
}

/**
 * Load expanded folder IDs from localStorage
 */
export function loadExpandedFolders(accountId: string): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const stored = localStorage.getItem(getFolderExpandedKey(accountId));
    if (stored) {
      return new Set(JSON.parse(stored));
    }
  } catch {
    // Ignore parse errors
  }
  return new Set();
}

/**
 * Save expanded folder IDs to localStorage
 */
export function saveExpandedFolders(
  accountId: string,
  expandedIds: Set<string>
): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(
      getFolderExpandedKey(accountId),
      JSON.stringify([...expandedIds])
    );
  } catch {
    // Ignore storage errors
  }
}
