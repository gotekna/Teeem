"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { api } from "@/lib/api";
import {
  AUTO_SAVE_INTERVAL_MS,
  MAX_DRAFTS,
} from "@/lib/email-constants";
import type { EmailDraft, AutoSaveConfig } from "@/lib/email-types";
import type { AccountType } from "@/lib/email-constants";
import { getStorageItem, setStorageItem, STORAGE_KEYS } from "@/lib/storage-utils";

// Re-export types for backwards compatibility
export type { EmailDraft } from "@/lib/email-types";

// API response types
interface DraftsApiResponse {
  success: boolean;
  data: EmailDraft[];
  meta?: { total: number };
}

interface DraftApiResponse {
  success: boolean;
  data: EmailDraft;
}

interface DeleteApiResponse {
  success: boolean;
  message: string;
}

/**
 * Get all drafts from localStorage (fallback/cache)
 */
function getDraftsFromStorage(): EmailDraft[] {
  if (typeof window === "undefined") return [];

  try {
    return getStorageItem<EmailDraft[]>(STORAGE_KEYS.EMAIL_DRAFTS, []);
  } catch (error) {
    console.error("Failed to parse drafts from localStorage:", error);
    return [];
  }
}

/**
 * Save drafts to localStorage (cache)
 */
function saveDraftsToStorage(drafts: EmailDraft[]): void {
  if (typeof window === "undefined") return;

  try {
    // Keep only the most recent drafts
    const trimmedDrafts = drafts
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
      .slice(0, MAX_DRAFTS);

    setStorageItem(STORAGE_KEYS.EMAIL_DRAFTS, trimmedDrafts);
  } catch (error) {
    console.error("Failed to save drafts to localStorage:", error);
  }
}

/**
 * Generate a unique draft ID (for temporary local drafts)
 */
function generateDraftId(): string {
  return `draft-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Check if an ID is a server-generated ID (numeric) vs local temporary ID
 */
function isServerDraftId(id: string): boolean {
  return /^\d+$/.test(id);
}

/**
 * Hook for managing email drafts
 *
 * Hybrid mode:
 * - Loads from API first, falls back to localStorage
 * - Saves to both API and localStorage for offline support
 * - On mount, migrates localStorage-only drafts to API
 *
 * Usage:
 * const { drafts, saveDraft, deleteDraft, getDraft, hasDrafts } = useEmailDrafts();
 */
export function useEmailDrafts() {
  const [drafts, setDrafts] = useState<EmailDraft[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const hasMigratedRef = useRef(false);

  // Load drafts from API (with localStorage fallback)
  const loadDrafts = useCallback(async () => {
    try {
      const response = await api.get<DraftsApiResponse>("/api/v1/email_drafts");
      if (response.success && response.data) {
        setDrafts(response.data);
        // Update localStorage cache
        saveDraftsToStorage(response.data);
        setError(null);
        return response.data;
      }
    } catch (err) {
      // Fall back to localStorage
      const localDrafts = getDraftsFromStorage();
      setDrafts(localDrafts);
      setError("Offline mode - drafts saved locally");
      return localDrafts;
    }
    return [];
  }, []);

  // Migrate localStorage drafts to API (one-time on first load)
  const migrateLocalDrafts = useCallback(async (apiDrafts: EmailDraft[]) => {
    if (hasMigratedRef.current) return;
    hasMigratedRef.current = true;

    const localDrafts = getDraftsFromStorage();
    if (localDrafts.length === 0) return;

    // Find drafts that exist in localStorage but not in API
    const apiDraftIds = new Set(apiDrafts.map(d => d.id));
    const localOnlyDrafts = localDrafts.filter(d => !apiDraftIds.has(d.id) && !isServerDraftId(d.id));

    if (localOnlyDrafts.length === 0) return;


    // Migrate each local draft to API
    for (const draft of localOnlyDrafts) {
      try {
        await api.post<DraftApiResponse>("/api/v1/email_drafts", {
          credential_id: draft.credential_id,
          from_address: draft.from_address,
          to: draft.to,
          cc: draft.cc,
          bcc: draft.bcc,
          subject: draft.subject,
          body: draft.body,
          reply_to_message_id: draft.reply_to_message_id,
          attachment_names: draft.attachment_names,
        });
      } catch (error) {
        console.error("Draft migration failed:", error);
      }
    }

    // Reload drafts from API after migration
    await loadDrafts();
  }, [loadDrafts]);

  // Load drafts on mount
  useEffect(() => {
    const init = async () => {
      setIsLoading(true);
      const apiDrafts = await loadDrafts();
      await migrateLocalDrafts(apiDrafts);
      setIsLoading(false);
    };
    init();
  }, [loadDrafts, migrateLocalDrafts]);

  /**
   * Save a new or update existing draft
   * account_type is optional - if provided, enables provider sync (MS365/IMAP Drafts folder)
   */
  const saveDraft = useCallback(async (
    draftData: Omit<EmailDraft, "id" | "created_at" | "updated_at">,
    existingId?: string,
    accountType?: AccountType
  ): Promise<string> => {
    const now = new Date().toISOString();

    // Prepare API payload
    const payload: Record<string, unknown> = {
      credential_id: draftData.credential_id,
      from_address: draftData.from_address,
      to: draftData.to,
      cc: draftData.cc,
      bcc: draftData.bcc,
      subject: draftData.subject,
      body: draftData.body,
      reply_to_message_id: draftData.reply_to_message_id,
      attachment_names: draftData.attachment_names || [],
      status: 'draft',
    };

    // Pass account_type + provider-specific credential for provider sync
    if (accountType) {
      payload.account_type = accountType;
    }
    if (draftData.microsoft_credential_id) {
      payload.microsoft_credential_id = draftData.microsoft_credential_id;
    }

    try {
      let response: DraftApiResponse | null;

      if (existingId && isServerDraftId(existingId)) {
        // Update existing API draft
        response = await api.patch<DraftApiResponse>(`/api/v1/email_drafts/${existingId}`, payload);
      } else {
        // Create new draft
        response = await api.post<DraftApiResponse>("/api/v1/email_drafts", payload);
      }

      if (response?.success && response.data) {
        const savedDraft = response.data;

        // Update local state
        setDrafts((prev) => {
          const filtered = prev.filter((d) => d.id !== savedDraft.id && d.id !== existingId);
          const updated = [savedDraft, ...filtered];
          saveDraftsToStorage(updated);
          return updated;
        });

        return savedDraft.id;
      }
    } catch (error) {
      console.error("Draft save failed:", error);
    }

    // Fallback to localStorage only
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
  const deleteDraft = useCallback(async (id: string): Promise<void> => {
    // Try to delete from API first
    if (isServerDraftId(id)) {
      try {
        await api.delete<DeleteApiResponse>(`/api/v1/email_drafts/${id}`);
      } catch (error) {
        console.error("Draft delete failed:", error);
      }
    }

    // Always remove from local state and localStorage
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
  const clearAllDrafts = useCallback(async (): Promise<void> => {
    try {
      await api.delete<DeleteApiResponse>("/api/v1/email_drafts/destroy_all");
    } catch (error) {
      console.error("Draft clear all failed:", error);
    }

    setDrafts([]);
    saveDraftsToStorage([]);
  }, []);

  /**
   * Send an existing draft via the provider (MS365 or IMAP)
   * This triggers provider send + draft cleanup in one call.
   * Falls back to returning false if draft has no provider_draft_id.
   */
  const sendDraft = useCallback(async (id: string): Promise<boolean> => {
    if (!isServerDraftId(id)) return false;

    try {
      const response = await api.post<DeleteApiResponse>(`/api/v1/email_drafts/${id}/send_draft`);
      if (response?.success) {
        // Remove from local state
        setDrafts((prev) => {
          const filtered = prev.filter((d) => d.id !== id);
          saveDraftsToStorage(filtered);
          return filtered;
        });
        return true;
      }
      return false;
    } catch (err) {
      console.error("Failed to send draft:", err);
      return false;
    }
  }, []);

  /**
   * Refresh drafts from API/storage
   */
  const refreshDrafts = useCallback(async (): Promise<void> => {
    await loadDrafts();
  }, [loadDrafts]);

  return {
    drafts,
    saveDraft,
    sendDraft,
    deleteDraft,
    getDraft,
    clearAllDrafts,
    refreshDrafts,
    hasDrafts: drafts.length > 0,
    draftCount: drafts.length,
    isLoading,
    error,
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
  const { enabled, data, accountType, existingDraftId, onSave } = config;

  const [draftId, setDraftId] = useState<string | undefined>(existingDraftId);
  const [lastSavedData, setLastSavedData] = useState<string>("");
  const [isSaving, setIsSaving] = useState(false);
  const { saveDraft, deleteDraft } = useEmailDrafts();
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Serialize data for comparison
  const currentDataString = JSON.stringify({
    credential_id: data.credential_id,
    microsoft_credential_id: data.microsoft_credential_id,
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
  const save = useCallback(async () => {
    if (!hasContent) return;

    setIsSaving(true);
    try {
      const id = await saveDraft(
        {
          credential_id: data.credential_id,
          microsoft_credential_id: data.microsoft_credential_id,
          from_address: data.from_address,
          to: data.to,
          cc: data.cc,
          bcc: data.bcc,
          subject: data.subject,
          body: data.body,
          reply_to_message_id: data.reply_to_message_id,
          attachment_names: data.attachment_names || [],
        },
        draftId,
        accountType
      );

      setDraftId(id);
      setLastSavedData(currentDataString);
      onSave?.(id);

      return id;
    } finally {
      setIsSaving(false);
    }
  }, [data, draftId, saveDraft, hasContent, currentDataString, onSave, accountType]);

  // Discard draft
  const discard = useCallback(async () => {
    if (draftId) {
      await deleteDraft(draftId);
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
