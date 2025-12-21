"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import MultipleSelector, { Option } from "@/components/ui/multiple-selector";
import { getIcon } from "@/lib/icon-map";
import {
  SortableList,
  SortableItem,
  reorderByPosition,
  DragHandle,
  ItemBadge,
} from "@/components/ui/dnd";
import {
  Loader2,
  ChevronDown,
  ChevronRight,
  Eye,
  EyeOff,
  Plus,
  Trash2,
  Lock,
  FolderOpen,
  FileText,
  Settings2,
  CornerDownRight,
  AlertCircle,
  Pencil,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useEntityTabs } from "@/lib/hooks/useEntityTabs";
import type {
  EntityTab,
  EntityTabScope,
  TabGroup,
  EntityTabCreateParams,
  EntityTabUpdateParams,
  ReorderTabParams,
} from "@/lib/types/entity-tabs";
import { SCOPE_LABELS, GROUP_LABELS, CORPORATE_ENTITY_TYPES } from "@/lib/types/entity-tabs";

// Entity type options for MultipleSelector
const ENTITY_TYPE_OPTIONS: Option[] = CORPORATE_ENTITY_TYPES.map((type) => ({
  value: type,
  label: type,
}));

interface EntityTabsConfigProps {
  scope: EntityTabScope;
  showEntityFilters?: boolean;      // Show entity type checkboxes (for corporate_entity)
  showSharePointPaths?: boolean;    // Show SharePoint path config
  showDocumentTypes?: boolean;      // Show linked document types
  showTabGroups?: boolean;          // Show grouped by tab_group
  title?: string;                   // Override default title
  description?: string;             // Override default description
}

export function EntityTabsConfig({
  scope,
  showEntityFilters = false,
  showSharePointPaths = false,
  showDocumentTypes = false,
  showTabGroups = true,
  title,
  description,
}: EntityTabsConfigProps) {
  const {
    tabs,
    groups,
    loading,
    error,
    createTab,
    updateTab,
    deleteTab,
    reorderTabs,
    toggleEnabled,
    refetch,
  } = useEntityTabs({ scope });

  const [saving, setSaving] = React.useState(false);
  const [expandedItems, setExpandedItems] = React.useState<Set<number>>(new Set());
  const [editingTab, setEditingTab] = React.useState<EntityTab | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = React.useState(false);
  const [deleteConfirmTab, setDeleteConfirmTab] = React.useState<EntityTab | null>(null);
  const [activeGroup, setActiveGroup] = React.useState<string>("overview");

  // Form state for create/edit
  const [formData, setFormData] = React.useState<Partial<EntityTabCreateParams>>({});

  // Get display title
  const displayTitle = title || `${SCOPE_LABELS[scope]} Tabs`;
  const displayDescription =
    description ||
    `Configure tabs for ${SCOPE_LABELS[scope].toLowerCase()}. Drag to reorder, toggle visibility, or add custom tabs.`;

  // Group tabs by tab_group
  const groupedTabs = React.useMemo(() => {
    const grouped: Record<string, EntityTab[]> = {};
    const allGroups = [...groups];

    // Initialize all groups
    allGroups.forEach((group) => {
      grouped[group] = [];
    });

    // Only include root tabs (no parent_id)
    tabs
      .filter((tab) => !tab.parent_id)
      .forEach((tab) => {
        const group = tab.tab_group || "special";
        if (!grouped[group]) grouped[group] = [];
        grouped[group].push(tab);
      });

    // Sort by order_position within each group
    Object.keys(grouped).forEach((group) => {
      grouped[group].sort((a, b) => a.order_position - b.order_position);
    });

    return grouped;
  }, [tabs, groups]);

  // Flat list for non-grouped view
  const flatTabs = React.useMemo(() => {
    return tabs
      .filter((tab) => !tab.parent_id)
      .sort((a, b) => a.order_position - b.order_position);
  }, [tabs]);

  // Toggle item expansion
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
  const handleReorder = async (newItems: EntityTab[], group?: TabGroup) => {
    setSaving(true);
    try {
      const reorderData: ReorderTabParams[] = newItems.map((item, index) => ({
        id: item.id,
        parent_id: item.parent_id,
      }));

      // Update order_position based on new order
      await reorderTabs(reorderData);
    } catch (err) {
      console.error("Failed to reorder tabs:", err);
    } finally {
      setSaving(false);
    }
  };

  // Handle visibility toggle
  const handleToggleEnabled = async (tab: EntityTab) => {
    setSaving(true);
    try {
      await toggleEnabled(tab.id);
    } catch (err) {
      console.error("Failed to toggle visibility:", err);
    } finally {
      setSaving(false);
    }
  };

  // Handle delete
  const handleDelete = async (tab: EntityTab) => {
    if (!tab.can_delete) {
      return;
    }
    setSaving(true);
    try {
      await deleteTab(tab.id);
      setDeleteConfirmTab(null);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Failed to delete tab";
      alert(errorMessage);
    } finally {
      setSaving(false);
    }
  };

  // Open create dialog
  const openCreateDialog = (group?: TabGroup) => {
    setFormData({
      tab_key: "",
      display_name: "",
      description: "",
      tab_group: group || "special",
      entity_filters: [],
      enabled: true,
      has_sharepoint_folder: false,
      sharepoint_folder_path: "",
    });
    setEditingTab(null);
    setIsCreateDialogOpen(true);
  };

  // Open edit dialog
  const openEditDialog = (tab: EntityTab) => {
    setFormData({
      display_name: tab.display_name,
      description: tab.description || "",
      tab_group: tab.tab_group || undefined,
      entity_filters: tab.entity_filters,
      enabled: tab.enabled,
      icon_name: tab.icon_name || "",
      has_sharepoint_folder: tab.has_sharepoint_folder,
      sharepoint_folder_path: tab.sharepoint_folder_path || "",
    });
    setEditingTab(tab);
    setIsCreateDialogOpen(true);
  };

  // Handle form submit
  const handleFormSubmit = async () => {
    setSaving(true);
    try {
      if (editingTab) {
        // Update existing
        const updateParams: EntityTabUpdateParams = {
          display_name: formData.display_name,
          description: formData.description,
          tab_group: formData.tab_group,
          entity_filters: formData.entity_filters,
          enabled: formData.enabled,
          icon_name: formData.icon_name,
          has_sharepoint_folder: formData.has_sharepoint_folder,
          sharepoint_folder_path: formData.sharepoint_folder_path,
        };
        await updateTab(editingTab.id, updateParams);
      } else {
        // Create new
        const createParams: EntityTabCreateParams = {
          scope,
          tab_key: formData.tab_key || formData.display_name?.toLowerCase().replace(/\s+/g, "-") || "",
          display_name: formData.display_name || "",
          description: formData.description,
          tab_group: formData.tab_group,
          entity_filters: formData.entity_filters,
          enabled: formData.enabled ?? true,
          icon_name: formData.icon_name,
          has_sharepoint_folder: formData.has_sharepoint_folder,
          sharepoint_folder_path: formData.sharepoint_folder_path,
        };
        await createTab(createParams);
      }
      setIsCreateDialogOpen(false);
      setEditingTab(null);
    } catch (err) {
      console.error("Failed to save tab:", err);
    } finally {
      setSaving(false);
    }
  };

  // Render a single tab item
  const renderTabItem = (tab: EntityTab, index: number, isChild = false) => {
    const IconComponent = getIcon(tab.icon_name || "file");
    const hasChildren = tab.children && tab.children.length > 0;
    const isExpanded = expandedItems.has(tab.id);

    return (
      <SortableItem
        key={tab.id}
        id={tab.id}
        position={index + 1}
        editablePosition={false}
        className={cn(
          "border rounded-lg bg-background",
          !tab.enabled && "opacity-50",
          isChild && "ml-8"
        )}
      >
        <div className="flex items-center gap-3 flex-1 py-2 px-3">
          {/* Drag handle */}
          <DragHandle />

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

          {/* Name and badges */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium">{tab.display_name}</span>
              <Badge variant="outline" className="text-xs">
                {tab.tab_key}
              </Badge>
              {tab.is_system_tab && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Badge variant="secondary" className="text-xs gap-1">
                        <Lock className="h-3 w-3" />
                        System
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>System tabs cannot be deleted, only disabled</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
              {tab.has_sharepoint_folder && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Badge variant="outline" className="text-xs gap-1">
                        <FolderOpen className="h-3 w-3" />
                        SharePoint
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{tab.sharepoint_folder_path || "Has SharePoint folder"}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
              {hasChildren && (
                <Badge variant="secondary" className="text-xs">
                  {tab.children?.length} sub-tabs
                </Badge>
              )}
              {tab.document_count > 0 && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Badge variant="default" className="text-xs gap-1">
                        <FileText className="h-3 w-3" />
                        {tab.document_count} docs
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Contains {tab.document_count} documents</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
            {/* Entity filters (for corporate_entity) */}
            {showEntityFilters && tab.entity_filters && tab.entity_filters.length > 0 && (
              <div className="flex gap-1 mt-1">
                {tab.entity_filters.map((type) => (
                  <Badge key={type} variant="outline" className="text-xs bg-muted">
                    {type}
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1">
            {/* Edit button */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => openEditDialog(tab)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Edit tab</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            {/* Visibility toggle */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => handleToggleEnabled(tab)}
                    disabled={saving}
                  >
                    {tab.enabled ? (
                      <Eye className="h-4 w-4" />
                    ) : (
                      <EyeOff className="h-4 w-4 text-muted-foreground" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{tab.enabled ? "Disable tab" : "Enable tab"}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            {/* Delete button (only for non-system tabs with no documents) */}
            {!tab.is_system_tab && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className={cn(
                        "h-8 w-8",
                        !tab.can_delete && "cursor-not-allowed opacity-50"
                      )}
                      onClick={() => tab.can_delete && setDeleteConfirmTab(tab)}
                      disabled={!tab.can_delete || saving}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {tab.can_delete ? (
                      <p>Delete tab</p>
                    ) : (
                      <p>Cannot delete: contains {tab.document_count} documents</p>
                    )}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
        </div>
      </SortableItem>
    );
  };

  // Render a group of tabs
  const renderTabGroup = (group: TabGroup, tabsInGroup: EntityTab[]) => {
    return (
      <Card key={group}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CardTitle className="text-base">{GROUP_LABELS[group]}</CardTitle>
              <Badge variant="secondary" className="text-xs">
                {tabsInGroup.length}
              </Badge>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => openCreateDialog(group)}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Tab
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {tabsInGroup.length > 0 ? (
            <SortableList items={tabsInGroup} onReorder={(items) => handleReorder(items, group)}>
              <div className="space-y-2">
                {tabsInGroup.map((tab, index) => (
                  <React.Fragment key={tab.id}>
                    {renderTabItem(tab, index)}
                    {/* Render children if expanded */}
                    {expandedItems.has(tab.id) && tab.children && tab.children.length > 0 && (
                      <div className="space-y-2 mt-2">
                        {tab.children.map((child, childIndex) =>
                          renderTabItem(child, childIndex, true)
                        )}
                      </div>
                    )}
                  </React.Fragment>
                ))}
              </div>
            </SortableList>
          ) : (
            <div className="text-center py-6 text-muted-foreground">
              No tabs in this group
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <AlertCircle className="h-12 w-12 mx-auto text-destructive mb-4" />
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
          <h3 className="text-lg font-medium">{displayTitle}</h3>
          <p className="text-sm text-muted-foreground">{displayDescription}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => openCreateDialog()}>
            <Plus className="h-4 w-4 mr-2" />
            Add Custom Tab
          </Button>
        </div>
      </div>

      {/* Tabs by group */}
      {showTabGroups ? (
        <Tabs value={activeGroup} onValueChange={setActiveGroup}>
          <TabsList>
            {groups.map((group) => (
              <TabsTrigger key={group} value={group} className="gap-2">
                {GROUP_LABELS[group]}
                <Badge variant="secondary" className="text-xs">
                  {groupedTabs[group]?.length || 0}
                </Badge>
              </TabsTrigger>
            ))}
          </TabsList>
          {groups.map((group) => (
            <TabsContent key={group} value={group}>
              {renderTabGroup(group, groupedTabs[group] || [])}
            </TabsContent>
          ))}
        </Tabs>
      ) : (
        /* Flat list without groups */
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>All Tabs</CardTitle>
              <Badge variant="secondary">{flatTabs.length}</Badge>
            </div>
          </CardHeader>
          <CardContent>
            {flatTabs.length > 0 ? (
              <SortableList items={flatTabs} onReorder={handleReorder}>
                <div className="space-y-2">
                  {flatTabs.map((tab, index) => (
                    <React.Fragment key={tab.id}>
                      {renderTabItem(tab, index)}
                      {expandedItems.has(tab.id) && tab.children && tab.children.length > 0 && (
                        <div className="space-y-2 mt-2">
                          {tab.children.map((child, childIndex) =>
                            renderTabItem(child, childIndex, true)
                          )}
                        </div>
                      )}
                    </React.Fragment>
                  ))}
                </div>
              </SortableList>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                No tabs configured
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingTab ? "Edit Tab" : "Create New Tab"}
            </DialogTitle>
            <DialogDescription>
              {editingTab
                ? `Update settings for "${editingTab.display_name}"`
                : "Add a new custom tab to this scope"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Display Name */}
            <div className="space-y-2">
              <Label htmlFor="display_name">Display Name</Label>
              <Input
                id="display_name"
                value={formData.display_name || ""}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, display_name: e.target.value }))
                }
                placeholder="e.g., Tax Returns"
              />
            </div>

            {/* Tab Key (only for new tabs) */}
            {!editingTab && (
              <div className="space-y-2">
                <Label htmlFor="tab_key">Tab Key (URL slug)</Label>
                <Input
                  id="tab_key"
                  value={formData.tab_key || ""}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, tab_key: e.target.value }))
                  }
                  placeholder="e.g., tax-returns (auto-generated if empty)"
                />
              </div>
            )}

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                value={formData.description || ""}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, description: e.target.value }))
                }
                placeholder="Brief description of this tab"
              />
            </div>

            {/* Entity Filters (for corporate_entity) */}
            {showEntityFilters && (
              <div className="space-y-2">
                <Label>Show for Entity Types</Label>
                <MultipleSelector
                  value={
                    formData.entity_filters?.map((type) => ({
                      value: type,
                      label: type,
                    })) || []
                  }
                  onChange={(options: Option[]) =>
                    setFormData((prev) => ({
                      ...prev,
                      entity_filters: options.map((o: Option) => o.value),
                    }))
                  }
                  defaultOptions={ENTITY_TYPE_OPTIONS}
                  placeholder="Select entity types..."
                  emptyIndicator={
                    <p className="text-center text-sm text-muted-foreground">
                      No options available
                    </p>
                  }
                />
              </div>
            )}

            {/* SharePoint Folder */}
            {showSharePointPaths && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="has_sharepoint"
                    checked={formData.has_sharepoint_folder || false}
                    onCheckedChange={(checked) =>
                      setFormData((prev) => ({
                        ...prev,
                        has_sharepoint_folder: checked === true,
                      }))
                    }
                  />
                  <Label htmlFor="has_sharepoint">Has SharePoint Folder</Label>
                </div>
                {formData.has_sharepoint_folder && (
                  <div className="space-y-2 pl-6">
                    <Label htmlFor="sharepoint_path">SharePoint Path</Label>
                    <Input
                      id="sharepoint_path"
                      value={formData.sharepoint_folder_path || ""}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          sharepoint_folder_path: e.target.value,
                        }))
                      }
                      placeholder="e.g., /Documents/ATO"
                    />
                  </div>
                )}
              </div>
            )}

            {/* Enabled */}
            <div className="flex items-center gap-2">
              <Switch
                id="enabled"
                checked={formData.enabled ?? true}
                onCheckedChange={(checked) =>
                  setFormData((prev) => ({ ...prev, enabled: checked }))
                }
              />
              <Label htmlFor="enabled">Enabled</Label>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsCreateDialogOpen(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button onClick={handleFormSubmit} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingTab ? "Save Changes" : "Create Tab"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteConfirmTab} onOpenChange={() => setDeleteConfirmTab(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Tab</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{deleteConfirmTab?.display_name}&quot;?
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteConfirmTab(null)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteConfirmTab && handleDelete(deleteConfirmTab)}
              disabled={saving}
            >
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Saving indicator */}
      {saving && (
        <div className="fixed bottom-4 right-4 bg-background border rounded-lg shadow-lg px-4 py-2 flex items-center gap-2 z-50">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm">Saving...</span>
        </div>
      )}
    </div>
  );
}
