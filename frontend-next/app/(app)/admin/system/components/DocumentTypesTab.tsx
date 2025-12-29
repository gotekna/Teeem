"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useUrlState } from "@/hooks/useUrlState";
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
import {
  Plus,
  Building2,
  Briefcase,
  Users,
  FolderOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";
import { Checkbox } from "@/components/ui/checkbox";
import TeeemTableView from "@/components/table/TeeemTableView";
import type { TableColumn, TableRow } from "@/components/table/types";
import { Spinner } from "@/components/ui/spinner";
import { convertColumnsToTEEEMFormat, type ApiColumn } from "@/lib/corporate/column-utils";
import { DOCUMENT_FOLDER_OPTIONS } from "@/lib/constants/document-types";

// SSoT: Use slug for Foundation lookup - numeric IDs differ per environment
const DOCUMENT_TYPES_FOUNDATION_SLUG = "document-types";

// SSoT: DOCUMENT_FOLDER_OPTIONS imported from @/lib/constants/document-types

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

  // SSoT: URL state managed by useUrlState hook
  const [urlState, setUrlState] = useUrlState({
    scope: null as string | null,  // null = "all"
  });
  const scopeFilter = (urlState.scope as "company" | "job" | "contacts" | "all") || "all";

  const { toast } = useToast();
  const [loading, setLoading] = React.useState(true);
  const [documentTypes, setDocumentTypes] = React.useState<DocumentType[]>([]);
  const [columns, setColumns] = React.useState<TableColumn[]>([]);
  const [showAddForm, setShowAddForm] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
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
    // SSoT: "contacts" scope includes legacy "people" scope for backwards compatibility
    if (scopeFilter === "contacts") {
      return documentTypes.filter(dt => dt.scope === "contacts" || dt.scope === "people");
    }
    return documentTypes.filter(dt => dt.scope === scopeFilter || dt.scope === "both");
  }, [documentTypes, scopeFilter]);

  // Handle scope tab change
  const handleScopeChange = React.useCallback((value: string) => {
    setUrlState({ scope: value === "all" ? null : value });
  }, [setUrlState]);

  React.useEffect(() => {
    fetchColumns();
    loadData();
    loadAvailableFolders();
  }, []);

  const loadAvailableFolders = async () => {
    try {
      // SSoT: Use /api/v1/document_types/tabs (EntityTab-based folders)
      const response = await api.get<{ success: boolean; tabs: FolderOption[] }>(
        "/api/v1/document_types/tabs"
      );
      if (response.success && response.tabs) {
        setAvailableFolders(response.tabs);
      }
    } catch (error) {
      console.error("Failed to load available folders:", error);
    }
  };

  const fetchColumns = async () => {
    try {
      // SSoT: Use slug for Foundation API - backend resolves to numeric ID
      const response = await api.get<{ foundation: { columns: ApiColumn[] } }>(
        `/api/v1/foundations/${DOCUMENT_TYPES_FOUNDATION_SLUG}`
      );
      const dbColumns = response?.foundation?.columns || [];
      const teeemColumns = convertColumnsToTEEEMFormat(dbColumns, DOCUMENT_TYPES_FOUNDATION_SLUG);

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
            <SelectItem value="contacts">Contacts</SelectItem>
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
        <Spinner size={32} className="text-muted-foreground" />
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
          <TabsTrigger value="contacts" className="gap-2">
            <Users className="h-4 w-4" />
            Contacts ({documentTypes.filter(dt => dt.scope === "contacts" || dt.scope === "people").length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value={scopeFilter} className="mt-6 space-y-6">



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
                    {DOCUMENT_FOLDER_OPTIONS.map(f => (
                      <SelectItem key={f} value={f}>{f}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2">
                <Button type="submit" disabled={saving}>
                  {saving ? <Spinner size={16} className="mr-2" /> : null}
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

      {/* Table - SSoT: Use slug, TeeemTableView resolves numeric ID */}
      <TeeemTableView
          foundationId="document-types"
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
