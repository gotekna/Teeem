"use client";

/**
 * TruncatedText - SSoT for text truncation with automatic tooltips
 *
 * Use this component when text might overflow and needs truncation.
 * Automatically shows a tooltip when text is truncated.
 *
 * Usage:
 *   import { TruncatedText } from "@/components/ui/truncated-text";
 *
 *   // Single line truncation by max width
 *   <TruncatedText maxWidth={200}>
 *     This is a very long text that will be truncated
 *   </TruncatedText>
 *
 *   // Multi-line clamping
 *   <TruncatedText lines={2}>
 *     Multi-line text that clamps after 2 lines
 *   </TruncatedText>
 */

import * as React from "react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export interface TruncatedTextProps {
  /** The text content to display */
  children: string;

  /** Max width in pixels (for single-line truncation) */
  maxWidth?: number;

  /** Number of lines to clamp (for multi-line truncation) */
  lines?: number;

  /** Whether to show tooltip on overflow (default: true) */
  showTooltip?: boolean;

  /** Position of the tooltip */
  tooltipSide?: "top" | "bottom" | "left" | "right";

  /** Additional class names */
  className?: string;

  /** Element to render as (default: span) */
  as?: "span" | "p" | "div";
}

/**
 * TruncatedText - THE ONE component for text truncation
 *
 * Use for:
 * - Table cells with limited width
 * - Card titles that might overflow
 * - Any text that needs truncation with tooltip fallback
 */
export function TruncatedText({
  children,
  maxWidth,
  lines,
  showTooltip = true,
  tooltipSide = "top",
  className,
  as: Component = "span",
}: TruncatedTextProps) {
  const textRef = React.useRef<HTMLElement>(null);
  const [isTruncated, setIsTruncated] = React.useState(false);

  // Check if text is actually truncated
  React.useEffect(() => {
    const checkTruncation = () => {
      const element = textRef.current;
      if (!element) return;

      // For multi-line: compare scrollHeight to clientHeight
      // For single-line: compare scrollWidth to clientWidth
      if (lines) {
        setIsTruncated(element.scrollHeight > element.clientHeight);
      } else {
        setIsTruncated(element.scrollWidth > element.clientWidth);
      }
    };

    checkTruncation();

    // Re-check on resize
    const resizeObserver = new ResizeObserver(checkTruncation);
    if (textRef.current) {
      resizeObserver.observe(textRef.current);
    }

    return () => resizeObserver.disconnect();
  }, [children, maxWidth, lines]);

  // Build style object for max-width
  const style: React.CSSProperties = maxWidth
    ? { maxWidth: `${maxWidth}px` }
    : {};

  // Build class names based on truncation mode
  const truncateClasses = lines
    ? cn(
        "overflow-hidden",
        lines === 1 && "line-clamp-1",
        lines === 2 && "line-clamp-2",
        lines === 3 && "line-clamp-3",
        lines === 4 && "line-clamp-4",
        lines === 5 && "line-clamp-5",
        lines === 6 && "line-clamp-6",
        // For lines > 6, use CSS variable
        lines > 6 && `line-clamp-[${lines}]`
      )
    : "truncate";

  const textElement = (
    <Component
      ref={textRef as React.RefObject<HTMLSpanElement & HTMLParagraphElement & HTMLDivElement>}
      style={style}
      className={cn(
        "inline-block",
        truncateClasses,
        className
      )}
    >
      {children}
    </Component>
  );

  // If tooltip disabled or text not truncated, render without tooltip
  if (!showTooltip || !isTruncated) {
    return textElement;
  }

  // Render with tooltip
  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>{textElement}</TooltipTrigger>
        <TooltipContent
          side={tooltipSide}
          className="max-w-xs break-words"
        >
          {children}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// =============================================================================
// Convenience Components
// =============================================================================

/**
 * TruncatedCell - Optimized for table cells
 */
export function TruncatedCell({
  children,
  className,
  ...props
}: Omit<TruncatedTextProps, "as">) {
  return (
    <TruncatedText
      as="span"
      className={cn("block", className)}
      {...props}
    >
      {children}
    </TruncatedText>
  );
}

/**
 * ClampedText - Multi-line text clamping
 */
export function ClampedText({
  children,
  lines = 2,
  className,
  ...props
}: Omit<TruncatedTextProps, "maxWidth">) {
  return (
    <TruncatedText
      as="p"
      lines={lines}
      className={className}
      {...props}
    >
      {children}
    </TruncatedText>
  );
}
