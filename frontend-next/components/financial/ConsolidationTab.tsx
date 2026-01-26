"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  Building2,
  GitMerge,
  TrendingUp,
  DollarSign,
  ArrowRightLeft,
  Download,
  Layers,
  PieChart,
} from "lucide-react";
import { api } from "@/lib/api";
import { formatCurrency } from "@/utils/formatters";

interface Entity {
  id: number;
  name: string;
  type: string;
  ownership_percentage: number;
  currency: string;
  status: string;
}

interface ConsolidationData {
  financial_year: string;
  as_at_date: string;
  entities: Entity[];
  consolidated_profit_loss: {
    summary: {
      total_revenue: number;
      total_expenses: number;
      net_profit: number;
      profit_attributable_to_group: number;
      minority_interest: number;
    };
    by_entity: Array<{
      entity: string;
      revenue: number;
      expenses: number;
      profit: number;
    }>;
  };
  consolidated_balance_sheet: {
    summary: {
      total_assets: number;
      total_liabilities: number;
      net_assets: number;
      total_equity: number;
    };
    by_entity: Array<{
      entity: string;
      assets: number;
      liabilities: number;
      equity: number;
    }>;
  };
  elimination_entries: Array<{
    type: string;
    description: string;
    debit_account: string;
    credit_account: string;
    amount: number;
  }>;
  intercompany_summary: {
    transactions: Array<{
      from_entity: string;
      to_entity: string;
      amount: number;
      type: string;
    }>;
    total_intercompany: number;
  };
}

export default function ConsolidationTab() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [data, setData] = useState<ConsolidationData | null>(null);
  const [selectedYear, setSelectedYear] = useState<string>("");
  const [activeTab, setActiveTab] = useState("overview");

  const getCurrentFinancialYear = () => {
    const today = new Date();
    const year = today.getMonth() >= 6 ? today.getFullYear() + 1 : today.getFullYear();
    return `FY${year}`;
  };

  const fetchData = useCallback(async () => {
    const fy = selectedYear || getCurrentFinancialYear();

    try {
      const res = await api.get<{ success: boolean; data: ConsolidationData }>(`/api/v1/gl/consolidation?financial_year=${fy}`);
      if (res?.success) setData(res.data || null);

      if (!selectedYear) {
        setSelectedYear(fy);
      }
    } catch (error) {
      console.error("Failed to fetch consolidation data:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedYear]);

  useEffect(() => {
    setLoading(true);
    fetchData();
  }, [fetchData]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchData();
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
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-semibold">Group Consolidation</h2>
          <Select value={selectedYear} onValueChange={setSelectedYear}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Select Year" />
            </SelectTrigger>
            <SelectContent>
              {[0, 1, 2, 3, 4].map((offset) => {
                const today = new Date();
                const year = today.getMonth() >= 6 ? today.getFullYear() + 1 - offset : today.getFullYear() - offset;
                return (
                  <SelectItem key={year} value={`FY${year}`}>
                    FY{year}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleRefresh} disabled={refreshing}>
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      {data && (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                Entities
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{data.entities?.length || 0}</div>
              <p className="text-xs text-muted-foreground mt-1">in group</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Group Revenue
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatCurrency(data.consolidated_profit_loss?.summary?.total_revenue || 0)}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Group Profit
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${(data.consolidated_profit_loss?.summary?.profit_attributable_to_group || 0) >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                {formatCurrency(data.consolidated_profit_loss?.summary?.profit_attributable_to_group || 0)}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Layers className="h-4 w-4" />
                Net Assets
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatCurrency(data.consolidated_balance_sheet?.summary?.net_assets || 0)}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <ArrowRightLeft className="h-4 w-4" />
                Intercompany
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatCurrency(data.intercompany_summary?.total_intercompany || 0)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">eliminated</p>
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="profit_loss">Profit & Loss</TabsTrigger>
          <TabsTrigger value="balance_sheet">Balance Sheet</TabsTrigger>
          <TabsTrigger value="eliminations">Eliminations</TabsTrigger>
          <TabsTrigger value="intercompany">Intercompany</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Group Entities
              </CardTitle>
            </CardHeader>
            <CardContent>
              {data?.entities && data.entities.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Entity</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead className="text-right">Ownership</TableHead>
                      <TableHead>Currency</TableHead>
                      <TableHead className="text-center">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.entities.map((entity) => (
                      <TableRow key={entity.id}>
                        <TableCell className="font-medium">{entity.name}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{entity.type}</Badge>
                        </TableCell>
                        <TableCell className="text-right">{entity.ownership_percentage}%</TableCell>
                        <TableCell>{entity.currency}</TableCell>
                        <TableCell className="text-center">
                          <Badge className={entity.status === "active" ? "bg-status-success text-status-success-foreground dark:bg-green-900/30 dark:text-green-400" : ""}>
                            {entity.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <Building2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p className="text-lg font-medium">No entities configured</p>
                  <p className="text-sm mt-1">Add subsidiary companies to enable consolidation</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Entity Contribution */}
          {data?.consolidated_profit_loss?.by_entity && data.consolidated_profit_loss.by_entity.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <PieChart className="h-5 w-5" />
                  Entity Contribution
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Entity</TableHead>
                      <TableHead className="text-right">Revenue</TableHead>
                      <TableHead className="text-right">Expenses</TableHead>
                      <TableHead className="text-right">Profit</TableHead>
                      <TableHead className="text-right">% of Group</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.consolidated_profit_loss.by_entity.map((entity, idx) => {
                      const groupProfit = data.consolidated_profit_loss.summary.profit_attributable_to_group;
                      const percentage = groupProfit !== 0 ? ((entity.profit / groupProfit) * 100).toFixed(1) : "0";
                      return (
                        <TableRow key={idx}>
                          <TableCell className="font-medium">{entity.entity}</TableCell>
                          <TableCell className="text-right">{formatCurrency(entity.revenue)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(entity.expenses)}</TableCell>
                          <TableCell className={`text-right font-medium ${entity.profit >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                            {formatCurrency(entity.profit)}
                          </TableCell>
                          <TableCell className="text-right">{percentage}%</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Profit & Loss Tab */}
        <TabsContent value="profit_loss" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Consolidated Profit & Loss
              </CardTitle>
            </CardHeader>
            <CardContent>
              {data?.consolidated_profit_loss?.summary && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 rounded-lg bg-muted">
                      <div className="text-sm text-muted-foreground">Total Revenue</div>
                      <div className="text-xl font-bold">{formatCurrency(data.consolidated_profit_loss.summary.total_revenue)}</div>
                    </div>
                    <div className="p-4 rounded-lg bg-muted">
                      <div className="text-sm text-muted-foreground">Total Expenses</div>
                      <div className="text-xl font-bold">{formatCurrency(data.consolidated_profit_loss.summary.total_expenses)}</div>
                    </div>
                    <div className="p-4 rounded-lg bg-muted">
                      <div className="text-sm text-muted-foreground">Net Profit</div>
                      <div className={`text-xl font-bold ${data.consolidated_profit_loss.summary.net_profit >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                        {formatCurrency(data.consolidated_profit_loss.summary.net_profit)}
                      </div>
                    </div>
                    <div className="p-4 rounded-lg bg-muted">
                      <div className="text-sm text-muted-foreground">Attributable to Group</div>
                      <div className={`text-xl font-bold ${data.consolidated_profit_loss.summary.profit_attributable_to_group >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                        {formatCurrency(data.consolidated_profit_loss.summary.profit_attributable_to_group)}
                      </div>
                    </div>
                  </div>

                  {data.consolidated_profit_loss.summary.minority_interest !== 0 && (
                    <div className="p-4 rounded-lg border">
                      <div className="text-sm text-muted-foreground">Minority Interest</div>
                      <div className="text-lg font-medium">{formatCurrency(data.consolidated_profit_loss.summary.minority_interest)}</div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Balance Sheet Tab */}
        <TabsContent value="balance_sheet" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Layers className="h-5 w-5" />
                Consolidated Balance Sheet
              </CardTitle>
            </CardHeader>
            <CardContent>
              {data?.consolidated_balance_sheet?.summary && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 rounded-lg bg-muted">
                    <div className="text-sm text-muted-foreground">Total Assets</div>
                    <div className="text-xl font-bold">{formatCurrency(data.consolidated_balance_sheet.summary.total_assets)}</div>
                  </div>
                  <div className="p-4 rounded-lg bg-muted">
                    <div className="text-sm text-muted-foreground">Total Liabilities</div>
                    <div className="text-xl font-bold">{formatCurrency(data.consolidated_balance_sheet.summary.total_liabilities)}</div>
                  </div>
                  <div className="p-4 rounded-lg bg-muted">
                    <div className="text-sm text-muted-foreground">Net Assets</div>
                    <div className="text-xl font-bold">{formatCurrency(data.consolidated_balance_sheet.summary.net_assets)}</div>
                  </div>
                  <div className="p-4 rounded-lg bg-muted">
                    <div className="text-sm text-muted-foreground">Total Equity</div>
                    <div className="text-xl font-bold">{formatCurrency(data.consolidated_balance_sheet.summary.total_equity)}</div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Eliminations Tab */}
        <TabsContent value="eliminations" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <GitMerge className="h-5 w-5" />
                Elimination Entries
              </CardTitle>
            </CardHeader>
            <CardContent>
              {data?.elimination_entries && data.elimination_entries.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Type</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Debit Account</TableHead>
                      <TableHead>Credit Account</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.elimination_entries.map((entry, idx) => (
                      <TableRow key={idx}>
                        <TableCell>
                          <Badge variant="outline">{entry.type}</Badge>
                        </TableCell>
                        <TableCell>{entry.description}</TableCell>
                        <TableCell>{entry.debit_account}</TableCell>
                        <TableCell>{entry.credit_account}</TableCell>
                        <TableCell className="text-right font-medium">{formatCurrency(entry.amount)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <GitMerge className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No elimination entries required</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Intercompany Tab */}
        <TabsContent value="intercompany" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ArrowRightLeft className="h-5 w-5" />
                Intercompany Transactions
              </CardTitle>
            </CardHeader>
            <CardContent>
              {data?.intercompany_summary?.transactions && data.intercompany_summary.transactions.length > 0 ? (
                <>
                  <div className="p-4 rounded-lg bg-muted mb-4">
                    <div className="text-sm text-muted-foreground">Total Intercompany Transactions</div>
                    <div className="text-xl font-bold">{formatCurrency(data.intercompany_summary.total_intercompany)}</div>
                  </div>

                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>From Entity</TableHead>
                        <TableHead>To Entity</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.intercompany_summary.transactions.map((tx, idx) => (
                        <TableRow key={idx}>
                          <TableCell>{tx.from_entity}</TableCell>
                          <TableCell>{tx.to_entity}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{tx.type}</Badge>
                          </TableCell>
                          <TableCell className="text-right font-medium">{formatCurrency(tx.amount)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <ArrowRightLeft className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No intercompany transactions found</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
