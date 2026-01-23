/**
 * EmptyState - SSoT for all empty state displays
 *
 * Use this component when there's no data to display (empty lists, search results, etc.)
 *
 * Usage:
 *   import { EmptyState } from "@/components/ui/empty-state";
 *
 *   <EmptyState title="No documents found" />
 *
 *   <EmptyState
 *     icon={<FileSearch className="h-12 w-12" />}
 *     title="No search results"
 *     description="Try adjusting your search or filters"
 *     action={{ label: "Clear filters", onClick: handleClear }}
 *   />
 */

import * as React from "react";
import { FileSearch } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export interface EmptyStateAction {
  label: string;
  onClick: () => void;
  variant?: "default" | "outline" | "secondary" | "ghost" | "link";
}

export interface EmptyStateProps {
  /** Icon to display (defaults to FileSearch) */
  icon?: React.ReactNode;
  /** Main title/message */
  title: string;
  /** Optional description text */
  description?: string;
  /** Optional action button */
  action?: EmptyStateAction;
  /** Additional class names */
  className?: string;
  /** Size variant */
  size?: "sm" | "md" | "lg";
}

/**
 * EmptyState - THE ONE component for empty state displays
 *
 * Use for:
 * - Empty tables/lists
 * - No search results
 * - No data in a section
 * - Empty dropdowns/comboboxes
 */
export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
  size = "md",
}: EmptyStateProps) {
  const sizeClasses = {
    sm: {
      container: "py-6 px-4",
      icon: "[&>svg]:h-8 [&>svg]:w-8",
      title: "text-sm",
      description: "text-xs",
      button: "text-xs h-7 px-2",
    },
    md: {
      container: "py-8 px-6",
      icon: "[&>svg]:h-12 [&>svg]:w-12",
      title: "text-base",
      description: "text-sm",
      button: "text-sm h-8 px-3",
    },
    lg: {
      container: "py-12 px-8",
      icon: "[&>svg]:h-16 [&>svg]:w-16",
      title: "text-lg",
      description: "text-base",
      button: "text-base h-9 px-4",
    },
  };

  const classes = sizeClasses[size];

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center",
        classes.container,
        className
      )}
    >
      {/* Icon */}
      <div className={cn("text-muted-foreground/50 mb-4", classes.icon)}>
        {icon ?? <FileSearch />}
      </div>

      {/* Title */}
      <p className={cn("font-medium text-muted-foreground", classes.title)}>
        {title}
      </p>

      {/* Description */}
      {description && (
        <p className={cn("text-muted-foreground/70 mt-1 max-w-sm", classes.description)}>
          {description}
        </p>
      )}

      {/* Action */}
      {action && (
        <Button
          variant={action.variant ?? "outline"}
          onClick={action.onClick}
          className={cn("mt-4", classes.button)}
        >
          {action.label}
        </Button>
      )}
    </div>
  );
}
