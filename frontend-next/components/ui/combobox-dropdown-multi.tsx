"use client";

import { Check, ChevronsUpDown, Search, X } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import * as React from "react";

import { CommandList } from "cmdk";
import { cn } from "@/lib/utils";
import { Badge } from "./badge";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "./command";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";

import type { ComboboxItem, ComboboxGroup } from "./combobox-dropdown";

type Props<T extends ComboboxItem> = {
  /** Flat list of items (use this OR groups, not both) */
  items?: T[];
  /** Grouped items with section headers (use this OR items, not both) */
  groups?: ComboboxGroup<T>[];
  /** Currently selected items */
  selectedItems: T[];
  /** Called when selection changes */
  onSelectionChange: (items: T[]) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyResults?: React.ReactNode;
  disabled?: boolean;
  /** Limit the maximum number of selected items */
  maxSelected?: number;
  className?: string;
  /** Show loading spinner while items are being fetched */
  isLoading?: boolean;
  /** Custom render for list items */
  renderListItem?: (props: {
    isChecked: boolean;
    item: T;
    searchTerm: string;
  }) => React.ReactNode;
  /** Props passed to PopoverContent */
  popoverProps?: React.ComponentProps<typeof PopoverContent>;
  /** Badge variant for selected items */
  badgeVariant?: "default" | "secondary" | "outline" | "tag";
};

export function ComboboxDropdownMulti<T extends ComboboxItem>({
  items,
  groups,
  selectedItems,
  onSelectionChange,
  placeholder = "Select items...",
  searchPlaceholder,
  emptyResults,
  disabled,
  maxSelected,
  className,
  isLoading = false,
  renderListItem,
  popoverProps,
  badgeVariant = "secondary",
}: Props<T>) {
  const [open, setOpen] = React.useState(false);
  const [inputValue, setInputValue] = React.useState("");
  const [highlightedIndex, setHighlightedIndex] = React.useState(0);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const listRef = React.useRef<HTMLDivElement>(null);

  // Flatten groups to items array if groups are provided
  const safeItems = React.useMemo(() => {
    if (groups && groups.length > 0) {
      return groups.flatMap((group) => group.items);
    }
    return Array.isArray(items) ? items : [];
  }, [items, groups]);

  // Build a set for O(1) selected lookups
  const selectedIdSet = React.useMemo(
    () => new Set(selectedItems.map((i) => i.id)),
    [selectedItems]
  );

  // Filter function for a single item
  const itemMatchesSearch = React.useCallback(
    (item: T, searchLower: string): boolean => {
      const matchesLabel = item.label.toLowerCase().includes(searchLower);
      const matchesSearchText =
        item.searchText?.toLowerCase().includes(searchLower) ?? false;
      return matchesLabel || matchesSearchText;
    },
    []
  );

  // Filter items by search input
  const filteredItems = React.useMemo(() => {
    const searchLower = inputValue.toLowerCase();
    return safeItems.filter((item) => itemMatchesSearch(item, searchLower));
  }, [safeItems, inputValue, itemMatchesSearch]);

  // Filter groups while preserving structure
  const filteredGroups = React.useMemo(() => {
    if (!groups || groups.length === 0) return null;

    const searchLower = inputValue.toLowerCase();

    return groups
      .map((group) => ({
        ...group,
        items: group.items.filter((item) =>
          itemMatchesSearch(item, searchLower)
        ),
      }))
      .filter((group) => group.items.length > 0);
  }, [groups, inputValue, itemMatchesSearch]);

  // Reset highlighted index when filtered items change
  React.useEffect(() => {
    setHighlightedIndex(0);
  }, [filteredItems.length]);

  // Scroll highlighted item into view
  React.useEffect(() => {
    if (listRef.current && open) {
      const items = listRef.current.querySelectorAll("[cmdk-item]");
      const highlightedItem = items[highlightedIndex] as HTMLElement;
      if (highlightedItem) {
        highlightedItem.scrollIntoView({ block: "nearest" });
      }
    }
  }, [highlightedIndex, open]);

  // Toggle an item's selection
  const handleToggleItem = React.useCallback(
    (item: T) => {
      if (item.disabled) return;

      const isSelected = selectedIdSet.has(item.id);
      let newSelection: T[];

      if (isSelected) {
        newSelection = selectedItems.filter((s) => s.id !== item.id);
      } else {
        if (maxSelected && selectedItems.length >= maxSelected) return;
        newSelection = [...selectedItems, item];
      }

      onSelectionChange(newSelection);
    },
    [selectedItems, selectedIdSet, onSelectionChange, maxSelected]
  );

  // Remove a specific item
  const handleRemoveItem = React.useCallback(
    (item: T, e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      onSelectionChange(selectedItems.filter((s) => s.id !== item.id));
    },
    [selectedItems, onSelectionChange]
  );

  // Keyboard navigation handler
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Enter") {
        setOpen(true);
        e.preventDefault();
      }
      return;
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setHighlightedIndex((prev) =>
          prev < filteredItems.length - 1 ? prev + 1 : 0
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        setHighlightedIndex((prev) =>
          prev > 0 ? prev - 1 : filteredItems.length - 1
        );
        break;
      case "Enter":
      case " ":
        if (e.key === " " && inputValue) break; // Allow space in search
        e.preventDefault();
        if (filteredItems.length > 0 && highlightedIndex < filteredItems.length) {
          handleToggleItem(filteredItems[highlightedIndex]);
        }
        break;
      case "Escape":
        e.preventDefault();
        setOpen(false);
        setInputValue("");
        break;
      case "Backspace":
        if (inputValue === "" && selectedItems.length > 0) {
          // Remove last selected item
          onSelectionChange(selectedItems.slice(0, -1));
        }
        break;
    }
  };

  // Handle input change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInputValue(value);
    if (!open && value) {
      setOpen(true);
    }
  };

  // Render a single item in the dropdown
  const renderItem = (item: T, globalIndex: number) => {
    const isChecked = selectedIdSet.has(item.id);
    const isHighlighted = globalIndex === highlightedIndex;

    return (
      <CommandItem
        disabled={item.disabled}
        className={cn(
          "cursor-pointer whitespace-nowrap",
          "aria-selected:bg-blue-100 aria-selected:text-foreground dark:aria-selected:bg-blue-900/40",
          isHighlighted && "bg-blue-100 dark:bg-blue-900/40"
        )}
        key={item.id}
        value={item.id}
        onSelect={(id) => {
          const foundItem = safeItems.find(
            (i) => i.id.toLowerCase() === id.toLowerCase()
          );
          if (!foundItem) return;
          handleToggleItem(foundItem);
        }}
        onMouseEnter={() => setHighlightedIndex(globalIndex)}
      >
        {renderListItem ? (
          renderListItem({ isChecked, item, searchTerm: inputValue })
        ) : (
          <div className="flex items-center gap-2 w-full">
            <div
              className={cn(
                "flex h-4 w-4 items-center justify-center rounded-sm border border-primary shrink-0",
                isChecked
                  ? "bg-primary text-primary-foreground"
                  : "opacity-50"
              )}
            >
              {isChecked && <Check className="h-3 w-3" />}
            </div>
            <span className={cn("flex-1 truncate", item.disabled && "text-muted-foreground")}>
              {item.label}
            </span>
          </div>
        )}
      </CommandItem>
    );
  };

  // Render grouped items with section headers
  const renderGroupedContent = () => {
    if (!filteredGroups || filteredGroups.length === 0) {
      return <CommandEmpty>{emptyResults ?? "No items found"}</CommandEmpty>;
    }

    let globalIndex = 0;
    const elements: React.ReactNode[] = [];

    filteredGroups.forEach((group) => {
      elements.push(
        <div
          key={`header-${group.label}`}
          className="sticky top-0 z-10 bg-muted backdrop-blur-sm px-2 py-1.5 text-xs font-semibold text-muted-foreground border-b border-border"
        >
          {group.label}
        </div>
      );

      group.items.forEach((item) => {
        const idx = globalIndex++;
        elements.push(renderItem(item, idx));
      });
    });

    return <>{elements}</>;
  };

  // Render flat items (no groups)
  const renderFlatContent = () => {
    return (
      <>
        {filteredItems.map((item, index) => renderItem(item, index))}
        <CommandEmpty>{emptyResults ?? "No items found"}</CommandEmpty>
      </>
    );
  };

  const DropdownContent = (
    <Command loop shouldFilter={false} className="h-auto">
      <CommandList
        ref={listRef}
        className="max-h-[300px] min-h-[100px] overflow-y-auto overflow-x-hidden"
      >
        {isLoading ? (
          <div className="flex items-center justify-center min-h-[100px]">
            <Spinner size={20} className="text-muted-foreground" />
          </div>
        ) : filteredGroups ? (
          renderGroupedContent()
        ) : (
          renderFlatContent()
        )}
      </CommandList>
    </Command>
  );

  const hasSelection = selectedItems.length > 0;

  return (
    <Popover
      open={open}
      onOpenChange={(isOpen) => {
        setOpen(isOpen);
        if (isOpen) {
          setTimeout(() => inputRef.current?.focus(), 0);
        } else {
          setInputValue("");
        }
      }}
    >
      <PopoverTrigger asChild disabled={disabled} className="w-full">
        <div
          className={cn(
            "relative w-full min-h-9 rounded-md border border-input bg-transparent shadow-sm",
            "focus-within:ring-1 focus-within:ring-ring",
            disabled && "cursor-not-allowed opacity-50",
            className
          )}
          onClick={() => {
            if (!disabled) {
              inputRef.current?.focus();
            }
          }}
        >
          <div className="flex flex-wrap items-center gap-1 p-1 pr-8 max-h-[4.5rem] overflow-y-auto">
            {/* Selected item badges */}
            {selectedItems.map((item) => (
              <Badge
                key={item.id}
                variant={badgeVariant}
                className="shrink-0 gap-1 pr-1"
              >
                <span className="truncate max-w-[160px]">{item.label}</span>
                {!disabled && (
                  <button
                    type="button"
                    className="ml-0.5 outline-none hover:text-foreground"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                    onClick={(e) => handleRemoveItem(item, e)}
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </Badge>
            ))}
            {/* Inline search input */}
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              onFocus={() => {
                if (!open) {
                  setOpen(true);
                }
              }}
              placeholder={hasSelection ? "" : placeholder}
              disabled={disabled}
              className={cn(
                "flex-1 min-w-[80px] h-7 bg-transparent text-sm outline-none placeholder:text-muted-foreground",
                "disabled:cursor-not-allowed"
              )}
            />
          </div>
          {/* Right icon */}
          <div className="absolute right-2 top-1/2 -translate-y-1/2">
            {isLoading ? (
              <Spinner size={16} className="text-muted-foreground" />
            ) : (
              <ChevronsUpDown className="h-4 w-4 text-muted-foreground opacity-50" />
            )}
          </div>
        </div>
      </PopoverTrigger>

      <PopoverContent
        className="p-0 w-auto"
        sideOffset={5}
        align="start"
        {...popoverProps}
        style={{
          minWidth: "var(--radix-popover-trigger-width)",
          ...popoverProps?.style,
        }}
        onOpenAutoFocus={(e) => {
          e.preventDefault(); // Keep focus on the trigger input
        }}
      >
        {DropdownContent}
      </PopoverContent>
    </Popover>
  );
}
