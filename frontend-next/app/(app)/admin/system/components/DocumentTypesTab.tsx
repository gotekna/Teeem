"use client";

import * as React from "react";
import { useRouter, usePathname } from "next/navigation";
import { useConfirm } from "@/contexts/ConfirmationContext";
import { Button } from "@/components/ui/button";
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
  Building2,
  Briefcase,
  Users,
  PenTool,
} from "lucide-react";
import { SignatureFieldConfigModal, type SignatureFieldConfig } from "@/components/documents/signature-field-config-modal";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";
import TeeemTableView from "@/components/table/TeeemTableView";
import type { TableColumn, TableRow } from "@/components/table/types";
import { Spinner } from "@/components/ui/spinner";
import { convertColumnsToTEEEMFormat, type ApiColumn } from "@/lib/corporate/column-utils";

// SSoT: Use slug for Foundation lookup - numeric IDs differ per environment
const DOCUMENT_TYPES_FOUNDATION_SLUG = "document_types";

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
  ui_name?: string;
  download_name?: string;
  title_preview?: string;
  primary_tab?: string;
  folder?: string;
  tabs?: string[];
  // Folder lookup fields
  folder_ids?: number[];
  folders?: DocumentTypeFolder[];
  primary_folder_id?: number;
  primary_folder_name?: string;
  active?: boolean;
  documents_count?: number;
  scope?: string;
  file_extensions?: string[];
  file_extensions_display?: string;
  // Signature field configuration for Word→PDF conversion
  signature_field_config?: SignatureFieldConfig[];
}

interface DocumentTypesTabProps {
  /** Base path for navigation (e.g., "/settings/documents/types" or "/admin/system/document-types") */
  basePath?: string;
}

const DEFAULT_DOC_TYPES_BASE_PATH = "/admin/system/document-types";

export function DocumentTypesTab({ basePath = DEFAULT_DOC_TYPES_BASE_PATH }: DocumentTypesTabProps) {
  const router = useRouter();
  const pathname = usePathname();

  // Read scope from URL path for proper back button support
  // e.g. /admin/system/warehouse-config/document_types/job -> "job"
  const pathParts = pathname.split("/");
  const lastPart = pathParts[pathParts.length - 1];
  const validScopes = ["company", "job", "contacts"];
  const scopeFilter = validScopes.includes(lastPart) ? lastPart as "company" | "job" | "contacts" : "all";

  const { toast } = useToast();
  const { confirm } = useConfirm();
  const [loading, setLoading] = React.useState(true);
  const [documentTypes, setDocumentTypes] = React.useState<DocumentType[]>([]);
  const [columns, setColumns] = React.useState<TableColumn[]>([]);
  // Signature field configuration modal state
  const [signatureModalOpen, setSignatureModalOpen] = React.useState(false);
  const [signatureModalDocType, setSignatureModalDocType] = React.useState<DocumentType | null>(null);
  const [signatureModalPdf, setSignatureModalPdf] = React.useState<string | undefined>(undefined);

  // Filter document types by scope
  // SSoT: "contacts" is THE ONE scope for all individuals (Jan 2026 consolidation)
  const filteredDocTypes = React.useMemo(() => {
    if (scopeFilter === "all") return documentTypes;
    if (scopeFilter === "contacts") {
      return documentTypes.filter(dt => dt.scope === "contacts");
    }
    return documentTypes.filter(dt => dt.scope === scopeFilter || dt.scope === "both");
  }, [documentTypes, scopeFilter]);

  // Handle scope tab change - update URL for back button support
  const handleScopeChange = React.useCallback((value: string) => {
    if (value === "all") {
      router.push(basePath, { scroll: false });
    } else {
      router.push(`${basePath}/${value}`, { scroll: false });
    }
  }, [router, basePath]);

  React.useEffect(() => {
    fetchColumns();
    loadData();
  }, []);

  const fetchColumns = async () => {
    try {
      // SSoT: Use slug for Foundation API - backend resolves to numeric ID
      const response = await api.get<{ foundation: { columns: ApiColumn[] } }>(
        `/api/v1/foundations/${DOCUMENT_TYPES_FOUNDATION_SLUG}`
      );
      const dbColumns = response?.foundation?.columns || [];
      const teeemColumns = convertColumnsToTEEEMFormat(dbColumns, DOCUMENT_TYPES_FOUNDATION_SLUG);

      // Add computed display columns that don't exist in the database
      const enhancedColumns = [
        ...teeemColumns,
        {
          key: "primary_folder",
          label: "Primary",
          column_type: "single_line_text",
          resizable: true,
          sortable: true,
          filterable: false,
          width: 150,
          editable: false,
          tooltip: "Primary warehouse folder where this document type appears"
        } as TableColumn,
        {
          key: "show_in",
          label: "Show In",
          column_type: "single_line_text",
          resizable: true,
          sortable: false,
          filterable: false,
          width: 200,
          editable: false,
          tooltip: "Additional folders where this document type also appears"
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
    if (!(await confirm(`Delete document type "${entry.name}"? This cannot be undone.`))) {
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
    if (!(await confirm(`Delete ${ids.length} document types? This cannot be undone.`))) {
      return;
    }
    try {
      await Promise.all(ids.map(id => api.delete(`/api/v1/document_types/${id}`)));
      await loadData();
    } catch (error) {
      console.error("Failed to bulk delete document types:", error);
    }
  };

  // SSoT: Add handled by TeeemTableView's built-in add modal via Foundation API

  // Open signature field configuration modal
  const handleOpenSignatureConfig = React.useCallback((docType: DocumentType) => {
    setSignatureModalDocType(docType);
    setSignatureModalPdf(undefined); // User will upload a PDF in the modal
    setSignatureModalOpen(true);
  }, []);

  // Save signature field configuration
  const handleSaveSignatureConfig = React.useCallback(async (config: SignatureFieldConfig[]) => {
    if (!signatureModalDocType?.id) return;

    try {
      await api.patch(`/api/v1/document_types/${signatureModalDocType.id}`, {
        document_type: { signature_field_config: config }
      });

      // Update local state
      setDocumentTypes(prev => prev.map(dt =>
        dt.id === signatureModalDocType.id ? { ...dt, signature_field_config: config } : dt
      ));

      toast({
        title: "Signature fields saved",
        description: `Configured ${config.length} signature field(s) for "${signatureModalDocType.name}"`,
      });
    } catch (error) {
      console.error("Failed to save signature config:", error);
      toast({
        title: "Error",
        description: "Failed to save signature field configuration",
        variant: "destructive",
      });
    }
  }, [signatureModalDocType, toast]);

  // Handle row double-click - open in new tab
  // Single-click selects row (default behavior), double-click opens detail in new tab
  // Always use admin path since that's where the editor lives (SSoT)
  const handleRowDoubleClick = React.useCallback((row: DocumentType) => {
    window.open(`/admin/system/document-types/${row.id}`, '_blank');
  }, []);

  // Custom cell renderer for tabs display and badges
  const customCellRenderer = (entry: DocumentType, columnKey: string) => {
    // Make NAME column a clickable link to full-screen editor with signature config button
    if (columnKey === "name") {
      const value = entry.name;
      if (!value) return <span className="text-muted-foreground">-</span>;
      const hasSignatureConfig = entry.signature_field_config && entry.signature_field_config.length > 0;
      return (
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              // Always use admin path since that's where the editor lives (SSoT)
              router.push(`/admin/system/document-types/${entry.id}`);
            }}
            className="text-left text-primary hover:underline font-medium flex-1"
            title="Click to open full editor"
          >
            {value}
          </button>
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "h-6 w-6 shrink-0",
              hasSignatureConfig ? "text-green-600 dark:text-green-400" : "text-muted-foreground"
            )}
            onClick={(e) => {
              e.stopPropagation();
              handleOpenSignatureConfig(entry);
            }}
            title={hasSignatureConfig
              ? `${entry.signature_field_config!.length} signature field(s) configured`
              : "Configure signature fields"
            }
          >
            <PenTool className="h-3.5 w-3.5" />
          </Button>
        </div>
      );
    }
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
    if (columnKey === "primary_folder") {
      const primaryFolder = entry.folders?.find(f => f.is_primary);
      const folderName = primaryFolder
        ? (primaryFolder.parent_name ? `${primaryFolder.parent_name} > ${primaryFolder.name}` : primaryFolder.name)
        : entry.primary_folder_name;
      if (!folderName) return <span className="text-muted-foreground">-</span>;
      return (
        <Badge variant="default" className="text-xs bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300">
          {folderName}
        </Badge>
      );
    }
    if (columnKey === "show_in") {
      const secondaryFolders = entry.folders?.filter(f => !f.is_primary) || [];
      if (secondaryFolders.length === 0) return <span className="text-muted-foreground">-</span>;
      return (
        <div className="flex flex-wrap gap-1">
          {secondaryFolders.slice(0, 2).map(f => (
            <Badge
              key={f.id}
              variant="secondary"
              className="text-xs"
            >
              {f.parent_name ? `${f.parent_name} > ${f.name}` : f.name}
            </Badge>
          ))}
          {secondaryFolders.length > 2 && (
            <Badge variant="outline" className="text-xs">
              +{secondaryFolders.length - 2}
            </Badge>
          )}
        </div>
      );
    }
    if (columnKey === "primary_tab" || columnKey === "folder") {
      const value = entry[columnKey as keyof DocumentType] as string | undefined;
      if (!value) return <span className="text-muted-foreground">-</span>;
      return (
        <Badge variant="outline" className="text-xs bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 dark:bg-blue-900/30 dark:text-blue-300">
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
    if (columnKey === "download_name") {
      const value = entry.download_name;
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
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="shrink-0 mb-4">
        <h2 className="text-lg font-semibold">Document Types & Naming Conventions</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Single source of truth for document types across Companies and Jobs. Click any cell to edit.
        </p>
      </div>

      {/* Scope Filter Tabs */}
      <Tabs value={scopeFilter} onValueChange={handleScopeChange} className="flex flex-col flex-1 min-h-0">
        <TabsList className="grid w-full grid-cols-4 max-w-3xl shrink-0">
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
            Contacts ({documentTypes.filter(dt => dt.scope === "contacts").length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value={scopeFilter} className="flex-1 min-h-0 mt-4">
      {/* Table - SSoT: Use slug, TeeemTableView resolves numeric ID */}
      {/* Add Record uses TeeemTableView's built-in modal via Foundation API */}
      <TeeemTableView
          foundationId="document_types"
          tableName={`Document Types (${filteredDocTypes.length}${scopeFilter !== "all" ? ` - ${scopeFilter}` : ""})`}
          entries={filteredDocTypes}
          // ⚠️ legacyDataSource: Documented exception to autoFetchRecords (per CLAUDE.md)
          // Reasons:
          // 1. Custom API: /api/v1/document_types with include_inactive=true param
          // 2. Client-side OR filtering: scope="company" OR scope="both" (complex filter logic)
          // 3. Computed grouping: Groups by primary_tab (not a database column)
          legacyDataSource="custom-api: /api/v1/document_types?include_inactive=true + client-side scope OR filtering"
          onEdit={handleEdit}
          onRowUpdate={handleRowUpdate}
          onRowDoubleClick={handleRowDoubleClick}
          onDelete={handleDelete}
          onBulkDelete={handleBulkDelete}
          onRefresh={loadData}
          enableExport={true}
          enableSchemaEditor={true}
          customCellRenderer={customCellRenderer}
          onColumnUpdate={fetchColumns}
          initialGroupByColumn="primary_tab"
        />

        </TabsContent>
      </Tabs>

      {/* Signature Field Configuration Modal */}
      {signatureModalDocType && (
        <SignatureFieldConfigModal
          open={signatureModalOpen}
          onOpenChange={setSignatureModalOpen}
          documentTypeId={signatureModalDocType.id as number}
          documentTypeName={signatureModalDocType.name || "Document Type"}
          pdfContent={signatureModalPdf}
          initialConfig={signatureModalDocType.signature_field_config || []}
          onSave={handleSaveSignatureConfig}
        />
      )}
    </div>
  );
}
