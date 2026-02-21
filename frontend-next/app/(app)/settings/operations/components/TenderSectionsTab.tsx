"use client";

import * as React from "react";
import TeeemTableView from "@/components/table/TeeemTableView";
import { FOUNDATION_SLUGS } from "@/lib/constants/foundation-slugs";

/**
 * TenderSectionsTab - Manage tender sections for grouping PO items in tender documents.
 *
 * SSoT: This is THE ONE location for managing tender section definitions.
 * Sections (records with parent_id set) are children of Tender Headers.
 *
 * Linking sections to PO tasks is done via Schedule Master:
 * SM Schedule Master has a "Tender Section" lookup column (tender_id),
 * same pattern as Cost Centres.
 *
 * Headers are managed separately in TenderHeadersTab.
 * Part of Settings > Operations.
 */
export function TenderSectionsTab() {
  return (
    <div className="flex flex-col h-full -mx-4">
      <TeeemTableView
        foundationId={FOUNDATION_SLUGS.TENDERS}
        autoFetchRecords={true}
        initialFilters={[
          {
            id: "section-filter",
            column: "parent_id",
            operator: "is_not_empty",
            value: null,
            locked: true,
          },
        ]}
      />
    </div>
  );
}
