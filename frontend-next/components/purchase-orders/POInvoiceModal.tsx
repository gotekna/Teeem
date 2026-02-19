"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { Badge } from "@/components/ui/badge";
import { Receipt } from "lucide-react";
import { api } from "@/lib/api";
import { BillsInvoiceViewer, type BillDetail } from "@/components/invoice/BillsInvoiceViewer";
import { POSummaryView } from "@/components/purchase-orders/POSummaryView";
import { usePOInvoiceModal } from "@/hooks/use-po-invoice-modal";

export function POInvoiceModal() {
  const router = useRouter();
  const { isOpen, poId, poNumber, close } = usePOInvoiceModal();

  const [bills, setBills] = useState<BillDetail[]>([]);
  const [selectedBill, setSelectedBill] = useState<BillDetail | null>(null);
  const [loading, setLoading] = useState(false);
  // Only show Dialog AFTER we confirm bills exist (prevents flash)
  const [hasBills, setHasBills] = useState(false);

  const fetchBills = useCallback(async (id: string | number) => {
    setLoading(true);
    setHasBills(false);
    try {
      const response = await api.get<{ bills: BillDetail[]; total_count: number }>(
        `/api/v1/purchase_orders/${id}/bills`
      );
      if (response) {
        const fetchedBills = response.bills || [];
        if (fetchedBills.length === 0) {
          // No invoices — navigate to full PO editor instead
          const slug = String(id).replace("PO-", "");
          close();
          router.push(`/purchase_orders/${slug}`);
          return;
        }
        setBills(fetchedBills);
        setSelectedBill(fetchedBills[0] || null);
        setHasBills(true);
      }
    } catch (err) {
      console.error("Failed to load bills for PO:", err);
      // On error, also navigate to PO editor as fallback
      const slug = String(id).replace("PO-", "");
      close();
      router.push(`/purchase_orders/${slug}`);
      return;
    } finally {
      setLoading(false);
    }
  }, [close, router]);

  // Fetch bills when modal opens with a new PO
  useEffect(() => {
    if (isOpen && poId) {
      fetchBills(poId);
    } else {
      setBills([]);
      setSelectedBill(null);
      setHasBills(false);
    }
  }, [isOpen, poId, fetchBills]);

  const displayTitle = poNumber ? `${poNumber} vs Invoice` : "PO vs Invoice";

  return (
    <Dialog open={isOpen && hasBills} onOpenChange={(open) => { if (!open) close(); }}>
      <DialogContent className="max-w-[95vw] max-h-[90vh] h-[90vh] p-0 gap-0 flex flex-col">
        {/* Header */}
        <DialogHeader className="px-4 py-3 border-b shrink-0">
          <DialogTitle className="flex items-center gap-2 text-base">
            <Receipt className="h-4 w-4" />
            {displayTitle}
            {bills.length > 0 && (
              <Badge variant="secondary" className="text-xs">
                {bills.length} bill{bills.length !== 1 ? "s" : ""}
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        {/* Split Pane */}
        <div className="flex flex-1 min-h-0 overflow-hidden">
          {/* Left: PO Summary */}
          <div className="w-1/2 border-r overflow-hidden flex flex-col">
            {poId ? (
              <POSummaryView poId={poId} />
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                No purchase order selected
              </div>
            )}
          </div>

          {/* Right: Invoice / Bill Viewer */}
          <div className="w-1/2 overflow-hidden flex flex-col">
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <Spinner />
              </div>
            ) : (
              <BillsInvoiceViewer
                bill={selectedBill}
                bills={bills}
                onBillSelect={setSelectedBill}
                onRefresh={() => poId && fetchBills(poId)}
                height="100%"
              />
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
