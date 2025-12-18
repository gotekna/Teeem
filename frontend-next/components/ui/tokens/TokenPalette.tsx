"use client";

/**
 * TokenPalette - Searchable palette of available placeholder tokens
 *
 * THE ONE component for showing available placeholders to insert.
 * See: frontend-next/lib/component-registry.ts
 *
 * Usage:
 * ```tsx
 * import { TokenPalette } from "@/components/ui/tokens";
 *
 * <TokenPalette
 *   scope="company"
 *   onSelect={(code) => insertToken(code)}
 *   showLongVariants
 * />
 * ```
 */

import * as React from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import {
  type PlaceholderToken,
  type PlaceholderScope,
  getPlaceholders,
  PLACEHOLDER_COLOR_CLASSES,
} from "@/lib/placeholders";

export interface TokenPaletteProps {
  /** Scope of placeholders to show */
  scope?: PlaceholderScope;
  /** Custom list of placeholders (overrides scope) */
  placeholders?: PlaceholderToken[];
  /** Callback when a token is selected */
  onSelect: (code: string, isLong: boolean) => void;
  /** Whether to show long variants column */
  showLongVariants?: boolean;
  /** Whether to show search input */
  showSearch?: boolean;
  /** Additional class names */
  className?: string;
  /** Maximum height (uses ScrollArea) */
  maxHeight?: string;
  /** Header text */
  header?: string;
}

export function TokenPalette({
  scope = "all",
  placeholders: customPlaceholders,
  onSelect,
  showLongVariants = true,
  showSearch = true,
  className,
  maxHeight = "400px",
  header = "Placeholders",
}: TokenPaletteProps) {
  const [search, setSearch] = React.useState("");

  const allPlaceholders = customPlaceholders || getPlaceholders(scope);

  // Filter by search
  const filteredPlaceholders = React.useMemo(() => {
    if (!search.trim()) return allPlaceholders;
    const query = search.toLowerCase();
    return allPlaceholders.filter(
      (p) =>
        p.code.toLowerCase().includes(query) ||
        p.example.toLowerCase().includes(query) ||
        p.longCode?.toLowerCase().includes(query) ||
        p.longExample?.toLowerCase().includes(query) ||
        p.description?.toLowerCase().includes(query)
    );
  }, [allPlaceholders, search]);

  return (
    <div className={cn("flex flex-col border rounded-none bg-background", className)}>
      {/* Header */}
      <div className="px-3 py-2 border-b bg-muted/50">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">{header}</span>
          {showSearch && (
            <div className="relative w-32">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
              <Input
                placeholder="Search..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-7 pl-7 text-xs"
              />
            </div>
          )}
        </div>
      </div>

      {/* Column Headers */}
      {showLongVariants && (
        <div className="grid grid-cols-2 gap-2 px-3 py-1.5 border-b bg-muted/30 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
          <div>Short</div>
          <div>Long</div>
        </div>
      )}

      {/* Placeholder List */}
      <ScrollArea style={{ maxHeight }} className="flex-1">
        <div className="p-2 space-y-1">
          {filteredPlaceholders.length === 0 ? (
            <div className="text-sm text-muted-foreground text-center py-4">
              No placeholders found
            </div>
          ) : (
            filteredPlaceholders.map((placeholder, index) => (
              <TokenPaletteItem
                key={`${placeholder.code}-${index}`}
                placeholder={placeholder}
                onSelect={onSelect}
                showLongVariant={showLongVariants}
              />
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

// =============================================================================
// PALETTE ITEM
// =============================================================================

interface TokenPaletteItemProps {
  placeholder: PlaceholderToken;
  onSelect: (code: string, isLong: boolean) => void;
  showLongVariant: boolean;
}

function TokenPaletteItem({
  placeholder,
  onSelect,
  showLongVariant,
}: TokenPaletteItemProps) {
  const colorClasses = PLACEHOLDER_COLOR_CLASSES[placeholder.color];

  const TokenButton = ({
    code,
    example,
    isLong,
  }: {
    code: string;
    example: string;
    isLong: boolean;
  }) => (
    <button
      type="button"
      onClick={() => onSelect(code, isLong)}
      className={cn(
        "flex flex-col items-start p-1.5 rounded-none border text-left w-full",
        "hover:shadow-sm transition-shadow cursor-pointer",
        colorClasses.bg,
        colorClasses.border,
        "hover:opacity-90"
      )}
      title={`Click to insert ${code}`}
    >
      <span className={cn("font-mono text-[11px] font-medium truncate w-full", colorClasses.text)}>
        {placeholder.label || code}
      </span>
      <span className="text-[10px] text-muted-foreground truncate w-full">
        {example}
      </span>
    </button>
  );

  if (showLongVariant) {
    return (
      <div className="grid grid-cols-2 gap-2">
        <TokenButton
          code={placeholder.code}
          example={placeholder.example}
          isLong={false}
        />
        {placeholder.longCode ? (
          <TokenButton
            code={placeholder.longCode}
            example={placeholder.longExample || placeholder.example}
            isLong={true}
          />
        ) : (
          <div className="p-1.5 text-[10px] text-muted-foreground italic flex items-center">
            —
          </div>
        )}
      </div>
    );
  }

  return (
    <TokenButton
      code={placeholder.code}
      example={placeholder.example}
      isLong={false}
    />
  );
}
