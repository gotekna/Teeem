import { redirect } from "next/navigation";
import { fetchFoundationForSSR } from "@/lib/server/foundation-api";
import PurchaseOrdersPageClient from "./purchase-orders-page-client";

interface PurchaseOrdersPageProps {
  searchParams: Promise<{ view?: string }>;
}

/**
 * Purchase Orders Page - SSR Optimized for Fast LCP
 *
 * This Server Component fetches data before sending HTML to the client.
 * The table renders immediately with 20 rows, achieving ~500ms LCP.
 * Additional records load in the background after hydration.
 *
 * URL Pattern: /purchase_orders (default view) or /purchase_orders/view/[slug] (specific view)
 * Legacy ?view=slug redirects to path-based URL for SSoT compliance.
 */
export default async function PurchaseOrdersPage({ searchParams }: PurchaseOrdersPageProps) {
  // Await searchParams (Next.js 15 requirement)
  const params = await searchParams;

  // SSoT URL Pattern: Redirect legacy ?view= to path-based URL
  if (params.view) {
    redirect(`/purchase_orders/view/${params.view}`);
  }

  // Fetch first 20 records on server for fast LCP
  // Also fetch all views for immediate toolbar button rendering
  const { columns, records, hasMore, view, views } = await fetchFoundationForSSR("purchase-orders", {
    limit: 20,
  });

  return (
    <PurchaseOrdersPageClient
      initialColumns={columns}
      initialRecords={records}
      initialHasMore={hasMore}
      initialView={view}
      initialViews={views}
    />
  );
}
