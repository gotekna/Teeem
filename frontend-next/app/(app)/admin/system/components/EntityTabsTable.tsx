"use client";

/**
 * EntityTabsTable - Tree view for Entity Tabs & Folders Configuration
 *
 * Shows the complete hierarchy:
 * - Tab Groups (Overview, Documents, Special)
 *   - Tabs with SharePoint folder paths
 *     - Sub-tabs with sub-folder paths
 *
 * Features:
 * - Tree structure with expand/collapse
 * - Add new tabs and sub-tabs
 * - Inline SharePoint path editing
 * - Drag-to-reorder
 * - Enable/disable toggle
 */

import * as React from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { SharePointFolderBrowser } from "@/components/ui/sharepoint-folder-browser";
import {
  ChevronDown,
  ChevronRight,
  Folder,
  FolderOpen,
  FolderPlus,
  FolderTree,
  Loader2,
  Plus,
  Trash2,
  X,
  Check,
  Building2,
  Scale,
  Users,
  LayoutGrid,
  FileText,
  Sparkles,
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

// Entity type display config
const ENTITY_TYPE_CONFIG: Record<string, { abbrev: string; color: string; icon: React.ElementType }> = {
  Company: { abbrev: "C", color: "blue", icon: Building2 },
  Trust: { abbrev: "T", color: "purple", icon: Scale },
  Superfund: { abbrev: "S", color: "green", icon: Users },
  "Corporate Trustee": { abbrev: "CT", color: "orange", icon: Building2 },
};

// Group display config
const GROUP_CONFIG = {
  overview: {
    label: "Overview Tabs",
    icon: LayoutGrid,
    color: "green",
    description: "Info tabs shown on company detail pages (Info, Corporate, Bank Accounts, etc.)"
  },
  documents: {
    label: "Document Folder Tabs",
    icon: FolderOpen,
    color: "blue",
    description: "Document folders linked to SharePoint (BANK, ATO, ADVICE, etc.)"
  },
  special: {
    label: "Special Tabs",
    icon: Sparkles,
    color: "purple",
    description: "Main navigation tabs (Documents browser, Data, Activity)"
  },
};

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function EntityTabsTable() {
  const { toast } = useToast();

  // State
  const [tabs, setTabs] = React.useState<EntityTab[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [expandedGroups, setExpandedGroups] = React.useState<Set<string>>(new Set(["documents"]));
  const [expandedTabs, setExpandedTabs] = React.useState<Set<string>>(new Set());

  // Editing state
  const [editingPath, setEditingPath] = React.useState<{ tabId: string; value: string } | null>(null);
  const [editingEntityTypes, setEditingEntityTypes] = React.useState<string | null>(null);
  const [addingSubTab, setAddingSubTab] = React.useState<{ tabId: string; name: string; folder: string } | null>(null);
  const [addingTab, setAddingTab] = React.useState<{ group: string; name: string; folder: string } | null>(null);

  // Folder browser state
  const [folderBrowserTab, setFolderBrowserTab] = React.useState<EntityTab | null>(null);
  const [selectedFolder, setSelectedFolder] = React.useState<{ id?: string; name: string; path: string } | null>(null);

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

  // Group tabs
  const groupedTabs = React.useMemo(() => {
    const groups: Record<string, EntityTab[]> = {
      overview: [],
      documents: [],
      special: [],
    };
    tabs.forEach((tab) => {
      if (groups[tab.group]) {
        groups[tab.group].push(tab);
      }
    });
    // Sort each group by order_position
    Object.keys(groups).forEach((key) => {
      groups[key].sort((a, b) => a.order_position - b.order_position);
    });
    return groups;
  }, [tabs]);

  // Toggle group expansion
  const toggleGroup = (group: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(group)) {
        next.delete(group);
      } else {
        next.add(group);
      }
      return next;
    });
  };

  // Toggle tab expansion
  const toggleTab = (tabId: string) => {
    setExpandedTabs((prev) => {
      const next = new Set(prev);
      if (next.has(tabId)) {
        next.delete(tabId);
      } else {
        next.add(tabId);
      }
      return next;
    });
  };

  // Save SharePoint path
  const handleSavePath = async (tab: EntityTab) => {
    if (!editingPath) return;
    setSaving(true);
    try {
      await api.patch(`/api/v1/corporate/entity_tabs/${tab.id}`, {
        tab: {
          has_sharepoint_folder: !!editingPath.value,
          sharepoint_folder_path: editingPath.value || null,
        }
      });
      await loadTabs();
      setEditingPath(null);
      toast({ title: "Path updated", description: "SharePoint folder path saved" });
    } catch (error) {
      console.error("Failed to update path:", error);
      toast({ title: "Error", description: "Failed to update path", variant: "destructive" });
    } finally {
      setSaving(false);
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
      await api.patch(`/api/v1/corporate/entity_tabs/${tab.id}`, {
        tab: { sub_tabs: newSubTabs }
      });
      await loadTabs();
      setAddingSubTab(null);
      toast({ title: "Sub-folder added", description: `Added "${addingSubTab.name}" under ${tab.name}` });
    } catch (error) {
      console.error("Failed to add sub-tab:", error);
      toast({ title: "Error", description: "Failed to add sub-folder", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  // Delete sub-tab
  const handleDeleteSubTab = async (tab: EntityTab, subTabKey: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`Delete sub-folder "${subTabKey}"?`)) return;
    setSaving(true);
    try {
      const newSubTabs = (tab.sub_tabs || []).filter((st) => st.key !== subTabKey);
      await api.patch(`/api/v1/corporate/entity_tabs/${tab.id}`, {
        tab: { sub_tabs: newSubTabs }
      });
      await loadTabs();
      toast({ title: "Sub-folder deleted" });
    } catch (error) {
      console.error("Failed to delete sub-tab:", error);
      toast({ title: "Error", description: "Failed to delete sub-folder", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  // Toggle entity type on a tab
  const handleToggleEntityType = async (tab: EntityTab, entityType: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSaving(true);
    try {
      const hasType = tab.entity_types.includes(entityType);
      const newEntityTypes = hasType
        ? tab.entity_types.filter((t) => t !== entityType)
        : [...tab.entity_types, entityType];

      await api.patch(`/api/v1/corporate/entity_tabs/${tab.id}`, {
        tab: { entity_types: newEntityTypes }
      });
      await loadTabs();
      toast({
        title: hasType ? "Entity type removed" : "Entity type added",
        description: `${entityType} ${hasType ? "removed from" : "added to"} "${tab.name}"`,
      });
    } catch (error) {
      console.error("Failed to update entity types:", error);
      toast({ title: "Error", description: "Failed to update entity types", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  // Save folder from browser
  const handleSaveFolderFromBrowser = async () => {
    if (!folderBrowserTab || !selectedFolder) return;
    setSaving(true);
    try {
      // Extract folder name from path (last segment)
      const folderName = selectedFolder.path.split("/").filter(Boolean).pop() || selectedFolder.name;

      await api.patch(`/api/v1/corporate/entity_tabs/${folderBrowserTab.id}`, {
        tab: {
          has_sharepoint_folder: true,
          sharepoint_folder_path: folderName,
        }
      });
      await loadTabs();
      setFolderBrowserTab(null);
      setSelectedFolder(null);
      toast({ title: "Folder linked", description: `"${folderBrowserTab.name}" now linked to /${folderName}` });
    } catch (error) {
      console.error("Failed to save folder:", error);
      toast({ title: "Error", description: "Failed to save folder", variant: "destructive" });
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
          <h3 className="text-lg font-medium">Entity Tabs & Folders</h3>
          <p className="text-sm text-muted-foreground">
            Configure tabs and their SharePoint folder connections for company pages
          </p>
        </div>
        <Badge variant="outline" className="text-xs">
          SSoT: Database
        </Badge>
      </div>

      {/* Tree View */}
      <div className="space-y-3">
        {(["overview", "documents", "special"] as const).map((groupKey) => {
          const group = GROUP_CONFIG[groupKey];
          const groupTabs = groupedTabs[groupKey] || [];
          const isExpanded = expandedGroups.has(groupKey);
          const GroupIcon = group.icon;

          return (
            <Card key={groupKey} className={cn(
              "overflow-hidden",
              groupKey === "overview" && "border-green-200 dark:border-green-800",
              groupKey === "documents" && "border-blue-200 dark:border-blue-800",
              groupKey === "special" && "border-purple-200 dark:border-purple-800",
            )}>
              {/* Group Header */}
              <button
                onClick={() => toggleGroup(groupKey)}
                className={cn(
                  "w-full flex items-center justify-between p-4 text-left transition-colors",
                  groupKey === "overview" && "bg-green-50 dark:bg-green-900/20 hover:bg-green-100 dark:hover:bg-green-900/30",
                  groupKey === "documents" && "bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30",
                  groupKey === "special" && "bg-purple-50 dark:bg-purple-900/20 hover:bg-purple-100 dark:hover:bg-purple-900/30",
                )}
              >
                <div className="flex items-center gap-3">
                  {isExpanded ? (
                    <ChevronDown className="h-5 w-5 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                  )}
                  <GroupIcon className={cn(
                    "h-5 w-5",
                    groupKey === "overview" && "text-green-600 dark:text-green-400",
                    groupKey === "documents" && "text-blue-600 dark:text-blue-400",
                    groupKey === "special" && "text-purple-600 dark:text-purple-400",
                  )} />
                  <div>
                    <span className="font-medium">{group.label}</span>
                    <span className="ml-2 text-sm text-muted-foreground">({groupTabs.length})</span>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground max-w-md text-right hidden md:block">
                  {group.description}
                </p>
              </button>

              {/* Group Content */}
              {isExpanded && (
                <CardContent className="pt-0 pb-4">
                  <div className="border-l-2 border-muted ml-6 pl-4 space-y-1 mt-2">
                    {groupTabs.map((tab) => {
                      const isTabExpanded = expandedTabs.has(tab.id);
                      const hasSubTabs = tab.sub_tabs && tab.sub_tabs.length > 0;
                      const hasFolder = tab.has_sharepoint_folder && tab.sharepoint_folder_path;

                      return (
                        <div key={tab.id}>
                          {/* Tab Row */}
                          <div
                            className="flex items-center gap-2 py-2 px-3 rounded-lg transition-colors cursor-pointer hover:bg-muted/50"
                            onClick={() => toggleTab(tab.id)}
                          >
                            {/* Expand indicator */}
                            {hasSubTabs || groupKey === "documents" ? (
                              isTabExpanded ? (
                                <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                              ) : (
                                <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                              )
                            ) : (
                              <div className="w-4" />
                            )}

                            {/* Folder icon */}
                            {hasFolder ? (
                              <FolderOpen className={cn(
                                "h-4 w-4 shrink-0",
                                groupKey === "overview" && "text-green-600 dark:text-green-400",
                                groupKey === "documents" && "text-blue-600 dark:text-blue-400",
                                groupKey === "special" && "text-purple-600 dark:text-purple-400",
                              )} />
                            ) : (
                              <Folder className="h-4 w-4 text-muted-foreground shrink-0" />
                            )}

                            {/* Tab name */}
                            <span className="font-medium text-sm">{tab.name}</span>

                            {/* Entity type badges - clickable to toggle */}
                            <div className="flex gap-0.5 ml-2" onClick={(e) => e.stopPropagation()}>
                              {(["Company", "Trust", "Superfund", "Corporate Trustee"] as const).map((type) => {
                                const config = ENTITY_TYPE_CONFIG[type];
                                const isActive = tab.entity_types.includes(type);
                                return (
                                  <button
                                    key={type}
                                    onClick={(e) => handleToggleEntityType(tab, type, e)}
                                    disabled={saving}
                                    title={`${isActive ? "Remove" : "Add"} ${type}`}
                                    className={cn(
                                      "text-[9px] px-1.5 py-0.5 rounded border transition-all",
                                      isActive ? (
                                        type === "Company" && "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-700 hover:bg-blue-200 dark:hover:bg-blue-900/50"
                                      ) : (
                                        "bg-muted/30 text-muted-foreground/50 border-transparent hover:border-muted-foreground/30 hover:text-muted-foreground"
                                      ),
                                      isActive && type === "Trust" && "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border-purple-300 dark:border-purple-700 hover:bg-purple-200 dark:hover:bg-purple-900/50",
                                      isActive && type === "Superfund" && "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-green-300 dark:border-green-700 hover:bg-green-200 dark:hover:bg-green-900/50",
                                      isActive && type === "Corporate Trustee" && "bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 border-orange-300 dark:border-orange-700 hover:bg-orange-200 dark:hover:bg-orange-900/50",
                                    )}
                                  >
                                    {config.abbrev}
                                  </button>
                                );
                              })}
                            </div>

                            {/* Spacer */}
                            <div className="flex-1" />

                            {/* SharePoint path */}
                            {editingPath?.tabId === tab.id ? (
                              <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                                <Input
                                  value={editingPath.value}
                                  onChange={(e) => setEditingPath({ ...editingPath, value: e.target.value })}
                                  className="h-6 text-xs font-mono w-40"
                                  placeholder="FOLDER_NAME"
                                  autoFocus
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") handleSavePath(tab);
                                    if (e.key === "Escape") setEditingPath(null);
                                  }}
                                />
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-6 w-6"
                                  onClick={() => handleSavePath(tab)}
                                  disabled={saving}
                                >
                                  {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3 text-green-600" />}
                                </Button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-6 w-6"
                                  onClick={() => setEditingPath(null)}
                                >
                                  <X className="h-3 w-3" />
                                </Button>
                              </div>
                            ) : hasFolder ? (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setFolderBrowserTab(tab);
                                  setSelectedFolder(null);
                                }}
                                className="flex items-center gap-1 text-xs font-mono text-blue-600 dark:text-blue-400 hover:underline"
                              >
                                <FolderTree className="h-3 w-3" />
                                /{tab.sharepoint_folder_path}
                              </button>
                            ) : groupKey === "documents" ? (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setFolderBrowserTab(tab);
                                  setSelectedFolder(null);
                                }}
                                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                              >
                                <FolderPlus className="h-3 w-3" />
                                Link folder
                              </button>
                            ) : null}

                            {/* Sub-tab count */}
                            {hasSubTabs && (
                              <Badge variant="secondary" className="text-[10px] ml-2">
                                {tab.sub_tabs!.length} sub
                              </Badge>
                            )}

                          </div>

                          {/* Expanded: Sub-tabs */}
                          {isTabExpanded && (
                            <div className="ml-10 border-l-2 border-dashed border-muted pl-4 py-2 space-y-1">
                              {/* Existing sub-tabs */}
                              {tab.sub_tabs?.map((subTab) => (
                                <div
                                  key={subTab.key}
                                  className="flex items-center gap-2 py-1.5 px-2 rounded hover:bg-muted/50 text-sm group"
                                >
                                  <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                                  <span>{subTab.name}</span>
                                  <span className="text-xs font-mono text-muted-foreground ml-auto">
                                    /{subTab.folder}
                                  </span>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-5 w-5 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
                                    onClick={(e) => handleDeleteSubTab(tab, subTab.key, e)}
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </div>
                              ))}

                              {/* Add sub-tab form */}
                              {addingSubTab?.tabId === tab.id ? (
                                <div className="flex items-center gap-2 py-1.5 px-2 rounded bg-muted/30">
                                  <FolderPlus className="h-3.5 w-3.5 text-muted-foreground" />
                                  <Input
                                    value={addingSubTab.name}
                                    onChange={(e) => setAddingSubTab({ ...addingSubTab, name: e.target.value })}
                                    placeholder="Sub-folder name"
                                    className="h-6 text-xs flex-1"
                                    autoFocus
                                  />
                                  <Input
                                    value={addingSubTab.folder}
                                    onChange={(e) => setAddingSubTab({ ...addingSubTab, folder: e.target.value })}
                                    placeholder="Folder path"
                                    className="h-6 text-xs w-32 font-mono"
                                  />
                                  <Button
                                    size="sm"
                                    className="h-6 text-xs"
                                    onClick={() => handleAddSubTab(tab)}
                                    disabled={saving || !addingSubTab.name.trim()}
                                  >
                                    {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : "Add"}
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-6 text-xs"
                                    onClick={() => setAddingSubTab(null)}
                                  >
                                    Cancel
                                  </Button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => setAddingSubTab({ tabId: tab.id, name: "", folder: "" })}
                                  className="flex items-center gap-2 py-1.5 px-2 rounded text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 w-full"
                                >
                                  <Plus className="h-3.5 w-3.5" />
                                  Add sub-folder
                                </button>
                              )}

                              {/* Document types (if any) */}
                              {tab.document_types && tab.document_types.length > 0 && (
                                <div className="pt-2 mt-2 border-t border-dashed">
                                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">
                                    Document Types ({tab.document_types.length})
                                  </p>
                                  <div className="flex flex-wrap gap-1">
                                    {tab.document_types.slice(0, 6).map((dt) => (
                                      <Badge key={dt.id} variant="outline" className="text-[9px]">
                                        {dt.name}
                                        {dt.is_primary && "*"}
                                      </Badge>
                                    ))}
                                    {tab.document_types.length > 6 && (
                                      <Badge variant="outline" className="text-[9px]">
                                        +{tab.document_types.length - 6}
                                      </Badge>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {/* Add new tab button */}
                    {groupKey === "documents" && (
                      <div className="pt-2">
                        {addingTab?.group === groupKey ? (
                          <div className="flex items-center gap-2 py-2 px-3 rounded-lg bg-muted/30">
                            <FolderPlus className="h-4 w-4 text-muted-foreground" />
                            <Input
                              value={addingTab.name}
                              onChange={(e) => setAddingTab({ ...addingTab, name: e.target.value })}
                              placeholder="Tab name"
                              className="h-7 text-sm flex-1"
                              autoFocus
                            />
                            <Input
                              value={addingTab.folder}
                              onChange={(e) => setAddingTab({ ...addingTab, folder: e.target.value })}
                              placeholder="Folder path"
                              className="h-7 text-sm w-32 font-mono"
                            />
                            <Button
                              size="sm"
                              className="h-7"
                              disabled={saving || !addingTab.name.trim()}
                            >
                              {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : "Add Tab"}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7"
                              onClick={() => setAddingTab(null)}
                            >
                              Cancel
                            </Button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setAddingTab({ group: groupKey, name: "", folder: "" })}
                            className="flex items-center gap-2 py-2 px-3 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 w-full"
                          >
                            <Plus className="h-4 w-4" />
                            Add new document tab
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>

      {/* Legend */}
      <Card className="bg-muted/30">
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <Badge variant="outline" className="text-[9px] px-1 py-0 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">C</Badge>
              <span>Company</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Badge variant="outline" className="text-[9px] px-1 py-0 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300">T</Badge>
              <span>Trust</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Badge variant="outline" className="text-[9px] px-1 py-0 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300">S</Badge>
              <span>Superfund</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Badge variant="outline" className="text-[9px] px-1 py-0 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300">CT</Badge>
              <span>Corporate Trustee</span>
            </div>
            <div className="flex items-center gap-1.5 ml-4">
              <FolderOpen className="h-3.5 w-3.5 text-blue-600" />
              <span>Has SharePoint folder</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Folder Browser Sheet */}
      <Sheet open={!!folderBrowserTab} onOpenChange={(open) => !open && setFolderBrowserTab(null)}>
        <SheetContent className="sm:max-w-2xl">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <FolderTree className="h-5 w-5" />
              Link SharePoint Folder
            </SheetTitle>
            <SheetDescription>
              Select a SharePoint folder for "{folderBrowserTab?.name}"
            </SheetDescription>
          </SheetHeader>

          <div className="mt-6 space-y-4">
            {/* Current path info */}
            {folderBrowserTab?.sharepoint_folder_path && (
              <div className="text-sm">
                <span className="text-muted-foreground">Current folder: </span>
                <span className="font-mono text-blue-600">/{folderBrowserTab.sharepoint_folder_path}</span>
              </div>
            )}

            {/* Folder browser */}
            <div className="border rounded-lg p-4 bg-muted/20 min-h-[400px]">
              <SharePointFolderBrowser
                onSelect={(folder, path) => {
                  if (folder) {
                    setSelectedFolder({ id: folder.id, name: folder.name, path });
                  } else {
                    setSelectedFolder(null);
                  }
                }}
                selectedFolderId={selectedFolder?.id}
              />
            </div>

            {/* Selected folder preview */}
            {selectedFolder && (
              <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                <FolderOpen className="h-5 w-5 text-green-600" />
                <div className="flex-1">
                  <p className="font-medium text-sm">{selectedFolder.name}</p>
                  <p className="text-xs font-mono text-muted-foreground">{selectedFolder.path}</p>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button variant="outline" onClick={() => setFolderBrowserTab(null)}>
                Cancel
              </Button>
              <Button
                onClick={handleSaveFolderFromBrowser}
                disabled={!selectedFolder || saving}
              >
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4 mr-2" />
                    Link Folder
                  </>
                )}
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
