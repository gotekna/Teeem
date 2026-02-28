"use client";

import { useParams } from "next/navigation";
import { useEffect, useState, useCallback, Suspense } from "react";
import { FileText, Sparkles, Loader2, Check, X, Paperclip, SplitSquareHorizontal, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  purchaseOrderId: number | null;
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
  const [createdPOs, setCreatedPOs] = useState<Array<{ id: number; poNumber: string; budget: number | null; status: string }>>([]);
  // PO line allocation state (CC-level only)
  const [allocations, setAllocations] = useState<Record<number, string>>({});
  const [inputModes, setInputModes] = useState<Record<number, "$" | "%">>({});
  const [percentInputs, setPercentInputs] = useState<Record<number, string>>({});

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

  // Initialize allocation inputs when parentLine children are available
  useEffect(() => {
    if (!qr?.parentLine?.children?.length) return;
    const isCCLvl = qr.parentLine.quoteLevel === "cost_centre";
    if (!isCCLvl) return;
    const initial: Record<number, string> = {};
    for (const child of qr.parentLine.children) {
      initial[child.id] = allocations[child.id] || "";
    }
    setAllocations(initial);
  }, [qr?.parentLine?.children?.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // Allocation calculations
  const priceNum = qr?.priceQuoted ?? 0;
  const totalAllocated = Object.values(allocations).reduce(
    (sum, val) => sum + (parseFloat(val) || 0),
    0
  );
  const remaining = priceNum - totalAllocated;

  const handleAutoAllocate = useCallback(() => {
    if (!qr?.parentLine?.children?.length || !priceNum) return;
    const children = qr.parentLine.children;
    const perLine = Math.floor((priceNum / children.length) * 100) / 100;
    const newAllocations: Record<number, string> = {};
    let allocated = 0;
    children.forEach((child, i) => {
      if (i === children.length - 1) {
        newAllocations[child.id] = String(Math.round((priceNum - allocated) * 100) / 100);
      } else {
        newAllocations[child.id] = String(perLine);
        allocated += perLine;
      }
    });
    setAllocations(newAllocations);
  }, [qr?.parentLine?.children, priceNum]);

  const handleAllocateRemaining = useCallback((targetChildId?: number) => {
    if (!qr?.parentLine?.children?.length || remaining < 0.01) return;
    const children = qr.parentLine.children;

    if (targetChildId != null) {
      // Add remaining to the specific line
      const current = parseFloat(allocations[targetChildId] || "0") || 0;
      const newVal = Math.round((current + remaining) * 100) / 100;
      setAllocations((prev) => ({ ...prev, [targetChildId]: String(newVal) }));
      return;
    }

    // Find first child with $0 allocation, or use last child
    const emptyChild = children.find((c) => !parseFloat(allocations[c.id] || "0"));
    const target = emptyChild || children[children.length - 1];
    const current = parseFloat(allocations[target.id] || "0") || 0;
    const newVal = Math.round((current + remaining) * 100) / 100;
    setAllocations((prev) => ({ ...prev, [target.id]: String(newVal) }));
  }, [qr?.parentLine?.children, remaining, allocations]);

  const handleAccept = useCallback(async () => {
    if (!qr || accepting) return;
    setAccepting(true);
    setActionResult(null);
    try {
      // Build allocation data for CC-level quotes
      const isCCLvl = qr.parentLine?.quoteLevel === "cost_centre" && (qr.parentLine?.children?.length ?? 0) > 0;
      const allocationData = isCCLvl
        ? Object.entries(allocations)
            .filter(([, val]) => parseFloat(val) > 0)
            .map(([lineId, val]) => ({ lineId: Number(lineId), amount: parseFloat(val) }))
        : undefined;

      const res = await api.post<{ success: boolean; message: string; data?: { purchaseOrders: Array<{ id: number; poNumber: string; budget: number | null; status: string }> } }>(
        `/api/v1/quote_returns/${returnId}/accept`,
        {
          includeTenderDescription: includeTenderDesc,
          allocations: allocationData,
        }
      );
      const msg = (res as { message: string })?.message || "Quote accepted";
      const pos = (res as { data?: { purchaseOrders: Array<{ id: number; poNumber: string; budget: number | null; status: string }> } })?.data?.purchaseOrders || [];
      setCreatedPOs(pos);
      setActionResult({ type: "success", message: msg });
      setQr((prev) => prev ? { ...prev, status: "accepted" } : prev);
    } catch (err) {
      setActionResult({ type: "error", message: `Accept failed: ${err}` });
    } finally {
      setAccepting(false);
    }
  }, [qr, returnId, includeTenderDesc, accepting, allocations]);

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
                Price Ex GST {extraction ? "(AI)" : ""}
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

          {/* PO Line Allocation (CC-level, editable when actionable) */}
          {isCCLevel && qr.parentLine && canAct && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <SplitSquareHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-xs font-medium text-muted-foreground">
                    PO Line Allocation
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleAutoAllocate}
                  disabled={!priceNum}
                  className="text-xs h-6 px-2"
                >
                  Split Evenly
                </Button>
              </div>

              {qr.parentLine.budgetAmount != null && (
                <p className="text-xs text-muted-foreground">
                  CC: {qr.parentLine.name} ({formatCurrency(qr.parentLine.budgetAmount)} budget)
                </p>
              )}

              <div className="space-y-1.5">
                {qr.parentLine.children.map((child) => {
                  const amt = parseFloat(allocations[child.id] || "0") || 0;
                  const pct = priceNum > 0 ? Math.round((amt / priceNum) * 100) : 0;
                  const isPercent = inputModes[child.id] === "%";
                  const pctInputVal = percentInputs[child.id] ?? "";
                  return (
                    <div key={child.id} className="flex items-center gap-2">
                      {qr.purchaseOrderId ? (
                        <a
                          href={`/purchase_orders/${qr.purchaseOrderId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm flex-1 truncate text-blue-600 hover:underline"
                          title={child.name}
                        >
                          {child.name}
                        </a>
                      ) : (
                        <span className="text-sm flex-1 truncate" title={child.name}>{child.name}</span>
                      )}
                      {remaining > 0.01 && (
                        <button
                          type="button"
                          onClick={() => handleAllocateRemaining(child.id)}
                          className="text-[10px] text-blue-600 hover:text-blue-800 shrink-0 cursor-pointer"
                          title={`Allocate remaining ${formatCurrency(remaining)} to this line`}
                        >
                          +rest
                        </button>
                      )}
                      <div className="relative w-24 shrink-0">
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                          {isPercent ? "%" : "$"}
                        </span>
                        <Input
                          type="number"
                          value={isPercent ? pctInputVal : (allocations[child.id] || "")}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (isPercent) {
                              setPercentInputs((prev) => ({ ...prev, [child.id]: val }));
                              const p = parseFloat(val) || 0;
                              const dollarAmt = Math.round((p / 100) * priceNum * 100) / 100;
                              setAllocations((prev) => ({ ...prev, [child.id]: dollarAmt > 0 ? String(dollarAmt) : "" }));
                            } else {
                              setAllocations((prev) => ({ ...prev, [child.id]: val }));
                            }
                          }}
                          className="pl-5 text-sm h-7"
                          placeholder="0"
                          step={isPercent ? "1" : "0.01"}
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setInputModes((prev) => {
                            const next = prev[child.id] === "%" ? "$" : "%";
                            if (next === "%") {
                              setPercentInputs((p) => ({ ...p, [child.id]: pct > 0 ? String(pct) : "" }));
                            }
                            return { ...prev, [child.id]: next };
                          });
                        }}
                        className="text-xs text-muted-foreground w-10 text-right shrink-0 hover:text-foreground cursor-pointer"
                        title={`Click to enter as ${isPercent ? "$" : "%"}`}
                      >
                        {isPercent ? formatCurrency(amt) : `${pct}%`}
                      </button>
                    </div>
                  );
                })}
              </div>

              <div className="flex justify-between pt-1.5 border-t text-xs">
                <span>Total:</span>
                <span className="font-medium font-mono">
                  {formatCurrency(totalAllocated)} / {formatCurrency(priceNum)}
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span>Remaining:</span>
                {remaining > 0.01 ? (
                  <button
                    type="button"
                    onClick={() => handleAllocateRemaining()}
                    className="font-medium font-mono text-amber-600 hover:text-amber-800 hover:underline cursor-pointer"
                    title="Click to allocate to first empty line"
                  >
                    {formatCurrency(remaining)} unallocated
                  </button>
                ) : (
                  <span
                    className={`font-medium font-mono ${
                      remaining < -0.01 ? "text-red-600" : "text-green-600"
                    }`}
                  >
                    {formatCurrency(Math.abs(remaining))}
                    {remaining < -0.01 ? " over" : ""}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* PO Line Breakdown (read-only, already actioned) */}
          {isCCLevel && qr.parentLine && !canAct && (
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
                        <td className="px-3 py-1.5">
                          {qr.purchaseOrderId ? (
                            <a
                              href={`/purchase_orders/${qr.purchaseOrderId}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:underline inline-flex items-center gap-1"
                            >
                              {child.name}
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          ) : (
                            child.name
                          )}
                        </td>
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
                    disabled={accepting || rejecting || !qr.priceQuoted || (isCCLevel && (remaining < -0.01 || totalAllocated < 0.01))}
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
              {isCCLevel && qr.priceQuoted && totalAllocated < 0.01 && (
                <p className="text-xs text-amber-600">
                  Allocate price to PO lines before accepting.
                </p>
              )}
              {isCCLevel && remaining < -0.01 && (
                <p className="text-xs text-red-600">
                  Allocation total exceeds quoted price.
                </p>
              )}
            </div>
          )}

          {/* Already actioned — accepted with PO links */}
          {qr.status === "accepted" && (
            <div className="border-t pt-4 space-y-3">
              <div className="flex items-center gap-2 text-sm text-green-600 bg-green-50 rounded-md px-3 py-2 border border-green-200">
                <Check className="h-4 w-4 shrink-0" />
                Quote accepted
              </div>

              {/* Created PO cards */}
              {createdPOs.length > 0 && (
                <div>
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Purchase Orders Created
                  </span>
                  <div className={`mt-1.5 flex gap-2 ${createdPOs.length > 2 ? "overflow-x-auto pb-1" : ""}`}>
                    {createdPOs.map((po) => (
                      <a
                        key={po.id}
                        href={`/purchase_orders/${po.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-none flex items-center gap-2 px-3 py-2 rounded-md border border-green-200 bg-green-50 hover:bg-green-100 transition-colors cursor-pointer min-w-0"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-green-800 truncate">
                            PO {po.poNumber}
                          </p>
                          {po.budget != null && (
                            <p className="text-xs text-green-600">{formatCurrency(po.budget)}</p>
                          )}
                        </div>
                        <ExternalLink className="h-3.5 w-3.5 text-green-600 shrink-0" />
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Fallback if no createdPOs (e.g. page reload after accept) */}
              {createdPOs.length === 0 && qr.purchaseOrderNumber && (
                <p className="text-sm text-green-600 font-medium">
                  PO {qr.purchaseOrderNumber}
                </p>
              )}
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
