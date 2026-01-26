import { redirect } from "next/navigation";
import CalendarPageClient from "./calendar-page-client";

interface CalendarPageProps {
  searchParams: Promise<{ view?: string; date?: string }>;
}

/**
 * Calendar Page - Default Month View
 *
 * URL Pattern (Path-Based):
 *   /calendar         → month view (default)
 *   /calendar/week    → week view
 *   /calendar/day     → day view
 *   /calendar/schedule → schedule view
 *
 * Legacy ?view=slug redirects to path-based URL for SSoT compliance.
 */
export default async function CalendarPage({ searchParams }: CalendarPageProps) {
  const params = await searchParams;

  // SSoT URL Pattern: Redirect legacy ?view= to path-based URL
  if (params.view) {
    redirect(`/calendar/${params.view}`);
  }

  // Default to month view
  return <CalendarPageClient />;
}
