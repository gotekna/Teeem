"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
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
  RefreshCw,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Building2,
  ArrowLeftRight,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

interface CompanyGroup {
  id: number;
  name: string;
  companies_count: number;
  latest_reconciliation?: {
    id: number;
    as_of_date: string;
    health_score: number;
    has_discrepancies: boolean;
    total_discrepancy: number;
    completed_at: string;
  };
}

interface IntercompanyRelationship {
  company_a: {
    id: number;
    name: string;
    amount: number;
    source: string;
  };
  company_b: {
    id: number;
    name: string;
    amount: number;
    source: string;
  };
  balance_type: string;
  discrepancy: number;
  matched: boolean;
  as_of_date: string;
}

interface GroupDetail {
  id: number;
  name: string;
  companies: { id: number; name: string }[];
}

interface ReconciliationSummary {
  as_of_date: string;
  total_relationships: number;
  matched: number;
  mismatched: number;
  health_score: number;
}

export default function ConsolidationPage() {
  const [groups, setGroups] = React.useState<CompanyGroup[]>([]);
  const [selectedGroupId, setSelectedGroupId] = React.useState<string>("");
  const [groupDetail, setGroupDetail] = React.useState<GroupDetail | null>(null);
  const [summary, setSummary] = React.useState<ReconciliationSummary | null>(null);
  const [relationships, setRelationships] = React.useState<IntercompanyRelationship[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [reconciling, setReconciling] = React.useState(false);
  const [asOfDate, setAsOfDate] = React.useState(new Date().toISOString().split('T')[0]);

  // Load company groups
  React.useEffect(() => {
    loadGroups();
  }, []);

  // Load group details when selection changes
  React.useEffect(() => {
    if (selectedGroupId) {
      loadGroupDetails();
    }
     
  }, [selectedGroupId, asOfDate]);

  const loadGroups = async () => {
    try {
      setLoading(true);
      const response = await api.get<{ success: boolean; groups: CompanyGroup[] }>(
        "/api/v1/consolidation"
      );
      if (response?.success) {
        setGroups(response.groups);
        // Auto-select first group with companies
        const firstWithCompanies = response.groups.find(g => g.companies_count > 1);
        if (firstWithCompanies) {
          setSelectedGroupId(String(firstWithCompanies.id));
        }
      }
    } catch (error) {
      console.error("Failed to load groups:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadGroupDetails = async () => {
    if (!selectedGroupId) return;

    try {
      setLoading(true);
      const response = await api.get<{
        success: boolean;
        group: GroupDetail;
        summary: ReconciliationSummary;
        relationships: IntercompanyRelationship[];
      }>(`/api/v1/consolidation/${selectedGroupId}?as_of_date=${asOfDate}`);

      if (response?.success) {
        setGroupDetail(response.group);
        setSummary(response.summary);
        setRelationships(response.relationships);
      }
    } catch (error) {
      console.error("Failed to load group details:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleReconcile = async () => {
    if (!selectedGroupId) return;

    try {
      setReconciling(true);
      const response = await api.post<{
        success: boolean;
        summary: ReconciliationSummary;
        discrepancies: unknown[];
      }>(`/api/v1/consolidation/${selectedGroupId}/reconcile?as_of_date=${asOfDate}`);

      if (response?.success) {
        // Reload details to show updated data
        await loadGroupDetails();
      }
    } catch (error) {
      console.error("Failed to run reconciliation:", error);
    } finally {
      setReconciling(false);
    }
  };

  const formatCurrency = (amount: number) => {
    const absAmount = Math.abs(amount);
    return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(absAmount);
  };

  const getHealthColor = (score: number) => {
    if (score >= 90) return "text-green-600";
    if (score >= 70) return "text-yellow-600";
    return "text-red-600";
  };

  const getHealthBg = (score: number) => {
    if (score >= 90) return "bg-green-100 dark:bg-green-900/30";
    if (score >= 70) return "bg-yellow-100 dark:bg-yellow-900/30";
    return "bg-red-100 dark:bg-red-900/30";
  };

  if (loading && groups.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size={32} className="text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Consolidated Financials</h1>
          <p className="text-muted-foreground">
            Intercompany balance reconciliation across company groups
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">As of:</span>
            <input
              type="date"
              value={asOfDate}
              onChange={(e) => setAsOfDate(e.target.value)}
              className="px-3 py-2 border rounded-md text-sm"
            />
          </div>
          <Select value={selectedGroupId} onValueChange={setSelectedGroupId}>
            <SelectTrigger className="w-[250px]">
              <SelectValue placeholder="Select company group" />
            </SelectTrigger>
            <SelectContent>
              {groups.map((group) => (
                <SelectItem key={group.id} value={String(group.id)}>
                  {group.name} ({group.companies_count} companies)
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            onClick={handleReconcile}
            disabled={!selectedGroupId || reconciling}
          >
            {reconciling ? (
              <Spinner size={16} className="mr-2" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Run Reconciliation
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className={cn("p-2 rounded-lg", getHealthBg(summary.health_score))}>
                  {summary.health_score >= 90 ? (
                    <CheckCircle className={cn("h-5 w-5", getHealthColor(summary.health_score))} />
                  ) : summary.health_score >= 70 ? (
                    <AlertTriangle className={cn("h-5 w-5", getHealthColor(summary.health_score))} />
                  ) : (
                    <XCircle className={cn("h-5 w-5", getHealthColor(summary.health_score))} />
                  )}
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Health Score</div>
                  <div className={cn("text-2xl font-bold", getHealthColor(summary.health_score))}>
                    {summary.health_score}%
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                  <ArrowLeftRight className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Total Relationships</div>
                  <div className="text-2xl font-bold">{summary.total_relationships}</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Matched</div>
                  <div className="text-2xl font-bold text-green-600">{summary.matched}</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-red-100 dark:bg-red-900/30">
                  <AlertTriangle className="h-5 w-5 text-red-600" />
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Mismatched</div>
                  <div className="text-2xl font-bold text-red-600">{summary.mismatched}</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Companies in Group */}
      {groupDetail && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Companies in {groupDetail.name}</CardTitle>
            <CardDescription>
              {groupDetail.companies.length} companies in this consolidation group
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {groupDetail.companies.map((company) => (
                <Badge key={company.id} variant="secondary" className="py-1 px-3">
                  <Building2 className="h-3 w-3 mr-1.5" />
                  {company.name}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Intercompany Relationships Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Intercompany Balance Reconciliation</CardTitle>
          <CardDescription>
            Comparing balances between related companies. Balances should be inverse (sum to zero).
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Spinner size={24} className="text-muted-foreground" />
            </div>
          ) : relationships.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <ArrowLeftRight className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No intercompany relationships found.</p>
              <p className="text-sm mt-1">
                Run reconciliation to sync balances from loan register and Xero.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Company A</TableHead>
                  <TableHead className="text-right">A&apos;s View</TableHead>
                  <TableHead>Company B</TableHead>
                  <TableHead className="text-right">B&apos;s View</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Discrepancy</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {relationships.map((rel, index) => (
                  <TableRow key={index} className={!rel.matched ? "bg-red-50 dark:bg-red-900/10" : ""}>
                    <TableCell className="font-medium">{rel.company_a.name}</TableCell>
                    <TableCell className="text-right font-mono">
                      <span className={rel.company_a.amount >= 0 ? "text-green-600" : "text-red-600"}>
                        {rel.company_a.amount >= 0 ? (
                          <TrendingUp className="inline h-3 w-3 mr-1" />
                        ) : (
                          <TrendingDown className="inline h-3 w-3 mr-1" />
                        )}
                        {formatCurrency(rel.company_a.amount)}
                      </span>
                    </TableCell>
                    <TableCell className="font-medium">{rel.company_b.name}</TableCell>
                    <TableCell className="text-right font-mono">
                      <span className={rel.company_b.amount >= 0 ? "text-green-600" : "text-red-600"}>
                        {rel.company_b.amount >= 0 ? (
                          <TrendingUp className="inline h-3 w-3 mr-1" />
                        ) : (
                          <TrendingDown className="inline h-3 w-3 mr-1" />
                        )}
                        {formatCurrency(rel.company_b.amount)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">
                        {rel.balance_type}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {rel.discrepancy !== 0 && (
                        <span className="text-red-600 font-semibold">
                          {formatCurrency(rel.discrepancy)}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {rel.matched ? (
                        <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Matched
                        </Badge>
                      ) : (
                        <Badge variant="destructive">
                          <AlertTriangle className="h-3 w-3 mr-1" />
                          Mismatch
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Group Overview Cards */}
      {groups.length > 1 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">All Company Groups</CardTitle>
            <CardDescription>
              Overview of reconciliation status across all groups
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
              {groups.filter(g => g.companies_count > 1).map((group) => (
                <Card
                  key={group.id}
                  className={cn(
                    "cursor-pointer hover:border-primary transition-colors",
                    selectedGroupId === String(group.id) && "border-primary"
                  )}
                  onClick={() => setSelectedGroupId(String(group.id))}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium">{group.name}</h4>
                      {group.latest_reconciliation && (
                        <Badge
                          variant="secondary"
                          className={cn(
                            group.latest_reconciliation.has_discrepancies
                              ? "bg-red-100 text-red-800"
                              : "bg-green-100 text-green-800"
                          )}
                        >
                          {group.latest_reconciliation.health_score}%
                        </Badge>
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {group.companies_count} companies
                    </div>
                    {group.latest_reconciliation && (
                      <div className="text-xs text-muted-foreground mt-1">
                        Last checked: {format(new Date(group.latest_reconciliation.completed_at), "d MMM yyyy")}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
