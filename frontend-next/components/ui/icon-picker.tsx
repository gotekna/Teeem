"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { ICON_MAP, AVAILABLE_ICONS, getIcon } from "@/lib/icon-map";

interface IconPickerProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

export function IconPicker({ value, onChange, className }: IconPickerProps) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");

  const filteredIcons = React.useMemo(() => {
    if (!search) return AVAILABLE_ICONS;
    return AVAILABLE_ICONS.filter((icon) =>
      icon.toLowerCase().includes(search.toLowerCase())
    );
  }, [search]);

  const SelectedIcon = getIcon(value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-[120px] justify-between", className)}
        >
          <div className="flex items-center gap-2">
            <SelectedIcon className="h-4 w-4" />
            <span className="truncate text-xs">{value}</span>
          </div>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[280px] p-2" align="start">
        <Input
          placeholder="Search icons..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="mb-2"
        />
        <div className="grid grid-cols-6 gap-1 max-h-[200px] overflow-y-auto">
          {filteredIcons.map((iconName) => {
            const Icon = ICON_MAP[iconName];
            return (
              <Button
                key={iconName}
                variant={value === iconName ? "secondary" : "ghost"}
                size="icon"
                className="h-8 w-8"
                onClick={() => {
                  onChange(iconName);
                  setOpen(false);
                  setSearch("");
                }}
                title={iconName}
              >
                <Icon className="h-4 w-4" />
              </Button>
            );
          })}
        </div>
        {filteredIcons.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">
            No icons found
          </p>
        )}
      </PopoverContent>
    </Popover>
  );
}
