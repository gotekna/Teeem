"use client";

import { TablePage } from "@/components/ui/page-wrappers";
import { AlertTriangle } from "lucide-react";

/**
 * Missing Items Page
 *
 * This page is intended for tracking missing documents, items, or records
 * that need follow-up. Currently a placeholder while the feature is being built.
 */
export default function MissingPage() {
  return (
    <TablePage>
      <div className="flex flex-col items-center justify-center h-full gap-4 text-muted-foreground">
        <AlertTriangle className="h-12 w-12" />
        <h1 className="text-xl font-semibold">Missing Items</h1>
        <p className="text-sm max-w-md text-center">
          This feature is coming soon. It will help you track and manage missing
          documents, records, and items that need follow-up.
        </p>
      </div>
    </TablePage>
  );
}
