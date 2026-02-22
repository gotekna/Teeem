"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sunrise,
  CheckSquare,
  AlertTriangle,
  Mail,
  Clock,
  MessageSquare,
  Bell,
  ChevronRight,
} from "lucide-react";
import { api } from "@/lib/api";
import Link from "next/link";

interface BriefingSection {
  type: string;
  title: string;
  count: number;
  items: Array<{
    id: number;
    name?: string;
    subject?: string;
    from?: string;
    status?: string;
    job_name?: string;
    days_overdue?: number;
    hours_waiting?: number;
    priority?: string;
    po_number?: string;
    supplier?: string;
  }>;
}

interface BriefingData {
  greeting: string;
  sections: BriefingSection[];
  has_items: boolean;
  alert_count: number;
  generated_at: string;
  user_name: string;
}

const SECTION_ICONS: Record<string, typeof CheckSquare> = {
  tasks_due: CheckSquare,
  overdue: AlertTriangle,
  follow_ups: Mail,
  unanswered: Clock,
  pending_pos: MessageSquare,
};

const SECTION_COLORS: Record<string, string> = {
  tasks_due: "text-blue-600 dark:text-blue-400",
  overdue: "text-red-600 dark:text-red-400",
  follow_ups: "text-amber-600 dark:text-amber-400",
  unanswered: "text-orange-600 dark:text-orange-400",
  pending_pos: "text-purple-600 dark:text-purple-400",
};

const BADGE_VARIANTS: Record<string, "default" | "destructive" | "outline" | "secondary"> = {
  tasks_due: "default",
  overdue: "destructive",
  follow_ups: "secondary",
  unanswered: "outline",
  pending_pos: "secondary",
};

export default function BriefingWidget() {
  const [briefing, setBriefing] = useState<BriefingData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchBriefing = async () => {
      try {
        const res = await api.get<{ success: boolean; data: BriefingData }>("/api/v1/assistant/briefing");
        if (res?.success && res.data) {
          setBriefing(res.data);
        }
      } catch (err) {
        console.error("[BriefingWidget] Failed to fetch:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchBriefing();

    // Auto-refresh every 5 minutes
    const interval = setInterval(fetchBriefing, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Skeleton className="h-5 w-5 rounded" />
            <Skeleton className="h-5 w-48" />
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </CardContent>
      </Card>
    );
  }

  if (!briefing || !briefing.has_items) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Sunrise className="h-5 w-5 text-amber-500" />
            {briefing?.greeting || "Good morning"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            All clear! No urgent items need your attention right now.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Sunrise className="h-5 w-5 text-amber-500" />
            {briefing.greeting}
          </CardTitle>
          <div className="flex items-center gap-2">
            {briefing.alert_count > 0 && (
              <Badge variant="outline" className="text-xs gap-1">
                <Bell className="h-3 w-3" />
                {briefing.alert_count} alert{briefing.alert_count !== 1 ? "s" : ""}
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Section badges summary */}
        <div className="flex flex-wrap gap-2">
          {briefing.sections.map((section) => (
            <Badge
              key={section.type}
              variant={BADGE_VARIANTS[section.type] || "outline"}
              className="text-xs gap-1"
            >
              {section.count} {section.title.toLowerCase()}
            </Badge>
          ))}
        </div>

        {/* Top 3 items needing attention */}
        <div className="space-y-2">
          {briefing.sections.slice(0, 3).map((section) => {
            const Icon = SECTION_ICONS[section.type] || CheckSquare;
            const colorClass = SECTION_COLORS[section.type] || "text-muted-foreground";

            return (
              <div key={section.type} className="flex items-start gap-2 text-sm">
                <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${colorClass}`} />
                <div className="min-w-0">
                  <span className="font-medium">{section.title}</span>
                  <span className="text-muted-foreground"> ({section.count})</span>
                  {section.items.length > 0 && (
                    <p className="text-xs text-muted-foreground truncate">
                      {section.items.slice(0, 2).map((item) =>
                        item.name || item.subject || item.po_number || "Item"
                      ).join(", ")}
                      {section.items.length > 2 && ` +${section.items.length - 2} more`}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Action buttons */}
        <div className="flex gap-2 pt-1">
          <Link href="/settings/assistant">
            <Button variant="outline" size="sm" className="text-xs">
              <Bell className="h-3 w-3 mr-1" />
              View Alerts
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
