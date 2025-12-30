import { fetchFoundationForSSR } from "@/lib/server/foundation-api";
import PricebookPageClient from "./pricebook-page-client";

/**
 * Pricebook Page - SSR Optimized for Fast LCP
 *
 * This Server Component fetches data before sending HTML to the client.
 * The table renders immediately with 20 rows, achieving ~500ms LCP.
 * Additional records load in the background after hydration.
 */
export default async function PricebookPage() {
  // Fetch first 20 records on server for fast LCP
  const { columns, records, hasMore } = await fetchFoundationForSSR("pricebook-items", {
    limit: 20,
  });

  return (
    <PricebookPageClient
      initialColumns={columns}
      initialRecords={records}
      initialHasMore={hasMore}
    />
  );
}
