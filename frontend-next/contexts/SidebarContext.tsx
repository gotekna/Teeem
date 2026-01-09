"use client";

import { createContext, useContext, useState, useMemo, useEffect, useRef, type ReactNode } from "react";
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
