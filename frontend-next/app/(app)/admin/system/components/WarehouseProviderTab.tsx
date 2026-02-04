"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Cloud,
  CheckCircle2,
  AlertCircle,
  Save,
  RefreshCw,
  ExternalLink,
  Info,
  Settings,
  HardDrive,
  Database,
  FolderTree,
  Folder,
  FolderOpen,
  ChevronRight,
  ChevronDown,
  ChevronsDownUp,
  ChevronsUpDown,
  Pencil,
  FileText,
  Link2,
  Eye,
  Mail,
  Briefcase,
  Users,
  Building2,
  FileBox,
  ClipboardList,
  FolderHeart,
  Clock,
  BookOpen,
  ArrowRight,
  Layers,
  Zap,
  Lock,
  Plus,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { ExpandChevron } from "@/components/ui/expand-chevron";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";
import { Spinner } from "@/components/ui/spinner";
import { TokenBuilder, resolveWithExamples } from "@/components/ui/tokens";
import { getWarehouseScopeForType } from "@/lib/placeholders";
import Link from "next/link";

// SSoT (Feb 2026): All warehouse type config now comes from database
// - base_folder.full_path_template is the SSoT for folder paths
// - warehouseTypes.display_name for scope labels
// - No parent-child derivation needed - base_folders store complete paths

// SSoT: Provider types match WarehouseProvider.PROVIDER_TYPES
// Backend consolidates wasabi/s3 into s3_compatible
type ProviderType = "sharepoint" | "s3_compatible" | "local";

const PROVIDER_OPTIONS: { value: ProviderType; label: string; icon: React.ElementType; description: string }[] = [
  { value: "sharepoint", label: "SharePoint", icon: Cloud, description: "Microsoft SharePoint / OneDrive for Business" },
  { value: "s3_compatible", label: "Wasabi / S3", icon: Database, description: "Wasabi, Amazon S3, or any S3-compatible storage" },
  { value: "local", label: "Local Storage", icon: HardDrive, description: "Local file system (development only)" },
];

// SSoT: Normalize legacy provider values from API to current values
function normalizeProviderType(apiValue: string | null | undefined): ProviderType {
  if (!apiValue) return "s3_compatible"; // Default
  // Handle legacy values
  if (apiValue === "wasabi" || apiValue === "s3") return "s3_compatible";
  // Return as-is if valid
  if (["sharepoint", "s3_compatible", "local"].includes(apiValue)) {
    return apiValue as ProviderType;
  }
  return "s3_compatible"; // Fallback
}

// SSoT: WarehouseProvider handles CONNECTION + root path + scope folders
// Individual tab folder paths are managed in WarehouseFolder (Entity Configurator)
// SSoT: Dynamic scope folders from WarehouseProvider.SCOPE_FOLDERS
// Keys and values come from the backend API
type ScopeFolders = Record<string, string>;

// Document type interface
// Note: display_name contains the Document UI Name TEMPLATE (with tokens like {ContactName})
// name contains the actual document type name like "Xero Invoice"
interface DocumentType {
  id: number;
  name: string;  // Actual doc type name: "Xero Invoice"
  abbreviation?: string;  // Short code: "XINV"
  display_name?: string;  // Document UI Name TEMPLATE: "{ContactName} {DocTypeName} {Date}"
  file_name?: string;  // Document Download Name TEMPLATE: "{ContactName} {DocTypeCode} {Date}"
}

// SSoT (Feb 2026): Base folders from warehouse_types API
// These are THE ONE source of truth for folder categories shown as chips
interface BaseFolderFromAPI {
  id: number;
  name: string;
  folder_path_template?: string;
  full_path_template?: string;  // SSoT: Full path including warehouse type's template
  path_preview?: string;
  is_system?: boolean;  // System base folders can't be deleted (e.g., Task Attachments)
  // SSoT (Feb 2026): Linked warehouse_folder for UI/DL name editing
  warehouse_folder?: {
    id: number;
    display_name: string;
    folder_path?: string;
    ui_name?: string;
    download_name?: string;
  };
}

// WarehouseType from API (for base folders lookup and tree building)
interface WarehouseTypeFromAPI {
  id: number;
  code: string;
  display_name: string;
  folder_path_template?: string;  // e.g., "Tasks/{{TaskId}}/{{TaskName}}"
  base_folders: BaseFolderFromAPI[];
}

// WarehouseFolder interface for tabs under each scope
interface WarehouseTabConfig {
  id: number;
  tab_key: string;
  display_name: string;
  scope: string;
  parent_id: number | null;
  // SSoT: API returns warehouse_enabled (Jan 2026 rename)
  // has_storage_folder kept for backwards compatibility
  warehouse_enabled?: boolean | null;
  has_storage_folder?: boolean | null;
  storage_folder_path: string | null;
  download_name: string | null;
  ui_name: string | null;  // SSoT: Document UI Name template
  enabled: boolean;
  order_position: number;
  icon_name: string | null;
  folder_path?: string | null;
  base_folder?: string | null;  // SSoT: First segment of folder_path (from database)
  base_folder_path_template?: string | null;  // SSoT: Template from base_folders table
  children?: WarehouseTabConfig[];
  document_types?: DocumentType[];
}

// Scope to API scope mapping
const SCOPE_TO_API_SCOPE: Record<string, string> = {
  corporate: 'corporate',
  job: 'job',
  contact: 'contact',
  email: 'email',
  warehouse: 'warehouse',
  task: 'task',
  user: 'user',
  case: 'case',
  asset: 'asset',
  financial: 'financial',
  compliance: 'compliance',
  payment: 'payment',
  bank_statement: 'bank_statement',
  template: 'template',
  esignature: 'esignature',
  plan: 'plan',
};

interface StorageConfig {
  configured: boolean;
  provider_type: string; // Can be legacy values (wasabi, s3) - normalized via normalizeProviderType()
  status: string;
  // SharePoint connection
  site_url: string | null;
  site_id: string | null;
  drive_id: string | null;
  drive_name: string | null;
  // S3/Wasabi connection
  endpoint: string | null;
  bucket: string | null;
  region: string | null;
  // Root path and warehouse folders
  root_path: string;
  // SSoT: warehouse_folders is THE ONE place for warehouse type roots
  // warehouse_folders REMOVED (Jan 2026 SSoT fix) - use warehouse_folders only
  warehouse_folders: ScopeFolders;
  // SSoT: Templates for folder paths and filenames per warehouse type
  warehouse_folder_templates: Record<string, string>;
  download_names: Record<string, string>;  // Filename when downloading
  ui_name_templates: Record<string, string>;  // Name shown in File Warehouse UI
  // Legacy field names for backwards compatibility during API transition
  file_name_templates?: Record<string, string>;
  display_name_templates?: Record<string, string>;
  // SSoT: Config links for warehouse folders (URL to external config page)
  config_links: Record<string, string>;
  // Phase 4: Virtual warehouses (render from DB instead of S3)
  virtual_warehouses: Record<string, boolean>;
  // SM task exclusion setting
  exclude_sm_tasks: boolean;
  // Link expiry for presigned download URLs (days)
  link_expiry_days: number;
}

// Tree node structure for folder hierarchy
interface FolderTreeNode {
  name: string;  // Display name (e.g., "Users", "Contracts")
  path: string;  // Full path (e.g., "Users/Contracts")
  scopeKey: string | null;  // Primary scope key (first one added)
  scopeKeys: string[];  // ALL scope keys that share this path (for multi-scope folders like Tasks)
  children: FolderTreeNode[];
  tabs?: WarehouseTabConfig[];  // Tabs under this scope folder (DEPRECATED for chips - use baseFolders)
  baseFolders?: BaseFolderFromAPI[];  // SSoT (Feb 2026): Base folders from warehouse_types API
}

// SSoT (Feb 2026): Get scope label from warehouse type display_name or convert code to Title Case
// warehouseTypes lookup is passed in where available, otherwise falls back to code conversion
function getScopeLabel(key: string, warehouseTypes?: WarehouseTypeFromAPI[]): string {
  // Look up display_name from warehouseTypes if available
  if (warehouseTypes) {
    const wt = warehouseTypes.find(t => t.code === key);
    if (wt?.display_name) return wt.display_name;
  }
  // Fallback: convert snake_case to Title Case
  return key
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

// Normalize path for display: replace legacy {{TeeemXL}} with {{TabName}}
function normalizePathDisplay(path: string | null | undefined): string {
  if (!path) return '';
  return path.replace(/\{\{TeeemXL\}\}/gi, '{{TabName}}');
}

// ============================================================================
// SSoT: FolderEditPanel - THE ONE reusable component for folder/tab editing
// Standardized field order: Root Path → Base Folder → Folder Path → Full Path
//                          → Document UI Name → Document Download Name
// ============================================================================
interface FolderEditPanelProps {
  // Path configuration
  rootPath: string;
  baseFolderValue?: string;
  baseFolderInheritedFrom?: string;  // If set, base folder is read-only (inherited)
  folderPath: string;
  fullPathPreview: string;
  // Document naming
  uiNameValue: string;
  downloadNameValue: string;
  // Scope for token builder
  scope: string;
  // Callbacks
  onBaseFolderChange?: (value: string) => void;
  onFolderPathChange: (value: string) => void;
  onUiNameChange: (value: string) => void;
  onDownloadNameChange: (value: string) => void;
  onSave: () => void;
  onCancel: () => void;
  // State
  isSaving?: boolean;
  hasUnsavedChanges?: boolean;
  lastSaved?: Date | null;
  // Display options
  showBaseFolder?: boolean;  // Default true for scope folders, false for tabs
  folderSuffixButtons?: React.ReactNode;  // Optional folder suffix quick-add buttons
  compactMode?: boolean;  // Slightly smaller spacing for nested panels
}

function FolderEditPanel({
  rootPath,
  baseFolderValue,
  baseFolderInheritedFrom,
  folderPath,
  fullPathPreview,
  uiNameValue,
  downloadNameValue,
  scope,
  onBaseFolderChange,
  onFolderPathChange,
  onUiNameChange,
  onDownloadNameChange,
  onSave,
  onCancel,
  isSaving = false,
  hasUnsavedChanges = false,
  lastSaved = null,
  showBaseFolder = true,
  folderSuffixButtons,
  compactMode = false,
}: FolderEditPanelProps) {
  const labelClass = compactMode ? "text-[11px]" : "text-xs";
  const spacing = compactMode ? "space-y-3" : "space-y-4";

  return (
    <div className={spacing}>
      {/* 1. Root Path (always read-only) */}
      <div className="space-y-1">
        <label className={cn(labelClass, "font-medium text-muted-foreground")}>Root Path</label>
        <div className="bg-muted/50 border border-muted rounded px-3 py-2">
          <span className="font-mono text-sm text-muted-foreground">
            {rootPath || '/'}
          </span>
        </div>
        <p className="text-[10px] text-muted-foreground">
          Storage provider root folder (configured in Storage Config).
        </p>
      </div>

      {/* 2. Base Folder (optional - for scope folders) */}
      {showBaseFolder && (
        <div className="space-y-1">
          <label className={cn(labelClass, "font-medium text-muted-foreground")}>
            Base Folder
            {baseFolderInheritedFrom && (
              <span className="text-muted-foreground/70 ml-1">
                (inherited from {baseFolderInheritedFrom.replace('_', ' ')})
              </span>
            )}
          </label>
          {baseFolderInheritedFrom ? (
            // Read-only when inherited
            <div className="bg-muted/50 border border-muted rounded px-3 py-2">
              <span className="font-mono text-sm text-muted-foreground">
                {baseFolderValue || ''}
              </span>
            </div>
          ) : (
            // Editable when not inherited
            <TokenBuilder
              value={baseFolderValue || ''}
              onChange={onBaseFolderChange || (() => {})}
              scope={getWarehouseScopeForType(scope)}
              showPreview={false}
              separator="/"
              placeholder="Click tokens to build base folder..."
              defaultExpanded={false}
            />
          )}
          <p className="text-[10px] text-muted-foreground">
            {baseFolderInheritedFrom
              ? `Base path inherited from ${baseFolderInheritedFrom.replace('_', ' ')}. Edit the Folder Path below to set the suffix.`
              : 'Storage folder path. Use the same path for related types to group them on one row.'
            }
          </p>
        </div>
      )}

      {/* 3. Folder Path (TokenBuilder) */}
      <TokenBuilder
        label={<span className={cn(labelClass, "font-medium")}>Folder Path</span>}
        value={folderPath}
        onChange={onFolderPathChange}
        scope={getWarehouseScopeForType(scope)}
        showPreview={false}
        separator="/"
        placeholder="Click tokens to build folder path..."
        defaultExpanded={false}
        prefixValue={baseFolderInheritedFrom ? baseFolderValue : undefined}
      />

      {/* 4. Full Path Preview */}
      <div className={cn(
        "bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded px-3 py-2",
        compactMode ? "-mt-1" : "-mt-2"
      )}>
        <span className="text-xs text-muted-foreground">Full Path: </span>
        <span className="font-mono text-sm text-green-700 dark:text-green-400">
          {fullPathPreview || '/'}
        </span>
      </div>

      {/* Optional: Folder suffix quick-add buttons */}
      {folderSuffixButtons}

      {/* 5. Document UI Name (TokenBuilder) */}
      <TokenBuilder
        label={<span className={cn(labelClass, "font-medium")}>Document UI Name</span>}
        value={uiNameValue}
        onChange={onUiNameChange}
        scope={getWarehouseScopeForType(scope)}
        showPreview={true}
        placeholder="Click tokens to build document UI name..."
        defaultExpanded={false}
        defaultValue="{{OriginalFileName}}"
      />

      {/* 6. Document Download Name (TokenBuilder) */}
      <TokenBuilder
        label={
          <span className={cn(labelClass, "font-medium")}>
            Document Download Name
            {(!downloadNameValue || downloadNameValue === '{{OriginalFileName}}') && (
              <span className="ml-1.5 text-[9px] text-blue-500/70 font-normal">(default)</span>
            )}
          </span>
        }
        value={downloadNameValue}
        onChange={onDownloadNameChange}
        scope={getWarehouseScopeForType(scope)}
        showPreview={true}
        placeholder="Click tokens to build download filename..."
        defaultExpanded={false}
        defaultValue="{{OriginalFileName}}"
      />

      {/* Save/Cancel buttons */}
      <div className="flex items-center justify-between pt-2 border-t mt-3">
        {/* Auto-save indicator */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {isSaving ? (
            <>
              <Spinner size={12} />
              <span>Saving...</span>
            </>
          ) : lastSaved ? (
            <>
              <CheckCircle2 className="h-3 w-3 text-green-500 dark:text-green-400" />
              <span>Auto-saved</span>
            </>
          ) : (
            <span className="text-muted-foreground/50">Changes auto-save</span>
          )}
        </div>

        {/* Save and Close buttons */}
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="default"
            onClick={onSave}
            disabled={isSaving || !hasUnsavedChanges}
            className="h-7 px-3 text-xs"
          >
            {isSaving ? 'Saving...' : 'Save'}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={onCancel}
            className="h-7 px-3 text-xs"
          >
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}

// TreeNode component for folder hierarchy
interface TreeNodeProps {
  node: FolderTreeNode;
  level: number;
  expandedPaths: Set<string>;
  onToggle: (path: string) => void;
  editingKey: string | null;
  onStartEdit: (key: string) => void;
  onSaveEdit: (key: string, value: string) => void;
  onCancelEdit: () => void;
  currentPath: ScopeFolders;
  rootPath: string;
  // Tab editing props
  editingTabId: number | null;
  onStartTabEdit: (tabId: number) => void;
  onSaveTabEdit: (tabId: number, path: string, displayName: string, sendNameTemplate: string) => void;
  onCancelTabEdit: () => void;
  // Parent scope info for simple scope detection
  parentScopeKey?: string | null;
  // SSoT: Templates for auto-save
  scopeTemplates: Record<string, string>;
  downloadNameTemplates: Record<string, string>;  // Filename when downloading
  uiNameTemplates: Record<string, string>;  // Name shown in File Warehouse UI
  configLinks: Record<string, string>;
  onSaveTemplates: (scopeKey: string, baseFolder: string, folderTemplate: string, downloadNameTemplate: string, uiNameTemplate: string, configLink: string | null) => Promise<void>;
  // Phase 4: Virtual scopes
  virtualScopes: Record<string, boolean>;
  onToggleVirtual: (scopeKey: string, isVirtual: boolean) => Promise<void>;
  // SSoT: warehouse_folders - full path patterns like Jobs/{{JobCode}}
  scopeRootFolders: Record<string, string>;
  // SSoT (Feb 2026): All warehouse types for display_name lookup
  warehouseTypes: WarehouseTypeFromAPI[];
  // SSoT (Feb 2026): Edit warehouse folder UI/DL names
  onEditWarehouseFolder?: (folder: { id: number; display_name: string; folder_path?: string; download_name?: string; ui_name?: string; base_folder_path_template?: string }) => void;
}

function TreeNode({
  node,
  level,
  expandedPaths,
  onToggle,
  editingKey,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  currentPath,
  rootPath,
  editingTabId,
  onStartTabEdit,
  onSaveTabEdit,
  onCancelTabEdit,
  parentScopeKey,
  scopeTemplates,
  downloadNameTemplates,
  uiNameTemplates,
  configLinks,
  onSaveTemplates,
  virtualScopes,
  onToggleVirtual,
  scopeRootFolders,
  warehouseTypes,
  onEditWarehouseFolder,
}: TreeNodeProps) {
  const hasChildren = node.children.length > 0;
  const hasTabs = node.tabs && node.tabs.length > 0;
  // Check if we're editing ANY scope in this node's scopeKeys
  const isEditingThisNode = editingKey && node.scopeKeys?.includes(editingKey);
  // The currently editing scope key (could be different from node.scopeKey when multiple scopes share path)
  const currentEditingScopeKey = isEditingThisNode ? editingKey : null;
  // FRC Fix: Initialize editValue to FIRST segment only (Base Folder)
  // NOT full path which would cause duplication with folderTemplate
  const [editValue, setEditValue] = React.useState(node.path?.split('/')[0] || node.path || '');
  // SSoT: Initialize templates from props (loaded from backend), fallback to defaults
  // Use editingKey when available, otherwise primary scopeKey
  const activeScopeKey = currentEditingScopeKey || node.scopeKey;

  // SSoT (Feb 2026): Load folder template directly from scopeRootFolders
  // base_folder.full_path_template is the SSoT - no parent-child derivation needed
  const getInitialFolderTemplate = (scopeKey: string | null | undefined): string => {
    if (!scopeKey) return '';
    // Return full path template from base_folder (SSoT)
    return scopeRootFolders[scopeKey] || scopeTemplates[scopeKey] || '';
  };

  const [folderTemplate, setFolderTemplate] = React.useState(
    getInitialFolderTemplate(activeScopeKey)
  );
  const [downloadNameTemplate, setDownloadNameTemplate] = React.useState(
    activeScopeKey ? downloadNameTemplates[activeScopeKey] || '' : ''
  );
  const [uiNameTemplate, setUiNameTemplate] = React.useState(
    activeScopeKey ? uiNameTemplates[activeScopeKey] || '' : ''
  );
  // Config link: checkbox + URL for linking to external config page
  // SSoT: Initialize from configLinks prop (loaded from backend)
  const initialConfigLink = activeScopeKey ? configLinks[activeScopeKey] || '' : '';
  const [hasConfigLink, setHasConfigLink] = React.useState(!!initialConfigLink);

  // SSoT: Simple scopes without config link can expand to show folder template preview
  // Check if ANY scope has a template (for multi-scope paths like Tasks)
  const hasTemplatePreview = node.scopeKeys?.length > 0 && node.scopeKeys.some(sk => {
    const template = scopeTemplates[sk] || '';
    return template && !configLinks[sk];
  });
  const hasExpandableContent = hasChildren || hasTabs || hasTemplatePreview;
  const isExpanded = expandedPaths.has(node.path);
  const [configLinkUrl, setConfigLinkUrl] = React.useState(initialConfigLink);
  const [isSaving, setIsSaving] = React.useState(false);
  const [lastSaved, setLastSaved] = React.useState<Date | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = React.useState(false);
  const saveTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  // Track if templates have been modified (to avoid saving on initial load)
  const hasModified = React.useRef(false);
  // Track previous scope to save when switching
  const prevScopeRef = React.useRef<{
    scopeKey: string;
    baseFolder: string;
    folder: string;
    downloadName: string;
    uiName: string;
    configLink: string | null;
  } | null>(null);
  // Track the last scope we initialized for (to avoid re-initializing on prop changes)
  const initializedScopeRef = React.useRef<string | null>(null);

  // Immediate save function (no debounce) - for switching scopes
  const saveImmediate = React.useCallback(async (scopeKey: string, baseFolder: string, folder: string, downloadName: string, uiName: string, configLink: string | null) => {
    if (!scopeKey) return;
    try {
      await onSaveTemplates(scopeKey, baseFolder, folder, downloadName, uiName, configLink);
    } catch (error) {
      console.error('Failed to save templates:', error);
    }
  }, [onSaveTemplates]);

  // Manual save handler - saves immediately without waiting for debounce
  const handleManualSave = React.useCallback(async () => {
    console.log('🟡 [handleManualSave] Called', { currentEditingScopeKey, editValue, folderTemplate, downloadNameTemplate, uiNameTemplate, hasConfigLink, configLinkUrl });
    if (!currentEditingScopeKey) {
      console.log('🟡 [handleManualSave] No currentEditingScopeKey, returning');
      return;
    }

    // Clear any pending auto-save
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }

    setIsSaving(true);
    try {
      const linkToSave = hasConfigLink ? configLinkUrl : null;
      console.log('🟡 [handleManualSave] Calling onSaveTemplates with:', { currentEditingScopeKey, editValue, folderTemplate, downloadNameTemplate, uiNameTemplate, linkToSave });
      await onSaveTemplates(currentEditingScopeKey, editValue, folderTemplate, downloadNameTemplate, uiNameTemplate, linkToSave);
      console.log('🟡 [handleManualSave] Save successful');
      setLastSaved(new Date());
      hasModified.current = false;
      setHasUnsavedChanges(false);
      prevScopeRef.current = null;
    } catch (error) {
      console.error('🟡 [handleManualSave] Failed to save templates:', error);
    } finally {
      setIsSaving(false);
    }
  }, [currentEditingScopeKey, editValue, folderTemplate, downloadNameTemplate, uiNameTemplate, hasConfigLink, configLinkUrl, onSaveTemplates]);

  // Auto-save function with debounce - calls actual API
  const autoSave = React.useCallback(async (scopeKey: string, baseFolder: string, folder: string, downloadName: string, uiName: string, configLink: string | null) => {
    console.log('🟢 [autoSave] Called', { scopeKey, baseFolder, folder, downloadName, uiName, configLink, hasModified: hasModified.current });
    if (!scopeKey || !hasModified.current) {
      console.log('🟢 [autoSave] Skipping - no scopeKey or not modified');
      return;
    }

    // Update the ref so we can save when switching
    prevScopeRef.current = { scopeKey, baseFolder, folder, downloadName, uiName, configLink };

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    saveTimeoutRef.current = setTimeout(async () => {
      console.log('🟢 [autoSave] Debounce triggered, saving...');
      setIsSaving(true);
      try {
        await onSaveTemplates(scopeKey, baseFolder, folder, downloadName, uiName, configLink);
        console.log('🟢 [autoSave] Save successful');
        setLastSaved(new Date());
        hasModified.current = false;
        setHasUnsavedChanges(false);
        prevScopeRef.current = null; // Clear after successful save
      } catch (error) {
        console.error('🟢 [autoSave] Failed to save templates:', error);
      } finally {
        setIsSaving(false);
      }
    }, 1000); // 1 second debounce
  }, [onSaveTemplates]);

  // Trigger auto-save when templates or config link change
  // IMPORTANT: Only auto-save if we're editing the INITIALIZED scope (not during scope switch)
  React.useEffect(() => {
    // Don't auto-save during scope switch - let the save-on-switch effect handle that
    if (currentEditingScopeKey && hasModified.current && initializedScopeRef.current === currentEditingScopeKey) {
      // Pass null for configLink if checkbox is unchecked (to remove it)
      const linkToSave = hasConfigLink ? configLinkUrl : null;
      autoSave(currentEditingScopeKey, editValue, folderTemplate, downloadNameTemplate, uiNameTemplate, linkToSave);
    }
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [editValue, folderTemplate, downloadNameTemplate, uiNameTemplate, hasConfigLink, configLinkUrl, currentEditingScopeKey, autoSave]);

  // Save previous scope immediately when switching to a different scope
  React.useEffect(() => {
    // If we have pending changes from a previous scope, save them immediately
    if (prevScopeRef.current && prevScopeRef.current.scopeKey !== currentEditingScopeKey) {
      const prev = prevScopeRef.current;
      saveImmediate(prev.scopeKey, prev.baseFolder, prev.folder, prev.downloadName, prev.uiName, prev.configLink);
      prevScopeRef.current = null;
      // Clear any pending debounced save
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = null;
      }
    }
  }, [currentEditingScopeKey, saveImmediate]);

  // Handle template changes - mark as modified
  const handleFolderTemplateChange = (value: string) => {
    hasModified.current = true;
    setHasUnsavedChanges(true);
    setFolderTemplate(value);
  };

  const handleDownloadNameTemplateChange = (value: string) => {
    hasModified.current = true;
    setHasUnsavedChanges(true);
    setDownloadNameTemplate(value);
  };

  const handleUiNameTemplateChange = (value: string) => {
    hasModified.current = true;
    setHasUnsavedChanges(true);
    setUiNameTemplate(value);
  };

  // SSoT (Feb 2026): Simple/complex distinction removed - all scopes use base_folders
  const isInSimpleScope = false;
  const isSimpleScopeChild = false;

  // Reset edit value and templates when editing starts or switches to a different scope
  // IMPORTANT: Only initialize templates when SCOPE actually changes, not when props update after save
  React.useEffect(() => {
    if (currentEditingScopeKey) {
      const scopeActuallyChanged = initializedScopeRef.current !== currentEditingScopeKey;
      console.log('🟣 [TreeNode useEffect] Scope edit check:', { currentEditingScopeKey, previousScope: initializedScopeRef.current, scopeActuallyChanged, nodePath: node.path });

      // Only initialize templates when switching to a DIFFERENT scope
      if (scopeActuallyChanged) {
        // FRC Fix: Base Folder should be FIRST segment only (e.g., "Tasks")
        // NOT the full path (e.g., "Tasks/{{TaskId}}/{{TaskName}}")
        // The template portion is in scopeTemplates (set via setFolderTemplate below)
        const fullPath = currentPath[currentEditingScopeKey] || node.path;
        const firstSegment = fullPath?.split('/')[0] || fullPath || '';
        const initialTemplate = getInitialFolderTemplate(currentEditingScopeKey);
        console.log('🟣 [TreeNode useEffect] Initializing edit values:', {
          fullPath,
          firstSegment,
          folderTemplate: initialTemplate,
          downloadName: downloadNameTemplates[currentEditingScopeKey],
          uiName: uiNameTemplates[currentEditingScopeKey],
          configLink: configLinks[currentEditingScopeKey],
        });
        setEditValue(firstSegment);
        setFolderTemplate(initialTemplate);
        setDownloadNameTemplate(
          downloadNameTemplates[currentEditingScopeKey] || ''
        );
        setUiNameTemplate(
          uiNameTemplates[currentEditingScopeKey] || ''
        );
        const linkValue = configLinks[currentEditingScopeKey] || '';
        setConfigLinkUrl(linkValue);
        setHasConfigLink(!!linkValue);
        hasModified.current = false;
        setHasUnsavedChanges(false);
        setLastSaved(null);
        initializedScopeRef.current = currentEditingScopeKey;
      }
    } else {
      // Editing stopped - reset the initialized scope tracker
      initializedScopeRef.current = null;
    }
  }, [currentEditingScopeKey, currentPath, node.path, scopeTemplates, downloadNameTemplates, uiNameTemplates, configLinks]);

  const fullPath = rootPath
    ? `${rootPath}/${node.path}`.replace(/\/+/g, '/')
    : `/${node.path}`;

  return (
    <div>
      {/* Node row */}
      <div
        className={cn(
          "flex items-center gap-1 py-1 px-1 rounded-sm hover:bg-muted/50 group",
          isEditingThisNode && "bg-muted"
        )}
        style={{ paddingLeft: `${level * 16 + 4}px` }}
      >
        {/* Expand/collapse button or spacer */}
        {hasExpandableContent ? (
          <button
            type="button"
            onClick={() => onToggle(node.path)}
            className="p-1.5 hover:bg-muted rounded -ml-1"
          >
            <ExpandChevron expanded={isExpanded} size={16} />
          </button>
        ) : (
          <span className="w-6" />
        )}

        {/* Folder icon */}
        {hasExpandableContent && isExpanded ? (
          <FolderOpen className="h-4 w-4 text-amber-500 flex-shrink-0" />
        ) : (
          <Folder className="h-4 w-4 text-amber-500 flex-shrink-0" />
        )}

        {/* Folder name and scope badge */}
        <span className="font-mono text-sm">{node.name}</span>

        {/* Scope badges - show only PRIMARY scope (not child scopes like task_attachments) */}
        {/* SSoT (Feb 2026): Base folder indicators - show on LEAF nodes (no children) */}
        {/* Lock icon for system folders, Folder icon for custom folders */}
        {/* Settings button for folders with linked warehouse_folder (for UI/DL editing) */}
        {node.baseFolders && node.baseFolders.length > 0 && node.children.length === 0 && (
          <div className="flex items-center gap-1 ml-1">
            {node.baseFolders.map((bf) => (
              <div key={bf.id} className="flex items-center gap-0.5">
                <span
                  className="p-0.5"
                  title={bf.is_system
                    ? `System folder (required by code): ${bf.name}`
                    : `Base folder: ${bf.name}`}
                >
                  {bf.is_system ? (
                    <Lock className="h-3 w-3 text-muted-foreground" />
                  ) : (
                    <Folder className="h-3 w-3 text-muted-foreground" />
                  )}
                </span>
                {/* UI/DL badges - green if custom, orange if default */}
                {bf.warehouse_folder && (
                  <>
                    <span
                      className={`text-[9px] px-1 rounded ${
                        bf.warehouse_folder.ui_name
                          ? 'bg-green-500/20 text-green-600 dark:text-green-400'
                          : 'bg-orange-500/20 text-orange-600 dark:text-orange-400'
                      }`}
                      title={`UI: ${bf.warehouse_folder.ui_name || '{{OriginalFileName}} (default)'}`}
                    >
                      UI
                    </span>
                    <span
                      className={`text-[9px] px-1 rounded ${
                        bf.warehouse_folder.download_name
                          ? 'bg-green-500/20 text-green-600 dark:text-green-400'
                          : 'bg-orange-500/20 text-orange-600 dark:text-orange-400'
                      }`}
                      title={`DL: ${bf.warehouse_folder.download_name || '{{OriginalFileName}} (default)'}`}
                    >
                      DL
                    </span>
                  </>
                )}
                {/* Edit button for folders with linked warehouse_folder */}
                {bf.warehouse_folder && onEditWarehouseFolder && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onEditWarehouseFolder({
                        id: bf.warehouse_folder!.id,
                        display_name: bf.warehouse_folder!.display_name || bf.name,
                        // SSoT: Load from warehouse_folder first, fallback to base_folder template
                        folder_path: bf.warehouse_folder!.folder_path || bf.full_path_template || bf.folder_path_template,
                        download_name: bf.warehouse_folder!.download_name,
                        ui_name: bf.warehouse_folder!.ui_name,
                        base_folder_path_template: bf.folder_path_template,  // SSoT: Template from base_folders table
                      });
                    }}
                    className="p-0.5 hover:bg-muted rounded"
                    title="Edit UI/DL names"
                  >
                    <Settings className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* SSoT (Feb 2026): Show base folder details for LEAF nodes */}
      {/* Always show folder path, UI name, and DL name for base folders */}
      {node.baseFolders && node.baseFolders.length > 0 && node.children.length === 0 && (
        <div style={{ paddingLeft: `${level * 16 + 28}px` }}>
          {node.baseFolders.map((bf) => (
            <div
              key={bf.id}
              className="text-[10px] text-muted-foreground font-mono space-y-0.5 mb-2"
            >
              <div>{bf.full_path_template || bf.folder_path_template || '—'}</div>
              {/* Always show UI/DL fields for base folders with warehouse_folder */}
              {/* Green = custom value saved, Orange = using default (original filename) */}
              {bf.warehouse_folder && (
                <div className="flex flex-col gap-0.5 text-[9px] mt-0.5">
                  <div className="flex items-center gap-1">
                    <span className="w-6">UI:</span>
                    <span className={bf.warehouse_folder.ui_name ? 'text-green-500' : 'text-orange-500'}>
                      {bf.warehouse_folder.ui_name || '{{OriginalFileName}}'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="w-6">DL:</span>
                    <span className={bf.warehouse_folder.download_name ? 'text-green-500' : 'text-orange-500'}>
                      {bf.warehouse_folder.download_name || '{{OriginalFileName}}'}
                    </span>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      {/* For non-leaf nodes, show just the path */}
      {node.children.length > 0 && (() => {
        const scopeKeys = node.scopeKeys || (node.scopeKey ? [node.scopeKey] : []);
        if (scopeKeys.length === 0 || isEditingThisNode) return null;

        const primaryScopeKey = scopeKeys[0];
        const displayPath = (scopeRootFolders[primaryScopeKey] || '')
          .replace(/\{\{TeeemXL\}\}/gi, '{{TabName}}')
          .replace(/\/+/g, '/')
          .replace(/\/+$/, '');

        if (!displayPath) return null;

        const hasDynamicMailbox = displayPath.includes('{{Mailbox}}');

        return (
          <div
            className="flex items-center gap-2 text-[10px] text-muted-foreground font-mono"
            style={{ paddingLeft: `${level * 16 + 28}px` }}
          >
            <span>{displayPath}</span>
            {hasDynamicMailbox && (
              <span
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-sans font-semibold bg-purple-500 text-white dark:bg-purple-600"
                title="Dynamic: Auto-expands to show all synced mailboxes"
              >
                <Zap className="h-3 w-3" />
                Dynamic
              </span>
            )}
          </div>
        );
      })()}

      {/* Editing panel for any scope folder */}
      {editingKey && node.scopeKeys?.includes(editingKey) && (
        <div
          className="border rounded-lg bg-card py-3 px-4 my-1 shadow-sm"
          style={{ marginLeft: `${level * 16 + 28}px` }}
        >
          <div className="space-y-4">
            {/* Root Path (read-only greyed out) */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Root Path</label>
              <div className="bg-muted/50 border border-muted rounded px-3 py-2">
                <span className="font-mono text-sm text-muted-foreground">
                  {rootPath || '/'}
                </span>
              </div>
              <p className="text-[10px] text-muted-foreground">
                Storage provider root folder (configured in Storage Config).
              </p>
            </div>

            {/* SSoT (Feb 2026): Folder Path - base_folder.full_path_template is the SSoT */}
            <TokenBuilder
              label={<span className="text-xs font-medium">Folder Path</span>}
              value={folderTemplate}
              onChange={handleFolderTemplateChange}
              scope={getWarehouseScopeForType(currentEditingScopeKey || '')}
              showPreview={false}
              separator="/"
              placeholder="Click tokens to build folder path..."
              defaultExpanded={false}
            />
            <p className="text-[10px] text-muted-foreground -mt-2">
              Full path template from base_folder. Use tokens like {'{{JobCode}}'} for dynamic paths.
            </p>

            {/* Full Path Preview */}
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded px-3 py-2 -mt-2">
              <span className="text-xs text-muted-foreground">Full Path: </span>
              <span className="font-mono text-sm text-green-700 dark:text-green-400">
                {normalizePathDisplay([rootPath, folderTemplate].filter(Boolean).join('/').replace(/\/+/g, '/'))}
              </span>
            </div>

            {/* Folder suffix buttons for task scopes - SSoT: prevents typos */}
            {(currentEditingScopeKey === 'task_attachments' || currentEditingScopeKey === 'task_responses') && (
              <div className="flex items-center gap-2 -mt-2">
                <span className="text-xs text-muted-foreground">Add folder suffix:</span>
                {currentEditingScopeKey === 'task_attachments' && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-6 text-xs px-2"
                    disabled={folderTemplate.endsWith('/Attachments')}
                    onClick={() => {
                      const base = folderTemplate.replace(/\/Attachments\/?$/, '').replace(/\/$/, '');
                      handleFolderTemplateChange(base + '/Attachments');
                    }}
                  >
                    /Attachments
                  </Button>
                )}
                {currentEditingScopeKey === 'task_responses' && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-6 text-xs px-2"
                    disabled={folderTemplate.endsWith('/Responses')}
                    onClick={() => {
                      const base = folderTemplate.replace(/\/Responses\/?$/, '').replace(/\/$/, '');
                      handleFolderTemplateChange(base + '/Responses');
                    }}
                  >
                    /Responses
                  </Button>
                )}
              </div>
            )}

            {/* Folder suffix buttons for email scopes - SSoT: prevents typos */}
            {(currentEditingScopeKey === 'email' || currentEditingScopeKey === 'email_attachments') && (
              <div className="flex items-center gap-2 -mt-2">
                <span className="text-xs text-muted-foreground">Add folder suffix:</span>
                {currentEditingScopeKey === 'email' && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-6 text-xs px-2"
                    disabled={folderTemplate.includes('/Email Body')}
                    onClick={() => {
                      // Insert /Email Body after {{Mailbox}} if present, otherwise at start
                      if (folderTemplate.includes('{{Mailbox}}')) {
                        handleFolderTemplateChange(folderTemplate.replace('{{Mailbox}}', '{{Mailbox}}/Email Body'));
                      } else {
                        handleFolderTemplateChange('/Email Body' + (folderTemplate ? '/' + folderTemplate : ''));
                      }
                    }}
                  >
                    /Email Body
                  </Button>
                )}
                {currentEditingScopeKey === 'email_attachments' && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-6 text-xs px-2"
                    disabled={folderTemplate.includes('/Attachments')}
                    onClick={() => {
                      // Insert /Attachments after {{Mailbox}} if present, otherwise at start
                      if (folderTemplate.includes('{{Mailbox}}')) {
                        handleFolderTemplateChange(folderTemplate.replace('{{Mailbox}}', '{{Mailbox}}/Attachments'));
                      } else {
                        handleFolderTemplateChange('/Attachments' + (folderTemplate ? '/' + folderTemplate : ''));
                      }
                    }}
                  >
                    /Attachments
                  </Button>
                )}
              </div>
            )}

            {/* Document UI Name Template (what user sees in File Warehouse) */}
            <TokenBuilder
              label={<span className="text-xs font-medium">Document UI Name</span>}
              value={uiNameTemplate}
              onChange={handleUiNameTemplateChange}
              scope={getWarehouseScopeForType(currentEditingScopeKey || '')}
              showPreview={true}
              placeholder="Click tokens to build document UI name..."
              defaultExpanded={false}
              defaultValue="{{OriginalFileName}}"
            />

            {/* Document Download Name Template (filename when downloading) */}
            <TokenBuilder
              label={<span className="text-xs font-medium">Document Download Name</span>}
              value={downloadNameTemplate}
              onChange={handleDownloadNameTemplateChange}
              scope={getWarehouseScopeForType(currentEditingScopeKey || '')}
              showPreview={true}
              placeholder="Click tokens to build download filename..."
              defaultExpanded={false}
              defaultValue="{{OriginalFileName}}"
            />

            {/* Auto-save status and close */}
            <div className="flex items-center justify-between pt-2 border-t mt-3">
              {/* Auto-save indicator */}
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                {isSaving ? (
                  <>
                    <Spinner size={12} />
                    <span>Saving...</span>
                  </>
                ) : lastSaved ? (
                  <>
                    <CheckCircle2 className="h-3 w-3 text-green-500 dark:text-green-400" />
                    <span>Auto-saved</span>
                  </>
                ) : (
                  <span className="text-muted-foreground/50">Changes auto-save</span>
                )}
              </div>

              {/* Save and Close buttons */}
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="default"
                  onClick={handleManualSave}
                  disabled={isSaving || !hasUnsavedChanges}
                  className="h-7 px-3 text-xs"
                >
                  {isSaving ? 'Saving...' : 'Save'}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={onCancelEdit}
                  className="h-7 px-3 text-xs"
                >
                  Close
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Expanded content: Children OR Tabs */}
      {isExpanded && hasExpandableContent && (
        <div>
          {/* Show child folders */}
          {hasChildren && node.children.map((child) => (
            <TreeNode
              key={child.path}
              node={child}
              level={level + 1}
              expandedPaths={expandedPaths}
              onToggle={onToggle}
              editingKey={editingKey}
              onStartEdit={onStartEdit}
              onSaveEdit={onSaveEdit}
              onCancelEdit={onCancelEdit}
              currentPath={currentPath}
              rootPath={rootPath}
              editingTabId={editingTabId}
              onStartTabEdit={onStartTabEdit}
              onSaveTabEdit={onSaveTabEdit}
              onCancelTabEdit={onCancelTabEdit}
              parentScopeKey={node.scopeKey || parentScopeKey}
              scopeTemplates={scopeTemplates}
              downloadNameTemplates={downloadNameTemplates}
              uiNameTemplates={uiNameTemplates}
              configLinks={configLinks}
              onSaveTemplates={onSaveTemplates}
              virtualScopes={virtualScopes}
              onToggleVirtual={onToggleVirtual}
              scopeRootFolders={scopeRootFolders}
              warehouseTypes={warehouseTypes}
              onEditWarehouseFolder={onEditWarehouseFolder}
            />
          ))}
          {/* Show entity tabs (with document types) */}
          {/* SSoT: Entity identifier (e.g., {{JobCode}}) comes from warehouse_folders, not extracted from template */}
          {hasTabs && node.scopeKey && (
            <div className="ml-1">
              {node.tabs!.map((tab) => (
                <TabNode
                  key={tab.id}
                  tab={tab}
                  level={level + 1}
                  basePath={normalizePathDisplay(scopeRootFolders[node.scopeKey!] || fullPath)}
                  rootPath={rootPath}
                  scope={node.scopeKey!}
                  editingTabId={editingTabId}
                  onStartEdit={onStartTabEdit}
                  onSaveEdit={onSaveTabEdit}
                  onCancelEdit={onCancelTabEdit}
                  onEditWarehouseFolder={onEditWarehouseFolder}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Helper: Replace template tokens with example values for preview
// Makes templates more readable by showing what the actual output would look like
function resolveTemplatePreview(template: string, docType?: DocumentType): string {
  if (!template) return '';

  // Build dynamic examples based on docType
  // NOTE: Use docType.name (actual name like "Xero Invoice"), NOT display_name (which is the template!)
  const docTypeName = docType?.name || 'Invoice';
  const docTypeAbbr = docType?.abbreviation || 'INV';

  // Replace all token patterns: {Token}, {{Token}}, [Token], [[Token]]
  // Use a single regex to find all tokens and replace them
  let result = template;

  // Define token -> example value mappings
  const tokenExamples: Record<string, string> = {
    // Contact/Person
    'contactname': 'John Smith',
    'personname': 'Jane Doe',
    'name': 'John Smith',
    // Job
    'jobcode': 'J-2024-001',
    'jobname': 'Kitchen Renovation',
    'jobtitle': 'Renovation Project',
    // Company
    'companyname': 'Acme Corp',
    'companycode': 'ACME',
    'companygroup': 'Main Group',
    // Document type - use actual values
    'doctypename': docTypeName,
    'doctypecode': docTypeAbbr,
    'doctypeabbr': docTypeAbbr,
    'doctype': docTypeName,
    // Invoice/Bill
    'invoicenumber': 'INV-00123',
    'invoiceno': 'INV-00123',
    'billnumber': 'BILL-00456',
    'billno': 'BILL-00456',
    'ponumber': 'PO-00789',
    'pono': 'PO-00789',
    // Dates
    'date': '2026-01-30',
    'year': '2026',
    'month': '01',
    'day': '30',
    // Other
    'description': 'Services rendered',
    'subject': 'RE: Project Update',
    'reference': 'REF-001',
    'amount': '$1,234.56',
    // File
    'originalfilename': 'invoice-2026.pdf',
    'filename': 'invoice-2026.pdf',
    'extension': 'pdf',
    // Email (additional)
    'sendername': 'John Smith',
    'senderemail': 'john@example.com',
    'receiveddate': '2026-01-30',
    'receivedtime': '14-30',
    'mailbox': 'robert@teeem.com.au',
    // Literal folder names (double brackets) - strip brackets, show clean name
    'email body': 'Email Body',
    'email attachments': 'Email Attachments',
    'attachments': 'Attachments',
    'responses': 'Responses',
    'teeemxl': 'TeeemXL',
    'teeemdocs': 'TeeemDocs',
    'teeemword': 'TeeemWord',
    'teeemppt': 'TeeemPPT',
    'teeempdf': 'TeeemPDF',
    'teeemnotes': 'TeeemNotes',
    'teeemtemplates': 'TeeemTemplates',
  };

  // Match tokens in formats: {Token}, {{Token}}, [Token], [[Token]]
  result = result.replace(/\{\{?([^{}]+)\}\}?|\[\[?([^\[\]]+)\]\]?/g, (match, braceToken, bracketToken) => {
    const tokenName = (braceToken || bracketToken || '').toLowerCase().trim();
    return tokenExamples[tokenName] ?? match; // Return original if no example found
  });

  return result;
}

// TabNode component for displaying entity tabs
interface TabNodeProps {
  tab: WarehouseTabConfig;
  level: number;
  basePath: string;
  rootPath: string;
  scope: string;
  editingTabId: number | null;
  onStartEdit: (tabId: number) => void;
  onSaveEdit: (tabId: number, path: string, displayName: string, sendNameTemplate: string) => void;
  onCancelEdit: () => void;
  // SSoT (Feb 2026): Edit warehouse folder UI/DL names
  onEditWarehouseFolder?: (folder: { id: number; display_name: string; folder_path?: string; download_name?: string; ui_name?: string; base_folder_path_template?: string }) => void;
}

function TabNode({
  tab,
  level,
  basePath,
  rootPath,
  scope,
  editingTabId,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  onEditWarehouseFolder,
}: TabNodeProps) {
  const isEditing = editingTabId === tab.id;
  // SSoT (Feb 2026): Simple/complex distinction removed - all scopes use base_folders
  const isSimpleScope = false;

  // Extract just the folder name from stored path (strip base path if present)
  const extractFolderName = (storedPath: string | null | undefined, base: string): string => {
    if (!storedPath) return '';
    // FRC Fix (Feb 2026): If stored path equals base path exactly, return empty (no additional folder)
    // This happens for root tabs where folder_path IS the scope's full template
    if (base && storedPath === base) {
      return '';
    }
    // If path starts with basePath, strip it to get just the folder name
    if (base && storedPath.startsWith(base + '/')) {
      return storedPath.slice(base.length + 1);
    }
    // If path contains /, take the last segment (the actual folder name)
    if (storedPath.includes('/')) {
      return storedPath.split('/').pop() || storedPath;
    }
    return storedPath;
  };

  // Folder name: extract from stored path
  // Use ?? (nullish coalescing) not || so empty string "" is preserved (user intentionally cleared it)
  const storedPath = tab.folder_path ?? tab.storage_folder_path ?? '';
  const extractedFolderName = storedPath ? extractFolderName(storedPath, basePath) : '';
  // FRC Fix (Feb 2026): If folder_path is empty, use tab's display_name (not basePath segment)
  // This shows the tab's name instead of deriving from parent path
  const defaultFolderName = extractedFolderName || tab.display_name || '';
  // Edit path: only show what was actually stored (empty if folder_path is empty)
  const [editPath, setEditPath] = React.useState(extractedFolderName);
  const [editDisplayName, setEditDisplayName] = React.useState(tab.display_name || '');
  const [editSendName, setEditSendName] = React.useState(tab.download_name || '{{OriginalFileName}}');

  // Track previous isEditing state to only initialize on ENTRY to edit mode
  const wasEditingRef = React.useRef(false);
  React.useEffect(() => {
    // Only reset edit fields when ENTERING edit mode (false → true)
    // NOT when data changes during editing (that would overwrite user's changes)
    const shouldInit = isEditing && !wasEditingRef.current;
    console.log('[TabNode useEffect]', { isEditing, wasEditing: wasEditingRef.current, shouldInit, tabId: tab.id });
    if (shouldInit) {
      console.log('[TabNode useEffect] tab.folder_path:', JSON.stringify(tab.folder_path));
      console.log('[TabNode useEffect] tab.storage_folder_path:', JSON.stringify(tab.storage_folder_path));
      const stored = tab.folder_path ?? tab.storage_folder_path ?? '';
      console.log('[TabNode useEffect] stored (after ??):', JSON.stringify(stored));
      const folderName = stored ? extractFolderName(stored, basePath) : '';
      console.log('[TabNode useEffect] Initializing editPath to:', JSON.stringify(folderName));
      setEditPath(folderName);
      setEditDisplayName(tab.display_name || '');
      setEditSendName(tab.download_name || '{{OriginalFileName}}');
    }
    wasEditingRef.current = isEditing;
  }, [isEditing, tab.folder_path, tab.storage_folder_path, tab.display_name, tab.download_name, basePath]);

  // Build full path preview: rootPath + basePath + folderName
  const fullPathPreview = [rootPath, basePath, editPath]
    .filter(Boolean)
    .join('/')
    .replace(/\/+/g, '/');

  const tabFullPath = tab.storage_folder_path
    ? `${basePath}/${tab.storage_folder_path}`.replace(/\/+/g, '/')
    : basePath;

  // For simple scopes - inline editing with TokenBuilder
  if (isSimpleScope) {
    return (
      <div
        className={cn(
          "py-2 px-1 rounded-sm group",
          isEditing && "bg-blue-50 dark:bg-blue-900/20",
          !isEditing && "cursor-pointer hover:bg-muted/50"
        )}
        style={{ paddingLeft: `${level * 16 + 24}px` }}
        onClick={!isEditing ? (e) => { e.stopPropagation(); onStartEdit(tab.id); } : undefined}
        title={!isEditing ? "Click to edit" : undefined}
      >
        {/* Tab header row - show folder name from folder_path (resolved) */}
        <div className="flex items-center gap-1 mb-2">
          <FileText className="h-3.5 w-3.5 text-blue-500 dark:text-blue-400 flex-shrink-0" />
          <span className="text-sm font-medium">{resolveTemplatePreview(defaultFolderName || tab.display_name || '')}</span>
          {/* UI/DL badges for this tab */}
          <span
            className={cn(
              "px-1.5 py-0.5 rounded text-[9px] font-sans font-semibold",
              tab.ui_name
                ? "bg-green-500 text-white dark:bg-green-600"
                : "bg-orange-500 text-white dark:bg-orange-600"
            )}
            title={`UI Name: ${tab.ui_name || '{{OriginalFileName}} (default)'}`}
          >
            UI
          </span>
          <span
            className={cn(
              "px-1.5 py-0.5 rounded text-[9px] font-sans font-semibold",
              tab.download_name && tab.download_name !== '{{OriginalFileName}}'
                ? "bg-green-500 text-white dark:bg-green-600"
                : "bg-orange-500 text-white dark:bg-orange-600"
            )}
            title={`Download Name: ${tab.download_name || '{{OriginalFileName}} (default)'}`}
          >
            DL
          </span>
          {!isEditing && (
            <span className="text-[10px] text-muted-foreground ml-2 opacity-0 group-hover:opacity-100">(click to edit)</span>
          )}
        </div>

        {isEditing ? (
          <div className="space-y-3 ml-4 border-l-2 border-blue-200 dark:border-blue-800 pl-3">
            {/* SSoT: Standardized field order matches FolderEditPanel */}
            {/* 1. Root folder path (read-only) */}
            <div className="space-y-1">
              <span className="text-[11px] font-medium text-muted-foreground">Root Path</span>
              <div className="bg-muted/50 border border-muted rounded px-2 py-1.5">
                <span className="font-mono text-xs text-muted-foreground">
                  {rootPath || '/'}
                </span>
              </div>
            </div>

            {/* 2. Base Folder (inherited from parent scope - read-only for tabs) */}
            <div className="space-y-1">
              <span className="text-[11px] font-medium text-muted-foreground">
                Base Folder
                <span className="text-muted-foreground/70 ml-1">(inherited from {scope})</span>
              </span>
              <div className="bg-muted/50 border border-muted rounded px-2 py-1.5">
                <span className="font-mono text-xs text-muted-foreground">
                  {basePath.replace(/\/?\{\{TeeemXL\}\}|\{\{TabName\}\}/g, '').replace(/\/+$/, '') || '/'}
                </span>
              </div>
              <p className="text-[10px] text-muted-foreground">
                Base path inherited from parent scope. Edit Folder Path below to set the tab folder name.
              </p>
            </div>

            {/* 3. Folder Path - the folder name in storage */}
            <div className="space-y-1">
              <TokenBuilder
                label={<span className="text-[11px] font-medium text-muted-foreground">Folder Path</span>}
                value={editPath}
                onChange={setEditPath}
                scope={getWarehouseScopeForType(scope)}
                showPreview={false}
                separator="/"
                placeholder="e.g. TeeemXL"
                defaultExpanded={false}
              />
              {/* 4. Full path preview - append editPath to basePath (or replace placeholder if present) */}
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded px-2 py-1">
                <span className="text-[10px] text-muted-foreground font-medium">Full Path: </span>
                <span className="font-mono text-xs text-green-700 dark:text-green-400">
                  {(() => {
                    const hasPlaceholder = /\{\{TeeemXL\}\}|\{\{TabName\}\}/i.test(basePath);
                    const resolvedBase = hasPlaceholder
                      ? basePath.replace(/\{\{TeeemXL\}\}|\{\{TabName\}\}/gi, editPath || '...')
                      : basePath;
                    // FRC Fix: Always append editPath (even if basePath already has tokens like {{Year}})
                    const fullPath = hasPlaceholder
                      ? [rootPath, resolvedBase]  // Placeholder was replaced
                      : [rootPath, basePath, editPath].filter(Boolean);  // Append editPath
                    return fullPath.join('/').replace(/\/+/g, '/') || '/';
                  })()}
                </span>
              </div>
            </div>

            {/* 4. Document UI Name - what users see in UI */}
            <div className="space-y-1">
              <TokenBuilder
                label={<span className="text-[11px] font-medium text-muted-foreground">Document UI Name</span>}
                value={editDisplayName}
                onChange={setEditDisplayName}
                scope={getWarehouseScopeForType(scope)}
                showPreview={true}
                separator=" "
                placeholder="Name shown in UI..."
                defaultExpanded={false}
                defaultValue="{{OriginalFileName}}"
              />
            </div>

            {/* 5. Document Download Name template */}
            <div className="space-y-1">
              <TokenBuilder
                label={
                  <span className="text-[11px] font-medium text-muted-foreground">
                    Document Download Name
                    {(!tab.download_name || editSendName === '{{OriginalFileName}}') && (
                      <span className="ml-1.5 text-[9px] text-blue-500/70 font-normal">(default)</span>
                    )}
                  </span>
                }
                value={editSendName}
                onChange={setEditSendName}
                scope={getWarehouseScopeForType(scope)}
                showPreview={true}
                separator=" "
                placeholder="e.g. {{OriginalFileName}}"
                defaultExpanded={false}
              />
            </div>

            {/* Save/Cancel buttons */}
            <div className="flex gap-2 pt-1">
              <Button
                size="sm"
                onClick={() => {
                  // Use tab.display_name as fallback if editDisplayName is empty
                  const displayNameToSave = editDisplayName.trim() || tab.display_name || 'Untitled';

                  // FRC Fix (Feb 2026): If folder path is empty, save empty string
                  // Don't append basePath - empty means "use basePath directly"
                  // This prevents the loop where {{Year}} gets extracted and re-added
                  let fullPath: string;
                  if (!editPath.trim()) {
                    // Empty folder path = use basePath directly (save as empty)
                    fullPath = '';
                  } else {
                    // Has folder path - build full path
                    const hasPlaceholder = /\{\{TeeemXL\}\}|\{\{TabName\}\}/i.test(basePath);
                    fullPath = hasPlaceholder
                      ? basePath.replace(/\{\{TeeemXL\}\}|\{\{TabName\}\}/gi, editPath)
                      : [basePath, editPath].filter(Boolean).join('/').replace(/\/+/g, '/');
                  }

                  console.log('[TabNode Save] Clicked:', { tabId: tab.id, editPath, fullPath, displayNameToSave, editSendName, basePath });
                  onSaveEdit(tab.id, fullPath, displayNameToSave, editSendName);
                }}
                className="h-7 text-xs"
              >
                Save
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={onCancelEdit}
                className="h-7 text-xs"
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          // SSoT: Standardized field order matches editing state
          // Show folder path, document UI name, and download name when not editing
          <div className="ml-4 text-[11px] text-muted-foreground space-y-0.5">
            <div>
              <span className="font-medium">Folder Path: </span>
              <span className="font-mono">
                {(() => {
                  // If basePath has {{TeeemXL}} or {{TabName}}, replace it with the folder name
                  const hasPlaceholder = /\{\{TeeemXL\}\}|\{\{TabName\}\}/i.test(basePath);
                  if (hasPlaceholder) {
                    return [rootPath, basePath.replace(/\{\{TeeemXL\}\}|\{\{TabName\}\}/gi, defaultFolderName)]
                      .filter(Boolean).join('/').replace(/\/+/g, '/');
                  }
                  // FRC Fix (Feb 2026): Use extractedFolderName NOT defaultFolderName
                  // When folder_path equals basePath, extractedFolderName is empty (correct - no additional folder)
                  // defaultFolderName would incorrectly fallback to display_name and append it
                  return [rootPath, basePath, extractedFolderName]
                    .filter(Boolean).join('/').replace(/\/+/g, '/');
                })()}
              </span>
            </div>
            <div>
              <span className="font-medium">Document UI Name: </span>
              <span>{tab.display_name}</span>
            </div>
            <div>
              <span className="font-medium">Document Download Name: </span>
              <span className="font-mono">{tab.download_name || '{{OriginalFileName}}'}</span>
            </div>
          </div>
        )}
      </div>
    );
  }

  // For complex scopes - show tab with folder path, document types, and children
  const hasChildren = tab.children && tab.children.length > 0;
  const hasDocTypes = tab.document_types && tab.document_types.length > 0;
  const hasExpandableContent = hasChildren || hasDocTypes;
  const storedFolderPath = tab.folder_path || tab.storage_folder_path;

  // FRC Fix (Feb 2026): Extract parent folder name from basePath (first static segment)
  // When folder_path is empty/invalid, inherit this instead of showing bad data like {25}
  const getParentFolderName = (path: string | null | undefined): string => {
    if (!path) return '';
    const parts = path.split('/').filter(Boolean);
    for (const part of parts) {
      // Return first non-placeholder part
      if (!part.startsWith('{{') && !part.startsWith('[[')) {
        return part;
      }
    }
    return '';
  };

  // Check if storedFolderPath is valid (not empty, not just an ID like {25})
  const isValidFolderPath = storedFolderPath &&
    storedFolderPath.trim() !== '' &&
    !/^\{\d+\}$/.test(storedFolderPath.trim());

  // For child tabs (parent_id exists), use display_name as folder name
  // For root tabs, extract from stored path or fall back to base_folder column
  // FRC Fix: If folder_path is empty/invalid, use base_folder from database (SSoT)
  const isChildTab = !!tab.parent_id;
  const extractedName = isValidFolderPath ? extractFolderName(storedFolderPath, basePath) : '';
  // SSoT (Feb 2026): Use tab.base_folder directly instead of extracting from path
  const folderName = isChildTab
    ? (tab.display_name || '')
    : (extractedName || tab.base_folder || tab.display_name || '');

  // Compute this tab's full path (for passing to children as their basePath)
  // If basePath has {{TabName}}, replace it with folder name (root tabs)
  // If basePath has NO placeholder, append folder name (child tabs inherit + add own folder)
  const hasPlaceholder = /\{\{TabName\}\}|\{\{TeeemXL\}\}/i.test(basePath);
  const currentFullPath = folderName
    ? hasPlaceholder
      ? basePath.replace(/\{\{TabName\}\}/gi, folderName).replace(/\{\{TeeemXL\}\}/gi, folderName)
      : `${basePath}/${folderName}`
    : basePath;

  // Collapse state for this tab node
  const [isCollapsed, setIsCollapsed] = React.useState(true);

  return (
    <div>
      <div
        className="flex items-center gap-1 py-1 px-1 rounded-sm hover:bg-muted/50 group cursor-pointer"
        style={{ paddingLeft: `${level * 16 + 24}px` }}
        onClick={() => hasExpandableContent && setIsCollapsed(!isCollapsed)}
      >
        {/* Expand/collapse chevron */}
        {hasExpandableContent ? (
          <ChevronRight
            className={cn(
              "h-3.5 w-3.5 text-muted-foreground flex-shrink-0 transition-transform",
              !isCollapsed && "rotate-90"
            )}
          />
        ) : (
          <span className="w-3.5" /> // Spacer for alignment
        )}
        <FileText className="h-3.5 w-3.5 text-blue-500 dark:text-blue-400 flex-shrink-0" />
        {/* Show folder name (from folder_path), resolved if it contains tokens */}
        <span className="text-sm">{resolveTemplatePreview(folderName || tab.display_name || '')}</span>
        {/* UI/DL badges for this tab */}
        <span
          className={cn(
            "px-1.5 py-0.5 rounded text-[9px] font-sans font-semibold",
            tab.ui_name
              ? "bg-green-500 text-white dark:bg-green-600"
              : "bg-orange-500 text-white dark:bg-orange-600"
          )}
          title={`UI Name: ${tab.ui_name || '{{OriginalFileName}} (default)'}`}
        >
          UI
        </span>
        <span
          className={cn(
            "px-1.5 py-0.5 rounded text-[9px] font-sans font-semibold",
            tab.download_name && tab.download_name !== '{{OriginalFileName}}'
              ? "bg-green-500 text-white dark:bg-green-600"
              : "bg-orange-500 text-white dark:bg-orange-600"
          )}
          title={`Download Name: ${tab.download_name || '{{OriginalFileName}} (default)'}`}
        >
          DL
        </span>
        {/* Show document type count if has doc types */}
        {hasDocTypes && (
          <span className="text-[10px] px-1.5 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded">
            {tab.document_types!.length} {tab.document_types!.length === 1 ? 'type' : 'types'}
          </span>
        )}
        {/* SSoT (Feb 2026): Edit button for UI/DL names */}
        {onEditWarehouseFolder && (
          <button
            type="button"
            className="p-0.5 rounded hover:bg-muted opacity-0 group-hover:opacity-100 transition-opacity"
            title="Edit UI/DL name templates"
            onClick={(e) => {
              e.stopPropagation();
              onEditWarehouseFolder({
                id: tab.id,
                display_name: tab.display_name,
                folder_path: tab.folder_path || tab.storage_folder_path || undefined,
                download_name: tab.download_name || undefined,
                ui_name: tab.ui_name || undefined,
                base_folder_path_template: tab.base_folder_path_template || undefined,  // SSoT: Template from base_folders table
              });
            }}
          >
            <Settings className="h-3 w-3 text-muted-foreground" />
          </button>
        )}
      </div>
      {/* Collapsible content: folder path, document types, and children */}
      {!isCollapsed && (
        <>
          {/* Show FULL folder path: basePath (inherited) + tab folder name */}
          {(folderName || basePath) && (
            <div
              className="text-[10px] text-muted-foreground font-mono py-0.5"
              style={{ paddingLeft: `${level * 16 + 58}px` }}
            >
              📁 {currentFullPath}
            </div>
          )}
          {/* Show document types with their templates */}
          {hasDocTypes && (
            <div
              className="space-y-1.5 py-1"
              style={{ paddingLeft: `${level * 16 + 58}px` }}
            >
              {tab.document_types!.map((dt) => {
                // display_name contains the Document UI Name TEMPLATE (with tokens)
                // file_name contains the Document Download Name TEMPLATE (with tokens)
                // name is the actual document type name like "Xero Invoice"
                const uiNameTemplate = dt.display_name || dt.file_name || '';
                const downloadTemplate = dt.file_name || '';

                return (
                  <div key={dt.id} className="text-[10px] py-0.5">
                    {/* Document type name (actual name, not template) */}
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-foreground">
                        {dt.name}
                      </span>
                      {dt.abbreviation && (
                        <span className="text-muted-foreground/60 text-[9px]">({dt.abbreviation})</span>
                      )}
                    </div>
                    {/* Document UI Name and Download Name side by side */}
                    <div className="flex items-start gap-8 pl-2 mt-0.5">
                      {/* Document UI Name (left) */}
                      <div className="flex flex-col gap-0.5">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[9px] text-muted-foreground/50">👁</span>
                          <span className="font-mono text-[8px] text-muted-foreground/60">
                            {uiNameTemplate || '(default)'}
                          </span>
                        </div>
                        <span className="font-mono text-[9px] text-green-700 dark:text-green-400 pl-4">
                          {uiNameTemplate
                            ? resolveTemplatePreview(uiNameTemplate, dt)
                            : '(default)'}
                        </span>
                      </div>
                      {/* Document Download Name (right) */}
                      <div className="flex flex-col gap-0.5">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[9px] text-muted-foreground/50">📥</span>
                          <span className="font-mono text-[8px] text-muted-foreground/60">
                            {downloadTemplate || '(default)'}
                          </span>
                        </div>
                        <span className="font-mono text-[9px] text-blue-700 dark:text-blue-400 pl-4">
                          {downloadTemplate
                            ? resolveTemplatePreview(downloadTemplate, dt)
                            : '(default)'}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {/* Recursively render children - pass current full path as their basePath */}
          {hasChildren && tab.children!.map((child) => (
            <TabNode
              key={child.id}
              tab={child}
              level={level + 1}
              basePath={currentFullPath}
              rootPath={rootPath}
              scope={scope}
              editingTabId={editingTabId}
              onStartEdit={onStartEdit}
              onSaveEdit={onSaveEdit}
              onCancelEdit={onCancelEdit}
              onEditWarehouseFolder={onEditWarehouseFolder}
            />
          ))}
        </>
      )}
    </div>
  );
}

export function WarehouseProviderTab() {
  const { toast } = useToast();
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [testing, setTesting] = React.useState(false);
  const [config, setConfig] = React.useState<StorageConfig | null>(null);
  const [formData, setFormData] = React.useState({
    // Provider type (SSoT)
    provider_type: "sharepoint" as ProviderType,
    // SharePoint configuration
    sharepoint_site_url: "",
    sharepoint_site_id: "",
    sharepoint_drive_id: "",
    sharepoint_drive_name: "",
    // S3/Wasabi configuration
    s3_endpoint: "",
    s3_bucket: "",
    s3_region: "",
    // Root path
    root_path: "",  // SSoT: Matches backend field name
    // SSoT: warehouse_folders is THE ONE source for warehouse type roots
    // warehouse_folders REMOVED (Jan 2026 SSoT fix)
    warehouse_folders: {} as ScopeFolders,
    // SSoT: Templates for folder paths and filenames per warehouse type
    warehouse_folder_templates: {} as Record<string, string>,
    download_names: {} as Record<string, string>,  // Filename when downloading
    ui_name_templates: {} as Record<string, string>,  // Name shown in File Warehouse UI
    // SSoT: Config links for warehouse folders
    config_links: {} as Record<string, string>,
    // Phase 4: Virtual warehouses (render from DB instead of S3)
    virtual_warehouses: {} as Record<string, boolean>,
    // SM task exclusion setting
    exclude_sm_tasks: false,
    // Link expiry for presigned download URLs (days)
    link_expiry_days: 7,
  });
  // Tree view state
  const [expandedPaths, setExpandedPaths] = React.useState<Set<string>>(new Set());
  const [editingKey, setEditingKey] = React.useState<string | null>(null);
  const [editingTabId, setEditingTabId] = React.useState<number | null>(null);

  // Entity tabs for each scope
  const [entityTabs, setWarehouseTabConfigs] = React.useState<Record<string, WarehouseTabConfig[]>>({});
  const [loadingTabs, setLoadingTabs] = React.useState(false);

  // SSoT (Feb 2026): Base folders by warehouse type code from /api/v1/warehouse_types
  // This is THE ONE source of truth for folder category chips (not warehouse_folders)
  const [baseFoldersByScope, setBaseFoldersByScope] = React.useState<Record<string, BaseFolderFromAPI[]>>({});
  // SSoT (Feb 2026): Full warehouse types data for building folder tree
  const [warehouseTypes, setWarehouseTypes] = React.useState<WarehouseTypeFromAPI[]>([]);

  // SSoT (Feb 2026): Edit warehouse folder UI/DL names
  interface EditingWarehouseFolder {
    id: number;
    display_name: string;
    folder_path?: string;
    download_name?: string;
    ui_name?: string;
    base_folder_path_template?: string;  // SSoT: Template from base_folders table (read-only)
  }
  const [editingWarehouseFolder, setEditingWarehouseFolder] = React.useState<EditingWarehouseFolder | null>(null);
  const [warehouseFolderEditForm, setWarehouseFolderEditForm] = React.useState({
    folder_path: '',
    download_name: '',
    ui_name: '',
  });

  // Warehouse stats for live preview
  interface WarehouseStats {
    warehouse_total: number;
    warehouse_by_source: Record<string, number>;
    counts: Record<string, number>;  // All counts including tasks, templates, etc.
  }
  const [warehouseStats, setWarehouseStats] = React.useState<WarehouseStats | null>(null);
  const [loadingWarehouse, setLoadingWarehouse] = React.useState(false);
  const [showLivePreview, setShowLivePreview] = React.useState(false);

  // Load warehouse stats
  const loadWarehouseStats = async () => {
    setLoadingWarehouse(true);
    try {
      // Note: Backend returns counts at root level, not inside data
      const response = await api.get<{
        success: boolean;
        data: Record<string, unknown>;
        counts: Record<string, number | Record<string, number>>;
      }>("/api/v1/documents/all");
      if (response?.success && response.counts) {
        const counts = response.counts;
        setWarehouseStats({
          warehouse_total: (counts.warehouse_total as number) || 0,
          warehouse_by_source: (counts.warehouse_by_source as Record<string, number>) || {},
          counts: counts as Record<string, number>,
        });
      }
    } catch (error) {
      console.error("Failed to load warehouse stats:", error);
    } finally {
      setLoadingWarehouse(false);
    }
  };

  // Fetch entity tabs for all scopes
  // FRC (Jan 2026): Use per-scope error handling so one failing scope doesn't break all tabs
  const loadWarehouseTabConfigs = async () => {
    setLoadingTabs(true);
    try {
      const tabsByScope: Record<string, WarehouseTabConfig[]> = {};

      // Fetch tabs for each scope in parallel with per-scope error handling
      const scopeKeys = Object.keys(SCOPE_TO_API_SCOPE);
      const results = await Promise.all(
        scopeKeys.map(async (scopeKey) => {
          try {
            const apiScope = SCOPE_TO_API_SCOPE[scopeKey];
            const response = await api.get<{ success: boolean; data: { tabs: WarehouseTabConfig[] } }>(
              `/api/v1/warehouse_folders?scope=${apiScope}`
            );
            // Safely access nested properties
            const tabs = response?.success && response?.data?.tabs ? response.data.tabs : [];
            return { scopeKey, tabs };
          } catch (scopeError) {
            // Log but don't fail other scopes
            console.warn(`Failed to load entity tabs for scope ${scopeKey}:`, scopeError);
            return { scopeKey, tabs: [] };
          }
        })
      );

      results.forEach(({ scopeKey, tabs }) => {
        // Include all tabs (no parent_id filter - warehouse tabs may have parent)
        tabsByScope[scopeKey] = tabs;
      });

      setWarehouseTabConfigs(tabsByScope);
    } catch (error) {
      console.error("Failed to load entity tabs:", error);
    } finally {
      setLoadingTabs(false);
    }
  };

  // SSoT (Feb 2026): Fetch warehouse types to get base folders for each scope
  // base_folders are THE ONE source for folder category chips AND folder tree
  const loadWarehouseTypes = async () => {
    try {
      const response = await api.get<{
        success: boolean;
        data: WarehouseTypeFromAPI[];
      }>('/api/v1/warehouse_types');

      if (response?.success && response.data) {
        // Store full warehouse types for tree building
        setWarehouseTypes(response.data);

        // Build map of scope code → base_folders for quick lookup
        const foldersByScope: Record<string, BaseFolderFromAPI[]> = {};
        response.data.forEach((wt) => {
          // Use the warehouse type code as the scope key (e.g., "task", "job", "email")
          foldersByScope[wt.code] = wt.base_folders || [];
        });
        setBaseFoldersByScope(foldersByScope);
      }
    } catch (error) {
      console.error("Failed to load warehouse types:", error);
    }
  };

  // SSoT (Feb 2026): Start editing a warehouse folder's path and UI/DL names
  const startEditingWarehouseFolder = (folder: EditingWarehouseFolder) => {
    setEditingWarehouseFolder(folder);
    setWarehouseFolderEditForm({
      folder_path: folder.folder_path || '',
      download_name: folder.download_name || '',
      ui_name: folder.ui_name || '',
    });
  };

  // SSoT (Feb 2026): Save warehouse folder path and UI/DL names
  const saveWarehouseFolder = async () => {
    if (!editingWarehouseFolder) return;

    try {
      const response = await api.patch<{ success: boolean }>(`/api/v1/warehouse_folders/${editingWarehouseFolder.id}`, {
        warehouse_folder: {
          folder_path: warehouseFolderEditForm.folder_path || null,
          download_name: warehouseFolderEditForm.download_name || null,
          ui_name: warehouseFolderEditForm.ui_name || null,
        }
      });

      if (response?.success) {
        toast({
          title: "Saved",
          description: `Updated ${editingWarehouseFolder.display_name}`,
        });
        setEditingWarehouseFolder(null);
        // Reload warehouse types and tab configs to refresh the tree with new UI/DL values
        loadWarehouseTypes();
        loadWarehouseTabConfigs();
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save warehouse folder",
        variant: "destructive",
      });
      console.error('Failed to save warehouse folder:', error);
    }
  };

  // Build folder tree from base folders (SSoT: Feb 2026)
  // LIM: Direct tree build from base_folders - no intermediate transformation
  const folderTree = React.useMemo(() => {
    const root: FolderTreeNode[] = [];
    const isPlaceholder = (p: string) => p.startsWith('{{') || p.startsWith('[[');

    // Build tree directly from base folders
    Object.entries(baseFoldersByScope).forEach(([scopeCode, baseFolders]) => {
      baseFolders.forEach((bf) => {
        const path = bf.full_path_template;
        if (!path || isPlaceholder(path.split('/')[0])) return;

        // Parse path into static segments (skip placeholders)
        const staticParts = path.split('/').filter(p => p && !isPlaceholder(p));
        if (staticParts.length === 0) return;

        let current = root;
        let currentPath = '';
        let lastNode: FolderTreeNode | null = null;

        staticParts.forEach((part, index) => {
          currentPath = currentPath ? `${currentPath}/${part}` : part;
          const isFirstPart = index === 0;

          let node = current.find(n => n.name === part);
          if (!node) {
            node = {
              name: part,
              path: currentPath,
              scopeKey: isFirstPart ? scopeCode : null,
              scopeKeys: isFirstPart ? [scopeCode] : [],
              children: [],
            };
            current.push(node);
          } else if (isFirstPart && !node.scopeKeys.includes(scopeCode)) {
            node.scopeKeys.push(scopeCode);
            // Keep first scopeKey as primary
            if (!node.scopeKey) node.scopeKey = scopeCode;
          }

          lastNode = node;
          current = node.children;
        });

        // SSoT (Feb 2026): Attach base folder to its LEAF node for editing
        // This allows clicking on child folders like "Attachments" to edit them
        if (lastNode) {
          const leafNode = lastNode as FolderTreeNode;
          if (!leafNode.baseFolders) {
            leafNode.baseFolders = [];
          }
          // Only add if not already present
          if (!leafNode.baseFolders.find((existing: BaseFolderFromAPI) => existing.id === bf.id)) {
            leafNode.baseFolders.push(bf);
          }
        }
      });
    });

    // Sort root nodes alphabetically
    root.sort((a, b) => a.name.localeCompare(b.name));

    const tree = root;

    // Helper: Check if tab has doc types directly
    const tabHasDocTypes = (tab: WarehouseTabConfig): boolean => {
      return !!(tab.document_types && tab.document_types.length > 0);
    };

    // Helper: Check if tab or any descendants have doc types AND warehouse enabled
    // SSoT: Check warehouse_enabled (new) with fallback to has_storage_folder (legacy)
    // FRC (Feb 2026): Must include parent tabs if children have doc types
    // Example: Corporate has no direct doc types, but Tax/ID children do → include Corporate
    const hasDescendantWithDocTypes = (tab: WarehouseTabConfig): boolean => {
      const isWarehouseEnabled = tab.warehouse_enabled ?? tab.has_storage_folder;
      // This tab has warehouse + doc types directly
      if (isWarehouseEnabled && tabHasDocTypes(tab)) return true;
      // Or any child/descendant has doc types (recursive check)
      if (tab.children && tab.children.length > 0) {
        return tab.children.some(child => hasDescendantWithDocTypes(child));
      }
      return false;
    };

    // Helper: Filter tabs to those with document types (directly OR via children)
    // Keeps parent tabs if any children have doc types, filters children recursively
    const filterTabsWithDocTypes = (tabs: WarehouseTabConfig[]): WarehouseTabConfig[] => {
      return tabs
        .filter(tab => hasDescendantWithDocTypes(tab))
        .map(tab => ({
          ...tab,
          // Recursively filter children - only keep qualifying descendants
          children: tab.children ? filterTabsWithDocTypes(tab.children) : []
        }));
    };

    // SSoT (Feb 2026): All scopes show warehouse-enabled tabs for consistency
    // Previously corporate/job/contact required document types - now all show tabs
    const SCOPES_WITHOUT_DOC_TYPES = ['email', 'task', 'warehouse', 'user', 'case', 'corporate', 'job', 'contact'];

    // Helper: Filter tabs to warehouse-enabled only
    const filterWarehouseEnabledTabs = (tabs: WarehouseTabConfig[]): WarehouseTabConfig[] => {
      return tabs
        .filter(tab => (tab.warehouse_enabled ?? tab.has_storage_folder) === true)
        .map(tab => ({
          ...tab,
          children: tab.children ? filterWarehouseEnabledTabs(tab.children) : []
        }));
    };

    // Attach tabs to scope nodes
    // SSoT (Feb 2026): contact/job/corporate scopes show only tabs WITH document types
    // email/task/warehouse/user/case scopes show ALL warehouse-enabled tabs (no doc type requirement)
    const attachTabs = (nodes: FolderTreeNode[]) => {
      nodes.forEach(node => {
        if (node.scopeKey && entityTabs[node.scopeKey]) {
          const allTabs = entityTabs[node.scopeKey];
          // Scopes without doc types: show all warehouse-enabled tabs
          // Other scopes (contact, job, corporate): only show tabs with document types
          if (SCOPES_WITHOUT_DOC_TYPES.includes(node.scopeKey)) {
            node.tabs = filterWarehouseEnabledTabs(allTabs);
          } else {
            node.tabs = filterTabsWithDocTypes(allTabs);
          }
        }
        if (node.children.length > 0) {
          attachTabs(node.children);
        }
      });
    };

    // SSoT (Feb 2026): Attach ALL scope base folders to root nodes
    // This shows all base folders as chips on the scope root (e.g., Tasks shows Task, Task Attachments, Task Responses)
    // Individual base folders are already attached to leaf nodes during tree building above
    const attachScopeBaseFolders = (nodes: FolderTreeNode[]) => {
      nodes.forEach(node => {
        if (node.scopeKey && baseFoldersByScope[node.scopeKey]) {
          // For root scope nodes: show ALL base folders for that scope
          // Merge with any existing (don't overwrite leaf-attached base folders)
          const scopeFolders = baseFoldersByScope[node.scopeKey];
          if (!node.baseFolders) {
            node.baseFolders = scopeFolders;
          } else {
            // Merge: add scope folders that aren't already present
            scopeFolders.forEach(sf => {
              if (!node.baseFolders!.find(existing => existing.id === sf.id)) {
                node.baseFolders!.push(sf);
              }
            });
          }
        }
        if (node.children.length > 0) {
          attachScopeBaseFolders(node.children);
        }
      });
    };

    // SSoT (Feb 2026): Only attach base folders - no warehouse_folders tabs
    // FRC: base_folders table is THE source of truth for folder structure
    attachScopeBaseFolders(tree);
    return tree;
  }, [warehouseTypes, baseFoldersByScope]);

  // SSoT (Feb 2026): Build scopeRootFolders from warehouse types
  // FRC: warehouse_type.folder_path_template IS the scope root path - no fallbacks
  const scopeRootFoldersFromWarehouseTypes = React.useMemo(() => {
    const folders: Record<string, string> = {};
    warehouseTypes.forEach((wt) => {
      if (wt.folder_path_template) {
        folders[wt.code] = wt.folder_path_template;
      }
    });
    return folders;
  }, [warehouseTypes]);

  // Toggle tree node expansion
  const toggleExpanded = (path: string) => {
    const isCollapsing = expandedPaths.has(path);

    setExpandedPaths(prev => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });

    // When collapsing, also close any edit panels for scopes at or under this path
    if (isCollapsing && editingKey) {
      const scopesAtPath = Object.entries(formData.warehouse_folders)
        .filter(([, folderPath]) => folderPath === path || folderPath.startsWith(path + '/'))
        .map(([scopeKey]) => scopeKey);
      if (scopesAtPath.includes(editingKey)) {
        setEditingKey(null);
      }
    }
  };

  // Save tab settings via API
  const saveTabFolderPath = async (
    tabId: number,
    folderPath: string,
    displayName: string,
    sendNameTemplate: string
  ) => {
    try {
      console.log('[saveTabFolderPath] Saving:', { tabId, folderPath, displayName, sendNameTemplate });
      const response = await api.patch<{ success: boolean; error?: string; data?: WarehouseTabConfig }>(
        `/api/v1/warehouse_folders/${tabId}`,
        {
          warehouse_folder: {
            display_name: displayName,
            folder_path: folderPath,
            download_name: sendNameTemplate,
          }
        }
      );
      console.log('[saveTabFolderPath] Response:', response);
      if (response?.success) {
        // SSoT: Use RESPONSE data if available, not sent values
        // Backend might transform/normalize values (e.g., empty string handling)
        const savedData = response.data;
        const savedFolderPath = savedData?.folder_path ?? folderPath;
        const savedDisplayName = savedData?.display_name ?? displayName;
        const savedSendName = savedData?.download_name ?? sendNameTemplate;

        console.log('[saveTabFolderPath] Using values:', { savedFolderPath, savedDisplayName, savedSendName });

        // Update local state with response data (SSoT)
        setWarehouseTabConfigs(prev => {
          const newTabs = { ...prev };
          Object.keys(newTabs).forEach(scope => {
            newTabs[scope] = newTabs[scope].map(tab =>
              tab.id === tabId
                ? {
                    ...tab,
                    display_name: savedDisplayName,
                    folder_path: savedFolderPath,
                    storage_folder_path: savedFolderPath,  // Legacy alias
                    download_name: savedSendName
                  }
                : tab
            );
          });
          return newTabs;
        });
        toast({
          title: "Saved",
          description: "Tab storage settings updated",
        });
      }
    } catch (error) {
      console.error("Failed to save tab settings:", error);
      toast({
        title: "Error",
        description: "Failed to save tab settings",
        variant: "destructive",
      });
    } finally {
      setEditingTabId(null);
    }
  };

  // SSoT: Save scope templates via API (called by auto-save in TreeNode)
  const saveScopeTemplates = React.useCallback(async (
    scopeKey: string,
    baseFolder: string,
    folderTemplate: string,
    downloadNameTemplate: string,
    uiNameTemplate: string,
    configLink: string | null
  ) => {
    // DEBUG: Log all save parameters
    console.log('🔵 [saveScopeTemplates] Called with:', {
      scopeKey,
      baseFolder,
      folderTemplate,
      downloadNameTemplate,
      uiNameTemplate,
      configLink,
    });

    try {
      // SSoT (Feb 2026): base_folder.full_path_template is the SSoT
      // folderTemplate already contains the complete path - save it directly
      const warehouseFolderValue = folderTemplate
        .replace(/\/+/g, '/')
        .replace(/\/+$/, '');

      console.log('🔵 [saveScopeTemplates] Saving folder path:', warehouseFolderValue);

      // FRC Guard (Feb 2026): Prevent saving empty folder_path for root scopes
      // This would remove the scope from the tree entirely and break folder storage
      if (!warehouseFolderValue || warehouseFolderValue.trim() === '') {
        toast({
          title: "Cannot save",
          description: "Folder path cannot be empty. The scope needs a base folder path.",
          variant: "destructive"
        });
        return;
      }

      const payload = {
        storage: {
          warehouse_folders: { [scopeKey]: warehouseFolderValue },
          warehouse_folder_templates: { [scopeKey]: folderTemplate },
          download_names: { [scopeKey]: downloadNameTemplate },
          ui_name_templates: { [scopeKey]: uiNameTemplate },
          config_links: { [scopeKey]: configLink }, // null removes the link
        }
      };
      console.log('🔵 [saveScopeTemplates] API payload:', JSON.stringify(payload, null, 2));

      const response = await api.patch<{ success: boolean; data: StorageConfig }>(
        "/api/v1/warehouse_provider",
        payload
      );
      console.log('🔵 [saveScopeTemplates] API response:', response);

      if (response?.success) {
        // Update local state to reflect saved values
        setFormData(prev => {
          const newConfigLinks = { ...prev.config_links };
          if (configLink) {
            newConfigLinks[scopeKey] = configLink;
          } else {
            delete newConfigLinks[scopeKey];
          }
          return {
            ...prev,
            warehouse_folders: { ...prev.warehouse_folders, [scopeKey]: warehouseFolderValue },
            warehouse_folder_templates: { ...prev.warehouse_folder_templates, [scopeKey]: folderTemplate },
            download_names: { ...prev.download_names, [scopeKey]: downloadNameTemplate },
            ui_name_templates: { ...prev.ui_name_templates, [scopeKey]: uiNameTemplate },
            config_links: newConfigLinks,
          };
        });
      } else {
        throw new Error('Failed to save templates');
      }
    } catch (error) {
      console.error("Failed to save scope templates:", error);
      toast({
        title: "Error",
        description: "Failed to save templates",
        variant: "destructive",
      });
      throw error; // Re-throw so auto-save can handle it
    }
  }, [toast, formData.warehouse_folders]);

  // Phase 4: Toggle virtual warehouse via API
  const toggleVirtualScope = React.useCallback(async (scopeKey: string, isVirtual: boolean) => {
    try {
      const response = await api.patch<{ success: boolean; data: StorageConfig }>(
        "/api/v1/warehouse_provider",
        {
          storage: {
            virtual_warehouses: { [scopeKey]: isVirtual },
          }
        }
      );
      if (response?.success) {
        // Update local state
        setFormData(prev => ({
          ...prev,
          virtual_warehouses: { ...prev.virtual_warehouses, [scopeKey]: isVirtual },
        }));
        toast({
          title: "Saved",
          description: `${scopeKey} is now ${isVirtual ? 'virtual (database-driven)' : 'physical (S3-driven)'}`,
        });
      } else {
        throw new Error('Failed to save virtual warehouse setting');
      }
    } catch (error) {
      console.error("Failed to toggle virtual warehouse:", error);
      toast({
        title: "Error",
        description: "Failed to save virtual warehouse setting",
        variant: "destructive",
      });
    }
  }, [toast]);

  // Collect all expandable paths (for expand/collapse all)
  const allExpandablePaths = React.useMemo(() => {
    const allPaths = new Set<string>();
    const collectPaths = (nodes: FolderTreeNode[]) => {
      nodes.forEach(node => {
        const hasExpandableContent = node.children.length > 0 || (node.tabs && node.tabs.length > 0);
        if (hasExpandableContent) {
          allPaths.add(node.path);
          collectPaths(node.children);
        }
      });
    };
    collectPaths(folderTree);
    return allPaths;
  }, [folderTree]);

  // Expand/collapse all handlers
  const expandAll = React.useCallback(() => {
    setExpandedPaths(new Set(allExpandablePaths));
  }, [allExpandablePaths]);

  const collapseAll = React.useCallback(() => {
    setExpandedPaths(new Set());
  }, []);

  // Load storage config and warehouse types on mount
  // SSoT (Feb 2026): Only load warehouse_types - no warehouse_folders
  // FRC: base_folders (via warehouse_types API) is THE source of truth
  React.useEffect(() => {
    loadConfig();
    loadWarehouseTypes();
  }, []);

  const loadConfig = async () => {
    try {
      setLoading(true);
      console.log('🔴 [loadConfig] Fetching storage config...');
      const response = await api.get<{ success: boolean; data: StorageConfig }>(
        "/api/v1/warehouse_provider"
      );
      console.log('🔴 [loadConfig] Response:', response);
      if (response?.success && response.data) {
        console.log('🔴 [loadConfig] warehouse_folders:', response.data.warehouse_folders);
        console.log('🔴 [loadConfig] warehouse_folder_templates:', response.data.warehouse_folder_templates);
        console.log('🔴 [loadConfig] download_names:', response.data.download_names);
        console.log('🔴 [loadConfig] ui_name_templates:', response.data.ui_name_templates);
        setConfig(response.data);
        setFormData({
          // Provider type - normalize legacy values (wasabi/s3 → s3_compatible)
          provider_type: normalizeProviderType(response.data.provider_type),
          // SharePoint connection
          sharepoint_site_url: response.data.site_url || "",
          sharepoint_site_id: response.data.site_id || "",
          sharepoint_drive_id: response.data.drive_id || "",
          sharepoint_drive_name: response.data.drive_name || "",
          // S3/Wasabi connection
          s3_endpoint: response.data.endpoint || "",
          s3_bucket: response.data.bucket || "",
          s3_region: response.data.region || "",
          // Root path
          root_path: response.data.root_path || "",
          // SSoT: warehouse_folders is THE ONE source for warehouse type roots
          // warehouse_folders REMOVED (Jan 2026 SSoT fix)
          warehouse_folders: response.data.warehouse_folders || {},
          // SSoT: Templates from WarehouseProvider
          // Support both old (file_name_templates/display_name_templates) and new (download_names/ui_name_templates) field names
          warehouse_folder_templates: response.data.warehouse_folder_templates || {},
          download_names: response.data.download_names || response.data.file_name_templates || {},
          ui_name_templates: response.data.ui_name_templates || response.data.display_name_templates || {},
          // SSoT: Config links from WarehouseProvider
          config_links: response.data.config_links || {},
          // Phase 4: Virtual warehouses from WarehouseProvider
          virtual_warehouses: response.data.virtual_warehouses || {},
          // SM task exclusion setting
          exclude_sm_tasks: response.data.exclude_sm_tasks ?? false,
          // Link expiry for presigned download URLs (days)
          link_expiry_days: response.data.link_expiry_days || 7,
        });
      }
    } catch (error) {
      console.error("Failed to load storage config:", error);
      toast({
        title: "Error",
        description: "Failed to load storage configuration",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      // Include provider_type and S3/Wasabi fields in save
      const response = await api.patch<{ success: boolean; data: StorageConfig }>(
        "/api/v1/warehouse_provider",
        {
          storage: {
            provider_type: formData.provider_type,
            root_path: formData.root_path,
            // SSoT: warehouse_folders is THE ONE place for warehouse type roots
            warehouse_folders: config?.warehouse_folders,
            warehouse_folder_templates: formData.warehouse_folder_templates,
            download_names: formData.download_names,
            ui_name_templates: formData.ui_name_templates,
            config_links: formData.config_links,
            virtual_warehouses: formData.virtual_warehouses,  // Phase 4: Virtual File Warehouse
            exclude_sm_tasks: formData.exclude_sm_tasks,      // SM task exclusion setting
            link_expiry_days: formData.link_expiry_days,      // Download link expiry (days)
            // Map SharePoint fields (frontend uses sharepoint_* prefix, backend expects bare names)
            site_url: formData.sharepoint_site_url,
            site_id: formData.sharepoint_site_id,
            drive_id: formData.sharepoint_drive_id,
            drive_name: formData.sharepoint_drive_name,
            // Map S3/Wasabi fields (frontend uses s3_* prefix, backend expects bare names)
            endpoint: formData.s3_endpoint,
            bucket: formData.s3_bucket,
            region: formData.s3_region,
          }
        }
      );
      if (response?.success) {
        setConfig(response.data);
        const providerLabel = PROVIDER_OPTIONS.find(p => p.value === formData.provider_type)?.label || "Storage";
        toast({
          title: "Saved",
          description: `${providerLabel} configuration updated successfully`,
        });
      }
    } catch (error: unknown) {
      console.error('[StorageConfig] Save error:', error);
      const err = error as { message?: string; data?: { errors?: string[] } };
      const errorMessage = err?.data?.errors?.join(', ') || err?.message || "Failed to save storage configuration";
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    try {
      setTesting(true);
      const response = await api.post<{ success: boolean; message?: string; error?: string; provider?: string; details?: { name?: string; web_url?: string } }>(
        "/api/v1/warehouse_provider/test"
      );
      if (response?.success) {
        toast({
          title: "Connection Successful",
          description: `Connected to ${response.details?.name || "cloud storage"}`,
        });
      } else {
        toast({
          title: "Connection Failed",
          description: response?.error || "Could not connect to storage",
          variant: "destructive",
        });
      }
    } catch (error: unknown) {
      const err = error as { message?: string };
      toast({
        title: "Connection Failed",
        description: err?.message || "Could not connect to storage",
        variant: "destructive",
      });
    } finally {
      setTesting(false);
    }
  };

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner size={32} className="text-muted-foreground" />
      </div>
    );
  }

  // Get current provider info
  const currentProvider = PROVIDER_OPTIONS.find(p => p.value === formData.provider_type) || PROVIDER_OPTIONS[0];

  return (
    <div className="space-y-6">
      {/* Header with Provider Selector */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Storage Configuration</h2>
          <p className="text-sm text-muted-foreground">
            Configure storage provider connection settings
          </p>
        </div>
        <Badge
          variant={config?.configured ? "default" : "secondary"}
          className={cn(
            "gap-1",
            config?.configured && "bg-status-success text-status-success-foreground dark:bg-green-900/30 dark:text-green-400"
          )}
        >
          {config?.configured ? (
            <>
              <CheckCircle2 className="h-3 w-3" />
              Connected
            </>
          ) : (
            <>
              <AlertCircle className="h-3 w-3" />
              Not Configured
            </>
          )}
        </Badge>
      </div>

      {/* Tabs: Setup Info, Configuration, Live Preview */}
      <Tabs defaultValue="config" className="w-full">
        <TabsList className="grid w-full grid-cols-3 max-w-xl">
          <TabsTrigger value="setup" className="flex items-center gap-2">
            <BookOpen className="h-4 w-4" />
            Setup Info
          </TabsTrigger>
          <TabsTrigger value="config" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Configuration
          </TabsTrigger>
          <TabsTrigger value="preview" className="flex items-center gap-2" onClick={() => {
            if (!warehouseStats) loadWarehouseStats();
          }}>
            <Eye className="h-4 w-4" />
            Live Preview
          </TabsTrigger>
        </TabsList>

        {/* Setup Info Tab - SSoT Documentation */}
        <TabsContent value="setup" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <BookOpen className="h-4 w-4" />
                WarehouseProvider SSoT Guide
              </CardTitle>
              <CardDescription>
                How folder paths are configured and where they&apos;re stored
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Overview */}
              <div className="rounded-lg border bg-muted/30 p-4">
                <h4 className="font-medium mb-2 flex items-center gap-2">
                  <Layers className="h-4 w-4 text-blue-500" />
                  Overview
                </h4>
                <p className="text-sm text-muted-foreground">
                  This page configures <strong>virtual folder paths</strong> for the File Warehouse.
                  All settings save to <code className="bg-muted px-1 rounded">WarehouseProvider.warehouse_folders</code> (SSoT).
                </p>
              </div>

              {/* Path Hierarchy */}
              <div className="space-y-3">
                <h4 className="font-medium flex items-center gap-2">
                  <FolderTree className="h-4 w-4 text-amber-500" />
                  Path Hierarchy
                </h4>
                <div className="grid gap-3">
                  {/* Root Path */}
                  <div className="rounded-lg border p-3 bg-card">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline" className="text-xs">1</Badge>
                      <span className="font-medium text-sm">Root Path</span>
                      <Badge variant="secondary" className="text-xs">Read-only</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground ml-6">
                      Comes from Storage Provider config (e.g., <code className="bg-muted px-1 rounded">/</code> or <code className="bg-muted px-1 rounded">/Documents</code>).
                      This is where your S3 bucket or SharePoint site root is.
                    </p>
                  </div>

                  {/* Base Folder */}
                  <div className="rounded-lg border p-3 bg-card">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline" className="text-xs">2</Badge>
                      <span className="font-medium text-sm">Folder Path</span>
                    </div>
                    <p className="text-xs text-muted-foreground ml-6">
                      The folder path for each scope. Most scopes store <strong>full paths</strong> (e.g., <code className="bg-muted px-1 rounded">Tasks/{"{{TaskId}}"}/{"{{TaskName}}"}/Attachments</code>).
                      Some scopes (case, email, asset) use suffix derivation from a parent.
                    </p>
                  </div>

                  {/* Child Scope Note */}
                  <div className="rounded-lg border p-3 bg-card border-dashed">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline" className="text-xs text-muted-foreground">Note</Badge>
                      <span className="font-medium text-sm text-muted-foreground">Suffix Derivation (some scopes)</span>
                    </div>
                    <p className="text-xs text-muted-foreground ml-6">
                      Case, email, and asset sub-scopes store only a suffix (e.g., <code className="bg-muted px-1 rounded">Documents</code>) and derive their base from the parent scope.
                      Task scopes use full paths - no derivation needed.
                    </p>
                  </div>
                </div>
              </div>

              {/* Example */}
              <div className="space-y-3">
                <h4 className="font-medium flex items-center gap-2">
                  <ArrowRight className="h-4 w-4 text-green-500" />
                  Example: Task Attachments
                </h4>
                <div className="rounded-lg border bg-muted/20 p-4 font-mono text-sm space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground w-24">Root Path:</span>
                    <span>/</span>
                    <Badge variant="outline" className="text-xs">S3 bucket root</Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground w-24">+ Folder:</span>
                    <span>Tasks/{"{{TaskId}}"}/{"{{TaskName}}"}/Attachments</span>
                    <Badge variant="outline" className="text-xs">full path stored</Badge>
                  </div>
                  <div className="border-t pt-2 mt-2">
                    <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                      <span className="text-muted-foreground w-24">= Result:</span>
                      <span>/Tasks/123/my-task/Attachments</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* SSoT Storage */}
              <div className="space-y-3">
                <h4 className="font-medium flex items-center gap-2">
                  <Database className="h-4 w-4 text-purple-500" />
                  SSoT: Where It&apos;s Stored
                </h4>
                <div className="rounded-lg border p-3 bg-card">
                  <div className="text-sm space-y-2">
                    <div className="flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5" />
                      <div>
                        <span className="font-medium">Parent scopes</span>
                        <span className="text-muted-foreground"> store full base path</span>
                        <div className="text-xs text-muted-foreground mt-1">
                          <code className="bg-muted px-1 rounded">warehouse_folders.task = &quot;Tasks/{"{{TaskId}}"}/{"{{TaskName}}"}&quot;</code>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5" />
                      <div>
                        <span className="font-medium">Child scopes</span>
                        <span className="text-muted-foreground"> store suffix only</span>
                        <div className="text-xs text-muted-foreground mt-1">
                          <code className="bg-muted px-1 rounded">warehouse_folders.task_responses = &quot;Responses&quot;</code>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Root Path Source */}
              <div className="space-y-3">
                <h4 className="font-medium flex items-center gap-2">
                  <HardDrive className="h-4 w-4 text-slate-500" />
                  Where Root Path Comes From
                </h4>
                <div className="rounded-lg border p-3 bg-card">
                  <p className="text-sm text-muted-foreground mb-3">
                    Root Path is configured in the <strong>Configuration</strong> tab under <strong>Storage Provider</strong>.
                    It depends on which provider you&apos;re using:
                  </p>
                  <div className="grid gap-2 text-xs">
                    <div className="flex items-start gap-2 p-2 rounded bg-muted/30">
                      <Database className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
                      <div>
                        <span className="font-medium">Wasabi / S3:</span>
                        <span className="text-muted-foreground ml-1">
                          Root path is relative to your bucket (e.g., <code className="bg-muted px-1 rounded">/</code> for bucket root)
                        </span>
                      </div>
                    </div>
                    <div className="flex items-start gap-2 p-2 rounded bg-muted/30">
                      <Cloud className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
                      <div>
                        <span className="font-medium">SharePoint:</span>
                        <span className="text-muted-foreground ml-1">
                          Root path is the folder within your SharePoint site/drive (e.g., <code className="bg-muted px-1 rounded">/Documents</code>)
                        </span>
                      </div>
                    </div>
                    <div className="flex items-start gap-2 p-2 rounded bg-muted/30">
                      <HardDrive className="h-4 w-4 text-slate-500 mt-0.5 flex-shrink-0" />
                      <div>
                        <span className="font-medium">Local Storage:</span>
                        <span className="text-muted-foreground ml-1">
                          Root path is the directory on the server (development only)
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Document Types */}
              <div className="space-y-3">
                <h4 className="font-medium flex items-center gap-2">
                  <FileText className="h-4 w-4 text-indigo-500" />
                  Document Types & Folder Structure
                </h4>
                <div className="rounded-lg border p-3 bg-card">
                  <p className="text-sm text-muted-foreground mb-3">
                    Document Types add an extra layer of organization <strong>within</strong> each scope folder:
                  </p>
                  <div className="rounded-lg border bg-muted/20 p-4 font-mono text-xs space-y-1">
                    <div className="text-muted-foreground">📁 Jobs/</div>
                    <div className="text-muted-foreground ml-4">📁 J-001/</div>
                    <div className="text-muted-foreground ml-8">📁 Plans/</div>
                    <div className="text-indigo-600 dark:text-indigo-400 ml-12">📄 Floor Plan.pdf <span className="text-muted-foreground">← Doc Type: Plan</span></div>
                    <div className="text-muted-foreground ml-8">📁 Invoices/</div>
                    <div className="text-indigo-600 dark:text-indigo-400 ml-12">📄 Invoice-001.pdf <span className="text-muted-foreground">← Doc Type: Invoice</span></div>
                    <div className="text-muted-foreground ml-8">📁 Contracts/</div>
                    <div className="text-indigo-600 dark:text-indigo-400 ml-12">📄 Contract.pdf <span className="text-muted-foreground">← Doc Type: Contract</span></div>
                  </div>
                  <div className="mt-3 text-xs text-muted-foreground">
                    <strong>Configure Document Types:</strong> Use the <strong>Document Types</strong> tab above to create and manage document types.
                    Each type can specify which scopes it applies to (Jobs, Contacts, Corporate, etc.).
                  </div>
                </div>
              </div>

              {/* How It All Fits Together */}
              <div className="space-y-3">
                <h4 className="font-medium flex items-center gap-2">
                  <Layers className="h-4 w-4 text-emerald-500" />
                  How It All Fits Together
                </h4>
                <div className="rounded-lg border p-3 bg-card">
                  <div className="grid gap-2 text-sm">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs w-6 justify-center">1</Badge>
                      <span><strong>WarehouseProvider</strong> defines storage provider (S3/SharePoint/Local) + connection</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs w-6 justify-center">2</Badge>
                      <span><strong>Root Path</strong> is the starting point within that provider</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs w-6 justify-center">3</Badge>
                      <span><strong>WarehouseFolder</strong> (SSoT) defines folder hierarchy: scopes → tabs → document types</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs w-6 justify-center">4</Badge>
                      <span><strong>WarehouseDocument</strong> stores virtual folder path for each document</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs w-6 justify-center">5</Badge>
                      <span><strong>File Warehouse</strong> builds tree from WarehouseFolder config + WarehouseDocument data</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* File Warehouse Integration */}
              <div className="rounded-lg border bg-blue-50 dark:bg-blue-950/30 p-4 space-y-4">
                <h4 className="font-medium flex items-center gap-2">
                  <FileBox className="h-4 w-4 text-blue-500" />
                  File Warehouse Integration
                </h4>

                {/* SSoT Architecture */}
                <div className="space-y-3">
                  <div className="text-sm space-y-2">
                    <div className="flex items-start gap-2">
                      <span className="bg-blue-500 text-white text-xs px-1.5 py-0.5 rounded font-medium shrink-0">SSoT</span>
                      <span><code className="bg-muted px-1 rounded text-xs">WarehouseDocument</code> is the single source of truth for ALL document metadata. It stores display names, folder paths, file info, and links to the actual file content via <code className="bg-muted px-1 rounded text-xs">StorageBlob</code>.</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="bg-green-500 text-white text-xs px-1.5 py-0.5 rounded font-medium shrink-0">Structure</span>
                      <span><code className="bg-muted px-1 rounded text-xs">WarehouseFolder</code> defines the visual folder hierarchy (this config). The File Warehouse tree combines configured folders with actual documents.</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="bg-purple-500 text-white text-xs px-1.5 py-0.5 rounded font-medium shrink-0">Virtual</span>
                      <span>Folder paths are <strong>virtual</strong> - stored in <code className="bg-muted px-1 rounded text-xs">WarehouseDocument.folder</code>, not as actual S3/storage folders. Moving documents is instant (just update the path).</span>
                    </div>
                  </div>
                </div>

                {/* How the Tree is Built */}
                <div className="border-t pt-3">
                  <h5 className="text-xs font-medium mb-2 text-muted-foreground uppercase tracking-wide">How the Folder Tree is Built</h5>
                  <div className="text-xs space-y-1.5 text-muted-foreground">
                    <div><strong className="text-foreground">Base folders</strong> → from <code className="bg-muted px-1 rounded">WarehouseFolder.all_base_folders</code> (Jobs, Contacts, Tasks, etc.)</div>
                    <div><strong className="text-foreground">Subfolders</strong> → from <code className="bg-muted px-1 rounded">WarehouseFolder.tabs_for_base_folder()</code> + <code className="bg-muted px-1 rounded">GROUP BY</code> on <code className="bg-muted px-1 rounded">WarehouseDocument.folder</code></div>
                    <div><strong className="text-foreground">Files</strong> → from <code className="bg-muted px-1 rounded">WarehouseDocument</code> records at that folder path</div>
                  </div>
                </div>

                {/* Key Insight */}
                <div className="border-t pt-3">
                  <div className="text-xs bg-amber-100 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 rounded p-2">
                    <strong className="text-amber-700 dark:text-amber-400">Key insight:</strong> <span className="text-amber-800 dark:text-amber-300">Source models (JobDocument, ContactDocument, etc.) are legacy. WarehouseDocument contains all metadata needed - the polymorphic <code className="bg-amber-200/50 dark:bg-amber-900/50 px-1 rounded">documentable</code> reference is only for historical linking, not for browsing.</span>
                  </div>
                </div>
              </div>

              {/* Available Tokens */}
              <div className="space-y-3">
                <h4 className="font-medium flex items-center gap-2">
                  <Settings className="h-4 w-4 text-cyan-500" />
                  Available Tokens (Path Variables)
                </h4>
                <div className="rounded-lg border p-3 bg-card">
                  <p className="text-sm text-muted-foreground mb-3">
                    Tokens are placeholders in folder paths that get resolved to actual values when documents are saved:
                  </p>
                  <div className="grid md:grid-cols-2 gap-4">
                    {/* Job Tokens */}
                    <div className="space-y-2">
                      <h5 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Job Tokens</h5>
                      <div className="text-xs space-y-1">
                        <div><code className="bg-muted px-1 rounded">{"{{JobCode}}"}</code> → <span className="text-muted-foreground">J-001</span></div>
                        <div><code className="bg-muted px-1 rounded">{"{{JobName}}"}</code> → <span className="text-muted-foreground">Smith Renovation</span></div>
                        <div><code className="bg-muted px-1 rounded">{"{{JobTitle}}"}</code> → <span className="text-muted-foreground">Kitchen Extension</span></div>
                        <div><code className="bg-muted px-1 rounded">{"{{JobStatus}}"}</code> → <span className="text-muted-foreground">Active</span></div>
                      </div>
                    </div>
                    {/* Task Tokens */}
                    <div className="space-y-2">
                      <h5 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Task Tokens</h5>
                      <div className="text-xs space-y-1">
                        <div><code className="bg-muted px-1 rounded">{"{{TaskId}}"}</code> → <span className="text-muted-foreground">1234</span></div>
                        <div><code className="bg-muted px-1 rounded">{"{{TaskName}}"}</code> → <span className="text-muted-foreground">Site Inspection</span></div>
                        <div><code className="bg-muted px-1 rounded">{"{{TaskStatus}}"}</code> → <span className="text-muted-foreground">Pending</span></div>
                      </div>
                    </div>
                    {/* Contact Tokens */}
                    <div className="space-y-2">
                      <h5 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Contact Tokens</h5>
                      <div className="text-xs space-y-1">
                        <div><code className="bg-muted px-1 rounded">{"{{ContactName}}"}</code> → <span className="text-muted-foreground">John Smith</span></div>
                        <div><code className="bg-muted px-1 rounded">{"{{CompanyName}}"}</code> → <span className="text-muted-foreground">Acme Corp</span></div>
                      </div>
                    </div>
                    {/* Date/File Tokens */}
                    <div className="space-y-2">
                      <h5 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Date & File Tokens</h5>
                      <div className="text-xs space-y-1">
                        <div><code className="bg-muted px-1 rounded">{"{{Year}}"}</code> → <span className="text-muted-foreground">2026</span></div>
                        <div><code className="bg-muted px-1 rounded">{"{{Month}}"}</code> → <span className="text-muted-foreground">01</span></div>
                        <div><code className="bg-muted px-1 rounded">{"{{Date}}"}</code> → <span className="text-muted-foreground">2026-01-29</span></div>
                        <div><code className="bg-muted px-1 rounded">{"{{OriginalFileName}}"}</code> → <span className="text-muted-foreground">invoice.pdf</span></div>
                      </div>
                    </div>
                  </div>
                  {/* Dynamic Tokens */}
                  <div className="mt-4 pt-3 border-t">
                    <h5 className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-2 mb-2">
                      <Zap className="h-3 w-3 text-purple-500" />
                      Dynamic Tokens
                    </h5>
                    <p className="text-xs text-muted-foreground mb-2">
                      Dynamic tokens auto-expand to show folders from database records:
                    </p>
                    <div className="text-xs space-y-1">
                      <div>
                        <code className="bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 px-1 rounded">{"{{Mailbox}}"}</code>
                        <span className="text-muted-foreground ml-2">→ Shows all synced mailbox addresses as folders</span>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      Single-click opens a drawer with emails. Double-click opens full email view in new window.
                    </p>
                  </div>
                  {/* Token Resolution Example */}
                  <div className="mt-4 pt-3 border-t">
                    <h5 className="text-xs font-medium mb-2">Example: Token Resolution</h5>
                    <div className="rounded bg-muted/30 p-3 font-mono text-xs space-y-1">
                      <div className="text-muted-foreground">Template: <span className="text-foreground">Tasks/{"{{TaskId}}"}/{"{{TaskName}}"}/Attachments</span></div>
                      <div className="text-muted-foreground">Context: <span className="text-foreground">TaskId=1234, TaskName=&quot;Site Inspection&quot;</span></div>
                      <div className="border-t my-2 border-dashed" />
                      <div className="text-green-600 dark:text-green-400">Resolved: Tasks/1234/Site Inspection/Attachments</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Blob Deduplication */}
              <div className="space-y-3">
                <h4 className="font-medium flex items-center gap-2">
                  <Database className="h-4 w-4 text-pink-500" />
                  Blob Deduplication (StorageBlob)
                </h4>
                <div className="rounded-lg border p-3 bg-card">
                  <p className="text-sm text-muted-foreground mb-3">
                    Files are stored <strong>once</strong> and referenced from <strong>multiple locations</strong>.
                    This saves storage space and ensures consistency.
                  </p>
                  <div className="rounded-lg border bg-muted/20 p-4 font-mono text-xs space-y-3">
                    {/* How it works */}
                    <div className="space-y-1">
                      <div className="font-medium text-foreground mb-2">How It Works:</div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">1</Badge>
                        <span>File uploaded → SHA256 hash calculated</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">2</Badge>
                        <span>If hash exists → reuse existing blob (no duplicate storage)</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">3</Badge>
                        <span>WarehouseDocument references the blob</span>
                      </div>
                    </div>
                    {/* Visual diagram */}
                    <div className="border-t pt-3">
                      <div className="font-medium text-foreground mb-2">Example: Same invoice in 2 places</div>
                      <div className="text-muted-foreground space-y-1">
                        <div>📄 Jobs/J-001/Invoices/Invoice.pdf</div>
                        <div>📄 Contacts/Acme Corp/Invoices/Invoice.pdf</div>
                        <div className="border-t my-2 border-dashed" />
                        <div className="flex items-center gap-2">
                          <ArrowRight className="h-3 w-3" />
                          <span className="text-pink-600 dark:text-pink-400">Both point to: StorageBlob #abc123 (stored once!)</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 grid md:grid-cols-2 gap-3 text-xs">
                    <div className="flex items-start gap-2 p-2 rounded bg-muted/30">
                      <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                      <div>
                        <span className="font-medium">WarehouseDocument:</span>
                        <span className="text-muted-foreground ml-1">
                          Metadata (display_name, folder, documentable link)
                        </span>
                      </div>
                    </div>
                    <div className="flex items-start gap-2 p-2 rounded bg-muted/30">
                      <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                      <div>
                        <span className="font-medium">StorageBlob:</span>
                        <span className="text-muted-foreground ml-1">
                          Physical file (content_hash, storage_path, size)
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Maintenance Note */}
              <div className="rounded-lg border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/30 p-4">
                <h4 className="font-medium mb-2 flex items-center gap-2 text-amber-700 dark:text-amber-400">
                  <AlertCircle className="h-4 w-4" />
                  Backend SSoT Reference
                </h4>
                <div className="text-sm text-muted-foreground space-y-1">
                  <div><code className="bg-muted px-1 rounded text-xs">WarehouseProvider.instance</code> — The ONE source for storage provider config (Wasabi/SharePoint/Local)</div>
                  <div><code className="bg-muted px-1 rounded text-xs">WarehouseFolder</code> — Folder hierarchy configuration (table: warehouse_folders)</div>
                  <div><code className="bg-muted px-1 rounded text-xs">WarehouseDocument</code> — Universal document metadata table</div>
                  <div><code className="bg-muted px-1 rounded text-xs">StorageBlob</code> — Deduplicated file content (content-hash based)</div>
                  <div><code className="bg-muted px-1 rounded text-xs">SendNameResolver</code> — Resolves tokens in download filenames</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="config" className="space-y-6 mt-4">
      {/* Provider Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Storage Provider
          </CardTitle>
          <CardDescription>
            Select where documents will be stored
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Provider</Label>
              <Select
                value={formData.provider_type}
                onValueChange={(value: ProviderType) => {
                  // FRC: Don't auto-change root_path when switching providers
                  // This prevents accidentally overwriting user's intentional root_path setting
                  // User can manually update root_path if needed after switching providers
                  setFormData(prev => ({
                    ...prev,
                    provider_type: value,
                  }));
                }}
              >
                <SelectTrigger className="w-full md:w-[300px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PROVIDER_OPTIONS.map((option) => {
                    const Icon = option.icon;
                    return (
                      <SelectItem key={option.value} value={option.value}>
                        <div className="flex items-center gap-2">
                          <Icon className="h-4 w-4" />
                          <span>{option.label}</span>
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {currentProvider.description}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* SharePoint Connection - shown when provider is sharepoint */}
      {formData.provider_type === "sharepoint" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Cloud className="h-4 w-4" />
              SharePoint Site
            </CardTitle>
            <CardDescription>
              Configure the SharePoint site where all documents will be stored
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="site_url">Site URL</Label>
                <Input
                  id="site_url"
                  value={formData.sharepoint_site_url}
                  onChange={(e) => handleChange("sharepoint_site_url", e.target.value)}
                  placeholder="https://yourcompany.sharepoint.com/sites/YourSite"
                />
                <p className="text-xs text-muted-foreground">
                  The full URL to your SharePoint site
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="site_id">Site ID</Label>
                <Input
                  id="site_id"
                  value={formData.sharepoint_site_id}
                  onChange={(e) => handleChange("sharepoint_site_id", e.target.value)}
                  placeholder="yourcompany.sharepoint.com,abc123..."
                  className="font-mono text-xs"
                />
                <p className="text-xs text-muted-foreground">
                  Microsoft Graph Site ID (from API)
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="drive_id">Drive ID</Label>
                <Input
                  id="drive_id"
                  value={formData.sharepoint_drive_id}
                  onChange={(e) => handleChange("sharepoint_drive_id", e.target.value)}
                  placeholder="b!abc123..."
                  className="font-mono text-xs"
                />
                <p className="text-xs text-muted-foreground">
                  Document Library Drive ID
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="drive_name">Drive Name</Label>
                <Input
                  id="drive_name"
                  value={formData.sharepoint_drive_name}
                  onChange={(e) => handleChange("sharepoint_drive_name", e.target.value)}
                  placeholder="Shared Documents"
                />
                <p className="text-xs text-muted-foreground">
                  Display name of the document library
                </p>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <Button onClick={handleTest} disabled={testing || !formData.sharepoint_site_id}>
                {testing ? (
                  <>
                    <Spinner size={16} className="mr-2" />
                    Testing...
                  </>
                ) : (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Test Connection
                  </>
                )}
              </Button>
              {formData.sharepoint_site_url && (
                <Button variant="outline" asChild>
                  <a href={formData.sharepoint_site_url} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Open Site
                  </a>
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* S3/Wasabi Connection - shown when provider is s3_compatible */}
      {formData.provider_type === "s3_compatible" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Database className="h-4 w-4" />
              S3-Compatible Storage Connection
            </CardTitle>
            <CardDescription>
              Configure the bucket where all documents will be stored (Wasabi, AWS S3, MinIO, etc.)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="s3_endpoint">Endpoint URL</Label>
                <Input
                  id="s3_endpoint"
                  value={formData.s3_endpoint}
                  onChange={(e) => handleChange("s3_endpoint", e.target.value)}
                  placeholder="https://s3.wasabisys.com"
                />
                <p className="text-xs text-muted-foreground">
                  Endpoint URL (e.g., s3.wasabisys.com for Wasabi, s3.amazonaws.com for AWS)
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="s3_bucket">Bucket Name</Label>
                <Input
                  id="s3_bucket"
                  value={formData.s3_bucket}
                  onChange={(e) => handleChange("s3_bucket", e.target.value)}
                  placeholder="my-documents-bucket"
                />
                <p className="text-xs text-muted-foreground">
                  The name of your storage bucket
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="s3_region">Region</Label>
                <Input
                  id="s3_region"
                  value={formData.s3_region}
                  onChange={(e) => handleChange("s3_region", e.target.value)}
                  placeholder="ap-southeast-2"
                />
                <p className="text-xs text-muted-foreground">
                  Storage region (e.g., ap-southeast-2 for Sydney)
                </p>
              </div>
            </div>

            <div className="p-3 bg-muted/50 rounded-lg border">
              <p className="text-sm flex items-center gap-2">
                <Info className="h-4 w-4 text-blue-500 dark:text-blue-400" />
                <span>Credentials are configured in <strong>Admin → System → Connections</strong></span>
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Local Storage - shown when provider is local */}
      {formData.provider_type === "local" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <HardDrive className="h-4 w-4" />
              Local Storage
            </CardTitle>
            <CardDescription>
              Store documents on the local file system (development only)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
              <p className="text-sm text-yellow-800 dark:text-yellow-200 flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                Local storage is for development only. Documents will be stored in the Rails storage directory.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Download Link Settings */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Download Link Settings
          </CardTitle>
          <CardDescription>
            Configure how long download links remain valid
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Label htmlFor="link-expiry" className="text-sm whitespace-nowrap">
                Link expiry:
              </Label>
              <Input
                id="link-expiry"
                type="number"
                min={1}
                max={30}
                className="w-20"
                value={formData.link_expiry_days}
                onChange={(e) => {
                  const value = parseInt(e.target.value) || 7;
                  const clamped = Math.max(1, Math.min(30, value));
                  setFormData(prev => ({ ...prev, link_expiry_days: clamped }));
                }}
              />
              <span className="text-sm text-muted-foreground">days</span>
            </div>
            <p className="text-xs text-muted-foreground flex-1">
              Presigned download URLs will expire after this many days. Applies to document downloads and task attachment zips.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Warehouse Folders - Tree View (SSoT for scope folder paths) */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <FolderTree className="h-4 w-4" />
                Warehouse Folders
              </CardTitle>
              <CardDescription>
                Click a badge to edit folder path, templates, and filename patterns.
              </CardDescription>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={expandAll}
                className="h-7 px-2 text-xs"
                title="Expand all"
              >
                <ChevronsUpDown className="h-3.5 w-3.5 mr-1" />
                Expand
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={collapseAll}
                className="h-7 px-2 text-xs"
                title="Collapse all"
              >
                <ChevronsDownUp className="h-3.5 w-3.5 mr-1" />
                Collapse
              </Button>
            </div>
          </div>
          <CardDescription>
            Folder structure for each entity type. Click a label to edit its path.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Tree view of folder structure */}
          <div className="border rounded-md p-3 bg-muted/20">

            {/* Recursive tree render */}
            {folderTree.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2">No folders configured</p>
            ) : (
              <div className="space-y-0.5">
                {folderTree.map((node) => (
                  <TreeNode
                    key={node.path}
                    node={node}
                    level={0}
                    expandedPaths={expandedPaths}
                    onToggle={toggleExpanded}
                    editingKey={editingKey}
                    onStartEdit={setEditingKey}
                    onSaveEdit={(key, value) => {
                      setFormData(prev => ({
                        ...prev,
                        warehouse_folders: { ...prev.warehouse_folders, [key]: value }
                      }));
                      setEditingKey(null);
                    }}
                    onCancelEdit={() => setEditingKey(null)}
                    currentPath={formData.warehouse_folders}
                    rootPath={formData.root_path}
                    editingTabId={editingTabId}
                    onStartTabEdit={setEditingTabId}
                    onSaveTabEdit={saveTabFolderPath}
                    onCancelTabEdit={() => setEditingTabId(null)}
                    scopeTemplates={formData.warehouse_folder_templates}
                    downloadNameTemplates={formData.download_names}
                    uiNameTemplates={formData.ui_name_templates}
                    configLinks={formData.config_links}
                    onSaveTemplates={saveScopeTemplates}
                    virtualScopes={formData.virtual_warehouses}
                    onToggleVirtual={toggleVirtualScope}
                    scopeRootFolders={scopeRootFoldersFromWarehouseTypes}
                    warehouseTypes={warehouseTypes}
                    onEditWarehouseFolder={startEditingWarehouseFolder}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Legend */}
          <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Folder className="h-3 w-3 text-amber-500" />
              Folder
            </span>
            <span className="flex items-center gap-1">
              <Badge variant="outline" className="h-4 text-[10px] px-1">Jobs</Badge>
              Entity type (click to edit)
            </span>
          </div>

          {/* Loading indicator for folders */}
          {loadingTabs && (
            <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
              <Spinner size={12} />
              Loading folders...
            </div>
          )}
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? (
            <>
              <Spinner size={16} className="mr-2" />
              Saving...
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              Save Configuration
            </>
          )}
        </Button>
      </div>
        </TabsContent>

        {/* Live Preview Tab */}
        <TabsContent value="preview" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Eye className="h-4 w-4" />
                Warehouse Contents
              </CardTitle>
              <CardDescription>
                Live view of what&apos;s stored in the File Warehouse
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingWarehouse ? (
                <div className="flex items-center justify-center py-8">
                  <Spinner size={24} className="text-muted-foreground" />
                </div>
              ) : warehouseStats ? (
                <div className="space-y-6">
                  {/* Total count */}
                  <div className="flex items-center gap-4 p-4 bg-muted/50 rounded-lg">
                    <FileBox className="h-8 w-8 text-primary" />
                    <div>
                      <div className="text-2xl font-bold">{warehouseStats.warehouse_total.toLocaleString()}</div>
                      <div className="text-sm text-muted-foreground">Total documents in warehouse</div>
                    </div>
                  </div>

                  {/* By source type - from WarehouseDocument table */}
                  <div className="space-y-3">
                    <h3 className="text-sm font-medium">Warehouse Documents (Phase 3 SSoT)</h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {Object.entries(warehouseStats.warehouse_by_source)
                        .sort(([, a], [, b]) => b - a)
                        .map(([source, count]) => {
                          const icons: Record<string, React.ReactNode> = {
                            email: <Mail className="h-4 w-4" />,
                            job: <Briefcase className="h-4 w-4" />,
                            contact: <Users className="h-4 w-4" />,
                            corporate: <Building2 className="h-4 w-4" />,
                            task: <ClipboardList className="h-4 w-4" />,
                            user: <FolderHeart className="h-4 w-4" />,
                          };
                          return (
                            <div
                              key={source}
                              className="flex items-center gap-3 p-3 border rounded-lg bg-card"
                            >
                              <div className="text-muted-foreground">
                                {icons[source] || <FileText className="h-4 w-4" />}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-medium capitalize truncate">{source}</div>
                                <div className="text-xs text-muted-foreground">
                                  {count.toLocaleString()} docs
                                </div>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  </div>

                  {/* Other storage counts - from legacy tables */}
                  <div className="space-y-3">
                    <h3 className="text-sm font-medium">Other Storage (Legacy / Links)</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                      {[
                        { key: 'tasks', label: 'Task Attachments', icon: <ClipboardList className="h-3.5 w-3.5" /> },
                        { key: 'templates', label: 'Templates', icon: <FileText className="h-3.5 w-3.5" /> },
                        { key: 'notes', label: 'Notes', icon: <FileText className="h-3.5 w-3.5" /> },
                        { key: 'excel_documents', label: 'Excel Docs', icon: <FileText className="h-3.5 w-3.5" /> },
                        { key: 'word_documents', label: 'Word Docs', icon: <FileText className="h-3.5 w-3.5" /> },
                        { key: 'pricebook_photos', label: 'Pricebook Photos', icon: <FileText className="h-3.5 w-3.5" /> },
                        { key: 'active_storage', label: 'Active Storage', icon: <Database className="h-3.5 w-3.5" /> },
                      ].map(({ key, label, icon }) => {
                        const count = warehouseStats.counts[key] || 0;
                        if (count === 0) return null;
                        return (
                          <div key={key} className="flex items-center gap-2 p-2 border rounded bg-muted/30">
                            <span className="text-muted-foreground">{icon}</span>
                            <span className="text-xs truncate">{label}</span>
                            <span className="ml-auto text-xs font-medium">{count.toLocaleString()}</span>
                          </div>
                        );
                      })}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Task attachments link to existing documents. Templates and notes are stored separately.
                    </p>
                  </div>

                  {/* Folder structure preview */}
                  <div className="space-y-3">
                    <h3 className="text-sm font-medium">Folder Structure Preview</h3>
                    <div className="border rounded-lg p-4 bg-muted/20 font-mono text-sm space-y-1">
                      {/* Render configured scopes with their computed paths */}
                      {Object.entries(formData.warehouse_folders)
                        .filter(([, path]) => path)
                        .sort(([, a], [, b]) => a.localeCompare(b))
                        .map(([scopeKey, basePath]) => {
                          const template = formData.warehouse_folder_templates[scopeKey] || '' || '';
                          const count = warehouseStats.warehouse_by_source[scopeKey] || 0;
                          const icons: Record<string, React.ReactNode> = {
                            email: <Mail className="h-3.5 w-3.5 text-blue-500" />,
                            email_attachments: <Mail className="h-3.5 w-3.5 text-blue-500" />,
                            job: <Briefcase className="h-3.5 w-3.5 text-green-500" />,
                            contact: <Users className="h-3.5 w-3.5 text-purple-500" />,
                            corporate: <Building2 className="h-3.5 w-3.5 text-orange-500" />,
                            task: <ClipboardList className="h-3.5 w-3.5 text-red-500" />,
                            task_attachments: <ClipboardList className="h-3.5 w-3.5 text-red-500" />,
                            task_responses: <ClipboardList className="h-3.5 w-3.5 text-red-500" />,
                            user: <FolderHeart className="h-3.5 w-3.5 text-pink-500" />,
                          };
                          return (
                            <div key={scopeKey} className="ml-4 space-y-0.5">
                              <div className="flex items-center gap-2">
                                <FolderOpen className="h-4 w-4 text-amber-500" />
                                <span>{basePath}</span>
                                <Badge variant="outline" className="h-5 text-[10px] px-1.5">
                                  {getScopeLabel(scopeKey)}
                                </Badge>
                                {count > 0 && (
                                  <span className="text-xs text-muted-foreground">
                                    ({count.toLocaleString()} docs)
                                  </span>
                                )}
                              </div>
                              {template && (
                                <div className="ml-6 flex items-center gap-2 text-muted-foreground">
                                  {icons[scopeKey] || <Folder className="h-3.5 w-3.5 text-amber-500/60" />}
                                  <span className="italic">{template}</span>
                                </div>
                              )}
                            </div>
                          );
                        })}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      This shows your configured folder structure. Tokens like {`{{Mailbox}}`} and {`{{Year}}`} are replaced with actual values.
                    </p>
                  </div>

                  {/* Refresh button */}
                  <div className="flex justify-end">
                    <Button variant="outline" size="sm" onClick={loadWarehouseStats} disabled={loadingWarehouse}>
                      <RefreshCw className={cn("h-4 w-4 mr-2", loadingWarehouse && "animate-spin")} />
                      Refresh
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <p>Click to load warehouse statistics</p>
                  <Button variant="outline" size="sm" onClick={loadWarehouseStats} className="mt-2">
                    Load Preview
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Warehouse Folder Edit Dialog - for editing UI/DL names */}
      <Dialog open={!!editingWarehouseFolder} onOpenChange={(open) => !open && setEditingWarehouseFolder(null)}>
        <DialogContent className="sm:max-w-[700px]">
          <DialogHeader>
            <DialogTitle>Edit Warehouse Folder</DialogTitle>
            <DialogDescription>
              {editingWarehouseFolder?.display_name} - Configure folder path and name templates
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Available Tokens */}
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Available Tokens (drag to field or click to copy)</Label>
              <div className="flex flex-wrap gap-1">
                {[
                  '{{OriginalFileName}}',
                  '{{Subject}}',
                  '{{FromName}}',
                  '{{FromEmail}}',
                  '{{ReceivedDate}}',
                  '{{Date}}',
                  '{{JobCode}}',
                  '{{JobName}}',
                  '{{ContactName}}',
                  '{{CompanyCode}}',
                  '{{DocTypeName}}',
                ].map((token) => (
                  <button
                    key={token}
                    type="button"
                    draggable
                    className="px-1.5 py-0.5 text-[10px] font-mono bg-muted hover:bg-muted/80 rounded border cursor-grab active:cursor-grabbing"
                    onClick={() => {
                      navigator.clipboard.writeText(token);
                      toast({ title: 'Copied', description: `${token} copied to clipboard` });
                    }}
                    onDragStart={(e) => {
                      e.dataTransfer.setData('text/plain', token);
                      e.dataTransfer.effectAllowed = 'copy';
                    }}
                    title={`Drag to field or click to copy ${token}`}
                  >
                    {token}
                  </button>
                ))}
              </div>
            </div>

            {/* Full Warehouse Folder Path - Editable with greyed-out base path prefix */}
            <div className="space-y-2">
              <Label htmlFor="folder_path">Full Warehouse Folder Path</Label>
              <div className="flex items-center border rounded-md overflow-hidden">
                {/* Base folder path prefix - read-only, greyed out */}
                {editingWarehouseFolder?.base_folder_path_template && (
                  <span className="px-3 py-2 bg-muted text-muted-foreground font-mono text-sm border-r whitespace-nowrap">
                    {editingWarehouseFolder.base_folder_path_template}
                  </span>
                )}
                {/* Editable suffix */}
                <Input
                  id="folder_path"
                  value={
                    // Show only the suffix after the base folder path
                    editingWarehouseFolder?.base_folder_path_template && warehouseFolderEditForm.folder_path.startsWith(editingWarehouseFolder.base_folder_path_template)
                      ? warehouseFolderEditForm.folder_path.slice(editingWarehouseFolder.base_folder_path_template.length)
                      : warehouseFolderEditForm.folder_path
                  }
                  onChange={(e) => {
                    const suffix = e.target.value;
                    const basePath = editingWarehouseFolder?.base_folder_path_template || '';
                    setWarehouseFolderEditForm(prev => ({
                      ...prev,
                      folder_path: basePath + suffix
                    }));
                  }}
                  placeholder=""
                  className="font-mono text-sm border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.currentTarget.classList.add('ring-2', 'ring-primary');
                  }}
                  onDragLeave={(e) => {
                    e.currentTarget.classList.remove('ring-2', 'ring-primary');
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.currentTarget.classList.remove('ring-2', 'ring-primary');
                    const token = e.dataTransfer.getData('text/plain');
                    if (token) {
                      setWarehouseFolderEditForm(prev => {
                        // Add / before token if current value doesn't end with /
                        const currentPath = prev.folder_path;
                        const separator = currentPath.endsWith('/') ? '' : '/';
                        return {
                          ...prev,
                          folder_path: currentPath + separator + token
                        };
                      });
                    }
                  }}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Full folder path saved to warehouse_folders table.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="ui_name">UI Name Template</Label>
              <div className="flex gap-2">
                <Input
                  id="ui_name"
                  value={warehouseFolderEditForm.ui_name}
                  onChange={(e) => setWarehouseFolderEditForm(prev => ({ ...prev, ui_name: e.target.value }))}
                  placeholder="e.g., {{Subject}} - {{FromName}}"
                  className="flex-1"
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.currentTarget.classList.add('ring-2', 'ring-primary');
                  }}
                  onDragLeave={(e) => {
                    e.currentTarget.classList.remove('ring-2', 'ring-primary');
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.currentTarget.classList.remove('ring-2', 'ring-primary');
                    const token = e.dataTransfer.getData('text/plain');
                    if (token) {
                      setWarehouseFolderEditForm(prev => ({
                        ...prev,
                        ui_name: prev.ui_name + token
                      }));
                    }
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setWarehouseFolderEditForm(prev => ({ ...prev, ui_name: '{{OriginalFileName}}' }))}
                  title="Set to default template"
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Default
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                How this folder&apos;s items appear in the UI. Leave blank for default.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="download_name">Download Name Template</Label>
              <div className="flex gap-2">
                <Input
                  id="download_name"
                  value={warehouseFolderEditForm.download_name}
                  onChange={(e) => setWarehouseFolderEditForm(prev => ({ ...prev, download_name: e.target.value }))}
                  placeholder="e.g., {{Subject}} - {{ReceivedDate}}.eml"
                  className="flex-1"
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.currentTarget.classList.add('ring-2', 'ring-primary');
                  }}
                  onDragLeave={(e) => {
                    e.currentTarget.classList.remove('ring-2', 'ring-primary');
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.currentTarget.classList.remove('ring-2', 'ring-primary');
                    const token = e.dataTransfer.getData('text/plain');
                    if (token) {
                      setWarehouseFolderEditForm(prev => ({
                        ...prev,
                        download_name: prev.download_name + token
                      }));
                    }
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setWarehouseFolderEditForm(prev => ({ ...prev, download_name: '{{OriginalFileName}}' }))}
                  title="Set to default template"
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Default
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Filename used when downloading. Include extension.
              </p>
            </div>
            {/* Live preview of full path */}
            <div className="rounded-lg border bg-muted/50 p-3 space-y-1 text-sm">
              <div className="flex gap-2">
                <span className="text-muted-foreground w-24">Path:</span>
                <span className="font-mono text-xs">{warehouseFolderEditForm.folder_path || editingWarehouseFolder?.display_name || ''}</span>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingWarehouseFolder(null)}>
              Cancel
            </Button>
            <Button onClick={saveWarehouseFolder}>
              <Save className="h-4 w-4 mr-2" />
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
