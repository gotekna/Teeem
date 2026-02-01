"use client";

/**
 * HelpTooltip - Contextual help tooltip for UI elements
 *
 * Usage:
 * <HelpTooltip content="This button saves your changes">
 *   <Button>Save</Button>
 * </HelpTooltip>
 *
 * Or with a help icon:
 * <HelpTooltip content="Enter your email address" showIcon>
 *   <Label>Email</Label>
 * </HelpTooltip>
 */

import * as React from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { HelpCircle, Info, Lightbulb } from "lucide-react";
import { cn } from "@/lib/utils";

type TooltipVariant = "default" | "info" | "tip";

interface HelpTooltipProps {
  children: React.ReactNode;
  content: string;
  /** Additional tips shown below main content */
  tips?: string[];
  /** Show help icon next to children */
  showIcon?: boolean;
  /** Icon variant */
  variant?: TooltipVariant;
  /** Icon size */
  iconSize?: "sm" | "md" | "lg";
  /** Position of icon relative to children */
  iconPosition?: "before" | "after";
  /** Tooltip side preference */
  side?: "top" | "right" | "bottom" | "left";
  /** Alignment */
  align?: "start" | "center" | "end";
  /** Additional class for the wrapper */
  className?: string;
  /** Delay before showing tooltip (ms) */
  delayDuration?: number;
}

const iconSizes = {
  sm: "h-3 w-3",
  md: "h-4 w-4",
  lg: "h-5 w-5",
};

const variantIcons = {
  default: HelpCircle,
  info: Info,
  tip: Lightbulb,
};

const variantColors = {
  default: "text-muted-foreground hover:text-foreground",
  info: "text-blue-500 dark:text-blue-400 hover:text-blue-600",
  tip: "text-amber-500 dark:text-amber-400 hover:text-amber-600",
};

export function HelpTooltip({
  children,
  content,
  tips,
  showIcon = false,
  variant = "default",
  iconSize = "sm",
  iconPosition = "after",
  side = "top",
  align = "center",
  className,
  delayDuration = 300,
}: HelpTooltipProps) {
  const Icon = variantIcons[variant];

  const tooltipContent = (
    <div className="max-w-xs">
      <p className="text-sm">{content}</p>
      {tips && tips.length > 0 && (
        <ul className="mt-2 space-y-1">
          {tips.map((tip, i) => (
            <li key={i} className="flex items-start gap-1.5 text-xs text-muted-foreground">
              <Lightbulb className="h-3 w-3 text-amber-500 mt-0.5 flex-shrink-0" />
              <span>{tip}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );

  if (showIcon) {
    return (
      <div className={cn("inline-flex items-center gap-1", className)}>
        {iconPosition === "before" && (
          <TooltipProvider>
            <Tooltip delayDuration={delayDuration}>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className={cn(
                    "inline-flex items-center justify-center transition-colors cursor-help",
                    variantColors[variant]
                  )}
                >
                  <Icon className={iconSizes[iconSize]} />
                </button>
              </TooltipTrigger>
              <TooltipContent side={side} align={align}>
                {tooltipContent}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}

        {children}

        {iconPosition === "after" && (
          <TooltipProvider>
            <Tooltip delayDuration={delayDuration}>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className={cn(
                    "inline-flex items-center justify-center transition-colors cursor-help",
                    variantColors[variant]
                  )}
                >
                  <Icon className={iconSizes[iconSize]} />
                </button>
              </TooltipTrigger>
              <TooltipContent side={side} align={align}>
                {tooltipContent}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
    );
  }

  // Wrap children with tooltip (no icon)
  return (
    <TooltipProvider>
      <Tooltip delayDuration={delayDuration}>
        <TooltipTrigger asChild>
          <span className={cn("cursor-help", className)}>{children}</span>
        </TooltipTrigger>
        <TooltipContent side={side} align={align}>
          {tooltipContent}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/**
 * Standalone help icon with tooltip
 *
 * Usage:
 * <HelpIcon content="This field is required" />
 */
export function HelpIcon({
  content,
  tips,
  variant = "default",
  size = "sm",
  side = "top",
  className,
}: {
  content: string;
  tips?: string[];
  variant?: TooltipVariant;
  size?: "sm" | "md" | "lg";
  side?: "top" | "right" | "bottom" | "left";
  className?: string;
}) {
  const Icon = variantIcons[variant];

  return (
    <TooltipProvider>
      <Tooltip delayDuration={300}>
        <TooltipTrigger asChild>
          <button
            type="button"
            className={cn(
              "inline-flex items-center justify-center transition-colors cursor-help",
              variantColors[variant],
              className
            )}
          >
            <Icon className={iconSizes[size]} />
          </button>
        </TooltipTrigger>
        <TooltipContent side={side}>
          <div className="max-w-xs">
            <p className="text-sm">{content}</p>
            {tips && tips.length > 0 && (
              <ul className="mt-2 space-y-1">
                {tips.map((tip, i) => (
                  <li key={i} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                    <Lightbulb className="h-3 w-3 text-amber-500 mt-0.5 flex-shrink-0" />
                    <span>{tip}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/**
 * Field label with integrated help tooltip
 *
 * Usage:
 * <FieldLabel label="Email" help="Enter your business email address" required />
 */
export function FieldLabel({
  label,
  help,
  tips,
  required = false,
  htmlFor,
  className,
}: {
  label: string;
  help?: string;
  tips?: string[];
  required?: boolean;
  htmlFor?: string;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      <label
        htmlFor={htmlFor}
        className="text-sm font-medium text-foreground"
      >
        {label}
        {required && <span className="text-destructive ml-0.5">*</span>}
      </label>
      {help && (
        <HelpIcon content={help} tips={tips} size="sm" />
      )}
    </div>
  );
}
