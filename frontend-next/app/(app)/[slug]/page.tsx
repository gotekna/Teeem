"use client";

import { useParams, useSearchParams, useRouter } from "next/navigation";
import { useEffect, useState, Suspense, useCallback } from "react";
import { TeeemTableView, SchemaTab, ConnectionsTab, CreateRecordDialog } from "@/components/table";
import { api } from "@/lib/api";
import type { TableRow } from "@/components/table/types";
import { TABLE_IDS, stripUrlSuffix, slugifyPricebookCode } from "@/lib/url-utils";
import { getTableUIConfig } from "@/lib/table-ui-config";
import { useFoundationBySlug } from "@/hooks/useFoundationBySlug";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertCircle, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

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

  // Strip any legacy suffix if present (for backwards compatibility)
  const cleanSlug = stripUrlSuffix(rawSlug);

  const [showAddModal, setShowAddModal] = useState(false);

  // Load foundation data by slug
  const { foundation, columns, records, isLoading, error, refresh, serverSearch, isSearching } = useFoundationBySlug(cleanSlug);

  // Get table ID from foundation (needed for UI config)
  const tableId = foundation?.id || 0;

  // Get UI configuration for this table
  const uiConfig = getTableUIConfig(tableId);

  // Derive active tab from URL or config (no state needed)
  const activeTab = tab || uiConfig.defaultTab || (uiConfig.tabs && uiConfig.tabs.length > 0 ? uiConfig.tabs[0].id : "data");

  // Handle row double-click - navigate to full page for supported tables
  const handleRowDoubleClick = (row: TableRow) => {
    console.log("[TablePage] Double-click on row:", row.id, "tableId:", tableId);

    if (tableId === TABLE_IDS.JOBS) {
      router.push(`/jobs/${row.id}`);
    } else if (tableId === TABLE_IDS.CONTACTS) {
      router.push(`/contacts/${row.id}`);
    } else if (tableId === TABLE_IDS.PRICEBOOK) {
      // Use item_code instead of id for pricebook items
      const itemCode = row.item_code as string;
      if (itemCode) {
        router.push(`/pricebook/${slugifyPricebookCode(itemCode)}`);
      } else {
        console.warn("[TablePage] Pricebook item missing item_code:", row);
      }
    } else {
      // Companies use /corporate routes, not Foundation-based [slug] pages
      console.log("[TablePage] No detail page for table:", tableId);
    }
  };

  // Redirect legacy URLs with suffix to clean URLs
  useEffect(() => {
    if (rawSlug && rawSlug.includes("_GOD_LOVES_YOU_")) {
      router.replace(`/${cleanSlug}${tab ? `?tab=${tab}` : ''}`);
    }
  }, [rawSlug, cleanSlug, tab, router]);

  // Get table name from foundation or fallback
  const tableName = foundation?.name || cleanSlug;

  // Handle tab changes - update URL (activeTab is now derived from URL)
  const handleTabChange = (newTab: string) => {
    router.replace(`/${cleanSlug}?tab=${newTab}`, { scroll: false });
  };

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
      // Companies use /corporate routes, not Foundation-based [slug] pages
      default:
        // For other tables, use the slug-based URL with item ID
        router.push(`/${cleanSlug}/${row.id}`);
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

  // Note: Merge is now handled by TeeemTableView internally via enableMerge prop

  // Left actions - Add New button
  const leftActions = !uiConfig.viewOnly ? (
    <Button onClick={handleAddNew} className="gap-2">
      <Plus className="h-4 w-4" />
      Add Record
    </Button>
  ) : null;

  // Common table props
  // Note: Filters button is auto-enabled by TeeemTableView when foundationIdNumeric is set
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
    // Merge is handled internally by TeeemTableView when foundationIdNumeric is set
    leftActions: leftActions,
    // Server-side search for large tables
    onServerSearch: serverSearch,
    serverSearchLoading: isSearching,
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

      {/* Note: GlobalViewsManager is now handled by TeeemTableView internally when foundationIdNumeric is set */}
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
