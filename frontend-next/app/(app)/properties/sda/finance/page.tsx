"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { api } from "@/lib/api";
import {
  DollarSign,
  AlertCircle,
  RefreshCw,
  Plus,
  CheckSquare,
  TrendingDown,
  Clock,
  FileText,
  Send,
  Users,
  ArrowUpRight,
  CheckCircle2,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

type EntryType =
  | "rent_received"
  | "ndia_payment"
  | "participant_contribution"
  | "disbursement_to_owner"
  | "management_fee"
  | "bond_received"
  | "bond_refund";

interface LedgerEntry {
  id: number;
  date: string;
  propertyAddress: string;
  propertyId: number;
  type: EntryType;
  description: string;
  reference: string;
  debit: number | null;
  credit: number | null;
  balance: number;
  reconciled: boolean;
}

interface LedgerSummary {
  totalReceipts: number;
  totalDisbursements: number;
  trustBalance: number;
  unreconciledCount: number;
}

type ArrearStatus =
  | "current"
  | "reminder_sent"
  | "notice_issued"
  | "breach"
  | "referred"
  | "resolved";

interface ArrearRecord {
  id: number;
  propertyAddress: string;
  tenantName: string;
  amountOverdue: number;
  daysOverdue: number;
  status: ArrearStatus;
  firstMissedDate: string;
  lastActionDate: string;
}

interface ArrearsSummary {
  activeArrears: number;
  totalOverdueAmount: number;
  criticalCount: number;
  avgDaysOverdue: number;
}

type StatementType = "monthly" | "quarterly" | "annual" | "tax_summary";
type StatementStatus = "draft" | "generated" | "sent";

interface OwnerStatement {
  id: number;
  propertyAddress: string;
  ownerName: string;
  type: StatementType;
  period: string;
  grossIncome: number;
  expenses: number;
  netIncome: number;
  status: StatementStatus;
}

interface StatementsSummary {
  generatedThisMonth: number;
  sent: number;
  draft: number;
  totalDisbursed: number;
}

// ─── Config maps ─────────────────────────────────────────────────────────────

const ENTRY_TYPE_CONFIG: Record<EntryType, { label: string; bg: string; text: string }> = {
  rent_received: {
    label: "Rent Received",
    bg: "bg-green-100 dark:bg-green-900/30",
    text: "text-green-700 dark:text-green-300",
  },
  ndia_payment: {
    label: "NDIA Payment",
    bg: "bg-purple-100 dark:bg-purple-900/30",
    text: "text-purple-700 dark:text-purple-300",
  },
  participant_contribution: {
    label: "Participant Contribution",
    bg: "bg-blue-100 dark:bg-blue-900/30",
    text: "text-blue-700 dark:text-blue-300",
  },
  disbursement_to_owner: {
    label: "Disbursement",
    bg: "bg-red-100 dark:bg-red-900/30",
    text: "text-red-700 dark:text-red-300",
  },
  management_fee: {
    label: "Management Fee",
    bg: "bg-amber-100 dark:bg-amber-900/30",
    text: "text-amber-700 dark:text-amber-300",
  },
  bond_received: {
    label: "Bond Received",
    bg: "bg-gray-100 dark:bg-gray-800",
    text: "text-gray-600 dark:text-gray-400",
  },
  bond_refund: {
    label: "Bond Refund",
    bg: "bg-gray-100 dark:bg-gray-800",
    text: "text-gray-600 dark:text-gray-400",
  },
};

const ARREAR_STATUS_CONFIG: Record<
  ArrearStatus,
  { label: string; bg: string; text: string; border?: string }
> = {
  current: {
    label: "Current",
    bg: "bg-amber-100 dark:bg-amber-900/30",
    text: "text-amber-700 dark:text-amber-300",
  },
  reminder_sent: {
    label: "Reminder Sent",
    bg: "bg-orange-100 dark:bg-orange-900/30",
    text: "text-orange-700 dark:text-orange-300",
  },
  notice_issued: {
    label: "Notice Issued",
    bg: "bg-red-100 dark:bg-red-900/30",
    text: "text-red-700 dark:text-red-300",
  },
  breach: {
    label: "Breach",
    bg: "bg-red-200 dark:bg-red-900/60",
    text: "text-red-800 dark:text-red-200",
    border: "border-l-2 border-l-red-500",
  },
  referred: {
    label: "Referred",
    bg: "bg-purple-100 dark:bg-purple-900/30",
    text: "text-purple-700 dark:text-purple-300",
  },
  resolved: {
    label: "Resolved",
    bg: "bg-green-100 dark:bg-green-900/30",
    text: "text-green-700 dark:text-green-300",
  },
};

const STATEMENT_TYPE_CONFIG: Record<StatementType, { label: string; bg: string; text: string }> = {
  monthly: {
    label: "Monthly",
    bg: "bg-blue-100 dark:bg-blue-900/30",
    text: "text-blue-700 dark:text-blue-300",
  },
  quarterly: {
    label: "Quarterly",
    bg: "bg-purple-100 dark:bg-purple-900/30",
    text: "text-purple-700 dark:text-purple-300",
  },
  annual: {
    label: "Annual",
    bg: "bg-green-100 dark:bg-green-900/30",
    text: "text-green-700 dark:text-green-300",
  },
  tax_summary: {
    label: "Tax Summary",
    bg: "bg-amber-100 dark:bg-amber-900/30",
    text: "text-amber-700 dark:text-amber-300",
  },
};

const STATEMENT_STATUS_CONFIG: Record<
  StatementStatus,
  { label: string; bg: string; text: string }
> = {
  draft: {
    label: "Draft",
    bg: "bg-gray-100 dark:bg-gray-800",
    text: "text-gray-600 dark:text-gray-400",
  },
  generated: {
    label: "Generated",
    bg: "bg-blue-100 dark:bg-blue-900/30",
    text: "text-blue-700 dark:text-blue-300",
  },
  sent: {
    label: "Sent",
    bg: "bg-green-100 dark:bg-green-900/30",
    text: "text-green-700 dark:text-green-300",
  },
};

// ─── Shared components ────────────────────────────────────────────────────────

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

function SummaryCardSkeleton() {
  return (
    <Card>
      <CardContent className="pt-5 pb-5">
        <div className="flex items-center gap-3">
          <Skeleton className="h-9 w-9 rounded-lg" />
          <div>
            <Skeleton className="h-3 w-24 mb-1" />
            <Skeleton className="h-6 w-20" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function TableHeader({ children }: { children: string }) {
  return (
    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
      {children}
    </th>
  );
}

function EmptyRow({ cols, message }: { cols: number; message: string }) {
  return (
    <tr>
      <td colSpan={cols} className="px-4 py-12 text-center">
        <FileText className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
        <p className="text-sm text-muted-foreground">{message}</p>
      </td>
    </tr>
  );
}

function SkeletonRows({ cols, count = 5 }: { cols: number; count?: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <tr key={i} className="border-b border-border">
          {Array.from({ length: cols }).map((_, j) => (
            <td key={j} className="px-4 py-3">
              <Skeleton className="h-4 w-full max-w-[120px]" />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

// ─── Tab 1: Rent Ledger ───────────────────────────────────────────────────────

function RentLedgerTab() {
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [summary, setSummary] = useState<LedgerSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [error, setError] = useState(false);
  const [propertyFilter, setPropertyFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<EntryType | "all">("all");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [reconciling, setReconciling] = useState(false);

  const fetchEntries = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await api.get<{ success: boolean; data: LedgerEntry[] }>(
        "/api/v1/sda/rent_ledger"
      );
      if (res?.data) setEntries(res.data);
      else if (Array.isArray(res)) setEntries(res as LedgerEntry[]);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchSummary = useCallback(async () => {
    setSummaryLoading(true);
    try {
      const res = await api.get<{ success: boolean; data: LedgerSummary }>(
        "/api/v1/sda/rent_ledger/balance"
      );
      if (res?.data) setSummary(res.data);
    } catch {
      // Non-critical
    } finally {
      setSummaryLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEntries();
    fetchSummary();
  }, [fetchEntries, fetchSummary]);

  const properties = Array.from(new Set(entries.map((e) => e.propertyAddress))).sort();

  const filtered = entries.filter((e) => {
    const matchProp = propertyFilter === "all" || e.propertyAddress === propertyFilter;
    const matchType = typeFilter === "all" || e.type === typeFilter;
    return matchProp && matchType;
  });

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleReconcileSelected = async () => {
    if (selectedIds.size === 0) return;
    setReconciling(true);
    try {
      const res = await api.post<{ success: boolean; data: LedgerEntry[] }>(
        "/api/v1/sda/rent_ledger/reconcile",
        { ids: Array.from(selectedIds) }
      );
      if (res?.data) {
        const map = new Map(res.data.map((e: LedgerEntry) => [e.id, e]));
        setEntries((prev) => prev.map((e) => map.get(e.id) ?? e));
        setSelectedIds(new Set());
      }
    } catch {
      // Handle silently
    } finally {
      setReconciling(false);
    }
  };

  const summaryCards = summary
    ? [
        {
          title: "Total Receipts (This Month)",
          value: `$${Math.round(summary.totalReceipts).toLocaleString()}`,
          icon: ArrowUpRight,
          iconBg: "bg-green-100 dark:bg-green-900/30",
          iconColor: "text-green-600 dark:text-green-400",
        },
        {
          title: "Total Disbursements",
          value: `$${Math.round(summary.totalDisbursements).toLocaleString()}`,
          icon: TrendingDown,
          iconBg: "bg-red-100 dark:bg-red-900/30",
          iconColor: "text-red-600 dark:text-red-400",
        },
        {
          title: "Trust Balance",
          value: `$${Math.round(summary.trustBalance).toLocaleString()}`,
          icon: DollarSign,
          iconBg: "bg-blue-100 dark:bg-blue-900/30",
          iconColor: "text-blue-600 dark:text-blue-400",
        },
        {
          title: "Unreconciled",
          value: summary.unreconciledCount,
          icon: CheckSquare,
          iconBg: "bg-amber-100 dark:bg-amber-900/30",
          iconColor: "text-amber-600 dark:text-amber-400",
        },
      ]
    : [];

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {summaryLoading || !summary
          ? Array.from({ length: 4 }).map((_, i) => <SummaryCardSkeleton key={i} />)
          : summaryCards.map((c) => (
              <SummaryCard
                key={c.title}
                title={c.title}
                value={c.value}
                icon={c.icon}
                iconBg={c.iconBg}
                iconColor={c.iconColor}
                loading={false}
              />
            ))}
      </div>

      {/* Filters + actions */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={propertyFilter}
            onChange={(e) => setPropertyFilter(e.target.value)}
            className="text-sm border border-border rounded-md px-3 py-1.5 bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            aria-label="Filter by property"
          >
            <option value="all">All Properties</option>
            {properties.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as EntryType | "all")}
            className="text-sm border border-border rounded-md px-3 py-1.5 bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            aria-label="Filter by entry type"
          >
            <option value="all">All Types</option>
            {(Object.keys(ENTRY_TYPE_CONFIG) as EntryType[]).map((t) => (
              <option key={t} value={t}>
                {ENTRY_TYPE_CONFIG[t].label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              fetchEntries();
              fetchSummary();
            }}
            disabled={loading}
          >
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          {selectedIds.size > 0 && (
            <Button size="sm" variant="outline" onClick={handleReconcileSelected} disabled={reconciling}>
              <CheckSquare className="h-3.5 w-3.5 mr-1.5" />
              {reconciling ? "Reconciling…" : `Reconcile ${selectedIds.size}`}
            </Button>
          )}
          <Button size="sm">
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            Add Entry
          </Button>
        </div>
      </div>

      {/* Table */}
      {error ? (
        <Card>
          <CardContent className="py-8 text-center">
            <AlertCircle className="h-7 w-7 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">Unable to load ledger entries</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={fetchEntries}>
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
                    <TableHeader>Date</TableHeader>
                    <TableHeader>Property</TableHeader>
                    <TableHeader>Type</TableHeader>
                    <TableHeader>Description</TableHeader>
                    <TableHeader>Reference</TableHeader>
                    <TableHeader>Debit</TableHeader>
                    <TableHeader>Credit</TableHeader>
                    <TableHeader>Balance</TableHeader>
                    <TableHeader>Reconciled</TableHeader>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <SkeletonRows cols={10} />
                  ) : filtered.length === 0 ? (
                    <EmptyRow cols={10} message="No ledger entries found" />
                  ) : (
                    filtered.map((entry) => {
                      const typeCfg = ENTRY_TYPE_CONFIG[entry.type];
                      return (
                        <tr
                          key={entry.id}
                          className={`border-b border-border transition-colors ${
                            selectedIds.has(entry.id) ? "bg-primary/5" : "hover:bg-secondary/40"
                          }`}
                        >
                          <td className="px-4 py-3 w-10">
                            {!entry.reconciled && (
                              <input
                                type="checkbox"
                                checked={selectedIds.has(entry.id)}
                                onChange={() => toggleSelect(entry.id)}
                                className="rounded border-border"
                                aria-label={`Select entry ${entry.reference}`}
                              />
                            )}
                          </td>
                          <td className="px-4 py-3 text-xs font-mono text-muted-foreground whitespace-nowrap">
                            {entry.date}
                          </td>
                          <td className="px-4 py-3 text-sm">
                            <span className="truncate max-w-[140px] block">{entry.propertyAddress}</span>
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${typeCfg.bg} ${typeCfg.text}`}
                            >
                              {typeCfg.label}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-muted-foreground max-w-[180px] truncate">
                            {entry.description}
                          </td>
                          <td className="px-4 py-3 text-xs font-mono text-muted-foreground">
                            {entry.reference || "—"}
                          </td>
                          <td className="px-4 py-3 text-sm font-mono text-red-600 dark:text-red-400">
                            {entry.debit != null ? `$${entry.debit.toLocaleString()}` : "—"}
                          </td>
                          <td className="px-4 py-3 text-sm font-mono text-green-600 dark:text-green-400">
                            {entry.credit != null ? `$${entry.credit.toLocaleString()}` : "—"}
                          </td>
                          <td className="px-4 py-3 text-sm font-mono font-semibold">
                            ${entry.balance.toLocaleString()}
                          </td>
                          <td className="px-4 py-3">
                            {entry.reconciled ? (
                              <CheckCircle2 className="h-4 w-4 text-green-500" />
                            ) : (
                              <span className="h-4 w-4 rounded-full border border-border inline-block" />
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
            {!loading && filtered.length > 0 && (
              <div className="px-4 py-3 border-t border-border text-xs text-muted-foreground">
                Showing{" "}
                <span className="font-mono font-medium text-foreground">{filtered.length}</span> of{" "}
                <span className="font-mono font-medium text-foreground">{entries.length}</span>{" "}
                entries
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── Tab 2: Arrears ───────────────────────────────────────────────────────────

function ArrearsTab() {
  const [arrears, setArrears] = useState<ArrearRecord[]>([]);
  const [summary, setSummary] = useState<ArrearsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [error, setError] = useState(false);
  const [escalating, setEscalating] = useState<number | null>(null);
  const [resolving, setResolving] = useState<number | null>(null);

  const fetchArrears = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await api.get<{ success: boolean; data: ArrearRecord[] }>(
        "/api/v1/sda/rent_ledger/arrears"
      );
      if (res?.data) setArrears(res.data);
      else if (Array.isArray(res)) setArrears(res as ArrearRecord[]);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchSummary = useCallback(async () => {
    setSummaryLoading(true);
    try {
      const res = await api.get<{ success: boolean; data: ArrearsSummary }>(
        "/api/v1/sda/rent_ledger/arrears/summary"
      );
      if (res?.data) setSummary(res.data);
    } catch {
      // Non-critical
    } finally {
      setSummaryLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchArrears();
    fetchSummary();
  }, [fetchArrears, fetchSummary]);

  const handleEscalate = async (id: number) => {
    setEscalating(id);
    try {
      const res = await api.post<{ success: boolean; data: ArrearRecord }>(
        `/api/v1/sda/rent_ledger/arrears/${id}/escalate`,
        {}
      );
      if (res?.data) {
        setArrears((prev) => prev.map((a) => (a.id === id ? res.data : a)));
      }
    } catch {
      // Handle silently
    } finally {
      setEscalating(null);
    }
  };

  const handleResolve = async (id: number) => {
    setResolving(id);
    try {
      const res = await api.post<{ success: boolean; data: ArrearRecord }>(
        `/api/v1/sda/rent_ledger/arrears/${id}/resolve`,
        {}
      );
      if (res?.data) {
        setArrears((prev) => prev.map((a) => (a.id === id ? res.data : a)));
      }
    } catch {
      // Handle silently
    } finally {
      setResolving(null);
    }
  };

  const summaryCards = summary
    ? [
        {
          title: "Active Arrears",
          value: summary.activeArrears,
          icon: AlertCircle,
          iconBg: "bg-amber-100 dark:bg-amber-900/30",
          iconColor: "text-amber-600 dark:text-amber-400",
        },
        {
          title: "Total Overdue",
          value: `$${Math.round(summary.totalOverdueAmount).toLocaleString()}`,
          icon: DollarSign,
          iconBg: "bg-red-100 dark:bg-red-900/30",
          iconColor: "text-red-600 dark:text-red-400",
        },
        {
          title: "Critical (>14 days)",
          value: summary.criticalCount,
          icon: TrendingDown,
          iconBg: "bg-red-100 dark:bg-red-900/30",
          iconColor: "text-red-600 dark:text-red-400",
        },
        {
          title: "Avg Days Overdue",
          value: `${Math.round(summary.avgDaysOverdue)}d`,
          icon: Clock,
          iconBg: "bg-orange-100 dark:bg-orange-900/30",
          iconColor: "text-orange-600 dark:text-orange-400",
        },
      ]
    : [];

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {summaryLoading || !summary
          ? Array.from({ length: 4 }).map((_, i) => <SummaryCardSkeleton key={i} />)
          : summaryCards.map((c) => (
              <SummaryCard
                key={c.title}
                title={c.title}
                value={c.value}
                icon={c.icon}
                iconBg={c.iconBg}
                iconColor={c.iconColor}
                loading={false}
              />
            ))}
      </div>

      {/* Actions bar */}
      <div className="flex justify-end">
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            fetchArrears();
            fetchSummary();
          }}
          disabled={loading}
        >
          <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Table */}
      {error ? (
        <Card>
          <CardContent className="py-8 text-center">
            <AlertCircle className="h-7 w-7 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">Unable to load arrears</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={fetchArrears}>
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
                    <TableHeader>Property</TableHeader>
                    <TableHeader>Tenant</TableHeader>
                    <TableHeader>Amount Overdue</TableHeader>
                    <TableHeader>Days Overdue</TableHeader>
                    <TableHeader>Status</TableHeader>
                    <TableHeader>First Missed</TableHeader>
                    <TableHeader>Last Action</TableHeader>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <SkeletonRows cols={8} />
                  ) : arrears.length === 0 ? (
                    <EmptyRow cols={8} message="No active arrears" />
                  ) : (
                    arrears.map((arrear) => {
                      const statusCfg = ARREAR_STATUS_CONFIG[arrear.status];
                      const isCritical = arrear.daysOverdue > 14;
                      return (
                        <tr
                          key={arrear.id}
                          className={`border-b border-border transition-colors hover:bg-secondary/40 ${
                            isCritical ? "border-l-2 border-l-red-500" : ""
                          }`}
                        >
                          <td className="px-4 py-3 text-sm">
                            <span className="truncate max-w-[160px] block font-medium">
                              {arrear.propertyAddress}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-muted-foreground">
                            {arrear.tenantName}
                          </td>
                          <td className="px-4 py-3 text-sm font-mono font-semibold text-red-600 dark:text-red-400">
                            ${arrear.amountOverdue.toLocaleString()}
                          </td>
                          <td className="px-4 py-3 text-sm font-mono">
                            <span
                              className={
                                isCritical
                                  ? "text-red-600 dark:text-red-400 font-bold"
                                  : "text-foreground"
                              }
                            >
                              {arrear.daysOverdue}d
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${statusCfg.bg} ${statusCfg.text}`}
                            >
                              {statusCfg.label}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs font-mono text-muted-foreground">
                            {arrear.firstMissedDate}
                          </td>
                          <td className="px-4 py-3 text-xs font-mono text-muted-foreground">
                            {arrear.lastActionDate}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-end gap-1.5">
                              {arrear.status !== "resolved" && (
                                <>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 text-xs px-2"
                                    onClick={() => handleEscalate(arrear.id)}
                                    disabled={escalating === arrear.id}
                                  >
                                    {escalating === arrear.id ? "…" : "Escalate"}
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 text-xs px-2 text-green-600 border-green-300 hover:bg-green-50 dark:text-green-400 dark:border-green-700 dark:hover:bg-green-950"
                                    onClick={() => handleResolve(arrear.id)}
                                    disabled={resolving === arrear.id}
                                  >
                                    {resolving === arrear.id ? "…" : "Resolve"}
                                  </Button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
            {!loading && arrears.length > 0 && (
              <div className="px-4 py-3 border-t border-border text-xs text-muted-foreground">
                <span className="font-mono font-medium text-foreground">{arrears.length}</span>{" "}
                arrear records
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── Tab 3: Owner Statements ──────────────────────────────────────────────────

function OwnerStatementsTab() {
  const [statements, setStatements] = useState<OwnerStatement[]>([]);
  const [summary, setSummary] = useState<StatementsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [error, setError] = useState(false);
  const [propertyFilter, setPropertyFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<StatementType | "all">("all");
  const [statusFilter, setStatusFilter] = useState<StatementStatus | "all">("all");
  const [generating, setGenerating] = useState<number | null>(null);
  const [sending, setSending] = useState<number | null>(null);

  const fetchStatements = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await api.get<{ success: boolean; data: OwnerStatement[] }>(
        "/api/v1/sda/owner_statements"
      );
      if (res?.data) setStatements(res.data);
      else if (Array.isArray(res)) setStatements(res as OwnerStatement[]);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchSummary = useCallback(async () => {
    setSummaryLoading(true);
    try {
      const res = await api.get<{ success: boolean; data: StatementsSummary }>(
        "/api/v1/sda/owner_statements/summary"
      );
      if (res?.data) setSummary(res.data);
    } catch {
      // Non-critical
    } finally {
      setSummaryLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatements();
    fetchSummary();
  }, [fetchStatements, fetchSummary]);

  const handleGenerate = async (id: number) => {
    setGenerating(id);
    try {
      const res = await api.post<{ success: boolean; data: OwnerStatement }>(
        `/api/v1/sda/owner_statements/${id}/generate`,
        {}
      );
      if (res?.data) {
        setStatements((prev) => prev.map((s) => (s.id === id ? res.data : s)));
      }
      await fetchSummary();
    } catch {
      // Handle silently
    } finally {
      setGenerating(null);
    }
  };

  const handleSend = async (id: number) => {
    setSending(id);
    try {
      const res = await api.post<{ success: boolean; data: OwnerStatement }>(
        `/api/v1/sda/owner_statements/${id}/send_statement`,
        {}
      );
      if (res?.data) {
        setStatements((prev) => prev.map((s) => (s.id === id ? res.data : s)));
      }
      await fetchSummary();
    } catch {
      // Handle silently
    } finally {
      setSending(null);
    }
  };

  const properties = Array.from(new Set(statements.map((s) => s.propertyAddress))).sort();

  const filtered = statements.filter((s) => {
    const matchProp = propertyFilter === "all" || s.propertyAddress === propertyFilter;
    const matchType = typeFilter === "all" || s.type === typeFilter;
    const matchStatus = statusFilter === "all" || s.status === statusFilter;
    return matchProp && matchType && matchStatus;
  });

  const summaryCards = summary
    ? [
        {
          title: "Generated (This Month)",
          value: summary.generatedThisMonth,
          icon: FileText,
          iconBg: "bg-blue-100 dark:bg-blue-900/30",
          iconColor: "text-blue-600 dark:text-blue-400",
        },
        {
          title: "Sent",
          value: summary.sent,
          icon: Send,
          iconBg: "bg-green-100 dark:bg-green-900/30",
          iconColor: "text-green-600 dark:text-green-400",
        },
        {
          title: "Draft",
          value: summary.draft,
          icon: Clock,
          iconBg: "bg-gray-100 dark:bg-gray-800",
          iconColor: "text-gray-600 dark:text-gray-400",
        },
        {
          title: "Total Disbursed",
          value: `$${Math.round(summary.totalDisbursed).toLocaleString()}`,
          icon: DollarSign,
          iconBg: "bg-emerald-100 dark:bg-emerald-900/30",
          iconColor: "text-emerald-600 dark:text-emerald-400",
        },
      ]
    : [];

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {summaryLoading || !summary
          ? Array.from({ length: 4 }).map((_, i) => <SummaryCardSkeleton key={i} />)
          : summaryCards.map((c) => (
              <SummaryCard
                key={c.title}
                title={c.title}
                value={c.value}
                icon={c.icon}
                iconBg={c.iconBg}
                iconColor={c.iconColor}
                loading={false}
              />
            ))}
      </div>

      {/* Filters + actions */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={propertyFilter}
            onChange={(e) => setPropertyFilter(e.target.value)}
            className="text-sm border border-border rounded-md px-3 py-1.5 bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            aria-label="Filter by property"
          >
            <option value="all">All Properties</option>
            {properties.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as StatementType | "all")}
            className="text-sm border border-border rounded-md px-3 py-1.5 bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            aria-label="Filter by statement type"
          >
            <option value="all">All Types</option>
            {(Object.keys(STATEMENT_TYPE_CONFIG) as StatementType[]).map((t) => (
              <option key={t} value={t}>
                {STATEMENT_TYPE_CONFIG[t].label}
              </option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatementStatus | "all")}
            className="text-sm border border-border rounded-md px-3 py-1.5 bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            aria-label="Filter by status"
          >
            <option value="all">All Statuses</option>
            {(Object.keys(STATEMENT_STATUS_CONFIG) as StatementStatus[]).map((s) => (
              <option key={s} value={s}>
                {STATEMENT_STATUS_CONFIG[s].label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              fetchStatements();
              fetchSummary();
            }}
            disabled={loading}
          >
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button size="sm">
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            Generate Statement
          </Button>
        </div>
      </div>

      {/* Table */}
      {error ? (
        <Card>
          <CardContent className="py-8 text-center">
            <AlertCircle className="h-7 w-7 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">Unable to load owner statements</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={fetchStatements}>
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
                    <TableHeader>Property</TableHeader>
                    <TableHeader>Owner</TableHeader>
                    <TableHeader>Type</TableHeader>
                    <TableHeader>Period</TableHeader>
                    <TableHeader>Gross Income</TableHeader>
                    <TableHeader>Expenses</TableHeader>
                    <TableHeader>Net Income</TableHeader>
                    <TableHeader>Status</TableHeader>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <SkeletonRows cols={9} />
                  ) : filtered.length === 0 ? (
                    <EmptyRow cols={9} message="No owner statements found" />
                  ) : (
                    filtered.map((stmt) => {
                      const typeCfg = STATEMENT_TYPE_CONFIG[stmt.type];
                      const statusCfg = STATEMENT_STATUS_CONFIG[stmt.status];
                      return (
                        <tr
                          key={stmt.id}
                          className="border-b border-border transition-colors hover:bg-secondary/40"
                        >
                          <td className="px-4 py-3 text-sm">
                            <span className="truncate max-w-[140px] block font-medium">
                              {stmt.propertyAddress}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-muted-foreground">
                            <div className="flex items-center gap-1.5">
                              <Users className="h-3.5 w-3.5 shrink-0" />
                              {stmt.ownerName}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${typeCfg.bg} ${typeCfg.text}`}
                            >
                              {typeCfg.label}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs font-mono text-muted-foreground">
                            {stmt.period}
                          </td>
                          <td className="px-4 py-3 text-sm font-mono text-green-600 dark:text-green-400">
                            ${stmt.grossIncome.toLocaleString()}
                          </td>
                          <td className="px-4 py-3 text-sm font-mono text-red-600 dark:text-red-400">
                            ${stmt.expenses.toLocaleString()}
                          </td>
                          <td className="px-4 py-3 text-sm font-mono font-semibold">
                            ${stmt.netIncome.toLocaleString()}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${statusCfg.bg} ${statusCfg.text}`}
                            >
                              {statusCfg.label}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-end gap-1.5">
                              {stmt.status === "draft" && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-xs px-2"
                                  onClick={() => handleGenerate(stmt.id)}
                                  disabled={generating === stmt.id}
                                >
                                  {generating === stmt.id ? "…" : "Generate"}
                                </Button>
                              )}
                              {stmt.status === "generated" && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-xs px-2"
                                  onClick={() => handleSend(stmt.id)}
                                  disabled={sending === stmt.id}
                                >
                                  <Send className="h-3 w-3 mr-1" />
                                  {sending === stmt.id ? "…" : "Send"}
                                </Button>
                              )}
                              {stmt.status === "sent" && (
                                <span className="text-xs text-green-600 dark:text-green-400 font-medium flex items-center gap-1">
                                  <CheckCircle2 className="h-3.5 w-3.5" />
                                  Sent
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
            {!loading && filtered.length > 0 && (
              <div className="px-4 py-3 border-t border-border text-xs text-muted-foreground">
                Showing{" "}
                <span className="font-mono font-medium text-foreground">{filtered.length}</span> of{" "}
                <span className="font-mono font-medium text-foreground">{statements.length}</span>{" "}
                statements
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function SdaFinancePage() {
  return (
    <div className="space-y-6">
      <Tabs defaultValue="rent-ledger">
        <TabsList className="mb-2">
          <TabsTrigger value="rent-ledger">Rent Ledger</TabsTrigger>
          <TabsTrigger value="arrears">Arrears</TabsTrigger>
          <TabsTrigger value="owner-statements">Owner Statements</TabsTrigger>
        </TabsList>

        <TabsContent value="rent-ledger">
          <RentLedgerTab />
        </TabsContent>

        <TabsContent value="arrears">
          <ArrearsTab />
        </TabsContent>

        <TabsContent value="owner-statements">
          <OwnerStatementsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
