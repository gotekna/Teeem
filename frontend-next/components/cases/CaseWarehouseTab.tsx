"use client";

/**
 * CaseWarehouseTab - Data warehouse summary for a case
 *
 * Shows financial metrics, related entities, actions summary,
 * investigation period, and any data inconsistencies.
 *
 * Extracted from cases/[id]/page.tsx for maintainability.
 */

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Clock,
  AlertTriangle,
  Users,
  Building2,
  Briefcase,
  RefreshCw,
} from "lucide-react";
import { api } from "@/lib/api";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/utils/formatters";

interface WarehouseSummary {
  case_number: string;
  title: string;
  status: string;
  generated_at: string;
  related_contacts: number;
  related_companies: number;
  related_jobs: number;
  documents_linked: number;
  emails_linked: number;
  actions_completed: number;
  actions_with_findings: number;
  total_job_income: number;
  total_job_expenses: number;
  total_hours_logged: number;
  inconsistencies: Array<{
    severity: "high" | "medium" | "low";
    title: string;
    description: string;
    type: string;
    source: string;
  }>;
  invoice_variances: number;
  investigation_period: {
    start: string | null;
    end: string | null;
  };
}

interface CaseWarehouseTabProps {
  caseId: string;
}

export function CaseWarehouseTab({ caseId }: CaseWarehouseTabProps) {
  const [warehouseSummary, setWarehouseSummary] = React.useState<WarehouseSummary | null>(null);
  const [loading, setLoading] = React.useState(true);

  const loadWarehouseSummary = React.useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.get<{ success: boolean; data: WarehouseSummary }>(
        `/api/v1/cases/${caseId}/warehouse_summary`
      );
      setWarehouseSummary(response.data);
    } catch (error) {
      console.error("Failed to load warehouse summary:", error);
    } finally {
      setLoading(false);
    }
  }, [caseId]);

  React.useEffect(() => {
    loadWarehouseSummary();
  }, [loadWarehouseSummary]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <Spinner size={24} className="text-muted-foreground" />
      </div>
    );
  }

  if (!warehouseSummary) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="text-center text-muted-foreground">
            <BarChart3 className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>Failed to load warehouse data</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={() => loadWarehouseSummary()}
            >
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Stats Grid */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Job Income</p>
                <p className="text-2xl font-bold text-green-600">
                  {formatCurrency(warehouseSummary.total_job_income || 0)}
                </p>
              </div>
              <TrendingUp className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Job Expenses</p>
                <p className="text-2xl font-bold text-red-600">
                  {formatCurrency(warehouseSummary.total_job_expenses || 0)}
                </p>
              </div>
              <TrendingDown className="h-8 w-8 text-red-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Hours Logged</p>
                <p className="text-2xl font-bold">
                  {(warehouseSummary.total_hours_logged || 0).toFixed(1)}
                </p>
              </div>
              <Clock className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Invoice Variances</p>
                <p className="text-2xl font-bold text-amber-600">
                  {warehouseSummary.invoice_variances || 0}
                </p>
              </div>
              <AlertTriangle className="h-8 w-8 text-amber-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Related Entities Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Related Entities</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center p-4 bg-muted/30 rounded-lg">
              <Users className="h-6 w-6 mx-auto mb-2 text-teal-600" />
              <p className="text-2xl font-bold">{warehouseSummary.related_contacts}</p>
              <p className="text-sm text-muted-foreground">Contacts</p>
            </div>
            <div className="text-center p-4 bg-muted/30 rounded-lg">
              <Building2 className="h-6 w-6 mx-auto mb-2 text-blue-600" />
              <p className="text-2xl font-bold">{warehouseSummary.related_companies}</p>
              <p className="text-sm text-muted-foreground">Companies</p>
            </div>
            <div className="text-center p-4 bg-muted/30 rounded-lg">
              <Briefcase className="h-6 w-6 mx-auto mb-2 text-amber-600" />
              <p className="text-2xl font-bold">{warehouseSummary.related_jobs}</p>
              <p className="text-sm text-muted-foreground">Jobs</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Actions & Documents Summary */}
      <div className="grid grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Actions Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Completed Actions</span>
                <span className="font-medium">{warehouseSummary.actions_completed}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">With Findings</span>
                <span className="font-medium">{warehouseSummary.actions_with_findings}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Documents Linked</span>
                <span className="font-medium">{warehouseSummary.documents_linked}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Emails Linked</span>
                <span className="font-medium">{warehouseSummary.emails_linked}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Investigation Period</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Start Date</span>
                <span className="font-medium">
                  {warehouseSummary.investigation_period?.start
                    ? format(new Date(warehouseSummary.investigation_period.start), "d MMM yyyy")
                    : "Not set"}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">End Date</span>
                <span className="font-medium">
                  {warehouseSummary.investigation_period?.end
                    ? format(new Date(warehouseSummary.investigation_period.end), "d MMM yyyy")
                    : "Not set"}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Generated At</span>
                <span className="font-medium">
                  {format(new Date(warehouseSummary.generated_at), "d MMM yyyy HH:mm")}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Inconsistencies */}
      {warehouseSummary.inconsistencies && warehouseSummary.inconsistencies.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Issues & Inconsistencies ({warehouseSummary.inconsistencies.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {warehouseSummary.inconsistencies.map((issue, idx) => (
                <div
                  key={idx}
                  className={cn(
                    "p-3 rounded-lg border",
                    issue.severity === "high"
                      ? "border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950"
                      : issue.severity === "medium"
                      ? "border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950"
                      : "border-border bg-muted dark:border-border dark:bg-background"
                  )}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <Badge
                          className={cn(
                            issue.severity === "high"
                              ? "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300"
                              : issue.severity === "medium"
                              ? "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300"
                              : "bg-muted text-foreground dark:bg-card dark:text-muted-foreground"
                          )}
                        >
                          {issue.severity}
                        </Badge>
                        <span className="font-medium">{issue.title}</span>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        {issue.description}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Type: {issue.type} | Source: {issue.source}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Refresh Button */}
      <div className="flex justify-end">
        <Button variant="outline" onClick={() => loadWarehouseSummary()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh Warehouse Data
        </Button>
      </div>
    </div>
  );
}

export default CaseWarehouseTab;
