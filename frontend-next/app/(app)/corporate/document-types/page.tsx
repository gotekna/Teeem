"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
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
import { ArrowLeft, Plus, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import TeeemTableView from "@/components/table/TeeemTableView";
import type { TableColumn, TableRow } from "@/components/table/types";

// Available folders/tabs
const FOLDER_OPTIONS = [
  "ADVICE", "ASIC", "ASSETS", "ATO", "BANK", "COMPANY",
  "DIVIDENDS", "FINANCIALS", "GENERAL", "INSURANCE",
  "LOANS", "MINUTES", "REGISTRY", "TRUST"
];

// Build column definitions for document types table
const buildDocumentTypeColumns = (): TableColumn[] => [
  { key: "id", label: "ID", column_type: "whole_number", resizable: true, sortable: true, filterable: true, width: 60 },
  { key: "abbreviation", label: "Code", column_type: "single_line_text", resizable: true, sortable: true, filterable: true, width: 80 },
  { key: "name", label: "Document Type", column_type: "single_line_text", resizable: true, sortable: true, filterable: true, width: 280 },
  { key: "naming_format", label: "Naming Format", column_type: "single_line_text", resizable: true, sortable: true, filterable: true, width: 300 },
  { key: "primary_tab", label: "Primary Tab", column_type: "choice", resizable: true, sortable: true, filterable: true, filterType: "dropdown", width: 120, choices: FOLDER_OPTIONS },
  { key: "folder", label: "Folder", column_type: "choice", resizable: true, sortable: true, filterable: true, filterType: "dropdown", width: 120, choices: FOLDER_OPTIONS },
  { key: "tabs_display", label: "All Tabs", column_type: "single_line_text", resizable: true, sortable: false, filterable: false, width: 200 },
  { key: "active", label: "Active", column_type: "boolean", resizable: true, sortable: true, filterable: true, filterType: "dropdown", width: 70 },
  { key: "documents_count", label: "Docs", column_type: "whole_number", resizable: true, sortable: true, filterable: false, width: 60 }
];

interface DocumentType extends TableRow {
  abbreviation?: string;
  name?: string;
  naming_format?: string;
  primary_tab?: string;
  folder?: string;
  tabs?: string[];
  tabs_display?: string;
  active?: boolean;
  documents_count?: number;
}

export default function DocumentTypesPage() {
  const router = useRouter();
  const [loading, setLoading] = React.useState(true);
  const [documentTypes, setDocumentTypes] = React.useState<DocumentType[]>([]);
  const [columns] = React.useState(buildDocumentTypeColumns());
  const [showAddForm, setShowAddForm] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [newDocType, setNewDocType] = React.useState({
    name: "",
    abbreviation: "",
    naming_format: "{CompanyCode} {Description} {Date}",
    folder: "GENERAL",
    primary_tab: "GENERAL",
    active: true
  });

  React.useEffect(() => {
    loadData();
  }, []);

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
        tabs_display: dt.tabs?.join(", ") || ""
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
        naming_format: "{CompanyCode} {Description} {Date}",
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

  // Custom cell renderer for tabs display and badges
  const customCellRenderer = (entry: DocumentType, columnKey: string) => {
    if (columnKey === "tabs_display") {
      const tabs = entry.tabs || [];
      if (tabs.length === 0) return <span className="text-muted-foreground">-</span>;
      return (
        <div className="flex flex-wrap gap-1">
          {tabs.map(tab => (
            <Badge
              key={tab}
              variant={tab === entry.primary_tab ? "default" : "secondary"}
              className={cn(
                "text-xs",
                tab === entry.primary_tab && "ring-1 ring-primary"
              )}
            >
              {tab}
            </Badge>
          ))}
        </div>
      );
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
    if (columnKey === "naming_format") {
      const value = entry.naming_format;
      if (!value) return <span className="text-muted-foreground italic">Not set</span>;
      return (
        <span className="font-mono text-xs text-muted-foreground">{value}</span>
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
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-start gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push("/corporate")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight font-serif">Document Types & Naming Conventions</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Manage document types, naming formats, and tab assignments. Click any cell to edit.
            </p>
          </div>
        </div>
      </div>

      {/* Add Form */}
      {showAddForm && (
        <Card className="mb-6">
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
                <Label htmlFor="naming_format">Naming Format</Label>
                <Input
                  id="naming_format"
                  value={newDocType.naming_format}
                  onChange={(e) => setNewDocType({ ...newDocType, naming_format: e.target.value })}
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
        foundationIdNumeric={454}
        tableName={`Document Types (${documentTypes.length})`}
        entries={documentTypes}
        columns={columns}
        onEdit={handleEdit}
        onRowUpdate={handleRowUpdate}
        onDelete={handleDelete}
        onBulkDelete={handleBulkDelete}
        enableExport={true}
        enableSchemaEditor={true}
        customCellRenderer={customCellRenderer}
        leftActions={
          <Button onClick={() => setShowAddForm(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Document Type
          </Button>
        }
      />

      {/* Legend */}
      <Card className="mt-6 bg-blue-50/50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900">
        <CardContent className="p-4">
          <h4 className="text-sm font-medium text-blue-900 dark:text-blue-200 mb-2">Naming Format Variables</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm text-blue-700 dark:text-blue-300">
            <div><code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">{"{CompanyCode}"}</code> Company abbreviation</div>
            <div><code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">{"{LoanID}"}</code> Loan identifier</div>
            <div><code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">{"{AssetCode}"}</code> Asset abbreviation</div>
            <div><code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">{"{FY}"}</code> or <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">{"{YY}"}</code> Financial year</div>
            <div><code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">{"{Date}"}</code> Document date</div>
            <div><code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">{"{Period}"}</code> BAS period</div>
            <div><code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">{"{Description}"}</code> Custom text</div>
            <div><code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">{"{LenderCode}"}</code> Lender company</div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
