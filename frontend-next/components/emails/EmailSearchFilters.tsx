"use client";

import * as React from "react";
import { useState, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Search,
  SlidersHorizontal,
  X,
  Calendar as CalendarIcon,
  Paperclip,
  Mail,
  Inbox,
  ArrowUpRight,
  ArrowDownLeft,
  AlertCircle,
} from "lucide-react";
import type { DateRange } from "react-day-picker";
import { format } from "date-fns";
import type { EmailFilters, UseEmailFiltersReturn } from "@/hooks/useEmailFilters";

export interface EmailSearchFiltersProps {
  /** Filter state from useEmailFilters hook */
  filters: EmailFilters;
  /** Set a single filter value */
  setFilter: UseEmailFiltersReturn["setFilter"];
  /** Set search text */
  setSearch: UseEmailFiltersReturn["setSearch"];
  /** Clear all filters */
  clearFilters: UseEmailFiltersReturn["clearFilters"];
  /** Whether any filters are active */
  hasActiveFilters: boolean;
  /** Count of active filters */
  activeFilterCount: number;
  /** Active filter labels for badges */
  activeFilterLabels: string[];
  /** Called when search should be executed */
  onSearch: () => void;
  /** Additional className */
  className?: string;
}

/**
 * Email search bar with advanced filters popover
 *
 * Features:
 * - Text search input
 * - Filter button with popover
 * - Date range filter
 * - Has attachments filter
 * - Unassigned filter
 * - Unread filter
 * - Active filter badges
 */
export function EmailSearchFilters({
  filters,
  setFilter,
  setSearch,
  clearFilters,
  hasActiveFilters,
  activeFilterCount,
  activeFilterLabels,
  onSearch,
  className,
}: EmailSearchFiltersProps) {
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [datePickerOpen, setDatePickerOpen] = useState(false);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        onSearch();
      }
    },
    [onSearch]
  );

  const handleClearSearch = useCallback(() => {
    setSearch("");
    onSearch();
  }, [setSearch, onSearch]);

  const handleClearFilters = useCallback(() => {
    clearFilters();
    onSearch();
  }, [clearFilters, onSearch]);

  const handleDateRangeSelect = useCallback(
    (range: DateRange | undefined) => {
      setFilter("dateRange", range);
    },
    [setFilter]
  );

  const handleRemoveFilter = useCallback(
    (label: string) => {
      // Determine which filter to remove based on label
      if (label.startsWith("From/To:")) {
        setFilter("email", "");
      } else if (label.includes(" - ") || label.startsWith("After") || label.startsWith("Before")) {
        setFilter("dateRange", undefined);
      } else if (label === "Has attachments") {
        setFilter("hasAttachments", false);
      } else if (label === "Unassigned") {
        setFilter("unassigned", false);
      } else if (label === "Unread") {
        setFilter("unread", false);
      } else if (["Sent", "Received", "CC'd", "BCC'd"].includes(label)) {
        setFilter("direction", "");
      } else if (["High importance", "Normal importance", "Low importance"].includes(label)) {
        setFilter("importance", "");
      }
      onSearch();
    },
    [setFilter, onSearch]
  );

  const formatDateRange = () => {
    if (!filters.dateRange?.from) return "Select date range";
    if (filters.dateRange.to) {
      return `${format(filters.dateRange.from, "MMM d")} - ${format(filters.dateRange.to, "MMM d, yyyy")}`;
    }
    return `From ${format(filters.dateRange.from, "MMM d, yyyy")}`;
  };

  return (
    <div className={cn("space-y-2", className)}>
      {/* Search bar row */}
      <div className="flex items-center gap-2">
        {/* Search input */}
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search subject, body, addresses... (from: to: has:attachment is:unread)"
            value={filters.search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={handleKeyDown}
            className="pl-8 pr-8 h-8 text-sm"
            title="Operators: from:email to:email subject:text has:attachment is:unread is:starred before:YYYY-MM-DD after:YYYY-MM-DD"
          />
          {filters.search && (
            <button
              onClick={handleClearSearch}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Filter button */}
        <Popover open={filtersOpen} onOpenChange={setFiltersOpen}>
          <PopoverTrigger asChild>
            <Button
              variant={hasActiveFilters ? "default" : "outline"}
              size="sm"
              className="h-8 gap-1.5"
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Filters</span>
              {activeFilterCount > 0 && (
                <Badge
                  variant="secondary"
                  className="h-4 w-4 p-0 flex items-center justify-center text-[10px] bg-background text-foreground"
                >
                  {activeFilterCount}
                </Badge>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-4" align="end">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-medium text-sm">Filters</h4>
                {hasActiveFilters && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-xs text-muted-foreground"
                    onClick={handleClearFilters}
                  >
                    Clear all
                  </Button>
                )}
              </div>

              {/* Email address filter */}
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Mail className="h-3 w-3" />
                  From/To email
                </Label>
                <Input
                  placeholder="email@example.com"
                  value={filters.email}
                  onChange={(e) => setFilter("email", e.target.value)}
                  className="h-8 text-sm"
                />
              </div>

              {/* Date range filter */}
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <CalendarIcon className="h-3 w-3" />
                  Date range
                </Label>
                <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full h-8 justify-start text-sm font-normal",
                        !filters.dateRange?.from && "text-muted-foreground"
                      )}
                    >
                      {formatDateRange()}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="range"
                      defaultMonth={filters.dateRange?.from}
                      selected={filters.dateRange}
                      onSelect={handleDateRangeSelect}
                      numberOfMonths={2}
                    />
                    <div className="flex items-center justify-between p-3 border-t">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setFilter("dateRange", undefined);
                          setDatePickerOpen(false);
                        }}
                      >
                        Clear
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => setDatePickerOpen(false)}
                      >
                        Apply
                      </Button>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>

              {/* Direction filter */}
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <ArrowUpRight className="h-3 w-3" />
                  Direction
                </Label>
                <Select
                  value={filters.direction}
                  onValueChange={(value) => setFilter("direction", value as "" | "sent" | "received" | "cc" | "bcc")}
                >
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue placeholder="All directions" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All directions</SelectItem>
                    <SelectItem value="received">
                      <span className="flex items-center gap-1.5">
                        <ArrowDownLeft className="h-3 w-3" />
                        Received
                      </span>
                    </SelectItem>
                    <SelectItem value="sent">
                      <span className="flex items-center gap-1.5">
                        <ArrowUpRight className="h-3 w-3" />
                        Sent
                      </span>
                    </SelectItem>
                    <SelectItem value="cc">CC'd</SelectItem>
                    <SelectItem value="bcc">BCC'd</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Importance filter */}
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <AlertCircle className="h-3 w-3" />
                  Importance
                </Label>
                <Select
                  value={filters.importance}
                  onValueChange={(value) => setFilter("importance", value as "" | "high" | "normal" | "low")}
                >
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue placeholder="All importance" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All importance</SelectItem>
                    <SelectItem value="high">
                      <span className="flex items-center gap-1.5">
                        <AlertCircle className="h-3 w-3 text-red-500" />
                        High
                      </span>
                    </SelectItem>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Checkbox filters */}
              <div className="space-y-3 pt-2 border-t">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="hasAttachments"
                    checked={filters.hasAttachments}
                    onCheckedChange={(checked) =>
                      setFilter("hasAttachments", checked === true)
                    }
                  />
                  <Label
                    htmlFor="hasAttachments"
                    className="text-sm font-normal flex items-center gap-1.5 cursor-pointer"
                  >
                    <Paperclip className="h-3.5 w-3.5 text-muted-foreground" />
                    Has attachments
                  </Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="unassigned"
                    checked={filters.unassigned}
                    onCheckedChange={(checked) =>
                      setFilter("unassigned", checked === true)
                    }
                  />
                  <Label
                    htmlFor="unassigned"
                    className="text-sm font-normal flex items-center gap-1.5 cursor-pointer"
                  >
                    <Inbox className="h-3.5 w-3.5 text-muted-foreground" />
                    Unassigned to job
                  </Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="unread"
                    checked={filters.unread}
                    onCheckedChange={(checked) =>
                      setFilter("unread", checked === true)
                    }
                  />
                  <Label
                    htmlFor="unread"
                    className="text-sm font-normal flex items-center gap-1.5 cursor-pointer"
                  >
                    <span className="h-2 w-2 rounded-full bg-blue-500" />
                    Unread only
                  </Label>
                </div>
              </div>

              {/* Apply button */}
              <div className="pt-2">
                <Button
                  className="w-full"
                  size="sm"
                  onClick={() => {
                    setFiltersOpen(false);
                    onSearch();
                  }}
                >
                  Apply filters
                </Button>
              </div>
            </div>
          </PopoverContent>
        </Popover>

        {/* Search button */}
        <Button size="sm" className="h-8" onClick={onSearch}>
          Search
        </Button>
      </div>

      {/* Active filter badges */}
      {activeFilterLabels.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {activeFilterLabels.map((label) => (
            <Badge
              key={label}
              variant="secondary"
              className="text-xs gap-1 pr-1 h-5"
            >
              {label}
              <button
                onClick={() => handleRemoveFilter(label)}
                className="hover:bg-muted rounded-full p-0.5"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </Badge>
          ))}
          <Button
            variant="ghost"
            size="sm"
            className="h-5 text-xs text-muted-foreground px-1.5"
            onClick={handleClearFilters}
          >
            Clear all
          </Button>
        </div>
      )}
    </div>
  );
}

export default EmailSearchFilters;
