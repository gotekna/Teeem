"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sunrise,
  CheckSquare,
  AlertTriangle,
  Mail,
  Clock,
  FileText,
  Bell,
  RefreshCw,
  ChevronRight,
  ExternalLink,
  Sparkles,
  Reply,
  Check,
  Eye,
  Loader2,
} from "lucide-react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import Link from "next/link";
import { useRouter } from "next/navigation";
import JoshuaMascot from "./JoshuaMascot";

interface BriefingItem {
  id: number;
  name?: string;
  subject?: string;
  from?: string;
  from_email?: string;
  ai_summary?: string;
  status?: string;
  job_name?: string;
  days_overdue?: number;
  hours_waiting?: number;
  priority?: string;
  po_number?: string;
  supplier?: string;
  total?: number;
  follow_up_reason?: string;
}

interface BriefingSection {
  type: string;
  title: string;
  count: number;
  items: BriefingItem[];
}

interface BriefingData {
  greeting: string;
  sections: BriefingSection[];
  has_items: boolean;
  alert_count: number;
  generated_at: string;
  user_name: string;
}

const SECTION_CONFIG: Record<string, {
  icon: typeof CheckSquare;
  color: string;
  bgColor: string;
  borderColor: string;
  badgeVariant: "default" | "destructive" | "outline" | "secondary";
  link?: string;
}> = {
  tasks_due: {
    icon: CheckSquare,
    color: "text-blue-600 dark:text-blue-400",
    bgColor: "bg-blue-50 dark:bg-blue-950/30",
    borderColor: "border-blue-200 dark:border-blue-800",
    badgeVariant: "default",
    link: "/tasks",
  },
  overdue: {
    icon: AlertTriangle,
    color: "text-red-600 dark:text-red-400",
    bgColor: "bg-red-50 dark:bg-red-950/30",
    borderColor: "border-red-200 dark:border-red-800",
    badgeVariant: "destructive",
    link: "/tasks",
  },
  follow_ups: {
    icon: Mail,
    color: "text-amber-600 dark:text-amber-400",
    bgColor: "bg-amber-50 dark:bg-amber-950/30",
    borderColor: "border-amber-200 dark:border-amber-800",
    badgeVariant: "secondary",
    link: "/email",
  },
  unanswered: {
    icon: Clock,
    color: "text-orange-600 dark:text-orange-400",
    bgColor: "bg-orange-50 dark:bg-orange-950/30",
    borderColor: "border-orange-200 dark:border-orange-800",
    badgeVariant: "outline",
    link: "/email",
  },
  pending_pos: {
    icon: FileText,
    color: "text-purple-600 dark:text-purple-400",
    bgColor: "bg-purple-50 dark:bg-purple-950/30",
    borderColor: "border-purple-200 dark:border-purple-800",
    badgeVariant: "secondary",
    link: "/purchase_orders",
  },
};

function SectionCard({ section, onCompleteTask, completingTaskId }: {
  section: BriefingSection;
  onCompleteTask: (taskId: number) => void;
  completingTaskId: number | null;
}) {
  const config = SECTION_CONFIG[section.type] || {
    icon: CheckSquare,
    color: "text-muted-foreground",
    bgColor: "bg-muted/30",
    borderColor: "border-border",
    badgeVariant: "outline" as const,
  };
  const Icon = config.icon;

  return (
    <Card className={`border ${config.borderColor}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className={`flex items-center gap-2 text-base ${config.color}`}>
            <div className={`p-1.5 rounded-md ${config.bgColor}`}>
              <Icon className="h-4 w-4" />
            </div>
            {section.title}
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant={config.badgeVariant} className="text-xs font-mono">
              {section.count}
            </Badge>
            {config.link && (
              <Link href={config.link}>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                  <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                </Button>
              </Link>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {section.items.map((item, idx) => (
            <ItemRow
              key={item.id || idx}
              item={item}
              type={section.type}
              onCompleteTask={onCompleteTask}
              completingTaskId={completingTaskId}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function buildReplyUrl(item: BriefingItem): string {
  const params = new URLSearchParams();
  if (item.from_email) params.set("compose_to", item.from_email);
  if (item.subject) {
    const subject = item.subject.startsWith("RE:") ? item.subject : `RE: ${item.subject}`;
    params.set("compose_subject", subject);
  }
  return `/email?${params.toString()}`;
}

function ItemRow({ item, type, onCompleteTask, completingTaskId }: {
  item: BriefingItem;
  type: string;
  onCompleteTask: (taskId: number) => void;
  completingTaskId: number | null;
}) {
  const router = useRouter();
  const isCompleting = completingTaskId === item.id;

  switch (type) {
    case "tasks_due":
      return (
        <div className="flex items-center justify-between py-1.5 border-b border-border/50 last:border-0 group">
          <div className="flex items-center gap-2 min-w-0">
            <div className={`h-2 w-2 rounded-full shrink-0 ${
              item.priority === "high" ? "bg-red-500" : "bg-blue-500"
            }`} />
            <span className="text-sm truncate">{item.name}</span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0 ml-2">
            {item.job_name && (
              <Badge variant="outline" className="text-xs">
                {item.job_name}
              </Badge>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={() => onCompleteTask(item.id)}
              disabled={isCompleting}
            >
              {isCompleting ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <>
                  <Check className="h-3 w-3 mr-1" />
                  Done
                </>
              )}
            </Button>
          </div>
        </div>
      );

    case "overdue":
      return (
        <div className="flex items-center justify-between py-1.5 border-b border-border/50 last:border-0 group">
          <div className="flex items-center gap-2 min-w-0">
            <div className="h-2 w-2 rounded-full shrink-0 bg-red-500" />
            <span className="text-sm truncate">{item.name}</span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0 ml-2">
            {item.job_name && (
              <Badge variant="outline" className="text-xs">{item.job_name}</Badge>
            )}
            <Badge variant="destructive" className="text-xs font-mono">
              {item.days_overdue}d
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={() => onCompleteTask(item.id)}
              disabled={isCompleting}
            >
              {isCompleting ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <>
                  <Check className="h-3 w-3 mr-1" />
                  Done
                </>
              )}
            </Button>
          </div>
        </div>
      );

    case "follow_ups":
      return (
        <div className="flex items-center justify-between py-1.5 border-b border-border/50 last:border-0 group">
          <div className="min-w-0">
            <p className="text-sm truncate">{item.subject}</p>
            <p className="text-xs text-muted-foreground">From: {item.from}</p>
            {item.ai_summary && (
              <p className="text-xs text-muted-foreground/70 truncate mt-0.5">{item.ai_summary}</p>
            )}
          </div>
          <div className="flex items-center gap-1.5 shrink-0 ml-2">
            {item.follow_up_reason && (
              <Badge variant="outline" className="text-xs">
                {item.follow_up_reason}
              </Badge>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={() => router.push(buildReplyUrl(item))}
            >
              <Reply className="h-3 w-3 mr-1" />
              Reply
            </Button>
          </div>
        </div>
      );

    case "unanswered":
      return (
        <div className="flex items-center justify-between py-1.5 border-b border-border/50 last:border-0 group">
          <div className="min-w-0">
            <p className="text-sm truncate">{item.subject}</p>
            <p className="text-xs text-muted-foreground">From: {item.from}</p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0 ml-2">
            <Badge variant="outline" className="text-xs font-mono">
              {item.hours_waiting}h
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={() => router.push(buildReplyUrl(item))}
            >
              <Reply className="h-3 w-3 mr-1" />
              Reply
            </Button>
          </div>
        </div>
      );

    case "pending_pos":
      return (
        <div className="flex items-center justify-between py-1.5 border-b border-border/50 last:border-0 group">
          <div className="min-w-0">
            <p className="text-sm font-mono">{item.po_number}</p>
            {item.supplier && (
              <p className="text-xs text-muted-foreground">{item.supplier}</p>
            )}
          </div>
          <div className="flex items-center gap-1.5 shrink-0 ml-2">
            {item.total != null && (
              <span className="text-sm font-medium">
                ${Number(item.total).toLocaleString()}
              </span>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={() => router.push("/purchase_orders")}
            >
              <Eye className="h-3 w-3 mr-1" />
              Review
            </Button>
          </div>
        </div>
      );

    default:
      return (
        <div className="py-1.5 border-b border-border/50 last:border-0">
          <p className="text-sm">{item.name || item.subject}</p>
        </div>
      );
  }
}

export default function AIJoshuaTab() {
  const [briefing, setBriefing] = useState<BriefingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [completingTaskId, setCompletingTaskId] = useState<number | null>(null);

  const handleCompleteTask = async (taskId: number) => {
    setCompletingTaskId(taskId);
    try {
      const res = await api.post<{ success: boolean }>(`/api/v1/sm_tasks/${taskId}/complete`, {});
      if (res?.success) {
        toast.success("Task marked as complete");
        // Remove the completed task from the briefing locally
        setBriefing(prev => {
          if (!prev) return prev;
          const sections = prev.sections
            .map(s => {
              if (s.type !== "tasks_due" && s.type !== "overdue") return s;
              const items = s.items.filter(i => i.id !== taskId);
              return { ...s, items, count: items.length };
            })
            .filter(s => s.count > 0);
          return { ...prev, sections, has_items: sections.length > 0 };
        });
      } else {
        toast.error("Failed to complete task");
      }
    } catch {
      toast.error("Failed to complete task");
    } finally {
      setCompletingTaskId(null);
    }
  };

  const fetchBriefing = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const res = await api.get<{ success: boolean; data: BriefingData }>("/api/v1/assistant/briefing");
      if (res?.success && res.data) {
        setBriefing(res.data);
      }
    } catch (err) {
      console.error("[AIJoshua] Failed to fetch briefing:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchBriefing();
    const interval = setInterval(() => fetchBriefing(), 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-lg" />
          <div>
            <Skeleton className="h-6 w-64 mb-1" />
            <Skeleton className="h-4 w-40" />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-3">
                <Skeleton className="h-5 w-40" />
              </CardHeader>
              <CardContent className="space-y-3">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const totalItems = briefing?.sections.reduce((sum, s) => sum + s.count, 0) || 0;

  return (
    <div className="space-y-6 pb-48">
      {/* Joshua Mascot */}
      <JoshuaMascot
        alertCount={briefing?.alert_count || 0}
        hasItems={briefing?.has_items || false}
        sections={briefing?.sections.map(s => ({ type: s.type, title: s.title, count: s.count })) || []}
        isLoading={loading}
      />

      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-amber-100 dark:bg-amber-900/40">
            <Sparkles className="h-5 w-5 text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <h2 className="text-xl font-semibold">
              {briefing?.greeting || "Hello"}
            </h2>
            <p className="text-sm text-muted-foreground">
              {briefing?.has_items
                ? `You have ${totalItems} item${totalItems !== 1 ? "s" : ""} that need your attention today.`
                : "All clear! Nothing needs your attention right now."
              }
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {briefing?.alert_count != null && briefing.alert_count > 0 && (
            <Badge variant="outline" className="gap-1">
              <Bell className="h-3 w-3" />
              {briefing.alert_count} alert{briefing.alert_count !== 1 ? "s" : ""}
            </Badge>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchBriefing(true)}
            disabled={refreshing}
          >
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Summary badges */}
      {briefing?.has_items && (
        <div className="flex flex-wrap gap-2">
          {briefing.sections.map((section) => {
            const config = SECTION_CONFIG[section.type];
            const Icon = config?.icon || CheckSquare;
            return (
              <Badge
                key={section.type}
                variant={config?.badgeVariant || "outline"}
                className="gap-1.5 py-1 px-2.5"
              >
                <Icon className="h-3 w-3" />
                {section.count} {section.title.toLowerCase()}
              </Badge>
            );
          })}
        </div>
      )}

      {/* Section cards */}
      {briefing?.has_items ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {briefing.sections.map((section) => (
            <SectionCard
              key={section.type}
              section={section}
              onCompleteTask={handleCompleteTask}
              completingTaskId={completingTaskId}
            />
          ))}
        </div>
      ) : (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <Sunrise className="h-12 w-12 mx-auto text-amber-400 mb-4" />
            <h3 className="text-lg font-medium mb-1">You&apos;re all caught up</h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              No tasks due, no overdue items, no emails waiting for your reply.
              Enjoy your day!
            </p>
          </CardContent>
        </Card>
      )}

      {/* Footer */}
      {briefing?.generated_at && (
        <p className="text-xs text-muted-foreground text-right">
          Last updated: {briefing.generated_at} AEST
        </p>
      )}
    </div>
  );
}
