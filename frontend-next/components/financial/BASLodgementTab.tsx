"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Spinner } from "@/components/ui/spinner";
import {
  RefreshCw,
  FileText,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Send,
  Download,
  Calendar,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Building2,
  Clock,
  ArrowRight,
  FileSpreadsheet,
  History,
  Shield,
  AlertCircle,
  ExternalLink,
  BarChart3,
} from "lucide-react";
import { api } from "@/lib/api";

interface Period {
  quarter: string;
  financial_year: string;
  label: string;
  start_date: string;
  end_date: string;
  due_date: string;
}

interface GSTSection {
  g1_total_sales: number;
  g9_gst_on_sales: number;
  g12_total_purchases: number;
  g20_gst_on_purchases: number;
  label_1a_gst_on_sales: number;
  label_1b_gst_on_purchases: number;
  net_gst: number;
  by_tax_type?: {
    sales: Record<string, { total: number; count: number }>;
    purchases: Record<string, { total: number; count: number }>;
  };
}

interface PAYGWithholding {
  w1_gross_wages: number;
  w2_tax_withheld: number;
  w3_other_payments: number;
  w4_total_withheld: number;
}

interface PAYGInstalments {
  t7_instalment_income: number;
  t8_instalment_rate: number;
  t9_instalment_amount: number;
  t11_credit_variations: number;
}

interface BASSummary {
  total_payable_to_ato: number;
  total_refund_due: number;
  net_amount: number;
  due_date: string;
  days_until_due: number;
}

interface Validation {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

interface BASData {
  bas_period: Period;
  generated_at: string;
  gst_section: GSTSection;
  payg_withholding: PAYGWithholding;
  payg_instalments: PAYGInstalments;
  summary: BASSummary;
  validation: Validation;
  reconciliation: {
    overall_status: string;
    gst: { status: string; variance: number };
  };
}

interface Lodgement {
  id: number;
  period: string;
  period_code: string;
  period_year: number;
  status: string;
  is_amendment: boolean;
  lodgement_reference: string | null;
  lodged_at: string | null;
  lodged_by: string | null;
  net_amount: number;
  gst_payable: number;
  can_amend: boolean;
  created_at: string;
}

interface SBRStatus {
  sbr_configured: boolean;
  sbr_environment: string | null;
  company_abn: boolean;
  can_lodge: boolean;
  setup_guide: string;
  missing_config: string[];
}

interface ChartDataPoint {
  period: string;
  gst_collected: number;
  gst_paid: number;
  net_gst: number;
}

export default function BASLodgementTab() {
  const [loading, setLoading] = useState(true);
  const [periods, setPeriods] = useState<Period[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<Period | null>(null);
  const [basData, setBASData] = useState<BASData | null>(null);
  const [lodgements, setLodgements] = useState<Lodgement[]>([]);
  const [sbrStatus, setSBRStatus] = useState<SBRStatus | null>(null);
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [activeView, setActiveView] = useState<"prepare" | "history" | "trend">("prepare");
  const [showLodgeDialog, setShowLodgeDialog] = useState(false);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [lodging, setLodging] = useState(false);
  const [exporting, setExporting] = useState(false);

  const fetchPeriods = useCallback(async () => {
    try {
      const response = await api.get<{
        success: boolean;
        data: { periods: Period[]; current_period: Period | null };
      }>("/api/v1/gl/bas/periods");
      if (response.success) {
        setPeriods(response.data.periods);
        if (response.data.current_period) {
          setSelectedPeriod(response.data.current_period);
        } else if (response.data.periods.length > 0) {
          setSelectedPeriod(response.data.periods[0]);
        }
      }
    } catch (error) {
      console.error("Failed to fetch periods:", error);
    }
  }, []);

  const fetchBASData = useCallback(async () => {
    if (!selectedPeriod) return;
    setLoading(true);
    try {
      const response = await api.get<{ success: boolean; data: BASData }>("/api/v1/gl/bas", {
        params: {
          quarter: selectedPeriod.quarter,
          financial_year: selectedPeriod.financial_year,
        },
      });
      if (response.success) {
        setBASData(response.data);
      }
    } catch (error) {
      console.error("Failed to fetch BAS data:", error);
    } finally {
      setLoading(false);
    }
  }, [selectedPeriod]);

  const fetchLodgements = useCallback(async () => {
    try {
      const response = await api.get<{
        success: boolean;
        data: { lodgements: Lodgement[]; sbr_configured: boolean };
      }>("/api/v1/gl/bas/lodgements");
      if (response.success) {
        setLodgements(response.data.lodgements);
        setSBRStatus({
          sbr_configured: response.data.sbr_configured,
          sbr_environment: null,
          company_abn: true,
          can_lodge: response.data.sbr_configured,
          setup_guide: "TEEEM_DOCS/ATO_SBR_INTEGRATION_GUIDE.md",
          missing_config: [],
        });
      }
    } catch (error) {
      console.error("Failed to fetch lodgements:", error);
    }
  }, []);

  const fetchSBRStatus = useCallback(async () => {
    try {
      const response = await api.get<{ success: boolean; data: SBRStatus }>(
        "/api/v1/gl/bas/sbr_status"
      );
      if (response.success) {
        setSBRStatus(response.data);
      }
    } catch (error) {
      console.error("Failed to fetch SBR status:", error);
    }
  }, []);

  const fetchChartData = useCallback(async () => {
    try {
      const response = await api.get<{
        success: boolean;
        data: { quarterly_trend: ChartDataPoint[] };
      }>("/api/v1/gl/bas/chart_data");
      if (response.success) {
        setChartData(response.data.quarterly_trend);
      }
    } catch (error) {
      console.error("Failed to fetch chart data:", error);
    }
  }, []);

  useEffect(() => {
    fetchPeriods();
    fetchLodgements();
    fetchSBRStatus();
    fetchChartData();
  }, [fetchPeriods, fetchLodgements, fetchSBRStatus, fetchChartData]);

  useEffect(() => {
    if (selectedPeriod) {
      fetchBASData();
    }
  }, [selectedPeriod, fetchBASData]);

  const handleMarkLodged = async () => {
    if (!selectedPeriod) return;
    setLodging(true);
    try {
      const response = await api.post<{ success: boolean; data: Lodgement }>(
        "/api/v1/gl/bas/mark_lodged",
        {
          quarter: selectedPeriod.quarter,
          financial_year: selectedPeriod.financial_year,
        }
      );
      if (response?.success) {
        setShowLodgeDialog(false);
        fetchLodgements();
        fetchBASData();
      }
    } catch (error) {
      console.error("Failed to mark as lodged:", error);
    } finally {
      setLodging(false);
    }
  };

  const handleLodgeToATO = async () => {
    if (!selectedPeriod) return;
    setLodging(true);
    try {
      const response = await api.post<{ success: boolean; data: Lodgement; error?: string }>(
        "/api/v1/gl/bas/lodge_to_ato",
        {
          quarter: selectedPeriod.quarter,
          financial_year: selectedPeriod.financial_year,
        }
      );
      if (response?.success) {
        setShowLodgeDialog(false);
        fetchLodgements();
        fetchBASData();
      } else {
        alert(response?.error || "Lodgement failed");
      }
    } catch (error) {
      console.error("Failed to lodge to ATO:", error);
    } finally {
      setLodging(false);
    }
  };

  const handleExport = async (format: "csv" | "pdf" | "json") => {
    if (!selectedPeriod) return;
    setExporting(true);
    try {
      const response = await api.post<{
        success: boolean;
        data: { format: string; content?: string; filename?: string };
      }>("/api/v1/gl/bas/export", {
        quarter: selectedPeriod.quarter,
        financial_year: selectedPeriod.financial_year,
        format,
      });
      if (response?.success) {
        if (format === "csv" && response.data.content) {
          const blob = new Blob([response.data.content], { type: "text/csv" });
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = response.data.filename || "BAS_Export.csv";
          a.click();
          window.URL.revokeObjectURL(url);
        }
        setShowExportDialog(false);
      }
    } catch (error) {
      console.error("Failed to export:", error);
    } finally {
      setExporting(false);
    }
  };

  const formatCurrency = (amount: number) => {
    const formatted = new Intl.NumberFormat("en-AU", {
      style: "currency",
      currency: "AUD",
    }).format(Math.abs(amount));
    return amount < 0 ? `-${formatted}` : formatted;
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      lodged: "default",
      pending: "secondary",
      failed: "destructive",
      error: "destructive",
      cancelled: "outline",
    };
    return <Badge variant={variants[status] || "secondary"}>{status}</Badge>;
  };

  const getValidationIcon = (valid: boolean) => {
    return valid ? (
      <CheckCircle className="h-5 w-5 text-green-500" />
    ) : (
      <AlertTriangle className="h-5 w-5 text-yellow-500" />
    );
  };

  // Calculate max for chart scaling
  const maxChartValue = Math.max(
    ...chartData.map((d) => Math.max(d.gst_collected, d.gst_paid, Math.abs(d.net_gst)))
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <FileText className="h-6 w-6" />
            BAS Lodgement
          </h2>
          <p className="text-muted-foreground">
            Business Activity Statement preparation and lodgement
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select
            value={selectedPeriod?.label || ""}
            onValueChange={(value) => {
              const period = periods.find((p) => p.label === value);
              if (period) setSelectedPeriod(period);
            }}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Select period" />
            </SelectTrigger>
            <SelectContent>
              {periods.map((period) => (
                <SelectItem key={period.label} value={period.label}>
                  {period.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={() => fetchBASData()}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* SBR Status Banner */}
      {sbrStatus && !sbrStatus.sbr_configured && (
        <Card className="border-yellow-500 bg-yellow-50 dark:bg-yellow-950/20">
          <CardContent className="py-4">
            <div className="flex items-center gap-4">
              <AlertCircle className="h-5 w-5 text-yellow-600" />
              <div className="flex-1">
                <p className="font-medium text-yellow-800 dark:text-yellow-200">
                  SBR Not Configured
                </p>
                <p className="text-sm text-yellow-700 dark:text-yellow-300">
                  Direct ATO lodgement requires SBR registration. You can still prepare and
                  manually lodge via the ATO portal.
                </p>
              </div>
              <Button variant="outline" size="sm" asChild>
                <a
                  href="https://softwaredevelopers.ato.gov.au/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2"
                >
                  <ExternalLink className="h-4 w-4" />
                  ATO Developer Portal
                </a>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* View Tabs */}
      <Tabs value={activeView} onValueChange={(v) => setActiveView(v as typeof activeView)}>
        <TabsList>
          <TabsTrigger value="prepare" className="flex items-center gap-2">
            <FileSpreadsheet className="h-4 w-4" />
            Prepare BAS
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-2">
            <History className="h-4 w-4" />
            Lodgement History
          </TabsTrigger>
          <TabsTrigger value="trend" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Trends
          </TabsTrigger>
        </TabsList>

        {/* Prepare BAS View */}
        <TabsContent value="prepare" className="space-y-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Spinner className="h-8 w-8" />
            </div>
          ) : basData ? (
            <>
              {/* Stats Cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      1A - GST on Sales
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-red-600">
                      {formatCurrency(basData.gst_section.label_1a_gst_on_sales)}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Total: {formatCurrency(basData.gst_section.g1_total_sales)}
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      1B - GST on Purchases
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-green-600">
                      {formatCurrency(basData.gst_section.label_1b_gst_on_purchases)}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Total: {formatCurrency(basData.gst_section.g12_total_purchases)}
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Net GST
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div
                      className={`text-2xl font-bold ${basData.gst_section.net_gst >= 0 ? "text-red-600" : "text-green-600"}`}
                    >
                      {formatCurrency(basData.gst_section.net_gst)}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {basData.gst_section.net_gst >= 0 ? "Payable to ATO" : "Refund due"}
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Due Date
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold flex items-center gap-2">
                      <Calendar className="h-5 w-5 text-muted-foreground" />
                      {new Date(basData.summary.due_date).toLocaleDateString("en-AU", {
                        day: "numeric",
                        month: "short",
                      })}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {basData.summary.days_until_due > 0
                        ? `${basData.summary.days_until_due} days remaining`
                        : "Overdue"}
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Validation Status */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="h-5 w-5" />
                    Validation Status
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-4">
                    {getValidationIcon(basData.validation.valid)}
                    <div className="flex-1">
                      <p className="font-medium">
                        {basData.validation.valid
                          ? "Ready to lodge"
                          : "Validation issues found"}
                      </p>
                      {basData.validation.errors.length > 0 && (
                        <ul className="mt-2 space-y-1">
                          {basData.validation.errors.map((error, i) => (
                            <li key={i} className="text-sm text-red-600 flex items-center gap-2">
                              <XCircle className="h-4 w-4" />
                              {error}
                            </li>
                          ))}
                        </ul>
                      )}
                      {basData.validation.warnings.length > 0 && (
                        <ul className="mt-2 space-y-1">
                          {basData.validation.warnings.map((warning, i) => (
                            <li
                              key={i}
                              className="text-sm text-yellow-600 flex items-center gap-2"
                            >
                              <AlertTriangle className="h-4 w-4" />
                              {warning}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" onClick={() => setShowExportDialog(true)}>
                        <Download className="h-4 w-4 mr-2" />
                        Export
                      </Button>
                      <Button onClick={() => setShowLodgeDialog(true)}>
                        <Send className="h-4 w-4 mr-2" />
                        Lodge
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* GST Details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Sales GST */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <TrendingUp className="h-5 w-5 text-red-500" />
                      GST on Sales
                    </CardTitle>
                    <CardDescription>Output tax collected from customers</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableBody>
                        <TableRow>
                          <TableCell className="font-medium">G1 - Total Sales</TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(basData.gst_section.g1_total_sales)}
                          </TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="font-medium">G9 - GST on Sales</TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(basData.gst_section.g9_gst_on_sales)}
                          </TableCell>
                        </TableRow>
                        <TableRow className="bg-muted/50">
                          <TableCell className="font-bold">1A - GST Payable</TableCell>
                          <TableCell className="text-right font-bold text-red-600">
                            {formatCurrency(basData.gst_section.label_1a_gst_on_sales)}
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>

                {/* Purchases GST */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <TrendingDown className="h-5 w-5 text-green-500" />
                      GST on Purchases
                    </CardTitle>
                    <CardDescription>Input tax credits claimable</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableBody>
                        <TableRow>
                          <TableCell className="font-medium">G12 - Total Purchases</TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(basData.gst_section.g12_total_purchases)}
                          </TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="font-medium">G20 - GST on Purchases</TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(basData.gst_section.g20_gst_on_purchases)}
                          </TableCell>
                        </TableRow>
                        <TableRow className="bg-muted/50">
                          <TableCell className="font-bold">1B - GST Credit</TableCell>
                          <TableCell className="text-right font-bold text-green-600">
                            {formatCurrency(basData.gst_section.label_1b_gst_on_purchases)}
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </div>

              {/* PAYG Sections */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* PAYG Withholding */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Building2 className="h-5 w-5" />
                      PAYG Withholding
                    </CardTitle>
                    <CardDescription>Tax withheld from wages and payments</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableBody>
                        <TableRow>
                          <TableCell className="font-medium">W1 - Gross Wages</TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(basData.payg_withholding.w1_gross_wages)}
                          </TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="font-medium">W2 - Tax Withheld</TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(basData.payg_withholding.w2_tax_withheld)}
                          </TableCell>
                        </TableRow>
                        <TableRow className="bg-muted/50">
                          <TableCell className="font-bold">W4 - Total Withheld</TableCell>
                          <TableCell className="text-right font-bold">
                            {formatCurrency(basData.payg_withholding.w4_total_withheld)}
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>

                {/* PAYG Instalments */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <DollarSign className="h-5 w-5" />
                      PAYG Instalments
                    </CardTitle>
                    <CardDescription>Income tax instalments</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableBody>
                        <TableRow>
                          <TableCell className="font-medium">T7 - Instalment Income</TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(basData.payg_instalments.t7_instalment_income)}
                          </TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="font-medium">T8 - Rate</TableCell>
                          <TableCell className="text-right">
                            {(basData.payg_instalments.t8_instalment_rate * 100).toFixed(2)}%
                          </TableCell>
                        </TableRow>
                        <TableRow className="bg-muted/50">
                          <TableCell className="font-bold">T9 - Instalment Amount</TableCell>
                          <TableCell className="text-right font-bold">
                            {formatCurrency(basData.payg_instalments.t9_instalment_amount)}
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </div>

              {/* Summary */}
              <Card className="border-2">
                <CardHeader>
                  <CardTitle>Total Amount</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-3xl font-bold">
                        {formatCurrency(basData.summary.total_payable_to_ato)}
                      </p>
                      <p className="text-muted-foreground">
                        {basData.summary.total_payable_to_ato >= 0
                          ? "Payable to ATO"
                          : "Refund from ATO"}
                      </p>
                    </div>
                    <ArrowRight className="h-8 w-8 text-muted-foreground" />
                    <div className="text-right">
                      <p className="font-medium">Due: {basData.summary.due_date}</p>
                      <p className="text-sm text-muted-foreground">
                        {basData.summary.days_until_due} days remaining
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
          ) : (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                Select a period to prepare BAS
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Lodgement History View */}
        <TabsContent value="history" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Lodgement History</span>
                <Badge variant="secondary">{lodgements.length} lodgements</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {lodgements.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground">
                  <History className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No BAS lodgements recorded yet</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Period</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Net Amount</TableHead>
                      <TableHead>Lodged By</TableHead>
                      <TableHead>Lodged At</TableHead>
                      <TableHead>Reference</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lodgements.map((lodgement) => (
                      <TableRow key={lodgement.id}>
                        <TableCell className="font-medium">{lodgement.period}</TableCell>
                        <TableCell>{getStatusBadge(lodgement.status)}</TableCell>
                        <TableCell>
                          {lodgement.is_amendment ? (
                            <Badge variant="outline">Amendment</Badge>
                          ) : (
                            <Badge variant="secondary">Original</Badge>
                          )}
                        </TableCell>
                        <TableCell>{formatCurrency(lodgement.net_amount)}</TableCell>
                        <TableCell>{lodgement.lodged_by || "-"}</TableCell>
                        <TableCell>
                          {lodgement.lodged_at
                            ? new Date(lodgement.lodged_at).toLocaleDateString("en-AU")
                            : "-"}
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {lodgement.lodgement_reference || "-"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Trend View */}
        <TabsContent value="trend" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Quarterly GST Trend</CardTitle>
              <CardDescription>GST collected vs paid over the last 4 quarters</CardDescription>
            </CardHeader>
            <CardContent>
              {chartData.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground">
                  <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No trend data available</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {chartData.map((data, index) => (
                    <div key={index} className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium">{data.period}</span>
                        <span className="text-muted-foreground">
                          Net: {formatCurrency(data.net_gst)}
                        </span>
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs w-20 text-muted-foreground">Collected</span>
                          <div className="flex-1 bg-muted rounded-full h-4 overflow-hidden">
                            <div
                              className="h-full bg-red-500 rounded-full"
                              style={{
                                width: `${maxChartValue > 0 ? (data.gst_collected / maxChartValue) * 100 : 0}%`,
                              }}
                            />
                          </div>
                          <span className="text-xs w-24 text-right">
                            {formatCurrency(data.gst_collected)}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs w-20 text-muted-foreground">Paid</span>
                          <div className="flex-1 bg-muted rounded-full h-4 overflow-hidden">
                            <div
                              className="h-full bg-green-500 rounded-full"
                              style={{
                                width: `${maxChartValue > 0 ? (data.gst_paid / maxChartValue) * 100 : 0}%`,
                              }}
                            />
                          </div>
                          <span className="text-xs w-24 text-right">
                            {formatCurrency(data.gst_paid)}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Summary Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Avg. GST Collected
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">
                  {formatCurrency(
                    chartData.length > 0
                      ? chartData.reduce((sum, d) => sum + d.gst_collected, 0) / chartData.length
                      : 0
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-1">per quarter</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Avg. GST Paid
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">
                  {formatCurrency(
                    chartData.length > 0
                      ? chartData.reduce((sum, d) => sum + d.gst_paid, 0) / chartData.length
                      : 0
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-1">per quarter</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Avg. Net GST
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatCurrency(
                    chartData.length > 0
                      ? chartData.reduce((sum, d) => sum + d.net_gst, 0) / chartData.length
                      : 0
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-1">per quarter</p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Lodge Dialog */}
      <Dialog open={showLodgeDialog} onOpenChange={setShowLodgeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Lodge BAS</DialogTitle>
            <DialogDescription>
              Lodge {selectedPeriod?.label} Business Activity Statement
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {basData && (
              <div className="space-y-2 bg-muted p-4 rounded-lg">
                <div className="flex justify-between">
                  <span>1A - GST on Sales</span>
                  <span className="font-medium">
                    {formatCurrency(basData.gst_section.label_1a_gst_on_sales)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>1B - GST on Purchases</span>
                  <span className="font-medium">
                    {formatCurrency(basData.gst_section.label_1b_gst_on_purchases)}
                  </span>
                </div>
                <div className="flex justify-between border-t pt-2 mt-2">
                  <span className="font-bold">Net Amount</span>
                  <span className="font-bold">
                    {formatCurrency(basData.summary.total_payable_to_ato)}
                  </span>
                </div>
              </div>
            )}

            {sbrStatus?.sbr_configured ? (
              <div className="flex items-center gap-2 text-green-600">
                <CheckCircle className="h-5 w-5" />
                <span>SBR configured - can lodge directly to ATO</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-yellow-600">
                <AlertTriangle className="h-5 w-5" />
                <span>SBR not configured - mark as lodged manually</span>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowLodgeDialog(false)}>
              Cancel
            </Button>
            {sbrStatus?.sbr_configured ? (
              <Button onClick={handleLodgeToATO} disabled={lodging}>
                {lodging ? (
                  <>
                    <Spinner className="mr-2 h-4 w-4" />
                    Lodging...
                  </>
                ) : (
                  <>
                    <Send className="mr-2 h-4 w-4" />
                    Lodge to ATO
                  </>
                )}
              </Button>
            ) : (
              <Button onClick={handleMarkLodged} disabled={lodging}>
                {lodging ? (
                  <>
                    <Spinner className="mr-2 h-4 w-4" />
                    Saving...
                  </>
                ) : (
                  <>
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Mark as Lodged
                  </>
                )}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Export Dialog */}
      <Dialog open={showExportDialog} onOpenChange={setShowExportDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Export BAS</DialogTitle>
            <DialogDescription>
              Export {selectedPeriod?.label} BAS data for record keeping or manual lodgement
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-3 gap-4 py-4">
            <Button
              variant="outline"
              className="flex flex-col items-center gap-2 h-24"
              onClick={() => handleExport("csv")}
              disabled={exporting}
            >
              <FileSpreadsheet className="h-8 w-8" />
              <span>CSV</span>
            </Button>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    className="flex flex-col items-center gap-2 h-24 opacity-50"
                    disabled
                  >
                    <FileText className="h-8 w-8" />
                    <span>PDF</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Coming soon</TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <Button
              variant="outline"
              className="flex flex-col items-center gap-2 h-24"
              onClick={() => handleExport("json")}
              disabled={exporting}
            >
              <FileText className="h-8 w-8" />
              <span>JSON</span>
            </Button>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowExportDialog(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
