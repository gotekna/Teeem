"use client";

import * as React from "react";
import { toast } from "sonner";
import { resolveWithExamples, resolveSharePointPath } from "@/lib/placeholders";
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
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
// Plan configuration components (SSoT: Plans config moved from separate tab)
import {
  CategoriesSection as PlanCategoriesSection,
  TypesSection as PlanTypesSection,
  RevisionFormatsSection as PlanRevisionFormatsSection,
} from "@/app/(app)/admin/system/components/PlansTab";
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

// Generate display code from display name (max 3 chars)
// Single word: first 3 letters (e.g., "Photo" -> "PHO")
// Multi-word: first letter of each word (e.g., "Tax Returns" -> "TR", "Site Photo" -> "SP")
function generateDisplayCode(displayName: string): string {
  if (!displayName) return "";
  const words = displayName.trim().split(/\s+/);
  if (words.length === 1) {
    return words[0].substring(0, 3).toUpperCase();
  }
  return words
    .slice(0, 3)
    .map((w) => w.charAt(0))
    .join("")
    .toUpperCase();
}

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
  } = useEntityTabs({ scope, includeDisabled: true });

  // Fetch entity types from API (SSoT)
  const {
    entityTypes,
    loading: entityTypesLoading,
    saving: entityTypesSaving,
    updateEntityTypes,
  } = useEntityTypes();

  const [saving, setSaving] = React.useState(false);
  const [expandedItems, setExpandedItems] = React.useState<Set<number>>(new Set());
  const [expandedDocTypes, setExpandedDocTypes] = React.useState<Set<number>>(new Set());
  const [editingTab, setEditingTab] = React.useState<EntityTab | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = React.useState(false);
  const [deleteConfirmTab, setDeleteConfirmTab] = React.useState<EntityTab | null>(null);
  const [activeGroup, setActiveGroup] = React.useState<string>("overview");
  const [showEntityTypesEditor, setShowEntityTypesEditor] = React.useState(false);
  const [newEntityType, setNewEntityType] = React.useState("");
  // Plan configuration sheet (SSoT: Plans config integrated here)
  const [configTab, setConfigTab] = React.useState<EntityTab | null>(null);

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
  const [formData, setFormData] = React.useState<Partial<EntityTabCreateParams & { sharepoint_path_type?: 'corporate' | 'contacts' }>>({});

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

  // Auto-select first non-empty group when tabs change or current group becomes empty
  React.useEffect(() => {
    const nonEmptyGroups = groups.filter((g) => (groupedTabs[g]?.length || 0) > 0);
    if (nonEmptyGroups.length > 0 && (groupedTabs[activeGroup]?.length || 0) === 0) {
      setActiveGroup(nonEmptyGroups[0]);
    }
  }, [groupedTabs, groups, activeGroup]);

  // Flat list for non-grouped view
  const flatTabs = React.useMemo(() => {
    return tabs
      .filter((tab) => !tab.parent_id)
      .sort((a, b) => a.order_position - b.order_position);
  }, [tabs]);

  // Items start collapsed by default - user can expand as needed

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

      // Build optimistic tabs array with updated order_positions
      // This prevents jitter by immediately showing the new order
      const optimisticTabs = tabs.map(tab => {
        const newIndex = newItems.findIndex(ni => ni.id === tab.id);
        if (newIndex !== -1) {
          return { ...tab, order_position: newIndex };
        }
        return tab;
      });

      // Update order_position based on new order (with optimistic update)
      await reorderTabs(reorderData, optimisticTabs);
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
      sharepoint_path_type: 'corporate',  // SSoT: Default to corporate path
    });
    setEditingTab(null);
    setIsCreateDialogOpen(true);
  };

  // Open edit dialog - always opens the edit dialog for tab settings
  // (Special config sheets are accessed via dedicated buttons, not the edit action)
  const openEditDialog = (tab: EntityTab) => {
    setFormData({
      display_name: tab.display_name,
      display_code: tab.display_code || "",
      description: tab.description || "",
      tab_group: tab.tab_group || undefined,
      parent_id: tab.parent_id || undefined,
      entity_filters: tab.entity_filters,
      enabled: tab.enabled,
      icon_name: tab.icon_name || "",
      has_sharepoint_folder: tab.has_sharepoint_folder,
      sharepoint_folder_path: tab.sharepoint_folder_path || "",
      uses_custom_path: tab.uses_custom_path || false,  // SSoT: Template inheritance flag
      sharepoint_path_type: tab.sharepoint_path_type || 'corporate',  // SSoT: Path type for contacts
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
          display_code: formData.display_code,
          description: formData.description,
          tab_group: formData.tab_group,
          // Use null (not undefined) so JSON serialization includes it
          parent_id: formData.parent_id ?? null,
          entity_filters: formData.entity_filters,
          enabled: formData.enabled,
          icon_name: formData.icon_name,
          has_sharepoint_folder: formData.has_sharepoint_folder,
          sharepoint_folder_path: formData.sharepoint_folder_path,
          uses_custom_path: formData.uses_custom_path,  // SSoT: Template inheritance flag
          sharepoint_path_type: formData.sharepoint_path_type,  // SSoT: Path type for contacts
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
          display_code: formData.display_code,
          description: formData.description,
          tab_group: formData.tab_group,
          entity_filters: formData.entity_filters,
          enabled: formData.enabled ?? true,
          icon_name: formData.icon_name,
          has_sharepoint_folder: formData.has_sharepoint_folder,
          sharepoint_folder_path: formData.sharepoint_folder_path,
          sharepoint_path_type: formData.sharepoint_path_type,  // SSoT: Path type for contacts
        };
        await createTab(createParams);
      }
      toast.success(editingTab ? "Tab updated" : "Tab created");
      setIsCreateDialogOpen(false);
      setEditingTab(null);
    } catch (err: any) {
      console.error("Failed to save tab:", err);
      toast.error(err?.message || "Failed to save tab");
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

  // Helper to find siblings (tabs with same parent), sorted by order_position
  // When showTabGroups is false (flat list mode), all root tabs are siblings
  const findSiblings = (tab: EntityTab): EntityTab[] => {
    let siblings: EntityTab[];

    if (!tab.parent_id) {
      // Root level
      if (showTabGroups) {
        // Grouped view - filter by tab_group
        siblings = tabs.filter(t => !t.parent_id && t.tab_group === tab.tab_group);
      } else {
        // Flat list view - ALL root tabs are siblings (regardless of group)
        siblings = tabs.filter(t => !t.parent_id);
      }
    } else {
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
      siblings = parent?.children || [];
    }

    // CRITICAL: Sort by order_position to ensure correct ordering
    return siblings.sort((a, b) => a.order_position - b.order_position);
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
        {/* Expanded document types - table view */}
        {expandedDocTypes.has(tab.id) && tab.document_types && tab.document_types.length > 0 && (
          <div className={cn(
            "mt-1 mb-2 rounded-lg border bg-muted/30",
            depth === 0 && "ml-16",
            depth === 1 && "ml-26",
            depth >= 2 && "ml-36"
          )}>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left py-1.5 px-3 font-medium text-muted-foreground w-20">CODE</th>
                  <th className="text-left py-1.5 px-3 font-medium text-muted-foreground w-48">NAME</th>
                  <th className="text-left py-1.5 px-3 font-medium text-muted-foreground">FILE NAME</th>
                  <th className="text-left py-1.5 px-3 font-medium text-muted-foreground">DISPLAY NAME</th>
                </tr>
              </thead>
              <tbody>
                {tab.document_types.map((dt) => {
                  // Generate example using SSoT placeholders.ts
                  const applyReplacements = (str: string | undefined) => {
                    if (!str) return '—';
                    // Use SSoT for all standard placeholders
                    let result = resolveWithExamples(str);
                    // Override document-type specific values with actual data
                    result = result
                      .replace(/\{DocTypeCode\}/gi, dt.abbreviation || 'DOC')
                      .replace(/\{DocTypeName\}/gi, dt.name || 'Document');
                    return result;
                  };
                  const exampleFileName = applyReplacements(dt.file_name);
                  const exampleDisplayName = applyReplacements(dt.display_name);

                  return (
                    <React.Fragment key={dt.id}>
                      {/* Template row */}
                      <tr
                        className="border-b hover:bg-muted/50 cursor-pointer"
                        onDoubleClick={() => window.open(`/admin/system/document-types/${dt.id}`, '_blank')}
                      >
                        <td className="py-1.5 px-3 font-mono text-xs">{dt.abbreviation || '—'}</td>
                        <td className="py-1.5 px-3">{dt.name}</td>
                        <td className="py-1.5 px-3 text-muted-foreground text-xs font-mono">{dt.file_name || '—'}</td>
                        <td className="py-1.5 px-3 text-muted-foreground text-xs font-mono">{dt.display_name || '—'}</td>
                      </tr>
                      {/* Example row with resolved values */}
                      <tr
                        className="border-b last:border-0 hover:bg-muted/50 cursor-pointer bg-green-50/50 dark:bg-green-900/10"
                        onDoubleClick={() => window.open(`/admin/system/document-types/${dt.id}`, '_blank')}
                      >
                        <td className="py-1 px-3 text-xs text-green-600 dark:text-green-400">↳ eg.</td>
                        <td className="py-1 px-3 text-xs text-muted-foreground italic"></td>
                        <td className="py-1 px-3 text-xs text-green-700 dark:text-green-300">{exampleFileName}</td>
                        <td className="py-1 px-3 text-xs text-green-700 dark:text-green-300">{exampleDisplayName}</td>
                      </tr>
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {/* Expanded children */}
        {expandedItems.has(tab.id) && tab.children && tab.children.length > 0 && (
          <SortableList
            items={tab.children}
            onReorder={(newChildren) => handleChildReorder(tab, newChildren)}
          >
            <div className="space-y-1 mt-1">
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
          "border rounded-lg",
          !tab.enabled && "opacity-50",
          // SSoT: Custom path tabs get orange tinted background as warning indicator
          tab.uses_custom_path && tab.has_sharepoint_folder && "bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800",
          // Parent tabs with children get a colored background (only if not custom path)
          depth === 0 && hasChildren && !tab.uses_custom_path && "bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800",
          // Root tabs without children (only if not custom path)
          depth === 0 && !hasChildren && !tab.uses_custom_path && "bg-background",
          // Child tabs get indentation and left border
          depth === 1 && "ml-10 border-l-4 border-l-blue-300 dark:border-l-blue-700",
          depth === 2 && "ml-20 border-l-4 border-l-primary/30",
          depth >= 3 && "ml-28 border-l-4 border-l-primary/50"
        )}
      >
        <div className="flex items-center gap-2 flex-1 py-1 px-2">
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
          <div className="h-6 w-6 rounded bg-muted flex items-center justify-center shrink-0">
            <IconComponent className="h-3.5 w-3.5" />
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
              {tab.document_types && tab.document_types.length > 0 && (
                <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 text-xs font-medium bg-muted text-muted-foreground rounded">
                  {tab.document_types.length}
                </span>
              )}
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
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-xs gap-1 font-normal max-w-md",
                          tab.uses_custom_path
                            ? "bg-orange-50 border-orange-300 text-orange-700 dark:bg-orange-900/30 dark:border-orange-700 dark:text-orange-300"
                            : "bg-green-50 border-green-300 text-green-700 dark:bg-green-900/30 dark:border-green-700 dark:text-green-300"
                        )}
                      >
                        <FolderOpen className="h-3 w-3 shrink-0" />
                        <span className="truncate">{tab.full_sharepoint_path || tab.effective_sharepoint_path || tab.hierarchy_path || tab.display_name}</span>
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{tab.uses_custom_path ? "Custom path (overrides global template)" : "Using global template"}</p>
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
              {tab.document_types && tab.document_types.length > 0 && (
                <Badge
                  variant="outline"
                  className="text-xs gap-1 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800 cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900/20"
                  onClick={(e) => {
                    e.stopPropagation();
                    setExpandedDocTypes((prev) => {
                      const next = new Set(prev);
                      if (next.has(tab.id)) {
                        next.delete(tab.id);
                      } else {
                        next.add(tab.id);
                      }
                      return next;
                    });
                  }}
                >
                  {expandedDocTypes.has(tab.id) ? (
                    <ChevronDown className="h-3 w-3" />
                  ) : (
                    <ChevronRight className="h-3 w-3" />
                  )}
                  {tab.document_types.length} type{tab.document_types.length !== 1 ? 's' : ''}
                </Badge>
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
            {/* Plan configuration buttons (only for Plans tab) */}
            {tab.tab_key === "plans" && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setConfigTab({ ...tab, component_name: "PlanCategories" } as EntityTab)}
                >
                  Categories
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setConfigTab({ ...tab, component_name: "PlanTypes" } as EntityTab)}
                >
                  Types
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setConfigTab({ ...tab, component_name: "RevisionFormats" } as EntityTab)}
                >
                  Revisions
                </Button>
              </>
            )}

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
        <CardContent className="pt-0">
          {tabsInGroup.length > 0 ? (
            <SortableList items={tabsInGroup} onReorder={(items) => handleReorder(items, group)}>
              <div className="space-y-1">
                {tabsInGroup.map((tab, index) => renderTabWithChildren(tab, index))}
              </div>
            </SortableList>
          ) : (
            <div className="text-center py-4 text-muted-foreground">
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

  // Action buttons - rendered in Card header for compact mode, or standalone for non-compact
  const actionButtons = (
    <div className="flex items-center gap-2">
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
  );

  return (
    <div className={compact ? "space-y-4" : "space-y-6"}>
      {/* Header - only show outside card for non-compact mode */}
      {!compact && (
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-medium">{displayTitle}</h3>
            <p className="text-sm text-muted-foreground">{displayDescription}</p>
          </div>
          {actionButtons}
        </div>
      )}

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

      {/* Tabs by group - only show groups that have tabs */}
      {showTabGroups ? (
        <Tabs value={activeGroup} onValueChange={setActiveGroup}>
          <TabsList>
            {groups
              .filter((group) => (groupedTabs[group]?.length || 0) > 0)
              .map((group) => (
                <TabsTrigger key={group} value={group} className="gap-2">
                  {GROUP_LABELS[group]}
                  <Badge variant="secondary" className="text-xs">
                    {groupedTabs[group]?.length || 0}
                  </Badge>
                </TabsTrigger>
              ))}
          </TabsList>
          {groups
            .filter((group) => (groupedTabs[group]?.length || 0) > 0)
            .map((group) => (
              <TabsContent key={group} value={group}>
                {renderTabGroup(group, groupedTabs[group] || [])}
              </TabsContent>
            ))}
        </Tabs>
      ) : (
        /* Flat list without groups */
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <CardTitle>All Tabs</CardTitle>
                <Badge variant="secondary">{flatTabs.length}</Badge>
              </div>
              {compact && actionButtons}
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            {flatTabs.length > 0 ? (
              <SortableList items={flatTabs} onReorder={handleReorder}>
                <div className="space-y-1">
                  {flatTabs.map((tab, index) => renderTabWithChildren(tab, index))}
                </div>
              </SortableList>
            ) : (
              <div className="text-center py-4 text-muted-foreground">
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
            {/* Display Name and Display Code */}
            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-2 space-y-2">
                <Label htmlFor="display_name">Display Name</Label>
                <Input
                  id="display_name"
                  value={formData.display_name || ""}
                  onChange={(e) => {
                    const newName = e.target.value;
                    setFormData((prev) => {
                      // Auto-generate display_code if empty or matches auto-generated pattern
                      const currentCode = prev.display_code || "";
                      const shouldAutoGenerate = !currentCode || currentCode === generateDisplayCode(prev.display_name || "");
                      return {
                        ...prev,
                        display_name: newName,
                        display_code: shouldAutoGenerate ? generateDisplayCode(newName) : currentCode,
                      };
                    });
                  }}
                  placeholder="e.g., Tax Returns"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="display_code">Code (max 3)</Label>
                <Input
                  id="display_code"
                  value={formData.display_code || ""}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      display_code: e.target.value.toUpperCase().slice(0, 3),
                    }))
                  }
                  placeholder="e.g., TAX"
                  maxLength={3}
                  className="font-mono uppercase"
                />
              </div>
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
                      // Use null (not undefined) so JSON serialization includes it
                      parent_id: value === "none" ? null : parseInt(value, 10),
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

            {/* SharePoint Folder - SSoT: Template Inheritance */}
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
                  <div className="space-y-4 pl-6 border-l-2 border-muted ml-2">
                    {/* Path Mode Toggle - SSoT: Template Inheritance */}
                    <div className="space-y-2">
                      <Label>Path Mode</Label>
                      <div className="space-y-2">
                        {/* Option: Inherit from global template */}
                        <label
                          className={cn(
                            "flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors",
                            !formData.uses_custom_path
                              ? "bg-primary/5 border-primary"
                              : "bg-background hover:bg-muted/50"
                          )}
                        >
                          <input
                            type="radio"
                            name="path_mode"
                            checked={!formData.uses_custom_path}
                            onChange={() =>
                              setFormData((prev) => ({
                                ...prev,
                                uses_custom_path: false,
                                sharepoint_folder_path: "",  // Clear custom path when switching to inherit
                              }))
                            }
                            className="mt-0.5"
                          />
                          <div className="flex-1">
                            <div className="font-medium text-sm">Inherit from global template</div>
                            <div className="text-xs text-muted-foreground mt-0.5">
                              Uses the template from Admin &gt; System &gt; Company &gt; SharePoint
                            </div>

                            {/* SSoT: Corporate/Contacts path toggle - only for contact scope */}
                            {scope === "contact" && !formData.uses_custom_path && (
                              <div className="mt-3 p-2 rounded bg-muted/30 border">
                                <Label className="text-xs font-medium">SharePoint Base Path</Label>
                                <div className="flex gap-2 mt-1.5">
                                  <label
                                    className={cn(
                                      "flex-1 flex items-center gap-2 p-2 rounded border cursor-pointer transition-colors text-sm",
                                      formData.sharepoint_path_type === 'corporate'
                                        ? "bg-primary/10 border-primary"
                                        : "bg-background hover:bg-muted/50"
                                    )}
                                  >
                                    <input
                                      type="radio"
                                      name="sharepoint_path_type"
                                      checked={formData.sharepoint_path_type === 'corporate'}
                                      onChange={() =>
                                        setFormData((prev) => ({
                                          ...prev,
                                          sharepoint_path_type: 'corporate',
                                        }))
                                      }
                                    />
                                    <span>Corporate</span>
                                  </label>
                                  <label
                                    className={cn(
                                      "flex-1 flex items-center gap-2 p-2 rounded border cursor-pointer transition-colors text-sm",
                                      formData.sharepoint_path_type === 'contacts'
                                        ? "bg-primary/10 border-primary"
                                        : "bg-background hover:bg-muted/50"
                                    )}
                                  >
                                    <input
                                      type="radio"
                                      name="sharepoint_path_type"
                                      checked={formData.sharepoint_path_type === 'contacts'}
                                      onChange={() =>
                                        setFormData((prev) => ({
                                          ...prev,
                                          sharepoint_path_type: 'contacts',
                                        }))
                                      }
                                    />
                                    <span>Contacts</span>
                                  </label>
                                </div>
                                <p className="text-xs text-muted-foreground mt-1.5">
                                  {formData.sharepoint_path_type === 'contacts'
                                    ? "Uses Contacts SharePoint folder for this tab"
                                    : "Uses Corporate SharePoint folder for this tab (default)"}
                                </p>
                              </div>
                            )}

                            {/* Show inherited preview */}
                            {editingTab?.inherited_template && (
                              <div className="mt-2 text-xs bg-muted/50 rounded px-2 py-1.5 font-mono">
                                <span className="text-muted-foreground/60">Preview: </span>
                                <span className="text-foreground">
                                  {resolveSharePointPath(editingTab.inherited_template + "/" + (formData.display_name || editingTab.display_name))}
                                </span>
                              </div>
                            )}
                          </div>
                          <Badge variant="secondary" className="text-xs shrink-0">Recommended</Badge>
                        </label>

                        {/* Option: Use custom path */}
                        <label
                          className={cn(
                            "flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors",
                            formData.uses_custom_path
                              ? "bg-orange-50 dark:bg-orange-900/20 border-orange-300 dark:border-orange-700"
                              : "bg-background hover:bg-muted/50"
                          )}
                        >
                          <input
                            type="radio"
                            name="path_mode"
                            checked={formData.uses_custom_path || false}
                            onChange={() =>
                              setFormData((prev) => ({
                                ...prev,
                                uses_custom_path: true,
                                // Pre-fill with effective path when switching to custom
                                sharepoint_folder_path: prev.sharepoint_folder_path || editingTab?.effective_sharepoint_path || "",
                              }))
                            }
                            className="mt-0.5"
                          />
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm">Use custom path</span>
                              {formData.uses_custom_path && (
                                <Badge className="text-xs bg-orange-500 text-white border-0">
                                  <AlertCircle className="h-3 w-3 mr-1" />
                                  Override
                                </Badge>
                              )}
                            </div>
                            <div className="text-xs text-muted-foreground mt-0.5">
                              Override the global template with a custom path for this tab only
                            </div>
                          </div>
                        </label>
                      </div>
                    </div>

                    {/* Custom Path Input - Only shown when using custom path */}
                    {formData.uses_custom_path && (
                      <div className="space-y-3 p-3 rounded-lg bg-orange-50/50 dark:bg-orange-900/10 border border-orange-200 dark:border-orange-800">
                        {/* Warning banner with restore button */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 text-orange-700 dark:text-orange-300 text-xs">
                            <AlertCircle className="h-4 w-4 shrink-0" />
                            <span>This custom path overrides the global SharePoint template</span>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-xs h-7 text-muted-foreground hover:text-foreground"
                            onClick={() =>
                              setFormData((prev) => ({
                                ...prev,
                                uses_custom_path: false,
                                sharepoint_folder_path: "",
                              }))
                            }
                          >
                            Restore to Inherit
                          </Button>
                        </div>

                        {/* Path Template Input */}
                        <div className="space-y-2">
                          <Label>Custom Path Template</Label>
                          <Input
                            value={formData.sharepoint_folder_path || ""}
                            onChange={(e) =>
                              setFormData((prev) => ({
                                ...prev,
                                sharepoint_folder_path: e.target.value,
                              }))
                            }
                            placeholder="e.g., {{JobCode}}/{{Category}}/Custom Folder"
                            className="font-mono text-sm"
                          />
                          {/* Path Preview */}
                          {formData.sharepoint_folder_path && (
                            <div className="text-xs text-muted-foreground bg-background rounded px-2 py-1.5 font-mono border">
                              <span className="text-muted-foreground/60">Preview: </span>
                              <span className="text-foreground">{resolveSharePointPath(formData.sharepoint_folder_path)}</span>
                            </div>
                          )}
                        </div>

                        {/* Placeholder Badges - different for job vs corporate scopes */}
                        <div className="space-y-2">
                          <Label className="text-xs text-muted-foreground">Click to insert placeholder:</Label>
                          <div className="flex flex-wrap gap-1">
                            {(scope === "job" ? [
                              { key: "{{JobCode}}", example: "077", color: "orange" },
                              { key: "{{Category}}", example: "Contract Drawings", color: "orange" },
                              { key: "{{JobName}}", example: "Tulum Street Jimboomba", color: "orange" },
                              { key: "{{Tab}}", example: formData.display_code || "TAB", color: "blue" },
                              { key: "{{TabLong}}", example: formData.display_name || "Tab Name", color: "blue" },
                            ] : [
                              { key: "{{CompanyGroup}}", example: "Tekna Group", color: "purple" },
                              { key: "{{CompanyCode}}", example: "TH", color: "purple" },
                              { key: "{{EntityName}}", example: "Tekna Homes Pty Ltd", color: "purple" },
                              { key: "{{Tab}}", example: formData.display_code || "TAB", color: "blue" },
                              { key: "{{TabLong}}", example: formData.display_name || "Tab Name", color: "blue" },
                            ]).map((placeholder) => (
                              <Badge
                                key={placeholder.key}
                                variant="outline"
                                className={`cursor-pointer ${
                                  placeholder.color === "orange"
                                    ? "hover:bg-orange-100 dark:hover:bg-orange-900/30 text-orange-700 dark:text-orange-300"
                                    : placeholder.color === "blue"
                                    ? "hover:bg-blue-100 dark:hover:bg-blue-900/30 text-blue-700 dark:text-blue-300"
                                    : "hover:bg-purple-100 dark:hover:bg-purple-900/30 text-purple-700 dark:text-purple-300"
                                }`}
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
                    onClick={() => {
                      // Map EntityTabScope to document type scope
                      const docTypeScope = scope === 'corporate_entity' ? 'company' : scope;
                      // Pass tab ID so it can be pre-selected as the folder
                      const tabId = editingTab?.id;
                      window.open(`/admin/system/document-types/new?scope=${docTypeScope}${tabId ? `&tab=${tabId}` : ''}`, '_blank');
                    }}
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
                  placeholder="Type to search document types..."
                  hidePlaceholderWhenSelected={false}
                  emptyIndicator={
                    <p className="text-center text-sm text-muted-foreground">
                      No document types found
                    </p>
                  }
                  inputProps={{
                    className: "min-w-[200px]",
                  }}
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

      {/* Plan Configuration Sheet (SSoT: Plans config integrated from separate tab) */}
      <Sheet open={!!configTab} onOpenChange={() => setConfigTab(null)}>
        <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{configTab?.display_name} Configuration</SheetTitle>
            <SheetDescription>
              Configure {configTab?.display_name?.toLowerCase()} for the Plans document tab
            </SheetDescription>
          </SheetHeader>
          <div className="mt-6">
            {configTab?.component_name === "PlanCategories" && <PlanCategoriesSection />}
            {configTab?.component_name === "PlanTypes" && <PlanTypesSection />}
            {configTab?.component_name === "RevisionFormats" && <PlanRevisionFormatsSection />}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
