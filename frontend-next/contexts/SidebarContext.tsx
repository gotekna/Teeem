"use client";

import { createContext, useContext, useState, useMemo, useEffect, useRef, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { getStorageItem, setStorageItem, STORAGE_KEYS } from "@/lib/storage-utils";

interface SidebarContextType {
  isExpanded: boolean;
  setIsExpanded: (expanded: boolean) => void;
  isPinned: boolean;
  setIsPinned: (pinned: boolean) => void;
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

// Get pinned state from localStorage synchronously
function getPinnedState(): boolean {
  return getStorageItem<boolean>(STORAGE_KEYS.SIDEBAR_PINNED, false);
}

// Save pinned state to localStorage
function savePinnedState(pinned: boolean): void {
  setStorageItem(STORAGE_KEYS.SIDEBAR_PINNED, pinned);
}

export function SidebarProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const baseRoute = getBaseRoute(pathname);
  const prevBaseRouteRef = useRef(baseRoute);

  // Initialize state with stored values
  const [isExpandedInternal, setIsExpandedState] = useState(() => getStoredState(baseRoute));
  const [isPinned, setIsPinnedState] = useState(() => getPinnedState());

  // When base route changes, update expanded state from storage (only if not pinned)
  // This replaces the key={baseRoute} pattern which caused remounts
  useEffect(() => {
    if (prevBaseRouteRef.current !== baseRoute) {
      prevBaseRouteRef.current = baseRoute;
      if (!isPinned) {
        setIsExpandedState(getStoredState(baseRoute));
      }
    }
  }, [baseRoute, isPinned]);

  // Wrapper to save state when changed
  const setIsExpanded = useMemo(
    () => (expanded: boolean) => {
      setIsExpandedState(expanded);
      saveState(baseRoute, expanded);
    },
    [baseRoute]
  );

  // Wrapper to save pinned state when changed
  const setIsPinned = useMemo(
    () => (pinned: boolean) => {
      setIsPinnedState(pinned);
      savePinnedState(pinned);
      // When pinning, expand the sidebar
      if (pinned) {
        setIsExpandedState(true);
      }
    },
    []
  );

  // When pinned, always show as expanded
  const isExpanded = isPinned ? true : isExpandedInternal;
  const sidebarWidth = isExpanded ? EXPANDED_WIDTH : COLLAPSED_WIDTH;

  const value = useMemo(
    () => ({ isExpanded, setIsExpanded, isPinned, setIsPinned, sidebarWidth }),
    [isExpanded, setIsExpanded, isPinned, setIsPinned, sidebarWidth]
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
