"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Plus, Loader2, Building2, Briefcase, Users, FolderOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";
import { Checkbox } from "@/components/ui/checkbox";
import TeeemTableView from "@/components/table/TeeemTableView";
import type { TableColumn, TableRow } from "@/components/table/types";
import { convertColumnsToTEEEMFormat, type ApiColumn } from "@/lib/corporate/column-utils";
import { SharePointFolderBrowser } from "@/components/ui/sharepoint-folder-browser";

// Foundation ID for document_types table
const DOCUMENT_TYPES_FOUNDATION_ID = 454;

// Fallback folder options (used if API fails)
const FOLDER_OPTIONS = [
  "ADVICE", "ASIC", "ASSETS", "ATO", "BANK", "COMPANY",
  "DIVIDENDS", "FINANCIALS", "GENERAL", "INSURANCE",
  "LOANS", "MINUTES", "REGISTRY", "TRUST"
];

interface FolderOption {
  id: number;
  name: string;
  label: string;
  description?: string;
  parent_id?: number | null;
  parent_name?: string;
  entity_types?: string[];
  children?: FolderOption[];
}

interface DocumentTypeFolder {
  id: number;
  name: string;
  is_primary: boolean;
  parent_id?: number | null;
  parent_name?: string;
}

interface DocumentType extends TableRow {
  abbreviation?: string;
  name?: string;
  display_name?: string;
  file_name?: string;
  title_preview?: string;
  primary_tab?: string;
  folder?: string;
  tabs?: string[];
  tabs_display?: string;
  // New folder lookup fields
  folder_ids?: number[];
  folders?: DocumentTypeFolder[];
  primary_folder_id?: number;
  primary_folder_name?: string;
  active?: boolean;
  documents_count?: number;
  scope?: string;
  file_extensions?: string[];
  file_extensions_display?: string;
  target_folder?: string;
}

// Separate component for tabs display with popover - MUST be outside DocumentTypesTab to avoid hook violations
function TabsDisplayCell({
  entry,
  availableFolders,
  onUpdate,
  onToast
}: {
  entry: DocumentType;
  availableFolders: FolderOption[];
  onUpdate: (id: string, field: string, value: any) => Promise<void>;
  onToast: (toast: { title: string; description: string; variant?: "destructive" }) => void;
}) {
  const folderIds = entry.folder_ids || [];
  const folders = entry.folders || [];
  const [open, setOpen] = React.useState(false);

  // Flatten folders for easier lookup
  const flatFolders = React.useMemo(() => {
    const result: FolderOption[] = [];
    availableFolders.forEach(f => {
      result.push(f);
      if (f.children) {
        f.children.forEach(c => result.push({ ...c, parent_name: f.name }));
      }
    });
    return result;
  }, [availableFolders]);

  const toggleFolder = async (folderId: number, folderName: string) => {
    const newFolderIds = folderIds.includes(folderId)
      ? folderIds.filter(id => id !== folderId)
      : [...folderIds, folderId];

    try {
      await onUpdate(String(entry.id!), "folder_ids", newFolderIds);
      onToast({
        title: "Folders updated",
        description: `${folderName} ${folderIds.includes(folderId) ? 'removed' : 'added'}`,
      });
    } catch (error) {
      onToast({
        title: "Error",
        description: "Failed to update folders",
        variant: "destructive",
      });
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-7 px-2 text-xs justify-start"
        >
          {folders.length === 0 ? (
            <span className="text-muted-foreground">Select folders...</span>
          ) : (
            <div className="flex flex-wrap gap-1">
              {folders.slice(0, 2).map(f => (
                <Badge
                  key={f.id}
                  variant={f.is_primary ? "default" : "secondary"}
                  className={cn("text-xs", f.is_primary && "ring-1 ring-blue-500")}
                >
                  {f.parent_name ? `${f.parent_name} > ${f.name}` : f.name}
                </Badge>
              ))}
              {folders.length > 2 && (
                <Badge variant="secondary" className="text-xs">
                  +{folders.length - 2}
                </Badge>
              )}
            </div>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96 p-3 max-h-80 overflow-y-auto" align="start">
        <div className="space-y-3">
          <p className="text-sm font-medium">Select Folders</p>
          {availableFolders.map(parentFolder => {
            const isSelected = folderIds.includes(parentFolder.id);
            const isPrimary = entry.primary_folder_id === parentFolder.id;
            const children = parentFolder.children || [];

            return (
              <div key={parentFolder.id} className="space-y-1">
                {/* Parent folder */}
                <div
                  className={cn(
                    "flex items-center gap-2 p-2 rounded border cursor-pointer transition-colors text-xs",
                    isSelected && "bg-blue-50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-700",
                    isPrimary && "ring-1 ring-blue-500",
                    !isSelected && "hover:bg-muted"
                  )}
                  onClick={() => toggleFolder(parentFolder.id, parentFolder.name)}
                >
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => toggleFolder(parentFolder.id, parentFolder.name)}
                  />
                  <span className="font-medium">
                    {parentFolder.name}
                    {isPrimary && <span className="ml-1 text-blue-600">★</span>}
                  </span>
                </div>

                {/* Child folders (sub-tabs) */}
                {children.length > 0 && (
                  <div className="ml-4 space-y-1">
                    {children.map(child => {
                      const childSelected = folderIds.includes(child.id);
                      const childPrimary = entry.primary_folder_id === child.id;
                      return (
                        <div
                          key={child.id}
                          className={cn(
                            "flex items-center gap-2 p-2 rounded border cursor-pointer transition-colors text-xs",
                            childSelected && "bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-700",
                            childPrimary && "ring-1 ring-green-500",
                            !childSelected && "hover:bg-muted"
                          )}
                          onClick={() => toggleFolder(child.id, `${parentFolder.name} > ${child.name}`)}
                        >
                          <Checkbox
                            checked={childSelected}
                            onCheckedChange={() => toggleFolder(child.id, `${parentFolder.name} > ${child.name}`)}
                          />
                          <span className="font-medium text-muted-foreground">
                            └ {child.name}
                            {childPrimary && <span className="ml-1 text-green-600">★</span>}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function DocumentTypesTab() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const scopeFilter = (searchParams.get("scope") as "company" | "job" | "people" | "all") || "all";

  const { toast } = useToast();
  const [loading, setLoading] = React.useState(true);
  const [documentTypes, setDocumentTypes] = React.useState<DocumentType[]>([]);
  const [columns, setColumns] = React.useState<TableColumn[]>([]);
  const [showAddForm, setShowAddForm] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [showFolderConfig, setShowFolderConfig] = React.useState(false);
  // SSoT: These templates define the folder structure for all document types
  const [baseFolders, setBaseFolders] = React.useState({
    company: "/Teeem/Companies/{{CompanyGroup}}/{{CompanyCode}}/{{Folder}}",
    job: "/Teeem/Jobs/{{JobCode}}/{{Category}}",
    people: "/Teeem/People/{{ContactName}}"
  });
  const [newDocType, setNewDocType] = React.useState({
    name: "",
    abbreviation: "",
    file_name: "{CompanyCode} {Description} {Date}",
    folder: "GENERAL",
    primary_tab: "GENERAL",
    active: true
  });
  const [availableFolders, setAvailableFolders] = React.useState<FolderOption[]>([]);

  // Filter document types by scope
  const filteredDocTypes = React.useMemo(() => {
    if (scopeFilter === "all") return documentTypes;
    return documentTypes.filter(dt => dt.scope === scopeFilter || dt.scope === "both");
  }, [documentTypes, scopeFilter]);

  // Handle scope tab change
  const handleScopeChange = React.useCallback((value: string) => {
    const currentParams = new URLSearchParams(searchParams.toString());
    currentParams.set("scope", value);
    router.push(`?${currentParams.toString()}`);
  }, [router, searchParams]);

  React.useEffect(() => {
    fetchColumns();
    loadData();
    loadSharePointPathTemplates();
    loadAvailableFolders();
  }, []);

  const loadAvailableFolders = async () => {
    try {
      const response = await api.get<{ success: boolean; data: FolderOption[] }>(
        "/api/v1/document_folders?hierarchy=true&active=true"
      );
      if (response.success && response.data) {
        setAvailableFolders(response.data);
      }
    } catch (error) {
      console.error("Failed to load available folders:", error);
    }
  };

  const fetchColumns = async () => {
    try {
      const response = await api.get<{ foundation: { columns: ApiColumn[] } }>(
        `/api/v1/foundations/${DOCUMENT_TYPES_FOUNDATION_ID}`
      );
      const dbColumns = response?.foundation?.columns || [];
      const teeemColumns = convertColumnsToTEEEMFormat(dbColumns, DOCUMENT_TYPES_FOUNDATION_ID);

      // Add computed display columns that don't exist in the database
      // tabs_display is computed from the tabs array field for display purposes
      const enhancedColumns = [
        ...teeemColumns,
        {
          key: "tabs_display",
          label: "All Tabs",
          column_type: "single_line_text",
          resizable: true,
          sortable: false,
          filterable: false,
          width: 200,
          editable: false,
          tooltip: "All folder tabs this document type appears in (computed field)"
        } as TableColumn
      ];

      setColumns(enhancedColumns);
    } catch (err) {
      console.error("Failed to fetch columns:", err);
    }
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const response = await api.get<{ data: DocumentType[] }>("/api/v1/document_types", {
        params: { include_inactive: "true" }
      });
      const types = response.data || [];
      // Transform for table display
      const transformed = types.map(dt => ({
        ...dt,
        // Use folders from join table if available, fallback to legacy tabs
        tabs_display: dt.folders?.length
          ? dt.folders.map(f => f.parent_name ? `${f.parent_name} > ${f.name}` : f.name).join(", ")
          : dt.tabs?.join(", ") || "",
        file_extensions_display: dt.file_extensions?.join(", ") || ""
      }));
      setDocumentTypes(transformed);
    } catch (error) {
      console.error("Failed to load document types:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadSharePointPathTemplates = async () => {
    try {
      console.log("Loading SharePoint path templates from backend...");
      const response = await api.get<{ templates: { company: string; job: string; people: string } }>(
        "/api/v1/system_settings/sharepoint_path_templates"
      );
      console.log("Received templates from backend:", response.templates);
      if (response.templates) {
        setBaseFolders(response.templates);
      } else {
        console.warn("No templates received from backend, using defaults");
      }
    } catch (error) {
      console.error("Failed to load SharePoint path templates:", error);
      console.error("Error details:", error);
    }
  };

  const saveSharePointPathTemplates = async () => {
    try {
      setSaving(true);
      await api.put("/api/v1/system_settings/update_sharepoint_path_templates", {
        templates: baseFolders
      });
      toast({
        title: "Success!",
        description: "SharePoint folder paths saved successfully.",
      });
      setShowFolderConfig(false);
    } catch (error) {
      console.error("Failed to save SharePoint path templates:", error);
      toast({
        title: "Error",
        description: "Failed to save path templates. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = async (entry: DocumentType) => {
    try {
      await api.patch(`/api/v1/document_types/${entry.id}`, {
        document_type: entry
      });
      await loadData();
    } catch (error) {
      console.error("Failed to update document type:", error);
    }
  };

  // Standard inline cell editing - required for TeeemTableView inline edit
  const handleRowUpdate = async (rowId: number | string, columnKey: string, value: unknown) => {
    try {
      await api.patch(`/api/v1/document_types/${rowId}`, {
        document_type: { [columnKey]: value }
      });
      // Update local state immediately for responsiveness
      setDocumentTypes(prev => prev.map(dt =>
        dt.id === rowId ? { ...dt, [columnKey]: value } : dt
      ));
    } catch (error) {
      console.error("Failed to update document type:", error);
      throw error; // Re-throw so TeeemTableView can show error
    }
  };

  const handleDelete = async (entry: DocumentType) => {
    if (!confirm(`Delete document type "${entry.name}"? This cannot be undone.`)) {
      return;
    }
    try {
      await api.delete(`/api/v1/document_types/${entry.id}`);
      await loadData();
    } catch (error) {
      console.error("Failed to delete document type:", error);
    }
  };

  const handleBulkDelete = async (ids: (number | string)[]) => {
    if (!confirm(`Delete ${ids.length} document types? This cannot be undone.`)) {
      return;
    }
    try {
      await Promise.all(ids.map(id => api.delete(`/api/v1/document_types/${id}`)));
      await loadData();
    } catch (error) {
      console.error("Failed to bulk delete document types:", error);
    }
  };

  const handleAddDocType = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      await api.post("/api/v1/document_types", {
        document_type: {
          ...newDocType,
          tabs: [newDocType.primary_tab]
        }
      });
      setShowAddForm(false);
      setNewDocType({
        name: "",
        abbreviation: "",
        file_name: "{CompanyCode} {Description} {Date}",
        folder: "GENERAL",
        primary_tab: "GENERAL",
        active: true
      });
      await loadData();
    } catch (error) {
      console.error("Failed to create document type:", error);
    } finally {
      setSaving(false);
    }
  };

  // Handle row click - navigate to detail page
  const handleRowClick = React.useCallback((row: DocumentType) => {
    router.push(`/admin/system/document-types/${row.id}`);
  }, [router]);

  // Handle row double-click
  const handleRowDoubleClick = React.useCallback((row: DocumentType) => {
    router.push(`/admin/system/document-types/${row.id}`);
  }, [router]);

  // Custom cell renderer for tabs display and badges
  const customCellRenderer = (entry: DocumentType, columnKey: string) => {
    if (columnKey === "scope") {
      const value = entry.scope || "company";
      return (
        <Select
          value={value}
          onValueChange={async (newScope) => {
            try {
              await handleRowUpdate(entry.id!, "scope", newScope);
              toast({
                title: "Scope updated",
                description: `Moved to ${newScope} tab`,
              });
            } catch (error) {
              toast({
                title: "Error",
                description: "Failed to update scope",
                variant: "destructive",
              });
            }
          }}
        >
          <SelectTrigger className="h-7 w-28 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="company">Company</SelectItem>
            <SelectItem value="job">Job</SelectItem>
            <SelectItem value="people">People</SelectItem>
            <SelectItem value="both">Both</SelectItem>
          </SelectContent>
        </Select>
      );
    }
    if (columnKey === "file_extensions_display") {
      const extensions = entry.file_extensions || [];
      if (extensions.length === 0) return <span className="text-muted-foreground">-</span>;
      return (
        <div className="flex flex-wrap gap-1">
          {extensions.map(ext => (
            <Badge key={ext} variant="secondary" className="text-xs font-mono">
              {ext}
            </Badge>
          ))}
        </div>
      );
    }
    if (columnKey === "target_folder") {
      const value = entry.target_folder;
      if (!value) return <span className="text-muted-foreground">-</span>;
      return (
        <span className="font-mono text-xs text-muted-foreground">{value}</span>
      );
    }
    if (columnKey === "tabs_display") {
      return <TabsDisplayCell entry={entry} availableFolders={availableFolders} onUpdate={handleRowUpdate} onToast={toast} />;
    }
    if (columnKey === "primary_tab" || columnKey === "folder") {
      const value = entry[columnKey as keyof DocumentType] as string | undefined;
      if (!value) return <span className="text-muted-foreground">-</span>;
      return (
        <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
          {value}
        </Badge>
      );
    }
    if (columnKey === "abbreviation") {
      const value = entry.abbreviation;
      if (!value) return <span className="text-muted-foreground">-</span>;
      return (
        <span className="font-mono font-bold text-primary">{value}</span>
      );
    }
    if (columnKey === "file_name") {
      const value = entry.file_name;
      if (!value) return <span className="text-muted-foreground italic">Not set</span>;
      return (
        <span className="font-mono text-xs text-muted-foreground">{value}</span>
      );
    }
    if (columnKey === "title_preview") {
      const value = entry.title_preview;
      if (!value) return <span className="text-muted-foreground italic">Not set</span>;
      return (
        <span className="font-semibold text-green-700 dark:text-green-400">{value}</span>
      );
    }
    return null;
  };

  if (loading && documentTypes.length === 0) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-lg font-semibold">Document Types & Naming Conventions</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Single source of truth for document types across Companies and Jobs. Click any cell to edit.
        </p>
      </div>

      {/* Scope Filter Tabs */}
      <Tabs value={scopeFilter} onValueChange={handleScopeChange}>
        <TabsList className="grid w-full grid-cols-4 max-w-3xl">
          <TabsTrigger value="all" className="gap-2">
            All ({documentTypes.length})
          </TabsTrigger>
          <TabsTrigger value="company" className="gap-2">
            <Building2 className="h-4 w-4" />
            Company ({documentTypes.filter(dt => dt.scope === "company" || dt.scope === "both").length})
          </TabsTrigger>
          <TabsTrigger value="job" className="gap-2">
            <Briefcase className="h-4 w-4" />
            Job ({documentTypes.filter(dt => dt.scope === "job" || dt.scope === "both").length})
          </TabsTrigger>
          <TabsTrigger value="people" className="gap-2">
            <Users className="h-4 w-4" />
            People ({documentTypes.filter(dt => dt.scope === "people").length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value={scopeFilter} className="mt-6 space-y-6">

      {/* SharePoint Folder Structure Configuration */}
      <Card className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/20 dark:to-purple-950/20 border-blue-200 dark:border-blue-900">
        <CardContent className="p-6">
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <h3 className="text-base font-semibold text-blue-900 dark:text-blue-200 mb-2">
                📁 SharePoint Folder Structure
              </h3>
              <p className="text-sm text-blue-700 dark:text-blue-300">
                Configure folder path templates for automated document organization in SharePoint/OneDrive. Use placeholders like {'{{CompanyCode}}'} to create dynamic paths.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="ml-4"
              onClick={() => setShowFolderConfig(!showFolderConfig)}
            >
              <FolderOpen className="h-4 w-4 mr-2" />
              {showFolderConfig ? "Hide" : "Configure"} Paths
            </Button>
          </div>

          {!showFolderConfig ? (
            <div className="space-y-3">
              {scopeFilter === "all" ? (
                <>
                  <div className="flex items-center gap-2 text-sm">
                    <Badge variant="outline" className="bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
                      <Building2 className="h-3 w-3 mr-1" />
                      Company
                    </Badge>
                    <code className="bg-white dark:bg-gray-900 px-2 py-1 rounded text-xs font-mono flex-1">
                      {baseFolders.company}
                    </code>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => {
                        setShowFolderConfig(true);
                        handleScopeChange("company");
                      }}
                    >
                      <FolderOpen className="h-3 w-3 mr-1" />
                      Browse
                    </Button>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Badge variant="outline" className="bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300">
                      <Briefcase className="h-3 w-3 mr-1" />
                      Job
                    </Badge>
                    <code className="bg-white dark:bg-gray-900 px-2 py-1 rounded text-xs font-mono flex-1">
                      {baseFolders.job}
                    </code>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => {
                        setShowFolderConfig(true);
                        handleScopeChange("job");
                      }}
                    >
                      <FolderOpen className="h-3 w-3 mr-1" />
                      Browse
                    </Button>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Badge variant="outline" className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300">
                      <Users className="h-3 w-3 mr-1" />
                      People
                    </Badge>
                    <code className="bg-white dark:bg-gray-900 px-2 py-1 rounded text-xs font-mono flex-1">
                      {baseFolders.people}
                    </code>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => {
                        setShowFolderConfig(true);
                        handleScopeChange("people");
                      }}
                    >
                      <FolderOpen className="h-3 w-3 mr-1" />
                      Browse
                    </Button>
                  </div>
                </>
              ) : scopeFilter === "company" ? (
                <div className="flex items-center gap-2 text-sm">
                  <Badge variant="outline" className="bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
                    <Building2 className="h-3 w-3 mr-1" />
                    Company
                  </Badge>
                  <code className="bg-white dark:bg-gray-900 px-2 py-1 rounded text-xs font-mono flex-1">
                    {baseFolders.company}
                  </code>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => setShowFolderConfig(true)}
                  >
                    <FolderOpen className="h-3 w-3 mr-1" />
                    Browse
                  </Button>
                </div>
              ) : scopeFilter === "job" ? (
                <div className="flex items-center gap-2 text-sm">
                  <Badge variant="outline" className="bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300">
                    <Briefcase className="h-3 w-3 mr-1" />
                    Job
                  </Badge>
                  <code className="bg-white dark:bg-gray-900 px-2 py-1 rounded text-xs font-mono flex-1">
                    {baseFolders.job}
                  </code>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => setShowFolderConfig(true)}
                  >
                    <FolderOpen className="h-3 w-3 mr-1" />
                    Browse
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-sm">
                  <Badge variant="outline" className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300">
                    <Users className="h-3 w-3 mr-1" />
                    People
                  </Badge>
                  <code className="bg-white dark:bg-gray-900 px-2 py-1 rounded text-xs font-mono flex-1">
                    {baseFolders.people}
                  </code>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => setShowFolderConfig(true)}
                  >
                    <FolderOpen className="h-3 w-3 mr-1" />
                    Browse
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {/* Folder Picker based on active scope */}
              {scopeFilter === "all" ? (
                <p className="text-sm text-muted-foreground">
                  Select a specific scope tab (Company, Job, or People) to configure its folder path.
                </p>
              ) : scopeFilter === "company" ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="outline" className="bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
                      <Building2 className="h-3 w-3 mr-1" />
                      Company Base Folder
                    </Badge>
                  </div>
                  <SharePointFolderBrowser
                    onSelect={(folder, path) => {
                      // Only update the base path portion, preserve the placeholders
                      const template = path ? `${path}/{{CompanyGroup}}/{{CompanyCode}}/{{Folder}}` : "/Teeem/Companies/{{CompanyGroup}}/{{CompanyCode}}/{{Folder}}";
                      setBaseFolders(prev => ({ ...prev, company: template }));
                    }}
                    rootFolder=""
                  />
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground">Available Placeholders (click to insert)</label>
                    <div className="flex flex-wrap gap-1">
                      <Badge
                        variant="outline"
                        className="cursor-pointer hover:bg-purple-100 dark:hover:bg-purple-900/30 text-purple-700 dark:text-purple-300"
                        onClick={() => {
                          const input = document.querySelector('input[value="' + baseFolders.company + '"]') as HTMLInputElement;
                          if (input) {
                            const cursorPos = input.selectionStart || baseFolders.company.length;
                            const newValue = baseFolders.company.slice(0, cursorPos) + '{{CompanyGroup}}' + baseFolders.company.slice(cursorPos);
                            setBaseFolders(prev => ({ ...prev, company: newValue }));
                          }
                        }}
                      >
                        {'{{CompanyGroup}}'} <span className="ml-1 text-xs opacity-60">e.g., "Tekna Group"</span>
                      </Badge>
                      <Badge
                        variant="outline"
                        className="cursor-pointer hover:bg-purple-100 dark:hover:bg-purple-900/30 text-purple-700 dark:text-purple-300"
                        onClick={() => {
                          const input = document.querySelector('input[value="' + baseFolders.company + '"]') as HTMLInputElement;
                          if (input) {
                            const cursorPos = input.selectionStart || baseFolders.company.length;
                            const newValue = baseFolders.company.slice(0, cursorPos) + '{{CompanyCode}}' + baseFolders.company.slice(cursorPos);
                            setBaseFolders(prev => ({ ...prev, company: newValue }));
                          }
                        }}
                      >
                        {'{{CompanyCode}}'} <span className="ml-1 text-xs opacity-60">e.g., "ABC123"</span>
                      </Badge>
                      <Badge
                        variant="outline"
                        className="cursor-pointer hover:bg-purple-100 dark:hover:bg-purple-900/30 text-purple-700 dark:text-purple-300"
                        onClick={() => {
                          const input = document.querySelector('input[value="' + baseFolders.company + '"]') as HTMLInputElement;
                          if (input) {
                            const cursorPos = input.selectionStart || baseFolders.company.length;
                            const newValue = baseFolders.company.slice(0, cursorPos) + '{{Folder}}' + baseFolders.company.slice(cursorPos);
                            setBaseFolders(prev => ({ ...prev, company: newValue }));
                          }
                        }}
                      >
                        {'{{Folder}}'} <span className="ml-1 text-xs opacity-60">e.g., "Invoices"</span>
                      </Badge>
                    </div>
                  </div>
                  <Input
                    value={baseFolders.company}
                    onChange={(e) => setBaseFolders(prev => ({ ...prev, company: e.target.value }))}
                    className="text-xs font-mono"
                    placeholder="/Corporate/{{CompanyCode}}/{{Folder}}"
                  />
                  <div className="flex gap-2 justify-end pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowFolderConfig(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      onClick={saveSharePointPathTemplates}
                      disabled={saving}
                    >
                      {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                      Done
                    </Button>
                  </div>
                </div>
              ) : scopeFilter === "job" ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="outline" className="bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300">
                      <Briefcase className="h-3 w-3 mr-1" />
                      Job Base Folder
                    </Badge>
                  </div>
                  <SharePointFolderBrowser
                    onSelect={(folder, path) => {
                      // Only update the base path portion, preserve the placeholders
                      const template = path ? `${path}/{{JobCode}}/{{Category}}` : "/Teeem/Jobs/{{JobCode}}/{{Category}}";
                      setBaseFolders(prev => ({ ...prev, job: template }));
                    }}
                    rootFolder=""
                  />
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground">Available Placeholders (click to insert)</label>
                    <div className="flex flex-wrap gap-1">
                      <Badge
                        variant="outline"
                        className="cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-900/30 text-blue-700 dark:text-blue-300"
                        onClick={() => {
                          const input = document.querySelector('input[value="' + baseFolders.job + '"]') as HTMLInputElement;
                          if (input) {
                            const cursorPos = input.selectionStart || baseFolders.job.length;
                            const newValue = baseFolders.job.slice(0, cursorPos) + '{{JobCode}}' + baseFolders.job.slice(cursorPos);
                            setBaseFolders(prev => ({ ...prev, job: newValue }));
                          }
                        }}
                      >
                        {'{{JobCode}}'} <span className="ml-1 text-xs opacity-60">e.g., "JOB-001"</span>
                      </Badge>
                      <Badge
                        variant="outline"
                        className="cursor-pointer hover:bg-orange-100 dark:hover:bg-orange-900/30 text-orange-700 dark:text-orange-300"
                        onClick={() => {
                          const input = document.querySelector('input[value="' + baseFolders.job + '"]') as HTMLInputElement;
                          if (input) {
                            const cursorPos = input.selectionStart || baseFolders.job.length;
                            const newValue = baseFolders.job.slice(0, cursorPos) + '{{Category}}' + baseFolders.job.slice(cursorPos);
                            setBaseFolders(prev => ({ ...prev, job: newValue }));
                          }
                        }}
                      >
                        {'{{Category}}'} <span className="ml-1 text-xs opacity-60">e.g., "Plans"</span>
                      </Badge>
                    </div>
                  </div>
                  <Input
                    value={baseFolders.job}
                    onChange={(e) => setBaseFolders(prev => ({ ...prev, job: e.target.value }))}
                    className="text-xs font-mono"
                    placeholder="/Jobs/{{JobCode}}/{{Category}}"
                  />
                  <div className="flex gap-2 justify-end pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowFolderConfig(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      onClick={saveSharePointPathTemplates}
                      disabled={saving}
                    >
                      {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                      Done
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="outline" className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300">
                      <Users className="h-3 w-3 mr-1" />
                      People Base Folder
                    </Badge>
                  </div>
                  <SharePointFolderBrowser
                    onSelect={(folder, path) => {
                      const template = path ? `${path}/{{ContactName}}` : "/Teeem/People/{{ContactName}}";
                      setBaseFolders(prev => ({ ...prev, people: template }));
                    }}
                    rootFolder=""
                  />
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground">Available Placeholders (click to insert)</label>
                    <div className="flex flex-wrap gap-1">
                      <Badge
                        variant="outline"
                        className="cursor-pointer hover:bg-green-100 dark:hover:bg-green-900/30 text-green-700 dark:text-green-300"
                        onClick={() => {
                          const input = document.querySelector('input[value="' + baseFolders.people + '"]') as HTMLInputElement;
                          if (input) {
                            const cursorPos = input.selectionStart || baseFolders.people.length;
                            const newValue = baseFolders.people.slice(0, cursorPos) + '{{ContactName}}' + baseFolders.people.slice(cursorPos);
                            setBaseFolders(prev => ({ ...prev, people: newValue }));
                          }
                        }}
                      >
                        {'{{ContactName}}'} <span className="ml-1 text-xs opacity-60">e.g., "John Smith"</span>
                      </Badge>
                    </div>
                  </div>
                  <Input
                    value={baseFolders.people}
                    onChange={(e) => setBaseFolders(prev => ({ ...prev, people: e.target.value }))}
                    className="text-xs font-mono"
                    placeholder="/Contacts/{{ContactName}}"
                  />
                  <div className="flex gap-2 justify-end pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowFolderConfig(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      onClick={saveSharePointPathTemplates}
                      disabled={saving}
                    >
                      {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                      Done
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Form */}
      {showAddForm && (
        <Card>
          <CardContent className="p-4">
            <form onSubmit={handleAddDocType} className="flex items-end gap-4 flex-wrap">
              <div className="space-y-1">
                <Label htmlFor="abbreviation">Code</Label>
                <Input
                  id="abbreviation"
                  value={newDocType.abbreviation}
                  onChange={(e) => setNewDocType({ ...newDocType, abbreviation: e.target.value.toUpperCase() })}
                  placeholder="CTR"
                  className="w-20"
                />
              </div>
              <div className="flex-1 min-w-[200px] space-y-1">
                <Label htmlFor="name">Document Type Name *</Label>
                <Input
                  id="name"
                  value={newDocType.name}
                  onChange={(e) => setNewDocType({ ...newDocType, name: e.target.value })}
                  placeholder="CTR - Company Tax Return"
                  required
                />
              </div>
              <div className="flex-1 min-w-[200px] space-y-1">
                <Label htmlFor="file_name">File Name</Label>
                <Input
                  id="file_name"
                  value={newDocType.file_name}
                  onChange={(e) => setNewDocType({ ...newDocType, file_name: e.target.value })}
                  placeholder="{CompanyCode} CTR FY{YY}"
                  className="font-mono text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label>Folder</Label>
                <Select
                  value={newDocType.folder}
                  onValueChange={(value) => setNewDocType({ ...newDocType, folder: value, primary_tab: value })}
                >
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FOLDER_OPTIONS.map(f => (
                      <SelectItem key={f} value={f}>{f}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2">
                <Button type="submit" disabled={saving}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Add
                </Button>
                <Button type="button" variant="outline" onClick={() => setShowAddForm(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Table - Foundation 454 */}
      <TeeemTableView
          foundationId="document-types"
          foundationIdNumeric={DOCUMENT_TYPES_FOUNDATION_ID}
          tableName={`Document Types (${filteredDocTypes.length}${scopeFilter !== "all" ? ` - ${scopeFilter}` : ""})`}
          entries={filteredDocTypes}
          // columns prop removed - TeeemTableView auto-fetches from Foundation API (SSoT)
          onEdit={handleEdit}
          onRowUpdate={handleRowUpdate}
          onRowClick={handleRowClick}
          onRowDoubleClick={handleRowDoubleClick}
          onDelete={handleDelete}
          onBulkDelete={handleBulkDelete}
          enableExport={true}
          enableSchemaEditor={true}
          customCellRenderer={customCellRenderer}
          onColumnUpdate={fetchColumns}
          initialGroupByColumn="folder"
          leftActions={
            <Button onClick={() => router.push(`/admin/system/document-types/new${scopeFilter !== "all" ? `?scope=${scopeFilter}` : ""}`)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Document Type
            </Button>
          }
        />

        </TabsContent>
      </Tabs>
    </div>
  );
}
