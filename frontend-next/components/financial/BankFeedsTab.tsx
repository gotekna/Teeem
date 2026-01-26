"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  RefreshCw,
  Landmark,
  CheckCircle,
  XCircle,
  Clock,
  Link2,
  Unlink,
  Download,
  ArrowRightLeft,
  AlertCircle,
  TrendingUp,
  Calendar,
  DollarSign,
  Building2,
  Wifi,
  WifiOff,
  ExternalLink,
  FileText,
  Settings,
  Zap,
} from "lucide-react";
import { api } from "@/lib/api";
import { formatCurrency, formatDate } from "@/utils/formatters";

// Types
interface BankAccount {
  id: number;
  code: string;
  name: string;
  description: string | null;
  account_type: string;
  account_class: string;
  is_bank_account: boolean;
  active: boolean;
  currency_code: string | null;
  external_provider: string | null;
  external_account_id: string | null;
  current_balance?: number;
}

interface Reconciliation {
  id: number;
  account: {
    id: number;
    name: string;
    code: string;
  };
  external_provider: string | null;
  statement_date: string;
  period_start: string;
  period_end: string;
  statement_opening_balance: number;
  statement_closing_balance: number;
  gl_opening_balance: number;
  gl_closing_balance: number;
  reconciled_balance: number;
  difference: number;
  status: string;
  reconciled: boolean;
  can_edit: boolean;
  completed_at: string | null;
  completed_by: string | null;
  stats: {
    matched_count: number;
    unmatched_count: number;
    adjustment_count: number;
    total_lines: number;
  };
  display_name: string;
  created_at: string;
}

interface SyncStatus {
  bank_transactions?: {
    last_sync: string | null;
    status: string;
    count: number;
  };
}

interface BasiqStatus {
  connected: boolean;
  status: string;
  institution_name?: string;
  last_sync_at?: string;
  consent_expires_at?: string;
  last_error?: string;
}

export default function BankFeedsTab() {
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState<"accounts" | "transactions" | "reconciliations">("accounts");

  // Bank accounts state
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [totalBalance, setTotalBalance] = useState<number>(0);

  // Reconciliations state
  const [reconciliations, setReconciliations] = useState<Reconciliation[]>([]);

  // Sync state
  const [syncing, setSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);

  // Action state
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Connect dialog state
  const [connectDialogOpen, setConnectDialogOpen] = useState(false);
  const [connecting, setConnecting] = useState(false);

  // Basiq state
  const [basiqStatus, setBasiqStatus] = useState<BasiqStatus | null>(null);

  // Fetch bank accounts
  const fetchBankAccounts = useCallback(async () => {
    try {
      const response = await api.get<{
        success: boolean;
        data: BankAccount[];
        meta: { total_balance: number };
      }>("/api/v1/gl/accounts/bank_accounts");

      if (response?.success) {
        setBankAccounts(response.data || []);
        setTotalBalance(response.meta?.total_balance || 0);
      }
    } catch (err) {
      console.error("Failed to fetch bank accounts:", err);
    }
  }, []);

  // Fetch reconciliations
  const fetchReconciliations = useCallback(async () => {
    try {
      const response = await api.get<{ success: boolean; data: Reconciliation[] }>(
        "/api/v1/gl/reconciliations"
      );
      if (response?.success) {
        setReconciliations(response.data || []);
      }
    } catch (err) {
      console.error("Failed to fetch reconciliations:", err);
    }
  }, []);

  // Fetch sync status
  const fetchSyncStatus = useCallback(async () => {
    try {
      const response = await api.get<{ success: boolean; data: SyncStatus }>(
        "/api/v1/gl/sync/status"
      );
      if (response?.success) {
        setSyncStatus(response.data);
      }
    } catch (err) {
      console.error("Failed to fetch sync status:", err);
    }
  }, []);

  // Fetch Basiq status
  const fetchBasiqStatus = useCallback(async () => {
    try {
      const response = await api.get<{ success: boolean; data: BasiqStatus }>(
        "/api/v1/basiq/status"
      );
      if (response?.success) {
        setBasiqStatus(response.data);
      }
    } catch (err) {
      console.error("Failed to fetch Basiq status:", err);
    }
  }, []);

  // Connect to bank via Basiq
  const connectBank = async () => {
    setConnecting(true);
    setError(null);
    try {
      const response = await api.post<{
        success: boolean;
        data: { consent_url: string; consent_id: string };
        error?: string;
      }>("/api/v1/basiq/connect", {});

      if (response?.success && response.data?.consent_url) {
        // Redirect to Basiq consent UI
        window.location.href = response.data.consent_url;
      } else {
        setError(response?.error || "Failed to initiate bank connection");
        setConnecting(false);
      }
    } catch (err) {
      setError("Failed to connect to bank");
      setConnecting(false);
    }
  };

  // Disconnect bank
  const disconnectBank = async () => {
    if (!confirm("Are you sure you want to disconnect the bank feed?")) return;

    try {
      const response = await api.post<{ success: boolean; error?: string }>(
        "/api/v1/basiq/disconnect",
        {}
      );
      if (response?.success) {
        setSuccessMessage("Bank feed disconnected");
        fetchBasiqStatus();
      } else {
        setError(response?.error || "Failed to disconnect");
      }
    } catch (err) {
      setError("Failed to disconnect bank feed");
    }
  };

  // Sync bank transactions
  const syncBankTransactions = async () => {
    setSyncing(true);
    setError(null);
    try {
      const response = await api.post<{ success: boolean; message: string }>(
        "/api/v1/gl/sync/bank_transactions",
        { background: "false" }
      );
      if (response?.success) {
        setSuccessMessage("Bank transactions synced successfully");
        await Promise.all([fetchBankAccounts(), fetchReconciliations(), fetchSyncStatus()]);
      }
    } catch (err) {
      setError("Failed to sync bank transactions");
    } finally {
      setSyncing(false);
    }
  };

  // Initial load
  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await Promise.all([fetchBankAccounts(), fetchReconciliations(), fetchSyncStatus(), fetchBasiqStatus()]);
      setLoading(false);
    };
    init();
  }, [fetchBankAccounts, fetchReconciliations, fetchSyncStatus, fetchBasiqStatus]);

  // Clear messages
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  // Format time ago
  const formatTimeAgo = (dateString: string | null) => {
    if (!dateString) return "Never";
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
    return formatDate(dateString);
  };

  // Get connection status badge
  const getConnectionBadge = (account: BankAccount) => {
    if (account.external_provider) {
      return (
        <Badge className="bg-status-success text-status-success-foreground dark:bg-green-900/30 dark:text-green-400">
          <Wifi className="h-3 w-3 mr-1" />
          Connected
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="text-muted-foreground">
        <WifiOff className="h-3 w-3 mr-1" />
        Manual
      </Badge>
    );
  };

  // Get reconciliation status badge
  const getReconciliationBadge = (recon: Reconciliation) => {
    if (recon.reconciled) {
      return (
        <Badge className="bg-status-success text-status-success-foreground dark:bg-green-900/30 dark:text-green-400">
          <CheckCircle className="h-3 w-3 mr-1" />
          Reconciled
        </Badge>
      );
    }
    if (recon.status === "in_progress") {
      return (
        <Badge className="bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 dark:bg-blue-900/30 dark:text-blue-400">
          <Clock className="h-3 w-3 mr-1" />
          In Progress
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="text-amber-600 dark:text-amber-400">
        <AlertCircle className="h-3 w-3 mr-1" />
        {recon.status}
      </Badge>
    );
  };

  // Calculate stats
  const stats = {
    totalAccounts: bankAccounts.length,
    connectedAccounts: bankAccounts.filter((a) => a.external_provider).length,
    activeReconciliations: reconciliations.filter((r) => !r.reconciled).length,
    completedReconciliations: reconciliations.filter((r) => r.reconciled).length,
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Messages */}
      {successMessage && (
        <div className="p-3 rounded-lg bg-green-50 border border-green-200 dark:bg-green-900/20 dark:border-green-800">
          <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
            <CheckCircle className="h-4 w-4" />
            <span className="text-sm font-medium">{successMessage}</span>
          </div>
        </div>
      )}

      {error && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 dark:bg-red-900/20 dark:border-red-800">
          <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
            <XCircle className="h-4 w-4" />
            <span className="text-sm">{error}</span>
          </div>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Landmark className="h-4 w-4" />
              Bank Accounts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalAccounts}</div>
            <p className="text-xs text-muted-foreground">
              {stats.connectedAccounts} connected to feeds
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Total Balance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${totalBalance >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
              {formatCurrency(totalBalance)}
            </div>
            <p className="text-xs text-muted-foreground">Across all accounts</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <ArrowRightLeft className="h-4 w-4" />
              Reconciliations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.activeReconciliations}</div>
            <p className="text-xs text-muted-foreground">
              {stats.completedReconciliations} completed
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Download className="h-4 w-4" />
              Last Sync
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-semibold">
              {formatTimeAgo(syncStatus?.bank_transactions?.last_sync || null)}
            </div>
            <p className="text-xs text-muted-foreground">
              {syncStatus?.bank_transactions?.count || 0} transactions
            </p>
          </CardContent>
        </Card>
      </div>

      {/* View Tabs */}
      <Tabs value={activeView} onValueChange={(v) => setActiveView(v as typeof activeView)}>
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="accounts" className="flex items-center gap-2">
              <Landmark className="h-4 w-4" />
              Bank Accounts
            </TabsTrigger>
            <TabsTrigger value="reconciliations" className="flex items-center gap-2">
              <ArrowRightLeft className="h-4 w-4" />
              Reconciliations
            </TabsTrigger>
          </TabsList>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={syncBankTransactions}
              disabled={syncing}
            >
              {syncing ? (
                <Spinner className="h-4 w-4 mr-2" />
              ) : (
                <Download className="h-4 w-4 mr-2" />
              )}
              Sync Transactions
            </Button>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button onClick={() => setConnectDialogOpen(true)}>
                    <Link2 className="h-4 w-4 mr-2" />
                    Connect Bank
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Connect a new bank feed via Open Banking</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>

        {/* Bank Accounts View */}
        <TabsContent value="accounts">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Landmark className="h-5 w-5" />
                  Bank Accounts
                </span>
                <Button variant="outline" size="sm" onClick={fetchBankAccounts}>
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {bankAccounts.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Landmark className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p className="text-lg font-medium">No bank accounts found</p>
                  <p className="text-sm mt-1">Sync your chart of accounts to see bank accounts</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Code</TableHead>
                      <TableHead>Account Name</TableHead>
                      <TableHead>Feed Status</TableHead>
                      <TableHead>Provider</TableHead>
                      <TableHead className="text-right">Balance</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bankAccounts.map((account) => (
                      <TableRow key={account.id}>
                        <TableCell className="font-mono font-medium">
                          {account.code}
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">{account.name}</div>
                          {account.description && (
                            <div className="text-xs text-muted-foreground truncate max-w-48">
                              {account.description}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>{getConnectionBadge(account)}</TableCell>
                        <TableCell>
                          {account.external_provider ? (
                            <Badge variant="outline" className="capitalize">
                              {account.external_provider}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <span
                            className={`font-semibold ${
                              (account.current_balance || 0) >= 0
                                ? "text-green-600 dark:text-green-400"
                                : "text-red-600 dark:text-red-400"
                            }`}
                          >
                            {formatCurrency(account.current_balance || 0)}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            {account.external_provider ? (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button variant="outline" size="sm">
                                      <Settings className="h-4 w-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>Manage feed settings</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            ) : (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setConnectDialogOpen(true)}
                              >
                                <Link2 className="h-4 w-4 mr-1" />
                                Connect
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Reconciliations View */}
        <TabsContent value="reconciliations">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <ArrowRightLeft className="h-5 w-5" />
                  Bank Reconciliations
                </span>
                <Button variant="outline" size="sm" onClick={fetchReconciliations}>
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {reconciliations.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <ArrowRightLeft className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p className="text-lg font-medium">No reconciliations yet</p>
                  <p className="text-sm mt-1">Start a reconciliation from a bank account</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Account</TableHead>
                      <TableHead>Period</TableHead>
                      <TableHead className="text-right">Statement Balance</TableHead>
                      <TableHead className="text-right">GL Balance</TableHead>
                      <TableHead className="text-right">Difference</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Progress</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reconciliations.map((recon) => (
                      <TableRow key={recon.id}>
                        <TableCell>
                          <div className="font-medium">{recon.account.name}</div>
                          <div className="text-xs text-muted-foreground font-mono">
                            {recon.account.code}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3 w-3 text-muted-foreground" />
                            {formatDate(recon.statement_date)}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {formatDate(recon.period_start)} - {formatDate(recon.period_end)}
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(recon.statement_closing_balance)}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(recon.gl_closing_balance)}
                        </TableCell>
                        <TableCell className="text-right">
                          <span
                            className={`font-semibold ${
                              Math.abs(recon.difference) < 0.01
                                ? "text-green-600 dark:text-green-400"
                                : "text-red-600 dark:text-red-400"
                            }`}
                          >
                            {formatCurrency(recon.difference)}
                          </span>
                        </TableCell>
                        <TableCell>{getReconciliationBadge(recon)}</TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <span className="text-green-600 dark:text-green-400">
                              {recon.stats.matched_count}
                            </span>
                            <span className="text-muted-foreground"> / </span>
                            <span>{recon.stats.total_lines}</span>
                            <span className="text-muted-foreground text-xs ml-1">matched</span>
                          </div>
                          {recon.stats.unmatched_count > 0 && (
                            <div className="text-xs text-amber-600 dark:text-amber-400">
                              {recon.stats.unmatched_count} unmatched
                            </div>
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
      </Tabs>

      {/* Connect Bank Dialog */}
      <Dialog open={connectDialogOpen} onOpenChange={setConnectDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Link2 className="h-5 w-5" />
              {basiqStatus?.connected ? "Bank Feed Connected" : "Connect Bank Feed"}
            </DialogTitle>
            <DialogDescription>
              {basiqStatus?.connected
                ? `Connected to ${basiqStatus.institution_name || "your bank"} via Open Banking.`
                : "Connect your bank account via Open Banking to automatically import transactions."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {basiqStatus?.connected ? (
              /* Connected State */
              <Card className="border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-900/20">
                <CardContent className="pt-6">
                  <div className="text-center space-y-4">
                    <div className="w-16 h-16 mx-auto rounded-full bg-green-100 dark:bg-green-900/40 flex items-center justify-center">
                      <CheckCircle className="h-8 w-8 text-green-600 dark:text-green-400" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-green-700 dark:text-green-300">
                        {basiqStatus.institution_name || "Bank Connected"}
                      </h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        Transactions are being synced automatically
                      </p>
                    </div>
                    {basiqStatus.last_sync_at && (
                      <p className="text-xs text-muted-foreground">
                        Last synced: {formatTimeAgo(basiqStatus.last_sync_at)}
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            ) : (
              /* Not Connected State */
              <>
                <Card className="border-dashed">
                  <CardContent className="pt-6">
                    <div className="text-center space-y-4">
                      <div className="w-16 h-16 mx-auto rounded-full bg-muted flex items-center justify-center">
                        <Landmark className="h-8 w-8 text-muted-foreground" />
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold">Open Banking Integration</h3>
                        <p className="text-sm text-muted-foreground mt-1">
                          Connect to 120+ Australian banks via CDR/Open Banking
                        </p>
                      </div>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div className="p-3 rounded-lg bg-muted/50">
                          <Zap className="h-4 w-4 mx-auto mb-1 text-amber-500" />
                          <p className="font-medium">Real-time</p>
                          <p className="text-xs text-muted-foreground">Live transaction sync</p>
                        </div>
                        <div className="p-3 rounded-lg bg-muted/50">
                          <CheckCircle className="h-4 w-4 mx-auto mb-1 text-green-500 dark:text-green-400" />
                          <p className="font-medium">Secure</p>
                          <p className="text-xs text-muted-foreground">Bank-grade security</p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {basiqStatus?.status === "pending" && (
                  <div className="p-4 rounded-lg bg-amber-50 border border-amber-200 dark:bg-amber-900/20 dark:border-amber-800">
                    <div className="flex items-start gap-3">
                      <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                      <div className="text-sm">
                        <p className="font-medium text-amber-700 dark:text-amber-300">Connection Pending</p>
                        <p className="text-amber-600 dark:text-amber-400 mt-1">
                          Complete the bank authentication to finish connecting.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {basiqStatus?.last_error && (
                  <div className="p-4 rounded-lg bg-red-50 border border-red-200 dark:bg-red-900/20 dark:border-red-800">
                    <div className="flex items-start gap-3">
                      <XCircle className="h-5 w-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                      <div className="text-sm">
                        <p className="font-medium text-red-700 dark:text-red-300">Connection Error</p>
                        <p className="text-red-600 dark:text-red-400 mt-1">
                          {basiqStatus.last_error}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setConnectDialogOpen(false)}>
              Close
            </Button>
            {basiqStatus?.connected ? (
              <Button variant="destructive" onClick={disconnectBank}>
                <Unlink className="h-4 w-4 mr-2" />
                Disconnect
              </Button>
            ) : (
              <Button onClick={connectBank} disabled={connecting}>
                {connecting ? (
                  <>
                    <Spinner className="h-4 w-4 mr-2" />
                    Connecting...
                  </>
                ) : (
                  <>
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Connect Bank
                  </>
                )}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
