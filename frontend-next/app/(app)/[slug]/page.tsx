"use client";

import { useParams, usePathname, useRouter } from "next/navigation";
import { useEffect, Suspense, useCallback, useMemo } from "react";
import { useConfirm } from "@/contexts/ConfirmationContext";
import { useToast } from "@/components/ui/use-toast";
import { TeeemTableView, SchemaTab, ConnectionsTab } from "@/components/table";
import { TablePage } from "@/components/ui/page-wrappers";
import { api } from "@/lib/api";
import type { TableRow } from "@/components/table/types";
import { TABLE_IDS, stripUrlSuffix, slugifyPricebookCode } from "@/lib/url-utils";
import { getTableUIConfig } from "@/lib/table-ui-config";
import { useFoundationBySlug } from "@/hooks/useFoundationBySlug";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertCircle } from "lucide-react";
import { notFound } from "next/navigation";

/**
 * SSoT: Static routes that should NEVER be treated as Foundation slugs.
 * If a slug matches one of these, the route should 404 (the actual page lives
 * elsewhere and this catch-all shouldn't handle it).
 *
 * Why: Next.js routing can fall through to [slug] when deep paths under
 * static routes don't exist (e.g., /settings/system/entity-config/foo
 * matches [slug]=settings when /settings/system/entity-config/ doesn't exist).
 */
const STATIC_ROUTE_PREFIXES = [
  "settings",
  "admin",
  "corporate", // Has dedicated pages in /corporate/*
  // Note: Don't add foundation slugs here (jobs, contacts, etc.)
  // Those are intentionally handled by this [slug] route
];

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
  const pathname = usePathname();
  const router = useRouter();
  const { confirm } = useConfirm();
  const { toast } = useToast();

  const rawSlug = params.slug as string;

  // SSoT Guard: Prevent static routes from being treated as Foundation slugs
  // This handles edge cases where Next.js routing falls through to [slug]
  // when deep paths under static routes don't have explicit pages.
  if (STATIC_ROUTE_PREFIXES.includes(rawSlug)) {
    notFound();
  }

  // Strip any legacy suffix if present (for backwards compatibility)
  const cleanSlug = stripUrlSuffix(rawSlug);

  // URL is SSoT for tab state (path-based navigation)
  // Parse: /contacts/schema → tab = "schema"
  const tab = useMemo(() => {
    const parts = pathname.replace(`/${cleanSlug}`, "").split("/").filter(Boolean);
    // Only return tab if it's a known tab name (not a record ID)
    const potentialTab = parts[0];
    if (potentialTab && ["data", "schema", "connections"].includes(potentialTab)) {
      return potentialTab;
    }
    return null;
  }, [pathname, cleanSlug]);

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
      router.replace(`/${cleanSlug}${tab ? `/${tab}` : ''}`);
    }
  }, [rawSlug, cleanSlug, tab, router]);

  // Get table name from foundation or fallback
  const tableName = foundation?.name || cleanSlug;

  // Handle tab changes - update URL (activeTab is now derived from URL)
  const handleTabChange = useCallback((newTab: string) => {
    router.push(`/${cleanSlug}/${newTab}`, { scroll: false });
  }, [router, cleanSlug]);

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
    if (!(await confirm(`Are you sure you want to delete ${ids.length} record(s)?`))) return;

    try {
      await Promise.all(ids.map((id) =>
        api.delete(`/api/v1/foundations/${tableId}/records/${id}`)
      ));
      refresh();
    } catch (error) {
      console.error("[TablePage] Failed to delete records:", error);
      toast({ title: "Error", description: "Failed to delete some records", variant: "destructive" });
    }
  };

  // Note: Merge is now handled by TeeemTableView internally via enableMerge prop

  // Common table props
  // SSoT: Add button is auto-enabled by TeeemTableView when foundationIdNumeric is set
  // Note: Filters button is auto-enabled by TeeemTableView when foundationIdNumeric is set
  // Note: columns NOT passed - TeeemTableView auto-fetches from Foundation API (SSoT)
  const tableProps = {
    entries: records,
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
    // Note: Merge is handled internally by TeeemTableView when foundationIdNumeric is set
    // Note: leftActions removed - Add button auto-enabled by TeeemTableView (SSoT)
    // Server-side search for large tables
    onServerSearch: serverSearch,
    serverSearchLoading: isSearching,
  };

  return (
    <TablePage>
      {/* Tabs (if configured) */}
      {uiConfig.tabs && uiConfig.tabs.length > 0 ? (
        <Tabs value={activeTab} onValueChange={handleTabChange} className="flex-1 flex flex-col px-4">
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
        <TeeemTableView {...tableProps} />
      )}

      {/* Note: CreateRecordDialog removed - handled internally by TeeemTableView (SSoT) */}
      {/* Note: GlobalViewsManager is now handled by TeeemTableView internally when foundationIdNumeric is set */}
    </TablePage>
  );
}

export default function DynamicFoundationPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <TablePageContent />
    </Suspense>
  );
}
