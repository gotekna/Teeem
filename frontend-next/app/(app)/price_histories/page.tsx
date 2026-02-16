"use client";

import TeeemTableView from "@/components/table/TeeemTableView";
import { TablePage } from "@/components/ui/page-wrappers";
import { BackButton } from "@/components/ui/back-button";
import { FOUNDATION_SLUGS } from "@/lib/constants/foundation-slugs";

export default function PriceHistoriesPage() {
  return (
    <TablePage>
      <TeeemTableView
        foundationId={FOUNDATION_SLUGS.PRICE_HISTORIES}
        autoFetchRecords={true}
        tableName="Price Histories"
        leftActions={<BackButton fallbackHref="/dashboard" />}
        hideFooter={true}
      />
    </TablePage>
  );
}
