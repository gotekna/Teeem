"use client";

import { useState, useEffect } from "react";
import { useConfirm } from "@/contexts/ConfirmationContext";
import Link from "next/link";
import {
  ArrowPathIcon,
  CheckCircleIcon,
  ClockIcon,
  ExclamationCircleIcon,
  UserGroupIcon,
  DocumentTextIcon,
  BanknotesIcon,
  ChartBarIcon,
} from "@heroicons/react/24/outline";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { Spinner } from "@/components/ui/spinner";
import { api } from "@/lib/api";
import { formatDate, formatDateTime } from "@/utils/formatters";

// Types
interface ConnectionStatus {
  loading: boolean;
  connected: boolean;
  organizationName?: string;
}

interface SyncStatus {
  contacts_synced?: number;
  invoices_matched?: number;
  payments_synced?: number;
  last_sync?: string;
}

interface SyncHistoryEntry {
  type: string;
  status: string;
  message?: string;
  timestamp: string;
}

export default function XeroSyncPage() {
  const { toast } = useToast();
  const { confirm } = useConfirm();
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>({
    loading: true,
    connected: false,
  });
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [syncHistory, setSyncHistory] = useState<SyncHistoryEntry[]>([]);
  const [syncing, setSyncing] = useState({ contacts: false, invoices: false });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
     
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      await Promise.all([loadConnectionStatus(), loadSyncStatus(), loadSyncHistory()]);
    } finally {
      setLoading(false);
    }
  };

  const loadConnectionStatus = async () => {
    try {
      const response = await api.get<{ data: { connected: boolean; tenant_name?: string } }>(
        "/api/v1/xero/status"
      );
      setConnectionStatus({
        loading: false,
        connected: response?.data?.connected || false,
        organizationName: response?.data?.tenant_name,
      });
    } catch (err) {
      console.error("Failed to load Xero status:", err);
      setConnectionStatus({ loading: false, connected: false });
    }
  };

  const loadSyncStatus = async () => {
    try {
      const response = await api.get<{ data: SyncStatus }>("/api/v1/xero/sync_status");
      setSyncStatus(response?.data || null);
    } catch (err) {
      console.error("Failed to load sync status:", err);
      setSyncStatus(null);
    }
  };

  const loadSyncHistory = async () => {
    try {
      const response = await api.get<{ history: SyncHistoryEntry[] }>("/api/v1/xero/sync_history");
      setSyncHistory(response?.history || []);
    } catch (err) {
      console.error("Failed to load sync history:", err);
      setSyncHistory([]);
    }
  };

  const handleSyncContacts = async () => {
    if (!(await confirm("This will sync all contacts from TEEEM to Xero. Continue?"))) {
      return;
    }

    try {
      setSyncing({ ...syncing, contacts: true });
      await api.post("/api/v1/xero/sync_contacts");
      toast({
        title: "Contact sync started",
        description: "This may take a few minutes.",
      });
      await loadSyncStatus();
      await loadSyncHistory();
    } catch (err) {
      console.error("Failed to sync contacts:", err);
      toast({
        title: "Sync failed",
        description: "Failed to sync contacts. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSyncing({ ...syncing, contacts: false });
    }
  };

  const getSyncStatusBadge = (status: string) => {
    const badges: Record<
      string,
      { className: string; icon: React.ComponentType<{ className?: string }>; text: string }
    > = {
      success: {
        className: "bg-status-success text-status-success-foreground dark:bg-green-900/30 dark:text-green-400",
        icon: CheckCircleIcon,
        text: "Success",
      },
      in_progress: {
        className: "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 dark:bg-blue-900/30 dark:text-blue-400",
        icon: ClockIcon,
        text: "In Progress",
      },
      failed: {
        className: "bg-status-error text-status-error-foreground dark:bg-red-900/30 dark:text-red-400",
        icon: ExclamationCircleIcon,
        text: "Failed",
      },
      pending: {
        className: "bg-muted text-foreground dark:bg-muted dark:text-muted-foreground",
        icon: ClockIcon,
        text: "Pending",
      },
    };
    return badges[status] || badges.pending;
  };

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Spinner size={32} className="text-muted-foreground" />
      </div>
    );
  }

  if (!connectionStatus.connected) {
    return (
      <div className="container max-w-4xl py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold">Xero Integration</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Connect your Xero account to sync contacts, invoices, and payments automatically.
          </p>
        </div>

        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">
              Xero is not connected. Please connect your Xero account in{" "}
              <Link href="/settings/integrations/xero" className="text-primary hover:underline">
                Settings → Integrations → Xero
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container py-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Xero Sync</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Manage your Xero integration and sync data between TEEEM and Xero.
          </p>
        </div>
        <Button onClick={loadData}>
          <ArrowPathIcon className="mr-2 h-5 w-5" />
          Refresh
        </Button>
      </div>

      {/* Connection Status */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Connection Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <CheckCircleIcon className="h-6 w-6 text-green-500" />
            <div>
              <p className="font-medium">Connected to Xero</p>
              {connectionStatus.organizationName && (
                <p className="text-sm text-muted-foreground">
                  Organization: {connectionStatus.organizationName}
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Sync Stats */}
      <div className="mb-8">
        <h2 className="mb-4 text-lg font-semibold">Sync Overview</h2>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <UserGroupIcon className="h-8 w-8 text-indigo-600" />
                <div className="ml-5">
                  <p className="text-sm font-medium text-muted-foreground">Contacts Synced</p>
                  <p className="mt-1 text-3xl font-semibold">{syncStatus?.contacts_synced || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <DocumentTextIcon className="h-8 w-8 text-green-600" />
                <div className="ml-5">
                  <p className="text-sm font-medium text-muted-foreground">Invoices Matched</p>
                  <p className="mt-1 text-3xl font-semibold">{syncStatus?.invoices_matched || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <BanknotesIcon className="h-8 w-8 text-blue-600" />
                <div className="ml-5">
                  <p className="text-sm font-medium text-muted-foreground">Payments Synced</p>
                  <p className="mt-1 text-3xl font-semibold">{syncStatus?.payments_synced || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <ChartBarIcon className="h-8 w-8 text-purple-600" />
                <div className="ml-5">
                  <p className="text-sm font-medium text-muted-foreground">Last Sync</p>
                  <p className="mt-1 text-sm font-semibold">
                    {syncStatus?.last_sync
                      ? formatDate(syncStatus.last_sync).split(",")[0]
                      : "Never"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="mb-8">
        <h2 className="mb-4 text-lg font-semibold">Quick Actions</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Button
            variant="outline"
            onClick={handleSyncContacts}
            disabled={syncing.contacts}
            className="h-auto justify-start px-6 py-5"
          >
            <div className="flex items-center gap-3">
              {syncing.contacts ? (
                <Spinner size={24} />
              ) : (
                <UserGroupIcon className="h-6 w-6 text-indigo-600" />
              )}
              <div className="text-left">
                <p className="font-medium">
                  {syncing.contacts ? "Syncing Contacts..." : "Sync Contacts"}
                </p>
                <p className="text-sm text-muted-foreground">Push contacts to Xero</p>
              </div>
            </div>
          </Button>

          <Link href="/contacts">
            <Button variant="outline" className="h-auto w-full justify-start px-6 py-5">
              <div className="flex items-center gap-3">
                <DocumentTextIcon className="h-6 w-6 text-green-600" />
                <div className="text-left">
                  <p className="font-medium">Match Invoices</p>
                  <p className="text-sm text-muted-foreground">Link POs to Xero invoices</p>
                </div>
              </div>
            </Button>
          </Link>

          <Link href="/jobs">
            <Button variant="outline" className="h-auto w-full justify-start px-6 py-5">
              <div className="flex items-center gap-3">
                <BanknotesIcon className="h-6 w-6 text-blue-600" />
                <div className="text-left">
                  <p className="font-medium">View Payments</p>
                  <p className="text-sm text-muted-foreground">See synced payments</p>
                </div>
              </div>
            </Button>
          </Link>
        </div>
      </div>

      {/* Sync History */}
      <div className="mb-8">
        <h2 className="mb-4 text-lg font-semibold">Sync History</h2>
        <Card>
          {syncHistory.length === 0 ? (
            <CardContent className="py-12 text-center">
              <ClockIcon className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-2 text-sm font-semibold">No sync history</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Sync history will appear here as you sync data with Xero.
              </p>
            </CardContent>
          ) : (
            <div className="divide-y">
              {syncHistory.map((entry, index) => {
                const badge = getSyncStatusBadge(entry.status);
                const Icon = badge.icon;

                return (
                  <div key={index} className="flex items-center justify-between px-4 py-4 sm:px-6">
                    <div className="flex min-w-0 flex-1 items-center gap-x-3">
                      <Icon
                        className={`h-5 w-5 flex-shrink-0 ${
                          entry.status === "success"
                            ? "text-green-600"
                            : entry.status === "failed"
                            ? "text-red-600"
                            : "text-blue-600"
                        }`}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">
                          {entry.type === "contacts" && "Contact Sync"}
                          {entry.type === "invoices" && "Invoice Match"}
                          {entry.type === "payments" && "Payment Sync"}
                        </p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {entry.message || "No details available"}
                        </p>
                      </div>
                    </div>
                    <div className="ml-4 flex flex-shrink-0 items-center gap-x-4">
                      <Badge className={badge.className}>{badge.text}</Badge>
                      <time className="whitespace-nowrap text-sm text-muted-foreground">
                        {formatDate(entry.timestamp)}
                      </time>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      {/* Help */}
      <Card className="bg-blue-50 dark:bg-blue-900/20">
        <CardContent className="p-6">
          <h3 className="text-sm font-medium text-blue-800 dark:text-blue-400">
            Need help with Xero integration?
          </h3>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-blue-700 dark:text-blue-300">
            <li>Contacts sync automatically when you create or update suppliers</li>
            <li>Match Xero invoices to purchase orders for automatic payment tracking</li>
            <li>Payments recorded in TEEEM sync to Xero automatically</li>
            <li>
              Visit the{" "}
              <Link href="/settings" className="font-medium underline">
                Settings page
              </Link>{" "}
              for advanced configuration
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
