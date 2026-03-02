"use client";

import { Check, ChevronsUpDown, Search, X } from "lucide-react";
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

export type ComboboxMultiItem = {
  id: string;
  label: string;
  disabled?: boolean;
  searchText?: string;
};

type Props = {
  placeholder?: string;
  searchPlaceholder?: string;
  items: ComboboxMultiItem[];
  selectedIds: string[];
  onChange: (selectedIds: string[]) => void;
  disabled?: boolean;
  className?: string;
};

export function ComboboxMultiSelect({
  placeholder = "Select...",
  searchPlaceholder = "Search...",
  items,
  selectedIds,
  onChange,
  disabled,
  className,
}: Props) {
  const [open, setOpen] = React.useState(false);
  const [inputValue, setInputValue] = React.useState("");
  const inputRef = React.useRef<HTMLInputElement>(null);

  const selectedSet = React.useMemo(() => new Set(selectedIds), [selectedIds]);

  const filteredItems = React.useMemo(() => {
    if (!inputValue) return items;
    const search = inputValue.toLowerCase();
    return items.filter(
      (item) =>
        item.label.toLowerCase().includes(search) ||
        (item.searchText?.toLowerCase().includes(search) ?? false)
    );
  }, [items, inputValue]);

  const selectedLabels = React.useMemo(() => {
    return selectedIds
      .map((id) => items.find((i) => i.id === id)?.label)
      .filter(Boolean) as string[];
  }, [selectedIds, items]);

  const handleToggle = (itemId: string) => {
    if (selectedSet.has(itemId)) {
      onChange(selectedIds.filter((id) => id !== itemId));
    } else {
      onChange([...selectedIds, itemId]);
    }
  };

  const handleClearAll = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    onChange([]);
  };

  // Focus search input when popover opens
  React.useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 0);
    } else {
      setInputValue("");
    }
  }, [open]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "w-full justify-between font-normal h-auto min-h-9",
            !selectedIds.length && "text-muted-foreground",
            className
          )}
        >
          <div className="flex-1 min-w-0 text-left">
            {selectedLabels.length === 0 ? (
              <span>{placeholder}</span>
            ) : (
              <div className="flex flex-wrap gap-1 py-0.5">
                {selectedLabels.map((label, idx) => (
                  <span
                    key={selectedIds[idx]}
                    className="inline-flex items-center gap-1 px-1.5 py-0 rounded bg-muted text-xs text-foreground"
                  >
                    {label}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggle(selectedIds[idx]);
                      }}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0 ml-1">
            {selectedIds.length > 0 && (
              <button
                type="button"
                onClick={handleClearAll}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
            <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
          </div>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command shouldFilter={false}>
          <div className="flex items-center border-b px-3">
            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
            <input
              ref={inputRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder={searchPlaceholder}
              className="flex h-9 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
          <CommandList>
            <CommandEmpty className="py-6 text-center text-sm text-muted-foreground">
              No results found.
            </CommandEmpty>
            <CommandGroup className="max-h-[250px] overflow-auto">
              {filteredItems.map((item) => {
                const isSelected = selectedSet.has(item.id);
                return (
                  <CommandItem
                    key={item.id}
                    value={item.id}
                    disabled={item.disabled}
                    onSelect={() => handleToggle(item.id)}
                    className="cursor-pointer"
                  >
                    <div
                      className={cn(
                        "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary",
                        isSelected
                          ? "bg-primary text-primary-foreground"
                          : "opacity-50"
                      )}
                    >
                      {isSelected && <Check className="h-3 w-3" />}
                    </div>
                    {item.label}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
