"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  RefreshCw,
  ChevronDown,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  Minus,
  FileText,
  DollarSign,
  BarChart3,
  Package,
  Settings,
} from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { JobQuantityVariablesForm } from "./JobQuantityVariablesForm";
import { JobRecipesPanel } from "./JobRecipesPanel";

interface LineItem {
  id: number;
  description: string;
  quantity: number;
  unit_price: number;
  total: number;
}

interface PurchaseOrder {
  id: number;
  po_number: string;
  supplier_name: string;
  status: string;
  budget: number;
  total: number;
  line_items: LineItem[];
}

interface BOQCategory {
  name: string;
  purchase_orders: PurchaseOrder[];
  boq_total: number;
  po_total: number;
  variance: number;
  variance_percent: number;
}

interface BOQSummary {
  boq_total: number;
  po_total: number;
  variance: number;
  variance_percent: number;
  contract_value: number;
  po_count: number;
  category_count: number;
}

interface BOQData {
  success: boolean;
  job: {
    id: number;
    name: string;
    contract_value: number;
  };
  categories: BOQCategory[];
  summary: BOQSummary;
}

interface JobBOQTabProps {
  jobId: string | number;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-AU", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
}

export function JobBOQTab({ jobId }: JobBOQTabProps) {
  const [loading, setLoading] = useState(true);
  const [boqData, setBOQData] = useState<BOQData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<string[]>([]);

  useEffect(() => {
    loadBOQData();
  }, [jobId]);

  const loadBOQData = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get<BOQData>(`/api/v1/jobs/${jobId}/boq`);
      if (response?.success) {
        setBOQData(response);
      } else {
        setError("Failed to load BOQ data");
      }
    } catch (err) {
      console.error("Failed to load BOQ data:", err);
      setError("Failed to load BOQ data");
    } finally {
      setLoading(false);
    }
  };

  const toggleCategory = (name: string) => {
    setExpandedCategories((prev) =>
      prev.includes(name) ? prev.filter((c) => c !== name) : [...prev, name]
    );
  };

  const expandAll = () => {
    if (boqData) {
      setExpandedCategories(boqData.categories.map((c) => c.name));
    }
  };

  const collapseAll = () => {
    setExpandedCategories([]);
  };

  const getVarianceColor = (variance: number) => {
    if (variance === 0) return "text-muted-foreground";
    if (variance > 0) return "text-red-600 dark:text-red-400"; // Over budget
    return "text-green-600 dark:text-green-400"; // Under budget
  };

  const getVarianceIcon = (variance: number) => {
    if (variance === 0) return <Minus className="h-4 w-4" />;
    if (variance > 0) return <TrendingUp className="h-4 w-4" />;
    return <TrendingDown className="h-4 w-4" />;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner size={32} className="text-muted-foreground" />
      </div>
    );
  }

  if (error || !boqData) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="text-center">
            <p className="text-muted-foreground">{error || "No data available"}</p>
            <Button variant="outline" onClick={loadBOQData} className="mt-4">
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const { summary, categories } = boqData;

  return (
    <Tabs defaultValue="comparison" className="space-y-6">
      <TabsList>
        <TabsTrigger value="comparison" className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4" />
          BOQ vs PO
        </TabsTrigger>
        <TabsTrigger value="recipes" className="flex items-center gap-2">
          <Package className="h-4 w-4" />
          Recipes
        </TabsTrigger>
        <TabsTrigger value="variables" className="flex items-center gap-2">
          <Settings className="h-4 w-4" />
          House Specs
        </TabsTrigger>
      </TabsList>

      {/* BOQ Comparison Tab */}
      <TabsContent value="comparison" className="space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <FileText className="h-4 w-4" />
              BOQ Total
            </div>
            <div className="text-2xl font-bold">{formatCurrency(summary.boq_total)}</div>
            <div className="text-xs text-muted-foreground mt-1">
              {summary.category_count} categories
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <DollarSign className="h-4 w-4" />
              PO Total
            </div>
            <div className="text-2xl font-bold">{formatCurrency(summary.po_total)}</div>
            <div className="text-xs text-muted-foreground mt-1">
              {summary.po_count} purchase orders
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <BarChart3 className="h-4 w-4" />
              Variance
            </div>
            <div className={cn("text-2xl font-bold", getVarianceColor(summary.variance))}>
              {summary.variance >= 0 ? "+" : ""}
              {formatCurrency(summary.variance)}
            </div>
            <div className={cn("text-xs mt-1", getVarianceColor(summary.variance))}>
              {summary.variance_percent >= 0 ? "+" : ""}
              {summary.variance_percent}%
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              Contract Value
            </div>
            <div className="text-2xl font-bold">{formatCurrency(summary.contract_value)}</div>
            <div className="text-xs text-muted-foreground mt-1">
              Margin: {formatCurrency(summary.contract_value - summary.po_total)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={expandAll}>
            Expand All
          </Button>
          <Button variant="outline" size="sm" onClick={collapseAll}>
            Collapse All
          </Button>
        </div>
        <Button variant="outline" size="sm" onClick={loadBOQData}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Side-by-Side Comparison Table */}
      <Card>
        <CardHeader>
          <CardTitle>BOQ vs Purchase Orders</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="w-[40%]">Category / Item</TableHead>
                  <TableHead className="text-right w-[15%]">BOQ Budget</TableHead>
                  <TableHead className="text-right w-[15%]">PO Actual</TableHead>
                  <TableHead className="text-right w-[15%]">Variance</TableHead>
                  <TableHead className="text-right w-[15%]">%</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {categories.map((category) => {
                  const isExpanded = expandedCategories.includes(category.name);

                  return (
                    <>
                      {/* Category Row */}
                      <TableRow
                        key={category.name}
                        className="cursor-pointer hover:bg-muted/50 font-medium"
                        onClick={() => toggleCategory(category.name)}
                      >
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {isExpanded ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                            <span>{category.name}</span>
                            <Badge variant="secondary" className="ml-2">
                              {category.purchase_orders.length} PO{category.purchase_orders.length !== 1 ? "s" : ""}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {formatCurrency(category.boq_total)}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {formatCurrency(category.po_total)}
                        </TableCell>
                        <TableCell className={cn("text-right font-mono", getVarianceColor(category.variance))}>
                          <div className="flex items-center justify-end gap-1">
                            {getVarianceIcon(category.variance)}
                            {category.variance >= 0 ? "+" : ""}
                            {formatCurrency(category.variance)}
                          </div>
                        </TableCell>
                        <TableCell className={cn("text-right font-mono", getVarianceColor(category.variance))}>
                          {category.variance_percent >= 0 ? "+" : ""}
                          {category.variance_percent}%
                        </TableCell>
                      </TableRow>

                      {/* Expanded PO Details */}
                      {isExpanded &&
                        category.purchase_orders.map((po) => (
                          <>
                            {/* PO Header Row */}
                            <TableRow key={`po-${po.id}`} className="bg-muted/30">
                              <TableCell className="pl-10">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-medium">{po.po_number}</span>
                                  <span className="text-sm text-muted-foreground">
                                    - {po.supplier_name}
                                  </span>
                                  <Badge
                                    variant="outline"
                                    className={cn(
                                      "text-xs",
                                      po.status === "draft" && "border-gray-300 text-gray-500",
                                      po.status === "approved" && "border-green-300 text-green-600",
                                      po.status === "sent" && "border-blue-300 text-blue-600"
                                    )}
                                  >
                                    {po.status}
                                  </Badge>
                                </div>
                              </TableCell>
                              <TableCell className="text-right font-mono text-sm text-muted-foreground">
                                {formatCurrency(po.budget)}
                              </TableCell>
                              <TableCell className="text-right font-mono text-sm">
                                {formatCurrency(po.total)}
                              </TableCell>
                              <TableCell
                                className={cn("text-right font-mono text-sm", getVarianceColor(po.total - po.budget))}
                              >
                                {po.total - po.budget >= 0 ? "+" : ""}
                                {formatCurrency(po.total - po.budget)}
                              </TableCell>
                              <TableCell className="text-right font-mono text-sm text-muted-foreground">
                                {po.budget > 0 ? `${(((po.total - po.budget) / po.budget) * 100).toFixed(1)}%` : "-"}
                              </TableCell>
                            </TableRow>

                            {/* PO Line Items */}
                            {po.line_items.map((item) => (
                              <TableRow key={`item-${item.id}`} className="text-sm text-muted-foreground">
                                <TableCell className="pl-14">
                                  {item.description}
                                </TableCell>
                                <TableCell className="text-right font-mono">-</TableCell>
                                <TableCell className="text-right font-mono">
                                  <div className="flex flex-col items-end">
                                    <span>{formatCurrency(item.total)}</span>
                                    <span className="text-xs">
                                      {formatNumber(item.quantity)} × ${formatNumber(item.unit_price)}
                                    </span>
                                  </div>
                                </TableCell>
                                <TableCell className="text-right font-mono">-</TableCell>
                                <TableCell className="text-right font-mono">-</TableCell>
                              </TableRow>
                            ))}
                          </>
                        ))}
                    </>
                  );
                })}

                {/* Totals Row */}
                <TableRow className="bg-muted font-bold border-t-2">
                  <TableCell>TOTAL</TableCell>
                  <TableCell className="text-right font-mono">{formatCurrency(summary.boq_total)}</TableCell>
                  <TableCell className="text-right font-mono">{formatCurrency(summary.po_total)}</TableCell>
                  <TableCell className={cn("text-right font-mono", getVarianceColor(summary.variance))}>
                    <div className="flex items-center justify-end gap-1">
                      {getVarianceIcon(summary.variance)}
                      {summary.variance >= 0 ? "+" : ""}
                      {formatCurrency(summary.variance)}
                    </div>
                  </TableCell>
                  <TableCell className={cn("text-right font-mono", getVarianceColor(summary.variance))}>
                    {summary.variance_percent >= 0 ? "+" : ""}
                    {summary.variance_percent}%
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
      </TabsContent>

      {/* Recipes Tab */}
      <TabsContent value="recipes">
        <JobRecipesPanel jobId={jobId} onPOGenerated={loadBOQData} />
      </TabsContent>

      {/* House Specs Tab */}
      <TabsContent value="variables">
        <JobQuantityVariablesForm jobId={jobId} onSave={loadBOQData} />
      </TabsContent>
    </Tabs>
  );
}

export default JobBOQTab;
