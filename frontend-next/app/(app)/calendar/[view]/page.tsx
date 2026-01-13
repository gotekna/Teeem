import { redirect, notFound } from "next/navigation";
import CalendarPageClient from "../calendar-page-client";

interface CalendarViewPageProps {
  params: Promise<{ view: string }>;
}

const VALID_VIEWS = ["month", "week", "day", "schedule"];

/**
 * Calendar View Page - Path-Based View URL
 *
 * SSoT URL Pattern: /calendar/week (path-based, human-readable)
 *
 * @example /calendar/week → Week view
 * @example /calendar/day → Day view
 * @example /calendar/schedule → Schedule view
 */
export default async function CalendarViewPage({ params }: CalendarViewPageProps) {
  const { view } = await params;

  // Validate view is one of the allowed types
  if (!VALID_VIEWS.includes(view)) {
    notFound();
  }

  // Month is the default, redirect to clean URL
  if (view === "month") {
    redirect("/calendar");
  }

  return <CalendarPageClient viewSlug={view} />;
}
