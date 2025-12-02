"use client";

import { useParams, useSearchParams, useRouter } from "next/navigation";
import { useEffect, useState, Suspense } from "react";
import { TeeemTableView, SchemaTab, ConnectionsTab, CreateRecordDialog } from "@/components/table";
import type { TableRow } from "@/components/table/types";
import { TABLE_IDS, urls, stripUrlSuffix } from "@/lib/url-utils";
import { getTableUIConfig } from "@/lib/table-ui-config";
import { useFoundationBySlug } from "@/hooks/useFoundationBySlug";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertCircle, Plus, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GlobalViewsManager } from "@/app/(app)/admin/system/components/GlobalViewsManager";

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
