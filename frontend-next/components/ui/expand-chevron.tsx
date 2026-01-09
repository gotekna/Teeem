"use client";

import * as React from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ExpandChevronProps {
  /** Whether the item is expanded */
  expanded: boolean;
  /** Size of the chevron (default: 16) */
  size?: number;
  /** Additional className */
  className?: string;
  /** Click handler */
  onClick?: (e: React.MouseEvent) => void;
}

/**
 * ExpandChevron - SSoT component for expand/collapse indicators
 *
 * Uses a single ChevronRight icon that rotates 90° when expanded.
 * This provides a consistent look across TeeemTableView, GanttCanvasView,
 * and other expandable UI elements.
 *
 * Usage:
 * ```tsx
 * <ExpandChevron expanded={isExpanded} onClick={toggleExpand} />
 * ```
 */
export function ExpandChevron({
  expanded,
  size = 16,
  className,
  onClick,
}: ExpandChevronProps) {
  return (
    <ChevronRight
      className={cn(
        "shrink-0 transition-transform duration-200",
        expanded && "rotate-90",
        onClick && "cursor-pointer hover:bg-muted rounded",
        className
      )}
      style={{ width: size, height: size }}
      onClick={onClick}
    />
  );
}

export default ExpandChevron;
