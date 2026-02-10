"use client";

/**
 * ItemBadge - Flexible badge for sortable items
 *
 * THE ONE component for showing item badges in sortable lists.
 * Replaces PositionBadge with full flexibility: position, label, icon, or custom content.
 * See: frontend-next/lib/component-registry.ts
 *
 * Usage:
 * ```tsx
 * import { ItemBadge } from "@/components/ui/dnd";
 *
 * // Numeric position (like PositionBadge):
 * <ItemBadge position={1} />
 *
 * // Custom label:
 * <ItemBadge label="02a" />
 *
 * // Icon only:
 * <ItemBadge icon={Star} color="orange" />
 *
 * // Editable position:
 * <ItemBadge position={1} editable onPositionChange={(newPos) => reorder(newPos)} />
 *
 * // Custom colors:
 * <ItemBadge position={1} color="purple" />
 * ```
 */

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { type LucideIcon } from "lucide-react";

// Color system for ItemBadge
export type ItemBadgeColor =
  | "default"
  | "primary"
  | "purple"
  | "orange"
  | "blue"
  | "green"
  | "gray"
  | "red";

export interface ItemBadgeProps {
  // Content (priority order - first defined wins)
  /** Numeric position (1-indexed) */
  position?: number;
  /** Custom label text (e.g., "00", "02a", "A1") */
  label?: string;
  /** Lucide icon to display */
  icon?: LucideIcon;
  /** Fully custom render function */
  renderContent?: () => React.ReactNode;

  // Styling
  /** Color variant */
  color?: ItemBadgeColor;
  /** Size variant */
  size?: "sm" | "md" | "lg";
  /** Additional class names */
  className?: string;

  // Interactivity (for position/label editing)
  /** Whether the badge can be edited by clicking */
  editable?: boolean;
  /** Callback when position is changed (receives new 1-indexed position) */
  onPositionChange?: (newPosition: number) => void;
  /** Callback when label is changed */
  onLabelChange?: (newLabel: string) => void;
  /** Maximum allowed position (for position editing) */
  maxPosition?: number;
}

// Size classes for badge - must match inputSizeClasses for seamless edit mode transition
const sizeClasses = {
  sm: "text-[9px] px-1 py-0 h-3.5 w-6 leading-[14px]",
  md: "text-[10px] px-1.5 py-0 h-4 w-7 leading-4",
  lg: "text-xs px-2 py-0.5 h-5 w-8 leading-5",
};

// Size classes for input (editing mode) - must match badge sizeClasses exactly
const inputSizeClasses = {
  sm: "h-3.5 min-w-[16px] w-6 text-[9px] leading-[14px]",
  md: "h-4 min-w-[20px] w-7 text-[10px] leading-4",
  lg: "h-5 min-w-[24px] w-8 text-xs leading-5",
};

// Icon size classes
const iconSizeClasses = {
  sm: "h-2.5 w-2.5",
  md: "h-3 w-3",
  lg: "h-3.5 w-3.5",
};

// Color classes for badge background and text
const colorClasses: Record<ItemBadgeColor, string> = {
  default: "bg-transparent border-border text-foreground",
  primary: "bg-primary/10 border-primary/30 text-primary",
  purple: "bg-purple-100 border-purple-300 text-purple-700 dark:bg-purple-900/30 dark:border-purple-700 dark:text-purple-300",
  orange: "bg-orange-100 border-orange-300 text-orange-700 dark:bg-orange-900/30 dark:border-orange-700 dark:text-orange-300",
  blue: "bg-blue-100 border-blue-300 text-blue-700 dark:bg-blue-900/30 dark:border-blue-700 dark:text-blue-300",
  green: "bg-green-100 border-green-300 text-green-700 dark:bg-green-900/30 dark:border-green-700 dark:text-green-300",
  gray: "bg-muted border-border text-foreground dark:bg-card dark:border-border dark:text-muted-foreground",
  red: "bg-red-100 border-red-300 text-red-700 dark:bg-red-900/30 dark:border-red-700 dark:text-red-300",
};

export function ItemBadge({
  position,
  label,
  icon: Icon,
  renderContent,
  color = "default",
  size = "md",
  className,
  editable = false,
  onPositionChange,
  onLabelChange,
  maxPosition,
}: ItemBadgeProps) {
  const [isEditing, setIsEditing] = React.useState(false);
  const [inputValue, setInputValue] = React.useState("");
  const inputRef = React.useRef<HTMLInputElement>(null);

  // Determine what type of content we're showing
  const contentType: "position" | "label" | "icon" | "custom" | "none" =
    renderContent
      ? "custom"
      : Icon
        ? "icon"
        : label !== undefined
          ? "label"
          : position !== undefined
            ? "position"
            : "none";

  // Initialize input value based on content type
  React.useEffect(() => {
    if (!isEditing) {
      if (contentType === "position" && position !== undefined) {
        setInputValue(String(position));
      } else if (contentType === "label" && label !== undefined) {
        setInputValue(label);
      }
    }
  }, [position, label, isEditing, contentType]);

  const handleClick = (e: React.MouseEvent) => {
    // Only stop propagation and handle click when editable
    if (!editable) return;

    e.stopPropagation();

    // Only allow editing for position or label
    if (contentType === "position" && onPositionChange) {
      setIsEditing(true);
      setInputValue(String(position));
      setTimeout(() => inputRef.current?.select(), 0);
    } else if (contentType === "label" && onLabelChange) {
      setIsEditing(true);
      setInputValue(label || "");
      setTimeout(() => inputRef.current?.select(), 0);
    }
  };

  const handleBlur = () => {
    setIsEditing(false);

    if (contentType === "position" && onPositionChange) {
      const newPos = parseInt(inputValue, 10);
      if (!isNaN(newPos) && newPos >= 1 && newPos !== position) {
        const clampedPos = maxPosition ? Math.min(newPos, maxPosition) : newPos;
        onPositionChange(clampedPos);
      } else {
        setInputValue(String(position));
      }
    } else if (contentType === "label" && onLabelChange) {
      if (inputValue !== label) {
        onLabelChange(inputValue);
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleBlur();
    } else if (e.key === "Escape") {
      setIsEditing(false);
      if (contentType === "position") {
        setInputValue(String(position));
      } else if (contentType === "label") {
        setInputValue(label || "");
      }
    }
  };

  // Editing mode - show input
  // Stop all pointer/mouse events to prevent card drag behavior
  if (isEditing) {
    const stopEvent = (e: React.SyntheticEvent) => e.stopPropagation();
    return (
      <Input
        ref={inputRef}
        type={contentType === "position" ? "number" : "text"}
        min={contentType === "position" ? 1 : undefined}
        max={contentType === "position" ? maxPosition : undefined}
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        onClick={stopEvent}
        onPointerDown={stopEvent}
        onMouseDown={stopEvent}
        className={cn(
          contentType === "label" ? "w-12" : inputSizeClasses[size],
          // Match Badge's inline-flex display (override Input's block-level flex)
          "inline-flex items-center justify-center p-0 font-mono border-primary",
          // Hide number input spinners to match badge size exactly
          "[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none",
          className
        )}
      />
    );
  }

  // Render badge content
  const renderBadgeContent = () => {
    switch (contentType) {
      case "custom":
        return renderContent?.();
      case "icon":
        return Icon ? <Icon className={iconSizeClasses[size]} /> : null;
      case "label":
        return label;
      case "position":
        return position;
      case "none":
        return null;
    }
  };

  const isClickable =
    editable &&
    ((contentType === "position" && onPositionChange) ||
      (contentType === "label" && onLabelChange));

  const tooltipText =
    contentType === "position"
      ? "Click to edit position"
      : contentType === "label"
        ? "Click to edit"
        : undefined;

  return (
    <Badge
      variant="outline"
      className={cn(
        sizeClasses[size],
        colorClasses[color],
        "justify-center shrink-0 font-mono",
        isClickable && "cursor-pointer hover:opacity-80",
        className
      )}
      onClick={isClickable ? handleClick : undefined}
      title={isClickable ? tooltipText : undefined}
    >
      {renderBadgeContent()}
    </Badge>
  );
}

