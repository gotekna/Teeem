import { fetchFoundationForSSR } from "@/lib/server/foundation-api";
import PurchaseOrdersPageClient from "../../purchase-orders-page-client";

interface PurchaseOrdersViewPageProps {
  params: Promise<{ slug: string }>;
}

/**
 * Purchase Orders View Page - Path-Based View URL
 *
 * SSoT URL Pattern: /purchase_orders/view/all-purchase-orders (path-based, human-readable)
 *
 * This is the preferred URL format per component-registry.ts URL PATTERNS standard.
 * Legacy ?view=slug URLs are redirected here by the parent page.
 *
 * @example /purchase_orders/view/all-purchase-orders → All purchase orders view
 * @example /purchase_orders/view/pending → View filtered to pending POs
 */
export default async function PurchaseOrdersViewPage({ params }: PurchaseOrdersViewPageProps) {
  const { slug } = await params;

  // Fetch with view applied on server for fast LCP + no CLS
  const { columns, records, hasMore, view, views } = await fetchFoundationForSSR("purchase-orders", {
    limit: 20,
    viewSlug: slug,
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
