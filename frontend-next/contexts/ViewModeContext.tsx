"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { getStorageItem, setStorageItem, STORAGE_KEYS } from "@/lib/storage-utils";

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
    const stored = getStorageItem<ViewMode>(STORAGE_KEYS.VIEW_MODE, "table");
    if (stored === "table" || stored === "relational") {
      setViewModeState(stored);
    }
  }, []);

  // Save to localStorage when changed
  const setViewMode = (mode: ViewMode) => {
    setViewModeState(mode);
    if (isClient) {
      setStorageItem(STORAGE_KEYS.VIEW_MODE, mode);
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
