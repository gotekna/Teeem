"use client";

import { useParams } from "next/navigation";
import { useEffect, useState, Suspense } from "react";
import { FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { DocumentViewer } from "@/components/ui/document-viewer";
import { api } from "@/lib/api";
import { format, parseISO } from "date-fns";
import { DATE_DISPLAY } from "@/lib/constants/date-formats";

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

  // Set page title
  useEffect(() => {
    if (qr?.supplierName) {
      document.title = `${qr.supplierName} - Quote Return | Teeem`;
    }
  }, [qr?.supplierName]);

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

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <div className="border-b bg-card px-6 py-4 shrink-0">
        <h1 className="text-xl font-semibold">{qr.supplierName || "Quote Details"}</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {qr.itemName || ""}
          {qr.parentName ? ` \u2014 ${qr.parentName}` : ""}
        </p>
      </div>

      {/* Content: Side-by-side layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Tender Info */}
        <div className="w-[400px] shrink-0 border-r overflow-auto p-6 space-y-5">
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
              <span className="text-muted-foreground text-xs">Price</span>
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
              <span className="text-muted-foreground text-xs">Status</span>
              <div className="mt-0.5">
                <Badge variant="outline" className={`text-xs ${STATUS_COLORS[qr.status] || ""}`}>
                  {STATUS_LABELS[qr.status] || qr.status}
                </Badge>
              </div>
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
              <div>
                <span className="text-muted-foreground text-xs">Purchase Order</span>
                <p className="text-green-600 font-medium">PO {qr.purchaseOrderNumber}</p>
              </div>
            )}
          </div>

          {/* Tender Description */}
          {tender?.requested.description && (
            <div>
              <span className="text-xs font-medium text-muted-foreground">Tender Description</span>
              <div className="mt-1 text-sm whitespace-pre-wrap bg-muted/30 rounded-md p-3 border">
                {tender.requested.description}
              </div>
            </div>
          )}

          {/* RFQ Instructions */}
          {tender?.requested.rfqInstructions &&
            tender.requested.rfqInstructions !== tender.requested.description && (
            <div>
              <span className="text-xs font-medium text-muted-foreground">RFQ Instructions</span>
              <div className="mt-1 text-sm whitespace-pre-wrap bg-muted/30 rounded-md p-3 border">
                {tender.requested.rfqInstructions}
              </div>
            </div>
          )}

          {/* Document Types */}
          {tender?.requested.documentTypeNames && tender.requested.documentTypeNames.length > 0 && (
            <div>
              <span className="text-xs font-medium text-muted-foreground">Document Types</span>
              <div className="flex flex-wrap gap-1 mt-1">
                {tender.requested.documentTypeNames.map((dt) => (
                  <Badge key={dt} variant="outline" className="text-xs">{dt}</Badge>
                ))}
              </div>
            </div>
          )}

          {/* PO Line Breakdown (CC-level) */}
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

          {/* Supplier Notes */}
          {(tender?.quoted.responseNotes || qr.responseNotes) && (
            <div>
              <span className="text-xs font-medium text-muted-foreground">Supplier Notes</span>
              <p className="text-sm whitespace-pre-wrap mt-1">
                {tender?.quoted.responseNotes || qr.responseNotes}
              </p>
            </div>
          )}

          {/* Timeframe */}
          {tender?.quoted.timeframe && (
            <div>
              <span className="text-xs font-medium text-muted-foreground">Timeframe</span>
              <p className="text-sm mt-0.5">{tender.quoted.timeframe}</p>
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
              showHeader={true}
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
