"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";

/**
 * Catch-all route for job detail tab URLs
 *
 * Handles path-based tab URLs like /jobs/48/overview and redirects
 * them to the main page with query params: /jobs/48?tab=overview
 *
 * Some tabs have their own dedicated pages (schedule, dashboard, etc.)
 * which are handled by their own route files. This catch-all handles
 * tabs that don't have dedicated pages (overview, contract, etc.)
 */
export default function JobTabRedirect() {
  const params = useParams();
  const router = useRouter();
  const jobId = params.id as string;
  const slug = params.slug as string[];

  useEffect(() => {
    // Build redirect URL with query params
    // /jobs/48/overview → /jobs/48?tab=overview
    // /jobs/48/contract/details → /jobs/48?tab=contract&subtab=details
    const tab = slug[0];
    const subtab = slug[1];

    let redirectUrl = `/jobs/${jobId}?tab=${tab}`;
    if (subtab) {
      redirectUrl += `&subtab=${subtab}`;
    }

    router.replace(redirectUrl);
  }, [jobId, slug, router]);

  // Show nothing while redirecting
  return null;
}
