"use client";

import { BackButton } from "@/components/ui/back-button";
import { ScheduleMasterTab } from "@/app/(app)/admin/system/components/ScheduleMasterTab";
import { useSetLayoutMode } from "@/contexts/LayoutModeContext";

/**
 * Full-page Schedule Master view.
 * Renders outside the Settings chrome for maximum vertical space.
 * BackButton returns to /settings/operations.
 */
export default function ScheduleMasterPage() {
  useSetLayoutMode("full-height");

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-4 py-2 shrink-0 border-b">
        <BackButton fallbackHref="/settings/operations" />
        <h1 className="text-lg font-semibold">Schedule Master</h1>
      </div>
      <div className="flex-1 min-h-0">
        <ScheduleMasterTab basePath="/settings/operations/schedule-master" />
      </div>
    </div>
  );
}
