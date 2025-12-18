"use client";

/**
 * TokenBuilder - Draggable placeholder tokens with preview
 *
 * THE ONE component for building template strings with placeholders.
 * Used for document file naming, display names, email templates, etc.
 * See: frontend-next/lib/component-registry.ts
 *
 * Features:
 * - Click palette items to add tokens
 * - Drag tokens within template to reorder
 * - Click X to remove tokens
 * - Live preview of resolved template
 *
 * Usage:
 * ```tsx
 * import { TokenBuilder } from "@/components/ui/tokens";
 *
 * <TokenBuilder
 *   value="{CompanyCode} - {Description}"
 *   onChange={(newValue) => setTemplate(newValue)}
 *   scope="company"
 *   showPreview
 *   previewData={{ CompanyCode: "TH", Description: "Example" }}
 * />
 * ```
 */

import * as React from "react";
import { Plus, GripVertical, X, Search, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  type PlaceholderScope,
  type PlaceholderToken,
  parseTemplate,
  buildTemplate,
  resolveWithExamples,
  getPlaceholderColor,
  getPlaceholders,
  PLACEHOLDER_COLOR_CLASSES,
} from "@/lib/placeholders";
import {
  DndContext,
  DragOverlay,
  closestCenter,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  arrayMove,
  horizontalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { createDndSensors } from "@/components/ui/dnd/dnd-config";

export interface TokenBuilderProps {
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
  label?: string;
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
}: {
  item: TokenItem;
  disabled: boolean;
  onRemove: () => void;
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
        isDragging && "opacity-50 shadow-lg z-50",
        !disabled && "cursor-grab active:cursor-grabbing"
      )}
    >
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

      {/* Remove Button */}
      {!disabled && (
        <button
          type="button"
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

// Drag overlay token (shown while dragging)
function DragOverlayToken({ item }: { item: TokenItem }) {
  const color = item.type === "placeholder" ? getPlaceholderColor(item.value) : "gray";
  const colorClasses = PLACEHOLDER_COLOR_CLASSES[color];

  return (
    <span
      className={cn(
        "inline-flex items-center font-mono text-xs px-2 py-1 gap-1.5 rounded-none border shadow-lg",
        colorClasses.bg,
        colorClasses.text,
        colorClasses.border
      )}
    >
      <GripVertical className="h-3 w-3 opacity-50" />
      <span className="truncate">{item.value}</span>
      <X className="h-3 w-3 opacity-60" />
    </span>
  );
}

export function TokenBuilder({
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
}: TokenBuilderProps) {
  const [customText, setCustomText] = React.useState("");
  const [activeId, setActiveId] = React.useState<string | null>(null);
  const [paletteExpanded, setPaletteExpanded] = React.useState(true);
  const [search, setSearch] = React.useState("");
  const inputRef = React.useRef<HTMLInputElement>(null);
  const sensors = createDndSensors();

  // Get placeholders
  const allPlaceholders = customPlaceholders || getPlaceholders(scope);

  // Filter placeholders by search
  const filteredPlaceholders = React.useMemo(() => {
    if (!search.trim()) return allPlaceholders;
    const query = search.toLowerCase();
    return allPlaceholders.filter(
      (p) =>
        p.code.toLowerCase().includes(query) ||
        p.example.toLowerCase().includes(query) ||
        p.description?.toLowerCase().includes(query)
    );
  }, [allPlaceholders, search]);

  // Parse current value into tokens with unique IDs
  const tokens: TokenItem[] = React.useMemo(() => {
    const parsed = parseTemplate(value);
    return parsed.map((token, index) => ({
      ...token,
      id: `token-${index}-${token.value}`,
    }));
  }, [value]);

  // Find active item for drag overlay
  const activeItem = React.useMemo(
    () => tokens.find((t) => t.id === activeId) || null,
    [tokens, activeId]
  );

  // Generate preview
  const preview = React.useMemo(() => {
    if (!showPreview) return "";
    if (previewData) {
      let result = value;
      Object.entries(previewData).forEach(([key, val]) => {
        // Support both {Key} and {{Key}} formats
        result = result.replace(new RegExp(`\\{\\{?${key}\\}\\}?`, "g"), val);
      });
      return result;
    }
    return resolveWithExamples(value, previewUseLong);
  }, [value, showPreview, previewData, previewUseLong]);

  // Insert a token at the end (auto-add space if needed)
  const insertToken = (code: string) => {
    if (!value) {
      onChange(code);
    } else {
      // Auto-add space if value doesn't end with space or separator
      const lastChar = value.slice(-1);
      const needsSpace = lastChar !== " " && lastChar !== "-" && lastChar !== "_" && lastChar !== "/";
      const newValue = needsSpace ? `${value} ${code}` : `${value}${code}`;
      onChange(newValue);
    }
  };

  // Remove a token at index
  const removeToken = (index: number) => {
    const newTokens = tokens.filter((_, i) => i !== index);
    onChange(buildTemplate(newTokens.map(({ type, value }) => ({ type, value }))));
  };

  // Add custom text
  const addCustomText = () => {
    if (customText.trim()) {
      const newValue = value ? `${value}${customText}` : customText;
      onChange(newValue);
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

  // Handle drag start
  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  // Handle drag end - reorder tokens
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (over && active.id !== over.id) {
      const oldIndex = tokens.findIndex((t) => t.id === active.id);
      const newIndex = tokens.findIndex((t) => t.id === over.id);
      const reordered = arrayMove(tokens, oldIndex, newIndex);
      onChange(buildTemplate(reordered.map(({ type, value }) => ({ type, value }))));
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
        {tokens.length === 0 ? (
          <span className="text-sm text-muted-foreground">{placeholder}</span>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={tokens.map((t) => t.id)}
              strategy={horizontalListSortingStrategy}
            >
              {tokens.map((token, index) => (
                <SortableToken
                  key={token.id}
                  item={token}
                  disabled={disabled}
                  onRemove={() => removeToken(index)}
                />
              ))}
            </SortableContext>

            <DragOverlay>
              {activeItem ? <DragOverlayToken item={activeItem} /> : null}
            </DragOverlay>
          </DndContext>
        )}
      </div>

      {/* Preview */}
      {showPreview && value && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Preview:</span>
          <span className="text-sm font-mono text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950/30 px-2 py-0.5 rounded-none">
            {preview}
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
            <span>Available Tokens (click to add)</span>
            {paletteExpanded ? (
              <ChevronUp className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            )}
          </button>

          {paletteExpanded && (
            <div className="border-t">
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

              {/* Token Grid */}
              <ScrollArea className="max-h-[200px]">
                <div className="p-2 flex flex-wrap gap-1.5">
                  {filteredPlaceholders.map((p, index) => {
                    const colorClasses = PLACEHOLDER_COLOR_CLASSES[p.color];
                    return (
                      <button
                        key={`${p.code}-${index}`}
                        type="button"
                        onClick={() => insertToken(p.code)}
                        className={cn(
                          "inline-flex items-center gap-1 px-2 py-1 rounded-none border text-xs font-mono",
                          "hover:shadow-sm transition-all cursor-pointer hover:scale-105",
                          colorClasses.bg,
                          colorClasses.text,
                          colorClasses.border
                        )}
                        title={p.description || `Add ${p.code}`}
                      >
                        <Plus className="h-2.5 w-2.5 opacity-60" />
                        {p.code}
                      </button>
                    );
                  })}
                  {filteredPlaceholders.length === 0 && (
                    <span className="text-xs text-muted-foreground p-2">No tokens found</span>
                  )}
                </div>
              </ScrollArea>
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
