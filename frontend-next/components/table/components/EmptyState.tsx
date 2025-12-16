"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { Search, Filter, Database, AlertCircle, Plus, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

export type EmptyStateVariant = "no-data" | "no-search-results" | "no-filter-results" | "error" | "loading";

interface EmptyStateProps {
  /** The type of empty state to display */
  variant: EmptyStateVariant;
  /** Optional custom title */
  title?: string;
  /** Optional custom description */
  description?: string;
  /** Whether the table is in loading/searching state */
  isLoading?: boolean;
  /** The current search term (for display) */
  searchTerm?: string;
  /** Number of active filters (for display) */
  filterCount?: number;
  /** Callback when "Clear Search" is clicked */
  onClearSearch?: () => void;
  /** Callback when "Clear Filters" is clicked */
  onClearFilters?: () => void;
  /** Callback when "Add Record" is clicked */
  onAddRecord?: () => void;
  /** Callback when "Retry" is clicked */
  onRetry?: () => void;
  /** Optional className for the container */
  className?: string;
}

/**
 * EmptyState - Beautiful empty state displays for tables
 *
 * Shows contextual messages and suggested actions based on why the table is empty:
 * - no-data: Table has no records at all
 * - no-search-results: Search returned no matches
 * - no-filter-results: Filters returned no matches
 * - error: API or other error occurred
 * - loading: Data is being fetched
 */
export function EmptyState({
  variant,
  title,
  description,
  isLoading = false,
  searchTerm,
  filterCount = 0,
  onClearSearch,
  onClearFilters,
  onAddRecord,
  onRetry,
  className,
}: EmptyStateProps) {
  // Loading state
  if (isLoading || variant === "loading") {
    return (
      <div className={cn("flex flex-col items-center justify-center py-16 px-4", className)}>
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent mb-4" />
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    );
  }

  // Determine content based on variant
  const getContent = () => {
    switch (variant) {
      case "no-search-results":
        return {
          icon: Search,
          iconBg: "bg-amber-50 dark:bg-amber-950/30",
          iconColor: "text-amber-600 dark:text-amber-400",
          defaultTitle: "No search results",
          defaultDescription: searchTerm
            ? `No records match "${searchTerm}"`
            : "Try adjusting your search terms",
          actions: onClearSearch ? (
            <Button variant="outline" size="sm" onClick={onClearSearch}>
              Clear search
            </Button>
          ) : null,
        };

      case "no-filter-results":
        return {
          icon: Filter,
          iconBg: "bg-blue-50 dark:bg-blue-950/30",
          iconColor: "text-blue-600 dark:text-blue-400",
          defaultTitle: "No matching records",
          defaultDescription: filterCount > 0
            ? `No records match your ${filterCount} active filter${filterCount > 1 ? "s" : ""}`
            : "Try adjusting your filters to see more results",
          actions: onClearFilters ? (
            <Button variant="outline" size="sm" onClick={onClearFilters}>
              Clear filters
            </Button>
          ) : null,
        };

      case "error":
        return {
          icon: AlertCircle,
          iconBg: "bg-red-50 dark:bg-red-950/30",
          iconColor: "text-red-600 dark:text-red-400",
          defaultTitle: "Something went wrong",
          defaultDescription: "We couldn't load the data. Please try again.",
          actions: onRetry ? (
            <Button variant="outline" size="sm" onClick={onRetry}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </Button>
          ) : null,
        };

      case "no-data":
      default:
        return {
          icon: Database,
          iconBg: "bg-gray-50 dark:bg-gray-800",
          iconColor: "text-gray-400 dark:text-gray-500",
          defaultTitle: "No records yet",
          defaultDescription: "Get started by adding your first record",
          actions: onAddRecord ? (
            <Button size="sm" onClick={onAddRecord}>
              <Plus className="h-4 w-4 mr-2" />
              Add record
            </Button>
          ) : null,
        };
    }
  };

  const content = getContent();
  const Icon = content.icon;

  return (
    <div
      className={cn("flex flex-col items-center justify-center py-16 px-4", className)}
      role="status"
      aria-live="polite"
    >
      {/* Icon container */}
      <div
        className={cn(
          "flex items-center justify-center w-16 h-16 rounded-full mb-4",
          content.iconBg
        )}
        aria-hidden="true"
      >
        <Icon className={cn("h-8 w-8", content.iconColor)} />
      </div>

      {/* Title */}
      <h3 className="text-lg font-medium text-foreground mb-1">
        {title || content.defaultTitle}
      </h3>

      {/* Description */}
      <p className="text-sm text-muted-foreground text-center max-w-md mb-4">
        {description || content.defaultDescription}
      </p>

      {/* Actions */}
      {content.actions && (
        <div className="flex items-center gap-2" role="group" aria-label="Available actions">
          {content.actions}
        </div>
      )}
    </div>
  );
}

/**
 * Determine which empty state variant to show based on context
 */
export function getEmptyStateVariant(options: {
  hasData: boolean;
  hasSearch: boolean;
  hasFilters: boolean;
  hasError?: boolean;
}): EmptyStateVariant {
  const { hasData, hasSearch, hasFilters, hasError } = options;

  if (hasError) {
    return "error";
  }

  // If there's no data at all (no entries ever loaded)
  if (!hasData) {
    return "no-data";
  }

  // Data exists but search returned nothing
  if (hasSearch) {
    return "no-search-results";
  }

  // Data exists but filters returned nothing
  if (hasFilters) {
    return "no-filter-results";
  }

  // Default to no-data
  return "no-data";
}

export default EmptyState;
