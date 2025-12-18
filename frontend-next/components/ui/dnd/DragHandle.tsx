"use client";

/**
 * DragHandle - Standard 6-dot grip icon for drag-and-drop
 *
 * THE ONE component for drag handles in sortable lists.
 * See: frontend-next/lib/component-registry.ts
 *
 * Usage:
 * ```tsx
 * import { DragHandle } from "@/components/ui/dnd";
 *
 * // Inside a sortable item:
 * <DragHandle {...attributes} {...listeners} />
 *
 * // With custom size:
 * <DragHandle size="lg" {...attributes} {...listeners} />
 * ```
 */

import * as React from "react";
import { GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";
import { DRAG_HANDLE_CLASSES } from "./dnd-config";

export interface DragHandleProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Size of the grip icon */
  size?: "sm" | "md" | "lg";
  /** Additional class names */
  className?: string;
  /** Whether the handle is disabled */
  disabled?: boolean;
}

const sizeClasses = {
  sm: "h-3 w-3",
  md: "h-4 w-4",
  lg: "h-5 w-5",
};

export const DragHandle = React.forwardRef<HTMLDivElement, DragHandleProps>(
  ({ size = "md", className, disabled, onClick, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          DRAG_HANDLE_CLASSES,
          "shrink-0 flex items-center justify-center",
          disabled && "cursor-not-allowed opacity-50",
          className
        )}
        onClick={(e) => {
          // Prevent click from bubbling to parent
          e.stopPropagation();
          onClick?.(e);
        }}
        {...props}
      >
        <GripVertical
          className={cn(
            sizeClasses[size],
            "text-muted-foreground",
            !disabled && "hover:text-foreground transition-colors"
          )}
        />
      </div>
    );
  }
);

DragHandle.displayName = "DragHandle";
