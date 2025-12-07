"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  FileText,
  Cloud,
  CheckCircle2,
  Clock,
  AlertTriangle,
  RefreshCw,
  Loader2,
} from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

interface PdfSyncStatus {
  total_invoices: number;
  pdfs_synced: number;
  pending: number;
  progress_percentage: number;
  sharepoint_uploads: number;
  synced_last_24h: number;
  last_sync_at: string | null;
  breakdown: {
    bills: { total: number; synced: number };
    sales_invoices: { total: number; synced: number };
    quotes: { total: number; synced: number };
  };
  estimated_remaining_minutes: number;
  health: {
    status: "healthy" | "in_progress" | "warning" | "not_started";
    message: string;
    color: string;
  };
}

export function XeroPdfSyncStatus() {
  const [data, setData] = React.useState<PdfSyncStatus | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const fetchStatus = React.useCallback(async () => {
    try {
      const response = await api.get<{ success: boolean; data: PdfSyncStatus }>("/api/v1/xero/pdf_sync_status");
      if (response.success) {
        setData(response.data);
        setError(null);
      } else {
        setError("Failed to load PDF sync status");
      }
    } catch (err) {
      console.error("Failed to fetch PDF sync status:", err);
      setError("Failed to load PDF sync status");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchStatus();
    // Auto-refresh every 30 seconds if sync is in progress
    const interval = setInterval(() => {
      if (data?.health.status === "in_progress") {
        fetchStatus();
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [fetchStatus, data?.health.status]);

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (error || !data) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="text-center text-muted-foreground">
            <AlertTriangle className="h-8 w-8 mx-auto mb-2" />
            <p>{error || "Unable to load PDF sync status"}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const getHealthBadge = () => {
    switch (data.health.status) {
      case "healthy":
        return (
          <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Synced
          </Badge>
        );
      case "in_progress":
        return (
          <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">
            <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
            Syncing
          </Badge>
        );
      case "warning":
        return (
          <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">
            <AlertTriangle className="h-3 w-3 mr-1" />
            Stale
          </Badge>
        );
      default:
        return (
          <Badge variant="secondary">
            <Clock className="h-3 w-3 mr-1" />
            Not Started
          </Badge>
        );
    }
  };

  const formatTime = (minutes: number) => {
    if (minutes < 60) return `~${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `~${hours}h ${mins}m`;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <FileText className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <CardTitle className="text-base">PDF Sync to SharePoint</CardTitle>
              <CardDescription>
                Xero invoice PDFs synced to contact folders
              </CardDescription>
            </div>
          </div>
          {getHealthBadge()}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Progress</span>
            <span className="font-medium">{data.progress_percentage}%</span>
          </div>
          <Progress value={data.progress_percentage} className="h-2" />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{data.pdfs_synced.toLocaleString()} of {data.total_invoices.toLocaleString()} PDFs</span>
            {data.pending > 0 && (
              <span>{formatTime(data.estimated_remaining_minutes)} remaining</span>
            )}
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="p-3 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <FileText className="h-3 w-3" />
              PDFs Synced
            </div>
            <div className="text-lg font-semibold text-green-600">
              {data.pdfs_synced.toLocaleString()}
            </div>
          </div>
          <div className="p-3 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <Cloud className="h-3 w-3" />
              SharePoint
            </div>
            <div className="text-lg font-semibold text-blue-600">
              {data.sharepoint_uploads.toLocaleString()}
            </div>
          </div>
          <div className="p-3 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <Clock className="h-3 w-3" />
              Pending
            </div>
            <div className="text-lg font-semibold text-amber-600">
              {data.pending.toLocaleString()}
            </div>
          </div>
          <div className="p-3 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <RefreshCw className="h-3 w-3" />
              Last 24h
            </div>
            <div className="text-lg font-semibold">
              {data.synced_last_24h.toLocaleString()}
            </div>
          </div>
        </div>

        {/* Breakdown by Type */}
        <div className="space-y-2">
          <div className="text-sm font-medium text-muted-foreground">By Document Type</div>
          <div className="grid grid-cols-3 gap-2">
            <div className="p-2 border rounded-lg">
              <div className="text-xs text-muted-foreground">Bills</div>
              <div className="flex items-baseline gap-1">
                <span className="text-sm font-semibold">{data.breakdown.bills.synced}</span>
                <span className="text-xs text-muted-foreground">/ {data.breakdown.bills.total}</span>
              </div>
              <Progress
                value={data.breakdown.bills.total > 0 ? (data.breakdown.bills.synced / data.breakdown.bills.total) * 100 : 0}
                className="h-1 mt-1"
              />
            </div>
            <div className="p-2 border rounded-lg">
              <div className="text-xs text-muted-foreground">Invoices</div>
              <div className="flex items-baseline gap-1">
                <span className="text-sm font-semibold">{data.breakdown.sales_invoices.synced}</span>
                <span className="text-xs text-muted-foreground">/ {data.breakdown.sales_invoices.total}</span>
              </div>
              <Progress
                value={data.breakdown.sales_invoices.total > 0 ? (data.breakdown.sales_invoices.synced / data.breakdown.sales_invoices.total) * 100 : 0}
                className="h-1 mt-1"
              />
            </div>
            <div className="p-2 border rounded-lg">
              <div className="text-xs text-muted-foreground">Quotes</div>
              <div className="flex items-baseline gap-1">
                <span className="text-sm font-semibold">{data.breakdown.quotes.synced}</span>
                <span className="text-xs text-muted-foreground">/ {data.breakdown.quotes.total}</span>
              </div>
              <Progress
                value={data.breakdown.quotes.total > 0 ? (data.breakdown.quotes.synced / data.breakdown.quotes.total) * 100 : 0}
                className="h-1 mt-1"
              />
            </div>
          </div>
        </div>

        {/* Last Sync Time */}
        {data.last_sync_at && (
          <div className="flex items-center justify-between text-sm border-t pt-3">
            <span className="text-muted-foreground">Last synced</span>
            <span className="font-medium">
              {new Date(data.last_sync_at).toLocaleString("en-AU", {
                day: "numeric",
                month: "short",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
