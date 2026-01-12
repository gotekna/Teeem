"use client";

import * as React from "react";
import { toast } from "sonner";
import { resolveWithExamples, resolveSharePointPath, SHAREPOINT_PLACEHOLDERS } from "@/lib/placeholders";
import { TokenBuilder } from "@/components/ui/tokens";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { IconPicker } from "@/components/ui/icon-picker";
import {
  SortableList,
  SortableItem,
  reorderByPosition,
  DragHandle,
  ItemBadge,
} from "@/components/ui/dnd";
import {
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
// useUrlState removed - doesn't work reliably with catch-all routes
import { SharePointFolderBrowser } from "@/components/ui/sharepoint-folder-browser";
import { Spinner } from "@/components/ui/spinner";
import type {
  EntityTab,
  EntityTabScope,
  TabGroup,
  TabDisplayMode,
  EntityTabCreateParams,
  EntityTabUpdateParams,
  ReorderTabParams,
} from "@/lib/types/entity-tabs";
import { SCOPE_LABELS, GROUP_LABELS } from "@/lib/types/entity-tabs";

// Hook to fetch used icons for a scope
function useUsedIcons(scope: EntityTabScope) {
  const [usedIcons, setUsedIcons] = React.useState<Array<{ id: number; icon_name: string; display_name: string }>>([]);
  const [loading, setLoading] = React.useState(false);

  const fetchUsedIcons = React.useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.get<{ success: boolean; data: Array<{ id: number; icon_name: string; display_name: string }> }>(
        `/api/v1/entity_tabs/used_icons?scope=${scope}`
      );
      if (response?.success) {
        setUsedIcons(response.data);
      }
    } catch (err) {
      console.error('Failed to fetch used icons:', err);
    } finally {
      setLoading(false);
    }
  }, [scope]);

  React.useEffect(() => {
    fetchUsedIcons();
  }, [fetchUsedIcons]);

  return { usedIcons, loading, refetch: fetchUsedIcons };
}

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

  // Fetch used icons for icon picker (SSoT: unique icons per root tab)
  const { usedIcons, refetch: refetchUsedIcons } = useUsedIcons(scope);

  // SSoT: Fetch storage configuration for scope folder paths
  const [storageConfig, setStorageConfig] = React.useState<{
    root_path?: string;
    scope_folders?: Record<string, string>;
  } | null>(null);

  React.useEffect(() => {
    const fetchStorageConfig = async () => {
      try {
        const response = await api.get<{
          success: boolean;
          data: { root_path?: string; scope_folders?: Record<string, string> };
        }>("/api/v1/corporate_company_settings/sharepoint");
        if (response?.success && response.data) {
          setStorageConfig(response.data);
        }
      } catch (err) {
        console.error("Failed to fetch storage config:", err);
      }
    };
    fetchStorageConfig();
  }, []);

  // SSoT: Get base path for a scope from StorageConfiguration
  const getBasePath = React.useCallback((scopeKey: string): string => {
    const rootPath = storageConfig?.root_path || "";
    const scopePath = storageConfig?.scope_folders?.[scopeKey] || "";
    if (!scopePath) return rootPath || "/";
    return rootPath ? `${rootPath}/${scopePath}` : `/${scopePath}`;
  }, [storageConfig]);

  const [saving, setSaving] = React.useState(false);

  // Local state for dialog - URL state doesn't work reliably with catch-all routes
  const [activeGroup, setActiveGroup] = React.useState("overview");
  const [editingTabKey, setEditingTabKey] = React.useState<string | null>(null);
  const [dialogAction, setDialogAction] = React.useState<"edit" | "create" | null>(null);
  const [configPanelName, setConfigPanelName] = React.useState<string | null>(null);

  // Local state for expanded items
  const [expandedItems, setExpandedItemsState] = React.useState<Set<string>>(new Set());
  const [expandedDocTypes, setExpandedDocTypesState] = React.useState<Set<string>>(new Set());

  // Derive values from local state
  const isDialogOpen = dialogAction === "create" || dialogAction === "edit";
  const isCreateMode = dialogAction === "create";

  // Look up editingTab from tabs array using local state
  const editingTab = React.useMemo(() => {
    if (!editingTabKey || dialogAction !== "edit") return null;
    // Search recursively through tabs and children by tab_key
    const findTab = (tabList: EntityTab[]): EntityTab | null => {
      for (const tab of tabList) {
        if (tab.tab_key === editingTabKey) return tab;
        if (tab.children?.length) {
          const found = findTab(tab.children);
          if (found) return found;
        }
      }
      return null;
    };
    return findTab(tabs);
  }, [editingTabKey, dialogAction, tabs]);

  // Look up configTab from tabs array using local state
  const configTab = React.useMemo(() => {
    if (!configPanelName) return null;
    // Find the plans tab and add the component_name
    const plansTab = tabs.find(t => t.tab_key === "plans");
    if (!plansTab) return null;
    return { ...plansTab, component_name: configPanelName } as EntityTab & { component_name: string };
  }, [configPanelName, tabs]);

  // Use tab_key (slug) for expanded state - Set<string> instead of Set<number>
  const setExpandedItems = React.useCallback((updater: Set<string> | ((prev: Set<string>) => Set<string>)) => {
    if (typeof updater === "function") {
      setExpandedItemsState((prev) => updater(prev));
    } else {
      setExpandedItemsState(updater);
    }
  }, []);

  const setExpandedDocTypes = React.useCallback((updater: Set<string> | ((prev: Set<string>) => Set<string>)) => {
    if (typeof updater === "function") {
      setExpandedDocTypesState((prev) => updater(prev));
    } else {
      setExpandedDocTypesState(updater);
    }
  }, []);

  // Use tab_key (slug) instead of numeric ID
  const setEditingTab = React.useCallback((tab: EntityTab | null) => {
    if (tab) {
      setEditingTabKey(tab.tab_key);
      setDialogAction("edit");
    } else {
      setEditingTabKey(null);
      setDialogAction(null);
    }
  }, []);

  const setDialogOpen = React.useCallback((open: boolean) => {
    if (!open) {
      setDialogAction(null);
      setEditingTabKey(null);
    }
  }, []);

  const openCreateMode = React.useCallback(() => {
    setDialogAction("create");
    setEditingTabKey(null);
  }, []);

  const setConfigTab = React.useCallback((tab: EntityTab | null, componentName?: string) => {
    setConfigPanelName(componentName || null);
  }, []);

  const [deleteConfirmTab, setDeleteConfirmTab] = React.useState<EntityTab | null>(null);
  const [showEntityTypesEditor, setShowEntityTypesEditor] = React.useState(false);
  const [newEntityType, setNewEntityType] = React.useState("");

  // SSoT: Track original display_name to detect changes for folder rename prompt
  const [originalDisplayName, setOriginalDisplayName] = React.useState<string | null>(null);

  // SSoT: Folder rename confirmation dialog state
  const [folderRenameDialog, setFolderRenameDialog] = React.useState<{
    open: boolean;
    oldName: string;
    newName: string;
    tabId: number;
  } | null>(null);

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
  const [formData, setFormData] = React.useState<Partial<EntityTabCreateParams & { sharepoint_path_type?: 'corporate' | 'contacts'; display_mode?: TabDisplayMode; hidden_by_default?: boolean }>>({});

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

  // Toggle item expansion - uses tab_key (slug) instead of numeric ID
  const toggleExpanded = (tabKey: string) => {
    setExpandedItems((prev) => {
      const next = new Set(prev);
      if (next.has(tabKey)) {
        next.delete(tabKey);
      } else {
        next.add(tabKey);
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
      tab_group: group || 'documents',  // Default to documents (most common use case)
      entity_filters: [],
      enabled: true,
      has_sharepoint_folder: false,
      sharepoint_folder_path: "",
      sharepoint_path_type: 'corporate',  // SSoT: Default to corporate path
      is_photo_category: false,  // SSoT: Explicit photo category flag
      is_cad_category: false,  // SSoT: Explicit CAD/Revit category flag
      display_mode: 'both',  // SSoT: Default display mode
      hidden_by_default: false,  // SSoT: Default visibility
    });
    openCreateMode();
  };

  // Open edit dialog - always opens the edit dialog for tab settings
  // (Special config sheets are accessed via dedicated buttons, not the edit action)
  const openEditDialog = (tab: EntityTab) => {
    // Note: Both {{TabName}} (parent) and {{SubTabName}} (current) are valid for subtabs
    const folderPath = tab.sharepoint_folder_path || "";

    // SSoT: Store original display_name for folder rename detection
    setOriginalDisplayName(tab.display_name);

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
      sharepoint_folder_path: folderPath,
      uses_custom_path: tab.uses_custom_path || false,  // SSoT: Template inheritance flag
      sharepoint_path_type: tab.sharepoint_path_type || 'corporate',  // SSoT: Path type for contacts
      // SSoT: Include linked document type IDs
      document_type_ids: tab.document_types?.map((dt: any) => dt.id) || [],
      is_photo_category: tab.is_photo_category || false,  // SSoT: Explicit photo category flag
      is_cad_category: tab.is_cad_category || false,  // SSoT: Explicit CAD/Revit category flag
      display_mode: tab.display_mode || 'both',  // SSoT: Display mode
      hidden_by_default: tab.hidden_by_default || false,  // SSoT: Hidden by default
    });
    // setEditingTab updates URL with tabId and action=edit
    setEditingTab(tab);
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
        // SSoT: Detect display_name change for folder rename prompt
        const displayNameChanged = originalDisplayName && formData.display_name !== originalDisplayName;
        const hasSharePointFolder = editingTab.has_sharepoint_folder || formData.has_sharepoint_folder;

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
          is_photo_category: formData.is_photo_category,  // SSoT: Explicit photo category flag
          is_cad_category: formData.is_cad_category,  // SSoT: Explicit CAD/Revit category flag
          display_mode: formData.display_mode,  // SSoT: Display mode
          hidden_by_default: formData.hidden_by_default,  // SSoT: Hidden by default
        };
        await updateTab(editingTab.id, updateParams);
        // Refetch used icons after update (icon may have changed)
        refetchUsedIcons();

        // SSoT: Show folder rename confirmation if display_name changed and has SharePoint folder
        if (displayNameChanged && hasSharePointFolder) {
          setFolderRenameDialog({
            open: true,
            oldName: originalDisplayName,
            newName: formData.display_name || "",
            tabId: editingTab.id,
          });
          toast.success("Tab updated - Storage folder rename queued");
        } else {
          toast.success("Tab updated");
        }
        setDialogOpen(false);
        setOriginalDisplayName(null);
        return;
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
          is_photo_category: formData.is_photo_category,  // SSoT: Explicit photo category flag
          is_cad_category: formData.is_cad_category,  // SSoT: Explicit CAD/Revit category flag
          display_mode: formData.display_mode,  // SSoT: Display mode
          hidden_by_default: formData.hidden_by_default,  // SSoT: Hidden by default
        };
        await createTab(createParams);
        // Refetch used icons after create (new icon added)
        refetchUsedIcons();
        toast.success("Tab created");
        setDialogOpen(false);
      }
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
        {expandedDocTypes.has(tab.tab_key) && tab.document_types && tab.document_types.length > 0 && (
          <div className={cn(
            "mt-1 mb-2 rounded-lg border bg-muted/30",
            depth === 0 && "ml-16",
            depth === 1 && "ml-26",
            depth >= 2 && "ml-36"
          )}>
            <Table className="w-full text-sm">
              <TableHeader>
                <TableRow className="border-b bg-muted/50">
                  <TableHead className="text-left py-1.5 px-3 font-medium text-muted-foreground w-20">CODE</TableHead>
                  <TableHead className="text-left py-1.5 px-3 font-medium text-muted-foreground w-48">NAME</TableHead>
                  <TableHead className="text-left py-1.5 px-3 font-medium text-muted-foreground">FILE NAME</TableHead>
                  <TableHead className="text-left py-1.5 px-3 font-medium text-muted-foreground">DISPLAY NAME</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
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
                      <TableRow
                        className="border-b hover:bg-muted/50 cursor-pointer"
                        onDoubleClick={() => window.open(`/admin/system/document-types/${dt.id}`, '_blank')}
                      >
                        <TableCell className="py-1.5 px-3 font-mono text-xs">{dt.abbreviation || '—'}</TableCell>
                        <TableCell className="py-1.5 px-3">{dt.name}</TableCell>
                        <TableCell className="py-1.5 px-3 text-muted-foreground text-xs font-mono">{dt.file_name || '—'}</TableCell>
                        <TableCell className="py-1.5 px-3 text-muted-foreground text-xs font-mono">{dt.display_name || '—'}</TableCell>
                      </TableRow>
                      {/* Example row with resolved values */}
                      <TableRow
                        className="border-b last:border-0 hover:bg-muted/50 cursor-pointer bg-green-50/50 dark:bg-green-900/10"
                        onDoubleClick={() => window.open(`/admin/system/document-types/${dt.id}`, '_blank')}
                      >
                        <TableCell className="py-1 px-3 text-xs text-green-600 dark:text-green-400">↳ eg.</TableCell>
                        <TableCell className="py-1 px-3 text-xs text-muted-foreground italic"></TableCell>
                        <TableCell className="py-1 px-3 text-xs text-green-700 dark:text-green-300">{exampleFileName}</TableCell>
                        <TableCell className="py-1 px-3 text-xs text-green-700 dark:text-green-300">{exampleDisplayName}</TableCell>
                      </TableRow>
                    </React.Fragment>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
        {/* Expanded children */}
        {expandedItems.has(tab.tab_key) && tab.children && tab.children.length > 0 && (
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
    // SSoT: Use effective_icon_name for inherited icons from parent
    const IconComponent = getIcon(tab.effective_icon_name || tab.icon_name || "file");
    const hasChildren = tab.children && tab.children.length > 0;
    const isExpanded = expandedItems.has(tab.tab_key);

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
          {/* Expand/collapse button for items with children */}
          {hasChildren ? (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 shrink-0"
              onClick={(e) => {
                e.stopPropagation();
                toggleExpanded(tab.tab_key);
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
                          "text-xs gap-1 font-normal",
                          tab.uses_custom_path
                            ? "bg-orange-50 border-orange-300 text-orange-700 dark:bg-orange-900/30 dark:border-orange-700 dark:text-orange-300"
                            : "bg-green-50 border-green-300 text-green-700 dark:bg-green-900/30 dark:border-green-700 dark:text-green-300"
                        )}
                      >
                        <FolderOpen className="h-3 w-3 shrink-0" />
                        <span>{
                          tab.uses_custom_path
                            ? (tab.sharepoint_folder_path || tab.display_name)
                            : (tab.sharepoint_base_path && tab.effective_sharepoint_path
                                ? `${tab.sharepoint_base_path}/${tab.effective_sharepoint_path}`
                                : (tab.effective_sharepoint_path || tab.hierarchy_path || tab.display_name))
                        }</span>
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="max-w-lg">
                      <p className="font-mono text-xs break-all">{
                        tab.uses_custom_path
                          ? (tab.sharepoint_folder_path || tab.display_name)
                          : (tab.sharepoint_base_path && tab.effective_sharepoint_path
                              ? `${tab.sharepoint_base_path}/${tab.effective_sharepoint_path}`
                              : (tab.effective_sharepoint_path || tab.hierarchy_path || tab.display_name))
                      }</p>
                      <p className="text-muted-foreground mt-1">{tab.uses_custom_path ? "Custom path" : "Global template"}</p>
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
                      if (next.has(tab.tab_key)) {
                        next.delete(tab.tab_key);
                      } else {
                        next.add(tab.tab_key);
                      }
                      return next;
                    });
                  }}
                >
                  {expandedDocTypes.has(tab.tab_key) ? (
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
                  onClick={() => setConfigTab(tab, "PlanCategories")}
                >
                  Categories
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setConfigTab(tab, "PlanTypes")}
                >
                  Types
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setConfigTab(tab, "RevisionFormats")}
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
        <Spinner size={32} className="text-muted-foreground" />
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
                    <Spinner size={16} className="text-muted-foreground" />
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

      {/* Create/Edit Dialog - controlled by URL state for back button support */}
      <Dialog open={isDialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[95vw] h-[90vh] overflow-hidden flex flex-col">
          {/* Visually hidden title for screen reader accessibility */}
          <DialogTitle className="sr-only">
            {editingTab ? `Edit: ${editingTab.display_name}` : "Create New Tab"}
          </DialogTitle>
          <DialogDescription className="sr-only">
            Configure tab settings including name, icon, visibility, and content options
          </DialogDescription>
          {/* Compact header with inline save button */}
          <div className="flex items-center justify-between border-b pb-3 mb-4">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-semibold" aria-hidden="true">
                {editingTab ? `Edit: ${editingTab.display_name}` : "Create New Tab"}
              </h2>
              {/* SSoT: Show subtab indicator when editing a child tab */}
              {(formData.parent_id || editingTab?.parent_id) && (() => {
                const parentId = formData.parent_id || editingTab?.parent_id;
                const parentTab = tabs.find(t => t.id === parentId);
                return (
                  <Badge variant="secondary" className="bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-700">
                    <span className="text-xs">↳ Subtab of: {parentTab?.display_name || "Unknown"}</span>
                  </Badge>
                );
              })()}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDialogOpen(false)}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button size="sm" onClick={handleFormSubmit} disabled={saving}>
                {saving && <Spinner size={16} className="mr-2" />}
                {editingTab ? "Save Changes" : "Create Tab"}
              </Button>
            </div>
          </div>

          {/* Three-column layout */}
          <div className="grid grid-cols-3 gap-6 flex-1 overflow-hidden">
            {/* Column 1: Basic Info + Tab Settings */}
            <div className="space-y-4 overflow-y-auto">
              <h3 className="text-sm font-medium text-muted-foreground border-b pb-2">Basic Information</h3>

              {/* Display Name and Code side by side */}
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2 space-y-2">
                  <Label htmlFor="display_name">Display Name</Label>
                  <Input
                    id="display_name"
                    value={formData.display_name || ""}
                    onChange={(e) => {
                      const newName = e.target.value;
                      setFormData((prev) => {
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
                  <Label htmlFor="display_code">Code</Label>
                  <Input
                    id="display_code"
                    value={formData.display_code || ""}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        display_code: e.target.value.toUpperCase().slice(0, 3),
                      }))
                    }
                    placeholder="TAX"
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
                    placeholder="e.g., tax-returns"
                  />
                </div>
              )}

              {/* Tab Group - determines if this is a document tab */}
              <div className="space-y-2">
                <Label htmlFor="tab_group">Tab Group</Label>
                <Select
                  value={formData.tab_group || "documents"}
                  onValueChange={(value: TabGroup) =>
                    setFormData((prev) => ({ ...prev, tab_group: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select tab group" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="overview">Overview</SelectItem>
                    <SelectItem value="documents">Documents (enables Document Types)</SelectItem>
                    <SelectItem value="reports">Reports</SelectItem>
                    <SelectItem value="data">Data</SelectItem>
                    <SelectItem value="setup">Setup</SelectItem>
                    <SelectItem value="main">Main</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {formData.tab_group === 'documents'
                    ? "Document tabs can link to Document Types"
                    : "Only 'Documents' group enables Document Types linking"}
                </p>
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Input
                  id="description"
                  value={formData.description || ""}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, description: e.target.value }))
                  }
                  placeholder="Brief description"
                />
              </div>

              {/* Icon Picker - SSoT: Visual icon selection with uniqueness enforcement */}
              <IconPicker
                value={formData.icon_name || null}
                onChange={(iconName) =>
                  setFormData((prev) => ({ ...prev, icon_name: iconName || "" }))
                }
                usedIcons={usedIcons}
                disableUsed={!formData.parent_id && !editingTab?.parent_id}  // Only disable for root tabs
                currentTabId={editingTab?.id}
                label="Icon"
                placeholder="Select an icon..."
                showInheritedBadge={!!(formData.parent_id || editingTab?.parent_id) && !formData.icon_name}
              />

              {/* Display Mode - SSoT: How tab renders (icon_only disabled for child tabs) */}
              <div className="space-y-2">
                <Label>Display Mode</Label>
                <Select
                  value={formData.display_mode || 'both'}
                  onValueChange={(value: TabDisplayMode) =>
                    setFormData((prev) => ({ ...prev, display_mode: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select display mode" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="both">Icon + Text</SelectItem>
                    <SelectItem
                      value="icon_only"
                      disabled={!!(formData.parent_id || editingTab?.parent_id)}
                    >
                      Icon Only {(formData.parent_id || editingTab?.parent_id) && "(not available for sub-tabs)"}
                    </SelectItem>
                    <SelectItem value="text_only">Text Only</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {formData.display_mode === 'icon_only'
                    ? "Tab shows icon only (tooltip shows name)"
                    : formData.display_mode === 'text_only'
                    ? "Tab shows text only (no icon)"
                    : "Tab shows both icon and text"}
                </p>
              </div>

              {/* Parent Tab (for nesting under another tab) */}
              {editingTab && availableParents.length > 0 && (
                <div className="space-y-2">
                  <Label htmlFor="parent_id">Parent Tab</Label>
                  <Select
                    value={formData.parent_id?.toString() || "none"}
                    onValueChange={(value) => {
                      const newParentId = value === "none" ? null : parseInt(value, 10);
                      setFormData((prev) => ({
                        ...prev,
                        parent_id: newParentId,
                      }));
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select parent tab" />
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

              {/* Corporate/Contacts path toggle - only for contact scope */}
              {scope === "contact" && (
                <div className="flex items-center gap-2 pt-2">
                  <Switch
                    id="corporate_path"
                    checked={formData.sharepoint_path_type === 'corporate'}
                    onCheckedChange={(checked) =>
                      setFormData((prev) => ({
                        ...prev,
                        sharepoint_path_type: checked ? 'corporate' : 'contacts',
                      }))
                    }
                  />
                  <div>
                    <Label htmlFor="corporate_path">Corporate Path</Label>
                    <p className="text-xs text-muted-foreground">
                      {formData.sharepoint_path_type === 'corporate'
                        ? "Uses Corporate/People folder"
                        : "Uses Contacts folder"}
                    </p>
                  </div>
                </div>
              )}

              {/* Photo Category checkbox - SSoT: Explicit flag for photo gallery view */}
              <div className="flex items-center space-x-3 pt-4 mt-4 border-t">
                <Checkbox
                  id="is_photo_category_basic"
                  checked={formData.is_photo_category || false}
                  onCheckedChange={(checked) =>
                    setFormData((prev) => ({ ...prev, is_photo_category: checked === true }))
                  }
                />
                <div>
                  <Label htmlFor="is_photo_category_basic" className="text-sm cursor-pointer font-medium">
                    Photo Gallery View
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Show photos in grid instead of file table
                  </p>
                </div>
              </div>

              {/* CAD Category checkbox - SSoT: Explicit flag for Revit/DWG file viewer */}
              <div className="flex items-center space-x-3 pt-4 mt-4 border-t">
                <Checkbox
                  id="is_cad_category_basic"
                  checked={formData.is_cad_category || false}
                  onCheckedChange={(checked) =>
                    setFormData((prev) => ({ ...prev, is_cad_category: checked === true }))
                  }
                />
                <div>
                  <Label htmlFor="is_cad_category_basic" className="text-sm cursor-pointer font-medium">
                    CAD Files View
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Show Revit, DWG, and Datasmith files with upload
                  </p>
                </div>
              </div>
            </div>

            {/* Column 2: Storage Configuration */}
            <div className="space-y-4 overflow-y-auto">
              <h3 className="text-sm font-medium text-muted-foreground border-b pb-2">Storage Configuration</h3>

            {/* Storage Folder Path */}
            {showSharePointPaths && (
              <div className="space-y-3">
                {/* Base path from StorageConfiguration (read-only) - SSoT for scope folders */}
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Base Path (from Admin → System → Storage Config)</Label>
                  <div className="flex items-center gap-1 p-2 border rounded bg-muted/30">
                    <span className="inline-flex items-center font-mono text-xs px-2 py-1 rounded-none border bg-muted dark:bg-slate-800 text-foreground dark:text-muted-foreground border-border dark:border-border">
                      {/* SSoT: Get base path from StorageConfiguration scope_folders */}
                      {scope === "contact"
                        ? (formData.sharepoint_path_type === 'corporate'
                            ? getBasePath("people")
                            : getBasePath("contact"))
                        : (editingTab?.sharepoint_base_path || getBasePath(scope))}
                    </span>
                    <span className="text-muted-foreground">/</span>
                  </div>
                </div>

                {/* Editable folder path (read-only for system tabs) */}
                <TokenBuilder
                  label={editingTab?.is_system_tab ? "Folder Path (system-managed)" : "Folder Path (add placeholders)"}
                  value={formData.sharepoint_folder_path || editingTab?.effective_sharepoint_path || (formData.display_name || editingTab?.display_name || "")}
                  onChange={(value) =>
                    setFormData((prev) => ({
                      ...prev,
                      sharepoint_folder_path: value,
                    }))
                  }
                  // SSoT: Filter placeholders based on tab hierarchy
                  // - Root tabs: show {{TabName}} only (no subtab)
                  // - Subtabs: show BOTH {{TabName}} (parent) and {{SubTabName}} (current)
                  placeholders={SHAREPOINT_PLACEHOLDERS.filter((p) => {
                    const isSubtab = !!(formData.parent_id || editingTab?.parent_id);
                    if (isSubtab) {
                      // Subtabs: show BOTH TabName (parent) and SubTabName (current)
                      return true;
                    } else {
                      // Root tabs: show TabName only, hide SubTabName
                      return p.code !== "{{SubTabName}}";
                    }
                  })}
                  showPreview={true}
                  placeholder="Click tokens to add..."
                  disabled={editingTab?.is_system_tab}
                />

                {/* Full path preview - uses ACTUAL tab names, not generic examples */}
                {(() => {
                  // SSoT: Get base path from StorageConfiguration scope_folders
                  const basePath = scope === "contact"
                    ? (formData.sharepoint_path_type === 'corporate'
                        ? getBasePath("people")
                        : getBasePath("contact"))
                    : (editingTab?.sharepoint_base_path || getBasePath(scope));

                  // Get actual tab names for preview
                  const parentId = formData.parent_id || editingTab?.parent_id;
                  // Recursive search to find parent tab (might be nested)
                  const findTabById = (tabList: EntityTab[], id: number): EntityTab | null => {
                    for (const tab of tabList) {
                      if (tab.id === id) return tab;
                      if (tab.children?.length) {
                        const found = findTabById(tab.children, id);
                        if (found) return found;
                      }
                    }
                    return null;
                  };
                  const parentTab = parentId ? findTabById(tabs, parentId) : null;
                  const currentTabName = formData.display_name || editingTab?.display_name || "";
                  const parentTabName = parentTab?.display_name || "";

                  // Resolve with ACTUAL values, not generic examples
                  let folderPath = formData.sharepoint_folder_path || currentTabName;
                  folderPath = folderPath
                    .replace(/\{\{SubTabName\}\}/g, currentTabName)
                    .replace(/\{\{TabName\}\}/g, parentTabName || currentTabName)
                    .replace(/\{\{JobCode\}\}/g, "077")
                    .replace(/\{\{Category\}\}/g, currentTabName)
                    .replace(/\{\{CompanyGroup\}\}/g, "Tekna Group")
                    .replace(/\{\{CompanyCode\}\}/g, "TH")
                    .replace(/\{\{ContactName\}\}/g, "Robert Harder");

                  const fullPath = `${basePath}/${folderPath}`;
                  return (
                    <div className="text-xs bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded px-2 py-1.5 font-mono" title={fullPath}>
                      <span className="text-green-600 dark:text-green-400 font-medium">Full Path: </span>
                      <span className="text-green-700 dark:text-green-300">{fullPath}</span>
                    </div>
                  );
                })()}
              </div>
            )}

            </div>

            {/* Column 4: Linked Document Types */}
            <div className="space-y-4 overflow-y-auto">
              <h3 className="text-sm font-medium text-muted-foreground border-b pb-2 sticky top-0 bg-background">Document Types</h3>

              {/* Document Types (SSoT: Link document types to this tab) */}
              {(editingTab?.tab_group === 'documents' || formData.tab_group === 'documents') ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Linked Types</Label>
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
                      New
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Select document types for this tab
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
                    placeholder="Search types..."
                    hidePlaceholderWhenSelected={false}
                    emptyIndicator={
                      <p className="text-center text-sm text-muted-foreground">
                        No document types found
                      </p>
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    {(formData.document_type_ids || []).length} linked
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
              ) : (
                <p className="text-xs text-muted-foreground">
                  Only available for document tabs
                </p>
              )}
            </div>
          </div>
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
              {saving && <Spinner size={16} className="mr-2" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* SSoT: Folder Rename Notification Dialog */}
      <Dialog
        open={folderRenameDialog?.open || false}
        onOpenChange={(open) => !open && setFolderRenameDialog(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>SharePoint Folder Rename Queued</DialogTitle>
            <DialogDescription className="space-y-3 pt-2">
              <p>
                The tab name was changed from{" "}
                <span className="font-semibold text-foreground">
                  &quot;{folderRenameDialog?.oldName}&quot;
                </span>{" "}
                to{" "}
                <span className="font-semibold text-foreground">
                  &quot;{folderRenameDialog?.newName}&quot;
                </span>.
              </p>
              <p className="text-sm">
                A background job has been queued to rename the corresponding SharePoint folder.
                This will update the folder name across all linked entities.
              </p>
              <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded px-3 py-2">
                <FolderOpen className="h-4 w-4" />
                <span>Folder rename typically completes within a few seconds.</span>
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="default"
              onClick={() => setFolderRenameDialog(null)}
            >
              Got it
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Saving indicator */}
      {saving && (
        <div className="fixed bottom-4 right-4 bg-background border rounded-lg shadow-lg px-4 py-2 flex items-center gap-2 z-50">
          <Spinner size={16} />
          <span className="text-sm">Saving...</span>
        </div>
      )}

      {/* Plan Configuration Sheet (SSoT: Plans config integrated from separate tab) */}
      <Sheet open={!!configTab} onOpenChange={() => setConfigTab(null, undefined)}>
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
