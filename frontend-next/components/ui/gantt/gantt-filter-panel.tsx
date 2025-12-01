"use client";

import * as React from "react";
import { Search, X, Filter, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { defaultStatuses } from "./types";
import type { GanttStatus } from "./types";

export type GanttFilters = {
  search: string;
  status: string | null;
  trade: string | null;
};

type GanttFilterPanelProps = {
  filters: GanttFilters;
  onFiltersChange: (filters: GanttFilters) => void;
  trades?: string[];
  className?: string;
};

export function GanttFilterPanel({
  filters,
  onFiltersChange,
  trades = [],
  className,
}: GanttFilterPanelProps) {
  const [isOpen, setIsOpen] = React.useState(false);

  const activeFilterCount = [
    filters.status,
    filters.trade,
  ].filter(Boolean).length;

  const handleSearchChange = (value: string) => {
    onFiltersChange({ ...filters, search: value });
  };

  const handleStatusChange = (value: string) => {
    onFiltersChange({ ...filters, status: value === "all" ? null : value });
  };

  const handleTradeChange = (value: string) => {
    onFiltersChange({ ...filters, trade: value === "all" ? null : value });
  };

  const clearFilters = () => {
    onFiltersChange({ search: "", status: null, trade: null });
  };

  const hasActiveFilters = filters.search || filters.status || filters.trade;

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {/* Search input */}
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          placeholder="Search tasks..."
          value={filters.search}
          onChange={(e) => handleSearchChange(e.target.value)}
          className="h-8 w-[200px] pl-8 text-[12px]"
        />
        {filters.search && (
          <button
            onClick={() => handleSearchChange("")}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Filter popover */}
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={cn(
              "h-8 gap-1.5 text-[11px]",
              activeFilterCount > 0 && "border-primary"
            )}
          >
            <Filter className="h-3.5 w-3.5" />
            Filters
            {activeFilterCount > 0 && (
              <Badge variant="secondary" className="ml-1 h-4 px-1 text-[10px]">
                {activeFilterCount}
              </Badge>
            )}
            <ChevronDown className="h-3 w-3 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-[240px] p-3">
          <div className="space-y-3">
            {/* Status filter */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                Status
              </label>
              <Select
                value={filters.status || "all"}
                onValueChange={handleStatusChange}
              >
                <SelectTrigger className="h-8 text-[12px]">
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  {defaultStatuses.map((status) => (
                    <SelectItem key={status.id} value={status.id}>
                      <div className="flex items-center gap-2">
                        <div
                          className={cn(
                            "h-2 w-2 rounded-full",
                            status.color.split(" ")[0]
                          )}
                        />
                        {status.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Trade filter */}
            {trades.length > 0 && (
              <div className="space-y-1.5">
                <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                  Trade
                </label>
                <Select
                  value={filters.trade || "all"}
                  onValueChange={handleTradeChange}
                >
                  <SelectTrigger className="h-8 text-[12px]">
                    <SelectValue placeholder="All trades" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All trades</SelectItem>
                    {trades.map((trade) => (
                      <SelectItem key={trade} value={trade}>
                        {trade}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Clear filters */}
            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                className="w-full h-7 text-[11px]"
              >
                <X className="h-3 w-3 mr-1" />
                Clear all filters
              </Button>
            )}
          </div>
        </PopoverContent>
      </Popover>

      {/* Active filter badges */}
      {(filters.status || filters.trade) && (
        <div className="flex items-center gap-1">
          {filters.status && (
            <Badge
              variant="secondary"
              className="h-6 gap-1 text-[10px] pr-1"
            >
              {defaultStatuses.find((s) => s.id === filters.status)?.name}
              <button
                onClick={() => handleStatusChange("all")}
                className="ml-0.5 hover:text-destructive"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {filters.trade && (
            <Badge
              variant="secondary"
              className="h-6 gap-1 text-[10px] pr-1"
            >
              {filters.trade}
              <button
                onClick={() => handleTradeChange("all")}
                className="ml-0.5 hover:text-destructive"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
        </div>
      )}
    </div>
  );
}
