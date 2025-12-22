"use client";

/**
 * TabNavigation - Multi-level tab navigation component
 *
 * Renders tab navigation with support for 3 levels:
 * - L1: Primary tabs (Overview, Documents, Xero, etc.)
 * - L2: Secondary tabs (Information, Corporate, Directors under Overview)
 * - L3: Tertiary tabs (used by Xero for Connection, Accounts, Reports, etc.)
 *
 * Uses shadcn/ui Tabs component for consistent styling.
 */

import * as React from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import type { EntityTab } from "@/lib/types/entity-tabs";

// ============================================
// TYPES
// ============================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type IconComponent = React.ComponentType<{ className?: string }>;

interface TabNavigationProps {
  /** Level 1 tabs */
  l1Tabs: EntityTab[];
  /** Level 2 tabs (children of active L1) */
  l2Tabs: EntityTab[];
  /** Level 3 tabs (children of active L2) */
  l3Tabs: EntityTab[];

  /** Active tab keys */
  activeL1Key: string | null;
  activeL2Key: string | null;
  activeL3Key: string | null;

  /** Change handlers */
  onL1Change: (tabKey: string) => void;
  onL2Change: (tabKey: string) => void;
  onL3Change: (tabKey: string) => void;

  /** Optional: Custom className for container */
  className?: string;
}

// ============================================
// ICON HELPER
// ============================================

/**
 * Get Lucide icon component by name
 * Falls back to null if icon not found
 *
 * Icon names are stored as kebab-case in database (e.g., "file-text")
 * and converted to PascalCase for Lucide component lookup (e.g., "FileText")
 */
function getIcon(iconName: string | null): IconComponent | null {
  if (!iconName) return null;

  // Convert icon_name to component name (e.g., "file-text" -> "FileText")
  const componentName = iconName
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");

  // Dynamic require to get icon component
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const LucideIcons = require("lucide-react") as Record<string, IconComponent>;
    return LucideIcons[componentName] || null;
  } catch {
    return null;
  }
}

// ============================================
// TAB LEVEL COMPONENT
// ============================================

interface TabLevelProps {
  tabs: EntityTab[];
  activeKey: string | null;
  onChange: (tabKey: string) => void;
  level: 1 | 2 | 3;
  className?: string;
}

function TabLevel({ tabs, activeKey, onChange, level, className }: TabLevelProps) {
  if (tabs.length === 0) return null;

  // Style variants by level
  const levelStyles = {
    1: "border-b bg-background",
    2: "border-b bg-muted/30",
    3: "border-b bg-muted/10 text-sm",
  };

  const triggerStyles = {
    1: "data-[state=active]:bg-background data-[state=active]:shadow-sm",
    2: "data-[state=active]:bg-background/80 text-sm",
    3: "data-[state=active]:bg-background/60 text-xs",
  };

  return (
    <div className={cn(levelStyles[level], className)}>
      <Tabs
        value={activeKey || undefined}
        onValueChange={onChange}
        className="w-full"
      >
        <TabsList className="bg-transparent h-auto p-0 gap-0 justify-start">
          {tabs.map((tab) => {
            const Icon = getIcon(tab.icon_name);

            return (
              <TabsTrigger
                key={tab.tab_key}
                value={tab.tab_key}
                className={cn(
                  "rounded-none border-b-2 border-transparent px-4 py-2.5",
                  "data-[state=active]:border-primary",
                  triggerStyles[level]
                )}
              >
                <div className="flex items-center gap-2">
                  {Icon && <Icon className="h-4 w-4" />}
                  <span>{tab.display_name}</span>
                  {/* Show document count badge if > 0 */}
                  {tab.document_count > 0 && (
                    <span className="ml-1 px-1.5 py-0.5 text-[10px] rounded-full bg-muted text-muted-foreground">
                      {tab.document_count}
                    </span>
                  )}
                </div>
              </TabsTrigger>
            );
          })}
        </TabsList>
      </Tabs>
    </div>
  );
}

// ============================================
// MAIN COMPONENT
// ============================================

export function TabNavigation({
  l1Tabs,
  l2Tabs,
  l3Tabs,
  activeL1Key,
  activeL2Key,
  activeL3Key,
  onL1Change,
  onL2Change,
  onL3Change,
  className,
}: TabNavigationProps) {
  return (
    <div className={cn("flex flex-col", className)}>
      {/* Level 1 - Primary tabs */}
      <TabLevel
        tabs={l1Tabs}
        activeKey={activeL1Key}
        onChange={onL1Change}
        level={1}
      />

      {/* Level 2 - Secondary tabs (only show if L2 tabs exist) */}
      {l2Tabs.length > 0 && (
        <TabLevel
          tabs={l2Tabs}
          activeKey={activeL2Key}
          onChange={onL2Change}
          level={2}
        />
      )}

      {/* Level 3 - Tertiary tabs (only show if L3 tabs exist) */}
      {l3Tabs.length > 0 && (
        <TabLevel
          tabs={l3Tabs}
          activeKey={activeL3Key}
          onChange={onL3Change}
          level={3}
        />
      )}
    </div>
  );
}

// ============================================
// SIMPLE TAB LIST (for pages that don't need full hierarchy)
// ============================================

interface SimpleTabListProps {
  tabs: EntityTab[];
  activeKey: string | null;
  onChange: (tabKey: string) => void;
  className?: string;
}

export function SimpleTabList({
  tabs,
  activeKey,
  onChange,
  className,
}: SimpleTabListProps) {
  return (
    <TabLevel
      tabs={tabs}
      activeKey={activeKey}
      onChange={onChange}
      level={1}
      className={className}
    />
  );
}

export default TabNavigation;
