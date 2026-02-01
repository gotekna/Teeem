"use client";

import { createContext, useContext, useState, useMemo, useEffect, useRef, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { getStorageItem, setStorageItem, STORAGE_KEYS } from "@/lib/storage-utils";

interface SidebarContextType {
  isExpanded: boolean;
  setIsExpanded: (expanded: boolean) => void;
  sidebarWidth: number;
}

const SidebarContext = createContext<SidebarContextType | undefined>(undefined);

const COLLAPSED_WIDTH = 70;
const EXPANDED_WIDTH = 240;

// Get the base route (e.g., "/jobs/123" -> "jobs", "/contacts" -> "contacts")
// Note: pathname can be null during SSR/hydration
function getBaseRoute(pathname: string | null): string {
  if (!pathname) return "dashboard";
  const parts = pathname.split("/").filter(Boolean);
  return parts[0] || "dashboard";
}

// Get state from localStorage synchronously
function getStoredState(baseRoute: string): boolean {
  const saved = getStorageItem<Record<string, boolean>>(STORAGE_KEYS.SIDEBAR_STATE, {});
  return saved[baseRoute] ?? false;
}

// Save state to localStorage
function saveState(baseRoute: string, expanded: boolean): void {
  const saved = getStorageItem<Record<string, boolean>>(STORAGE_KEYS.SIDEBAR_STATE, {});
  const states = { ...saved, [baseRoute]: expanded };
  setStorageItem(STORAGE_KEYS.SIDEBAR_STATE, states);
}

export function SidebarProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const baseRoute = getBaseRoute(pathname);
  const prevBaseRouteRef = useRef(baseRoute);

  // Initialize state with stored value for initial route
  const [isExpanded, setIsExpandedState] = useState(() => getStoredState(baseRoute));

  // When base route changes, update expanded state from storage
  // This replaces the key={baseRoute} pattern which caused remounts
  useEffect(() => {
    if (prevBaseRouteRef.current !== baseRoute) {
      prevBaseRouteRef.current = baseRoute;
      setIsExpandedState(getStoredState(baseRoute));
    }
  }, [baseRoute]);

  // Wrapper to save state when changed
  const setIsExpanded = useMemo(
    () => (expanded: boolean) => {
      setIsExpandedState(expanded);
      saveState(baseRoute, expanded);
    },
    [baseRoute]
  );

  const sidebarWidth = isExpanded ? EXPANDED_WIDTH : COLLAPSED_WIDTH;

  const value = useMemo(
    () => ({ isExpanded, setIsExpanded, sidebarWidth }),
    [isExpanded, setIsExpanded, sidebarWidth]
  );

  return (
    <SidebarContext.Provider value={value}>
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebar() {
  const context = useContext(SidebarContext);
  if (context === undefined) {
    throw new Error("useSidebar must be used within a SidebarProvider");
  }
  return context;
}

export { COLLAPSED_WIDTH, EXPANDED_WIDTH };
