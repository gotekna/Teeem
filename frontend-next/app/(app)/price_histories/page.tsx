"use client";

import TeeemTableView from "@/components/table/TeeemTableView";
import { TablePage } from "@/components/ui/page-wrappers";
import { BackButton } from "@/components/ui/back-button";

export default function PriceHistoriesPage() {
  return (
    <TablePage>
      <TeeemTableView
        foundationId="price-histories"
        autoFetchRecords={true}
        tableName="Price Histories"
        leftActions={<BackButton fallbackHref="/dashboard" />}
        hideFooter={true}
      />
    </TablePage>
  );
}
