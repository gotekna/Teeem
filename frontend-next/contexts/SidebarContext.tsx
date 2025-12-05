"use client";

import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
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

export function SidebarProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [isExpanded, setIsExpandedState] = useState(false);

  // Load saved state for current route on mount and route change
  useEffect(() => {
    const baseRoute = getBaseRoute(pathname);
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const states: Record<string, boolean> = JSON.parse(saved);
        // Use saved state for this route, or default to false (collapsed)
        setIsExpandedState(states[baseRoute] ?? false);
      }
    } catch (e) {
      // Ignore localStorage errors
    }
  }, [pathname]);

  // Wrapper to save state when changed
  const setIsExpanded = (expanded: boolean) => {
    setIsExpandedState(expanded);
    const baseRoute = getBaseRoute(pathname);
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      const states: Record<string, boolean> = saved ? JSON.parse(saved) : {};
      states[baseRoute] = expanded;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(states));
    } catch (e) {
      // Ignore localStorage errors
    }
  };

  const sidebarWidth = isExpanded ? EXPANDED_WIDTH : COLLAPSED_WIDTH;

  return (
    <SidebarContext.Provider value={{ isExpanded, setIsExpanded, sidebarWidth }}>
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
