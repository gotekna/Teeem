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

// SSoT: System badge config (same style as TAB_TYPE_CONFIG.system but used independently)
const SYSTEM_BADGE = TAB_TYPE_CONFIG.system;

interface TabTypeBadgeProps {
  tabType: TabType;
  /** 'full' = icon + label, 'compact' = icon + 3-char code, 'icon' = icon only */
  variant?: "full" | "compact" | "icon";
  /** When true AND tab_type != 'system', renders a separate SYS badge before the tab_type badge */
  isSystem?: boolean;
  className?: string;
  showTooltip?: boolean;
}

// SSoT: THE ONE component for tab badges
// Two independent axes → two separate badges:
//   [SYS] [DOC]  ← is_system=true, tab_type=document (e.g. Task Attachments)
//   [SYS]        ← is_system=true, tab_type=system (e.g. Settings - no redundant second SYS)
//   [DOC]        ← is_system=false, tab_type=document (e.g. user custom tab)
export function TabTypeBadge({
  tabType,
  variant = "full",
  isSystem,
  className,
  showTooltip = true,
}: TabTypeBadgeProps) {
  const config = TAB_TYPE_CONFIG[tabType];
  if (!config) return null;

  const Icon = TAB_TYPE_ICONS[tabType];
  const showSystemBadge = isSystem && tabType !== 'system';
  const badgeClasses = cn(
    config.color,
    config.darkColor,
    config.textColor,
    "gap-1 border-0",
    className
  );

  const typeBadge = (
    <Badge className={badgeClasses}>
      <Icon className="h-3 w-3" />
      {variant === "full" && <span>{config.label}</span>}
      {variant === "compact" && <span>{config.shortLabel}</span>}
    </Badge>
  );

  const wrappedTypeBadge = (!showTooltip || variant === "full") ? typeBadge : (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>{typeBadge}</TooltipTrigger>
        <TooltipContent>
          <p>{config.description}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );

  if (!showSystemBadge) return wrappedTypeBadge;

  const sysBadge = (
    <Badge className={cn(SYSTEM_BADGE.color, SYSTEM_BADGE.darkColor, SYSTEM_BADGE.textColor, "gap-1 border-0", className)}>
      <Settings className="h-3 w-3" />
      {variant === "full" && <span>{SYSTEM_BADGE.label}</span>}
      {variant === "compact" && <span>{SYSTEM_BADGE.shortLabel}</span>}
    </Badge>
  );

  return (
    <div className="flex items-center gap-0.5">
      {sysBadge}
      {wrappedTypeBadge}
    </div>
  );
}

// Compact inline badge for folder tree views (icon + 3-char code with tooltip)
export function TabTypeBadgeCompact({
  tabType,
  isSystem,
  className,
}: {
  tabType: TabType;
  /** When true AND tab_type != 'system', renders a separate SYS badge before the tab_type badge */
  isSystem?: boolean;
  className?: string;
}) {
  const config = TAB_TYPE_CONFIG[tabType];
  if (!config) return null;

  const Icon = TAB_TYPE_ICONS[tabType];
  const showSystemBadge = isSystem && tabType !== 'system';

  const badgeStyle = "flex items-center gap-0.5 px-1 py-0.5 rounded text-[10px] font-medium";

  const typeBadge = (
    <div className={cn(badgeStyle, config.color, config.darkColor, config.textColor, className)}>
      <Icon className="h-3 w-3" />
      <span>{config.shortLabel}</span>
    </div>
  );

  if (!showSystemBadge) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>{typeBadge}</TooltipTrigger>
          <TooltipContent>
            <p>{config.label} - {config.description}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  const sysBadge = (
    <div className={cn(badgeStyle, SYSTEM_BADGE.color, SYSTEM_BADGE.darkColor, SYSTEM_BADGE.textColor, className)}>
      <Settings className="h-3 w-3" />
      <span>{SYSTEM_BADGE.shortLabel}</span>
    </div>
  );

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-0.5">
            {sysBadge}
            {typeBadge}
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p>System-required {config.label.toLowerCase()} tab</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
