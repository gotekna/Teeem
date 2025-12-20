"use client";

import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";
import {
  Loader2,
  Link2Off,
  Users,
  FileText,
  Activity,
  AlertCircle,
} from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { XeroConnectionStatus, TenantStats } from "./types";

interface XeroOverviewCardProps {
  companyId: string;
}

/**
 * XeroOverviewCard - Shows connection status, quick stats, and health at a glance
 *
 * Displays:
 * - Connection status with tenant name
 * - Contacts stats (linked count, pending review)
 * - Documents stats (invoices, bills)
 * - API usage percentage
 * - Health alerts if attention needed
 */
export function XeroOverviewCard({ companyId }: XeroOverviewCardProps) {
  const [status, setStatus] = React.useState<XeroConnectionStatus | null>(null);
  const [tenantStats, setTenantStats] = React.useState<TenantStats | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        // Load connection status
        const statusResponse = await api.get<{ success: boolean } & XeroConnectionStatus>(
          `/api/v1/companies/${companyId}/xero/status`
        );
        setStatus(statusResponse);

        // Load tenant stats if connected
        if (statusResponse.connected && statusResponse.xero_tenant_id) {
          const statsResponse = await api.get<{ success: boolean; data: { tenants: TenantStats[] } }>("/api/v1/xero/sync_stats");
          if (statsResponse.success && statsResponse.data?.tenants) {
            const tenant = statsResponse.data.tenants.find(t => t.tenant_id === statusResponse.xero_tenant_id);
            setTenantStats(tenant || null);
          }
        }
      } catch (error) {
        console.error("Failed to load Xero overview data:", error);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [companyId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!status?.connected) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center py-8">
            <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
              <Link2Off className="h-6 w-6 text-muted-foreground" />
            </div>
            <h3 className="font-medium mb-2">Xero Not Connected</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Connect your Xero organization to view financial data.
            </p>
            <p className="text-xs text-muted-foreground">
              Go to the Connection tab to get started.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const getStatusColor = (displayStatus?: string) => {
    switch (displayStatus) {
      case 'connected': return 'bg-green-500';
      case 'warning': return 'bg-orange-500';
      case 'error': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const formatLastSync = (dateStr?: string) => {
    if (!dateStr) return 'Never';
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) return `${diffMins} min ago`;
    if (diffHours < 24) return `${diffHours} hours ago`;
    return `${diffDays} days ago`;
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Connection Status */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-3 mb-2">
            <div className={cn("w-3 h-3 rounded-full", getStatusColor(status.display_status))} />
            <span className="text-sm font-medium">Connection</span>
          </div>
          <p className="text-lg font-semibold truncate">{status.xero_tenant_name || 'Connected'}</p>
          <p className="text-xs text-muted-foreground mt-1">
            Last sync: {formatLastSync(status.last_sync_at)}
          </p>
        </CardContent>
      </Card>

      {/* Contacts Stats */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-3 mb-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Contacts</span>
          </div>
          <p className="text-lg font-semibold">{tenantStats?.contacts?.total_links || 0} linked</p>
          {tenantStats?.contacts?.pending_review && tenantStats.contacts.pending_review > 0 ? (
            <p className="text-xs text-orange-600 mt-1">
              {tenantStats.contacts.pending_review} pending review
            </p>
          ) : (
            <p className="text-xs text-muted-foreground mt-1">All contacts synced</p>
          )}
        </CardContent>
      </Card>

      {/* Documents Stats */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-3 mb-2">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Documents</span>
          </div>
          <p className="text-lg font-semibold">{tenantStats?.documents?.total || 0} synced</p>
          <p className="text-xs text-muted-foreground mt-1">
            {tenantStats?.documents?.invoices || 0} invoices, {tenantStats?.documents?.bills || 0} bills
          </p>
        </CardContent>
      </Card>

      {/* API Usage */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-3 mb-2">
            <Activity className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">API Usage</span>
          </div>
          <p className="text-lg font-semibold">
            {tenantStats?.rate_limits?.daily_percentage !== undefined
              ? `${Math.round(tenantStats.rate_limits.daily_percentage)}%`
              : 'N/A'}
          </p>
          <p className="text-xs text-muted-foreground mt-1">Daily limit used</p>
        </CardContent>
      </Card>

      {/* Health Alert (if needed) */}
      {status.needs_attention && (
        <Card className="md:col-span-2 lg:col-span-4 border-orange-200 bg-orange-50 dark:border-orange-900 dark:bg-orange-950">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-orange-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-orange-800 dark:text-orange-200">{status.message || 'Attention Required'}</p>
                {status.action_required && (
                  <p className="text-sm text-orange-700 dark:text-orange-300 mt-1">{status.action_required}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default XeroOverviewCard;
