"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DollarSign,
  Building2,
  Calendar,
  FileText,
  ExternalLink,
  StickyNote,
} from "lucide-react";
import { api } from "@/lib/api";
import { formatCurrency } from "@/utils/formatters";
import { cn } from "@/lib/utils";
import {
  type PurchaseOrder,
  STATUS_BADGE_VARIANTS,
  STATUS_OPTIONS,
  getGstRate,
} from "@/lib/constants/purchase-order-constants";

interface POSummaryViewProps {
  poId: string | number;
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "-";
  return new Date(dateStr).toLocaleDateString("en-AU");
}

export function POSummaryView({ poId }: POSummaryViewProps) {
  const router = useRouter();
  const [po, setPo] = useState<PurchaseOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchPO() {
      setLoading(true);
      setError(null);
      try {
        const data = await api.get<PurchaseOrder>(`/api/v1/purchase_orders/${poId}`);
        if (!cancelled && data) {
          setPo(data);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load purchase order");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchPO();
    return () => { cancelled = true; };
  }, [poId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Spinner />
      </div>
    );
  }

  if (error || !po) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        <p>{error || "Purchase order not found"}</p>
      </div>
    );
  }

  const statusLabel = STATUS_OPTIONS.find(s => s.value === po.status)?.label || po.status;
  const statusClasses = STATUS_BADGE_VARIANTS[po.status] || STATUS_BADGE_VARIANTS.draft;

  // Calculate line item totals
  const activeLineItems = po.line_items?.filter(li => !li._destroy) || [];
  const subtotal = activeLineItems.reduce((sum, li) => sum + (li.quantity * li.unit_price), 0);
  const gst = activeLineItems.reduce((sum, li) => {
    const rate = getGstRate(li.gst_code);
    return sum + (li.quantity * li.unit_price * rate);
  }, 0);
  const total = subtotal + gst;

  const slug = po.purchase_order_number?.replace("PO-", "") || po.id;

  return (
    <div className="flex flex-col h-full overflow-y-auto p-4 space-y-4">
      {/* Header: PO Number + Status */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold">{po.purchase_order_number}</h2>
          <Badge className={cn("text-xs border", statusClasses)}>
            {statusLabel}
          </Badge>
        </div>
        {po.job && (
          <span className="text-sm text-muted-foreground truncate max-w-[200px]">
            {po.job.title}
          </span>
        )}
      </div>

      {/* Info Cards Row */}
      <div className="grid grid-cols-2 gap-3">
        {/* Total */}
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <DollarSign className="h-3.5 w-3.5" />
              <span className="text-xs font-medium">Total (inc GST)</span>
            </div>
            <p className="text-lg font-semibold">{formatCurrency(total)}</p>
          </CardContent>
        </Card>

        {/* Supplier */}
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Building2 className="h-3.5 w-3.5" />
              <span className="text-xs font-medium">Supplier</span>
            </div>
            <p className="text-sm font-medium truncate">
              {po.supplier?.display_name || "Not assigned"}
            </p>
          </CardContent>
        </Card>

        {/* Required Date */}
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Calendar className="h-3.5 w-3.5" />
              <span className="text-xs font-medium">Required Date</span>
            </div>
            <p className="text-sm font-medium">{formatDate(po.required_date)}</p>
          </CardContent>
        </Card>

        {/* Budget / Lock Status */}
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <FileText className="h-3.5 w-3.5" />
              <span className="text-xs font-medium">Budget</span>
            </div>
            <p className="text-sm font-medium">
              {po.budget ? formatCurrency(po.budget) : "-"}
              {po.budget_locked && (
                <span className="ml-1.5 text-xs text-amber-600 dark:text-amber-400">Locked</span>
              )}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Notes */}
      {po.description && (
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <StickyNote className="h-3.5 w-3.5" />
              <span className="text-xs font-medium">Notes</span>
            </div>
            <p className="text-sm text-foreground whitespace-pre-wrap">{po.description}</p>
          </CardContent>
        </Card>
      )}

      {/* Line Items Table */}
      <div className="flex-1 min-h-0">
        <h3 className="text-sm font-medium mb-2 text-muted-foreground">
          Line Items ({activeLineItems.length})
        </h3>
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="text-xs w-[100px]">Code</TableHead>
                <TableHead className="text-xs">Description</TableHead>
                <TableHead className="text-xs text-right w-[60px]">Qty</TableHead>
                <TableHead className="text-xs text-right w-[90px]">Price</TableHead>
                <TableHead className="text-xs text-right w-[60px]">Tax</TableHead>
                <TableHead className="text-xs text-right w-[90px]">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {activeLineItems.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-6 text-sm">
                    No line items
                  </TableCell>
                </TableRow>
              ) : (
                activeLineItems.map((li, idx) => {
                  const lineTotal = li.quantity * li.unit_price;
                  const lineGst = lineTotal * getGstRate(li.gst_code);
                  return (
                    <TableRow key={li.id || idx}>
                      <TableCell className="text-xs font-mono">
                        {li.pricebook_item?.item_code || "-"}
                      </TableCell>
                      <TableCell className="text-xs truncate max-w-[180px]">
                        {li.description}
                      </TableCell>
                      <TableCell className="text-xs text-right">{li.quantity}</TableCell>
                      <TableCell className="text-xs text-right">{formatCurrency(li.unit_price)}</TableCell>
                      <TableCell className="text-xs text-right">{li.gst_code || "GST"}</TableCell>
                      <TableCell className="text-xs text-right font-medium">
                        {formatCurrency(lineTotal + lineGst)}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        {/* Totals */}
        {activeLineItems.length > 0 && (
          <div className="mt-2 space-y-1 text-right pr-2">
            <div className="flex justify-end gap-8 text-xs text-muted-foreground">
              <span>Subtotal</span>
              <span className="w-[90px] text-right">{formatCurrency(subtotal)}</span>
            </div>
            <div className="flex justify-end gap-8 text-xs text-muted-foreground">
              <span>GST</span>
              <span className="w-[90px] text-right">{formatCurrency(gst)}</span>
            </div>
            <div className="flex justify-end gap-8 text-sm font-semibold border-t pt-1">
              <span>Total</span>
              <span className="w-[90px] text-right">{formatCurrency(total)}</span>
            </div>
          </div>
        )}
      </div>

      {/* Open Full Editor Button */}
      <Button
        variant="outline"
        className="w-full"
        onClick={() => router.push(`/purchase_orders/${slug}`)}
      >
        <ExternalLink className="h-4 w-4 mr-2" />
        Open Full Editor
      </Button>
    </div>
  );
}
