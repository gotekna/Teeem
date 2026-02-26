"use client";

import { useParams } from "next/navigation";
import { useEffect, useState, useCallback, Suspense } from "react";
import { FileText, Sparkles, Loader2, Check, X, Paperclip } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { DocumentViewer } from "@/components/ui/document-viewer";
import { api } from "@/lib/api";
import { format, parseISO } from "date-fns";
import { DATE_DISPLAY } from "@/lib/constants/date-formats";

interface ExtractionResult {
  priceQuoted: number | null;
  quoteNumber: string | null;
  validTo: string | null;
  notesSummary: string | null;
  lineItems: Array<{ description: string; amount: number | null }>;
  confidence: number;
}

interface TenderDetails {
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
}

// Decoded from URL hash
interface QuoteReturnContext {
  id: string;
  supplierName: string | null;
  itemName: string | null;
  parentName: string | null;
  priceQuoted: number | null;
  status: string;
  isBestPrice: boolean;
  dateSent: string | null;
  dateReceived: string | null;
  quoteNumber: string | null;
  validTo: string | null;
  warehouseDocumentId: number | null;
  purchaseOrderNumber: string | null;
  responseNotes: string | null;
  parentLine: {
    id: number;
    name: string;
    quoteLevel: string;
    tenderDescription: string | null;
    budgetAmount: number | null;
    children: Array<{ id: number; name: string; budgetAmount: number | null }>;
  } | null;
}

const STATUS_COLORS: Record<string, string> = {
  sent: "bg-blue-100 text-blue-700",
  responded: "bg-amber-100 text-amber-700",
  accepted: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
};

const STATUS_LABELS: Record<string, string> = {
  sent: "Sent",
  responded: "Responded",
  accepted: "Accepted",
  rejected: "Rejected",
};

function formatCurrency(val: number | null | undefined) {
  if (val == null) return "\u2014";
  return `$${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function decodeHash(): QuoteReturnContext | null {
  try {
    if (typeof window === "undefined") return null;
    const hash = window.location.hash.slice(1);
    if (!hash) return null;
    return JSON.parse(decodeURIComponent(hash));
  } catch {
    return null;
  }
}

function QuoteReturnContent() {
  const params = useParams();
  const returnId = params.id as string;

  const [qr, setQr] = useState<QuoteReturnContext | null>(null);
  const [tender, setTender] = useState<TenderDetails | null>(null);
  const [docUrls, setDocUrls] = useState<{ openUrl: string; downloadUrl: string; filename: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [extracting, setExtracting] = useState(false);
  const [extraction, setExtraction] = useState<ExtractionResult | null>(null);
  const [includeTenderDesc, setIncludeTenderDesc] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [actionResult, setActionResult] = useState<{ type: "success" | "error"; message: string } | null>(null);

  useEffect(() => {
    const ctx = decodeHash();
    setQr(ctx);

    const fetchData = async () => {
      try {
        const promises: Promise<unknown>[] = [
          api.get<{ success: boolean; data: TenderDetails }>(
            `/api/v1/quote_returns/${returnId}/confirm_details`
          ).then((res) => {
            setTender((res as { data: TenderDetails })?.data ?? null);
          }),
        ];

        const docId = ctx?.warehouseDocumentId;
        if (docId) {
          promises.push(
            Promise.all([
              api.post<{ success: boolean; shareUrl: string }>(
                `/api/v1/documents/${docId}/share_link`
              ),
              api.post<{ success: boolean; shareUrl: string }>(
                `/api/v1/documents/${docId}/share_link`,
                { open: true }
              ),
            ]).then(([dlRes, openRes]) => {
              if (dlRes?.shareUrl && openRes?.shareUrl) {
                setDocUrls({
                  downloadUrl: dlRes.shareUrl,
                  openUrl: openRes.shareUrl,
                  filename: ctx?.supplierName
                    ? `${ctx.supplierName} - Quote.pdf`
                    : "Quote Document.pdf",
                });
              }
            })
          );
        }

        await Promise.all(promises);
      } catch (err) {
        console.error("[QuoteReturnPage] Failed to load:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [returnId]);

  // Auto-extract data from PDF when fields are empty and document exists
  useEffect(() => {
    if (!qr || loading) return;
    const isCqs = returnId.startsWith("cqs_");
    const hasDoc = qr.warehouseDocumentId != null;
    const needsExtraction = !qr.priceQuoted;
    if (isCqs && hasDoc && needsExtraction) {
      setExtracting(true);
      api.post<{ success: boolean; data: { extraction: ExtractionResult; saved: boolean; updatedFields: string[] } }>(
        `/api/v1/quote_returns/${returnId}/extract`
      ).then((res) => {
        const ext = (res as { data: { extraction: ExtractionResult } })?.data?.extraction;
        if (ext) {
          setExtraction(ext);
          setQr((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              priceQuoted: ext.priceQuoted ?? prev.priceQuoted,
              quoteNumber: ext.quoteNumber ?? prev.quoteNumber,
              validTo: ext.validTo ?? prev.validTo,
              responseNotes: ext.notesSummary ?? prev.responseNotes,
              dateReceived: prev.dateReceived || new Date().toISOString().split("T")[0],
              status: prev.status === "sent" ? "responded" : prev.status,
            };
          });
        }
      }).catch((err) => {
        console.error("[QuoteReturnPage] AI extraction failed:", err);
      }).finally(() => {
        setExtracting(false);
      });
    }
  }, [qr?.warehouseDocumentId, loading, returnId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Set page title
  useEffect(() => {
    if (qr?.supplierName) {
      document.title = `${qr.supplierName} - Quote Return | Teeem`;
    }
  }, [qr?.supplierName]);

  const handleAccept = useCallback(async () => {
    if (!qr || accepting) return;
    setAccepting(true);
    setActionResult(null);
    try {
      const res = await api.post<{ success: boolean; message: string; data?: { purchaseOrders: Array<{ poNumber: string }> } }>(
        `/api/v1/quote_returns/${returnId}/accept`,
        { includeTenderDescription: includeTenderDesc }
      );
      const msg = (res as { message: string })?.message || "Quote accepted";
      setActionResult({ type: "success", message: msg });
      setQr((prev) => prev ? { ...prev, status: "accepted" } : prev);
    } catch (err) {
      setActionResult({ type: "error", message: `Accept failed: ${err}` });
    } finally {
      setAccepting(false);
    }
  }, [qr, returnId, includeTenderDesc, accepting]);

  const handleReject = useCallback(async () => {
    if (!qr || rejecting) return;
    setRejecting(true);
    setActionResult(null);
    try {
      await api.post(`/api/v1/quote_returns/${returnId}/reject`);
      setActionResult({ type: "success", message: "Quote rejected" });
      setQr((prev) => prev ? { ...prev, status: "rejected" } : prev);
    } catch (err) {
      setActionResult({ type: "error", message: `Reject failed: ${err}` });
    } finally {
      setRejecting(false);
    }
  }, [qr, returnId, rejecting]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Spinner />
      </div>
    );
  }

  if (!qr) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <FileText className="h-16 w-16 text-muted-foreground mx-auto mb-4 opacity-50" />
          <h1 className="text-xl font-semibold mb-2">Quote Not Found</h1>
          <p className="text-muted-foreground">This quote return link is invalid.</p>
        </div>
      </div>
    );
  }

  const isExpired = qr.validTo ? new Date(qr.validTo) < new Date() : false;
  const isCCLevel = qr.parentLine?.quoteLevel === "cost_centre" && (qr.parentLine?.children?.length ?? 0) > 0;
  const canAct = qr.status === "sent" || qr.status === "responded";
  const hasTenderDesc = !!tender?.requested.description;

  return (
    <div className="h-dvh flex bg-background overflow-hidden">
        {/* Left: Quote Info + Actions */}
        <div className="w-[380px] shrink-0 border-r overflow-y-auto p-4 pb-8 space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="min-w-0">
              <h1 className="text-base font-semibold truncate">{qr.supplierName || "Quote Details"}</h1>
              <p className="text-xs text-muted-foreground truncate">
                {qr.itemName || ""}
                {qr.parentName ? ` \u2014 ${qr.parentName}` : ""}
              </p>
            </div>
            <Badge variant="outline" className={`text-xs shrink-0 ml-2 ${STATUS_COLORS[qr.status] || ""}`}>
              {STATUS_LABELS[qr.status] || qr.status}
            </Badge>
          </div>

          {/* AI Extraction Banner */}
          {extracting && (
            <div className="flex items-center gap-2 text-sm text-blue-600 bg-blue-50 rounded-md px-3 py-2 border border-blue-200">
              <Loader2 className="h-4 w-4 animate-spin" />
              Extracting quote data from PDF...
            </div>
          )}
          {extraction && !extracting && (
            <div className="flex items-center gap-2 text-sm text-purple-600 bg-purple-50 rounded-md px-3 py-2 border border-purple-200">
              <Sparkles className="h-4 w-4" />
              AI extracted and saved ({Math.round(extraction.confidence * 100)}% confidence)
            </div>
          )}

          {/* Quote Info Grid */}
          <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
            <div>
              <span className="text-muted-foreground text-xs">Supplier</span>
              <p className="font-medium">{qr.supplierName || "Unknown"}</p>
            </div>
            <div>
              <span className="text-muted-foreground text-xs">Item / Task</span>
              <p className="font-medium">{qr.itemName || "\u2014"}</p>
            </div>
            <div>
              <span className="text-muted-foreground text-xs">CC / Trade</span>
              <p>{qr.parentName || "\u2014"}</p>
            </div>
            <div>
              <span className="text-muted-foreground text-xs">
                Price {extraction ? "(AI)" : ""}
              </span>
              <p className={`font-mono font-medium ${qr.isBestPrice ? "text-green-600" : ""}`}>
                {formatCurrency(qr.priceQuoted)}
              </p>
              {tender?.requested.budget != null && (
                <p className="text-xs text-muted-foreground">
                  Budget: {formatCurrency(tender.requested.budget)}
                </p>
              )}
            </div>
            <div>
              <span className="text-muted-foreground text-xs">Quote #</span>
              <p>{qr.quoteNumber || "\u2014"}</p>
            </div>
            <div>
              <span className="text-muted-foreground text-xs">Sent</span>
              <p>{qr.dateSent ? format(parseISO(qr.dateSent), DATE_DISPLAY) : "\u2014"}</p>
            </div>
            <div>
              <span className="text-muted-foreground text-xs">Received</span>
              <p>{qr.dateReceived ? format(parseISO(qr.dateReceived), DATE_DISPLAY) : "\u2014"}</p>
            </div>
            <div>
              <span className="text-muted-foreground text-xs">Valid To</span>
              <p className={isExpired ? "text-red-600" : ""}>
                {qr.validTo
                  ? `${format(parseISO(qr.validTo), DATE_DISPLAY)}${isExpired ? " (expired)" : ""}`
                  : "\u2014"}
              </p>
            </div>
            {qr.purchaseOrderNumber && (
              <div className="col-span-2">
                <span className="text-muted-foreground text-xs">Purchase Order</span>
                <p className="text-green-600 font-medium">PO {qr.purchaseOrderNumber}</p>
              </div>
            )}
          </div>

          {/* PO Line Breakdown */}
          {isCCLevel && qr.parentLine && (
            <div>
              <span className="text-xs font-medium text-muted-foreground">
                PO Lines \u2014 {qr.parentLine.name}
                {qr.parentLine.budgetAmount != null && (
                  <span className="ml-1">(Budget: {formatCurrency(qr.parentLine.budgetAmount)})</span>
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
                    {qr.parentLine.children.map((child) => (
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

          {/* AI-Extracted Line Items */}
          {extraction?.lineItems && extraction.lineItems.length > 0 && (
            <div>
              <span className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                <Sparkles className="h-3 w-3 text-purple-500" />
                Quote Breakdown (AI Extracted)
              </span>
              <div className="mt-1.5 rounded-md border overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/50 border-b">
                      <th className="text-left px-3 py-1.5 text-xs font-medium text-muted-foreground">Item</th>
                      <th className="text-right px-3 py-1.5 text-xs font-medium text-muted-foreground">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {extraction.lineItems.map((item, i) => (
                      <tr key={i} className="border-b last:border-0">
                        <td className="px-3 py-1.5">{item.description}</td>
                        <td className="px-3 py-1.5 text-right font-mono text-muted-foreground">
                          {formatCurrency(item.amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Tender Description (collapsible preview) */}
          {tender?.requested.description && (
            <div>
              <span className="text-xs font-medium text-muted-foreground">Tender Description</span>
              <div className="mt-1 text-sm whitespace-pre-wrap bg-muted/30 rounded-md p-3 border max-h-32 overflow-auto">
                {tender.requested.description}
              </div>
            </div>
          )}

          {/* Supplier Notes */}
          {(tender?.quoted.responseNotes || qr.responseNotes) && (
            <div>
              <span className="text-xs font-medium text-muted-foreground">Supplier Notes</span>
              <p className="text-sm whitespace-pre-wrap mt-1">
                {tender?.quoted.responseNotes || qr.responseNotes}
              </p>
            </div>
          )}

          {/* ── Accept/Reject Actions ────────────────────────────── */}
          {canAct && (
            <div className="border-t pt-4 space-y-3">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Actions
              </span>

              {/* PO Options */}
              <div className="space-y-2">
                {/* Tender description checkbox */}
                {hasTenderDesc && (
                  <label className="flex items-start gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={includeTenderDesc}
                      onChange={(e) => setIncludeTenderDesc(e.target.checked)}
                      className="mt-0.5 rounded border-gray-300"
                    />
                    <span>Add tender description to PO description</span>
                  </label>
                )}

                {/* Quote attachment indicator */}
                {qr.warehouseDocumentId && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Paperclip className="h-3.5 w-3.5" />
                    <span>Quote document will be attached to PO</span>
                  </div>
                )}
              </div>

              {/* Action result */}
              {actionResult && (
                <div className={`text-sm rounded-md px-3 py-2 border ${
                  actionResult.type === "success"
                    ? "bg-green-50 text-green-700 border-green-200"
                    : "bg-red-50 text-red-700 border-red-200"
                }`}>
                  {actionResult.message}
                </div>
              )}

              {/* Buttons */}
              {!actionResult?.type && (
                <div className="flex gap-2">
                  <Button
                    onClick={handleAccept}
                    disabled={accepting || rejecting || !qr.priceQuoted}
                    className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                  >
                    {accepting ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-1" />
                    ) : (
                      <Check className="h-4 w-4 mr-1" />
                    )}
                    Accept &amp; Create PO
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleReject}
                    disabled={accepting || rejecting}
                    className="text-red-600 border-red-200 hover:bg-red-50"
                  >
                    {rejecting ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-1" />
                    ) : (
                      <X className="h-4 w-4 mr-1" />
                    )}
                    Reject
                  </Button>
                </div>
              )}

              {/* Disabled reason */}
              {!qr.priceQuoted && !extracting && (
                <p className="text-xs text-amber-600">
                  Cannot accept without a price. Wait for AI extraction or enter price manually.
                </p>
              )}
            </div>
          )}

          {/* Already actioned */}
          {qr.status === "accepted" && (
            <div className="border-t pt-4">
              <div className="flex items-center gap-2 text-sm text-green-600 bg-green-50 rounded-md px-3 py-2 border border-green-200">
                <Check className="h-4 w-4" />
                Quote accepted{qr.purchaseOrderNumber ? ` \u2014 PO ${qr.purchaseOrderNumber}` : ""}
              </div>
            </div>
          )}
          {qr.status === "rejected" && (
            <div className="border-t pt-4">
              <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 rounded-md px-3 py-2 border border-red-200">
                <X className="h-4 w-4" />
                Quote rejected
              </div>
            </div>
          )}
        </div>

        {/* Right: PDF Viewer */}
        <div className="flex-1 overflow-hidden">
          {docUrls ? (
            <DocumentViewer
              url={docUrls.openUrl}
              fileName={docUrls.filename}
              downloadUrl={docUrls.downloadUrl}
              showHeader={false}
              showFooter={false}
              theme="dark"
              className="h-full"
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground bg-muted/10">
              <FileText className="h-16 w-16 mb-4 opacity-30" />
              <p className="text-lg">No document attached</p>
              <p className="text-sm mt-1">This quote has no PDF document yet.</p>
            </div>
          )}
        </div>
    </div>
  );
}

export default function QuoteReturnPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-background">
          <Spinner />
        </div>
      }
    >
      <QuoteReturnContent />
    </Suspense>
  );
}
