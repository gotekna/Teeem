"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

export interface NavigationItem {
  id: number;
  name: string;
  href: string;
  icon: string;
  badge_key: string | null;
  position: number;
  is_collapsed: boolean;
  has_children: boolean;
  children: NavigationChildItem[];
}

export interface NavigationChildItem {
  id: number;
  name: string;
  href: string;
  icon: string;
  badge_key: string | null;
  position: number;
}

interface NavigationData {
  items: NavigationItem[];
}

interface NavigationResponse {
  success: boolean;
  navigation: NavigationData;
}

interface ToggleCollapseResponse {
  success: boolean;
  is_collapsed: boolean;
}

export function useNavigation() {
  return useQuery({
    queryKey: ["navigation"],
    queryFn: async () => {
      const response = await api.get<NavigationResponse>("/api/v1/navigation");
      return response.navigation;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
    retry: 1,
  });
}

// Toggle collapse state for a navigation item (saved to database)
export function useToggleNavCollapse() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (itemId: number) => {
      const response = await api.patch<ToggleCollapseResponse>(
        `/api/v1/navigation/${itemId}/toggle_collapse`
      );
      return response;
    },
    // Optimistic update for instant UI feedback
    onMutate: async (itemId: number) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ["navigation"] });

      // Snapshot the previous value
      const previousNav = queryClient.getQueryData<NavigationData>(["navigation"]);

      // Optimistically update
      if (previousNav) {
        queryClient.setQueryData<NavigationData>(["navigation"], {
          ...previousNav,
          items: previousNav.items.map((item) =>
            item.id === itemId
              ? { ...item, is_collapsed: !item.is_collapsed }
              : item
          ),
        });
      }

      return { previousNav };
    },
    // Rollback on error
    onError: (_err, _itemId, context) => {
      if (context?.previousNav) {
        queryClient.setQueryData(["navigation"], context.previousNav);
      }
    },
    // Always refetch after error or success to ensure sync
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["navigation"] });
    },
  });
}

// Reset navigation to system defaults
export function useResetNavigation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      await api.post("/api/v1/navigation/reset");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["navigation"] });
    },
  });
}
