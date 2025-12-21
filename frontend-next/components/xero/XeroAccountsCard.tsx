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
import type { XeroAccount } from "./types";

interface CompanyComparison {
  company_id: number;
  company_name: string;
  name: string;
  status: string;
}

interface GroupCompanyInfo {
  company_id: number;
  company_name: string;
  xero_tenant: string;
  accounts: Array<{ code: string; name: string; type: string; status: string }>;
}

interface AccountComparison {
  code: string;
  name: string;
  type: string;
  company_count: number;
  all_companies: boolean;
  names_match: boolean;
  companies: CompanyComparison[];
}

interface XeroAccountsCardProps {
  companyId: string;
  companyName?: string;
}

/**
 * XeroAccountsCard - Shows Chart of Accounts from Xero with group comparison
 *
 * Features:
 * - Load and display all accounts from Xero
 * - Filter by account type and search by code/name (via TeeemTableView)
 * - Compare accounts across consolidated group companies
 * - Highlight missing accounts with check/X icons per company
 * - Standardize bank account names across all group companies
 */
export function XeroAccountsCard({ companyId, companyName }: XeroAccountsCardProps) {
  const [accounts, setAccounts] = React.useState<XeroAccount[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [comparison, setComparison] = React.useState<AccountComparison[]>([]);
  const [comparisonLoading, setComparisonLoading] = React.useState(false);
  const [groupCompanies, setGroupCompanies] = React.useState<GroupCompanyInfo[]>([]);
  const [standardizing, setStandardizing] = React.useState(false);
  const [standardizeResult, setStandardizeResult] = React.useState<{
    renamed_count: number;
    skipped_count: number;
    error_count: number;
  } | null>(null);

  const loadAccounts = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get<{
        success: boolean;
        accounts: XeroAccount[];
        summary: { total: number; by_type: Record<string, number> };
        error?: string;
      }>(`/api/v1/companies/${companyId}/xero/accounts`);

      if (response?.success) {
        setAccounts(response.accounts);
      } else {
        setError(response?.error || "Failed to load accounts");
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const loadComparison = async () => {
    try {
      setComparisonLoading(true);
      const response = await api.get<{
        success: boolean;
        companies: GroupCompanyInfo[];
        comparison: AccountComparison[];
        summary: {
          total_unique_accounts: number;
          accounts_in_all: number;
          accounts_with_differences: number;
          missing_in_some: number;
        };
        error?: string;
      }>(`/api/v1/companies/${companyId}/xero/accounts/compare`);

      if (response?.success) {
        setGroupCompanies(response.companies || []);
        setComparison(response.comparison || []);
      }
    } catch (err) {
      console.error("[XeroAccountsCard] Comparison error:", err);
    } finally {
      setComparisonLoading(false);
    }
  };

  React.useEffect(() => {
    loadAccounts();
    loadComparison();
  }, [companyId]);

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

      for (const company of groupCompanies) {
        const response = await api.post<{
          success: boolean;
          renamed_count: number;
          skipped_count: number;
          error_count: number;
          error?: string;
        }>(`/api/v1/companies/${company.company_id}/xero/accounts/standardize_names`, {});

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

      // Reload accounts to show updated names
      await loadAccounts();
      await loadComparison();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setStandardizing(false);
    }
  };

  const handleRefresh = async () => {
    await loadAccounts();
    await loadComparison();
  };

  // Build columns dynamically - static columns + group company columns
  const columns = React.useMemo<TableColumn[]>(() => {
    const baseColumns: TableColumn[] = [
      {
        key: "code",
        label: "Code",
        column_type: "text",
        width: 100,
        editable: false,
      },
      {
        key: "name",
        label: "Name",
        column_type: "text",
        width: 250,
        editable: false,
      },
      {
        key: "type",
        label: "Type",
        column_type: "text",
        width: 120,
        editable: false,
      },
      {
        key: "tax_type",
        label: "Tax Type",
        column_type: "text",
        width: 100,
        editable: false,
      },
      {
        key: "status",
        label: "Status",
        column_type: "text",
        width: 80,
        editable: false,
      },
    ];

    // Add dynamic columns for each group company
    const companyColumns: TableColumn[] = groupCompanies.map((company) => ({
      key: `company_${company.company_id}`,
      label: company.company_name.split(" ")[0], // Short name
      column_type: "boolean",
      width: 70,
      editable: false,
      tooltip: `${company.company_name} (${company.xero_tenant})`,
    }));

    return [...baseColumns, ...companyColumns];
  }, [groupCompanies]);

  // Transform accounts into table entries with company presence flags
  const entries = React.useMemo<TableRow[]>(() => {
    return accounts.map((acc) => {
      // Find this account in comparison data to check which companies have it
      const comparisonData = comparison.find((c) => c.code === acc.code);
      const companiesWithAccount = comparisonData?.companies.map((c) => c.company_id) || [];

      // Build base entry
      const entry: TableRow = {
        id: acc.account_id,
        code: acc.code,
        name: acc.name,
        type: acc.type,
        tax_type: acc.tax_type || "—",
        status: acc.status,
      };

      // Add company presence flags
      groupCompanies.forEach((company) => {
        entry[`company_${company.company_id}`] = companiesWithAccount.includes(company.company_id);
      });

      return entry;
    });
  }, [accounts, comparison, groupCompanies]);

  // Custom cell renderer for special formatting
  const customCellRenderer = React.useCallback(
    (entry: TableRow, columnKey: string): React.ReactNode | null => {
      // Handle company columns - show check/X icons
      if (columnKey.startsWith("company_")) {
        const hasAccount = entry[columnKey] as boolean;
        return hasAccount ? (
          <Check className="h-4 w-4 text-green-600 mx-auto" />
        ) : (
          <X className="h-4 w-4 text-red-400 mx-auto" />
        );
      }

      // Handle status column - show colored badge
      if (columnKey === "status") {
        const status = entry[columnKey] as string;
        return status === "ACTIVE" ? (
          <Badge variant="outline" className="bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400">
            Active
          </Badge>
        ) : (
          <Badge variant="outline" className="bg-gray-50 text-gray-500 dark:bg-gray-900/20 dark:text-gray-400">
            Archived
          </Badge>
        );
      }

      // Handle type column - show badge
      if (columnKey === "type") {
        return <Badge variant="outline">{entry[columnKey] as string}</Badge>;
      }

      return null; // Use default rendering
    },
    []
  );

  // Left actions for the table header
  const leftActions = React.useMemo(() => (
    <>
      {groupCompanies.length > 0 && (
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
      )}
    </>
  ), [groupCompanies.length, loading, standardizing]);

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
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-muted-foreground">
            <XCircle className="h-8 w-8 mx-auto mb-2 text-red-500" />
            <p>{error}</p>
            <Button variant="outline" size="sm" className="mt-4" onClick={loadAccounts}>
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
              {groupCompanies.length > 0 && (
                <span className="ml-2 text-xs text-blue-600">
                  ({groupCompanies.length} {groupCompanies.length === 1 ? "company" : "companies"} in group)
                </span>
              )}
              {comparisonLoading && (
                <span className="ml-2 text-xs text-muted-foreground">(loading group...)</span>
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

        {/* TeeemTableView for accounts */}
        <div className="-mx-6">
          <TeeemTableView
            key={`xero-accounts-${groupCompanies.length}`}
            entries={entries}
            columns={columns}
            tableName="Xero Accounts"
            onRefresh={handleRefresh}
            leftActions={leftActions}
            customCellRenderer={customCellRenderer}
            viewOnly={true}
            disableSavedViews={true}
            enableExport={true}
          />
        </div>
      </CardContent>
    </Card>
  );
}

export default XeroAccountsCard;
