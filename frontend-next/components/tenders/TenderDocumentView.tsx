"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/utils/formatters";

interface TenderDocumentItem {
  id: number;
  tender_section_name: string;
  tender_section_code: string | null;
  section_sort_order: number;
  section_type: string;
  line_number: number;
  description: string;
  quantity: number | null;
  unit: string | null;
  unit_price: number | null;
  total_amount: number | null;
  gst_code: string;
  item_type: string;
  notes: string | null;
  source_po_number: string | null;
  cost_centre_name: string | null;
  trade_name: string | null;
}

interface TenderDocumentData {
  id: number;
  document_number: string;
  version: number;
  status: string;
  date_prepared: string;
  valid_until: string | null;
  subtotal: number;
  gst: number;
  total: number;
  job_name: string | null;
  job_code: string | null;
  client_name: string | null;
  client_address: string | null;
  client_email: string | null;
  client_phone: string | null;
  salesperson_name: string | null;
  created_by_name: string | null;
  locked_by_name: string | null;
  locked_at: string | null;
  sent_at: string | null;
  accepted_at: string | null;
  declined_at: string | null;
  revision_notes: string | null;
  sections_grouped: Record<string, TenderDocumentItem[]>;
  section_subtotals: Record<string, number>;
}

interface TenderDocumentViewProps {
  document: TenderDocumentData;
}

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  locked: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  sent: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300",
  revision_requested: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300",
  accepted: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  declined: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
  superseded: "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-500",
};

export function TenderDocumentView({ document: doc }: TenderDocumentViewProps) {
  const sections = Object.entries(doc.sections_grouped || {});

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">
            {doc.document_number} - Version {doc.version}
          </h3>
          <p className="text-sm text-muted-foreground">
            Prepared {doc.date_prepared}
            {doc.valid_until && ` · Valid until ${doc.valid_until}`}
          </p>
        </div>
        <Badge className={STATUS_COLORS[doc.status] || ""}>
          {doc.status.replace(/_/g, " ")}
        </Badge>
      </div>

      {/* Client & Job Info */}
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Client</CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-1">
            <p className="font-medium">{doc.client_name || "—"}</p>
            {doc.client_address && <p className="text-muted-foreground">{doc.client_address}</p>}
            {doc.client_email && <p className="text-muted-foreground">{doc.client_email}</p>}
            {doc.client_phone && <p className="text-muted-foreground">{doc.client_phone}</p>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Job</CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-1">
            <p className="font-medium">{doc.job_name || "—"}</p>
            <p className="text-muted-foreground">{doc.job_code}</p>
            {doc.salesperson_name && (
              <p className="text-muted-foreground">Contact: {doc.salesperson_name}</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Sections */}
      {sections.map(([sectionName, items]) => (
        <Card key={sectionName}>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">{sectionName}</CardTitle>
              <span className="text-sm font-semibold">
                {formatCurrency(doc.section_subtotals?.[sectionName] || 0)}
              </span>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="py-2 w-10">#</th>
                    <th className="py-2">Description</th>
                    <th className="py-2 text-right w-20">Qty</th>
                    <th className="py-2 text-right w-28">Unit Price</th>
                    <th className="py-2 text-right w-28">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {(items || []).map((item) => (
                    <tr key={item.id} className="border-b border-border/50">
                      <td className="py-2 text-muted-foreground">{item.line_number}</td>
                      <td className="py-2">
                        {item.description}
                        {item.notes && (
                          <span className="block text-xs text-muted-foreground">{item.notes}</span>
                        )}
                        {item.source_po_number && (
                          <span className="block text-xs text-muted-foreground">
                            PO: {item.source_po_number}
                          </span>
                        )}
                      </td>
                      {item.item_type === "priced" || item.item_type === "provisional" ? (
                        <>
                          <td className="py-2 text-right">{item.quantity}</td>
                          <td className="py-2 text-right">{formatCurrency(item.unit_price || 0)}</td>
                          <td className="py-2 text-right font-medium">{formatCurrency(item.total_amount || 0)}</td>
                        </>
                      ) : (
                        <td colSpan={3} className="py-2 text-right text-muted-foreground italic">
                          {item.item_type === "included" ? "Included" : "—"}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      ))}

      {/* Totals */}
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-2 text-right">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal (excl. GST)</span>
              <span className="font-medium">{formatCurrency(doc.subtotal)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">GST</span>
              <span className="font-medium">{formatCurrency(doc.gst)}</span>
            </div>
            <div className="flex justify-between border-t pt-2">
              <span className="font-semibold text-lg">Total (incl. GST)</span>
              <span className="font-bold text-lg">{formatCurrency(doc.total)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Revision Notes */}
      {doc.revision_notes && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-orange-600 dark:text-orange-400">Revision Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">{doc.revision_notes}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export type { TenderDocumentData, TenderDocumentItem };
