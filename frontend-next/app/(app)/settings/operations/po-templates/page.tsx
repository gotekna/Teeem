"use client";

import { BackButton } from "@/components/ui/back-button";
import { PoTemplatesTab } from "@/app/(app)/admin/system/components/PoTemplatesTab";
import { useSetLayoutMode } from "@/contexts/LayoutModeContext";

/**
 * Full-page PO Templates view.
 * Renders outside the Settings chrome for maximum vertical space.
 * BackButton returns to /settings/operations.
 */
export default function PoTemplatesPage() {
  useSetLayoutMode("full-height");

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-4 py-2 shrink-0 border-b">
        <BackButton fallbackHref="/settings/operations" />
        <h1 className="text-lg font-semibold">PO Templates</h1>
      </div>
      <div className="flex-1 min-h-0 px-4 py-3">
        <PoTemplatesTab />
      </div>
    </div>
  );
}
