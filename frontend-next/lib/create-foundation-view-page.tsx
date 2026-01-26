import { fetchFoundationForSSR, type ViewData, type SSRGroupCounts } from "@/lib/server/foundation-api";
import type { TableRow, TableColumn } from "@/components/table/types";

/**
 * SSoT: Standard props interface for all Foundation page client components
 *
 * All Foundation-backed pages (Jobs, Contacts, PurchaseOrders, etc.) should
 * accept these props to enable SSR with view support.
 */
export interface FoundationPageClientProps {
  initialColumns: TableColumn[];
  initialRecords: TableRow[];
  initialHasMore: boolean;
  initialView?: ViewData | null;
  initialViews?: ViewData[];
  // Optional: some pages may use additional props
  initialGroupCounts?: SSRGroupCounts | null;
  initialTotalCount?: number | null;
  viewSlug?: string;
}

/**
 * SSoT: Factory for creating Foundation view pages
 *
 * Instead of duplicating the same pattern across every Foundation:
 * - jobs/view/[slug]/page.tsx
 * - contacts/view/[slug]/page.tsx
 * - purchase_orders/view/[slug]/page.tsx
 * - ... etc
 *
 * Each page becomes a 3-line file using this factory.
 *
 * @example
 * ```tsx
 * // app/(app)/jobs/view/[slug]/page.tsx
 * import { createFoundationViewPage } from "@/lib/create-foundation-view-page";
 * import JobsPageClient from "../../jobs-page-client";
 * export default createFoundationViewPage("jobs", JobsPageClient);
 * ```
 *
 * Benefits:
 * - SSoT: Pattern defined once, used everywhere
 * - Type-safe: Client component must accept FoundationPageClientProps
 * - Maintainable: Change the pattern in one place
 * - Future-proof: Easy to add new Foundation pages
 */
export function createFoundationViewPage<
  TProps extends FoundationPageClientProps = FoundationPageClientProps
>(
  foundationSlug: string,
  ClientComponent: React.ComponentType<TProps>,
  options?: {
    /** Include group counts in SSR fetch (for grouped views) */
    includeGroupCounts?: boolean;
    /** Custom limit for initial fetch (default: 20) */
    limit?: number;
  }
) {
  const { includeGroupCounts = false, limit = 20 } = options || {};

  /**
   * Generated Server Component for /foundation/view/[slug]
   *
   * Fetches foundation data with view applied on server for fast LCP.
   * No client-side fetching needed - table renders immediately.
   */
  return async function FoundationViewPage({
    params,
  }: {
    params: Promise<{ slug: string }>;
  }) {
    const { slug } = await params;

    // Fetch with view applied on server for fast LCP + no CLS
    const result = await fetchFoundationForSSR(foundationSlug, {
      limit,
      viewSlug: slug,
    });

    // Build props for client component
    const clientProps: FoundationPageClientProps = {
      initialColumns: result.columns,
      initialRecords: result.records,
      initialHasMore: result.hasMore,
      initialView: result.view,
      initialViews: result.views,
      initialTotalCount: result.totalCount,
      viewSlug: slug,
    };

    // Include group counts if requested
    if (includeGroupCounts && result.groupCounts) {
      clientProps.initialGroupCounts = result.groupCounts;
    }

    return <ClientComponent {...(clientProps as TProps)} />;
  };
}

/**
 * SSoT: Factory for creating Foundation main pages with view redirect
 *
 * Creates the main page that:
 * 1. Redirects ?view=slug to path-based URL (SSoT pattern)
 * 2. Fetches initial data for fast LCP
 * 3. Renders the client component
 *
 * @example
 * ```tsx
 * // app/(app)/jobs/page.tsx
 * import { createFoundationMainPage } from "@/lib/create-foundation-view-page";
 * import JobsPageClient from "./jobs-page-client";
 * export default createFoundationMainPage("jobs", "/jobs", JobsPageClient);
 * ```
 */
export function createFoundationMainPage<
  TProps extends FoundationPageClientProps = FoundationPageClientProps
>(
  foundationSlug: string,
  basePath: string,
  ClientComponent: React.ComponentType<TProps>,
  options?: {
    includeGroupCounts?: boolean;
    limit?: number;
  }
) {
  const { includeGroupCounts = false, limit = 20 } = options || {};

  return async function FoundationMainPage({
    searchParams,
  }: {
    searchParams: Promise<{ view?: string }>;
  }) {
    // Dynamic import to avoid bundling redirect in client
    const { redirect } = await import("next/navigation");

    const params = await searchParams;

    // SSoT URL Pattern: Redirect legacy ?view= to path-based URL
    if (params.view) {
      redirect(`${basePath}/view/${params.view}`);
    }

    // Fetch initial data for fast LCP
    const result = await fetchFoundationForSSR(foundationSlug, { limit });

    const clientProps: FoundationPageClientProps = {
      initialColumns: result.columns,
      initialRecords: result.records,
      initialHasMore: result.hasMore,
      initialView: result.view,
      initialViews: result.views,
      initialTotalCount: result.totalCount,
    };

    if (includeGroupCounts && result.groupCounts) {
      clientProps.initialGroupCounts = result.groupCounts;
    }

    return <ClientComponent {...(clientProps as TProps)} />;
  };
}
