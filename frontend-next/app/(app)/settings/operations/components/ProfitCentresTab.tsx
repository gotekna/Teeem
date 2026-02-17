"use client";

import TeeemTableView from "@/components/table/TeeemTableView";
import { FOUNDATION_SLUGS } from "@/lib/constants/foundation-slugs";

/**
 * ProfitCentresTab - Global profit centre templates management
 *
 * SSoT: This is THE ONE location for managing global profit centre templates.
 * Filtered to templates only (is_template: true, job_id: null).
 * Job-specific profit centres (variations) are managed on the job detail page.
 *
 * Part of Settings > Operations.
 */
export function ProfitCentresTab() {
  return (
    <div className="flex flex-col h-full -mx-4">
      <TeeemTableView
        foundationId={FOUNDATION_SLUGS.PROFIT_CENTRES}
        autoFetchRecords={true}
        initialFilters={[
          { id: "template-filter", column: "is_template", operator: "=", value: "true" },
        ]}
      />
    </div>
  );
}
