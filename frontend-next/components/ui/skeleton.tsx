import type * as React from "react";
import { cn } from "@/lib/utils";

function Skeleton({
  className,
  animate = true,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { animate?: boolean }) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-md",
        // Base color - visible muted background
        "bg-muted",
        // GPU-optimized shimmer overlay effect using transform (not background-position)
        // This prevents CLS (Cumulative Layout Shift) issues
        animate && "before:absolute before:inset-0 before:w-full before:bg-gradient-to-r before:from-transparent before:via-white/20 before:to-transparent before:animate-shimmer",
        className,
      )}
      {...props}
    />
  );
}

export { Skeleton };
