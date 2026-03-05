"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import {
  AlertCircle,
  DollarSign,
  CheckCircle2,
  Clock,
  XCircle,
  BanknoteIcon,
  RefreshCw,
  Send,
  Sparkles,
  FileText,
  ChevronDown,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface NdisClaim {
  id: number;
  propertyAddress: string;
  participantName?: string;
  period: string;
  amount: number;
  status: "draft" | "submitted" | "processing" | "approved" | "paid" | "rejected";
  submittedAt?: string;
  approvedAt?: string;
  paidAt?: string;
  notes?: string;
}

interface ClaimsSummary {
  totalClaimed: number;
  approved: number;
  pending: number;
  paid: number;
  rejected: number;
}

type ClaimStatus = NdisClaim["status"] | "all";

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<
  NdisClaim["status"],
  { label: string; bg: string; text: string; icon: React.ElementType }
> = {
  draft: {
    label: "Draft",
    bg: "bg-gray-100 dark:bg-gray-800",
    text: "text-gray-600 dark:text-gray-400",
    icon: FileText,
  },
  submitted: {
    label: "Submitted",
    bg: "bg-blue-100 dark:bg-blue-900/30",
    text: "text-blue-700 dark:text-blue-300",
    icon: Send,
  },
  processing: {
    label: "Processing",
    bg: "bg-amber-100 dark:bg-amber-900/30",
    text: "text-amber-700 dark:text-amber-300",
    icon: Clock,
  },
  approved: {
    label: "Approved",
    bg: "bg-green-100 dark:bg-green-900/30",
    text: "text-green-700 dark:text-green-300",
    icon: CheckCircle2,
  },
  paid: {
    label: "Paid",
    bg: "bg-emerald-100 dark:bg-emerald-900/30",
    text: "text-emerald-700 dark:text-emerald-300",
    icon: BanknoteIcon,
  },
  rejected: {
    label: "Rejected",
    bg: "bg-red-100 dark:bg-red-900/30",
    text: "text-red-700 dark:text-red-300",
    icon: XCircle,
  },
};

function StatusBadge({ status }: { status: NdisClaim["status"] }) {
  const cfg = STATUS_CONFIG[status];
  const Icon = cfg.icon;
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold ${cfg.bg} ${cfg.text}`}
    >
      <Icon className="h-3 w-3" />
      {cfg.label}
    </span>
  );
}

// ─── Summary Card ─────────────────────────────────────────────────────────────

function SummaryCard({
  title,
  value,
  icon: Icon,
  iconBg,
  iconColor,
  loading,
}: {
  title: string;
  value: string | number;
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
  loading: boolean;
}) {
  return (
    <Card>
      <CardContent className="pt-5 pb-5">
        <div className="flex items-center gap-3">
          <div className={`p-2.5 rounded-lg ${iconBg}`}>
            <Icon className={`h-4 w-4 ${iconColor}`} />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{title}</p>
            {loading ? (
              <Skeleton className="h-6 w-20 mt-0.5" />
            ) : (
              <p className="text-lg font-bold font-mono">{value}</p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Claims Table Row ─────────────────────────────────────────────────────────

function ClaimRow({
  claim,
  selected,
  onToggle,
}: {
  claim: NdisClaim;
  selected: boolean;
  onToggle: (id: number) => void;
}) {
  return (
    <tr
      className={`border-b border-border transition-colors ${
        selected ? "bg-primary/5" : "hover:bg-secondary/40"
      }`}
    >
      <td className="px-4 py-3 w-10">
        {claim.status === "draft" && (
          <input
            type="checkbox"
            checked={selected}
            onChange={() => onToggle(claim.id)}
            className="rounded border-border"
            aria-label={`Select claim for ${claim.propertyAddress}`}
          />
        )}
      </td>
      <td className="px-4 py-3 text-sm">
        <div className="font-medium truncate max-w-[180px]">{claim.propertyAddress}</div>
        {claim.participantName && (
          <div className="text-xs text-muted-foreground">{claim.participantName}</div>
        )}
      </td>
      <td className="px-4 py-3 text-sm text-muted-foreground font-mono text-xs">
        {claim.period}
      </td>
      <td className="px-4 py-3 text-sm font-mono font-semibold">
        ${claim.amount.toLocaleString()}
      </td>
      <td className="px-4 py-3">
        <StatusBadge status={claim.status} />
      </td>
      <td className="px-4 py-3 text-xs text-muted-foreground">
        {claim.paidAt
          ? `Paid ${claim.paidAt}`
          : claim.approvedAt
          ? `Approved ${claim.approvedAt}`
          : claim.submittedAt
          ? `Submitted ${claim.submittedAt}`
          : "—"}
      </td>
    </tr>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

const STATUS_FILTERS: { value: ClaimStatus; label: string }[] = [
  { value: "all", label: "All" },
  { value: "draft", label: "Draft" },
  { value: "submitted", label: "Submitted" },
  { value: "processing", label: "Processing" },
  { value: "approved", label: "Approved" },
  { value: "paid", label: "Paid" },
  { value: "rejected", label: "Rejected" },
];

export default function SdaClaimsPage() {
  const [claims, setClaims] = useState<NdisClaim[]>([]);
  const [summary, setSummary] = useState<ClaimsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [error, setError] = useState(false);
  const [statusFilter, setStatusFilter] = useState<ClaimStatus>("all");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [generating, setGenerating] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const fetchClaims = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await api.get<{ success: boolean; data: NdisClaim[] }>("/api/v1/ndis_claims");
      if (res?.data) setClaims(res.data);
      else if (Array.isArray(res)) setClaims(res as NdisClaim[]);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchSummary = useCallback(async () => {
    setSummaryLoading(true);
    try {
      const res = await api.get<{ success: boolean; data: ClaimsSummary }>(
        "/api/v1/ndis_claims/summary"
      );
      if (res?.data) setSummary(res.data);
    } catch {
      // Summary is non-critical
    } finally {
      setSummaryLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchClaims();
    fetchSummary();
  }, [fetchClaims, fetchSummary]);

  // Filter
  const filtered =
    statusFilter === "all" ? claims : claims.filter((c) => c.status === statusFilter);

  // Selection helpers
  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllDrafts = () => {
    const draftIds = filtered
      .filter((c) => c.status === "draft")
      .map((c) => c.id);
    setSelectedIds(new Set(draftIds));
  };

  const clearSelection = () => setSelectedIds(new Set());

  // Generate monthly claims
  const handleGenerateMonthly = async () => {
    setGenerating(true);
    try {
      const res = await api.post<{ success: boolean; data: NdisClaim[] }>(
        "/api/v1/ndis_claims/generate_monthly",
        {}
      );
      if (res?.data) {
        setClaims((prev) => {
          const existingIds = new Set(prev.map((c) => c.id));
          const newClaims = res.data.filter((c: NdisClaim) => !existingIds.has(c.id));
          return [...prev, ...newClaims];
        });
      }
      await fetchSummary();
    } catch {
      // Handle silently
    } finally {
      setGenerating(false);
    }
  };

  // Bulk submit
  const handleBulkSubmit = async () => {
    if (selectedIds.size === 0) return;
    setSubmitting(true);
    try {
      const res = await api.post<{ success: boolean; data: NdisClaim[] }>(
        "/api/v1/ndis_claims/bulk_submit",
        { ids: Array.from(selectedIds) }
      );
      if (res?.data) {
        const updatedMap = new Map(res.data.map((c: NdisClaim) => [c.id, c]));
        setClaims((prev) => prev.map((c) => updatedMap.get(c.id) ?? c));
        setSelectedIds(new Set());
      }
      await fetchSummary();
    } catch {
      // Handle silently
    } finally {
      setSubmitting(false);
    }
  };

  const summaryCards = summary
    ? [
        {
          title: "Total Claimed",
          value: `$${Math.round(summary.totalClaimed).toLocaleString()}`,
          icon: DollarSign,
          iconBg: "bg-blue-100 dark:bg-blue-900/30",
          iconColor: "text-blue-600 dark:text-blue-400",
        },
        {
          title: "Approved",
          value: `$${Math.round(summary.approved).toLocaleString()}`,
          icon: CheckCircle2,
          iconBg: "bg-green-100 dark:bg-green-900/30",
          iconColor: "text-green-600 dark:text-green-400",
        },
        {
          title: "Pending",
          value: `$${Math.round(summary.pending).toLocaleString()}`,
          icon: Clock,
          iconBg: "bg-amber-100 dark:bg-amber-900/30",
          iconColor: "text-amber-600 dark:text-amber-400",
        },
        {
          title: "Paid",
          value: `$${Math.round(summary.paid).toLocaleString()}`,
          icon: BanknoteIcon,
          iconBg: "bg-emerald-100 dark:bg-emerald-900/30",
          iconColor: "text-emerald-600 dark:text-emerald-400",
        },
      ]
    : [];

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {(summaryLoading || !summary ? Array.from({ length: 4 }) : summaryCards).map(
          (card, i) => {
            if (summaryLoading || !summary) {
              return (
                <Card key={i}>
                  <CardContent className="pt-5 pb-5">
                    <div className="flex items-center gap-3">
                      <Skeleton className="h-9 w-9 rounded-lg" />
                      <div>
                        <Skeleton className="h-3 w-20 mb-1" />
                        <Skeleton className="h-6 w-24" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            }
            const c = card as (typeof summaryCards)[number];
            return (
              <SummaryCard
                key={c.title}
                title={c.title}
                value={c.value}
                icon={c.icon}
                iconBg={c.iconBg}
                iconColor={c.iconColor}
                loading={false}
              />
            );
          }
        )}
      </div>

      {/* Actions bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Status filter */}
        <div className="flex flex-wrap gap-1">
          {STATUS_FILTERS.map((f) => (
            <Button
              key={f.value}
              variant={statusFilter === f.value ? "default" : "outline"}
              size="sm"
              className="h-7 text-xs px-2.5"
              onClick={() => setStatusFilter(f.value)}
            >
              {f.label}
              {f.value !== "all" && (
                <span className="ml-1.5 font-mono opacity-70">
                  {claims.filter((c) => c.status === f.value).length}
                </span>
              )}
            </Button>
          ))}
        </div>

        {/* Right side actions */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => { fetchClaims(); fetchSummary(); }}
            disabled={loading}
          >
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleGenerateMonthly}
            disabled={generating}
          >
            <Sparkles className="h-3.5 w-3.5 mr-1.5" />
            {generating ? "Generating…" : "Generate Monthly"}
          </Button>
          {selectedIds.size > 0 ? (
            <>
              <Button variant="outline" size="sm" onClick={clearSelection}>
                Clear ({selectedIds.size})
              </Button>
              <Button size="sm" onClick={handleBulkSubmit} disabled={submitting}>
                <Send className="h-3.5 w-3.5 mr-1.5" />
                {submitting ? "Submitting…" : `Submit ${selectedIds.size} Claim${selectedIds.size > 1 ? "s" : ""}`}
              </Button>
            </>
          ) : (
            <Button variant="outline" size="sm" onClick={selectAllDrafts}>
              Select All Drafts
            </Button>
          )}
        </div>
      </div>

      {/* Claims Table */}
      {error ? (
        <Card>
          <CardContent className="py-8 text-center">
            <AlertCircle className="h-7 w-7 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">Unable to load claims</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={fetchClaims}>
              Retry
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-secondary/50">
                    <th className="px-4 py-3 w-10">
                      <span className="sr-only">Select</span>
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Property / Participant
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Period
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Amount
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Date
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    Array.from({ length: 6 }).map((_, i) => (
                      <tr key={i} className="border-b border-border">
                        <td className="px-4 py-3">
                          <Skeleton className="h-4 w-4 rounded" />
                        </td>
                        <td className="px-4 py-3">
                          <Skeleton className="h-4 w-40 mb-1" />
                          <Skeleton className="h-3 w-28" />
                        </td>
                        <td className="px-4 py-3">
                          <Skeleton className="h-4 w-20" />
                        </td>
                        <td className="px-4 py-3">
                          <Skeleton className="h-4 w-16" />
                        </td>
                        <td className="px-4 py-3">
                          <Skeleton className="h-5 w-20 rounded" />
                        </td>
                        <td className="px-4 py-3">
                          <Skeleton className="h-3 w-24" />
                        </td>
                      </tr>
                    ))
                  ) : filtered.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-12 text-center">
                        <FileText className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                        <p className="text-sm text-muted-foreground">
                          {statusFilter === "all"
                            ? "No claims found"
                            : `No ${statusFilter} claims`}
                        </p>
                      </td>
                    </tr>
                  ) : (
                    filtered.map((claim) => (
                      <ClaimRow
                        key={claim.id}
                        claim={claim}
                        selected={selectedIds.has(claim.id)}
                        onToggle={toggleSelect}
                      />
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Table footer */}
            {!loading && filtered.length > 0 && (
              <div className="px-4 py-3 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  Showing{" "}
                  <span className="font-mono font-medium text-foreground">
                    {filtered.length}
                  </span>{" "}
                  of{" "}
                  <span className="font-mono font-medium text-foreground">{claims.length}</span>
                </span>
                {filtered.length > 10 && (
                  <Button variant="ghost" size="sm" className="text-xs h-6">
                    Load more
                    <ChevronDown className="h-3 w-3 ml-1" />
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
