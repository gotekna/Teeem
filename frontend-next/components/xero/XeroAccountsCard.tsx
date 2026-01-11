"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  RefreshCw,
  XCircle,
  Check,
  X,
  Wand2,
  AlertTriangle,
} from "lucide-react";
import { api } from "@/lib/api";
import TeeemTableView from "@/components/table/TeeemTableView";
import type { TableColumn, TableRow } from "@/components/table/types";
import { Spinner } from "@/components/ui/spinner";

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
 * XeroAccountsCard - Shows Chart of Accounts with GROUP comparison
 *
 * Features:
 * - Shows all accounts from the company's GROUP (not just this company)
 * - Dynamic company columns showing which companies have each account
 * - Highlights MISMATCHES where accounts are missing from some companies
 * - Helps identify consolidation issues (e.g., lawyer expenses on different codes)
 * - Standardize bank account names across group
 * - Sync from Xero button
 */
export function XeroAccountsCard({ companyId, companyName }: XeroAccountsCardProps) {
  const [accounts, setAccounts] = React.useState<TableRow[]>([]);
  const [companies, setCompanies] = React.useState<CompanyInfo[]>([]);
  const [foundationId, setFoundationId] = React.useState<number | null>(null);
  const [groupName, setGroupName] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [standardizing, setStandardizing] = React.useState(false);
  const [standardizeResult, setStandardizeResult] = React.useState<{
    renamed_count: number;
    skipped_count: number;
    error_count: number;
  } | null>(null);
  const [syncing, setSyncing] = React.useState(false);
  const [showMismatchesOnly, setShowMismatchesOnly] = React.useState(false);

  const loadData = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Fetch GROUP accounts with company presence data
      // This shows ALL accounts in the group with columns for each company
      const response = await api.get<{
        success: boolean;
        data: TableRow[];
        companies: CompanyInfo[];
        meta: {
          total: number;
          foundation_id: number;
          company_group: string;
        };
        error?: string;
      }>(`/api/v1/xero_chart_of_accounts/with_company_presence?company_id=${companyId}`);

      if (response?.success) {
        // Mark accounts that have mismatches (not present in ALL companies)
        const companyIds = response.companies?.map(c => c.id) || [];
        const enrichedAccounts = (response.data || []).map(account => {
          // Check if this account exists in ALL companies
          const presentInAll = companyIds.every(cId => account[`company_${cId}`] === true);
          const presentCount = companyIds.filter(cId => account[`company_${cId}`] === true).length;
          return {
            ...account,
            _has_mismatch: !presentInAll && presentCount > 0, // Exists in some but not all
            _missing_from_all: presentCount === 0, // Not in any company (orphan in master)
            _company_count: presentCount,
          };
        });

        setAccounts(enrichedAccounts);
        setCompanies(response.companies || []);
        setFoundationId(response.meta?.foundation_id || null);
        setGroupName(response.meta?.company_group || null);
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

  // Add dynamic company columns for each company in the group
  const extraColumns = React.useMemo<TableColumn[]>(() => {
    if (companies.length <= 1) return []; // No group columns needed for single company

    return companies.map(company => ({
      key: `company_${company.id}`,
      label: company.short_name || company.name.split(" ")[0],
      filterType: "boolean" as const,
      width: 80,
      sortable: true,
    }));
  }, [companies]);

  // Filter accounts if showing mismatches only
  const displayedAccounts = React.useMemo(() => {
    if (!showMismatchesOnly) return accounts;
    return accounts.filter(a => a._has_mismatch === true);
  }, [accounts, showMismatchesOnly]);

  // Count mismatches for the toggle button
  const mismatchCount = React.useMemo(() => {
    return accounts.filter(a => a._has_mismatch === true).length;
  }, [accounts]);

  // Custom cell renderer for status badges, company presence, and mismatch highlighting
  const customCellRenderer = React.useCallback(
    (entry: TableRow, columnKey: string): React.ReactNode | null => {
      // Company presence columns - show check/X with mismatch highlighting
      if (columnKey.startsWith("company_")) {
        const present = entry[columnKey] as boolean;
        const hasMismatch = entry._has_mismatch as boolean;

        if (present) {
          return <Check className="h-4 w-4 text-green-600 mx-auto" />;
        } else {
          // Highlight missing with warning if this account exists in OTHER companies (mismatch)
          return hasMismatch ? (
            <X className="h-4 w-4 text-amber-500 mx-auto" />
          ) : (
            <X className="h-4 w-4 text-muted-foreground dark:text-muted-foreground mx-auto" />
          );
        }
      }

      // Active status as colored badge
      if (columnKey === "active") {
        const active = entry[columnKey] as boolean;
        return active ? (
          <Badge variant="outline" className="bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400">
            Active
          </Badge>
        ) : (
          <Badge variant="outline" className="bg-muted text-muted-foreground dark:bg-gray-900/20 dark:text-muted-foreground">
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

      // Account name - highlight if mismatch
      if (columnKey === "account_name") {
        const name = entry[columnKey] as string;
        const hasMismatch = entry._has_mismatch as boolean;
        if (hasMismatch) {
          return (
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
              <span className="text-amber-700 dark:text-amber-400">{name}</span>
            </div>
          );
        }
        return null; // Use default rendering
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
      {/* Mismatch filter toggle */}
      {mismatchCount > 0 && (
        <Button
          variant={showMismatchesOnly ? "default" : "outline"}
          size="sm"
          onClick={() => setShowMismatchesOnly(!showMismatchesOnly)}
          className={showMismatchesOnly ? "bg-amber-600 hover:bg-amber-700" : ""}
          title="Show only accounts that are missing from some companies in the group"
        >
          <AlertTriangle className="h-4 w-4" />
          <span className="ml-2">
            {showMismatchesOnly ? `Showing ${mismatchCount} Mismatches` : `${mismatchCount} Mismatches`}
          </span>
        </Button>
      )}
      <Button
        variant="outline"
        size="sm"
        onClick={handleStandardizeNames}
        disabled={loading || standardizing}
        title="Rename bank accounts in Xero to use standardized format: BANK BSB ACCOUNT_NUMBER"
      >
        {standardizing ? <Spinner size={16} /> : <Wand2 className="h-4 w-4" />}
        <span className="ml-2">Standardize Bank Names</span>
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={handleSyncFromXero}
        disabled={loading || syncing}
        title="Sync accounts from Xero to local database"
      >
        {syncing ? <Spinner size={16} /> : <RefreshCw className="h-4 w-4" />}
        <span className="ml-2">Sync from Xero</span>
      </Button>
    </div>
  ), [loading, standardizing, syncing, mismatchCount, showMismatchesOnly]);

  if (loading && accounts.length === 0) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-2">
            <Spinner size={16} />
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
            <CardTitle className="text-lg font-medium">
              Xero Chart of Accounts
              {groupName && (
                <span className="ml-2 text-sm font-normal text-muted-foreground">
                  — {groupName} Group
                </span>
              )}
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              {displayedAccounts.length} accounts
              {showMismatchesOnly && ` (filtered from ${accounts.length})`}
              {companies.length > 1 && (
                <span className="ml-2">
                  across {companies.length} companies: {companies.map(c => c.short_name || c.name.split(" ")[0]).join(", ")}
                </span>
              )}
            </p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        {/* Mismatch summary banner */}
        {mismatchCount > 0 && !showMismatchesOnly && (
          <div className="mb-4 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              <div>
                <div className="font-medium text-amber-700 dark:text-amber-400">
                  {mismatchCount} Account{mismatchCount !== 1 ? 's' : ''} Need Attention
                </div>
                <div className="text-sm text-amber-600 dark:text-amber-500">
                  These accounts exist in some companies but not others. Click the Mismatches button to filter.
                </div>
              </div>
            </div>
          </div>
        )}

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
            entries={displayedAccounts}
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
