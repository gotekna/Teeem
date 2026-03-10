"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import {
  Bell,
  Mail,
  MessageSquare,
  ExternalLink,
  Search,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Clock,
  Send,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  RotateCcw,
  Loader2,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

type NotificationType =
  | "vacancy_5day"
  | "incident_24hr"
  | "incident_5day"
  | "restrictive_practice"
  | "plan_expiry"
  | "agreement_expiry"
  | "compliance_overdue"
  | "price_guide_expiry"
  | "claim_rejected"
  | "arrears_escalation"
  | "policy_review_due"
  | "coi_review_due";

type NotificationChannel = "email" | "sms" | "in_app" | "ndis_portal" | "sda_finder";
type NotificationStatus = "pending" | "sent" | "delivered" | "failed" | "acknowledged";
type NotificationPriority = "low" | "normal" | "high" | "urgent";

interface SdaNotification {
  id: number;
  notificationType: NotificationType;
  channel: NotificationChannel;
  status: NotificationStatus;
  priority: NotificationPriority;
  recipient: string;
  subject: string;
  body?: string;
  dueAt?: string;
  sentAt?: string;
  deliveredAt?: string;
  acknowledgedAt?: string;
  deliveryError?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

interface NotificationDashboard {
  pending: number;
  failed: number;
  overdue: number;
  sentToday: number;
}

type TypeFilter = NotificationType | "all";
type ChannelFilter = NotificationChannel | "all";
type StatusFilter = NotificationStatus | "all";
type PriorityFilter = NotificationPriority | "all";

// ─── Constants ───────────────────────────────────────────────────────────────

const NOTIFICATION_TYPE_LABELS: Record<NotificationType, string> = {
  vacancy_5day: "Vacancy (5 Day)",
  incident_24hr: "Incident (24hr)",
  incident_5day: "Incident (5 Day)",
  restrictive_practice: "Restrictive Practice",
  plan_expiry: "Plan Expiry",
  agreement_expiry: "Agreement Expiry",
  compliance_overdue: "Compliance Overdue",
  price_guide_expiry: "Price Guide Expiry",
  claim_rejected: "Claim Rejected",
  arrears_escalation: "Arrears Escalation",
  policy_review_due: "Policy Review Due",
  coi_review_due: "COI Review Due",
};

const TYPE_FILTERS: { value: TypeFilter; label: string }[] = [
  { value: "all", label: "All Types" },
  { value: "vacancy_5day", label: "Vacancy 5d" },
  { value: "incident_24hr", label: "Incident 24hr" },
  { value: "incident_5day", label: "Incident 5d" },
  { value: "restrictive_practice", label: "Restrictive Practice" },
  { value: "plan_expiry", label: "Plan Expiry" },
  { value: "agreement_expiry", label: "Agreement Expiry" },
  { value: "compliance_overdue", label: "Compliance" },
  { value: "price_guide_expiry", label: "Price Guide" },
  { value: "claim_rejected", label: "Claim Rejected" },
  { value: "arrears_escalation", label: "Arrears" },
  { value: "policy_review_due", label: "Policy Review" },
  { value: "coi_review_due", label: "COI Review" },
];

const CHANNEL_FILTERS: { value: ChannelFilter; label: string }[] = [
  { value: "all", label: "All Channels" },
  { value: "email", label: "Email" },
  { value: "sms", label: "SMS" },
  { value: "in_app", label: "In-App" },
  { value: "ndis_portal", label: "NDIS Portal" },
  { value: "sda_finder", label: "SDA Finder" },
];

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "sent", label: "Sent" },
  { value: "delivered", label: "Delivered" },
  { value: "failed", label: "Failed" },
  { value: "acknowledged", label: "Acknowledged" },
];

const PRIORITY_FILTERS: { value: PriorityFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "low", label: "Low" },
  { value: "normal", label: "Normal" },
  { value: "high", label: "High" },
  { value: "urgent", label: "Urgent" },
];

// ─── Badge Configs ────────────────────────────────────────────────────────────

const PRIORITY_CONFIG: Record<
  NotificationPriority,
  { label: string; bg: string; text: string; dot: string }
> = {
  low: {
    label: "Low",
    bg: "bg-gray-100 dark:bg-gray-800",
    text: "text-gray-600 dark:text-gray-400",
    dot: "bg-gray-400",
  },
  normal: {
    label: "Normal",
    bg: "bg-blue-100 dark:bg-blue-900/30",
    text: "text-blue-700 dark:text-blue-300",
    dot: "bg-blue-500",
  },
  high: {
    label: "High",
    bg: "bg-orange-100 dark:bg-orange-900/30",
    text: "text-orange-700 dark:text-orange-300",
    dot: "bg-orange-500",
  },
  urgent: {
    label: "Urgent",
    bg: "bg-red-100 dark:bg-red-900/30",
    text: "text-red-700 dark:text-red-300",
    dot: "bg-red-500",
  },
};

const STATUS_CONFIG: Record<
  NotificationStatus,
  { label: string; bg: string; text: string; icon: React.ElementType }
> = {
  pending: {
    label: "Pending",
    bg: "bg-yellow-100 dark:bg-yellow-900/30",
    text: "text-yellow-700 dark:text-yellow-300",
    icon: Clock,
  },
  sent: {
    label: "Sent",
    bg: "bg-blue-100 dark:bg-blue-900/30",
    text: "text-blue-700 dark:text-blue-300",
    icon: Send,
  },
  delivered: {
    label: "Delivered",
    bg: "bg-green-100 dark:bg-green-900/30",
    text: "text-green-700 dark:text-green-300",
    icon: CheckCircle2,
  },
  failed: {
    label: "Failed",
    bg: "bg-red-100 dark:bg-red-900/30",
    text: "text-red-700 dark:text-red-300",
    icon: XCircle,
  },
  acknowledged: {
    label: "Acknowledged",
    bg: "bg-gray-100 dark:bg-gray-800",
    text: "text-gray-600 dark:text-gray-400",
    icon: CheckCircle2,
  },
};

const CHANNEL_ICONS: Record<NotificationChannel, React.ElementType> = {
  email: Mail,
  sms: MessageSquare,
  in_app: Bell,
  ndis_portal: ExternalLink,
  sda_finder: Search,
};

const CHANNEL_LABELS: Record<NotificationChannel, string> = {
  email: "Email",
  sms: "SMS",
  in_app: "In-App",
  ndis_portal: "NDIS Portal",
  sda_finder: "SDA Finder",
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function PriorityBadge({ priority }: { priority: NotificationPriority }) {
  const cfg = PRIORITY_CONFIG[priority];
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-semibold ${cfg.bg} ${cfg.text}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

function StatusBadge({ status }: { status: NotificationStatus }) {
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

function ChannelCell({ channel }: { channel: NotificationChannel }) {
  const Icon = CHANNEL_ICONS[channel];
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
      <Icon className="h-3.5 w-3.5" />
      {CHANNEL_LABELS[channel]}
    </span>
  );
}

function SummaryCard({
  title,
  value,
  icon: Icon,
  iconBg,
  iconColor,
  valueColor,
  loading,
}: {
  title: string;
  value: string | number;
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
  valueColor?: string;
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

function NotificationRow({
  notification,
  expanded,
  onToggle,
  onAcknowledge,
  onRetry,
  acknowledging,
  retrying,
}: {
  notification: SdaNotification;
  expanded: boolean;
  onToggle: (id: number) => void;
  onAcknowledge: (id: number) => void;
  onRetry: (id: number) => void;
  acknowledging: boolean;
  retrying: boolean;
}) {
  const typeLabel = NOTIFICATION_TYPE_LABELS[notification.notificationType];
  const canAcknowledge =
    notification.status === "sent" || notification.status === "delivered";
  const canRetry = notification.status === "failed";

  const formattedDate = notification.createdAt
    ? new Date(notification.createdAt).toLocaleDateString("en-AU", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

  const formattedDue = notification.dueAt
    ? new Date(notification.dueAt).toLocaleDateString("en-AU", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

  return (
    <>
      <tr
        className={`border-b border-border transition-colors cursor-pointer ${
          expanded ? "bg-primary/5" : "hover:bg-secondary/40"
        }`}
        onClick={() => onToggle(notification.id)}
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
        <td className="px-4 py-3 text-xs font-mono text-muted-foreground whitespace-nowrap">
          {formattedDate}
        </td>

        {/* Type */}
        <td className="px-4 py-3 text-sm">
          <span className="font-medium truncate max-w-[160px] block">{typeLabel}</span>
        </td>

        {/* Channel */}
        <td className="px-4 py-3">
          <ChannelCell channel={notification.channel} />
        </td>

        {/* Priority */}
        <td className="px-4 py-3">
          <PriorityBadge priority={notification.priority} />
        </td>

        {/* Status */}
        <td className="px-4 py-3">
          <StatusBadge status={notification.status} />
        </td>

        {/* Recipient */}
        <td className="px-4 py-3 text-sm text-muted-foreground">
          <span className="truncate max-w-[140px] block">{notification.recipient}</span>
        </td>

        {/* Subject */}
        <td className="px-4 py-3 text-sm">
          <span className="truncate max-w-[200px] block">{notification.subject}</span>
        </td>

        {/* Due At */}
        <td className="px-4 py-3 text-xs font-mono text-muted-foreground whitespace-nowrap">
          {formattedDue}
        </td>

        {/* Actions */}
        <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-end gap-1.5">
            {canAcknowledge && (
              <Button
                size="sm"
                variant="outline"
                className="h-6 text-xs px-2 border-green-300 dark:border-green-700 text-green-700 dark:text-green-300 hover:bg-green-50 dark:hover:bg-green-900/20"
                onClick={() => onAcknowledge(notification.id)}
                disabled={acknowledging}
                aria-label={`Acknowledge notification ${notification.id}`}
              >
                {acknowledging ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                )}
                {acknowledging ? "" : "Acknowledge"}
              </Button>
            )}
            {canRetry && (
              <Button
                size="sm"
                variant="outline"
                className="h-6 text-xs px-2 border-orange-300 dark:border-orange-700 text-orange-700 dark:text-orange-300 hover:bg-orange-50 dark:hover:bg-orange-900/20"
                onClick={() => onRetry(notification.id)}
                disabled={retrying}
                aria-label={`Retry notification ${notification.id}`}
              >
                {retrying ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <RotateCcw className="h-3 w-3 mr-1" />
                )}
                {retrying ? "" : "Retry"}
              </Button>
            )}
          </div>
        </td>
      </tr>

      {/* Expanded detail row */}
      {expanded && (
        <tr className="border-b border-border bg-secondary/20">
          <td colSpan={10} className="px-6 py-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
              {/* Body */}
              <div className="lg:col-span-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                  Message Body
                </p>
                <p className="text-foreground whitespace-pre-wrap">
                  {notification.body ?? (
                    <span className="text-muted-foreground italic">No body content</span>
                  )}
                </p>
              </div>

              {/* Timestamps + delivery error */}
              <div className="space-y-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                    Timestamps
                  </p>
                  <div className="space-y-1 text-xs font-mono">
                    {notification.sentAt && (
                      <div className="flex gap-2">
                        <span className="text-muted-foreground w-24 shrink-0">Sent:</span>
                        <span>{new Date(notification.sentAt).toLocaleString("en-AU")}</span>
                      </div>
                    )}
                    {notification.deliveredAt && (
                      <div className="flex gap-2">
                        <span className="text-muted-foreground w-24 shrink-0">Delivered:</span>
                        <span>{new Date(notification.deliveredAt).toLocaleString("en-AU")}</span>
                      </div>
                    )}
                    {notification.acknowledgedAt && (
                      <div className="flex gap-2">
                        <span className="text-muted-foreground w-24 shrink-0">Acknowledged:</span>
                        <span>
                          {new Date(notification.acknowledgedAt).toLocaleString("en-AU")}
                        </span>
                      </div>
                    )}
                    {!notification.sentAt &&
                      !notification.deliveredAt &&
                      !notification.acknowledgedAt && (
                        <span className="text-muted-foreground italic">No delivery timestamps</span>
                      )}
                  </div>
                </div>

                {notification.deliveryError && (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-red-600 dark:text-red-400 mb-1">
                      Delivery Error
                    </p>
                    <p className="text-xs text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded px-2 py-1">
                      {notification.deliveryError}
                    </p>
                  </div>
                )}

                {notification.metadata &&
                  Object.keys(notification.metadata).length > 0 && (
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                        Metadata
                      </p>
                      <pre className="text-xs text-muted-foreground bg-secondary/50 rounded px-2 py-1 overflow-auto max-h-20">
                        {JSON.stringify(notification.metadata, null, 2)}
                      </pre>
                    </div>
                  )}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function SdaNotificationsPage() {
  const [notifications, setNotifications] = useState<SdaNotification[]>([]);
  const [dashboard, setDashboard] = useState<NotificationDashboard | null>(null);
  const [overdueCount, setOverdueCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [dashboardLoading, setDashboardLoading] = useState(true);
  const [error, setError] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [acknowledgingId, setAcknowledgingId] = useState<number | null>(null);
  const [retryingId, setRetryingId] = useState<number | null>(null);

  // Filters
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [channelFilter, setChannelFilter] = useState<ChannelFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>("all");

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const params = new URLSearchParams();
      if (typeFilter !== "all") params.set("notification_type", typeFilter);
      if (channelFilter !== "all") params.set("channel", channelFilter);
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (priorityFilter !== "all") params.set("priority", priorityFilter);
      const query = params.toString() ? `?${params.toString()}` : "";
      const res = await api.get<{ success: boolean; data: SdaNotification[] }>(
        `/api/v1/sda/notifications${query}`
      );
      if (res?.data) setNotifications(res.data);
      else if (Array.isArray(res)) setNotifications(res as SdaNotification[]);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [typeFilter, channelFilter, statusFilter, priorityFilter]);

  const fetchDashboard = useCallback(async () => {
    setDashboardLoading(true);
    try {
      const [dashRes, overdueRes] = await Promise.all([
        api.get<{ success: boolean; data: NotificationDashboard }>(
          "/api/v1/sda/notifications/dashboard"
        ),
        api.get<{ success: boolean; data: SdaNotification[] }>(
          "/api/v1/sda/notifications/overdue"
        ),
      ]);
      if (dashRes?.data) setDashboard(dashRes.data);
      if (overdueRes?.data)
        setOverdueCount(Array.isArray(overdueRes.data) ? overdueRes.data.length : 0);
    } catch {
      // Dashboard is non-critical
    } finally {
      setDashboardLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  const toggleExpanded = (id: number) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  const handleAcknowledge = async (id: number) => {
    setAcknowledgingId(id);
    try {
      const res = await api.post<{ success: boolean; data: SdaNotification }>(
        `/api/v1/sda/notifications/${id}/acknowledge`,
        {}
      );
      if (res?.data) {
        setNotifications((prev) =>
          prev.map((n) => (n.id === id ? res.data : n))
        );
        await fetchDashboard();
      }
    } catch {
      // Handle silently
    } finally {
      setAcknowledgingId(null);
    }
  };

  const handleRetry = async (id: number) => {
    setRetryingId(id);
    try {
      const res = await api.post<{ success: boolean; data: SdaNotification }>(
        `/api/v1/sda/notifications/${id}/retry_send`,
        {}
      );
      if (res?.data) {
        setNotifications((prev) =>
          prev.map((n) => (n.id === id ? res.data : n))
        );
        await fetchDashboard();
      }
    } catch {
      // Handle silently
    } finally {
      setRetryingId(null);
    }
  };

  const hasOverdue = overdueCount > 0;

  const summaryCards = [
    {
      title: "Pending",
      value: dashboard?.pending ?? 0,
      icon: Clock,
      iconBg: "bg-yellow-100 dark:bg-yellow-900/30",
      iconColor: "text-yellow-600 dark:text-yellow-400",
      valueColor: undefined,
    },
    {
      title: "Failed",
      value: dashboard?.failed ?? 0,
      icon: XCircle,
      iconBg:
        (dashboard?.failed ?? 0) > 0
          ? "bg-red-100 dark:bg-red-900/30"
          : "bg-gray-100 dark:bg-gray-800",
      iconColor:
        (dashboard?.failed ?? 0) > 0
          ? "text-red-600 dark:text-red-400"
          : "text-gray-400 dark:text-gray-500",
      valueColor:
        (dashboard?.failed ?? 0) > 0 ? "text-red-600 dark:text-red-400" : undefined,
    },
    {
      title: "Overdue",
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
    {
      title: "Sent Today",
      value: dashboard?.sentToday ?? 0,
      icon: Send,
      iconBg: "bg-green-100 dark:bg-green-900/30",
      iconColor: "text-green-600 dark:text-green-400",
      valueColor: undefined,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Overdue Alert Banner */}
      {!dashboardLoading && hasOverdue && (
        <div className="flex items-start gap-3 rounded-lg border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-4 py-3">
          <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-red-800 dark:text-red-300">
              {overdueCount} overdue notification{overdueCount > 1 ? "s" : ""} requiring immediate
              action
            </p>
            <p className="text-xs text-red-700 dark:text-red-400 mt-0.5">
              These notifications have passed their due date and must be sent immediately to remain
              NDIS compliant.
            </p>
          </div>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {summaryCards.map((card, i) => {
          if (dashboardLoading) {
            return (
              <Card key={i}>
                <CardContent className="pt-5 pb-5">
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-9 w-9 rounded-lg" />
                    <div>
                      <Skeleton className="h-3 w-20 mb-1" />
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
              valueColor={card.valueColor}
              loading={false}
            />
          );
        })}
      </div>

      {/* Filters and actions bar */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-2">
          {/* Type filter pills — scrollable row */}
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
              </Button>
            ))}
          </div>

          {/* Channel + Status + Priority filter row */}
          <div className="flex flex-wrap gap-1 items-center">
            {/* Channel */}
            <span className="text-xs text-muted-foreground mr-0.5">Channel:</span>
            {CHANNEL_FILTERS.map((f) => (
              <Button
                key={f.value}
                variant={channelFilter === f.value ? "default" : "outline"}
                size="sm"
                className="h-7 text-xs px-2.5"
                onClick={() => setChannelFilter(f.value)}
              >
                {f.label}
              </Button>
            ))}

            <div className="h-5 w-px bg-border mx-1" />

            {/* Status */}
            <span className="text-xs text-muted-foreground mr-0.5">Status:</span>
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
                    {notifications.filter((n) => n.status === f.value).length}
                  </span>
                )}
              </Button>
            ))}

            <div className="h-5 w-px bg-border mx-1" />

            {/* Priority */}
            <span className="text-xs text-muted-foreground mr-0.5">Priority:</span>
            {PRIORITY_FILTERS.map((f) => (
              <Button
                key={f.value}
                variant={priorityFilter === f.value ? "default" : "outline"}
                size="sm"
                className="h-7 text-xs px-2.5"
                onClick={() => setPriorityFilter(f.value)}
              >
                {f.label}
                {f.value !== "all" && (
                  <span className="ml-1.5 font-mono opacity-70">
                    {notifications.filter((n) => n.priority === f.value).length}
                  </span>
                )}
              </Button>
            ))}
          </div>
        </div>

        {/* Right side actions */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            fetchNotifications();
            fetchDashboard();
          }}
          disabled={loading}
        >
          <RefreshCw
            className={`h-3.5 w-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`}
          />
          Refresh
        </Button>
      </div>

      {/* Notifications Table */}
      {error ? (
        <Card>
          <CardContent className="py-8 text-center">
            <AlertCircle className="h-7 w-7 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">Unable to load notifications</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={fetchNotifications}
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
                      Type
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Channel
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Priority
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Recipient
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Subject
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">
                      Due At
                    </th>
                    <th className="px-4 py-3 w-40">
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
                          <Skeleton className="h-4 w-28" />
                        </td>
                        <td className="px-4 py-3">
                          <Skeleton className="h-4 w-32" />
                        </td>
                        <td className="px-4 py-3">
                          <Skeleton className="h-4 w-20" />
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
                          <Skeleton className="h-4 w-40" />
                        </td>
                        <td className="px-4 py-3">
                          <Skeleton className="h-4 w-24" />
                        </td>
                        <td className="px-4 py-3" />
                      </tr>
                    ))
                  ) : notifications.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="px-4 py-12 text-center">
                        <Bell className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                        <p className="text-sm font-medium text-foreground mb-1">
                          No notifications
                        </p>
                        <p className="text-xs text-muted-foreground">
                          No notifications match the current filters.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    notifications.map((notification) => (
                      <NotificationRow
                        key={notification.id}
                        notification={notification}
                        expanded={expandedId === notification.id}
                        onToggle={toggleExpanded}
                        onAcknowledge={handleAcknowledge}
                        onRetry={handleRetry}
                        acknowledging={acknowledgingId === notification.id}
                        retrying={retryingId === notification.id}
                      />
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Table footer */}
            {!loading && notifications.length > 0 && (
              <div className="px-4 py-3 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  Showing{" "}
                  <span className="font-mono font-medium text-foreground">
                    {notifications.length}
                  </span>{" "}
                  notification{notifications.length !== 1 ? "s" : ""}
                </span>
                {notifications.filter((n) => n.status === "failed").length > 0 && (
                  <span className="font-mono text-red-600 dark:text-red-400">
                    {notifications.filter((n) => n.status === "failed").length} failed
                  </span>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
