import { redirect } from "next/navigation";
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
 * URL Pattern: /pricebook (default view) or /pricebook/view/[slug] (specific view)
 * Legacy ?view=slug redirects to path-based URL for SSoT compliance.
 */
export default async function PricebookPage({ searchParams }: PricebookPageProps) {
  // Await searchParams (Next.js 15 requirement)
  const params = await searchParams;

  // SSoT URL Pattern: Redirect legacy ?view= to path-based URL
  if (params.view) {
    redirect(`/pricebook/view/${params.view}`);
  }

  // Fetch first 20 records on server for fast LCP
  // Also fetch all views for immediate toolbar button rendering
  // Also fetch totalCount to show "20 of X records" immediately (prevents CLS from count change)
  const { columns, records, hasMore, view, views, groupCounts, totalCount } = await fetchFoundationForSSR("pricebook-items", {
    limit: 20,
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
