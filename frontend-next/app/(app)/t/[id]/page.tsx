"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { api } from "@/lib/api";
import { Spinner } from "@/components/ui/spinner";
import { BackButton } from "@/components/ui/back-button";

/**
 * LEGACY route handler for /t/[id] URLs
 *
 * SSoT: This page does NOT use hardcoded Foundation IDs.
 * It fetches the foundation by ID from the API and redirects to the slug-based route.
 * If the foundation doesn't exist, it shows an error.
 */

interface FoundationResponse {
  success?: boolean;
  foundation?: {
    id: number;
    slug: string;
    name: string;
    database_table_name?: string;
  };
  id?: number;
  slug?: string;
  name?: string;
  database_table_name?: string;
}

export default function LegacyTablePage() {
  const router = useRouter();
  const params = useParams();
  const tableId = Number(params.id);

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function resolveAndRedirect() {
      if (!tableId || isNaN(tableId)) {
        setError("Invalid table ID");
        setLoading(false);
        return;
      }

      try {
        // Fetch foundation from API to get its slug
        const response = await api.get<FoundationResponse>(`/api/v1/foundations/${tableId}`);
        const foundation = response.foundation || response;

        if (!foundation || !foundation.slug) {
          setError(`Table ${tableId} not found. This table ID may not exist in this environment.`);
          setLoading(false);
          return;
        }

        // Redirect to the slug-based route
        // Use database_table_name if available, otherwise slug
        const routeSlug = foundation.database_table_name || foundation.slug;
        router.replace(`/${routeSlug}`);
      } catch (err) {
        console.error("Failed to resolve table ID:", err);
        setError(`Table ${tableId} not found. Foundation IDs differ between environments - use slug-based URLs instead.`);
        setLoading(false);
      }
    }

    resolveAndRedirect();
  }, [tableId, router]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <Spinner />
        <p className="text-muted-foreground">Redirecting to table...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <p className="text-destructive font-medium">Legacy URL Error</p>
        <p className="text-muted-foreground text-center max-w-md">{error}</p>
        <p className="text-sm text-muted-foreground">
          Tip: Use slug-based URLs like /jobs, /contacts, /pricebook instead of /t/204
        </p>
        <BackButton fallbackHref="/" label="Go Home" variant="outline" />
      </div>
    );
  }

  return null;
}
