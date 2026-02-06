"use client";

/**
 * PlaceholderPalette - Searchable palette of available placeholder tokens
 *
 * THE ONE component for showing available placeholders to insert.
 * See: frontend-next/lib/component-registry.ts
 *
 * Usage:
 * ```tsx
 * import { PlaceholderPalette } from "@/components/ui/placeholders";
 *
 * <PlaceholderPalette
 *   scope="company"
 *   onSelect={(code) => insertPlaceholder(code)}
 *   showLongVariants
 * />
 * ```
 */

import * as React from "react";
import { Search, Briefcase, Mail, Building2, Calendar, FileText, FolderTree, ListFilter, Wrench, ChevronDown, ChevronRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  type PlaceholderToken,
  type PlaceholderScope,
  getPlaceholders,
  PLACEHOLDER_COLOR_CLASSES,
} from "@/lib/placeholders";

// =====================================================================
// SSoT: Category filter for placeholders (Feb 2026)
// Matches PlaceholderBuilder component for consistent UX
// =====================================================================
type TokenCategory = "all" | "job" | "task" | "email" | "company" | "date" | "folder" | "other";

interface CategoryConfig {
  label: string;
  icon: React.ElementType;
  color: string;
  match: (token: PlaceholderToken) => boolean;
}

const CATEGORY_CONFIG: Record<TokenCategory, CategoryConfig> = {
  all: {
    label: "All",
    icon: ListFilter,
    color: "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600",
    match: () => true,
  },
  job: {
    label: "Job",
    icon: Briefcase,
    color: "bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 border-orange-300 dark:border-orange-700",
    match: (t) => /\{?\{?Job|LotNumber|StreetName|Suburb|Project/i.test(t.code),
  },
  task: {
    label: "Task",
    icon: Wrench,
    color: "bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 border-orange-300 dark:border-orange-700",
    match: (t) => /\{?\{?Task|Attachment|Response|\[\[Attachment|\[\[Response/i.test(t.code),
  },
  email: {
    label: "Email",
    icon: Mail,
    color: "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-700",
    match: (t) => /\{?\{?Subject|Sender|Received|Mailbox|\[\[Email/i.test(t.code),
  },
  company: {
    label: "Company",
    icon: Building2,
    color: "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border-purple-300 dark:border-purple-700",
    match: (t) => /\{?\{?Company|Person|Contact|User|Account|Asset|Bank|BSB|Loan|Lender/i.test(t.code),
  },
  date: {
    label: "Date",
    icon: Calendar,
    color: "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-green-300 dark:border-green-700",
    match: (t) => /\{?\{?Date|Year|Month|Time|Day|FY|Period|YYYY|DDMM|\{EX\}|Expiry/i.test(t.code),
  },
  folder: {
    label: "Doc",
    icon: FileText,
    color: "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-700",
    match: (t) => /DocType|\{BA\}|\{FIA\}|\{Occ\}|BuildingApproval|FinalInspection|Certificate|FormNumber|Invoice|PONum|PONumber/i.test(t.code),
  },
  other: {
    label: "Other",
    icon: FolderTree,
    color: "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600",
    match: () => true, // Fallback for uncategorized
  },
};

// Get category for a token
function getTokenCategory(token: PlaceholderToken): TokenCategory {
  // Check in priority order (more specific first)
  // Email before task so [[Email Attachments]] categorizes as email not task
  if (CATEGORY_CONFIG.email.match(token)) return "email";
  if (CATEGORY_CONFIG.task.match(token)) return "task";
  if (CATEGORY_CONFIG.job.match(token)) return "job";
  if (CATEGORY_CONFIG.company.match(token)) return "company";
  if (CATEGORY_CONFIG.date.match(token)) return "date";
  if (CATEGORY_CONFIG.folder.match(token)) return "folder";
  if (CATEGORY_CONFIG.other.match(token)) return "other";
  return "other";
}

export interface PlaceholderPaletteProps {
  /** Scope of placeholders to show */
  scope?: PlaceholderScope;
  /** Custom list of placeholders (overrides scope) */
  placeholders?: PlaceholderToken[];
  /** Callback when a placeholder is selected */
  onSelect: (code: string, isLong: boolean) => void;
  /** Whether to show long variants column */
  showLongVariants?: boolean;
  /** Whether to show search input */
  showSearch?: boolean;
  /** Whether to show category filter badges */
  showCategoryFilter?: boolean;
  /** Additional class names */
  className?: string;
  /** Maximum height (uses ScrollArea) */
  maxHeight?: string;
  /** Header text */
  header?: string;
  /** Make the palette collapsible */
  collapsible?: boolean;
  /** Default collapsed state (only used if collapsible=true) */
  defaultCollapsed?: boolean;
}

export function PlaceholderPalette({
  scope = "all",
  placeholders: customPlaceholders,
  onSelect,
  showLongVariants = true,
  showSearch = true,
  showCategoryFilter = true,
  className,
  maxHeight = "400px",
  header = "Placeholders",
  collapsible = false,
  defaultCollapsed = true,
}: PlaceholderPaletteProps) {
  const [search, setSearch] = React.useState("");
  const [category, setCategory] = React.useState<TokenCategory>("all");
  const [isOpen, setIsOpen] = React.useState(!defaultCollapsed);

  const allPlaceholders = customPlaceholders || getPlaceholders(scope);

  // Filter by search and category
  const filteredPlaceholders = React.useMemo(() => {
    let result = allPlaceholders;

    // Filter by category
    if (category !== "all") {
      result = result.filter((p) => getTokenCategory(p) === category);
    }

    // Filter by search
    if (search.trim()) {
      const query = search.toLowerCase();
      result = result.filter(
        (p) =>
          p.code.toLowerCase().includes(query) ||
          p.example.toLowerCase().includes(query) ||
          p.longCode?.toLowerCase().includes(query) ||
          p.longExample?.toLowerCase().includes(query) ||
          p.description?.toLowerCase().includes(query)
      );
    }

    return result;
  }, [allPlaceholders, search, category]);

  // Content that can be collapsed
  const paletteContent = (
    <>
      {/* Category Filter Buttons - SSoT (Feb 2026) */}
      {showCategoryFilter && (
        <div className="flex flex-wrap gap-1 px-3 py-2 border-b bg-muted/30">
          {(["all", "job", "task", "email", "company", "date", "folder", "other"] as TokenCategory[]).map((cat) => {
            const config = CATEGORY_CONFIG[cat];
            const Icon = config.icon;
            const isActive = category === cat;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setCategory(cat)}
                className={cn(
                  "inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-medium border transition-all",
                  isActive
                    ? config.color + " ring-1 ring-offset-0 ring-primary/50"
                    : "bg-background hover:bg-muted text-muted-foreground border-muted-foreground/30 hover:border-muted-foreground/50"
                )}
              >
                <Icon className="h-2.5 w-2.5" />
                <span>{config.label}</span>
              </button>
            );
          })}
        </div>
      )}

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
    </>
  );

  // Header content (shared between collapsible and non-collapsible modes)
  const headerContent = (
    <div className="flex items-center justify-between w-full">
      <div className="flex items-center gap-2">
        {collapsible && (
          isOpen ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )
        )}
        <span className="text-sm font-medium">{header}</span>
        {collapsible && !isOpen && (
          <span className="text-xs text-muted-foreground">
            ({filteredPlaceholders.length} tokens)
          </span>
        )}
      </div>
      {showSearch && isOpen && (
        <div className="relative w-32" onClick={(e) => e.stopPropagation()}>
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
  );

  if (collapsible) {
    return (
      <Collapsible open={isOpen} onOpenChange={setIsOpen} className={cn("flex flex-col border rounded-none bg-background", className)}>
        <CollapsibleTrigger asChild>
          <div className="px-3 py-2 border-b bg-muted/50 cursor-pointer hover:bg-muted/70 transition-colors">
            {headerContent}
          </div>
        </CollapsibleTrigger>
        <CollapsibleContent>
          {paletteContent}
        </CollapsibleContent>
      </Collapsible>
    );
  }

  return (
    <div className={cn("flex flex-col border rounded-none bg-background", className)}>
      {/* Header */}
      <div className="px-3 py-2 border-b bg-muted/50">
        {headerContent}
      </div>
      {paletteContent}
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

// Backwards compatibility aliases (DEPRECATED - use PlaceholderPalette)
export type TokenPaletteProps = PlaceholderPaletteProps;
export const TokenPalette = PlaceholderPalette;
