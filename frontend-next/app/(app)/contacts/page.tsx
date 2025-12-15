import { Suspense } from "react";
import { fetchFoundationBySlug } from "@/lib/server/foundation-api";
import ContactsPageClient from "./ContactsPageClient";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Contacts Page - Server Component
 *
 * This is a React Server Component that fetches data on the server
 * before sending HTML to the client. This eliminates the white screen
 * flash that occurs with client-only data fetching.
 *
 * Data flow:
 * 1. Server fetches foundation + records (runs on every request)
 * 2. HTML is streamed to client with data already present
 * 3. Client component hydrates and handles interactivity
 */

// Force dynamic rendering (no static caching)
export const dynamic = 'force-dynamic';

// Loading skeleton for Suspense fallback
function ContactsTableSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header skeleton */}
      <div className="flex items-center justify-between">
        <div>
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-4 w-48 mt-2" />
        </div>
        <Skeleton className="h-10 w-32" />
      </div>

      {/* Stats skeleton */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="border rounded-lg p-6">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-8 w-12 mt-2" />
          </div>
        ))}
      </div>

      {/* Tabs skeleton */}
      <Skeleton className="h-10 w-96" />

      {/* Table skeleton */}
      <div className="border rounded-lg">
        <div className="p-4 border-b">
          <Skeleton className="h-10 w-64" />
        </div>
        <div className="p-4 space-y-3">
          {[...Array(10)].map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      </div>
    </div>
  );
}

export default async function ContactsPage() {
  console.log('🔴🔴🔴 ContactsPage SERVER COMPONENT RUNNING 🔴🔴🔴');
  // Fetch data on the server - this runs before any HTML is sent to client
  const { foundation, columns, records, totalCount, hasMore, error } = await fetchFoundationBySlug("contacts");
  console.log('🔴🔴🔴 ContactsPage SSR result:', { hasFoundation: !!foundation, recordCount: records?.length, hasMore, error });

  return (
    <Suspense fallback={<ContactsTableSkeleton />}>
      <ContactsPageClient
        initialFoundation={foundation}
        initialColumns={columns}
        initialRecords={records}
        initialTotalCount={totalCount}
        initialHasMore={hasMore}
        initialError={error}
      />
    </Suspense>
  );
}
