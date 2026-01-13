import { fetchFoundationForSSR } from "@/lib/server/foundation-api";
import PricebookPageClient from "../../pricebook-page-client";

interface PricebookViewPageProps {
  params: Promise<{ slug: string }>;
}

/**
 * Pricebook View Page - Path-Based View URL
 *
 * SSoT URL Pattern: /pricebook/view/by_category (path-based, human-readable)
 *
 * This is the preferred URL format per component-registry.ts URL PATTERNS standard.
 * Legacy ?view=slug URLs are redirected here by the parent page.
 *
 * @example /pricebook/view/by_category → View grouped by category
 * @example /pricebook/view/all → Default flat view
 */
export default async function PricebookViewPage({ params }: PricebookViewPageProps) {
  const { slug } = await params;

  // Fetch with view applied on server for fast LCP + no CLS
  const { columns, records, hasMore, totalCount, view, views, groupCounts } = await fetchFoundationForSSR("pricebook-items", {
    limit: 20,
    viewSlug: slug,
  });

  return (
    <PricebookPageClient
      initialColumns={columns}
      initialRecords={records}
      initialHasMore={hasMore}
      initialTotalCount={totalCount}
      initialView={view}
      initialViews={views}
      initialGroupCounts={groupCounts}
    />
  );
}
