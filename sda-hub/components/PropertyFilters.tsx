"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useRef } from "react";
import { Search, X, SlidersHorizontal } from "lucide-react";
import { SDA_CATEGORY_LABELS, BUILDING_TYPE_LABELS } from "@/lib/types";
import type { FiltersResponse } from "@/lib/types";

interface PropertyFiltersProps {
  filters: FiltersResponse | null;
  open: boolean;
  onToggle: () => void;
}

export function PropertyFilters({ filters, open, onToggle }: PropertyFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const setFilter = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
      params.delete("page");
      router.push(`/properties?${params.toString()}`);
    },
    [router, searchParams]
  );

  const clearFilters = useCallback(() => {
    router.push("/properties");
  }, [router]);

  const hasFilters = searchParams.toString().length > 0;
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);

  return (
    <>
      {/* Mobile filter toggle */}
      <button
        type="button"
        onClick={onToggle}
        className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 lg:hidden dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
        aria-expanded={open}
      >
        <SlidersHorizontal className="h-4 w-4" />
        Filters
        {hasFilters && (
          <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-brand-500 text-[10px] font-bold text-white">
            {Array.from(searchParams.keys()).length}
          </span>
        )}
      </button>

      {/* Filter panel */}
      <aside
        className={`${
          open ? "block" : "hidden"
        } w-full shrink-0 lg:block lg:w-64`}
        role="complementary"
        aria-label="Property filters"
      >
        <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Filters</h2>
            {hasFilters && (
              <button
                onClick={clearFilters}
                className="inline-flex items-center gap-1 text-xs text-brand-500 hover:text-brand-600 dark:text-brand-400"
              >
                <X className="h-3 w-3" />
                Clear all
              </button>
            )}
          </div>

          <div className="mt-4 space-y-4">
            {/* Search suburb */}
            <div>
              <label htmlFor="filter-suburb" className="block text-xs font-medium text-gray-700 dark:text-gray-300">
                Suburb / Postcode
              </label>
              <div className="relative mt-1">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
                <input
                  id="filter-suburb"
                  type="text"
                  placeholder="Search..."
                  defaultValue={searchParams.get("suburb") || ""}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (debounceRef.current) clearTimeout(debounceRef.current);
                    debounceRef.current = setTimeout(() => setFilter("suburb", v), 400);
                  }}
                  className="w-full rounded-lg border border-gray-300 bg-white py-1.5 pl-8 pr-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:placeholder:text-gray-500"
                />
              </div>
            </div>

            {/* Listing type */}
            <FilterSelect
              label="Listing Type"
              id="filter-listing-type"
              value={searchParams.get("listingType") || ""}
              onChange={(v) => setFilter("listingType", v)}
              options={[
                { value: "", label: "All" },
                { value: "vacancy", label: "Vacancies" },
                { value: "for_sale", label: "For Sale" },
              ]}
            />

            {/* SDA Category */}
            <FilterSelect
              label="SDA Category"
              id="filter-category"
              value={searchParams.get("category") || ""}
              onChange={(v) => setFilter("category", v)}
              options={[
                { value: "", label: "All Categories" },
                ...(filters?.categories || []).map((c) => ({
                  value: c,
                  label: SDA_CATEGORY_LABELS[c] || c,
                })),
              ]}
            />

            {/* Building Type */}
            <FilterSelect
              label="Building Type"
              id="filter-building-type"
              value={searchParams.get("buildingType") || ""}
              onChange={(v) => setFilter("buildingType", v)}
              options={[
                { value: "", label: "All Types" },
                ...(filters?.buildingTypes || []).map((t) => ({
                  value: t,
                  label: BUILDING_TYPE_LABELS[t] || t,
                })),
              ]}
            />

            {/* Bedrooms */}
            <FilterSelect
              label="Bedrooms"
              id="filter-bedrooms"
              value={searchParams.get("bedrooms") || ""}
              onChange={(v) => setFilter("bedrooms", v)}
              options={[
                { value: "", label: "Any" },
                ...(filters?.bedroomOptions || []).map((b) => ({
                  value: b.toString(),
                  label: `${b} Bed${b !== 1 ? "s" : ""}`,
                })),
              ]}
            />

            {/* State */}
            <FilterSelect
              label="State"
              id="filter-state"
              value={searchParams.get("state") || ""}
              onChange={(v) => setFilter("state", v)}
              options={[
                { value: "", label: "All States" },
                ...(filters?.states || []).map((s) => ({
                  value: s,
                  label: s,
                })),
              ]}
            />
          </div>
        </div>
      </aside>
    </>
  );
}

function FilterSelect({
  label,
  id,
  value,
  onChange,
  options,
}: {
  label: string;
  id: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-xs font-medium text-gray-700 dark:text-gray-300">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}
