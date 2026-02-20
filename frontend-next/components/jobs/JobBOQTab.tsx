"use client";

import { useState, useEffect, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Spinner } from "@/components/ui/spinner";
import {
  RefreshCw,
  FileText,
  DollarSign,
  BarChart3,
  Package,
  Settings,
  Upload,
} from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/utils/formatters";
import { JobQuantityVariablesForm } from "./JobQuantityVariablesForm";
import { JobRecipesPanel } from "./JobRecipesPanel";
import { DatabuildImportModal } from "@/components/xero/DatabuildImportModal";
import { BillOfQuantities, type BOQGroup } from "@/components/ui/bill-of-quantities";

interface BOQApiGroup {
  id: number | string;
  name: string;
  supplierId: number | null;
  supplierName: string | null;
  taskName: string | null;
  tradeName: string | null;
  stageName: string | null;
  stagePosition: number | null;
  costCentreName: string | null;
  profitCentreName: string | null;
  items: Array<{
    id: number | string;
    description: string;
    quantity: number;
    unitPrice: number;
    gstCode: string;
    subtotal: number;
    pricebookItemCode: string | null;
  }>;
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
  groups: BOQApiGroup[];
  summary: BOQSummary;
}

interface JobBOQTabProps {
  jobId: string | number;
}

export function JobBOQTab({ jobId }: JobBOQTabProps) {
  const [loading, setLoading] = useState(true);
  const [boqData, setBOQData] = useState<BOQData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);

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

  // Convert API groups to BillOfQuantities format
  const boqGroups: BOQGroup[] = useMemo(() => {
    if (!boqData?.groups) return [];
    return boqData.groups.map((g) => ({
      id: g.id,
      name: g.name,
      supplierId: g.supplierId,
      supplierName: g.supplierName,
      taskName: g.taskName,
      tradeName: g.tradeName,
      stageName: g.stageName,
      stagePosition: g.stagePosition,
      costCentreName: g.costCentreName,
      profitCentreName: g.profitCentreName,
      items: g.items.map((item) => ({
        id: item.id,
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        gstCode: item.gstCode,
        subtotal: item.subtotal,
        pricebookItemCode: item.pricebookItemCode,
      })),
    }));
  }, [boqData]);

  const getVarianceColor = (variance: number) => {
    if (variance === 0) return "text-muted-foreground";
    if (variance > 0) return "text-red-600 dark:text-red-400";
    return "text-green-600 dark:text-green-400";
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

  const { summary } = boqData;

  return (
    <Tabs defaultValue="boq" className="flex flex-col h-full">
      <div className="flex items-center justify-between shrink-0 mb-4">
        <TabsList>
          <TabsTrigger value="boq" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Bill of Quantities
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
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowImportModal(true)}>
            <Upload className="h-4 w-4 mr-2" />
            Import CSV
          </Button>
          <Button variant="outline" size="sm" onClick={loadBOQData}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 shrink-0 mb-4">
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <FileText className="h-3.5 w-3.5" />
              BOQ Budget
            </div>
            <div className="text-xl font-bold">{formatCurrency(summary.boq_total)}</div>
            <div className="text-xs text-muted-foreground">
              {summary.category_count} cost centres
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <DollarSign className="h-3.5 w-3.5" />
              PO Total
            </div>
            <div className="text-xl font-bold">{formatCurrency(summary.po_total)}</div>
            <div className="text-xs text-muted-foreground">
              {summary.po_count} purchase orders
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <BarChart3 className="h-3.5 w-3.5" />
              Variance
            </div>
            <div className={cn("text-xl font-bold", getVarianceColor(summary.variance))}>
              {summary.variance >= 0 ? "+" : ""}
              {formatCurrency(summary.variance)}
            </div>
            <div className={cn("text-xs", getVarianceColor(summary.variance))}>
              {summary.variance_percent >= 0 ? "+" : ""}
              {summary.variance_percent}%
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="text-xs text-muted-foreground mb-1">Contract Value</div>
            <div className="text-xl font-bold">{formatCurrency(summary.contract_value)}</div>
            <div className="text-xs text-muted-foreground">
              Margin: {formatCurrency(summary.contract_value - summary.po_total)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* BOQ Tab - BillOfQuantities component */}
      <TabsContent value="boq" className="flex-1 min-h-0 mt-0">
        <BillOfQuantities
          groups={boqGroups}
          readOnly={true}
          loading={loading}
        />
      </TabsContent>

      {/* Recipes Tab */}
      <TabsContent value="recipes" className="flex-1 min-h-0 mt-0">
        <JobRecipesPanel jobId={jobId} onPOGenerated={loadBOQData} />
      </TabsContent>

      {/* House Specs Tab */}
      <TabsContent value="variables" className="flex-1 min-h-0 mt-0">
        <JobQuantityVariablesForm jobId={jobId} onSave={loadBOQData} />
      </TabsContent>

      <DatabuildImportModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onImportComplete={loadBOQData}
        preSelectedJobId={jobId}
      />
    </Tabs>
  );
}

export default JobBOQTab;
