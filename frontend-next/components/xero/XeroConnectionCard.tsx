"use client";

import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Loader2,
  CheckCircle,
  XCircle,
  AlertTriangle,
  RefreshCw,
  ExternalLink,
  Link2,
  Unlink,
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import type { XeroConnectionStatus, TenantStats } from "./types";

interface XeroConnectionCardProps {
  companyId: string;
  companyName?: string;
  onSyncComplete?: () => void;
  onConnectionChange?: (connected: boolean) => void;
}

/**
 * XeroConnectionCard - OAuth connection management for Xero
 *
 * Features:
 * - Connect/disconnect Xero organizations
 * - Display connection status with health indicators
 * - Sync controls with detailed feedback
 * - Confirmation dialog for new connections
 * - Tenant stats display (contacts, documents, API usage)
 */
export function XeroConnectionCard({
  companyId,
  companyName,
  onSyncComplete,
  onConnectionChange,
}: XeroConnectionCardProps) {
  const { toast } = useToast();
  const [status, setStatus] = React.useState<XeroConnectionStatus | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [connecting, setConnecting] = React.useState(false);
  const [disconnecting, setDisconnecting] = React.useState(false);
  const [syncing, setSyncing] = React.useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = React.useState(false);
  const [pendingConnection, setPendingConnection] = React.useState<XeroConnectionStatus | null>(null);
  const [tenantStats, setTenantStats] = React.useState<TenantStats | null>(null);

  React.useEffect(() => {
    loadStatus();
  }, [companyId]);

  const loadStatus = async () => {
    try {
      setLoading(true);
      const response = await api.get<{ success: boolean } & XeroConnectionStatus>(
        `/api/v1/companies/${companyId}/xero/status`
      );
      setStatus(response);
    } catch (error) {
      console.error("Failed to load Xero status:", error);
      setStatus({ connected: false });
      onConnectionChange?.(false);
    } finally {
      setLoading(false);
    }
  };

  // Notify parent when status changes
  React.useEffect(() => {
    if (status !== null) {
      onConnectionChange?.(status.connected);
    }
  }, [status?.connected]);

  // Load tenant stats when connected
  React.useEffect(() => {
    const loadTenantStats = async () => {
      if (!status?.connected || !status?.xero_tenant_id) {
        setTenantStats(null);
        return;
      }
      try {
        const response = await api.get<{ success: boolean; data: { tenants: TenantStats[] } }>("/api/v1/xero/sync_stats");
        if (response.success && response.data?.tenants) {
          const tenant = response.data.tenants.find(t => t.tenant_id === status.xero_tenant_id);
          setTenantStats(tenant || null);
        }
      } catch (error) {
        console.error("Failed to load tenant stats:", error);
      }
    };
    loadTenantStats();
  }, [status?.connected, status?.xero_tenant_id]);

  const handleConnect = async () => {
    try {
      setConnecting(true);
      const response = await api.get<{ success: boolean; authorization_url: string }>(
        `/api/v1/companies/${companyId}/xero/authorize`
      );
      if (response?.success && response.authorization_url) {
        // Open Xero OAuth in new window
        window.open(response.authorization_url, "_blank", "width=600,height=700");
        // Start polling for connection status
        const pollInterval = setInterval(async () => {
          const statusCheck = await api.get<{ success: boolean } & XeroConnectionStatus>(
            `/api/v1/companies/${companyId}/xero/status`
          );
          if (statusCheck.connected) {
            clearInterval(pollInterval);
            // Show confirmation dialog instead of auto-accepting
            setPendingConnection(statusCheck);
            setShowConfirmDialog(true);
            setConnecting(false);
          }
        }, 3000);
        // Stop polling after 5 minutes
        setTimeout(() => {
          clearInterval(pollInterval);
          setConnecting(false);
        }, 300000);
      }
    } catch (error) {
      console.error("Failed to start Xero connection:", error);
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm("Are you sure you want to disconnect from Xero? This will remove the connection for this company.")) {
      return;
    }
    try {
      setDisconnecting(true);
      await api.post(`/api/v1/companies/${companyId}/xero/disconnect`);
      setStatus({ connected: false });
    } catch (error) {
      console.error("Failed to disconnect from Xero:", error);
    } finally {
      setDisconnecting(false);
    }
  };

  const handleSync = async () => {
    try {
      setSyncing(true);
      const response = await api.post<{
        success: boolean;
        message?: string;
        bank_accounts_synced?: number;
        transactions_synced?: number;
        error?: string;
      }>(`/api/v1/companies/${companyId}/xero/sync`);

      if (response && response.success) {
        const bankAccountsMsg = response.bank_accounts_synced
          ? `${response.bank_accounts_synced} bank account${response.bank_accounts_synced !== 1 ? 's' : ''}`
          : '0 bank accounts';
        const transactionsMsg = response.transactions_synced
          ? `${response.transactions_synced} transaction${response.transactions_synced !== 1 ? 's' : ''}`
          : '0 transactions';

        toast({
          title: "Sync completed successfully",
          description: `Synced ${bankAccountsMsg} and ${transactionsMsg}`,
        });
      }

      await loadStatus();
      onSyncComplete?.();
    } catch (error: unknown) {
      console.error("Failed to sync with Xero:", error);
      const axiosError = error as { response?: { data?: { error?: string } }; message?: string };
      const errorMessage = axiosError?.response?.data?.error || axiosError?.message || "Failed to sync with Xero";
      toast({
        title: "Sync failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setSyncing(false);
    }
  };

  // User confirms the Xero connection is correct
  const handleConfirmConnection = () => {
    if (pendingConnection) {
      setStatus(pendingConnection);
      setPendingConnection(null);
    }
    setShowConfirmDialog(false);
  };

  // User says wrong connection - disconnect
  const handleRejectConnection = async () => {
    setShowConfirmDialog(false);
    setPendingConnection(null);
    try {
      setDisconnecting(true);
      await api.post(`/api/v1/companies/${companyId}/xero/disconnect`);
      setStatus({ connected: false });
    } catch (error) {
      console.error("Failed to disconnect from Xero:", error);
    } finally {
      setDisconnecting(false);
    }
  };

  if (loading) {
    return (
      <Card className="mb-4">
        <CardContent className="p-4">
          <div className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm text-muted-foreground">Loading Xero status...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mb-4">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className={cn(
              "w-10 h-10 rounded-lg flex items-center justify-center",
              status?.connected ? "bg-blue-100 dark:bg-blue-900/30" : "bg-muted"
            )}>
              <svg viewBox="0 0 24 24" className={cn("h-6 w-6", status?.connected ? "text-blue-600" : "text-muted-foreground")}>
                <path fill="currentColor" d="M12.076 2.018C5.956 2.018 1.001 6.974 1.001 13.093c0 6.12 4.955 11.075 11.075 11.075 6.119 0 11.075-4.955 11.075-11.075 0-6.12-4.956-11.075-11.075-11.075zm0 19.875c-4.863 0-8.8-3.937-8.8-8.8s3.937-8.8 8.8-8.8 8.8 3.937 8.8 8.8-3.937 8.8-8.8 8.8z"/>
                <path fill="currentColor" d="M15.951 10.343l-3.875 2.75-3.875-2.75c-.325-.231-.778-.156-1.009.169-.231.325-.156.778.169 1.009l4.5 3.193c.131.094.281.14.432.14s.3-.047.431-.14l4.5-3.193c.325-.231.4-.684.169-1.009-.231-.325-.684-.4-1.009-.169h-.433z"/>
              </svg>
            </div>
            <div>
              <h3 className="font-medium">
                Xero Integration
                {status?.connected && status.xero_tenant_name && (
                  <span className="ml-2 text-sm font-normal text-muted-foreground">
                    ({status.xero_tenant_name})
                  </span>
                )}
              </h3>
              {/* SSoT: Use display_status from XeroConnectionHealth service */}
              <div className="flex items-center gap-3 text-sm">
                {(status?.display_status === 'connected' || (!status?.display_status && status?.connected)) ? (
                  <>
                    <span className="flex items-center gap-1.5 text-green-600 dark:text-green-400">
                      <CheckCircle className="h-3.5 w-3.5" />
                      Connected
                    </span>
                    {status?.last_sync_at && (
                      <span className="text-muted-foreground">
                        Last sync: {format(new Date(status.last_sync_at), "d MMM yyyy, h:mm a")}
                      </span>
                    )}
                    {status?.days_since_sync !== undefined && status?.days_since_sync !== null && status?.days_since_sync > 7 && (
                      <Badge variant="secondary" className="bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300">
                        <AlertTriangle className="h-3 w-3 mr-1" />
                        {status.days_since_sync} days since last sync
                      </Badge>
                    )}
                  </>
                ) : status?.display_status === 'warning' ? (
                  <span className="flex items-center gap-1.5 text-orange-600 dark:text-orange-400">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    {status?.message || 'Needs attention'}
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <XCircle className="h-3.5 w-3.5" />
                    {status?.message || 'Not connected'}
                  </span>
                )}
                {/* Show needs_attention indicator if action required */}
                {status?.needs_attention && status?.action_required === 'reconnect' && (
                  <Badge variant="destructive" className="text-xs">
                    Reconnect Required
                  </Badge>
                )}
              </div>
            </div>
          </div>
          {/* SSoT: Use display_status to determine which buttons to show */}
          <div className="flex items-center gap-2">
            {(status?.display_status === 'connected' || status?.display_status === 'warning' || (!status?.display_status && status?.connected)) ? (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open("https://go.xero.com/", "_blank")}
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Open Xero
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSync}
                  disabled={syncing}
                >
                  {syncing ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4 mr-2" />
                  )}
                  Sync Now
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleDisconnect}
                  disabled={disconnecting}
                  className="text-destructive hover:text-destructive"
                >
                  {disconnecting ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Unlink className="h-4 w-4 mr-2" />
                  )}
                  Disconnect
                </Button>
              </>
            ) : (
              <Button
                onClick={handleConnect}
                disabled={connecting}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                {connecting ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Link2 className="h-4 w-4 mr-2" />
                )}
                {status?.action_required === 'reconnect' ? 'Reconnect to Xero' : 'Connect to Xero'}
              </Button>
            )}
          </div>
        </div>

        {/* Tenant Stats */}
        {status?.connected && tenantStats && (
          <div className="mt-4 pt-4 border-t">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="p-3 bg-muted/50 rounded-lg">
                <div className="text-2xl font-bold">{tenantStats.contacts.total_links}</div>
                <div className="text-xs text-muted-foreground">Contacts</div>
              </div>
              <div className="p-3 bg-muted/50 rounded-lg">
                <div className="text-2xl font-bold">{tenantStats.documents.total}</div>
                <div className="text-xs text-muted-foreground">Documents</div>
              </div>
              <div className="p-3 bg-muted/50 rounded-lg">
                <div className="text-2xl font-bold">{tenantStats.rate_limits?.daily_percentage || 0}%</div>
                <div className="text-xs text-muted-foreground">Daily API</div>
              </div>
            </div>
            <div className="flex justify-between text-xs text-muted-foreground mt-3 px-1">
              <span>{tenantStats.documents.invoices} invoices</span>
              <span>{tenantStats.documents.bills} bills</span>
              <span>{tenantStats.documents.quotes} quotes</span>
            </div>
            {tenantStats.contacts.pending_review > 0 && (
              <div className="flex items-center gap-2 text-xs text-amber-600 bg-amber-50 dark:bg-amber-900/20 p-2 rounded mt-3">
                <AlertTriangle className="h-3 w-3" />
                {tenantStats.contacts.pending_review} pending review
              </div>
            )}
          </div>
        )}
      </CardContent>

      {/* Confirmation Dialog */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-500" />
              Confirm Xero Connection
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-4">
                <p>Please verify this connection is correct:</p>
                <div className="rounded-lg border p-4 space-y-2 bg-muted/50">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">TEEEM Company:</span>
                    <span className="font-medium text-foreground">{companyName || "Unknown"}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Connected to Xero:</span>
                    <span className="font-medium text-blue-600">{pendingConnection?.xero_tenant_name || "Unknown"}</span>
                  </div>
                </div>
                <p className="text-sm text-orange-600 dark:text-orange-400">
                  Make sure the Xero organisation matches this company. Connecting to the wrong Xero file will sync incorrect data.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={handleRejectConnection}
              className="bg-red-50 text-red-700 hover:bg-red-100 border-red-200"
            >
              Wrong Company - Disconnect
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmConnection}
              className="bg-green-600 hover:bg-green-700"
            >
              Yes, This is Correct
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

export default XeroConnectionCard;
