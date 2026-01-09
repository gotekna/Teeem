"use client";

/**
 * TokenBadge - Individual draggable token badge
 *
 * THE ONE component for displaying placeholder tokens in template builders.
 * See: frontend-next/lib/component-registry.ts
 *
 * Usage:
 * ```tsx
 * import { TokenBadge } from "@/components/ui/tokens";
 *
 * <TokenBadge
 *   code="{CompanyCode}"
 *   color="purple"
 *   onRemove={() => removeToken(index)}
 *   draggable
 * />
 * ```
 */

import * as React from "react";
import { X, GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  type PlaceholderColor,
  PLACEHOLDER_COLOR_CLASSES,
} from "@/lib/placeholders";

export interface TokenBadgeProps {
  /** The placeholder code, e.g., "{CompanyCode}" */
  code: string;
  /** Color variant */
  color?: PlaceholderColor;
  /** Whether the token can be removed */
  removable?: boolean;
  /** Callback when remove is clicked */
  onRemove?: () => void;
  /** Whether the token is draggable */
  draggable?: boolean;
  /** Drag event handlers (from useDraggable or useSortable) */
  dragHandleProps?: React.HTMLAttributes<HTMLDivElement>;
  /** Whether the token is currently being dragged */
  isDragging?: boolean;
  /** Size variant */
  size?: "sm" | "md" | "lg";
  /** Additional class names */
  className?: string;
  /** Click handler */
  onClick?: () => void;
}

const sizeClasses = {
  sm: "text-[10px] px-1.5 py-0.5 gap-1",
  md: "text-xs px-2 py-1 gap-1.5",
  lg: "text-sm px-2.5 py-1.5 gap-2",
};

const iconSizes = {
  sm: "h-2.5 w-2.5",
  md: "h-3 w-3",
  lg: "h-3.5 w-3.5",
};

export function TokenBadge({
  code,
  color = "gray",
  removable = false,
  onRemove,
  draggable = false,
  dragHandleProps,
  isDragging = false,
  size = "md",
  className,
  onClick,
}: TokenBadgeProps) {
  const colorClasses = PLACEHOLDER_COLOR_CLASSES[color];

  return (
    <span
      className={cn(
        "inline-flex items-center font-mono rounded-none border",
        sizeClasses[size],
        colorClasses.bg,
        colorClasses.text,
        colorClasses.border,
        isDragging && "opacity-50 shadow-lg",
        onClick && "cursor-pointer hover:opacity-80",
        className
      )}
      onClick={onClick}
    >
      {/* Drag Handle */}
      {draggable && (
        <span
          {...dragHandleProps}
          className="cursor-grab active:cursor-grabbing touch-none"
          onClick={(e) => e.stopPropagation()}
        >
          <GripVertical className={cn(iconSizes[size], "opacity-50")} />
        </span>
      )}

      {/* Token Code */}
      <span className="truncate">{code}</span>

      {/* Remove Button */}
      {removable && onRemove && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="hover:opacity-100 opacity-60 transition-opacity"
        >
          <X className={iconSizes[size]} />
        </button>
      )}
    </span>
  );
}
