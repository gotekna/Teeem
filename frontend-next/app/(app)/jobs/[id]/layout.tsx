"use client";

import { useSetLayoutMode } from "@/contexts/LayoutModeContext";

/**
 * Job Detail Layout
 *
 * Sets the layout mode to "full-height" at the route level.
 * This prevents the double flash that occurred when useSetLayoutMode
 * was called in page.tsx (which ran on every render).
 *
 * By setting it here in the layout, it only runs once when entering
 * the /jobs/[id] route segment.
 */
export default function JobDetailLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  useSetLayoutMode("full-height");
  return <>{children}</>;
}
