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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { api } from "@/lib/api";
import { useEntityTabs } from "@/lib/hooks/useEntityTabs";
import { SharePointFolderBrowser } from "@/components/ui/sharepoint-folder-browser";
import type {
  EntityTab,
  EntityTabScope,
  TabGroup,
  EntityTabCreateParams,
  EntityTabUpdateParams,
  ReorderTabParams,
} from "@/lib/types/entity-tabs";
import { SCOPE_LABELS, GROUP_LABELS } from "@/lib/types/entity-tabs";

// Hook to fetch and manage entity types from API
function useEntityTypes() {
  const [entityTypes, setEntityTypes] = React.useState<string[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);

  const fetchEntityTypes = React.useCallback(async () => {
    try {
      const response = await api.get<{ success: boolean; data: string[] }>('/api/v1/entity_tabs/entity_types');
      if (response?.success) {
        setEntityTypes(response.data);
      }
    } catch (err) {
      console.error('Failed to fetch entity types:', err);
      // Fallback to defaults
      setEntityTypes(['Company', 'Trust', 'Superfund', 'Charity', 'Corporate Trustee', 'Sole Trader']);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchEntityTypes();
  }, [fetchEntityTypes]);

  const updateEntityTypes = async (types: string[]) => {
    setSaving(true);
    try {
      const response = await api.put<{ success: boolean; data: string[] }>('/api/v1/entity_tabs/entity_types', {
        entity_types: types,
      });
      if (response?.success) {
        setEntityTypes(response.data);
        return true;
      }
      return false;
    } catch (err) {
      console.error('Failed to update entity types:', err);
      return false;
    } finally {
      setSaving(false);
    }
  };

  return { entityTypes, loading, saving, updateEntityTypes, refetch: fetchEntityTypes };
}

interface EntityTabsConfigProps {
  scope: EntityTabScope;
  showEntityFilters?: boolean;      // Show entity type checkboxes (for corporate_entity)
  showSharePointPaths?: boolean;    // Show SharePoint path config
  showDocumentTypes?: boolean;      // Show linked document types
  showTabGroups?: boolean;          // Show grouped by tab_group
  title?: string;                   // Override default title
  description?: string;             // Override default description
  compact?: boolean;                // Hide title/description for embedded use
}

export function EntityTabsConfig({
  scope,
  showEntityFilters = false,
  showSharePointPaths = false,
  showDocumentTypes = false,
  showTabGroups = true,
  title,
  description,
  compact = false,
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

  // Fetch entity types from API (SSoT)
  const {
    entityTypes,
    loading: entityTypesLoading,
    saving: entityTypesSaving,
    updateEntityTypes,
  } = useEntityTypes();

  const [saving, setSaving] = React.useState(false);
  const [expandedItems, setExpandedItems] = React.useState<Set<number>>(new Set());
  const [editingTab, setEditingTab] = React.useState<EntityTab | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = React.useState(false);
  const [deleteConfirmTab, setDeleteConfirmTab] = React.useState<EntityTab | null>(null);
  const [activeGroup, setActiveGroup] = React.useState<string>("overview");
  const [showEntityTypesEditor, setShowEntityTypesEditor] = React.useState(false);
  const [newEntityType, setNewEntityType] = React.useState("");

  // All document types for linking (SSoT)
  const [allDocumentTypes, setAllDocumentTypes] = React.useState<Array<{ id: number; name: string; display_name?: string }>>([]);

  // Fetch all document types on mount
  React.useEffect(() => {
    const fetchDocumentTypes = async () => {
      try {
        const response = await api.get<{ success: boolean; data: any[] }>('/api/v1/document_types');
        if (response?.success && Array.isArray(response.data)) {
          setAllDocumentTypes(response.data.map((dt: any) => ({
            id: dt.id,
            name: dt.name,
            display_name: dt.display_name,
          })));
        }
      } catch (err) {
        console.error('Failed to fetch document types:', err);
      }
    };
    fetchDocumentTypes();
  }, []);

  // Form state for create/edit
  const [formData, setFormData] = React.useState<Partial<EntityTabCreateParams>>({});

  // Convert entity types to MultipleSelector options
  const entityTypeOptions: Option[] = React.useMemo(() =>
    entityTypes.map((type) => ({ value: type, label: type })),
    [entityTypes]
  );

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

  // Auto-expand all items with children on load (recursive)
  React.useEffect(() => {
    const collectItemsWithChildren = (items: EntityTab[]): number[] => {
      const result: number[] = [];
      for (const item of items) {
        if (item.children && item.children.length > 0) {
          result.push(item.id);
          result.push(...collectItemsWithChildren(item.children));
        }
      }
      return result;
    };
    const itemsWithChildren = collectItemsWithChildren(tabs);
    if (itemsWithChildren.length > 0) {
      setExpandedItems(new Set(itemsWithChildren));
    }
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
      tab_group: group,
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
      parent_id: tab.parent_id || undefined,
      entity_filters: tab.entity_filters,
      enabled: tab.enabled,
      icon_name: tab.icon_name || "",
      has_sharepoint_folder: tab.has_sharepoint_folder,
      sharepoint_folder_path: tab.sharepoint_folder_path || "",
      // SSoT: Include linked document type IDs
      document_type_ids: tab.document_types?.map((dt: any) => dt.id) || [],
    });
    setEditingTab(tab);
    setIsCreateDialogOpen(true);
  };

  // Get available parent tabs (root-level tabs that can be parents)
  const availableParents = React.useMemo(() => {
    return tabs.filter((t) => !t.parent_id && t.id !== editingTab?.id);
  }, [tabs, editingTab]);

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
          parent_id: formData.parent_id,
          entity_filters: formData.entity_filters,
          enabled: formData.enabled,
          icon_name: formData.icon_name,
          has_sharepoint_folder: formData.has_sharepoint_folder,
          sharepoint_folder_path: formData.sharepoint_folder_path,
          // SSoT: Include linked document type IDs
          document_type_ids: formData.document_type_ids,
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

  // Toggle entity filter inline (click badge to toggle)
  // Children inherit from parent - updating parent updates all children
  const toggleEntityFilter = async (tab: EntityTab, entityType: string) => {
    const currentFilters = tab.entity_filters || [];
    const newFilters = currentFilters.includes(entityType)
      ? currentFilters.filter((t) => t !== entityType)
      : [...currentFilters, entityType];

    try {
      // Update this tab
      await updateTab(tab.id, { entity_filters: newFilters });

      // Update all children recursively
      const updateChildren = async (children: EntityTab[]) => {
        for (const child of children) {
          await updateTab(child.id, { entity_filters: newFilters });
          if (child.children && child.children.length > 0) {
            await updateChildren(child.children);
          }
        }
      };

      if (tab.children && tab.children.length > 0) {
        await updateChildren(tab.children);
      }
    } catch (err) {
      console.error("Failed to update entity filters:", err);
    }
  };

  // Helper to find siblings (tabs with same parent)
  const findSiblings = (tab: EntityTab): EntityTab[] => {
    if (!tab.parent_id) {
      // Root level - filter by tab_group
      return tabs.filter(t => !t.parent_id && t.tab_group === tab.tab_group);
    }

    // Find parent and return its children
    const findParent = (items: EntityTab[]): EntityTab | null => {
      for (const item of items) {
        if (item.id === tab.parent_id) return item;
        if (item.children?.length) {
          const found = findParent(item.children);
          if (found) return found;
        }
      }
      return null;
    };

    const parent = findParent(tabs);
    return parent?.children || [];
  };

  // Handle position change via typing a number
  const handlePositionChange = async (tab: EntityTab, newPosition: number, depth: number) => {
    try {
      const siblings = findSiblings(tab);
      if (siblings.length === 0) return;

      const currentIndex = siblings.findIndex(t => t.id === tab.id);
      if (currentIndex === -1) return;

      const targetIndex = Math.max(0, Math.min(newPosition - 1, siblings.length - 1));

      if (currentIndex === targetIndex) return;

      // Reorder siblings
      const reordered = [...siblings];
      const [moved] = reordered.splice(currentIndex, 1);
      reordered.splice(targetIndex, 0, moved);

      // Update positions via API
      const reorderData = reordered.map((t) => ({
        id: t.id,
        parent_id: t.parent_id
      }));

      await reorderTabs(reorderData);
    } catch (err) {
      console.error("Failed to change position:", err);
    }
  };

  // Handle reorder for children
  const handleChildReorder = async (parentTab: EntityTab, newChildren: EntityTab[]) => {
    setSaving(true);
    try {
      const reorderData: ReorderTabParams[] = newChildren.map((item) => ({
        id: item.id,
        parent_id: item.parent_id,
      }));
      await reorderTabs(reorderData);
    } catch (err) {
      console.error("Failed to reorder children:", err);
    } finally {
      setSaving(false);
    }
  };

  // Render tab with all its children recursively
  const renderTabWithChildren = (tab: EntityTab, index: number, depth = 0): React.ReactNode => {
    return (
      <React.Fragment key={tab.id}>
        {renderTabItem(tab, index, depth > 0, depth)}
        {expandedItems.has(tab.id) && tab.children && tab.children.length > 0 && (
          <SortableList
            items={tab.children}
            onReorder={(newChildren) => handleChildReorder(tab, newChildren)}
          >
            <div className="space-y-2 mt-2">
              {tab.children.map((child, childIndex) =>
                renderTabWithChildren(child, childIndex, depth + 1)
              )}
            </div>
          </SortableList>
        )}
      </React.Fragment>
    );
  };

  // Render a single tab item
  const renderTabItem = (tab: EntityTab, index: number, isChild = false, depth = 0) => {
    const IconComponent = getIcon(tab.icon_name || "file");
    const hasChildren = tab.children && tab.children.length > 0;
    const isExpanded = expandedItems.has(tab.id);

    return (
      <SortableItem
        key={tab.id}
        id={tab.id}
        position={index + 1}
        editablePosition={true}
        onPositionChange={(newPosition) => handlePositionChange(tab, newPosition, depth)}
        className={cn(
          "border rounded-lg bg-background",
          !tab.enabled && "opacity-50",
          depth === 1 && "ml-10 border-l-4 border-l-muted-foreground/30",
          depth === 2 && "ml-20 border-l-4 border-l-primary/30",
          depth >= 3 && "ml-28 border-l-4 border-l-primary/50"
        )}
      >
        <div className="flex items-center gap-3 flex-1 py-2 px-3">
          {/* Drag handle */}
          <DragHandle />

          {/* Expand/collapse button for items with children */}
          {hasChildren ? (
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
              <span
                className="font-medium cursor-pointer hover:text-primary hover:underline"
                onClick={() => openEditDialog(tab)}
                title="Click to edit"
              >
                {tab.display_name}
              </span>
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
                <Badge variant="outline" className="text-xs gap-1 text-muted-foreground font-normal max-w-[300px] truncate">
                  <FolderOpen className="h-3 w-3 shrink-0" />
                  <span className="truncate">{tab.hierarchy_path || tab.display_name}</span>
                </Badge>
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
              {tab.document_types && tab.document_types.length > 0 && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Badge variant="outline" className="text-xs gap-1 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800">
                        {tab.document_types.length} type{tab.document_types.length !== 1 ? 's' : ''}
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="max-w-xs">
                      <p className="font-medium mb-1">Linked Document Types:</p>
                      <ul className="text-xs space-y-0.5">
                        {tab.document_types.map((dt) => (
                          <li key={dt.id}>• {dt.display_name || dt.name}</li>
                        ))}
                      </ul>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
            {/* Entity filters (for corporate_entity) - clickable toggles, only on root items */}
            {showEntityFilters && depth === 0 && (
              <div className="flex gap-1 mt-1 flex-wrap">
                {entityTypes.map((type) => {
                  const isSelected = tab.entity_filters?.includes(type);
                  return (
                    <Badge
                      key={type}
                      variant={isSelected ? "default" : "outline"}
                      className={cn(
                        "text-xs cursor-pointer transition-colors",
                        isSelected ? "bg-primary" : "bg-transparent opacity-40 hover:opacity-70"
                      )}
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleEntityFilter(tab, type);
                      }}
                    >
                      {type}
                    </Badge>
                  );
                })}
              </div>
            )}
          </div>

          {/* Description - right aligned */}
          {tab.description && (
            <div className="hidden lg:block text-xs text-muted-foreground text-right shrink-0">
              {tab.description}
            </div>
          )}

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
                {tabsInGroup.map((tab, index) => renderTabWithChildren(tab, index))}
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
    <div className={compact ? "space-y-4" : "space-y-6"}>
      {/* Header */}
      <div className="flex items-center justify-between">
        {!compact && (
          <div>
            <h3 className="text-lg font-medium">{displayTitle}</h3>
            <p className="text-sm text-muted-foreground">{displayDescription}</p>
          </div>
        )}
        <div className={`flex items-center gap-2 ${compact ? "w-full justify-end" : ""}`}>
          {scope === "corporate_entity" && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowEntityTypesEditor(!showEntityTypesEditor)}
              className="text-muted-foreground"
            >
              <Settings2 className="h-4 w-4 mr-2" />
              Entity Types
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => openCreateDialog()}>
            <Plus className="h-4 w-4 mr-2" />
            Add Custom Tab
          </Button>
        </div>
      </div>

      {/* Entity Types Editor (SSoT) - Only for corporate_entity scope */}
      {scope === "corporate_entity" && showEntityTypesEditor && (
        <Card className="border-dashed">
          <CardContent className="py-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <Label className="text-sm font-medium">Entity Types</Label>
                <p className="text-xs text-muted-foreground mb-3">
                  Configure which entity types are available. Drag to reorder.
                </p>
                <div className="flex flex-wrap gap-2 mb-3">
                  {entityTypes.map((type, index) => (
                    <Badge
                      key={type}
                      variant="secondary"
                      className="gap-1 px-2 py-1 cursor-pointer hover:bg-destructive/20 group"
                      onClick={() => {
                        const newTypes = entityTypes.filter((_, i) => i !== index);
                        updateEntityTypes(newTypes);
                      }}
                    >
                      {type}
                      <Trash2 className="h-3 w-3 opacity-0 group-hover:opacity-100 text-destructive" />
                    </Badge>
                  ))}
                  {entityTypesSaving && (
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  )}
                </div>
                <div className="flex gap-2">
                  <Input
                    placeholder="New entity type..."
                    value={newEntityType}
                    onChange={(e) => setNewEntityType(e.target.value)}
                    className="h-8 w-48"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && newEntityType.trim()) {
                        updateEntityTypes([...entityTypes, newEntityType.trim()]);
                        setNewEntityType("");
                      }
                    }}
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8"
                    disabled={!newEntityType.trim() || entityTypesSaving}
                    onClick={() => {
                      if (newEntityType.trim()) {
                        updateEntityTypes([...entityTypes, newEntityType.trim()]);
                        setNewEntityType("");
                      }
                    }}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 shrink-0"
                onClick={() => setShowEntityTypesEditor(false)}
              >
                <ChevronDown className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

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
                  {flatTabs.map((tab, index) => renderTabWithChildren(tab, index))}
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
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
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

            {/* Parent Tab (for nesting under another tab) */}
            {editingTab && availableParents.length > 0 && (
              <div className="space-y-2">
                <Label htmlFor="parent_id">Parent Tab</Label>
                <Select
                  value={formData.parent_id?.toString() || "none"}
                  onValueChange={(value) =>
                    setFormData((prev) => ({
                      ...prev,
                      parent_id: value === "none" ? undefined : parseInt(value, 10),
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select parent tab (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No parent (root level)</SelectItem>
                    {availableParents.map((parent) => (
                      <SelectItem key={parent.id} value={parent.id.toString()}>
                        {parent.display_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Move this tab under another tab to create a sub-tab
                </p>
              </div>
            )}

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
                  defaultOptions={entityTypeOptions}
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
                  <div className="space-y-3 pl-6">
                    {/* Path Template Input */}
                    <div className="space-y-2">
                      <Label>SharePoint Path Template</Label>
                      <Input
                        value={formData.sharepoint_folder_path || ""}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            sharepoint_folder_path: e.target.value,
                          }))
                        }
                        placeholder="e.g., /Teeem/Companies/{{CompanyGroup}}/{{CompanyCode}}/Xero"
                        className="font-mono text-sm"
                      />
                    </div>

                    {/* Placeholder Badges */}
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">Click to insert placeholder:</Label>
                      <div className="flex flex-wrap gap-1">
                        {[
                          { key: "{{CompanyGroup}}", label: "Company Group", example: "Tekna Group" },
                          { key: "{{CompanyCode}}", label: "Company Code", example: "ABC123" },
                          { key: "{{EntityName}}", label: "Entity Name", example: "ABC Pty Ltd" },
                        ].map((placeholder) => (
                          <Badge
                            key={placeholder.key}
                            variant="outline"
                            className="cursor-pointer hover:bg-purple-100 dark:hover:bg-purple-900/30 text-purple-700 dark:text-purple-300"
                            onClick={() => {
                              setFormData((prev) => ({
                                ...prev,
                                sharepoint_folder_path: (prev.sharepoint_folder_path || "") + placeholder.key,
                              }));
                            }}
                          >
                            {placeholder.key}
                            <span className="ml-1 text-xs opacity-60">({placeholder.example})</span>
                          </Badge>
                        ))}
                      </div>
                    </div>

                    {/* Folder Browser */}
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">Or browse SharePoint folders:</Label>
                      <SharePointFolderBrowser
                        onSelect={(folder, path) => {
                          setFormData((prev) => ({
                            ...prev,
                            sharepoint_folder_path: path,
                          }));
                        }}
                        rootFolder=""
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Document Types (SSoT: Link document types to this tab) */}
            {(editingTab?.tab_group === 'documents' || formData.tab_group === 'documents') && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Linked Document Types</Label>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => window.open('/admin/system/document-types/new', '_blank')}
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    New Document Type
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Select which document types should appear under this tab
                </p>
                <MultipleSelector
                  value={
                    (formData.document_type_ids || []).map((id) => {
                      const dt = allDocumentTypes.find((d) => d.id === id);
                      return {
                        value: id.toString(),
                        label: dt?.display_name || dt?.name || `Type ${id}`,
                      };
                    })
                  }
                  onChange={(options: Option[]) =>
                    setFormData((prev) => ({
                      ...prev,
                      document_type_ids: options.map((o: Option) => parseInt(o.value)),
                    }))
                  }
                  defaultOptions={allDocumentTypes.map((dt) => ({
                    value: dt.id.toString(),
                    label: dt.display_name || dt.name,
                  }))}
                  placeholder="Select document types..."
                  emptyIndicator={
                    <p className="text-center text-sm text-muted-foreground">
                      No document types available
                    </p>
                  }
                />
                <p className="text-xs text-muted-foreground">
                  {(formData.document_type_ids || []).length} document types linked
                  {(formData.document_type_ids || []).length > 0 && (
                    <span className="ml-2">
                      — Click badge to edit document type
                    </span>
                  )}
                </p>
                {/* Clickable links to edit document types */}
                {(formData.document_type_ids || []).length > 0 && (
                  <div className="flex flex-wrap gap-1 pt-1">
                    {(formData.document_type_ids || []).map((id) => {
                      const dt = allDocumentTypes.find((d) => d.id === id);
                      return (
                        <Badge
                          key={id}
                          variant="outline"
                          className="cursor-pointer hover:bg-primary/10 text-xs"
                          onClick={() => window.open(`/admin/system/document-types/${id}`, '_blank')}
                        >
                          {dt?.display_name || dt?.name || `Type ${id}`}
                          <span className="ml-1 opacity-50">↗</span>
                        </Badge>
                      );
                    })}
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
