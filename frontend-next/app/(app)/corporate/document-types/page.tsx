"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useConfirm } from "@/contexts/ConfirmationContext";
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
import { Plus } from "lucide-react";
import { BackButton } from "@/components/ui/back-button";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import TeeemTableView from "@/components/table/TeeemTableView";
import type { TableRow } from "@/components/table/types";
import { TablePage } from "@/components/ui/page-wrappers";
import { Spinner } from "@/components/ui/spinner";
import { DOCUMENT_FOLDER_OPTIONS } from "@/lib/constants/document-types";

/**
 * Document Types Page - Corporate Document Type Management
 *
 * SSoT: Uses Foundation API via autoFetchRecords (Jan 2026 refactor)
 * Foundation: "document_types"
 *
 * Previous pattern used manual loadData() with entries prop.
 * Refactored to use autoFetchRecords for SSR hydration, caching, infinite scroll.
 * Custom cell renderer preserved for badges and formatted display.
 */

// Re-export for local use (SSoT: @/lib/constants/document-types.ts)
const FOLDER_OPTIONS = DOCUMENT_FOLDER_OPTIONS;

interface DocumentType extends TableRow {
  abbreviation?: string;
  name?: string;
  naming_format?: string;
  title_preview?: string;
  primary_tab?: string;
  folder?: string;
  tabs?: string[];
  active?: boolean;
  documents_count?: number;
  scope?: string;
  file_extensions?: string[];
  target_folder?: string;
}

export default function DocumentTypesPage() {
  const router = useRouter();
  const { confirm } = useConfirm();
  const [refreshKey, setRefreshKey] = React.useState(0);
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

  // Handle row click - navigate to detail page
  const handleRowClick = React.useCallback((row: DocumentType) => {
    router.push(`/admin/system/document-types/${row.id}`);
  }, [router]);

  // Handle row double-click
  const handleRowDoubleClick = React.useCallback((row: DocumentType) => {
    router.push(`/admin/system/document-types/${row.id}`);
  }, [router]);

  const handleDelete = async (entry: DocumentType) => {
    if (!(await confirm(`Delete document type "${entry.name}"? This cannot be undone.`))) {
      throw new Error("Cancelled");
    }
    // TeeemTableView handles the actual delete via Foundation API
  };

  const handleBulkDelete = async (ids: (number | string)[]) => {
    if (!(await confirm(`Delete ${ids.length} document types? This cannot be undone.`))) {
      throw new Error("Cancelled");
    }
    // TeeemTableView handles the actual delete via Foundation API
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
      // Trigger refresh to show new record
      setRefreshKey(k => k + 1);
    } catch (error) {
      console.error("Failed to create document type:", error);
    } finally {
      setSaving(false);
    }
  };

  // Custom cell renderer for tabs display and badges
  const customCellRenderer = (entry: DocumentType, columnKey: string) => {
    if (columnKey === "scope") {
      const value = entry.scope || "company";
      const scopeConfig = {
        company: { label: "Company", className: "bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300" },
        job: { label: "Job", className: "bg-orange-50 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300" },
        both: { label: "Both", className: "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300" }
      };
      const config = scopeConfig[value as keyof typeof scopeConfig] || scopeConfig.company;
      return (
        <Badge variant="outline" className={cn("text-xs", config.className)}>
          {config.label}
        </Badge>
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
    if (columnKey === "title_preview") {
      const value = entry.title_preview;
      if (!value) return <span className="text-muted-foreground italic">Not set</span>;
      return (
        <span className="font-semibold text-green-700 dark:text-green-400">{value}</span>
      );
    }
    return null;
  };

  // Left actions - Back button + Add button
  const leftActionsWithBack = (
    <div className="flex items-center gap-2">
      <BackButton fallbackHref="/corporate" />
      <Button onClick={() => setShowAddForm(true)}>
        <Plus className="h-4 w-4 mr-2" />
        Add Document Type
      </Button>
    </div>
  );

  return (
    <TablePage>
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

      {/* Table - document_types Foundation (SSoT: autoFetchRecords) */}
      <TeeemTableView
        foundationId="document_types"
        autoFetchRecords={true}
        refreshTrigger={refreshKey}
        tableName="Document Types"
        onRowClick={handleRowClick}
        onRowDoubleClick={handleRowDoubleClick}
        onDelete={handleDelete}
        onBulkDelete={handleBulkDelete}
        enableExport={true}
        enableSchemaEditor={true}
        customCellRenderer={customCellRenderer}
        leftActions={leftActionsWithBack}
        hideFooter={true}
      />

      {/* Legend */}
      <Card className="mt-6 bg-blue-50/50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900">
        <CardContent className="p-4">
          <h4 className="text-sm font-medium text-blue-900 dark:text-blue-200 mb-2">Naming Format Variables</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm text-blue-700 dark:text-blue-300 mb-4">
            <div className="col-span-4 text-xs font-semibold text-purple-700 dark:text-purple-300 border-b border-purple-200 dark:border-purple-800 pb-1 mb-1">Corporate Documents</div>
            <div><code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">{"{CompanyCode}"}</code> Company abbreviation</div>
            <div><code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">{"{LoanID}"}</code> Loan identifier</div>
            <div><code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">{"{AssetCode}"}</code> Asset abbreviation</div>
            <div><code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">{"{FY}"}</code> or <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">{"{YY}"}</code> Financial year</div>
            <div><code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">{"{Date}"}</code> Document date</div>
            <div><code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">{"{Period}"}</code> BAS period</div>
            <div><code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">{"{Description}"}</code> Custom text</div>
            <div><code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">{"{LenderCode}"}</code> Lender company</div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm text-orange-700 dark:text-orange-300">
            <div className="col-span-4 text-xs font-semibold border-b border-orange-200 dark:border-orange-800 pb-1 mb-1">Job Documents</div>
            <div><code className="bg-orange-100 dark:bg-orange-900 px-1 rounded">{"{JobCode}"}</code> Job number</div>
            <div><code className="bg-orange-100 dark:bg-orange-900 px-1 rounded">{"{JobTitle}"}</code> Job address/title</div>
            <div><code className="bg-orange-100 dark:bg-orange-900 px-1 rounded">{"{Occ}"}</code> Certificate of Occupancy</div>
            <div><code className="bg-orange-100 dark:bg-orange-900 px-1 rounded">{"{Consultant}"}</code> Consultant name</div>
            <div><code className="bg-orange-100 dark:bg-orange-900 px-1 rounded">{"{Number}"}</code> Sequential number</div>
          </div>
        </CardContent>
      </Card>
    </TablePage>
  );
}
