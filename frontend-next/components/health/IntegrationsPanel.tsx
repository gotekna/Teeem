"use client";

import * as React from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import {
  CheckCircle,
  AlertTriangle,
  XCircle,
  RefreshCw,
  ExternalLink,
  Link2,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface Integration {
  id: string;
  name: string;
  status: "connected" | "warning" | "disconnected" | "error";
  statusMessage: string;
  lastSynced?: string;
  actionLabel?: string;
  actionType?: "retry" | "connect" | "view";
  href?: string;
}

interface IntegrationsPanelProps {
  integrations: Integration[];
  onAction?: (integration: Integration) => Promise<void>;
  loading?: boolean;
}

function getStatusIcon(status: string) {
  switch (status) {
    case "connected":
      return <CheckCircle className="h-4 w-4 text-green-600" />;
    case "warning":
      return <AlertTriangle className="h-4 w-4 text-orange-600" />;
    case "disconnected":
    case "error":
      return <XCircle className="h-4 w-4 text-red-600" />;
    default:
      return <AlertTriangle className="h-4 w-4 text-muted-foreground" />;
  }
}

function getStatusBadge(status: string, message: string) {
  const variants: Record<string, string> = {
    connected: "bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300",
    warning: "bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300",
    disconnected: "bg-muted text-foreground dark:bg-card dark:text-muted-foreground",
    error: "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300",
  };

  return (
    <Badge variant="secondary" className={cn("text-xs", variants[status] || variants.disconnected)}>
      {message}
    </Badge>
  );
}

function formatLastSynced(timestamp?: string): string {
  if (!timestamp) return "";

  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString();
}

export function IntegrationsPanel({
  integrations,
  onAction,
  loading,
}: IntegrationsPanelProps) {
  const [actionLoading, setActionLoading] = React.useState<string | null>(null);

  const handleAction = async (integration: Integration) => {
    if (!onAction) return;

    setActionLoading(integration.id);
    try {
      await onAction(integration);
    } catch (error) {
      console.error("Integration action failed:", error);
    } finally {
      setActionLoading(null);
    }
  };

  const connectedCount = integrations.filter((i) => i.status === "connected").length;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between text-base">
          <div className="flex items-center gap-2">
            <Link2 className="h-4 w-4" />
            <span>Integrations</span>
          </div>
          <Badge variant="secondary" className="text-xs">
            {connectedCount}/{integrations.length} connected
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        {loading ? (
          <div className="flex items-center justify-center py-4">
            <Spinner size={20} className="text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-2">
            {integrations.map((integration) => (
              <div
                key={integration.id}
                className="flex items-center justify-between py-2 px-2 rounded hover:bg-secondary/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  {getStatusIcon(integration.status)}
                  <div>
                    <p className="font-medium text-sm">{integration.name}</p>
                    <div className="flex items-center gap-2">
                      {getStatusBadge(integration.status, integration.statusMessage)}
                      {integration.lastSynced && integration.status === "connected" && (
                        <span className="text-xs text-muted-foreground">
                          {formatLastSynced(integration.lastSynced)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {integration.actionLabel && (
                  integration.href ? (
                    <Link href={integration.href}>
                      <Button size="sm" variant="outline" className="text-xs h-7">
                        {integration.actionType === "view" ? (
                          <ExternalLink className="h-3 w-3 mr-1" />
                        ) : null}
                        {integration.actionLabel}
                      </Button>
                    </Link>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs h-7"
                      onClick={() => handleAction(integration)}
                      disabled={actionLoading === integration.id}
                    >
                      {actionLoading === integration.id ? (
                        <Spinner size={12} />
                      ) : integration.actionType === "retry" ? (
                        <>
                          <RefreshCw className="h-3 w-3 mr-1" />
                          {integration.actionLabel}
                        </>
                      ) : (
                        integration.actionLabel
                      )}
                    </Button>
                  )
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
