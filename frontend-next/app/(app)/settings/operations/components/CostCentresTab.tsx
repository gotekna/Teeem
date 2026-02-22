"use client";

import TeeemTableView from "@/components/table/TeeemTableView";
import { FOUNDATION_SLUGS } from "@/lib/constants/foundation-slugs";

/**
 * CostCentresTab - Global cost centre management
 *
 * SSoT: This is THE ONE location for managing cost centres.
 * Previously nested under Schedule Master > Tables, now promoted to
 * a top-level Operations tab alongside Profit Centres.
 *
 * Part of Settings > Operations.
 */
export function CostCentresTab() {
  return (
    <div className="flex flex-col h-full -mx-4">
      <TeeemTableView
        foundationId={FOUNDATION_SLUGS.COST_CENTRES}
        autoFetchRecords={true}
      />
    </div>
  );
}
