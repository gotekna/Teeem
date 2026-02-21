"use client";

import * as React from "react";
import TeeemTableView from "@/components/table/TeeemTableView";
import { FOUNDATION_SLUGS } from "@/lib/constants/foundation-slugs";

/**
 * TenderHeadersTab - Manage tender headers (top-level groupings).
 *
 * Headers are tender records with parent_id = NULL.
 * They group tender sections into two-level hierarchy for tender documents
 * (e.g., "Site Costs" header contains "Site Preparation", "Piering to Slab", etc.)
 *
 * SSoT: This tab manages headers only. Sections are managed in TenderSectionsTab.
 * Part of Settings > Operations.
 */
export function TenderHeadersTab() {
  return (
    <div className="flex flex-col h-full -mx-4">
      <TeeemTableView
        foundationId={FOUNDATION_SLUGS.TENDERS}
        autoFetchRecords={true}
        initialFilters={[
          {
            id: "header-filter",
            column: "parent_id",
            operator: "is_empty",
            value: null,
            locked: true,
          },
        ]}
      />
    </div>
  );
}
