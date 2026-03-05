"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import {
  AlertCircle,
  Plus,
  MapPin,
  Clock,
  BarChart3,
  CheckCircle2,
  ArrowRight,
  RefreshCw,
} from "lucide-react";
import QuickEnrolDialog from "@/components/sda/QuickEnrolDialog";

// ─── Types ───────────────────────────────────────────────────────────────────

interface EnrolmentProperty {
  id: number;
  address: string;
  suburb?: string;
  sdaCategory: string;
  completenessPercent: number;
  daysInStage: number;
  enrolmentId?: number;
  missingFields?: string[];
  missingDocuments?: string[];
}

interface EnrolmentsByStatus {
  not_started: EnrolmentProperty[];
  in_progress: EnrolmentProperty[];
  submitted: EnrolmentProperty[];
  under_review: EnrolmentProperty[];
  enrolled: EnrolmentProperty[];
}

// ─── SDA Category Badge ───────────────────────────────────────────────────────

const SDA_CATEGORY_STYLES: Record<string, string> = {
  HPS: "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800",
  FA: "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800",
  IL: "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800",
  Robust:
    "bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-800",
};

function SdaCategoryBadge({ category }: { category: string }) {
  const cls =
    SDA_CATEGORY_STYLES[category] ?? "bg-secondary text-secondary-foreground border-border";
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold border ${cls}`}
    >
      {category}
    </span>
  );
}

// ─── Completeness Bar ─────────────────────────────────────────────────────────

function CompletenessBar({ pct }: { pct: number }) {
  const color =
    pct >= 80
      ? "bg-green-500 dark:bg-green-400"
      : pct >= 50
      ? "bg-amber-500 dark:bg-amber-400"
      : "bg-red-500 dark:bg-red-400";

  return (
    <div className="space-y-0.5">
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">Completeness</span>
        <span className="font-mono font-medium">{pct}%</span>
      </div>
      <div className="w-full bg-secondary rounded-full h-1.5">
        <div className={`h-1.5 rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

// ─── Enrolment Card ───────────────────────────────────────────────────────────

interface EnrolmentCardProps {
  property: EnrolmentProperty;
  onUpdateStatus?: (id: number, status: string) => void;
}

function EnrolmentCard({ property }: EnrolmentCardProps) {
  const hasMissing =
    (property.missingFields?.length ?? 0) > 0 ||
    (property.missingDocuments?.length ?? 0) > 0;

  return (
    <Card className="hover:bg-secondary/20 transition-colors">
      <CardContent className="p-3 space-y-2.5">
        {/* Address */}
        <div className="flex items-start gap-1.5">
          <MapPin className="h-3 w-3 text-muted-foreground mt-0.5 shrink-0" />
          <div className="min-w-0">
            <p className="text-xs font-medium leading-tight truncate">{property.address}</p>
            {property.suburb && (
              <p className="text-xs text-muted-foreground">{property.suburb}</p>
            )}
          </div>
        </div>

        {/* Category + days */}
        <div className="flex items-center justify-between">
          <SdaCategoryBadge category={property.sdaCategory} />
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {property.daysInStage}d
          </span>
        </div>

        {/* Completeness */}
        <CompletenessBar pct={property.completenessPercent} />

        {/* Missing items alert */}
        {hasMissing && (
          <div className="flex items-start gap-1.5 text-xs text-amber-600 dark:text-amber-400">
            <AlertCircle className="h-3 w-3 mt-0.5 shrink-0" />
            <span>
              {[
                property.missingFields?.length
                  ? `${property.missingFields.length} field${property.missingFields.length > 1 ? "s" : ""}`
                  : null,
                property.missingDocuments?.length
                  ? `${property.missingDocuments.length} doc${property.missingDocuments.length > 1 ? "s" : ""}`
                  : null,
              ]
                .filter(Boolean)
                .join(", ")}{" "}
              missing
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Kanban Column ────────────────────────────────────────────────────────────

interface ColumnConfig {
  key: keyof EnrolmentsByStatus;
  label: string;
  color: string;
  emptyMsg: string;
}

const COLUMNS: ColumnConfig[] = [
  {
    key: "not_started",
    label: "Not Started",
    color: "bg-gray-400 dark:bg-gray-600",
    emptyMsg: "No properties here",
  },
  {
    key: "in_progress",
    label: "In Progress",
    color: "bg-blue-500 dark:bg-blue-400",
    emptyMsg: "None in progress",
  },
  {
    key: "submitted",
    label: "Submitted",
    color: "bg-indigo-500 dark:bg-indigo-400",
    emptyMsg: "None submitted",
  },
  {
    key: "under_review",
    label: "Under Review",
    color: "bg-amber-500 dark:bg-amber-400",
    emptyMsg: "None under review",
  },
  {
    key: "enrolled",
    label: "Enrolled",
    color: "bg-green-500 dark:bg-green-400",
    emptyMsg: "None enrolled yet",
  },
];

function KanbanColumn({
  config,
  items,
  loading,
}: {
  config: ColumnConfig;
  items: EnrolmentProperty[];
  loading: boolean;
}) {
  return (
    <div className="flex-1 min-w-[220px] max-w-xs">
      {/* Column header */}
      <div className="flex items-center gap-2 mb-3">
        <div className={`w-2 h-2 rounded-full ${config.color}`} />
        <h3 className="text-sm font-semibold">{config.label}</h3>
        <Badge variant="secondary" className="ml-auto font-mono text-xs">
          {loading ? "…" : items.length}
        </Badge>
      </div>

      {/* Cards */}
      <div className="space-y-2">
        {loading ? (
          Array.from({ length: 2 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-3 space-y-2">
                <Skeleton className="h-3 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
                <div className="flex justify-between">
                  <Skeleton className="h-5 w-10 rounded" />
                  <Skeleton className="h-3 w-8" />
                </div>
                <Skeleton className="h-1.5 w-full rounded-full" />
              </CardContent>
            </Card>
          ))
        ) : items.length === 0 ? (
          <div className="py-8 text-center border border-dashed border-border rounded-lg">
            <p className="text-xs text-muted-foreground">{config.emptyMsg}</p>
          </div>
        ) : (
          items.map((item) => <EnrolmentCard key={item.id} property={item} />)
        )}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function SdaEnrolmentsPage() {
  const [byStatus, setByStatus] = useState<EnrolmentsByStatus>({
    not_started: [],
    in_progress: [],
    submitted: [],
    under_review: [],
    enrolled: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [quickEnrolOpen, setQuickEnrolOpen] = useState(false);

  const fetchEnrolments = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await api.get<{ success: boolean; data: { byStatus: EnrolmentsByStatus } }>(
        "/api/v1/sda/enrolments"
      );
      if (res?.data?.byStatus) {
        setByStatus(res.data.byStatus);
      }
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEnrolments();
  }, [fetchEnrolments]);

  const totalCount = Object.values(byStatus).reduce((sum, arr) => sum + arr.length, 0);

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <BarChart3 className="h-4 w-4" />
            <span>
              <span className="font-semibold text-foreground font-mono">{totalCount}</span>{" "}
              properties in pipeline
            </span>
          </div>
          {/* Enrolled highlight */}
          <div className="flex items-center gap-1 text-sm text-green-600 dark:text-green-400">
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span className="font-mono">{byStatus.enrolled.length}</span>
            <span>enrolled</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchEnrolments}
            disabled={loading}
          >
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button size="sm" onClick={() => setQuickEnrolOpen(true)}>
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            Quick Enrol
          </Button>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <Card>
          <CardContent className="py-8 text-center">
            <AlertCircle className="h-7 w-7 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">Unable to load enrolments</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={fetchEnrolments}>
              Retry
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Kanban board */}
      {!error && (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {COLUMNS.map((col) => (
            <KanbanColumn
              key={col.key}
              config={col}
              items={byStatus[col.key]}
              loading={loading}
            />
          ))}
        </div>
      )}

      {/* Legend */}
      {!loading && !error && (
        <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground pt-2 border-t border-border">
          <span className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-red-500" />
            {"<50% complete"}
          </span>
          <span className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-amber-500" />
            50-79% complete
          </span>
          <span className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-green-500" />
            {"≥80% complete"}
          </span>
          <span className="flex items-center gap-1.5">
            <Clock className="h-3 w-3" />
            Days in current stage
          </span>
          <span className="flex items-center gap-1.5 ml-auto">
            <ArrowRight className="h-3 w-3" />
            Click card to view details
          </span>
        </div>
      )}

      {/* Quick Enrol Dialog */}
      <QuickEnrolDialog
        open={quickEnrolOpen}
        onOpenChange={setQuickEnrolOpen}
        onSuccess={() => {
          setQuickEnrolOpen(false);
          fetchEnrolments();
        }}
      />
    </div>
  );
}
