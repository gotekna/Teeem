"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { ExpandChevron } from "@/components/ui/expand-chevron";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";
import { Spinner } from "@/components/ui/spinner";
import { TokenBuilder } from "@/components/ui/tokens";
import Link from "next/link";

// SSoT: Simple scopes have inline editing (no document types)
const SIMPLE_SCOPES = ['email', 'warehouse', 'task'];
// SSoT: Complex scopes need separate tab (have document types, entity filters)
const COMPLEX_SCOPES = ['corporate_entity', 'job', 'contact'];

// Human-readable labels for scope links
const SCOPE_LABELS: Record<string, string> = {
  corporate_entity: 'Corporate',
  job: 'Jobs',
  contact: 'Contacts',
};

// SSoT: Default folder templates per scope (matches backend SCOPE_TEMPLATES)
const DEFAULT_FOLDER_TEMPLATES: Record<string, string> = {
  job: '{{JobCode}}/{{TabName}}',
  task: '{{TaskId}}',
  task_attachments: '{{TaskId}}/Attachments',
  task_responses: '{{TaskId}}/Responses',
  corporate_entity: '{{CompanyGroup}}/{{CompanyCode}}/{{TabName}}',
  corporate: '{{CompanyGroup}}/{{CompanyCode}}/{{TabName}}',
  contact: '{{ContactName}}/{{TabName}}',
  people: '{{ContactName}}/{{TabName}}',
  email: '{{Year}}/{{Month}}',
  notes: '{{UserName}}/{{Year}}',
  excel_documents: '{{UserName}}/{{Year}}',
  word_documents: '{{UserName}}/{{Year}}',
  powerpoint_documents: '{{UserName}}/{{Year}}',
};

// SSoT: Provider types match StorageConfiguration.PROVIDER_TYPES
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

// SSoT: StorageConfiguration handles CONNECTION + root path + scope folders
// Individual tab folder paths are managed in EntityTab (Entity Configurator)
// SSoT: Dynamic scope folders from StorageConfiguration.SCOPE_FOLDERS
// Keys and values come from the backend API
type ScopeFolders = Record<string, string>;

// Entity tab interface for tabs under each scope
interface EntityTab {
  id: number;
  tab_key: string;
  display_name: string;
  scope: string;
  parent_id: number | null;
  has_sharepoint_folder: boolean;
  sharepoint_folder_path: string | null;
  sharepoint_folder_template: string | null;
  sharepoint_filename_template: string | null;
  enabled: boolean;
  order_position: number;
  icon_name: string | null;
}

// Scope to API scope mapping
const SCOPE_TO_API_SCOPE: Record<string, string> = {
  corporate_entity: 'corporate_entity',
  job: 'job',
  contact: 'contact',
  email: 'email',
  warehouse: 'warehouse',
  task: 'task',
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
  // Root path and scope folders
  root_path: string;
  // SSoT: scope_root_folders is THE ONE place for scope roots
  scope_root_folders: ScopeFolders;
  // All scope folders (scope roots + tab paths for backward compat)
  scope_folders: ScopeFolders;
  // SSoT: Templates for folder paths and filenames per scope
  scope_templates: Record<string, string>;
  file_name_templates: Record<string, string>;
  // SSoT: Config links for scope folders (URL to external config page)
  config_links: Record<string, string>;
  // Phase 4: Virtual scopes (render from DB instead of S3)
  virtual_scopes: Record<string, boolean>;
  // Per-scope options (e.g., task.exclude_sm_linked)
  scope_options: Record<string, Record<string, boolean>>;
}

// Tree node structure for folder hierarchy
interface FolderTreeNode {
  name: string;  // Display name (e.g., "Users", "Contracts")
  path: string;  // Full path (e.g., "Users/Contracts")
  scopeKey: string | null;  // Primary scope key (first one added)
  scopeKeys: string[];  // ALL scope keys that share this path (for multi-scope folders like Tasks)
  children: FolderTreeNode[];
  tabs?: EntityTab[];  // Tabs under this scope folder
}

// SSoT: Known scope root folder names (first segment of paths that should appear at root)
// These match SCOPE_ROOT_DEFAULTS in StorageConfiguration
const KNOWN_ROOT_FOLDERS = [
  'Jobs', 'Contacts', 'Corporate', 'People', 'Tasks', 'Emails', 'Warehousing', 'Users'
];

// Build tree structure from flat scope folders
function buildFolderTree(scopeFolders: ScopeFolders): FolderTreeNode[] {
  const root: FolderTreeNode[] = [];

  // Sort entries by path for consistent tree building
  const entries = Object.entries(scopeFolders).sort(([, a], [, b]) => a.localeCompare(b));

  // Filter out paths that shouldn't be at root level:
  // 1. Paths that start with {{ (placeholder at root level)
  // 2. Paths that don't start with a known scope root folder (e.g., "ActiveStorage", "Attachments")
  //    These are tab paths that should be relative to their scope but were stored incorrectly
  const filteredEntries = entries.filter(([key, path]) => {
    if (!path) return false;
    // Skip paths that start with {{ (placeholder at root level)
    if (path.startsWith('{{')) return false;
    // Skip paths whose first segment isn't a known scope root folder
    // This filters out "ActiveStorage", "Attachments", "Documents", "Revit", "Email Body" etc.
    // that should be nested under their scope roots but aren't
    const firstSegment = path.split('/')[0];
    if (!KNOWN_ROOT_FOLDERS.includes(firstSegment)) {
      // Exception: Keep scope root entries themselves (overview tabs for each scope)
      // These have keys like 'email', 'warehouse', 'job', etc.
      const isOverviewTab = ['email', 'warehouse', 'job', 'contact', 'people', 'task', 'corporate_entity', 'corporate'].includes(key);
      if (!isOverviewTab) return false;
    }
    return true;
  });

  filteredEntries.forEach(([key, path]) => {
    if (!path) return;

    const parts = path.split('/').filter(Boolean);
    let current = root;
    let currentPath = '';

    parts.forEach((part, index) => {
      currentPath = currentPath ? `${currentPath}/${part}` : part;
      const isLeaf = index === parts.length - 1;

      // Look for existing node at this level
      let node = current.find(n => n.name === part);

      if (!node) {
        node = {
          name: part,
          path: currentPath,
          scopeKey: isLeaf ? key : null,
          scopeKeys: isLeaf ? [key] : [],
          children: [],
        };
        current.push(node);
      } else if (isLeaf) {
        // Multiple scopes share this path - add to scopeKeys array
        if (!node.scopeKeys.includes(key)) {
          node.scopeKeys.push(key);
        }
        // Set primary scopeKey if not already set
        if (!node.scopeKey) {
          node.scopeKey = key;
        }
      }

      current = node.children;
    });
  });

  return root;
}

// Get scope label from key (snake_case to Title Case)
function getScopeLabel(key: string): string {
  return key
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

// Check if a scopeKey belongs to a simple scope (warehouse, email, task families)
function isSimpleScopeKey(scopeKey: string | null): boolean {
  if (!scopeKey) return false;
  // Direct simple scopes
  if (SIMPLE_SCOPES.includes(scopeKey)) return true;
  // Sub-scopes of simple scopes (e.g., bill_inbox is under warehouse)
  const simpleSubScopes = [
    'bill_inbox', 'chat', 'excel_documents', 'notes', 'powerpoint_documents',
    'pricebook_photos', 'templates', 'bank_statements', 'contracts', 'word_documents',
    'email_attachments'
  ];
  return simpleSubScopes.includes(scopeKey);
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
  onSaveTabEdit: (tabId: number, path: string, template: string | null, filenameTemplate: string | null) => void;
  onCancelTabEdit: () => void;
  // Parent scope info for simple scope detection
  parentScopeKey?: string | null;
  // SSoT: Templates for auto-save
  scopeTemplates: Record<string, string>;
  fileNameTemplates: Record<string, string>;
  configLinks: Record<string, string>;
  onSaveTemplates: (scopeKey: string, baseFolder: string, folderTemplate: string, filenameTemplate: string, configLink: string | null) => Promise<void>;
  // Phase 4: Virtual scopes
  virtualScopes: Record<string, boolean>;
  onToggleVirtual: (scopeKey: string, isVirtual: boolean) => Promise<void>;
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
  fileNameTemplates,
  configLinks,
  onSaveTemplates,
  virtualScopes,
  onToggleVirtual,
}: TreeNodeProps) {
  const hasChildren = node.children.length > 0;
  const hasTabs = node.tabs && node.tabs.length > 0;
  // Check if we're editing ANY scope in this node's scopeKeys
  const isEditingThisNode = editingKey && node.scopeKeys?.includes(editingKey);
  // The currently editing scope key (could be different from node.scopeKey when multiple scopes share path)
  const currentEditingScopeKey = isEditingThisNode ? editingKey : null;
  const [editValue, setEditValue] = React.useState(node.path);
  // SSoT: Initialize templates from props (loaded from backend), fallback to defaults
  // Use editingKey when available, otherwise primary scopeKey
  const activeScopeKey = currentEditingScopeKey || node.scopeKey;
  const [folderTemplate, setFolderTemplate] = React.useState(
    activeScopeKey
      ? scopeTemplates[activeScopeKey] || DEFAULT_FOLDER_TEMPLATES[activeScopeKey] || '{{TabName}}'
      : '{{TabName}}'
  );
  const [filenameTemplate, setFilenameTemplate] = React.useState(
    activeScopeKey ? fileNameTemplates[activeScopeKey] || '{{OriginalFileName}}' : '{{OriginalFileName}}'
  );
  // Config link: checkbox + URL for linking to external config page
  // SSoT: Initialize from configLinks prop (loaded from backend)
  const initialConfigLink = activeScopeKey ? configLinks[activeScopeKey] || '' : '';
  const [hasConfigLink, setHasConfigLink] = React.useState(!!initialConfigLink);

  // SSoT: Simple scopes without config link can expand to show folder template preview
  // Check if ANY scope has a template (for multi-scope paths like Tasks)
  const hasTemplatePreview = node.scopeKeys?.length > 0 && node.scopeKeys.some(sk => {
    const template = scopeTemplates[sk] || DEFAULT_FOLDER_TEMPLATES[sk];
    return template && !configLinks[sk];
  });
  const hasExpandableContent = hasChildren || hasTabs || hasTemplatePreview;
  const isExpanded = expandedPaths.has(node.path);
  const [configLinkUrl, setConfigLinkUrl] = React.useState(initialConfigLink);
  const [isSaving, setIsSaving] = React.useState(false);
  const [lastSaved, setLastSaved] = React.useState<Date | null>(null);
  const saveTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  // Track if templates have been modified (to avoid saving on initial load)
  const hasModified = React.useRef(false);
  // Track previous scope to save when switching
  const prevScopeRef = React.useRef<{
    scopeKey: string;
    baseFolder: string;
    folder: string;
    filename: string;
    configLink: string | null;
  } | null>(null);
  // Track the last scope we initialized for (to avoid re-initializing on prop changes)
  const initializedScopeRef = React.useRef<string | null>(null);

  // Immediate save function (no debounce) - for switching scopes
  const saveImmediate = React.useCallback(async (scopeKey: string, baseFolder: string, folder: string, filename: string, configLink: string | null) => {
    if (!scopeKey) return;
    try {
      await onSaveTemplates(scopeKey, baseFolder, folder, filename, configLink);
    } catch (error) {
      console.error('Failed to save templates:', error);
    }
  }, [onSaveTemplates]);

  // Auto-save function with debounce - calls actual API
  const autoSave = React.useCallback(async (scopeKey: string, baseFolder: string, folder: string, filename: string, configLink: string | null) => {
    if (!scopeKey || !hasModified.current) return;

    // Update the ref so we can save when switching
    prevScopeRef.current = { scopeKey, baseFolder, folder, filename, configLink };

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    saveTimeoutRef.current = setTimeout(async () => {
      setIsSaving(true);
      try {
        await onSaveTemplates(scopeKey, baseFolder, folder, filename, configLink);
        setLastSaved(new Date());
        hasModified.current = false;
        prevScopeRef.current = null; // Clear after successful save
      } catch (error) {
        console.error('Failed to save templates:', error);
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
      autoSave(currentEditingScopeKey, editValue, folderTemplate, filenameTemplate, linkToSave);
    }
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [editValue, folderTemplate, filenameTemplate, hasConfigLink, configLinkUrl, currentEditingScopeKey, autoSave]);

  // Save previous scope immediately when switching to a different scope
  React.useEffect(() => {
    // If we have pending changes from a previous scope, save them immediately
    if (prevScopeRef.current && prevScopeRef.current.scopeKey !== currentEditingScopeKey) {
      const prev = prevScopeRef.current;
      saveImmediate(prev.scopeKey, prev.baseFolder, prev.folder, prev.filename, prev.configLink);
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
    setFolderTemplate(value);
  };

  const handleFilenameTemplateChange = (value: string) => {
    hasModified.current = true;
    setFilenameTemplate(value);
  };

  // Determine if this node is in a simple scope context (for inline editing)
  const isInSimpleScope = parentScopeKey ? SIMPLE_SCOPES.includes(parentScopeKey) : false;
  const isSimpleScopeChild = isInSimpleScope && node.scopeKey && !SIMPLE_SCOPES.includes(node.scopeKey);

  // Reset edit value and templates when editing starts or switches to a different scope
  // IMPORTANT: Only initialize templates when SCOPE actually changes, not when props update after save
  React.useEffect(() => {
    if (currentEditingScopeKey) {
      const scopeActuallyChanged = initializedScopeRef.current !== currentEditingScopeKey;

      // Only initialize templates when switching to a DIFFERENT scope
      if (scopeActuallyChanged) {
        setEditValue(currentPath[currentEditingScopeKey] || node.path);
        setFolderTemplate(
          scopeTemplates[currentEditingScopeKey] || DEFAULT_FOLDER_TEMPLATES[currentEditingScopeKey] || '{{TabName}}'
        );
        setFilenameTemplate(
          fileNameTemplates[currentEditingScopeKey] || '{{OriginalFileName}}'
        );
        const linkValue = configLinks[currentEditingScopeKey] || '';
        setConfigLinkUrl(linkValue);
        setHasConfigLink(!!linkValue);
        hasModified.current = false;
        setLastSaved(null);
        initializedScopeRef.current = currentEditingScopeKey;
      }
    } else {
      // Editing stopped - reset the initialized scope tracker
      initializedScopeRef.current = null;
    }
  }, [currentEditingScopeKey, currentPath, node.path, scopeTemplates, fileNameTemplates, configLinks]);

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
            className="p-0.5 hover:bg-muted rounded"
          >
            <ExpandChevron expanded={isExpanded} size={14} />
          </button>
        ) : (
          <span className="w-5" />
        )}

        {/* Folder icon */}
        {hasExpandableContent && isExpanded ? (
          <FolderOpen className="h-4 w-4 text-amber-500 flex-shrink-0" />
        ) : (
          <Folder className="h-4 w-4 text-amber-500 flex-shrink-0" />
        )}

        {/* Folder name and scope badge */}
        <span className="font-mono text-sm">{node.name}</span>

        {/* Scope badges - show all scopes that share this path */}
        {node.scopeKeys && node.scopeKeys.length > 0 && (
          <div className="flex items-center gap-1 ml-2">
            {node.scopeKeys.map((sk) => (
              <div key={sk} className="flex items-center gap-1">
                <Badge
                  variant="outline"
                  className={cn(
                    "h-5 text-[10px] px-1.5 bg-background",
                    editingKey === sk && "ring-2 ring-primary"
                  )}
                >
                  {getScopeLabel(sk)}
                </Badge>
              </div>
            ))}
          </div>
        )}

        {/* Config link - shown when checkbox is enabled and URL is set */}
        {hasConfigLink && configLinkUrl && !isEditingThisNode && (() => {
          // Get tab name from URL
          const getTabName = (url: string) => {
            if (url.includes('corporate_entity')) return 'Corporate tab';
            if (url.includes('/job')) return 'Jobs tab';
            if (url.includes('/contact')) return 'Contacts tab';
            return 'Configure';
          };
          return (
            <Link
              href={configLinkUrl}
              className="ml-2 text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 hover:underline flex items-center gap-1"
            >
              {getTabName(configLinkUrl)} <ExternalLink className="h-3 w-3" />
            </Link>
          );
        })()}

        {/* Tab count badge */}
        {hasTabs && (
          <span className="ml-1 text-[10px] text-muted-foreground">
            ({node.tabs!.length} tabs)
          </span>
        )}

        {/* Full path preview (on hover) */}
        {!isEditingThisNode && (
          <span className="ml-auto text-[10px] text-muted-foreground font-mono opacity-0 group-hover:opacity-100 transition-opacity">
            {fullPath}
          </span>
        )}
      </div>

      {/* Editing panel for any scope folder */}
      {editingKey && node.scopeKeys?.includes(editingKey) && (
        <div
          className="border rounded-lg bg-card py-3 px-4 my-1 shadow-sm"
          style={{ marginLeft: `${level * 16 + 28}px` }}
        >
          <div className="space-y-4">
            {/* Base Folder (editable) */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Base Folder</label>
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm text-muted-foreground">{rootPath}/</span>
                <Input
                  value={editValue}
                  onChange={(e) => {
                    setEditValue(e.target.value);
                    hasModified.current = true;
                  }}
                  className="h-8 text-sm font-mono flex-1"
                  placeholder="Emails"
                />
                <span className="text-muted-foreground">/</span>
              </div>
              <p className="text-[10px] text-muted-foreground">
                Storage folder path. Use same path for related scopes to group them on one row.
              </p>
            </div>

            {/* Folder Template */}
            <TokenBuilder
              label={<span className="text-xs font-medium">Folder Path</span>}
              value={folderTemplate}
              onChange={handleFolderTemplateChange}
              scope="storage"
              showPreview={false}
              separator="/"
              placeholder="Click tokens to build folder path..."
              defaultExpanded={false}
            />

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

            {/* Full Path Preview */}
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded px-3 py-2">
              <span className="text-xs text-muted-foreground">Full Path: </span>
              <span className="font-mono text-sm text-green-700 dark:text-green-400">
                {[rootPath, editValue, folderTemplate].filter(Boolean).join('/').replace(/\/+/g, '/')}
              </span>
            </div>

            {/* Send Name Template */}
            <TokenBuilder
              label={<span className="text-xs font-medium">Send Name</span>}
              value={filenameTemplate}
              onChange={handleFilenameTemplateChange}
              scope="storage"
              showPreview={true}
              placeholder="Click tokens to build filename..."
              defaultExpanded={false}
            />

            {/* Phase 4: Virtual Folder Toggle */}
            <div className="space-y-2 pt-2 border-t">
              <div className="flex items-center gap-2">
                <Checkbox
                  id={`virtual-${currentEditingScopeKey}`}
                  checked={virtualScopes[currentEditingScopeKey || ''] ?? false}
                  onCheckedChange={(checked) => {
                    if (currentEditingScopeKey) {
                      onToggleVirtual(currentEditingScopeKey, checked === true);
                    }
                  }}
                />
                <label
                  htmlFor={`virtual-${currentEditingScopeKey}`}
                  className="text-xs font-medium cursor-pointer flex items-center gap-1.5"
                >
                  <Database className="h-3.5 w-3.5" />
                  Virtual Folder (Phase 4)
                </label>
              </div>
              <p className="text-[10px] text-muted-foreground ml-6">
                When enabled, folder tree renders from database instead of S3.
                Reorganization is instant (bulk DB update). Physical storage stays at Blobs/&#123;hash&#125;.ext.
              </p>
            </div>

            {/* Config Link - checkbox + URL */}
            <div className="space-y-2 pt-2 border-t">
              <div className="flex items-center gap-2">
                <Checkbox
                  id={`config-link-${node.scopeKey}`}
                  checked={hasConfigLink}
                  onCheckedChange={(checked) => {
                    setHasConfigLink(checked === true);
                    hasModified.current = true;
                  }}
                />
                <label
                  htmlFor={`config-link-${node.scopeKey}`}
                  className="text-xs font-medium cursor-pointer flex items-center gap-1.5"
                >
                  <Link2 className="h-3.5 w-3.5" />
                  Link to configuration page
                </label>
              </div>
              {hasConfigLink && (
                <div className="ml-6 space-y-2">
                  <Select
                    value={configLinkUrl || ""}
                    onValueChange={(value) => {
                      setConfigLinkUrl(value);
                      hasModified.current = true;
                    }}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Select target tab..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="/admin/system/entity-config/corporate_entity">
                        Corporate tab
                      </SelectItem>
                      <SelectItem value="/admin/system/entity-config/job">
                        Jobs tab
                      </SelectItem>
                      <SelectItem value="/admin/system/entity-config/contact">
                        Contacts tab
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-[10px] text-muted-foreground">
                    Shows &quot;Configure →&quot; link next to this scope
                  </p>
                </div>
              )}
            </div>

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

              {/* Close button */}
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
      )}

      {/* Expanded content: Children OR Tabs (tabs take priority for scopes) */}
      {isExpanded && hasExpandableContent && (
        <div>
          {/* For simple scopes WITHOUT config link: show folder template preview */}
          {/* Complex scopes with config links have their folder structure defined in entity tabs (SSoT) */}
          {/* When multiple scopes share a path, show ALL their template previews */}
          {node.scopeKeys?.length > 0 && !isEditingThisNode && (
            <div className="ml-1">
              {/* Render ALL scope templates as nested preview folders */}
              {(() => {
                // Collect all templates from all scopes sharing this path
                const allTemplates: Array<{ scopeKey: string; template: string; filename: string }> = [];
                for (const sk of node.scopeKeys) {
                  const template = scopeTemplates[sk] || DEFAULT_FOLDER_TEMPLATES[sk] || '';
                  const filename = fileNameTemplates[sk] || '{{OriginalFileName}}';
                  // Skip scopes with config links (they show tabs instead)
                  if (!configLinks[sk] && template) {
                    allTemplates.push({ scopeKey: sk, template, filename });
                  }
                }

                // Build a merged tree structure from all templates
                // This handles the case where multiple scopes share the same prefix (e.g., {{TaskId}})
                const templateTree: Map<string, { parts: string[]; scopeKey: string; filename: string }[]> = new Map();
                for (const { scopeKey, template, filename } of allTemplates) {
                  const parts = template.split('/').filter(Boolean);
                  const key = parts[0] || ''; // First part as the grouping key
                  if (!templateTree.has(key)) {
                    templateTree.set(key, []);
                  }
                  templateTree.get(key)!.push({ parts, scopeKey, filename });
                }

                // Render the merged tree
                const rendered: React.ReactNode[] = [];
                for (const [firstPart, items] of templateTree) {
                  if (!firstPart) continue;

                  // Render the first part (e.g., {{TaskId}})
                  rendered.push(
                    <div
                      key={`first-${firstPart}`}
                      className="flex items-center gap-1 py-0.5 px-1"
                      style={{ paddingLeft: `${(level + 1) * 16 + 4}px` }}
                    >
                      <span className="w-5" />
                      <Folder className="h-3.5 w-3.5 text-amber-500/50 flex-shrink-0" />
                      <span className="font-mono text-xs text-muted-foreground italic">
                        {firstPart}
                      </span>
                    </div>
                  );

                  // Render the remaining parts for each scope
                  for (const { parts, scopeKey, filename } of items) {
                    const remainingParts = parts.slice(1);
                    let currentLevel = level + 2;
                    for (let idx = 0; idx < remainingParts.length; idx++) {
                      const part = remainingParts[idx];
                      const isLast = idx === remainingParts.length - 1;
                      rendered.push(
                        <div
                          key={`${scopeKey}-${parts.join('-')}-${idx}`}
                          className="flex items-center gap-1 py-0.5 px-1"
                          style={{ paddingLeft: `${currentLevel++ * 16 + 4}px` }}
                        >
                          <span className="w-5" />
                          <Folder className="h-3.5 w-3.5 text-amber-500/50 flex-shrink-0" />
                          <span className="font-mono text-xs text-muted-foreground italic">
                            {part}
                          </span>
                          {isLast && filename && (
                            <span className="ml-2 text-[10px] text-muted-foreground/60">
                              → {filename}
                            </span>
                          )}
                        </div>
                      );
                    }
                  }
                }
                return rendered;
              })()}
            </div>
          )}
          {/* For scopes with tabs: show tabs */}
          {hasTabs && node.scopeKey ? (
            <div className="ml-1">
              {node.tabs!.map((tab) => (
                <TabNode
                  key={tab.id}
                  tab={tab}
                  level={level + 1}
                  basePath={fullPath}
                  scope={node.scopeKey!}
                  editingTabId={editingTabId}
                  onStartEdit={onStartTabEdit}
                  onSaveEdit={onSaveTabEdit}
                  onCancelEdit={onCancelTabEdit}
                />
              ))}
            </div>
          ) : (
            /* For non-scope folders: show child folders */
            node.children.map((child) => (
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
                fileNameTemplates={fileNameTemplates}
                configLinks={configLinks}
                onSaveTemplates={onSaveTemplates}
                virtualScopes={virtualScopes}
                onToggleVirtual={onToggleVirtual}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

// TabNode component for displaying entity tabs
interface TabNodeProps {
  tab: EntityTab;
  level: number;
  basePath: string;
  scope: string;
  editingTabId: number | null;
  onStartEdit: (tabId: number) => void;
  onSaveEdit: (tabId: number, path: string, template: string | null, filenameTemplate: string | null) => void;
  onCancelEdit: () => void;
}

function TabNode({
  tab,
  level,
  basePath,
  scope,
  editingTabId,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
}: TabNodeProps) {
  const isEditing = editingTabId === tab.id;
  const isSimpleScope = SIMPLE_SCOPES.includes(scope);
  const [editPath, setEditPath] = React.useState(tab.sharepoint_folder_path || '');
  const [editTemplate, setEditTemplate] = React.useState(tab.sharepoint_folder_template || '');
  const [editFilename, setEditFilename] = React.useState(tab.sharepoint_filename_template || '');

  React.useEffect(() => {
    if (isEditing) {
      setEditPath(tab.sharepoint_folder_path || '');
      setEditTemplate(tab.sharepoint_folder_template || '');
      setEditFilename(tab.sharepoint_filename_template || '');
    }
  }, [isEditing, tab.sharepoint_folder_path, tab.sharepoint_folder_template, tab.sharepoint_filename_template]);

  const tabFullPath = tab.sharepoint_folder_path
    ? `${basePath}/${tab.sharepoint_folder_path}`.replace(/\/+/g, '/')
    : basePath;

  // For simple scopes - inline editing with TokenBuilder
  if (isSimpleScope) {
    return (
      <div
        className={cn(
          "py-2 px-1 rounded-sm",
          isEditing && "bg-blue-50 dark:bg-blue-900/20"
        )}
        style={{ paddingLeft: `${level * 16 + 24}px` }}
      >
        {/* Tab header row */}
        <div className="flex items-center gap-1 mb-2">
          <FileText className="h-3.5 w-3.5 text-blue-500 dark:text-blue-400 flex-shrink-0" />
          <span className="text-sm font-medium">{tab.display_name}</span>
        </div>

        {isEditing ? (
          <div className="space-y-3 ml-4 border-l-2 border-blue-200 dark:border-blue-800 pl-3">
            {/* Folder path */}
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-muted-foreground">Folder Path</label>
              <Input
                value={editPath}
                onChange={(e) => setEditPath(e.target.value)}
                className="h-7 text-xs font-mono"
                placeholder="Subfolder path..."
              />
            </div>

            {/* Folder template with TokenBuilder */}
            <div className="space-y-1">
              <TokenBuilder
                label={<span className="text-[11px] font-medium text-muted-foreground">Folder Template</span>}
                value={editTemplate}
                onChange={setEditTemplate}
                scope="storage"
                showPreview={true}
                separator="/"
                placeholder="Click tokens to build folder path..."
                defaultExpanded={false}
              />
            </div>

            {/* Filename template with TokenBuilder */}
            <div className="space-y-1">
              <TokenBuilder
                label={<span className="text-[11px] font-medium text-muted-foreground">Filename Template</span>}
                value={editFilename}
                onChange={setEditFilename}
                scope="document"
                showPreview={true}
                placeholder="Click tokens to build filename..."
                defaultExpanded={false}
              />
            </div>

            {/* Save/Cancel buttons */}
            <div className="flex gap-2 pt-1">
              <Button
                size="sm"
                onClick={() => onSaveEdit(tab.id, editPath, editTemplate || null, editFilename || null)}
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
          <div
            className="ml-4 space-y-1 text-[11px] text-muted-foreground cursor-pointer hover:bg-muted/50 rounded px-2 py-1 -ml-2"
            onClick={() => onStartEdit(tab.id)}
            title="Click to edit"
          >
            <div className="flex items-center gap-2">
              <span className="font-medium w-20">Path:</span>
              <span className="font-mono">{tab.sharepoint_folder_path || '(none)'}</span>
            </div>
            {tab.sharepoint_folder_template && (
              <div className="flex items-center gap-2">
                <span className="font-medium w-20">Template:</span>
                <span className="font-mono text-blue-600 dark:text-blue-400">{tab.sharepoint_folder_template}</span>
              </div>
            )}
            {tab.sharepoint_filename_template && (
              <div className="flex items-center gap-2">
                <span className="font-medium w-20">Filename:</span>
                <span className="font-mono text-green-600 dark:text-green-400">{tab.sharepoint_filename_template}</span>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // For complex scopes - read-only preview (configured in separate tab)
  return (
    <div
      className="flex items-center gap-1 py-1 px-1 rounded-sm hover:bg-muted/50 group"
      style={{ paddingLeft: `${level * 16 + 24}px` }}
    >
      <FileText className="h-3.5 w-3.5 text-blue-500 dark:text-blue-400 flex-shrink-0" />
      <span className="text-sm">{tab.display_name}</span>
      <span className="ml-auto text-[10px] text-muted-foreground font-mono opacity-60">
        {tab.sharepoint_folder_path || '(no subfolder)'}
      </span>
    </div>
  );
}

export function StorageConfigTab() {
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
    // SSoT: Scope folders loaded from StorageConfiguration.SCOPE_FOLDERS via API
    scope_folders: {} as ScopeFolders,
    // SSoT: Templates for folder paths and filenames per scope
    scope_templates: {} as Record<string, string>,
    file_name_templates: {} as Record<string, string>,
    // SSoT: Config links for scope folders
    config_links: {} as Record<string, string>,
    // Phase 4: Virtual scopes (render from DB instead of S3)
    virtual_scopes: {} as Record<string, boolean>,
  });
  // Tree view state
  const [expandedPaths, setExpandedPaths] = React.useState<Set<string>>(new Set());
  const [editingKey, setEditingKey] = React.useState<string | null>(null);
  const [editingTabId, setEditingTabId] = React.useState<number | null>(null);

  // Entity tabs for each scope
  const [entityTabs, setEntityTabs] = React.useState<Record<string, EntityTab[]>>({});
  const [loadingTabs, setLoadingTabs] = React.useState(false);

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
      const response = await api.get<{
        success: boolean;
        data: {
          counts: Record<string, number>;
        }
      }>("/api/v1/documents/all");
      if (response?.success && response.data?.counts) {
        const counts = response.data.counts;
        setWarehouseStats({
          warehouse_total: counts.warehouse_total || 0,
          warehouse_by_source: (counts.warehouse_by_source as unknown as Record<string, number>) || {},
          counts: counts,
        });
      }
    } catch (error) {
      console.error("Failed to load warehouse stats:", error);
    } finally {
      setLoadingWarehouse(false);
    }
  };

  // Fetch entity tabs for all scopes
  const loadEntityTabs = async () => {
    setLoadingTabs(true);
    try {
      const tabsByScope: Record<string, EntityTab[]> = {};

      // Fetch tabs for each scope in parallel
      const scopeKeys = Object.keys(SCOPE_TO_API_SCOPE);
      const results = await Promise.all(
        scopeKeys.map(async (scopeKey) => {
          const apiScope = SCOPE_TO_API_SCOPE[scopeKey];
          const response = await api.get<{ success: boolean; data: { tabs: EntityTab[] } }>(
            `/api/v1/entity_tabs?scope=${apiScope}`
          );
          return { scopeKey, tabs: response?.success ? response.data.tabs : [] };
        })
      );

      results.forEach(({ scopeKey, tabs }) => {
        // Include all tabs (no parent_id filter - warehouse tabs may have parent)
        tabsByScope[scopeKey] = tabs;
      });

      setEntityTabs(tabsByScope);
    } catch (error) {
      console.error("Failed to load entity tabs:", error);
    } finally {
      setLoadingTabs(false);
    }
  };

  // Build folder tree from scope_folders, attaching tabs to scope nodes
  // SSoT: Use config.scope_folders directly from API (not formData which may have stale initial state)
  const folderTree = React.useMemo(() => {
    const scopeFolders = config?.scope_folders || {};
    const tree = buildFolderTree(scopeFolders);

    // Attach tabs to scope nodes
    const attachTabs = (nodes: FolderTreeNode[]) => {
      nodes.forEach(node => {
        if (node.scopeKey && entityTabs[node.scopeKey]) {
          node.tabs = entityTabs[node.scopeKey];
        }
        if (node.children.length > 0) {
          attachTabs(node.children);
        }
      });
    };

    attachTabs(tree);
    return tree;
  }, [config?.scope_folders, entityTabs]);

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
      const scopesAtPath = Object.entries(formData.scope_folders)
        .filter(([, folderPath]) => folderPath === path || folderPath.startsWith(path + '/'))
        .map(([scopeKey]) => scopeKey);
      if (scopesAtPath.includes(editingKey)) {
        setEditingKey(null);
      }
    }
  };

  // Save tab folder path, template, and filename template via API
  const saveTabFolderPath = async (
    tabId: number,
    folderPath: string,
    folderTemplate: string | null,
    filenameTemplate: string | null
  ) => {
    try {
      const response = await api.patch<{ success: boolean }>(
        `/api/v1/entity_tabs/${tabId}`,
        {
          entity_tab: {
            sharepoint_folder_path: folderPath,
            sharepoint_folder_template: folderTemplate,
            sharepoint_filename_template: filenameTemplate,
          }
        }
      );
      if (response?.success) {
        // Update local state
        setEntityTabs(prev => {
          const newTabs = { ...prev };
          Object.keys(newTabs).forEach(scope => {
            newTabs[scope] = newTabs[scope].map(tab =>
              tab.id === tabId
                ? {
                    ...tab,
                    sharepoint_folder_path: folderPath,
                    sharepoint_folder_template: folderTemplate,
                    sharepoint_filename_template: filenameTemplate,
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
    }
    setEditingTabId(null);
  };

  // SSoT: Save scope templates via API (called by auto-save in TreeNode)
  const saveScopeTemplates = React.useCallback(async (
    scopeKey: string,
    baseFolder: string,
    folderTemplate: string,
    filenameTemplate: string,
    configLink: string | null
  ) => {
    try {
      const response = await api.patch<{ success: boolean; data: StorageConfig }>(
        "/api/v1/storage_configuration",
        {
          storage: {
            scope_folders: { [scopeKey]: baseFolder },
            scope_templates: { [scopeKey]: folderTemplate },
            file_name_templates: { [scopeKey]: filenameTemplate },
            config_links: { [scopeKey]: configLink }, // null removes the link
          }
        }
      );
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
            scope_folders: { ...prev.scope_folders, [scopeKey]: baseFolder },
            scope_templates: { ...prev.scope_templates, [scopeKey]: folderTemplate },
            file_name_templates: { ...prev.file_name_templates, [scopeKey]: filenameTemplate },
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
  }, [toast]);

  // Phase 4: Toggle virtual scope via API
  const toggleVirtualScope = React.useCallback(async (scopeKey: string, isVirtual: boolean) => {
    try {
      const response = await api.patch<{ success: boolean; data: StorageConfig }>(
        "/api/v1/storage_configuration",
        {
          storage: {
            virtual_scopes: { [scopeKey]: isVirtual },
          }
        }
      );
      if (response?.success) {
        // Update local state
        setFormData(prev => ({
          ...prev,
          virtual_scopes: { ...prev.virtual_scopes, [scopeKey]: isVirtual },
        }));
        toast({
          title: "Saved",
          description: `${scopeKey} is now ${isVirtual ? 'virtual (database-driven)' : 'physical (S3-driven)'}`,
        });
      } else {
        throw new Error('Failed to save virtual scope setting');
      }
    } catch (error) {
      console.error("Failed to toggle virtual scope:", error);
      toast({
        title: "Error",
        description: "Failed to save virtual scope setting",
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

  // Load storage config and entity tabs on mount
  React.useEffect(() => {
    loadConfig();
    loadEntityTabs();
  }, []);

  const loadConfig = async () => {
    try {
      setLoading(true);
      const response = await api.get<{ success: boolean; data: StorageConfig }>(
        "/api/v1/storage_configuration"
      );
      if (response?.success && response.data) {
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
          // SSoT: Scope folders from StorageConfiguration.SCOPE_FOLDERS
          scope_folders: response.data.scope_folders || {},
          // SSoT: Templates from StorageConfiguration
          scope_templates: response.data.scope_templates || {},
          file_name_templates: response.data.file_name_templates || {},
          // SSoT: Config links from StorageConfiguration
          config_links: response.data.config_links || {},
          // Phase 4: Virtual scopes from StorageConfiguration
          virtual_scopes: response.data.virtual_scopes || {},
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
        "/api/v1/storage_configuration",
        {
          storage: {
            provider_type: formData.provider_type,
            root_path: formData.root_path,
            // SSoT: scope_root_folders is THE ONE place for scope roots
            scope_root_folders: config?.scope_root_folders,
            scope_folders: formData.scope_folders,
            scope_templates: formData.scope_templates,
            file_name_templates: formData.file_name_templates,
            config_links: formData.config_links,
            virtual_scopes: formData.virtual_scopes,  // Phase 4: Virtual File Warehouse
            scope_options: config?.scope_options,     // Per-scope options (e.g., task.exclude_sm_linked)
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
        "/api/v1/storage_configuration/test"
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

      {/* Tabs: Configuration vs Live Preview */}
      <Tabs defaultValue="config" className="w-full">
        <TabsList className="grid w-full grid-cols-2 max-w-md">
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

      {/* Root Path Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Root Path
          </CardTitle>
          <CardDescription>
            Base path in the storage provider. All folder paths are relative to this root.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="root_path">Root Path</Label>
            <Input
              id="root_path"
              value={formData.root_path}
              onChange={(e) => handleChange("root_path", e.target.value)}
              placeholder="/ (drive root)"
              className="font-mono"
            />
            <p className="text-xs text-muted-foreground">
              Base path for all storage. S3/Wasabi: use &quot;/&quot; (bucket root). SharePoint: use &quot;/Shared Documents&quot;.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Scope Root Folders - SSoT for scope base paths */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <FolderTree className="h-4 w-4" />
                Scope Root Folders
              </CardTitle>
              <CardDescription>
                Root folder for each scope. All tab paths are relative to these roots.
              </CardDescription>
            </div>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={saving}
              className="h-8"
            >
              {saving ? <Spinner className="h-4 w-4 mr-2" /> : <Save className="h-4 w-4 mr-2" />}
              Save
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {Object.entries(config?.scope_root_folders || {}).map(([scope, folder]) => {
              // Available placeholders per scope
              const scopePlaceholders: Record<string, string[]> = {
                job: ['JobCode', 'JobName'],
                contact: ['ContactName', 'ContactID'],
                corporate_entity: ['CompanyGroup', 'CompanyCode', 'CompanyName'],
                people: ['ContactName', 'ContactID'],
                task: ['JobCode', 'JobName', 'TaskNumber', 'TaskName', 'TaskStatus'],
                email: ['Mailbox', 'Year', 'Month'],
                warehouse: ['UserName', 'Year', 'Month'],
              };
              const placeholders = scopePlaceholders[scope] || [];

              // Insert placeholder at cursor or end
              const insertPlaceholder = (placeholder: string) => {
                const token = `{{${placeholder}}}`;
                const newValue = folder.includes(token) ? folder : `${folder}${folder && !folder.endsWith('/') ? '/' : ''}${token}`;
                const newRoots = { ...(config?.scope_root_folders || {}), [scope]: newValue };
                setConfig(prev => prev ? { ...prev, scope_root_folders: newRoots } : prev);
              };

              return (
                <div key={scope} className="flex items-start gap-3 pb-3 border-b last:border-0 last:pb-0">
                  <div className="flex items-center gap-2 min-w-[130px] pt-1">
                    {scope === 'job' && <Briefcase className="h-4 w-4 text-blue-500" />}
                    {scope === 'contact' && <Users className="h-4 w-4 text-green-500" />}
                    {scope === 'corporate_entity' && <Building2 className="h-4 w-4 text-purple-500" />}
                    {scope === 'people' && <Users className="h-4 w-4 text-teal-500" />}
                    {scope === 'task' && <ClipboardList className="h-4 w-4 text-orange-500" />}
                    {scope === 'email' && <Mail className="h-4 w-4 text-red-500" />}
                    {scope === 'warehouse' && <FileBox className="h-4 w-4 text-amber-500" />}
                    <Label className="text-sm font-medium">{getScopeLabel(scope)}</Label>
                  </div>
                  <div className="flex-1 space-y-1.5">
                    <Input
                      value={folder}
                      onChange={(e) => {
                        const newRoots = { ...(config?.scope_root_folders || {}), [scope]: e.target.value };
                        setConfig(prev => prev ? { ...prev, scope_root_folders: newRoots } : prev);
                      }}
                      className="font-mono h-8"
                      placeholder={getScopeLabel(scope)}
                    />
                    {placeholders.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {placeholders.map((p) => (
                          <button
                            key={p}
                            type="button"
                            onClick={() => insertPlaceholder(p)}
                            className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-mono bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors"
                            title={`Click to insert {{${p}}}`}
                          >
                            {`{{${p}}}`}
                          </button>
                        ))}
                      </div>
                    )}
                    {scope === 'task' && (
                      <div className="flex items-center gap-2 pt-1">
                        <Checkbox
                          id="exclude-sm-linked"
                          checked={config?.scope_options?.task?.exclude_sm_linked ?? false}
                          onCheckedChange={(checked) => {
                            const newOptions = {
                              ...(config?.scope_options || {}),
                              task: {
                                ...(config?.scope_options?.task || {}),
                                exclude_sm_linked: !!checked
                              }
                            };
                            setConfig(prev => prev ? { ...prev, scope_options: newOptions } : prev);
                          }}
                        />
                        <Label htmlFor="exclude-sm-linked" className="text-xs text-muted-foreground cursor-pointer">
                          Exclude tasks linked to Schedule Master (use PO storage)
                        </Label>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Scope Folders - Tree View */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <FolderTree className="h-4 w-4" />
              Scope Folders
            </CardTitle>
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
            Folder structure for each entity type. Click a scope label to edit its path.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Tree view of folder structure */}
          <div className="border rounded-md p-3 bg-muted/20">
            {/* Root path header */}
            <div className="flex items-center gap-2 mb-2 pb-2 border-b">
              <Folder className="h-4 w-4 text-amber-500" />
              <span className="font-mono text-sm font-medium">
                {formData.root_path || "/"}
              </span>
              <span className="text-xs text-muted-foreground">(root)</span>
            </div>

            {/* Recursive tree render */}
            {folderTree.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2">No scope folders configured</p>
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
                        scope_folders: { ...prev.scope_folders, [key]: value }
                      }));
                      setEditingKey(null);
                    }}
                    onCancelEdit={() => setEditingKey(null)}
                    currentPath={formData.scope_folders}
                    rootPath={formData.root_path}
                    editingTabId={editingTabId}
                    onStartTabEdit={setEditingTabId}
                    onSaveTabEdit={saveTabFolderPath}
                    onCancelTabEdit={() => setEditingTabId(null)}
                    scopeTemplates={formData.scope_templates}
                    fileNameTemplates={formData.file_name_templates}
                    configLinks={formData.config_links}
                    onSaveTemplates={saveScopeTemplates}
                    virtualScopes={formData.virtual_scopes}
                    onToggleVirtual={toggleVirtualScope}
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
              <Badge variant="outline" className="h-4 text-[10px] px-1">scope</Badge>
              Scope folder
            </span>
            <span className="flex items-center gap-1">
              <FileText className="h-3 w-3 text-blue-500 dark:text-blue-400" />
              Tab (click to edit path)
            </span>
          </div>

          {/* Loading indicator for tabs */}
          {loadingTabs && (
            <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
              <Spinner size={12} />
              Loading tabs...
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
                      <div className="flex items-center gap-2">
                        <Folder className="h-4 w-4 text-amber-500" />
                        <span className="font-medium">{formData.root_path || "/"}</span>
                        <span className="text-muted-foreground text-xs">(root)</span>
                      </div>
                      {/* Render configured scopes with their computed paths */}
                      {Object.entries(formData.scope_folders)
                        .filter(([, path]) => path)
                        .sort(([, a], [, b]) => a.localeCompare(b))
                        .map(([scopeKey, basePath]) => {
                          const template = formData.scope_templates[scopeKey] || DEFAULT_FOLDER_TEMPLATES[scopeKey] || '';
                          const count = warehouseStats.warehouse_by_source[scopeKey] || 0;
                          const icons: Record<string, React.ReactNode> = {
                            email: <Mail className="h-3.5 w-3.5 text-blue-500" />,
                            email_attachments: <Mail className="h-3.5 w-3.5 text-blue-500" />,
                            job: <Briefcase className="h-3.5 w-3.5 text-green-500" />,
                            contact: <Users className="h-3.5 w-3.5 text-purple-500" />,
                            corporate: <Building2 className="h-3.5 w-3.5 text-orange-500" />,
                            corporate_entity: <Building2 className="h-3.5 w-3.5 text-orange-500" />,
                            task: <ClipboardList className="h-3.5 w-3.5 text-red-500" />,
                            task_attachments: <ClipboardList className="h-3.5 w-3.5 text-red-500" />,
                            task_responses: <ClipboardList className="h-3.5 w-3.5 text-red-500" />,
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
    </div>
  );
}
