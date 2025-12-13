"use client";

import { Check, ChevronsUpDown, X, Loader2 } from "lucide-react";
import * as React from "react";

import { CommandList } from "cmdk";
import { cn } from "@/lib/utils";
import { Button } from "./button";
import { Badge } from "./badge";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "./command";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";

export type MultiSelectItem = {
  id: string;
  label: string;
  disabled?: boolean;
};

type Props = {
  placeholder?: React.ReactNode;
  searchPlaceholder?: string;
  items: MultiSelectItem[];
  onSelect: (selectedIds: string[]) => void;
  selectedIds: string[];
  emptyResults?: React.ReactNode;
  popoverProps?: React.ComponentProps<typeof PopoverContent>;
  disabled?: boolean;
  className?: string;
  maxDisplay?: number; // Max badges to show before "X more"
  /** Show loading spinner while items are being fetched */
  isLoading?: boolean;
};

export function MultiSelectCombobox({
  placeholder,
  searchPlaceholder,
  items,
  onSelect,
  selectedIds,
  emptyResults,
  popoverProps,
  disabled,
  className,
  maxDisplay = 3,
  isLoading = false,
}: Props) {
  const [open, setOpen] = React.useState(false);
  const [inputValue, setInputValue] = React.useState("");

  // Defensive: ensure items is always an array
  const safeItems = Array.isArray(items) ? items : [];
  const safeSelectedIds = Array.isArray(selectedIds) ? selectedIds : [];

  const filteredItems = safeItems.filter((item) =>
    item.label.toLowerCase().includes(inputValue.toLowerCase()),
  );

  // Get selected items for display
  const selectedItems = safeItems.filter((item) =>
    safeSelectedIds.includes(item.id)
  );

  // Handle item toggle (add or remove)
  const handleToggleItem = (itemId: string) => {
    const newSelectedIds = safeSelectedIds.includes(itemId)
      ? safeSelectedIds.filter((id) => id !== itemId)
      : [...safeSelectedIds, itemId];
    onSelect(newSelectedIds);
  };

  // Handle removing a specific item
  const handleRemoveItem = (itemId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect(safeSelectedIds.filter((id) => id !== itemId));
  };

  // Clear all selections
  const handleClearAll = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect([]);
  };

  return (
    <Popover open={open} onOpenChange={setOpen} modal>
      <PopoverTrigger asChild disabled={disabled} className="w-full">
        <Button
          variant="outline"
          aria-expanded={open}
          className="w-full justify-between relative font-normal min-h-[40px] h-auto py-2"
        >
          <div className="flex flex-wrap gap-1 flex-1 pr-8">
            {selectedItems.length === 0 ? (
              <span className="text-muted-foreground">
                {placeholder ?? "Select items..."}
              </span>
            ) : (
              <>
                {selectedItems.slice(0, maxDisplay).map((item) => (
                  <Badge
                    key={item.id}
                    variant="secondary"
                    className="mr-1 font-normal"
                  >
                    {item.label}
                    <button
                      onClick={(e) => handleRemoveItem(item.id, e)}
                      className="ml-1 rounded-full hover:bg-muted"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
                {selectedItems.length > maxDisplay && (
                  <Badge variant="secondary" className="font-normal">
                    +{selectedItems.length - maxDisplay} more
                  </Badge>
                )}
              </>
            )}
          </div>
          <div className="flex items-center gap-2 absolute right-2 top-1/2 -translate-y-1/2">
            {selectedItems.length > 0 && (
              <button
                onClick={handleClearAll}
                className="rounded-full hover:bg-muted p-0.5"
              >
                <X className="h-4 w-4 text-muted-foreground hover:text-foreground" />
              </button>
            )}
            <ChevronsUpDown className="h-4 w-4 opacity-50" />
          </div>
        </Button>
      </PopoverTrigger>

      <PopoverContent
        className="p-0"
        {...popoverProps}
        style={{
          width: "var(--radix-popover-trigger-width)",
          ...popoverProps?.style,
        }}
      >
        <Command loop shouldFilter={false}>
          <CommandInput
            value={inputValue}
            onValueChange={setInputValue}
            placeholder={searchPlaceholder ?? "Search..."}
            className="px-3"
          />

          <CommandGroup>
            <CommandList className="max-h-[300px] overflow-auto">
              {isLoading ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <>
                  {filteredItems.map((item) => {
                    const isChecked = safeSelectedIds.includes(item.id);

                    return (
                      <CommandItem
                        disabled={item.disabled}
                        className={cn("cursor-pointer", className)}
                        key={item.id}
                        value={item.id}
                        onSelect={(id) => {
                          handleToggleItem(id);
                        }}
                      >
                        <div
                          className={cn(
                            "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary",
                            isChecked
                              ? "bg-primary text-primary-foreground"
                              : "opacity-50 [&_svg]:invisible"
                          )}
                        >
                          <Check className="h-4 w-4" />
                        </div>
                        {item.label}
                      </CommandItem>
                    );
                  })}

                  <CommandEmpty>{emptyResults ?? "No items found"}</CommandEmpty>
                </>
              )}
            </CommandList>
          </CommandGroup>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
