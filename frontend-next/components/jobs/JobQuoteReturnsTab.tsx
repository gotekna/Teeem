"use client";

import { useState, useEffect, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Check,
  X,
  FileText,
  ClipboardCheck,
} from "lucide-react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { DATE_DISPLAY, DATETIME_DISPLAY } from "@/lib/constants/date-formats";
import { DocumentViewer } from "@/components/ui/document-viewer";
import { QuoteConfirmDialog } from "./quote-returns/QuoteConfirmDialog";
import { RecordResponseDialog, type ParentLineContext } from "./custom-quotes/RecordResponseDialog";
import { useSupplierDocumentUpload } from "./custom-quotes/useSupplierDocumentUpload";
import type {
  QuoteReturn,
  QuoteReturnsData,
  QuoteReturnStatus,
} from "./quote-returns/types";
import { STATUS_COLORS, STATUS_LABELS } from "./quote-returns/types";

interface JobQuoteReturnsTabProps {
  jobId: string | number;
}

const ACCEPTED_DROP_TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
]);

export default function JobQuoteReturnsTab({ jobId }: JobQuoteReturnsTabProps) {
  const [data, setData] = useState<QuoteReturnsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirmDialog, setConfirmDialog] = useState<QuoteReturn | null>(null);
  const [filter, setFilter] = useState<QuoteReturnStatus | "all">("all");
  const [dragOverRowId, setDragOverRowId] = useState<string | null>(null);
  const [recordResponseDialog, setRecordResponseDialog] = useState<{
    sourceId: number;
    supplierName: string;
    attachedDocument?: { warehouseDocumentId: number; filename: string } | null;
    parentLine?: ParentLineContext | null;
  } | null>(null);
  const [detailSheet, setDetailSheet] = useState<QuoteReturn | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailTender, setDetailTender] = useState<{
    requested: {
      description: string | null;
      budget: number | null;
      taskName: string | null;
      documentTypeNames?: string[];
      rfqInstructions: string | null;
    };
    quoted: {
      supplierName: string | null;
      price: number | null;
      quoteNumber: string | null;
      validTo: string | null;
      responseNotes: string | null;
      timeframe: string | null;
      documentId: number | null;
    };
  } | null>(null);
  const [detailDocUrls, setDetailDocUrls] = useState<{
    openUrl: string;
    downloadUrl: string;
    filename: string;
  } | null>(null);

  const { uploading, uploadForSupplier } = useSupplierDocumentUpload();

  const loadReturns = useCallback(async () => {
    try {
      const res = await api.get<{ success: boolean; data: QuoteReturnsData }>(
        `/api/v1/jobs/${jobId}/quote_returns`
      );
      setData(res?.data ?? null);
    } catch (err) {
      console.error("[JobQuoteReturnsTab] Failed to load:", err);
      toast.error("Failed to load quote returns");
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  useEffect(() => {
    loadReturns();
  }, [loadReturns]);

  const handleRowDoubleClick = useCallback(async (qr: QuoteReturn) => {
    setDetailSheet(qr);
    setDetailTender(null);
    setDetailDocUrls(null);
    setDetailLoading(true);

    try {
      // Fetch tender details and document URLs in parallel
      const promises: Promise<unknown>[] = [
        api.get<{ success: boolean; data: typeof detailTender }>(
          `/api/v1/quote_returns/${qr.id}/confirm_details`
        ).then((res) => {
          setDetailTender((res as { data: typeof detailTender })?.data ?? null);
        }),
      ];

      if (qr.warehouseDocumentId) {
        promises.push(
          Promise.all([
            api.post<{ success: boolean; shareUrl: string }>(
              `/api/v1/documents/${qr.warehouseDocumentId}/share_link`
            ),
            api.post<{ success: boolean; shareUrl: string }>(
              `/api/v1/documents/${qr.warehouseDocumentId}/share_link`,
              { open: true }
            ),
          ]).then(([dlRes, openRes]) => {
            if (dlRes?.shareUrl && openRes?.shareUrl) {
              setDetailDocUrls({
                downloadUrl: dlRes.shareUrl,
                openUrl: openRes.shareUrl,
                filename: qr.supplierName
                  ? `${qr.supplierName} - Quote.pdf`
                  : "Quote Document.pdf",
              });
              // Also open PDF in a new browser tab
              window.open(openRes.shareUrl, "_blank");
            }
          })
        );
      }

      await Promise.all(promises);
    } catch {
      console.error("[JobQuoteReturnsTab] Failed to load detail");
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const handleReject = async (qr: QuoteReturn) => {
    try {
      await api.post(`/api/v1/quote_returns/${qr.id}/reject`);
      toast.success("Quote rejected");
      loadReturns();
    } catch (err) {
      console.error("[JobQuoteReturnsTab] Reject failed:", err);
      toast.error("Failed to reject quote");
    }
  };

  const handleRowDrop = useCallback(async (qr: QuoteReturn, e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverRowId(null);

    if (qr.source !== "custom_quote" || qr.status !== "sent") return;

    const files = Array.from(e.dataTransfer.files);
    const validFile = files.find((f) => ACCEPTED_DROP_TYPES.has(f.type));
    if (!validFile) return;

    const result = await uploadForSupplier(qr.sourceId, validFile);
    if (result) {
      toast.success(`Uploaded ${result.filename}`);
      setRecordResponseDialog({
        sourceId: qr.sourceId,
        supplierName: qr.supplierName || "Supplier",
        attachedDocument: result,
        parentLine: qr.parentLine,
      });
    }
  }, [uploadForSupplier]);

  const handleRecordResponseSubmit = useCallback(async (data: {
    price_quoted: number;
    quote_number?: string;
    valid_to?: string;
    response_notes?: string;
    warehouse_document_id?: number;
  }) => {
    if (!recordResponseDialog) return;
    try {
      await api.post(
        `/api/v1/custom_quote_suppliers/${recordResponseDialog.sourceId}/record_response`,
        data
      );
      toast.success("Response recorded");
      setRecordResponseDialog(null);
      loadReturns();
    } catch (err) {
      console.error("[JobQuoteReturnsTab] Record response failed:", err);
      toast.error("Failed to record response");
    }
  }, [recordResponseDialog, loadReturns]);

  const filteredReturns =
    data?.returns.filter((r) => filter === "all" || r.status === filter) ?? [];

  const formatCurrency = (val: number | null | undefined) => {
    if (val == null) return "—";
    return `$${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const isExpired = (validTo: string | null) => {
    if (!validTo) return false;
    return new Date(validTo) < new Date();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner />
      </div>
    );
  }

  if (!data || data.returns.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
        <ClipboardCheck className="h-12 w-12 mb-3 opacity-50" />
        <p className="text-lg font-medium">No Quote Returns Yet</p>
        <p className="text-sm mt-1">
          Supplier responses from Quote Tracker and Custom Quotes will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Summary Bar */}
      <div className="flex items-center gap-4 px-4 py-3 border-b bg-muted/30">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Total</span>
          <Badge variant="secondary">{data.summary.totalReturns}</Badge>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Sent</span>
          <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">
            {data.summary.sentCount}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Responded</span>
          <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300">
            {data.summary.respondedCount}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Accepted</span>
          <Badge className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
            {data.summary.acceptedCount}
          </Badge>
        </div>
        <div className="ml-auto text-sm">
          <span className="text-muted-foreground">Accepted Value: </span>
          <span className="font-semibold">
            {formatCurrency(data.summary.totalAcceptedValue)}
          </span>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1 px-4 py-2 border-b">
        {(["all", "sent", "responded", "accepted", "rejected"] as const).map((f) => (
          <Button
            key={f}
            variant={filter === f ? "default" : "ghost"}
            size="sm"
            className="h-7 text-xs"
            onClick={() => setFilter(f)}
          >
            {f === "all" ? "All" : STATUS_LABELS[f]}
            <Badge variant="outline" className="ml-1 text-xs h-4 px-1">
              {f === "all"
                ? data.returns.length
                : data.returns.filter((r) => r.status === f).length}
            </Badge>
          </Button>
        ))}
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 sticky top-0">
            <tr className="border-b">
              <th className="text-left px-4 py-2 font-medium">Supplier</th>
              <th className="text-left px-3 py-2 font-medium">Item / Task</th>
              <th className="text-left px-3 py-2 font-medium">CC / Trade</th>
              <th className="text-right px-3 py-2 font-medium">Price</th>
              <th className="text-left px-3 py-2 font-medium">Sent</th>
              <th className="text-left px-3 py-2 font-medium">Received</th>
              <th className="text-left px-3 py-2 font-medium">Quote #</th>
              <th className="text-left px-3 py-2 font-medium">Valid To</th>
              <th className="text-left px-3 py-2 font-medium">Status</th>
              <th className="text-left px-3 py-2 font-medium">Confirmed</th>
              <th className="text-center px-3 py-2 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredReturns.map((qr) => {
              const canDropOnRow = qr.source === "custom_quote" && qr.status === "sent";
              const isRowDragOver = dragOverRowId === qr.id;
              return (
              <tr
                key={qr.id}
                className={`border-b hover:bg-muted/30 transition-colors cursor-pointer ${
                  qr.status === "rejected" ? "opacity-50" : ""
                } ${isRowDragOver ? "bg-blue-50 dark:bg-blue-950/50" : ""}`}
                onDoubleClick={() => handleRowDoubleClick(qr)}
                onDragOver={canDropOnRow ? (e) => { e.preventDefault(); e.stopPropagation(); setDragOverRowId(qr.id); } : undefined}
                onDragLeave={canDropOnRow ? (e) => { e.preventDefault(); e.stopPropagation(); setDragOverRowId(null); } : undefined}
                onDrop={canDropOnRow ? (e) => handleRowDrop(qr, e) : undefined}
              >
                <td className="px-4 py-2 font-medium truncate max-w-[160px]">
                  {qr.supplierName || "Unknown"}
                </td>
                <td className="px-3 py-2 truncate max-w-[160px]">
                  {qr.itemName || "—"}
                </td>
                <td className="px-3 py-2 truncate max-w-[120px] text-muted-foreground">
                  {qr.parentName || "—"}
                </td>
                <td className="px-3 py-2 text-right font-mono">
                  <span
                    className={
                      qr.isBestPrice
                        ? "text-green-600 dark:text-green-400 font-bold"
                        : ""
                    }
                  >
                    {formatCurrency(qr.priceQuoted)}
                  </span>
                </td>
                <td className="px-3 py-2 text-muted-foreground">
                  {qr.dateSent ? (
                    <span title={qr.sentByName ? `by ${qr.sentByName}` : ""}>
                      {format(parseISO(qr.dateSent), DATE_DISPLAY)}
                    </span>
                  ) : "—"}
                </td>
                <td className="px-3 py-2 text-muted-foreground">
                  {qr.dateReceived
                    ? format(parseISO(qr.dateReceived), DATE_DISPLAY)
                    : "—"}
                </td>
                <td className="px-3 py-2">{qr.quoteNumber || "—"}</td>
                <td className="px-3 py-2">
                  {qr.validTo ? (
                    <span
                      className={
                        isExpired(qr.validTo)
                          ? "text-red-600 dark:text-red-400"
                          : ""
                      }
                    >
                      {format(parseISO(qr.validTo), DATE_DISPLAY)}
                      {isExpired(qr.validTo) && " (expired)"}
                    </span>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-3 py-2">
                  <Badge
                    variant="outline"
                    className={`text-xs ${STATUS_COLORS[qr.status]}`}
                  >
                    {STATUS_LABELS[qr.status]}
                  </Badge>
                </td>
                <td className="px-3 py-2 text-xs text-muted-foreground">
                  {qr.confirmedBy ? (
                    <span title={qr.confirmedAt ? format(parseISO(qr.confirmedAt), DATETIME_DISPLAY) : ""}>
                      {qr.confirmedBy}
                    </span>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-3 py-2">
                  <div className="flex items-center justify-center gap-1">
                    {qr.status === "sent" && (
                      <span className="text-xs text-muted-foreground">Awaiting response</span>
                    )}
                    {qr.status === "responded" && (
                      <>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-xs text-green-600 hover:text-green-700 hover:bg-green-50 dark:hover:bg-green-950"
                          onClick={() => setConfirmDialog(qr)}
                          title="Select this quote"
                        >
                          <Check className="h-3.5 w-3.5 mr-1" />
                          Select
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950"
                          onClick={() => handleReject(qr)}
                          title="Reject this quote"
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </>
                    )}
                    {qr.status === "accepted" && qr.purchaseOrderNumber && (
                      <span className="text-xs text-green-600 dark:text-green-400 font-medium">
                        PO {qr.purchaseOrderNumber}
                      </span>
                    )}
                    {qr.warehouseDocumentId && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0"
                        title="View quote document"
                        onClick={async () => {
                          try {
                            const res = await api.post<{ success: boolean; shareUrl: string }>(
                              `/api/v1/documents/${qr.warehouseDocumentId}/share_link`,
                              { open: true }
                            );
                            if (res?.shareUrl) {
                              window.open(res.shareUrl, "_blank");
                            }
                          } catch {
                            toast.error("Failed to open document");
                          }
                        }}
                      >
                        <FileText className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
              );
            })}
          </tbody>
        </table>

        {filteredReturns.length === 0 && (
          <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
            No {filter !== "all" ? STATUS_LABELS[filter].toLowerCase() : ""} returns found.
          </div>
        )}
      </div>

      {/* Confirmation Dialog */}
      {confirmDialog && (
        <QuoteConfirmDialog
          open={true}
          onClose={() => setConfirmDialog(null)}
          quoteReturn={confirmDialog}
          onAccepted={loadReturns}
        />
      )}

      {/* Record Response Sheet (from drag-drop upload) */}
      <RecordResponseDialog
        open={!!recordResponseDialog}
        onClose={() => setRecordResponseDialog(null)}
        supplierName={recordResponseDialog?.supplierName || ""}
        supplierId={recordResponseDialog?.sourceId || 0}
        attachedDocument={recordResponseDialog?.attachedDocument}
        parentLine={recordResponseDialog?.parentLine}
        onSubmit={handleRecordResponseSubmit}
      />

      {/* Quote Return Detail Sheet */}
      <Sheet
        open={!!detailSheet}
        onOpenChange={(open) => {
          if (!open) {
            setDetailSheet(null);
            setDetailTender(null);
            setDetailDocUrls(null);
          }
        }}
      >
        <SheetContent
          side="right"
          className="w-[800px] sm:max-w-[800px] flex flex-col p-0"
        >
          <SheetHeader className="px-6 py-4 border-b shrink-0">
            <SheetTitle className="text-lg">
              {detailSheet?.supplierName || "Quote Details"}
            </SheetTitle>
          </SheetHeader>

          {detailSheet && (
            <div className="flex flex-col flex-1 overflow-hidden">
              {detailLoading ? (
                <div className="flex items-center justify-center h-64">
                  <Spinner />
                </div>
              ) : (
                <>
                  {/* Tender Info Section */}
                  <div className="px-6 py-4 border-b space-y-4 shrink-0 overflow-auto max-h-[40%]">
                    {/* Basic Quote Info */}
                    <div className="grid grid-cols-3 gap-x-6 gap-y-2 text-sm">
                      <div>
                        <span className="text-muted-foreground text-xs">Supplier</span>
                        <p className="font-medium">{detailSheet.supplierName || "Unknown"}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground text-xs">Item / Task</span>
                        <p className="font-medium">{detailSheet.itemName || "—"}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground text-xs">CC / Trade</span>
                        <p>{detailSheet.parentName || "—"}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground text-xs">Price</span>
                        <p className={`font-mono font-medium ${
                          detailSheet.isBestPrice ? "text-green-600 dark:text-green-400" : ""
                        }`}>
                          {formatCurrency(detailSheet.priceQuoted)}
                          {detailTender?.requested.budget != null && detailSheet.priceQuoted != null && (
                            <span className="text-xs text-muted-foreground ml-1">
                              (Budget: {formatCurrency(detailTender.requested.budget)})
                            </span>
                          )}
                        </p>
                      </div>
                      <div>
                        <span className="text-muted-foreground text-xs">Status</span>
                        <div className="mt-0.5">
                          <Badge variant="outline" className={`text-xs ${STATUS_COLORS[detailSheet.status]}`}>
                            {STATUS_LABELS[detailSheet.status]}
                          </Badge>
                        </div>
                      </div>
                      <div>
                        <span className="text-muted-foreground text-xs">Quote #</span>
                        <p>{detailSheet.quoteNumber || "—"}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground text-xs">Sent</span>
                        <p>{detailSheet.dateSent ? format(parseISO(detailSheet.dateSent), DATE_DISPLAY) : "—"}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground text-xs">Received</span>
                        <p>{detailSheet.dateReceived ? format(parseISO(detailSheet.dateReceived), DATE_DISPLAY) : "—"}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground text-xs">Valid To</span>
                        <p className={detailSheet.validTo && isExpired(detailSheet.validTo) ? "text-red-600 dark:text-red-400" : ""}>
                          {detailSheet.validTo
                            ? `${format(parseISO(detailSheet.validTo), DATE_DISPLAY)}${isExpired(detailSheet.validTo) ? " (expired)" : ""}`
                            : "—"}
                        </p>
                      </div>
                    </div>

                    {/* Tender Description */}
                    {detailTender?.requested.description && (
                      <div>
                        <span className="text-muted-foreground text-xs font-medium">Tender Description</span>
                        <div className="mt-1 text-sm whitespace-pre-wrap bg-muted/30 rounded-md p-3 border">
                          {detailTender.requested.description}
                        </div>
                      </div>
                    )}

                    {/* RFQ Instructions */}
                    {detailTender?.requested.rfqInstructions &&
                      detailTender.requested.rfqInstructions !== detailTender.requested.description && (
                      <div>
                        <span className="text-muted-foreground text-xs font-medium">RFQ Instructions</span>
                        <div className="mt-1 text-sm whitespace-pre-wrap bg-muted/30 rounded-md p-3 border">
                          {detailTender.requested.rfqInstructions}
                        </div>
                      </div>
                    )}

                    {/* Document Types */}
                    {detailTender?.requested.documentTypeNames && detailTender.requested.documentTypeNames.length > 0 && (
                      <div>
                        <span className="text-muted-foreground text-xs font-medium">Document Types</span>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {detailTender.requested.documentTypeNames.map((dt) => (
                            <Badge key={dt} variant="outline" className="text-xs">{dt}</Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* PO Line Breakdown (CC-level quotes) */}
                    {detailSheet.parentLine?.quoteLevel === "cost_centre" &&
                      detailSheet.parentLine.children.length > 0 && (
                      <div>
                        <span className="text-muted-foreground text-xs font-medium">
                          PO Lines — {detailSheet.parentLine.name}
                          {detailSheet.parentLine.budgetAmount != null && (
                            <span className="ml-1">
                              (Budget: {formatCurrency(detailSheet.parentLine.budgetAmount)})
                            </span>
                          )}
                        </span>
                        <div className="mt-1.5 rounded-md border overflow-hidden">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="bg-muted/50 border-b">
                                <th className="text-left px-3 py-1.5 text-xs font-medium text-muted-foreground">PO Line</th>
                                <th className="text-right px-3 py-1.5 text-xs font-medium text-muted-foreground">Budget</th>
                              </tr>
                            </thead>
                            <tbody>
                              {detailSheet.parentLine.children.map((child) => (
                                <tr key={child.id} className="border-b last:border-0">
                                  <td className="px-3 py-1.5">{child.name}</td>
                                  <td className="px-3 py-1.5 text-right font-mono text-muted-foreground">
                                    {formatCurrency(child.budgetAmount)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* Response Notes */}
                    {(detailTender?.quoted.responseNotes || detailSheet.responseNotes) && (
                      <div>
                        <span className="text-muted-foreground text-xs font-medium">Supplier Notes</span>
                        <p className="text-sm whitespace-pre-wrap mt-1">
                          {detailTender?.quoted.responseNotes || detailSheet.responseNotes}
                        </p>
                      </div>
                    )}

                    {/* PO info */}
                    {detailSheet.purchaseOrderNumber && (
                      <div>
                        <span className="text-muted-foreground text-xs font-medium">Purchase Order</span>
                        <p className="text-sm text-green-600 dark:text-green-400 font-medium mt-0.5">
                          PO {detailSheet.purchaseOrderNumber}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Document Viewer Section */}
                  <div className="flex-1 overflow-hidden">
                    {detailDocUrls ? (
                      <DocumentViewer
                        url={detailDocUrls.openUrl}
                        fileName={detailDocUrls.filename}
                        downloadUrl={detailDocUrls.downloadUrl}
                        showHeader={false}
                        showFooter={false}
                        theme="light"
                        className="h-full"
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                        <FileText className="h-12 w-12 mb-3 opacity-30" />
                        <p className="text-sm">No document attached</p>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
