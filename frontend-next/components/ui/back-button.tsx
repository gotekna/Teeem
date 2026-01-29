"use client";

import { ArrowLeft } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import { cn } from "@/lib/utils";
import { Button } from "./button";

/**
 * BackButton - THE STANDARD back navigation component
 *
 * Priority order for navigation:
 * 1. ?returnTo= query param (allows deep linking)
 * 2. Browser history (if came from same origin)
 * 3. fallbackHref prop (explicit parent route)
 * 4. Computed parent from current URL
 *
 * Usage:
 * - Detail pages: <BackButton fallbackHref="/jobs" />
 * - List pages: Pass to TeeemTableView leftActions prop
 * - Create pages: <BackButton fallbackHref="/parent-list" />
 */

export interface BackButtonProps {
  /**
   * Explicit fallback URL when browser history is unavailable.
   * REQUIRED for detail pages - ensures predictable navigation.
   */
  fallbackHref?: string;

  /**
   * Optional text label next to the icon.
   * If provided, button shows icon + text.
   */
  label?: string;

  /**
   * Button size variant (matches Button component).
   * @default "icon"
   */
  size?: "sm" | "default" | "icon";

  /**
   * Button style variant (matches Button component).
   * @default "ghost"
   */
  variant?: "ghost" | "outline" | "secondary";

  /**
   * Additional CSS classes.
   */
  className?: string;
}

/**
 * Computes the parent route from a given pathname.
 * Falls back to /dashboard if at root level.
 *
 * Examples:
 * - /jobs/123 -> /jobs
 * - /jobs/123/colours -> /jobs/123
 * - /corporate/companies/456 -> /corporate
 * - /settings/integrations/xero -> /settings/integrations
 */
function getParentRoute(pathname: string): string {
  // Remove trailing slash if present
  const cleanPath = (pathname ?? "").replace(/\/$/, "");

  // Split into segments
  const segments = cleanPath.split("/").filter(Boolean);

  // If at root or only one level deep, go to dashboard
  if (segments.length <= 1) {
    return "/dashboard";
  }

  // Special case: numeric ID at end (detail page)
  const lastSegment = segments[segments.length - 1];
  const isNumericId = /^\d+$/.test(lastSegment);

  if (isNumericId) {
    // Go up one level (e.g., /jobs/123 -> /jobs)
    segments.pop();
  } else {
    // For named segments, also go up one level
    // (e.g., /jobs/123/colours -> /jobs/123)
    segments.pop();
  }

  return "/" + segments.join("/") || "/dashboard";
}

export function BackButton({
  fallbackHref,
  label,
  size = "icon",
  variant = "ghost",
  className,
}: BackButtonProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const handleBack = useCallback(() => {
    // Priority 1: Check for returnTo query param (highest priority - deep linking)
    const returnTo = searchParams.get("returnTo");
    if (returnTo) {
      router.push(returnTo);
      return;
    }

    // Priority 2: Use browser history if available
    // In Next.js App Router, most navigation is client-side so router.back() works
    // history.length > 2 means user has navigated within the app (1 = initial, 2 = first nav)
    const hasHistory = typeof window !== "undefined" && window.history.length > 2;
    if (hasHistory) {
      router.back();
      return;
    }

    // Priority 3: Use explicit fallback (for direct URL entry / no history)
    if (fallbackHref) {
      router.push(fallbackHref);
      return;
    }

    // Priority 4: Compute parent route from current path
    const parentRoute =
      typeof window !== "undefined"
        ? getParentRoute(window.location.pathname)
        : "/dashboard";
    router.push(parentRoute);
  }, [router, searchParams, fallbackHref]);

  // Determine if we should show a label
  const hasLabel = !!label;
  const buttonSize = hasLabel ? "default" : size;

  return (
    <Button
      variant={variant}
      size={buttonSize}
      onClick={handleBack}
      className={cn(
        "shrink-0",
        hasLabel && "gap-2",
        className
      )}
      title="Go back"
      aria-label={label || "Go back"}
    >
      <ArrowLeft className="h-4 w-4" />
      {label && <span>{label}</span>}
    </Button>
  );
}

// Re-export for convenience
export { getParentRoute };
