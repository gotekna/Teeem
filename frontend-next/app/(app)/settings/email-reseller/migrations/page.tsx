"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  RefreshCw,
  Play,
  Pause,
  XCircle,
  CheckCircle2,
  Clock,
  AlertCircle,
} from "lucide-react";
import { useEmailMigrations } from "@/hooks/useEmailSubscriptions";
import { cn } from "@/lib/utils";
import type { EmailMigration, MigrationStatus } from "@/lib/email-reseller-types";

const STATUS_COLORS: Record<MigrationStatus, string> = {
  pending: "bg-gray-500/10 text-gray-600",
  queued: "bg-blue-500/10 text-blue-600",
  in_progress: "bg-yellow-500/10 text-yellow-600",
  paused: "bg-orange-500/10 text-orange-600",
  completed: "bg-green-500/10 text-green-600",
  failed: "bg-red-500/10 text-red-600",
  cancelled: "bg-gray-500/10 text-gray-600",
};

const STATUS_ICONS: Record<MigrationStatus, React.ReactNode> = {
  pending: <Clock className="h-4 w-4" />,
  queued: <Clock className="h-4 w-4" />,
  in_progress: <RefreshCw className="h-4 w-4 animate-spin" />,
  paused: <Pause className="h-4 w-4" />,
  completed: <CheckCircle2 className="h-4 w-4" />,
  failed: <AlertCircle className="h-4 w-4" />,
  cancelled: <XCircle className="h-4 w-4" />,
};

export default function MigrationsPage() {
  const {
    migrations,
    loading,
    fetchActiveMigrations,
    pauseMigration,
    resumeMigration,
    cancelMigration,
  } = useEmailMigrations();

  const [refreshing, setRefreshing] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState<"active" | "completed">("active");

  // Fetch migrations on mount
  React.useEffect(() => {
    fetchActiveMigrations();
  }, [fetchActiveMigrations]);

  // Auto-refresh every 30 seconds for active migrations
  React.useEffect(() => {
    const interval = setInterval(() => {
      if (activeTab === "active") {
        fetchActiveMigrations();
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [activeTab, fetchActiveMigrations]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchActiveMigrations();
    setRefreshing(false);
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  };

  const formatDuration = (startedAt: string | null) => {
    if (!startedAt) return "-";
    const start = new Date(startedAt).getTime();
    const now = Date.now();
    const mins = Math.floor((now - start) / 60000);
    if (mins < 60) return `${mins} min`;
    const hours = Math.floor(mins / 60);
    return `${hours}h ${mins % 60}m`;
  };

  const estimateRemaining = (migration: EmailMigration) => {
    if (migration.progress === 0 || !migration.started_at) return "Calculating...";
    if (migration.progress >= 100) return "Complete";

    const startTime = new Date(migration.started_at).getTime();
    const elapsed = Date.now() - startTime;
    const totalEstimate = (elapsed / migration.progress) * 100;
    const remaining = totalEstimate - elapsed;
    const mins = Math.ceil(remaining / 60000);

    if (mins < 60) return `~${mins} min`;
    return `~${Math.ceil(mins / 60)}h`;
  };

  // Filter migrations by status
  const activeMigrations = migrations.filter((m) =>
    ["pending", "queued", "in_progress", "paused"].includes(m.status)
  );
  const completedMigrations = migrations.filter((m) =>
    ["completed", "failed", "cancelled"].includes(m.status)
  );

  if (loading && migrations.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Migration Tracker</h2>
          <p className="text-sm text-muted-foreground">
            Monitor and manage email migrations in real-time
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing}>
          <RefreshCw className={cn("h-4 w-4 mr-2", refreshing && "animate-spin")} />
          Refresh
        </Button>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "active" | "completed")}>
        <TabsList>
          <TabsTrigger value="active" className="gap-2">
            Active
            {activeMigrations.length > 0 && (
              <Badge variant="secondary" className="h-5 px-1.5">
                {activeMigrations.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="completed" className="gap-2">
            Completed
          </TabsTrigger>
        </TabsList>

        {/* Active Migrations */}
        <TabsContent value="active" className="space-y-4">
          {activeMigrations.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <CheckCircle2 className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                <p className="text-muted-foreground">No active migrations</p>
                <p className="text-sm text-muted-foreground mt-1">
                  All migrations have completed
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {activeMigrations.map((migration) => (
                <Card key={migration.id}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-base">{migration.source_email}</CardTitle>
                        <p className="text-sm text-muted-foreground mt-1">
                          {migration.contact_name || "Unknown"} •{" "}
                          {migration.migration_type.replace("_", " ")}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className={cn("capitalize gap-1", STATUS_COLORS[migration.status])}>
                          {STATUS_ICONS[migration.status]}
                          {migration.status.replace("_", " ")}
                        </Badge>
                        {migration.status === "in_progress" && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => pauseMigration(migration.id)}
                          >
                            <Pause className="h-3 w-3 mr-1" />
                            Pause
                          </Button>
                        )}
                        {migration.status === "paused" && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => resumeMigration(migration.id)}
                          >
                            <Play className="h-3 w-3 mr-1" />
                            Resume
                          </Button>
                        )}
                        {["in_progress", "paused", "pending", "queued"].includes(migration.status) && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive"
                            onClick={() => cancelMigration(migration.id)}
                          >
                            <XCircle className="h-3 w-3 mr-1" />
                            Cancel
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {/* Progress Bar */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="font-medium">{migration.progress}%</span>
                        <span className="text-muted-foreground">
                          {estimateRemaining(migration)}
                        </span>
                      </div>
                      <Progress value={migration.progress} className="h-3" />
                    </div>

                    {/* Stats */}
                    <div className="grid grid-cols-4 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Items</p>
                        <p className="font-medium">
                          {migration.processed_items.toLocaleString()} /{" "}
                          {migration.total_items.toLocaleString()}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Data</p>
                        <p className="font-medium">
                          {formatBytes(migration.processed_bytes)} /{" "}
                          {formatBytes(migration.total_bytes)}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Duration</p>
                        <p className="font-medium">{formatDuration(migration.started_at)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Failed</p>
                        <p className={cn("font-medium", migration.failed_items > 0 && "text-red-600")}>
                          {migration.failed_items}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Completed Migrations */}
        <TabsContent value="completed">
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Source Email</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Items</TableHead>
                  <TableHead>Completed</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {completedMigrations.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                      No completed migrations
                    </TableCell>
                  </TableRow>
                ) : (
                  completedMigrations.map((migration) => (
                    <TableRow key={migration.id}>
                      <TableCell className="font-medium">{migration.source_email}</TableCell>
                      <TableCell>{migration.contact_name || "Unknown"}</TableCell>
                      <TableCell>
                        <Badge className={cn("capitalize gap-1", STATUS_COLORS[migration.status])}>
                          {STATUS_ICONS[migration.status]}
                          {migration.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {migration.processed_items.toLocaleString()}
                        {migration.failed_items > 0 && (
                          <span className="text-red-600 ml-1">
                            ({migration.failed_items} failed)
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {migration.completed_at
                          ? new Date(migration.completed_at).toLocaleDateString("en-AU")
                          : "-"}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
