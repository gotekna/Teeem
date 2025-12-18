"use client";

import { useQuery } from "@tanstack/react-query";
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
