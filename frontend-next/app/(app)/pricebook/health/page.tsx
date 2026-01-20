"use client";

import * as React from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ChevronDown,
  ChevronRight,
  RefreshCw,
  Search,
  Package,
  Users,
  AlertTriangle,
  CheckCircle,
  LinkIcon,
  Settings,
  XCircle,
} from "lucide-react";
import { api } from "@/lib/api";

// Types
interface PricebookItem {
  id: number;
  item_code: string;
  item_name: string;
  category?: string;
  current_price?: number;
  default_supplier?: { id: number; name: string };
}

interface SupplierCategoryEntry {
  supplier: { id: number; name: string };
  category: string;
  coverage_percentage: number;
  items_with_pricing: number;
  total_items_in_category: number;
  missing_items_count: number;
}

interface PriceIssue {
  item_id: number;
  item_code: string;
  item_name: string;
  default_supplier_name?: string;
  item_current_price?: number;
  active_price_value?: number;
  difference?: number;
}

interface HealthChecks {
  totalPricebookItems: number;
  itemsWithoutDefaultSupplier: { count: number; items: PricebookItem[] };
  suppliersWithIncompleteCategoryPricing: {
    count: number;
    suppliersWithIssuesCount: number;
    totalSuppliers: number;
    suppliers: SupplierCategoryEntry[];
  };
  itemsWithDefaultSupplierButNoPriceHistory: { count: number; items: PricebookItem[] };
  itemsRequiringPhotoWithoutImage: { count: number; items: PricebookItem[] };
}

interface PriceHealthCheck {
  total_items_checked: number;
  issues_found: number;
  issues: PriceIssue[];
}

interface XeroSyncHealth {
  overall_status: string;
  total_linked_contacts: number;
  total_contacts_with_errors: number;
  total_contacts_with_conflicts: number;
  sync_enabled_count: number;
  total_organizations: number;
  organizations?: Array<{
    xero_tenant_id: string;
    xero_tenant_name: string;
    status: string;
    linked_contacts: number;
    contacts_with_errors: number;
    contacts_with_conflicts: number;
  }>;
  recent_errors?: Array<{
    contact_id: number;
    contact_name: string;
    error: string;
  }>;
}

interface XeroInvoiceSyncHealth {
  total_invoices: number;
  linked_to_jobs: number;
  linked_to_contacts: number;
  with_errors_count: number;
  by_type?: Record<string, number>;
  by_status?: Record<string, number>;
  last_synced_at?: string;
}

interface DuplicateContact {
  id: number;
  display_name: string;
  email?: string;
  entity_type?: string;
  has_xero?: boolean;
  contact_types?: string[];
}

interface DuplicateGroup {
  match_type: string;
  match_value: string;
  contacts: DuplicateContact[];
}

interface DuplicateContacts {
  total_duplicate_groups: number;
  total_contacts_involved: number;
  duplicates: DuplicateGroup[];
}

// Health percentage calculation
const calculateHealthPercentage = (issueCount: number, totalItems: number): number => {
  if (totalItems === 0) return 100;
  if (issueCount === 0) return 100;
  const healthyCount = totalItems - issueCount;
  const percentage = (healthyCount / totalItems) * 100;
  return Math.min(99, Math.round(percentage));
};

const getHealthColor = (percentage: number): string => {
  if (percentage === 100) return "green";
  if (percentage >= 75) return "orange";
  return "red";
};


// Health Score Ring Component
function HealthScoreRing({ percentage, size = 64 }: { percentage: number; size?: number }) {
  const color = getHealthColor(percentage);
  const colorClass = color === "green" ? "text-green-500 dark:text-green-400" : color === "orange" ? "text-orange-500 dark:text-orange-400" : "text-red-500 dark:text-red-400";

  return (
    <div className={`w-${size/4} h-${size/4}`} style={{ width: size, height: size }}>
      <svg className="transform -rotate-90" viewBox="0 0 100 100">
        <circle
          cx="50"
          cy="50"
          r="42"
          fill="none"
          stroke="currentColor"
          strokeWidth="12"
          className="text-muted"
        />
        <circle
          cx="50"
          cy="50"
          r="42"
          fill="none"
          stroke="currentColor"
          strokeWidth="12"
          strokeDasharray={`${(percentage / 100) * 264} 264`}
          strokeLinecap="round"
          className={colorClass}
        />
      </svg>
    </div>
  );
}

// Health Check Section Component
function HealthCheckSection({
  title,
  description,
  count,
  percentage,
  isExpanded,
  onToggle,
  searchValue,
  onSearchChange,
  children,
}: {
  title: string;
  description: string;
  count: number;
  percentage: number;
  isExpanded: boolean;
  onToggle: () => void;
  searchValue: string;
  onSearchChange: (value: string) => void;
  children?: React.ReactNode;
}) {
  const color = getHealthColor(percentage);
  const colorClass = color === "green" ? "text-green-500 dark:text-green-400 bg-green-500/10" :
                     color === "orange" ? "text-orange-500 dark:text-orange-400 bg-orange-500/10" :
                     "text-red-500 dark:text-red-400 bg-red-500/10";

  return (
    <div className="border-b last:border-b-0">
      <div className="flex items-start justify-between p-4">
        <div className="flex-1">
          <div className="flex items-start gap-3">
            <button
              onClick={onToggle}
              className="flex items-center gap-3 hover:bg-muted/50 rounded-lg transition-colors"
            >
              <div className={`flex items-center justify-center w-12 h-12 rounded-lg ${colorClass}`}>
                <span className="text-2xl font-bold">{count}</span>
              </div>
              <div className="text-left">
                <h3 className="text-base font-medium flex items-center gap-2">
                  {title}
                  <span className={`text-sm font-bold ${color === "green" ? "text-green-500 dark:text-green-400" : color === "orange" ? "text-orange-500 dark:text-orange-400" : "text-red-500 dark:text-red-400"}`}>
                    ({percentage}%)
                  </span>
                  {count > 0 && (
                    isExpanded ? <ChevronDown className="h-5 w-5 text-muted-foreground" /> : <ChevronRight className="h-5 w-5 text-muted-foreground" />
                  )}
                </h3>
                <p className="text-sm text-muted-foreground mt-1">{description}</p>
              </div>
            </button>
            {count > 0 && (
              <div className="relative flex-1 max-w-xs ml-4">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search..."
                  value={searchValue}
                  onChange={(e) => onSearchChange(e.target.value)}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!isExpanded) onToggle();
                  }}
                  className="pl-9"
                />
              </div>
            )}
          </div>
          {isExpanded && children && <div className="mt-4 ml-15">{children}</div>}
        </div>
        <Badge variant={count === 0 ? "default" : "secondary"}>
          {count === 0 ? "Healthy" : "Needs Attention"}
        </Badge>
      </div>
    </div>
  );
}

export default function PricebookHealthPage() {
  const [loading, setLoading] = React.useState(true);
  const [healthChecks, setHealthChecks] = React.useState<HealthChecks>({
    totalPricebookItems: 0,
    itemsWithoutDefaultSupplier: { count: 0, items: [] },
    suppliersWithIncompleteCategoryPricing: { count: 0, suppliersWithIssuesCount: 0, totalSuppliers: 0, suppliers: [] },
    itemsWithDefaultSupplierButNoPriceHistory: { count: 0, items: [] },
    itemsRequiringPhotoWithoutImage: { count: 0, items: [] },
  });
  const [priceHealthCheck, setPriceHealthCheck] = React.useState<PriceHealthCheck>({
    total_items_checked: 0,
    issues_found: 0,
    issues: [],
  });
  const [xeroSyncHealth, setXeroSyncHealth] = React.useState<XeroSyncHealth | null>(null);
  const [xeroInvoiceSyncHealth, setXeroInvoiceSyncHealth] = React.useState<XeroInvoiceSyncHealth | null>(null);
  const [duplicateContacts, setDuplicateContacts] = React.useState<DuplicateContacts | null>(null);
  const [loadingDuplicates, setLoadingDuplicates] = React.useState(false);

  // Expanded sections state
  const [expandedSections, setExpandedSections] = React.useState({
    itemsWithoutDefaultSupplier: false,
    suppliersWithIncompleteCategoryPricing: false,
    itemsWithDefaultSupplierButNoPriceHistory: false,
    itemsRequiringPhotoWithoutImage: false,
    priceMismatches: false,
    xeroSync: true,
    xeroInvoiceSync: true,
    duplicateContacts: true,
  });

  // Search queries state
  const [searchQueries, setSearchQueries] = React.useState({
    itemsWithoutDefaultSupplier: "",
    suppliersWithIncompleteCategoryPricing: "",
    itemsWithDefaultSupplierButNoPriceHistory: "",
    itemsRequiringPhotoWithoutImage: "",
    priceMismatches: "",
  });

  // Expanded supplier category for nested view
  const [expandedSupplierCategory, setExpandedSupplierCategory] = React.useState<string | null>(null);
  const [loadingMissingItems, setLoadingMissingItems] = React.useState(false);
  const [missingItems, setMissingItems] = React.useState<Record<string, PricebookItem[]>>({});

  const toggleSection = (sectionName: keyof typeof expandedSections) => {
    setExpandedSections((prev) => ({ ...prev, [sectionName]: !prev[sectionName] }));
  };

  const updateSearchQuery = (sectionName: keyof typeof searchQueries, value: string) => {
    setSearchQueries((prev) => ({ ...prev, [sectionName]: value }));
  };

  const filterItems = (items: PricebookItem[], sectionName: keyof typeof searchQueries) => {
    const query = searchQueries[sectionName];
    if (!query.trim()) return items;
    const queryLower = query.toLowerCase();
    return items.filter(
      (item) =>
        item.item_code?.toLowerCase().includes(queryLower) ||
        item.item_name?.toLowerCase().includes(queryLower) ||
        item.category?.toLowerCase().includes(queryLower)
    );
  };

  const filterSuppliers = (suppliers: SupplierCategoryEntry[]) => {
    const query = searchQueries.suppliersWithIncompleteCategoryPricing;
    if (!query.trim()) return suppliers;
    const queryLower = query.toLowerCase();
    return suppliers.filter(
      (entry) =>
        entry.supplier?.name?.toLowerCase().includes(queryLower) ||
        entry.category?.toLowerCase().includes(queryLower)
    );
  };

  // Load data functions
  const loadHealthData = async () => {
    try {
      setLoading(true);
      const response = await api.get<HealthChecks>("/api/v1/health/pricebook");
      setHealthChecks(response);
    } catch (error) {
      console.error("Failed to load health data:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadPriceHealthCheck = async () => {
    try {
      const response = await api.get<PriceHealthCheck>("/api/v1/pricebook/price_health_check");
      setPriceHealthCheck(response);
    } catch (error) {
      console.error("Failed to load price health check:", error);
    }
  };

  const loadXeroSyncHealth = async () => {
    try {
      const response = await api.get<{ health: XeroSyncHealth }>("/api/v1/sync_configurations/health");
      setXeroSyncHealth(response.health);
    } catch (error) {
      console.error("Failed to load Xero sync health:", error);
    }
  };

  const loadXeroInvoiceSyncHealth = async () => {
    try {
      const response = await api.get<{ success: boolean; data: XeroInvoiceSyncHealth }>("/api/v1/external_invoices/sync_status");
      if (response?.success) {
        setXeroInvoiceSyncHealth(response.data);
      }
    } catch (error) {
      console.error("Failed to load Xero invoice sync health:", error);
    }
  };

  const triggerInvoiceSync = async (incremental = true) => {
    try {
      await api.post("/api/v1/external_invoices/trigger_sync", { incremental: incremental ? "true" : "false" });
      await loadXeroInvoiceSyncHealth();
    } catch (error) {
      console.error("Failed to trigger invoice sync:", error);
    }
  };

  const loadDuplicateContacts = async () => {
    try {
      setLoadingDuplicates(true);
      const response = await api.get<DuplicateContacts>("/api/v1/contacts/merge/duplicates");
      setDuplicateContacts(response);
    } catch (error) {
      console.error("Failed to load duplicate contacts:", error);
    } finally {
      setLoadingDuplicates(false);
    }
  };

  const toggleSupplierCategory = async (supplierId: number, category: string) => {
    const key = `${supplierId}-${category}`;
    if (expandedSupplierCategory === key) {
      setExpandedSupplierCategory(null);
      return;
    }
    setExpandedSupplierCategory(key);
    if (!missingItems[key]) {
      try {
        setLoadingMissingItems(true);
        const response = await api.get<{ items: PricebookItem[] }>(`/api/v1/health/pricebook/missing_items?supplier_id=${supplierId}&category=${encodeURIComponent(category)}`);
        setMissingItems((prev) => ({ ...prev, [key]: response.items }));
      } catch (error) {
        console.error("Failed to load missing items:", error);
      } finally {
        setLoadingMissingItems(false);
      }
    }
  };

  React.useEffect(() => {
    loadHealthData();
    loadPriceHealthCheck();
    loadXeroSyncHealth();
    loadXeroInvoiceSyncHealth();
    loadDuplicateContacts();
  }, []);

  // Calculate health percentages
  const totalPricebookItems = healthChecks.totalPricebookItems || 0;

  const itemsWithoutDefaultSupplierPct = calculateHealthPercentage(
    healthChecks.itemsWithoutDefaultSupplier.count,
    totalPricebookItems
  );

  const itemsWithDefaultSupplierButNoPriceHistoryPct = calculateHealthPercentage(
    healthChecks.itemsWithDefaultSupplierButNoPriceHistory.count,
    totalPricebookItems
  );

  const itemsRequiringPhotoWithoutImagePct = calculateHealthPercentage(
    healthChecks.itemsRequiringPhotoWithoutImage.count,
    totalPricebookItems
  );

  const priceMismatchesPct = calculateHealthPercentage(
    priceHealthCheck.issues_found,
    priceHealthCheck.total_items_checked
  );

  const suppliersHealthPct = calculateHealthPercentage(
    healthChecks.suppliersWithIncompleteCategoryPricing.suppliersWithIssuesCount || 0,
    healthChecks.suppliersWithIncompleteCategoryPricing.totalSuppliers || 0
  );

  const overallHealthPercentage = Math.round(
    (itemsWithoutDefaultSupplierPct +
      suppliersHealthPct +
      itemsWithDefaultSupplierButNoPriceHistoryPct +
      itemsRequiringPhotoWithoutImagePct +
      priceMismatchesPct) /
      5
  );

  const healthColor = getHealthColor(overallHealthPercentage);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Spinner size={48} className="text-primary" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b bg-background px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center justify-center w-10 h-10 bg-red-100 dark:bg-red-900/30 rounded-lg">
              <Package className="h-6 w-6 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold">Pricebook Health</h1>
              <p className="text-sm text-muted-foreground">Monitor pricebook data quality and integrity</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="text-right">
                <div className="text-sm font-medium text-muted-foreground">Overall Health</div>
                <div
                  className={`text-3xl font-bold ${
                    healthColor === "green"
                      ? "text-green-500 dark:text-green-400"
                      : healthColor === "orange"
                      ? "text-orange-500 dark:text-orange-400"
                      : "text-red-500 dark:text-red-400"
                  }`}
                >
                  {overallHealthPercentage}%
                </div>
              </div>
              <HealthScoreRing percentage={overallHealthPercentage} />
            </div>
            <Button variant="outline" onClick={loadHealthData} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Pricebook Health Section */}
          <Card>
            <CardHeader>
              <CardTitle>Pricebook Data Quality</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {/* Items Without Default Supplier */}
              <HealthCheckSection
                title="Items Without Default Supplier"
                description="Pricebook items that don't have a default supplier assigned"
                count={healthChecks.itemsWithoutDefaultSupplier.count}
                percentage={itemsWithoutDefaultSupplierPct}
                isExpanded={expandedSections.itemsWithoutDefaultSupplier}
                onToggle={() => toggleSection("itemsWithoutDefaultSupplier")}
                searchValue={searchQueries.itemsWithoutDefaultSupplier}
                onSearchChange={(v) => updateSearchQuery("itemsWithoutDefaultSupplier", v)}
              >
                {healthChecks.itemsWithoutDefaultSupplier.count > 0 && (
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Item Code</TableHead>
                          <TableHead>Item Name</TableHead>
                          <TableHead>Category</TableHead>
                          <TableHead className="text-right">Current Price</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filterItems(healthChecks.itemsWithoutDefaultSupplier.items, "itemsWithoutDefaultSupplier")
                          .slice(0, 10)
                          .map((item) => (
                            <TableRow key={item.id}>
                              <TableCell>
                                <Link href={`/pricebook/${item.id}`} className="text-primary hover:underline font-medium">
                                  {item.item_code}
                                </Link>
                              </TableCell>
                              <TableCell>{item.item_name}</TableCell>
                              <TableCell className="text-muted-foreground">{item.category || "-"}</TableCell>
                              <TableCell className="text-right text-muted-foreground">
                                {item.current_price ? `$${Number(item.current_price).toFixed(2)}` : "-"}
                              </TableCell>
                            </TableRow>
                          ))}
                      </TableBody>
                    </Table>
                    {healthChecks.itemsWithoutDefaultSupplier.count > 10 && (
                      <div className="px-4 py-3 bg-muted text-sm text-muted-foreground text-center">
                        Showing 10 of {healthChecks.itemsWithoutDefaultSupplier.count} items
                      </div>
                    )}
                  </div>
                )}
              </HealthCheckSection>

              {/* Suppliers with Incomplete Category Pricing */}
              <HealthCheckSection
                title="Suppliers with Incomplete Category Pricing"
                description="Suppliers who have price history for some items in a category but not all"
                count={healthChecks.suppliersWithIncompleteCategoryPricing.count}
                percentage={suppliersHealthPct}
                isExpanded={expandedSections.suppliersWithIncompleteCategoryPricing}
                onToggle={() => toggleSection("suppliersWithIncompleteCategoryPricing")}
                searchValue={searchQueries.suppliersWithIncompleteCategoryPricing}
                onSearchChange={(v) => updateSearchQuery("suppliersWithIncompleteCategoryPricing", v)}
              >
                {healthChecks.suppliersWithIncompleteCategoryPricing.count > 0 && (
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Supplier</TableHead>
                          <TableHead>Category</TableHead>
                          <TableHead className="text-center">Coverage</TableHead>
                          <TableHead className="text-center">Items Priced</TableHead>
                          <TableHead className="text-center">Missing Prices</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filterSuppliers(healthChecks.suppliersWithIncompleteCategoryPricing.suppliers)
                          .slice(0, 15)
                          .map((entry, idx) => {
                            const key = `${entry.supplier.id}-${entry.category}`;
                            const isExpanded = expandedSupplierCategory === key;
                            const items = missingItems[key] || [];

                            return (
                              <React.Fragment key={idx}>
                                <TableRow
                                  className="cursor-pointer hover:bg-muted/50"
                                  onClick={() => toggleSupplierCategory(entry.supplier.id, entry.category)}
                                >
                                  <TableCell className="font-medium">
                                    <div className="flex items-center gap-2">
                                      {isExpanded ? (
                                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                      ) : (
                                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                      )}
                                      {entry.supplier.name}
                                    </div>
                                  </TableCell>
                                  <TableCell>{entry.category}</TableCell>
                                  <TableCell>
                                    <div className="flex items-center justify-center gap-2">
                                      <Progress
                                        value={entry.coverage_percentage}
                                        className="w-24 h-2"
                                      />
                                      <span className="text-xs text-muted-foreground">
                                        {entry.coverage_percentage}%
                                      </span>
                                    </div>
                                  </TableCell>
                                  <TableCell className="text-center text-muted-foreground">
                                    {entry.items_with_pricing} / {entry.total_items_in_category}
                                  </TableCell>
                                  <TableCell className="text-center">
                                    <Badge variant="secondary">{entry.missing_items_count}</Badge>
                                  </TableCell>
                                </TableRow>
                                {isExpanded && (
                                  <TableRow>
                                    <TableCell colSpan={5} className="bg-muted/30 p-4">
                                      {loadingMissingItems ? (
                                        <div className="flex items-center justify-center py-4">
                                          <Spinner size={24} />
                                          <span className="ml-2 text-sm text-muted-foreground">Loading missing items...</span>
                                        </div>
                                      ) : items.length > 0 ? (
                                        <div className="space-y-2">
                                          <div className="text-xs font-medium text-muted-foreground mb-3">
                                            Missing Items for {entry.supplier.name} in {entry.category}:
                                          </div>
                                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                                            {items.map((item) => (
                                              <div
                                                key={item.id}
                                                className="flex items-center gap-2 p-2 bg-background rounded border text-xs"
                                              >
                                                <span className="font-mono text-muted-foreground">{item.item_code}</span>
                                                <span className="truncate">{item.item_name}</span>
                                              </div>
                                            ))}
                                          </div>
                                        </div>
                                      ) : (
                                        <div className="text-sm text-muted-foreground text-center py-2">
                                          No missing items found
                                        </div>
                                      )}
                                    </TableCell>
                                  </TableRow>
                                )}
                              </React.Fragment>
                            );
                          })}
                      </TableBody>
                    </Table>
                    {healthChecks.suppliersWithIncompleteCategoryPricing.count > 15 && (
                      <div className="px-4 py-3 bg-muted text-sm text-muted-foreground text-center">
                        Showing 15 of {healthChecks.suppliersWithIncompleteCategoryPricing.count} supplier-category combinations
                      </div>
                    )}
                  </div>
                )}
              </HealthCheckSection>

              {/* Items with Default Supplier but No Price History */}
              <HealthCheckSection
                title="Items with Default Supplier but No Price History"
                description="Items have a default supplier set but no corresponding price history entry"
                count={healthChecks.itemsWithDefaultSupplierButNoPriceHistory.count}
                percentage={itemsWithDefaultSupplierButNoPriceHistoryPct}
                isExpanded={expandedSections.itemsWithDefaultSupplierButNoPriceHistory}
                onToggle={() => toggleSection("itemsWithDefaultSupplierButNoPriceHistory")}
                searchValue={searchQueries.itemsWithDefaultSupplierButNoPriceHistory}
                onSearchChange={(v) => updateSearchQuery("itemsWithDefaultSupplierButNoPriceHistory", v)}
              >
                {healthChecks.itemsWithDefaultSupplierButNoPriceHistory.count > 0 && (
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Item Code</TableHead>
                          <TableHead>Item Name</TableHead>
                          <TableHead>Category</TableHead>
                          <TableHead>Default Supplier</TableHead>
                          <TableHead className="text-right">Current Price</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filterItems(healthChecks.itemsWithDefaultSupplierButNoPriceHistory.items, "itemsWithDefaultSupplierButNoPriceHistory")
                          .slice(0, 15)
                          .map((item) => (
                            <TableRow key={item.id}>
                              <TableCell>
                                <Link href={`/pricebook/${item.id}`} className="text-primary hover:underline font-medium">
                                  {item.item_code}
                                </Link>
                              </TableCell>
                              <TableCell>{item.item_name}</TableCell>
                              <TableCell className="text-muted-foreground">{item.category || "-"}</TableCell>
                              <TableCell className="text-muted-foreground">{item.default_supplier?.name || "-"}</TableCell>
                              <TableCell className="text-right text-muted-foreground">
                                {item.current_price ? `$${Number(item.current_price).toFixed(2)}` : "-"}
                              </TableCell>
                            </TableRow>
                          ))}
                      </TableBody>
                    </Table>
                    {healthChecks.itemsWithDefaultSupplierButNoPriceHistory.count > 15 && (
                      <div className="px-4 py-3 bg-muted text-sm text-muted-foreground text-center">
                        Showing 15 of {healthChecks.itemsWithDefaultSupplierButNoPriceHistory.count} items
                      </div>
                    )}
                  </div>
                )}
              </HealthCheckSection>

              {/* Items Requiring Photo Without Image */}
              <HealthCheckSection
                title="Items Requiring Photo Without Image"
                description="Items marked as requiring a photo but have no image attached"
                count={healthChecks.itemsRequiringPhotoWithoutImage.count}
                percentage={itemsRequiringPhotoWithoutImagePct}
                isExpanded={expandedSections.itemsRequiringPhotoWithoutImage}
                onToggle={() => toggleSection("itemsRequiringPhotoWithoutImage")}
                searchValue={searchQueries.itemsRequiringPhotoWithoutImage}
                onSearchChange={(v) => updateSearchQuery("itemsRequiringPhotoWithoutImage", v)}
              >
                {healthChecks.itemsRequiringPhotoWithoutImage.count > 0 && (
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Item Code</TableHead>
                          <TableHead>Item Name</TableHead>
                          <TableHead>Category</TableHead>
                          <TableHead className="text-right">Current Price</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filterItems(healthChecks.itemsRequiringPhotoWithoutImage.items, "itemsRequiringPhotoWithoutImage")
                          .slice(0, 10)
                          .map((item) => (
                            <TableRow key={item.id}>
                              <TableCell>
                                <Link href={`/pricebook/${item.id}`} className="text-primary hover:underline font-medium">
                                  {item.item_code}
                                </Link>
                              </TableCell>
                              <TableCell>{item.item_name}</TableCell>
                              <TableCell className="text-muted-foreground">{item.category || "-"}</TableCell>
                              <TableCell className="text-right text-muted-foreground">
                                {item.current_price ? `$${Number(item.current_price).toFixed(2)}` : "-"}
                              </TableCell>
                            </TableRow>
                          ))}
                      </TableBody>
                    </Table>
                    {healthChecks.itemsRequiringPhotoWithoutImage.count > 10 && (
                      <div className="px-4 py-3 bg-muted text-sm text-muted-foreground text-center">
                        Showing 10 of {healthChecks.itemsRequiringPhotoWithoutImage.count} items
                      </div>
                    )}
                  </div>
                )}
              </HealthCheckSection>

              {/* Price Mismatches */}
              <HealthCheckSection
                title="Price Mismatches (Active vs Current)"
                description="Items where the active price from default supplier doesn't match the item's current price"
                count={priceHealthCheck.issues_found}
                percentage={priceMismatchesPct}
                isExpanded={expandedSections.priceMismatches}
                onToggle={() => toggleSection("priceMismatches")}
                searchValue={searchQueries.priceMismatches}
                onSearchChange={(v) => updateSearchQuery("priceMismatches", v)}
              >
                {priceHealthCheck.issues_found > 0 && (
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Item Code</TableHead>
                          <TableHead>Item Name</TableHead>
                          <TableHead>Default Supplier</TableHead>
                          <TableHead className="text-right">Current Price</TableHead>
                          <TableHead className="text-right">Active Price</TableHead>
                          <TableHead className="text-right">Difference</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(() => {
                          const query = searchQueries.priceMismatches.toLowerCase();
                          const filtered = priceHealthCheck.issues.filter(
                            (issue) =>
                              !query.trim() ||
                              issue.item_code?.toLowerCase().includes(query) ||
                              issue.item_name?.toLowerCase().includes(query) ||
                              issue.default_supplier_name?.toLowerCase().includes(query)
                          );
                          return filtered.slice(0, 15).map((issue) => (
                            <TableRow key={issue.item_id}>
                              <TableCell>
                                <Link href={`/pricebook/${issue.item_id}`} className="text-primary hover:underline font-medium">
                                  {issue.item_code}
                                </Link>
                              </TableCell>
                              <TableCell>{issue.item_name}</TableCell>
                              <TableCell className="text-muted-foreground">{issue.default_supplier_name || "-"}</TableCell>
                              <TableCell className="text-right text-muted-foreground">
                                {issue.item_current_price ? `$${Number(issue.item_current_price).toFixed(2)}` : "-"}
                              </TableCell>
                              <TableCell className="text-right font-medium">
                                {issue.active_price_value ? `$${Number(issue.active_price_value).toFixed(2)}` : "-"}
                              </TableCell>
                              <TableCell className="text-right">
                                {issue.difference !== null && issue.difference !== undefined ? (
                                  <span
                                    className={`font-medium ${
                                      issue.difference > 0
                                        ? "text-red-500 dark:text-red-400"
                                        : issue.difference < 0
                                        ? "text-green-500 dark:text-green-400"
                                        : "text-muted-foreground"
                                    }`}
                                  >
                                    {issue.difference > 0 ? "+" : ""}
                                    {issue.difference < 0 ? "-" : ""}${Math.abs(issue.difference).toFixed(2)}
                                  </span>
                                ) : (
                                  <span className="text-muted-foreground">-</span>
                                )}
                              </TableCell>
                            </TableRow>
                          ));
                        })()}
                      </TableBody>
                    </Table>
                    {priceHealthCheck.issues_found > 15 && (
                      <div className="px-4 py-3 bg-muted text-sm text-muted-foreground text-center">
                        Showing 15 of {priceHealthCheck.issues_found} items
                      </div>
                    )}
                  </div>
                )}
              </HealthCheckSection>
            </CardContent>
          </Card>

          {/* Xero Sync Health Section */}
          {xeroSyncHealth && (
            <Card>
              <Accordion
                type="single"
                collapsible
                value={expandedSections.xeroSync ? "xeroSync" : ""}
                onValueChange={(v) => setExpandedSections(prev => ({ ...prev, xeroSync: v === "xeroSync" }))}
              >
                <AccordionItem value="xeroSync" className="border-none">
                  <CardHeader className="p-0">
                    <AccordionTrigger className="px-6 py-4 hover:bg-muted/50 hover:no-underline [&>svg]:hidden">
                      <div className="flex items-center justify-between w-full">
                        <div className="flex items-center gap-3">
                          <CardTitle>Xero Contact Sync Health</CardTitle>
                          <Badge
                            variant={
                              xeroSyncHealth.overall_status === "healthy"
                                ? "default"
                                : xeroSyncHealth.overall_status === "warning"
                                ? "secondary"
                                : xeroSyncHealth.overall_status === "error"
                                ? "destructive"
                                : "outline"
                            }
                          >
                            {xeroSyncHealth.overall_status === "healthy"
                              ? "Healthy"
                              : xeroSyncHealth.overall_status === "warning"
                              ? "Warning"
                              : xeroSyncHealth.overall_status === "error"
                              ? "Errors"
                              : "Disabled"}
                          </Badge>
                        </div>
                        {expandedSections.xeroSync ? (
                          <ChevronDown className="h-5 w-5 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-5 w-5 text-muted-foreground" />
                        )}
                      </div>
                    </AccordionTrigger>
                  </CardHeader>
                  <AccordionContent>
                  <CardContent>
                    {/* Overview Stats */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                      <div className="bg-muted/50 rounded-lg p-4">
                        <div className="flex items-center gap-2 mb-1">
                          <LinkIcon className="h-4 w-4 text-blue-500 dark:text-blue-400" />
                          <span className="text-sm text-muted-foreground">Linked Contacts</span>
                        </div>
                        <div className="text-2xl font-semibold">{xeroSyncHealth.total_linked_contacts || 0}</div>
                      </div>
                      <div className="bg-muted/50 rounded-lg p-4">
                        <div className="flex items-center gap-2 mb-1">
                          <XCircle className="h-4 w-4 text-red-500 dark:text-red-400" />
                          <span className="text-sm text-muted-foreground">With Errors</span>
                        </div>
                        <div className={`text-2xl font-semibold ${xeroSyncHealth.total_contacts_with_errors > 0 ? "text-red-500 dark:text-red-400" : ""}`}>
                          {xeroSyncHealth.total_contacts_with_errors || 0}
                        </div>
                      </div>
                      <div className="bg-muted/50 rounded-lg p-4">
                        <div className="flex items-center gap-2 mb-1">
                          <AlertTriangle className="h-4 w-4 text-yellow-500 dark:text-yellow-400" />
                          <span className="text-sm text-muted-foreground">Conflicts</span>
                        </div>
                        <div className={`text-2xl font-semibold ${xeroSyncHealth.total_contacts_with_conflicts > 0 ? "text-yellow-500 dark:text-yellow-400" : ""}`}>
                          {xeroSyncHealth.total_contacts_with_conflicts || 0}
                        </div>
                      </div>
                      <div className="bg-muted/50 rounded-lg p-4">
                        <div className="flex items-center gap-2 mb-1">
                          <Settings className="h-4 w-4 text-primary" />
                          <span className="text-sm text-muted-foreground">Organizations</span>
                        </div>
                        <div className="text-2xl font-semibold">
                          {xeroSyncHealth.sync_enabled_count || 0} / {xeroSyncHealth.total_organizations || 0}
                        </div>
                      </div>
                    </div>

                    {/* Organization Health */}
                    {xeroSyncHealth.organizations && xeroSyncHealth.organizations.length > 0 && (
                      <div className="mb-6">
                        <h4 className="text-sm font-medium mb-3">Organization Status</h4>
                        <div className="space-y-2">
                          {xeroSyncHealth.organizations.map((org) => (
                            <div
                              key={org.xero_tenant_id}
                              className="flex items-center justify-between p-3 bg-muted/30 rounded-lg"
                            >
                              <div className="flex items-center gap-3">
                                <Badge
                                  variant={
                                    org.status === "healthy"
                                      ? "default"
                                      : org.status === "warning"
                                      ? "secondary"
                                      : org.status === "error"
                                      ? "destructive"
                                      : "outline"
                                  }
                                >
                                  {org.status === "healthy"
                                    ? "Healthy"
                                    : org.status === "warning"
                                    ? "Warning"
                                    : org.status === "error"
                                    ? "Errors"
                                    : "Disabled"}
                                </Badge>
                                <span className="font-medium">{org.xero_tenant_name || "Unnamed Organization"}</span>
                              </div>
                              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                <span>{org.linked_contacts} linked</span>
                                {org.contacts_with_errors > 0 && (
                                  <span className="text-red-500 dark:text-red-400">{org.contacts_with_errors} errors</span>
                                )}
                                {org.contacts_with_conflicts > 0 && (
                                  <span className="text-yellow-500 dark:text-yellow-400">{org.contacts_with_conflicts} conflicts</span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Recent Errors */}
                    {xeroSyncHealth.recent_errors && xeroSyncHealth.recent_errors.length > 0 && (
                      <div className="mb-6">
                        <h4 className="text-sm font-medium mb-3">Recent Sync Errors</h4>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Contact</TableHead>
                              <TableHead>Error</TableHead>
                              <TableHead>Action</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {xeroSyncHealth.recent_errors.slice(0, 5).map((error, idx) => (
                              <TableRow key={idx}>
                                <TableCell className="font-medium">
                                  <Link href={`/contacts/${error.contact_id}`} className="text-primary hover:underline">
                                    {error.contact_name || `Contact #${error.contact_id}`}
                                  </Link>
                                </TableCell>
                                <TableCell className="text-red-500 dark:text-red-400 max-w-xs truncate">{error.error}</TableCell>
                                <TableCell>
                                  <Link href={`/contacts/${error.contact_id}/xero`} className="text-primary hover:underline">
                                    View Details
                                  </Link>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}

                    {/* No Issues / Configure Link */}
                    <div className="flex items-center justify-between">
                      {xeroSyncHealth.total_contacts_with_errors === 0 && xeroSyncHealth.total_contacts_with_conflicts === 0 ? (
                        <div className="flex items-center gap-2 text-green-500 dark:text-green-400">
                          <CheckCircle className="h-5 w-5" />
                          <span className="text-sm">All contacts syncing correctly</span>
                        </div>
                      ) : (
                        <div />
                      )}
                      <Link href="/contacts/sync-config" className="inline-flex items-center text-sm text-primary hover:underline">
                        <Settings className="h-4 w-4 mr-1" />
                        Configure Sync Settings
                      </Link>
                    </div>
                  </CardContent>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </Card>
          )}

          {/* Xero Invoice Sync Health Section */}
          {xeroInvoiceSyncHealth && (
            <Card>
              <Accordion
                type="single"
                collapsible
                value={expandedSections.xeroInvoiceSync ? "xeroInvoiceSync" : ""}
                onValueChange={(v) => setExpandedSections(prev => ({ ...prev, xeroInvoiceSync: v === "xeroInvoiceSync" }))}
              >
                <AccordionItem value="xeroInvoiceSync" className="border-none">
                  <CardHeader className="p-0">
                    <AccordionTrigger className="px-6 py-4 hover:bg-muted/50 hover:no-underline [&>svg]:hidden">
                      <div className="flex items-center justify-between w-full">
                        <div className="flex items-center gap-3">
                          <CardTitle>Xero Invoice Data Warehouse</CardTitle>
                          <Badge variant={xeroInvoiceSyncHealth.with_errors_count > 0 ? "destructive" : "default"}>
                            {xeroInvoiceSyncHealth.with_errors_count > 0 ? "Errors" : "Healthy"}
                          </Badge>
                        </div>
                        {expandedSections.xeroInvoiceSync ? (
                          <ChevronDown className="h-5 w-5 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-5 w-5 text-muted-foreground" />
                        )}
                      </div>
                    </AccordionTrigger>
                  </CardHeader>
                  <AccordionContent>
                  <CardContent>
                    {/* Overview Stats */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                      <div className="bg-muted/50 rounded-lg p-4">
                        <div className="text-sm text-muted-foreground mb-1">Total Cached</div>
                        <div className="text-2xl font-semibold">{xeroInvoiceSyncHealth.total_invoices || 0}</div>
                      </div>
                      <div className="bg-muted/50 rounded-lg p-4">
                        <div className="text-sm text-muted-foreground mb-1">Linked to Jobs</div>
                        <div className="text-2xl font-semibold">{xeroInvoiceSyncHealth.linked_to_jobs || 0}</div>
                      </div>
                      <div className="bg-muted/50 rounded-lg p-4">
                        <div className="text-sm text-muted-foreground mb-1">Linked to Contacts</div>
                        <div className="text-2xl font-semibold">{xeroInvoiceSyncHealth.linked_to_contacts || 0}</div>
                      </div>
                      <div className="bg-muted/50 rounded-lg p-4">
                        <div className="flex items-center gap-2 mb-1">
                          <XCircle className="h-4 w-4 text-red-500 dark:text-red-400" />
                          <span className="text-sm text-muted-foreground">With Errors</span>
                        </div>
                        <div className={`text-2xl font-semibold ${xeroInvoiceSyncHealth.with_errors_count > 0 ? "text-red-500 dark:text-red-400" : ""}`}>
                          {xeroInvoiceSyncHealth.with_errors_count || 0}
                        </div>
                      </div>
                    </div>

                    {/* By Type */}
                    {xeroInvoiceSyncHealth.by_type && (
                      <div className="mb-6">
                        <h4 className="text-sm font-medium mb-3">By Type</h4>
                        <div className="grid grid-cols-2 gap-4">
                          {Object.entries(xeroInvoiceSyncHealth.by_type).map(([type, count]) => (
                            <div key={type} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                              <span className="text-sm text-muted-foreground capitalize">
                                {type === "sales_invoice" ? "Sales Invoices" : type === "bill" ? "Bills" : type}
                              </span>
                              <span className="text-sm font-medium">{count}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* By Status */}
                    {xeroInvoiceSyncHealth.by_status && (
                      <div className="mb-6">
                        <h4 className="text-sm font-medium mb-3">By Status</h4>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          {Object.entries(xeroInvoiceSyncHealth.by_status).map(([status, count]) => (
                            <div key={status} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                              <Badge
                                variant={
                                  status === "paid"
                                    ? "default"
                                    : status === "approved"
                                    ? "secondary"
                                    : status === "draft"
                                    ? "outline"
                                    : status === "voided" || status === "deleted"
                                    ? "destructive"
                                    : "secondary"
                                }
                              >
                                {status}
                              </Badge>
                              <span className="text-sm font-medium">{count}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Last Sync Info */}
                    <div className="flex items-center justify-between">
                      <div className="text-sm text-muted-foreground">
                        {xeroInvoiceSyncHealth.last_synced_at ? (
                          <>Last synced: {new Date(xeroInvoiceSyncHealth.last_synced_at).toLocaleString()}</>
                        ) : (
                          <>Never synced</>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => triggerInvoiceSync(true)}>
                          <RefreshCw className="h-4 w-4 mr-1" />
                          Incremental Sync
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => triggerInvoiceSync(false)}>
                          Full Sync
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </Card>
          )}

          {/* Possible Duplicate Contacts Section */}
          <Card>
            <Accordion
              type="single"
              collapsible
              value={expandedSections.duplicateContacts ? "duplicateContacts" : ""}
              onValueChange={(v) => setExpandedSections(prev => ({ ...prev, duplicateContacts: v === "duplicateContacts" }))}
            >
              <AccordionItem value="duplicateContacts" className="border-none">
                <CardHeader className="p-0">
                  <AccordionTrigger className="px-6 py-4 hover:bg-muted/50 hover:no-underline [&>svg]:hidden">
                    <div className="flex items-center justify-between w-full">
                      <div className="flex items-center gap-3">
                        {expandedSections.duplicateContacts ? (
                          <ChevronDown className="h-5 w-5 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-5 w-5 text-muted-foreground" />
                        )}
                        <CardTitle>Possible Duplicate Contacts</CardTitle>
                        {duplicateContacts && (
                          <Badge variant={duplicateContacts.total_duplicate_groups > 0 ? "secondary" : "default"}>
                            {duplicateContacts.total_duplicate_groups} groups
                          </Badge>
                        )}
                      </div>
                      {loadingDuplicates && <Spinner size={20} className="text-muted-foreground" />}
                    </div>
                  </AccordionTrigger>
                </CardHeader>
                <AccordionContent>
                <CardContent>
                  {loadingDuplicates ? (
                    <div className="flex items-center justify-center py-8">
                      <Spinner size={32} className="text-muted-foreground" />
                    </div>
                  ) : duplicateContacts ? (
                    <>
                      {/* Stats */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                        <div className="bg-muted/50 rounded-lg p-3">
                          <div className="text-sm text-muted-foreground">Duplicate Groups</div>
                          <div className={`text-2xl font-semibold ${duplicateContacts.total_duplicate_groups > 0 ? "text-yellow-500 dark:text-yellow-400" : ""}`}>
                            {duplicateContacts.total_duplicate_groups}
                          </div>
                        </div>
                        <div className="bg-muted/50 rounded-lg p-3">
                          <div className="text-sm text-muted-foreground">Contacts Involved</div>
                          <div className={`text-2xl font-semibold ${duplicateContacts.total_contacts_involved > 0 ? "text-yellow-500 dark:text-yellow-400" : ""}`}>
                            {duplicateContacts.total_contacts_involved}
                          </div>
                        </div>
                      </div>

                      {/* Duplicate Groups List */}
                      {duplicateContacts.duplicates && duplicateContacts.duplicates.length > 0 ? (
                        <div className="space-y-4 max-h-96 overflow-y-auto">
                          {duplicateContacts.duplicates.slice(0, 20).map((group, idx) => (
                            <div key={idx} className="border rounded-lg p-3">
                              <div className="flex items-center gap-2 mb-2">
                                <Badge
                                  variant={
                                    group.match_type === "display_name"
                                      ? "default"
                                      : group.match_type === "first_last_name"
                                      ? "secondary"
                                      : "outline"
                                  }
                                >
                                  {group.match_type === "display_name"
                                    ? "Same Full Name"
                                    : group.match_type === "first_last_name"
                                    ? "Same First+Last"
                                    : "Same Email"}
                                </Badge>
                                <span className="text-sm font-medium">"{group.match_value}"</span>
                                <span className="text-xs text-muted-foreground">({group.contacts.length} contacts)</span>
                              </div>
                              <div className="space-y-1">
                                {group.contacts.map((contact) => (
                                  <div
                                    key={contact.id}
                                    className="flex items-center justify-between text-sm bg-muted/30 rounded px-2 py-1"
                                  >
                                    <div className="flex items-center gap-2">
                                      <Link href={`/contacts/${contact.id}`} className="text-primary hover:underline font-medium">
                                        #{contact.id}
                                      </Link>
                                      <span>{contact.display_name}</span>
                                      {contact.entity_type && (
                                        <Badge variant="outline" className="text-xs">
                                          {contact.entity_type}
                                        </Badge>
                                      )}
                                      {contact.has_xero && (
                                        <Badge variant="secondary" className="text-xs">
                                          Xero
                                        </Badge>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-2 text-muted-foreground">
                                      {contact.email && <span className="text-xs">{contact.email}</span>}
                                      {contact.contact_types && contact.contact_types.length > 0 && (
                                        <span className="text-xs">{contact.contact_types.join(", ")}</span>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                          {duplicateContacts.duplicates.length > 20 && (
                            <div className="text-center text-sm text-muted-foreground py-2">
                              Showing 20 of {duplicateContacts.duplicates.length} duplicate groups
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-green-500 dark:text-green-400">
                          <CheckCircle className="h-5 w-5" />
                          <span className="text-sm">No duplicate contacts found</span>
                        </div>
                      )}

                      {/* Link to Contacts */}
                      <div className="mt-4 flex justify-end">
                        <Link href="/contacts" className="inline-flex items-center text-sm text-primary hover:underline">
                          <Users className="h-4 w-4 mr-1" />
                          View All Contacts
                        </Link>
                      </div>
                    </>
                  ) : (
                    <div className="text-muted-foreground text-center py-4">Failed to load duplicate contacts data</div>
                  )}
                </CardContent>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </Card>
        </div>
      </div>
    </div>
  );
}
