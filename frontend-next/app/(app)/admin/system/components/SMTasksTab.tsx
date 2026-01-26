"use client";

import TeeemTableView from "@/components/table/TeeemTableView";
import { FOUNDATION_SLUGS } from "@/lib/constants/foundation-slugs";

/**
 * SM Tasks Admin Tab
 *
 * Shows ALL SmTask records (both job-linked and standalone) in one table.
 * This is an admin/debug view. Normal users should use:
 * - /tasks (Task Hub) for standalone tasks
 * - Job pages for job-linked tasks
 */
export function SMTasksTab() {
  return (
    <div className="flex flex-col h-full -mx-4">
      <TeeemTableView
        foundationId={FOUNDATION_SLUGS.SM_TASKS}
        autoFetchRecords={true}
      />
    </div>
  );
}
