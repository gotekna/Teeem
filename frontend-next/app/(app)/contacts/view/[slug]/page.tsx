import { fetchFoundationForSSR } from "@/lib/server/foundation-api";
import ContactsPageClient from "../../contacts-page-client";

interface ContactsViewPageProps {
  params: Promise<{ slug: string }>;
}

/**
 * Contacts View Page - SSR Optimized
 *
 * Handles URLs like /contacts/view/company_role, /contacts/view/suppliers
 * The view slug determines which saved view configuration to apply.
 *
 * SSR fetches the view config and initial records so the page
 * renders immediately with the correct grouping/filters applied.
 */
export default async function ContactsViewPage({ params }: ContactsViewPageProps) {
  const { slug } = await params;

  // Fetch records with view configuration applied
  const { columns, records, hasMore, view, views, groupCounts } =
    await fetchFoundationForSSR("contacts", {
      limit: 20,
      viewSlug: slug,
    });

  return (
    <ContactsPageClient
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
