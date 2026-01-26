"use client";

import { ScrollablePage } from "@/components/ui/page-wrappers";
import { DataWarehouseTab } from "@/app/(app)/admin/system/components/DataWarehouseTab";

export default function DataWarehousePage() {
  return (
    <ScrollablePage>
      <DataWarehouseTab />
    </ScrollablePage>
  );
}
