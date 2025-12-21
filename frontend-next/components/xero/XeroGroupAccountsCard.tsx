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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Loader2,
  RefreshCw,
  CheckCircle,
  XCircle,
  AlertTriangle,
} from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

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

interface ComparisonSummary {
  total_unique_accounts: number;
  accounts_in_all: number;
  accounts_with_differences: number;
  missing_in_some: number;
  companies: Array<{ id: number; name: string }>;
}

interface XeroGroupAccountsCardProps {
  companyId: string;
}

/**
 * XeroGroupAccountsCard - Group Chart of Accounts comparison
 *
 * Shows accounts across all companies in a group side-by-side,
 * highlighting which companies have each account and any naming differences.
 */
export function XeroGroupAccountsCard({ companyId }: XeroGroupAccountsCardProps) {
  const [comparison, setComparison] = React.useState<AccountComparison[]>([]);
  const [summary, setSummary] = React.useState<ComparisonSummary | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [filterType, setFilterType] = React.useState<string>("all");
  const [searchTerm, setSearchTerm] = React.useState("");
  const [showOnlyDifferences, setShowOnlyDifferences] = React.useState(false);

  const loadComparison = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get<{
        success: boolean;
        comparison: AccountComparison[];
        summary: ComparisonSummary;
        error?: string;
      }>(`/api/v1/companies/${companyId}/xero/accounts/compare`);

      if (response?.success) {
        setComparison(response.comparison);
        setSummary(response.summary);
      } else {
        setError(response?.error || "Failed to load comparison");
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    loadComparison();
  }, [companyId]);

  // Get unique types for filter
  const accountTypes = React.useMemo(() => {
    const types = new Set(comparison.map(a => a.type));
    return Array.from(types).sort();
  }, [comparison]);

  // Get company names from summary
  const companyNames = React.useMemo(() => {
    return summary?.companies || [];
  }, [summary]);

  // Filter accounts
  const filteredAccounts = React.useMemo(() => {
    return comparison.filter(acc => {
      const matchesType = filterType === "all" || acc.type === filterType;
      const matchesSearch = !searchTerm ||
        acc.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        acc.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesDiffFilter = !showOnlyDifferences || !acc.all_companies || !acc.names_match;
      return matchesType && matchesSearch && matchesDiffFilter;
    });
  }, [comparison, filterType, searchTerm, showOnlyDifferences]);

  // Count stats
  const stats = React.useMemo(() => ({
    total: comparison.length,
    inAll: comparison.filter(a => a.all_companies).length,
    missingInSome: comparison.filter(a => !a.all_companies).length,
    nameDiffs: comparison.filter(a => !a.names_match).length,
  }), [comparison]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">Group Chart of Accounts</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Compare accounts across all companies in this group
            </p>
          </div>
          <Button onClick={loadComparison} disabled={loading} size="sm" variant="outline">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            <span className="ml-2">Refresh</span>
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {error && (
          <div className="bg-destructive/10 text-destructive px-4 py-3 rounded-lg text-sm mb-4">
            {error}
          </div>
        )}

        {/* Summary Stats */}
        {summary && (
          <div className="grid grid-cols-4 gap-4 mb-6">
            <div className="bg-muted/50 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold">{stats.total}</div>
              <div className="text-xs text-muted-foreground">Total Accounts</div>
            </div>
            <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-green-600">{stats.inAll}</div>
              <div className="text-xs text-muted-foreground">In All Companies</div>
            </div>
            <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-amber-600">{stats.missingInSome}</div>
              <div className="text-xs text-muted-foreground">Missing In Some</div>
            </div>
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-blue-600">{stats.nameDiffs}</div>
              <div className="text-xs text-muted-foreground">Name Differences</div>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="flex items-center gap-4 mb-4">
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
          <Button
            variant={showOnlyDifferences ? "default" : "outline"}
            size="sm"
            onClick={() => setShowOnlyDifferences(!showOnlyDifferences)}
          >
            <AlertTriangle className="h-4 w-4 mr-2" />
            Show Differences Only
          </Button>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        )}

        {/* Table */}
        {!loading && filteredAccounts.length > 0 && (
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="w-[100px]">Code</TableHead>
                  <TableHead>Account Name</TableHead>
                  <TableHead className="w-[120px]">Type</TableHead>
                  {companyNames.map(company => (
                    <TableHead key={company.id} className="text-center w-[150px]">
                      {company.name}
                    </TableHead>
                  ))}
                  <TableHead className="text-center w-[80px]">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAccounts.map((account) => {
                  const hasIssue = !account.all_companies || !account.names_match;
                  return (
                    <TableRow
                      key={account.code}
                      className={cn(
                        hasIssue && "bg-amber-50/50 dark:bg-amber-900/10"
                      )}
                    >
                      <TableCell className="font-mono text-sm">{account.code}</TableCell>
                      <TableCell className="font-medium">{account.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {account.type}
                        </Badge>
                      </TableCell>
                      {companyNames.map(company => {
                        const companyData = account.companies.find(c => c.company_id === company.id);
                        if (!companyData) {
                          return (
                            <TableCell key={company.id} className="text-center">
                              <XCircle className="h-4 w-4 text-red-500 mx-auto" />
                            </TableCell>
                          );
                        }
                        const namesDiffer = companyData.name !== account.name;
                        return (
                          <TableCell key={company.id} className="text-center">
                            {namesDiffer ? (
                              <div className="flex flex-col items-center gap-1">
                                <AlertTriangle className="h-4 w-4 text-amber-500" />
                                <span className="text-xs text-muted-foreground truncate max-w-[140px]" title={companyData.name}>
                                  {companyData.name}
                                </span>
                              </div>
                            ) : (
                              <CheckCircle className="h-4 w-4 text-green-500 mx-auto" />
                            )}
                          </TableCell>
                        );
                      })}
                      <TableCell className="text-center">
                        {account.all_companies && account.names_match ? (
                          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400">
                            OK
                          </Badge>
                        ) : !account.all_companies ? (
                          <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400">
                            Missing
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400">
                            Diff
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Empty State */}
        {!loading && filteredAccounts.length === 0 && comparison.length > 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <p>No accounts match your filters</p>
          </div>
        )}

        {!loading && comparison.length === 0 && !error && (
          <div className="text-center py-12 text-muted-foreground">
            <p className="font-medium mb-2">No group data available</p>
            <p className="text-sm">This company may not be part of a group, or no companies have Xero connected.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
