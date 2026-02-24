"use client";

import * as React from "react";
import { Maximize2, Minimize2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSidebar } from "@/contexts/SidebarContext";
import { Button } from "@/components/ui/button";

/**
 * ExpandableSection - Renders children normally or as a fixed overlay
 *
 * When expanded, content fills the viewport below the breadcrumb bar (top-24),
 * respecting sidebar width on desktop. Escape key exits expanded mode.
 *
 * Pattern reused from EntityConfigurationTab's fixed overlay.
 */
interface ExpandableSectionProps {
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  className?: string;
}

export function ExpandableSection({
  expanded,
  onToggle,
  children,
  className,
}: ExpandableSectionProps) {
  const { sidebarWidth } = useSidebar();

  // Escape key exits expanded mode
  React.useEffect(() => {
    if (!expanded) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onToggle();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [expanded, onToggle]);

  // Lock body scroll when expanded
  React.useEffect(() => {
    if (!expanded) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [expanded]);

  if (!expanded) {
    return <div className={className}>{children}</div>;
  }

  return (
    <div
      className={cn(
        "fixed top-24 left-0 md:left-[var(--sidebar-width)] right-0 bottom-0 bg-background flex flex-col z-40 transition-[left] duration-300",
        className
      )}
      style={{ "--sidebar-width": `${sidebarWidth}px` } as React.CSSProperties}
    >
      {children}
    </div>
  );
}

/**
 * ExpandButton - Small toggle button for tab bars
 *
 * Shows Maximize2 when collapsed, Minimize2 when expanded.
 * Designed to sit inline with TabsList.
 */
interface ExpandButtonProps {
  expanded: boolean;
  onToggle: () => void;
  className?: string;
}

export function ExpandButton({ expanded, onToggle, className }: ExpandButtonProps) {
  return (
    <Button
      variant="ghost"
      size="icon"
      className={cn("h-8 w-8 shrink-0", className)}
      onClick={onToggle}
      title={expanded ? "Exit fullscreen (Esc)" : "Expand to fullscreen"}
    >
      {expanded ? (
        <Minimize2 className="h-4 w-4" />
      ) : (
        <Maximize2 className="h-4 w-4" />
      )}
    </Button>
  );
}
