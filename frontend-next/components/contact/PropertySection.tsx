"use client";

import React from "react";
import { cn } from "@/lib/utils";

export interface PropertySectionProps {
  /** Section title */
  title: string;
  /** Optional action button on the right */
  action?: React.ReactNode;
  /** Section content */
  children: React.ReactNode;
  /** Custom class for the section */
  className?: string;
}

/**
 * PropertySection - A titled section divider for grouping PropertyRows
 *
 * Brand Guidelines Applied:
 * - 11px label text
 * - #878787 text color
 */
export function PropertySection({
  title,
  action,
  children,
  className,
}: PropertySectionProps) {
  return (
    <div className={cn("space-y-1", className)}>
      <div className="flex items-center justify-between py-2">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {title}
        </h3>
        {action}
      </div>
      <div className="space-y-0">{children}</div>
    </div>
  );
}

export default PropertySection;
