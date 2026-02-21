"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Spinner } from "@/components/ui/spinner";
import {
  RefreshCw,
  BarChart3,
  Package,
  Settings,
  Upload,
  ExternalLink,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/utils/formatters";
import { JobQuantityVariablesForm } from "./JobQuantityVariablesForm";
import { JobRecipesPanel } from "./JobRecipesPanel";
import { DatabuildImportModal } from "@/components/xero/DatabuildImportModal";
import { BillOfQuantities, type BOQGroup, type BOQSavePayload } from "@/components/ui/bill-of-quantities";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SupplierPicker, type Supplier } from "@/components/ui/supplier-picker";
import { Label } from "@/components/ui/label";

interface BOQApiGroup {
  id: number | string;
  name: string;
  supplierId: number | null;
  supplierName: string | null;
  taskName: string | null;
  taskPosition: number | null;
  tradeName: string | null;
  stageName: string | null;
  stagePosition: number | null;
  costCentreName: string | null;
  tenderName: string | null;
  tenderHeaderName: string | null;
  profitCentreName: string | null;
  items: Array<{
    id: number | string;
    description: string;
    quantity: number;
    unitPrice: number;
    gstCode: string;
    subtotal: number;
    pricebookItemCode: string | null;
    profitCentreId: number | null;
    profitCentreName: string | null;
  }>;
}

interface ProfitCentreOption {
  id: number;
  code: string;
  name: string;
  label: string;
}

interface BOQSummary {
  boq_total: number;
  po_total: number;
  po_subtotal: number;
  po_gst: number;
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
  profitCentres: ProfitCentreOption[];
  summary: BOQSummary;
}

interface SmTaskOption {
  id: number;
  name: string;
  task_number: string | null;
  start_date: string | null;
  po_required: boolean;
  cost_centre: number | null;
  has_existing_po: boolean;
  existing_po_id: number | null;
}

interface JobBOQTabProps {
  jobId: string | number;
}

export function JobBOQTab({ jobId }: JobBOQTabProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [boqData, setBOQData] = useState<BOQData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);

  // Add PO modal state (from Cost Centre or Stage section headers)
  const [showAddPOModal, setShowAddPOModal] = useState(false);
  const [addPOSectionLabel, setAddPOSectionLabel] = useState("");
  const [addPOGroupBy, setAddPOGroupBy] = useState<"costCentre" | "stage">("costCentre");
  const [sectionTasks, setSectionTasks] = useState<SmTaskOption[]>([]);
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [creatingPO, setCreatingPO] = useState(false);

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
      taskPosition: g.taskPosition,
      tradeName: g.tradeName,
      stageName: g.stageName,
      stagePosition: g.stagePosition,
      costCentreName: g.costCentreName,
      tenderName: g.tenderName,
      tenderHeaderName: g.tenderHeaderName,
      profitCentreName: g.profitCentreName,
      items: g.items.map((item) => ({
        id: item.id,
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        gstCode: item.gstCode,
        subtotal: item.subtotal,
        pricebookItemCode: item.pricebookItemCode,
        profitCentreId: item.profitCentreId,
        profitCentreName: item.profitCentreName,
      })),
    }));
  }, [boqData]);

  const getVarianceColor = (variance: number) => {
    if (variance === 0) return "text-muted-foreground";
    if (variance > 0) return "text-red-600 dark:text-red-400";
    return "text-green-600 dark:text-green-400";
  };

  const handleAddPO = useCallback(async (sectionLabel: string, groupBy: "costCentre" | "stage" | "supplier" | "trade" | "profitCentre") => {
    setAddPOSectionLabel(sectionLabel);
    setAddPOGroupBy(groupBy as "costCentre" | "stage");
    setSelectedTaskId(null);
    setSelectedSupplier(null);
    setSectionTasks([]);
    setShowAddPOModal(true);

    // Build filter param based on grouping dimension
    let filterParam = "";
    if (groupBy === "costCentre") {
      // Parse cost centre code from label (e.g., "140" from "140 - Retaining Walls")
      const ccCode = sectionLabel.split(" - ")[0]?.trim();
      if (!ccCode) return;
      filterParam = `cost_centre_code=${encodeURIComponent(ccCode)}`;
    } else if (groupBy === "stage") {
      filterParam = `stage_name=${encodeURIComponent(sectionLabel)}`;
    }

    try {
      setLoadingTasks(true);
      const res = await api.get<{ success: boolean; sm_tasks: SmTaskOption[] }>(
        `/api/v1/jobs/${jobId}/sm_tasks?for=select&${filterParam}`
      );
      const tasks = (res?.sm_tasks || []).filter((t) => t.po_required);
      setSectionTasks(tasks);
    } catch (err) {
      console.error("Failed to load tasks for section:", err);
    } finally {
      setLoadingTasks(false);
    }
  }, [jobId]);

  const handleCreatePO = useCallback(async (andOpen: boolean) => {
    if (!selectedTaskId || !selectedSupplier) return;

    try {
      setCreatingPO(true);
      const res = await api.post<{ success: boolean; purchase_order: { id: number } }>(
        `/api/v1/purchase_orders`,
        {
          purchase_order: {
            job_id: jobId,
            supplier_id: selectedSupplier.id,
            schedule_task_id: selectedTaskId,
            status: "draft",
          },
        }
      );

      if (res?.success) {
        toast.success("Purchase order created");
        setShowAddPOModal(false);
        if (andOpen && res.purchase_order?.id) {
          router.push(`/purchase_orders/${res.purchase_order.id}`);
        } else {
          await loadBOQData();
        }
      } else {
        toast.error("Failed to create purchase order");
      }
    } catch (err) {
      console.error("Failed to create PO:", err);
      toast.error("Failed to create purchase order");
    } finally {
      setCreatingPO(false);
    }
  }, [selectedTaskId, selectedSupplier, jobId, router]);

  const handleGroupClick = useCallback((groupId: number | string) => {
    router.push(`/purchase_orders/${groupId}`);
  }, [router]);

  const handleSave = useCallback(async (payload: BOQSavePayload) => {
    const { quantityChanges, profitCentreChanges, pricebookChanges, newLines } = payload;

    // Group all changes by PO id
    const poUpdates = new Map<string, {
      existing: Array<{ id: string; quantity?: number; profit_centre_id?: number | null; pricebook_item_id?: number }>;
      newItems: Array<{ description: string; quantity: number; unit_price: number; gst_code: string; pricebook_item_id?: number | null; profit_centre_id?: number | null }>;
    }>();

    const ensurePo = (groupId: string) => {
      if (!poUpdates.has(groupId)) {
        poUpdates.set(groupId, { existing: [], newItems: [] });
      }
      return poUpdates.get(groupId)!;
    };

    // Parse quantity changes: key format is "groupId:lineItemId"
    for (const [key, qty] of quantityChanges) {
      const [groupId, lineItemId] = key.split(":");
      ensurePo(groupId).existing.push({ id: lineItemId, quantity: qty });
    }

    // Parse profit centre changes: key format is "groupId:lineItemId"
    if (profitCentreChanges) {
      for (const [key, pcId] of profitCentreChanges) {
        const [groupId, lineItemId] = key.split(":");
        const po = ensurePo(groupId);
        const existingEntry = po.existing.find((e) => e.id === lineItemId);
        if (existingEntry) {
          existingEntry.profit_centre_id = pcId;
        } else {
          po.existing.push({ id: lineItemId, profit_centre_id: pcId });
        }
      }
    }

    // Parse pricebook changes: key format is "groupId:lineItemId"
    if (pricebookChanges) {
      for (const [key, pb] of pricebookChanges) {
        const [groupId, lineItemId] = key.split(":");
        const po = ensurePo(groupId);
        const existingEntry = po.existing.find((e) => e.id === lineItemId);
        if (existingEntry) {
          existingEntry.pricebook_item_id = pb.pricebookItemId;
        } else {
          po.existing.push({ id: lineItemId, pricebook_item_id: pb.pricebookItemId });
        }
      }
    }

    // Group new lines by PO
    for (const nl of newLines) {
      const gid = String(nl.groupId);
      ensurePo(gid).newItems.push({
        description: nl.description,
        quantity: nl.quantity,
        unit_price: nl.unitPrice,
        gst_code: nl.gstCode,
        pricebook_item_id: nl.pricebookItemId,
        profit_centre_id: nl.profitCentreId,
      });
    }

    // Patch each PO with its line item changes
    const errors: string[] = [];
    for (const [poId, updates] of poUpdates) {
      const lineItemsAttributes = [
        ...updates.existing.map((e) => {
          const attrs: Record<string, unknown> = { id: Number(e.id) };
          if (e.quantity !== undefined) attrs.quantity = e.quantity;
          if (e.profit_centre_id !== undefined) attrs.profit_centre_id = e.profit_centre_id;
          if (e.pricebook_item_id !== undefined) attrs.pricebook_item_id = e.pricebook_item_id;
          return attrs;
        }),
        ...updates.newItems.map((n) => ({
          description: n.description,
          quantity: n.quantity,
          unit_price: n.unit_price,
          gst_code: n.gst_code,
          pricebook_item_id: n.pricebook_item_id,
          profit_centre_id: n.profit_centre_id,
        })),
      ];

      try {
        await api.patch(`/api/v1/purchase_orders/${poId}`, {
          purchase_order: { line_items_attributes: lineItemsAttributes },
        });
      } catch (err) {
        console.error(`Failed to update PO ${poId}:`, err);
        errors.push(`PO ${poId}`);
      }
    }

    if (errors.length > 0) {
      toast.error(`Failed to update: ${errors.join(", ")}`);
    } else {
      toast.success(`Updated ${poUpdates.size} purchase order${poUpdates.size !== 1 ? "s" : ""}`);
    }

    // Reload BOQ data to reflect saved changes
    await loadBOQData();
  }, []);

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
      <div className="flex items-center justify-between shrink-0 mb-2">
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
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2 shrink-0 mb-2">
        <Card className="shadow-none">
          <CardContent className="pt-2 pb-2 px-3">
            <div className="text-[10px] text-muted-foreground">Ex GST</div>
            <div className="text-lg font-bold">{formatCurrency(summary.po_subtotal)}</div>
            <div className="text-[10px] text-muted-foreground">{summary.po_count} purchase orders</div>
          </CardContent>
        </Card>
        <Card className="shadow-none">
          <CardContent className="pt-2 pb-2 px-3">
            <div className="text-[10px] text-muted-foreground">GST Amount</div>
            <div className="text-lg font-bold">{formatCurrency(summary.po_gst)}</div>
          </CardContent>
        </Card>
        <Card className="shadow-none">
          <CardContent className="pt-2 pb-2 px-3">
            <div className="text-[10px] text-muted-foreground">Inc GST</div>
            <div className="text-lg font-bold">{formatCurrency(summary.po_total)}</div>
          </CardContent>
        </Card>
        <Card className="shadow-none">
          <CardContent className="pt-2 pb-2 px-3">
            <div className="text-[10px] text-muted-foreground">Variance</div>
            <div className={cn("text-lg font-bold", getVarianceColor(summary.variance))}>
              {summary.variance >= 0 ? "+" : ""}{formatCurrency(summary.variance)}
            </div>
            <div className={cn("text-[10px]", getVarianceColor(summary.variance))}>
              {summary.variance_percent >= 0 ? "+" : ""}{summary.variance_percent}%
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-none">
          <CardContent className="pt-2 pb-2 px-3">
            <div className="text-[10px] text-muted-foreground">Contract Value</div>
            <div className="text-lg font-bold">{formatCurrency(summary.contract_value)}</div>
            <div className="text-[10px] text-muted-foreground">
              Margin: {formatCurrency(summary.contract_value - summary.po_total)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* BOQ Tab - BillOfQuantities component */}
      <TabsContent value="boq" className="flex-1 min-h-0 mt-0">
        <BillOfQuantities
          groups={boqGroups}
          onSave={handleSave}
          onGroupClick={handleGroupClick}
          onAddPO={handleAddPO}
          profitCentres={boqData.profitCentres?.map((pc) => ({ id: pc.id, label: pc.label })) ?? []}
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

      {/* Add PO Dialog (from Cost Centre or Stage section) */}
      <Dialog open={showAddPOModal} onOpenChange={setShowAddPOModal}>
        <DialogContent className="sm:max-w-lg p-0 gap-0 overflow-hidden">
          <DialogHeader className="px-5 pt-5 pb-3">
            <DialogTitle className="text-base">
              New Purchase Order
            </DialogTitle>
            <p className="text-sm text-muted-foreground mt-0.5">{addPOSectionLabel}</p>
          </DialogHeader>

          <div className="px-5 pb-5 space-y-4">
            {/* Task selection */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Task</Label>
              {loadingTasks ? (
                <div className="flex items-center gap-2 py-8 justify-center text-muted-foreground">
                  <Spinner size={16} />
                  <span className="text-sm">Loading tasks...</span>
                </div>
              ) : sectionTasks.length === 0 ? (
                <div className="rounded-lg border border-dashed py-8 text-center">
                  <p className="text-sm text-muted-foreground">
                    No tasks with PO Required found
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Check that tasks are assigned to this {addPOGroupBy === "costCentre" ? "cost centre" : "stage"}
                  </p>
                </div>
              ) : (
                <div className="space-y-1 max-h-[280px] overflow-y-auto rounded-lg border p-1">
                  {sectionTasks.map((task) => {
                    const hasPO = task.has_existing_po;
                    const isSelected = selectedTaskId === task.id;
                    return (
                      <button
                        key={task.id}
                        type="button"
                        disabled={hasPO}
                        className={cn(
                          "w-full flex items-center gap-3 rounded-md px-3 py-2.5 text-left transition-all",
                          hasPO
                            ? "opacity-40 cursor-not-allowed"
                            : isSelected
                              ? "bg-primary/10 ring-1 ring-primary/40"
                              : "hover:bg-muted/60 cursor-pointer"
                        )}
                        onClick={() => !hasPO && setSelectedTaskId(task.id)}
                      >
                        {/* Selection indicator */}
                        <div className={cn(
                          "h-4 w-4 rounded-full border-2 shrink-0 flex items-center justify-center transition-colors",
                          hasPO
                            ? "border-muted-foreground/30"
                            : isSelected
                              ? "border-primary bg-primary"
                              : "border-muted-foreground/40"
                        )}>
                          {isSelected && !hasPO && (
                            <div className="h-1.5 w-1.5 rounded-full bg-white" />
                          )}
                        </div>

                        {/* Task info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className={cn("text-sm font-medium truncate", hasPO && "line-through")}>
                              {task.name}
                            </span>
                            {task.task_number && (
                              <span className="text-xs text-muted-foreground shrink-0">#{task.task_number}</span>
                            )}
                          </div>
                        </div>

                        {/* PO status */}
                        {hasPO && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-medium text-muted-foreground bg-muted rounded-full px-2 py-0.5 shrink-0">
                            <Check className="h-2.5 w-2.5" />
                            Has PO
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Supplier selection */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Supplier</Label>
              <SupplierPicker
                value={selectedSupplier}
                onSelect={setSelectedSupplier}
                placeholder="Search suppliers..."
                clearable
              />
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 pt-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowAddPOModal(false)}
                disabled={creatingPO}
                className="text-muted-foreground"
              >
                Cancel
              </Button>
              <div className="flex-1" />
              <Button
                size="sm"
                onClick={() => handleCreatePO(false)}
                disabled={!selectedTaskId || !selectedSupplier || creatingPO}
              >
                {creatingPO ? <Spinner size={14} className="mr-2" /> : null}
                Create PO
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleCreatePO(true)}
                disabled={!selectedTaskId || !selectedSupplier || creatingPO}
              >
                <ExternalLink className="h-3 w-3 mr-1.5" />
                Create & Open
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Tabs>
  );
}

export default JobBOQTab;
