"use client";

import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { api } from "@/lib/api";

interface BOQSummary {
  po_count: number;
  po_subtotal: number;
  po_gst: number;
  po_total: number;
}

interface POSummaryToolbarProps {
  jobId: string | number;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export function POSummaryToolbar({ jobId }: POSummaryToolbarProps) {
  const [summary, setSummary] = useState<BOQSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function fetchSummary() {
      try {
        setLoading(true);
        const response = await api.get<{
          summary: BOQSummary;
        }>(`/api/v1/jobs/${jobId}/boq`);
        if (!cancelled) {
          setSummary(response?.summary || null);
        }
      } catch (err) {
        console.error("Failed to load PO summary:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchSummary();
    return () => { cancelled = true; };
  }, [jobId]);

  return (
    <div className="flex items-center gap-3 px-4 py-2 border-b bg-muted/30 shrink-0">
      <div className="flex items-center gap-2">
        {loading ? (
          <Spinner size={14} />
        ) : summary ? (
          <>
            <Badge variant="secondary" className="text-xs whitespace-nowrap">
              {summary.po_count} POs
            </Badge>
            <div className="flex items-center gap-1.5 text-xs font-mono">
              <span className="text-muted-foreground whitespace-nowrap">
                Ex: {formatCurrency(summary.po_subtotal)}
              </span>
              <span className="text-muted-foreground/60">+</span>
              <span className="text-muted-foreground whitespace-nowrap">
                GST: {formatCurrency(summary.po_gst)}
              </span>
              <span className="text-muted-foreground/60">=</span>
              <Badge variant="outline" className="text-xs font-mono whitespace-nowrap">
                {formatCurrency(summary.po_total)}
              </Badge>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
