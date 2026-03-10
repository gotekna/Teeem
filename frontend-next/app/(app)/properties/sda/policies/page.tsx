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
  BookOpen,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  Plus,
  Shield,
  Loader2,
  Archive,
  RotateCcw,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

type PolicyType = "policy" | "procedure" | "guideline" | "form" | "template";
type PolicyCategory =
  | "governance"
  | "safety"
  | "complaints"
  | "incidents"
  | "restrictive_practices"
  | "conflict_of_interest"
  | "maintenance"
  | "tenancy"
  | "privacy"
  | "rights"
  | "emergency"
  | "medication"
  | "infection_control"
  | "sda_specific";
type PolicyStatus = "draft" | "active" | "under_review" | "archived" | "superseded";

interface SdaPolicy {
  id: number;
  referenceNumber: string;
  title: string;
  policyType: PolicyType;
  category: PolicyCategory;
  version: string;
  status: PolicyStatus;
  reviewDate: string;
  ndisRequired: boolean;
  ndisCompliant?: boolean;
  ndisPracticeStandard?: string;
  summary?: string;
  contentPreview?: string;
  effectiveDate?: string;
  expiryDate?: string;
  owner?: string;
  lastReviewedAt?: string;
  daysUntilReview?: number;
}

interface PolicyDashboard {
  total: number;
  active: number;
  dueForReview: number;
  ndisRequired: number;
  ndisCompliant: number;
}

type CategoryFilter = PolicyCategory | "all";
type StatusFilter = PolicyStatus | "all";
type NdisFilter = "all" | "required" | "not_required";

// ─── Constants ────────────────────────────────────────────────────────────────

const POLICY_TYPE_LABELS: Record<PolicyType, string> = {
  policy: "Policy",
  procedure: "Procedure",
  guideline: "Guideline",
  form: "Form",
  template: "Template",
};

const CATEGORY_LABELS: Record<PolicyCategory, string> = {
  governance: "Governance",
  safety: "Safety",
  complaints: "Complaints",
  incidents: "Incidents",
  restrictive_practices: "Restrictive Practices",
  conflict_of_interest: "Conflict of Interest",
  maintenance: "Maintenance",
  tenancy: "Tenancy",
  privacy: "Privacy",
  rights: "Rights",
  emergency: "Emergency",
  medication: "Medication",
  infection_control: "Infection Control",
  sda_specific: "SDA Specific",
};

const CATEGORY_FILTERS: { value: CategoryFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "governance", label: "Governance" },
  { value: "safety", label: "Safety" },
  { value: "complaints", label: "Complaints" },
  { value: "incidents", label: "Incidents" },
  { value: "restrictive_practices", label: "Restrictive Practices" },
  { value: "maintenance", label: "Maintenance" },
  { value: "tenancy", label: "Tenancy" },
  { value: "rights", label: "Rights" },
  { value: "emergency", label: "Emergency" },
  { value: "sda_specific", label: "SDA Specific" },
];

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "draft", label: "Draft" },
  { value: "active", label: "Active" },
  { value: "under_review", label: "Under Review" },
  { value: "archived", label: "Archived" },
  { value: "superseded", label: "Superseded" },
];

const STATUS_CONFIG: Record<
  PolicyStatus,
  { label: string; bg: string; text: string; icon: React.ElementType }
> = {
  draft: {
    label: "Draft",
    bg: "bg-gray-100 dark:bg-gray-800",
    text: "text-gray-600 dark:text-gray-400",
    icon: FileText,
  },
  active: {
    label: "Active",
    bg: "bg-green-100 dark:bg-green-900/30",
    text: "text-green-700 dark:text-green-300",
    icon: CheckCircle2,
  },
  under_review: {
    label: "Under Review",
    bg: "bg-amber-100 dark:bg-amber-900/30",
    text: "text-amber-700 dark:text-amber-300",
    icon: RotateCcw,
  },
  archived: {
    label: "Archived",
    bg: "bg-gray-100 dark:bg-gray-800",
    text: "text-gray-500 dark:text-gray-500",
    icon: Archive,
  },
  superseded: {
    label: "Superseded",
    bg: "bg-red-100 dark:bg-red-900/30",
    text: "text-red-700 dark:text-red-300",
    icon: AlertCircle,
  },
};

const CATEGORY_COLOR_MAP: Record<PolicyCategory, string> = {
  governance: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  safety: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
  complaints: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300",
  incidents: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  restrictive_practices: "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300",
  conflict_of_interest: "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300",
  maintenance: "bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300",
  tenancy: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/40 dark:text-cyan-300",
  privacy: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300",
  rights: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  emergency: "bg-red-100 text-red-900 dark:bg-red-900/50 dark:text-red-200",
  medication: "bg-pink-100 text-pink-800 dark:bg-pink-900/40 dark:text-pink-300",
  infection_control: "bg-lime-100 text-lime-800 dark:bg-lime-900/40 dark:text-lime-300",
  sda_specific: "bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-300",
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: PolicyStatus }) {
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

function CategoryBadge({ category }: { category: PolicyCategory }) {
  const colorClass = CATEGORY_COLOR_MAP[category];
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${colorClass}`}
    >
      {CATEGORY_LABELS[category]}
    </span>
  );
}

function TypeBadge({ policyType }: { policyType: PolicyType }) {
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-secondary text-secondary-foreground">
      {POLICY_TYPE_LABELS[policyType]}
    </span>
  );
}

function ReviewDateCell({
  reviewDate,
  daysUntilReview,
}: {
  reviewDate: string;
  daysUntilReview?: number;
}) {
  const isOverdue = daysUntilReview !== undefined && daysUntilReview < 0;
  const isDueSoon = daysUntilReview !== undefined && daysUntilReview >= 0 && daysUntilReview <= 30;

  return (
    <div>
      <span
        className={`font-mono text-xs ${
          isOverdue
            ? "text-red-600 dark:text-red-400 font-semibold"
            : isDueSoon
            ? "text-amber-600 dark:text-amber-400 font-semibold"
            : "text-muted-foreground"
        }`}
      >
        {reviewDate}
      </span>
      {isOverdue && (
        <div className="text-xs text-red-600 dark:text-red-400 font-semibold">
          {Math.abs(daysUntilReview!)}d overdue
        </div>
      )}
      {isDueSoon && !isOverdue && (
        <div className="text-xs text-amber-600 dark:text-amber-400">
          in {daysUntilReview}d
        </div>
      )}
    </div>
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

function PolicyRow({
  policy,
  expanded,
  onToggle,
  onApprove,
  approving,
}: {
  policy: SdaPolicy;
  expanded: boolean;
  onToggle: (id: number) => void;
  onApprove: (id: number) => void;
  approving: boolean;
}) {
  const canApprove = policy.status === "draft" || policy.status === "under_review";

  return (
    <>
      <tr
        className={`border-b border-border transition-colors cursor-pointer ${
          expanded ? "bg-primary/5" : "hover:bg-secondary/40"
        }`}
        onClick={() => onToggle(policy.id)}
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

        {/* Reference # */}
        <td className="px-4 py-3 text-sm">
          <span className="font-mono font-semibold text-xs tracking-wide">
            {policy.referenceNumber}
          </span>
        </td>

        {/* Title */}
        <td className="px-4 py-3 text-sm">
          <div className="font-medium truncate max-w-[200px]" title={policy.title}>
            {policy.title}
          </div>
        </td>

        {/* Type */}
        <td className="px-4 py-3">
          <TypeBadge policyType={policy.policyType} />
        </td>

        {/* Category */}
        <td className="px-4 py-3">
          <CategoryBadge category={policy.category} />
        </td>

        {/* Version */}
        <td className="px-4 py-3 text-xs font-mono text-muted-foreground">
          v{policy.version}
        </td>

        {/* Status */}
        <td className="px-4 py-3">
          <StatusBadge status={policy.status} />
        </td>

        {/* Review Date */}
        <td className="px-4 py-3">
          <ReviewDateCell
            reviewDate={policy.reviewDate}
            daysUntilReview={policy.daysUntilReview}
          />
        </td>

        {/* NDIS Required */}
        <td className="px-4 py-3">
          {policy.ndisRequired ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300">
              <Shield className="h-3 w-3" />
              Required
            </span>
          ) : (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500">
              N/A
            </span>
          )}
        </td>

        {/* Actions */}
        <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
          {canApprove && (
            <Button
              size="sm"
              variant="outline"
              className="h-6 text-xs px-2 border-green-300 dark:border-green-700 text-green-700 dark:text-green-300 hover:bg-green-50 dark:hover:bg-green-900/20"
              onClick={() => onApprove(policy.id)}
              disabled={approving}
              aria-label={`Approve policy ${policy.referenceNumber}`}
            >
              {approving ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <CheckCircle2 className="h-3 w-3 mr-1" />
              )}
              {approving ? "" : "Approve"}
            </Button>
          )}
        </td>
      </tr>

      {/* Expanded detail row */}
      {expanded && (
        <tr className="border-b border-border bg-secondary/20">
          <td colSpan={10} className="px-6 py-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
              {/* Summary */}
              <div className="md:col-span-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                  Summary
                </p>
                <p className="text-foreground">
                  {policy.summary ?? (
                    <span className="text-muted-foreground italic">No summary recorded</span>
                  )}
                </p>
                {policy.contentPreview && (
                  <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
                    {policy.contentPreview}
                  </p>
                )}
              </div>

              {/* Dates */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                  Key Dates
                </p>
                <div className="space-y-1 text-xs">
                  {policy.effectiveDate && (
                    <div className="flex justify-between gap-2">
                      <span className="text-muted-foreground">Effective</span>
                      <span className="font-mono">{policy.effectiveDate}</span>
                    </div>
                  )}
                  {policy.expiryDate && (
                    <div className="flex justify-between gap-2">
                      <span className="text-muted-foreground">Expires</span>
                      <span className="font-mono">{policy.expiryDate}</span>
                    </div>
                  )}
                  {policy.lastReviewedAt && (
                    <div className="flex justify-between gap-2">
                      <span className="text-muted-foreground">Last Reviewed</span>
                      <span className="font-mono">{policy.lastReviewedAt}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Owner & NDIS */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                  Ownership &amp; Compliance
                </p>
                <div className="space-y-1 text-xs">
                  {policy.owner && (
                    <div className="flex justify-between gap-2">
                      <span className="text-muted-foreground">Owner</span>
                      <span className="font-medium">{policy.owner}</span>
                    </div>
                  )}
                  {policy.ndisRequired && policy.ndisPracticeStandard && (
                    <div>
                      <span className="text-muted-foreground block">NDIS Practice Standard</span>
                      <span className="font-medium text-purple-700 dark:text-purple-300">
                        {policy.ndisPracticeStandard}
                      </span>
                    </div>
                  )}
                  {policy.ndisRequired && (
                    <div className="flex justify-between gap-2">
                      <span className="text-muted-foreground">NDIS Compliant</span>
                      {policy.ndisCompliant === true ? (
                        <span className="text-green-600 dark:text-green-400 font-semibold flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3" /> Yes
                        </span>
                      ) : policy.ndisCompliant === false ? (
                        <span className="text-red-600 dark:text-red-400 font-semibold flex items-center gap-1">
                          <AlertCircle className="h-3 w-3" /> No
                        </span>
                      ) : (
                        <span className="text-muted-foreground italic">Unknown</span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ─── Overdue Review Row ───────────────────────────────────────────────────────

function OverduePolicyRow({ policy }: { policy: SdaPolicy }) {
  const daysOverdue = policy.daysUntilReview !== undefined ? Math.abs(policy.daysUntilReview) : 0;
  return (
    <tr className="border-b border-border hover:bg-secondary/30 transition-colors">
      <td className="px-4 py-3 text-sm">
        <span className="font-mono font-semibold text-xs tracking-wide text-muted-foreground">
          {policy.referenceNumber}
        </span>
      </td>
      <td className="px-4 py-3 text-sm font-medium">{policy.title}</td>
      <td className="px-4 py-3">
        <CategoryBadge category={policy.category} />
      </td>
      <td className="px-4 py-3">
        <StatusBadge status={policy.status} />
      </td>
      <td className="px-4 py-3 text-xs font-mono text-muted-foreground">{policy.reviewDate}</td>
      <td className="px-4 py-3">
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300">
          <Clock className="h-3 w-3" />
          {daysOverdue}d overdue
        </span>
      </td>
      <td className="px-4 py-3 text-xs text-muted-foreground">{policy.owner ?? "—"}</td>
    </tr>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function SdaPoliciesPage() {
  const [policies, setPolicies] = useState<SdaPolicy[]>([]);
  const [overduePolicies, setOverduePolicies] = useState<SdaPolicy[]>([]);
  const [dashboard, setDashboard] = useState<PolicyDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [dashboardLoading, setDashboardLoading] = useState(true);
  const [overdueLoading, setOverdueLoading] = useState(true);
  const [error, setError] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [ndisFilter, setNdisFilter] = useState<NdisFilter>("all");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [approvingId, setApprovingId] = useState<number | null>(null);
  const [addingNew, setAddingNew] = useState(false);

  const fetchPolicies = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const params = new URLSearchParams();
      if (categoryFilter !== "all") params.set("category", categoryFilter);
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (ndisFilter === "required") params.set("ndis_required", "true");
      if (ndisFilter === "not_required") params.set("ndis_required", "false");

      const url = `/api/v1/sda/policies${params.toString() ? `?${params.toString()}` : ""}`;
      const res = await api.get<{ success: boolean; data: SdaPolicy[] }>(url);
      if (res?.data) setPolicies(res.data);
      else if (Array.isArray(res)) setPolicies(res as SdaPolicy[]);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [categoryFilter, statusFilter, ndisFilter]);

  const fetchDashboard = useCallback(async () => {
    setDashboardLoading(true);
    try {
      const res = await api.get<{ success: boolean; data: PolicyDashboard }>(
        "/api/v1/sda/policies/dashboard"
      );
      if (res?.data) setDashboard(res.data);
    } catch {
      // Dashboard is non-critical
    } finally {
      setDashboardLoading(false);
    }
  }, []);

  const fetchOverdue = useCallback(async () => {
    setOverdueLoading(true);
    try {
      const res = await api.get<{ success: boolean; data: SdaPolicy[] }>(
        "/api/v1/sda/policies/due_for_review"
      );
      if (res?.data) setOverduePolicies(res.data);
      else if (Array.isArray(res)) setOverduePolicies(res as SdaPolicy[]);
    } catch {
      // Overdue list is non-critical
    } finally {
      setOverdueLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPolicies();
  }, [fetchPolicies]);

  useEffect(() => {
    fetchDashboard();
    fetchOverdue();
  }, [fetchDashboard, fetchOverdue]);

  const toggleExpanded = (id: number) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  const handleApprove = async (id: number) => {
    setApprovingId(id);
    try {
      const res = await api.post<{ success: boolean; data: SdaPolicy }>(
        `/api/v1/sda/policies/${id}/approve`,
        {}
      );
      if (res?.data) {
        setPolicies((prev) => prev.map((p) => (p.id === id ? res.data : p)));
        await fetchDashboard();
      }
    } catch {
      // Handle silently
    } finally {
      setApprovingId(null);
    }
  };

  const handleAddPolicy = async () => {
    setAddingNew(true);
    try {
      await api.post<{ success: boolean; data: SdaPolicy }>("/api/v1/sda/policies", {});
      await fetchPolicies();
      await fetchDashboard();
    } catch {
      // Handle silently
    } finally {
      setAddingNew(false);
    }
  };

  const hasDueForReview = !overdueLoading && overduePolicies.length > 0;

  const summaryCards = [
    {
      title: "Total Policies",
      value: dashboard?.total ?? 0,
      icon: BookOpen,
      iconBg: "bg-blue-100 dark:bg-blue-900/30",
      iconColor: "text-blue-600 dark:text-blue-400",
      valueColor: undefined,
    },
    {
      title: "Active",
      value: dashboard?.active ?? 0,
      icon: CheckCircle2,
      iconBg: "bg-green-100 dark:bg-green-900/30",
      iconColor: "text-green-600 dark:text-green-400",
      valueColor: undefined,
    },
    {
      title: "Due for Review",
      value: dashboard?.dueForReview ?? 0,
      icon: Clock,
      iconBg:
        (dashboard?.dueForReview ?? 0) > 0
          ? "bg-amber-100 dark:bg-amber-900/30"
          : "bg-gray-100 dark:bg-gray-800",
      iconColor:
        (dashboard?.dueForReview ?? 0) > 0
          ? "text-amber-600 dark:text-amber-400"
          : "text-gray-400 dark:text-gray-500",
      valueColor:
        (dashboard?.dueForReview ?? 0) > 0 ? "text-amber-600 dark:text-amber-400" : undefined,
    },
    {
      title: "NDIS Required",
      value: dashboard?.ndisRequired ?? 0,
      icon: Shield,
      iconBg: "bg-purple-100 dark:bg-purple-900/30",
      iconColor: "text-purple-600 dark:text-purple-400",
      valueColor: undefined,
    },
    {
      title: "NDIS Compliant",
      value: dashboard?.ndisCompliant ?? 0,
      icon: CheckCircle2,
      iconBg: "bg-emerald-100 dark:bg-emerald-900/30",
      iconColor: "text-emerald-600 dark:text-emerald-400",
      valueColor: undefined,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Due for Review Alert Banner */}
      {hasDueForReview && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 px-4 py-3">
          <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
              {overduePolicies.length} polic{overduePolicies.length === 1 ? "y" : "ies"} overdue for
              review
            </p>
            <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
              NDIS Practice Standards require policies to be reviewed at least annually. Overdue
              policies may put your registration compliance at risk.
            </p>
          </div>
        </div>
      )}

      {/* Dashboard Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {summaryCards.map((card, i) => {
          if (dashboardLoading) {
            return (
              <Card key={i}>
                <CardContent className="pt-5 pb-5">
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-9 w-9 rounded-lg" />
                    <div>
                      <Skeleton className="h-3 w-24 mb-1" />
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
          {/* Category filter pills */}
          <div className="flex flex-wrap gap-1">
            {CATEGORY_FILTERS.map((f) => (
              <Button
                key={f.value}
                variant={categoryFilter === f.value ? "default" : "outline"}
                size="sm"
                className="h-7 text-xs px-2.5"
                onClick={() => setCategoryFilter(f.value)}
              >
                {f.label}
                {f.value !== "all" && (
                  <span className="ml-1.5 font-mono opacity-70">
                    {policies.filter((p) => p.category === f.value).length}
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
                    {policies.filter((p) => p.status === f.value).length}
                  </span>
                )}
              </Button>
            ))}
          </div>

          {/* NDIS filter pills */}
          <div className="flex flex-wrap gap-1">
            {(
              [
                { value: "all", label: "NDIS: All" },
                { value: "required", label: "NDIS Required" },
                { value: "not_required", label: "Not Required" },
              ] as { value: NdisFilter; label: string }[]
            ).map((f) => (
              <Button
                key={f.value}
                variant={ndisFilter === f.value ? "default" : "outline"}
                size="sm"
                className="h-7 text-xs px-2.5"
                onClick={() => setNdisFilter(f.value)}
              >
                {f.value === "required" && <Shield className="h-3 w-3 mr-1" />}
                {f.label}
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
              fetchPolicies();
              fetchDashboard();
              fetchOverdue();
            }}
            disabled={loading}
          >
            <RefreshCw
              className={`h-3.5 w-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
          <Button size="sm" onClick={handleAddPolicy} disabled={addingNew}>
            {addingNew ? (
              <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
            ) : (
              <Plus className="h-3.5 w-3.5 mr-1.5" />
            )}
            Add Policy
          </Button>
        </div>
      </div>

      {/* Policies Table */}
      {error ? (
        <Card>
          <CardContent className="py-8 text-center">
            <AlertCircle className="h-7 w-7 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">Unable to load policies</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={fetchPolicies}>
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
                      Reference #
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Title
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Type
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Category
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Version
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">
                      Review Date
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">
                      NDIS Required
                    </th>
                    <th className="px-4 py-3 w-28">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    Array.from({ length: 7 }).map((_, i) => (
                      <tr key={i} className="border-b border-border">
                        <td className="px-3 py-3">
                          <Skeleton className="h-3.5 w-3.5 rounded" />
                        </td>
                        <td className="px-4 py-3">
                          <Skeleton className="h-4 w-24" />
                        </td>
                        <td className="px-4 py-3">
                          <Skeleton className="h-4 w-48" />
                        </td>
                        <td className="px-4 py-3">
                          <Skeleton className="h-5 w-20 rounded" />
                        </td>
                        <td className="px-4 py-3">
                          <Skeleton className="h-5 w-24 rounded" />
                        </td>
                        <td className="px-4 py-3">
                          <Skeleton className="h-4 w-8" />
                        </td>
                        <td className="px-4 py-3">
                          <Skeleton className="h-5 w-20 rounded" />
                        </td>
                        <td className="px-4 py-3">
                          <Skeleton className="h-4 w-20" />
                        </td>
                        <td className="px-4 py-3">
                          <Skeleton className="h-5 w-20 rounded" />
                        </td>
                        <td className="px-4 py-3" />
                      </tr>
                    ))
                  ) : policies.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="px-4 py-12 text-center">
                        <FileText className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                        <p className="text-sm font-medium text-foreground mb-1">
                          No policies found
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {categoryFilter !== "all" || statusFilter !== "all" || ndisFilter !== "all"
                            ? "No policies match the current filters."
                            : "No policies have been added yet."}
                        </p>
                      </td>
                    </tr>
                  ) : (
                    policies.map((policy) => (
                      <PolicyRow
                        key={policy.id}
                        policy={policy}
                        expanded={expandedId === policy.id}
                        onToggle={toggleExpanded}
                        onApprove={handleApprove}
                        approving={approvingId === policy.id}
                      />
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Table footer */}
            {!loading && policies.length > 0 && (
              <div className="px-4 py-3 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  Showing{" "}
                  <span className="font-mono font-medium text-foreground">{policies.length}</span>{" "}
                  polic{policies.length === 1 ? "y" : "ies"}
                </span>
                <span className="font-mono text-purple-600 dark:text-purple-400">
                  {policies.filter((p) => p.ndisRequired).length} NDIS required
                </span>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Due for Review Section */}
      {(overdueLoading || overduePolicies.length > 0) && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Clock className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            <h2 className="text-sm font-semibold text-foreground">
              Due for Review
            </h2>
            {!overdueLoading && (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300">
                {overduePolicies.length}
              </span>
            )}
          </div>

          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-secondary/50">
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">
                        Reference #
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Title
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Category
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">
                        Review Date
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Overdue
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Owner
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {overdueLoading ? (
                      Array.from({ length: 3 }).map((_, i) => (
                        <tr key={i} className="border-b border-border">
                          <td className="px-4 py-3">
                            <Skeleton className="h-4 w-20" />
                          </td>
                          <td className="px-4 py-3">
                            <Skeleton className="h-4 w-48" />
                          </td>
                          <td className="px-4 py-3">
                            <Skeleton className="h-5 w-24 rounded" />
                          </td>
                          <td className="px-4 py-3">
                            <Skeleton className="h-5 w-20 rounded" />
                          </td>
                          <td className="px-4 py-3">
                            <Skeleton className="h-4 w-20" />
                          </td>
                          <td className="px-4 py-3">
                            <Skeleton className="h-5 w-20 rounded" />
                          </td>
                          <td className="px-4 py-3">
                            <Skeleton className="h-4 w-24" />
                          </td>
                        </tr>
                      ))
                    ) : (
                      overduePolicies.map((policy) => (
                        <OverduePolicyRow key={policy.id} policy={policy} />
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
