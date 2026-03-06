"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import {
  AlertCircle,
  Plus,
  MapPin,
  Star,
  Users,
  RefreshCw,
  HandHelping,
  CalendarDays,
  AlertTriangle,
  Clock,
  CheckSquare,
  Square,
  ClipboardEdit,
  Pencil,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

type ServiceType = "sil" | "in_home_support" | "respite";
type ProviderStatus = "active" | "inactive" | "pending";

interface SilProvider {
  id: number;
  contact: {
    id: number;
    displayName: string;
  };
  property: {
    id: number;
    address: string;
    suburb?: string;
  };
  serviceType: ServiceType;
  status: ProviderStatus;
  agreementStartDate?: string;
  agreementEndDate?: string;
  staffRatioStaff: number;
  staffRatioParticipants: number;
  overnightSupport: boolean;
  twentyFourHourSupport: boolean;
  satisfactionRating?: number;
  incidentCount: number;
  nextReviewDate?: string;
}

interface SilSummary {
  totalProviders: number;
  activeAgreements: number;
  expiringSoon: number;
  averageSatisfaction: number | null;
}

type StatusFilter = ProviderStatus | "all";
type ServiceTypeFilter = ServiceType | "all";

// ─── Config ───────────────────────────────────────────────────────────────────

const SERVICE_TYPE_CONFIG: Record<
  ServiceType,
  { label: string; bg: string; text: string }
> = {
  sil: {
    label: "SIL",
    bg: "bg-purple-100 dark:bg-purple-900/30",
    text: "text-purple-700 dark:text-purple-300",
  },
  in_home_support: {
    label: "In-Home Support",
    bg: "bg-blue-100 dark:bg-blue-900/30",
    text: "text-blue-700 dark:text-blue-300",
  },
  respite: {
    label: "Respite",
    bg: "bg-green-100 dark:bg-green-900/30",
    text: "text-green-700 dark:text-green-300",
  },
};

const STATUS_CONFIG: Record<
  ProviderStatus,
  { label: string; bg: string; text: string }
> = {
  active: {
    label: "Active",
    bg: "bg-green-100 dark:bg-green-900/30",
    text: "text-green-700 dark:text-green-300",
  },
  inactive: {
    label: "Inactive",
    bg: "bg-gray-100 dark:bg-gray-800",
    text: "text-gray-600 dark:text-gray-400",
  },
  pending: {
    label: "Pending",
    bg: "bg-amber-100 dark:bg-amber-900/30",
    text: "text-amber-700 dark:text-amber-300",
  },
};

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
  { value: "pending", label: "Pending" },
];

const SERVICE_TYPE_FILTERS: { value: ServiceTypeFilter; label: string }[] = [
  { value: "all", label: "All Services" },
  { value: "sil", label: "SIL" },
  { value: "in_home_support", label: "In-Home Support" },
  { value: "respite", label: "Respite" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function daysUntil(dateStr: string): number {
  const target = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - today.getTime()) / 86_400_000);
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function ServiceTypeBadge({ type }: { type: ServiceType }) {
  const cfg = SERVICE_TYPE_CONFIG[type];
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${cfg.bg} ${cfg.text}`}
    >
      {cfg.label}
    </span>
  );
}

function StatusBadge({ status }: { status: ProviderStatus }) {
  const cfg = STATUS_CONFIG[status];
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${cfg.bg} ${cfg.text}`}
    >
      {cfg.label}
    </span>
  );
}

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5" aria-label={`${rating} out of 5 stars`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={`h-3 w-3 ${
            i < Math.round(rating)
              ? "fill-amber-400 text-amber-400"
              : "fill-none text-gray-300 dark:text-gray-600"
          }`}
        />
      ))}
      <span className="ml-1 text-xs text-muted-foreground font-mono">{rating.toFixed(1)}</span>
    </div>
  );
}

function CheckIndicator({ checked, label }: { checked: boolean; label: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs ${
        checked
          ? "text-green-600 dark:text-green-400"
          : "text-muted-foreground"
      }`}
    >
      {checked ? (
        <CheckSquare className="h-3 w-3 shrink-0" />
      ) : (
        <Square className="h-3 w-3 shrink-0" />
      )}
      {label}
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

// ─── Provider Card ────────────────────────────────────────────────────────────

function ProviderCard({
  provider,
  onReview,
  onEdit,
}: {
  provider: SilProvider;
  onReview: (id: number) => void;
  onEdit: (id: number) => void;
}) {
  const isExpiringSoon =
    provider.agreementEndDate && daysUntil(provider.agreementEndDate) <= 30;

  const expiryDays =
    provider.agreementEndDate ? daysUntil(provider.agreementEndDate) : null;

  return (
    <Card className="hover:bg-secondary/20 transition-colors">
      <CardContent className="p-4 space-y-3">
        {/* Header: name + badges */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-semibold leading-tight truncate">
              {provider.contact.displayName}
            </p>
            <div className="flex items-center gap-1 mt-0.5 text-xs text-muted-foreground">
              <MapPin className="h-3 w-3 shrink-0" />
              <span className="truncate">{provider.property.address}</span>
              {provider.property.suburb && (
                <span className="shrink-0">{provider.property.suburb}</span>
              )}
            </div>
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0">
            <StatusBadge status={provider.status} />
            <ServiceTypeBadge type={provider.serviceType} />
          </div>
        </div>

        {/* Agreement dates */}
        {(provider.agreementStartDate || provider.agreementEndDate) && (
          <div className="flex items-center gap-1.5">
            <CalendarDays className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <span className="text-xs text-muted-foreground">
              {provider.agreementStartDate ? formatDate(provider.agreementStartDate) : "—"}
              {" — "}
              {provider.agreementEndDate ? formatDate(provider.agreementEndDate) : "—"}
            </span>
            {isExpiringSoon && expiryDays !== null && (
              <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-amber-600 dark:text-amber-400 ml-1">
                <AlertTriangle className="h-3 w-3" />
                {expiryDays <= 0 ? "Expired" : `${expiryDays}d left`}
              </span>
            )}
          </div>
        )}

        {/* Staff ratio + support checkboxes */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Users className="h-3.5 w-3.5 shrink-0" />
            <span>
              <span className="font-mono font-semibold text-foreground">
                {provider.staffRatioStaff}:{provider.staffRatioParticipants}
              </span>{" "}
              ratio
            </span>
          </div>
          <CheckIndicator checked={provider.overnightSupport} label="Overnight" />
          <CheckIndicator checked={provider.twentyFourHourSupport} label="24hr" />
        </div>

        {/* Satisfaction + incidents */}
        <div className="flex items-center justify-between gap-2">
          <div>
            {provider.satisfactionRating != null ? (
              <StarRating rating={provider.satisfactionRating} />
            ) : (
              <span className="text-xs text-muted-foreground">No rating</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {provider.incidentCount > 0 && (
              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs font-semibold bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300">
                <AlertCircle className="h-3 w-3" />
                {provider.incidentCount} incident{provider.incidentCount !== 1 ? "s" : ""}
              </span>
            )}
          </div>
        </div>

        {/* Next review date */}
        {provider.nextReviewDate && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="h-3 w-3 shrink-0" />
            <span>
              Next review:{" "}
              <span className="font-medium text-foreground">
                {formatDate(provider.nextReviewDate)}
              </span>
            </span>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2 pt-1 border-t border-border">
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs flex-1"
            onClick={() => onReview(provider.id)}
          >
            <ClipboardEdit className="h-3 w-3 mr-1.5" />
            Review
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs flex-1"
            onClick={() => onEdit(provider.id)}
          >
            <Pencil className="h-3 w-3 mr-1.5" />
            Edit
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Provider Card Skeleton ───────────────────────────────────────────────────

function ProviderCardSkeleton() {
  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1 space-y-1.5">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
          <div className="flex flex-col items-end gap-1">
            <Skeleton className="h-5 w-14 rounded" />
            <Skeleton className="h-5 w-20 rounded" />
          </div>
        </div>
        <Skeleton className="h-3 w-full" />
        <div className="flex gap-3">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-3 w-16" />
        </div>
        <div className="flex items-center justify-between">
          <Skeleton className="h-3 w-28" />
          <Skeleton className="h-5 w-20 rounded" />
        </div>
        <div className="flex gap-2 pt-1 border-t border-border">
          <Skeleton className="h-7 flex-1 rounded" />
          <Skeleton className="h-7 flex-1 rounded" />
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function SdaSilPage() {
  const [providers, setProviders] = useState<SilProvider[]>([]);
  const [summary, setSummary] = useState<SilSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [error, setError] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [serviceTypeFilter, setServiceTypeFilter] = useState<ServiceTypeFilter>("all");

  const fetchProviders = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await api.get<{ success: boolean; data: SilProvider[] }>(
        "/api/v1/sda/sil_providers"
      );
      if (res?.data) {
        setProviders(Array.isArray(res.data) ? res.data : []);
      } else if (Array.isArray(res)) {
        setProviders(res as SilProvider[]);
      }
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchSummary = useCallback(async () => {
    setSummaryLoading(true);
    try {
      const res = await api.get<{ success: boolean; data: SilSummary }>(
        "/api/v1/sda/sil_providers/summary"
      );
      if (res?.data) setSummary(res.data);
    } catch {
      // Summary is non-critical
    } finally {
      setSummaryLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProviders();
    fetchSummary();
  }, [fetchProviders, fetchSummary]);

  // Filtering
  const filtered = providers.filter((p) => {
    if (statusFilter !== "all" && p.status !== statusFilter) return false;
    if (serviceTypeFilter !== "all" && p.serviceType !== serviceTypeFilter) return false;
    return true;
  });

  // Handlers (stubs — backend integration point)
  const handleReview = (id: number) => {
    // TODO: Open review modal or navigate to review page
    void id;
  };

  const handleEdit = (id: number) => {
    // TODO: Open edit modal or navigate to edit page
    void id;
  };

  const handleAddProvider = async () => {
    // TODO: Open add provider modal
  };

  // Summary cards config
  const summaryCards = [
    {
      title: "Total SIL Providers",
      value: summary?.totalProviders ?? 0,
      icon: HandHelping,
      iconBg: "bg-purple-100 dark:bg-purple-900/30",
      iconColor: "text-purple-600 dark:text-purple-400",
    },
    {
      title: "Active Agreements",
      value: summary?.activeAgreements ?? 0,
      icon: Users,
      iconBg: "bg-green-100 dark:bg-green-900/30",
      iconColor: "text-green-600 dark:text-green-400",
    },
    {
      title: "Expiring Soon",
      value: summary?.expiringSoon ?? 0,
      icon: AlertTriangle,
      iconBg: "bg-amber-100 dark:bg-amber-900/30",
      iconColor: "text-amber-600 dark:text-amber-400",
    },
    {
      title: "Avg Satisfaction",
      value:
        summary?.averageSatisfaction != null
          ? `${summary.averageSatisfaction.toFixed(1)} / 5`
          : "—",
      icon: Star,
      iconBg: "bg-blue-100 dark:bg-blue-900/30",
      iconColor: "text-blue-600 dark:text-blue-400",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {summaryCards.map((card, i) =>
          summaryLoading ? (
            <Card key={i}>
              <CardContent className="pt-5 pb-5">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-9 w-9 rounded-lg" />
                  <div>
                    <Skeleton className="h-3 w-24 mb-1" />
                    <Skeleton className="h-6 w-16" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <SummaryCard
              key={card.title}
              title={card.title}
              value={card.value}
              icon={card.icon}
              iconBg={card.iconBg}
              iconColor={card.iconColor}
              loading={false}
            />
          )
        )}
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Filters */}
        <div className="flex flex-wrap gap-2">
          {/* Status filter */}
          <div className="flex gap-1">
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
                    {providers.filter((p) => p.status === f.value).length}
                  </span>
                )}
              </Button>
            ))}
          </div>

          {/* Service type filter */}
          <div className="flex gap-1">
            {SERVICE_TYPE_FILTERS.map((f) => (
              <Button
                key={f.value}
                variant={serviceTypeFilter === f.value ? "default" : "outline"}
                size="sm"
                className="h-7 text-xs px-2.5"
                onClick={() => setServiceTypeFilter(f.value)}
              >
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
              fetchProviders();
              fetchSummary();
            }}
            disabled={loading}
          >
            <RefreshCw
              className={`h-3.5 w-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
          <Button size="sm" onClick={handleAddProvider}>
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            Add SIL Provider
          </Button>
        </div>
      </div>

      {/* Content */}
      {error ? (
        <Card>
          <CardContent className="py-12 text-center">
            <AlertCircle className="h-7 w-7 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">Unable to load SIL providers</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={fetchProviders}
            >
              Retry
            </Button>
          </CardContent>
        </Card>
      ) : loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <ProviderCardSkeleton key={i} />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <HandHelping className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
            <p className="text-sm font-medium text-muted-foreground">
              {providers.length === 0
                ? "No SIL providers yet"
                : "No providers match the selected filters"}
            </p>
            {providers.length === 0 && (
              <Button size="sm" className="mt-4" onClick={handleAddProvider}>
                <Plus className="h-3.5 w-3.5 mr-1.5" />
                Add SIL Provider
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((provider) => (
              <ProviderCard
                key={provider.id}
                provider={provider}
                onReview={handleReview}
                onEdit={handleEdit}
              />
            ))}
          </div>

          {/* Footer count */}
          <p className="text-xs text-muted-foreground text-right">
            Showing{" "}
            <span className="font-mono font-medium text-foreground">{filtered.length}</span>{" "}
            of{" "}
            <span className="font-mono font-medium text-foreground">{providers.length}</span>{" "}
            providers
          </p>
        </>
      )}
    </div>
  );
}
