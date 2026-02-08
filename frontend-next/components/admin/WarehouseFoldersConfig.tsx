"use client";

import * as React from "react";
import { toast } from "sonner";
import { resolveWithExamples, resolveStoragePath, STORAGE_PLACEHOLDERS } from "@/lib/placeholders";
import { PlaceholderBuilder } from "@/components/ui/placeholders";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
  FolderOpen,
  FileText,
  Settings2,
  CornerDownRight,
  AlertCircle,
  Pencil,
  Check,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { useWarehouseFolders } from "@/lib/hooks/useWarehouseFolders";
// useUrlState removed - doesn't work reliably with catch-all routes
import { SharePointFolderBrowser } from "@/components/ui/sharepoint-folder-browser";
import { Spinner } from "@/components/ui/spinner";
import type {
  WarehouseFolder,
  WarehouseFolderScope,
  TabGroup,
  TabDisplayMode,
  WarehouseFolderCreateParams,
  WarehouseFolderUpdateParams,
  ReorderTabParams,
} from "@/lib/types/warehouse-folders";
import { SCOPE_LABELS, GROUP_LABELS } from "@/lib/types/warehouse-folders";
import { TAB_TYPE_CONFIG, TAB_TYPE_VALUES, deriveTabType, type TabType } from "@/lib/constants/tab-types";
import { TabTypeBadge, TabTypeBadgeCompact } from "@/components/ui/tab-type-badge";
import { ExpandChevron } from "@/components/ui/expand-chevron";
import { useAuth } from "@/contexts/AuthContext";

// SSoT: Warehouse Sub-Scope Configuration
// All warehouse sub-scopes defined once, used for both initialization and rendering
export interface WarehouseScopeConfig {
  id: string;
  label: string;
  color: string;
  defaultTemplate: string;
  previewReplacements: Record<string, string>;
}

export const WAREHOUSE_SCOPE_CONFIGS: WarehouseScopeConfig[] = [
  { id: 'primary', label: 'Warehousing', color: 'blue', defaultTemplate: '{{Category}}', previewReplacements: { '{{Category}}': 'General' } },
  { id: 'bill_inbox', label: 'Bill Inbox', color: 'orange', defaultTemplate: '{{TabName}}', previewReplacements: { '{{TabName}}': 'Invoices' } },
  { id: 'pricebook_photos', label: 'Pricebook Photos', color: 'purple', defaultTemplate: '{{TabName}}', previewReplacements: { '{{TabName}}': 'Products' } },
  { id: 'chat', label: 'Chat', color: 'green', defaultTemplate: '{{UserCode}}', previewReplacements: { '{{UserCode}}': 'RH' } },
  { id: 'templates', label: 'Templates', color: 'cyan', defaultTemplate: '{{TabName}}', previewReplacements: { '{{TabName}}': 'Contracts' } },
  { id: 'custom', label: 'Custom', color: 'gray', defaultTemplate: '{{Category}}', previewReplacements: { '{{Category}}': 'Misc' } },
  { id: 'pdf', label: 'PDF Documents', color: 'red', defaultTemplate: '{{TabName}}', previewReplacements: { '{{TabName}}': 'Reports' } },
  { id: 'word', label: 'Word Documents', color: 'blue', defaultTemplate: '{{TabName}}', previewReplacements: { '{{TabName}}': 'Documents' } },
  { id: 'excel', label: 'Excel Documents', color: 'green', defaultTemplate: '{{TabName}}', previewReplacements: { '{{TabName}}': 'Spreadsheets' } },
  { id: 'notes', label: 'Notes', color: 'yellow', defaultTemplate: '{{TabName}}', previewReplacements: { '{{TabName}}': 'Notes' } },
  { id: 'powerpoint', label: 'PowerPoint Documents', color: 'orange', defaultTemplate: '{{TabName}}', previewReplacements: { '{{TabName}}': 'Presentations' } },
  { id: 'bank_statements', label: 'Bank Statements', color: 'emerald', defaultTemplate: '{{TabName}}', previewReplacements: { '{{TabName}}': 'Statements' } },
  { id: 'contracts', label: 'Contracts', color: 'indigo', defaultTemplate: '{{TabName}}', previewReplacements: { '{{TabName}}': 'Agreements' } },
];

// Color classes for warehouse scope badges (Tailwind colors)
const WAREHOUSE_SCOPE_COLORS: Record<string, { bg: string; text: string }> = {
  blue: { bg: 'bg-blue-100 dark:bg-blue-900', text: 'text-blue-700 dark:text-blue-300' },
  orange: { bg: 'bg-orange-100 dark:bg-orange-900', text: 'text-orange-700 dark:text-orange-300' },
  purple: { bg: 'bg-purple-100 dark:bg-purple-900', text: 'text-purple-700 dark:text-purple-300' },
  green: { bg: 'bg-green-100 dark:bg-green-900', text: 'text-green-700 dark:text-green-300' },
  cyan: { bg: 'bg-cyan-100 dark:bg-cyan-900', text: 'text-cyan-700 dark:text-cyan-300' },
  gray: { bg: 'bg-gray-100 dark:bg-gray-800', text: 'text-gray-700 dark:text-gray-300' },
  red: { bg: 'bg-red-100 dark:bg-red-900', text: 'text-red-700 dark:text-red-300' },
  yellow: { bg: 'bg-yellow-100 dark:bg-yellow-900', text: 'text-yellow-700 dark:text-yellow-300' },
  emerald: { bg: 'bg-emerald-100 dark:bg-emerald-900', text: 'text-emerald-700 dark:text-emerald-300' },
  indigo: { bg: 'bg-indigo-100 dark:bg-indigo-900', text: 'text-indigo-700 dark:text-indigo-300' },
};

// Hook to fetch used icons for a scope
function useUsedIcons(scope: WarehouseFolderScope) {
  const [usedIcons, setUsedIcons] = React.useState<Array<{ id: number; icon_name: string; display_name: string }>>([]);
  const [loading, setLoading] = React.useState(false);

  const fetchUsedIcons = React.useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.get<{ success: boolean; data: Array<{ id: number; icon_name: string; display_name: string }> }>(
        `/api/v1/warehouse_folders/used_icons?scope=${scope}`
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
      const response = await api.get<{ success: boolean; data: string[] }>('/api/v1/warehouse_folders/entity_types');
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
      const response = await api.put<{ success: boolean; data: string[] }>('/api/v1/warehouse_folders/entity_types', {
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

interface WarehouseFoldersConfigProps {
  scope: WarehouseFolderScope;
  showEntityFilters?: boolean;      // Show entity type checkboxes (for corporate scope)
  showSharePointPaths?: boolean;    // Show SharePoint path config
  showDocumentTypes?: boolean;      // Show linked document types
  showTabGroups?: boolean;          // Show grouped by tab_group
  title?: string;                   // Override default title
  description?: string;             // Override default description
  compact?: boolean;                // Hide title/description for embedded use
  readOnly?: boolean;               // Hide add/edit/delete controls (managed via Warehouse Types)
}

export function WarehouseFoldersConfig({
  scope,
  showEntityFilters = false,
  showSharePointPaths = false,
  showDocumentTypes = false,
  showTabGroups = true,
  title,
  description,
  compact = false,
  readOnly = false,
}: WarehouseFoldersConfigProps) {
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
  } = useWarehouseFolders({ scope, includeDisabled: true });

  // Fetch entity types from API (SSoT)
  const {
    entityTypes,
    loading: entityTypesLoading,
    saving: entityTypesSaving,
    updateEntityTypes,
  } = useEntityTypes();

  // Auth context for guarding API calls
  const { isAuthenticated } = useAuth();

  // Fetch used icons for icon picker (SSoT: unique icons per root tab)
  const { usedIcons, refetch: refetchUsedIcons } = useUsedIcons(scope);

  // SSoT: Fetch storage configuration for scope folder paths
  const [storageConfig, setStorageConfig] = React.useState<{
    root_path?: string;
    warehouse_folders?: Record<string, string>;
    scope_templates?: Record<string, string>;
    download_name_templates?: Record<string, string>;  // Filename when downloading
  } | null>(null);

  React.useEffect(() => {
    const fetchStorageConfig = async () => {
      try {
        const response = await api.get<{
          success: boolean;
          data: {
            root_path?: string;
            warehouse_folders?: Record<string, string>;
            scope_templates?: Record<string, string>;
            download_name_templates?: Record<string, string>;
            file_name_templates?: Record<string, string>;  // Legacy backwards compat
          };
        }>("/api/v1/warehouse_provider");
        if (response?.success && response.data) {
          // Support both old and new field names
          setStorageConfig({
            ...response.data,
            download_name_templates: response.data.download_name_templates || response.data.file_name_templates,
          });
        }
      } catch (err) {
        console.error("Failed to fetch storage config:", err);
      }
    };
    fetchStorageConfig();
  }, []);

  // SSoT: Get base path for a scope from WarehouseProvider
  // warehouse_folders contains full template like "Jobs/{{JobCode}}/{{TabName}}"
  const getBasePath = React.useCallback((scopeKey: string): string => {
    const rootPath = storageConfig?.root_path || "";
    // SSoT: warehouse_folders is THE ONE source for scope root paths
    const scopePath = storageConfig?.warehouse_folders?.[scopeKey] || "";
    if (!scopePath) return rootPath || "";
    // Combine root and scope path, normalize slashes
    const fullPath = [rootPath, scopePath].filter(Boolean).join('/');
    return fullPath.replace(/\/+/g, '/').replace(/\/+$/, '');
  }, [storageConfig]);

  // SSoT: THE ONE function to get full storage path for a tab
  // Uses scope template from storageConfig.warehouse_folders
  const getTabFullPath = React.useCallback((tab: WarehouseFolder, defaultScope: string): string => {
    // Use the scope directly - warehouse_folders has templates like "Corporate/{{CompanyGroup}}/{{CompanyCode}}"
    const basePath = getBasePath(defaultScope);
    const folderPath = tab.folder_path || tab.display_name;
    // Combine and normalize: collapse multiple slashes, strip trailing
    const fullPath = [basePath, folderPath].filter(Boolean).join('/');
    return fullPath.replace(/\/+/g, '/').replace(/\/+$/, '');
  }, [getBasePath]);

  // SSoT: Get default folder path template for a scope
  // These match WarehouseProvider::SCOPE_TEMPLATES in the backend
  const getDefaultTemplate = React.useCallback((scopeKey: string): string => {
    const templates: Record<string, string> = {
      task: "{{TaskId}}/{{Category}}",
      job: "{{JobCode}}/{{TabName}}",
      corporate: "{{CompanyGroup}}/{{CompanyCode}}/{{TabName}}",
      people: "{{ContactName}}/{{TabName}}",
      contact: "{{ContactName}}/{{TabName}}",
      email: "{{Year}}/{{Month}}",
      warehouse: "{{TabName}}",
    };
    return templates[scopeKey] || "{{Name}}/{{Category}}";
  }, []);

  const [saving, setSaving] = React.useState(false);

  // Local state for dialog - URL state doesn't work reliably with catch-all routes
  const [activeGroup, setActiveGroup] = React.useState("overview");
  const [editingTabKey, setEditingTabKey] = React.useState<string | null>(null);
  const [dialogAction, setDialogAction] = React.useState<"edit" | "create" | null>(null);
  const [configPanelName, setConfigPanelName] = React.useState<string | null>(null);

  // Local state for expanded items
  const [expandedItems, setExpandedItemsState] = React.useState<Set<string>>(new Set());
  const [expandedDocTypes, setExpandedDocTypesState] = React.useState<Set<string>>(new Set());
  // Expanded warehouse sections (collapsed by default)
  const [expandedWarehouseSections, setExpandedWarehouseSections] = React.useState<Set<string>>(new Set());
  // Warehouse scope order (for drag-and-drop reordering)
  const [warehouseScopeOrder, setWarehouseScopeOrder] = React.useState<WarehouseScopeConfig[]>(WAREHOUSE_SCOPE_CONFIGS);

  // Derive values from local state
  const isDialogOpen = dialogAction === "create" || dialogAction === "edit";
  const isCreateMode = dialogAction === "create";

  // Look up editingTab from tabs array using local state
  const editingTab = React.useMemo(() => {
    if (!editingTabKey || dialogAction !== "edit") return null;
    // Search recursively through tabs and children by tab_key
    const findTab = (tabList: WarehouseFolder[]): WarehouseFolder | null => {
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
    return { ...plansTab, component_name: configPanelName } as WarehouseFolder & { component_name: string };
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
  const setEditingTab = React.useCallback((tab: WarehouseFolder | null) => {
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

  const setConfigTab = React.useCallback((tab: WarehouseFolder | null, componentName?: string) => {
    setConfigPanelName(componentName || null);
  }, []);

  const [deleteConfirmTab, setDeleteConfirmTab] = React.useState<WarehouseFolder | null>(null);
  const [showEntityTypesEditor, setShowEntityTypesEditor] = React.useState(false);
  const [newEntityType, setNewEntityType] = React.useState("");

  // SSoT: Editable folder path template for system scopes (task, email, warehouse)
  const [folderPathTemplate, setFolderPathTemplate] = React.useState<string>("");
  // SSoT: Separate template for email attachments (only used when scope === 'email')
  const [attachmentsPathTemplate, setAttachmentsPathTemplate] = React.useState<string>("");
  // SSoT: Warehouse sub-scope templates (only used when scope === 'warehouse')
  const [warehouseTemplates, setWarehouseTemplates] = React.useState<Record<string, string>>({});
  // SSoT: File name templates (how files are named when uploaded)
  const [fileNameTemplate, setFileNameTemplate] = React.useState<string>("{{OriginalFileName}}");
  const [attachmentsFileNameTemplate, setAttachmentsFileNameTemplate] = React.useState<string>("{{OriginalFileName}}");
  const [warehouseFileNameTemplates, setWarehouseFileNameTemplates] = React.useState<Record<string, string>>({});

  // SSoT: Auto-save templates when they change (debounced)
  // Track whether we've finished initial data load (to avoid saving on mount)
  const isInitialLoadRef = React.useRef(true);

  // Initialize folder path template when scope or storageConfig changes
  React.useEffect(() => {
    if (showSharePointPaths && storageConfig) {
      // Mark as initial load so auto-save effect skips
      isInitialLoadRef.current = true;

      // Try to get from scope_templates in storageConfig, fallback to getDefaultTemplate
      // Use ?? to allow empty string (user intentionally cleared the template)
      const savedTemplate = storageConfig?.scope_templates?.[scope];
      setFolderPathTemplate(savedTemplate ?? getDefaultTemplate(scope));

      // Initialize download name template
      const savedDownloadNameTemplate = storageConfig?.download_name_templates?.[scope];
      setFileNameTemplate(savedDownloadNameTemplate ?? '{{OriginalFileName}}');

      // Initialize attachments template for email scope
      if (scope === 'email') {
        const savedAttachmentsTemplate = storageConfig?.scope_templates?.['email_attachments'];
        setAttachmentsPathTemplate(savedAttachmentsTemplate ?? getDefaultTemplate('email'));
        const savedAttachmentsDownloadName = storageConfig?.download_name_templates?.['email_attachments'];
        setAttachmentsFileNameTemplate(savedAttachmentsDownloadName ?? '{{OriginalFileName}}');
      }

      // Initialize warehouse sub-scope templates (SSoT: WAREHOUSE_SCOPE_CONFIGS)
      if (scope === 'warehouse') {
        const templates: Record<string, string> = {};
        const downloadNameTemplates: Record<string, string> = {};
        WAREHOUSE_SCOPE_CONFIGS.forEach(config => {
          // Skip 'primary' - it uses the main scope template
          if (config.id === 'primary') return;
          const saved = storageConfig?.scope_templates?.[config.id];
          // Use ?? to allow empty string (user intentionally cleared the template)
          templates[config.id] = saved ?? config.defaultTemplate;
          const savedDownloadName = storageConfig?.download_name_templates?.[config.id];
          downloadNameTemplates[config.id] = savedDownloadName ?? '{{OriginalFileName}}';
        });
        setWarehouseTemplates(templates);
        setWarehouseFileNameTemplates(downloadNameTemplates);
      }
    }
  }, [scope, storageConfig, showSharePointPaths, getDefaultTemplate]);
  const saveTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  const [saveStatus, setSaveStatus] = React.useState<'idle' | 'saving' | 'saved'>('idle');

  // Helper to render label with save indicator
  const labelWithStatus = (text: string) => (
    <span className="flex items-center gap-2">
      <span>{text}</span>
      {saveStatus === 'saving' && (
        <span className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400">
          <Loader2 className="h-3 w-3 animate-spin" />
          <span className="text-xs">saving...</span>
        </span>
      )}
      {saveStatus === 'saved' && (
        <span className="inline-flex items-center gap-1 text-green-600 dark:text-green-400">
          <Check className="h-3 w-3" />
          <span className="text-xs">saved</span>
        </span>
      )}
    </span>
  );

  // Save templates to API (debounced)
  const saveTemplates = React.useCallback(async () => {
    if (!showSharePointPaths) return;

    try {
      // Build scope_templates object
      // Always include templates even if empty (user may intentionally clear them)
      const scopeTemplates: Record<string, string> = {};
      const downloadNameTemplatesPayload: Record<string, string> = {};

      // Add main scope template (always save, even if empty)
      scopeTemplates[scope] = folderPathTemplate;
      if (fileNameTemplate !== '{{OriginalFileName}}') {
        downloadNameTemplatesPayload[scope] = fileNameTemplate;
      }

      // Add email attachments template
      if (scope === 'email') {
        scopeTemplates['email_attachments'] = attachmentsPathTemplate;
        if (attachmentsFileNameTemplate !== '{{OriginalFileName}}') {
          downloadNameTemplatesPayload['email_attachments'] = attachmentsFileNameTemplate;
        }
      }

      // Add warehouse sub-scope templates (always save, even if empty)
      if (scope === 'warehouse') {
        Object.entries(warehouseTemplates).forEach(([key, value]) => {
          scopeTemplates[key] = value;
        });
        Object.entries(warehouseFileNameTemplates).forEach(([key, value]) => {
          if (value !== '{{OriginalFileName}}') {
            downloadNameTemplatesPayload[key] = value;
          }
        });
      }

      console.log('[WarehouseFoldersConfig] Setting status to saving...');
      setSaveStatus('saving');
      await api.patch('/api/v1/warehouse_provider', {
        storage: {
          scope_templates: scopeTemplates,
          download_name_templates: downloadNameTemplatesPayload,
        }
      });

      // Show green tick - stays until page closes or next change
      console.log('[WarehouseFoldersConfig] Setting status to saved...');
      setSaveStatus('saved');
      console.log('[WarehouseFoldersConfig] Auto-saved templates');
    } catch (err) {
      console.error('[WarehouseFoldersConfig] Failed to auto-save templates:', err);
      setSaveStatus('idle');
    }
  }, [
    showSharePointPaths, scope, folderPathTemplate, fileNameTemplate,
    attachmentsPathTemplate, attachmentsFileNameTemplate,
    warehouseTemplates, warehouseFileNameTemplates
  ]);

  // Auto-save effect with debounce
  React.useEffect(() => {
    // Skip initial load
    if (isInitialLoadRef.current) {
      isInitialLoadRef.current = false;
      return;
    }

    // Skip if not showing path config
    if (!showSharePointPaths) return;

    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Debounce save by 1 second
    saveTimeoutRef.current = setTimeout(() => {
      saveTemplates();
    }, 1000);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [
    folderPathTemplate, fileNameTemplate,
    attachmentsPathTemplate, attachmentsFileNameTemplate,
    warehouseTemplates, warehouseFileNameTemplates,
    saveTemplates, showSharePointPaths
  ]);

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

  // Fetch all document types when authenticated
  React.useEffect(() => {
    if (!isAuthenticated) return;

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
  }, [isAuthenticated]);

  // Form state for create/edit
  const [formData, setFormData] = React.useState<Partial<WarehouseFolderCreateParams & { warehouse_type_override?: 'corporate' | 'contacts'; display_mode?: TabDisplayMode; hidden_by_default?: boolean }>>({});

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
    const grouped: Record<string, WarehouseFolder[]> = {};
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

  // Count breakdown: roots, children (depth 1), grandchildren (depth 2+)
  const countBreakdown = React.useCallback((rootTabs: WarehouseFolder[]): { roots: number; children: number; grandchildren: number; total: number } => {
    let children = 0;
    let grandchildren = 0;
    const countDeep = (tabs: WarehouseFolder[], depth: number) => {
      for (const tab of tabs) {
        if (tab.children?.length) {
          for (const child of tab.children) {
            if (depth === 0) children++;
            else grandchildren++;
            countDeep([child], depth + 1);
          }
        }
      }
    };
    countDeep(rootTabs, 0);
    const roots = rootTabs.length;
    return { roots, children, grandchildren, total: roots + children + grandchildren };
  }, []);

  // Helper to collect all descendant tab_keys recursively
  const collectDescendantKeys = React.useCallback((tab: WarehouseFolder): string[] => {
    const keys: string[] = [];
    if (tab.children?.length) {
      for (const child of tab.children) {
        keys.push(child.tab_key);
        keys.push(...collectDescendantKeys(child));
      }
    }
    return keys;
  }, []);

  // Helper to find a tab by tab_key in the tree
  const findTabByKey = React.useCallback((tabKey: string, tabList: WarehouseFolder[] = tabs): WarehouseFolder | null => {
    for (const tab of tabList) {
      if (tab.tab_key === tabKey) return tab;
      if (tab.children?.length) {
        const found = findTabByKey(tabKey, tab.children);
        if (found) return found;
      }
    }
    return null;
  }, [tabs]);

  // Toggle item expansion - uses tab_key (slug) instead of numeric ID
  // When collapsing, also collapse all descendants recursively
  const toggleExpanded = (tabKey: string) => {
    setExpandedItems((prev) => {
      const next = new Set(prev);
      if (next.has(tabKey)) {
        // Collapsing - remove this item AND all descendants
        next.delete(tabKey);
        const tab = findTabByKey(tabKey);
        if (tab) {
          const descendantKeys = collectDescendantKeys(tab);
          for (const key of descendantKeys) {
            next.delete(key);
          }
        }
      } else {
        next.add(tabKey);
      }
      return next;
    });
  };

  // Toggle warehouse section expansion (for Bill Inbox, Pricebook Photos, etc.)
  const toggleWarehouseSection = (sectionKey: string) => {
    setExpandedWarehouseSections((prev) => {
      const next = new Set(prev);
      if (next.has(sectionKey)) {
        next.delete(sectionKey);
      } else {
        next.add(sectionKey);
      }
      return next;
    });
  };

  // Handle warehouse scope reorder (drag-and-drop)
  const handleWarehouseScopeReorder = (newOrder: WarehouseScopeConfig[]) => {
    setWarehouseScopeOrder(newOrder);
    // Note: Order could be persisted to backend in future if needed
  };

  // Helper to get template value for a warehouse scope
  const getWarehouseScopeTemplate = (scopeId: string): string => {
    if (scopeId === 'primary') {
      return folderPathTemplate ?? getDefaultTemplate(scope);
    }
    const config = WAREHOUSE_SCOPE_CONFIGS.find(c => c.id === scopeId);
    return warehouseTemplates[scopeId] ?? config?.defaultTemplate ?? '{{TabName}}';
  };

  // Helper to set template value for a warehouse scope
  const setWarehouseScopeTemplate = (scopeId: string, value: string) => {
    if (scopeId === 'primary') {
      setFolderPathTemplate(value);
    } else {
      setWarehouseTemplates(prev => ({ ...prev, [scopeId]: value }));
    }
  };

  // Helper to get file name template for a warehouse scope
  const getWarehouseScopeFileNameTemplate = (scopeId: string): string => {
    if (scopeId === 'primary') {
      return fileNameTemplate;
    }
    return warehouseFileNameTemplates[scopeId] ?? '{{OriginalFileName}}';
  };

  // Helper to set file name template for a warehouse scope
  const setWarehouseScopeFileNameTemplate = (scopeId: string, value: string) => {
    if (scopeId === 'primary') {
      setFileNameTemplate(value);
    } else {
      setWarehouseFileNameTemplates(prev => ({ ...prev, [scopeId]: value }));
    }
  };

  // Handle drag-and-drop reorder
  const handleReorder = async (newItems: WarehouseFolder[], group?: TabGroup) => {
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
  const handleToggleEnabled = async (tab: WarehouseFolder) => {
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
  const handleDelete = async (tab: WarehouseFolder) => {
    if (!tab.can_delete) {
      return;
    }
    setSaving(true);
    try {
      await deleteTab(tab.id);
      setDeleteConfirmTab(null);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Failed to delete tab";
      toast.error(errorMessage);
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
      tab_type: 'document' as TabType,  // SSoT: Default tab type
      tab_group: group || 'documents',  // Default to documents (most common use case)
      entity_filters: [],
      enabled: true,
      warehouse_enabled: true,
      folder_path: "",
      warehouse_type_override: 'corporate',  // SSoT: Default to corporate path
      display_mode: 'both',  // SSoT: Default display mode
      hidden_by_default: false,  // SSoT: Default visibility
    });
    openCreateMode();
  };

  // Open edit dialog - always opens the edit dialog for tab settings
  // (Special config sheets are accessed via dedicated buttons, not the edit action)
  const openEditDialog = (tab: WarehouseFolder) => {
    // Note: Both {{TabName}} (parent) and {{SubTabName}} (current) are valid for subtabs
    // FRC (Feb 2026): Use folder_segment (tab's own piece), NOT folder_path (full path including base)
    // folder_path = full_folder_path from backend = "Contacts/{{ContactName}}/Financial/Bills"
    // folder_segment = just "Bills" (what the user actually edits)
    // Using full path caused: 1) duplicate base path in preview, 2) corrupted folder_path_suffix on save
    const folderPath = (tab as any).folder_segment || tab.folder_path || "";

    // SSoT: Store original display_name for folder rename detection
    setOriginalDisplayName(tab.display_name);

    setFormData({
      display_name: tab.display_name,
      display_code: tab.display_code || "",
      description: tab.description || "",
      tab_type: deriveTabType(tab),  // SSoT: THE ONE field for folder behavior
      tab_group: tab.tab_group || undefined,
      parent_id: tab.parent_id || undefined,
      entity_filters: tab.entity_filters,
      enabled: tab.enabled,
      icon_name: tab.icon_name || "",
      warehouse_enabled: tab.warehouse_enabled,
      folder_path: folderPath,
      uses_custom_path: tab.uses_custom_path || false,  // SSoT: Template inheritance flag
      warehouse_type_override: tab.warehouse_type_override || 'corporate',  // SSoT: Path type for contacts
      // SSoT: Include linked document type IDs
      document_type_ids: tab.document_types?.map((dt: any) => dt.id) || [],
      display_mode: tab.display_mode || 'both',  // SSoT: Display mode
      hidden_by_default: tab.hidden_by_default || false,  // SSoT: Hidden by default
      is_system: tab.is_system || false,  // SSoT: System lock
    });
    // setEditingTab updates URL with tabId and action=edit
    setEditingTab(tab);
  };

  // Get available parent tabs (any tab that can be a parent, including nested tabs)
  // SSoT: Filter out self, descendants (circular ref), and tabs with duplicate tab_key children
  const availableParents = React.useMemo(() => {
    if (!editingTab) return [];

    // Flatten the tree: tabs only contains root-level items, children are nested
    const flattenTabs = (tabList: WarehouseFolder[]): WarehouseFolder[] => {
      const result: WarehouseFolder[] = [];
      const walk = (items: WarehouseFolder[]) => {
        items.forEach(t => {
          result.push(t);
          if (t.children?.length) walk(t.children);
        });
      };
      walk(tabList);
      return result;
    };
    const allTabs = flattenTabs(tabs);

    // Collect all descendant IDs of the editing tab to prevent circular references
    const getDescendantIds = (tab: WarehouseFolder): Set<number> => {
      const ids = new Set<number>();
      (tab.children || []).forEach(child => {
        ids.add(child.id);
        getDescendantIds(child).forEach(id => ids.add(id));
      });
      return ids;
    };
    const descendantIds = getDescendantIds(editingTab);

    return allTabs.filter((t) => {
      // Can't be the tab we're editing
      if (t.id === editingTab.id) return false;
      // Can't be a descendant of the editing tab (would create circular reference)
      if (descendantIds.has(t.id)) return false;
      // Can't have a child with the same tab_key (would cause duplicate key conflict)
      // Exclude the tab being edited from this check (it's already a child of this parent)
      const hasChildWithSameKey = t.children?.some(child => child.tab_key === editingTab.tab_key && child.id !== editingTab.id);
      if (hasChildWithSameKey) return false;

      return true;
    });
  }, [tabs, editingTab]);

  // Lookup map for all tabs (including children) - used for parent label display
  const allTabsById = React.useMemo(() => {
    const map = new Map<number, WarehouseFolder>();
    const walk = (items: WarehouseFolder[]) => {
      items.forEach(t => {
        map.set(t.id, t);
        if (t.children?.length) walk(t.children);
      });
    };
    walk(tabs);
    return map;
  }, [tabs]);

  // SSoT: Check if moving to root level would conflict with existing root tab
  const canMoveToRoot = React.useMemo(() => {
    if (!editingTab) return true;
    // If already a root tab, can stay root
    if (!editingTab.parent_id) return true;
    // Check if there's already a root tab with this tab_key
    const hasRootTabWithSameKey = tabs.some(t => !t.parent_id && t.tab_key === editingTab.tab_key);
    return !hasRootTabWithSameKey;
  }, [tabs, editingTab]);

  // Handle form submit
  const handleFormSubmit = async () => {
    setSaving(true);
    try {
      if (editingTab) {
        // SSoT: Detect display_name change for folder rename prompt
        const displayNameChanged = originalDisplayName && formData.display_name !== originalDisplayName;
        const hasWarehouseEnabled = editingTab.warehouse_enabled || formData.warehouse_enabled;

        // Update existing
        const updateParams: WarehouseFolderUpdateParams = {
          display_name: formData.display_name,
          display_code: formData.display_code,
          description: formData.description,
          tab_type: formData.tab_type,  // SSoT: THE ONE field for folder behavior (backend auto-derives tab_group)
          // Use null (not undefined) so JSON serialization includes it
          parent_id: formData.parent_id ?? null,
          entity_filters: formData.entity_filters,
          enabled: formData.enabled,
          icon_name: formData.icon_name,
          warehouse_enabled: formData.warehouse_enabled,
          folder_path: formData.folder_path,
          uses_custom_path: formData.uses_custom_path,  // SSoT: Template inheritance flag
          warehouse_type_override: formData.warehouse_type_override,  // SSoT: Path type for contacts
          // SSoT: Include linked document type IDs
          document_type_ids: formData.document_type_ids,
          display_mode: formData.display_mode,  // SSoT: Display mode
          hidden_by_default: formData.hidden_by_default,  // SSoT: Hidden by default
          is_system: formData.is_system,  // SSoT: System lock
        };
        await updateTab(editingTab.id, updateParams);
        // Refetch used icons after update (icon may have changed)
        refetchUsedIcons();

        // SSoT: Show folder rename confirmation if display_name changed and has SharePoint folder
        if (displayNameChanged && hasWarehouseEnabled) {
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
        const createParams: WarehouseFolderCreateParams = {
          scope,
          tab_key: formData.tab_key || formData.display_name?.toLowerCase().replace(/\s+/g, "-") || "",
          tab_type: formData.tab_type,  // SSoT: THE ONE field for folder behavior (backend auto-derives tab_group)
          display_name: formData.display_name || "",
          display_code: formData.display_code,
          description: formData.description,
          entity_filters: formData.entity_filters,
          enabled: formData.enabled ?? true,
          icon_name: formData.icon_name,
          warehouse_enabled: formData.warehouse_enabled,
          folder_path: formData.folder_path,
          warehouse_type_override: formData.warehouse_type_override,  // SSoT: Path type for contacts
          display_mode: formData.display_mode,  // SSoT: Display mode
          hidden_by_default: formData.hidden_by_default,  // SSoT: Hidden by default
          is_system: formData.is_system,  // SSoT: System lock
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
  const toggleEntityFilter = async (tab: WarehouseFolder, entityType: string) => {
    const currentFilters = tab.entity_filters || [];
    const newFilters = currentFilters.includes(entityType)
      ? currentFilters.filter((t) => t !== entityType)
      : [...currentFilters, entityType];

    try {
      // Update this tab
      await updateTab(tab.id, { entity_filters: newFilters });

      // Update all children recursively
      const updateChildren = async (children: WarehouseFolder[]) => {
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
  const findSiblings = (tab: WarehouseFolder): WarehouseFolder[] => {
    let siblings: WarehouseFolder[];

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
      const findParent = (items: WarehouseFolder[]): WarehouseFolder | null => {
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
  const handlePositionChange = async (tab: WarehouseFolder, newPosition: number, depth: number) => {
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
  const handleChildReorder = async (parentTab: WarehouseFolder, newChildren: WarehouseFolder[]) => {
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
  const renderTabWithChildren = (tab: WarehouseFolder, index: number, depth = 0): React.ReactNode => {
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
                  <TableHead className="text-left py-1.5 px-3 font-medium text-muted-foreground w-24">STATUS</TableHead>
                  <TableHead className="text-left py-1.5 px-3 font-medium text-muted-foreground">UI NAME</TableHead>
                  <TableHead className="text-left py-1.5 px-3 font-medium text-muted-foreground">DOWNLOAD NAME</TableHead>
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
                  const exampleFileName = applyReplacements(dt.download_name);
                  const exampleDisplayName = applyReplacements(dt.ui_name);

                  return (
                    <React.Fragment key={dt.id}>
                      {/* Template row */}
                      <TableRow
                        className="border-b hover:bg-muted/50"
                      >
                        <TableCell className="py-1.5 px-3 font-mono text-xs">{dt.abbreviation || '—'}</TableCell>
                        <TableCell className="py-1.5 px-3">
                          <button
                            onClick={() => window.open(`/admin/system/document-types/${dt.id}`, '_blank')}
                            className="text-left text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                            title="Click to edit document type"
                          >
                            {dt.name}
                          </button>
                        </TableCell>
                        <TableCell className="py-1.5 px-3">
                          {/* SSoT: is_primary flag indicates primary vs secondary link */}
                          {dt.is_primary ? (
                            <Badge variant="default" className="bg-green-600 hover:bg-green-600 text-white text-xs">
                              Primary
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="text-xs">
                              Secondary
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="py-1.5 px-3 text-muted-foreground text-xs font-mono break-all">{dt.ui_name || '—'}</TableCell>
                        <TableCell className="py-1.5 px-3 text-muted-foreground text-xs font-mono break-all">{dt.download_name || '—'}</TableCell>
                      </TableRow>
                      {/* Example row with resolved values */}
                      <TableRow
                        className="border-b last:border-0 hover:bg-muted/50 bg-green-50/50 dark:bg-green-900/10"
                      >
                        <TableCell className="py-1 px-3 text-xs text-green-600 dark:text-green-400">↳ eg.</TableCell>
                        <TableCell className="py-1 px-3 text-xs text-muted-foreground italic"></TableCell>
                        <TableCell className="py-1 px-3"></TableCell>
                        <TableCell className="py-1 px-3 text-xs text-green-700 dark:text-green-300 break-all">{exampleDisplayName}</TableCell>
                        <TableCell className="py-1 px-3 text-xs text-green-700 dark:text-green-300 break-all">{exampleFileName}</TableCell>
                      </TableRow>
                    </React.Fragment>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
        {/* Expanded children - use CSS hiding to preserve state */}
        {tab.children && tab.children.length > 0 && (
          <div className={cn(!expandedItems.has(tab.tab_key) && "hidden")}>
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
          </div>
        )}
      </React.Fragment>
    );
  };

  // Render a single tab item
  const renderTabItem = (tab: WarehouseFolder, index: number, isChild = false, depth = 0) => {
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
          tab.uses_custom_path && tab.warehouse_enabled && "bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800",
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

          {/* Tab type badge */}
          <TabTypeBadgeCompact tabType={deriveTabType(tab)} isSystem={tab.is_system} />

          {/* Name and badges */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className={cn("font-medium", !readOnly && "cursor-pointer hover:text-primary hover:underline")}
                onClick={readOnly ? undefined : () => openEditDialog(tab)}
                title={readOnly ? undefined : "Click to edit"}
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
              {/* SSoT: Show folder path badge if tab has folder OR has children (children inherit parent path) */}
              {(tab.warehouse_enabled || hasChildren) && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-xs gap-1 font-normal max-w-none",
                          tab.uses_custom_path
                            ? "bg-orange-50 border-orange-300 text-orange-700 dark:bg-orange-900/30 dark:border-orange-700 dark:text-orange-300"
                            : "bg-green-50 border-green-300 text-green-700 dark:bg-green-900/30 dark:border-green-700 dark:text-green-300"
                        )}
                      >
                        <FolderOpen className="h-3 w-3 shrink-0" />
                        <span className="break-all">{tab.effective_warehouse_path || tab.full_warehouse_path || getTabFullPath(tab, scope)}</span>
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="max-w-lg">
                      <p className="font-mono text-xs break-all">{tab.effective_warehouse_path || tab.full_warehouse_path || getTabFullPath(tab, scope)}</p>
                      <p className="text-muted-foreground mt-1">{tab.uses_custom_path ? "Custom path" : "Global template"}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
              {/* SSoT: Document naming indicators (green=custom, orange=default) */}
              {(tab.warehouse_enabled || hasChildren) && (
                <>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-xs gap-0.5 font-normal",
                            tab.ui_name
                              ? "bg-green-50 border-green-300 text-green-700 dark:bg-green-900/30 dark:border-green-700 dark:text-green-300"
                              : "bg-orange-50 border-orange-300 text-orange-700 dark:bg-orange-900/30 dark:border-orange-700 dark:text-orange-300"
                          )}
                        >
                          <span>UI</span>
                        </Badge>
                      </TooltipTrigger>
                      <TooltipContent side="bottom">
                        <p className="font-medium">Document UI Name</p>
                        <p className="font-mono text-xs mt-1">{tab.ui_name || "{{OriginalFileName}}"}</p>
                        <p className="text-muted-foreground mt-1 text-xs">{tab.ui_name ? "Custom template" : "Using default"}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-xs gap-0.5 font-normal",
                            tab.download_name
                              ? "bg-green-50 border-green-300 text-green-700 dark:bg-green-900/30 dark:border-green-700 dark:text-green-300"
                              : "bg-orange-50 border-orange-300 text-orange-700 dark:bg-orange-900/30 dark:border-orange-700 dark:text-orange-300"
                          )}
                        >
                          <span>DL</span>
                        </Badge>
                      </TooltipTrigger>
                      <TooltipContent side="bottom">
                        <p className="font-medium">Document Download Name</p>
                        <p className="font-mono text-xs mt-1">{tab.download_name || "{{OriginalFileName}}"}</p>
                        <p className="text-muted-foreground mt-1 text-xs">{tab.download_name ? "Custom template" : "Using default"}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </>
              )}
              {/* SSoT: Primary Xero badge for tabs with xero_scope */}
              {tab.xero_scope === "primary" && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Badge
                        variant="outline"
                        className="text-xs gap-1 bg-purple-50 border-purple-300 text-purple-700 dark:bg-purple-900/30 dark:border-purple-700 dark:text-purple-300"
                      >
                        <span className="font-normal">Primary Xero:</span>
                        <span className="font-medium">{tab.xero_account_name || "Not configured"}</span>
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">
                      <p>Documents stored from the Primary Xero account</p>
                      <p className="text-muted-foreground mt-1">Configure at Settings → Company → Info</p>
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
            {/* Entity filters (for corporate scope) - clickable toggles, only on root items */}
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

          {/* SSoT: Visibility rule - prominent centered box */}
          {tab.visibility_rule && (
            <div className="hidden md:flex items-center justify-center px-3">
              <div
                className={cn(
                  "px-3 py-1 rounded-md text-xs font-medium border",
                  tab.visibility_rule === "Always visible" || tab.visibility_rule?.startsWith("Always visible")
                    ? "bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-900/30 dark:border-blue-700 dark:text-blue-300"
                    : "bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-900/30 dark:border-amber-700 dark:text-amber-300"
                )}
              >
                {tab.visibility_rule}
              </div>
            </div>
          )}

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

            {/* Edit button - hidden in readOnly mode (managed via Warehouse Types) */}
            {!readOnly && (
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
            )}

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

            {/* Delete button (only for non-system tabs with no documents) - hidden in readOnly mode */}
            {!readOnly && !tab.is_system && (
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
  const renderTabGroup = (group: TabGroup, tabsInGroup: WarehouseFolder[]) => {
    return (
      <Card key={group}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CardTitle className="text-base">{GROUP_LABELS[group]}</CardTitle>
              {(() => {
                const b = countBreakdown(tabsInGroup);
                return (
                  <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Badge variant="secondary" className="text-xs">{b.total}</Badge>
                    {(b.children > 0 || b.grandchildren > 0) && (
                      <span className="opacity-70">
                        {b.roots}{b.children > 0 && ` + ${b.children}`}{b.grandchildren > 0 && ` + ${b.grandchildren}`}
                      </span>
                    )}
                  </span>
                );
              })()}
            </div>
            {!readOnly && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => openCreateDialog(group)}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Tab
              </Button>
            )}
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
  // Hidden in readOnly mode (folder management done via Warehouse Types)
  const actionButtons = readOnly ? null : (
    <div className="flex items-center gap-2">
      {scope === "corporate" && (
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

      {/* Entity Types Editor (SSoT) - Only for corporate scope */}
      {scope === "corporate" && showEntityTypesEditor && (
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
                  {(() => {
                    const b = countBreakdown(groupedTabs[group] || []);
                    return (
                      <span className="flex items-center gap-1 text-xs">
                        <Badge variant="secondary" className="text-xs">{b.total}</Badge>
                        {(b.children > 0 || b.grandchildren > 0) && (
                          <span className="text-[10px] opacity-60">
                            {b.roots}{b.children > 0 && `+${b.children}`}{b.grandchildren > 0 && `+${b.grandchildren}`}
                          </span>
                        )}
                      </span>
                    );
                  })()}
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
                {(() => {
                  const b = countBreakdown(flatTabs);
                  return (
                    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Badge variant="secondary">{b.total}</Badge>
                      <span className="opacity-70">
                        {b.roots} root{b.children > 0 && <> + {b.children} child</>}{b.grandchildren > 0 && <> + {b.grandchildren} grandchild</>}
                      </span>
                    </span>
                  );
                })()}
              </div>
              {compact && actionButtons}
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            {/* SSoT: Storage Configuration for system scopes (task, email, warehouse) - always visible */}
            {showSharePointPaths && (
              <div className="space-y-6 mb-6">
                {/* Primary scope configuration (EML Files for email, Warehousing for warehouse, etc.) */}
                <div>
                  <button
                    type="button"
                    onClick={() => toggleWarehouseSection('primary')}
                    className="w-full flex items-center justify-between text-sm font-medium hover:bg-muted/50 rounded px-2 py-1.5 -mx-2 transition-colors"
                  >
                    <span className="flex items-center gap-2">
                      <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 text-xs font-bold">1</span>
                      {scope === 'email' ? 'EML Files' : scope === 'warehouse' ? 'Warehousing' : scope === 'task' ? 'Tasks' : 'Primary'}
                    </span>
                    {expandedWarehouseSections.has('primary') ? (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    )}
                  </button>
                  <div className={cn(!expandedWarehouseSections.has('primary') && "hidden", "space-y-3 mt-3")}>
                      {/* Base path from WarehouseProvider (read-only) */}
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Base Path (from Admin → System → Storage Config)</Label>
                        <div className="flex items-center gap-1 p-2 border rounded bg-muted/30">
                          <span className="inline-flex items-center font-mono text-xs px-2 py-1 rounded-none border bg-muted dark:bg-slate-800 text-foreground dark:text-muted-foreground border-border dark:border-border">
                            {getBasePath(scope)}
                          </span>
                          <span className="text-muted-foreground">/</span>
                        </div>
                      </div>

                      {/* Folder Path template with token builder - drag and drop enabled */}
                      {/* SSoT: inherited_template from API (computed from storage_path_type) takes precedence */}
                      <PlaceholderBuilder
                        label={labelWithStatus("Folder Path")}
                        value={folderPathTemplate || editingTab?.inherited_template || getDefaultTemplate(scope)}
                        onChange={setFolderPathTemplate}
                        scope="storage"
                        placeholders={STORAGE_PLACEHOLDERS}
                        showPreview={true}
                        placeholder="Click tokens below to add..."
                        disabled={false}
                        defaultExpanded={true}
                        separator="/"
                      />

                      {/* Full path preview */}
                      {(() => {
                        const basePath = getBasePath(scope);
                        // SSoT: Use effective template priority:
                        // 1. Local state (user editing)
                        // 2. inherited_template from API (computed from storage_path_type)
                        // 3. getDefaultTemplate (hardcoded fallback)
                        const effectiveTemplate = folderPathTemplate || editingTab?.inherited_template || getDefaultTemplate(scope);
                        // Replace tokens with example values
                        const resolvedPath = effectiveTemplate
                          ? `/${effectiveTemplate
                              .replace(/\{\{TaskId\}\}/g, "T-001")
                              .replace(/\{\{Category\}\}/g, "Responses")
                              .replace(/\{\{TabName\}\}/g, editingTab?.display_name || "Documents")
                              .replace(/\{\{Year\}\}/g, "2025")
                              .replace(/\{\{Month\}\}/g, "01")
                              .replace(/\{\{UserCode\}\}/g, "RH")
                              .replace(/\{\{UserName\}\}/g, "Robert Harder")
                              .replace(/\{\{JobCode\}\}/g, "J069")
                              .replace(/\{\{CompanyGroup\}\}/g, "Teeem Group")
                              .replace(/\{\{CompanyCode\}\}/g, "TH")
                              .replace(/\{\{ContactName\}\}/g, "John Smith")}`
                          : '';
                        const fullPath = `${basePath}${resolvedPath}`;
                        return (
                          <div className="text-xs bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded px-2 py-1.5 font-mono" title={fullPath}>
                            <span className="text-green-600 dark:text-green-400 font-medium">Full Path: </span>
                            <span className="text-green-700 dark:text-green-300">{fullPath}</span>
                          </div>
                        );
                      })()}

                      {/* Document Download Name template */}
                      <PlaceholderBuilder
                        label={labelWithStatus("Document Download Name")}
                        value={fileNameTemplate}
                        onChange={setFileNameTemplate}
                        scope="storage"
                        placeholders={STORAGE_PLACEHOLDERS}
                        showPreview={true}
                        placeholder="Click tokens below to add..."
                        disabled={false}
                        defaultExpanded={false}
                      />
                      <div className="text-xs bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded px-2 py-1.5 font-mono">
                        <span className="text-blue-600 dark:text-blue-400 font-medium">Example: </span>
                        <span className="text-blue-700 dark:text-blue-300">
                          {fileNameTemplate
                            .replace(/\{\{OriginalFileName\}\}/g, "Invoice.pdf")
                            .replace(/\{\{Date\}\}/g, "2025-01-12")
                            .replace(/\{\{TaskId\}\}/g, "T-001")
                            .replace(/\{\{Year\}\}/g, "2025")
                            .replace(/\{\{Month\}\}/g, "01")
                            .replace(/\{\{UploadedBy\}\}/g, "RH")
                            .replace(/\{\{Sequence\}\}/g, "001")
                            .replace(/\{\{Category\}\}/g, "Documents")
                            .replace(/\{\{UserCode\}\}/g, "RH")
                              .replace(/\{\{UserName\}\}/g, "Robert Harder")
                            .replace(/\{\{JobCode\}\}/g, "J069")
                            .replace(/\{\{ContactName\}\}/g, "John Smith")}
                        </span>
                      </div>
                    </div>
                  </div>

                {/* Email Attachments Configuration (only for email scope) */}
                {scope === 'email' && (
                  <div className="pt-4 border-t">
                    <button
                      type="button"
                      onClick={() => toggleWarehouseSection('attachments')}
                      className="w-full flex items-center justify-between text-sm font-medium hover:bg-muted/50 rounded px-2 py-1.5 -mx-2 transition-colors"
                    >
                      <span className="flex items-center gap-2">
                        <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-orange-100 dark:bg-orange-900 text-orange-700 dark:text-orange-300 text-xs font-bold">2</span>
                        Attachments
                      </span>
                      {expandedWarehouseSections.has('attachments') ? (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      )}
                    </button>
                    <div className={cn(!expandedWarehouseSections.has('attachments') && "hidden", "space-y-3 mt-3")}>
                        {/* Base path for attachments */}
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Base Path (from Admin → System → Storage Config)</Label>
                          <div className="flex items-center gap-1 p-2 border rounded bg-muted/30">
                            <span className="inline-flex items-center font-mono text-xs px-2 py-1 rounded-none border bg-muted dark:bg-slate-800 text-foreground dark:text-muted-foreground border-border dark:border-border">
                              {getBasePath('email_attachments')}
                            </span>
                            <span className="text-muted-foreground">/</span>
                          </div>
                        </div>

                        {/* Attachments Folder Path template */}
                        <PlaceholderBuilder
                          label={labelWithStatus("Folder Path")}
                          value={attachmentsPathTemplate ?? getDefaultTemplate('email')}
                          onChange={setAttachmentsPathTemplate}
                          scope="storage"
                          placeholders={STORAGE_PLACEHOLDERS}
                          showPreview={true}
                          placeholder="Click tokens below to add..."
                          disabled={false}
                          defaultExpanded={false}
                        />

                        {/* Full path preview for attachments */}
                        {(() => {
                          const basePath = getBasePath('email_attachments');
                          // Replace tokens with example values only if template exists
                          const resolvedPath = attachmentsPathTemplate
                            ? `/${attachmentsPathTemplate
                                .replace(/\{\{Year\}\}/g, "2025")
                                .replace(/\{\{Month\}\}/g, "01")
                                .replace(/\{\{Category\}\}/g, "Attachments")
                                .replace(/\{\{UserCode\}\}/g, "RH")
                              .replace(/\{\{UserName\}\}/g, "Robert Harder")
                                .replace(/\{\{JobCode\}\}/g, "J069")
                                .replace(/\{\{ContactName\}\}/g, "John Smith")}`
                            : '';
                          const fullPath = `${basePath}${resolvedPath}`;
                          return (
                            <div className="text-xs bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded px-2 py-1.5 font-mono" title={fullPath}>
                              <span className="text-green-600 dark:text-green-400 font-medium">Full Path: </span>
                              <span className="text-green-700 dark:text-green-300">{fullPath}</span>
                            </div>
                          );
                        })()}

                        {/* Document Download Name template for attachments */}
                        <PlaceholderBuilder
                          label={labelWithStatus("Document Download Name")}
                          value={attachmentsFileNameTemplate}
                          onChange={setAttachmentsFileNameTemplate}
                          scope="storage"
                          placeholders={STORAGE_PLACEHOLDERS}
                          showPreview={true}
                          placeholder="Click tokens below to add..."
                          disabled={false}
                          defaultExpanded={false}
                        />
                        <div className="text-xs bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded px-2 py-1.5 font-mono">
                          <span className="text-blue-600 dark:text-blue-400 font-medium">Example: </span>
                          <span className="text-blue-700 dark:text-blue-300">
                            {attachmentsFileNameTemplate
                              .replace(/\{\{OriginalFileName\}\}/g, "Report.xlsx")
                              .replace(/\{\{Date\}\}/g, "2025-01-12")
                              .replace(/\{\{Year\}\}/g, "2025")
                              .replace(/\{\{Month\}\}/g, "01")
                              .replace(/\{\{UploadedBy\}\}/g, "RH")
                              .replace(/\{\{Sequence\}\}/g, "001")
                              .replace(/\{\{UserCode\}\}/g, "RH")
                              .replace(/\{\{UserName\}\}/g, "Robert Harder")
                              .replace(/\{\{JobCode\}\}/g, "J069")
                              .replace(/\{\{ContactName\}\}/g, "John Smith")}
                          </span>
                        </div>
                    </div>
                  </div>
                )}

                {/* Warehouse Sub-Scopes Configuration (only for warehouse scope) - uses SortableList for drag-and-drop */}
                {scope === 'warehouse' && (
                  <SortableList
                    items={warehouseScopeOrder.filter(c => c.id !== 'primary')}
                    onReorder={handleWarehouseScopeReorder}
                    className="space-y-2"
                  >
                    {warehouseScopeOrder.filter(c => c.id !== 'primary').map((config, index) => {
                      const colorClasses = WAREHOUSE_SCOPE_COLORS[config.color] || WAREHOUSE_SCOPE_COLORS.gray;
                      const isExpanded = expandedWarehouseSections.has(config.id);
                      const template = getWarehouseScopeTemplate(config.id);
                      const fileNameTpl = getWarehouseScopeFileNameTemplate(config.id);
                      const basePath = getBasePath(config.id);

                      // Build preview path with replacements
                      let previewPath = template;
                      Object.entries(config.previewReplacements).forEach(([key, value]) => {
                        previewPath = previewPath.replace(new RegExp(key.replace(/[{}]/g, '\\$&'), 'g'), value);
                      });

                      return (
                        <SortableItem
                          key={config.id}
                          id={config.id}
                          position={index + 2}
                          badgeColor={config.color as any}
                          variant="card"
                          className="border rounded"
                        >
                          <div className="flex-1">
                            <button
                              type="button"
                              onClick={() => toggleWarehouseSection(config.id)}
                              className="w-full flex items-center justify-between py-1"
                            >
                              <span className="text-sm font-medium">{config.label}</span>
                              <ExpandChevron expanded={isExpanded} size={16} />
                            </button>

                            {isExpanded && (
                              <div className="space-y-3 mt-3 pt-3 border-t">
                                {/* Base Path */}
                                <div className="space-y-1">
                                  <Label className="text-xs text-muted-foreground">Base Path</Label>
                                  <div className="flex items-center gap-1 p-2 border rounded bg-muted/30">
                                    <span className="inline-flex items-center font-mono text-xs px-2 py-1 rounded-none border bg-muted dark:bg-slate-800 text-foreground dark:text-muted-foreground border-border dark:border-border">
                                      {basePath}
                                    </span>
                                    <span className="text-muted-foreground">/</span>
                                  </div>
                                </div>

                                {/* Folder Path Template */}
                                <PlaceholderBuilder
                                  label={labelWithStatus("Folder Path")}
                                  value={template}
                                  onChange={(val) => setWarehouseScopeTemplate(config.id, val)}
                                  scope="storage"
                                  placeholders={STORAGE_PLACEHOLDERS}
                                  showPreview={true}
                                  placeholder="Click tokens below to add..."
                                  disabled={false}
                                  defaultExpanded={false}
                                  separator="/"
                                />

                                {/* Full Path Preview */}
                                <div className="text-xs bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded px-2 py-1.5 font-mono">
                                  <span className="text-green-600 dark:text-green-400 font-medium">Full Path: </span>
                                  <span className="text-green-700 dark:text-green-300">{basePath}{template ? `/${previewPath}` : ''}</span>
                                </div>

                                {/* Document Download Name Template */}
                                <PlaceholderBuilder
                                  label={labelWithStatus("Document Download Name")}
                                  value={fileNameTpl}
                                  onChange={(val) => setWarehouseScopeFileNameTemplate(config.id, val)}
                                  scope="storage"
                                  placeholders={STORAGE_PLACEHOLDERS}
                                  showPreview={true}
                                  disabled={false}
                                  defaultExpanded={false}
                                />
                              </div>
                            )}
                          </div>
                        </SortableItem>
                      );
                    })}
                  </SortableList>
                )}
              </div>
            )}

            {/* Tabs list */}
            {flatTabs.length > 0 ? (
              <SortableList items={flatTabs} onReorder={handleReorder}>
                <div className="space-y-1">
                  {flatTabs.map((tab, index) => renderTabWithChildren(tab, index))}
                </div>
              </SortableList>
            ) : !showSharePointPaths && (
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
              {/* SSoT: Tab type badge */}
              {editingTab && (
                <TabTypeBadge tabType={formData.tab_type || deriveTabType(editingTab)} isSystem={editingTab.is_system} />
              )}
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
                      <SelectItem value="none" disabled={!canMoveToRoot}>
                        No parent (root level){!canMoveToRoot && " - tab key already exists at root"}
                      </SelectItem>
                      {availableParents.map((parent) => {
                        // Show hierarchy for nested tabs (e.g., "Financial > XERO Organisational Level")
                        const parentOfParent = parent.parent_id ? allTabsById.get(parent.parent_id) : null;
                        const label = parentOfParent
                          ? `${parentOfParent.display_name} > ${parent.display_name}`
                          : parent.display_name;
                        return (
                          <SelectItem key={parent.id} value={parent.id.toString()}>
                            {label}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Entity Filters (for corporate scope) */}
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


              {/* SSoT: Tab Type selector - THE ONE field for folder behavior */}
              <div className="space-y-2 pt-4 mt-4 border-t">
                <Label>Tab Type</Label>
                <div className="grid grid-cols-1 gap-1.5">
                  {TAB_TYPE_VALUES.map((type) => {
                    const config = TAB_TYPE_CONFIG[type];
                    const isSelected = formData.tab_type === type;
                    return (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setFormData((prev) => ({ ...prev, tab_type: type as TabType }))}
                        disabled={editingTab?.is_system && type !== formData.tab_type}
                        className={cn(
                          "flex items-center gap-2 px-3 py-2 rounded-md border text-left transition-colors",
                          isSelected
                            ? `${config.color} ${config.darkColor} ${config.textColor} border-current`
                            : "border-border hover:bg-muted/50",
                          editingTab?.is_system && type !== formData.tab_type && "opacity-40 cursor-not-allowed"
                        )}
                      >
                        <TabTypeBadge tabType={type} variant="icon" showTooltip={false} />
                        <div className="flex-1 min-w-0">
                          <span className="text-sm font-medium">{config.label}</span>
                          <p className="text-xs text-muted-foreground">{config.description}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
                {editingTab?.is_system && (
                  <p className="text-xs text-muted-foreground">System tab - type cannot be changed</p>
                )}
              </div>
            </div>

            {/* Column 2: Storage Configuration */}
            <div className="space-y-4 overflow-y-auto">
              <h3 className="text-sm font-medium text-muted-foreground border-b pb-2">Storage Configuration</h3>

            {/* Storage Folder Path */}
            {showSharePointPaths && (
              <div className="space-y-3">
                {/* Base path from WarehouseProvider - SSoT for scope folders */}
                {/* SSoT: Sub-tabs inherit base path from parent - not editable */}
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">
                    Base Path
                    {(formData.parent_id || editingTab?.parent_id) && (
                      <span className="ml-1 text-blue-600 dark:text-blue-400">(inherited from parent)</span>
                    )}
                  </Label>
                  {(formData.parent_id || editingTab?.parent_id) ? (
                    // Sub-tabs: base path is ALWAYS from warehouse_types table (SSoT)
                    // SSoT (Feb 2026): getBasePath reads warehouse_types.folder_path_template directly
                    // Never use parent's folder_path - it can be corrupted
                    <div className="flex items-center gap-1 p-2 border rounded bg-muted/30">
                      <span className="inline-flex items-center font-mono text-xs px-2 py-1 rounded-none border bg-muted dark:bg-slate-800 text-foreground dark:text-muted-foreground border-border dark:border-border">
                        {getBasePath(scope)}
                      </span>
                      <span className="text-muted-foreground">/</span>
                    </div>
                  ) : scope === "contact" && formData.tab_type !== 'system' ? (
                    // Root contact DOCUMENT tabs: can choose between /Contacts/ or /Corporate/People/
                    // System tabs don't need this - they're structural, not document storage
                    <div className="flex items-center gap-1">
                      <Select
                        value={formData.warehouse_type_override === 'corporate' ? 'people' : 'contact'}
                        onValueChange={(value) =>
                          setFormData((prev) => ({
                            ...prev,
                            warehouse_type_override: value === 'people' ? 'corporate' : 'contacts',
                          }))
                        }
                      >
                        <SelectTrigger className="w-full font-mono text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="contact">
                            <span className="font-mono">/{getBasePath("contact")}/</span>
                            <span className="text-muted-foreground ml-2">- Contact documents</span>
                          </SelectItem>
                          <SelectItem value="people">
                            <span className="font-mono">/{getBasePath("people")}/</span>
                            <span className="text-muted-foreground ml-2">- Corporate people</span>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  ) : (
                    // Other scopes: read-only display
                    <div className="flex items-center gap-1 p-2 border rounded bg-muted/30">
                      <span className="inline-flex items-center font-mono text-xs px-2 py-1 rounded-none border bg-muted dark:bg-slate-800 text-foreground dark:text-muted-foreground border-border dark:border-border">
                        {getBasePath(scope)}
                      </span>
                      <span className="text-muted-foreground">/</span>
                    </div>
                  )}
                </div>

                {/* Warehouse Folder Path (read-only from warehouse_folders table) */}
                {editingTab?.base_folder_path_template && (
                  <div className="space-y-1">
                    <Label className="text-xs">Warehouse Folder Path</Label>
                    <div className="p-2 border rounded bg-muted/30 font-mono text-xs text-muted-foreground">
                      {editingTab.base_folder_path_template}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Inherited from warehouse folder configuration
                    </p>
                  </div>
                )}

                {/* Editable folder path */}
                {/* SSoT: Show inherited base path as greyed-out prefix, then editable tab folder */}
                <PlaceholderBuilder
                  label="Full Warehouse Folder Path"
                  value={formData.folder_path ?? ""}
                  onChange={(value) =>
                    setFormData((prev) => ({
                      ...prev,
                      folder_path: value,
                    }))
                  }
                  scope="storage"
                  // SSoT: Base path ALWAYS from warehouse_types.folder_path_template
                  // Same for root and child tabs - never use parent's folder_path
                  prefixValue={getBasePath(scope)}
                  separator="/"
                  // SSoT: Filter placeholders based on tab hierarchy
                  // - Root tabs: show {{TabName}} only (no subtab)
                  // - Subtabs: show BOTH {{TabName}} (parent) and {{SubTabName}} (current)
                  placeholders={STORAGE_PLACEHOLDERS.filter((p) => {
                    const isSubtab = !!(formData.parent_id || editingTab?.parent_id);
                    if (isSubtab) {
                      // Subtabs: show BOTH TabName (parent) and SubTabName (current)
                      return true;
                    } else {
                      // Root tabs: show TabName only, hide SubTabName
                      return p.code !== "{{SubTabName}}";
                    }
                  })}
                  showPreview={false}
                  placeholder="Enter folder name or click tokens..."
                />

                {/* Full path preview - uses ACTUAL tab names, not generic examples */}
                {(() => {
                  // SSoT: Base path ALWAYS from warehouse_types.folder_path_template
                  const basePath = getBasePath(scope);

                  const parentId = formData.parent_id || editingTab?.parent_id;
                  const findTabById = (tabList: WarehouseFolder[], id: number): WarehouseFolder | null => {
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
                  let folderPath = formData.folder_path || currentTabName;
                  folderPath = folderPath
                    .replace(/\{\{SubTabName\}\}/g, currentTabName)
                    .replace(/\{\{TabName\}\}/g, parentTabName || currentTabName)
                    .replace(/\{\{JobCode\}\}/g, "077")
                    .replace(/\{\{Category\}\}/g, currentTabName)
                    .replace(/\{\{CompanyGroup\}\}/g, "Teeem Group")
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
              {(formData.tab_type !== 'system') ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Linked Types</Label>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => {
                        // Map WarehouseFolderScope to document type scope
                        const docTypeScope = scope === 'corporate' ? 'company' : scope;
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

// Backwards compatibility alias for old name
export const EntityTabsConfig = WarehouseFoldersConfig;
