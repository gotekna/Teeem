"use client";

import * as React from "react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { PanelRight, PanelBottom, PanelTopClose } from "lucide-react";

export type ReadingPanePosition = "right" | "bottom" | "off";

export interface ReadingPaneToggleProps {
  /** Current position */
  position: ReadingPanePosition;
  /** Called when position changes */
  onPositionChange: (position: ReadingPanePosition) => void;
  /** Additional className */
  className?: string;
}

const POSITION_CONFIG: Record<
  ReadingPanePosition,
  { icon: typeof PanelRight; label: string; description: string }
> = {
  right: {
    icon: PanelRight,
    label: "Right",
    description: "Reading pane on the right",
  },
  bottom: {
    icon: PanelBottom,
    label: "Bottom",
    description: "Reading pane below list",
  },
  off: {
    icon: PanelTopClose,
    label: "Off",
    description: "No preview, opens in full view",
  },
};

const STORAGE_KEY = "teeem_email_reading_pane";

/**
 * Toggle component for email reading pane position
 *
 * Options:
 * - Right: 3-column layout with reading pane on the right (default)
 * - Bottom: 2-column with reading pane stacked below email list
 * - Off: 2-column, clicking email opens full page view
 */
export function ReadingPaneToggle({
  position,
  onPositionChange,
  className,
}: ReadingPaneToggleProps) {
  return (
    <TooltipProvider delayDuration={300}>
      <div className={cn("flex items-center border rounded-md", className)}>
        {(Object.keys(POSITION_CONFIG) as ReadingPanePosition[]).map((pos) => {
          const config = POSITION_CONFIG[pos];
          const Icon = config.icon;
          const isActive = position === pos;
          return (
            <Tooltip key={pos}>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn(
                    "h-6 w-6 rounded-none first:rounded-l-md last:rounded-r-md",
                    isActive && "bg-muted"
                  )}
                  onClick={() => onPositionChange(pos)}
                  aria-label={config.label}
                >
                  <Icon className="h-3 w-3" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">
                <p className="font-medium">{config.label}</p>
                <p className="text-muted-foreground">{config.description}</p>
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </TooltipProvider>
  );
}

/**
 * Hook to manage reading pane position with localStorage persistence
 */
export function useReadingPanePosition() {
  const [position, setPosition] = useState<ReadingPanePosition>("right");
  const [isHydrated, setIsHydrated] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && ["right", "bottom", "off"].includes(stored)) {
      setPosition(stored as ReadingPanePosition);
    }
    setIsHydrated(true);
  }, []);

  // Save to localStorage when position changes
  useEffect(() => {
    if (isHydrated) {
      localStorage.setItem(STORAGE_KEY, position);
    }
  }, [position, isHydrated]);

  return { position, setPosition, isHydrated };
}

export default ReadingPaneToggle;
