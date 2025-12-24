"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import {
  FileText,
  Receipt,
  Users,
  Building2,
  PieChart,
  BarChart3,
  Lock,
  CheckCircle,
  AlertTriangle,
  XCircle,
  RefreshCw,
  Calendar,
  Clock,
} from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { format, formatDistanceToNow } from "date-fns";

interface XeroHealthData {
  organisation: {
    name: string | null;
    locked_date: string | null;
    period_lock_date?: string | null;
    financial_year_end_day: number | null;
    financial_year_end_month: number | null;
    base_currency: string | null;
  };
  connection: {
    status: string;
    tenant_name: string;
    last_sync_at: string | null;
    api_calls_today: string | null;
  };
  invoices: {
    total: number;
    with_pdfs: number;
    missing_pdfs: number;
    by_status: Record<string, number>;
    last_synced: string | null;
  };
  bills: {
    total: number;
    with_pdfs: number;
    missing_pdfs: number;
    by_status: Record<string, number>;
    last_synced: string | null;
  };
  credit_notes: {
    total: number;
  };
  contacts: {
    linked: number;
    with_errors: number;
    last_synced: string | null;
  };
  bank: {
    accounts: number;
    statements_completed: number;
    statements_pending: number;
    statements_failed: number;
    documents_generated: number;
  };
  profit_loss: {
    months_available: number;
    date_range: { from: string; to: string } | null;
    last_synced: string | null;
  };
  balance_sheet: {
    reports_count: number;
    last_synced: string | null;
  };
  end_of_month: {
    current_month: string;
    last_month: string;
    last_month_closed: boolean;
  };
}

interface XeroHealthDashboardProps {
  companyId: string;
}

/**
 * XeroHealthDashboard - Comprehensive sync status and health metrics
 *
 * Shows:
 * - Organisation locked date from Xero
 * - Sync status for each data type
 * - Document generation progress
 * - End of month closure status
 */
export function XeroHealthDashboard({ companyId }: XeroHealthDashboardProps) {
  const [health, setHealth] = React.useState<XeroHealthData | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const loadHealth = React.useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get<{ success: boolean; health: XeroHealthData; error?: string }>(
        `/api/v1/companies/${companyId}/xero/health`
      );
      if (response.success && response.health) {
        setHealth(response.health);
      } else {
        setError(response.error || "Failed to load health data");
      }
    } catch (err) {
      console.error("Failed to load Xero health:", err);
      setError("Failed to load health data");
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  React.useEffect(() => {
    loadHealth();
  }, [loadHealth]);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Spinner className="h-6 w-6" />
        <span className="ml-2 text-muted-foreground">Loading health data...</span>
      </div>
    );
  }

  if (error || !health) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center">
        <AlertTriangle className="h-8 w-8 text-amber-500 mb-2" />
        <p className="text-muted-foreground">{error || "No health data available"}</p>
        <Button variant="outline" size="sm" className="mt-4" onClick={loadHealth}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Retry
        </Button>
      </div>
    );
  }

  const formatSyncTime = (dateStr: string | null) => {
    if (!dateStr) return "Never";
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return "Unknown";
      return formatDistanceToNow(date, { addSuffix: true });
    } catch {
      return "Unknown";
    }
  };

  const formatDate = (dateStr: string | null, formatStr: string = "d MMMM yyyy") => {
    if (!dateStr) return null;
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return null;
      return format(date, formatStr);
    } catch {
      return null;
    }
  };

  const getStatusBadge = (hasErrors: boolean, total: number) => {
    if (hasErrors) {
      return <Badge variant="destructive" className="ml-2">Issues</Badge>;
    }
    if (total > 0) {
      return <Badge className="ml-2 bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">OK</Badge>;
    }
    return null;
  };

  return (
    <div className="space-y-6">
      {/* Locked Dates Banner */}
      {(health.organisation.locked_date || health.organisation.period_lock_date) && (
        <Card className="border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950/30">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/50 rounded-lg shrink-0">
                <Lock className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="space-y-1">
                {health.organisation.locked_date !== health.organisation.period_lock_date &&
                 health.organisation.period_lock_date && formatDate(health.organisation.period_lock_date) &&
                 health.organisation.locked_date && formatDate(health.organisation.locked_date) ? (
                  <>
                    <p className="font-medium text-blue-900 dark:text-blue-100">
                      Locked (except advisers): {formatDate(health.organisation.period_lock_date)}
                    </p>
                    <p className="font-medium text-blue-900 dark:text-blue-100">
                      Fully Locked: {formatDate(health.organisation.locked_date)}
                    </p>
                  </>
                ) : (
                  <p className="font-medium text-blue-900 dark:text-blue-100">
                    Fully Locked: {formatDate(health.organisation.locked_date) || formatDate(health.organisation.period_lock_date ?? null)}
                  </p>
                )}
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  Transactions up to {health.organisation.locked_date !== health.organisation.period_lock_date ? 'these dates' : 'this date'} cannot be modified in Xero
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* End of Month Status */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            End of Month Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Current Period</p>
              <p className="font-medium">{health.end_of_month.current_month}</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-muted-foreground">Last Month ({health.end_of_month.last_month})</p>
              <div className="flex items-center gap-2 justify-end">
                {health.end_of_month.last_month_closed ? (
                  <>
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <span className="text-green-600 font-medium">Closed</span>
                  </>
                ) : (
                  <>
                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                    <span className="text-amber-600 font-medium">Open</span>
                  </>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {/* Invoices */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <FileText className="h-4 w-4 text-blue-600" />
              <span className="font-medium text-sm">Invoices</span>
              {getStatusBadge(health.invoices.missing_pdfs > 0, health.invoices.total)}
            </div>
            <div className="text-3xl font-bold">{health.invoices.total}</div>
            <div className="mt-2 space-y-1 text-xs text-muted-foreground">
              <div className="flex justify-between">
                <span>With PDFs:</span>
                <span className="font-medium text-foreground">{health.invoices.with_pdfs}</span>
              </div>
              {health.invoices.missing_pdfs > 0 && (
                <div className="flex justify-between text-amber-600">
                  <span>Missing PDFs:</span>
                  <span className="font-medium">{health.invoices.missing_pdfs}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span>Synced:</span>
                <span>{formatSyncTime(health.invoices.last_synced)}</span>
              </div>
            </div>
            {/* Status breakdown */}
            {Object.keys(health.invoices.by_status).length > 0 && (
              <div className="mt-3 pt-3 border-t flex flex-wrap gap-1">
                {Object.entries(health.invoices.by_status).map(([status, count]) => (
                  <Badge key={status} variant="secondary" className="text-xs">
                    {status}: {count}
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Bills */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Receipt className="h-4 w-4 text-purple-600" />
              <span className="font-medium text-sm">Bills</span>
              {getStatusBadge(health.bills.missing_pdfs > 0, health.bills.total)}
            </div>
            <div className="text-3xl font-bold">{health.bills.total}</div>
            <div className="mt-2 space-y-1 text-xs text-muted-foreground">
              <div className="flex justify-between">
                <span>With PDFs:</span>
                <span className="font-medium text-foreground">{health.bills.with_pdfs}</span>
              </div>
              {health.bills.missing_pdfs > 0 && (
                <div className="flex justify-between text-amber-600">
                  <span>Missing PDFs:</span>
                  <span className="font-medium">{health.bills.missing_pdfs}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span>Synced:</span>
                <span>{formatSyncTime(health.bills.last_synced)}</span>
              </div>
            </div>
            {Object.keys(health.bills.by_status).length > 0 && (
              <div className="mt-3 pt-3 border-t flex flex-wrap gap-1">
                {Object.entries(health.bills.by_status).map(([status, count]) => (
                  <Badge key={status} variant="secondary" className="text-xs">
                    {status}: {count}
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Contacts */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Users className="h-4 w-4 text-green-600" />
              <span className="font-medium text-sm">Contacts</span>
              {getStatusBadge(health.contacts.with_errors > 0, health.contacts.linked)}
            </div>
            <div className="text-3xl font-bold">{health.contacts.linked}</div>
            <div className="mt-2 space-y-1 text-xs text-muted-foreground">
              <div className="flex justify-between">
                <span>Linked to Xero:</span>
                <span className="font-medium text-foreground">{health.contacts.linked}</span>
              </div>
              {health.contacts.with_errors > 0 && (
                <div className="flex justify-between text-red-600">
                  <span>With Errors:</span>
                  <span className="font-medium">{health.contacts.with_errors}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span>Synced:</span>
                <span>{formatSyncTime(health.contacts.last_synced)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Bank */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Building2 className="h-4 w-4 text-teal-600" />
              <span className="font-medium text-sm">Bank</span>
              {getStatusBadge(health.bank.statements_failed > 0, health.bank.accounts)}
            </div>
            <div className="text-3xl font-bold">{health.bank.accounts}</div>
            <div className="mt-2 space-y-1 text-xs text-muted-foreground">
              <div className="flex justify-between">
                <span>Accounts:</span>
                <span className="font-medium text-foreground">{health.bank.accounts}</span>
              </div>
              <div className="flex justify-between">
                <span>Statements:</span>
                <span className="font-medium text-foreground">{health.bank.statements_completed}</span>
              </div>
              {health.bank.statements_pending > 0 && (
                <div className="flex justify-between text-amber-600">
                  <span>Pending:</span>
                  <span className="font-medium">{health.bank.statements_pending}</span>
                </div>
              )}
              {health.bank.statements_failed > 0 && (
                <div className="flex justify-between text-red-600">
                  <span>Failed:</span>
                  <span className="font-medium">{health.bank.statements_failed}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span>Documents:</span>
                <span className="font-medium text-foreground">{health.bank.documents_generated}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* P&L */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <PieChart className="h-4 w-4 text-orange-600" />
              <span className="font-medium text-sm">Profit & Loss</span>
              {health.profit_loss.months_available > 0 && (
                <Badge className="ml-2 bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">OK</Badge>
              )}
            </div>
            <div className="text-3xl font-bold">{health.profit_loss.months_available}</div>
            <div className="text-xs text-muted-foreground">months</div>
            <div className="mt-2 space-y-1 text-xs text-muted-foreground">
              {health.profit_loss.date_range && (
                <div className="flex justify-between">
                  <span>Range:</span>
                  <span className="font-medium text-foreground">
                    {health.profit_loss.date_range.from} - {health.profit_loss.date_range.to}
                  </span>
                </div>
              )}
              <div className="flex justify-between">
                <span>Synced:</span>
                <span>{formatSyncTime(health.profit_loss.last_synced)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Balance Sheet */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <BarChart3 className="h-4 w-4 text-indigo-600" />
              <span className="font-medium text-sm">Balance Sheet</span>
              {health.balance_sheet.reports_count > 0 && (
                <Badge className="ml-2 bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">OK</Badge>
              )}
            </div>
            <div className="text-3xl font-bold">{health.balance_sheet.reports_count}</div>
            <div className="text-xs text-muted-foreground">reports</div>
            <div className="mt-2 space-y-1 text-xs text-muted-foreground">
              <div className="flex justify-between">
                <span>Generated:</span>
                <span>{formatSyncTime(health.balance_sheet.last_synced)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Refresh button */}
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={loadHealth}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh Health Data
        </Button>
      </div>
    </div>
  );
}

export default XeroHealthDashboard;
