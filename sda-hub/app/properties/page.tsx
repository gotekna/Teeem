"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { PropertyCard } from "@/components/PropertyCard";
import { PropertyFilters } from "@/components/PropertyFilters";
import { Loader2, Home } from "lucide-react";
import { getListings, getFilters } from "@/lib/api";
import type { SdaListing, FiltersResponse } from "@/lib/types";

function PropertiesContent() {
  const searchParams = useSearchParams();
  const [listings, setListings] = useState<SdaListing[]>([]);
  const [filters, setFilters] = useState<FiltersResponse | null>(null);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const page = parseInt(searchParams.get("page") || "1", 10);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      searchParams.forEach((value, key) => {
        params[key] = value;
      });

      const [listingsRes, filtersRes] = await Promise.all([
        getListings(params),
        filters ? Promise.resolve(filters) : getFilters(),
      ]);

      setListings(listingsRes.listings);
      setTotal(listingsRes.pagination.total);
      setTotalPages(listingsRes.pagination.totalPages);
      if (!filters) setFilters(filtersRes);
    } catch {
      setListings([]);
    } finally {
      setLoading(false);
    }
  }, [searchParams, filters]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Page header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl dark:text-white">
            SDA Properties
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {loading ? "Loading..." : `${total} propert${total === 1 ? "y" : "ies"} available`}
          </p>
        </div>
        <PropertyFilters filters={filters} open={filtersOpen} onToggle={() => setFiltersOpen(!filtersOpen)} />
      </div>

      <div className="mt-6 flex flex-col gap-6 lg:flex-row">
        {/* Desktop filters sidebar */}
        <div className="hidden lg:block">
          <PropertyFilters filters={filters} open={true} onToggle={() => {}} />
        </div>

        {/* Results */}
        <div className="flex-1">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-brand-500" />
            </div>
          ) : listings.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 py-16 dark:border-gray-700">
              <Home className="h-12 w-12 text-gray-300 dark:text-gray-600" />
              <h3 className="mt-4 text-base font-semibold text-gray-900 dark:text-white">No properties found</h3>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Try adjusting your filters or check back later.
              </p>
            </div>
          ) : (
            <>
              <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
                {listings.map((listing) => (
                  <PropertyCard key={listing.slug} listing={listing} />
                ))}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="mt-8 flex items-center justify-center gap-2">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => {
                    const params = new URLSearchParams(searchParams.toString());
                    params.set("page", p.toString());
                    return (
                      <a
                        key={p}
                        href={`/properties?${params.toString()}`}
                        className={`inline-flex h-9 w-9 items-center justify-center rounded-lg text-sm font-medium transition-colors ${
                          p === page
                            ? "bg-brand-500 text-white"
                            : "text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
                        }`}
                        aria-current={p === page ? "page" : undefined}
                      >
                        {p}
                      </a>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function PropertiesPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center py-32">
        <Loader2 className="h-8 w-8 animate-spin text-brand-500" />
      </div>
    }>
      <PropertiesContent />
    </Suspense>
  );
}
