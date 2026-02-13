"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import TeeemTableView from "@/components/table/TeeemTableView";
import type { TableRow } from "@/components/table/types";
import { FOUNDATION_SLUGS } from "@/lib/constants/foundation-slugs";

interface JobPurchaseOrderLinesTabProps {
  jobId: string | number;
}

export function JobPurchaseOrderLinesTab({ jobId }: JobPurchaseOrderLinesTabProps) {
  const router = useRouter();

  // Double-click navigates to parent Purchase Order
  const handleRowDoubleClick = useCallback((row: TableRow) => {
    const poId = row.purchase_order_id as number | undefined;
    if (poId) {
      router.push(`/purchase_orders/${poId}`);
    }
  }, [router]);

  return (
    <TeeemTableView
      foundationId={FOUNDATION_SLUGS.PURCHASE_ORDER_LINE_ITEMS}
      autoFetchRecords={true}
      extraQueryParams={{ job_id: String(jobId) }}
      tableName="Purchase Order Lines"
      enableExport={true}
      onRowDoubleClick={handleRowDoubleClick}
      hideAddRecord={true}
      alwaysEditable={true}
    />
  );
}

export default JobPurchaseOrderLinesTab;
