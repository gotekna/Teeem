"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  RefreshCw,
  Scale,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
} from "lucide-react";
import Link from "next/link";
import { api } from "@/lib/api";
import { formatCurrency } from "@/utils/formatters";

// --- Types ---

interface LineItem {
  id: number;
  description: string;
  quantity: number;
  unit_price: number;
  current_subtotal: number;
  pricebook_item_code: string | null;
  price_only_price: number | null;
  price_only_subtotal: number | null;
  price_only_supplier: string | null;
  price_only_supplier_id: number | null;
  difference: number | null;
  difference_pct: number | null;
  status: "cheaper" | "expensive" | "equal" | "missing_price_only" | "no_pricebook_link";
}

interface POGroup {
  id: number;
  po_number: string;
  supplier_id: number | null;
  supplier_name: string;
  status: string;
  current_total: number;
  price_only_total: number | null;
  difference: number | null;
  missing_count: number;
  line_items: LineItem[];
}

interface Summary {
  current_total: number;
  price_only_total: number;
  difference: number;
  missing_prices: number;
  unlinked_lines: number;
  total_pos: number;
  total_line_items: number;
}

interface PriceAnalysisData {
  success: boolean;
  summary: Summary;
  po_groups: POGroup[];
}

interface JobPriceAnalysisTabProps {
  jobId: string | number;
}

// --- Helpers ---

const STATUS_ROW_CLASSES: Record<string, string> = {
  cheaper: "bg-red-50 dark:bg-red-950/20",
  expensive: "bg-green-50 dark:bg-green-950/20",
  equal: "",
  missing_price_only: "bg-yellow-50 dark:bg-yellow-950/20",
  no_pricebook_link: "bg-muted/30",
};

const STATUS_BADGES: Record<string, { className: string; label: string }> = {
  cheaper: { className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400", label: "Overpaid" },
  expensive: { className: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400", label: "Good Deal" },
  equal: { className: "bg-muted text-foreground dark:bg-card dark:text-muted-foreground", label: "Equal" },
  missing_price_only: { className: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400", label: "No Ref Price" },
  no_pricebook_link: { className: "bg-muted text-muted-foreground dark:bg-card dark:text-muted-foreground", label: "Not Linked" },
};

function getDiffColor(diff: number | null): string {
  if (diff === null) return "text-muted-foreground";
  if (diff < -0.01) return "text-red-600 dark:text-red-400 font-semibold";
  if (diff > 0.01) return "text-green-600 dark:text-green-400 font-semibold";
  return "text-foreground";
}

// --- Component ---

export default function JobPriceAnalysisTab({ jobId }: JobPriceAnalysisTabProps) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<PriceAnalysisData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedPOs, setExpandedPOs] = useState<Set<number>>(new Set());

  useEffect(() => {
    loadData();
  }, [jobId]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get<PriceAnalysisData>(`/api/v1/jobs/${jobId}/price_analysis`);
      setData(response);
      // Auto-expand first PO if data loaded
      if (response?.po_groups?.length) {
        setExpandedPOs(new Set([response.po_groups[0].id]));
      }
    } catch (err) {
      console.error("Failed to load price analysis:", err);
      setError("Failed to load price analysis data");
    } finally {
      setLoading(false);
    }
  };

  const togglePO = (poId: number) => {
    setExpandedPOs((prev) => {
      const next = new Set(prev);
      if (next.has(poId)) next.delete(poId);
      else next.add(poId);
      return next;
    });
  };

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner size={32} className="text-muted-foreground" />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <Card className="border-destructive">
        <CardContent className="py-6">
          <div className="flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-destructive" />
            <p className="text-sm text-destructive">{error}</p>
          </div>
          <Button variant="outline" className="mt-3" onClick={loadData}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Empty state
  if (!data || !data.po_groups || data.po_groups.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Scale className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
          <h3 className="text-sm font-semibold">Price Analysis</h3>
          <p className="text-sm text-muted-foreground mt-1">
            No purchase orders found. Create purchase orders with pricebook items to compare against reference prices.
          </p>
        </CardContent>
      </Card>
    );
  }

  const { summary, po_groups } = data;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">PO Total (Ex GST)</p>
            <p className="mt-1 text-2xl font-semibold">{formatCurrency(summary.current_total)}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {summary.total_pos} POs, {summary.total_line_items} items
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Reference Total (Ex GST)</p>
            <p className="mt-1 text-2xl font-semibold">{formatCurrency(summary.price_only_total)}</p>
            <p className="text-xs text-muted-foreground mt-1">From price-only contacts</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Difference</p>
            <p className={`mt-1 text-2xl font-semibold ${getDiffColor(summary.difference)}`}>
              {summary.difference >= 0 ? "+" : ""}{formatCurrency(summary.difference)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {summary.difference < 0 ? "Ref prices are lower" : summary.difference > 0 ? "Ref prices are higher" : "Prices match"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Missing Ref Prices</p>
            <div className="mt-1 flex items-baseline gap-2">
              <p className={`text-2xl font-semibold ${summary.missing_prices > 0 ? "text-yellow-600 dark:text-yellow-400" : "text-foreground"}`}>
                {summary.missing_prices}
              </p>
              {summary.unlinked_lines > 0 && (
                <p className="text-sm text-muted-foreground">+ {summary.unlinked_lines} unlinked</p>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Items without reference pricing</p>
          </CardContent>
        </Card>
      </div>

      {/* PO Accordion */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">Purchase Orders</h3>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setExpandedPOs(new Set(po_groups.map(g => g.id)))}
            >
              Expand All
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setExpandedPOs(new Set())}
            >
              Collapse All
            </Button>
            <Button variant="outline" size="sm" onClick={loadData}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </div>

        {po_groups.map((po) => (
          <POCard
            key={po.id}
            po={po}
            expanded={expandedPOs.has(po.id)}
            onToggle={() => togglePO(po.id)}
          />
        ))}
      </div>
    </div>
  );
}

// --- PO Card Sub-Component ---

function POCard({ po, expanded, onToggle }: { po: POGroup; expanded: boolean; onToggle: () => void }) {
  const hasDiff = po.difference !== null;

  return (
    <Card>
      <button
        className="w-full text-left px-4 py-3 flex items-center justify-between hover:bg-muted/50 dark:hover:bg-muted/20 transition-colors rounded-t-lg"
        onClick={onToggle}
      >
        <div className="flex items-center gap-3 min-w-0">
          {expanded ? (
            <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
          )}
          <span className="font-medium text-sm">{po.po_number}</span>
          {po.supplier_id ? (
            <Link
              href={`/contacts/${po.supplier_id}`}
              className="text-sm text-primary hover:underline truncate"
              onClick={(e) => e.stopPropagation()}
            >
              {po.supplier_name}
            </Link>
          ) : (
            <span className="text-sm text-muted-foreground truncate">{po.supplier_name}</span>
          )}
          <Badge variant="outline" className="text-xs shrink-0">{po.status}</Badge>
          {po.missing_count > 0 && (
            <Badge className="bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 text-xs shrink-0">
              <AlertTriangle className="h-3 w-3 mr-1" />
              {po.missing_count} missing
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-4 shrink-0 ml-4">
          <div className="text-right">
            <p className="text-sm font-medium">{formatCurrency(po.current_total)}</p>
            <p className="text-xs text-muted-foreground">Ex GST</p>
          </div>
          {hasDiff && (
            <>
              <span className="text-muted-foreground">→</span>
              <div className="text-right">
                <p className="text-sm font-medium">{formatCurrency(po.price_only_total)}</p>
                <p className="text-xs text-muted-foreground">Ref Ex GST</p>
              </div>
              <div className="text-right min-w-[80px]">
                <p className={`text-sm font-medium ${getDiffColor(po.difference)}`}>
                  {po.difference! >= 0 ? "+" : ""}{formatCurrency(po.difference)}
                </p>
              </div>
            </>
          )}
        </div>
      </button>

      {expanded && (
        <CardContent className="p-0 border-t">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[40px]">#</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="w-[100px]">Code</TableHead>
                <TableHead className="text-right w-[60px]">Qty</TableHead>
                <TableHead className="text-right w-[90px]">Our $</TableHead>
                <TableHead className="text-right w-[140px]">Ref $</TableHead>
                <TableHead className="text-right w-[100px]">Line Diff</TableHead>
                <TableHead className="w-[100px]">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {po.line_items.map((item, idx) => {
                const rowClass = STATUS_ROW_CLASSES[item.status] || "";
                const badge = STATUS_BADGES[item.status];
                const isUnlinked = item.status === "no_pricebook_link";

                return (
                  <TableRow key={item.id} className={rowClass}>
                    <TableCell className="text-muted-foreground text-xs">{idx + 1}</TableCell>
                    <TableCell className={`max-w-[300px] truncate ${isUnlinked ? "italic text-muted-foreground" : ""}`}>
                      {item.description}
                    </TableCell>
                    <TableCell className="text-xs font-mono">
                      {item.pricebook_item_code ? (
                        <Link href={`/pricebook/${item.pricebook_item_code}`} className="text-primary hover:underline">
                          {item.pricebook_item_code}
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">{item.quantity}</TableCell>
                    <TableCell className="text-right">{formatCurrency(item.unit_price)}</TableCell>
                    <TableCell className="text-right">
                      {item.price_only_price !== null ? (
                        <div>
                          <div>{formatCurrency(item.price_only_price)}</div>
                          {item.price_only_supplier && (
                            <div className="text-xs truncate max-w-[160px]" title={item.price_only_supplier}>
                              {item.price_only_supplier_id ? (
                                <Link href={`/contacts/${item.price_only_supplier_id}`} className="text-primary hover:underline">
                                  {item.price_only_supplier}
                                </Link>
                              ) : (
                                <span className="text-muted-foreground">{item.price_only_supplier}</span>
                              )}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-xs">
                          {item.status === "no_pricebook_link" ? "—" : "None"}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className={`text-right ${getDiffColor(item.difference)}`}>
                      {item.difference !== null ? (
                        <>
                          {item.difference >= 0 ? "+" : ""}{formatCurrency(item.difference)}
                          {item.difference_pct !== null && item.difference_pct !== 0 && (
                            <span className="text-xs ml-1">({item.difference_pct > 0 ? "+" : ""}{item.difference_pct}%)</span>
                          )}
                        </>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {badge && (
                        <Badge className={`text-xs ${badge.className}`}>{badge.label}</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}

              {/* PO Totals Row */}
              <TableRow className="bg-muted/50 font-semibold border-t-2">
                <TableCell colSpan={4} className="text-right">PO Total (Ex GST)</TableCell>
                <TableCell className="text-right">{formatCurrency(po.current_total)}</TableCell>
                <TableCell className="text-right">
                  {po.price_only_total !== null ? formatCurrency(po.price_only_total) : "—"}
                </TableCell>
                <TableCell className={`text-right ${getDiffColor(po.difference)}`}>
                  {po.difference !== null ? (
                    <>{po.difference >= 0 ? "+" : ""}{formatCurrency(po.difference)}</>
                  ) : "—"}
                </TableCell>
                <TableCell />
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      )}
    </Card>
  );
}
