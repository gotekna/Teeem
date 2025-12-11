"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";

type ViewMode = "table" | "relational";

interface ViewModeContextType {
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  toggleViewMode: () => void;
}

const ViewModeContext = createContext<ViewModeContextType | undefined>(undefined);

export function ViewModeProvider({ children }: { children: ReactNode }) {
  const [viewMode, setViewModeState] = useState<ViewMode>("table");
  const [isClient, setIsClient] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    setIsClient(true);
    const stored = localStorage.getItem("teeem_view_mode");
    if (stored === "table" || stored === "relational") {
      setViewModeState(stored);
    }
  }, []);

  // Save to localStorage when changed
  const setViewMode = (mode: ViewMode) => {
    setViewModeState(mode);
    if (isClient) {
      localStorage.setItem("teeem_view_mode", mode);
    }
  };

  const toggleViewMode = () => {
    const newMode = viewMode === "table" ? "relational" : "table";
    setViewMode(newMode);
  };

  return (
    <ViewModeContext.Provider value={{ viewMode, setViewMode, toggleViewMode }}>
      {children}
    </ViewModeContext.Provider>
  );
}

export function useViewMode() {
  const context = useContext(ViewModeContext);
  if (context === undefined) {
    throw new Error("useViewMode must be used within a ViewModeProvider");
  }
  return context;
}
