"use client";

import React, { useRef, useCallback, useEffect, useState, memo } from "react";
import { Search, X, Loader2, MoreHorizontal, Check } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// Search mode types
export type SearchMode = "contains" | "exact" | "starts_with" | "fuzzy" | "regex";

interface SearchModeConfig {
  id: SearchMode;
  label: string;
  icon: string;
  description: string;
}

const SEARCH_MODES: SearchModeConfig[] = [
  { id: "contains", label: "Contains", icon: "∋", description: "Match anywhere in text" },
  { id: "exact", label: "Exact Match", icon: "=", description: "Match the exact text only" },
  { id: "starts_with", label: "Starts With", icon: "^", description: "Match text at the start" },
  { id: "fuzzy", label: "Fuzzy Search", icon: "≈", description: "Tolerates typos (e.g., 'acount' → 'account')" },
  { id: "regex", label: "Regex", icon: ".*", description: "Use regular expressions" },
];

interface SearchInputProps {
  value: string;
  onSearch: (value: string, mode?: SearchMode) => void;
  onSearchAllChange: (checked: boolean) => void;
  searchAllColumns: boolean;
  serverSearchLoading: boolean;
  hasServerSearch: boolean;
  searchMode?: SearchMode;
  onSearchModeChange?: (mode: SearchMode) => void;
  showModeSelector?: boolean;
}

export const SearchInput = memo(function SearchInput({
  value,
  onSearch,
  onSearchAllChange,
  searchAllColumns,
  serverSearchLoading,
  hasServerSearch,
  searchMode = "contains",
  onSearchModeChange,
  showModeSelector = true,
}: SearchInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  // Track local input value for controlled input
  const [localValue, setLocalValue] = useState(value);
  const [localMode, setLocalMode] = useState<SearchMode>(searchMode);

  // Sync local value with prop value when it changes externally
  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  // Sync local mode with prop mode when it changes externally
  useEffect(() => {
    setLocalMode(searchMode);
  }, [searchMode]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value;
      setLocalValue(newValue);

      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }

      debounceRef.current = setTimeout(() => {
        onSearch(newValue, localMode);
      }, 300);
    },
    [onSearch, localMode]
  );

  const handleClear = useCallback(() => {
    setLocalValue("");
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    onSearch("", localMode);
  }, [onSearch, localMode]);

  const handleModeChange = useCallback((mode: SearchMode) => {
    setLocalMode(mode);
    onSearchModeChange?.(mode);

    // Re-trigger search with new mode if there's a value
    if (localValue) {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
      // Immediate search on mode change
      onSearch(localValue, mode);
    }
  }, [localValue, onSearch, onSearchModeChange]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  const currentMode = SEARCH_MODES.find(m => m.id === localMode) || SEARCH_MODES[0];

  return (
    <div className="flex items-center gap-2 flex-1">
      <div className="relative flex-1 max-w-md">
        {serverSearchLoading ? (
          <Loader2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
        ) : (
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        )}
        <Input
          ref={inputRef}
          type="text"
          value={localValue}
          onChange={handleChange}
          placeholder={
            hasServerSearch ? "Search all records..." : "Search across all fields..."
          }
          className="pl-9 pr-9"
          aria-label="Search table"
          aria-busy={serverSearchLoading}
          aria-describedby={localValue ? "search-clear-hint" : undefined}
        />
        {localValue && (
          <button
            onClick={handleClear}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            aria-label="Clear search"
            type="button"
          >
            <X className="h-4 w-4" />
            <span id="search-clear-hint" className="sr-only">
              Press to clear search
            </span>
          </button>
        )}
      </div>

      {/* Search Options Menu - "..." button */}
      {showModeSelector && hasServerSearch && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="h-9 w-9 p-0"
              title="Search options"
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            {/* Search All Columns Toggle */}
            <DropdownMenuItem
              onClick={(e) => {
                e.preventDefault();
                onSearchAllChange(!searchAllColumns);
              }}
              className="flex items-center justify-between py-2 cursor-pointer"
            >
              <div className="flex-1">
                <div className="font-medium text-sm">Search all columns</div>
                <div className="text-xs text-muted-foreground">
                  {searchAllColumns
                    ? "Searching all columns including hidden"
                    : "Only searching key columns (name, ID, etc.)"}
                </div>
              </div>
              {searchAllColumns && <Check className="h-4 w-4 text-primary" />}
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            {/* Search Mode Label */}
            <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
              Match Type
            </div>

            {/* Search Modes */}
            {SEARCH_MODES.map((mode) => (
              <DropdownMenuItem
                key={mode.id}
                onClick={() => handleModeChange(mode.id)}
                className="flex items-center gap-3 py-2 cursor-pointer"
              >
                <span className="font-mono text-sm w-5 text-center opacity-70">
                  {mode.icon}
                </span>
                <div className="flex-1">
                  <div className="font-medium text-sm">{mode.label}</div>
                  <div className="text-xs text-muted-foreground">
                    {mode.description}
                  </div>
                </div>
                {localMode === mode.id && <Check className="h-4 w-4 text-primary" />}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
});
