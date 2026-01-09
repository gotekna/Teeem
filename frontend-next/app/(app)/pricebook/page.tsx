import { fetchFoundationForSSR, type ViewData } from "@/lib/server/foundation-api";
import PricebookPageClient from "./pricebook-page-client";

interface PricebookPageProps {
  searchParams: Promise<{ view?: string }>;
}

/**
 * Pricebook Page - SSR Optimized for Fast LCP
 *
 * This Server Component fetches data before sending HTML to the client.
 * The table renders immediately with 20 rows, achieving ~500ms LCP.
 * Additional records load in the background after hydration.
 *
 * SSR View Loading:
 * When ?view=slug is in the URL, the view config is fetched on the server
 * and passed to the client. This eliminates the flash when switching from
 * flat table to grouped view on hydration.
 */
export default async function PricebookPage({ searchParams }: PricebookPageProps) {
  // Await searchParams (Next.js 15 requirement)
  const params = await searchParams;
  const viewSlug = params.view;

  // Fetch first 20 records on server for fast LCP
  // Also fetch view config if ?view= param is present to eliminate CLS
  // Also fetch group counts if view has grouping to eliminate CLS
  // Also fetch all views for immediate toolbar button rendering
  // Also fetch totalCount to show "20 of X records" immediately (prevents CLS from count change)
  const { columns, records, hasMore, view, views, groupCounts, totalCount } = await fetchFoundationForSSR("pricebook-items", {
    limit: 20,
    viewSlug,
  });

  return (
    <PricebookPageClient
      initialColumns={columns}
      initialRecords={records}
      initialHasMore={hasMore}
      initialView={view}
      initialViews={views}
      initialGroupCounts={groupCounts}
      initialTotalCount={totalCount}
    />
  );
}
