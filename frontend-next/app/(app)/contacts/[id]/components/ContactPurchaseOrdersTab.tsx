"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { FileText } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { api } from "@/lib/api";
import TeeemTableView from "@/components/table/TeeemTableView";
import type { TableColumn, TableRow } from "@/components/table/types";
import type { Contact } from "../types";

// =============================================================================
// SSoT: Purchase Orders Tab (ROOT level)
// =============================================================================
// Shows all purchase orders for this supplier contact.
// Visible when contact is_supplier? = true (visibility_rule: is_supplier)
// =============================================================================

interface PurchaseOrder {
  id: number;
  purchase_order_number: string;
  status: string;
  total: number | null;
  sub_total: number | null;
  required_date: string | null;
  ordered_date: string | null;
  description: string | null;
  job?: {
    id: number;
    title: string;
    job_code: string;
  } | null;
  supplier?: {
    id: number;
    display_name: string;
  } | null;
}

interface PurchaseOrdersResponse {
  purchase_orders: PurchaseOrder[];
  pagination: {
    current_page: number;
    total_pages: number;
    total_count: number;
    per_page: number;
  };
}

interface ContactPurchaseOrdersTabProps {
  contact: Contact;
}

export function ContactPurchaseOrdersTab({ contact }: ContactPurchaseOrdersTabProps) {
  const router = useRouter();
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    loadPurchaseOrders();
  }, [contact.id]);

  const loadPurchaseOrders = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get<PurchaseOrdersResponse>(
        `/api/v1/purchase_orders?supplier_id=${contact.id}&per_page=100`
      );

      if (response?.purchase_orders) {
        setPurchaseOrders(response.purchase_orders);
        setTotal(response.pagination?.total_count || response.purchase_orders.length);
      }
    } catch (err) {
      console.error("Failed to load purchase orders:", err);
      setError(err instanceof Error ? err.message : "Failed to load purchase orders");
    } finally {
      setLoading(false);
    }
  };

  // Define columns for TeeemTableView
  const columns: TableColumn[] = useMemo(() => [
    { key: "purchase_order_number", label: "PO #", width: 120, sortable: true },
    { key: "job_title", label: "Job", width: 250, sortable: true },
    { key: "description", label: "Description", width: 200, sortable: true },
    { key: "status", label: "Status", width: 100, sortable: true, column_type: "badge" },
    { key: "required_date", label: "Required", width: 110, sortable: true, column_type: "date" },
    { key: "ordered_date", label: "Ordered", width: 110, sortable: true, column_type: "date" },
    { key: "total", label: "Total", width: 120, sortable: true, column_type: "currency", showSum: true, sumType: "currency" },
  ], []);

  // Transform to rows
  const rows: TableRow[] = useMemo(() => {
    return purchaseOrders.map((po) => ({
      id: po.id,
      purchase_order_number: po.purchase_order_number,
      job_id: po.job?.id,
      job_title: po.job ? `${po.job.job_code} - ${po.job.title}` : null,
      description: po.description,
      status: po.status?.toUpperCase(),
      required_date: po.required_date,
      ordered_date: po.ordered_date,
      total: po.total,
    }));
  }, [purchaseOrders]);

  const handleRowClick = (row: TableRow) => {
    if (row.id) {
      router.push(`/purchase-orders/${row.id}`);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner size={32} className="text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Purchase Orders
          </span>
          {total > 0 && (
            <Badge variant="secondary">{total}</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {purchaseOrders.length > 0 ? (
          <div className="-mx-6">
            <TeeemTableView
              entries={rows}
              columns={columns}
              tableName="Purchase Orders"
              onRowClick={handleRowClick}
              viewOnly={true}
              enableExport={true}
            />
          </div>
        ) : (
          <p className="text-muted-foreground text-center py-8">
            No purchase orders for this supplier.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export default ContactPurchaseOrdersTab;
