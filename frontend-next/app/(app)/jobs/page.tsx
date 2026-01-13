import { redirect } from "next/navigation";
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
 * URL Pattern: /jobs (default view) or /jobs/view/[slug] (specific view)
 * Legacy ?view=slug redirects to path-based URL for SSoT compliance.
 */
export default async function JobsPage({ searchParams }: JobsPageProps) {
  // Await searchParams (Next.js 15 requirement)
  const params = await searchParams;

  // SSoT URL Pattern: Redirect legacy ?view= to path-based URL
  if (params.view) {
    redirect(`/jobs/view/${params.view}`);
  }

  // Fetch first 20 records on server for fast LCP
  // Also fetch all views for immediate toolbar button rendering
  const { columns, records, hasMore, view, views, groupCounts } = await fetchFoundationForSSR("jobs", {
    limit: 20,
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
