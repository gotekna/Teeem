"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Loader2,
  RefreshCw,
  XCircle,
  CheckCircle,
  GitMerge,
} from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { XeroAccount } from "./types";

interface CompanyComparison {
  company_id: number;
  company_name: string;
  name: string;
  status: string;
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
 * XeroAccountsCard - Shows Chart of Accounts from Xero with comparison
 *
 * Features:
 * - Load and display all accounts from Xero
 * - Filter by account type and search by code/name
 * - Compare accounts across consolidated group companies
 * - Highlight missing accounts and name mismatches
 */
export function XeroAccountsCard({ companyId, companyName }: XeroAccountsCardProps) {
  const [accounts, setAccounts] = React.useState<XeroAccount[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [showComparison, setShowComparison] = React.useState(false);
  const [comparison, setComparison] = React.useState<AccountComparison[]>([]);
  const [comparisonLoading, setComparisonLoading] = React.useState(false);
  const [comparisonSummary, setComparisonSummary] = React.useState<{
    total_unique_accounts: number;
    accounts_in_all: number;
    accounts_with_differences: number;
    missing_in_some: number;
  } | null>(null);
  const [filterType, setFilterType] = React.useState<string>("all");
  const [searchTerm, setSearchTerm] = React.useState("");

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
        setComparison(response.comparison);
        setComparisonSummary(response.summary);
        setShowComparison(true);
      } else {
        setError(response?.error || "Failed to load comparison");
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setComparisonLoading(false);
    }
  };

  React.useEffect(() => {
    loadAccounts();
  }, [companyId]);

  // Get unique types for filter
  const accountTypes = React.useMemo(() => {
    const types = new Set(accounts.map(a => a.type));
    return Array.from(types).sort();
  }, [accounts]);

  // Filter accounts
  const filteredAccounts = React.useMemo(() => {
    return accounts.filter(acc => {
      const matchesType = filterType === "all" || acc.type === filterType;
      const matchesSearch = !searchTerm ||
        acc.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        acc.name.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesType && matchesSearch;
    });
  }, [accounts, filterType, searchTerm]);

  // Filter comparison
  const filteredComparison = React.useMemo(() => {
    return comparison.filter(acc => {
      const matchesType = filterType === "all" || acc.type === filterType;
      const matchesSearch = !searchTerm ||
        acc.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        acc.name.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesType && matchesSearch;
    });
  }, [comparison, filterType, searchTerm]);

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
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={loadAccounts}
              disabled={loading}
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              <span className="ml-2">Refresh</span>
            </Button>
            <Button
              variant={showComparison ? "secondary" : "default"}
              size="sm"
              onClick={() => showComparison ? setShowComparison(false) : loadComparison()}
              disabled={comparisonLoading}
            >
              {comparisonLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <GitMerge className="h-4 w-4" />
              )}
              <span className="ml-2">{showComparison ? "Hide Comparison" : "Compare Group"}</span>
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-2 mt-4">
          <Input
            placeholder="Search by code or name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="max-w-xs"
          />
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {accountTypes.map(type => (
                <SelectItem key={type} value={type}>{type}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>

      <CardContent>
        {/* Comparison Summary */}
        {showComparison && comparisonSummary && (
          <div className="mb-4 p-4 rounded-lg bg-muted/50 border">
            <h4 className="font-medium mb-2">Comparison Summary</h4>
            <div className="grid grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Unique Accounts:</span>
                <span className="ml-2 font-medium">{comparisonSummary.total_unique_accounts}</span>
              </div>
              <div>
                <span className="text-muted-foreground">In All Companies:</span>
                <span className="ml-2 font-medium text-green-600">{comparisonSummary.accounts_in_all}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Missing in Some:</span>
                <span className="ml-2 font-medium text-yellow-600">{comparisonSummary.missing_in_some}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Name Differences:</span>
                <span className="ml-2 font-medium text-red-600">{comparisonSummary.accounts_with_differences}</span>
              </div>
            </div>
          </div>
        )}

        {/* Comparison View */}
        {showComparison ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-3 font-medium">Code</th>
                  <th className="text-left py-2 px-3 font-medium">Name</th>
                  <th className="text-left py-2 px-3 font-medium">Type</th>
                  <th className="text-center py-2 px-3 font-medium">Status</th>
                  <th className="text-left py-2 px-3 font-medium">Companies</th>
                </tr>
              </thead>
              <tbody>
                {filteredComparison.map((acc) => (
                  <tr
                    key={acc.code}
                    className={cn(
                      "border-b hover:bg-muted/50",
                      !acc.all_companies && "bg-yellow-50 dark:bg-yellow-900/10",
                      !acc.names_match && "bg-red-50 dark:bg-red-900/10"
                    )}
                  >
                    <td className="py-2 px-3 font-mono">{acc.code}</td>
                    <td className="py-2 px-3">
                      {acc.names_match ? (
                        acc.name
                      ) : (
                        <div className="space-y-1">
                          {acc.companies.map((c, i) => (
                            <div key={i} className="text-xs">
                              <span className="text-muted-foreground">{c.company_name}:</span>{" "}
                              <span className="font-medium">{c.name}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="py-2 px-3">{acc.type}</td>
                    <td className="py-2 px-3 text-center">
                      {acc.all_companies ? (
                        <Badge variant="outline" className="bg-green-50 text-green-700">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          All
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-yellow-50 text-yellow-700">
                          {acc.company_count} of {comparison.length > 0 ? Math.max(...comparison.map(c => c.companies.length)) : 0}
                        </Badge>
                      )}
                    </td>
                    <td className="py-2 px-3">
                      <div className="flex flex-wrap gap-1">
                        {acc.companies.map((c, i) => (
                          <Badge key={i} variant="secondary" className="text-xs">
                            {c.company_name}
                          </Badge>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          /* Standard Account List */
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-3 font-medium">Code</th>
                  <th className="text-left py-2 px-3 font-medium">Name</th>
                  <th className="text-left py-2 px-3 font-medium">Type</th>
                  <th className="text-left py-2 px-3 font-medium">Tax Type</th>
                  <th className="text-center py-2 px-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredAccounts.map((acc) => (
                  <tr key={acc.account_id} className="border-b hover:bg-muted/50">
                    <td className="py-2 px-3 font-mono">{acc.code}</td>
                    <td className="py-2 px-3">{acc.name}</td>
                    <td className="py-2 px-3">
                      <Badge variant="outline">{acc.type}</Badge>
                    </td>
                    <td className="py-2 px-3 text-muted-foreground">{acc.tax_type || "—"}</td>
                    <td className="py-2 px-3 text-center">
                      {acc.status === "ACTIVE" ? (
                        <Badge variant="outline" className="bg-green-50 text-green-700">Active</Badge>
                      ) : (
                        <Badge variant="outline" className="bg-gray-50 text-gray-500">Archived</Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredAccounts.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                No accounts found matching your filters
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default XeroAccountsCard;
