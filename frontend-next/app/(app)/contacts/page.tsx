import { redirect } from "next/navigation";
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
 * URL Pattern: /contacts (default view) or /contacts/view/[slug] (specific view)
 * Legacy ?view=slug redirects to path-based URL for SSoT compliance.
 */
export default async function ContactsPage({ searchParams }: ContactsPageProps) {
  // Await searchParams (Next.js 15 requirement)
  const params = await searchParams;

  // SSoT URL Pattern: Redirect legacy ?view= to path-based URL
  if (params.view) {
    redirect(`/contacts/view/${params.view}`);
  }

  // Fetch first 20 records on server for fast LCP
  // Also fetch all views for immediate toolbar button rendering
  const { columns, records, hasMore, totalCount, view, views, groupCounts } = await fetchFoundationForSSR("contacts", {
    limit: 20,
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
