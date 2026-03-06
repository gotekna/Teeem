"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import {
  Scale,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  Clock,
  Users,
  ShieldCheck,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  Plus,
  Loader2,
  FileText,
  XCircle,
  Eye,
  Send,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

type DeclarantType = "staff" | "sil_provider" | "contractor" | "board_member";
type ConflictType = "financial" | "personal" | "professional" | "familial" | "other";
type CoiStatus = "declared" | "under_review" | "managed" | "resolved" | "dismissed";
type Severity = "low" | "medium" | "high" | "critical";

interface ConflictOfInterest {
  id: number;
  declarantName: string;
  declarantType: DeclarantType;
  declarationDate: string;
  conflictType: ConflictType;
  severity: Severity;
  status: CoiStatus;
  reviewDate?: string;
  description?: string;
  partiesInvolved?: string;
  managementPlan?: string;
  mitigationActions?: string;
  reviewerNotes?: string;
  reviewedBy?: string;
  reviewedAt?: string;
}

interface CoiSummary {
  totalActive: number;
  highCriticalCount: number;
  needsReviewCount: number;
  resolvedCount: number;
}

type DeclarantTypeFilter = DeclarantType | "all";
type StatusFilter = CoiStatus | "all";
type SeverityFilter = Severity | "all";

// ─── Constants ───────────────────────────────────────────────────────────────

const DECLARANT_TYPE_LABELS: Record<DeclarantType, string> = {
  staff: "Staff",
  sil_provider: "SIL Provider",
  contractor: "Contractor",
  board_member: "Board Member",
};

const CONFLICT_TYPE_LABELS: Record<ConflictType, string> = {
  financial: "Financial",
  personal: "Personal",
  professional: "Professional",
  familial: "Familial",
  other: "Other",
};

const DECLARANT_TYPE_FILTERS: { value: DeclarantTypeFilter; label: string }[] = [
  { value: "all", label: "All Declarants" },
  { value: "staff", label: "Staff" },
  { value: "sil_provider", label: "SIL Provider" },
  { value: "contractor", label: "Contractor" },
  { value: "board_member", label: "Board Member" },
];

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "declared", label: "Declared" },
  { value: "under_review", label: "Under Review" },
  { value: "managed", label: "Managed" },
  { value: "resolved", label: "Resolved" },
  { value: "dismissed", label: "Dismissed" },
];

const SEVERITY_FILTERS: { value: SeverityFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "critical", label: "Critical" },
];

// ─── Config ───────────────────────────────────────────────────────────────────

const SEVERITY_CONFIG: Record<
  Severity,
  { label: string; bg: string; text: string; dot: string }
> = {
  low: {
    label: "Low",
    bg: "bg-gray-100 dark:bg-gray-800",
    text: "text-gray-600 dark:text-gray-400",
    dot: "bg-gray-400",
  },
  medium: {
    label: "Medium",
    bg: "bg-amber-100 dark:bg-amber-900/30",
    text: "text-amber-700 dark:text-amber-300",
    dot: "bg-amber-500",
  },
  high: {
    label: "High",
    bg: "bg-orange-100 dark:bg-orange-900/30",
    text: "text-orange-700 dark:text-orange-300",
    dot: "bg-orange-500",
  },
  critical: {
    label: "Critical",
    bg: "bg-red-100 dark:bg-red-900/30",
    text: "text-red-700 dark:text-red-300",
    dot: "bg-red-500",
  },
};

const STATUS_CONFIG: Record<
  CoiStatus,
  { label: string; bg: string; text: string; icon: React.ElementType }
> = {
  declared: {
    label: "Declared",
    bg: "bg-blue-100 dark:bg-blue-900/30",
    text: "text-blue-700 dark:text-blue-300",
    icon: FileText,
  },
  under_review: {
    label: "Under Review",
    bg: "bg-amber-100 dark:bg-amber-900/30",
    text: "text-amber-700 dark:text-amber-300",
    icon: Eye,
  },
  managed: {
    label: "Managed",
    bg: "bg-purple-100 dark:bg-purple-900/30",
    text: "text-purple-700 dark:text-purple-300",
    icon: ShieldCheck,
  },
  resolved: {
    label: "Resolved",
    bg: "bg-green-100 dark:bg-green-900/30",
    text: "text-green-700 dark:text-green-300",
    icon: CheckCircle2,
  },
  dismissed: {
    label: "Dismissed",
    bg: "bg-gray-100 dark:bg-gray-800",
    text: "text-gray-600 dark:text-gray-400",
    icon: XCircle,
  },
};

const REVIEW_STATUS_OPTIONS: { value: CoiStatus; label: string }[] = [
  { value: "under_review", label: "Under Review" },
  { value: "managed", label: "Managed" },
  { value: "resolved", label: "Resolved" },
  { value: "dismissed", label: "Dismissed" },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function SeverityBadge({ severity }: { severity: Severity }) {
  const cfg = SEVERITY_CONFIG[severity];
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-semibold ${cfg.bg} ${cfg.text}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

function StatusBadge({ status }: { status: CoiStatus }) {
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

function SummaryCard({
  title,
  value,
  icon: Icon,
  iconBg,
  iconColor,
  loading,
  valueColor,
}: {
  title: string;
  value: string | number;
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
  loading: boolean;
  valueColor?: string;
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
              <Skeleton className="h-6 w-14 mt-0.5" />
            ) : (
              <p className={`text-lg font-bold font-mono ${valueColor ?? ""}`}>{value}</p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Review Form Panel ────────────────────────────────────────────────────────

function ReviewPanel({
  coi,
  onClose,
  onSubmit,
  submitting,
}: {
  coi: ConflictOfInterest;
  onClose: () => void;
  onSubmit: (id: number, reviewerNotes: string, status: CoiStatus) => void;
  submitting: boolean;
}) {
  const [reviewerNotes, setReviewerNotes] = useState(coi.reviewerNotes ?? "");
  const [newStatus, setNewStatus] = useState<CoiStatus>(
    coi.status === "declared" ? "under_review" : coi.status
  );

  return (
    <div className="border border-border rounded-lg bg-secondary/20 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-foreground">Review Declaration</p>
        <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={onClose}>
          Cancel
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Status change */}
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">
            Update Status
          </label>
          <select
            value={newStatus}
            onChange={(e) => setNewStatus(e.target.value as CoiStatus)}
            className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          >
            {REVIEW_STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Reviewer notes */}
        <div className="sm:col-span-1">
          <label className="block text-xs font-medium text-muted-foreground mb-1">
            Reviewer Notes
          </label>
          <textarea
            value={reviewerNotes}
            onChange={(e) => setReviewerNotes(e.target.value)}
            placeholder="Add review notes, decisions, or required actions..."
            rows={3}
            className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
          />
        </div>
      </div>

      <div className="flex justify-end">
        <Button
          size="sm"
          onClick={() => onSubmit(coi.id, reviewerNotes, newStatus)}
          disabled={submitting}
          aria-label={`Submit review for COI declaration from ${coi.declarantName}`}
        >
          {submitting ? (
            <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
          ) : (
            <Send className="h-3.5 w-3.5 mr-1.5" />
          )}
          {submitting ? "Submitting..." : "Submit Review"}
        </Button>
      </div>
    </div>
  );
}

// ─── COI Table Row ────────────────────────────────────────────────────────────

function CoiRow({
  coi,
  expanded,
  reviewingId,
  submittingReviewId,
  onToggle,
  onOpenReview,
  onCloseReview,
  onSubmitReview,
}: {
  coi: ConflictOfInterest;
  expanded: boolean;
  reviewingId: number | null;
  submittingReviewId: number | null;
  onToggle: (id: number) => void;
  onOpenReview: (id: number) => void;
  onCloseReview: () => void;
  onSubmitReview: (id: number, reviewerNotes: string, status: CoiStatus) => void;
}) {
  const declarantTypeLabel = DECLARANT_TYPE_LABELS[coi.declarantType];
  const conflictTypeLabel = CONFLICT_TYPE_LABELS[coi.conflictType];
  const isReviewOpen = reviewingId === coi.id;
  const isActive = coi.status !== "resolved" && coi.status !== "dismissed";
  const isOverdueForReview =
    coi.reviewDate != null && new Date(coi.reviewDate) < new Date() && isActive;

  return (
    <>
      <tr
        className={`border-b border-border transition-colors cursor-pointer ${
          expanded ? "bg-primary/5" : "hover:bg-secondary/40"
        }`}
        onClick={() => onToggle(coi.id)}
        aria-expanded={expanded}
      >
        {/* Expand toggle */}
        <td className="px-3 py-3 w-8">
          {expanded ? (
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
          )}
        </td>

        {/* Declaration Date */}
        <td className="px-4 py-3 text-xs text-muted-foreground font-mono whitespace-nowrap">
          {coi.declarationDate}
        </td>

        {/* Declarant */}
        <td className="px-4 py-3 text-sm">
          <div className="font-medium">{coi.declarantName}</div>
          <div className="text-xs text-muted-foreground">{declarantTypeLabel}</div>
        </td>

        {/* Conflict Type */}
        <td className="px-4 py-3 text-sm text-muted-foreground">
          {conflictTypeLabel}
        </td>

        {/* Severity */}
        <td className="px-4 py-3">
          <SeverityBadge severity={coi.severity} />
        </td>

        {/* Status */}
        <td className="px-4 py-3">
          <StatusBadge status={coi.status} />
        </td>

        {/* Review Date */}
        <td className="px-4 py-3 text-xs font-mono whitespace-nowrap">
          {coi.reviewDate ? (
            <span
              className={
                isOverdueForReview
                  ? "text-red-600 dark:text-red-400 font-semibold"
                  : "text-muted-foreground"
              }
            >
              {isOverdueForReview && (
                <AlertTriangle className="h-3 w-3 inline mr-1" />
              )}
              {coi.reviewDate}
            </span>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </td>

        {/* Actions */}
        <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
          {isActive && (
            <Button
              size="sm"
              variant="outline"
              className="h-6 text-xs px-2"
              onClick={() => (isReviewOpen ? onCloseReview() : onOpenReview(coi.id))}
              aria-label={`Review COI declaration from ${coi.declarantName}`}
            >
              <Eye className="h-3 w-3 mr-1" />
              Review
            </Button>
          )}
        </td>
      </tr>

      {/* Expanded detail row */}
      {expanded && (
        <tr className="border-b border-border bg-secondary/20">
          <td colSpan={8} className="px-6 py-4 space-y-4">
            {/* Detail grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                  Description
                </p>
                <p className="text-foreground">
                  {coi.description ?? (
                    <span className="text-muted-foreground italic">No description recorded</span>
                  )}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                  Parties Involved
                </p>
                <p className="text-foreground">
                  {coi.partiesInvolved ?? (
                    <span className="text-muted-foreground italic">Not specified</span>
                  )}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                  Management Plan
                </p>
                <p className="text-foreground">
                  {coi.managementPlan ?? (
                    <span className="text-muted-foreground italic">Not yet defined</span>
                  )}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                  Mitigation Actions
                </p>
                <p className="text-foreground">
                  {coi.mitigationActions ?? (
                    <span className="text-muted-foreground italic">None recorded</span>
                  )}
                </p>
              </div>
              {coi.reviewerNotes && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                    Reviewer Notes
                  </p>
                  <p className="text-foreground">{coi.reviewerNotes}</p>
                  {coi.reviewedBy && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Reviewed by {coi.reviewedBy}
                      {coi.reviewedAt ? ` on ${coi.reviewedAt}` : ""}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Review form */}
            {isReviewOpen && (
              <ReviewPanel
                coi={coi}
                onClose={onCloseReview}
                onSubmit={onSubmitReview}
                submitting={submittingReviewId === coi.id}
              />
            )}
          </td>
        </tr>
      )}
    </>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function SdaConflictOfInterestPage() {
  const [cois, setCois] = useState<ConflictOfInterest[]>([]);
  const [summary, setSummary] = useState<CoiSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [error, setError] = useState(false);
  const [declarantTypeFilter, setDeclarantTypeFilter] = useState<DeclarantTypeFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>("all");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [reviewingId, setReviewingId] = useState<number | null>(null);
  const [submittingReviewId, setSubmittingReviewId] = useState<number | null>(null);
  const [loggingNew, setLoggingNew] = useState(false);

  const fetchCois = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await api.get<{ success: boolean; data: ConflictOfInterest[] }>(
        "/api/v1/sda/conflict_of_interests"
      );
      if (res?.data) setCois(res.data);
      else if (Array.isArray(res)) setCois(res as ConflictOfInterest[]);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchSummary = useCallback(async () => {
    setSummaryLoading(true);
    try {
      const res = await api.get<{ success: boolean; data: CoiSummary }>(
        "/api/v1/sda/conflict_of_interests/needs_review"
      );
      if (res?.data) setSummary(res.data);
    } catch {
      // Summary is non-critical
    } finally {
      setSummaryLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCois();
    fetchSummary();
  }, [fetchCois, fetchSummary]);

  const filtered = cois.filter((coi) => {
    const matchesDeclarantType =
      declarantTypeFilter === "all" || coi.declarantType === declarantTypeFilter;
    const matchesStatus =
      statusFilter === "all" || coi.status === statusFilter;
    const matchesSeverity =
      severityFilter === "all" || coi.severity === severityFilter;
    return matchesDeclarantType && matchesStatus && matchesSeverity;
  });

  const toggleExpanded = (id: number) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  const handleOpenReview = (id: number) => {
    setReviewingId(id);
    // Ensure row is expanded when review opens
    setExpandedId(id);
  };

  const handleCloseReview = () => {
    setReviewingId(null);
  };

  const handleSubmitReview = async (
    id: number,
    reviewerNotes: string,
    status: CoiStatus
  ) => {
    setSubmittingReviewId(id);
    try {
      const res = await api.post<{ success: boolean; data: ConflictOfInterest }>(
        `/api/v1/sda/conflict_of_interests/${id}/review`,
        { reviewer_notes: reviewerNotes, status }
      );
      if (res?.data) {
        setCois((prev) =>
          prev.map((coi) => (coi.id === id ? res.data : coi))
        );
        setReviewingId(null);
        await fetchSummary();
      }
    } catch {
      // Handle silently
    } finally {
      setSubmittingReviewId(null);
    }
  };

  const handleLogDeclaration = async () => {
    setLoggingNew(true);
    try {
      await api.post<{ success: boolean; data: ConflictOfInterest }>(
        "/api/v1/sda/conflict_of_interests",
        {}
      );
      await fetchCois();
      await fetchSummary();
    } catch {
      // Handle silently
    } finally {
      setLoggingNew(false);
    }
  };

  // Derive overdue-review count from list when summary not available
  const overdueCount =
    summary?.needsReviewCount ??
    cois.filter(
      (coi) =>
        coi.reviewDate != null &&
        new Date(coi.reviewDate) < new Date() &&
        coi.status !== "resolved" &&
        coi.status !== "dismissed"
    ).length;
  const hasOverdue = overdueCount > 0;

  // Compute summary values from list data when API summary is unavailable
  const totalActive =
    summary?.totalActive ??
    cois.filter((c) => c.status !== "resolved" && c.status !== "dismissed").length;
  const highCriticalCount =
    summary?.highCriticalCount ??
    cois.filter(
      (c) =>
        (c.severity === "high" || c.severity === "critical") &&
        c.status !== "resolved" &&
        c.status !== "dismissed"
    ).length;
  const resolvedCount =
    summary?.resolvedCount ??
    cois.filter((c) => c.status === "resolved").length;

  const summaryCards = [
    {
      title: "Total Active",
      value: totalActive,
      icon: Scale,
      iconBg: "bg-blue-100 dark:bg-blue-900/30",
      iconColor: "text-blue-600 dark:text-blue-400",
      valueColor: undefined,
    },
    {
      title: "High / Critical",
      value: highCriticalCount,
      icon: AlertTriangle,
      iconBg:
        highCriticalCount > 0
          ? "bg-orange-100 dark:bg-orange-900/30"
          : "bg-gray-100 dark:bg-gray-800",
      iconColor:
        highCriticalCount > 0
          ? "text-orange-600 dark:text-orange-400"
          : "text-gray-400 dark:text-gray-500",
      valueColor:
        highCriticalCount > 0 ? "text-orange-600 dark:text-orange-400" : undefined,
    },
    {
      title: "Needs Review",
      value: overdueCount,
      icon: Clock,
      iconBg:
        hasOverdue
          ? "bg-amber-100 dark:bg-amber-900/30"
          : "bg-gray-100 dark:bg-gray-800",
      iconColor:
        hasOverdue
          ? "text-amber-600 dark:text-amber-400"
          : "text-gray-400 dark:text-gray-500",
      valueColor: hasOverdue ? "text-amber-600 dark:text-amber-400" : undefined,
    },
    {
      title: "Resolved",
      value: resolvedCount,
      icon: ShieldCheck,
      iconBg: "bg-green-100 dark:bg-green-900/30",
      iconColor: "text-green-600 dark:text-green-400",
      valueColor: undefined,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Overdue Review Alert Banner */}
      {!summaryLoading && hasOverdue && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 px-4 py-3">
          <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
              {overdueCount} conflict of interest declaration
              {overdueCount > 1 ? "s" : ""} overdue for review
            </p>
            <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
              These declarations have passed their scheduled review date and require
              action to maintain NDIS governance compliance. Review or update each
              declaration to ensure appropriate management controls are in place.
            </p>
          </div>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {summaryCards.map((card, i) => {
          if (summaryLoading) {
            return (
              <Card key={i}>
                <CardContent className="pt-5 pb-5">
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-9 w-9 rounded-lg" />
                    <div>
                      <Skeleton className="h-3 w-28 mb-1" />
                      <Skeleton className="h-6 w-10" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          }
          return (
            <SummaryCard
              key={card.title}
              title={card.title}
              value={card.value}
              icon={card.icon}
              iconBg={card.iconBg}
              iconColor={card.iconColor}
              loading={false}
              valueColor={card.valueColor}
            />
          );
        })}
      </div>

      {/* Filters and actions bar */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-2">
          {/* Declarant type filter pills */}
          <div className="flex flex-wrap gap-1">
            {DECLARANT_TYPE_FILTERS.map((f) => (
              <Button
                key={f.value}
                variant={declarantTypeFilter === f.value ? "default" : "outline"}
                size="sm"
                className="h-7 text-xs px-2.5"
                onClick={() => setDeclarantTypeFilter(f.value)}
              >
                {f.label}
                {f.value !== "all" && (
                  <span className="ml-1.5 font-mono opacity-70">
                    {cois.filter((c) => c.declarantType === f.value).length}
                  </span>
                )}
              </Button>
            ))}
          </div>

          {/* Status filter pills */}
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
                    {cois.filter((c) => c.status === f.value).length}
                  </span>
                )}
              </Button>
            ))}
          </div>

          {/* Severity filter pills */}
          <div className="flex flex-wrap gap-1">
            {SEVERITY_FILTERS.map((f) => (
              <Button
                key={f.value}
                variant={severityFilter === f.value ? "default" : "outline"}
                size="sm"
                className="h-7 text-xs px-2.5"
                onClick={() => setSeverityFilter(f.value)}
              >
                {f.label}
                {f.value !== "all" && (
                  <span className="ml-1.5 font-mono opacity-70">
                    {cois.filter((c) => c.severity === f.value).length}
                  </span>
                )}
              </Button>
            ))}
          </div>
        </div>

        {/* Right side actions */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              fetchCois();
              fetchSummary();
            }}
            disabled={loading}
          >
            <RefreshCw
              className={`h-3.5 w-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
          <Button size="sm" onClick={handleLogDeclaration} disabled={loggingNew}>
            {loggingNew ? (
              <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
            ) : (
              <Plus className="h-3.5 w-3.5 mr-1.5" />
            )}
            Log Declaration
          </Button>
        </div>
      </div>

      {/* COI Table */}
      {error ? (
        <Card>
          <CardContent className="py-8 text-center">
            <AlertCircle className="h-7 w-7 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">
              Unable to load conflict of interest declarations
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={fetchCois}
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
                    <th className="px-3 py-3 w-8">
                      <span className="sr-only">Expand</span>
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">
                      Declaration Date
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Declarant
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">
                      Conflict Type
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Severity
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">
                      Review Date
                    </th>
                    <th className="px-4 py-3 w-28">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    Array.from({ length: 6 }).map((_, i) => (
                      <tr key={i} className="border-b border-border">
                        <td className="px-3 py-3">
                          <Skeleton className="h-3.5 w-3.5 rounded" />
                        </td>
                        <td className="px-4 py-3">
                          <Skeleton className="h-4 w-20" />
                        </td>
                        <td className="px-4 py-3">
                          <Skeleton className="h-4 w-32 mb-1" />
                          <Skeleton className="h-3 w-20" />
                        </td>
                        <td className="px-4 py-3">
                          <Skeleton className="h-4 w-24" />
                        </td>
                        <td className="px-4 py-3">
                          <Skeleton className="h-5 w-16 rounded" />
                        </td>
                        <td className="px-4 py-3">
                          <Skeleton className="h-5 w-24 rounded" />
                        </td>
                        <td className="px-4 py-3">
                          <Skeleton className="h-4 w-20" />
                        </td>
                        <td className="px-4 py-3" />
                      </tr>
                    ))
                  ) : filtered.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-12 text-center">
                        <Scale className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                        <p className="text-sm text-muted-foreground">
                          {declarantTypeFilter === "all" &&
                          statusFilter === "all" &&
                          severityFilter === "all"
                            ? "No conflict of interest declarations recorded"
                            : "No declarations match these filters"}
                        </p>
                      </td>
                    </tr>
                  ) : (
                    filtered.map((coi) => (
                      <CoiRow
                        key={coi.id}
                        coi={coi}
                        expanded={expandedId === coi.id}
                        reviewingId={reviewingId}
                        submittingReviewId={submittingReviewId}
                        onToggle={toggleExpanded}
                        onOpenReview={handleOpenReview}
                        onCloseReview={handleCloseReview}
                        onSubmitReview={handleSubmitReview}
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
                  <span className="font-mono font-medium text-foreground">
                    {cois.length}
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
