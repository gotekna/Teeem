"use client";

/**
 * CaseOverviewTab - Overview dashboard for a case
 *
 * Shows parent case dashboard with sub-case summary, child cases list,
 * case details, primary entity, statistics, and risk assessment.
 *
 * Extracted from cases/[id]/page.tsx for maintainability.
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  FolderTree,
  Activity,
  CheckCircle,
  AlertTriangle,
  ChevronRight,
  ExternalLink,
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface ChildCase {
  id: number;
  case_number: string;
  title: string;
  status: string;
  formatted_status: string;
  overdue: boolean;
}

interface ChildCasesSummary {
  total: number;
  open: number;
  closed: number;
  overdue: number;
}

interface CaseData {
  id: number;
  case_number: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  case_type: string | null;
  has_children: boolean;
  is_child_case: boolean;
  child_cases_summary: ChildCasesSummary | null;
  child_cases: ChildCase[] | null;
  child_cases_count: number;
  investigation_start_date: string | null;
  investigation_end_date: string | null;
  created_by: string | null;
  key_findings: unknown[] | null;
  contact_id: number | null;
  contact_name: string | null;
  company_id: number | null;
  company_name: string | null;
  actions_count: number;
  documents_count: number;
  emails_count: number;
  timeline_events_count: number;
  contacts_count: number;
  companies_count: number;
  risk_score: number | null;
}

interface CaseOverviewTabProps {
  caseData: CaseData;
  onCreateSubCase: () => void;
  onViewAllMatters: () => void;
}

function getStatusColor(status: string) {
  switch (status) {
    case "draft":
      return "bg-muted text-foreground dark:bg-card dark:text-muted-foreground";
    case "open":
    case "active":
      return "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 dark:bg-blue-900 dark:text-blue-100";
    case "in_progress":
    case "reviewing":
      return "bg-status-warning text-status-warning-foreground dark:bg-amber-900 dark:text-amber-100";
    case "on_hold":
    case "pending":
      return "bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300 dark:bg-orange-900 dark:text-orange-100";
    case "closed":
    case "resolved":
      return "bg-status-success text-status-success-foreground dark:bg-green-900 dark:text-green-100";
    case "archived":
      return "bg-muted text-foreground dark:bg-slate-800 dark:text-muted-foreground";
    default:
      return "bg-muted text-foreground dark:bg-card dark:text-muted-foreground";
  }
}

export function CaseOverviewTab({ caseData, onCreateSubCase, onViewAllMatters }: CaseOverviewTabProps) {
  const router = useRouter();

  return (
    <div className="space-y-6">
      {/* Parent Case Dashboard - shown when this is a parent/master case */}
      {(caseData.has_children || !caseData.is_child_case) && caseData.child_cases_summary && (
        <div className="space-y-6">
          {/* Sub-case Status Summary Cards */}
          <div className="grid grid-cols-4 gap-4">
            <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950/50 dark:to-blue-900/30 border-blue-200">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-blue-600 dark:text-blue-400">Total Matters</p>
                    <p className="text-3xl font-bold text-blue-700 dark:text-blue-300">
                      {caseData.child_cases_summary.total}
                    </p>
                  </div>
                  <FolderTree className="h-8 w-8 text-blue-500 dark:text-blue-400 opacity-50" />
                </div>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-950/50 dark:to-amber-900/30 border-amber-200">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-amber-600 dark:text-amber-400">Open</p>
                    <p className="text-3xl font-bold text-amber-700 dark:text-amber-300">
                      {caseData.child_cases_summary.open}
                    </p>
                  </div>
                  <Activity className="h-8 w-8 text-amber-500 opacity-50" />
                </div>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950/50 dark:to-green-900/30 border-green-200">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-green-600 dark:text-green-400">Closed</p>
                    <p className="text-3xl font-bold text-green-700 dark:text-green-300">
                      {caseData.child_cases_summary.closed}
                    </p>
                  </div>
                  <CheckCircle className="h-8 w-8 text-green-500 dark:text-green-400 opacity-50" />
                </div>
              </CardContent>
            </Card>
            <Card className={cn(
              "border",
              caseData.child_cases_summary.overdue > 0
                ? "bg-gradient-to-br from-red-50 to-red-100 dark:from-red-950/50 dark:to-red-900/30 border-red-200"
                : "bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950/50 dark:to-slate-900/30 border-border"
            )}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className={cn(
                      "text-sm font-medium",
                      caseData.child_cases_summary.overdue > 0 ? "text-red-600 dark:text-red-400" : "text-muted-foreground dark:text-muted-foreground"
                    )}>Overdue</p>
                    <p className={cn(
                      "text-3xl font-bold",
                      caseData.child_cases_summary.overdue > 0 ? "text-red-700 dark:text-red-300" : "text-foreground dark:text-muted-foreground"
                    )}>
                      {caseData.child_cases_summary.overdue}
                    </p>
                  </div>
                  <AlertTriangle className={cn(
                    "h-8 w-8 opacity-50",
                    caseData.child_cases_summary.overdue > 0 ? "text-red-500 dark:text-red-400" : "text-muted-foreground"
                  )} />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Active Sub-cases List */}
          {caseData.child_cases && caseData.child_cases.length > 0 && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-lg">Active Matters</CardTitle>
                <Button size="sm" onClick={onCreateSubCase}>
                  <Plus className="h-4 w-4 mr-1" />
                  New Matter
                </Button>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {caseData.child_cases
                    .filter(c => c.status !== 'closed' && c.status !== 'archived')
                    .slice(0, 5)
                    .map((child) => (
                    <div
                      key={child.id}
                      className={cn(
                        "flex items-center justify-between p-3 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors",
                        child.overdue && "border-red-300 bg-red-50 dark:bg-red-950/20"
                      )}
                      onClick={() => router.push(`/cases/${child.id}`)}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs text-muted-foreground">
                              {child.case_number}
                            </span>
                            {child.overdue && (
                              <Badge className="bg-status-error text-status-error-foreground text-xs">
                                <AlertTriangle className="h-3 w-3 mr-1" />
                                Overdue
                              </Badge>
                            )}
                          </div>
                          <p className="font-medium truncate">{child.title}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className={getStatusColor(child.status)}>
                          {child.formatted_status}
                        </Badge>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </div>
                  ))}
                  {caseData.child_cases.filter(c => c.status !== 'closed' && c.status !== 'archived').length > 5 && (
                    <Button
                      variant="ghost"
                      className="w-full"
                      onClick={onViewAllMatters}
                    >
                      View all {caseData.child_cases.filter(c => c.status !== 'closed' && c.status !== 'archived').length} active matters
                    </Button>
                  )}
                  {caseData.child_cases.filter(c => c.status !== 'closed' && c.status !== 'archived').length === 0 && (
                    <div className="text-center py-6 text-muted-foreground">
                      <CheckCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p>All matters resolved</p>
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-2"
                        onClick={onCreateSubCase}
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        Create New Matter
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* No sub-cases yet - prompt to create first one */}
          {(!caseData.child_cases || caseData.child_cases.length === 0) && (
            <Card className="border-dashed">
              <CardContent className="py-12 text-center">
                <FolderTree className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                <h3 className="text-lg font-medium mb-2">No Matters Yet</h3>
                <p className="text-muted-foreground mb-4">
                  This is your client file. Create your first matter to start tracking specific issues.
                </p>
                <Button onClick={onCreateSubCase}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create First Matter
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Standard Case Details Grid */}
      <div className="grid grid-cols-3 gap-6">
        {/* Main Info */}
        <Card className="col-span-2">
          <CardHeader>
            <CardTitle>
              {caseData.has_children || !caseData.is_child_case ? "Client File Details" : "Case Details"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {caseData.description && (
              <div>
                <label className="text-sm font-medium text-muted-foreground">Description</label>
                <p className="mt-1">{caseData.description}</p>
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground">
                  Investigation Period
                </label>
                <p className="mt-1">
                  {caseData.investigation_start_date && caseData.investigation_end_date
                    ? `${format(new Date(caseData.investigation_start_date), "d MMM yyyy")} - ${format(
                        new Date(caseData.investigation_end_date),
                        "d MMM yyyy"
                      )}`
                    : "Not specified"}
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Created By</label>
                <p className="mt-1">{caseData.created_by || "Unknown"}</p>
              </div>
            </div>
            {caseData.key_findings && caseData.key_findings.length > 0 && (
              <div>
                <label className="text-sm font-medium text-muted-foreground">Key Findings</label>
                <ul className="mt-1 list-disc list-inside space-y-1">
                  {caseData.key_findings.map((finding, idx) => (
                    <li key={idx}>{String(finding)}</li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Side Panel */}
        <div className="space-y-4">
          {/* Primary Entity */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Primary Entity</CardTitle>
            </CardHeader>
            <CardContent>
              {caseData.contact_name && (
                <div className="flex items-center justify-between">
                  <span>{caseData.contact_name}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => router.push(`/contacts/${caseData.contact_id}`)}
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                </div>
              )}
              {caseData.company_name && (
                <div className="flex items-center justify-between">
                  <span>{caseData.company_name}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => router.push(`/corporate/companies/${caseData.company_id}`)}
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                </div>
              )}
              {!caseData.contact_name && !caseData.company_name && (
                <p className="text-muted-foreground text-sm">No primary entity</p>
              )}
            </CardContent>
          </Card>

          {/* Stats */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {caseData.has_children ? "File Statistics" : "Case Statistics"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                {caseData.has_children && (
                  <div className="flex justify-between font-medium border-b pb-2 mb-2">
                    <span className="text-muted-foreground">Sub-cases</span>
                    <span>{caseData.child_cases_count}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Actions Run</span>
                  <span className="font-medium">{caseData.actions_count}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Documents</span>
                  <span className="font-medium">{caseData.documents_count}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Emails</span>
                  <span className="font-medium">{caseData.emails_count}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Timeline Events</span>
                  <span className="font-medium">{caseData.timeline_events_count}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Related Contacts</span>
                  <span className="font-medium">{caseData.contacts_count}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Related Companies</span>
                  <span className="font-medium">{caseData.companies_count}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Risk Score */}
          {caseData.risk_score !== null && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Risk Assessment</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4">
                  <div
                    className={cn(
                      "text-3xl font-bold",
                      caseData.risk_score >= 70
                        ? "text-red-600 dark:text-red-400"
                        : caseData.risk_score >= 40
                        ? "text-amber-600"
                        : "text-green-600 dark:text-green-400"
                    )}
                  >
                    {caseData.risk_score}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {caseData.risk_score >= 70
                      ? "High Risk"
                      : caseData.risk_score >= 40
                      ? "Medium Risk"
                      : "Low Risk"}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

export default CaseOverviewTab;
