"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { AVAILABLE_ICONS, getIcon, ICON_MAP } from "@/lib/icon-map";
import { Search, X, Check } from "lucide-react";

interface UsedIcon {
  id: number;
  icon_name: string;
  display_name: string;
}

interface IconPickerProps {
  value?: string | null;
  onChange: (iconName: string | null) => void;
  usedIcons?: UsedIcon[];
  disableUsed?: boolean;  // If true, used icons are disabled (for root tabs)
  currentTabId?: number;  // Current tab ID (to allow selecting own icon)
  label?: string;
  placeholder?: string;
  showInheritedBadge?: boolean;  // Show "Inherited from parent" badge when no value
  className?: string;
}

// Categorize icons for better UX
const ICON_CATEGORIES: Record<string, string[]> = {
  "Photo": ["Camera", "Image", "Images", "ImagePlus"],
  "Documents": ["FileText", "Folder", "FolderOpen", "FileCheck", "FileBadge", "FileStack", "Files", "ScrollText"],
  "Awards": ["Award", "BadgeCheck", "Medal", "Trophy"],
  "Plans": ["Ruler", "PenTool", "Compass", "LayoutDashboard"],
  "Construction": ["HardHat", "Hammer", "Construction", "Truck"],
  "Finance": ["DollarSign", "TrendingUp", "Receipt", "Wallet", "CreditCard", "PiggyBank", "Calculator", "Banknote"],
  "Communication": ["Mail", "Phone", "Video", "Send", "Inbox", "MessageSquare"],
  "Navigation": ["Home", "Map", "Target", "ExternalLink"],
  "People": ["Users", "UserCog"],
  "Business": ["Briefcase", "Building2", "Package"],
  "Time": ["Calendar", "CalendarClock", "Clock"],
  "Status": ["Eye", "EyeOff", "Check", "X", "Info", "AlertTriangle", "CheckCircle", "XCircle"],
  "Other": ["Shield", "Settings", "Wrench", "Scale", "History", "Workflow", "Layers", "ListTodo", "FileQuestion", "Sparkles", "Zap", "Star", "Tag", "Palette", "Activity", "Cloud", "ClipboardList", "FileSignature", "ShoppingCart", "ClipboardCheck", "BookOpen", "MoreHorizontal", "MoreVertical"],
};

// Get category for an icon
function getIconCategory(iconName: string): string {
  for (const [category, icons] of Object.entries(ICON_CATEGORIES)) {
    if (icons.includes(iconName)) {
      return category;
    }
  }
  return "Other";
}

export function IconPicker({
  value,
  onChange,
  usedIcons = [],
  disableUsed = false,
  currentTabId,
  label,
  placeholder = "Select an icon...",
  showInheritedBadge = false,
  className,
}: IconPickerProps) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");

  // Get the selected icon component
  const SelectedIcon = value ? getIcon(value) : null;

  // Filter icons by search
  const filteredIcons = React.useMemo(() => {
    const searchLower = search.toLowerCase();
    return AVAILABLE_ICONS.filter((name) =>
      name.toLowerCase().includes(searchLower)
    );
  }, [search]);

  // Group filtered icons by category
  const groupedIcons = React.useMemo(() => {
    const groups: Record<string, string[]> = {};

    filteredIcons.forEach((iconName) => {
      const category = getIconCategory(iconName);
      if (!groups[category]) {
        groups[category] = [];
      }
      groups[category].push(iconName);
    });

    // Sort categories to put common ones first
    const categoryOrder = ["Photo", "Documents", "Awards", "Plans", "Finance", "Communication", "Business", "Navigation", "People", "Time", "Construction", "Status", "Other"];
    const sortedGroups: Record<string, string[]> = {};

    categoryOrder.forEach((cat) => {
      if (groups[cat] && groups[cat].length > 0) {
        sortedGroups[cat] = groups[cat];
      }
    });

    return sortedGroups;
  }, [filteredIcons]);

  // Check if an icon is used by another tab
  const isIconUsed = React.useCallback((iconName: string) => {
    return usedIcons.some(
      (used) => used.icon_name === iconName && used.id !== currentTabId
    );
  }, [usedIcons, currentTabId]);

  // Get the tab that uses an icon
  const getIconUser = React.useCallback((iconName: string): UsedIcon | undefined => {
    return usedIcons.find(
      (used) => used.icon_name === iconName && used.id !== currentTabId
    );
  }, [usedIcons, currentTabId]);

  return (
    <div className={cn("space-y-2", className)}>
      {label && <Label>{label}</Label>}

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between h-10"
          >
            <div className="flex items-center gap-2">
              {SelectedIcon ? (
                <>
                  <SelectedIcon className="h-4 w-4" />
                  <span>{value}</span>
                </>
              ) : (
                <span className="text-muted-foreground">{placeholder}</span>
              )}
            </div>
            {value && (
              <X
                className="h-4 w-4 text-muted-foreground hover:text-foreground"
                onClick={(e) => {
                  e.stopPropagation();
                  onChange(null);
                }}
              />
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[400px] p-0" align="start">
          {/* Search */}
          <div className="p-3 border-b">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search icons..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 h-9"
              />
            </div>
          </div>

          {/* Icon grid by category */}
          <div className="max-h-[400px] overflow-y-auto p-2">
            {Object.entries(groupedIcons).map(([category, icons]) => (
              <div key={category} className="mb-4 last:mb-0">
                <div className="text-xs font-medium text-muted-foreground px-1 mb-2">
                  {category}
                </div>
                <div className="grid grid-cols-8 gap-1">
                  {icons.map((iconName) => {
                    const IconComponent = ICON_MAP[iconName] || getIcon(iconName);
                    const isUsed = isIconUsed(iconName);
                    const user = isUsed ? getIconUser(iconName) : null;
                    const isSelected = value === iconName;
                    const isDisabled = disableUsed && isUsed;

                    return (
                      <TooltipProvider key={iconName}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              type="button"
                              onClick={() => {
                                if (!isDisabled) {
                                  onChange(iconName);
                                  setOpen(false);
                                  setSearch("");
                                }
                              }}
                              disabled={isDisabled}
                              className={cn(
                                "h-9 w-9 flex items-center justify-center rounded-md border transition-colors relative",
                                isSelected && "bg-primary text-primary-foreground border-primary",
                                !isSelected && !isDisabled && "hover:bg-muted",
                                isDisabled && "opacity-30 cursor-not-allowed",
                                isUsed && !isDisabled && "border-orange-300 dark:border-orange-700"
                              )}
                            >
                              {isSelected && (
                                <Check className="h-3 w-3 absolute top-0.5 right-0.5 text-primary-foreground" />
                              )}
                              <IconComponent className="h-4 w-4" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="bottom">
                            <p className="font-medium">{iconName}</p>
                            {isUsed && user && (
                              <p className="text-xs text-orange-500">
                                Used by: {user.display_name}
                              </p>
                            )}
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    );
                  })}
                </div>
              </div>
            ))}

            {filteredIcons.length === 0 && (
              <div className="text-center py-6 text-muted-foreground">
                No icons found
              </div>
            )}
          </div>

          {/* Footer with legend */}
          {disableUsed && usedIcons.length > 0 && (
            <div className="border-t p-2 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <span className="w-3 h-3 border border-orange-300 rounded" />
                Used by another tab
              </span>
            </div>
          )}
        </PopoverContent>
      </Popover>

      {/* Show inherited badge for child tabs */}
      {showInheritedBadge && !value && (
        <Badge variant="secondary" className="text-xs">
          Inherited from parent
        </Badge>
      )}
    </div>
  );
}
