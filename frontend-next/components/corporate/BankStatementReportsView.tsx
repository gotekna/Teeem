"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Loader2,
  RefreshCw,
  Download,
  ChevronRight,
  ChevronDown,
  FileText,
  Building2,
  Calendar,
  AlertCircle,
  CheckCircle2,
  Clock,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";

// Types
interface BankReportMonth {
  id: number;
  month: number;
  month_name: string;
  period_display: string;
  transaction_count: number;
  total_in: number;
  total_out: number;
  net_change: number;
  generated_at: string;
  file_name: string;
}

interface BankReportYear {
  financial_year: string;
  months: BankReportMonth[];
}

interface BankReportAccount {
  name: string;
  bank_account_id: string;
  years: BankReportYear[];
}

interface GenerateResult {
  created: number;
  regenerated: number;
  skipped: number;
  failed: number;
  errors: string[];
}

interface Props {
  companyId?: string;
}

export function BankStatementReportsView({ companyId }: Props) {
  const [reports, setReports] = useState<BankReportAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [downloading, setDownloading] = useState<number | null>(null);
  const [expandedAccounts, setExpandedAccounts] = useState<Set<string>>(new Set());
  const [expandedYears, setExpandedYears] = useState<Set<string>>(new Set());
  const [lastResult, setLastResult] = useState<GenerateResult | null>(null);

  // Load reports on mount
  useEffect(() => {
    loadReports();
  }, []);

  const loadReports = async () => {
    try {
      setLoading(true);
      const response = await api.get<{ success: boolean; data: BankReportAccount[] }>(
        "/api/v1/bank_statement_reports/by_structure"
      );

      if (response?.success) {
        setReports(response.data);
        // Auto-expand first account and year
        if (response.data.length > 0) {
          const firstAccount = response.data[0];
          setExpandedAccounts(new Set([firstAccount.bank_account_id]));
          if (firstAccount.years.length > 0) {
            setExpandedYears(new Set([`${firstAccount.bank_account_id}-${firstAccount.years[0].financial_year}`]));
          }
        }
      }
    } catch (error) {
      console.error("Failed to load reports:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateAll = async () => {
    try {
      setGenerating(true);
      setLastResult(null);
      const response = await api.post<{ success: boolean; data: GenerateResult }>(
        "/api/v1/bank_statement_reports/generate_all"
      );

      if (response?.success) {
        setLastResult(response.data);
        // Reload reports to show new ones
        await loadReports();
      }
    } catch (error) {
      console.error("Failed to generate reports:", error);
    } finally {
      setGenerating(false);
    }
  };

  const handleDownload = async (reportId: number) => {
    try {
      setDownloading(reportId);

      // Get report details with download URL
      const response = await api.get<{ success: boolean; data: { download_url: string; file_name: string } }>(
        `/api/v1/bank_statement_reports/${reportId}`
      );

      if (response?.success && response.data.download_url) {
        // Open Cloudinary URL in new tab (will trigger download)
        window.open(response.data.download_url, "_blank");
      }
    } catch (error) {
      console.error("Failed to download report:", error);
    } finally {
      setDownloading(null);
    }
  };

  const toggleAccount = (accountId: string) => {
    setExpandedAccounts((prev) => {
      const next = new Set(prev);
      if (next.has(accountId)) {
        next.delete(accountId);
      } else {
        next.add(accountId);
      }
      return next;
    });
  };

  const toggleYear = (accountId: string, year: string) => {
    const key = `${accountId}-${year}`;
    setExpandedYears((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-AU", {
      style: "currency",
      currency: "AUD",
      minimumFractionDigits: 2,
    }).format(amount);
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="flex items-center justify-center gap-2">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>Loading stored reports...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with Generate button */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Stored Bank Statement Reports
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                PDF reports stored for ATO compliance - organized by bank account, FY, and month
              </p>
            </div>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    onClick={handleGenerateAll}
                    disabled={generating}
                    variant="default"
                  >
                    {generating ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Generate All Reports
                      </>
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Generate PDFs for all bank accounts, FYs, and months</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </CardHeader>

        {/* Generation result */}
        {lastResult && (
          <CardContent className="pt-0">
            <div className={cn(
              "p-3 rounded-lg text-sm",
              lastResult.failed > 0 ? "bg-yellow-50 text-yellow-800" : "bg-green-50 text-green-800"
            )}>
              <div className="flex items-center gap-2 mb-1">
                {lastResult.failed > 0 ? (
                  <AlertCircle className="h-4 w-4" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" />
                )}
                <span className="font-medium">Generation Complete</span>
              </div>
              <div className="flex gap-4 text-xs">
                <span>Created: {lastResult.created}</span>
                <span>Regenerated: {lastResult.regenerated}</span>
                <span>Skipped: {lastResult.skipped}</span>
                {lastResult.failed > 0 && <span className="text-red-600">Failed: {lastResult.failed}</span>}
              </div>
              {lastResult.errors.length > 0 && (
                <div className="mt-2 text-xs text-red-600">
                  {lastResult.errors.slice(0, 3).map((err, i) => (
                    <div key={i}>{err}</div>
                  ))}
                  {lastResult.errors.length > 3 && (
                    <div>...and {lastResult.errors.length - 3} more errors</div>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        )}
      </Card>

      {/* Reports tree */}
      {reports.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p className="font-medium">No reports generated yet</p>
              <p className="text-sm mt-1">
                Click "Generate All Reports" to create PDFs for all bank transaction periods
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="pt-4">
            <div className="space-y-2">
              {reports.map((account) => (
                <Collapsible
                  key={account.bank_account_id}
                  open={expandedAccounts.has(account.bank_account_id)}
                  onOpenChange={() => toggleAccount(account.bank_account_id)}
                >
                  <CollapsibleTrigger className="flex items-center gap-2 w-full p-2 hover:bg-muted rounded-lg transition-colors">
                    {expandedAccounts.has(account.bank_account_id) ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                    <Building2 className="h-4 w-4 text-blue-500" />
                    <span className="font-medium">{account.name}</span>
                    <Badge variant="secondary" className="ml-auto">
                      {account.years.length} FY{account.years.length !== 1 ? "s" : ""}
                    </Badge>
                  </CollapsibleTrigger>

                  <CollapsibleContent className="ml-6 mt-1 space-y-1">
                    {account.years.map((year) => {
                      const yearKey = `${account.bank_account_id}-${year.financial_year}`;
                      return (
                        <Collapsible
                          key={year.financial_year}
                          open={expandedYears.has(yearKey)}
                          onOpenChange={() => toggleYear(account.bank_account_id, year.financial_year)}
                        >
                          <CollapsibleTrigger className="flex items-center gap-2 w-full p-2 hover:bg-muted rounded-lg transition-colors">
                            {expandedYears.has(yearKey) ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                            <Calendar className="h-4 w-4 text-orange-500" />
                            <span className="font-medium">{year.financial_year}</span>
                            <Badge variant="outline" className="ml-auto">
                              {year.months.length} month{year.months.length !== 1 ? "s" : ""}
                            </Badge>
                          </CollapsibleTrigger>

                          <CollapsibleContent className="ml-6 mt-1">
                            <div className="border rounded-lg overflow-hidden">
                              <table className="w-full text-sm">
                                <thead className="bg-muted/50">
                                  <tr>
                                    <th className="px-3 py-2 text-left font-medium">Month</th>
                                    <th className="px-3 py-2 text-right font-medium">Transactions</th>
                                    <th className="px-3 py-2 text-right font-medium">Money In</th>
                                    <th className="px-3 py-2 text-right font-medium">Money Out</th>
                                    <th className="px-3 py-2 text-right font-medium">Net</th>
                                    <th className="px-3 py-2 text-center font-medium">Generated</th>
                                    <th className="px-3 py-2 text-center font-medium">Download</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {year.months.map((month) => (
                                    <tr key={month.id} className="border-t hover:bg-muted/30">
                                      <td className="px-3 py-2 font-medium">{month.month_name}</td>
                                      <td className="px-3 py-2 text-right">{month.transaction_count}</td>
                                      <td className="px-3 py-2 text-right text-green-600">
                                        {formatCurrency(month.total_in)}
                                      </td>
                                      <td className="px-3 py-2 text-right text-red-600">
                                        {formatCurrency(month.total_out)}
                                      </td>
                                      <td className={cn(
                                        "px-3 py-2 text-right font-medium",
                                        month.net_change >= 0 ? "text-green-600" : "text-red-600"
                                      )}>
                                        {formatCurrency(month.net_change)}
                                      </td>
                                      <td className="px-3 py-2 text-center text-xs text-muted-foreground">
                                        <TooltipProvider>
                                          <Tooltip>
                                            <TooltipTrigger>
                                              <span className="flex items-center justify-center gap-1">
                                                <Clock className="h-3 w-3" />
                                                {formatDistanceToNow(new Date(month.generated_at), { addSuffix: true })}
                                              </span>
                                            </TooltipTrigger>
                                            <TooltipContent>
                                              {format(new Date(month.generated_at), "PPpp")}
                                            </TooltipContent>
                                          </Tooltip>
                                        </TooltipProvider>
                                      </td>
                                      <td className="px-3 py-2 text-center">
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          onClick={() => handleDownload(month.id)}
                                          disabled={downloading === month.id}
                                        >
                                          {downloading === month.id ? (
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                          ) : (
                                            <Download className="h-4 w-4" />
                                          )}
                                        </Button>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </CollapsibleContent>
                        </Collapsible>
                      );
                    })}
                  </CollapsibleContent>
                </Collapsible>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Legal note */}
      <p className="text-xs text-muted-foreground text-center">
        Reports are reconstructed from Xero bank feed data and retained per s262A ITAA 1936.
        Not official bank statements.
      </p>
    </div>
  );
}
