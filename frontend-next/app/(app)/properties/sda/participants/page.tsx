"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import {
  AlertCircle,
  Star,
  Users,
  TrendingUp,
  AlertTriangle,
  ClipboardList,
  ChevronDown,
  ChevronUp,
  CheckSquare,
  Square,
  Plus,
  Filter,
  RefreshCw,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface RatingDimensions {
  overall_satisfaction: number;
  housing_quality: number;
  maintenance_response: number;
  safety: number;
  independence: number;
  community_access: number;
}

type GoalsStatus = "on_track" | "at_risk" | "behind" | "achieved";
type OutcomeType =
  | "satisfaction_survey"
  | "goal_review"
  | "independence_assessment"
  | "wellbeing_check";

interface ParticipantOutcome {
  id: number;
  participantName: string;
  propertyAddress: string;
  type: OutcomeType;
  date: string;
  overallRating: number;
  goalsStatus: GoalsStatus;
  averageScore: number;
  dimensions: RatingDimensions;
  feedback?: string;
  actionItems: string[];
}

interface OutcomesSummary {
  totalAssessments: number;
  averageSatisfaction: number;
  goalsOnTrackPct: number;
  needsAttentionCount: number;
}

type OutcomeTypeFilter = OutcomeType | "all";

// ─── Config ───────────────────────────────────────────────────────────────────

const OUTCOME_TYPE_LABELS: Record<OutcomeType, string> = {
  satisfaction_survey: "Satisfaction Survey",
  goal_review: "Goal Review",
  independence_assessment: "Independence Assessment",
  wellbeing_check: "Wellbeing Check",
};

const GOALS_STATUS_CONFIG: Record<
  GoalsStatus,
  { label: string; bg: string; text: string }
> = {
  on_track: {
    label: "On Track",
    bg: "bg-green-100 dark:bg-green-900/30",
    text: "text-green-700 dark:text-green-300",
  },
  at_risk: {
    label: "At Risk",
    bg: "bg-amber-100 dark:bg-amber-900/30",
    text: "text-amber-700 dark:text-amber-300",
  },
  behind: {
    label: "Behind",
    bg: "bg-red-100 dark:bg-red-900/30",
    text: "text-red-700 dark:text-red-300",
  },
  achieved: {
    label: "Achieved",
    bg: "bg-blue-100 dark:bg-blue-900/30",
    text: "text-blue-700 dark:text-blue-300",
  },
};

const DIMENSION_LABELS: Record<keyof RatingDimensions, string> = {
  overall_satisfaction: "Overall Satisfaction",
  housing_quality: "Housing Quality",
  maintenance_response: "Maintenance Response",
  safety: "Safety",
  independence: "Independence",
  community_access: "Community Access",
};

const TYPE_FILTERS: { value: OutcomeTypeFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "satisfaction_survey", label: "Satisfaction Survey" },
  { value: "goal_review", label: "Goal Review" },
  { value: "independence_assessment", label: "Independence" },
  { value: "wellbeing_check", label: "Wellbeing" },
];

// ─── Star Rating Display ──────────────────────────────────────────────────────

function StarRating({ rating, max = 5 }: { rating: number; max?: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${rating} out of ${max} stars`}>
      {Array.from({ length: max }).map((_, i) => (
        <Star
          key={i}
          className={`h-3.5 w-3.5 ${
            i < Math.round(rating)
              ? "fill-amber-400 text-amber-400"
              : "fill-transparent text-gray-300 dark:text-gray-600"
          }`}
        />
      ))}
    </span>
  );
}

// ─── Goals Status Badge ───────────────────────────────────────────────────────

function GoalsBadge({ status }: { status: GoalsStatus }) {
  const cfg = GOALS_STATUS_CONFIG[status];
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${cfg.bg} ${cfg.text}`}
    >
      {cfg.label}
    </span>
  );
}

// ─── Mini Bar Chart for Dimensions ───────────────────────────────────────────

function DimensionsChart({ dimensions }: { dimensions: RatingDimensions }) {
  return (
    <div className="grid gap-2">
      {(Object.keys(dimensions) as Array<keyof RatingDimensions>).map((key) => {
        const value = dimensions[key];
        const pct = (value / 5) * 100;
        return (
          <div key={key} className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground w-40 shrink-0">
              {DIMENSION_LABELS[key]}
            </span>
            <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-amber-400 dark:bg-amber-500 rounded-full transition-all duration-300"
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="text-xs font-mono font-semibold text-foreground w-6 text-right">
              {value.toFixed(1)}
            </span>
          </div>
        );
      })}
    </div>
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

// ─── Outcome Row (expandable) ─────────────────────────────────────────────────

function OutcomeRow({ outcome }: { outcome: ParticipantOutcome }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <>
      <tr
        className={`border-b border-border transition-colors cursor-pointer ${
          expanded ? "bg-primary/5" : "hover:bg-secondary/40"
        }`}
        onClick={() => setExpanded((v) => !v)}
      >
        {/* Participant */}
        <td className="px-4 py-3 text-sm">
          <div className="font-medium">{outcome.participantName}</div>
        </td>

        {/* Property */}
        <td className="px-4 py-3 text-sm">
          <div className="truncate max-w-[160px] text-muted-foreground">
            {outcome.propertyAddress}
          </div>
        </td>

        {/* Type */}
        <td className="px-4 py-3 text-sm text-muted-foreground">
          {OUTCOME_TYPE_LABELS[outcome.type]}
        </td>

        {/* Date */}
        <td className="px-4 py-3 text-xs text-muted-foreground font-mono">
          {outcome.date}
        </td>

        {/* Overall Rating */}
        <td className="px-4 py-3">
          <StarRating rating={outcome.overallRating} />
        </td>

        {/* Goals Status */}
        <td className="px-4 py-3">
          <GoalsBadge status={outcome.goalsStatus} />
        </td>

        {/* Average Score */}
        <td className="px-4 py-3 text-sm font-mono font-semibold">
          {outcome.averageScore.toFixed(1)}
          <span className="text-muted-foreground font-normal">/5</span>
        </td>

        {/* Expand toggle */}
        <td className="px-4 py-3 text-muted-foreground" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => setExpanded((v) => !v)}
            className="p-1 rounded hover:bg-secondary transition-colors"
            aria-label={expanded ? "Collapse" : "Expand"}
          >
            {expanded ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </button>
        </td>
      </tr>

      {/* Expanded panel */}
      {expanded && (
        <tr className="border-b border-border bg-secondary/20">
          <td colSpan={8} className="px-6 py-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Dimensions chart */}
              <div>
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                  Rating Dimensions
                </h4>
                <DimensionsChart dimensions={outcome.dimensions} />
              </div>

              {/* Feedback + action items */}
              <div className="space-y-4">
                {outcome.feedback && (
                  <div>
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                      Participant Feedback
                    </h4>
                    <p className="text-sm text-foreground leading-relaxed bg-background rounded-md px-3 py-2 border border-border">
                      {outcome.feedback}
                    </p>
                  </div>
                )}

                {outcome.actionItems.length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                      Action Items
                    </h4>
                    <ul className="space-y-1.5">
                      {outcome.actionItems.map((item, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm">
                          <CheckSquare className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {outcome.actionItems.length === 0 && !outcome.feedback && (
                  <p className="text-sm text-muted-foreground italic">
                    No additional details recorded.
                  </p>
                )}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ─── New Assessment Modal (inline sheet) ─────────────────────────────────────

function NewAssessmentPanel({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    participantName: "",
    propertyAddress: "",
    type: "satisfaction_survey" as OutcomeType,
    date: new Date().toISOString().split("T")[0],
    overallRating: 3,
    goalsStatus: "on_track" as GoalsStatus,
    feedback: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post("/api/v1/sda/outcomes", form);
      onCreated();
      onClose();
    } catch {
      // Handle silently
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />
      {/* Panel */}
      <div className="relative ml-auto h-full w-full max-w-md bg-background border-l border-border shadow-xl flex flex-col overflow-y-auto">
        <div className="px-6 py-5 border-b border-border flex items-center justify-between">
          <h2 className="text-base font-semibold">New Assessment</h2>
          <Button variant="ghost" size="sm" onClick={onClose} className="h-8 w-8 p-0">
            <ChevronUp className="h-4 w-4 rotate-90" />
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 px-6 py-5 space-y-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide block mb-1">
              Participant Name
            </label>
            <input
              required
              value={form.participantName}
              onChange={(e) => setForm((f) => ({ ...f, participantName: e.target.value }))}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="e.g. Jane Smith"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide block mb-1">
              Property Address
            </label>
            <input
              required
              value={form.propertyAddress}
              onChange={(e) => setForm((f) => ({ ...f, propertyAddress: e.target.value }))}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="e.g. 12 Acacia Ave, Brisbane"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide block mb-1">
              Assessment Type
            </label>
            <select
              value={form.type}
              onChange={(e) =>
                setForm((f) => ({ ...f, type: e.target.value as OutcomeType }))
              }
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            >
              {(Object.keys(OUTCOME_TYPE_LABELS) as OutcomeType[]).map((t) => (
                <option key={t} value={t}>
                  {OUTCOME_TYPE_LABELS[t]}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide block mb-1">
              Date
            </label>
            <input
              type="date"
              required
              value={form.date}
              onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide block mb-1">
              Overall Rating (1–5)
            </label>
            <div className="flex items-center gap-2">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, overallRating: n }))}
                  className="p-0.5 rounded transition-transform hover:scale-110"
                  aria-label={`${n} star${n > 1 ? "s" : ""}`}
                >
                  <Star
                    className={`h-6 w-6 transition-colors ${
                      n <= form.overallRating
                        ? "fill-amber-400 text-amber-400"
                        : "fill-transparent text-gray-300 dark:text-gray-600"
                    }`}
                  />
                </button>
              ))}
              <span className="text-sm font-mono text-muted-foreground ml-1">
                {form.overallRating}/5
              </span>
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide block mb-1">
              Goals Status
            </label>
            <select
              value={form.goalsStatus}
              onChange={(e) =>
                setForm((f) => ({ ...f, goalsStatus: e.target.value as GoalsStatus }))
              }
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            >
              {(Object.keys(GOALS_STATUS_CONFIG) as GoalsStatus[]).map((s) => (
                <option key={s} value={s}>
                  {GOALS_STATUS_CONFIG[s].label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide block mb-1">
              Participant Feedback
            </label>
            <textarea
              value={form.feedback}
              onChange={(e) => setForm((f) => ({ ...f, feedback: e.target.value }))}
              rows={3}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none"
              placeholder="Optional feedback from participant..."
            />
          </div>

          <div className="pt-2 flex gap-2">
            <Button type="submit" disabled={submitting} className="flex-1">
              {submitting ? "Saving…" : "Save Assessment"}
            </Button>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function SdaParticipantsPage() {
  const [outcomes, setOutcomes] = useState<ParticipantOutcome[]>([]);
  const [summary, setSummary] = useState<OutcomesSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [error, setError] = useState(false);
  const [typeFilter, setTypeFilter] = useState<OutcomeTypeFilter>("all");
  const [needsAttentionOnly, setNeedsAttentionOnly] = useState(false);
  const [showNewAssessment, setShowNewAssessment] = useState(false);

  const fetchOutcomes = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await api.get<{ success: boolean; data: ParticipantOutcome[] }>(
        "/api/v1/sda/outcomes"
      );
      if (res?.data) setOutcomes(res.data);
      else if (Array.isArray(res)) setOutcomes(res as ParticipantOutcome[]);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchSummary = useCallback(async () => {
    setSummaryLoading(true);
    try {
      const res = await api.get<{ success: boolean; data: OutcomesSummary }>(
        "/api/v1/sda/outcomes/summary"
      );
      if (res?.data) setSummary(res.data);
    } catch {
      // Summary is non-critical
    } finally {
      setSummaryLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOutcomes();
    fetchSummary();
  }, [fetchOutcomes, fetchSummary]);

  // Filter logic
  const filtered = outcomes.filter((o) => {
    if (typeFilter !== "all" && o.type !== typeFilter) return false;
    if (needsAttentionOnly && o.goalsStatus !== "behind" && o.goalsStatus !== "at_risk") return false;
    return true;
  });

  const summaryCards = summary
    ? [
        {
          title: "Total Assessments",
          value: summary.totalAssessments,
          icon: ClipboardList,
          iconBg: "bg-blue-100 dark:bg-blue-900/30",
          iconColor: "text-blue-600 dark:text-blue-400",
        },
        {
          title: "Avg Satisfaction",
          value: `${summary.averageSatisfaction.toFixed(1)}/5`,
          icon: Star,
          iconBg: "bg-amber-100 dark:bg-amber-900/30",
          iconColor: "text-amber-600 dark:text-amber-400",
        },
        {
          title: "Goals On Track",
          value: `${Math.round(summary.goalsOnTrackPct)}%`,
          icon: TrendingUp,
          iconBg: "bg-green-100 dark:bg-green-900/30",
          iconColor: "text-green-600 dark:text-green-400",
        },
        {
          title: "Needs Attention",
          value: summary.needsAttentionCount,
          icon: AlertTriangle,
          iconBg: "bg-red-100 dark:bg-red-900/30",
          iconColor: "text-red-600 dark:text-red-400",
        },
      ]
    : [];

  return (
    <>
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
          {/* Type filter chips */}
          <div className="flex flex-wrap gap-1">
            {TYPE_FILTERS.map((f) => (
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
                    {outcomes.filter((o) => o.type === f.value).length}
                  </span>
                )}
              </Button>
            ))}
          </div>

          {/* Right side */}
          <div className="flex items-center gap-2">
            <Button
              variant={needsAttentionOnly ? "default" : "outline"}
              size="sm"
              className="h-7 text-xs px-2.5"
              onClick={() => setNeedsAttentionOnly((v) => !v)}
            >
              <AlertTriangle className="h-3 w-3 mr-1.5" />
              Needs Attention
              {summary && summary.needsAttentionCount > 0 && (
                <span className="ml-1.5 font-mono opacity-80">
                  {summary.needsAttentionCount}
                </span>
              )}
            </Button>

            <Button
              variant="outline"
              size="sm"
              className="h-7"
              onClick={() => {
                fetchOutcomes();
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
              size="sm"
              className="h-7"
              onClick={() => setShowNewAssessment(true)}
            >
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              New Assessment
            </Button>
          </div>
        </div>

        {/* Table */}
        {error ? (
          <Card>
            <CardContent className="py-8 text-center">
              <AlertCircle className="h-7 w-7 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">Unable to load outcomes</p>
              <Button variant="outline" size="sm" className="mt-3" onClick={fetchOutcomes}>
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
                        Participant
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Property
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Type
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Date
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Overall Rating
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Goals Status
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Avg Score
                      </th>
                      <th className="px-4 py-3 w-10">
                        <span className="sr-only">Expand</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      Array.from({ length: 6 }).map((_, i) => (
                        <tr key={i} className="border-b border-border">
                          <td className="px-4 py-3">
                            <Skeleton className="h-4 w-32" />
                          </td>
                          <td className="px-4 py-3">
                            <Skeleton className="h-4 w-36" />
                          </td>
                          <td className="px-4 py-3">
                            <Skeleton className="h-4 w-28" />
                          </td>
                          <td className="px-4 py-3">
                            <Skeleton className="h-4 w-20" />
                          </td>
                          <td className="px-4 py-3">
                            <Skeleton className="h-4 w-24" />
                          </td>
                          <td className="px-4 py-3">
                            <Skeleton className="h-5 w-18 rounded" />
                          </td>
                          <td className="px-4 py-3">
                            <Skeleton className="h-4 w-10" />
                          </td>
                          <td className="px-4 py-3">
                            <Skeleton className="h-4 w-6" />
                          </td>
                        </tr>
                      ))
                    ) : filtered.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-4 py-12 text-center">
                          <Users className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                          <p className="text-sm text-muted-foreground">
                            {needsAttentionOnly
                              ? "No participants currently need attention"
                              : typeFilter !== "all"
                              ? `No ${OUTCOME_TYPE_LABELS[typeFilter as OutcomeType]} records`
                              : "No assessments recorded yet"}
                          </p>
                          {!needsAttentionOnly && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="mt-3"
                              onClick={() => setShowNewAssessment(true)}
                            >
                              <Plus className="h-3.5 w-3.5 mr-1.5" />
                              New Assessment
                            </Button>
                          )}
                        </td>
                      </tr>
                    ) : (
                      filtered.map((outcome) => (
                        <OutcomeRow key={outcome.id} outcome={outcome} />
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
                      {outcomes.length}
                    </span>{" "}
                    assessments
                  </span>
                  {needsAttentionOnly && (
                    <button
                      onClick={() => setNeedsAttentionOnly(false)}
                      className="text-primary hover:underline"
                    >
                      Clear filter
                    </button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* New Assessment Panel */}
      <NewAssessmentPanel
        open={showNewAssessment}
        onClose={() => setShowNewAssessment(false)}
        onCreated={() => {
          fetchOutcomes();
          fetchSummary();
        }}
      />
    </>
  );
}
