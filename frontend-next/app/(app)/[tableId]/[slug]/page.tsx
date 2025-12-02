"use client";

import { useParams, useSearchParams, useRouter } from "next/navigation";
import { useEffect, useState, Suspense } from "react";
import { TeeemTableView, SchemaTab, ConnectionsTab } from "@/components/table";
import type { TableRow } from "@/components/table/types";
import { TABLE_SLUGS, urls } from "@/lib/url-utils";
import { getTableUIConfig } from "@/lib/table-ui-config";
import { useFoundationData } from "@/hooks/useFoundationData";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertCircle, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

// Table IDs for navigation support
const TABLE_IDS = {
  JOBS: 204,
  CONTACTS: 214,
  PRICEBOOK: 205,
};

function PageSkeleton() {
  return (
    <div className="p-6 space-y-4">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-4 w-32" />
      <Skeleton className="h-[400px] w-full" />
    </div>
  );
}

function ErrorDisplay({ error, tableId }: { error: Error; tableId: number }) {
  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center gap-2 text-destructive">
        <AlertCircle className="h-5 w-5" />
        <h1 className="text-xl font-semibold">Failed to load table</h1>
      </div>
      <p className="text-sm text-muted-foreground">
        Could not load data for Table #{tableId}
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

  const tableId = Number(params.tableId);
  const slug = params.slug as string;
  const tab = searchParams.get("tab");

  const [activeTab, setActiveTab] = useState(tab || "data");
  const [showAddModal, setShowAddModal] = useState(false);

  // Handle row double-click - navigate to full page for supported tables
  const handleRowDoubleClick = (row: TableRow) => {
    console.log("[TablePage] Double-click on row:", row.id, "tableId:", tableId);

    if (tableId === TABLE_IDS.JOBS) {
      // Navigate to job detail page
      const title = row.title || row.job_title || row.name;
      const slug = title ? String(title).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') : String(row.id);
      router.push(`/jobs/${slug}`);
    } else if (tableId === TABLE_IDS.CONTACTS) {
      // Navigate to contact detail page
      const name = row.full_name || row.name;
      const slug = name ? String(name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') : String(row.id);
      router.push(`/contacts/${slug}`);
    } else if (tableId === TABLE_IDS.PRICEBOOK) {
      // Navigate to pricebook detail page
      const code = row.item_code || row.code;
      const slug = code ? String(code).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') : String(row.id);
      router.push(`/pricebook/${slug}`);
    } else {
      console.log("[TablePage] No detail page for table:", tableId);
    }
  };

  // Get UI configuration for this table
  const uiConfig = getTableUIConfig(tableId);

  // Load foundation data using unified hook
  const { foundation, columns, records, isLoading, error, refresh } = useFoundationData(tableId);

  // Validate URL has _GOD_LOVES_YOU_ suffix
  useEffect(() => {
    if (slug && !slug.includes("_GOD_LOVES_YOU_")) {
      const tableName = TABLE_SLUGS[tableId] || `table-${tableId}`;
      router.replace(urls.table(tableId, tableName, tab || undefined));
    }
  }, [tableId, slug, tab, router]);

  // Parse the slug for item detection
  const cleanSlug = slug?.replace(/_GOD_LOVES_YOU_$/i, "") || "";
  const itemIdMatch = cleanSlug.match(/-(\d+)(?:-|$)/);
  const itemId = itemIdMatch ? itemIdMatch[1] : null;

  // Get table name from foundation or fallback
  const tableName = foundation?.name || `Table ${tableId}`;

  // Handle tab changes - update URL
  const handleTabChange = (newTab: string) => {
    setActiveTab(newTab);
    const newUrl = urls.table(tableId, cleanSlug, newTab);
    router.replace(newUrl, { scroll: false });
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
    return <ErrorDisplay error={error} tableId={tableId} />;
  }

  // Handle add new record
  const handleAddNew = () => {
    // For now, just log - we'll need to implement a create modal
    console.log("[TablePage] Add new record for table:", tableId);
    setShowAddModal(true);
    // TODO: Open create modal or navigate to create page
  };

  // Handle row click - navigate to detail page
  const handleRowClick = (row: { id: number | string; [key: string]: unknown }) => {
    console.log('handleRowClick called with row:', row, 'tableId:', tableId);
    // Use dedicated detail pages for known tables
    switch (tableId) {
      case 204: // Jobs - use /jobs/[id] route
        console.log('Navigating to /jobs/' + row.id);
        router.push(`/jobs/${row.id}`);
        break;
      case 205: // Contacts - use /contacts/[id] route
        router.push(`/contacts/${row.id}`);
        break;
      case 353: // Companies - use /companies/[id] route
        router.push(`/companies/${row.id}`);
        break;
      default:
        // For other tables, use generic item URL
        const itemName = (row.title || row.name || row.job_title || '') as string;
        router.push(urls.tableItem(tableId, row.id, itemName || undefined));
    }
  };

  // Left actions - Add New button
  const leftActions = !uiConfig.viewOnly ? (
    <Button onClick={handleAddNew} className="gap-2">
      <Plus className="h-4 w-4" />
      Add Record
    </Button>
  ) : null;

  // Note: Filter functionality is built into TeeemTableView's three-dot menu
  // No need for a separate filter button - it's available via "Filter by this column" in column headers
  // and the cascade filter system in the menu

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
  };

  return (
    <div className="flex flex-col h-full p-6 space-y-4">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight font-serif">{tableName}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          <span className="font-mono">Table #{tableId}</span>
          {foundation?.table_type === 'system' && (
            <span className="ml-2 text-xs bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 px-1.5 py-0.5 rounded">
              System
            </span>
          )}
          {itemId && <span className="ml-2">• Item #{itemId}</span>}
        </p>
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
                  {/* Fallback to table view for unknown tab types */}
                  {!["data", "schema", "connections"].includes(t.id) && (
                    <TeeemTableView {...tableProps} />
                  )}
                </>
              )}
            </TabsContent>
          ))}
        </Tabs>
      ) : (
        /* No tabs - just show table */
        <div className="flex-1 min-h-0">
          <TeeemTableView {...tableProps} />
        </div>
      )}

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
