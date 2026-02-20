"use client";

import TeeemTableView from "@/components/table/TeeemTableView";
import { FOUNDATION_SLUGS } from "@/lib/constants/foundation-slugs";

/**
 * TenderSectionsTab - Manage tender sections for grouping PO items in tender documents.
 *
 * SSoT: This is THE ONE location for managing tender section definitions.
 * Sections like "Base Price & Essential Inclusions", "Site Costs", etc.
 * are linked to SM Schedule Masters via a lookup column.
 *
 * Part of Settings > Operations.
 */
export function TenderSectionsTab() {
  return (
    <div className="flex flex-col h-full -mx-4">
      <TeeemTableView
        foundationId={FOUNDATION_SLUGS.TENDERS}
        autoFetchRecords={true}
      />
    </div>
  );
}
