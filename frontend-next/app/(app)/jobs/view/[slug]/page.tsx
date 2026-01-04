import { fetchFoundationForSSR } from "@/lib/server/foundation-api";
import JobsPageClient from "../../jobs-page-client";

interface JobsViewPageProps {
  params: Promise<{ slug: string }>;
}

/**
 * Jobs View Page - SSR Optimized
 *
 * Handles URLs like /jobs/view/live, /jobs/view/completed
 * The view slug determines which saved view configuration to apply.
 *
 * SSR fetches the view config and initial records so the page
 * renders immediately with the correct grouping/filters applied.
 */
export default async function JobsViewPage({ params }: JobsViewPageProps) {
  const { slug } = await params;

  // Fetch records with view configuration applied
  const { columns, records, hasMore, view, views, groupCounts } =
    await fetchFoundationForSSR("jobs", {
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
      viewSlug={slug}
    />
  );
}
