"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  DRAFTS_STORAGE_KEY,
  AUTO_SAVE_INTERVAL_MS,
  MAX_DRAFTS,
} from "@/lib/email-constants";
import type { EmailDraft, AutoSaveConfig } from "@/lib/email-types";

// Re-export types for backwards compatibility
export type { EmailDraft } from "@/lib/email-types";

/**
 * Get all drafts from localStorage
 */
function getDraftsFromStorage(): EmailDraft[] {
  if (typeof window === "undefined") return [];

  try {
    const stored = localStorage.getItem(DRAFTS_STORAGE_KEY);
    if (!stored) return [];
    return JSON.parse(stored);
  } catch (error) {
    console.error("Failed to parse drafts from localStorage:", error);
    return [];
  }
}

/**
 * Save drafts to localStorage
 */
function saveDraftsToStorage(drafts: EmailDraft[]): void {
  if (typeof window === "undefined") return;

  try {
    // Keep only the most recent drafts
    const trimmedDrafts = drafts
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
      .slice(0, MAX_DRAFTS);

    localStorage.setItem(DRAFTS_STORAGE_KEY, JSON.stringify(trimmedDrafts));
  } catch (error) {
    console.error("Failed to save drafts to localStorage:", error);
  }
}

/**
 * Generate a unique draft ID
 */
function generateDraftId(): string {
  return `draft-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Hook for managing email drafts
 *
 * Usage:
 * const { drafts, saveDraft, deleteDraft, getDraft, hasDrafts } = useEmailDrafts();
 */
export function useEmailDrafts() {
  const [drafts, setDrafts] = useState<EmailDraft[]>([]);

  // Load drafts on mount
  useEffect(() => {
    setDrafts(getDraftsFromStorage());
  }, []);

  /**
   * Save a new or update existing draft
   */
  const saveDraft = useCallback((draftData: Omit<EmailDraft, "id" | "created_at" | "updated_at">, existingId?: string): string => {
    const now = new Date().toISOString();
    const id = existingId || generateDraftId();

    const draft: EmailDraft = {
      ...draftData,
      id,
      created_at: existingId
        ? (drafts.find((d) => d.id === existingId)?.created_at || now)
        : now,
      updated_at: now,
    };

    setDrafts((prev) => {
      const filtered = prev.filter((d) => d.id !== id);
      const updated = [draft, ...filtered];
      saveDraftsToStorage(updated);
      return updated;
    });

    return id;
  }, [drafts]);

  /**
   * Delete a draft by ID
   */
  const deleteDraft = useCallback((id: string): void => {
    setDrafts((prev) => {
      const filtered = prev.filter((d) => d.id !== id);
      saveDraftsToStorage(filtered);
      return filtered;
    });
  }, []);

  /**
   * Get a draft by ID
   */
  const getDraft = useCallback((id: string): EmailDraft | undefined => {
    return drafts.find((d) => d.id === id);
  }, [drafts]);

  /**
   * Clear all drafts
   */
  const clearAllDrafts = useCallback((): void => {
    setDrafts([]);
    saveDraftsToStorage([]);
  }, []);

  /**
   * Refresh drafts from storage
   */
  const refreshDrafts = useCallback((): void => {
    setDrafts(getDraftsFromStorage());
  }, []);

  return {
    drafts,
    saveDraft,
    deleteDraft,
    getDraft,
    clearAllDrafts,
    refreshDrafts,
    hasDrafts: drafts.length > 0,
    draftCount: drafts.length,
  };
}

/**
 * Hook for auto-saving compose state as a draft
 *
 * Usage:
 * const { draftId, save, discard, isDirty } = useAutoSaveDraft({
 *   enabled: isOpen,
 *   data: formData,
 * });
 */
export function useAutoSaveDraft(config: AutoSaveConfig) {
  const { enabled, data, existingDraftId, onSave } = config;

  const [draftId, setDraftId] = useState<string | undefined>(existingDraftId);
  const [lastSavedData, setLastSavedData] = useState<string>("");
  const [isSaving, setIsSaving] = useState(false);
  const { saveDraft, deleteDraft } = useEmailDrafts();
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Serialize data for comparison
  const currentDataString = JSON.stringify({
    credential_id: data.credential_id,
    from_address: data.from_address,
    to: data.to,
    cc: data.cc,
    bcc: data.bcc,
    subject: data.subject,
    body: data.body,
    reply_to_message_id: data.reply_to_message_id,
    attachment_names: data.attachment_names || [],
  });

  // Check if data has changed since last save
  const isDirty = currentDataString !== lastSavedData;

  // Check if there's enough content to save
  const hasContent = Boolean(
    data.to.trim() ||
    data.subject.trim() ||
    data.body.trim()
  );

  // Save draft function
  const save = useCallback(() => {
    if (!hasContent) return;

    setIsSaving(true);
    const id = saveDraft(
      {
        credential_id: data.credential_id,
        from_address: data.from_address,
        to: data.to,
        cc: data.cc,
        bcc: data.bcc,
        subject: data.subject,
        body: data.body,
        reply_to_message_id: data.reply_to_message_id,
        attachment_names: data.attachment_names || [],
      },
      draftId
    );

    setDraftId(id);
    setLastSavedData(currentDataString);
    setIsSaving(false);
    onSave?.(id);

    return id;
  }, [data, draftId, saveDraft, hasContent, currentDataString, onSave]);

  // Discard draft
  const discard = useCallback(() => {
    if (draftId) {
      deleteDraft(draftId);
      setDraftId(undefined);
    }
    setLastSavedData("");
  }, [draftId, deleteDraft]);

  // Auto-save timer
  useEffect(() => {
    if (!enabled || !hasContent || !isDirty) return;

    timerRef.current = setTimeout(() => {
      save();
    }, AUTO_SAVE_INTERVAL_MS);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [enabled, hasContent, isDirty, save]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  return {
    draftId,
    save,
    discard,
    isDirty,
    isSaving,
    hasContent,
  };
}

export default useEmailDrafts;
