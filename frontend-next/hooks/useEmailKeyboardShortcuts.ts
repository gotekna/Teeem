"use client";

import { useEffect, useCallback, useRef } from "react";

// Base email type with required fields for keyboard navigation
export interface BaseEmail {
  id: number;
  subject: string;
  from_email: string;
  from_name: string | null;
  received_at: string;
  is_read: boolean;
}

export interface UseEmailKeyboardShortcutsProps<T extends BaseEmail> {
  /** List of emails currently displayed */
  emails: T[];
  /** Currently selected email */
  selectedEmail: T | null;
  /** Callback to select an email */
  onSelectEmail: (email: T | null) => void;
  /** Archive action handler */
  onArchive?: () => Promise<void>;
  /** Star action handler */
  onStar?: () => Promise<void>;
  /** Pin action handler */
  onPin?: () => Promise<void>;
  /** VIP toggle handler */
  onVip?: () => Promise<void>;
  /** Reply action handler */
  onReply?: () => void;
  /** Compose new email handler */
  onCompose?: () => void;
  /** Show keyboard shortcuts help */
  onShowHelp?: () => void;
  /** Toggle selection on current email (x key) */
  onToggleSelection?: (email: T) => void;
  /** Select all emails (Cmd/Ctrl+A) */
  onSelectAll?: () => void;
  /** Clear all selections */
  onClearSelection?: () => void;
  /** Whether there are selected emails */
  hasSelection?: boolean;
  /** Enable/disable shortcuts */
  enabled?: boolean;
}

/**
 * Gmail-style keyboard shortcuts for email navigation and actions
 *
 * Shortcuts:
 * - j/↓: Next email
 * - k/↑: Previous email
 * - o/Enter: Open/select email
 * - x: Toggle selection (for bulk actions)
 * - Cmd/Ctrl+A: Select all
 * - e: Archive
 * - s: Star
 * - p: Pin
 * - v: Toggle VIP
 * - r: Reply
 * - c: Compose
 * - Escape: Clear selection (if any) or deselect
 * - ?: Show help
 */
export function useEmailKeyboardShortcuts<T extends BaseEmail>({
  emails,
  selectedEmail,
  onSelectEmail,
  onArchive,
  onStar,
  onPin,
  onVip,
  onReply,
  onCompose,
  onShowHelp,
  onToggleSelection,
  onSelectAll,
  onClearSelection,
  hasSelection = false,
  enabled = true,
}: UseEmailKeyboardShortcutsProps<T>): void {
  // Track if an action is in progress to prevent double-triggering
  const actionInProgress = useRef(false);

  const navigateNext = useCallback(() => {
    if (!emails.length) return;

    if (!selectedEmail) {
      // Select first email
      onSelectEmail(emails[0]);
      return;
    }

    const currentIndex = emails.findIndex((e) => e.id === selectedEmail.id);
    if (currentIndex < emails.length - 1) {
      onSelectEmail(emails[currentIndex + 1]);
    }
  }, [emails, selectedEmail, onSelectEmail]);

  const navigatePrev = useCallback(() => {
    if (!emails.length) return;

    if (!selectedEmail) {
      // Select last email
      onSelectEmail(emails[emails.length - 1]);
      return;
    }

    const currentIndex = emails.findIndex((e) => e.id === selectedEmail.id);
    if (currentIndex > 0) {
      onSelectEmail(emails[currentIndex - 1]);
    }
  }, [emails, selectedEmail, onSelectEmail]);

  const handleAction = useCallback(
    async (action: (() => Promise<void>) | undefined) => {
      if (!action || actionInProgress.current) return;
      actionInProgress.current = true;
      try {
        await action();
      } finally {
        actionInProgress.current = false;
      }
    },
    []
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!enabled) return;

      // Ignore if typing in input/textarea/contenteditable
      const target = e.target as HTMLElement;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target.isContentEditable
      ) {
        return;
      }

      // Handle Cmd/Ctrl+A for select all (before ignoring modifiers)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "a") {
        if (onSelectAll) {
          e.preventDefault();
          onSelectAll();
        }
        return;
      }

      // Ignore if modifier keys (Ctrl, Cmd, Alt) are pressed for other shortcuts
      // Allow Shift for potential future shortcuts like Shift+S
      if (e.ctrlKey || e.metaKey || e.altKey) {
        return;
      }

      const key = e.key;

      switch (key.toLowerCase()) {
        // Navigation
        case "j":
        case "arrowdown":
          e.preventDefault();
          navigateNext();
          break;

        case "k":
        case "arrowup":
          e.preventDefault();
          navigatePrev();
          break;

        case "o":
        case "enter":
          // Only handle Enter if not in an interactive element
          if (key === "Enter" && target.tagName === "BUTTON") return;
          if (emails.length > 0 && !selectedEmail) {
            e.preventDefault();
            onSelectEmail(emails[0]);
          }
          break;

        // Toggle selection (for multi-select)
        case "x":
          if (selectedEmail && onToggleSelection) {
            e.preventDefault();
            onToggleSelection(selectedEmail);
          }
          break;

        // Actions (require selected email)
        case "e":
          if (selectedEmail && onArchive) {
            e.preventDefault();
            handleAction(onArchive);
          }
          break;

        case "s":
          if (selectedEmail && onStar) {
            e.preventDefault();
            handleAction(onStar);
          }
          break;

        case "p":
          if (selectedEmail && onPin) {
            e.preventDefault();
            handleAction(onPin);
          }
          break;

        case "v":
          if (selectedEmail && onVip) {
            e.preventDefault();
            handleAction(onVip);
          }
          break;

        case "r":
          if (selectedEmail && onReply) {
            e.preventDefault();
            onReply();
          }
          break;

        // Compose (doesn't require selection)
        case "c":
          if (onCompose) {
            e.preventDefault();
            onCompose();
          }
          break;

        // Help
        case "?":
          if (onShowHelp) {
            e.preventDefault();
            onShowHelp();
          }
          break;

        // Escape - clear selection first, then deselect
        case "escape":
          e.preventDefault();
          if (hasSelection && onClearSelection) {
            // Clear bulk selection first
            onClearSelection();
          } else if (selectedEmail) {
            // Then deselect single email
            onSelectEmail(null);
          }
          break;

        default:
          break;
      }
    },
    [
      enabled,
      emails,
      selectedEmail,
      onSelectEmail,
      navigateNext,
      navigatePrev,
      onArchive,
      onStar,
      onPin,
      onVip,
      onReply,
      onCompose,
      onShowHelp,
      onToggleSelection,
      onSelectAll,
      onClearSelection,
      hasSelection,
      handleAction,
    ]
  );

  // Scroll selected email into view
  useEffect(() => {
    if (selectedEmail) {
      // Use requestAnimationFrame to ensure DOM has updated
      requestAnimationFrame(() => {
        const element = document.querySelector(
          `[data-email-id="${selectedEmail.id}"]`
        );
        if (element) {
          element.scrollIntoView({ behavior: "smooth", block: "nearest" });
        }
      });
    }
  }, [selectedEmail?.id]);

  // Register keyboard event listener
  useEffect(() => {
    if (!enabled) return;

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [enabled, handleKeyDown]);
}

export default useEmailKeyboardShortcuts;
