"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { BackButton } from "@/components/ui/back-button";
import { api } from "@/lib/api";
import {
  CheckCircle2,
  Circle,
  ArrowRight,
  ListChecks,
  Building2,
  Link2,
  Home,
  Settings2,
} from "lucide-react";
import { CreatePropertyFromJobDialog } from "@/components/properties/CreatePropertyFromJobDialog";

interface ChecklistItem {
  id: string;
  title: string;
  description: string;
  completedDescription?: string;
  complete: boolean;
  loading: boolean;
  icon: React.ElementType;
}

export default function PropertySetup() {
  const [items, setItems] = useState<ChecklistItem[]>([
    {
      id: "types",
      title: "Property Types & Statuses",
      description: "Configure property types and statuses for your portfolio",
      icon: ListChecks,
      complete: false,
      loading: true,
    },
    {
      id: "trading",
      title: "Trading Name",
      description: "Set a trading name for the property management module",
      icon: Building2,
      complete: false,
      loading: true,
    },
    {
      id: "xero",
      title: "Xero Connection",
      description: "Link a Xero organisation for financial tracking",
      icon: Link2,
      complete: false,
      loading: true,
    },
    {
      id: "property",
      title: "First Property",
      description: "Create your first property from an existing job or add manually",
      icon: Home,
      complete: false,
      loading: true,
    },
  ]);

  const [showCreateFromJob, setShowCreateFromJob] = useState(false);

  useEffect(() => {
    const fetchAll = async () => {
      const results = await Promise.allSettled([
        api.get<{ success: boolean; data: { lookups: { property_types?: unknown[]; property_statuses?: unknown[] } } }>("/api/v1/properties/lookups"),
        api.get<{ success: boolean; data: { records: unknown[] } }>("/api/v1/foundations/trading_names/records"),
        api.get<{ success: boolean; data: unknown[] }>("/api/v1/company_xero_connections"),
        api.get<{ success: boolean; data: { total: number } }>("/api/v1/properties/stats"),
      ]);

      setItems((prev) =>
        prev.map((item) => {
          switch (item.id) {
            case "types": {
              const res = results[0];
              let complete = false;
              let desc = item.description;
              if (res.status === "fulfilled" && res.value) {
                const data = (res.value as { lookups?: { property_types?: unknown[]; property_statuses?: unknown[] } })?.lookups
                  ?? (res.value as { data?: { lookups?: { property_types?: unknown[]; property_statuses?: unknown[] } } })?.data?.lookups;
                const types = data?.property_types ?? [];
                const statuses = data?.property_statuses ?? [];
                complete = types.length > 0 || statuses.length > 0;
                if (complete) {
                  desc = `${types.length} type${types.length !== 1 ? "s" : ""}, ${statuses.length} status${statuses.length !== 1 ? "es" : ""} configured`;
                }
              }
              return { ...item, complete, loading: false, description: complete ? desc : item.description };
            }
            case "trading": {
              const res = results[1];
              let complete = false;
              if (res.status === "fulfilled" && res.value) {
                const data = res.value as { records?: unknown[]; data?: { records?: unknown[] } };
                const records = data?.records ?? data?.data?.records ?? [];
                complete = records.length > 0;
              }
              return { ...item, complete, loading: false };
            }
            case "xero": {
              const res = results[2];
              let complete = false;
              if (res.status === "fulfilled" && res.value) {
                const data = res.value as { data?: Array<{ connected?: boolean }> } | Array<{ connected?: boolean }>;
                const connections = Array.isArray(data) ? data : (data as { data?: unknown[] })?.data ?? [];
                complete = (connections as Array<{ connected?: boolean }>).some((c) => c.connected);
              }
              return { ...item, complete, loading: false };
            }
            case "property": {
              const res = results[3];
              let complete = false;
              let desc = item.description;
              if (res.status === "fulfilled" && res.value) {
                const data = res.value as { total?: number; data?: { total?: number } };
                const total = data?.total ?? data?.data?.total ?? 0;
                complete = total > 0;
                if (complete) {
                  desc = `${total} propert${total !== 1 ? "ies" : "y"} created`;
                }
              }
              return { ...item, complete, loading: false, description: complete ? desc : item.description };
            }
            default:
              return item;
          }
        })
      );
    };

    fetchAll();
  }, []);

  const completedCount = items.filter((i) => i.complete).length;
  const allLoading = items.every((i) => i.loading);

  const renderAction = (item: ChecklistItem) => {
    switch (item.id) {
      case "types":
        return (
          <Button variant="outline" size="sm" asChild>
            <Link href="/settings/operations/properties">
              <Settings2 className="h-3.5 w-3.5 mr-1.5" />
              {item.complete ? "Manage" : "Configure"}
            </Link>
          </Button>
        );
      case "trading":
        return (
          <Button variant="outline" size="sm" asChild>
            <Link href="/settings/company/info">
              {item.complete ? "Manage" : "Configure"}
              <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
            </Link>
          </Button>
        );
      case "xero":
        return (
          <Button variant="outline" size="sm" asChild>
            <Link href="/settings/connections/integrations">
              {item.complete ? "Manage" : "Connect"}
              <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
            </Link>
          </Button>
        );
      case "property":
        return (
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowCreateFromJob(true)}
            >
              <Building2 className="h-3.5 w-3.5 mr-1.5" />
              From Job
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href="/properties/list">
                Add New
                <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
              </Link>
            </Button>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6 -mt-2">
      {/* Header */}
      <div>
        <BackButton fallbackHref="/properties" label="Properties" />
        <h1 className="text-2xl font-bold tracking-tight font-serif mt-3">
          Property Management Setup
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Configure your property management module
        </p>
      </div>

      {/* Progress */}
      <div className="flex items-center gap-3">
        {allLoading ? (
          <Skeleton className="h-5 w-40" />
        ) : (
          <>
            <Badge variant={completedCount === items.length ? "default" : "secondary"}>
              {completedCount} / {items.length} complete
            </Badge>
            {completedCount === items.length && (
              <span className="text-sm text-green-600 dark:text-green-400 font-medium">
                All set! You&apos;re ready to go.
              </span>
            )}
          </>
        )}
      </div>

      {/* Checklist */}
      <Card>
        <CardContent className="divide-y p-0">
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.id}
                className="flex items-center gap-4 px-6 py-4 first:pt-5 last:pb-5"
              >
                {/* Status icon */}
                <div className="flex-shrink-0">
                  {item.loading ? (
                    <Skeleton className="h-5 w-5 rounded-full" />
                  ) : item.complete ? (
                    <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                  ) : (
                    <Circle className="h-5 w-5 text-muted-foreground/40" />
                  )}
                </div>

                {/* Icon */}
                <div className="flex-shrink-0">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium ${item.complete ? "text-muted-foreground" : ""}`}>
                    {item.title}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {item.loading ? (
                      <Skeleton className="h-3 w-48 inline-block" />
                    ) : (
                      item.description
                    )}
                  </p>
                </div>

                {/* Action */}
                <div className="flex-shrink-0">
                  {!item.loading && renderAction(item)}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Footer action */}
      <div className="flex justify-end">
        <Button asChild>
          <Link href="/properties">
            Go to Dashboard
            <ArrowRight className="h-4 w-4 ml-2" />
          </Link>
        </Button>
      </div>

      {/* Create from Job Dialog */}
      <CreatePropertyFromJobDialog
        open={showCreateFromJob}
        onOpenChange={setShowCreateFromJob}
        onSuccess={() => {
          setShowCreateFromJob(false);
          // Refresh property check
          api.get<{ success: boolean; data: { total: number } }>("/api/v1/properties/stats").then((res) => {
            const data = res as { total?: number; data?: { total?: number } };
            const total = data?.total ?? data?.data?.total ?? 0;
            setItems((prev) =>
              prev.map((item) =>
                item.id === "property"
                  ? {
                      ...item,
                      complete: total > 0,
                      description: total > 0 ? `${total} propert${total !== 1 ? "ies" : "y"} created` : item.description,
                    }
                  : item
              )
            );
          });
        }}
      />
    </div>
  );
}
