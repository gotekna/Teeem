"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard,
  Building2,
  Scale,
  TrendingUp,
  Calculator,
  FileSpreadsheet,
  RefreshCw,
} from "lucide-react";
import { api } from "@/lib/api";

interface Company {
  id: number;
  name: string;
  entity_type: string;
  xero_connected: boolean;
}

const FINANCIAL_TABS = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "bank", label: "Bank Accounts", icon: Building2 },
  { id: "aged", label: "Aged Reports", icon: Scale },
  { id: "cashflow", label: "Cash Flow", icon: TrendingUp },
  { id: "bas", label: "BAS", icon: Calculator },
  { id: "reports", label: "Reports", icon: FileSpreadsheet },
];

export default function FinancialLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [companies, setCompanies] = React.useState<Company[]>([]);
  const [refreshing, setRefreshing] = React.useState(false);

  // Extract current tab and company from path
  // /financial → "dashboard"
  // /financial/bank → "bank"
  // /financial/aged/company/123 → "aged", company "123"
  const pathParts = pathname.replace("/financial", "").split("/").filter(Boolean);

  // Check if it's a known tab or a sub-path like "transactions", "reports", "tas"
  const KNOWN_TABS = ["dashboard", "bank", "aged", "cashflow", "bas", "reports"];
  const SUB_PAGES = ["transactions", "tas"]; // These have their own pages

  const firstPart = pathParts[0] || "dashboard";
  const isSubPage = SUB_PAGES.includes(firstPart);
  const currentTab = isSubPage ? "dashboard" : (KNOWN_TABS.includes(firstPart) ? firstPart : "dashboard");

  // Extract company ID if present (pattern: .../company/123)
  const companyIndex = pathParts.indexOf("company");
  const selectedCompany = companyIndex >= 0 && pathParts[companyIndex + 1]
    ? pathParts[companyIndex + 1]
    : "all";

  // Load companies
  React.useEffect(() => {
    const loadCompanies = async () => {
      try {
        const res = await api.get<{ success: boolean; companies: Company[] }>("/api/v1/companies");
        if (res?.companies) {
          setCompanies(res.companies);
        }
      } catch (error) {
        console.debug("Failed to load companies:", error);
      }
    };
    loadCompanies();
  }, []);

  const handleTabChange = (tabId: string) => {
    let path = `/financial/${tabId === "dashboard" ? "" : tabId}`;
    if (selectedCompany !== "all") {
      path += `/company/${selectedCompany}`;
    }
    router.push(path);
  };

  const handleCompanyChange = (companyId: string) => {
    const tabPath = currentTab === "dashboard" ? "" : currentTab;
    if (companyId === "all") {
      router.push(`/financial/${tabPath}`);
    } else {
      router.push(`/financial/${tabPath}/company/${companyId}`);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    // Trigger a page reload to refresh data
    router.refresh();
    setTimeout(() => setRefreshing(false), 1000);
  };

  // Don't show navigation for sub-pages (transactions, tas) - they have their own layout
  if (isSubPage) {
    return <>{children}</>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight font-serif">Financial</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Track income, expenses, and financial performance
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Company Selector */}
          <Select value={selectedCompany} onValueChange={handleCompanyChange}>
            <SelectTrigger className="w-[200px]">
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

          {/* Refresh Button */}
          <Button variant="outline" size="icon" onClick={handleRefresh} disabled={refreshing}>
            <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {/* Tab Navigation */}
      <TabsList>
        {FINANCIAL_TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = currentTab === tab.id;
          return (
            <TabsTrigger
              key={tab.id}
              value={tab.id}
              onClick={() => handleTabChange(tab.id)}
              data-state={isActive ? "active" : "inactive"}
              className="gap-2"
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </TabsTrigger>
          );
        })}
      </TabsList>

      {/* Content */}
      <div>{children}</div>
    </div>
  );
}
