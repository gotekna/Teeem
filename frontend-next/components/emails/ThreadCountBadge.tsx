"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ThreadCountBadgeProps {
  /** Number of emails in the thread */
  count: number;
  /** Whether the thread is currently expanded */
  isExpanded?: boolean;
  /** Additional class names */
  className?: string;
}

/**
 * Badge showing the number of emails in a thread
 *
 * Only renders when count > 1 (threads with 2+ emails)
 */
export function ThreadCountBadge({
  count,
  isExpanded = false,
  className,
}: ThreadCountBadgeProps) {
  // Don't show badge for single emails or no count
  if (!count || count <= 1) {
    return null;
  }

  return (
    <Badge
      variant="secondary"
      className={cn(
        "text-[10px] px-1.5 py-0 h-4 font-medium",
        isExpanded && "bg-primary/20 text-primary",
        className
      )}
    >
      <MessageSquare className="h-2.5 w-2.5 mr-0.5" />
      {count}
    </Badge>
  );
}

export default ThreadCountBadge;
