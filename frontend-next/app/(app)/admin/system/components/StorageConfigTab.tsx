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
  FolderHeart,
  Clock,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { ExpandChevron } from "@/components/ui/expand-chevron";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";
import { Spinner } from "@/components/ui/spinner";
import { TokenBuilder, resolveWithExamples } from "@/components/ui/tokens";
import Link from "next/link";

// SSoT: Simple scopes have inline editing (no document types)
// Note: 'overview' is needed because the Tasks folder can have scopeKey='overview'
// (from EntityTab.scope_base_folders when tab_key='overview' shares path with 'task')
// Note: 'user' added for Teeem Docs (personal user documents)
const SIMPLE_SCOPES = ['email', 'warehouse', 'task', 'user', 'overview'];
// SSoT: Complex scopes need separate tab (have document types, entity filters)
const COMPLEX_SCOPES = ['corporate', 'job', 'contact'];

// Human-readable labels for scope links
const SCOPE_LABELS: Record<string, string> = {
  corporate: 'Corporate',
  job: 'Jobs',
  contact: 'Contacts',
  user: 'Teeem Docs',
  // Template sub-scopes (Jan 2026)
  template_documents: 'Document Templates',
  template_bank_statements: 'Bank Statements',
  template_invoices: 'Invoice Templates',
  template_email_signatures: 'Email Signatures',
  template_pdf_fields: 'PDF Fields',
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

// Document type interface
interface DocumentType {
  id: number;
  name: string;
  code: string;
  display_name?: string;
}

// Entity tab interface for tabs under each scope
interface EntityTab {
  id: number;
  tab_key: string;
  display_name: string;
  scope: string;
  parent_id: number | null;
  has_storage_folder: boolean | null;
  storage_folder_path: string | null;
  send_name_template: string | null;
  enabled: boolean;
  order_position: number;
  icon_name: string | null;
  warehouse_folder?: string | null;
  children?: EntityTab[];
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
  file_name_templates: Record<string, string>;
  display_name_templates: Record<string, string>;
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
  tabs?: EntityTab[];  // Tabs under this scope folder
}

// SSoT: Known scope root folder names (first segment of paths that should appear at root)
// These match WAREHOUSE_ROOT_DEFAULTS in StorageConfiguration (Jan 2026 consolidation)
// Note: 'People' merged into 'Contacts'
// Note: 'Users' added for Teeem Docs (personal user documents - Jan 2026)
const KNOWN_ROOT_FOLDERS = [
  'Jobs', 'Contacts', 'Corporate', 'Tasks', 'Emails', 'Users', 'Teeem Docs', 'Warehouse', 'Shared', 'System',
  // Added Jan 2026 - new warehouse scopes
  'Cases', 'Assets', 'Financials', 'Payments', 'ESignatures', 'Templates'
];

// Build tree structure from flat scope folders
function buildFolderTree(scopeFolders: ScopeFolders): FolderTreeNode[] {
  const root: FolderTreeNode[] = [];

  // Sort entries by path for consistent tree building
  // SSoT FIX (Jan 2026): Filter out null values before sorting to prevent crash
  // API may return null values for scopes that haven't been configured
  const entries = Object.entries(scopeFolders)
    .filter(([, path]) => path !== null && path !== undefined)
    .sort(([, a], [, b]) => a.localeCompare(b));

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
      // These have keys like 'email', 'warehouse', 'job', 'user', etc.
      // SSoT: 'people' merged into 'contact' (Jan 2026 consolidation)
      const isOverviewTab = ['email', 'warehouse', 'job', 'contact', 'task', 'corporate', 'corporate', 'user'].includes(key);
      if (!isOverviewTab) return false;
    }
    return true;
  });

  // Main scope keys that should have scopeKey on their first folder, not the leaf
  // SSoT: 'people' merged into 'contact' (Jan 2026 consolidation)
  // SSoT: 'case' added for Case document management (Jan 2026)
  // SSoT: 'asset' added for Asset Register documents (Jan 2026)
  // SSoT: 'financial' added for Financial transaction receipts (Jan 2026)
  // SSoT: 'compliance' added for job compliance docs (Jan 2026)
  // SSoT: 'payment' added for subcontractor payment docs (Jan 2026)
  // SSoT: 'bank_statement', 'template', 'esignature', 'plan' added (Jan 2026)
  // SSoT: All scope keys that should show as badges in the tree view
  // Includes sub-scopes like task_attachments, task_responses that need separate configuration
  const mainScopeKeys = [
    'email', 'warehouse', 'job', 'contact', 'task', 'corporate', 'user',
    'case', 'case_documents', 'case_emails',
    'asset', 'asset_expenses', 'asset_service', 'asset_readings',
    'financial', 'financial_transactions',
    'compliance', 'payment', 'payment_invoices', 'payment_proof',
    'bank_statement', 'template',
    'template_documents', 'template_bank_statements', 'template_invoices', 'template_email_signatures', 'template_pdf_fields',
    'esignature', 'esignature_pending', 'esignature_completed',
    'plan',
    'task_attachments', 'task_responses'  // Task sub-scopes for attachments and responses
  ];

  filteredEntries.forEach(([key, path]) => {
    if (!path) return;

    // Split path but stop at first placeholder for folder building
    // e.g., "Tasks/{{TaskStatus}}/{{JobName}}" → only create "Tasks" folder
    const allParts = path.split('/').filter(Boolean);
    const isMainScope = mainScopeKeys.includes(key);

    // For main scopes, only take parts before first placeholder
    // This prevents creating {{TaskStatus}}, {{JobName}} etc. as folders
    let parts = allParts;
    if (isMainScope) {
      const firstPlaceholderIndex = allParts.findIndex(p => p.startsWith('{{'));
      if (firstPlaceholderIndex > 0) {
        parts = allParts.slice(0, firstPlaceholderIndex);
      } else if (firstPlaceholderIndex === 0) {
        // Path starts with placeholder - skip entirely
        return;
      }
    }

    let current = root;
    let currentPath = '';

    parts.forEach((part, index) => {
      // Skip placeholder parts entirely for tree building
      if (part.startsWith('{{')) return;

      currentPath = currentPath ? `${currentPath}/${part}` : part;
      const isLeaf = index === parts.length - 1;
      // For main scopes, set scopeKey on first folder, not leaf
      const shouldSetScopeKey = isMainScope ? (index === 0) : isLeaf;

      // Look for existing node at this level
      let node = current.find(n => n.name === part);

      if (!node) {
        // Only add main scope keys to scopeKeys (prevents duplicate badges from legacy variants like email-attachments)
        const shouldAddAsScopeKey = shouldSetScopeKey && mainScopeKeys.includes(key);
        node = {
          name: part,
          path: currentPath,
          scopeKey: shouldAddAsScopeKey ? key : null,
          scopeKeys: shouldAddAsScopeKey ? [key] : [],
          children: [],
        };
        current.push(node);
      } else if (shouldSetScopeKey && mainScopeKeys.includes(key)) {
        // Multiple scopes share this path - add to scopeKeys array
        // Only add main scope keys (prevents duplicate badges from legacy variants)
        if (!node.scopeKeys.includes(key)) {
          node.scopeKeys.push(key);
        }
        // SSoT: Main scope keys (email, job, task, etc.) should ALWAYS be the primary scopeKey
        // because warehouse_folders only has entries for main scopes
        // Without this, 'email-attachments' (alphabetically first) would steal primary from 'email'
        if (!node.scopeKey || (isMainScope && !mainScopeKeys.includes(node.scopeKey))) {
          node.scopeKey = key;
        }
      }

      current = node.children;
    });
  });

  return root;
}

// Get scope label from key (uses SCOPE_LABELS if defined, else snake_case to Title Case)
function getScopeLabel(key: string): string {
  // Check SCOPE_LABELS first for custom labels (e.g., 'user' → 'Teeem Docs')
  if (SCOPE_LABELS[key]) {
    return SCOPE_LABELS[key];
  }
  // Fallback: convert snake_case to Title Case
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
  onSaveTabEdit: (tabId: number, path: string, displayName: string, sendNameTemplate: string) => void;
  onCancelTabEdit: () => void;
  // Parent scope info for simple scope detection
  parentScopeKey?: string | null;
  // SSoT: Templates for auto-save
  scopeTemplates: Record<string, string>;
  fileNameTemplates: Record<string, string>;
  displayNameTemplates: Record<string, string>;
  configLinks: Record<string, string>;
  onSaveTemplates: (scopeKey: string, baseFolder: string, folderTemplate: string, filenameTemplate: string, displayNameTemplate: string, configLink: string | null) => Promise<void>;
  // Phase 4: Virtual scopes
  virtualScopes: Record<string, boolean>;
  onToggleVirtual: (scopeKey: string, isVirtual: boolean) => Promise<void>;
  // SSoT: warehouse_folders - full path patterns like Jobs/{{JobCode}}
  scopeRootFolders: Record<string, string>;
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
  displayNameTemplates,
  configLinks,
  onSaveTemplates,
  virtualScopes,
  onToggleVirtual,
  scopeRootFolders,
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
    activeScopeKey ? scopeTemplates[activeScopeKey] || '' : ''
  );
  const [filenameTemplate, setFilenameTemplate] = React.useState(
    activeScopeKey ? fileNameTemplates[activeScopeKey] || '' : ''
  );
  const [displayNameTemplate, setDisplayNameTemplate] = React.useState(
    activeScopeKey ? displayNameTemplates[activeScopeKey] || '' : ''
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
  const saveTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  // Track if templates have been modified (to avoid saving on initial load)
  const hasModified = React.useRef(false);
  // Track previous scope to save when switching
  const prevScopeRef = React.useRef<{
    scopeKey: string;
    baseFolder: string;
    folder: string;
    filename: string;
    displayName: string;
    configLink: string | null;
  } | null>(null);
  // Track the last scope we initialized for (to avoid re-initializing on prop changes)
  const initializedScopeRef = React.useRef<string | null>(null);

  // Immediate save function (no debounce) - for switching scopes
  const saveImmediate = React.useCallback(async (scopeKey: string, baseFolder: string, folder: string, filename: string, displayName: string, configLink: string | null) => {
    if (!scopeKey) return;
    try {
      await onSaveTemplates(scopeKey, baseFolder, folder, filename, displayName, configLink);
    } catch (error) {
      console.error('Failed to save templates:', error);
    }
  }, [onSaveTemplates]);

  // Auto-save function with debounce - calls actual API
  const autoSave = React.useCallback(async (scopeKey: string, baseFolder: string, folder: string, filename: string, displayName: string, configLink: string | null) => {
    if (!scopeKey || !hasModified.current) return;

    // Update the ref so we can save when switching
    prevScopeRef.current = { scopeKey, baseFolder, folder, filename, displayName, configLink };

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    saveTimeoutRef.current = setTimeout(async () => {
      setIsSaving(true);
      try {
        await onSaveTemplates(scopeKey, baseFolder, folder, filename, displayName, configLink);
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
      autoSave(currentEditingScopeKey, editValue, folderTemplate, filenameTemplate, displayNameTemplate, linkToSave);
    }
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [editValue, folderTemplate, filenameTemplate, displayNameTemplate, hasConfigLink, configLinkUrl, currentEditingScopeKey, autoSave]);

  // Save previous scope immediately when switching to a different scope
  React.useEffect(() => {
    // If we have pending changes from a previous scope, save them immediately
    if (prevScopeRef.current && prevScopeRef.current.scopeKey !== currentEditingScopeKey) {
      const prev = prevScopeRef.current;
      saveImmediate(prev.scopeKey, prev.baseFolder, prev.folder, prev.filename, prev.displayName, prev.configLink);
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

  const handleDisplayNameTemplateChange = (value: string) => {
    hasModified.current = true;
    setDisplayNameTemplate(value);
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
          scopeTemplates[currentEditingScopeKey] || ''
        );
        setFilenameTemplate(
          fileNameTemplates[currentEditingScopeKey] || ''
        );
        setDisplayNameTemplate(
          displayNameTemplates[currentEditingScopeKey] || ''
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
  }, [currentEditingScopeKey, currentPath, node.path, scopeTemplates, fileNameTemplates, displayNameTemplates, configLinks]);

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

        {/* Scope badges - show all scopes that share this path */}
        {node.scopeKeys && node.scopeKeys.length > 0 && (
          <div className="flex items-center gap-1 ml-2">
            {node.scopeKeys.map((sk) => (
              <div key={sk} className="flex items-center gap-1">
                <Badge
                  variant="outline"
                  className={cn(
                    "h-5 text-[10px] px-1.5 bg-background cursor-pointer hover:bg-muted transition-colors",
                    editingKey === sk && "ring-2 ring-primary"
                  )}
                  onClick={(e) => {
                    e.stopPropagation();
                    // Auto-expand folder to show edit panel and children
                    if (!expandedPaths.has(node.path)) {
                      onToggle(node.path);
                    }
                    onStartEdit(sk);
                  }}
                  title="Click to edit path"
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
            if (url.includes('corporate')) return 'Corporate tab';
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
      </div>

      {/* SSoT: Show warehouse_folders path pattern under folder name */}
      {(() => {
        const scopeKey = node.scopeKey || node.scopeKeys?.[0];
        const rootFolderPath = scopeKey ? scopeRootFolders[scopeKey] : null;
        if (!isEditingThisNode && rootFolderPath) {
          return (
            <div
              className="text-[10px] text-muted-foreground font-mono"
              style={{ paddingLeft: `${level * 16 + 28}px` }}
            >
              {rootFolderPath?.replace(/\/+/g, '/').replace(/\/+$/, '')}
            </div>
          );
        }
        return null;
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

            {/* Base Folder (editable) */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Base Folder</label>
              <div className="flex items-center gap-2">
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
                Storage folder path. Use the same path for related types to group them on one row.
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

            {/* Full Path Preview - directly under Folder Path for immediate feedback */}
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded px-3 py-2 -mt-2">
              <span className="text-xs text-muted-foreground">Full Path: </span>
              <span className="font-mono text-sm text-green-700 dark:text-green-400">
                {[rootPath, editValue, folderTemplate].filter(Boolean).join('/').replace(/\/+/g, '/')}
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

            {/* Display Name Template (what user sees in UI) */}
            <TokenBuilder
              label={<span className="text-xs font-medium">Display Name</span>}
              value={displayNameTemplate}
              onChange={handleDisplayNameTemplateChange}
              scope="storage"
              showPreview={true}
              placeholder="Click tokens to build display name..."
              defaultExpanded={false}
            />

            {/* Send Name Template (download filename) */}
            <TokenBuilder
              label={<span className="text-xs font-medium">Send Name</span>}
              value={filenameTemplate}
              onChange={handleFilenameTemplateChange}
              scope="storage"
              showPreview={true}
              placeholder="Click tokens to build filename..."
              defaultExpanded={false}
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
                  const template = scopeTemplates[sk] || '';
                  const filename = fileNameTemplates[sk] || '';
                  // Skip COMPLEX_SCOPES - they show via tabs section exclusively (job, contact, corporate)
                  // Skip scopes with config links (they show tabs instead)
                  if (!COMPLEX_SCOPES.includes(sk) && !configLinks[sk] && template) {
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

                  // Render the first part - resolve placeholders to examples (e.g., {{TeeemXL}} → TeeemXL)
                  rendered.push(
                    <div
                      key={`first-${firstPart}`}
                      className="flex items-center gap-1 py-0.5 px-1"
                      style={{ paddingLeft: `${(level + 1) * 16 + 4}px` }}
                    >
                      <span className="w-5" />
                      <Folder className="h-3.5 w-3.5 text-amber-500/50 flex-shrink-0" />
                      <span className="font-mono text-xs text-muted-foreground italic">
                        {resolveWithExamples(firstPart)}
                      </span>
                    </div>
                  );

                  // Render the remaining parts for each scope - resolve placeholders to examples
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
                            {resolveWithExamples(part)}
                          </span>
                          {isLast && filename && (
                            <span className="ml-2 text-[10px] text-muted-foreground/60">
                              → {resolveWithExamples(filename)}
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
          {/* SSoT: Entity identifier (e.g., {{JobCode}}) comes from warehouse_folders, not extracted from template */}
          {hasTabs && node.scopeKey ? (
            <div className="ml-1">
              {node.tabs!.map((tab) => (
                <TabNode
                  key={tab.id}
                  tab={tab}
                  level={level + 1}
                  basePath={fullPath}
                  rootPath={rootPath}
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
                displayNameTemplates={displayNameTemplates}
                configLinks={configLinks}
                onSaveTemplates={onSaveTemplates}
                virtualScopes={virtualScopes}
                onToggleVirtual={onToggleVirtual}
                scopeRootFolders={scopeRootFolders}
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
  rootPath: string;
  scope: string;
  editingTabId: number | null;
  onStartEdit: (tabId: number) => void;
  onSaveEdit: (tabId: number, path: string, displayName: string, sendNameTemplate: string) => void;
  onCancelEdit: () => void;
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
}: TabNodeProps) {
  const isEditing = editingTabId === tab.id;
  const isSimpleScope = SIMPLE_SCOPES.includes(scope);

  // Extract just the folder name from stored path (strip base path if present)
  const extractFolderName = (storedPath: string | null | undefined, base: string): string => {
    if (!storedPath) return '';
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

  // Folder name: extract from stored path, or default to display_name
  const storedPath = tab.warehouse_folder || tab.storage_folder_path;
  const defaultFolderName = storedPath ? extractFolderName(storedPath, basePath) : (tab.display_name || '');
  const [editPath, setEditPath] = React.useState(defaultFolderName);
  const [editDisplayName, setEditDisplayName] = React.useState(tab.display_name || '');
  const [editSendName, setEditSendName] = React.useState(tab.send_name_template || '');

  React.useEffect(() => {
    if (isEditing) {
      const stored = tab.warehouse_folder || tab.storage_folder_path;
      const folderName = stored ? extractFolderName(stored, basePath) : (tab.display_name || '');
      setEditPath(folderName);
      setEditDisplayName(tab.display_name || '');
      setEditSendName(tab.send_name_template || '');
    }
  }, [isEditing, tab.warehouse_folder, tab.storage_folder_path, tab.display_name, tab.send_name_template, basePath]);

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
        {/* Tab header row - show tab's display_name (this is the folder name) */}
        <div className="flex items-center gap-1 mb-2">
          <FileText className="h-3.5 w-3.5 text-blue-500 dark:text-blue-400 flex-shrink-0" />
          <span className="text-sm font-medium">{tab.display_name}</span>
          {!isEditing && (
            <span className="text-[10px] text-muted-foreground ml-2 opacity-0 group-hover:opacity-100">(click to edit)</span>
          )}
        </div>

        {isEditing ? (
          <div className="space-y-3 ml-4 border-l-2 border-blue-200 dark:border-blue-800 pl-3">
            {/* Display Name - what users see in UI */}
            <div className="space-y-1">
              <TokenBuilder
                label={<span className="text-[11px] font-medium text-muted-foreground">Display Name</span>}
                value={editDisplayName}
                onChange={setEditDisplayName}
                scope="storage"
                showPreview={true}
                separator=" "
                placeholder="Name shown in UI..."
                defaultExpanded={false}
              />
            </div>

            {/* Root folder path (read-only) */}
            <div className="space-y-1">
              <span className="text-[11px] font-medium text-muted-foreground">Root Path</span>
              <div className="bg-muted/50 border border-muted rounded px-2 py-1.5">
                <span className="font-mono text-xs text-muted-foreground">
                  {rootPath || '/'}
                </span>
              </div>
            </div>

            {/* Folder Path - the folder name in storage */}
            <div className="space-y-1">
              <TokenBuilder
                label={<span className="text-[11px] font-medium text-muted-foreground">Folder Path</span>}
                value={editPath}
                onChange={setEditPath}
                scope="storage"
                showPreview={false}
                separator="/"
                placeholder="e.g. TeeemXL"
                defaultExpanded={false}
              />
              {/* Full path preview - basePath is the SSoT template with {{TeeemXL}} replaced by folder name */}
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded px-2 py-1">
                <span className="text-[10px] text-muted-foreground font-medium">Full Path: </span>
                <span className="font-mono text-xs text-green-700 dark:text-green-400">
                  {[rootPath, basePath.replace(/\{\{TeeemXL\}\}|\{\{TabName\}\}/g, editPath || '...')]
                    .filter(Boolean)
                    .join('/')
                    .replace(/\/+/g, '/') || '/'}
                </span>
              </div>
            </div>

            {/* Download filename template */}
            <div className="space-y-1">
              <TokenBuilder
                label={<span className="text-[11px] font-medium text-muted-foreground">Download Filename</span>}
                value={editSendName}
                onChange={setEditSendName}
                scope="storage"
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
                  console.log('[TabNode Save] Clicked:', { tabId: tab.id, editPath, editDisplayName, editSendName });
                  onSaveEdit(tab.id, editPath, editDisplayName, editSendName);
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
          // Show display name, folder path, and download filename when not editing
          <div className="ml-4 text-[11px] text-muted-foreground space-y-0.5">
            <div>
              <span className="font-medium">Display Name: </span>
              <span>{tab.display_name}</span>
            </div>
            <div>
              <span className="font-medium">Folder Path: </span>
              <span className="font-mono">
                {[rootPath, basePath.replace(/\{\{TeeemXL\}\}|\{\{TabName\}\}/g, defaultFolderName)]
                  .filter(Boolean)
                  .join('/')
                  .replace(/\/+/g, '/')}
              </span>
            </div>
            <div>
              <span className="font-medium">Download As: </span>
              <span className="font-mono">{tab.send_name_template || '{{OriginalFileName}}'}</span>
            </div>
          </div>
        )}
      </div>
    );
  }

  // For complex scopes - show tab with folder path, document types, and children
  const hasChildren = tab.children && tab.children.length > 0;
  const hasDocTypes = tab.document_types && tab.document_types.length > 0;
  const folderPath = tab.warehouse_folder || tab.storage_folder_path;

  return (
    <div>
      <div
        className="flex items-center gap-1 py-1 px-1 rounded-sm hover:bg-muted/50 group"
        style={{ paddingLeft: `${level * 16 + 24}px` }}
      >
        <FileText className="h-3.5 w-3.5 text-blue-500 dark:text-blue-400 flex-shrink-0" />
        <span className="text-sm">{tab.display_name}</span>
        {/* Show document type count if has doc types */}
        {hasDocTypes && (
          <span className="text-[10px] px-1.5 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded">
            {tab.document_types!.length} {tab.document_types!.length === 1 ? 'type' : 'types'}
          </span>
        )}
      </div>
      {/* Show folder path if set */}
      {folderPath && (
        <div
          className="text-[10px] text-muted-foreground font-mono py-0.5"
          style={{ paddingLeft: `${level * 16 + 44}px` }}
        >
          📁 {folderPath}
        </div>
      )}
      {/* Show document types inline */}
      {hasDocTypes && (
        <div
          className="flex flex-wrap gap-1 py-1"
          style={{ paddingLeft: `${level * 16 + 44}px` }}
        >
          {tab.document_types!.map((dt) => (
            <span
              key={dt.id}
              className="text-[10px] px-1.5 py-0.5 bg-muted text-muted-foreground rounded"
            >
              {dt.display_name || dt.name}
            </span>
          ))}
        </div>
      )}
      {/* Recursively render children */}
      {hasChildren && tab.children!.map((child) => (
        <TabNode
          key={child.id}
          tab={child}
          level={level + 1}
          basePath={basePath}
          rootPath={rootPath}
          scope={scope}
          editingTabId={editingTabId}
          onStartEdit={onStartEdit}
          onSaveEdit={onSaveEdit}
          onCancelEdit={onCancelEdit}
        />
      ))}
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
    // SSoT: warehouse_folders is THE ONE source for warehouse type roots
    // warehouse_folders REMOVED (Jan 2026 SSoT fix)
    warehouse_folders: {} as ScopeFolders,
    // SSoT: Templates for folder paths and filenames per warehouse type
    warehouse_folder_templates: {} as Record<string, string>,
    file_name_templates: {} as Record<string, string>,
    display_name_templates: {} as Record<string, string>,
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
  const loadEntityTabs = async () => {
    setLoadingTabs(true);
    try {
      const tabsByScope: Record<string, EntityTab[]> = {};

      // Fetch tabs for each scope in parallel with per-scope error handling
      const scopeKeys = Object.keys(SCOPE_TO_API_SCOPE);
      const results = await Promise.all(
        scopeKeys.map(async (scopeKey) => {
          try {
            const apiScope = SCOPE_TO_API_SCOPE[scopeKey];
            const response = await api.get<{ success: boolean; data: { tabs: EntityTab[] } }>(
              `/api/v1/entity_tabs?scope=${apiScope}`
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

      setEntityTabs(tabsByScope);
    } catch (error) {
      console.error("Failed to load entity tabs:", error);
    } finally {
      setLoadingTabs(false);
    }
  };

  // Build folder tree from warehouse_folders, attaching tabs to scope nodes
  // SSoT: Use config from API (not formData which may have stale initial state)
  const folderTree = React.useMemo(() => {
    const scopeFolders = config?.warehouse_folders || {};
    const tree = buildFolderTree(scopeFolders);

    // Helper: Check if tab has doc types directly
    const tabHasDocTypes = (tab: EntityTab): boolean => {
      return !!(tab.document_types && tab.document_types.length > 0);
    };

    // Helper: Check if tab or any descendants have doc types AND warehouse enabled
    const hasDescendantWithDocTypes = (tab: EntityTab): boolean => {
      // This tab has warehouse + doc types
      if (tab.has_storage_folder && tabHasDocTypes(tab)) return true;
      // Or any child has it
      if (tab.children && tab.children.length > 0) {
        return tab.children.some(child => hasDescendantWithDocTypes(child));
      }
      return false;
    };

    // Helper: Filter tabs recursively
    // Keep a tab if: (has warehouse + doc types) OR (has children that qualify)
    const filterTabsWithDocTypes = (tabs: EntityTab[]): EntityTab[] => {
      return tabs
        .filter(tab => hasDescendantWithDocTypes(tab))
        .map(tab => ({
          ...tab,
          // Recursively filter children - only keep those with warehouse + doc types (or qualifying descendants)
          children: tab.children ? filterTabsWithDocTypes(tab.children) : []
        }));
    };

    // Scopes that don't use document types - show all warehouse-enabled tabs
    // SSoT: 'user' added for Teeem Docs (Jan 2026)
    // SSoT: 'case' added for Case document management (Jan 2026)
    const SCOPES_WITHOUT_DOC_TYPES = ['email', 'task', 'warehouse', 'user', 'case'];

    // Helper: Filter tabs for scopes without doc types (just warehouse enabled)
    const filterWarehouseEnabledTabs = (tabs: EntityTab[]): EntityTab[] => {
      return tabs
        .filter(tab => tab.has_storage_folder === true)
        .map(tab => ({
          ...tab,
          children: tab.children ? filterWarehouseEnabledTabs(tab.children) : []
        }));
    };

    // Attach tabs to scope nodes
    // SSoT: For doc-type scopes, show tabs with document types
    // For other scopes (email, task, warehouse), show all warehouse-enabled tabs
    const attachTabs = (nodes: FolderTreeNode[]) => {
      nodes.forEach(node => {
        if (node.scopeKey && entityTabs[node.scopeKey]) {
          const allTabs = entityTabs[node.scopeKey];
          // Use different filter based on scope type
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

    attachTabs(tree);
    return tree;
  }, [config?.warehouse_folders, entityTabs]);

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
    console.log('[saveTabFolderPath] Saving:', { tabId, folderPath, displayName, sendNameTemplate });
    try {
      const response = await api.patch<{ success: boolean; error?: string }>(
        `/api/v1/entity_tabs/${tabId}`,
        {
          entity_tab: {
            display_name: displayName,
            warehouse_folder: folderPath,
            send_name_template: sendNameTemplate,
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
                    display_name: displayName,
                    warehouse_folder: folderPath,
                    storage_folder_path: folderPath,  // Legacy alias
                    send_name_template: sendNameTemplate
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
    filenameTemplate: string,
    displayNameTemplate: string,
    configLink: string | null
  ) => {
    try {
      // Combine baseFolder + folderTemplate into full path with normalized slashes
      const fullPath = [baseFolder, folderTemplate]
        .filter(Boolean)
        .join('/')
        .replace(/\/+/g, '/')  // Normalize double slashes
        .replace(/\/+$/, '');  // Strip trailing slash for consistency

      const response = await api.patch<{ success: boolean; data: StorageConfig }>(
        "/api/v1/storage_configuration",
        {
          storage: {
            warehouse_folders: { [scopeKey]: fullPath },
            warehouse_folder_templates: { [scopeKey]: folderTemplate },
            file_name_templates: { [scopeKey]: filenameTemplate },
            display_name_templates: { [scopeKey]: displayNameTemplate },
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
            warehouse_folders: { ...prev.warehouse_folders, [scopeKey]: fullPath },
            warehouse_folder_templates: { ...prev.warehouse_folder_templates, [scopeKey]: folderTemplate },
            file_name_templates: { ...prev.file_name_templates, [scopeKey]: filenameTemplate },
            display_name_templates: { ...prev.display_name_templates, [scopeKey]: displayNameTemplate },
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

  // Phase 4: Toggle virtual warehouse via API
  const toggleVirtualScope = React.useCallback(async (scopeKey: string, isVirtual: boolean) => {
    try {
      const response = await api.patch<{ success: boolean; data: StorageConfig }>(
        "/api/v1/storage_configuration",
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
          // SSoT: warehouse_folders is THE ONE source for warehouse type roots
          // warehouse_folders REMOVED (Jan 2026 SSoT fix)
          warehouse_folders: response.data.warehouse_folders || {},
          // SSoT: Templates from StorageConfiguration
          warehouse_folder_templates: response.data.warehouse_folder_templates || {},
          file_name_templates: response.data.file_name_templates || {},
          display_name_templates: response.data.display_name_templates || {},
          // SSoT: Config links from StorageConfiguration
          config_links: response.data.config_links || {},
          // Phase 4: Virtual warehouses from StorageConfiguration
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
        "/api/v1/storage_configuration",
        {
          storage: {
            provider_type: formData.provider_type,
            root_path: formData.root_path,
            // SSoT: warehouse_folders is THE ONE place for warehouse type roots
            warehouse_folders: config?.warehouse_folders,
            warehouse_folder_templates: formData.warehouse_folder_templates,
            file_name_templates: formData.file_name_templates,
            display_name_templates: formData.display_name_templates,
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
                    fileNameTemplates={formData.file_name_templates}
                    displayNameTemplates={formData.display_name_templates}
                    configLinks={formData.config_links}
                    onSaveTemplates={saveScopeTemplates}
                    virtualScopes={formData.virtual_warehouses}
                    onToggleVirtual={toggleVirtualScope}
                    scopeRootFolders={formData.warehouse_folders || {}}
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
    </div>
  );
}
