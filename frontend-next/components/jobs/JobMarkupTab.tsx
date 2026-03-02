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
  Save,
  RotateCcw,
  Lock,
  DollarSign,
  TrendingUp,
  Percent,
  ChevronDown,
  ChevronRight,
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

interface MarkupSummary {
  costTotal: number;
  escalatedTotal: number;
  sellSubtotal: number;
  builderMarginPercent: number;
  contractExGst: number;
  contractIncGst: number;
  existingContractPrice: number | null;
}

interface MarkupData {
  job: {
    id: number;
    builderMarginPercent: number;
    contractPrice: number | null;
    pcPsMarkupCap: number;
  };
  items: MarkupItem[];
  summary: MarkupSummary;
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
  const [collapsedHeaders, setCollapsedHeaders] = useState<Set<string>>(new Set());
  const [hasChanges, setHasChanges] = useState(false);

  const pcPsMarkupCap = data?.job.pcPsMarkupCap ?? 25;

  // ============================================
  // Fetch data
  // ============================================

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<MarkupData>(`/api/v1/jobs/${jobId}/markup`);
      if (res) {
        setData(res);
        setItems(res.items);
        setBuilderMargin(res.job.builderMarginPercent);
        setHasChanges(false);
      }
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
    const costTotal = items.reduce((sum, it) => sum + it.cost, 0);
    const escalatedTotal = items.reduce((sum, it) => {
      const { escalatedCost } = recalcItem(it, pcPsMarkupCap);
      return sum + escalatedCost;
    }, 0);
    const sellSubtotal = items.reduce((sum, it) => {
      const { sellPrice } = recalcItem(it, pcPsMarkupCap);
      return sum + sellPrice;
    }, 0);
    const contractExGst = Math.round(sellSubtotal * (1 + builderMargin / 100) * 100) / 100;
    const contractIncGst = Math.round(contractExGst * 1.10 * 100) / 100;

    return {
      costTotal: Math.round(costTotal * 100) / 100,
      escalatedTotal: Math.round(escalatedTotal * 100) / 100,
      sellSubtotal: Math.round(sellSubtotal * 100) / 100,
      builderMarginPercent: builderMargin,
      contractExGst,
      contractIncGst,
      existingContractPrice: data?.summary.existingContractPrice ?? null,
    };
  }, [items, builderMargin, pcPsMarkupCap, data]);

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
      // Enforce PC/PS cap
      if (field === "markupPercent" && updated.isPcPs) {
        updated.markupPercent = Math.min(updated.markupPercent, pcPsMarkupCap);
      }
      const calc = recalcItem(updated, pcPsMarkupCap);
      return { ...updated, ...calc };
    }));
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

  const handleSave = async () => {
    setSaving(true);
    try {
      const changedItems = items.filter((it, i) => {
        const orig = data?.items[i];
        if (!orig) return true;
        return it.escalationPercent !== orig.escalationPercent || it.markupPercent !== orig.markupPercent;
      });

      await api.patch(`/api/v1/jobs/${jobId}/markup`, {
        items: changedItems.map(it => ({
          smTaskId: it.smTaskId,
          escalationPercent: it.escalationPercent,
          markupPercent: it.markupPercent,
        })),
        builderMarginPercent: builderMargin,
      });

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
      // Save current changes first, then apply
      const changedItems = items.filter((it, i) => {
        const orig = data?.items[i];
        if (!orig) return true;
        return it.escalationPercent !== orig.escalationPercent || it.markupPercent !== orig.markupPercent;
      });

      await api.patch(`/api/v1/jobs/${jobId}/markup`, {
        items: changedItems.map(it => ({
          smTaskId: it.smTaskId,
          escalationPercent: it.escalationPercent,
          markupPercent: it.markupPercent,
        })),
        builderMarginPercent: builderMargin,
        applyToContractPrice: true,
      });

      toast({ title: "Applied", description: `Contract price updated to ${formatCurrency(summary.contractIncGst)}` });
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
      setHasChanges(false);
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

  return (
    <div className="space-y-4 p-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <SummaryCard
          label="Cost Total"
          value={formatCurrency(summary.costTotal)}
          icon={<DollarSign className="h-4 w-4" />}
        />
        <SummaryCard
          label="Escalated Total"
          value={formatCurrency(summary.escalatedTotal)}
          icon={<TrendingUp className="h-4 w-4" />}
        />
        <SummaryCard
          label="Sell Subtotal"
          value={formatCurrency(summary.sellSubtotal)}
          icon={<DollarSign className="h-4 w-4" />}
        />
        <SummaryCard
          label="Builder Margin"
          value={`${builderMargin}%`}
          icon={<Percent className="h-4 w-4" />}
        />
        <SummaryCard
          label="Contract (inc GST)"
          value={formatCurrency(summary.contractIncGst)}
          icon={<DollarSign className="h-4 w-4" />}
          highlight
        />
      </div>

      {/* Builder Margin Control */}
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
              {Math.abs(summary.contractIncGst - summary.existingContractPrice) > 0.01 && (
                <span className={summary.contractIncGst > summary.existingContractPrice ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}>
                  {" "}({summary.contractIncGst > summary.existingContractPrice ? "+" : ""}{formatCurrency(summary.contractIncGst - summary.existingContractPrice)} difference)
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
                    // Group header row
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
                    // Item rows
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

                {/* Summary rows */}
                <TableRow className="border-t-2 border-border">
                  <TableCell colSpan={6} className="font-semibold text-sm">SUBTOTAL</TableCell>
                  <TableCell className="text-right font-semibold text-sm tabular-nums">
                    {formatCurrency(summary.sellSubtotal)}
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell colSpan={6} className="text-sm">
                    Builder Margin ({builderMargin}%)
                  </TableCell>
                  <TableCell className="text-right text-sm tabular-nums">
                    {formatCurrency(summary.contractExGst - summary.sellSubtotal)}
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell colSpan={6} className="font-semibold text-sm">CONTRACT (ex GST)</TableCell>
                  <TableCell className="text-right font-semibold text-sm tabular-nums">
                    {formatCurrency(summary.contractExGst)}
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell colSpan={6} className="text-sm text-muted-foreground">GST (10%)</TableCell>
                  <TableCell className="text-right text-sm tabular-nums text-muted-foreground">
                    {formatCurrency(summary.contractIncGst - summary.contractExGst)}
                  </TableCell>
                </TableRow>
                <TableRow className="bg-muted/30 dark:bg-muted/10">
                  <TableCell colSpan={6} className="font-bold">CONTRACT (inc GST)</TableCell>
                  <TableCell className="text-right font-bold tabular-nums">
                    {formatCurrency(summary.contractIncGst)}
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
