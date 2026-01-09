import { fetchFoundationForSSR, type ViewData } from "@/lib/server/foundation-api";
import ContactsPageClient from "./contacts-page-client";

interface ContactsPageProps {
  searchParams: Promise<{ view?: string }>;
}

/**
 * Contacts Page - SSR Optimized for Fast LCP
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
export default async function ContactsPage({ searchParams }: ContactsPageProps) {
  // Await searchParams (Next.js 15 requirement)
  const params = await searchParams;
  const viewSlug = params.view;

  // Fetch first 20 records on server for fast LCP
  // Also fetch view config if ?view= param is present to eliminate flash
  // Also fetch group counts if view has grouping to eliminate CLS
  // Also fetch all views for immediate toolbar button rendering
  const { columns, records, hasMore, totalCount, view, views, groupCounts } = await fetchFoundationForSSR("contacts", {
    limit: 20,
    viewSlug,
  });

  return (
    <ContactsPageClient
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
