"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
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
  ArrowLeft,
  FileSpreadsheet,
  TrendingDown,
  Shield,
  Download,
  Loader2,
  Building2,
  Car,
  Wrench,
  Box,
  AlertCircle,
  CheckCircle,
  Clock,
  DollarSign,
  BarChart3,
  Calendar,
  RefreshCw,
} from "lucide-react";
import { api } from "@/lib/api";
import { format } from "date-fns";

// Tab definitions
const TABS = [
  { id: "summary", name: "Summary", icon: BarChart3 },
  { id: "register", name: "Asset Register", icon: FileSpreadsheet },
  { id: "depreciation", name: "Depreciation Schedule", icon: TrendingDown },
  { id: "insurance", name: "Insurance Summary", icon: Shield },
];

interface Company {
  id: number;
  name: string;
  code?: string;
}

interface SummaryData {
  total_assets: number;
  active_assets: number;
  disposed_assets: number;
  by_type: Record<string, number>;
  by_status: Record<string, number>;
  by_entity_type: Record<string, number>;
  financials: {
    total_purchase_value: number;
    total_book_value: number;
    total_depreciation: number;
  };
  current_fy_depreciation: {
    financial_year: string;
    book_depreciation: number;
    tax_depreciation: number;
  };
  insurance: {
    insured_count: number;
    uninsured_count: number;
    expired_count: number;
    expiring_soon_count: number;
    total_annual_premium: number;
  };
}

interface RegisterAsset {
  id: number;
  asset_number?: string;
  name: string;
  display_name: string;
  asset_type: string;
  status: string;
  company_name?: string;
  entity_type?: string;
  make?: string;
  model?: string;
  location?: string;
  assigned_to?: string;
  purchase_date?: string;
  purchase_price?: number;
  current_book_value?: number;
  depreciation_method?: string;
  effective_life?: number;
  insurance_status?: string;
  insurance_expiry?: string;
}

interface DepreciationAsset {
  id: number;
  asset_number?: string;
  name: string;
  display_name: string;
  asset_type: string;
  company_name?: string;
  purchase_price?: number;
  depreciable_cost?: number;
  residual_value?: number;
  effective_life_years?: number;
  book_method?: string;
  tax_method?: string;
  is_division_43?: boolean;
  division_43_rate?: number;
  in_low_value_pool?: boolean;
  schedule?: {
    days_held: number;
    book_opening_wdv: number;
    book_depreciation: number;
    book_closing_wdv: number;
    book_accumulated: number;
    tax_opening_wdv: number;
    tax_depreciation: number;
    tax_closing_wdv: number;
    tax_accumulated: number;
    status: string;
  };
}

interface InsuranceAsset {
  id: number;
  asset_number?: string;
  name: string;
  display_name: string;
  asset_type: string;
  company_name?: string;
  current_book_value?: number;
  insurance: {
    id: number;
    policy_number?: string;
    insurer_name?: string;
    broker_name?: string;
    start_date?: string;
    renewal_date?: string;
    premium_amount?: number;
    coverage_amount?: number;
    excess_amount?: number;
    status: string;
    days_until_renewal?: number;
    expired?: boolean;
    expiring_soon?: boolean;
  };
}

export default function AssetReportsPage() {
  const router = useRouter();

  const [activeTab, setActiveTab] = React.useState("summary");
  const [loading, setLoading] = React.useState(true);
  const [companies, setCompanies] = React.useState<Company[]>([]);
  const [entityTypes, setEntityTypes] = React.useState<string[]>([]);

  // Filters
  const [selectedCompany, setSelectedCompany] = React.useState<string>("all");
  const [selectedType, setSelectedType] = React.useState<string>("all");
  const [selectedStatus, setSelectedStatus] = React.useState<string>("all");
  const [selectedEntityType, setSelectedEntityType] = React.useState<string>("all");
  const [financialYear, setFinancialYear] = React.useState<string>("");

  // Report data
  const [summary, setSummary] = React.useState<SummaryData | null>(null);
  const [registerAssets, setRegisterAssets] = React.useState<RegisterAsset[]>([]);
  const [registerSummary, setRegisterSummary] = React.useState<Record<string, number | Record<string, number>>>({});
  const [depreciationAssets, setDepreciationAssets] = React.useState<DepreciationAsset[]>([]);
  const [depreciationSummary, setDepreciationSummary] = React.useState<Record<string, number>>({});
  const [insuranceAssets, setInsuranceAssets] = React.useState<InsuranceAsset[]>([]);
  const [insuranceSummary, setInsuranceSummary] = React.useState<Record<string, number | Record<string, number>>>({});

  // Load companies and entity types on mount
  React.useEffect(() => {
    loadCompanies();
    loadEntityTypes();
    loadSummary();
  }, []);

  // Load data when tab changes or filters change
  React.useEffect(() => {
    if (activeTab === "summary") {
      loadSummary();
    } else if (activeTab === "register") {
      loadRegister();
    } else if (activeTab === "depreciation") {
      loadDepreciation();
    } else if (activeTab === "insurance") {
      loadInsurance();
    }
  }, [activeTab, selectedCompany, selectedType, selectedStatus, selectedEntityType, financialYear]);

  const loadCompanies = async () => {
    try {
      const response = await api.get<{ companies: Company[] }>("/api/v1/companies");
      setCompanies(response.companies || []);
    } catch (err) {
      console.error("Failed to load companies:", err);
    }
  };

  const loadEntityTypes = async () => {
    try {
      const response = await api.get<{ entity_types: string[] }>("/api/v1/asset_reports/entity_types");
      setEntityTypes(response.entity_types || []);
    } catch (err) {
      console.error("Failed to load entity types:", err);
      // Fallback defaults
      setEntityTypes(["Company", "Trust", "Superfund", "Charity", "Sole Trader", "Personal", "Director House"]);
    }
  };

  const loadSummary = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (selectedCompany !== "all") params.append("company_id", selectedCompany);
      if (selectedEntityType !== "all") params.append("entity_type", selectedEntityType);

      const response = await api.get<{ summary: SummaryData }>(
        `/api/v1/asset_reports/summary?${params.toString()}`
      );
      setSummary(response.summary);
    } catch (err) {
      console.error("Failed to load summary:", err);
    } finally {
      setLoading(false);
    }
  };

  const loadRegister = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (selectedCompany !== "all") params.append("company_id", selectedCompany);
      if (selectedType !== "all") params.append("asset_type", selectedType);
      if (selectedStatus !== "all") params.append("status", selectedStatus);
      if (selectedEntityType !== "all") params.append("entity_type", selectedEntityType);

      const response = await api.get<{ report: { assets: RegisterAsset[]; summary: Record<string, number | Record<string, number>> } }>(
        `/api/v1/asset_reports/register?${params.toString()}`
      );
      setRegisterAssets(response.report.assets || []);
      setRegisterSummary(response.report.summary || {});
    } catch (err) {
      console.error("Failed to load register:", err);
    } finally {
      setLoading(false);
    }
  };

  const loadDepreciation = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (selectedCompany !== "all") params.append("company_id", selectedCompany);
      if (selectedType !== "all") params.append("asset_type", selectedType);
      if (selectedEntityType !== "all") params.append("entity_type", selectedEntityType);
      if (financialYear) params.append("financial_year", financialYear);

      const response = await api.get<{ report: { assets: DepreciationAsset[]; summary: Record<string, number>; financial_year: string } }>(
        `/api/v1/asset_reports/depreciation?${params.toString()}`
      );
      setDepreciationAssets(response.report.assets || []);
      setDepreciationSummary(response.report.summary || {});
      if (!financialYear && response.report.financial_year) {
        setFinancialYear(response.report.financial_year);
      }
    } catch (err) {
      console.error("Failed to load depreciation:", err);
    } finally {
      setLoading(false);
    }
  };

  const loadInsurance = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (selectedCompany !== "all") params.append("company_id", selectedCompany);
      if (selectedType !== "all") params.append("asset_type", selectedType);
      if (selectedEntityType !== "all") params.append("entity_type", selectedEntityType);

      const response = await api.get<{ report: { assets: InsuranceAsset[]; summary: Record<string, number | Record<string, number>> } }>(
        `/api/v1/asset_reports/insurance?${params.toString()}`
      );
      setInsuranceAssets(response.report.assets || []);
      setInsuranceSummary(response.report.summary || {});
    } catch (err) {
      console.error("Failed to load insurance:", err);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value?: number) => {
    if (value === undefined || value === null) return "-";
    return new Intl.NumberFormat("en-AU", {
      style: "currency",
      currency: "AUD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return "-";
    try {
      return format(new Date(dateString), "dd MMM yyyy");
    } catch {
      return dateString;
    }
  };

  const getAssetTypeIcon = (type: string) => {
    switch (type) {
      case "vehicle":
        return <Car className="h-4 w-4" />;
      case "equipment":
        return <Wrench className="h-4 w-4" />;
      case "property":
        return <Building2 className="h-4 w-4" />;
      default:
        return <Box className="h-4 w-4" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300">Active</Badge>;
      case "disposed":
        return <Badge className="bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300">Disposed</Badge>;
      case "under_repair":
        return <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300">Under Repair</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getInsuranceStatusBadge = (insurance: InsuranceAsset["insurance"]) => {
    if (insurance.expired) {
      return <Badge variant="destructive"><AlertCircle className="h-3 w-3 mr-1" />Expired</Badge>;
    }
    if (insurance.expiring_soon) {
      return <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300"><Clock className="h-3 w-3 mr-1" />Expiring Soon</Badge>;
    }
    return <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300"><CheckCircle className="h-3 w-3 mr-1" />Active</Badge>;
  };

  const handleExportCSV = () => {
    // TODO: Implement CSV export
    console.log("Export CSV");
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between border-b pb-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push("/corporate/assets")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight font-serif">Asset Reports</h1>
            <p className="text-sm text-muted-foreground">
              Asset Register, Depreciation Schedules, and Insurance Summary
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleExportCSV}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4">
        <div className="w-48">
          <Label className="text-xs text-muted-foreground">Company</Label>
          <Select value={selectedCompany} onValueChange={setSelectedCompany}>
            <SelectTrigger>
              <SelectValue placeholder="All Companies" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Companies</SelectItem>
              {companies.map((company) => (
                <SelectItem key={company.id} value={company.id.toString()}>
                  {company.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="w-40">
          <Label className="text-xs text-muted-foreground">Asset Type</Label>
          <Select value={selectedType} onValueChange={setSelectedType}>
            <SelectTrigger>
              <SelectValue placeholder="All Types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="vehicle">Vehicle</SelectItem>
              <SelectItem value="equipment">Equipment</SelectItem>
              <SelectItem value="property">Property</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="w-44">
          <Label className="text-xs text-muted-foreground">Entity Type</Label>
          <Select value={selectedEntityType} onValueChange={setSelectedEntityType}>
            <SelectTrigger>
              <SelectValue placeholder="All Entity Types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Entity Types</SelectItem>
              {entityTypes.map((type) => (
                <SelectItem key={type} value={type}>
                  {type}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {activeTab === "register" && (
          <div className="w-40">
            <Label className="text-xs text-muted-foreground">Status</Label>
            <Select value={selectedStatus} onValueChange={setSelectedStatus}>
              <SelectTrigger>
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="disposed">Disposed</SelectItem>
                <SelectItem value="under_repair">Under Repair</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {activeTab === "depreciation" && (
          <div className="w-32">
            <Label className="text-xs text-muted-foreground">Financial Year</Label>
            <Input
              value={financialYear}
              onChange={(e) => setFinancialYear(e.target.value)}
              placeholder="FY2025"
            />
          </div>
        )}

        <div className="flex items-end">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              if (activeTab === "summary") loadSummary();
              else if (activeTab === "register") loadRegister();
              else if (activeTab === "depreciation") loadDepreciation();
              else if (activeTab === "insurance") loadInsurance();
            }}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <ScrollArea className="w-full whitespace-nowrap">
        <div className="flex gap-2 pb-2">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            return (
              <Button
                key={tab.id}
                variant={activeTab === tab.id ? "default" : "outline"}
                className="flex items-center gap-2"
                onClick={() => setActiveTab(tab.id)}
              >
                <Icon className="h-4 w-4" />
                {tab.name}
              </Button>
            );
          })}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Summary Tab */}
      {!loading && activeTab === "summary" && summary && (
        <div className="space-y-6">
          {/* Asset Overview */}
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2">
                  <Box className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Total Assets</span>
                </div>
                <p className="text-3xl font-bold mt-2">{summary.total_assets}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {summary.active_assets} active, {summary.disposed_assets} disposed
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Purchase Value</span>
                </div>
                <p className="text-3xl font-bold mt-2">{formatCurrency(summary.financials.total_purchase_value)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2">
                  <TrendingDown className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Current Book Value</span>
                </div>
                <p className="text-3xl font-bold mt-2">{formatCurrency(summary.financials.total_book_value)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2">
                  <TrendingDown className="h-4 w-4 text-red-500" />
                  <span className="text-sm text-muted-foreground">Total Depreciation</span>
                </div>
                <p className="text-3xl font-bold mt-2 text-red-600">{formatCurrency(summary.financials.total_depreciation)}</p>
              </CardContent>
            </Card>
          </div>

          {/* By Type, Entity Type, and Depreciation */}
          <div className="grid gap-6 md:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Assets by Type</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {Object.entries(summary.by_type).map(([type, count]) => (
                    <div key={type} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {getAssetTypeIcon(type)}
                        <span className="capitalize">{type}</span>
                      </div>
                      <Badge variant="outline">{count}</Badge>
                    </div>
                  ))}
                  {Object.keys(summary.by_type).length === 0 && (
                    <p className="text-sm text-muted-foreground">No assets</p>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Assets by Entity Type</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {Object.entries(summary.by_entity_type || {}).map(([entityType, count]) => (
                    <div key={entityType} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        <span>{entityType}</span>
                      </div>
                      <Badge variant="outline">{count}</Badge>
                    </div>
                  ))}
                  {Object.keys(summary.by_entity_type || {}).length === 0 && (
                    <p className="text-sm text-muted-foreground">No entity types</p>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">
                  {summary.current_fy_depreciation.financial_year} Depreciation
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Book Depreciation</span>
                    <span className="font-bold text-red-600">
                      {formatCurrency(summary.current_fy_depreciation.book_depreciation)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Tax Depreciation</span>
                    <span className="font-bold text-red-600">
                      {formatCurrency(summary.current_fy_depreciation.tax_depreciation)}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Insurance Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Insurance Overview</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-5">
                <div className="text-center p-4 bg-muted rounded-lg">
                  <p className="text-2xl font-bold text-green-600">{summary.insurance.insured_count}</p>
                  <p className="text-sm text-muted-foreground">Insured</p>
                </div>
                <div className="text-center p-4 bg-muted rounded-lg">
                  <p className="text-2xl font-bold text-gray-500">{summary.insurance.uninsured_count}</p>
                  <p className="text-sm text-muted-foreground">Uninsured</p>
                </div>
                <div className="text-center p-4 bg-muted rounded-lg">
                  <p className="text-2xl font-bold text-red-600">{summary.insurance.expired_count}</p>
                  <p className="text-sm text-muted-foreground">Expired</p>
                </div>
                <div className="text-center p-4 bg-muted rounded-lg">
                  <p className="text-2xl font-bold text-yellow-600">{summary.insurance.expiring_soon_count}</p>
                  <p className="text-sm text-muted-foreground">Expiring Soon</p>
                </div>
                <div className="text-center p-4 bg-muted rounded-lg">
                  <p className="text-2xl font-bold">{formatCurrency(summary.insurance.total_annual_premium)}</p>
                  <p className="text-sm text-muted-foreground">Annual Premium</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Asset Register Tab */}
      {!loading && activeTab === "register" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              Asset Register
              <Badge className="ml-2" variant="outline">{registerAssets.length} assets</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {registerAssets.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Asset #</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Company</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Assigned To</TableHead>
                      <TableHead>Purchase Date</TableHead>
                      <TableHead className="text-right">Purchase Price</TableHead>
                      <TableHead className="text-right">Book Value</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {registerAssets.map((asset) => (
                      <TableRow
                        key={asset.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => router.push(`/corporate/assets/${asset.id}`)}
                      >
                        <TableCell className="font-mono text-sm">{asset.asset_number || "-"}</TableCell>
                        <TableCell className="font-medium">{asset.display_name}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {getAssetTypeIcon(asset.asset_type)}
                            <span className="capitalize">{asset.asset_type}</span>
                          </div>
                        </TableCell>
                        <TableCell>{asset.company_name || "-"}</TableCell>
                        <TableCell>{asset.location || "-"}</TableCell>
                        <TableCell>{asset.assigned_to || "-"}</TableCell>
                        <TableCell>{formatDate(asset.purchase_date)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(asset.purchase_price)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(asset.current_book_value)}</TableCell>
                        <TableCell>{getStatusBadge(asset.status)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <FileSpreadsheet className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No assets found matching the criteria</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Depreciation Schedule Tab */}
      {!loading && activeTab === "depreciation" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              Depreciation Schedule - {financialYear}
              <Badge className="ml-2" variant="outline">{depreciationAssets.length} assets</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {/* Summary Row */}
            {Object.keys(depreciationSummary).length > 0 && (
              <div className="mb-6 p-4 bg-muted rounded-lg">
                <div className="grid grid-cols-4 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Total Book Depreciation</p>
                    <p className="text-lg font-bold text-red-600">{formatCurrency(depreciationSummary.total_book_depreciation)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Total Tax Depreciation</p>
                    <p className="text-lg font-bold text-red-600">{formatCurrency(depreciationSummary.total_tax_depreciation)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Total Book WDV</p>
                    <p className="text-lg font-bold">{formatCurrency(depreciationSummary.total_book_wdv)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Total Tax WDV</p>
                    <p className="text-lg font-bold">{formatCurrency(depreciationSummary.total_tax_wdv)}</p>
                  </div>
                </div>
              </div>
            )}

            {depreciationAssets.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Asset</TableHead>
                      <TableHead>Method</TableHead>
                      <TableHead className="text-right">Cost</TableHead>
                      <TableHead className="text-right">Life (yrs)</TableHead>
                      <TableHead className="text-right">Book Open</TableHead>
                      <TableHead className="text-right">Book Dep</TableHead>
                      <TableHead className="text-right">Book Close</TableHead>
                      <TableHead className="text-right">Tax Open</TableHead>
                      <TableHead className="text-right">Tax Dep</TableHead>
                      <TableHead className="text-right">Tax Close</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {depreciationAssets.map((asset) => (
                      <TableRow key={asset.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{asset.display_name}</p>
                            <p className="text-xs text-muted-foreground font-mono">{asset.asset_number}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-xs">
                            <p>Book: {asset.book_method?.replace(/_/g, " ")}</p>
                            <p>Tax: {asset.tax_method?.replace(/_/g, " ")}</p>
                            {asset.is_division_43 && <Badge className="bg-blue-100 text-blue-800 text-xs">Div 43</Badge>}
                            {asset.in_low_value_pool && <Badge className="bg-purple-100 text-purple-800 text-xs">LVP</Badge>}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">{formatCurrency(asset.depreciable_cost)}</TableCell>
                        <TableCell className="text-right">{asset.effective_life_years || "-"}</TableCell>
                        <TableCell className="text-right">{formatCurrency(asset.schedule?.book_opening_wdv)}</TableCell>
                        <TableCell className="text-right text-red-600">{formatCurrency(asset.schedule?.book_depreciation)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(asset.schedule?.book_closing_wdv)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(asset.schedule?.tax_opening_wdv)}</TableCell>
                        <TableCell className="text-right text-red-600">{formatCurrency(asset.schedule?.tax_depreciation)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(asset.schedule?.tax_closing_wdv)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <TrendingDown className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No depreciation schedules found</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Insurance Summary Tab */}
      {!loading && activeTab === "insurance" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              Insurance Summary
              <Badge className="ml-2" variant="outline">{insuranceAssets.length} insured assets</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {insuranceAssets.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Asset</TableHead>
                      <TableHead>Policy #</TableHead>
                      <TableHead>Insurer</TableHead>
                      <TableHead>Renewal Date</TableHead>
                      <TableHead className="text-right">Premium</TableHead>
                      <TableHead className="text-right">Coverage</TableHead>
                      <TableHead className="text-right">Excess</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {insuranceAssets.map((asset) => (
                      <TableRow key={asset.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{asset.display_name}</p>
                            <p className="text-xs text-muted-foreground">{asset.company_name}</p>
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-sm">{asset.insurance.policy_number || "-"}</TableCell>
                        <TableCell>{asset.insurance.insurer_name || "-"}</TableCell>
                        <TableCell>
                          <div>
                            <p>{formatDate(asset.insurance.renewal_date)}</p>
                            {asset.insurance.days_until_renewal !== undefined && asset.insurance.days_until_renewal > 0 && (
                              <p className="text-xs text-muted-foreground">
                                {asset.insurance.days_until_renewal} days
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">{formatCurrency(asset.insurance.premium_amount)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(asset.insurance.coverage_amount)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(asset.insurance.excess_amount)}</TableCell>
                        <TableCell>{getInsuranceStatusBadge(asset.insurance)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <Shield className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No insured assets found</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
