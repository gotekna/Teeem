"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

// Types
export interface NotebookOwner {
  id: number;
  name: string;
}

export interface NotebookSection {
  id: number;
  notebook_id: number;
  name: string;
  position: number;
  color: string | null;
  page_count: number;
  created_at: string;
  updated_at: string;
  pages?: NotebookPageSummary[];
}

export interface NotebookPageSummary {
  id: number;
  title: string;
  position: number;
  is_pinned: boolean;
  preview: string;
  word_count: number;
  last_edited_by: string | null;
  updated_at: string;
}

export interface NotebookShare {
  id: number;
  user: {
    id: number;
    name: string;
    email: string;
  };
  permission: "view" | "edit" | "admin";
  granted_by: string | null;
  expires_at: string | null;
  created_at: string;
}

export interface Notebook {
  id: number;
  name: string;
  description: string | null;
  icon_name: string | null;
  color: string | null;
  owner: NotebookOwner;
  notable_type: string | null;
  notable_id: number | null;
  is_default: boolean;
  section_count: number;
  page_count: number;
  permission: "view" | "edit" | "admin" | null;
  last_activity_at: string;
  created_at: string;
  updated_at: string;
  sections?: NotebookSection[];
  shares?: NotebookShare[];
}

interface NotebooksResponse {
  success: boolean;
  notebooks: Notebook[];
  total: number;
}

interface NotebookResponse {
  success: boolean;
  notebook: Notebook;
}

// Hook to list all notebooks
export function useNotebooks(options?: {
  notable_type?: string;
  notable_id?: number;
  global?: boolean;
}) {
  const params = new URLSearchParams();
  if (options?.notable_type && options?.notable_id) {
    params.set("notable_type", options.notable_type);
    params.set("notable_id", String(options.notable_id));
  }
  if (options?.global) {
    params.set("global", "true");
  }

  const queryString = params.toString();
  const url = `/api/v1/notebooks${queryString ? `?${queryString}` : ""}`;

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["notebooks", options],
    queryFn: async () => {
      const response = await api.get<NotebooksResponse>(url);
      if (!response?.success) {
        throw new Error("Failed to fetch notebooks");
      }
      return response;
    },
  });

  return {
    notebooks: data?.notebooks ?? [],
    total: data?.total ?? 0,
    isLoading,
    error,
    mutate: refetch,
  };
}

// Hook to get a single notebook with sections
export function useNotebook(notebookId: number | null) {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["notebook", notebookId],
    queryFn: async () => {
      if (!notebookId) return null;
      const response = await api.get<NotebookResponse>(`/api/v1/notebooks/${notebookId}`);
      if (!response?.success) {
        throw new Error("Failed to fetch notebook");
      }
      return response;
    },
    enabled: !!notebookId,
  });

  return {
    notebook: data?.notebook ?? null,
    isLoading,
    error,
    mutate: refetch,
  };
}

// Notebook API actions
export const notebookActions = {
  async create(data: {
    name: string;
    description?: string;
    icon_name?: string;
    color?: string;
    notable_type?: string;
    notable_id?: number;
  }): Promise<Notebook> {
    const response = await api.post<NotebookResponse>("/api/v1/notebooks", data);
    if (!response?.success) {
      throw new Error("Failed to create notebook");
    }
    return response.notebook;
  },

  async update(
    id: number,
    data: {
      name?: string;
      description?: string;
      icon_name?: string;
      color?: string;
    }
  ): Promise<Notebook> {
    const response = await api.patch<NotebookResponse>(`/api/v1/notebooks/${id}`, data);
    if (!response?.success) {
      throw new Error("Failed to update notebook");
    }
    return response.notebook;
  },

  async delete(id: number): Promise<void> {
    const response = await api.delete<{ success: boolean }>(`/api/v1/notebooks/${id}`);
    if (!response?.success) {
      throw new Error("Failed to delete notebook");
    }
  },

  async share(
    id: number,
    data: { user_id: number; permission: "view" | "edit" | "admin"; expires_at?: string }
  ): Promise<NotebookShare> {
    const response = await api.post<{ success: boolean; share: NotebookShare }>(
      `/api/v1/notebooks/${id}/share`,
      data
    );
    if (!response?.success) {
      throw new Error("Failed to share notebook");
    }
    return response.share;
  },

  async unshare(id: number, userId: number): Promise<void> {
    const response = await api.delete<{ success: boolean }>(
      `/api/v1/notebooks/${id}/unshare?user_id=${userId}`
    );
    if (!response?.success) {
      throw new Error("Failed to remove share");
    }
  },
};

// Section API actions
export const sectionActions = {
  async create(
    notebookId: number,
    data: { name: string; color?: string }
  ): Promise<NotebookSection> {
    const response = await api.post<{ success: boolean; section: NotebookSection }>(
      `/api/v1/notebooks/${notebookId}/sections`,
      data
    );
    if (!response?.success) {
      throw new Error("Failed to create section");
    }
    return response.section;
  },

  async update(
    notebookId: number,
    sectionId: number,
    data: { name?: string; color?: string }
  ): Promise<NotebookSection> {
    const response = await api.patch<{ success: boolean; section: NotebookSection }>(
      `/api/v1/notebooks/${notebookId}/sections/${sectionId}`,
      data
    );
    if (!response?.success) {
      throw new Error("Failed to update section");
    }
    return response.section;
  },

  async delete(notebookId: number, sectionId: number): Promise<void> {
    const response = await api.delete<{ success: boolean }>(
      `/api/v1/notebooks/${notebookId}/sections/${sectionId}`
    );
    if (!response?.success) {
      throw new Error("Failed to delete section");
    }
  },

  async reorder(notebookId: number, sectionId: number, position: number): Promise<void> {
    const response = await api.post<{ success: boolean }>(
      `/api/v1/notebooks/${notebookId}/sections/${sectionId}/reorder`,
      { position }
    );
    if (!response?.success) {
      throw new Error("Failed to reorder section");
    }
  },
};
