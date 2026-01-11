"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import debounce from "lodash/debounce";

// Types
export interface NotebookPageAttachment {
  id: number;
  file_name: string;
  content_type: string;
  file_size: number;
  human_size: string;
  is_image: boolean;
}

export interface NotebookPage {
  id: number;
  section_id: number;
  title: string;
  content: string;
  position: number;
  is_pinned: boolean;
  preview: string;
  word_count: number;
  char_count: number;
  created_by: { id: number; name: string } | null;
  last_edited_by: { id: number; name: string } | null;
  created_at: string;
  updated_at: string;
  attachments?: NotebookPageAttachment[];
  notebook?: { id: number; name: string };
  section?: { id: number; name: string };
}

interface PageResponse {
  success: boolean;
  page: NotebookPage;
}

interface PagesResponse {
  success: boolean;
  pages: NotebookPage[];
}

// Hook to get a single page with content
export function useNotebookPage(pageId: number | null, notebookId: number | null = null) {
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const pendingChangesRef = useRef<{ title?: string; content?: string } | null>(null);
  const queryClient = useQueryClient();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["notebook-page", pageId],
    queryFn: async () => {
      if (!pageId) return null;
      const response = await api.get<PageResponse>(`/api/v1/notebook_pages/${pageId}`);
      if (!response?.success) {
        throw new Error("Failed to fetch page");
      }
      return response;
    },
    enabled: !!pageId,
    staleTime: 0, // Always fetch fresh data to ensure we have notebook ID
  });

  // Debounced save function (300ms for faster sidebar updates)
  const debouncedSave = useRef(
    debounce(async (id: number, changes: { title?: string; content?: string }) => {
      try {
        setIsSaving(true);
        const response = await api.patch<PageResponse>(`/api/v1/notebook_pages/${id}`, changes);
        if (response?.success) {
          setLastSaved(new Date());
          setHasUnsavedChanges(false);
          pendingChangesRef.current = null;
          // Update the page cache
          queryClient.setQueryData(["notebook-page", id], response);
// Invalidate the notebook cache to refresh the sidebar
          const notebookId = response.page.notebook?.id;
          if (notebookId) {
            queryClient.invalidateQueries({ queryKey: ["notebook", notebookId] });
          }
        }
      } catch (err) {
        console.error("Failed to save page:", err);
      } finally {
        setIsSaving(false);
      }
    }, 300)
  ).current;

  // Update page content with debounced auto-save
  const updateContent = useCallback(
    (content: string) => {
      if (!pageId) return;
      setHasUnsavedChanges(true);
      pendingChangesRef.current = { ...pendingChangesRef.current, content };
      debouncedSave(pageId, pendingChangesRef.current);
    },
    [pageId, debouncedSave]
  );

  // Update page title with debounced auto-save
  const updateTitle = useCallback(
    (title: string) => {
      if (!pageId) return;
      setHasUnsavedChanges(true);
      pendingChangesRef.current = { ...pendingChangesRef.current, title };

      // Optimistically update the sidebar immediately using the passed notebookId
      console.log("🔄 Optimistic update:", { pageId, notebookId, title });
      if (notebookId) {
        queryClient.setQueryData(["notebook", notebookId], (oldData: any) => {
          console.log("📦 Current notebook data:", oldData);
          if (!oldData?.notebook) {
            console.log("❌ No notebook in oldData");
            return oldData;
          }
          const newData = {
            ...oldData,
            notebook: {
              ...oldData.notebook,
              sections: oldData.notebook.sections?.map((section: any) => ({
                ...section,
                pages: section.pages?.map((page: any) =>
                  page.id === pageId ? { ...page, title } : page
                ),
              })),
            },
          };
          console.log("✅ Updated notebook data:", newData);
          return newData;
        });
      } else {
        console.log("❌ No notebookId available");
      }

      debouncedSave(pageId, pendingChangesRef.current);
    },
    [pageId, notebookId, debouncedSave, queryClient]
  );

  // Force save immediately
  const saveNow = useCallback(async () => {
    if (!pageId || !pendingChangesRef.current) return;
    debouncedSave.cancel();
    try {
      setIsSaving(true);
      const response = await api.patch<PageResponse>(
        `/api/v1/notebook_pages/${pageId}`,
        pendingChangesRef.current
      );
      if (response?.success) {
        setLastSaved(new Date());
        setHasUnsavedChanges(false);
        pendingChangesRef.current = null;
        queryClient.setQueryData(["notebook-page", pageId], response);
      }
    } catch (err) {
      console.error("Failed to save page:", err);
    } finally {
      setIsSaving(false);
    }
  }, [pageId, debouncedSave, queryClient]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      debouncedSave.cancel();
    };
  }, [debouncedSave]);

  return {
    page: data?.page ?? null,
    isLoading,
    error,
    mutate: refetch,
    // Auto-save state
    isSaving,
    lastSaved,
    hasUnsavedChanges,
    // Update functions
    updateContent,
    updateTitle,
    saveNow,
  };
}

// Hook to list pages in a section
export function useNotebookPages(notebookId: number | null, sectionId: number | null) {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["notebook-pages", notebookId, sectionId],
    queryFn: async () => {
      if (!notebookId || !sectionId) return { pages: [] };
      const response = await api.get<PagesResponse>(
        `/api/v1/notebooks/${notebookId}/sections/${sectionId}/pages`
      );
      if (!response?.success) {
        throw new Error("Failed to fetch pages");
      }
      return response;
    },
    enabled: !!notebookId && !!sectionId,
  });

  return {
    pages: data?.pages ?? [],
    isLoading,
    error,
    mutate: refetch,
  };
}

// Hook for recent pages across all notebooks
export function useRecentPages() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["notebook-pages-recent"],
    queryFn: async () => {
      const response = await api.get<PagesResponse>("/api/v1/notebook_pages/recent");
      if (!response?.success) {
        throw new Error("Failed to fetch recent pages");
      }
      return response;
    },
  });

  return {
    pages: data?.pages ?? [],
    isLoading,
    error,
    mutate: refetch,
  };
}

// Hook for searching pages
export function useSearchPages(query: string) {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["notebook-pages-search", query],
    queryFn: async () => {
      if (!query.trim()) return { pages: [] };
      const response = await api.get<PagesResponse>("/api/v1/notebook_pages/search", {
        params: { q: query },
      });
      if (!response?.success) {
        throw new Error("Failed to search pages");
      }
      return response;
    },
    enabled: query.trim().length >= 2,
  });

  return {
    pages: data?.pages ?? [],
    isLoading,
    error,
    mutate: refetch,
  };
}

// Page API actions
export const pageActions = {
  async create(
    notebookId: number,
    sectionId: number,
    data: { title?: string; content?: string }
  ): Promise<NotebookPage> {
    const response = await api.post<PageResponse>(
      `/api/v1/notebooks/${notebookId}/sections/${sectionId}/pages`,
      data
    );
    if (!response?.success) {
      throw new Error("Failed to create page");
    }
    return response.page;
  },

  async update(
    pageId: number,
    data: { title?: string; content?: string; is_pinned?: boolean }
  ): Promise<NotebookPage> {
    const response = await api.patch<PageResponse>(`/api/v1/notebook_pages/${pageId}`, data);
    if (!response?.success) {
      throw new Error("Failed to update page");
    }
    return response.page;
  },

  async delete(pageId: number): Promise<void> {
    const response = await api.delete<{ success: boolean }>(`/api/v1/notebook_pages/${pageId}`);
    if (!response?.success) {
      throw new Error("Failed to delete page");
    }
  },

  async move(pageId: number, options: { section_id?: number; position?: number }): Promise<void> {
    const response = await api.post<{ success: boolean }>(`/api/v1/notebook_pages/${pageId}/move`, options);
    if (!response?.success) {
      throw new Error("Failed to move page");
    }
  },

  async togglePin(pageId: number): Promise<NotebookPage> {
    const response = await api.post<PageResponse>(`/api/v1/notebook_pages/${pageId}/toggle_pin`, {});
    if (!response?.success) {
      throw new Error("Failed to toggle pin");
    }
    return response.page;
  },
};

// Attachment API actions
export const attachmentActions = {
  async list(pageId: number): Promise<NotebookPageAttachment[]> {
    const response = await api.get<{ attachments: NotebookPageAttachment[] }>(
      `/api/v1/notebook_pages/${pageId}/attachments`
    );
    return response?.attachments ?? [];
  },

  async upload(pageId: number, file: File): Promise<NotebookPageAttachment> {
    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch(`/api/v1/notebook_pages/${pageId}/attachments`, {
      method: "POST",
      body: formData,
      credentials: "include",
    });

    if (!response.ok) {
      throw new Error("Failed to upload attachment");
    }

    const data = await response.json();
    return data.attachment;
  },

  async delete(attachmentId: number): Promise<void> {
    const response = await api.delete<{ success: boolean }>(
      `/api/v1/notebook_page_attachments/${attachmentId}`
    );
    if (!response?.success) {
      throw new Error("Failed to delete attachment");
    }
  },

  async getDownloadUrl(attachmentId: number): Promise<{ url: string; file_name: string }> {
    const response = await api.get<{ url: string; file_name: string }>(
      `/api/v1/notebook_page_attachments/${attachmentId}/download`
    );
    if (!response?.url) {
      throw new Error("Failed to get download URL");
    }
    return response;
  },
};
