"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

interface NavigationItem {
  id: number;
  name: string;
  href: string;
  icon: string;
  badge_key: string | null;
  position: number;
  navigation_group_id: number | null;
}

interface NavigationGroup {
  id: number;
  name: string;
  icon: string;
  position: number;
  is_collapsible: boolean;
  items: NavigationItem[];
}

interface NavigationData {
  groups: NavigationGroup[];
  ungrouped_items: NavigationItem[];
}

interface NavigationResponse {
  success: boolean;
  navigation: NavigationData;
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
