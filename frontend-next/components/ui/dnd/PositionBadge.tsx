"use client";

/**
 * PositionBadge - Editable/read-only position number badge
 *
 * THE ONE component for showing item position in sortable lists.
 * See: frontend-next/lib/component-registry.ts
 *
 * Usage:
 * ```tsx
 * import { PositionBadge } from "@/components/ui/dnd";
 *
 * // Read-only position:
 * <PositionBadge position={1} />
 *
 * // Editable position:
 * <PositionBadge position={1} editable onPositionChange={(newPos) => reorder(newPos)} />
 * ```
 */

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface PositionBadgeProps {
  /** Current position (1-indexed for display) */
  position: number;
  /** Whether the position can be edited by clicking */
  editable?: boolean;
  /** Callback when position is changed (receives new 1-indexed position) */
  onPositionChange?: (newPosition: number) => void;
  /** Maximum allowed position */
  maxPosition?: number;
  /** Size variant */
  size?: "sm" | "md" | "lg";
  /** Additional class names */
  className?: string;
}

const sizeClasses = {
  sm: "text-[9px] px-1 py-0 h-3.5 min-w-[16px]",
  md: "text-[10px] px-1.5 py-0 h-4 min-w-[20px]",
  lg: "text-xs px-2 py-0.5 h-5 min-w-[24px]",
};

const inputSizeClasses = {
  sm: "h-3.5 w-6 text-[9px]",
  md: "h-4 w-7 text-[10px]",
  lg: "h-5 w-8 text-xs",
};

export function PositionBadge({
  position,
  editable = false,
  onPositionChange,
  maxPosition,
  size = "md",
  className,
}: PositionBadgeProps) {
  const [isEditing, setIsEditing] = React.useState(false);
  const [inputValue, setInputValue] = React.useState(String(position));
  const inputRef = React.useRef<HTMLInputElement>(null);

  // Update input value when position changes externally
  React.useEffect(() => {
    if (!isEditing) {
      setInputValue(String(position));
    }
  }, [position, isEditing]);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (editable && onPositionChange) {
      setIsEditing(true);
      // Focus input after state update
      setTimeout(() => inputRef.current?.select(), 0);
    }
  };

  const handleBlur = () => {
    setIsEditing(false);
    const newPos = parseInt(inputValue, 10);
    if (!isNaN(newPos) && newPos >= 1 && newPos !== position) {
      const clampedPos = maxPosition ? Math.min(newPos, maxPosition) : newPos;
      onPositionChange?.(clampedPos);
    } else {
      setInputValue(String(position));
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleBlur();
    } else if (e.key === "Escape") {
      setIsEditing(false);
      setInputValue(String(position));
    }
  };

  if (isEditing) {
    return (
      <Input
        ref={inputRef}
        type="number"
        min={1}
        max={maxPosition}
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        onClick={(e) => e.stopPropagation()}
        className={cn(
          inputSizeClasses[size],
          "p-0 text-center font-mono border-primary",
          className
        )}
      />
    );
  }

  return (
    <Badge
      variant="outline"
      className={cn(
        sizeClasses[size],
        "justify-center shrink-0 font-mono",
        editable && onPositionChange && "cursor-pointer hover:bg-accent",
        className
      )}
      onClick={handleClick}
      title={editable ? "Click to edit position" : undefined}
    >
      {position}
    </Badge>
  );
}
