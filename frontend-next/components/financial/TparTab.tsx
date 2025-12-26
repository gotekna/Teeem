"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
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
  FileText,
  Building2,
  Send,
  Eye,
  CheckCircle,
  Clock,
  AlertCircle,
  Users,
  DollarSign,
} from "lucide-react";
import { api } from "@/lib/api";

interface TparReport {
  id: number;
  financial_year: string;
  status: string;
  payee_count: number;
  total_gross: number;
  total_gst: number;
  generated_at: string;
  submitted_at: string | null;
  lodged_at: string | null;
  lodgement_reference: string | null;
  created_at: string;
}

interface TparPayee {
  id: number;
  contact: { id: number; name: string; abn: string };
  payment_count: number;
  gross_paid: number;
  gst_paid: number;
}

interface TparPreview {
  financial_year: string;
  period: { start: string; end: string };
  payees: TparPayee[];
  totals: {
    payee_count: number;
    total_gross: number;
    total_gst: number;
  };
}

interface Contractor {
  id: number;
  name: string;
  abn: string;
  tpar_required: boolean;
  tpar_industry_code: string | null;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    minimumFractionDigits: 2,
  }).format(amount);
}

function formatDate(dateString: string | null): string {
  if (!dateString) return "-";
  return new Date(dateString).toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function TparTab() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [reports, setReports] = useState<TparReport[]>([]);
  const [preview, setPreview] = useState<TparPreview | null>(null);
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [selectedYear, setSelectedYear] = useState<string>("");
  const [activeView, setActiveView] = useState<"reports" | "preview" | "contractors">("reports");

  const getCurrentFinancialYear = () => {
    const today = new Date();
    const year = today.getMonth() >= 6 ? today.getFullYear() : today.getFullYear() - 1;
    return `${year}-${year + 1}`;
  };

  const fetchData = useCallback(async () => {
    try {
      const [reportsRes, contractorsRes] = await Promise.all([
        api.get<{ success: boolean; data: TparReport[] }>("/api/v1/gl/tpar"),
        api.get<{ success: boolean; data: Contractor[] }>("/api/v1/gl/tpar/contractors"),
      ]);

      if (reportsRes?.success) setReports(reportsRes.data || []);
      if (contractorsRes?.success) setContractors(contractorsRes.data || []);

      if (!selectedYear) {
        setSelectedYear(getCurrentFinancialYear());
      }
    } catch (error) {
      console.error("Failed to fetch TPAR data:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedYear]);

  const fetchPreview = useCallback(async () => {
    if (!selectedYear) return;

    try {
      const res = await api.get<{ success: boolean; data: TparPreview }>(`/api/v1/gl/tpar/preview?financial_year=${selectedYear}`);
      if (res?.success) setPreview(res.data || null);
    } catch (error) {
      console.error("Failed to fetch preview:", error);
    }
  }, [selectedYear]);

  useEffect(() => {
    setLoading(true);
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (activeView === "preview" && selectedYear) {
      fetchPreview();
    }
  }, [activeView, selectedYear, fetchPreview]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchData();
    if (activeView === "preview") {
      fetchPreview();
    }
  };

  const handleGenerate = async () => {
    try {
      await api.post("/api/v1/gl/tpar/generate", { financial_year: selectedYear });
      fetchData();
    } catch (error) {
      console.error("Failed to generate report:", error);
    }
  };

  const handleSubmit = async (report: TparReport) => {
    try {
      await api.post(`/api/v1/gl/tpar/${report.id}/submit`);
      fetchData();
    } catch (error) {
      console.error("Failed to submit report:", error);
    }
  };

  const handleLodge = async (report: TparReport) => {
    const reference = prompt("Enter ATO lodgement reference:");
    if (!reference) return;

    try {
      await api.post(`/api/v1/gl/tpar/${report.id}/lodge`, { reference });
      fetchData();
    } catch (error) {
      console.error("Failed to lodge report:", error);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "draft":
        return (
          <Badge variant="outline">
            <Clock className="h-3 w-3 mr-1" />
            Draft
          </Badge>
        );
      case "submitted":
        return (
          <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
            <Send className="h-3 w-3 mr-1" />
            Submitted
          </Badge>
        );
      case "lodged":
        return (
          <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
            <CheckCircle className="h-3 w-3 mr-1" />
            Lodged
          </Badge>
        );
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  const lodgedCount = reports.filter(r => r.status === "lodged").length;
  const draftCount = reports.filter(r => r.status === "draft").length;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Reports
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{reports.length}</div>
            <p className="text-xs text-muted-foreground mt-1">financial years</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Lodged
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{lodgedCount}</div>
            <p className="text-xs text-muted-foreground mt-1">with ATO</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Draft
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{draftCount}</div>
            <p className="text-xs text-muted-foreground mt-1">pending review</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Contractors
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{contractors.length}</div>
            <p className="text-xs text-muted-foreground mt-1">TPAR required</p>
          </CardContent>
        </Card>
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <Button
            variant={activeView === "reports" ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveView("reports")}
          >
            <FileText className="h-4 w-4 mr-2" />
            Reports
          </Button>
          <Button
            variant={activeView === "preview" ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveView("preview")}
          >
            <Eye className="h-4 w-4 mr-2" />
            Preview
          </Button>
          <Button
            variant={activeView === "contractors" ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveView("contractors")}
          >
            <Users className="h-4 w-4 mr-2" />
            Contractors
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Select value={selectedYear} onValueChange={setSelectedYear}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Select Year" />
            </SelectTrigger>
            <SelectContent>
              {[0, 1, 2, 3, 4].map((offset) => {
                const today = new Date();
                const year = today.getMonth() >= 6 ? today.getFullYear() - offset : today.getFullYear() - 1 - offset;
                const fy = `${year}-${year + 1}`;
                return (
                  <SelectItem key={fy} value={fy}>
                    FY {year}/{year + 1}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={handleRefresh} disabled={refreshing}>
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Reports View */}
      {activeView === "reports" && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              TPAR Reports
            </CardTitle>
            <Button onClick={handleGenerate} size="sm">
              Generate {selectedYear}
            </Button>
          </CardHeader>
          <CardContent>
            {reports.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium">No TPAR reports</p>
                <p className="text-sm mt-1">Generate a report to lodge with the ATO</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Financial Year</TableHead>
                    <TableHead className="text-right">Payees</TableHead>
                    <TableHead className="text-right">Gross Paid</TableHead>
                    <TableHead className="text-right">GST Paid</TableHead>
                    <TableHead>Generated</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reports.map((report) => (
                    <TableRow key={report.id}>
                      <TableCell className="font-medium">{report.financial_year}</TableCell>
                      <TableCell className="text-right">{report.payee_count}</TableCell>
                      <TableCell className="text-right">{formatCurrency(report.total_gross)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(report.total_gst)}</TableCell>
                      <TableCell>{formatDate(report.generated_at)}</TableCell>
                      <TableCell className="text-center">
                        {getStatusBadge(report.status)}
                        {report.lodgement_reference && (
                          <div className="text-xs text-muted-foreground mt-1">
                            Ref: {report.lodgement_reference}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {report.status === "draft" && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleSubmit(report)}
                            >
                              <Send className="h-4 w-4 mr-1" />
                              Submit
                            </Button>
                          )}
                          {report.status === "submitted" && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleLodge(report)}
                            >
                              <CheckCircle className="h-4 w-4 mr-1" />
                              Lodge
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {/* Preview View */}
      {activeView === "preview" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              TPAR Preview - {selectedYear}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {preview ? (
              <>
                <div className="grid grid-cols-3 gap-4 mb-6">
                  <div className="p-4 rounded-lg bg-muted">
                    <div className="text-sm text-muted-foreground">Total Payees</div>
                    <div className="text-xl font-bold">{preview.totals.payee_count}</div>
                  </div>
                  <div className="p-4 rounded-lg bg-muted">
                    <div className="text-sm text-muted-foreground">Total Gross</div>
                    <div className="text-xl font-bold">{formatCurrency(preview.totals.total_gross)}</div>
                  </div>
                  <div className="p-4 rounded-lg bg-muted">
                    <div className="text-sm text-muted-foreground">Total GST</div>
                    <div className="text-xl font-bold">{formatCurrency(preview.totals.total_gst)}</div>
                  </div>
                </div>

                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Contractor</TableHead>
                      <TableHead>ABN</TableHead>
                      <TableHead className="text-right">Payments</TableHead>
                      <TableHead className="text-right">Gross Paid</TableHead>
                      <TableHead className="text-right">GST Paid</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {preview.payees.map((payee) => (
                      <TableRow key={payee.id}>
                        <TableCell className="font-medium">{payee.contact.name}</TableCell>
                        <TableCell>{payee.contact.abn}</TableCell>
                        <TableCell className="text-right">{payee.payment_count}</TableCell>
                        <TableCell className="text-right">{formatCurrency(payee.gross_paid)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(payee.gst_paid)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <AlertCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No contractors with payments in this period</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Contractors View */}
      {activeView === "contractors" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              TPAR Contractors
            </CardTitle>
          </CardHeader>
          <CardContent>
            {contractors.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium">No contractors marked for TPAR</p>
                <p className="text-sm mt-1">Mark contractors in Contact settings to include them in TPAR</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Contractor</TableHead>
                    <TableHead>ABN</TableHead>
                    <TableHead>Industry Code</TableHead>
                    <TableHead className="text-center">TPAR Required</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {contractors.map((contractor) => (
                    <TableRow key={contractor.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-muted-foreground" />
                          {contractor.name}
                        </div>
                      </TableCell>
                      <TableCell>{contractor.abn || "-"}</TableCell>
                      <TableCell>{contractor.tpar_industry_code || "-"}</TableCell>
                      <TableCell className="text-center">
                        {contractor.tpar_required ? (
                          <CheckCircle className="h-5 w-5 text-green-600 mx-auto" />
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
