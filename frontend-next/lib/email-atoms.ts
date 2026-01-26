/**
 * Email Page Atoms - Single Source of Truth (SSoT)
 *
 * All email page state lives here. This eliminates:
 * - selectedFolder/selectedFolderId dual state
 * - emails/splitInbox.currentEmails dual email lists
 * - syncing/wsIsSyncing dual sync state
 *
 * Pattern follows lib/table-atoms.ts SSoT architecture.
 */

import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";
import type {
  EmailAccount,
  EmailFolder,
  EmailDraft,
  EmailListItem,
  SplitInboxCategory,
  CategoryData,
} from "./email-types";
import { PAGE_SIZE_LIST } from "./constants/pagination-constants";

// Pagination interface (matches page.tsx)
export interface Pagination {
  page: number;
  per_page: number;
  total: number;
  total_pages: number;
}

// =============================================================================
// EMAIL TYPE (used in page.tsx, should match or extend EmailListItem)
// =============================================================================

export type Email = EmailListItem & {
  // Additional fields from the page that might be used
  from_account_id?: string;
  credential_id?: string;
  folder_id?: string;
  folder_name?: string;
};

// =============================================================================
// FOLDER STATE - SSoT (eliminates dual selectedFolder/selectedFolderId)
// =============================================================================

/**
 * Selected folder - SINGLE source of truth for folder selection.
 * Combines name and id into one atom to prevent them from getting out of sync.
 */
export interface SelectedFolder {
  name: string;
  id: string;
}

export const selectedFolderAtom = atomWithStorage<SelectedFolder>(
  "email_selected_folder",
  { name: "Inbox", id: "ALL_INBOX" }
);

/**
 * Selected account - "all" for combined view, account ID for specific account.
 */
export const selectedAccountAtom = atomWithStorage<string>(
  "email_selected_account",
  "all"
);

/**
 * Expanded accounts in the sidebar folder tree.
 */
export const expandedAccountsAtom = atom<Set<string>>(new Set<string>());

/**
 * Show all mailboxes toggle (favorites vs all).
 */
export const showAllMailboxesAtom = atomWithStorage<boolean>(
  "email_show_all_mailboxes",
  false
);

// =============================================================================
// ACCOUNTS & FOLDERS
// =============================================================================

/**
 * All connected email accounts.
 */
export const accountsAtom = atom<EmailAccount[]>([]);

/**
 * Folders for each account, keyed by account ID.
 */
export const accountFoldersAtom = atom<Record<string, EmailFolder[]>>({});

/**
 * Custom folder order for each account.
 */
export const folderOrderAtom = atom<Record<string, string[]>>({});

/**
 * Which folders are currently loading.
 */
export const loadingFoldersAtom = atom<Set<string>>(new Set<string>());

// =============================================================================
// EMAIL LIST STATE - SSoT (eliminates emails vs splitInbox duality)
// =============================================================================

/**
 * Main email list for folder view.
 */
export const emailsAtom = atom<Email[]>([]);

/**
 * View mode: split inbox categories vs traditional folders.
 */
export const viewModeAtom = atomWithStorage<"split" | "folders">(
  "email_view_mode",
  "folders"
);

/**
 * Split inbox data by category.
 */
export const splitInboxDataAtom = atom<Record<SplitInboxCategory, CategoryData> | null>(null);

/**
 * Currently selected split inbox category.
 */
export const selectedCategoryAtom = atomWithStorage<SplitInboxCategory>(
  "email_selected_category",
  "vip"
);

/**
 * Split inbox emails for the currently selected category.
 * Derived from splitInboxDataAtom and selectedCategoryAtom.
 */
export const splitInboxEmailsAtom = atom<Email[]>((get) => {
  const data = get(splitInboxDataAtom);
  const category = get(selectedCategoryAtom);
  if (!data) return [];
  return (data[category]?.emails || []) as Email[];
});

/**
 * Visible emails - THE SSoT for what emails are displayed.
 * Returns split inbox emails or folder emails based on view mode.
 */
export const visibleEmailsAtom = atom<Email[]>((get) => {
  const viewMode = get(viewModeAtom);
  if (viewMode === "split") {
    return get(splitInboxEmailsAtom);
  }
  return get(emailsAtom);
});

// =============================================================================
// LOADING & SYNC STATE - SSoT (eliminates syncing vs wsIsSyncing)
// =============================================================================

/**
 * General loading state (initial fetch).
 */
export const loadingAtom = atom<boolean>(true);

/**
 * Sync in progress - SINGLE source of truth for sync spinner.
 * Updated by WebSocket handlers and manual sync actions.
 */
export const syncingAtom = atom<boolean>(false);

/**
 * Pagination state.
 */
export const paginationAtom = atom<Pagination>({
  page: 1,
  per_page: PAGE_SIZE_LIST,
  total: 0,
  total_pages: 0,
});

// =============================================================================
// SELECTION STATE
// =============================================================================

/**
 * Set of selected email IDs for bulk actions.
 */
export const selectedEmailIdsAtom = atom<Set<number>>(new Set<number>());

/**
 * Currently selected/focused email for reading pane.
 */
export const selectedEmailAtom = atom<Email | null>(null);

/**
 * Last clicked email ID for shift-click range selection.
 */
export const lastClickedEmailIdAtom = atom<number | null>(null);

/**
 * Email opened in popout window.
 */
export const popoutEmailAtom = atom<Email | null>(null);

// =============================================================================
// UI STATE - Modals
// =============================================================================

/**
 * Active modal type - only one modal open at a time.
 * Following pattern from table-atoms.ts activeTableModalAtom.
 */
export type EmailModalType =
  | "compose"
  | "createFolder"
  | "shortcuts"
  | "drafts"
  | null;

export const activeEmailModalAtom = atom<EmailModalType>(null);

/**
 * Reading pane position preference.
 */
export const readingPanePositionAtom = atomWithStorage<"right" | "bottom" | "off">(
  "email_reading_pane_position",
  "right"
);

// =============================================================================
// COMPOSE STATE
// =============================================================================

/**
 * Reply-to data for composing a reply.
 */
export interface ReplyToData {
  to: string;
  cc?: string;
  subject: string;
  body?: string;
  messageId?: string;
  fromAccountId?: string;
  replyToMessageId?: string;
}

export const replyToDataAtom = atom<ReplyToData | null>(null);

/**
 * Draft to resume editing.
 */
export const resumeDraftAtom = atom<EmailDraft | null>(null);

// =============================================================================
// ACTION STATE (loading states for specific actions)
// =============================================================================

/**
 * Creating task from email in progress.
 */
export const creatingTaskAtom = atom<boolean>(false);

/**
 * Creating contact from email in progress.
 */
export const creatingContactAtom = atom<boolean>(false);

// =============================================================================
// DERIVED ATOMS (computed values)
// =============================================================================

/**
 * Is any email selected for bulk actions.
 */
export const hasSelectionAtom = atom<boolean>((get) => {
  return get(selectedEmailIdsAtom).size > 0;
});

/**
 * Number of selected emails.
 */
export const selectionCountAtom = atom<number>((get) => {
  return get(selectedEmailIdsAtom).size;
});

/**
 * Is compose modal open (convenience atom).
 */
export const isComposeOpenAtom = atom<boolean>((get) => {
  return get(activeEmailModalAtom) === "compose";
});

/**
 * Is in split inbox view.
 */
export const isSplitViewAtom = atom<boolean>((get) => {
  return get(viewModeAtom) === "split";
});

// =============================================================================
// HELPER ACTIONS (for common state updates)
// =============================================================================

/**
 * Helper to toggle email selection.
 */
export const toggleEmailSelectionAtom = atom(
  null,
  (get, set, emailId: number) => {
    const current = get(selectedEmailIdsAtom);
    const next = new Set(current);
    if (next.has(emailId)) {
      next.delete(emailId);
    } else {
      next.add(emailId);
    }
    set(selectedEmailIdsAtom, next);
    set(lastClickedEmailIdAtom, emailId);
  }
);

/**
 * Helper to select all visible emails.
 */
export const selectAllEmailsAtom = atom(null, (get, set) => {
  const emails = get(visibleEmailsAtom);
  const ids = new Set(emails.map((e) => e.id));
  set(selectedEmailIdsAtom, ids);
});

/**
 * Helper to clear selection.
 */
export const clearSelectionAtom = atom(null, (get, set) => {
  set(selectedEmailIdsAtom, new Set());
  set(lastClickedEmailIdAtom, null);
});

/**
 * Helper to open compose modal.
 */
export const openComposeAtom = atom(
  null,
  (get, set, replyData?: ReplyToData) => {
    if (replyData) {
      set(replyToDataAtom, replyData);
    }
    set(activeEmailModalAtom, "compose");
  }
);

/**
 * Helper to close compose modal.
 */
export const closeComposeAtom = atom(null, (get, set) => {
  set(activeEmailModalAtom, null);
  set(replyToDataAtom, null);
  set(resumeDraftAtom, null);
});

/**
 * Helper to set folder (updates both name and id atomically).
 */
export const setFolderAtom = atom(
  null,
  (get, set, folder: { name: string; id: string }) => {
    set(selectedFolderAtom, folder);
  }
);
