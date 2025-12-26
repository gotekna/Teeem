"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Spinner } from "@/components/ui/spinner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  RefreshCw,
  BookOpen,
  TrendingUp,
  ArrowLeft,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  History,
  Building2,
  Layers,
  FileText,
  Receipt,
  CreditCard,
  Landmark,
  Users,
  Percent,
  Coins,
  FileSpreadsheet,
  Settings,
  Repeat,
  Link2,
  ExternalLink,
  Copy,
  Check,
} from "lucide-react";
import RecurringInvoicesTab from "@/components/financial/RecurringInvoicesTab";
import PaymentLinksTab from "@/components/financial/PaymentLinksTab";
import Link from "next/link";
import { api } from "@/lib/api";

interface Provider {
  id: string | null;
  provider: string;
  tenant_id: string;
  tenant_name: string;
  status: string;
  connected: boolean;
  last_sync_at: string | null;
  last_sync_status?: string;
  last_sync_error?: string | null;
  sync_enabled: boolean;
  source: string;
  company_id?: number;
  company_name?: string;
  account_count?: number;
}

interface Account {
  id: number;
  code: string;
  name: string;
  account_type: string;
  account_class: string;
  is_bank_account: boolean;
  active: boolean;
  external_provider: string | null;
}

interface SyncLog {
  id: number;
  provider: string;
  tenant_id: string;
  sync_type: string;
  status: string;
  status_badge: string;
  started_at: string;
  completed_at: string | null;
  duration: string;
  trigger: string;
  stats: Record<string, number>;
}

interface ChartOfAccounts {
  assets: Account[];
  liabilities: Account[];
  equity: Account[];
  revenue: Account[];
  expenses: Account[];
}

// Sync step types - matches backend SYNC_TYPES (SSoT: backend/app/models/gl/sync_log.rb)
type SyncStepStatus = "pending" | "running" | "completed" | "failed" | "skipped";

interface SyncStep {
  id: string;
  name: string;
  icon: React.ReactNode;
  status: SyncStepStatus;
  count?: number;
  error?: string;
}

// Define the sync steps with icons (order matters - dependencies first)
const SYNC_STEP_DEFINITIONS = [
  { id: "accounts", name: "Chart of Accounts", icon: <BookOpen className="h-4 w-4" /> },
  { id: "tax_rates", name: "Tax Rates", icon: <Percent className="h-4 w-4" /> },
  { id: "currencies", name: "Currencies", icon: <Coins className="h-4 w-4" /> },
  { id: "contacts", name: "Contacts", icon: <Users className="h-4 w-4" /> },
  { id: "invoices", name: "Sales Invoices", icon: <FileText className="h-4 w-4" /> },
  { id: "bills", name: "Bills", icon: <Receipt className="h-4 w-4" /> },
  { id: "payments", name: "Payments", icon: <CreditCard className="h-4 w-4" /> },
  { id: "bank_transactions", name: "Bank Transactions", icon: <Landmark className="h-4 w-4" /> },
  { id: "credit_notes", name: "Credit Notes", icon: <FileSpreadsheet className="h-4 w-4" /> },
  { id: "manual_journals", name: "Manual Journals", icon: <Layers className="h-4 w-4" /> },
] as const;

// Helper to format time ago
function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

export default function GlPage() {
  const [loading, setLoading] = useState(true);
  const [syncingTenantId, setSyncingTenantId] = useState<string | null>(null);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<Provider | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [chartOfAccounts, setChartOfAccounts] = useState<ChartOfAccounts | null>(null);
  const [syncLogs, setSyncLogs] = useState<SyncLog[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("companies");

  // Full sync progress modal state
  const [showSyncProgress, setShowSyncProgress] = useState(false);
  const [syncSteps, setSyncSteps] = useState<SyncStep[]>([]);
  const [fullSyncRunning, setFullSyncRunning] = useState(false);
  const [fullSyncProvider, setFullSyncProvider] = useState<Provider | null>(null);

  // Fetch available providers
  const fetchProviders = useCallback(async () => {
    try {
      const response = await api.get<{ success: boolean; data: Provider[] }>("/api/v1/gl/sync/providers");
      if (response?.success) {
        setProviders(response.data || []);
        // Auto-select first connected Xero provider if available
        const connectedProvider = response.data?.find((p: Provider) => p.provider === "xero" && p.connected);
        if (connectedProvider && !selectedProvider) {
          setSelectedProvider(connectedProvider);
        }
      }
    } catch (err) {
      console.error("Failed to fetch providers:", err);
    }
  }, [selectedProvider]);

  // Fetch chart of accounts
  const fetchAccounts = useCallback(async () => {
    if (!selectedProvider || selectedProvider.provider === "standalone") {
      setAccounts([]);
      setChartOfAccounts(null);
      return;
    }

    try {
      const params = new URLSearchParams({
        provider: selectedProvider.provider,
        tenant_id: selectedProvider.tenant_id,
      });

      // Get hierarchical chart
      const chartResponse = await api.get<{ success: boolean; data: ChartOfAccounts }>(`/api/v1/gl/accounts/chart?${params}`);
      if (chartResponse?.success) {
        setChartOfAccounts(chartResponse.data);
      }

      // Get flat list
      const listResponse = await api.get<{ success: boolean; data: Account[] }>(`/api/v1/gl/accounts?${params}`);
      if (listResponse?.success) {
        setAccounts(listResponse.data || []);
      }
    } catch (err) {
      console.error("Failed to fetch accounts:", err);
    }
  }, [selectedProvider]);

  // Fetch sync logs
  const fetchSyncLogs = useCallback(async () => {
    if (!selectedProvider || selectedProvider.provider === "standalone") {
      setSyncLogs([]);
      return;
    }

    try {
      const params = new URLSearchParams({
        provider: selectedProvider.provider,
        tenant_id: selectedProvider.tenant_id,
        limit: "20",
      });
      const response = await api.get<{ success: boolean; data: SyncLog[] }>(`/api/v1/gl/sync/logs?${params}`);
      if (response?.success) {
        setSyncLogs(response.data || []);
      }
    } catch (err) {
      console.error("Failed to fetch sync logs:", err);
    }
  }, [selectedProvider]);

  // Trigger sync
  const triggerSync = async (syncType: "full" | "accounts" | "incremental", provider?: Provider) => {
    const targetProvider = provider || selectedProvider;
    if (!targetProvider || targetProvider.provider === "standalone") return;

    setSyncingTenantId(targetProvider.tenant_id);
    setError(null);

    try {
      const endpoint = syncType === "full"
        ? "/api/v1/gl/sync/full"
        : syncType === "accounts"
        ? "/api/v1/gl/sync/accounts"
        : "/api/v1/gl/sync/incremental";

      const response = await api.post<{ success: boolean; error?: string }>(endpoint, {
        provider: targetProvider.provider,
        tenant_id: targetProvider.tenant_id,
        background: "false",
      });

      if (response?.success) {
        // Refresh data after sync
        await Promise.all([fetchProviders(), fetchAccounts(), fetchSyncLogs()]);
      } else {
        setError(response?.error || "Sync failed");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sync failed");
    } finally {
      setSyncingTenantId(null);
    }
  };

  // Initialize sync steps for a provider
  const initializeSyncSteps = (): SyncStep[] => {
    return SYNC_STEP_DEFINITIONS.map((def) => ({
      id: def.id,
      name: def.name,
      icon: def.icon,
      status: "pending" as SyncStepStatus,
    }));
  };

  // Update a specific sync step's status
  const updateSyncStep = (stepId: string, updates: Partial<SyncStep>) => {
    setSyncSteps((prev) =>
      prev.map((step) =>
        step.id === stepId ? { ...step, ...updates } : step
      )
    );
  };

  // Run a single sync step
  const runSyncStep = async (
    stepId: string,
    provider: Provider
  ): Promise<{ success: boolean; count?: number; error?: string }> => {
    try {
      const response = await api.post<{
        success: boolean;
        error?: string;
        data?: { synced?: number; created?: number; updated?: number };
      }>(`/api/v1/gl/sync/${stepId}`, {
        provider: provider.provider,
        tenant_id: provider.tenant_id,
        background: "false",
      });

      if (response?.success) {
        const count =
          response.data?.synced ||
          response.data?.created ||
          response.data?.updated ||
          0;
        return { success: true, count };
      } else {
        return { success: false, error: response?.error || "Sync failed" };
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Sync failed";
      // Check if it's a 404 (endpoint not implemented) - skip gracefully
      if (errorMessage.includes("404") || errorMessage.includes("Not Found")) {
        return { success: true, count: 0 }; // Skip but don't fail
      }
      return { success: false, error: errorMessage };
    }
  };

  // Full sync result state
  const [fullSyncResult, setFullSyncResult] = useState<"success" | "partial" | "failed" | null>(null);

  // Run full sync with step-by-step progress
  const runFullSync = async (provider: Provider) => {
    setFullSyncProvider(provider);
    setFullSyncRunning(true);
    setShowSyncProgress(true);
    setSyncingTenantId(provider.tenant_id);
    setFullSyncResult(null);
    setError(null);

    // Initialize all steps as pending
    const steps = initializeSyncSteps();
    setSyncSteps(steps);

    let successCount = 0;
    let failCount = 0;

    // Run each step sequentially
    for (const step of steps) {
      // Update status to running
      updateSyncStep(step.id, { status: "running" });

      // Run the sync step
      const result = await runSyncStep(step.id, provider);

      if (result.success) {
        updateSyncStep(step.id, {
          status: "completed",
          count: result.count,
        });
        successCount++;
      } else {
        updateSyncStep(step.id, {
          status: "failed",
          error: result.error,
        });
        failCount++;
        // Continue with remaining steps even if one fails
      }
    }

    // Determine overall result
    if (failCount === 0) {
      setFullSyncResult("success");
    } else if (successCount > 0) {
      setFullSyncResult("partial");
    } else {
      setFullSyncResult("failed");
    }

    // Refresh data after full sync
    await Promise.all([fetchProviders(), fetchAccounts(), fetchSyncLogs()]);

    setFullSyncRunning(false);
    setSyncingTenantId(null);
  };

  // Get status icon for sync step
  const getSyncStepIcon = (status: SyncStepStatus) => {
    switch (status) {
      case "completed":
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case "failed":
        return <XCircle className="h-5 w-5 text-red-500" />;
      case "running":
        return <RefreshCw className="h-5 w-5 text-blue-500 animate-spin" />;
      case "skipped":
        return <Clock className="h-5 w-5 text-gray-400" />;
      default:
        return <Clock className="h-5 w-5 text-gray-300" />;
    }
  };

  // Initial load
  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await fetchProviders();
      setLoading(false);
    };
    init();
  }, [fetchProviders]);

  // Load data when provider changes
  useEffect(() => {
    if (selectedProvider) {
      Promise.all([fetchAccounts(), fetchSyncLogs()]);
    }
  }, [selectedProvider, fetchAccounts, fetchSyncLogs]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "failed":
        return <XCircle className="h-4 w-4 text-red-500" />;
      case "running":
        return <RefreshCw className="h-4 w-4 text-blue-500 animate-spin" />;
      default:
        return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const getAccountTypeBadge = (type: string) => {
    const colors: Record<string, string> = {
      asset: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
      liability: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
      equity: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300",
      revenue: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
      expense: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300",
    };
    return colors[type] || "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300";
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  const xeroProviders = providers.filter((p) => p.provider === "xero");
  const connectedCount = xeroProviders.filter((p) => p.connected).length;
  const totalAccounts = xeroProviders.reduce((sum, p) => sum + (p.account_count || 0), 0);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/financial">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          {/* T.A.S. Logo Badge */}
          <div className="w-10 h-10 bg-foreground text-background flex items-center justify-center shrink-0">
            <span className="text-xl font-bold">$</span>
          </div>
          <div>
            <h1 className="text-2xl font-bold">T.A.S.</h1>
            <p className="text-muted-foreground">Teeem Accounting System</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Sync System Button - shows all company sync statuses */}
          <Button
            variant="outline"
            onClick={() => setActiveTab("companies")}
            className={activeTab === "companies" ? "bg-muted" : ""}
          >
            <Settings className="h-4 w-4 mr-2" />
            Sync System
          </Button>
          {selectedProvider && selectedProvider.connected && (
            <>
              {syncingTenantId === selectedProvider.tenant_id && <Spinner className="h-5 w-5" />}
              <Button
                variant="outline"
                onClick={() => triggerSync("accounts")}
                disabled={syncingTenantId !== null}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${syncingTenantId === selectedProvider.tenant_id ? "animate-spin" : ""}`} />
                Quick Sync
              </Button>
              <Button
                onClick={() => runFullSync(selectedProvider)}
                disabled={syncingTenantId !== null}
              >
                <Layers className={`h-4 w-4 mr-2 ${syncingTenantId === selectedProvider.tenant_id ? "animate-spin" : ""}`} />
                Full Sync
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Xero Companies
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{xeroProviders.length}</div>
            <p className="text-xs text-muted-foreground">
              {connectedCount} connected, {xeroProviders.length - connectedCount} disconnected
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              GL Accounts Synced
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalAccounts}</div>
            <p className="text-xs text-muted-foreground">
              Across all companies
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Selected Company
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Select
              value={selectedProvider?.tenant_id || ""}
              onValueChange={(value) => {
                const provider = providers.find((p) => p.tenant_id === value);
                setSelectedProvider(provider || null);
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a company" />
              </SelectTrigger>
              <SelectContent>
                {xeroProviders.map((p) => (
                  <SelectItem key={p.tenant_id} value={p.tenant_id}>
                    <div className="flex items-center gap-2">
                      {p.connected ? (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      ) : (
                        <XCircle className="h-4 w-4 text-red-500" />
                      )}
                      {p.tenant_name}
                      {p.account_count ? ` (${p.account_count})` : ""}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
      </div>

      {/* Error Display */}
      {error && (
        <Card className="border-red-200 bg-red-50 dark:bg-red-900/20">
          <CardContent className="py-4">
            <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
              <XCircle className="h-5 w-5" />
              <span>{error}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="companies" className="flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            All Companies
          </TabsTrigger>
          <TabsTrigger value="accounts" className="flex items-center gap-2">
            <BookOpen className="h-4 w-4" />
            Chart of Accounts
          </TabsTrigger>
          <TabsTrigger value="recurring" className="flex items-center gap-2">
            <Repeat className="h-4 w-4" />
            Recurring Invoices
          </TabsTrigger>
          <TabsTrigger value="summary" className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Summary
          </TabsTrigger>
          <TabsTrigger value="logs" className="flex items-center gap-2">
            <History className="h-4 w-4" />
            Sync History
          </TabsTrigger>
          <TabsTrigger value="payments" className="flex items-center gap-2">
            <Link2 className="h-4 w-4" />
            Payment Links
          </TabsTrigger>
        </TabsList>

        {/* All Companies Tab */}
        <TabsContent value="companies">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Xero Companies</span>
                <Badge variant="secondary">{xeroProviders.length} companies</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Status</TableHead>
                    <TableHead>Xero Tenant</TableHead>
                    <TableHead>TEEEM Company</TableHead>
                    <TableHead>GL Accounts</TableHead>
                    <TableHead>Last Sync</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {xeroProviders.map((provider) => (
                    <TableRow
                      key={provider.tenant_id}
                      className={selectedProvider?.tenant_id === provider.tenant_id ? "bg-muted/50" : ""}
                    >
                      <TableCell>
                        {provider.connected ? (
                          <Badge variant="outline" className="bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Connected
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                            <XCircle className="h-3 w-3 mr-1" />
                            Disconnected
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="font-medium">{provider.tenant_name}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {provider.company_name || "Not linked"}
                      </TableCell>
                      <TableCell>
                        {provider.account_count || 0} accounts
                      </TableCell>
                      <TableCell>
                        {provider.last_sync_at ? (
                          <div className="flex flex-col gap-0.5">
                            <span className="text-sm">
                              {formatTimeAgo(provider.last_sync_at)}
                            </span>
                            {provider.last_sync_status === "healthy" ? (
                              <Badge variant="outline" className="w-fit text-xs bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                                <CheckCircle className="h-2.5 w-2.5 mr-1" />
                                OK
                              </Badge>
                            ) : provider.last_sync_status === "failed" ? (
                              <Badge variant="outline" className="w-fit text-xs bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400" title={provider.last_sync_error || "Sync failed"}>
                                <XCircle className="h-2.5 w-2.5 mr-1" />
                                Failed
                              </Badge>
                            ) : null}
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-sm">Never synced</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setSelectedProvider(provider)}
                          >
                            Select
                          </Button>
                          {provider.connected && (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => triggerSync("accounts", provider)}
                                disabled={syncingTenantId !== null}
                              >
                                <RefreshCw className={`h-3 w-3 mr-1 ${syncingTenantId === provider.tenant_id ? "animate-spin" : ""}`} />
                                Quick
                              </Button>
                              <Button
                                size="sm"
                                onClick={() => runFullSync(provider)}
                                disabled={syncingTenantId !== null}
                              >
                                <Layers className={`h-3 w-3 mr-1 ${syncingTenantId === provider.tenant_id ? "animate-spin" : ""}`} />
                                Full
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Chart of Accounts Tab */}
        <TabsContent value="accounts">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>
                  Chart of Accounts
                  {selectedProvider && (
                    <span className="font-normal text-muted-foreground ml-2">
                      - {selectedProvider.tenant_name}
                    </span>
                  )}
                </span>
                <Badge variant="secondary">{accounts.length} accounts</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!selectedProvider ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Building2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p className="text-lg font-medium">Select a company</p>
                  <p className="text-sm mt-1">Choose a company from the dropdown above or the Companies tab</p>
                </div>
              ) : accounts.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <BookOpen className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p className="text-lg font-medium">No accounts synced yet</p>
                  <p className="text-sm mt-1">Click &quot;Sync Accounts&quot; to import from Xero</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Code</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Class</TableHead>
                      <TableHead>Bank</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {accounts.map((account) => (
                      <TableRow key={account.id}>
                        <TableCell className="font-mono font-medium">
                          {account.code}
                        </TableCell>
                        <TableCell>{account.name}</TableCell>
                        <TableCell>
                          <Badge className={getAccountTypeBadge(account.account_type)}>
                            {account.account_type}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {account.account_class?.replace(/_/g, " ")}
                        </TableCell>
                        <TableCell>
                          {account.is_bank_account && (
                            <Badge variant="outline">Bank</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {account.active ? (
                            <Badge variant="outline" className="text-green-600">Active</Badge>
                          ) : (
                            <Badge variant="outline" className="text-gray-400">Inactive</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Recurring Invoices Tab */}
        <TabsContent value="recurring">
          <RecurringInvoicesTab />
        </TabsContent>

        {/* Summary Tab */}
        <TabsContent value="summary">
          {!selectedProvider ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <Building2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Select a company to see summary</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              {chartOfAccounts && (
                <>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">
                        Assets
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-blue-600">
                        {chartOfAccounts.assets?.length || 0}
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">
                        Liabilities
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-red-600">
                        {chartOfAccounts.liabilities?.length || 0}
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">
                        Equity
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-purple-600">
                        {chartOfAccounts.equity?.length || 0}
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">
                        Revenue
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-green-600">
                        {chartOfAccounts.revenue?.length || 0}
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">
                        Expenses
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-orange-600">
                        {chartOfAccounts.expenses?.length || 0}
                      </div>
                    </CardContent>
                  </Card>
                </>
              )}
              {!chartOfAccounts && (
                <Card className="col-span-5">
                  <CardContent className="py-12 text-center text-muted-foreground">
                    <TrendingUp className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Sync accounts to see summary</p>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </TabsContent>

        {/* Sync History Tab */}
        <TabsContent value="logs">
          <Card>
            <CardHeader>
              <CardTitle>
                Sync History
                {selectedProvider && (
                  <span className="font-normal text-muted-foreground ml-2">
                    - {selectedProvider.tenant_name}
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!selectedProvider ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Building2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Select a company to see sync history</p>
                </div>
              ) : syncLogs.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <History className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No sync history yet</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Status</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Started</TableHead>
                      <TableHead>Duration</TableHead>
                      <TableHead>Trigger</TableHead>
                      <TableHead>Stats</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {syncLogs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {getStatusIcon(log.status)}
                            <span className="capitalize">{log.status}</span>
                          </div>
                        </TableCell>
                        <TableCell className="capitalize">{log.sync_type}</TableCell>
                        <TableCell>
                          {new Date(log.started_at).toLocaleString()}
                        </TableCell>
                        <TableCell>{log.duration || "-"}</TableCell>
                        <TableCell className="capitalize">{log.trigger}</TableCell>
                        <TableCell>
                          {log.stats && Object.keys(log.stats).length > 0 ? (
                            <div className="text-xs">
                              {Object.entries(log.stats).map(([key, value]) => (
                                <span key={key} className="mr-2">
                                  {key}: {value}
                                </span>
                              ))}
                            </div>
                          ) : (
                            "-"
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Payment Links Tab */}
        <TabsContent value="payments">
          <PaymentLinksTab />
        </TabsContent>
      </Tabs>

      {/* Full Sync Progress Modal */}
      <Dialog open={showSyncProgress} onOpenChange={(open) => {
        if (!fullSyncRunning) {
          setShowSyncProgress(open);
        }
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Layers className="h-5 w-5" />
              Full Sync
              {fullSyncProvider && (
                <Badge variant="secondary" className="ml-2">
                  {fullSyncProvider.tenant_name}
                </Badge>
              )}
            </DialogTitle>
            <DialogDescription>
              Syncing all GL data from Xero. Each entity type will be synced sequentially.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-4">
            {syncSteps.map((step) => (
              <div
                key={step.id}
                className={`flex items-center justify-between p-3 rounded-lg border ${
                  step.status === "running"
                    ? "bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800"
                    : step.status === "completed"
                    ? "bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800"
                    : step.status === "failed"
                    ? "bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800"
                    : "bg-gray-50 border-gray-200 dark:bg-gray-800/50 dark:border-gray-700"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="text-gray-500 dark:text-gray-400">
                    {step.icon}
                  </div>
                  <div>
                    <div className="font-medium text-sm">{step.name}</div>
                    {step.error && (
                      <div className="text-xs text-red-600 dark:text-red-400 mt-0.5">
                        {step.error}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {step.status === "completed" && step.count !== undefined && (
                    <Badge variant="secondary" className="text-xs">
                      {step.count}
                    </Badge>
                  )}
                  {getSyncStepIcon(step.status)}
                </div>
              </div>
            ))}
          </div>

          {/* Summary */}
          {!fullSyncRunning && syncSteps.length > 0 && (
            <div className="border-t pt-4 space-y-3">
              {/* Result Banner */}
              {fullSyncResult === "success" && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-green-50 border border-green-200 dark:bg-green-900/20 dark:border-green-800">
                  <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
                  <div>
                    <div className="font-medium text-green-700 dark:text-green-300">Sync Complete</div>
                    <div className="text-xs text-green-600 dark:text-green-400">All entities synced successfully</div>
                  </div>
                </div>
              )}
              {fullSyncResult === "partial" && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 dark:bg-amber-900/20 dark:border-amber-800">
                  <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                  <div>
                    <div className="font-medium text-amber-700 dark:text-amber-300">Partial Sync</div>
                    <div className="text-xs text-amber-600 dark:text-amber-400">Some entities failed - check errors above</div>
                  </div>
                </div>
              )}
              {fullSyncResult === "failed" && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 border border-red-200 dark:bg-red-900/20 dark:border-red-800">
                  <XCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
                  <div>
                    <div className="font-medium text-red-700 dark:text-red-300">Sync Failed</div>
                    <div className="text-xs text-red-600 dark:text-red-400">All sync attempts failed - check connection</div>
                  </div>
                </div>
              )}

              {/* Counts */}
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-4">
                  <span className="flex items-center gap-1 text-green-600">
                    <CheckCircle className="h-4 w-4" />
                    {syncSteps.filter((s) => s.status === "completed").length} completed
                  </span>
                  {syncSteps.filter((s) => s.status === "failed").length > 0 && (
                    <span className="flex items-center gap-1 text-red-600">
                      <XCircle className="h-4 w-4" />
                      {syncSteps.filter((s) => s.status === "failed").length} failed
                    </span>
                  )}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowSyncProgress(false)}
                >
                  Close
                </Button>
              </div>
            </div>
          )}

          {/* Running indicator */}
          {fullSyncRunning && (
            <div className="border-t pt-4">
              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <Spinner className="h-4 w-4" />
                Syncing... please wait
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
