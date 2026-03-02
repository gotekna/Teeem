"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  Save,
  RotateCcw,
  Lock,
  DollarSign,
  TrendingUp,
  Percent,
  ChevronDown,
  ChevronRight,
  Star,
  Shield,
  HardHat,
  Building2,
  Calculator,
  Target,
} from "lucide-react";
import { api } from "@/lib/api";
import { formatCurrency } from "@/utils/formatters";
import { useToast } from "@/components/ui/use-toast";

// ============================================
// Types
// ============================================

interface MarkupItem {
  smTaskId: number;
  taskName: string;
  supplierName: string | null;
  tenderSection: string | null;
  tenderHeader: string | null;
  isPcPs: boolean;
  sectionType: string | null;
  cost: number;
  poNumber: string | null;
  escalationPercent: number;
  markupPercent: number;
  markupCap: number | null;
  escalatedCost: number;
  sellPrice: number;
}

interface ChargeData {
  chargeType: string;
  label: string;
  ratePercent: number | null;
  overrideAmount: number | null;
  calculatedAmount: number;
  effectiveAmount: number;
  basisValue: number;
  usingOverride: boolean;
  purchaseOrderId: number | null;
  purchaseOrderNumber: string | null;
}

interface MarkupSummary {
  costTotal: number;
  escalatedTotal: number;
  sellSubtotal: number;
  chargesTotal: number;
  subtotalWithCharges: number;
  builderMarginPercent: number;
  contractExGst: number;
  gstAmount: number;
  contractIncGst: number;
  qbccAmount: number;
  finalContractIncGst: number;
  existingContractPrice: number | null;
}

interface PurchaseOrderOption {
  id: number;
  purchaseOrderNumber: string;
}

interface MarkupData {
  job: {
    id: number;
    builderMarginPercent: number;
    contractPrice: number | null;
    pcPsMarkupCap: number;
  };
  items: MarkupItem[];
  charges: ChargeData[];
  summary: MarkupSummary;
}

// Local mutable state for charges
interface ChargeEdit {
  chargeType: string;
  label: string;
  ratePercent: number | null;
  overrideAmount: number | null;
  purchaseOrderId: number | null;
  purchaseOrderNumber: string | null;
}

interface JobMarkupTabProps {
  jobId: string | number;
}

// ============================================
// Helpers
// ============================================

function recalcItem(item: MarkupItem, cap: number): { escalatedCost: number; sellPrice: number } {
  const escalatedCost = item.cost * (1 + item.escalationPercent / 100);
  const effectiveMarkup = item.isPcPs ? Math.min(item.markupPercent, cap) : item.markupPercent;
  const sellPrice = escalatedCost * (1 + effectiveMarkup / 100);
  return { escalatedCost: Math.round(escalatedCost * 100) / 100, sellPrice: Math.round(sellPrice * 100) / 100 };
}

const round2 = (n: number) => Math.round(n * 100) / 100;

const CHARGE_ORDER = ["construction_insurance", "qleave", "overheads", "qbcc_insurance"] as const;

const CHARGE_ICONS: Record<string, React.ReactNode> = {
  construction_insurance: <Shield className="h-3.5 w-3.5" />,
  qleave: <HardHat className="h-3.5 w-3.5" />,
  overheads: <Building2 className="h-3.5 w-3.5" />,
  qbcc_insurance: <Calculator className="h-3.5 w-3.5" />,
};

// ============================================
// Component
// ============================================

export default function JobMarkupTab({ jobId }: JobMarkupTabProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [data, setData] = useState<MarkupData | null>(null);
  const [items, setItems] = useState<MarkupItem[]>([]);
  const [builderMargin, setBuilderMargin] = useState(0);
  const [charges, setCharges] = useState<ChargeEdit[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrderOption[]>([]);
  const [collapsedHeaders, setCollapsedHeaders] = useState<Set<string>>(new Set());
  const [hasChanges, setHasChanges] = useState(false);
  const [targetPrice, setTargetPrice] = useState<string>("");
  const [calculatingTarget, setCalculatingTarget] = useState(false);

  const pcPsMarkupCap = data?.job.pcPsMarkupCap ?? 25;

  // ============================================
  // Fetch data
  // ============================================

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [markupRes, posRes] = await Promise.all([
        api.get<MarkupData>(`/api/v1/jobs/${jobId}/markup`),
        api.get<{ data: Array<{ id: number; purchase_order_number: string }> }>(`/api/v1/purchase_orders?job_id=${jobId}`),
      ]);

      if (markupRes) {
        setData(markupRes);
        setItems(markupRes.items);
        setBuilderMargin(markupRes.job.builderMarginPercent);
        setCharges(
          markupRes.charges.map(c => ({
            chargeType: c.chargeType,
            label: c.label,
            ratePercent: c.ratePercent,
            overrideAmount: c.overrideAmount,
            purchaseOrderId: c.purchaseOrderId,
            purchaseOrderNumber: c.purchaseOrderNumber,
          }))
        );
        setHasChanges(false);
      }

      // Parse PO list from API response (handles various response shapes)
      const poList = posRes?.data ?? (Array.isArray(posRes) ? posRes : []);
      setPurchaseOrders(
        (poList as Array<{ id: number; purchase_order_number: string }>)
          .filter(po => po.id && po.purchase_order_number)
          .map(po => ({ id: po.id, purchaseOrderNumber: po.purchase_order_number }))
      );
    } catch {
      toast({ title: "Error", description: "Failed to load pricing data", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [jobId, toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ============================================
  // Live recalculation
  // ============================================

  const summary = useMemo(() => {
    const costTotal = round2(items.reduce((sum, it) => sum + it.cost, 0));
    const escalatedTotal = round2(items.reduce((sum, it) => sum + recalcItem(it, pcPsMarkupCap).escalatedCost, 0));
    const sellSubtotal = round2(items.reduce((sum, it) => sum + recalcItem(it, pcPsMarkupCap).sellPrice, 0));

    // Calculate non-QBCC charges locally
    let chargesTotal = 0;
    const chargeAmounts: Record<string, number> = {};

    for (const c of charges) {
      if (c.chargeType === "qbcc_insurance") continue; // QBCC requires server-side lookup
      const override = c.overrideAmount != null && c.overrideAmount > 0;
      if (override) {
        chargeAmounts[c.chargeType] = c.overrideAmount!;
      } else {
        const rate = c.ratePercent ?? 0;
        const basis = c.chargeType === "qleave" ? costTotal : sellSubtotal;
        chargeAmounts[c.chargeType] = round2(basis * rate / 100);
      }
      chargesTotal += chargeAmounts[c.chargeType];
    }
    chargesTotal = round2(chargesTotal);

    const subtotalWithCharges = round2(sellSubtotal + chargesTotal);
    const contractExGst = round2(subtotalWithCharges * (1 + builderMargin / 100));
    const gstAmount = round2(contractExGst * 0.10);
    const contractIncGst = round2(contractExGst + gstAmount);

    // QBCC is server-calculated; use last known value from data
    const qbccCharge = charges.find(c => c.chargeType === "qbcc_insurance");
    const qbccOverride = qbccCharge?.overrideAmount != null && qbccCharge.overrideAmount > 0;
    const qbccAmount = qbccOverride
      ? qbccCharge!.overrideAmount!
      : (data?.summary.qbccAmount ?? 0);
    const finalContractIncGst = round2(contractIncGst + qbccAmount);

    return {
      costTotal,
      escalatedTotal,
      sellSubtotal,
      chargesTotal,
      chargeAmounts,
      subtotalWithCharges,
      builderMarginPercent: builderMargin,
      contractExGst,
      gstAmount,
      contractIncGst,
      qbccAmount,
      finalContractIncGst,
      existingContractPrice: data?.summary.existingContractPrice ?? null,
    };
  }, [items, builderMargin, charges, pcPsMarkupCap, data]);

  // ============================================
  // Grouping by tender header
  // ============================================

  const groupedItems = useMemo(() => {
    const groups: { header: string; items: MarkupItem[] }[] = [];
    const groupMap = new Map<string, MarkupItem[]>();

    for (const item of items) {
      const header = item.tenderHeader || "Ungrouped";
      if (!groupMap.has(header)) {
        groupMap.set(header, []);
        groups.push({ header, items: groupMap.get(header)! });
      }
      groupMap.get(header)!.push(item);
    }
    return groups;
  }, [items]);

  // ============================================
  // Handlers
  // ============================================

  const updateItem = (smTaskId: number, field: "escalationPercent" | "markupPercent", value: number) => {
    setItems(prev => prev.map(it => {
      if (it.smTaskId !== smTaskId) return it;
      const updated = { ...it, [field]: value };
      if (field === "markupPercent" && updated.isPcPs) {
        updated.markupPercent = Math.min(updated.markupPercent, pcPsMarkupCap);
      }
      const calc = recalcItem(updated, pcPsMarkupCap);
      return { ...updated, ...calc };
    }));
    setHasChanges(true);
  };

  const updateCharge = (chargeType: string, field: keyof ChargeEdit, value: unknown) => {
    setCharges(prev => prev.map(c => c.chargeType === chargeType ? { ...c, [field]: value } : c));
    setHasChanges(true);
  };

  const handleBuilderMarginChange = (value: number) => {
    setBuilderMargin(value);
    setHasChanges(true);
  };

  const toggleHeader = (header: string) => {
    setCollapsedHeaders(prev => {
      const next = new Set(prev);
      if (next.has(header)) next.delete(header);
      else next.add(header);
      return next;
    });
  };

  const buildSavePayload = () => {
    const changedItems = items.filter((it, i) => {
      const orig = data?.items[i];
      if (!orig) return true;
      return it.escalationPercent !== orig.escalationPercent || it.markupPercent !== orig.markupPercent;
    });

    return {
      items: changedItems.map(it => ({
        smTaskId: it.smTaskId,
        escalationPercent: it.escalationPercent,
        markupPercent: it.markupPercent,
      })),
      builderMarginPercent: builderMargin,
      charges: charges.map(c => ({
        chargeType: c.chargeType,
        ratePercent: c.ratePercent,
        overrideAmount: c.overrideAmount,
        purchaseOrderId: c.purchaseOrderId,
      })),
    };
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.patch(`/api/v1/jobs/${jobId}/markup`, buildSavePayload());
      toast({ title: "Saved", description: "Pricing updated successfully" });
      fetchData();
    } catch {
      toast({ title: "Error", description: "Failed to save pricing", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleApplyToContract = async () => {
    setSaving(true);
    try {
      await api.patch(`/api/v1/jobs/${jobId}/markup`, {
        ...buildSavePayload(),
        applyToContractPrice: true,
      });
      toast({ title: "Applied", description: `Contract price updated to ${formatCurrency(summary.finalContractIncGst)}` });
      fetchData();
    } catch {
      toast({ title: "Error", description: "Failed to apply to contract price", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    if (data) {
      setItems(data.items);
      setBuilderMargin(data.job.builderMarginPercent);
      setCharges(
        data.charges.map(c => ({
          chargeType: c.chargeType,
          label: c.label,
          ratePercent: c.ratePercent,
          overrideAmount: c.overrideAmount,
          purchaseOrderId: c.purchaseOrderId,
          purchaseOrderNumber: c.purchaseOrderNumber,
        }))
      );
      setHasChanges(false);
      setTargetPrice("");
    }
  };

  const handleCalculateTarget = async () => {
    const target = parseFloat(targetPrice);
    if (!target || target <= 0) {
      toast({ title: "Invalid target", description: "Enter a positive target price", variant: "destructive" });
      return;
    }
    setCalculatingTarget(true);
    try {
      const res = await api.post<{ success: boolean; requiredMarginPercent: number; finalContractIncGst: number }>(
        `/api/v1/jobs/${jobId}/target_margin`,
        { targetFinalIncGst: target }
      );
      if (res?.requiredMarginPercent != null) {
        setBuilderMargin(res.requiredMarginPercent);
        setHasChanges(true);
        toast({
          title: "Target calculated",
          description: `Builder margin set to ${res.requiredMarginPercent}% to hit ${formatCurrency(target)}`,
        });
      }
    } catch {
      toast({ title: "Error", description: "Failed to calculate target margin", variant: "destructive" });
    } finally {
      setCalculatingTarget(false);
    }
  };

  // ============================================
  // Render
  // ============================================

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  if (!data || items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
        <DollarSign className="h-12 w-12 mb-4 opacity-30" />
        <p className="text-lg font-medium">No PO tasks found</p>
        <p className="text-sm">This job needs purchase order tasks to show pricing.</p>
      </div>
    );
  }

  // Sort charges by defined order, separating QBCC (rendered after contract)
  const nonQbccCharges = charges
    .filter(c => c.chargeType !== "qbcc_insurance")
    .sort((a, b) => CHARGE_ORDER.indexOf(a.chargeType as typeof CHARGE_ORDER[number]) - CHARGE_ORDER.indexOf(b.chargeType as typeof CHARGE_ORDER[number]));
  const qbccCharge = charges.find(c => c.chargeType === "qbcc_insurance");

  return (
    <div className="space-y-4 p-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <SummaryCard
          label="Sell Subtotal"
          value={formatCurrency(summary.sellSubtotal)}
          icon={<DollarSign className="h-4 w-4" />}
        />
        <SummaryCard
          label="Charges"
          value={formatCurrency(summary.chargesTotal + summary.qbccAmount)}
          icon={<Shield className="h-4 w-4" />}
        />
        <SummaryCard
          label="Builder Margin"
          value={`${builderMargin}%`}
          icon={<Percent className="h-4 w-4" />}
        />
        <SummaryCard
          label="Final Contract (inc GST)"
          value={formatCurrency(summary.finalContractIncGst)}
          icon={<Star className="h-4 w-4" />}
          highlight
        />
      </div>

      {/* Builder Margin & Actions */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium whitespace-nowrap">Builder Margin:</span>
              <div className="relative w-24">
                <Input
                  type="number"
                  min={0}
                  step={0.5}
                  value={builderMargin}
                  onChange={e => handleBuilderMarginChange(parseFloat(e.target.value) || 0)}
                  className="pr-6 text-right h-8"
                />
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">%</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium whitespace-nowrap text-muted-foreground">Target Price:</span>
              <div className="relative w-32">
                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                <Input
                  type="number"
                  min={0}
                  step={1000}
                  value={targetPrice}
                  placeholder="e.g. 910000"
                  onChange={e => setTargetPrice(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") handleCalculateTarget(); }}
                  className="pl-5 text-right h-8"
                />
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleCalculateTarget}
                disabled={calculatingTarget || !targetPrice}
              >
                <Target className="h-3.5 w-3.5 mr-1" />
                {calculatingTarget ? "..." : "Calculate"}
              </Button>
            </div>
            <div className="flex items-center gap-2 ml-auto">
              {hasChanges && (
                <Button variant="outline" size="sm" onClick={handleReset} disabled={saving}>
                  <RotateCcw className="h-3.5 w-3.5 mr-1" />
                  Reset
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={handleSave} disabled={saving || !hasChanges}>
                <Save className="h-3.5 w-3.5 mr-1" />
                {saving ? "Saving..." : "Save"}
              </Button>
              <Button size="sm" onClick={handleApplyToContract} disabled={saving}>
                <DollarSign className="h-3.5 w-3.5 mr-1" />
                Apply to Contract Price
              </Button>
            </div>
          </div>
          {summary.existingContractPrice != null && summary.existingContractPrice > 0 && (
            <div className="text-xs text-muted-foreground mt-2">
              Current contract price: {formatCurrency(summary.existingContractPrice)}
              {Math.abs(summary.finalContractIncGst - summary.existingContractPrice) > 0.01 && (
                <span className={summary.finalContractIncGst > summary.existingContractPrice ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}>
                  {" "}({summary.finalContractIncGst > summary.existingContractPrice ? "+" : ""}{formatCurrency(summary.finalContractIncGst - summary.existingContractPrice)} difference)
                </span>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pricing Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[250px]">Task</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead className="text-right">Cost (ex GST)</TableHead>
                  <TableHead className="text-right w-[100px]">Esc %</TableHead>
                  <TableHead className="text-right w-[100px]">Escalated</TableHead>
                  <TableHead className="text-right w-[120px]">Markup %</TableHead>
                  <TableHead className="text-right">Sell Price</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {groupedItems.map(group => {
                  const isCollapsed = collapsedHeaders.has(group.header);
                  const groupSell = group.items.reduce((s, it) => s + recalcItem(it, pcPsMarkupCap).sellPrice, 0);

                  return [
                    <TableRow
                      key={`header-${group.header}`}
                      className="bg-muted/50 dark:bg-muted/20 cursor-pointer hover:bg-muted/70 dark:hover:bg-muted/30"
                      onClick={() => toggleHeader(group.header)}
                    >
                      <TableCell colSpan={6} className="font-semibold text-sm py-2">
                        <div className="flex items-center gap-1">
                          {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          {group.header}
                          <span className="text-muted-foreground font-normal ml-2">
                            ({group.items.length} {group.items.length === 1 ? "item" : "items"})
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-semibold text-sm py-2">
                        {formatCurrency(groupSell)}
                      </TableCell>
                    </TableRow>,
                    ...(!isCollapsed ? group.items.map(item => {
                      const calc = recalcItem(item, pcPsMarkupCap);
                      return (
                        <TableRow key={item.smTaskId}>
                          <TableCell className="py-1.5">
                            <div className="flex items-center gap-2">
                              <span className="text-sm">{item.taskName}</span>
                              {item.isPcPs && (
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 whitespace-nowrap">
                                  <Lock className="h-2.5 w-2.5 mr-0.5" />
                                  PC/PS max {pcPsMarkupCap}%
                                </Badge>
                              )}
                            </div>
                            {item.poNumber && (
                              <span className="text-xs text-muted-foreground">{item.poNumber}</span>
                            )}
                          </TableCell>
                          <TableCell className="text-sm py-1.5">
                            {item.supplierName || <span className="text-muted-foreground italic">TBA</span>}
                          </TableCell>
                          <TableCell className="text-right text-sm tabular-nums py-1.5">
                            {formatCurrency(item.cost)}
                          </TableCell>
                          <TableCell className="text-right py-1.5">
                            <PercentInput
                              value={item.escalationPercent}
                              onChange={v => updateItem(item.smTaskId, "escalationPercent", v)}
                            />
                          </TableCell>
                          <TableCell className="text-right text-sm tabular-nums py-1.5">
                            {formatCurrency(calc.escalatedCost)}
                          </TableCell>
                          <TableCell className="text-right py-1.5">
                            <PercentInput
                              value={item.markupPercent}
                              onChange={v => updateItem(item.smTaskId, "markupPercent", v)}
                              max={item.isPcPs ? pcPsMarkupCap : undefined}
                            />
                          </TableCell>
                          <TableCell className="text-right font-medium text-sm tabular-nums py-1.5">
                            {formatCurrency(calc.sellPrice)}
                          </TableCell>
                        </TableRow>
                      );
                    }) : []),
                  ];
                })}

                {/* ── SELL SUBTOTAL ── */}
                <TableRow className="border-t-2 border-border">
                  <TableCell colSpan={6} className="font-semibold text-sm">SELL SUBTOTAL</TableCell>
                  <TableCell className="text-right font-semibold text-sm tabular-nums">
                    {formatCurrency(summary.sellSubtotal)}
                  </TableCell>
                </TableRow>

                {/* ── JOB CHARGES ── */}
                {nonQbccCharges.length > 0 && (
                  <>
                    <TableRow className="bg-amber-50/50 dark:bg-amber-950/20">
                      <TableCell colSpan={7} className="py-1.5">
                        <span className="text-xs font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-400">
                          Job Charges
                        </span>
                      </TableCell>
                    </TableRow>
                    {nonQbccCharges.map(charge => {
                      const amount = summary.chargeAmounts[charge.chargeType] ?? 0;
                      const isOverride = charge.overrideAmount != null && charge.overrideAmount > 0;
                      return (
                        <ChargeRow
                          key={charge.chargeType}
                          charge={charge}
                          amount={amount}
                          isOverride={isOverride}
                          purchaseOrders={purchaseOrders}
                          onRateChange={(v) => updateCharge(charge.chargeType, "ratePercent", v)}
                          onOverrideChange={(v) => updateCharge(charge.chargeType, "overrideAmount", v)}
                          onPoChange={(id, num) => {
                            updateCharge(charge.chargeType, "purchaseOrderId", id);
                            updateCharge(charge.chargeType, "purchaseOrderNumber", num);
                          }}
                        />
                      );
                    })}
                    <TableRow className="border-t border-amber-200 dark:border-amber-800">
                      <TableCell colSpan={6} className="font-semibold text-sm">SUBTOTAL WITH CHARGES</TableCell>
                      <TableCell className="text-right font-semibold text-sm tabular-nums">
                        {formatCurrency(summary.subtotalWithCharges)}
                      </TableCell>
                    </TableRow>
                  </>
                )}

                {/* ── BUILDER MARGIN ── */}
                <TableRow>
                  <TableCell colSpan={6} className="text-sm">
                    Builder Margin ({builderMargin}%)
                  </TableCell>
                  <TableCell className="text-right text-sm tabular-nums">
                    {formatCurrency(summary.contractExGst - summary.subtotalWithCharges)}
                  </TableCell>
                </TableRow>

                {/* ── CONTRACT LINES ── */}
                <TableRow>
                  <TableCell colSpan={6} className="font-semibold text-sm">CONTRACT (ex GST)</TableCell>
                  <TableCell className="text-right font-semibold text-sm tabular-nums">
                    {formatCurrency(summary.contractExGst)}
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell colSpan={6} className="text-sm text-muted-foreground">GST (10%)</TableCell>
                  <TableCell className="text-right text-sm tabular-nums text-muted-foreground">
                    {formatCurrency(summary.gstAmount)}
                  </TableCell>
                </TableRow>
                <TableRow className="bg-muted/30 dark:bg-muted/10">
                  <TableCell colSpan={6} className="font-bold">CONTRACT (inc GST)</TableCell>
                  <TableCell className="text-right font-bold tabular-nums">
                    {formatCurrency(summary.contractIncGst)}
                  </TableCell>
                </TableRow>

                {/* ── QBCC (after contract inc GST) ── */}
                {qbccCharge && (
                  <>
                    <TableRow className="bg-blue-50/50 dark:bg-blue-950/20">
                      <TableCell colSpan={7} className="py-1.5">
                        <span className="text-xs font-semibold uppercase tracking-wider text-blue-700 dark:text-blue-400">
                          QBCC Home Warranty Insurance
                        </span>
                        <span className="text-xs text-muted-foreground ml-2">
                          (insurable value: {formatCurrency(summary.contractIncGst)})
                        </span>
                      </TableCell>
                    </TableRow>
                    <ChargeRow
                      charge={qbccCharge}
                      amount={summary.qbccAmount}
                      isOverride={qbccCharge.overrideAmount != null && qbccCharge.overrideAmount > 0}
                      purchaseOrders={purchaseOrders}
                      isQbcc
                      onRateChange={() => {}}
                      onOverrideChange={(v) => updateCharge("qbcc_insurance", "overrideAmount", v)}
                      onPoChange={(id, num) => {
                        updateCharge("qbcc_insurance", "purchaseOrderId", id);
                        updateCharge("qbcc_insurance", "purchaseOrderNumber", num);
                      }}
                    />
                  </>
                )}

                {/* ── FINAL CONTRACT ── */}
                <TableRow className="bg-primary/5 dark:bg-primary/10 border-t-2 border-primary/30">
                  <TableCell colSpan={6} className="font-bold text-primary">
                    <div className="flex items-center gap-1.5">
                      <Star className="h-4 w-4" />
                      FINAL CONTRACT (inc GST)
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-bold tabular-nums text-primary text-base">
                    {formatCurrency(summary.finalContractIncGst)}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================
// Sub-components
// ============================================

function SummaryCard({ label, value, icon, highlight }: {
  label: string;
  value: string;
  icon: React.ReactNode;
  highlight?: boolean;
}) {
  return (
    <Card className={highlight ? "border-primary/50 bg-primary/5 dark:bg-primary/10" : ""}>
      <CardContent className="pt-3 pb-3 px-4">
        <div className="flex items-center gap-2 text-muted-foreground mb-1">
          {icon}
          <span className="text-xs">{label}</span>
        </div>
        <div className={`text-lg font-semibold tabular-nums ${highlight ? "text-primary" : ""}`}>
          {value}
        </div>
      </CardContent>
    </Card>
  );
}

function PercentInput({ value, onChange, max }: {
  value: number;
  onChange: (v: number) => void;
  max?: number;
}) {
  return (
    <div className="relative w-20 ml-auto">
      <Input
        type="number"
        min={0}
        max={max}
        step={0.5}
        value={value}
        onChange={e => {
          let v = parseFloat(e.target.value) || 0;
          if (max !== undefined && v > max) v = max;
          if (v < 0) v = 0;
          onChange(v);
        }}
        className="pr-5 text-right h-7 text-sm"
      />
      <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">%</span>
    </div>
  );
}

function ChargeRow({
  charge,
  amount,
  isOverride,
  purchaseOrders,
  isQbcc,
  onRateChange,
  onOverrideChange,
  onPoChange,
}: {
  charge: ChargeEdit;
  amount: number;
  isOverride: boolean;
  purchaseOrders: PurchaseOrderOption[];
  isQbcc?: boolean;
  onRateChange: (v: number | null) => void;
  onOverrideChange: (v: number | null) => void;
  onPoChange: (id: number | null, num: string | null) => void;
}) {
  return (
    <TableRow>
      <TableCell className="py-1.5" colSpan={2}>
        <div className="flex items-center gap-2">
          {CHARGE_ICONS[charge.chargeType]}
          <span className="text-sm">{charge.label}</span>
          {isOverride && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
              override
            </Badge>
          )}
        </div>
      </TableCell>
      {/* Rate % (not for QBCC which uses table lookup) */}
      <TableCell className="text-right py-1.5" colSpan={2}>
        {!isQbcc ? (
          <PercentInput
            value={charge.ratePercent ?? 0}
            onChange={v => onRateChange(v)}
          />
        ) : (
          <span className="text-xs text-muted-foreground">table lookup</span>
        )}
      </TableCell>
      {/* $ Override */}
      <TableCell className="text-right py-1.5">
        <div className="relative w-28 ml-auto">
          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">$</span>
          <Input
            type="number"
            min={0}
            step={100}
            value={charge.overrideAmount ?? ""}
            placeholder="auto"
            onChange={e => {
              const raw = e.target.value;
              onOverrideChange(raw === "" ? null : parseFloat(raw) || null);
            }}
            className="pl-5 text-right h-7 text-sm"
          />
        </div>
      </TableCell>
      {/* PO Link */}
      <TableCell className="py-1.5">
        <Select
          value={charge.purchaseOrderId?.toString() ?? "none"}
          onValueChange={v => {
            if (v === "none") {
              onPoChange(null, null);
            } else {
              const po = purchaseOrders.find(p => p.id.toString() === v);
              onPoChange(parseInt(v), po?.purchaseOrderNumber ?? null);
            }
          }}
        >
          <SelectTrigger className="h-7 text-xs w-28">
            <SelectValue placeholder="Link PO" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">No PO</SelectItem>
            {purchaseOrders.map(po => (
              <SelectItem key={po.id} value={po.id.toString()}>
                {po.purchaseOrderNumber}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </TableCell>
      {/* Amount */}
      <TableCell className="text-right font-medium text-sm tabular-nums py-1.5">
        {formatCurrency(amount)}
      </TableCell>
    </TableRow>
  );
}
