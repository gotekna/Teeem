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
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

type Severity = "minor" | "moderate" | "serious" | "critical";
type IncidentStatus =
  | "reported"
  | "investigating"
  | "resolved"
  | "closed"
  | "reported_to_commission";
type NdisStatus = "reported" | "overdue" | "required" | "na";

interface SdaIncident {
  id: number;
  incidentNumber: string;
  propertyAddress: string;
  incidentType: string;
  severity: Severity;
  status: IncidentStatus;
  occurredAt: string;
  ndisStatus: NdisStatus;
  reportedBy: string;
  description?: string;
  immediateAction?: string;
  rootCause?: string;
  ndisReportable: boolean;
  ndisReportedAt?: string;
}

interface IncidentsSummary {
  totalThisYear: number;
  open: number;
  ndisReportable: number;
  overdueReports: number;
}

type SeverityFilter = Severity | "all";
type StatusFilter = IncidentStatus | "all";

// ─── Constants ───────────────────────────────────────────────────────────────

const INCIDENT_TYPE_LABELS: Record<string, string> = {
  property_damage: "Property Damage",
  participant_injury: "Participant Injury",
  fire: "Fire",
  flood: "Flood",
  security_breach: "Security Breach",
  equipment_failure: "Equipment Failure",
  medication_error: "Medication Error",
  fall: "Fall",
  behavioural_incident: "Behavioural Incident",
  environmental_hazard: "Environmental Hazard",
  abuse_neglect: "Abuse / Neglect",
  unexplained_death: "Unexplained Death",
  missing_person: "Missing Person",
  restrictive_practice: "Restrictive Practice",
  other: "Other",
};

const SEVERITY_FILTERS: { value: SeverityFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "minor", label: "Minor" },
  { value: "moderate", label: "Moderate" },
  { value: "serious", label: "Serious" },
  { value: "critical", label: "Critical" },
];

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "reported", label: "Reported" },
  { value: "investigating", label: "Investigating" },
  { value: "resolved", label: "Resolved" },
  { value: "closed", label: "Closed" },
  { value: "reported_to_commission", label: "Commission" },
];

const SEVERITY_CONFIG: Record<
  Severity,
  { label: string; bg: string; text: string; dot: string }
> = {
  minor: {
    label: "Minor",
    bg: "bg-gray-100 dark:bg-gray-800",
    text: "text-gray-600 dark:text-gray-400",
    dot: "bg-gray-400",
  },
  moderate: {
    label: "Moderate",
    bg: "bg-amber-100 dark:bg-amber-900/30",
    text: "text-amber-700 dark:text-amber-300",
    dot: "bg-amber-500",
  },
  serious: {
    label: "Serious",
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
  IncidentStatus,
  { label: string; bg: string; text: string; icon: React.ElementType }
> = {
  reported: {
    label: "Reported",
    bg: "bg-blue-100 dark:bg-blue-900/30",
    text: "text-blue-700 dark:text-blue-300",
    icon: FileText,
  },
  investigating: {
    label: "Investigating",
    bg: "bg-amber-100 dark:bg-amber-900/30",
    text: "text-amber-700 dark:text-amber-300",
    icon: Activity,
  },
  resolved: {
    label: "Resolved",
    bg: "bg-green-100 dark:bg-green-900/30",
    text: "text-green-700 dark:text-green-300",
    icon: CheckCircle2,
  },
  closed: {
    label: "Closed",
    bg: "bg-gray-100 dark:bg-gray-800",
    text: "text-gray-600 dark:text-gray-400",
    icon: XCircle,
  },
  reported_to_commission: {
    label: "Commission",
    bg: "bg-purple-100 dark:bg-purple-900/30",
    text: "text-purple-700 dark:text-purple-300",
    icon: Shield,
  },
};

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

function StatusBadge({ status }: { status: IncidentStatus }) {
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

function NdisStatusBadge({
  ndisStatus,
  ndisReportable,
}: {
  ndisStatus: NdisStatus;
  ndisReportable: boolean;
}) {
  if (!ndisReportable || ndisStatus === "na") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500">
        N/A
      </span>
    );
  }
  if (ndisStatus === "reported") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300">
        <CheckCircle2 className="h-3 w-3" />
        Reported
      </span>
    );
  }
  if (ndisStatus === "overdue") {
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

function IncidentRow({
  incident,
  expanded,
  onToggle,
  onReportToNdis,
  reporting,
}: {
  incident: SdaIncident;
  expanded: boolean;
  onToggle: (id: number) => void;
  onReportToNdis: (id: number) => void;
  reporting: boolean;
}) {
  const typeLabel =
    INCIDENT_TYPE_LABELS[incident.incidentType] ?? incident.incidentType;
  const showReportButton =
    incident.ndisReportable && incident.ndisStatus !== "reported";

  return (
    <>
      <tr
        className={`border-b border-border transition-colors cursor-pointer ${
          expanded ? "bg-primary/5" : "hover:bg-secondary/40"
        }`}
        onClick={() => onToggle(incident.id)}
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

        {/* Incident # */}
        <td className="px-4 py-3 text-sm">
          <span className="font-mono font-semibold text-xs tracking-wide">
            {incident.incidentNumber}
          </span>
        </td>

        {/* Property */}
        <td className="px-4 py-3 text-sm">
          <div className="font-medium truncate max-w-[160px]">
            {incident.propertyAddress}
          </div>
        </td>

        {/* Type */}
        <td className="px-4 py-3 text-sm text-muted-foreground">
          {typeLabel}
        </td>

        {/* Severity */}
        <td className="px-4 py-3">
          <SeverityBadge severity={incident.severity} />
        </td>

        {/* Status */}
        <td className="px-4 py-3">
          <StatusBadge status={incident.status} />
        </td>

        {/* Date/Time */}
        <td className="px-4 py-3 text-xs text-muted-foreground font-mono whitespace-nowrap">
          {incident.occurredAt}
        </td>

        {/* NDIS Status */}
        <td className="px-4 py-3">
          <NdisStatusBadge
            ndisStatus={incident.ndisStatus}
            ndisReportable={incident.ndisReportable}
          />
        </td>

        {/* Reported By */}
        <td className="px-4 py-3 text-xs text-muted-foreground">
          {incident.reportedBy}
        </td>

        {/* Actions */}
        <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
          {showReportButton && (
            <Button
              size="sm"
              variant="outline"
              className="h-6 text-xs px-2 border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-900/20"
              onClick={() => onReportToNdis(incident.id)}
              disabled={reporting}
              aria-label={`Report incident ${incident.incidentNumber} to NDIS Commission`}
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
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                  Description
                </p>
                <p className="text-foreground">
                  {incident.description ?? <span className="text-muted-foreground italic">No description recorded</span>}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                  Immediate Action Taken
                </p>
                <p className="text-foreground">
                  {incident.immediateAction ?? <span className="text-muted-foreground italic">Not recorded</span>}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                  Root Cause
                </p>
                <p className="text-foreground">
                  {incident.rootCause ?? <span className="text-muted-foreground italic">Under investigation</span>}
                </p>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function SdaIncidentsPage() {
  const [incidents, setIncidents] = useState<SdaIncident[]>([]);
  const [summary, setSummary] = useState<IncidentsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [error, setError] = useState(false);
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [reportingId, setReportingId] = useState<number | null>(null);
  const [loggingNew, setLoggingNew] = useState(false);

  const fetchIncidents = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await api.get<{ success: boolean; data: SdaIncident[] }>(
        "/api/v1/sda/incidents"
      );
      if (res?.data) setIncidents(res.data);
      else if (Array.isArray(res)) setIncidents(res as SdaIncident[]);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchSummary = useCallback(async () => {
    setSummaryLoading(true);
    try {
      const res = await api.get<{ success: boolean; data: IncidentsSummary }>(
        "/api/v1/sda/incidents/overdue_reports"
      );
      if (res?.data) setSummary(res.data);
    } catch {
      // Summary is non-critical
    } finally {
      setSummaryLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchIncidents();
    fetchSummary();
  }, [fetchIncidents, fetchSummary]);

  const filtered = incidents.filter((inc) => {
    const matchesSeverity =
      severityFilter === "all" || inc.severity === severityFilter;
    const matchesStatus =
      statusFilter === "all" || inc.status === statusFilter;
    return matchesSeverity && matchesStatus;
  });

  const toggleExpanded = (id: number) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  const handleReportToNdis = async (id: number) => {
    setReportingId(id);
    try {
      const res = await api.post<{ success: boolean; data: SdaIncident }>(
        `/api/v1/sda/incidents/${id}/report_to_ndis`,
        {}
      );
      if (res?.data) {
        setIncidents((prev) =>
          prev.map((inc) => (inc.id === id ? res.data : inc))
        );
        await fetchSummary();
      }
    } catch {
      // Handle silently
    } finally {
      setReportingId(null);
    }
  };

  const handleLogIncident = async () => {
    setLoggingNew(true);
    try {
      await api.post<{ success: boolean; data: SdaIncident }>(
        "/api/v1/sda/incidents",
        {}
      );
      await fetchIncidents();
      await fetchSummary();
    } catch {
      // Handle silently
    } finally {
      setLoggingNew(false);
    }
  };

  const overdueCount = summary?.overdueReports ?? 0;
  const hasOverdue = overdueCount > 0;

  const summaryCards = [
    {
      title: "Total Incidents (This Year)",
      value: summary?.totalThisYear ?? 0,
      icon: FileText,
      iconBg: "bg-blue-100 dark:bg-blue-900/30",
      iconColor: "text-blue-600 dark:text-blue-400",
      valueColor: undefined,
    },
    {
      title: "Open",
      value: summary?.open ?? 0,
      icon: Activity,
      iconBg: "bg-amber-100 dark:bg-amber-900/30",
      iconColor: "text-amber-600 dark:text-amber-400",
      valueColor: undefined,
    },
    {
      title: "NDIS Reportable",
      value: summary?.ndisReportable ?? 0,
      icon: Shield,
      iconBg: "bg-purple-100 dark:bg-purple-900/30",
      iconColor: "text-purple-600 dark:text-purple-400",
      valueColor: undefined,
    },
    {
      title: "Overdue Reports",
      value: overdueCount,
      icon: AlertTriangle,
      iconBg: hasOverdue
        ? "bg-red-100 dark:bg-red-900/30"
        : "bg-gray-100 dark:bg-gray-800",
      iconColor: hasOverdue
        ? "text-red-600 dark:text-red-400"
        : "text-gray-400 dark:text-gray-500",
      valueColor: hasOverdue ? "text-red-600 dark:text-red-400" : undefined,
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
              {overdueCount} overdue NDIS report{overdueCount > 1 ? "s" : ""} requiring immediate action
            </p>
            <p className="text-xs text-red-700 dark:text-red-400 mt-0.5">
              NDIS Commission requires incident reports within 24 hours. These reports are past due and must be submitted immediately to avoid compliance breaches.
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
                    {incidents.filter((inc) => inc.severity === f.value).length}
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
                    {incidents.filter((inc) => inc.status === f.value).length}
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
            onClick={() => { fetchIncidents(); fetchSummary(); }}
            disabled={loading}
          >
            <RefreshCw
              className={`h-3.5 w-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
          <Button
            size="sm"
            onClick={handleLogIncident}
            disabled={loggingNew}
          >
            {loggingNew ? (
              <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
            ) : (
              <Plus className="h-3.5 w-3.5 mr-1.5" />
            )}
            Log Incident
          </Button>
        </div>
      </div>

      {/* Incidents Table */}
      {error ? (
        <Card>
          <CardContent className="py-8 text-center">
            <AlertCircle className="h-7 w-7 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">Unable to load incidents</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={fetchIncidents}
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
                      Incident #
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Property
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Type
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Severity
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">
                      Date / Time
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">
                      NDIS Status
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">
                      Reported By
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
                          <Skeleton className="h-4 w-20" />
                        </td>
                        <td className="px-4 py-3">
                          <Skeleton className="h-4 w-36" />
                        </td>
                        <td className="px-4 py-3">
                          <Skeleton className="h-4 w-24" />
                        </td>
                        <td className="px-4 py-3">
                          <Skeleton className="h-5 w-16 rounded" />
                        </td>
                        <td className="px-4 py-3">
                          <Skeleton className="h-5 w-20 rounded" />
                        </td>
                        <td className="px-4 py-3">
                          <Skeleton className="h-4 w-28" />
                        </td>
                        <td className="px-4 py-3">
                          <Skeleton className="h-5 w-16 rounded" />
                        </td>
                        <td className="px-4 py-3">
                          <Skeleton className="h-4 w-20" />
                        </td>
                        <td className="px-4 py-3" />
                      </tr>
                    ))
                  ) : filtered.length === 0 ? (
                    <tr>
                      <td
                        colSpan={10}
                        className="px-4 py-12 text-center"
                      >
                        <FileText className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                        <p className="text-sm text-muted-foreground">
                          {severityFilter === "all" && statusFilter === "all"
                            ? "No incidents recorded"
                            : "No incidents match these filters"}
                        </p>
                      </td>
                    </tr>
                  ) : (
                    filtered.map((incident) => (
                      <IncidentRow
                        key={incident.id}
                        incident={incident}
                        expanded={expandedId === incident.id}
                        onToggle={toggleExpanded}
                        onReportToNdis={handleReportToNdis}
                        reporting={reportingId === incident.id}
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
                    {incidents.length}
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
