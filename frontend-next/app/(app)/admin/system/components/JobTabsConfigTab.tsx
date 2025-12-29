"use client";

import * as React from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getIcon } from "@/lib/icon-map";
import {
  SortableList,
  SortableItem,
  reorderByPosition,
} from "@/components/ui/dnd";
import {
  RefreshCw,
  ChevronDown,
  ChevronRight,
  Eye,
  EyeOff,
  CornerDownRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useJobTabs } from "@/lib/hooks/useJobTabs";
import type { JobTab, JobTabReorderItem } from "@/lib/types/job-tabs";

export function JobTabsConfigTab() {
  const { tabs, loading, error, reorderTabs, toggleHidden, setParent, resetToDefaults, refetch } = useJobTabs();
  const [saving, setSaving] = React.useState(false);
  const [expandedItems, setExpandedItems] = React.useState<Set<number>>(new Set());

  // Get top-level items (no parent)
  const topLevelItems = React.useMemo(() => {
    // Flatten all tabs including children as top level for display purposes
    // The actual hierarchy comes from the children property
    return tabs.sort((a, b) => a.position - b.position);
  }, [tabs]);

  // Get all available parents (tabs without parents that could be parents)
  const availableParents = React.useMemo(() => {
    return tabs.filter((t) => !t.is_hidden);
  }, [tabs]);

  // Toggle item expansion to show children
  const toggleExpanded = (itemId: number) => {
    setExpandedItems((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
  };

  // Handle drag-and-drop reorder
  const handleReorder = async (newItems: JobTab[]) => {
    setSaving(true);
    try {
      const reorderData: JobTabReorderItem[] = newItems.map((item, index) => ({
        id: item.id,
        position: index,
        parent_id: null, // Keep existing parent when reordering top level
      }));
      await reorderTabs(reorderData);
    } catch (error) {
      console.error("Failed to reorder tabs:", error);
    } finally {
      setSaving(false);
    }
  };

  // Handle reordering children within a parent
  const handleReorderChildren = async (parentId: number, newChildren: JobTab[]) => {
    setSaving(true);
    try {
      const reorderData: JobTabReorderItem[] = newChildren.map((item, index) => ({
        id: item.id,
        position: index,
        parent_id: parentId,
      }));
      await reorderTabs(reorderData);
    } catch (error) {
      console.error("Failed to reorder children:", error);
    } finally {
      setSaving(false);
    }
  };

  // Handle position badge change (manual position entry)
  const handlePositionChange = async (tab: JobTab, newPosition: number, parentId?: number) => {
    const items = parentId
      ? tabs.find((t) => t.id === parentId)?.children || []
      : topLevelItems;
    const reordered = reorderByPosition(items, tab.id, newPosition);

    if (parentId) {
      handleReorderChildren(parentId, reordered);
    } else {
      handleReorder(reordered);
    }
  };

  // Handle visibility toggle
  const handleToggleHidden = async (tabId: number) => {
    setSaving(true);
    try {
      await toggleHidden(tabId);
    } catch (error) {
      console.error("Failed to toggle visibility:", error);
    } finally {
      setSaving(false);
    }
  };

  // Handle parent assignment
  const handleSetParent = async (tabId: number, parentId: number | null) => {
    setSaving(true);
    try {
      await setParent(tabId, parentId);
    } catch (error) {
      console.error("Failed to set parent:", error);
    } finally {
      setSaving(false);
    }
  };

  // Handle reset to defaults
  const handleReset = async () => {
    if (!confirm("Reset all tab settings to defaults? This will undo all your customizations.")) {
      return;
    }
    setSaving(true);
    try {
      await resetToDefaults();
    } catch (error) {
      console.error("Failed to reset tabs:", error);
    } finally {
      setSaving(false);
    }
  };

  // Render a single tab item
  const renderTabItem = (tab: JobTab, index: number, isChild = false, parentId?: number) => {
    const IconComponent = getIcon(tab.icon);
    const hasChildren = tab.has_children && tab.children?.length > 0;
    const isExpanded = expandedItems.has(tab.id);

    return (
      <SortableItem
        key={tab.id}
        id={tab.id}
        position={index + 1}
        editablePosition
        onPositionChange={(pos) => handlePositionChange(tab, pos, parentId)}
        className={cn(
          "border rounded-lg bg-background",
          tab.is_hidden && "opacity-50",
          isChild && "ml-8"
        )}
      >
        <div className="flex items-center gap-3 flex-1 py-2 px-3">
          {/* Expand/collapse button for items with children */}
          {hasChildren && !isChild ? (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 shrink-0"
              onClick={(e) => {
                e.stopPropagation();
                toggleExpanded(tab.id);
              }}
            >
              {isExpanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </Button>
          ) : isChild ? (
            <CornerDownRight className="h-4 w-4 text-muted-foreground shrink-0" />
          ) : (
            <div className="w-6 shrink-0" />
          )}

          {/* Icon */}
          <div className="h-8 w-8 rounded bg-muted flex items-center justify-center shrink-0">
            <IconComponent className="h-4 w-4" />
          </div>

          {/* Name and slug */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-medium">{tab.name}</span>
              <Badge variant="outline" className="text-xs">
                {tab.slug}
              </Badge>
              {hasChildren && !isChild && (
                <Badge variant="secondary" className="text-xs">
                  {tab.children?.length} children
                </Badge>
              )}
            </div>
          </div>

          {/* Parent selector (not for items that already have children) */}
          {!hasChildren && !isChild && (
            <Select
              value={String(parentId || "none")}
              onValueChange={(value) => handleSetParent(tab.id, value === "none" ? null : Number(value))}
            >
              <SelectTrigger className="w-40 h-8">
                <SelectValue placeholder="No parent" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No parent</SelectItem>
                {availableParents
                  .filter((p) => p.id !== tab.id)
                  .map((parent) => (
                    <SelectItem key={parent.id} value={String(parent.id)}>
                      {parent.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          )}

          {/* Visibility toggle */}
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => handleToggleHidden(tab.id)}
              title={tab.is_hidden ? "Show tab" : "Hide tab"}
            >
              {tab.is_hidden ? (
                <EyeOff className="h-4 w-4 text-muted-foreground" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </SortableItem>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size={32} className="text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-muted-foreground">{error}</p>
          <Button onClick={refetch} className="mt-4">
            Try Again
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">Job Tabs Configuration</h3>
          <p className="text-sm text-muted-foreground">
            Customize your job page tabs. Drag to reorder, toggle visibility, or group tabs together.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleReset}
            disabled={saving}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Reset to Defaults
          </Button>
        </div>
      </div>

      {/* Tabs list */}
      <Card>
        <CardHeader>
          <CardTitle>Tab Order</CardTitle>
          <CardDescription>
            Drag tabs to reorder. Click the eye icon to show/hide tabs.
            Use the parent dropdown to group tabs together.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SortableList items={topLevelItems} onReorder={handleReorder}>
            <div className="space-y-2">
              {topLevelItems.map((tab, index) => (
                <React.Fragment key={tab.id}>
                  {renderTabItem(tab, index)}

                  {/* Render children if expanded */}
                  {expandedItems.has(tab.id) && tab.children && tab.children.length > 0 && (
                    <SortableList
                      items={tab.children}
                      onReorder={(newChildren) => handleReorderChildren(tab.id, newChildren)}
                    >
                      <div className="space-y-2 mt-2">
                        {tab.children.map((child, childIndex) =>
                          renderTabItem(child, childIndex, true, tab.id)
                        )}
                      </div>
                    </SortableList>
                  )}
                </React.Fragment>
              ))}
            </div>
          </SortableList>

          {topLevelItems.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              No tabs configured. Click &quot;Reset to Defaults&quot; to restore default tabs.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Preview section */}
      <Card>
        <CardHeader>
          <CardTitle>Preview</CardTitle>
          <CardDescription>
            This is how your tabs will appear on the job page.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-1 rounded-lg bg-muted p-1">
            {topLevelItems
              .filter((tab) => !tab.is_hidden)
              .map((tab) => {
                const IconComponent = getIcon(tab.icon);
                return (
                  <div
                    key={tab.id}
                    className={cn(
                      "inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium",
                      "bg-background shadow-sm",
                      "gap-2"
                    )}
                  >
                    <IconComponent className="h-4 w-4" />
                    {tab.name}
                    {tab.has_children && tab.children && tab.children.filter((c) => !c.is_hidden).length > 0 && (
                      <span className="text-xs text-muted-foreground">
                        ({tab.children.filter((c) => !c.is_hidden).length})
                      </span>
                    )}
                  </div>
                );
              })}
          </div>
        </CardContent>
      </Card>

      {/* Saving indicator */}
      {saving && (
        <div className="fixed bottom-4 right-4 bg-background border rounded-lg shadow-lg px-4 py-2 flex items-center gap-2">
          <Spinner size={16} />
          <span className="text-sm">Saving...</span>
        </div>
      )}
    </div>
  );
}
