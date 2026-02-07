"use client";

import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Settings, FolderArchive, Mail, PenTool, Camera } from "lucide-react";
import { cn } from "@/lib/utils";
import { TAB_TYPE_CONFIG, type TabType } from "@/lib/constants/tab-types";

// Icon lookup by tab type
const TAB_TYPE_ICONS = {
  system: Settings,
  document: FolderArchive,
  mailbox: Mail,
  revit: PenTool,
  photo: Camera,
} as const;

interface TabTypeBadgeProps {
  tabType: TabType;
  /** 'full' = icon + label, 'compact' = icon + 3-char code, 'icon' = icon only */
  variant?: "full" | "compact" | "icon";
  className?: string;
  showTooltip?: boolean;
}

// SSoT: Reusable badge for displaying tab type
// Replaces the 3 inline badge blocks in WarehouseFolderEditor and WarehouseFoldersConfig
export function TabTypeBadge({
  tabType,
  variant = "full",
  className,
  showTooltip = true,
}: TabTypeBadgeProps) {
  const config = TAB_TYPE_CONFIG[tabType];
  if (!config) return null;

  const Icon = TAB_TYPE_ICONS[tabType];
  const badgeClasses = cn(
    config.color,
    config.darkColor,
    config.textColor,
    "gap-1 border-0",
    className
  );

  const badge = (
    <Badge className={badgeClasses}>
      <Icon className="h-3 w-3" />
      {variant === "full" && <span>{config.label}</span>}
      {variant === "compact" && <span>{config.shortLabel}</span>}
    </Badge>
  );

  if (!showTooltip || variant === "full") return badge;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>{badge}</TooltipTrigger>
        <TooltipContent>
          <p>{config.description}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// Compact inline badge for folder tree views (icon + 3-char code with tooltip)
export function TabTypeBadgeCompact({
  tabType,
  className,
}: {
  tabType: TabType;
  className?: string;
}) {
  const config = TAB_TYPE_CONFIG[tabType];
  if (!config) return null;

  const Icon = TAB_TYPE_ICONS[tabType];

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={cn(
              "flex items-center gap-0.5 px-1 py-0.5 rounded text-[10px] font-medium",
              config.color,
              config.darkColor,
              config.textColor,
              className
            )}
          >
            <Icon className="h-3 w-3" />
            <span>{config.shortLabel}</span>
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p>{config.label} - {config.description}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
