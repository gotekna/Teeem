"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import {
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  Clock,
  FileText,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  Plus,
  Shield,
  Activity,
  XCircle,
  Loader2,
  Radio,
  Ban,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

type PracticeType = "chemical" | "mechanical" | "physical" | "seclusion" | "environmental";
type PracticeStatus = "active" | "ceased" | "under_review";
type AuthorizationSource = "behaviour_support_plan" | "emergency" | "other";

interface RestrictivePractice {
  id: number;
  practiceDate: string;
  participantName: string;
  participantId?: number;
  propertyAddress: string;
  propertyId?: number;
  practiceType: PracticeType;
  authorized: boolean;
  status: PracticeStatus;
  authorizationSource?: AuthorizationSource;
  bspReference?: string;
  bspReviewDate?: string;
  ndisReported: boolean;
  ndisReportedAt?: string;
  reason?: string;
  description?: string;
  participantResponse?: string;
  debriefNotes?: string;
  reportingDeadline?: string;
  isOverdue?: boolean;
}

interface OverdueItem {
  id: number;
  participantName: string;
  practiceType: PracticeType;
  practiceDate: string;
  reportingDeadline: string;
}

interface PracticesSummary {
  totalActive: number;
  unauthorizedCount: number;
  overdueReports: number;
  reportedThisMonth: number;
}

type PracticeTypeFilter = PracticeType | "all";
type AuthorizedFilter = "all" | "authorized" | "unauthorized";

// ─── Constants ───────────────────────────────────────────────────────────────

const PRACTICE_TYPE_LABELS: Record<PracticeType, string> = {
  chemical: "Chemical",
  mechanical: "Mechanical",
  physical: "Physical",
  seclusion: "Seclusion",
  environmental: "Environmental",
};

const PRACTICE_TYPE_FILTERS: { value: PracticeTypeFilter; label: string }[] = [
  { value: "all", label: "All Types" },
  { value: "chemical", label: "Chemical" },
  { value: "mechanical", label: "Mechanical" },
  { value: "physical", label: "Physical" },
  { value: "seclusion", label: "Seclusion" },
  { value: "environmental", label: "Environmental" },
];

const AUTHORIZED_FILTERS: { value: AuthorizedFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "authorized", label: "Authorized" },
  { value: "unauthorized", label: "Unauthorized" },
];

const AUTH_SOURCE_LABELS: Record<AuthorizationSource, string> = {
  behaviour_support_plan: "Behaviour Support Plan",
  emergency: "Emergency",
  other: "Other",
};

const STATUS_CONFIG: Record<
  PracticeStatus,
  { label: string; bg: string; text: string; icon: React.ElementType }
> = {
  active: {
    label: "Active",
    bg: "bg-red-100 dark:bg-red-900/30",
    text: "text-red-700 dark:text-red-300",
    icon: Activity,
  },
  ceased: {
    label: "Ceased",
    bg: "bg-gray-100 dark:bg-gray-800",
    text: "text-gray-600 dark:text-gray-400",
    icon: XCircle,
  },
  under_review: {
    label: "Under Review",
    bg: "bg-amber-100 dark:bg-amber-900/30",
    text: "text-amber-700 dark:text-amber-300",
    icon: Clock,
  },
};

const PRACTICE_TYPE_COLORS: Record<PracticeType, string> = {
  chemical: "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300",
  mechanical: "bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300",
  physical: "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300",
  seclusion: "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300",
  environmental: "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300",
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function PracticeTypeBadge({ type }: { type: PracticeType }) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${PRACTICE_TYPE_COLORS[type]}`}
    >
      {PRACTICE_TYPE_LABELS[type]}
    </span>
  );
}

function StatusBadge({ status }: { status: PracticeStatus }) {
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

function AuthorizedBadge({ authorized }: { authorized: boolean }) {
  if (authorized) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300">
        <CheckCircle2 className="h-3 w-3" />
        Authorized
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-bold bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300">
      <Ban className="h-3 w-3" />
      Unauthorized
    </span>
  );
}

function NdisReportedBadge({
  reported,
  isOverdue,
  authorized,
}: {
  reported: boolean;
  isOverdue?: boolean;
  authorized: boolean;
}) {
  // Authorized practices don't require NDIS reporting
  if (authorized) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500">
        N/A
      </span>
    );
  }
  if (reported) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300">
        <CheckCircle2 className="h-3 w-3" />
        Reported
      </span>
    );
  }
  if (isOverdue) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-bold bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300">
        <Radio className="h-3 w-3 animate-pulse" />
        OVERDUE
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300">
      <Clock className="h-3 w-3" />
      Required
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

function PracticeRow({
  practice,
  expanded,
  onToggle,
  onReportToNdis,
  reporting,
}: {
  practice: RestrictivePractice;
  expanded: boolean;
  onToggle: (id: number) => void;
  onReportToNdis: (id: number) => void;
  reporting: boolean;
}) {
  const showReportButton = !practice.authorized && !practice.ndisReported;

  return (
    <>
      <tr
        className={`border-b border-border transition-colors cursor-pointer ${
          expanded ? "bg-primary/5" : "hover:bg-secondary/40"
        }`}
        onClick={() => onToggle(practice.id)}
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

        {/* Date */}
        <td className="px-4 py-3 text-xs text-muted-foreground font-mono whitespace-nowrap">
          {practice.practiceDate}
        </td>

        {/* Participant */}
        <td className="px-4 py-3 text-sm">
          <div className="font-medium truncate max-w-[140px]">{practice.participantName}</div>
        </td>

        {/* Property */}
        <td className="px-4 py-3 text-sm">
          <div className="text-muted-foreground truncate max-w-[150px]">
            {practice.propertyAddress}
          </div>
        </td>

        {/* Type */}
        <td className="px-4 py-3">
          <PracticeTypeBadge type={practice.practiceType} />
        </td>

        {/* Authorized? */}
        <td className="px-4 py-3">
          <AuthorizedBadge authorized={practice.authorized} />
        </td>

        {/* Status */}
        <td className="px-4 py-3">
          <StatusBadge status={practice.status} />
        </td>

        {/* BSP Reference */}
        <td className="px-4 py-3 text-xs text-muted-foreground font-mono">
          {practice.bspReference ?? (
            <span className="text-muted-foreground/50 italic">—</span>
          )}
        </td>

        {/* NDIS Reported */}
        <td className="px-4 py-3">
          <NdisReportedBadge
            reported={practice.ndisReported}
            isOverdue={practice.isOverdue}
            authorized={practice.authorized}
          />
        </td>

        {/* Actions */}
        <td
          className="px-4 py-3 text-right"
          onClick={(e) => e.stopPropagation()}
        >
          {showReportButton && (
            <Button
              size="sm"
              variant="outline"
              className="h-6 text-xs px-2 border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-900/20"
              onClick={() => onReportToNdis(practice.id)}
              disabled={reporting}
              aria-label={`Report restrictive practice for ${practice.participantName} to NDIS`}
            >
              {reporting ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Shield className="h-3 w-3 mr-1" />
              )}
              {reporting ? "" : "Report to NDIS"}
            </Button>
          )}
        </td>
      </tr>

      {/* Expanded detail row */}
      {expanded && (
        <tr className="border-b border-border bg-secondary/20">
          <td colSpan={10} className="px-6 py-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                  Reason
                </p>
                <p className="text-foreground">
                  {practice.reason ?? (
                    <span className="text-muted-foreground italic">Not recorded</span>
                  )}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                  Description
                </p>
                <p className="text-foreground">
                  {practice.description ?? (
                    <span className="text-muted-foreground italic">No description recorded</span>
                  )}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                  Participant Response
                </p>
                <p className="text-foreground">
                  {practice.participantResponse ?? (
                    <span className="text-muted-foreground italic">Not recorded</span>
                  )}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                  Debrief Notes
                </p>
                <p className="text-foreground">
                  {practice.debriefNotes ?? (
                    <span className="text-muted-foreground italic">Not recorded</span>
                  )}
                </p>
              </div>
            </div>

            {/* BSP Details row */}
            {(practice.authorizationSource || practice.bspReference || practice.bspReviewDate) && (
              <div className="mt-4 pt-4 border-t border-border grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                    Authorization Source
                  </p>
                  <p className="text-foreground">
                    {practice.authorizationSource
                      ? AUTH_SOURCE_LABELS[practice.authorizationSource]
                      : <span className="text-muted-foreground italic">Not specified</span>}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                    BSP Reference
                  </p>
                  <p className="font-mono text-foreground">
                    {practice.bspReference ?? (
                      <span className="text-muted-foreground italic">—</span>
                    )}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                    BSP Review Date
                  </p>
                  <p className="font-mono text-foreground">
                    {practice.bspReviewDate ?? (
                      <span className="text-muted-foreground italic">—</span>
                    )}
                  </p>
                </div>
              </div>
            )}

            {/* NDIS reporting deadline */}
            {!practice.authorized && !practice.ndisReported && practice.reportingDeadline && (
              <div className="mt-3">
                <span
                  className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${
                    practice.isOverdue
                      ? "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300"
                      : "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300"
                  }`}
                >
                  <Clock className="h-3 w-3" />
                  {practice.isOverdue ? "Report overdue" : "Report due"}: {practice.reportingDeadline}
                  {" "}(5 business days from incident)
                </span>
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function SdaRestrictivePracticesPage() {
  const [practices, setPractices] = useState<RestrictivePractice[]>([]);
  const [overdue, setOverdue] = useState<OverdueItem[]>([]);
  const [summary, setSummary] = useState<PracticesSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [error, setError] = useState(false);
  const [typeFilter, setTypeFilter] = useState<PracticeTypeFilter>("all");
  const [authorizedFilter, setAuthorizedFilter] = useState<AuthorizedFilter>("all");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [reportingId, setReportingId] = useState<number | null>(null);
  const [addingNew, setAddingNew] = useState(false);

  const fetchPractices = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await api.get<{ success: boolean; data: RestrictivePractice[] }>(
        "/api/v1/sda/restrictive_practices"
      );
      if (res?.data) setPractices(res.data);
      else if (Array.isArray(res)) setPractices(res as RestrictivePractice[]);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchOverdue = useCallback(async () => {
    setSummaryLoading(true);
    try {
      const res = await api.get<{ success: boolean; data: { overdue: OverdueItem[]; summary: PracticesSummary } }>(
        "/api/v1/sda/restrictive_practices/overdue"
      );
      if (res?.data) {
        setOverdue(res.data.overdue ?? []);
        setSummary(res.data.summary ?? null);
      }
    } catch {
      // Summary is non-critical
    } finally {
      setSummaryLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPractices();
    fetchOverdue();
  }, [fetchPractices, fetchOverdue]);

  const filtered = practices.filter((p) => {
    const matchesType = typeFilter === "all" || p.practiceType === typeFilter;
    const matchesAuthorized =
      authorizedFilter === "all" ||
      (authorizedFilter === "authorized" ? p.authorized : !p.authorized);
    return matchesType && matchesAuthorized;
  });

  const toggleExpanded = (id: number) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  const handleReportToNdis = async (id: number) => {
    setReportingId(id);
    try {
      const res = await api.post<{ success: boolean; data: RestrictivePractice }>(
        `/api/v1/sda/restrictive_practices/${id}/report_to_ndis`,
        {}
      );
      if (res?.data) {
        setPractices((prev) =>
          prev.map((p) => (p.id === id ? res.data : p))
        );
        await fetchOverdue();
      }
    } catch {
      // Handle silently
    } finally {
      setReportingId(null);
    }
  };

  const handleAddPractice = async () => {
    setAddingNew(true);
    try {
      await api.post<{ success: boolean; data: RestrictivePractice }>(
        "/api/v1/sda/restrictive_practices",
        {}
      );
      await fetchPractices();
      await fetchOverdue();
    } catch {
      // Handle silently
    } finally {
      setAddingNew(false);
    }
  };

  const overdueCount = overdue.length;
  const hasOverdue = overdueCount > 0;

  const summaryCards = [
    {
      title: "Total Active",
      value: summary?.totalActive ?? 0,
      icon: Activity,
      iconBg: "bg-blue-100 dark:bg-blue-900/30",
      iconColor: "text-blue-600 dark:text-blue-400",
      valueColor: undefined,
    },
    {
      title: "Unauthorized",
      value: summary?.unauthorizedCount ?? 0,
      icon: Ban,
      iconBg:
        (summary?.unauthorizedCount ?? 0) > 0
          ? "bg-red-100 dark:bg-red-900/30"
          : "bg-gray-100 dark:bg-gray-800",
      iconColor:
        (summary?.unauthorizedCount ?? 0) > 0
          ? "text-red-600 dark:text-red-400"
          : "text-gray-400 dark:text-gray-500",
      valueColor:
        (summary?.unauthorizedCount ?? 0) > 0
          ? "text-red-600 dark:text-red-400"
          : undefined,
    },
    {
      title: "Overdue Reports",
      value: summary?.overdueReports ?? overdueCount,
      icon: AlertTriangle,
      iconBg: hasOverdue
        ? "bg-red-100 dark:bg-red-900/30"
        : "bg-gray-100 dark:bg-gray-800",
      iconColor: hasOverdue
        ? "text-red-600 dark:text-red-400"
        : "text-gray-400 dark:text-gray-500",
      valueColor: hasOverdue ? "text-red-600 dark:text-red-400" : undefined,
    },
    {
      title: "Reported This Month",
      value: summary?.reportedThisMonth ?? 0,
      icon: Shield,
      iconBg: "bg-green-100 dark:bg-green-900/30",
      iconColor: "text-green-600 dark:text-green-400",
      valueColor: undefined,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Overdue Alert Banner */}
      {!summaryLoading && hasOverdue && (
        <div className="flex items-start gap-3 rounded-lg border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-4 py-3">
          <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-red-800 dark:text-red-300">
              {overdueCount} unauthorized restrictive practice{overdueCount > 1 ? "s are" : " is"} overdue for NDIS reporting
            </p>
            <p className="text-xs text-red-700 dark:text-red-400 mt-0.5">
              Unauthorized restrictive practices must be reported to NDIS within 5 business days. The following
              {overdueCount > 1 ? " practices are" : " practice is"} past due and must be submitted immediately
              to avoid compliance breaches.
            </p>
            <ul className="mt-2 space-y-0.5">
              {overdue.slice(0, 3).map((item) => (
                <li key={item.id} className="text-xs text-red-700 dark:text-red-400 font-medium">
                  {item.participantName} — {PRACTICE_TYPE_LABELS[item.practiceType]} on {item.practiceDate}
                  <span className="font-normal ml-1">(deadline: {item.reportingDeadline})</span>
                </li>
              ))}
              {overdue.length > 3 && (
                <li className="text-xs text-red-700 dark:text-red-400 italic">
                  +{overdue.length - 3} more
                </li>
              )}
            </ul>
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
          {/* Practice type filter pills */}
          <div className="flex flex-wrap gap-1">
            {PRACTICE_TYPE_FILTERS.map((f) => (
              <Button
                key={f.value}
                variant={typeFilter === f.value ? "default" : "outline"}
                size="sm"
                className="h-7 text-xs px-2.5"
                onClick={() => setTypeFilter(f.value)}
              >
                {f.label}
                {f.value !== "all" && (
                  <span className="ml-1.5 font-mono opacity-70">
                    {practices.filter((p) => p.practiceType === f.value).length}
                  </span>
                )}
              </Button>
            ))}
          </div>

          {/* Authorized filter pills */}
          <div className="flex flex-wrap gap-1">
            {AUTHORIZED_FILTERS.map((f) => (
              <Button
                key={f.value}
                variant={authorizedFilter === f.value ? "default" : "outline"}
                size="sm"
                className="h-7 text-xs px-2.5"
                onClick={() => setAuthorizedFilter(f.value)}
              >
                {f.label}
                {f.value === "authorized" && (
                  <span className="ml-1.5 font-mono opacity-70">
                    {practices.filter((p) => p.authorized).length}
                  </span>
                )}
                {f.value === "unauthorized" && (
                  <span className="ml-1.5 font-mono opacity-70">
                    {practices.filter((p) => !p.authorized).length}
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
              fetchPractices();
              fetchOverdue();
            }}
            disabled={loading}
          >
            <RefreshCw
              className={`h-3.5 w-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
          <Button
            size="sm"
            onClick={handleAddPractice}
            disabled={addingNew}
          >
            {addingNew ? (
              <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
            ) : (
              <Plus className="h-3.5 w-3.5 mr-1.5" />
            )}
            Record Practice
          </Button>
        </div>
      </div>

      {/* Practices Table */}
      {error ? (
        <Card>
          <CardContent className="py-8 text-center">
            <AlertCircle className="h-7 w-7 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">Unable to load restrictive practices</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={fetchPractices}
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
                      Date
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Participant
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Property
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Type
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">
                      Authorized?
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">
                      BSP Reference
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">
                      NDIS Reported
                    </th>
                    <th className="px-4 py-3 w-36">
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
                          <Skeleton className="h-4 w-24" />
                        </td>
                        <td className="px-4 py-3">
                          <Skeleton className="h-4 w-32" />
                        </td>
                        <td className="px-4 py-3">
                          <Skeleton className="h-4 w-36" />
                        </td>
                        <td className="px-4 py-3">
                          <Skeleton className="h-5 w-20 rounded" />
                        </td>
                        <td className="px-4 py-3">
                          <Skeleton className="h-5 w-24 rounded" />
                        </td>
                        <td className="px-4 py-3">
                          <Skeleton className="h-5 w-20 rounded" />
                        </td>
                        <td className="px-4 py-3">
                          <Skeleton className="h-4 w-16" />
                        </td>
                        <td className="px-4 py-3">
                          <Skeleton className="h-5 w-18 rounded" />
                        </td>
                        <td className="px-4 py-3" />
                      </tr>
                    ))
                  ) : filtered.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="px-4 py-12 text-center">
                        <FileText className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                        <p className="text-sm text-muted-foreground">
                          {typeFilter === "all" && authorizedFilter === "all"
                            ? "No restrictive practices recorded"
                            : "No practices match these filters"}
                        </p>
                      </td>
                    </tr>
                  ) : (
                    filtered.map((practice) => (
                      <PracticeRow
                        key={practice.id}
                        practice={practice}
                        expanded={expandedId === practice.id}
                        onToggle={toggleExpanded}
                        onReportToNdis={handleReportToNdis}
                        reporting={reportingId === practice.id}
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
                    {practices.length}
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
