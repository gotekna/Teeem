"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import {
  RefreshCw,
  Building2,
  Search,
  AlertTriangle,
  XCircle,
  BarChart3,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { BackButton } from "@/components/ui/back-button";

const HEALTH_STATUS_COLORS: Record<string, { bg: string; text: string; border: string; dot: string }> = {
  excellent: { bg: "bg-green-100 dark:bg-green-900/30", text: "text-green-800 dark:text-green-300", border: "border-green-200 dark:border-green-800", dot: "bg-green-500" },
  good: { bg: "bg-blue-100 dark:bg-blue-900/30", text: "text-blue-800 dark:text-blue-300", border: "border-blue-200 dark:border-blue-800", dot: "bg-blue-500" },
  needs_attention: { bg: "bg-yellow-100 dark:bg-yellow-900/30", text: "text-yellow-800 dark:text-yellow-300", border: "border-yellow-200 dark:border-yellow-800", dot: "bg-yellow-500" },
  critical: { bg: "bg-red-100 dark:bg-red-900/30", text: "text-red-800 dark:text-red-300", border: "border-red-200 dark:border-red-800", dot: "bg-red-500" },
};

interface HealthCompany {
  id: number;
  name: string;
  health_score: number;
  health_status: string;
  issues: string[];
  warnings: string[];
  has_acn?: boolean;
  has_abn?: boolean;
  director_count?: number;
}

interface HealthSummary {
  total: number;
  average_score: number;
  excellent: number;
  good: number;
  needs_attention: number;
  critical: number;
}

interface HealthData {
  companies: HealthCompany[];
  summary: HealthSummary;
}

export default function HealthReportPage() {
  const router = useRouter();
  const [healthData, setHealthData] = React.useState<HealthData | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [reloading, setReloading] = React.useState(false);
  const [filter, setFilter] = React.useState("all");
  const [searchQuery, setSearchQuery] = React.useState("");

  React.useEffect(() => {
    loadHealthReport();
  }, []);

  const loadHealthReport = async () => {
    try {
      setLoading(true);
      const response = await api.get<HealthData>("/api/v1/companies/health_report");
      setHealthData(response);
    } catch (error) {
      console.error("Failed to load health report:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleReloadFromSpreadsheet = async () => {
    try {
      setReloading(true);
      await api.post("/api/v1/companies/reload");
      await loadHealthReport();
    } catch (error) {
      console.error("Failed to reload:", error);
    } finally {
      setReloading(false);
    }
  };

  const filteredCompanies = React.useMemo(() => {
    let companies = healthData?.companies || [];

    // Filter by status
    if (filter !== "all") {
      companies = companies.filter((c) => c.health_status === filter);
    }

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      companies = companies.filter((c) => c.name.toLowerCase().includes(query));
    }

    return companies;
  }, [healthData, filter, searchQuery]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Spinner size={32} className="text-muted-foreground" />
      </div>
    );
  }

  const summary = healthData?.summary;

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4">
          <BackButton fallbackHref="/corporate" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight font-serif">Corporate Health Dashboard</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Overview of data completeness and compliance across all companies
            </p>
          </div>
        </div>
        <Button onClick={handleReloadFromSpreadsheet} disabled={reloading}>
          <RefreshCw className={cn("h-4 w-4 mr-2", reloading && "animate-spin")} />
          {reloading ? "Reloading..." : "Reload from Spreadsheet"}
        </Button>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
          <Card className="text-center">
            <CardContent className="p-4">
              <div className="text-3xl font-bold">{summary.total}</div>
              <div className="text-sm text-muted-foreground">Total Companies</div>
            </CardContent>
          </Card>
          <Card className="text-center">
            <CardContent className="p-4">
              <div className="text-3xl font-bold text-primary">{summary.average_score}%</div>
              <div className="text-sm text-muted-foreground">Average Score</div>
            </CardContent>
          </Card>
          <Card
            className={cn("text-center cursor-pointer hover:ring-2 hover:ring-green-500 transition-all", filter === "excellent" && "ring-2 ring-green-500")}
            onClick={() => setFilter(filter === "excellent" ? "all" : "excellent")}
          >
            <CardContent className="p-4">
              <div className="text-3xl font-bold text-green-600">{summary.excellent}</div>
              <div className="text-sm text-muted-foreground">Excellent</div>
            </CardContent>
          </Card>
          <Card
            className={cn("text-center cursor-pointer hover:ring-2 hover:ring-blue-500 transition-all", filter === "good" && "ring-2 ring-blue-500")}
            onClick={() => setFilter(filter === "good" ? "all" : "good")}
          >
            <CardContent className="p-4">
              <div className="text-3xl font-bold text-blue-600">{summary.good}</div>
              <div className="text-sm text-muted-foreground">Good</div>
            </CardContent>
          </Card>
          <Card
            className={cn("text-center cursor-pointer hover:ring-2 hover:ring-yellow-500 transition-all", filter === "needs_attention" && "ring-2 ring-yellow-500")}
            onClick={() => setFilter(filter === "needs_attention" ? "all" : "needs_attention")}
          >
            <CardContent className="p-4">
              <div className="text-3xl font-bold text-yellow-600">{summary.needs_attention}</div>
              <div className="text-sm text-muted-foreground">Needs Attention</div>
            </CardContent>
          </Card>
          <Card
            className={cn("text-center cursor-pointer hover:ring-2 hover:ring-red-500 transition-all", filter === "critical" && "ring-2 ring-red-500")}
            onClick={() => setFilter(filter === "critical" ? "all" : "critical")}
          >
            <CardContent className="p-4">
              <div className="text-3xl font-bold text-red-600">{summary.critical}</div>
              <div className="text-sm text-muted-foreground">Critical</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filter and Search */}
      <div className="flex items-center gap-4">
        {filter !== "all" && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Filtering by:</span>
            <Badge className={cn(HEALTH_STATUS_COLORS[filter]?.bg, HEALTH_STATUS_COLORS[filter]?.text)}>
              {filter.replace("_", " ").toUpperCase()}
            </Badge>
            <Button variant="link" size="sm" onClick={() => setFilter("all")} className="text-primary">
              Clear filter
            </Button>
          </div>
        )}
        <div className="flex-1" />
        <div className="relative w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search companies..."
            className="pl-9"
          />
        </div>
      </div>

      {/* Companies List */}
      <Card>
        <CardContent className="p-0">
          <div className="px-4 py-3 border-b flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            <h3 className="font-medium">All Companies ({filteredCompanies.length})</h3>
          </div>
          <div className="divide-y">
            {filteredCompanies.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                {searchQuery ? "No companies match your search." : "No companies found."}
              </div>
            ) : (
              filteredCompanies.map((company) => {
                const colors = HEALTH_STATUS_COLORS[company.health_status] || HEALTH_STATUS_COLORS.critical;
                return (
                  <div
                    key={company.id}
                    className="px-4 py-4 hover:bg-muted/50 cursor-pointer"
                    onClick={() => router.push(`/corporate/companies/${company.id}/health`)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center min-w-0">
                        <Building2 className="h-8 w-8 text-muted-foreground mr-3" />
                        <div>
                          <p className="text-sm font-medium text-primary truncate">{company.name}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge className={cn(colors.bg, colors.text, "text-xs")}>
                              {company.health_status.replace("_", " ")}
                            </Badge>
                            {company.issues.length > 0 && (
                              <span className="text-xs text-red-600">
                                {company.issues.length} issue{company.issues.length !== 1 ? "s" : ""}
                              </span>
                            )}
                            {company.warnings.length > 0 && (
                              <span className="text-xs text-yellow-600">
                                {company.warnings.length} warning{company.warnings.length !== 1 ? "s" : ""}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        {/* Health Score Bar */}
                        <div className="w-32 hidden sm:block">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 bg-muted rounded-full h-2">
                              <div
                                className={cn("h-2 rounded-full", colors.dot)}
                                style={{ width: `${company.health_score}%` }}
                              />
                            </div>
                            <span className="text-sm font-medium w-10 text-right">{company.health_score}%</span>
                          </div>
                        </div>
                        {/* Quick Stats */}
                        <div className="hidden md:flex items-center gap-3 text-xs text-muted-foreground">
                          <span className={company.has_acn ? "text-green-600" : "text-red-500"}>
                            ACN {company.has_acn ? "✓" : "✗"}
                          </span>
                          <span className={company.has_abn ? "text-green-600" : "text-red-500"}>
                            ABN {company.has_abn ? "✓" : "✗"}
                          </span>
                          <span className={(company.director_count || 0) > 0 ? "text-green-600" : "text-red-500"}>
                            Directors: {company.director_count || 0}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Issues & Warnings Preview */}
                    {(company.issues.length > 0 || company.warnings.length > 0) && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {company.issues.slice(0, 3).map((issue, idx) => (
                          <span key={idx} className="inline-flex items-center rounded bg-red-50 dark:bg-red-900/20 px-1.5 py-0.5 text-xs text-red-700 dark:text-red-300">
                            <XCircle className="h-3 w-3 mr-0.5" />
                            {issue}
                          </span>
                        ))}
                        {company.warnings.slice(0, 2).map((warning, idx) => (
                          <span key={idx} className="inline-flex items-center rounded bg-yellow-50 dark:bg-yellow-900/20 px-1.5 py-0.5 text-xs text-yellow-700 dark:text-yellow-300">
                            <AlertTriangle className="h-3 w-3 mr-0.5" />
                            {warning}
                          </span>
                        ))}
                        {(company.issues.length > 3 || company.warnings.length > 2) && (
                          <span className="text-xs text-muted-foreground">
                            +{Math.max(0, company.issues.length - 3) + Math.max(0, company.warnings.length - 2)} more
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
