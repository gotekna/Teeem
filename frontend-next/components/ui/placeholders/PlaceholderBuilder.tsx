"use client";

/**
 * PlaceholderBuilder - Draggable placeholder tokens with preview
 *
 * THE ONE component for building template strings with placeholders.
 * Used for document file naming, display names, email templates, etc.
 * See: frontend-next/lib/component-registry.ts
 *
 * Features:
 * - Click palette items to add placeholders
 * - Drag placeholders within template to reorder
 * - Click X to remove placeholders
 * - Live preview of resolved template
 *
 * Usage:
 * ```tsx
 * import { PlaceholderBuilder } from "@/components/ui/placeholders";
 *
 * <PlaceholderBuilder
 *   value="{CompanyCode} - {Description}"
 *   onChange={(newValue) => setTemplate(newValue)}
 *   scope="company"
 *   showPreview
 *   previewData={{ CompanyCode: "TH", Description: "Example" }}
 * />
 * ```
 */

import * as React from "react";
import { Plus, GripVertical, X, Search, ChevronDown, ChevronUp, Briefcase, Mail, Building2, Calendar, FileText, FolderTree, ListFilter, Wrench } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  type PlaceholderScope,
  type PlaceholderToken,
  type PlaceholderColor,
  parseTemplate,
  buildTemplate,
  resolveWithExamples,
  getPlaceholderColor,
  getPlaceholders,
  PLACEHOLDER_COLOR_CLASSES,
} from "@/lib/placeholders";

// Category definitions for grouping tokens
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
import {
  DndContext,
  DragOverlay,
  closestCenter,
  type DragEndEvent,
  type DragStartEvent,
  type DragOverEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  arrayMove,
  horizontalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { restrictToWindowEdges } from "@dnd-kit/modifiers";
import { createDndSensors } from "@/components/ui/dnd/dnd-config";

export interface PlaceholderBuilderProps {
  /** Current template value */
  value: string;
  /** Callback when value changes */
  onChange: (value: string) => void;
  /** Scope of placeholders to show */
  scope?: PlaceholderScope;
  /** Custom placeholders (overrides scope) */
  placeholders?: PlaceholderToken[];
  /** Whether to show live preview */
  showPreview?: boolean;
  /** Custom preview data (overrides examples) */
  previewData?: Record<string, string>;
  /** Whether preview should use long variants */
  previewUseLong?: boolean;
  /** Label for the field */
  label?: React.ReactNode;
  /** Placeholder text for empty state */
  placeholder?: string;
  /** Whether the field is disabled */
  disabled?: boolean;
  /** Additional class names */
  className?: string;
  /** Error message */
  error?: string;
  /** Help text */
  helpText?: string;
  /** Whether palette is expanded by default */
  defaultExpanded?: boolean;
  /** Separator between tokens. Use "/" for folder paths, " " for text. Default: " " */
  separator?: string;
  /** Read-only prefix value (inherited tokens shown greyed out before editable tokens) */
  prefixValue?: string;
  /** Default value shown as hint when value is empty. Visual only - NOT persisted on save. */
  defaultValue?: string;
}

// Token item with unique ID for drag-and-drop
interface TokenItem {
  id: string;
  type: "placeholder" | "text";
  value: string;
}

// Sortable token component
function SortableToken({
  item,
  disabled,
  onRemove,
  order,
  totalOrdered,
  onReorder,
}: {
  item: TokenItem;
  disabled: boolean;
  onRemove: () => void;
  order?: number;
  totalOrdered?: number;
  onReorder?: (fromOrder: number, toOrder: number) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  // Separator tokens (e.g., "/" in folder paths) - small, not draggable
  // In folder path mode, separators are structurally required (auto-normalized)
  // so don't show delete button - they can't actually be removed
  const isSeparator = item.type === "text" && /^[\s/]+$/.test(item.value);

  if (isSeparator) {
    return (
      <span
        ref={setNodeRef}
        style={style}
        className={cn(
          "inline-flex items-center text-sm font-mono px-1 py-0.5 text-muted-foreground/50 group",
          isDragging && "!opacity-0 h-0 !p-0 !m-0 overflow-hidden !w-0"
        )}
      >
        <span>/</span>
        {!disabled && (
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            className="opacity-0 group-hover:opacity-60 hover:!opacity-100 transition-opacity ml-0.5"
          >
            <X className="h-2.5 w-2.5" />
          </button>
        )}
      </span>
    );
  }

  const color = item.type === "placeholder" ? getPlaceholderColor(item.value) : "gray";
  const colorClasses = PLACEHOLDER_COLOR_CLASSES[color];

  return (
    <span
      ref={setNodeRef}
      style={style}
      className={cn(
        "inline-flex items-center font-mono text-xs px-2 py-1 gap-1.5 rounded-none border",
        colorClasses.bg,
        colorClasses.text,
        colorClasses.border,
        isDragging && "!opacity-0 h-0 !p-0 !m-0 overflow-hidden !border-0 !w-0",
        !disabled && "cursor-grab active:cursor-grabbing"
      )}
    >
      {/* Order Number — click to type a new position */}
      {order !== undefined && (
        <input
          type="text"
          inputMode="numeric"
          defaultValue={order}
          key={order}
          onPointerDown={(e) => e.stopPropagation()}
          onFocus={(e) => e.target.select()}
          onBlur={(e) => {
            const newPos = parseInt(e.target.value, 10);
            if (!isNaN(newPos) && newPos >= 1 && newPos <= (totalOrdered || order) && newPos !== order && onReorder) {
              onReorder(order, newPos);
            } else {
              e.target.value = String(order);
            }
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            if (e.key === "Escape") {
              (e.target as HTMLInputElement).value = String(order);
              (e.target as HTMLInputElement).blur();
            }
            e.stopPropagation();
          }}
          className="h-4 w-5 rounded-sm bg-foreground/15 text-[10px] font-bold text-center border-0 p-0 outline-none focus:ring-1 focus:ring-primary/50 focus:bg-foreground/25"
        />
      )}

      {/* Drag Handle */}
      {!disabled && (
        <span
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing touch-none"
          onClick={(e) => e.stopPropagation()}
        >
          <GripVertical className="h-3 w-3 opacity-50" />
        </span>
      )}

      {/* Token Value */}
      <span className="truncate">{item.value}</span>

      {/* Remove Button - onPointerDown stops dnd-kit sensor from intercepting */}
      {!disabled && (
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="hover:opacity-100 opacity-60 transition-opacity"
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </span>
  );
}

// Drop indicator shown between tokens during drag — thick black line
function DropIndicator() {
  return (
    <div className="w-[3px] self-stretch min-h-[32px] bg-foreground rounded-full shadow-[0_0_6px_rgba(0,0,0,0.3)]" />
  );
}

// Drag overlay token (shown while dragging) - distinctive with ring + shadow
function DragOverlayToken({ item, order }: { item: TokenItem; order?: number }) {
  const isSeparator = item.type === "text" && /^[\s/]+$/.test(item.value);
  if (isSeparator) {
    return <span className="text-sm font-mono text-muted-foreground px-1">/</span>;
  }

  const color = item.type === "placeholder" ? getPlaceholderColor(item.value) : "gray";
  const colorClasses = PLACEHOLDER_COLOR_CLASSES[color];

  return (
    <span
      className={cn(
        "inline-flex items-center font-mono text-xs px-2 py-1 gap-1.5 rounded-none border",
        "shadow-xl ring-2 ring-foreground/40 scale-110",
        colorClasses.bg,
        colorClasses.text,
        colorClasses.border
      )}
    >
      {order !== undefined && (
        <span className="inline-flex items-center justify-center h-4 w-4 rounded-sm bg-foreground/15 text-[10px] font-bold leading-none">
          {order}
        </span>
      )}
      <GripVertical className="h-3 w-3 opacity-50" />
      <span className="truncate">{item.value}</span>
      <X className="h-3 w-3 opacity-60" />
    </span>
  );
}

// Read-only token (for inherited/prefix values - greyed out, non-removable)
function ReadOnlyToken({ item }: { item: TokenItem }) {
  return (
    <span
      className={cn(
        "inline-flex items-center font-mono text-xs px-2 py-1 rounded-none border",
        "bg-muted/50 text-muted-foreground border-muted-foreground/30 opacity-60"
      )}
    >
      <span className="truncate">{item.value}</span>
    </span>
  );
}

// Default token (shown as hint when value is empty - NOT persisted)
function DefaultToken({ item }: { item: TokenItem }) {
  return (
    <span
      className={cn(
        "inline-flex items-center font-mono text-xs px-2 py-1 rounded-none border border-dashed",
        "bg-muted/30 text-muted-foreground/50 border-muted-foreground/20"
      )}
    >
      <span className="truncate">{item.value}</span>
    </span>
  );
}

export function PlaceholderBuilder({
  value,
  onChange,
  scope = "all",
  placeholders: customPlaceholders,
  showPreview = true,
  previewData,
  previewUseLong = false,
  label,
  placeholder = "Click a token below to add it...",
  disabled = false,
  className,
  error,
  helpText,
  defaultExpanded = false,
  separator = " ",
  prefixValue,
  defaultValue,
}: TokenBuilderProps) {
  const [customText, setCustomText] = React.useState("");
  const [activeId, setActiveId] = React.useState<string | null>(null);
  const [overId, setOverId] = React.useState<string | null>(null);
  const [paletteExpanded, setPaletteExpanded] = React.useState(defaultExpanded);
  const [search, setSearch] = React.useState("");
  const [categoryFilter, setCategoryFilter] = React.useState<TokenCategory>("all");
  const inputRef = React.useRef<HTMLInputElement>(null);
  const sensors = createDndSensors();

  // Folder path mode: separator is "/" (used for warehouse path templates)
  const isFolderPathMode = separator === "/";

  // Clean double slashes in folder path mode, but don't force separators
  // between adjacent tokens - users may want {{JobCode}}{{JobName}} as one segment
  const emitChange = React.useCallback((newValue: string) => {
    if (isFolderPathMode) {
      onChange(newValue.replace(/\/+/g, "/"));
    } else {
      onChange(newValue);
    }
  }, [isFolderPathMode, onChange]);

  // Get placeholders
  const allPlaceholders = customPlaceholders || getPlaceholders(scope);

  // Get available categories (only show categories that have tokens)
  const availableCategories = React.useMemo(() => {
    const categories = new Set<TokenCategory>();
    categories.add("all"); // Always show "All"
    allPlaceholders.forEach((p) => {
      categories.add(getTokenCategory(p));
    });
    // Return in display order
    const order: TokenCategory[] = ["all", "job", "task", "email", "company", "date", "folder", "other"];
    return order.filter((c) => categories.has(c));
  }, [allPlaceholders]);

  // Filter placeholders by category and search
  const filteredPlaceholders = React.useMemo(() => {
    let filtered = allPlaceholders;

    // Filter by category
    if (categoryFilter !== "all") {
      filtered = filtered.filter((p) => getTokenCategory(p) === categoryFilter);
    }

    // Filter by search
    if (search.trim()) {
      const query = search.toLowerCase();
      filtered = filtered.filter(
        (p) =>
          p.code.toLowerCase().includes(query) ||
          p.example.toLowerCase().includes(query) ||
          p.description?.toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [allPlaceholders, categoryFilter, search]);

  // Parse current value into tokens with unique IDs
  const tokens: TokenItem[] = React.useMemo(() => {
    const parsed = parseTemplate(value ?? "");
    return parsed.map((token, index) => ({
      ...token,
      id: `token-${index}-${token.value}`,
    }));
  }, [value]);

  // Parse prefix value into read-only tokens (for inherited values)
  const prefixTokens: TokenItem[] = React.useMemo(() => {
    if (!prefixValue) return [];
    const parsed = parseTemplate(prefixValue);

    // In folder path mode, filter out text tokens that are only separators
    const filtered = isFolderPathMode
      ? parsed.filter(token => !(token.type === "text" && /^[\s/]+$/.test(token.value)))
      : parsed;

    return filtered.map((token, index) => ({
      ...token,
      id: `prefix-${index}-${token.value}`,
    }));
  }, [prefixValue, isFolderPathMode]);

  // Parse default value into hint tokens (shown when value is empty)
  const defaultTokens: TokenItem[] = React.useMemo(() => {
    if (!defaultValue) return [];
    const parsed = parseTemplate(defaultValue);

    // In folder path mode, filter out text tokens that are only separators
    const filtered = isFolderPathMode
      ? parsed.filter(token => !(token.type === "text" && /^[\s/]+$/.test(token.value)))
      : parsed;

    return filtered.map((token, index) => ({
      ...token,
      id: `default-${index}-${token.value}`,
    }));
  }, [defaultValue, isFolderPathMode]);

  // Check if showing default (value empty but defaultValue set)
  const isShowingDefault = !value && defaultValue && defaultTokens.length > 0;

  // Find active item for drag overlay
  const activeItem = React.useMemo(
    () => tokens.find((t) => t.id === activeId) || null,
    [tokens, activeId]
  );
  // Compute order number for the active drag item (skip separators)
  const activeOrder = React.useMemo(() => {
    if (!activeId) return undefined;
    let order = 0;
    for (const t of tokens) {
      const isSep = t.type === "text" && /^[\s/]+$/.test(t.value);
      if (!isSep) order++;
      if (t.id === activeId) return isSep ? undefined : order;
    }
    return undefined;
  }, [tokens, activeId]);

  // Generate preview
  const preview = React.useMemo(() => {
    if (!showPreview) return "";
    if (previewData) {
      let result = value ?? "";  // Handle null value
      Object.entries(previewData).forEach(([key, val]) => {
        // Support both {Key} and {{Key}} formats
        result = result.replace(new RegExp(`\\{\\{?${key}\\}\\}?`, "g"), val);
      });
      return result;
    }
    return resolveWithExamples(value ?? "", previewUseLong);  // Handle null value
  }, [value, showPreview, previewData, previewUseLong]);

  // Insert a token at the end (auto-add separator if needed)
  const insertToken = (code: string) => {
    if (!value) {
      emitChange(code);
    } else {
      // Auto-add separator unless value ends with a separator character
      const lastChar = value.slice(-1);
      const separators = [" ", "-", "_", "/", "("];
      const noSeparatorNeeded = separators.includes(lastChar);
      const newValue = noSeparatorNeeded ? `${value}${code}` : `${value}${separator}${code}`;
      emitChange(newValue);
    }
  };

  // Remove a token at index
  const removeToken = (index: number) => {
    const newTokens = tokens.filter((_, i) => i !== index);

    if (isFolderPathMode) {
      // Concatenate values, then normalize double separators
      let newValue = newTokens.map(t => t.value).join("");
      newValue = newValue.replace(/\/+/g, "/").replace(/^\/|\/$/g, "");
      emitChange(newValue);
    } else {
      emitChange(buildTemplate(newTokens.map(({ type, value }) => ({ type, value }))));
    }
  };

  // Add custom text
  const addCustomText = () => {
    if (customText.trim()) {
      const newValue = value ? `${value}${customText}` : customText;
      emitChange(newValue);
      setCustomText("");
    }
  };

  // Handle key press in custom text input
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addCustomText();
    }
  };

  // Handle reorder by typing a new position number
  const handleReorder = React.useCallback((fromOrder: number, toOrder: number) => {
    // Build ordered list (non-separator tokens only) to find real indices
    const orderedTokenIndices: number[] = [];
    tokens.forEach((t, i) => {
      const isSep = t.type === "text" && /^[\s/]+$/.test(t.value);
      if (!isSep) orderedTokenIndices.push(i);
    });
    const fromIdx = orderedTokenIndices[fromOrder - 1];
    const toIdx = orderedTokenIndices[toOrder - 1];
    if (fromIdx === undefined || toIdx === undefined) return;
    const reordered = arrayMove(tokens, fromIdx, toIdx);
    if (isFolderPathMode) {
      emitChange(reordered.map(t => t.value).join(""));
    } else {
      emitChange(buildTemplate(reordered.map(({ type, value }) => ({ type, value }))));
    }
  }, [tokens, isFolderPathMode, emitChange]);

  // Handle drag start
  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  // Handle drag over - track position for drop indicator
  const handleDragOver = (event: DragOverEvent) => {
    setOverId((event.over?.id as string) || null);
  };

  // Handle drag cancel - reset state
  const handleDragCancel = () => {
    setActiveId(null);
    setOverId(null);
  };

  // Handle drag end - reorder tokens
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    setOverId(null);

    if (over && active.id !== over.id) {
      const oldIndex = tokens.findIndex((t) => t.id === active.id);
      const newIndex = tokens.findIndex((t) => t.id === over.id);
      const reordered = arrayMove(tokens, oldIndex, newIndex);

      if (isFolderPathMode) {
        // Concatenate values directly (separator tokens are part of the array)
        const newValue = reordered.map(t => t.value).join("");
        emitChange(newValue);
      } else {
        emitChange(buildTemplate(reordered.map(({ type, value }) => ({ type, value }))));
      }
    }
  };

  return (
    <div className={cn("space-y-2", className)}>
      {/* Label */}
      {label && (
        <label className="text-sm font-medium text-foreground">{label}</label>
      )}

      {/* Token Display Area with Drag-and-Drop */}
      <div
        className={cn(
          "flex flex-wrap items-center gap-1.5 p-2 min-h-[42px] border rounded-none bg-background",
          error && "border-destructive",
          disabled && "opacity-50 cursor-not-allowed"
        )}
      >
        {/* Prefix tokens (read-only, inherited) */}
        {prefixTokens.map((token) => (
          <ReadOnlyToken key={token.id} item={token} />
        ))}

        {/* Visual separator between prefix and editable (non-removable) */}
        {isFolderPathMode && prefixTokens.length > 0 && tokens.length > 0 && (
          <span className="text-sm font-mono text-muted-foreground/40 select-none">/</span>
        )}

        {/* Editable tokens with drag-and-drop */}
        {tokens.length === 0 && prefixTokens.length === 0 && !isShowingDefault ? (
          <span className="text-sm text-muted-foreground">{placeholder}</span>
        ) : tokens.length === 0 && isShowingDefault ? (
          /* Show default tokens as hint when value is empty */
          <div className="flex items-center gap-1.5">
            {defaultTokens.map((token) => (
              <DefaultToken key={token.id} item={token} />
            ))}
            <span className="text-xs text-muted-foreground/60 italic ml-1">(default)</span>
            {!disabled && (
              <button
                type="button"
                onClick={() => emitChange(defaultValue || "")}
                className="ml-1 text-xs px-2 py-0.5 rounded bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 transition-colors"
              >
                Use
              </button>
            )}
          </div>
        ) : tokens.length === 0 ? (
          <span className="text-sm text-muted-foreground italic">+ add suffix</span>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
            onDragCancel={handleDragCancel}
          >
            <SortableContext
              items={tokens.map((t) => t.id)}
              strategy={horizontalListSortingStrategy}
            >
              {(() => {
                const activeIdx = activeId ? tokens.findIndex(t => t.id === activeId) : -1;
                const overIdx = overId ? tokens.findIndex(t => t.id === overId) : -1;
                // Compute order numbers (only for non-separator tokens)
                let orderCounter = 0;
                const orderMap = new Map<string, number>();
                tokens.forEach(t => {
                  const isSep = t.type === "text" && /^[\s/]+$/.test(t.value);
                  if (!isSep) {
                    orderCounter++;
                    orderMap.set(t.id, orderCounter);
                  }
                });
                const totalOrdered = orderCounter;
                return tokens.map((token, index) => {
                  const isDropTarget = activeId !== null && overId === token.id && activeId !== token.id;
                  return (
                    <React.Fragment key={token.id}>
                      {isDropTarget && activeIdx > overIdx && <DropIndicator />}
                      <SortableToken
                        item={token}
                        disabled={disabled}
                        onRemove={() => removeToken(index)}
                        order={orderMap.get(token.id)}
                        totalOrdered={totalOrdered}
                        onReorder={handleReorder}
                      />
                      {isDropTarget && activeIdx < overIdx && <DropIndicator />}
                    </React.Fragment>
                  );
                });
              })()}
            </SortableContext>

            <DragOverlay modifiers={[restrictToWindowEdges]} dropAnimation={null}>
              {activeItem ? <DragOverlayToken item={activeItem} order={activeOrder} /> : null}
            </DragOverlay>
          </DndContext>
        )}
      </div>

      {/* Preview */}
      {showPreview && (value || isShowingDefault) && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Preview:</span>
          <span className={cn(
            "text-sm font-mono px-2 py-0.5 rounded-none",
            isShowingDefault
              ? "text-muted-foreground/60 bg-muted/30 italic"
              : "text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950/30"
          )}>
            {isShowingDefault ? resolveWithExamples(defaultValue || "", previewUseLong) : preview}
          </span>
        </div>
      )}

      {/* Inline Palette - Click to Add */}
      {!disabled && (
        <div className="border rounded-none bg-muted/30">
          {/* Palette Header */}
          <button
            type="button"
            onClick={() => setPaletteExpanded(!paletteExpanded)}
            className="w-full flex items-center justify-between px-3 py-2 text-sm font-medium hover:bg-muted/50 transition-colors"
          >
            <span>Available Placeholders (click to add)</span>
            {paletteExpanded ? (
              <ChevronUp className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            )}
          </button>

          {paletteExpanded && (
            <div className="border-t">
              {/* Category Filter Buttons */}
              <div className="p-2 border-b bg-background flex flex-wrap gap-1">
                {availableCategories.map((cat) => {
                  const config = CATEGORY_CONFIG[cat];
                  const Icon = config.icon;
                  const isActive = categoryFilter === cat;
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setCategoryFilter(cat)}
                      className={cn(
                        "inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium border transition-all",
                        isActive
                          ? config.color + " ring-2 ring-offset-1 ring-primary/50"
                          : "bg-background hover:bg-muted text-muted-foreground border-muted-foreground/30 hover:border-muted-foreground/50"
                      )}
                    >
                      <Icon className="h-3 w-3" />
                      <span>{config.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Search and Custom Text */}
              <div className="p-2 border-b bg-background flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                  <Input
                    placeholder="Search tokens..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="h-7 pl-7 text-xs"
                  />
                </div>
                <Input
                  ref={inputRef}
                  placeholder="Custom text..."
                  value={customText}
                  onChange={(e) => setCustomText(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="h-7 text-xs w-32"
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={addCustomText}
                  disabled={!customText.trim()}
                  className="h-7 px-2"
                >
                  <Plus className="h-3 w-3" />
                </Button>
              </div>

              {/* Token Grid - 2 columns */}
              <div className="p-2 grid grid-cols-2 gap-1.5">
                {filteredPlaceholders.map((p, index) => {
                  const colorClasses = PLACEHOLDER_COLOR_CLASSES[p.color];
                  return (
                    <button
                      key={`${p.code}-${index}`}
                      type="button"
                      onClick={() => insertToken(p.code)}
                      className={cn(
                        "inline-flex items-center gap-1.5 px-2 py-1.5 rounded-none border text-xs font-mono",
                        "hover:shadow-sm transition-all cursor-pointer hover:scale-[1.02]",
                        colorClasses.bg,
                        colorClasses.text,
                        colorClasses.border
                      )}
                      title={p.description || `Add ${p.code}`}
                    >
                      <Plus className="h-2.5 w-2.5 opacity-60 flex-shrink-0" />
                      <span className="flex items-center gap-1.5">
                        <span>{p.code}</span>
                        <span className="opacity-50">→</span>
                        <span className="opacity-70 truncate">{p.example}</span>
                      </span>
                    </button>
                  );
                })}
                {filteredPlaceholders.length === 0 && (
                  <span className="text-xs text-muted-foreground p-2 col-span-2">
                    No tokens found{categoryFilter !== "all" && ` in ${CATEGORY_CONFIG[categoryFilter].label}`}
                    {search && ` matching "${search}"`}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Error */}
      {error && (
        <p className="text-xs text-destructive">{error}</p>
      )}

      {/* Help Text */}
      {helpText && !error && (
        <p className="text-xs text-muted-foreground">{helpText}</p>
      )}
    </div>
  );
}

// Backwards compatibility aliases (DEPRECATED - use PlaceholderBuilder)
export type TokenBuilderProps = PlaceholderBuilderProps;
export const TokenBuilder = PlaceholderBuilder;
