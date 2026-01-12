"use client";

/**
 * Schedule Master Page
 *
 * Direct access to Schedule Master without Settings wrapper.
 * Nav item points here for cleaner UX.
 */

import { ScheduleMasterTab } from "@/app/(app)/admin/system/components/ScheduleMasterTab";

export default function ScheduleMasterPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight font-serif">Schedule Master</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Configure schedule templates, tasks, and workflows
        </p>
      </div>
      <ScheduleMasterTab />
    </div>
  );
}
