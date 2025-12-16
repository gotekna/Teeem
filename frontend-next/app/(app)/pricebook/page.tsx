"use client";

import { useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import TeeemTableView from "@/components/table/TeeemTableView";
import { useFoundationBySlug } from "@/hooks/useFoundationBySlug";
import { Plus, AlertTriangle } from "lucide-react";
import { api } from "@/lib/api";
import { slugifyPricebookCode } from "@/lib/url-utils";
import { PricebookDetailDrawer } from "@/components/pricebook/PricebookDetailDrawer";
import type { TableRow } from "@/components/table/types";

export default function PriceBookPage() {
  const router = useRouter();

  // Use foundation hook for TeeemTableView with server-side stats
  const { foundation, columns, records, originalRecords, totalCount, isLoading, refresh, serverSearch, isSearching } = useFoundationBySlug("pricebook");

  const [activeTab, setActiveTab] = useState("all");
  const [selectedItemId, setSelectedItemId] = useState<number | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Handle row double-click - open drawer
  const handleRowDoubleClick = useCallback((row: TableRow) => {
    setSelectedItemId(row.id as number);
    setDrawerOpen(true);
  }, []);

  // Handle row click - navigate to detail page
  const handleRowClick = useCallback((row: TableRow) => {
    console.log("[PricebookPage] Row clicked:", row);
    const item = row as { id: number; item_code?: string };
    console.log("[PricebookPage] item_code:", item.item_code, "id:", item.id);
    if (item.item_code) {
      const slug = slugifyPricebookCode(item.item_code);
      console.log("[PricebookPage] Navigating to:", `/pricebook/${slug}`);
      router.push(`/pricebook/${slug}`);
    } else {
      console.warn("[PricebookPage] No item_code found, falling back to ID:", item.id);
      router.push(`/pricebook/${item.id}`);
    }
  }, [router]);

  // Handle inline row update
  const handleRowUpdate = useCallback(async (rowId: number | string, field: string, value: unknown) => {
    try {
      await api.patch(`/api/v1/foundations/pricebook/records/${rowId}`, {
        record: { [field]: value }
      });
      refresh();
    } catch (error) {
      console.error("Failed to update pricebook item:", error);
      throw error;
    }
  }, [refresh]);

  // Calculate stats - use server totalCount if available, otherwise fall back to loaded records
  const stats = useMemo(() => {
    // If we have all records loaded, calculate detailed stats from them
    if (originalRecords.length >= (totalCount ?? 0)) {
      return {
        total: originalRecords.length,
        active: originalRecords.filter((i) => i.is_active).length,
        needsReview: originalRecords.filter((i) => i.needs_pricing_review).length,
        withImages: originalRecords.filter((i) => i.image_url).length,
        categoriesCount: new Set(originalRecords.map((i) => i.category).filter(Boolean)).size,
      };
    }

    // Otherwise use server total count and calculate from loaded subset
    return {
      total: totalCount ?? originalRecords.length,
      active: originalRecords.filter((i) => i.is_active).length,
      needsReview: originalRecords.filter((i) => i.needs_pricing_review).length,
      withImages: originalRecords.filter((i) => i.image_url).length,
      categoriesCount: new Set(originalRecords.map((i) => i.category).filter(Boolean)).size,
    };
  }, [originalRecords, totalCount]);

  // Filter records based on active tab
  const getFilteredRecords = () => {
    switch (activeTab) {
      case "needs-review":
        return records.filter((i) => i.needs_pricing_review);
      case "inactive":
        return records.filter((i) => !i.is_active);
      default:
        return records;
    }
  };

  // Handle add item - MUST be before early return to avoid hook count mismatch
  const handleAddItem = useCallback(() => {
    router.push('/pricebook/new');
  }, [router]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight font-serif">Price Book</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {stats.total.toLocaleString()} items across {stats.categoriesCount} categories
          </p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="all">All Items</TabsTrigger>
          <TabsTrigger value="needs-review">
            Needs Review
            {stats.needsReview > 0 && (
              <Badge variant="secondary" className="ml-2">
                {stats.needsReview}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="inactive">Inactive</TabsTrigger>
        </TabsList>

        {/* Tab Content - Use TeeemTableView */}
        {["all", "needs-review", "inactive"].map((tabValue) => (
          <TabsContent key={tabValue} value={tabValue} className="mt-4">
            <TeeemTableView
              entries={getFilteredRecords()}
              columns={columns}
              foundationId="pricebook"
              foundationIdNumeric={foundation?.id}
              tableName={foundation?.name || "Pricebook"}
              enableExport={true}
              enableImport={true}
              onRefresh={refresh}
              onRowClick={handleRowClick}
              onRowDoubleClick={handleRowDoubleClick}
              onRowUpdate={handleRowUpdate}
              onServerSearch={serverSearch}
              serverSearchLoading={isSearching}
              leftActions={
                <Button variant="default" size="sm" onClick={handleAddItem}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Item
                </Button>
              }
            />
          </TabsContent>
        ))}
      </Tabs>

      {/* Pricebook Detail Drawer */}
      <PricebookDetailDrawer
        itemId={selectedItemId}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
      />
    </div>
  );
}
