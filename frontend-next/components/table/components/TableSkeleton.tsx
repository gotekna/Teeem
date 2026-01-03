"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface TableSkeletonProps {
  /** Number of rows to show */
  rowCount?: number;
  /** Number of columns to show */
  columnCount?: number;
  /** Whether to show the header skeleton */
  showHeader?: boolean;
  /** Show as grouped table (collapsed group headers) - prevents CLS for grouped views */
  grouped?: boolean;
  /** Number of group headers to show when grouped=true */
  groupCount?: number;
  /** Optional className for the container */
  className?: string;
}

/**
 * Skeleton pulse animation for loading cells
 */
function SkeletonCell({ width = "w-full" }: { width?: string }) {
  return (
    <div className={cn("h-4 rounded bg-muted animate-pulse", width)} />
  );
}

/**
 * TableSkeleton - Loading skeleton for table views
 *
 * Shows animated skeleton rows while data is loading.
 * Provides visual feedback and maintains layout stability.
 *
 * ULTRA FIX: When grouped=true, shows collapsed group headers instead of flat rows.
 * This prevents CLS (Cumulative Layout Shift) when table will render with grouping.
 */
export function TableSkeleton({
  rowCount = 10,
  columnCount = 6,
  showHeader = true,
  grouped = false,
  groupCount = 4,
  className,
}: TableSkeletonProps) {
  // Vary cell widths for more realistic appearance
  const cellWidths = ["w-3/4", "w-1/2", "w-2/3", "w-full", "w-1/3", "w-4/5"];

  // ULTRA FIX: Grouped skeleton matches collapsed group layout to prevent CLS
  if (grouped) {
    return (
      <div className={cn("border rounded-md overflow-hidden", className)}>
        <Table>
          {showHeader && (
            <TableHeader>
              <TableRow className="bg-muted/50">
                {Array.from({ length: columnCount }).map((_, i) => (
                  <TableHead key={i} className="h-10">
                    <SkeletonCell width="w-20" />
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
          )}
          <TableBody>
            {/* Render group header skeletons (collapsed groups) */}
            {Array.from({ length: groupCount }).map((_, groupIndex) => (
              <TableRow key={groupIndex} className="bg-muted/30">
                <TableCell colSpan={columnCount} className="py-2">
                  <div className="flex items-center gap-2">
                    {/* Expand/collapse chevron skeleton */}
                    <div className="h-4 w-4 rounded bg-muted animate-pulse" />
                    {/* Group name skeleton */}
                    <div className="h-4 w-32 rounded bg-muted animate-pulse" />
                    {/* Count badge skeleton */}
                    <div className="h-4 w-8 rounded bg-muted animate-pulse" />
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  }

  // Flat table skeleton (default)
  return (
    <div className={cn("border rounded-md overflow-hidden", className)}>
      <Table>
        {showHeader && (
          <TableHeader>
            <TableRow className="bg-muted/50">
              {Array.from({ length: columnCount }).map((_, i) => (
                <TableHead key={i} className="h-10">
                  <SkeletonCell width="w-20" />
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
        )}
        <TableBody>
          {Array.from({ length: rowCount }).map((_, rowIndex) => (
            <TableRow key={rowIndex}>
              {Array.from({ length: columnCount }).map((_, colIndex) => (
                <TableCell key={colIndex} className="py-3">
                  <SkeletonCell width={cellWidths[(rowIndex + colIndex) % cellWidths.length]} />
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

/**
 * Inline skeleton for a single row (useful for lazy loading)
 */
export function RowSkeleton({
  columnCount = 6,
  className,
}: {
  columnCount?: number;
  className?: string;
}) {
  const cellWidths = ["w-3/4", "w-1/2", "w-2/3", "w-full", "w-1/3", "w-4/5"];

  return (
    <TableRow className={className}>
      {Array.from({ length: columnCount }).map((_, i) => (
        <TableCell key={i} className="py-3">
          <SkeletonCell width={cellWidths[i % cellWidths.length]} />
        </TableCell>
      ))}
    </TableRow>
  );
}

/**
 * Compact skeleton for table toolbar area
 */
export function ToolbarSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center justify-between p-4 border-b", className)}>
      <div className="flex items-center gap-4">
        {/* Search skeleton */}
        <div className="h-9 w-64 rounded-md bg-muted animate-pulse" />
        {/* Filter button skeleton */}
        <div className="h-9 w-24 rounded-md bg-muted animate-pulse" />
      </div>
      <div className="flex items-center gap-2">
        {/* Action buttons skeleton */}
        <div className="h-9 w-20 rounded-md bg-muted animate-pulse" />
        <div className="h-9 w-20 rounded-md bg-muted animate-pulse" />
      </div>
    </div>
  );
}

/**
 * Full page table skeleton (toolbar + table)
 */
export function FullTableSkeleton({
  rowCount = 10,
  columnCount = 6,
  className,
}: {
  rowCount?: number;
  columnCount?: number;
  className?: string;
}) {
  return (
    <div className={cn("space-y-0", className)}>
      <ToolbarSkeleton />
      <TableSkeleton rowCount={rowCount} columnCount={columnCount} showHeader />
    </div>
  );
}

export default TableSkeleton;
