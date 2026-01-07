import { redirect } from "next/navigation";

interface ContactsViewPageProps {
  params: Promise<{ slug: string }>;
}

/**
 * Contacts View Page - REDIRECT to Query Param URL
 *
 * Legacy URLs like /contacts/view/company_role are redirected to /contacts?view=company_role
 * This enables client-side view switching without full page reloads.
 *
 * ULTRA FIX: Changed from SSR page to redirect for instant view switching.
 * The main /contacts page handles all views via query params now.
 */
export default async function ContactsViewPage({ params }: ContactsViewPageProps) {
  const { slug } = await params;

  // Redirect legacy path-based URLs to query param format
  // /contacts/view/company_role → /contacts?view=company_role
  redirect(`/contacts?view=${slug}`);
}
