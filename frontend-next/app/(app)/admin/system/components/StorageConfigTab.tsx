"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
  Pencil,
  FileText,
  Link2,
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
type ProviderType = "sharepoint" | "s3" | "wasabi" | "local";

const PROVIDER_OPTIONS: { value: ProviderType; label: string; icon: React.ElementType; description: string }[] = [
  { value: "sharepoint", label: "SharePoint", icon: Cloud, description: "Microsoft SharePoint / OneDrive for Business" },
  { value: "wasabi", label: "Wasabi", icon: Database, description: "Wasabi Hot Cloud Storage (S3-compatible)" },
  { value: "s3", label: "Amazon S3", icon: Cloud, description: "Amazon Simple Storage Service" },
  { value: "local", label: "Local Storage", icon: HardDrive, description: "Local file system (development only)" },
];

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
  provider_type: ProviderType;
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
  scope_folders: ScopeFolders;
  // SSoT: Templates for folder paths and filenames per scope
  scope_templates: Record<string, string>;
  file_name_templates: Record<string, string>;
  // SSoT: Config links for scope folders (URL to external config page)
  config_links: Record<string, string>;
}

// Tree node structure for folder hierarchy
interface FolderTreeNode {
  name: string;  // Display name (e.g., "Users", "Contracts")
  path: string;  // Full path (e.g., "Users/Contracts")
  scopeKey: string | null;  // Scope key if this is a scope folder (e.g., "user_contracts")
  children: FolderTreeNode[];
  tabs?: EntityTab[];  // Tabs under this scope folder
}

// Build tree structure from flat scope folders
function buildFolderTree(scopeFolders: ScopeFolders): FolderTreeNode[] {
  const root: FolderTreeNode[] = [];

  // Sort entries by path for consistent tree building
  const entries = Object.entries(scopeFolders).sort(([, a], [, b]) => a.localeCompare(b));

  entries.forEach(([key, path]) => {
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
          children: [],
        };
        current.push(node);
      } else if (isLeaf && !node.scopeKey) {
        // If this path is a scope folder but was created as intermediate, update it
        node.scopeKey = key;
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
  onSaveTemplates: (scopeKey: string, folderTemplate: string, filenameTemplate: string, configLink: string | null) => Promise<void>;
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
}: TreeNodeProps) {
  const hasChildren = node.children.length > 0;
  const hasTabs = node.tabs && node.tabs.length > 0;
  const isEditing = editingKey === node.scopeKey;
  const [editValue, setEditValue] = React.useState(node.path);
  // SSoT: Initialize templates from props (loaded from backend), fallback to defaults
  const [folderTemplate, setFolderTemplate] = React.useState(
    node.scopeKey
      ? scopeTemplates[node.scopeKey] || DEFAULT_FOLDER_TEMPLATES[node.scopeKey] || '{{TabName}}'
      : '{{TabName}}'
  );
  const [filenameTemplate, setFilenameTemplate] = React.useState(
    node.scopeKey ? fileNameTemplates[node.scopeKey] || '{{OriginalFileName}}' : '{{OriginalFileName}}'
  );
  // Config link: checkbox + URL for linking to external config page
  // SSoT: Initialize from configLinks prop (loaded from backend)
  const initialConfigLink = node.scopeKey ? configLinks[node.scopeKey] || '' : '';
  const [hasConfigLink, setHasConfigLink] = React.useState(!!initialConfigLink);

  // SSoT: Simple scopes without config link can expand to show folder template preview
  const hasTemplatePreview = node.scopeKey && folderTemplate && !hasConfigLink;
  const hasExpandableContent = hasChildren || hasTabs || hasTemplatePreview;
  const isExpanded = expandedPaths.has(node.path);
  const [configLinkUrl, setConfigLinkUrl] = React.useState(initialConfigLink);
  const [isSaving, setIsSaving] = React.useState(false);
  const [lastSaved, setLastSaved] = React.useState<Date | null>(null);
  const saveTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  // Track if templates have been modified (to avoid saving on initial load)
  const hasModified = React.useRef(false);

  // Auto-save function with debounce - calls actual API
  const autoSave = React.useCallback(async (folder: string, filename: string, configLink: string | null) => {
    if (!node.scopeKey || !hasModified.current) return;

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    saveTimeoutRef.current = setTimeout(async () => {
      setIsSaving(true);
      try {
        await onSaveTemplates(node.scopeKey!, folder, filename, configLink);
        setLastSaved(new Date());
      } catch (error) {
        console.error('Failed to save templates:', error);
      } finally {
        setIsSaving(false);
      }
    }, 1000); // 1 second debounce
  }, [node.scopeKey, onSaveTemplates]);

  // Trigger auto-save when templates or config link change
  React.useEffect(() => {
    if (isEditing && hasModified.current) {
      // Pass null for configLink if checkbox is unchecked (to remove it)
      const linkToSave = hasConfigLink ? configLinkUrl : null;
      autoSave(folderTemplate, filenameTemplate, linkToSave);
    }
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [folderTemplate, filenameTemplate, hasConfigLink, configLinkUrl, isEditing, autoSave]);

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

  // Reset edit value when editing starts
  React.useEffect(() => {
    if (isEditing) {
      setEditValue(currentPath[node.scopeKey!] || node.path);
    }
  }, [isEditing, node.scopeKey, currentPath, node.path]);

  const fullPath = rootPath
    ? `${rootPath}/${node.path}`.replace(/\/+/g, '/')
    : `/${node.path}`;

  return (
    <div>
      {/* Node row */}
      <div
        className={cn(
          "flex items-center gap-1 py-1 px-1 rounded-sm hover:bg-muted/50 group",
          isEditing && "bg-muted"
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

        {/* Edit button for any scope folder */}
        {node.scopeKey && !isEditing && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onStartEdit(node.scopeKey!)}
            className="h-5 px-1.5 ml-2 text-[10px] text-muted-foreground"
          >
            <Pencil className="h-3 w-3 mr-1" />
            Edit
          </Button>
        )}

        {/* Scope badge */}
        {node.scopeKey && (
          <Badge
            variant="outline"
            className="h-5 text-[10px] px-1.5 ml-2 bg-background"
          >
            {getScopeLabel(node.scopeKey)}
          </Badge>
        )}

        {/* Config link - shown when checkbox is enabled and URL is set */}
        {hasConfigLink && configLinkUrl && !isEditing && (() => {
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
              className="ml-2 text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 hover:underline flex items-center gap-1"
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
        {!isEditing && (
          <span className="ml-auto text-[10px] text-muted-foreground font-mono opacity-0 group-hover:opacity-100 transition-opacity">
            {fullPath}
          </span>
        )}
      </div>

      {/* Editing panel for any scope folder */}
      {node.scopeKey && isEditing && (
        <div
          className="border rounded-lg bg-card py-3 px-4 my-1 shadow-sm"
          style={{ marginLeft: `${level * 16 + 28}px` }}
        >
          <div className="space-y-4">
            {/* Base Path (read-only) */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Base Path</label>
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm bg-muted px-2 py-1 rounded">
                  {[rootPath, node.path].filter(Boolean).join('/').replace(/\/+/g, '/')}
                </span>
                <span className="text-muted-foreground">/</span>
              </div>
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

            {/* Full Path Preview */}
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded px-3 py-2">
              <span className="text-xs text-muted-foreground">Full Path: </span>
              <span className="font-mono text-sm text-green-700 dark:text-green-400">
                {[rootPath, node.path, folderTemplate].filter(Boolean).join('/').replace(/\/+/g, '/')}
              </span>
            </div>

            {/* File Name Template */}
            <TokenBuilder
              label={<span className="text-xs font-medium">File Name</span>}
              value={filenameTemplate}
              onChange={handleFilenameTemplateChange}
              scope="storage"
              showPreview={true}
              placeholder="Click tokens to build filename..."
              defaultExpanded={false}
            />

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
                    <CheckCircle2 className="h-3 w-3 text-green-500" />
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
          {node.scopeKey && folderTemplate && !isEditing && !hasConfigLink && (
            <div className="ml-1">
              {/* Render folder template as nested preview folders */}
              {(() => {
                const parts = folderTemplate.split('/').filter(Boolean);
                let currentLevel = level + 1;
                return parts.map((part, idx) => (
                  <div
                    key={`template-${idx}`}
                    className="flex items-center gap-1 py-0.5 px-1"
                    style={{ paddingLeft: `${currentLevel++ * 16 + 4}px` }}
                  >
                    <span className="w-5" />
                    <Folder className="h-3.5 w-3.5 text-amber-500/50 flex-shrink-0" />
                    <span className="font-mono text-xs text-muted-foreground italic">
                      {part}
                    </span>
                    {idx === parts.length - 1 && filenameTemplate && (
                      <span className="ml-2 text-[10px] text-muted-foreground/60">
                        → {filenameTemplate}
                      </span>
                    )}
                  </div>
                ));
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
          <FileText className="h-3.5 w-3.5 text-blue-500 flex-shrink-0" />
          <span className="text-sm font-medium">{tab.display_name}</span>
          {!isEditing && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onStartEdit(tab.id)}
              className="h-5 px-1.5 ml-2 text-[10px] text-muted-foreground"
            >
              <Pencil className="h-3 w-3 mr-1" />
              Edit
            </Button>
          )}
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
          <div className="ml-4 space-y-1 text-[11px] text-muted-foreground">
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
      <FileText className="h-3.5 w-3.5 text-blue-500 flex-shrink-0" />
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
    sharepoint_root_path: "",
    // SSoT: Scope folders loaded from StorageConfiguration.SCOPE_FOLDERS via API
    scope_folders: {} as ScopeFolders,
    // SSoT: Templates for folder paths and filenames per scope
    scope_templates: {} as Record<string, string>,
    file_name_templates: {} as Record<string, string>,
    // SSoT: Config links for scope folders
    config_links: {} as Record<string, string>,
  });
  // Tree view state
  const [expandedPaths, setExpandedPaths] = React.useState<Set<string>>(new Set());
  const [editingKey, setEditingKey] = React.useState<string | null>(null);
  const [editingTabId, setEditingTabId] = React.useState<number | null>(null);

  // Entity tabs for each scope
  const [entityTabs, setEntityTabs] = React.useState<Record<string, EntityTab[]>>({});
  const [loadingTabs, setLoadingTabs] = React.useState(false);

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
  const folderTree = React.useMemo(() => {
    const tree = buildFolderTree(formData.scope_folders);

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
  }, [formData.scope_folders, entityTabs]);

  // Toggle tree node expansion
  const toggleExpanded = (path: string) => {
    setExpandedPaths(prev => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
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
    folderTemplate: string,
    filenameTemplate: string,
    configLink: string | null
  ) => {
    try {
      const response = await api.patch<{ success: boolean; data: StorageConfig }>(
        "/api/v1/storage_configuration",
        {
          storage: {
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

  // Expand all nodes initially (folders with children or tabs)
  React.useEffect(() => {
    if (Object.keys(formData.scope_folders).length > 0 && expandedPaths.size === 0) {
      // Collect all paths that have children or tabs
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
      setExpandedPaths(allPaths);
    }
  }, [formData.scope_folders, folderTree, expandedPaths.size]);

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
          // Provider type
          provider_type: response.data.provider_type || "sharepoint",
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
          sharepoint_root_path: response.data.root_path || "",
          // SSoT: Scope folders from StorageConfiguration.SCOPE_FOLDERS
          scope_folders: response.data.scope_folders || {},
          // SSoT: Templates from StorageConfiguration
          scope_templates: response.data.scope_templates || {},
          file_name_templates: response.data.file_name_templates || {},
          // SSoT: Config links from StorageConfiguration
          config_links: response.data.config_links || {},
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
            ...formData,
            // Map S3/Wasabi fields to backend expected names
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
      const err = error as { message?: string };
      toast({
        title: "Error",
        description: err?.message || "Failed to save storage configuration",
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
            config?.configured && "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
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
                onValueChange={(value: ProviderType) => handleChange("provider_type", value)}
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
                  placeholder="https://gotekna.sharepoint.com/sites/TEEEM"
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
                  placeholder="gotekna.sharepoint.com,abc123..."
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

      {/* S3/Wasabi Connection - shown when provider is s3 or wasabi */}
      {(formData.provider_type === "s3" || formData.provider_type === "wasabi") && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Database className="h-4 w-4" />
              {formData.provider_type === "wasabi" ? "Wasabi" : "Amazon S3"} Connection
            </CardTitle>
            <CardDescription>
              Configure the {formData.provider_type === "wasabi" ? "Wasabi" : "S3"} bucket where all documents will be stored
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
                  placeholder={formData.provider_type === "wasabi" ? "https://s3.wasabisys.com" : "https://s3.amazonaws.com"}
                />
                <p className="text-xs text-muted-foreground">
                  {formData.provider_type === "wasabi" ? "Wasabi endpoint (e.g., s3.wasabisys.com or s3.ap-southeast-2.wasabisys.com)" : "S3 endpoint URL"}
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
                  The name of your {formData.provider_type === "wasabi" ? "Wasabi" : "S3"} bucket
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="s3_region">Region</Label>
                <Input
                  id="s3_region"
                  value={formData.s3_region}
                  onChange={(e) => handleChange("s3_region", e.target.value)}
                  placeholder={formData.provider_type === "wasabi" ? "ap-southeast-2" : "us-east-1"}
                />
                <p className="text-xs text-muted-foreground">
                  {formData.provider_type === "wasabi" ? "Wasabi region (e.g., ap-southeast-2 for Sydney)" : "AWS region (e.g., us-east-1)"}
                </p>
              </div>
            </div>

            <div className="p-3 bg-muted/50 rounded-lg border">
              <p className="text-sm flex items-center gap-2">
                <Info className="h-4 w-4 text-blue-500" />
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
              value={formData.sharepoint_root_path}
              onChange={(e) => handleChange("sharepoint_root_path", e.target.value)}
              placeholder="/ (drive root)"
              className="font-mono"
            />
            <p className="text-xs text-muted-foreground">
              Leave empty for drive root. For SharePoint, typically &quot;/Shared Documents&quot;.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Scope Folders - Tree View */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FolderTree className="h-4 w-4" />
            Scope Folders
          </CardTitle>
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
                {formData.sharepoint_root_path || "/"}
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
                    rootPath={formData.sharepoint_root_path}
                    editingTabId={editingTabId}
                    onStartTabEdit={setEditingTabId}
                    onSaveTabEdit={saveTabFolderPath}
                    onCancelTabEdit={() => setEditingTabId(null)}
                    scopeTemplates={formData.scope_templates}
                    fileNameTemplates={formData.file_name_templates}
                    configLinks={formData.config_links}
                    onSaveTemplates={saveScopeTemplates}
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
              <FileText className="h-3 w-3 text-blue-500" />
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
    </div>
  );
}
