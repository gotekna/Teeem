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
};

type Props<T> = {
  placeholder?: React.ReactNode;
  searchPlaceholder?: string;
  items: T[];
  onSelect: (item: T) => void;
  selectedItem?: T;
  renderSelectedItem?: (selectedItem: T) => React.ReactNode;
  renderOnCreate?: (value: string) => React.ReactNode;
  renderListItem?: (listItem: {
    isChecked: boolean;
    item: T;
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

  // Defensive: ensure items is always an array
  const safeItems = Array.isArray(items) ? items : [];

  // When disableInternalFilter is true, use all items (filtering done externally)
  const filteredItems = disableInternalFilter
    ? safeItems
    : safeItems.filter((item) =>
        item.label.toLowerCase().includes(inputValue.toLowerCase()),
      );

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

  const Component = (
    <Command loop shouldFilter={false}>
      {!searchInTrigger && (
        <CommandInput
          value={inputValue}
          onValueChange={setInputValue}
          placeholder={searchPlaceholder ?? "Search item..."}
          className="px-3"
        />
      )}

      <CommandGroup>
        <CommandList ref={listRef} className="max-h-[300px] overflow-y-auto overflow-x-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center py-6">
              <Spinner size={20} className="text-muted-foreground" />
            </div>
          ) : (
            <>
              {filteredItems.map((item, index) => {
                const isChecked = selectedItem?.id === item.id;
                const isHighlighted = index === highlightedIndex;

                return (
                  <CommandItem
                    disabled={item.disabled}
                    className={cn(
                      "cursor-pointer whitespace-nowrap",
                      isHighlighted && "bg-accent",
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
                    onMouseEnter={() => setHighlightedIndex(index)}
                  >
                    {renderListItem ? (
                      renderListItem({ isChecked, item })
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
              })}

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
          )}
        </CommandList>
      </CommandGroup>
    </Command>
  );

  if (headless) {
    return Component;
  }

  // Search in trigger mode - input is in the button area
  // When closed: show selected value as display text
  // When open: show empty input for searching (clears on open)
  if (searchInTrigger) {
    // Display value: when closed show selected item label, when open show search input
    const displayValue = open
      ? inputValue
      : (selectedItem ? (typeof renderSelectedItem(selectedItem) === 'string' ? renderSelectedItem(selectedItem) as string : selectedItem.label) : "");

    return (
      <Popover open={open} onOpenChange={(isOpen) => {
        setOpen(isOpen);
        if (!isOpen) {
          setInputValue(""); // Clear search when closing
        }
      }} modal>
        <PopoverTrigger asChild disabled={disabled || isLoading} className="w-full">
          <div className="relative w-full">
            <input
              ref={inputRef}
              type="text"
              value={displayValue}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              onFocus={() => {
                setOpen(true);
                setInputValue(""); // Clear to allow fresh search
              }}
              placeholder={placeholder as string ?? "Search..."}
              disabled={disabled || isLoading}
              className={cn(
                "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 pr-8 text-sm shadow-sm transition-colors",
                "placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                "disabled:cursor-not-allowed disabled:opacity-50",
                className
              )}
            />
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
          className="p-0 w-auto z-[1200]"
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
    <Popover open={open} onOpenChange={setOpen} modal>
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
        className="p-0 w-auto z-[1200]"
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
