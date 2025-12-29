"use client";

import { useState, useEffect } from "react";
import {
  ArrowPathIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ServerIcon,
  CpuChipIcon,
  CircleStackIcon,
} from "@heroicons/react/24/outline";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { api } from "@/lib/api";

// Types
interface Health {
  status?: string;
  database?: { status: string };
  memory?: { used_mb: number };
  storage?: { tmp_files: number };
}

interface Performance {
  server?: {
    ruby_version: string;
    rails_version: string;
    environment: string;
    threads: number;
    uptime_seconds: number;
  };
  database?: {
    connected: boolean;
    pool_size: number;
    active_connections: number;
  };
  memory?: { rss_mb: number };
  cache?: { log_size_mb: number };
}

interface Metrics {
  records?: {
    constructions: number;
    contacts: number;
    purchase_orders: number;
    estimates: number;
  };
}

export default function SystemPerformancePage() {
  const [health, setHealth] = useState<Health | null>(null);
  const [performance, setPerformance] = useState<Performance | null>(null);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);

  useEffect(() => {
    loadAllData();

    if (autoRefresh) {
      const interval = setInterval(loadAllData, 30000);
      return () => clearInterval(interval);
    }
  }, [autoRefresh]);

  const loadAllData = async () => {
    try {
      const [healthRes, perfRes, metricsRes] = await Promise.all([
        api.get<{ data: Health }>("/api/v1/system/health"),
        api.get<{ data: Performance }>("/api/v1/system/performance"),
        api.get<{ data: Metrics }>("/api/v1/system/metrics"),
      ]);

      setHealth(healthRes?.data || healthRes);
      setPerformance(perfRes?.data || perfRes);
      setMetrics(metricsRes?.data || metricsRes);
    } catch (err) {
      console.error("Failed to load system data:", err);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string | undefined) => {
    if (status === "healthy" || status === "connected") {
      return (
        <Badge className="gap-1.5 bg-green-100 text-green-700 dark:bg-green-500/10 dark:text-green-400">
          <CheckCircleIcon className="h-4 w-4" />
          Healthy
        </Badge>
      );
    }
    return (
      <Badge className="gap-1.5 bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400">
        <ExclamationTriangleIcon className="h-4 w-4" />
        Issue
      </Badge>
    );
  };

  const formatBytes = (mb: number) => {
    if (mb < 1024) return `${mb.toFixed(2)} MB`;
    return `${(mb / 1024).toFixed(2)} GB`;
  };

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Spinner size={32} className="text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="container max-w-7xl py-8">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">System Performance</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Monitor system health, performance metrics, and resource usage
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center space-x-2">
            <Switch id="auto-refresh" checked={autoRefresh} onCheckedChange={setAutoRefresh} />
            <Label htmlFor="auto-refresh" className="text-sm">
              Auto-refresh (30s)
            </Label>
          </div>
          <Button onClick={loadAllData}>
            <ArrowPathIcon className="mr-2 h-4 w-4" />
            Refresh Now
          </Button>
        </div>
      </div>

      {/* System Health Status */}
      <div className="mb-8">
        <h2 className="mb-4 text-lg font-semibold">System Health</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardContent className="flex items-center gap-4 p-5">
              <ServerIcon className="h-6 w-6 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">Overall Status</p>
                <div className="mt-1">{getStatusBadge(health?.status)}</div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex items-center gap-4 p-5">
              <CircleStackIcon className="h-6 w-6 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">Database</p>
                <div className="mt-1">{getStatusBadge(health?.database?.status)}</div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex items-center gap-4 p-5">
              <CpuChipIcon className="h-6 w-6 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">Memory Usage</p>
                <p className="mt-1 text-sm font-semibold">
                  {health?.memory?.used_mb ? formatBytes(health.memory.used_mb) : "N/A"}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex items-center gap-4 p-5">
              <ServerIcon className="h-6 w-6 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">Tmp Files</p>
                <p className="mt-1 text-sm font-semibold">
                  {health?.storage?.tmp_files?.toLocaleString() || "0"}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Performance Metrics */}
      <div className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Server Info */}
        <Card>
          <CardHeader>
            <CardTitle>Server Information</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="space-y-3">
              <div className="flex justify-between">
                <dt className="text-sm text-muted-foreground">Ruby Version</dt>
                <dd className="text-sm font-medium">{performance?.server?.ruby_version || "N/A"}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-sm text-muted-foreground">Rails Version</dt>
                <dd className="text-sm font-medium">{performance?.server?.rails_version || "N/A"}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-sm text-muted-foreground">Environment</dt>
                <dd className="text-sm font-medium capitalize">
                  {performance?.server?.environment || "N/A"}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-sm text-muted-foreground">Active Threads</dt>
                <dd className="text-sm font-medium">{performance?.server?.threads || "N/A"}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-sm text-muted-foreground">Uptime</dt>
                <dd className="text-sm font-medium">
                  {performance?.server?.uptime_seconds
                    ? `${Math.floor(performance.server.uptime_seconds / 3600)}h ${Math.floor((performance.server.uptime_seconds % 3600) / 60)}m`
                    : "N/A"}
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        {/* Database Info */}
        <Card>
          <CardHeader>
            <CardTitle>Database Connection Pool</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="space-y-3">
              <div className="flex justify-between">
                <dt className="text-sm text-muted-foreground">Status</dt>
                <dd className="text-sm font-medium">
                  {performance?.database?.connected ? "Connected" : "Disconnected"}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-sm text-muted-foreground">Pool Size</dt>
                <dd className="text-sm font-medium">{performance?.database?.pool_size || "N/A"}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-sm text-muted-foreground">Active Connections</dt>
                <dd className="text-sm font-medium">
                  {performance?.database?.active_connections || "N/A"}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-sm text-muted-foreground">Memory (RSS)</dt>
                <dd className="text-sm font-medium">
                  {performance?.memory?.rss_mb ? formatBytes(performance.memory.rss_mb) : "N/A"}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-sm text-muted-foreground">Log Size</dt>
                <dd className="text-sm font-medium">
                  {performance?.cache?.log_size_mb ? formatBytes(performance.cache.log_size_mb) : "N/A"}
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>
      </div>

      {/* Application Metrics */}
      <Card>
        <CardHeader>
          <CardTitle>Application Metrics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <div className="rounded-lg bg-muted/50 p-4 text-center">
              <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
                {metrics?.records?.constructions?.toLocaleString() || "0"}
              </div>
              <div className="mt-1 text-sm text-muted-foreground">Constructions</div>
            </div>
            <div className="rounded-lg bg-muted/50 p-4 text-center">
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                {metrics?.records?.contacts?.toLocaleString() || "0"}
              </div>
              <div className="mt-1 text-sm text-muted-foreground">Contacts</div>
            </div>
            <div className="rounded-lg bg-muted/50 p-4 text-center">
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {metrics?.records?.purchase_orders?.toLocaleString() || "0"}
              </div>
              <div className="mt-1 text-sm text-muted-foreground">Purchase Orders</div>
            </div>
            <div className="rounded-lg bg-muted/50 p-4 text-center">
              <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                {metrics?.records?.estimates?.toLocaleString() || "0"}
              </div>
              <div className="mt-1 text-sm text-muted-foreground">Estimates</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Last Updated */}
      <div className="mt-4 text-center text-sm text-muted-foreground">
        Last updated: {new Date().toLocaleString()}
      </div>
    </div>
  );
}
