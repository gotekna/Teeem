"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Building2,
  Users,
  Heart,
  AlertTriangle,
  Package,
  Clock,
  Plus,
  Calendar,
  FileText,
  Key,
  FolderOpen,
  ExternalLink,
  Loader2,
  CheckCircle2,
  ArrowLeftRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import TeeemTableView from "@/components/table/TeeemTableView";
import type { TableColumn, TableRow } from "@/components/table/types";

// Import from centralized utilities
import {
  convertColumnsToTEEEMFormat,
  type ApiColumn,
} from "@/lib/corporate/column-utils";
import {
  CORPORATE_TABLE_IDS,
  COLUMN_WIDTH_OVERRIDES,
} from "@/lib/corporate/config";

// Use centralized table ID
const COMPANIES_TABLE_ID = CORPORATE_TABLE_IDS.COMPANIES;

interface DashboardStats {
  totalCompanies: number;
  activeCompanies: number;
  totalAssets: number;
  complianceDueSoon: number;
  healthScore: number;
  criticalCompanies: number;
}

interface ComplianceItem {
  id: number;
  title: string;
  due_date: string;
  days_until_due: number;
  company: {
    id: number;
    name: string;
    slug?: string;
  };
}

interface StatCardProps {
  name: string;
  value: string | number;
  icon: React.ElementType;
  href: string;
  alert?: boolean;
  alertColor?: "green" | "yellow" | "red" | "orange";
}

function StatCard({ name, value, icon: Icon, href, alert, alertColor }: StatCardProps) {
  const router = useRouter();

  const getColors = () => {
    if (alertColor === "green") return { bg: "bg-green-500", ring: "ring-2 ring-green-500" };
    if (alertColor === "yellow") return { bg: "bg-yellow-500", ring: "ring-2 ring-yellow-500" };
    if (alertColor === "red") return { bg: "bg-red-500", ring: "ring-2 ring-red-500" };
    if (alert) return { bg: "bg-orange-500", ring: "ring-2 ring-orange-500" };
    return { bg: "bg-primary", ring: "" };
  };

  const colors = getColors();

  return (
    <Card
      className={cn(
        "cursor-pointer hover:shadow-md transition-shadow",
        colors.ring
      )}
      onClick={() => router.push(href)}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          <div className={cn("p-3 rounded-md", colors.bg)}>
            <Icon className="h-6 w-6 text-white" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">{name}</p>
            <p className="text-2xl font-semibold">{value}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface QuickActionProps {
  label: string;
  icon?: React.ElementType;
  href: string;
  variant?: "primary" | "secondary" | "outline";
  color?: string;
}

function QuickAction({ label, icon: Icon, href, variant = "outline", color }: QuickActionProps) {
  const router = useRouter();

  const getButtonClass = () => {
    if (color === "green") return "bg-green-600 hover:bg-green-700 text-white";
    if (color === "indigo") return "bg-indigo-600 hover:bg-indigo-700 text-white";
    if (color === "blue") return "bg-blue-600 hover:bg-blue-700 text-white";
    if (variant === "primary") return "bg-primary hover:bg-primary/90 text-primary-foreground";
    return "";
  };

  return (
    <Button
      variant={variant === "outline" ? "outline" : "default"}
      className={cn("justify-start h-10", getButtonClass())}
      onClick={() => router.push(href)}
    >
      {Icon && <Icon className="h-4 w-4 mr-2" />}
      {label}
    </Button>
  );
}

export default function CorporateDashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = React.useState(true);
  const [stats, setStats] = React.useState<DashboardStats>({
    totalCompanies: 0,
    activeCompanies: 0,
    totalAssets: 0,
    complianceDueSoon: 0,
    healthScore: 0,
    criticalCompanies: 0,
  });
  const [upcomingCompliance, setUpcomingCompliance] = React.useState<ComplianceItem[]>([]);
  const [companies, setCompanies] = React.useState<TableRow[]>([]);
  const [columns, setColumns] = React.useState<TableColumn[]>([]);

  React.useEffect(() => {
    loadDashboardData();
    fetchColumns();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);

      // Load companies
      const companiesResponse = await api.get<{ companies: TableRow[] }>("/api/v1/companies");
      const companiesList = companiesResponse.companies || [];
      setCompanies(companiesList);

      // Load compliance items due soon
      let compliance: ComplianceItem[] = [];
      try {
        const complianceResponse = await api.get<{ compliance_items: ComplianceItem[] }>("/api/v1/company_compliance_items", {
          params: { due_soon: "true", days: 30 },
        });
        compliance = complianceResponse.compliance_items || [];
      } catch {
        // Compliance endpoint may not exist
      }

      // Load assets
      let assets: unknown[] = [];
      try {
        const assetsResponse = await api.get<{ assets: unknown[] }>("/api/v1/assets");
        assets = assetsResponse.assets || [];
      } catch {
        // Assets endpoint may not exist
      }

      // Load health report
      let healthSummary: { average_score?: number; critical?: number } = {};
      try {
        const healthResponse = await api.get<{ summary: { average_score?: number; critical?: number } }>("/api/v1/companies/health_report");
        healthSummary = healthResponse.summary || {};
      } catch {
        // Health endpoint may not exist
      }

      setStats({
        totalCompanies: companiesList.length,
        activeCompanies: companiesList.filter((c) => c.status === "active" || c.status === "Active").length,
        totalAssets: assets.length,
        complianceDueSoon: compliance.length,
        healthScore: healthSummary.average_score || 0,
        criticalCompanies: healthSummary.critical || 0,
      });

      setUpcomingCompliance(compliance.slice(0, 5));
    } catch (error) {
      console.error("Failed to load dashboard:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchColumns = async () => {
    try {
      const response = await api.get<{ foundation: { columns: ApiColumn[] } }>(`/api/v1/foundations/${COMPANIES_TABLE_ID}`);
      const dbColumns = response?.foundation?.columns || [];
      // Use centralized width overrides from config
      const teeemColumns = convertColumnsToTEEEMFormat(
        dbColumns,
        COMPANIES_TABLE_ID,
        COLUMN_WIDTH_OVERRIDES.companies
      );
      setColumns(teeemColumns);
    } catch (err) {
      console.error("Failed to fetch columns:", err);
    }
  };

  const handleEdit = async (entry: TableRow) => {
    try {
      const response = await api.patch<{ company: TableRow }>(`/api/v1/companies/${entry.id}`, { company: entry });
      setCompanies(companies.map((c) => (c.id === entry.id ? response.company : c)));
    } catch (err) {
      console.error("Failed to update company:", err);
    }
  };

  const handleDelete = async (entry: TableRow) => {
    if (!confirm(`Delete company "${entry.name}"? This cannot be undone.`)) return;

    try {
      await api.delete(`/api/v1/companies/${entry.id}`);
      setCompanies(companies.filter((c) => c.id !== entry.id));
    } catch (err) {
      console.error("Failed to delete company:", err);
    }
  };

  const handleBulkDelete = async (ids: (number | string)[]) => {
    try {
      await Promise.all(ids.map((id) => api.delete(`/api/v1/companies/${id}`)));
      setCompanies(companies.filter((c) => !ids.includes(c.id)));
    } catch (err) {
      console.error("Failed to bulk delete companies:", err);
    }
  };

  const statCards: StatCardProps[] = [
    { name: "Total Companies", value: stats.totalCompanies, icon: Building2, href: "/corporate" },
    { name: "Active Companies", value: stats.activeCompanies, icon: CheckCircle2, href: "/corporate" },
    {
      name: "Health Score",
      value: stats.healthScore > 0 ? `${stats.healthScore.toFixed(1)}%` : "N/A",
      icon: Heart,
      href: "/corporate/health",
      alert: stats.criticalCompanies > 0,
      alertColor: stats.healthScore >= 80 ? "green" : stats.healthScore >= 60 ? "yellow" : "red",
    },
    { name: "Critical Companies", value: stats.criticalCompanies, icon: AlertTriangle, href: "/corporate/health", alert: stats.criticalCompanies > 0 },
    { name: "Total Assets", value: stats.totalAssets, icon: Package, href: "/corporate/assets" },
    { name: "Compliance Due", value: stats.complianceDueSoon, icon: Clock, href: "/corporate", alert: stats.complianceDueSoon > 0 },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="border-b pb-4">
        <h1 className="text-2xl font-bold tracking-tight font-serif">Corporate Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage companies, assets, compliance, and Xero integrations
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {statCards.map((stat) => (
          <StatCard key={stat.name} {...stat} />
        ))}
      </div>

      {/* Quick Actions */}
      <Card>
        <CardContent className="p-6">
          <h3 className="text-base font-medium mb-4">Quick Actions</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <QuickAction label="Health Report" icon={Heart} href="/corporate/health" color="green" />
            <QuickAction label="Company Groups" icon={Building2} href="/company-groups" color="indigo" />
            <QuickAction label="CG NEW (SSoT)" icon={Users} href="/corporate/cg-new" color="indigo" />
            <QuickAction label="Add Company" icon={Plus} href="/corporate/companies/new" color="blue" />
            <QuickAction label="Add Asset" icon={Package} href="/corporate/assets/new" />
            <QuickAction label="View Directors" icon={Users} href="/corporate/directors" />
            <QuickAction label="Compliance Calendar" icon={Calendar} href="/corporate/compliance-calendar" />
            <QuickAction label="Minute Templates" icon={FileText} href="/corporate/minute-templates" />
            <QuickAction label="Xero Integration" icon={ExternalLink} href="/xero" />
            <QuickAction label="ASIC Logins" icon={Key} href="/corporate/asic-logins" />
            <QuickAction label="Document Types" icon={FolderOpen} href="/corporate/document-types" />
            <QuickAction label="Consolidation" icon={ArrowLeftRight} href="/corporate/consolidation" />
          </div>
        </CardContent>
      </Card>

      {/* Data Health Indicator */}
      {stats.healthScore > 0 && (
        <Card
          className="cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => router.push("/corporate/health")}
        >
          <CardContent className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={cn(
                "p-2 rounded-full",
                stats.healthScore >= 80 ? "bg-green-100 text-green-600" :
                stats.healthScore >= 60 ? "bg-yellow-100 text-yellow-600" :
                "bg-red-100 text-red-600"
              )}>
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <p className="font-medium">Data Health</p>
                <p className="text-sm text-muted-foreground">
                  {stats.criticalCompanies > 0
                    ? `${stats.criticalCompanies} issues found • Click to fix`
                    : "All companies healthy"}
                </p>
              </div>
            </div>
            <span className={cn(
              "text-2xl font-bold",
              stats.healthScore >= 80 ? "text-green-600" :
              stats.healthScore >= 60 ? "text-yellow-600" :
              "text-red-600"
            )}>
              {stats.healthScore.toFixed(0)}%
            </span>
          </CardContent>
        </Card>
      )}

      {/* Companies Table */}
      <TeeemTableView
        foundationId="companies"
        foundationIdNumeric={COMPANIES_TABLE_ID}
        tableName="All Companies"
        entries={companies}
        columns={columns}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onBulkDelete={handleBulkDelete}
        onRowDoubleClick={(company) => router.push(`/corporate/companies/${company.id}`)}
        enableExport={true}
        enableSchemaEditor={true}
        hideUpdateViewButton={true}
        onColumnUpdate={fetchColumns}
        leftActions={
          <Button onClick={() => router.push("/corporate/companies/new")}>
            <Plus className="h-4 w-4 mr-2" />
            Add Company
          </Button>
        }
      />

      {/* Upcoming Compliance */}
      {upcomingCompliance.length > 0 && (
        <Card>
          <CardContent className="p-6">
            <h3 className="text-base font-medium mb-4">Upcoming Compliance (Next 30 Days)</h3>
            <div className="space-y-3">
              {upcomingCompliance.map((item) => (
                <div
                  key={item.id}
                  onClick={() => router.push(`/corporate/companies/${item.company.slug || item.company.id}?tab=compliance`)}
                  className="flex items-center justify-between p-3 bg-orange-50 dark:bg-orange-950/20 rounded-lg cursor-pointer hover:bg-orange-100 dark:hover:bg-orange-950/30 transition-colors"
                >
                  <div className="flex-1">
                    <p className="text-sm font-medium">{item.title}</p>
                    <p className="text-sm text-muted-foreground">{item.company.name}</p>
                  </div>
                  <div className="text-right">
                    <Badge variant={item.days_until_due <= 7 ? "destructive" : "default"}>
                      {item.days_until_due} days
                    </Badge>
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(item.due_date).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
            <Button
              variant="link"
              className="mt-4 p-0 h-auto"
              onClick={() => router.push("/corporate/compliance-calendar")}
            >
              View all compliance items →
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
