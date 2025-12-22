"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  RefreshCw,
  XCircle,
  Check,
  X,
  Wand2,
} from "lucide-react";
import { api } from "@/lib/api";
import TeeemTableView from "@/components/table/TeeemTableView";
import type { TableColumn, TableRow } from "@/components/table/types";

interface CompanyInfo {
  id: number;
  name: string;
  short_name: string;
}

interface XeroAccountsCardProps {
  companyId: string;
  companyName?: string;
}

/**
 * XeroAccountsCard - Shows Chart of Accounts with TeeemTableView (Foundation-backed)
 *
 * Features:
 * - Full TeeemTableView with saved views, filters, column visibility
 * - Dynamic company columns showing which companies have each account
 * - Standardize bank account names across group
 * - Sync from Xero button
 */
export function XeroAccountsCard({ companyId, companyName }: XeroAccountsCardProps) {
  const [accounts, setAccounts] = React.useState<TableRow[]>([]);
  const [companies, setCompanies] = React.useState<CompanyInfo[]>([]);
  const [foundationId, setFoundationId] = React.useState<number | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [standardizing, setStandardizing] = React.useState(false);
  const [standardizeResult, setStandardizeResult] = React.useState<{
    renamed_count: number;
    skipped_count: number;
    error_count: number;
  } | null>(null);
  const [syncing, setSyncing] = React.useState(false);

  const loadData = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Fetch per-company accounts with consolidated_account_code
      const response = await api.get<{
        success: boolean;
        data: TableRow[];
        meta: {
          foundation_id: number;
          company_name: string;
          xero_tenant_name: string;
          mapped_count: number;
          unmapped_count: number;
        };
        error?: string;
      }>(`/api/v1/xero_chart_of_accounts/company_accounts?company_id=${companyId}`);

      if (response?.success) {
        setAccounts(response.data || []);
        // Set companies from the single company (for UI compatibility)
        setCompanies([{
          id: Number(companyId),
          name: response.meta?.company_name || '',
          short_name: response.meta?.xero_tenant_name || ''
        }]);
        setFoundationId(response.meta?.foundation_id || null);
      } else {
        setError(response?.error || "Failed to load accounts");
      }
    } catch (err: any) {
      // Extract the actual error message from the API response
      const errorMessage = err?.data?.error || err?.message || "Failed to load accounts";
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  // Sync accounts from Xero to Foundation table
  const handleSyncFromXero = async () => {
    setSyncing(true);
    setError(null);

    try {
      // Get the tenant_id for this company
      const companyResponse = await api.get<{
        success: boolean;
        connection?: { xero_tenant_id: string };
      }>(`/api/v1/companies/${companyId}/xero/connection`);

      if (companyResponse?.success && companyResponse.connection?.xero_tenant_id) {
        // Sync from Xero - populates both XeroChartOfAccount (master) and CorporateCompanyXeroAccount (per-company)
        await api.post(`/api/v1/xero_chart_of_accounts/sync_from_xero`, {
          tenant_id: companyResponse.connection.xero_tenant_id,
          company_id: companyId,
          company_group_id: null,
        });
      }

      // Reload data after sync
      await loadData();
    } catch (err: any) {
      setError(err?.data?.error || err?.message || "Failed to sync from Xero");
    } finally {
      setSyncing(false);
    }
  };

  // Standardize bank account names across all companies in the group
  const handleStandardizeNames = async () => {
    if (!confirm("This will rename all bank accounts in Xero to use the format: BANK BSB ACCOUNT_NUMBER (e.g., NAB 123-456 12345678). Continue?")) {
      return;
    }

    setStandardizing(true);
    setStandardizeResult(null);
    setError(null);

    try {
      let totalRenamed = 0;
      let totalSkipped = 0;
      let totalErrors = 0;

      for (const company of companies) {
        const response = await api.post<{
          success: boolean;
          renamed_count: number;
          skipped_count: number;
          error_count: number;
          error?: string;
        }>(`/api/v1/companies/${company.id}/xero/accounts/standardize_names`, {});

        if (response?.success) {
          totalRenamed += response.renamed_count;
          totalSkipped += response.skipped_count;
          totalErrors += response.error_count;
        }
      }

      setStandardizeResult({
        renamed_count: totalRenamed,
        skipped_count: totalSkipped,
        error_count: totalErrors,
      });

      // Reload data after standardization
      await loadData();
    } catch (err: any) {
      setError(err?.data?.error || err?.message || "Failed to standardize names");
    } finally {
      setStandardizing(false);
    }
  };

  // No extra columns needed - Foundation has all columns including consolidated_account_code
  const extraColumns = React.useMemo<TableColumn[]>(() => [], []);

  // Custom cell renderer for status badges and mapped indicator
  const customCellRenderer = React.useCallback(
    (entry: TableRow, columnKey: string): React.ReactNode | null => {
      // Active status as colored badge
      if (columnKey === "active") {
        const active = entry[columnKey] as boolean;
        return active ? (
          <Badge variant="outline" className="bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400">
            Active
          </Badge>
        ) : (
          <Badge variant="outline" className="bg-gray-50 text-gray-500 dark:bg-gray-900/20 dark:text-gray-400">
            Inactive
          </Badge>
        );
      }

      // Account type as badge
      if (columnKey === "account_type") {
        const type = entry[columnKey] as string;
        if (!type) return null;
        return <Badge variant="outline">{type}</Badge>;
      }

      // Mapped status - show check/X
      if (columnKey === "mapped") {
        const mapped = entry[columnKey] as boolean;
        return mapped ? (
          <Check className="h-4 w-4 text-green-600 mx-auto" />
        ) : (
          <X className="h-4 w-4 text-red-400 mx-auto" />
        );
      }

      // Consolidated account code - highlight if set
      if (columnKey === "consolidated_account_code") {
        const code = entry[columnKey] as string;
        if (!code) return <span className="text-muted-foreground">—</span>;
        return (
          <Badge variant="secondary" className="font-mono">
            {code}
          </Badge>
        );
      }

      return null; // Use default rendering
    },
    []
  );

  // Left actions for the table header
  const leftActions = React.useMemo(() => (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={handleStandardizeNames}
        disabled={loading || standardizing}
        title="Rename bank accounts in Xero to use standardized format: BANK BSB ACCOUNT_NUMBER"
      >
        {standardizing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
        <span className="ml-2">Standardize Bank Names</span>
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={handleSyncFromXero}
        disabled={loading || syncing}
        title="Sync accounts from Xero to local database"
      >
        {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
        <span className="ml-2">Sync from Xero</span>
      </Button>
    </div>
  ), [loading, standardizing, syncing]);

  if (loading && accounts.length === 0) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Loading Xero accounts...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error && accounts.length === 0) {
    const isNoConnection = error.toLowerCase().includes("no xero connection");
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-muted-foreground">
            <XCircle className={`h-8 w-8 mx-auto mb-2 ${isNoConnection ? "text-amber-500" : "text-red-500"}`} />
            <p className="font-medium">{isNoConnection ? "Xero Not Connected" : error}</p>
            {isNoConnection && (
              <p className="text-sm mt-2">
                This company doesn&apos;t have a Xero connection yet.<br />
                Go to the <strong>Connection</strong> tab to connect Xero.
              </p>
            )}
            <Button variant="outline" size="sm" className="mt-4" onClick={loadData}>
              Try Again
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg font-medium">Xero Chart of Accounts</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              {accounts.length} accounts from {companyName || "this company"}
              {companies.length > 0 && (
                <span className="ml-2 text-xs text-blue-600">
                  ({companies.length} {companies.length === 1 ? "company" : "companies"} in group)
                </span>
              )}
            </p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        {/* Standardize Result */}
        {standardizeResult && (
          <div className="mb-4 p-3 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
            <div className="font-medium text-green-700 dark:text-green-400">
              Bank Account Names Standardized
            </div>
            <div className="text-sm text-green-600 dark:text-green-500">
              {standardizeResult.renamed_count} accounts renamed
              {standardizeResult.skipped_count > 0 && `, ${standardizeResult.skipped_count} skipped`}
              {standardizeResult.error_count > 0 && `, ${standardizeResult.error_count} errors`}
            </div>
          </div>
        )}

        {/* TeeemTableView with Foundation */}
        <div className="-mx-6">
          <TeeemTableView
            entries={accounts}
            foundationIdNumeric={foundationId}
            tableName="Xero Accounts"
            onRefresh={loadData}
            leftActions={leftActions}
            extraColumns={extraColumns}
            customCellRenderer={customCellRenderer}
            enableExport={true}
            viewOnly={true}
          />
        </div>
      </CardContent>
    </Card>
  );
}

export default XeroAccountsCard;
