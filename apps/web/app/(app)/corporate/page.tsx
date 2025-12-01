"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Building2,
  AlertTriangle,
  CheckCircle,
  Clock,
  Calendar,
  FileText,
  Users,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  Loader2,
  ExternalLink,
  DollarSign,
  Shield,
} from "lucide-react";
import { api } from "@/lib/api";

interface CompanyHealthIssue {
  id: number;
  company_id: number;
  company_name: string;
  issue_type: string;
  issue_description: string;
  severity: "critical" | "warning" | "info";
  due_date?: string;
  fix_url: string;
}

interface CompanyHealth {
  id: number;
  name: string;
  abn?: string;
  status: "active" | "inactive";
  health_score: number;
  issues_count: number;
  critical_count: number;
  warning_count: number;
  documents_verified: number;
  documents_total: number;
  next_review_date?: string;
  annual_return_due?: string;
  issues: CompanyHealthIssue[];
}

interface CorporateHealthData {
  overall_score: number;
  total_companies: number;
  total_issues: number;
  critical_issues: number;
  companies: CompanyHealth[];
  upcoming_deadlines: {
    company_name: string;
    deadline_type: string;
    due_date: string;
  }[];
}

function getHealthColor(score: number): string {
  if (score >= 90) return "text-green-600";
  if (score >= 70) return "text-yellow-600";
  return "text-red-600";
}

function getSeverityBadge(severity: string) {
  switch (severity) {
    case "critical":
      return <Badge variant="destructive">Critical</Badge>;
    case "warning":
      return <Badge className="bg-yellow-100 text-yellow-700">Warning</Badge>;
    default:
      return <Badge variant="secondary">Info</Badge>;
  }
}

export default function CorporateHealthPage() {
  const router = useRouter();
  const [healthData, setHealthData] = React.useState<CorporateHealthData | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [expandedCompanies, setExpandedCompanies] = React.useState<Set<number>>(new Set());

  const fetchHealthData = React.useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const data = await api.get<CorporateHealthData>("/api/v1/corporate/health");
      setHealthData(data);
    } catch (error) {
      // Mock data
      setHealthData(getMockCorporateHealth());
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  React.useEffect(() => {
    fetchHealthData();
  }, [fetchHealthData]);

  const toggleCompany = (companyId: number) => {
    setExpandedCompanies((prev) => {
      const next = new Set(prev);
      if (next.has(companyId)) {
        next.delete(companyId);
      } else {
        next.add(companyId);
      }
      return next;
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!healthData) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-4">
        <AlertTriangle className="h-12 w-12 text-muted-foreground" />
        <p className="text-muted-foreground">Failed to load corporate health data</p>
        <Button onClick={() => fetchHealthData()}>Retry</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight font-serif">Corporate Health</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Monitor compliance and data quality across your companies
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => fetchHealthData(true)}
          disabled={refreshing}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Overall Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className={`${healthData.overall_score >= 90 ? "bg-green-50 border-green-200" : healthData.overall_score >= 70 ? "bg-yellow-50 border-yellow-200" : "bg-red-50 border-red-200"}`}>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className={`text-4xl font-bold font-mono ${getHealthColor(healthData.overall_score)}`}>
                {healthData.overall_score}%
              </div>
              <div>
                <p className="font-medium">Overall Health</p>
                <Progress value={healthData.overall_score} className="h-2 w-24 mt-1" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Building2 className="h-8 w-8 text-muted-foreground" />
              <div>
                <div className="text-2xl font-bold font-mono">{healthData.total_companies}</div>
                <p className="text-sm text-muted-foreground">Companies</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-8 w-8 text-red-500" />
              <div>
                <div className="text-2xl font-bold font-mono text-red-600">{healthData.critical_issues}</div>
                <p className="text-sm text-muted-foreground">Critical Issues</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Clock className="h-8 w-8 text-orange-500" />
              <div>
                <div className="text-2xl font-bold font-mono text-orange-600">{healthData.total_issues}</div>
                <p className="text-sm text-muted-foreground">Total Issues</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Companies List */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Company Health Status</CardTitle>
              <CardDescription>Click on a company to view issues</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {healthData.companies.map((company) => (
                <Collapsible
                  key={company.id}
                  open={expandedCompanies.has(company.id)}
                  onOpenChange={() => toggleCompany(company.id)}
                >
                  <CollapsibleTrigger asChild>
                    <div className="flex items-center justify-between p-4 rounded-lg border hover:bg-secondary/50 cursor-pointer transition-colors">
                      <div className="flex items-center gap-3">
                        <Building2 className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <p className="font-medium">{company.name}</p>
                          {company.abn && (
                            <p className="text-xs text-muted-foreground">ABN: {company.abn}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        {company.critical_count > 0 && (
                          <Badge variant="destructive">{company.critical_count} critical</Badge>
                        )}
                        {company.warning_count > 0 && (
                          <Badge className="bg-yellow-100 text-yellow-700">
                            {company.warning_count} warnings
                          </Badge>
                        )}
                        {company.issues_count === 0 && (
                          <Badge className="bg-green-100 text-green-700">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            All good
                          </Badge>
                        )}
                        <div className={`text-lg font-bold font-mono ${getHealthColor(company.health_score)}`}>
                          {company.health_score}%
                        </div>
                        {expandedCompanies.has(company.id) ? (
                          <ChevronDown className="h-5 w-5 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-5 w-5 text-muted-foreground" />
                        )}
                      </div>
                    </div>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="mt-2 ml-8 space-y-3">
                      {/* Company Details */}
                      <div className="grid grid-cols-3 gap-4 p-3 bg-secondary/30 rounded-lg text-sm">
                        <div>
                          <p className="text-muted-foreground">Documents</p>
                          <p className="font-medium">
                            {company.documents_verified}/{company.documents_total} verified
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Next Review</p>
                          <p className="font-medium">
                            {company.next_review_date
                              ? new Date(company.next_review_date).toLocaleDateString("en-AU")
                              : "-"}
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Annual Return</p>
                          <p className="font-medium">
                            {company.annual_return_due
                              ? new Date(company.annual_return_due).toLocaleDateString("en-AU")
                              : "-"}
                          </p>
                        </div>
                      </div>

                      {/* Issues */}
                      {company.issues.length > 0 ? (
                        <div className="border rounded-lg overflow-hidden">
                          <Table>
                            <TableBody>
                              {company.issues.map((issue) => (
                                <TableRow key={issue.id}>
                                  <TableCell className="font-medium">{issue.issue_description}</TableCell>
                                  <TableCell>{getSeverityBadge(issue.severity)}</TableCell>
                                  <TableCell className="text-right">
                                    <Button variant="ghost" size="sm" asChild>
                                      <a href={issue.fix_url}>
                                        Fix <ExternalLink className="h-3 w-3 ml-1" />
                                      </a>
                                    </Button>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      ) : (
                        <div className="text-center py-4 text-sm text-muted-foreground">
                          <CheckCircle className="h-5 w-5 mx-auto mb-1 text-green-600" />
                          No issues found
                        </div>
                      )}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Upcoming Deadlines */}
        <div>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Upcoming Deadlines
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {healthData.upcoming_deadlines.length > 0 ? (
                  healthData.upcoming_deadlines.map((deadline, i) => {
                    const daysUntil = Math.ceil(
                      (new Date(deadline.due_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
                    );
                    const isUrgent = daysUntil <= 7;
                    const isWarning = daysUntil <= 30;

                    return (
                      <div
                        key={i}
                        className={`p-3 rounded-lg border ${isUrgent ? "border-red-200 bg-red-50" : isWarning ? "border-yellow-200 bg-yellow-50" : ""}`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium text-sm">{deadline.company_name}</p>
                            <p className="text-xs text-muted-foreground">{deadline.deadline_type}</p>
                          </div>
                          <div className="text-right">
                            <p className={`text-sm font-medium ${isUrgent ? "text-red-600" : isWarning ? "text-yellow-600" : ""}`}>
                              {new Date(deadline.due_date).toLocaleDateString("en-AU")}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {daysUntil} days
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No upcoming deadlines
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

// Mock data
function getMockCorporateHealth(): CorporateHealthData {
  return {
    overall_score: 82,
    total_companies: 5,
    total_issues: 8,
    critical_issues: 2,
    companies: [
      {
        id: 1,
        name: "Acme Corporation Pty Ltd",
        abn: "12 345 678 901",
        status: "active",
        health_score: 95,
        issues_count: 1,
        critical_count: 0,
        warning_count: 1,
        documents_verified: 12,
        documents_total: 14,
        next_review_date: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000).toISOString(),
        annual_return_due: new Date(Date.now() + 120 * 24 * 60 * 60 * 1000).toISOString(),
        issues: [
          {
            id: 1,
            company_id: 1,
            company_name: "Acme Corporation Pty Ltd",
            issue_type: "document_pending",
            issue_description: "2 documents awaiting verification",
            severity: "warning",
            fix_url: "/documents?company=1",
          },
        ],
      },
      {
        id: 2,
        name: "BuildRight Holdings Pty Ltd",
        abn: "23 456 789 012",
        status: "active",
        health_score: 65,
        issues_count: 4,
        critical_count: 2,
        warning_count: 2,
        documents_verified: 8,
        documents_total: 15,
        next_review_date: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
        annual_return_due: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        issues: [
          {
            id: 2,
            company_id: 2,
            company_name: "BuildRight Holdings Pty Ltd",
            issue_type: "review_overdue",
            issue_description: "Annual review is 10 days overdue",
            severity: "critical",
            fix_url: "/companies/2",
          },
          {
            id: 3,
            company_id: 2,
            company_name: "BuildRight Holdings Pty Ltd",
            issue_type: "missing_abn",
            issue_description: "Director ABN not recorded",
            severity: "critical",
            fix_url: "/companies/2/directors",
          },
          {
            id: 4,
            company_id: 2,
            company_name: "BuildRight Holdings Pty Ltd",
            issue_type: "document_pending",
            issue_description: "7 documents awaiting verification",
            severity: "warning",
            fix_url: "/documents?company=2",
          },
          {
            id: 5,
            company_id: 2,
            company_name: "BuildRight Holdings Pty Ltd",
            issue_type: "asic_login",
            issue_description: "ASIC login credentials expiring soon",
            severity: "warning",
            fix_url: "/companies/2/asic",
          },
        ],
      },
      {
        id: 3,
        name: "Smith Family Trust",
        status: "active",
        health_score: 100,
        issues_count: 0,
        critical_count: 0,
        warning_count: 0,
        documents_verified: 6,
        documents_total: 6,
        next_review_date: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
        issues: [],
      },
      {
        id: 4,
        name: "Tekna Projects Pty Ltd",
        abn: "34 567 890 123",
        status: "active",
        health_score: 88,
        issues_count: 2,
        critical_count: 0,
        warning_count: 2,
        documents_verified: 20,
        documents_total: 24,
        next_review_date: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
        annual_return_due: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString(),
        issues: [
          {
            id: 6,
            company_id: 4,
            company_name: "Tekna Projects Pty Ltd",
            issue_type: "document_pending",
            issue_description: "4 documents awaiting verification",
            severity: "warning",
            fix_url: "/documents?company=4",
          },
          {
            id: 7,
            company_id: 4,
            company_name: "Tekna Projects Pty Ltd",
            issue_type: "contact_incomplete",
            issue_description: "Missing registered office address",
            severity: "warning",
            fix_url: "/companies/4",
          },
        ],
      },
      {
        id: 5,
        name: "Property Investments Co",
        abn: "45 678 901 234",
        status: "active",
        health_score: 92,
        issues_count: 1,
        critical_count: 0,
        warning_count: 1,
        documents_verified: 10,
        documents_total: 11,
        next_review_date: new Date(Date.now() + 150 * 24 * 60 * 60 * 1000).toISOString(),
        annual_return_due: new Date(Date.now() + 210 * 24 * 60 * 60 * 1000).toISOString(),
        issues: [
          {
            id: 8,
            company_id: 5,
            company_name: "Property Investments Co",
            issue_type: "document_pending",
            issue_description: "1 document awaiting verification",
            severity: "warning",
            fix_url: "/documents?company=5",
          },
        ],
      },
    ],
    upcoming_deadlines: [
      {
        company_name: "BuildRight Holdings Pty Ltd",
        deadline_type: "Annual Return Due",
        due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        company_name: "Acme Corporation Pty Ltd",
        deadline_type: "Annual Review",
        due_date: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        company_name: "Tekna Projects Pty Ltd",
        deadline_type: "Annual Review",
        due_date: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        company_name: "Smith Family Trust",
        deadline_type: "Annual Review",
        due_date: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
      },
    ],
  };
}
