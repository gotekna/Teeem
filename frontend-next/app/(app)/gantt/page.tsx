"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * /gantt redirect page
 *
 * Redirects to the Schedule Master Gantt tab.
 * The Gantt chart is part of Schedule Master at /schedule-master/gantt.
 * For job-specific Gantt, use /jobs/[id]/schedule/gantt.
 */
export default function GanttRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/schedule-master/gantt");
  }, [router]);

  return (
    <div className="flex items-center justify-center h-full">
      <p className="text-muted-foreground">Redirecting to Schedule Master Gantt...</p>
    </div>
  );
}
