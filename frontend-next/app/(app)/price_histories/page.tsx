"use client";

import { useState, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import TeeemTableView from "@/components/table/TeeemTableView";
import { useFoundationBySlug } from "@/hooks/useFoundationBySlug";
import { TablePage } from "@/components/ui/page-wrappers";
import { History, Download, Upload } from "lucide-react";
import { api } from "@/lib/api";
import type { TableRow } from "@/components/table/types";

export default function PriceHistoriesPage() {
  // Use foundation hook for TeeemTableView with server-side stats
  const { foundation, columns, records, originalRecords, totalCount, isLoading, refresh, serverSearch, isSearching } = useFoundationBySlug("price_histories");

  // Handle row update
  const handleRowUpdate = useCallback(async (rowId: number | string, field: string, value: unknown) => {
    try {
      await api.patch(`/api/v1/foundations/price_histories/records/${rowId}`, {
        record: { [field]: value }
      });
      refresh();
    } catch (error) {
      console.error("Failed to update price history:", error);
      throw error;
    }
  }, [refresh]);

  // Calculate stats
  const stats = useMemo(() => {
    const total = totalCount ?? originalRecords.length;
    const priceIncreases = originalRecords.filter((r) => {
      const oldPrice = r.old_price ? parseFloat(String(r.old_price)) : 0;
      const newPrice = r.new_price ? parseFloat(String(r.new_price)) : 0;
      return newPrice > oldPrice;
    }).length;
    const priceDecreases = originalRecords.filter((r) => {
      const oldPrice = r.old_price ? parseFloat(String(r.old_price)) : 0;
      const newPrice = r.new_price ? parseFloat(String(r.new_price)) : 0;
      return newPrice < oldPrice;
    }).length;

    return { total, priceIncreases, priceDecreases };
  }, [originalRecords, totalCount]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Spinner />
      </div>
    );
  }

  if (!foundation) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-muted-foreground">Foundation not found</p>
      </div>
    );
  }

  return (
    <TablePage>
      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3 px-4 mb-4 shrink-0">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Total Changes
                </p>
                <p className="text-2xl font-bold">{stats.total.toLocaleString()}</p>
              </div>
              <History className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Price Increases
                </p>
                <p className="text-2xl font-bold text-green-600">
                  {stats.priceIncreases.toLocaleString()}
                </p>
              </div>
              <div className="h-8 w-8 rounded-full bg-green-100 dark:bg-green-900/20 flex items-center justify-center">
                <span className="text-green-600 font-bold">↑</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Price Decreases
                </p>
                <p className="text-2xl font-bold text-red-600">
                  {stats.priceDecreases.toLocaleString()}
                </p>
              </div>
              <div className="h-8 w-8 rounded-full bg-red-100 dark:bg-red-900/20 flex items-center justify-center">
                <span className="text-red-600 font-bold">↓</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <TeeemTableView
            foundationId={String(foundation.id)}
            foundationIdNumeric={foundation.id}
            tableName={foundation.name || "Price Histories"}
            entries={records}
            // columns prop removed - TeeemTableView auto-fetches from Foundation API (SSoT)
            onRowUpdate={handleRowUpdate}
            onRefresh={refresh}
            onServerSearch={serverSearch}
            serverSearchLoading={isSearching}
        hideFooter={true}
      />
    </TablePage>
  );
}
