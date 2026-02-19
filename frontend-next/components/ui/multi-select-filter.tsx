"use client";

import { useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/components/ui/command";
import { CommandList } from "cmdk";

interface MultiSelectFilterProps {
  values: string[];
  selected: Set<string>;
  onToggle: (value: string) => void;
  placeholder: string;
  label?: string;
}

export function MultiSelectFilter({
  values,
  selected,
  onToggle,
  placeholder,
  label,
}: MultiSelectFilterProps) {
  const [open, setOpen] = useState(false);
  const count = selected.size;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className={cn(
            "flex items-center gap-1 h-6 px-1.5 text-xs rounded border border-input bg-background hover:bg-muted transition-colors w-full min-w-0",
            count > 0 && "border-primary/50 bg-primary/5"
          )}
        >
          {count > 0 ? (
            <span className="truncate font-medium">
              {label ? `${label}: ` : ""}{count} selected
            </span>
          ) : (
            <span className="truncate text-muted-foreground">{placeholder}</span>
          )}
          <ChevronsUpDown className="h-3 w-3 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[220px] p-0" align="start">
        <Command>
          <CommandInput placeholder={`Search ${label || ""}...`} className="h-8 text-xs" />
          <CommandList>
            <CommandEmpty className="py-2 text-center text-xs text-muted-foreground">
              No matches.
            </CommandEmpty>
            <CommandGroup className="max-h-[200px] overflow-auto">
              {values.map((value) => (
                <CommandItem
                  key={value}
                  value={value}
                  onSelect={() => onToggle(value)}
                  className="text-xs gap-2"
                >
                  <Check
                    className={cn(
                      "h-3 w-3 shrink-0",
                      selected.has(value) ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <span className="truncate">{value}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
