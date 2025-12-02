"use client";

import { useParams, useSearchParams, useRouter } from "next/navigation";
import { useEffect, useState, Suspense, useCallback } from "react";
import { TeeemTableView, SchemaTab, ConnectionsTab, CreateRecordDialog } from "@/components/table";
import { api } from "@/lib/api";
import type { TableRow } from "@/components/table/types";
import { TABLE_IDS, urls, stripUrlSuffix } from "@/lib/url-utils";
import { getTableUIConfig } from "@/lib/table-ui-config";
import { useFoundationBySlug } from "@/hooks/useFoundationBySlug";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertCircle, Plus, Filter, GitMerge } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GlobalViewsManager } from "@/app/(app)/admin/system/components/GlobalViewsManager";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Loader } from "@/components/ui/loader";

function PageSkeleton() {
  return (
    <div className="p-6 space-y-4">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-4 w-32" />
      <Skeleton className="h-[400px] w-full" />
    </div>
  );
}

function ErrorDisplay({ error, slug }: { error: Error; slug: string }) {
  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center gap-2 text-destructive">
        <AlertCircle className="h-5 w-5" />
        <h1 className="text-xl font-semibold">Failed to load table</h1>
      </div>
      <p className="text-sm text-muted-foreground">
        Could not load data for &quot;{slug}&quot;
      </p>
      <pre className="text-xs bg-muted p-4 rounded overflow-auto">
        {error.message}
      </pre>
    </div>
  );
}

function TablePageContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();

  const rawSlug = params.slug as string;
  const tab = searchParams.get("tab");

  // Strip the _GOD_LOVES_YOU_ suffix to get the clean slug
  const cleanSlug = stripUrlSuffix(rawSlug);

  const [activeTab, setActiveTab] = useState(tab || "data");
  const [showAddModal, setShowAddModal] = useState(false);
  const [showViewsManager, setShowViewsManager] = useState(false);

  // Merge modal state
  const [showMergeModal, setShowMergeModal] = useState(false);
  const [mergeRecordIds, setMergeRecordIds] = useState<(number | string)[]>([]);
  const [primaryRecordId, setPrimaryRecordId] = useState<number | string | null>(null);
  const [merging, setMerging] = useState(false);

  // Load foundation data by slug
  const { foundation, columns, records, isLoading, error, refresh } = useFoundationBySlug(cleanSlug);

  // Get table ID from foundation (needed for UI config)
  const tableId = foundation?.id || 0;

  // Handle row double-click - navigate to full page for supported tables
  const handleRowDoubleClick = (row: TableRow) => {
    console.log("[TablePage] Double-click on row:", row.id, "tableId:", tableId);

    if (tableId === TABLE_IDS.JOBS) {
      router.push(`/jobs/${row.id}`);
    } else if (tableId === TABLE_IDS.CONTACTS) {
      router.push(`/contacts/${row.id}`);
    } else if (tableId === TABLE_IDS.PRICEBOOK) {
      router.push(`/pricebook/${row.id}`);
    } else if (tableId === TABLE_IDS.COMPANIES) {
      router.push(`/companies/${row.id}`);
    } else {
      console.log("[TablePage] No detail page for table:", tableId);
    }
  };

  // Get UI configuration for this table
  const uiConfig = getTableUIConfig(tableId);

  // Validate URL has _GOD_LOVES_YOU_ suffix
  useEffect(() => {
    if (rawSlug && !rawSlug.includes("_GOD_LOVES_YOU_")) {
      router.replace(`/${cleanSlug}_GOD_LOVES_YOU_${tab ? `?tab=${tab}` : ''}`);
    }
  }, [rawSlug, cleanSlug, tab, router]);

  // Get table name from foundation or fallback
  const tableName = foundation?.name || cleanSlug;

  // Handle tab changes - update URL
  const handleTabChange = (newTab: string) => {
    setActiveTab(newTab);
    router.replace(`/${cleanSlug}_GOD_LOVES_YOU_?tab=${newTab}`, { scroll: false });
  };

  // Set initial tab from URL or config
  useEffect(() => {
    if (tab) {
      setActiveTab(tab);
    } else if (uiConfig.defaultTab) {
      setActiveTab(uiConfig.defaultTab);
    } else if (uiConfig.tabs && uiConfig.tabs.length > 0) {
      setActiveTab(uiConfig.tabs[0].id);
    }
  }, [tab, uiConfig.defaultTab, uiConfig.tabs]);

  // Handle inline row update - must be before early returns (hooks rule)
  const handleRowUpdate = useCallback(async (rowId: number | string, field: string, value: unknown) => {
    if (!tableId) return;
    try {
      await api.patch(`/api/v1/foundations/${tableId}/records/${rowId}`, {
        record: { [field]: value }
      });
      // Refresh data after update
      refresh();
    } catch (error) {
      console.error("[TablePage] Failed to update row:", error);
      throw error;
    }
  }, [tableId, refresh]);

  if (isLoading) {
    return <PageSkeleton />;
  }

  if (error) {
    return <ErrorDisplay error={error} slug={cleanSlug} />;
  }

  // Handle add new record
  const handleAddNew = () => {
    console.log("[TablePage] Add new record for table:", tableId);
    setShowAddModal(true);
  };

  // Handle row click - navigate to detail page
  const handleRowClick = (row: { id: number | string; [key: string]: unknown }) => {
    console.log('handleRowClick called with row:', row, 'tableId:', tableId);
    switch (tableId) {
      case TABLE_IDS.JOBS:
        router.push(`/jobs/${row.id}`);
        break;
      case TABLE_IDS.CONTACTS:
        router.push(`/contacts/${row.id}`);
        break;
      case TABLE_IDS.COMPANIES:
        router.push(`/companies/${row.id}`);
        break;
      default:
        // For other tables, use the slug-based URL with item ID
        router.push(`/${cleanSlug}/${row.id}_GOD_LOVES_YOU_`);
    }
  };

  // Handle bulk delete
  const handleBulkDelete = async (ids: (number | string)[]) => {
    if (!confirm(`Are you sure you want to delete ${ids.length} record(s)?`)) return;

    try {
      await Promise.all(ids.map((id) =>
        api.delete(`/api/v1/foundations/${tableId}/records/${id}`)
      ));
      refresh();
    } catch (error) {
      console.error("[TablePage] Failed to delete records:", error);
      alert("Failed to delete some records");
    }
  };

  // Handle bulk merge - open modal
  const handleBulkMerge = (ids: (number | string)[]) => {
    setMergeRecordIds(ids);
    setPrimaryRecordId(ids[0]);
    setShowMergeModal(true);
  };

  // Confirm merge
  const handleMergeConfirm = async () => {
    if (!primaryRecordId || !tableId) return;

    setMerging(true);
    try {
      const secondaryIds = mergeRecordIds.filter(id => id !== primaryRecordId);

      // Use the generic merge endpoint for foundations
      await api.post(`/api/v1/foundations/${tableId}/records/${primaryRecordId}/merge`, {
        secondary_record_ids: secondaryIds,
      });

      refresh();
      setShowMergeModal(false);
      setMergeRecordIds([]);
      setPrimaryRecordId(null);
    } catch (error) {
      console.error("[TablePage] Failed to merge records:", error);
      alert("Failed to merge records. Please try again.");
    } finally {
      setMerging(false);
    }
  };

  // Get records for merge modal display
  const mergeRecords = mergeRecordIds
    .map(id => records.find(r => r.id === id))
    .filter(Boolean) as TableRow[];

  // Left actions - Add New button
  const leftActions = !uiConfig.viewOnly ? (
    <Button onClick={handleAddNew} className="gap-2">
      <Plus className="h-4 w-4" />
      Add Record
    </Button>
  ) : null;

  // Custom actions - Filters button (same as Gold Standard)
  const customActions = (
    <Button variant="outline" size="sm" onClick={() => setShowViewsManager(true)}>
      <Filter className="h-4 w-4 mr-2" />
      Filters
    </Button>
  );

  // Common table props
  const tableProps = {
    entries: records,
    columns: columns,
    foundationId: String(tableId),
    foundationIdNumeric: tableId,
    tableName: tableName,
    enableExport: uiConfig.enableExport,
    enableImport: uiConfig.enableImport,
    enableSchemaEditor: uiConfig.enableSchemaEditor,
    viewOnly: uiConfig.viewOnly,
    hideUpdateViewButton: uiConfig.hideUpdateViewButton,
    initialGroupByColumn: uiConfig.initialGroupByColumn,
    onRefresh: refresh,
    onRowDoubleClick: handleRowDoubleClick,
    onRowClick: handleRowClick,
    onRowUpdate: !uiConfig.viewOnly ? handleRowUpdate : undefined,
    onBulkDelete: !uiConfig.viewOnly ? handleBulkDelete : undefined,
    onBulkMerge: !uiConfig.viewOnly ? handleBulkMerge : undefined,
    leftActions: leftActions,
    customActions: customActions,
  };

  return (
    <div className="flex flex-col h-full p-6 space-y-4">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight font-serif">{tableName}</h1>
      </div>

      {/* Tabs (if configured) */}
      {uiConfig.tabs && uiConfig.tabs.length > 0 ? (
        <Tabs value={activeTab} onValueChange={handleTabChange} className="flex-1 flex flex-col">
          <TabsList>
            {uiConfig.tabs.map((t) => (
              <TabsTrigger key={t.id} value={t.id}>
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>

          {uiConfig.tabs.map((t) => (
            <TabsContent key={t.id} value={t.id} className="flex-1 min-h-0 overflow-auto">
              {t.id === activeTab && (
                <>
                  {t.id === "data" && <TeeemTableView {...tableProps} />}
                  {t.id === "schema" && (
                    <SchemaTab
                      foundationId={tableId}
                      columns={columns}
                      tableName={tableName}
                      onRefresh={refresh}
                    />
                  )}
                  {t.id === "connections" && (
                    <ConnectionsTab
                      foundationId={tableId}
                      columns={columns}
                      tableName={tableName}
                    />
                  )}
                  {!["data", "schema", "connections"].includes(t.id) && (
                    <TeeemTableView {...tableProps} />
                  )}
                </>
              )}
            </TabsContent>
          ))}
        </Tabs>
      ) : (
        <div className="flex-1 min-h-0">
          <TeeemTableView {...tableProps} />
        </div>
      )}

      {/* Create Record Dialog */}
      <CreateRecordDialog
        open={showAddModal}
        onOpenChange={setShowAddModal}
        foundationId={tableId}
        tableName={tableName}
        columns={columns}
        onSuccess={refresh}
      />

      {/* Global Views Manager */}
      <GlobalViewsManager
        open={showViewsManager}
        onOpenChange={setShowViewsManager}
        foundationId={tableId}
        columns={columns
          .filter(col => col.key !== 'select' && col.key !== 'actions')
          .map((col, index) => ({
            id: col.id || index,
            column_name: col.key,
            name: col.label,
            column_type: col.column_type || 'single_line_text',
            position: index,
          }))}
        onViewsChange={refresh}
        rows={records}
      />

      {/* Merge Records Modal */}
      <Dialog open={showMergeModal} onOpenChange={setShowMergeModal}>
        <DialogContent className="sm:max-w-lg p-6">
          <DialogHeader className="pb-4">
            <DialogTitle className="flex items-center gap-2">
              <GitMerge className="h-5 w-5" />
              Merge Records
            </DialogTitle>
            <DialogDescription className="pt-2">
              Select the primary record. All data from the other records will be merged into it,
              and the other records will be deleted.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <Label className="text-sm font-medium mb-4 block">
              Select Primary Record ({mergeRecords.length} records selected)
            </Label>
            <RadioGroup
              value={String(primaryRecordId)}
              onValueChange={(value) => setPrimaryRecordId(Number(value))}
              className="space-y-4"
            >
              {mergeRecords.map((record) => {
                // Find a display field (name, title, or first non-id text field)
                const displayField = columns.find(c =>
                  ['name', 'title', 'display_name', 'full_name'].includes(c.key)
                )?.key || columns.find(c =>
                  c.key !== 'id' && c.column_type === 'single_line_text'
                )?.key || 'id';

                const displayValue = record[displayField] || `Record #${record.id}`;

                return (
                  <div
                    key={record.id}
                    className={`flex items-center space-x-4 p-4 rounded-lg border ${
                      primaryRecordId === record.id
                        ? "border-primary bg-primary/5"
                        : "border-border hover:bg-muted/50"
                    }`}
                  >
                    <RadioGroupItem value={String(record.id)} id={`record-${record.id}`} />
                    <Label
                      htmlFor={`record-${record.id}`}
                      className="flex-1 cursor-pointer"
                    >
                      <div className="font-medium">{String(displayValue)}</div>
                      <div className="text-sm text-muted-foreground mt-1">
                        ID: {record.id}
                      </div>
                    </Label>
                  </div>
                );
              })}
            </RadioGroup>

            {mergeRecords.length > 1 && primaryRecordId && (
              <div className="mt-5 p-4 bg-amber-50 dark:bg-amber-950 rounded-lg border border-amber-200 dark:border-amber-800">
                <p className="text-sm text-amber-800 dark:text-amber-200">
                  <strong>Warning:</strong> {mergeRecords.length - 1} record(s) will be deleted after merge.
                </p>
              </div>
            )}
          </div>

          <DialogFooter className="pt-4">
            <Button
              variant="outline"
              onClick={() => setShowMergeModal(false)}
              disabled={merging}
            >
              Cancel
            </Button>
            <Button
              onClick={handleMergeConfirm}
              disabled={!primaryRecordId || merging}
            >
              {merging ? (
                <>
                  <Loader className="h-4 w-4 mr-2 animate-spin" />
                  Merging...
                </>
              ) : (
                <>
                  <GitMerge className="h-4 w-4 mr-2" />
                  Merge Records
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function TablePage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <TablePageContent />
    </Suspense>
  );
}
