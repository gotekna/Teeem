"use client";

import TeeemTableView from "@/components/table/TeeemTableView";
import { FOUNDATION_SLUGS } from "@/lib/constants/foundation-slugs";

interface JobQuoteTrackerTabProps {
  jobId: string | number;
}

/**
 * JobQuoteTrackerTab - Track supplier quotes for a job
 *
 * SSoT: Foundation = 'quote-tracker'
 * Location: PreCon > Quote Tracker tab
 *
 * This is for internal tracking of quotes received from suppliers.
 * Note: Different from QuoteRequest which is for sending RFQs.
 */
export function JobQuoteTrackerTab({ jobId }: JobQuoteTrackerTabProps) {
  return (
    <div className="flex flex-col h-full -mx-4">
      <TeeemTableView
        foundationId={FOUNDATION_SLUGS.QUOTE_TRACKER}
        autoFetchRecords={true}
        initialFilters={[
          {
            id: "job-filter",
            column: "job_id",
            operator: "=",
            value: String(jobId),
          },
        ]}
        tableName="Quote Tracker"
      />
    </div>
  );
}

export default JobQuoteTrackerTab;
