"use client";

import {
  Check,
  ChevronsUpDown,
  Search,
  X,
} from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import * as React from "react";

import { CommandList } from "cmdk";
import { cn } from "@/lib/utils";
import { Button } from "./button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "./command";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";

export type ComboboxItem = {
  id: string;
  label: string;
  disabled?: boolean;
  /** Additional text to search (e.g., employee names, aliases). Not displayed, only for filtering. */
  searchText?: string;
};

/** Group of items with a header label */
export type ComboboxGroup<T> = {
  label: string;
  items: T[];
};

type Props<T> = {
  placeholder?: React.ReactNode;
  searchPlaceholder?: string;
  /** Flat list of items (use this OR groups, not both) */
  items?: T[];
  /** Grouped items with section headers (use this OR items, not both) */
  groups?: ComboboxGroup<T>[];
  onSelect: (item: T) => void;
  selectedItem?: T;
  renderSelectedItem?: (selectedItem: T) => React.ReactNode;
  renderOnCreate?: (value: string) => React.ReactNode;
  renderListItem?: (listItem: {
    isChecked: boolean;
    item: T;
    /** Current search term for highlighting/filtering matched content */
    searchTerm: string;
  }) => React.ReactNode;
  emptyResults?: React.ReactNode;
  popoverProps?: React.ComponentProps<typeof PopoverContent>;
  disabled?: boolean;
  onCreate?: (value: string) => void;
  headless?: boolean;
  className?: string;
  /**
   * Show search input in the trigger button instead of inside the dropdown.
   * DEFAULT: true (TEEEM standard - field itself is searchable)
   * Set to false only for legacy/special cases.
   */
  searchInTrigger?: boolean;
  /** Show loading spinner while items are being fetched */
  isLoading?: boolean;
  /** Allow clearing the selection (shows X button) */
  clearable?: boolean;
  /** Called when selection is cleared */
  onClear?: () => void;
  /** Called when input value changes (for server-side search) */
  onInputChange?: (value: string) => void;
  /** Disable internal filtering (when using server-side search) */
  disableInternalFilter?: boolean;
};

export function ComboboxDropdown<T extends ComboboxItem>({
  headless,
  placeholder,
  searchPlaceholder,
  items,
  groups,
  onSelect,
  selectedItem: incomingSelectedItem,
  renderSelectedItem = (item) => item.label,
  renderListItem,
  renderOnCreate,
  emptyResults,
  popoverProps,
  disabled,
  onCreate,
  className,
  searchInTrigger = true, // TEEEM standard: field itself is searchable
  isLoading = false,
  clearable = false,
  onClear,
  onInputChange,
  disableInternalFilter = false,
}: Props<T>) {
  const [open, setOpen] = React.useState(false);
  const [internalSelectedItem, setInternalSelectedItem] = React.useState<
    T | undefined
  >();
  const [inputValue, setInputValue] = React.useState("");
  const [highlightedIndex, setHighlightedIndex] = React.useState(0);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const listRef = React.useRef<HTMLDivElement>(null);

  const selectedItem = incomingSelectedItem ?? internalSelectedItem;

  // Flatten groups to items array if groups are provided
  const safeItems = React.useMemo(() => {
    if (groups && groups.length > 0) {
      return groups.flatMap(group => group.items);
    }
    return Array.isArray(items) ? items : [];
  }, [items, groups]);

  // Filter function for a single item
  const itemMatchesSearch = React.useCallback((item: T, searchLower: string): boolean => {
    const matchesLabel = item.label.toLowerCase().includes(searchLower);
    const matchesSearchText = item.searchText?.toLowerCase().includes(searchLower) ?? false;
    return matchesLabel || matchesSearchText;
  }, []);

  // When disableInternalFilter is true, use all items (filtering done externally)
  // Otherwise filter by label AND searchText (for employee names, aliases, etc.)
  const filteredItems = React.useMemo(() => {
    if (disableInternalFilter) return safeItems;
    const searchLower = inputValue.toLowerCase();
    return safeItems.filter((item) => itemMatchesSearch(item, searchLower));
  }, [safeItems, inputValue, disableInternalFilter, itemMatchesSearch]);

  // Filter groups while preserving structure (hide empty groups after filtering)
  // Hierarchy-aware: keeps parent labels if any descendants match
  const filteredGroups = React.useMemo(() => {
    if (!groups || groups.length === 0) return null;
    if (disableInternalFilter) return groups;

    const searchLower = inputValue.toLowerCase();

    return groups
      .map(group => {
        // First pass: mark which items match
        const itemsWithMatch = group.items.map(item => ({
          item,
          matches: itemMatchesSearch(item, searchLower),
          // Check if this is a parent label (disabled with parent- id prefix)
          isParent: item.disabled && item.id.startsWith('parent-')
        }));

        // Second pass: keep parents if any following descendants match
        const filteredItems: T[] = [];
        for (let i = 0; i < itemsWithMatch.length; i++) {
          const { item, matches, isParent } = itemsWithMatch[i];

          if (matches) {
            filteredItems.push(item);
          } else if (isParent) {
            // Check if any following items (until next parent at same/lower depth) match
            const parentDepth = (item as any).depth ?? 0;
            let hasMatchingDescendant = false;

            for (let j = i + 1; j < itemsWithMatch.length; j++) {
              const descendant = itemsWithMatch[j];
              const descendantDepth = (descendant.item as any).depth ?? 0;

              // Stop when we hit another item at same or lower depth (sibling or uncle)
              if (descendantDepth <= parentDepth && !descendant.isParent) {
                break;
              }

              if (descendant.matches) {
                hasMatchingDescendant = true;
                break;
              }
            }

            if (hasMatchingDescendant) {
              filteredItems.push(item);
            }
          }
        }

        return { ...group, items: filteredItems };
      })
      .filter(group => group.items.length > 0);
  }, [groups, inputValue, disableInternalFilter, itemMatchesSearch]);

  const showCreate = onCreate && Boolean(inputValue) && !filteredItems.length;

  // Reset highlighted index when filtered items change
  React.useEffect(() => {
    setHighlightedIndex(0);
  }, [filteredItems.length]);

  // Scroll highlighted item into view
  React.useEffect(() => {
    if (listRef.current && open) {
      const items = listRef.current.querySelectorAll('[cmdk-item]');
      const highlightedItem = items[highlightedIndex] as HTMLElement;
      if (highlightedItem) {
        highlightedItem.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [highlightedIndex, open]);

  // Keyboard navigation handler for searchInTrigger mode
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
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
        e.preventDefault();
        // Auto-select if exactly one match or select highlighted item
        if (filteredItems.length === 1) {
          handleSelectItem(filteredItems[0]);
        } else if (filteredItems.length > 0 && highlightedIndex < filteredItems.length) {
          handleSelectItem(filteredItems[highlightedIndex]);
        }
        break;
      case "Escape":
        e.preventDefault();
        setOpen(false);
        setInputValue("");
        break;
    }
  };

  // Handle input change for searchInTrigger mode
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInputValue(value);
    onInputChange?.(value);
    if (!open && value) {
      setOpen(true);
    }
  };

  // Handle item selection
  const handleSelectItem = (item: T) => {
    onSelect(item);
    setInternalSelectedItem(item);
    setInputValue(""); // Clear search after selection
    setOpen(false);
  };

  // Handle clear selection
  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setInternalSelectedItem(undefined);
    setInputValue("");
    onClear?.();
  };

  // Render a single item
  const renderItem = (item: T, globalIndex: number) => {
    const isChecked = selectedItem?.id === item.id;
    const isHighlighted = globalIndex === highlightedIndex;

    return (
      <CommandItem
        disabled={item.disabled}
        className={cn(
          "cursor-pointer whitespace-nowrap",
          // Override cmdk's aria-selected:bg-accent with visible colors
          "aria-selected:bg-blue-100 aria-selected:text-foreground dark:aria-selected:bg-blue-900/40",
          isHighlighted && "bg-blue-100 dark:bg-blue-900/40",
          className
        )}
        key={item.id}
        value={item.id}
        onSelect={(id) => {
          // cmdk lowercases the value, so we need case-insensitive comparison
          const foundItem = safeItems.find((i) => i.id.toLowerCase() === id.toLowerCase());

          if (!foundItem) {
            return;
          }

          handleSelectItem(foundItem);
        }}
        onMouseEnter={() => setHighlightedIndex(globalIndex)}
      >
        {renderListItem ? (
          renderListItem({ isChecked, item, searchTerm: inputValue })
        ) : (
          <>
            <Check
              className={cn(
                "mr-2 h-4 w-4",
                isChecked ? "opacity-100" : "opacity-0",
              )}
            />
            {item.label}
          </>
        )}
      </CommandItem>
    );
  };

  // Render grouped items with section headers
  // Flattened structure so sticky headers work properly within scroll container
  const renderGroupedContent = () => {
    if (!filteredGroups || filteredGroups.length === 0) {
      return <CommandEmpty>{emptyResults ?? "No item found"}</CommandEmpty>;
    }

    let globalIndex = 0;
    const elements: React.ReactNode[] = [];

    filteredGroups.forEach((group, groupIdx) => {
      // Add sticky group header
      elements.push(
        <div
          key={`header-${group.label}`}
          className="sticky top-0 z-10 bg-muted backdrop-blur-sm px-2 py-1.5 text-xs font-semibold text-muted-foreground border-b border-border"
        >
          {group.label}
        </div>
      );

      // Add items for this group
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
        <CommandEmpty>{emptyResults ?? "No item found"}</CommandEmpty>
        {showCreate && (
          <CommandItem
            key={inputValue}
            value={inputValue}
            onSelect={() => {
              onCreate(inputValue);
              setOpen(false);
              setInputValue("");
            }}
            onMouseDown={(event) => {
              event.preventDefault();
              event.stopPropagation();
            }}
          >
            {renderOnCreate ? renderOnCreate(inputValue) : null}
          </CommandItem>
        )}
      </>
    );
  };

  const Component = (
    <Command loop shouldFilter={false} className="h-auto">
      {!searchInTrigger && (
        <CommandInput
          value={inputValue}
          onValueChange={setInputValue}
          placeholder={searchPlaceholder ?? "Search item..."}
          className="px-3"
        />
      )}

      <CommandList ref={listRef} className="max-h-[300px] min-h-[100px] overflow-y-auto overflow-x-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center min-h-[100px]">
            <Spinner size={20} className="text-muted-foreground" />
          </div>
        ) : (
          filteredGroups ? renderGroupedContent() : renderFlatContent()
        )}
      </CommandList>
    </Command>
  );

  if (headless) {
    return Component;
  }

  // Search in trigger mode - input is in the button area
  // When closed: show selected value (can be React elements like badges)
  // When open: show search input for typing
  if (searchInTrigger) {
    const showSelectedDisplay = !open && selectedItem;

    return (
      <Popover open={open} onOpenChange={(isOpen) => {
        setOpen(isOpen);
        if (isOpen) {
          // Focus input when opening so user can type immediately
          setTimeout(() => inputRef.current?.focus(), 0);
        } else {
          setInputValue(""); // Clear search when closing
        }
      }}>
        <PopoverTrigger asChild disabled={disabled} className="w-full">
          <div className="relative w-full h-9 overflow-hidden">
            {/* Hidden input for search when open */}
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              onFocus={() => {
                if (!open) {
                  setOpen(true);
                  setInputValue(""); // Only clear when first opening
                  onInputChange?.(""); // Trigger initial load
                }
              }}
              placeholder={placeholder as string ?? "Search..."}
              disabled={disabled}
              className={cn(
                "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 pr-8 text-sm shadow-sm",
                "placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                "disabled:cursor-not-allowed disabled:opacity-50",
                showSelectedDisplay && "text-transparent caret-transparent placeholder:text-transparent",
                className
              )}
            />
            {/* Overlay showing selected item when closed (supports React elements) */}
            {showSelectedDisplay && (
              <div
                className="absolute inset-0 flex items-center px-3 pr-8 pointer-events-none overflow-hidden"
                onClick={() => inputRef.current?.focus()}
              >
                <div className="truncate text-sm">
                  {renderSelectedItem(selectedItem)}
                </div>
              </div>
            )}
            {/* Icon: Loading > Clear > Search */}
            {isLoading ? (
              <Spinner size={16} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
            ) : clearable && selectedItem && !open ? (
              <X
                className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground hover:text-foreground cursor-pointer"
                onClick={handleClear}
              />
            ) : (
              <Search className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            )}
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
            e.preventDefault(); // Keep focus on the input
          }}
        >
          {Component}
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild disabled={disabled} className="w-full">
        <Button
          variant="outline"
          aria-expanded={open}
          className="w-full justify-between relative font-normal"
        >
          <span className="truncate text-ellipsis pr-3">
            {selectedItem ? (
              <span className="items-center overflow-hidden whitespace-nowrap text-ellipsis block">
                {renderSelectedItem
                  ? renderSelectedItem(selectedItem)
                  : selectedItem.label}
              </span>
            ) : (
              (placeholder ?? "Select item...")
            )}
          </span>
          <ChevronsUpDown className="size-4 opacity-50 absolute right-2" />
        </Button>
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
      >
        {Component}
      </PopoverContent>
    </Popover>
  );
}
