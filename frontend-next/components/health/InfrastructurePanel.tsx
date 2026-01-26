"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import {
  Database,
  Server,
  Cpu,
  HardDrive,
  Activity,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface InfrastructureMetric {
  id: string;
  name: string;
  status: "healthy" | "warning" | "critical";
  value?: string | number;
  maxValue?: string | number;
  percentage?: number;
  message?: string;
}

interface InfrastructurePanelProps {
  metrics: InfrastructureMetric[];
  loading?: boolean;
}

const iconMap: Record<string, React.ReactNode> = {
  database: <Database className="h-4 w-4" />,
  jobs_queue: <Server className="h-4 w-4" />,
  memory: <Cpu className="h-4 w-4" />,
  workers: <Activity className="h-4 w-4" />,
  storage: <HardDrive className="h-4 w-4" />,
};

function getStatusIcon(status: string) {
  switch (status) {
    case "healthy":
      return <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />;
    case "warning":
      return <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />;
    case "critical":
      return <XCircle className="h-4 w-4 text-red-600 dark:text-red-400" />;
    default:
      return <AlertTriangle className="h-4 w-4 text-muted-foreground" />;
  }
}

function getStatusBadgeColor(status: string): string {
  switch (status) {
    case "healthy":
      return "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 dark:bg-green-900/50 dark:text-green-300";
    case "warning":
      return "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 dark:bg-yellow-900/50 dark:text-yellow-300";
    case "critical":
      return "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 dark:bg-red-900/50 dark:text-red-300";
    default:
      return "bg-muted text-foreground dark:bg-card dark:text-muted-foreground";
  }
}

function getProgressColor(status: string): string {
  switch (status) {
    case "healthy":
      return "[&>div]:bg-green-500";
    case "warning":
      return "[&>div]:bg-yellow-500";
    case "critical":
      return "[&>div]:bg-red-500";
    default:
      return "";
  }
}

export function InfrastructurePanel({ metrics, loading }: InfrastructurePanelProps) {
  const healthyCount = metrics.filter((m) => m.status === "healthy").length;
  const warningCount = metrics.filter((m) => m.status === "warning").length;
  const criticalCount = metrics.filter((m) => m.status === "critical").length;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between text-base">
          <div className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            <span>Infrastructure</span>
          </div>
          <div className="flex items-center gap-1">
            {criticalCount > 0 && (
              <Badge variant="secondary" className="text-xs bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 dark:bg-red-900/50 dark:text-red-300">
                {criticalCount} critical
              </Badge>
            )}
            {warningCount > 0 && (
              <Badge variant="secondary" className="text-xs bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 dark:bg-yellow-900/50 dark:text-yellow-300">
                {warningCount} warning
              </Badge>
            )}
            {criticalCount === 0 && warningCount === 0 && (
              <Badge variant="secondary" className="text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 dark:bg-green-900/50 dark:text-green-300">
                All healthy
              </Badge>
            )}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        {loading ? (
          <div className="flex items-center justify-center py-4">
            <Spinner size={20} className="text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-3">
            {metrics.map((metric) => (
              <div key={metric.id} className="space-y-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {getStatusIcon(metric.status)}
                    <span className="text-sm font-medium">{metric.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {metric.value !== undefined && (
                      <span className="text-xs text-muted-foreground font-mono">
                        {metric.value}
                        {metric.maxValue && ` / ${metric.maxValue}`}
                      </span>
                    )}
                    <Badge
                      variant="secondary"
                      className={cn("text-xs", getStatusBadgeColor(metric.status))}
                    >
                      {metric.message || metric.status}
                    </Badge>
                  </div>
                </div>

                {metric.percentage !== undefined && (
                  <Progress
                    value={metric.percentage}
                    className={cn("h-1.5", getProgressColor(metric.status))}
                  />
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
