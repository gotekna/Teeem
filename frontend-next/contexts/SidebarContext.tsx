"use client";

import { createContext, useContext, useState, useMemo, type ReactNode } from "react";
import { usePathname } from "next/navigation";

interface SidebarContextType {
  isExpanded: boolean;
  setIsExpanded: (expanded: boolean) => void;
  sidebarWidth: number;
}

const SidebarContext = createContext<SidebarContextType | undefined>(undefined);

const COLLAPSED_WIDTH = 70;
const EXPANDED_WIDTH = 240;
const STORAGE_KEY = "teeem-sidebar-state";

// Get the base route (e.g., "/jobs/123" -> "jobs", "/contacts" -> "contacts")
function getBaseRoute(pathname: string): string {
  const parts = pathname.split("/").filter(Boolean);
  return parts[0] || "dashboard";
}

// Get state from localStorage synchronously
function getStoredState(baseRoute: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const states: Record<string, boolean> = JSON.parse(saved);
      return states[baseRoute] ?? false;
    }
  } catch {
    // Ignore localStorage errors
  }
  return false;
}

// Save state to localStorage
function saveState(baseRoute: string, expanded: boolean): void {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    const states: Record<string, boolean> = saved ? JSON.parse(saved) : {};
    states[baseRoute] = expanded;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(states));
  } catch {
    // Ignore localStorage errors
  }
}

// Inner component that handles state for a specific route
// Using key={baseRoute} on this component causes it to remount when route changes,
// which resets state to the stored value for the new route (avoids setState in useEffect)
function SidebarStateProvider({ baseRoute, children }: { baseRoute: string; children: ReactNode }) {
  // Initialize state with stored value for this route
  const [isExpanded, setIsExpandedState] = useState(() => getStoredState(baseRoute));

  // Wrapper to save state when changed - stable reference since baseRoute doesn't change
  // (component remounts with new key when baseRoute changes)
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

export function SidebarProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const baseRoute = getBaseRoute(pathname);

  // Key forces remount when route changes, resetting state to stored value
  // This is the React-recommended pattern to reset state on prop change
  // without using useEffect + setState (PATTERN-005)
  return (
    <SidebarStateProvider key={baseRoute} baseRoute={baseRoute}>
      {children}
    </SidebarStateProvider>
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
