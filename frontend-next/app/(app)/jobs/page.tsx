import { fetchFoundationForSSR, type ViewData } from "@/lib/server/foundation-api";
import JobsPageClient from "./jobs-page-client";

interface JobsPageProps {
  searchParams: Promise<{ view?: string }>;
}

/**
 * Jobs Page - SSR Optimized for Fast LCP
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
export default async function JobsPage({ searchParams }: JobsPageProps) {
  // Await searchParams (Next.js 15 requirement)
  const params = await searchParams;
  const viewSlug = params.view;

  // Fetch first 20 records on server for fast LCP
  // Also fetch view config if ?view= param is present to eliminate flash
  // Also fetch group counts if view has grouping to eliminate CLS
  const { columns, records, hasMore, view, groupCounts } = await fetchFoundationForSSR("jobs", {
    limit: 20,
    viewSlug,
  });

  return (
    <JobsPageClient
      initialColumns={columns}
      initialRecords={records}
      initialHasMore={hasMore}
      initialView={view}
      initialGroupCounts={groupCounts}
    />
  );
}
