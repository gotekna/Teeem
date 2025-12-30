import { fetchFoundationForSSR } from "@/lib/server/foundation-api";
import JobsPageClient from "./jobs-page-client";

/**
 * Jobs Page - SSR Optimized for Fast LCP
 *
 * This Server Component fetches data before sending HTML to the client.
 * The table renders immediately with 20 rows, achieving ~500ms LCP.
 * Additional records load in the background after hydration.
 */
export default async function JobsPage() {
  // Fetch first 20 records on server for fast LCP
  const { columns, records, hasMore } = await fetchFoundationForSSR("jobs", {
    limit: 20,
  });

  return (
    <JobsPageClient
      initialColumns={columns}
      initialRecords={records}
      initialHasMore={hasMore}
    />
  );
}
