import { fetchFoundationForSSR } from "@/lib/server/foundation-api";
import JobsPageClient from "../../jobs-page-client";

interface JobsViewPageProps {
  params: Promise<{ slug: string }>;
}

/**
 * Jobs View Page - Path-Based View URL
 *
 * SSoT URL Pattern: /jobs/view/live (path-based, human-readable)
 *
 * This is the preferred URL format per component-registry.ts URL PATTERNS standard.
 * Legacy ?view=slug URLs are redirected here by the parent page.
 *
 * @example /jobs/view/live → View filtered to live jobs
 * @example /jobs/view/completed → View filtered to completed jobs
 */
export default async function JobsViewPage({ params }: JobsViewPageProps) {
  const { slug } = await params;

  // Fetch with view applied on server for fast LCP + no CLS
  const { columns, records, hasMore, view, views, groupCounts } = await fetchFoundationForSSR("jobs", {
    limit: 20,
    viewSlug: slug,
  });

  return (
    <JobsPageClient
      initialColumns={columns}
      initialRecords={records}
      initialHasMore={hasMore}
      initialView={view}
      initialViews={views}
      initialGroupCounts={groupCounts}
    />
  );
}
