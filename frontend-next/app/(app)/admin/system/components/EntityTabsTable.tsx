"use client";

/**
 * EntityTabsTable - Configuration UI for Entity Tabs
 *
 * Shows all entity tabs in a table format with:
 * - Inline SharePoint paths (not hidden in dialog)
 * - Expandable rows for sub-tabs
 * - Drag-to-reorder for tabs and sub-tabs
 * - Group filter pills (Overview, Documents, Special)
 * - Add/edit inline
 *
 * Uses: SortableList, SortableItem, DragHandle from @/components/ui/dnd
 * SSoT: CorporateEntityTab model via /api/v1/corporate/entity_tabs
 */

import * as React from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/use-toast";
import {
  SortableList,
  SortableItem,
  DragHandle,
} from "@/components/ui/dnd";
import {
  ChevronDown,
  ChevronRight,
  Eye,
  EyeOff,
  Folder,
  FolderPlus,
  Loader2,
  Plus,
  Trash2,
  X,
  Check,
  GripVertical,
  Building2,
  Scale,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";

// =============================================================================
// TYPES
// =============================================================================

interface SubTab {
  key: string;
  name: string;
  folder: string;
}

interface EntityTab {
  id: string;
  tab_key: string;
  name: string;
  group: "overview" | "documents" | "special";
  entity_types: string[];
  enabled: boolean;
  order_position: number;
  icon_name?: string;
  description?: string;
  has_sharepoint_folder?: boolean;
  sharepoint_folder_path?: string;
  sub_tabs?: SubTab[];
  document_types?: Array<{ id: number; name: string; display_name: string; is_primary: boolean }>;
}

type GroupFilter = "all" | "overview" | "documents" | "special";

// Entity type display config
const ENTITY_TYPE_CONFIG = {
  Company: { abbrev: "C", color: "blue", icon: Building2 },
  Trust: { abbrev: "T", color: "purple", icon: Scale },
  Superfund: { abbrev: "S", color: "green", icon: Users },
} as const;

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function EntityTabsTable() {
  const { toast } = useToast();

  // State
  const [tabs, setTabs] = React.useState<EntityTab[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [expandedTabIds, setExpandedTabIds] = React.useState<Set<string>>(new Set());
  const [groupFilter, setGroupFilter] = React.useState<GroupFilter>("all");
  const [togglingTabId, setTogglingTabId] = React.useState<string | null>(null);

  // Inline editing state
  const [editingPath, setEditingPath] = React.useState<{ tabId: string; value: string } | null>(null);
  const [addingSubTab, setAddingSubTab] = React.useState<{ tabId: string; name: string; folder: string } | null>(null);

  // Load tabs from API
  const loadTabs = React.useCallback(async () => {
    try {
      const response = await api.get<{ success: boolean; data: EntityTab[] }>("/api/v1/corporate/entity_tabs");
      if (response.success && response.data) {
        setTabs(response.data);
      }
    } catch (error) {
      console.error("Failed to load entity tabs:", error);
      toast({ title: "Error", description: "Failed to load entity tabs", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  React.useEffect(() => {
    loadTabs();
  }, [loadTabs]);

  // Filter tabs by group
  const filteredTabs = React.useMemo(() => {
    const sorted = [...tabs].sort((a, b) => a.order_position - b.order_position);
    if (groupFilter === "all") return sorted;
    return sorted.filter((tab) => tab.group === groupFilter);
  }, [tabs, groupFilter]);

  // Group counts
  const groupCounts = React.useMemo(() => ({
    overview: tabs.filter((t) => t.group === "overview").length,
    documents: tabs.filter((t) => t.group === "documents").length,
    special: tabs.filter((t) => t.group === "special").length,
  }), [tabs]);

  // Toggle tab expansion
  const toggleExpanded = (tabId: string) => {
    setExpandedTabIds((prev) => {
      const next = new Set(prev);
      if (next.has(tabId)) {
        next.delete(tabId);
      } else {
        next.add(tabId);
      }
      return next;
    });
  };

  // Toggle tab enabled
  const handleToggleEnabled = async (tab: EntityTab) => {
    setTogglingTabId(tab.id);
    try {
      await api.patch(`/api/v1/corporate/entity_tabs/${tab.tab_key}`, {
        tab: { enabled: !tab.enabled }
      });
      await loadTabs();
      toast({
        title: tab.enabled ? "Tab disabled" : "Tab enabled",
        description: `"${tab.name}" has been ${tab.enabled ? "disabled" : "enabled"}`,
      });
    } catch (error) {
      console.error("Failed to toggle tab:", error);
      toast({ title: "Error", description: "Failed to toggle tab", variant: "destructive" });
    } finally {
      setTogglingTabId(null);
    }
  };

  // Update SharePoint path
  const handleSavePath = async (tabId: string, tabKey: string) => {
    if (!editingPath) return;
    setSaving(true);
    try {
      await api.patch(`/api/v1/corporate/entity_tabs/${tabKey}`, {
        tab: {
          has_sharepoint_folder: !!editingPath.value,
          sharepoint_folder_path: editingPath.value || null,
        }
      });
      await loadTabs();
      setEditingPath(null);
      toast({ title: "Path updated", description: "SharePoint path has been saved" });
    } catch (error) {
      console.error("Failed to update path:", error);
      toast({ title: "Error", description: "Failed to update path", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  // Handle reorder
  const handleReorder = async (newTabs: EntityTab[]) => {
    // Optimistically update UI
    setTabs((prev) => {
      const tabMap = new Map(prev.map((t) => [t.id, t]));
      newTabs.forEach((t, i) => {
        const tab = tabMap.get(t.id);
        if (tab) tab.order_position = i;
      });
      return [...tabMap.values()].sort((a, b) => a.order_position - b.order_position);
    });

    // Save to backend
    try {
      await api.post("/api/v1/corporate/entity_tabs/reorder", {
        tabs: newTabs.map((t, i) => ({ id: t.tab_key, position: i }))
      });
    } catch (error) {
      console.error("Failed to reorder tabs:", error);
      toast({ title: "Error", description: "Failed to save order", variant: "destructive" });
      await loadTabs(); // Reload to restore correct order
    }
  };

  // Add sub-tab
  const handleAddSubTab = async (tab: EntityTab) => {
    if (!addingSubTab || !addingSubTab.name.trim()) return;
    setSaving(true);
    try {
      const newSubTabs = [
        ...(tab.sub_tabs || []),
        {
          key: addingSubTab.name.toLowerCase().replace(/\s+/g, "-"),
          name: addingSubTab.name,
          folder: addingSubTab.folder || addingSubTab.name,
        }
      ];
      await api.patch(`/api/v1/corporate/entity_tabs/${tab.tab_key}`, {
        tab: { sub_tabs: newSubTabs }
      });
      await loadTabs();
      setAddingSubTab(null);
      toast({ title: "Sub-tab added", description: `Added "${addingSubTab.name}" to ${tab.name}` });
    } catch (error) {
      console.error("Failed to add sub-tab:", error);
      toast({ title: "Error", description: "Failed to add sub-tab", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  // Delete sub-tab
  const handleDeleteSubTab = async (tab: EntityTab, subTabKey: string) => {
    if (!confirm(`Delete sub-tab "${subTabKey}"?`)) return;
    setSaving(true);
    try {
      const newSubTabs = (tab.sub_tabs || []).filter((st) => st.key !== subTabKey);
      await api.patch(`/api/v1/corporate/entity_tabs/${tab.tab_key}`, {
        tab: { sub_tabs: newSubTabs }
      });
      await loadTabs();
      toast({ title: "Sub-tab deleted" });
    } catch (error) {
      console.error("Failed to delete sub-tab:", error);
      toast({ title: "Error", description: "Failed to delete sub-tab", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  // =============================================================================
  // RENDER
  // =============================================================================

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">Entity Tabs</h3>
          <p className="text-sm text-muted-foreground">
            Configure tabs for company, trust, and superfund pages. Click row to expand sub-tabs.
          </p>
        </div>
        <Badge variant="outline" className="text-xs">
          SSoT: Database
        </Badge>
      </div>

      {/* Group Filter Pills */}
      <div className="flex gap-2">
        <button
          onClick={() => setGroupFilter("all")}
          className={cn(
            "px-3 py-1.5 text-sm rounded-full transition-colors",
            groupFilter === "all"
              ? "bg-primary text-primary-foreground"
              : "bg-muted hover:bg-muted/80"
          )}
        >
          All ({tabs.length})
        </button>
        <button
          onClick={() => setGroupFilter("overview")}
          className={cn(
            "px-3 py-1.5 text-sm rounded-full transition-colors",
            groupFilter === "overview"
              ? "bg-green-600 text-white"
              : "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 hover:bg-green-200 dark:hover:bg-green-900/50"
          )}
        >
          Overview ({groupCounts.overview})
        </button>
        <button
          onClick={() => setGroupFilter("documents")}
          className={cn(
            "px-3 py-1.5 text-sm rounded-full transition-colors",
            groupFilter === "documents"
              ? "bg-blue-600 text-white"
              : "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 hover:bg-blue-200 dark:hover:bg-blue-900/50"
          )}
        >
          Documents ({groupCounts.documents})
        </button>
        <button
          onClick={() => setGroupFilter("special")}
          className={cn(
            "px-3 py-1.5 text-sm rounded-full transition-colors",
            groupFilter === "special"
              ? "bg-purple-600 text-white"
              : "bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-200 hover:bg-purple-200 dark:hover:bg-purple-900/50"
          )}
        >
          Special ({groupCounts.special})
        </button>
      </div>

      {/* Table Header */}
      <div className="grid grid-cols-12 gap-2 px-3 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wide border-b">
        <div className="col-span-1">#</div>
        <div className="col-span-3">Tab Name</div>
        <div className="col-span-2">Entities</div>
        <div className="col-span-4">SharePoint Path</div>
        <div className="col-span-1 text-center">Sub</div>
        <div className="col-span-1 text-center">On</div>
      </div>

      {/* Tabs List */}
      <SortableList
        items={filteredTabs}
        onReorder={handleReorder}
        className="space-y-0"
      >
        {filteredTabs.map((tab, index) => (
          <React.Fragment key={tab.id}>
            {/* Main Tab Row */}
            <SortableItem
              id={tab.id}
              variant="row"
              showBadge={false}
              className={cn(
                "grid grid-cols-12 gap-2 items-center",
                tab.enabled ? "" : "opacity-50",
                getGroupBgColor(tab.group)
              )}
            >
              {/* Position */}
              <div className="col-span-1 text-sm text-muted-foreground">
                {index + 1}
              </div>

              {/* Tab Name (clickable to expand) */}
              <button
                onClick={() => toggleExpanded(tab.id)}
                className="col-span-3 flex items-center gap-2 text-left hover:text-primary transition-colors"
              >
                {expandedTabIds.has(tab.id) ? (
                  <ChevronDown className="h-4 w-4 shrink-0" />
                ) : (
                  <ChevronRight className="h-4 w-4 shrink-0" />
                )}
                <Folder className={cn("h-4 w-4 shrink-0", getGroupIconColor(tab.group))} />
                <span className="font-medium truncate">{tab.name}</span>
              </button>

              {/* Entity Types */}
              <div className="col-span-2 flex gap-1">
                {tab.entity_types.map((type) => {
                  const config = ENTITY_TYPE_CONFIG[type as keyof typeof ENTITY_TYPE_CONFIG];
                  return config ? (
                    <Badge
                      key={type}
                      variant="outline"
                      className={cn("text-[10px] px-1.5", getEntityBadgeColor(type))}
                    >
                      {config.abbrev}
                    </Badge>
                  ) : null;
                })}
              </div>

              {/* SharePoint Path (inline editable) */}
              <div className="col-span-4">
                {editingPath?.tabId === tab.id ? (
                  <div className="flex items-center gap-1">
                    <Input
                      value={editingPath.value}
                      onChange={(e) => setEditingPath({ ...editingPath, value: e.target.value })}
                      className="h-7 text-xs font-mono"
                      placeholder="/Shared Documents/..."
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleSavePath(tab.id, tab.tab_key);
                        if (e.key === "Escape") setEditingPath(null);
                      }}
                    />
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      onClick={() => handleSavePath(tab.id, tab.tab_key)}
                      disabled={saving}
                    >
                      {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      onClick={() => setEditingPath(null)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ) : (
                  <button
                    onClick={() => setEditingPath({ tabId: tab.id, value: tab.sharepoint_folder_path || "" })}
                    className="text-xs font-mono text-muted-foreground hover:text-foreground transition-colors text-left truncate w-full"
                    title={tab.sharepoint_folder_path ? `/Shared Documents/${tab.sharepoint_folder_path}` : "Click to set path"}
                  >
                    {tab.has_sharepoint_folder && tab.sharepoint_folder_path ? (
                      <span>/{tab.sharepoint_folder_path}</span>
                    ) : (
                      <span className="italic">No path</span>
                    )}
                  </button>
                )}
              </div>

              {/* Sub-tab count */}
              <div className="col-span-1 text-center">
                {tab.sub_tabs && tab.sub_tabs.length > 0 ? (
                  <Badge variant="secondary" className="text-[10px]">
                    {tab.sub_tabs.length}
                  </Badge>
                ) : (
                  <span className="text-xs text-muted-foreground">-</span>
                )}
              </div>

              {/* Enabled toggle */}
              <div className="col-span-1 flex justify-center">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleToggleEnabled(tab);
                  }}
                  disabled={togglingTabId === tab.id}
                  className="p-1 rounded hover:bg-muted transition-colors"
                >
                  {togglingTabId === tab.id ? (
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  ) : tab.enabled ? (
                    <Eye className="h-4 w-4 text-green-600" />
                  ) : (
                    <EyeOff className="h-4 w-4 text-muted-foreground" />
                  )}
                </button>
              </div>
            </SortableItem>

            {/* Expanded Sub-Tabs Section */}
            {expandedTabIds.has(tab.id) && (
              <div className="ml-8 border-l-2 border-muted pl-4 py-2 bg-muted/20">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Sub-Tabs ({tab.sub_tabs?.length || 0})
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 text-xs"
                    onClick={() => setAddingSubTab({ tabId: tab.id, name: "", folder: "" })}
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Add
                  </Button>
                </div>

                {/* Sub-tabs list */}
                {tab.sub_tabs && tab.sub_tabs.length > 0 ? (
                  <div className="space-y-1">
                    {tab.sub_tabs.map((subTab) => (
                      <div
                        key={subTab.key}
                        className="flex items-center justify-between py-1.5 px-2 rounded bg-background border text-sm"
                      >
                        <div className="flex items-center gap-2">
                          <GripVertical className="h-3 w-3 text-muted-foreground/50" />
                          <span>{subTab.name}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono text-muted-foreground">
                            /{subTab.folder}
                          </span>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6 text-muted-foreground hover:text-destructive"
                            onClick={() => handleDeleteSubTab(tab, subTab.key)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground italic py-2">
                    No sub-tabs configured
                  </p>
                )}

                {/* Add sub-tab form */}
                {addingSubTab?.tabId === tab.id && (
                  <div className="mt-2 flex items-center gap-2 p-2 rounded border bg-background">
                    <Input
                      value={addingSubTab.name}
                      onChange={(e) => setAddingSubTab({ ...addingSubTab, name: e.target.value })}
                      placeholder="Sub-tab name"
                      className="h-7 text-sm flex-1"
                      autoFocus
                    />
                    <Input
                      value={addingSubTab.folder}
                      onChange={(e) => setAddingSubTab({ ...addingSubTab, folder: e.target.value })}
                      placeholder="Folder path"
                      className="h-7 text-sm flex-1 font-mono"
                    />
                    <Button
                      size="sm"
                      className="h-7"
                      onClick={() => handleAddSubTab(tab)}
                      disabled={saving || !addingSubTab.name.trim()}
                    >
                      {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : "Add"}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7"
                      onClick={() => setAddingSubTab(null)}
                    >
                      Cancel
                    </Button>
                  </div>
                )}

                {/* Document types (if any) */}
                {tab.document_types && tab.document_types.length > 0 && (
                  <div className="mt-3 pt-3 border-t">
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Document Types ({tab.document_types.length})
                    </span>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {tab.document_types.slice(0, 5).map((dt) => (
                        <Badge key={dt.id} variant="outline" className="text-[10px]">
                          {dt.name}
                          {dt.is_primary && <span className="ml-1 text-primary">*</span>}
                        </Badge>
                      ))}
                      {tab.document_types.length > 5 && (
                        <Badge variant="outline" className="text-[10px]">
                          +{tab.document_types.length - 5} more
                        </Badge>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </React.Fragment>
        ))}
      </SortableList>

      {/* Empty state */}
      {filteredTabs.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          No tabs found for this filter.
        </div>
      )}
    </div>
  );
}

// =============================================================================
// HELPERS
// =============================================================================

function getGroupBgColor(group: string): string {
  switch (group) {
    case "overview":
      return "hover:bg-green-50 dark:hover:bg-green-900/10";
    case "documents":
      return "hover:bg-blue-50 dark:hover:bg-blue-900/10";
    case "special":
      return "hover:bg-purple-50 dark:hover:bg-purple-900/10";
    default:
      return "";
  }
}

function getGroupIconColor(group: string): string {
  switch (group) {
    case "overview":
      return "text-green-600 dark:text-green-400";
    case "documents":
      return "text-blue-600 dark:text-blue-400";
    case "special":
      return "text-purple-600 dark:text-purple-400";
    default:
      return "text-muted-foreground";
  }
}

function getEntityBadgeColor(entityType: string): string {
  switch (entityType) {
    case "Company":
      return "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 border-blue-200 dark:border-blue-800";
    case "Trust":
      return "bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-200 border-purple-200 dark:border-purple-800";
    case "Superfund":
      return "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 border-green-200 dark:border-green-800";
    default:
      return "";
  }
}
