"use client";

import React, { useCallback, useEffect, useState, memo } from "react";
import {
  Search,
  X,
  MoreHorizontal,
  Check,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTableMaybe } from "../context";

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
  /** @deprecated Use TableContext instead. Search query value. */
  value?: string;
  /** @deprecated Use TableContext instead. Callback when search is triggered. */
  onSearch?: (value: string, mode?: SearchMode) => void;
  /** @deprecated Use TableContext instead. Callback to toggle searchAllColumns. */
  onSearchAllChange?: (checked: boolean) => void;
  /** @deprecated Use TableContext instead. Whether to search all columns. */
  searchAllColumns?: boolean;
  /** Whether server search is loading (async indicator) */
  serverSearchLoading?: boolean;
  /** Whether server search is available (feature flag) */
  hasServerSearch?: boolean;
  /** @deprecated Use TableContext instead. Current search mode. */
  searchMode?: SearchMode;
  /** @deprecated Use TableContext instead. Callback to change search mode. */
  onSearchModeChange?: (mode: SearchMode) => void;
  /** Whether to show the mode selector dropdown */
  showModeSelector?: boolean;
}

export const SearchInput = memo(function SearchInput({
  value: propValue,
  onSearch: propOnSearch,
  onSearchAllChange: propOnSearchAllChange,
  searchAllColumns: propSearchAllColumns,
  serverSearchLoading = false,
  hasServerSearch = false,
  searchMode: propSearchMode,
  onSearchModeChange: propOnSearchModeChange,
  showModeSelector = true,
}: SearchInputProps) {
  // Try to get values from context first
  const table = useTableMaybe();

  // Resolve values: context first, props as fallback
  const contextValue = table?.search.state.query ?? '';
  const contextSearchAllColumns = table?.search.state.searchAllColumns ?? false;
  const contextSearchMode = table?.search.state.mode ?? 'contains';

  // Effective values (context wins if available)
  const effectiveValue = table ? contextValue : (propValue ?? '');
  const effectiveSearchAllColumns = table ? contextSearchAllColumns : (propSearchAllColumns ?? false);
  const effectiveSearchMode = table ? contextSearchMode : (propSearchMode ?? 'contains');

  // Track local input value for controlled input
  const [localValue, setLocalValue] = useState(effectiveValue);
  const [localMode, setLocalMode] = useState<SearchMode>(effectiveSearchMode);

  // Sync local value with effective value when it changes externally
  useEffect(() => {
    setLocalValue(effectiveValue);
  }, [effectiveValue]);

  // Sync local mode with effective mode when it changes externally
  useEffect(() => {
    setLocalMode(effectiveSearchMode);
  }, [effectiveSearchMode]);

  // Only update local state on change - search fires on Enter
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setLocalValue(e.target.value);
    },
    []
  );

  // Search on Enter key press
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        // Use context actions if available, otherwise fall back to props
        if (table) {
          table.search.actions.setQuery(localValue);
          table.search.actions.setMode(localMode);
        }
        propOnSearch?.(localValue, localMode);
      }
    },
    [localValue, localMode, table, propOnSearch]
  );

  // Clear search immediately (resets results)
  const handleClear = useCallback(() => {
    setLocalValue("");
    // Use context actions if available, otherwise fall back to props
    if (table) {
      table.search.actions.clearQuery();
    }
    propOnSearch?.("", localMode);
  }, [table, propOnSearch, localMode]);

  // Mode change triggers immediate search if there's a value
  const handleModeChange = useCallback((mode: SearchMode) => {
    setLocalMode(mode);

    // Use context actions if available, otherwise fall back to props
    if (table) {
      table.search.actions.setMode(mode);
      // Re-trigger search with new mode if there's a value
      if (localValue) {
        table.search.actions.setQuery(localValue);
      }
    }
    propOnSearchModeChange?.(mode);
    // Re-trigger search with new mode if there's a value (for props fallback)
    if (localValue) {
      propOnSearch?.(localValue, mode);
    }
  }, [localValue, table, propOnSearch, propOnSearchModeChange]);

  const currentMode = SEARCH_MODES.find(m => m.id === localMode) || SEARCH_MODES[0];

  return (
    <div className="flex items-center gap-2 flex-1">
      <div className="relative flex-1 max-w-md">
        {serverSearchLoading ? (
          <Spinner size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        ) : (
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        )}
        <Input
          type="text"
          value={localValue}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={
            hasServerSearch ? "Search all records... (press Enter)" : "Search... (press Enter)"
          }
          className="pl-9 pr-9"
          aria-label="Search table - press Enter to search"
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
                // Use context actions if available, otherwise fall back to props
                if (table) {
                  table.search.actions.toggleSearchAllColumns();
                }
                propOnSearchAllChange?.(!effectiveSearchAllColumns);
              }}
              className="flex items-center justify-between py-2 cursor-pointer"
            >
              <div className="flex-1">
                <div className="font-medium text-sm">Search all columns</div>
                <div className="text-xs text-muted-foreground">
                  {effectiveSearchAllColumns
                    ? "Searching all columns including hidden"
                    : "Only searching key columns (name, ID, etc.)"}
                </div>
              </div>
              {effectiveSearchAllColumns && <Check className="h-4 w-4 text-primary" />}
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
