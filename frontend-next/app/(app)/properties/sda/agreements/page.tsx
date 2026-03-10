"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  XCircle,
  RefreshCw,
  FilePlus,
  FileText,
  ChevronDown,
  RotateCcw,
  Send,
  PenLine,
  Home,
  User,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type AgreementStatus =
  | "draft"
  | "sent"
  | "signed"
  | "active"
  | "expired"
  | "terminated";

type AgreementType =
  | "sda_accommodation"
  | "service_agreement"
  | "sil_agreement";

interface SdaAgreement {
  id: number;
  propertyAddress: string;
  participantName?: string;
  type: AgreementType;
  status: AgreementStatus;
  startDate?: string;
  endDate?: string;
  weeklyRate?: number;
  daysUntilExpiry?: number | null;
  createdAt?: string;
}

interface AgreementsSummary {
  total: number;
  active: number;
  expiringSoon: number;
  expired: number;
}

type StatusFilter = AgreementStatus | "all";
type TypeFilter = AgreementType | "all";

// ─── New Agreement Form State ─────────────────────────────────────────────────

interface NewAgreementForm {
  propertyAddress: string;
  participantName: string;
  type: AgreementType;
  startDate: string;
  endDate: string;
  weeklyRate: string;
}

const EMPTY_FORM: NewAgreementForm = {
  propertyAddress: "",
  participantName: "",
  type: "sda_accommodation",
  startDate: "",
  endDate: "",
  weeklyRate: "",
};

// ─── Status config ─────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<
  AgreementStatus,
  { label: string; bg: string; text: string; icon: React.ElementType }
> = {
  draft: {
    label: "Draft",
    bg: "bg-gray-100 dark:bg-gray-800",
    text: "text-gray-600 dark:text-gray-400",
    icon: FileText,
  },
  sent: {
    label: "Sent",
    bg: "bg-blue-100 dark:bg-blue-900/30",
    text: "text-blue-700 dark:text-blue-300",
    icon: Send,
  },
  signed: {
    label: "Signed",
    bg: "bg-amber-100 dark:bg-amber-900/30",
    text: "text-amber-700 dark:text-amber-300",
    icon: PenLine,
  },
  active: {
    label: "Active",
    bg: "bg-green-100 dark:bg-green-900/30",
    text: "text-green-700 dark:text-green-300",
    icon: CheckCircle2,
  },
  expired: {
    label: "Expired",
    bg: "bg-red-100 dark:bg-red-900/30",
    text: "text-red-700 dark:text-red-300",
    icon: XCircle,
  },
  terminated: {
    label: "Terminated",
    bg: "bg-red-100 dark:bg-red-900/30",
    text: "text-red-700 dark:text-red-300",
    icon: XCircle,
  },
};

// ─── Agreement type config ─────────────────────────────────────────────────────

const TYPE_CONFIG: Record<
  AgreementType,
  { label: string; bg: string; text: string }
> = {
  sda_accommodation: {
    label: "SDA Accommodation",
    bg: "bg-purple-100 dark:bg-purple-900/30",
    text: "text-purple-700 dark:text-purple-300",
  },
  service_agreement: {
    label: "Service Agreement",
    bg: "bg-blue-100 dark:bg-blue-900/30",
    text: "text-blue-700 dark:text-blue-300",
  },
  sil_agreement: {
    label: "SIL Agreement",
    bg: "bg-green-100 dark:bg-green-900/30",
    text: "text-green-700 dark:text-green-300",
  },
};

// ─── Sub-components ────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: AgreementStatus }) {
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

function TypeBadge({ type }: { type: AgreementType }) {
  const cfg = TYPE_CONFIG[type];
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${cfg.bg} ${cfg.text}`}
    >
      {cfg.label}
    </span>
  );
}

function ExpiryBadge({ days }: { days: number }) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 ml-1.5">
      <Clock className="h-3 w-3" />
      {days}d
    </span>
  );
}

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

// ─── Inline New Agreement Form ─────────────────────────────────────────────────

function NewAgreementRow({
  onSave,
  onCancel,
  saving,
}: {
  onSave: (form: NewAgreementForm) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const [form, setForm] = useState<NewAgreementForm>(EMPTY_FORM);

  const set = (field: keyof NewAgreementForm, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleSave = () => {
    if (!form.propertyAddress.trim()) return;
    onSave(form);
  };

  const inputCls =
    "w-full px-2 py-1 text-sm border border-input rounded bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-ring";

  return (
    <tr className="border-b border-border bg-primary/5">
      <td className="px-4 py-2">
        <input
          className={inputCls}
          placeholder="Property address"
          value={form.propertyAddress}
          onChange={(e) => set("propertyAddress", e.target.value)}
          autoFocus
          aria-label="Property address"
        />
      </td>
      <td className="px-4 py-2">
        <input
          className={inputCls}
          placeholder="Participant name"
          value={form.participantName}
          onChange={(e) => set("participantName", e.target.value)}
          aria-label="Participant name"
        />
      </td>
      <td className="px-4 py-2">
        <select
          className={inputCls}
          value={form.type}
          onChange={(e) => set("type", e.target.value as AgreementType)}
          aria-label="Agreement type"
        >
          <option value="sda_accommodation">SDA Accommodation</option>
          <option value="service_agreement">Service Agreement</option>
          <option value="sil_agreement">SIL Agreement</option>
        </select>
      </td>
      <td className="px-4 py-2">
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
          Draft
        </span>
      </td>
      <td className="px-4 py-2">
        <input
          type="date"
          className={inputCls}
          value={form.startDate}
          onChange={(e) => set("startDate", e.target.value)}
          aria-label="Start date"
        />
      </td>
      <td className="px-4 py-2">
        <input
          type="date"
          className={inputCls}
          value={form.endDate}
          onChange={(e) => set("endDate", e.target.value)}
          aria-label="End date"
        />
      </td>
      <td className="px-4 py-2">
        <input
          type="number"
          className={inputCls}
          placeholder="0.00"
          value={form.weeklyRate}
          onChange={(e) => set("weeklyRate", e.target.value)}
          aria-label="Weekly rate"
        />
      </td>
      <td className="px-4 py-2 text-muted-foreground text-xs">—</td>
      <td className="px-4 py-2">
        <div className="flex items-center gap-1.5">
          <Button size="sm" className="h-7 text-xs" onClick={handleSave} disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-xs"
            onClick={onCancel}
            disabled={saving}
          >
            Cancel
          </Button>
        </div>
      </td>
    </tr>
  );
}

// ─── Table Row ────────────────────────────────────────────────────────────────

function AgreementRow({ agreement }: { agreement: SdaAgreement }) {
  const isExpiringSoon =
    agreement.daysUntilExpiry != null &&
    agreement.daysUntilExpiry >= 0 &&
    agreement.daysUntilExpiry <= 30;

  return (
    <tr className="border-b border-border transition-colors hover:bg-secondary/40">
      <td className="px-4 py-3 text-sm">
        <div className="font-medium truncate max-w-[180px]">
          {agreement.propertyAddress}
        </div>
      </td>
      <td className="px-4 py-3 text-sm">
        {agreement.participantName ? (
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <User className="h-3 w-3 shrink-0" />
            <span className="truncate max-w-[150px]">{agreement.participantName}</span>
          </div>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </td>
      <td className="px-4 py-3">
        <TypeBadge type={agreement.type} />
      </td>
      <td className="px-4 py-3">
        <StatusBadge status={agreement.status} />
      </td>
      <td className="px-4 py-3 text-xs text-muted-foreground font-mono">
        {agreement.startDate ?? "—"}
      </td>
      <td className="px-4 py-3 text-xs text-muted-foreground font-mono">
        {agreement.endDate ?? "—"}
      </td>
      <td className="px-4 py-3 text-sm font-mono font-semibold">
        {agreement.weeklyRate != null
          ? `$${agreement.weeklyRate.toLocaleString()}`
          : "—"}
      </td>
      <td className="px-4 py-3 text-xs">
        {agreement.daysUntilExpiry == null ? (
          <span className="text-muted-foreground">—</span>
        ) : agreement.daysUntilExpiry < 0 ? (
          <span className="text-red-600 dark:text-red-400 font-semibold">Expired</span>
        ) : isExpiringSoon ? (
          <ExpiryBadge days={agreement.daysUntilExpiry} />
        ) : (
          <span className="text-muted-foreground font-mono">
            {agreement.daysUntilExpiry}d
          </span>
        )}
      </td>
      <td className="px-4 py-3 w-10" />
    </tr>
  );
}

// ─── Filters ───────────────────────────────────────────────────────────────────

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "draft", label: "Draft" },
  { value: "sent", label: "Sent" },
  { value: "signed", label: "Signed" },
  { value: "active", label: "Active" },
  { value: "expired", label: "Expired" },
  { value: "terminated", label: "Terminated" },
];

const TYPE_FILTERS: { value: TypeFilter; label: string }[] = [
  { value: "all", label: "All Types" },
  { value: "sda_accommodation", label: "SDA Accommodation" },
  { value: "service_agreement", label: "Service Agreement" },
  { value: "sil_agreement", label: "SIL Agreement" },
];

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function SdaAgreementsPage() {
  const [agreements, setAgreements] = useState<SdaAgreement[]>([]);
  const [summary, setSummary] = useState<AgreementsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [error, setError] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [showNewRow, setShowNewRow] = useState(false);
  const [saving, setSaving] = useState(false);
  const [bulkRenewing, setBulkRenewing] = useState(false);

  // ─── Fetch ──────────────────────────────────────────────────────────────────

  const fetchAgreements = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await api.get<{ success: boolean; data: SdaAgreement[] }>(
        "/api/v1/sda/agreements"
      );
      if (res?.data) setAgreements(res.data);
      else if (Array.isArray(res)) setAgreements(res as SdaAgreement[]);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchSummary = useCallback(async () => {
    setSummaryLoading(true);
    try {
      const res = await api.get<{ success: boolean; data: AgreementsSummary }>(
        "/api/v1/sda/agreements/expiring_soon"
      );
      if (res?.data) {
        // expiring_soon endpoint returns expiring agreements; derive summary counts
        // from the main list once both are loaded
        setSummary(res.data as unknown as AgreementsSummary);
      }
    } catch {
      // Summary is non-critical — derive from loaded agreements
    } finally {
      setSummaryLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAgreements();
    fetchSummary();
  }, [fetchAgreements, fetchSummary]);

  // Derive summary counts from the loaded agreements list as the authoritative source
  const derivedSummary: AgreementsSummary = {
    total: agreements.length,
    active: agreements.filter((a) => a.status === "active").length,
    expiringSoon: agreements.filter(
      (a) =>
        a.daysUntilExpiry != null &&
        a.daysUntilExpiry >= 0 &&
        a.daysUntilExpiry <= 30
    ).length,
    expired: agreements.filter((a) => a.status === "expired").length,
  };

  // Override server summary with derived once agreements are loaded
  const displaySummary: AgreementsSummary =
    loading ? (summary ?? derivedSummary) : derivedSummary;

  // ─── Filter ─────────────────────────────────────────────────────────────────

  const filtered = agreements.filter((a) => {
    const matchStatus = statusFilter === "all" || a.status === statusFilter;
    const matchType = typeFilter === "all" || a.type === typeFilter;
    return matchStatus && matchType;
  });

  // ─── Create ─────────────────────────────────────────────────────────────────

  const handleCreate = async (form: NewAgreementForm) => {
    setSaving(true);
    try {
      const res = await api.post<{ success: boolean; data: SdaAgreement }>(
        "/api/v1/sda/agreements",
        {
          property_address: form.propertyAddress,
          participant_name: form.participantName,
          agreement_type: form.type,
          start_date: form.startDate || null,
          end_date: form.endDate || null,
          weekly_rate: form.weeklyRate ? parseFloat(form.weeklyRate) : null,
        }
      );
      if (res?.data) {
        setAgreements((prev) => [res.data, ...prev]);
        setShowNewRow(false);
      }
    } catch {
      // Keep form open on error
    } finally {
      setSaving(false);
    }
  };

  // ─── Bulk Renew ──────────────────────────────────────────────────────────────

  const handleBulkRenew = async () => {
    const expiringIds = agreements
      .filter(
        (a) =>
          a.daysUntilExpiry != null &&
          a.daysUntilExpiry >= 0 &&
          a.daysUntilExpiry <= 30
      )
      .map((a) => a.id);

    if (expiringIds.length === 0) return;

    setBulkRenewing(true);
    try {
      const res = await api.post<{ success: boolean; data: SdaAgreement[] }>(
        "/api/v1/sda/agreements/bulk_renew",
        { ids: expiringIds }
      );
      if (res?.data) {
        const updatedMap = new Map(res.data.map((a: SdaAgreement) => [a.id, a]));
        setAgreements((prev) => prev.map((a) => updatedMap.get(a.id) ?? a));
      }
    } catch {
      // Handle silently
    } finally {
      setBulkRenewing(false);
    }
  };

  // ─── Summary cards config ────────────────────────────────────────────────────

  const summaryCards = [
    {
      title: "Total Agreements",
      value: displaySummary.total,
      icon: FileText,
      iconBg: "bg-blue-100 dark:bg-blue-900/30",
      iconColor: "text-blue-600 dark:text-blue-400",
    },
    {
      title: "Active",
      value: displaySummary.active,
      icon: CheckCircle2,
      iconBg: "bg-green-100 dark:bg-green-900/30",
      iconColor: "text-green-600 dark:text-green-400",
    },
    {
      title: "Expiring Soon",
      value: displaySummary.expiringSoon,
      icon: Clock,
      iconBg: "bg-amber-100 dark:bg-amber-900/30",
      iconColor: "text-amber-600 dark:text-amber-400",
    },
    {
      title: "Expired",
      value: displaySummary.expired,
      icon: XCircle,
      iconBg: "bg-red-100 dark:bg-red-900/30",
      iconColor: "text-red-600 dark:text-red-400",
    },
  ];

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {(summaryLoading && !agreements.length
          ? Array.from({ length: 4 })
          : summaryCards
        ).map((card, i) => {
          if (summaryLoading && !agreements.length) {
            return (
              <Card key={i}>
                <CardContent className="pt-5 pb-5">
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-9 w-9 rounded-lg" />
                    <div>
                      <Skeleton className="h-3 w-20 mb-1" />
                      <Skeleton className="h-6 w-16" />
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
        })}
      </div>

      {/* Actions bar */}
      <div className="flex flex-col gap-3">
        {/* Status filter pills */}
        <div className="flex flex-wrap items-center justify-between gap-3">
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
                    {agreements.filter((a) => a.status === f.value).length}
                  </span>
                )}
              </Button>
            ))}
          </div>

          {/* Right actions */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                fetchAgreements();
                fetchSummary();
              }}
              disabled={loading}
            >
              <RefreshCw
                className={`h-3.5 w-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`}
              />
              Refresh
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleBulkRenew}
              disabled={bulkRenewing || displaySummary.expiringSoon === 0}
            >
              <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
              {bulkRenewing
                ? "Renewing…"
                : `Bulk Renew${displaySummary.expiringSoon > 0 ? ` (${displaySummary.expiringSoon})` : ""}`}
            </Button>
            <Button
              size="sm"
              onClick={() => setShowNewRow(true)}
              disabled={showNewRow}
            >
              <FilePlus className="h-3.5 w-3.5 mr-1.5" />
              New Agreement
            </Button>
          </div>
        </div>

        {/* Agreement type filter pills */}
        <div className="flex flex-wrap gap-1">
          {TYPE_FILTERS.map((f) => (
            <Button
              key={f.value}
              variant={typeFilter === f.value ? "secondary" : "ghost"}
              size="sm"
              className="h-6 text-xs px-2"
              onClick={() => setTypeFilter(f.value)}
            >
              {f.label}
              {f.value !== "all" && (
                <span className="ml-1.5 font-mono opacity-70">
                  {agreements.filter((a) => a.type === f.value).length}
                </span>
              )}
            </Button>
          ))}
        </div>
      </div>

      {/* Table */}
      {error ? (
        <Card>
          <CardContent className="py-8 text-center">
            <AlertCircle className="h-7 w-7 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">
              Unable to load agreements
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={fetchAgreements}
            >
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
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Property
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Participant
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Type
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Start Date
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      End Date
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Weekly Rate
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Days Until Expiry
                    </th>
                    <th className="px-4 py-3 w-10">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {/* Inline new agreement row */}
                  {showNewRow && (
                    <NewAgreementRow
                      onSave={handleCreate}
                      onCancel={() => setShowNewRow(false)}
                      saving={saving}
                    />
                  )}

                  {loading ? (
                    Array.from({ length: 6 }).map((_, i) => (
                      <tr key={i} className="border-b border-border">
                        <td className="px-4 py-3">
                          <Skeleton className="h-4 w-36" />
                        </td>
                        <td className="px-4 py-3">
                          <Skeleton className="h-4 w-28" />
                        </td>
                        <td className="px-4 py-3">
                          <Skeleton className="h-5 w-32 rounded" />
                        </td>
                        <td className="px-4 py-3">
                          <Skeleton className="h-5 w-16 rounded" />
                        </td>
                        <td className="px-4 py-3">
                          <Skeleton className="h-4 w-20" />
                        </td>
                        <td className="px-4 py-3">
                          <Skeleton className="h-4 w-20" />
                        </td>
                        <td className="px-4 py-3">
                          <Skeleton className="h-4 w-16" />
                        </td>
                        <td className="px-4 py-3">
                          <Skeleton className="h-4 w-12" />
                        </td>
                        <td className="px-4 py-3" />
                      </tr>
                    ))
                  ) : filtered.length === 0 && !showNewRow ? (
                    <tr>
                      <td colSpan={9} className="px-4 py-12 text-center">
                        <Home className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                        <p className="text-sm text-muted-foreground mb-1">
                          {statusFilter === "all" && typeFilter === "all"
                            ? "No agreements found"
                            : "No agreements match the selected filters"}
                        </p>
                        {(statusFilter !== "all" || typeFilter !== "all") && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-xs mt-1"
                            onClick={() => {
                              setStatusFilter("all");
                              setTypeFilter("all");
                            }}
                          >
                            Clear filters
                          </Button>
                        )}
                      </td>
                    </tr>
                  ) : (
                    filtered.map((agreement) => (
                      <AgreementRow key={agreement.id} agreement={agreement} />
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
                  <span className="font-mono font-medium text-foreground">
                    {agreements.length}
                  </span>
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
