"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import {
  AlertCircle,
  DoorOpen,
  Clock,
  TrendingDown,
  Bell,
  RefreshCw,
  Send,
  Users,
  FileText,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface SdaVacancy {
  id: number;
  propertyAddress: string;
  suburb: string;
  sdaCategory: string;
  vacancyReason: string;
  startDate: string;
  daysVacant: number;
  dailyLostIncome: number;
  ndiaStatus: "notified" | "overdue" | "pending";
  status: "open" | "notified" | "listed" | "filled" | "closed";
}

interface VacanciesSummary {
  activeVacancies: number;
  avgDaysVacant: number;
  monthlyLostIncome: number;
  ndiaOverdueCount: number;
}

type VacancyStatus = SdaVacancy["status"] | "all";

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<
  SdaVacancy["status"],
  { label: string; bg: string; text: string }
> = {
  open: {
    label: "Open",
    bg: "bg-red-100 dark:bg-red-900/30",
    text: "text-red-700 dark:text-red-300",
  },
  notified: {
    label: "Notified",
    bg: "bg-blue-100 dark:bg-blue-900/30",
    text: "text-blue-700 dark:text-blue-300",
  },
  listed: {
    label: "Listed",
    bg: "bg-amber-100 dark:bg-amber-900/30",
    text: "text-amber-700 dark:text-amber-300",
  },
  filled: {
    label: "Filled",
    bg: "bg-green-100 dark:bg-green-900/30",
    text: "text-green-700 dark:text-green-300",
  },
  closed: {
    label: "Closed",
    bg: "bg-gray-100 dark:bg-gray-800",
    text: "text-gray-600 dark:text-gray-400",
  },
};

const SDA_CATEGORY_COLORS: Record<string, string> = {
  "Fully Accessible": "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  "High Physical Support": "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300",
  "Improved Liveability": "bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300",
  "Robust": "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300",
};

// ─── NDIA Status Badge ─────────────────────────────────────────────────────────

function NdiaStatusBadge({ ndiaStatus }: { ndiaStatus: SdaVacancy["ndiaStatus"] }) {
  if (ndiaStatus === "notified") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300">
        <Bell className="h-3 w-3" />
        Notified
      </span>
    );
  }
  if (ndiaStatus === "overdue") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 animate-pulse">
        <AlertCircle className="h-3 w-3" />
        Overdue!
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
      <Clock className="h-3 w-3" />
      Pending
    </span>
  );
}

// ─── Vacancy Status Badge ─────────────────────────────────────────────────────

function VacancyStatusBadge({ status }: { status: SdaVacancy["status"] }) {
  const cfg = STATUS_CONFIG[status];
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${cfg.bg} ${cfg.text}`}
    >
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

// ─── Vacancy Table Row ────────────────────────────────────────────────────────

function VacancyRow({
  vacancy,
  onNotifyNdia,
  notifying,
}: {
  vacancy: SdaVacancy;
  onNotifyNdia: (id: number) => void;
  notifying: boolean;
}) {
  const categoryColor =
    SDA_CATEGORY_COLORS[vacancy.sdaCategory] ??
    "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300";

  return (
    <tr className="border-b border-border hover:bg-secondary/40 transition-colors">
      <td className="px-4 py-3 text-sm">
        <div className="font-medium">{vacancy.propertyAddress}</div>
        <div className="text-xs text-muted-foreground">{vacancy.suburb}</div>
        <span
          className={`inline-block mt-1 px-1.5 py-0.5 rounded text-xs font-medium ${categoryColor}`}
        >
          {vacancy.sdaCategory}
        </span>
      </td>
      <td className="px-4 py-3 text-sm text-muted-foreground">{vacancy.vacancyReason}</td>
      <td className="px-4 py-3 text-sm font-mono text-xs">{vacancy.startDate}</td>
      <td className="px-4 py-3 text-sm">
        <span
          className={`font-mono font-semibold ${
            vacancy.daysVacant >= 28
              ? "text-red-600 dark:text-red-400"
              : vacancy.daysVacant >= 14
              ? "text-amber-600 dark:text-amber-400"
              : "text-foreground"
          }`}
        >
          {vacancy.daysVacant}d
        </span>
      </td>
      <td className="px-4 py-3 text-sm font-mono">
        ${vacancy.dailyLostIncome.toLocaleString()}/day
      </td>
      <td className="px-4 py-3">
        <NdiaStatusBadge ndiaStatus={vacancy.ndiaStatus} />
      </td>
      <td className="px-4 py-3">
        <VacancyStatusBadge status={vacancy.status} />
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-1.5">
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs px-2"
            onClick={() => onNotifyNdia(vacancy.id)}
            disabled={notifying || vacancy.ndiaStatus === "notified"}
          >
            <Send className="h-3 w-3 mr-1" />
            Report to SDA Finder
          </Button>
          <Button variant="outline" size="sm" className="h-7 text-xs px-2">
            <Users className="h-3 w-3 mr-1" />
            Match
          </Button>
        </div>
      </td>
    </tr>
  );
}

// ─── Status Filters ───────────────────────────────────────────────────────────

const STATUS_FILTERS: { value: VacancyStatus; label: string }[] = [
  { value: "all", label: "All" },
  { value: "open", label: "Open" },
  { value: "notified", label: "Notified" },
  { value: "listed", label: "Listed" },
  { value: "filled", label: "Filled" },
  { value: "closed", label: "Closed" },
];

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function SdaVacanciesPage() {
  const [vacancies, setVacancies] = useState<SdaVacancy[]>([]);
  const [summary, setSummary] = useState<VacanciesSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [error, setError] = useState(false);
  const [statusFilter, setStatusFilter] = useState<VacancyStatus>("all");
  const [notifyingId, setNotifyingId] = useState<number | null>(null);

  const fetchVacancies = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await api.get<{ success: boolean; data: SdaVacancy[] }>("/api/v1/sda/vacancies");
      if (res?.data) setVacancies(res.data);
      else if (Array.isArray(res)) setVacancies(res as SdaVacancy[]);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchSummary = useCallback(async () => {
    setSummaryLoading(true);
    try {
      const res = await api.get<{ success: boolean; data: VacanciesSummary }>(
        "/api/v1/sda/vacancies/summary"
      );
      if (res?.data) setSummary(res.data);
    } catch {
      // Summary is non-critical
    } finally {
      setSummaryLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchVacancies();
    fetchSummary();
  }, [fetchVacancies, fetchSummary]);

  const handleNotifyNdia = async (id: number) => {
    setNotifyingId(id);
    try {
      const res = await api.post<{ success: boolean; data: SdaVacancy }>(
        `/api/v1/sda/vacancies/${id}/notify_ndia`,
        {}
      );
      if (res?.data) {
        setVacancies((prev) => prev.map((v) => (v.id === id ? res.data : v)));
      }
    } catch {
      // Handle silently
    } finally {
      setNotifyingId(null);
    }
  };

  const filtered =
    statusFilter === "all" ? vacancies : vacancies.filter((v) => v.status === statusFilter);

  const summaryCards = summary
    ? [
        {
          title: "Active Vacancies",
          value: summary.activeVacancies,
          icon: DoorOpen,
          iconBg: "bg-red-100 dark:bg-red-900/30",
          iconColor: "text-red-600 dark:text-red-400",
        },
        {
          title: "Avg Days Vacant",
          value: `${summary.avgDaysVacant}d`,
          icon: Clock,
          iconBg: "bg-amber-100 dark:bg-amber-900/30",
          iconColor: "text-amber-600 dark:text-amber-400",
        },
        {
          title: "Lost Income (Monthly)",
          value: `$${Math.round(summary.monthlyLostIncome).toLocaleString()}`,
          icon: TrendingDown,
          iconBg: "bg-orange-100 dark:bg-orange-900/30",
          iconColor: "text-orange-600 dark:text-orange-400",
        },
        {
          title: "NDIA Overdue Notifications",
          value: summary.ndiaOverdueCount,
          icon: Bell,
          iconBg: "bg-purple-100 dark:bg-purple-900/30",
          iconColor: "text-purple-600 dark:text-purple-400",
        },
      ]
    : [];

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {(summaryLoading || !summary ? Array.from({ length: 4 }) : summaryCards).map((card, i) => {
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
        })}
      </div>

      {/* Actions bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
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
                  {vacancies.filter((v) => v.status === f.value).length}
                </span>
              )}
            </Button>
          ))}
        </div>

        {/* Right side */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            fetchVacancies();
            fetchSummary();
          }}
          disabled={loading}
        >
          <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Vacancies Table */}
      {error ? (
        <Card>
          <CardContent className="py-8 text-center">
            <AlertCircle className="h-7 w-7 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">Unable to load vacancies</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={fetchVacancies}>
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
                      Vacancy Reason
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Start Date
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Days Vacant
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Daily Lost Income
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      NDIA Status
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <tr key={i} className="border-b border-border">
                        <td className="px-4 py-3">
                          <Skeleton className="h-4 w-40 mb-1" />
                          <Skeleton className="h-3 w-24 mb-1" />
                          <Skeleton className="h-4 w-28 rounded" />
                        </td>
                        <td className="px-4 py-3">
                          <Skeleton className="h-4 w-32" />
                        </td>
                        <td className="px-4 py-3">
                          <Skeleton className="h-4 w-20" />
                        </td>
                        <td className="px-4 py-3">
                          <Skeleton className="h-4 w-10" />
                        </td>
                        <td className="px-4 py-3">
                          <Skeleton className="h-4 w-20" />
                        </td>
                        <td className="px-4 py-3">
                          <Skeleton className="h-5 w-20 rounded" />
                        </td>
                        <td className="px-4 py-3">
                          <Skeleton className="h-5 w-16 rounded" />
                        </td>
                        <td className="px-4 py-3">
                          <Skeleton className="h-7 w-40 rounded" />
                        </td>
                      </tr>
                    ))
                  ) : filtered.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-12 text-center">
                        <DoorOpen className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                        <p className="text-sm font-medium text-foreground mb-1">
                          {statusFilter === "all" ? "No vacancies" : `No ${statusFilter} vacancies`}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {statusFilter === "all"
                            ? "All properties are currently occupied."
                            : "Try a different status filter."}
                        </p>
                      </td>
                    </tr>
                  ) : (
                    filtered.map((vacancy) => (
                      <VacancyRow
                        key={vacancy.id}
                        vacancy={vacancy}
                        onNotifyNdia={handleNotifyNdia}
                        notifying={notifyingId === vacancy.id}
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
                  <span className="font-mono font-medium text-foreground">{filtered.length}</span>{" "}
                  of{" "}
                  <span className="font-mono font-medium text-foreground">
                    {vacancies.length}
                  </span>{" "}
                  vacancies
                </span>
                <span className="font-mono text-red-600 dark:text-red-400">
                  {vacancies.filter((v) => v.ndiaStatus === "overdue").length} NDIA overdue
                </span>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
