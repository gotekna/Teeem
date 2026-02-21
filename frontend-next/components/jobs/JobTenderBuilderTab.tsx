"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import {
  RefreshCw, FileSignature, ChevronDown, ChevronRight, Check,
  Plus, Undo2, X,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/utils/formatters";
import type { BOQGroup } from "@/components/ui/bill-of-quantities";
import { lineItemKey } from "@/lib/boq-to-tender";

// ─── Types ──────────────────────────────────────────────────────────

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

interface BOQData {
  success: boolean;
  job: { id: number; name: string; contract_value: number; job_code?: string };
  groups: BOQApiGroup[];
  profitCentres: Array<{ id: number; label: string }>;
  summary: {
    boq_total: number; po_total: number; po_subtotal: number; po_gst: number;
    variance: number; variance_percent: number; contract_value: number;
    po_count: number; category_count: number;
  };
}

/** Override values for existing PO line items */
interface ItemOverride {
  description?: string;
  quantity?: number;
  unitPrice?: number;
}

/** A custom line item added by the user (not from a PO) */
interface NewTenderLine {
  tempId: string;
  sectionName: string;
  headerName: string;
  description: string;
  quantity: number;
  unitPrice: number;
}

/** Unified row types: Header → Section → PO → Items → PO Footer */
type UnifiedRow =
  | { type: "header"; name: string; subtotal: number; itemCount: number }
  | { type: "section"; name: string; headerName: string; subtotal: number; itemCount: number; poCount: number }
  | {
      type: "po";
      poId: string | number;
      poName: string;
      supplierName: string | null | undefined;
      taskName: string | null | undefined;
      tradeName: string | null | undefined;
      costCentreName: string | null | undefined;
      itemCount: number;
      subtotal: number;
      headerName: string;
      sectionName: string;
    }
  | {
      type: "item";
      key: string;
      lineNum: number;
      poId: string | number;
      poName: string;
      pricebookCode: string | null | undefined;
      description: string;
      quantity: number;
      unitPrice: number;
      gstCode: string;
      amount: number;
      headerName: string;
      sectionName: string;
      isNewLine?: boolean;
    }
  | {
      type: "po-footer";
      poId: string | number;
      poName: string;
      subtotal: number;
      headerName: string;
      sectionName: string;
    };

let _tempIdCounter = 0;
function nextTempId(): string {
  return `new_${++_tempIdCounter}`;
}

// ─── Component ──────────────────────────────────────────────────────

interface JobTenderBuilderTabProps {
  jobId: string | number;
}

export function JobTenderBuilderTab({ jobId }: JobTenderBuilderTabProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [boqData, setBOQData] = useState<BOQData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [excludedIds, setExcludedIds] = useState<Set<string>>(new Set());
  const [creatingTender, setCreatingTender] = useState(false);
  const [collapsedHeaders, setCollapsedHeaders] = useState<Set<string>>(new Set());
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());
  const [collapsedPOs, setCollapsedPOs] = useState<Set<string>>(new Set());

  // Editing state
  const [editOverrides, setEditOverrides] = useState<Map<string, ItemOverride>>(new Map());
  const [newLines, setNewLines] = useState<NewTenderLine[]>([]);

  const hasEdits = editOverrides.size > 0 || newLines.length > 0;
  const editCount = editOverrides.size + newLines.length;

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

  const boqGroups: BOQGroup[] = useMemo(() => {
    if (!boqData?.groups) return [];
    return boqData.groups.map((g) => ({
      id: g.id, name: g.name,
      supplierId: g.supplierId, supplierName: g.supplierName,
      taskName: g.taskName, taskPosition: g.taskPosition,
      tradeName: g.tradeName, stageName: g.stageName,
      stagePosition: g.stagePosition, costCentreName: g.costCentreName,
      tenderName: g.tenderName, tenderHeaderName: g.tenderHeaderName,
      profitCentreName: g.profitCentreName,
      items: g.items.map((item) => ({
        id: item.id, description: item.description,
        quantity: item.quantity, unitPrice: item.unitPrice,
        gstCode: item.gstCode, subtotal: item.subtotal,
        pricebookItemCode: item.pricebookItemCode,
        profitCentreId: item.profitCentreId,
        profitCentreName: item.profitCentreName,
      })),
    }));
  }, [boqData]);

  // ─── Edit helpers ─────────────────────────────────────────────────

  /** Get the effective value for a field, considering overrides */
  const getEffective = useCallback((key: string, field: "description" | "quantity" | "unitPrice", original: string | number) => {
    const override = editOverrides.get(key);
    if (!override) return original;
    const val = override[field];
    return val !== undefined ? val : original;
  }, [editOverrides]);

  /** Update an override field for an existing item */
  const updateOverride = useCallback((key: string, field: "description" | "quantity" | "unitPrice", value: string | number) => {
    setEditOverrides((prev) => {
      const next = new Map(prev);
      const existing = next.get(key) || {};
      next.set(key, { ...existing, [field]: value });
      return next;
    });
  }, []);

  /** Update a new line field */
  const updateNewLine = useCallback((tempId: string, field: keyof NewTenderLine, value: string | number) => {
    setNewLines((prev) =>
      prev.map((nl) => nl.tempId === tempId ? { ...nl, [field]: value } : nl)
    );
  }, []);

  /** Add a new custom line to a section */
  const addNewLine = useCallback((headerName: string, sectionName: string) => {
    const tempId = nextTempId();
    setNewLines((prev) => [
      ...prev,
      { tempId, sectionName, headerName, description: "", quantity: 1, unitPrice: 0 },
    ]);
  }, []);

  /** Remove a new line */
  const removeNewLine = useCallback((tempId: string) => {
    setNewLines((prev) => prev.filter((nl) => nl.tempId !== tempId));
  }, []);

  /** Discard all edits */
  const discardEdits = useCallback(() => {
    setEditOverrides(new Map());
    setNewLines([]);
  }, []);

  // ─── Build unified rows ──────────────────────────────────────────

  const unifiedRows = useMemo((): UnifiedRow[] => {
    if (!boqGroups.length) return [];

    type POItems = { group: BOQGroup; items: BOQGroup["items"] };
    const headerMap = new Map<string, Map<string, Map<string | number, POItems>>>();

    for (const group of boqGroups) {
      const h = group.tenderHeaderName || "Unallocated";
      const s = group.tenderName || "Unallocated";
      if (!headerMap.has(h)) headerMap.set(h, new Map());
      const sm = headerMap.get(h)!;
      if (!sm.has(s)) sm.set(s, new Map());
      const poMap = sm.get(s)!;

      if (!poMap.has(group.id)) {
        poMap.set(group.id, { group, items: [] });
      }
      poMap.get(group.id)!.items.push(...group.items);
    }

    const rows: UnifiedRow[] = [];

    for (const [headerName, sectionMap] of headerMap) {
      let headerTotal = 0;
      let headerItemCount = 0;
      const hIdx = rows.length;
      rows.push({ type: "header", name: headerName, subtotal: 0, itemCount: 0 });

      for (const [sectionName, poMap] of sectionMap) {
        let sectionTotal = 0;
        let sectionItemCount = 0;
        const sIdx = rows.length;
        rows.push({ type: "section", name: sectionName, headerName, subtotal: 0, itemCount: 0, poCount: poMap.size });

        let lineNum = 0;
        for (const [poId, { group, items }] of poMap) {
          let poTotal = 0;
          const poIdx = rows.length;
          rows.push({
            type: "po", poId, poName: group.name,
            supplierName: group.supplierName, taskName: group.taskName,
            tradeName: group.tradeName, costCentreName: group.costCentreName,
            itemCount: items.length, subtotal: 0,
            headerName, sectionName,
          });

          for (const item of items) {
            lineNum++;
            const key = lineItemKey(group.id, item.id);
            const effQty = getEffective(key, "quantity", item.quantity) as number;
            const effPrice = getEffective(key, "unitPrice", item.unitPrice) as number;
            const amount = effQty * effPrice;
            poTotal += amount;
            rows.push({
              type: "item",
              key,
              lineNum, poId, poName: group.name,
              pricebookCode: item.pricebookItemCode,
              description: getEffective(key, "description", item.description) as string,
              quantity: effQty, unitPrice: effPrice, gstCode: item.gstCode,
              amount, headerName, sectionName,
            });
          }

          // New lines for this section go after the last PO's items
          const sectionNewLines = newLines.filter(
            (nl) => nl.headerName === headerName && nl.sectionName === sectionName
          );
          for (const nl of sectionNewLines) {
            lineNum++;
            const amount = nl.quantity * nl.unitPrice;
            poTotal += amount;
            rows.push({
              type: "item",
              key: nl.tempId,
              lineNum, poId: "custom", poName: "Custom",
              pricebookCode: null,
              description: nl.description,
              quantity: nl.quantity, unitPrice: nl.unitPrice, gstCode: "GST",
              amount, headerName, sectionName,
              isNewLine: true,
            });
          }

          (rows[poIdx] as Extract<UnifiedRow, { type: "po" }>).subtotal = poTotal;

          // PO footer row (+ Add Line & total)
          rows.push({
            type: "po-footer", poId, poName: group.name,
            subtotal: poTotal, headerName, sectionName,
          });

          sectionTotal += poTotal;
          sectionItemCount += items.length + sectionNewLines.length;
        }

        (rows[sIdx] as Extract<UnifiedRow, { type: "section" }>).subtotal = sectionTotal;
        (rows[sIdx] as Extract<UnifiedRow, { type: "section" }>).itemCount = sectionItemCount;
        headerTotal += sectionTotal;
        headerItemCount += sectionItemCount;
      }

      (rows[hIdx] as Extract<UnifiedRow, { type: "header" }>).subtotal = headerTotal;
      (rows[hIdx] as Extract<UnifiedRow, { type: "header" }>).itemCount = headerItemCount;
    }

    return rows;
  }, [boqGroups, editOverrides, newLines, getEffective]);

  const handleToggleExclude = useCallback((key: string) => {
    setExcludedIds((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }, []);

  const toggleHeader = useCallback((name: string) => {
    setCollapsedHeaders((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name); else next.add(name);
      return next;
    });
  }, []);

  const toggleSection = useCallback((key: string) => {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }, []);

  const togglePO = useCallback((key: string) => {
    setCollapsedPOs((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }, []);

  /** Compute totals considering overrides and exclusions */
  const totals = useMemo(() => {
    let included = 0;
    let excluded = 0;
    let includedCount = 0;
    let excludedCount = 0;

    for (const row of unifiedRows) {
      if (row.type !== "item") continue;
      if (excludedIds.has(row.key)) {
        excluded += row.amount;
        excludedCount++;
      } else {
        included += row.amount;
        includedCount++;
      }
    }

    return { includedTotal: included, excludedTotal: excluded, includedCount, excludedCount };
  }, [unifiedRows, excludedIds]);

  const handleCreateTender = useCallback(async () => {
    try {
      setCreatingTender(true);
      const excludedLineItemIds = Array.from(excludedIds)
        .filter((key) => !key.startsWith("new_"))
        .map((key) => key.split(":")[1]);

      const itemOverrides: Record<string, { description?: string; quantity?: number; unit_price?: number }> = {};
      for (const [key, override] of editOverrides) {
        const lineItemId = key.split(":")[1];
        if (lineItemId) {
          itemOverrides[lineItemId] = {
            ...(override.description !== undefined && { description: override.description }),
            ...(override.quantity !== undefined && { quantity: override.quantity }),
            ...(override.unitPrice !== undefined && { unit_price: override.unitPrice }),
          };
        }
      }

      const additionalItems = newLines
        .filter((nl) => nl.description.trim())
        .map((nl) => ({
          section_name: nl.sectionName,
          header_name: nl.headerName,
          description: nl.description,
          quantity: nl.quantity,
          unit_price: nl.unitPrice,
        }));

      const response = await api.post<{ success: boolean; data: { id: number } }>(
        `/api/v1/jobs/${jobId}/tender_documents`,
        {
          excluded_line_item_ids: excludedLineItemIds,
          item_overrides: itemOverrides,
          additional_items: additionalItems,
        }
      );

      if (response?.success) {
        toast.success("Tender document created");
        router.push(`/jobs/${jobId}?tab=tender`);
      } else {
        toast.error("Failed to create tender document");
      }
    } catch (err) {
      console.error("Failed to create tender:", err);
      toast.error("Failed to create tender document");
    } finally {
      setCreatingTender(false);
    }
  }, [jobId, excludedIds, editOverrides, newLines, router]);

  // ─── Render states ──────────────────────────────────────────────

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

  const hasTenderData = boqGroups.some((g) => g.tenderName || g.tenderHeaderName);

  if (!hasTenderData) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="text-center space-y-2">
            <FileSignature className="h-12 w-12 mx-auto text-muted-foreground/40" />
            <p className="text-lg font-medium">No Tender Sections Assigned</p>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Purchase orders need to be linked to tender sections via the Schedule Master
              before you can build a tender. Assign tender sections to tasks in the Schedule
              Master, then return here.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Column layout: ☑ | Code | Sup | Description | Qty | Price | GST | Amount
  return (
    <div className="flex flex-col h-full">
      {/* Top toolbar */}
      <div className="flex items-center justify-between gap-3 pb-2 shrink-0">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-medium text-muted-foreground">Tender Builder</h3>
          <Badge variant="secondary" className="text-xs">
            {totals.includedCount} items
          </Badge>
          {excludedIds.size > 0 && (
            <Badge variant="outline" className="text-xs text-orange-600 dark:text-orange-400 border-orange-300 dark:border-orange-700">
              {totals.excludedCount} excluded ({formatCurrency(totals.excludedTotal)})
            </Badge>
          )}
          {hasEdits && (
            <Badge variant="outline" className="text-xs text-blue-600 dark:text-blue-400 border-blue-300 dark:border-blue-700">
              {editCount} edits
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          {hasEdits && (
            <Button variant="ghost" size="sm" onClick={discardEdits} className="text-muted-foreground">
              <Undo2 className="h-4 w-4 mr-1" />
              Discard edits
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={loadBOQData}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Unified scrolling table */}
      <div className="flex-1 min-h-0 overflow-auto border rounded-md">
        <table className="w-full text-sm table-fixed border-collapse">
          <colgroup>
            <col className="w-9" />            {/* checkbox */}
            <col style={{ width: "12%" }} />   {/* Code */}
            <col style={{ width: "5%" }} />    {/* Sup badge */}
            <col />                             {/* Description (flex) */}
            <col style={{ width: "8%" }} />    {/* Qty */}
            <col style={{ width: "10%" }} />   {/* Unit Price */}
            <col style={{ width: "5%" }} />    {/* GST */}
            <col style={{ width: "10%" }} />   {/* Amount */}
          </colgroup>
          <thead className="sticky top-0 z-10 bg-muted/95 backdrop-blur-sm">
            <tr className="border-b">
              <th className="px-1 py-2"></th>
              <th className="text-left px-2 py-2 font-medium text-muted-foreground text-xs uppercase tracking-wider">Code</th>
              <th className="text-center px-1 py-2 font-medium text-muted-foreground text-xs uppercase tracking-wider">Sup</th>
              <th className="text-left px-2 py-2 font-medium text-muted-foreground text-xs uppercase tracking-wider">Description</th>
              <th className="text-right px-2 py-2 font-medium text-muted-foreground text-xs uppercase tracking-wider">Qty</th>
              <th className="text-right px-2 py-2 font-medium text-muted-foreground text-xs uppercase tracking-wider">Price</th>
              <th className="text-center px-1 py-2 font-medium text-muted-foreground text-xs uppercase tracking-wider">GST</th>
              <th className="text-right px-2 py-2 font-medium text-muted-foreground text-xs uppercase tracking-wider">Amount</th>
            </tr>
          </thead>
          <tbody>
            {unifiedRows.map((row, i) => {
              // ── Header row (full width) ──
              if (row.type === "header") {
                const isCollapsed = collapsedHeaders.has(row.name);
                return (
                  <tr
                    key={`h-${i}`}
                    className="bg-primary/8 dark:bg-primary/15 border-b cursor-pointer hover:bg-primary/12 dark:hover:bg-primary/20"
                    onClick={() => toggleHeader(row.name)}
                  >
                    <td className="px-2 py-2">
                      {isCollapsed
                        ? <ChevronRight className="h-4 w-4 text-primary" />
                        : <ChevronDown className="h-4 w-4 text-primary" />
                      }
                    </td>
                    <td colSpan={6} className="px-2 py-2 font-semibold text-primary">
                      {row.name}
                      <Badge variant="secondary" className="ml-2 text-[10px] font-normal">{row.itemCount} items</Badge>
                    </td>
                    <td className="text-right px-2 py-2 font-semibold text-primary tabular-nums">
                      {formatCurrency(row.subtotal)}
                    </td>
                  </tr>
                );
              }

              // ── Section row (full width) ──
              if (row.type === "section") {
                if (collapsedHeaders.has(row.headerName)) return null;
                const sKey = `${row.headerName}::${row.name}`;
                const isCollapsed = collapsedSections.has(sKey);

                const sectionItems = unifiedRows.filter(
                  (r): r is Extract<UnifiedRow, { type: "item" }> =>
                    r.type === "item" && r.headerName === row.headerName && r.sectionName === row.name
                );
                const includedSubtotal = sectionItems
                  .filter((r) => !excludedIds.has(r.key))
                  .reduce((sum, r) => sum + r.amount, 0);

                return (
                  <tr
                    key={`s-${i}`}
                    className="bg-muted/50 border-b cursor-pointer hover:bg-muted/70"
                    onClick={() => toggleSection(sKey)}
                  >
                    <td className="pl-6 py-1.5">
                      {isCollapsed
                        ? <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                        : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                      }
                    </td>
                    <td colSpan={6} className="px-2 py-1.5 font-medium text-foreground/80">
                      {row.name}
                      <Badge variant="outline" className="ml-2 text-[10px] font-normal">{row.poCount} POs</Badge>
                    </td>
                    <td className="text-right px-2 py-1.5 font-medium text-foreground/80 tabular-nums">
                      {formatCurrency(includedSubtotal)}
                    </td>
                  </tr>
                );
              }

              // ── PO row (collapsible header with PO details) ──
              if (row.type === "po") {
                if (collapsedHeaders.has(row.headerName)) return null;
                const sKey = `${row.headerName}::${row.sectionName}`;
                if (collapsedSections.has(sKey)) return null;
                const poKey = `${sKey}::${row.poId}`;
                const isCollapsed = collapsedPOs.has(poKey);

                return (
                  <tr
                    key={`po-${i}`}
                    className="border-b border-border/60 cursor-pointer hover:bg-muted/30 bg-muted/20"
                    onClick={() => togglePO(poKey)}
                  >
                    <td className="pl-10 py-1.5">
                      {isCollapsed
                        ? <ChevronRight className="h-3 w-3 text-muted-foreground" />
                        : <ChevronDown className="h-3 w-3 text-muted-foreground" />
                      }
                    </td>
                    <td colSpan={6} className="px-2 py-1.5">
                      <span className="font-semibold text-xs">{row.poName}</span>
                      {row.supplierName && (
                        <span className="ml-2 text-xs text-muted-foreground">{row.supplierName.toUpperCase()}</span>
                      )}
                      {row.tradeName && (
                        <span className="ml-2 text-[10px] text-muted-foreground">{row.tradeName}</span>
                      )}
                      {row.costCentreName && (
                        <span className="ml-2 text-[10px] text-muted-foreground">{row.costCentreName}</span>
                      )}
                      <span className="ml-2 text-[10px] text-muted-foreground">{row.itemCount} Items</span>
                    </td>
                    <td className="text-right px-2 py-1.5 text-xs text-muted-foreground tabular-nums">
                      {/* Amount shown in footer */}
                    </td>
                  </tr>
                );
              }

              // ── PO Footer row (Add Line + PO total) ──
              if (row.type === "po-footer") {
                if (collapsedHeaders.has(row.headerName)) return null;
                const sKey = `${row.headerName}::${row.sectionName}`;
                if (collapsedSections.has(sKey)) return null;
                const poKey = `${sKey}::${row.poId}`;
                if (collapsedPOs.has(poKey)) return null;

                return (
                  <tr key={`pof-${i}`} className="border-b-2 border-border bg-muted/10">
                    <td colSpan={2} className="pl-14 py-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="gap-1 h-6 text-xs text-muted-foreground hover:text-foreground"
                        onClick={() => addNewLine(row.headerName, row.sectionName)}
                      >
                        <Plus className="h-3 w-3" />
                        Add Line
                      </Button>
                    </td>
                    <td colSpan={5} className="text-right text-xs font-medium text-muted-foreground py-1 pr-2">
                      {row.poName} total:
                    </td>
                    <td className="text-right px-2 py-1 text-sm font-mono font-semibold tabular-nums">
                      {formatCurrency(row.subtotal)}
                    </td>
                  </tr>
                );
              }

              // ── Item row: always-visible inputs like the BOQ ──
              if (collapsedHeaders.has(row.headerName)) return null;
              const sKey = `${row.headerName}::${row.sectionName}`;
              if (collapsedSections.has(sKey)) return null;
              const poKey = `${sKey}::${row.poId}`;
              if (collapsedPOs.has(poKey)) return null;

              const isExcluded = excludedIds.has(row.key);
              const isNewLine = row.isNewLine || false;
              const isDirty = !isNewLine && editOverrides.has(row.key);

              return (
                <tr
                  key={row.key}
                  className={cn(
                    "border-b border-border/30 hover:bg-muted/20 transition-colors",
                    isExcluded && "opacity-40",
                    isNewLine && "!bg-green-50 dark:!bg-green-950/30",
                  )}
                >
                  {/* Checkbox */}
                  <td className="pl-14 py-1 text-center">
                    {isNewLine ? (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5 text-destructive hover:text-destructive"
                        onClick={() => removeNewLine(row.key)}
                        title="Remove line"
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    ) : (
                      <div
                        className={cn(
                          "w-4 h-4 rounded border inline-flex items-center justify-center cursor-pointer",
                          isExcluded
                            ? "bg-orange-500 border-orange-500"
                            : "border-primary bg-primary/10"
                        )}
                        onClick={() => handleToggleExclude(row.key)}
                      >
                        {!isExcluded && <Check className="h-3 w-3 text-primary" />}
                      </div>
                    )}
                  </td>

                  {/* Code */}
                  <td className={cn("px-2 py-1 text-xs font-mono text-muted-foreground", isExcluded && "line-through")}>
                    {isNewLine
                      ? <span className="italic text-green-600 dark:text-green-400">NEW</span>
                      : (row.pricebookCode || "—")
                    }
                  </td>

                  {/* Sup badge */}
                  <td className="text-center px-1 py-1">
                    <Badge variant="outline" className="text-[9px] px-1 py-0 h-4">Sup</Badge>
                  </td>

                  {/* Description (always-visible input) */}
                  <td className="px-1 py-1">
                    {isExcluded ? (
                      <span className="text-sm line-through">{row.description}</span>
                    ) : (
                      <input
                        type="text"
                        value={row.description}
                        onChange={(e) => {
                          if (isNewLine) {
                            updateNewLine(row.key, "description", e.target.value);
                          } else {
                            updateOverride(row.key, "description", e.target.value);
                          }
                        }}
                        className={cn(
                          "w-full bg-transparent text-sm px-1.5 py-0.5 rounded border border-transparent",
                          "hover:border-border focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/20",
                          isDirty && "border-amber-300 dark:border-amber-700",
                          isNewLine && "border-green-300 dark:border-green-700",
                        )}
                        placeholder="Enter description..."
                      />
                    )}
                  </td>

                  {/* Qty (always-visible input) */}
                  <td className="px-1 py-1">
                    {isExcluded ? (
                      <span className="text-sm text-right block tabular-nums line-through">{row.quantity}</span>
                    ) : (
                      <Input
                        type="number"
                        min={0}
                        step="any"
                        value={row.quantity}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) || 0;
                          if (isNewLine) {
                            updateNewLine(row.key, "quantity", val);
                          } else {
                            updateOverride(row.key, "quantity", val);
                          }
                        }}
                        className={cn(
                          "h-7 w-full text-right text-sm font-mono",
                          isDirty && "border-amber-500 bg-amber-50 dark:bg-amber-950/30",
                          isNewLine && "border-green-500",
                        )}
                      />
                    )}
                  </td>

                  {/* Unit Price (always-visible input) */}
                  <td className="px-1 py-1">
                    {isExcluded ? (
                      <span className="text-sm text-right block tabular-nums line-through">{formatCurrency(row.unitPrice)}</span>
                    ) : (
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        value={row.unitPrice}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) || 0;
                          if (isNewLine) {
                            updateNewLine(row.key, "unitPrice", val);
                          } else {
                            updateOverride(row.key, "unitPrice", val);
                          }
                        }}
                        className={cn(
                          "h-7 w-full text-right text-sm font-mono",
                          isDirty && "border-amber-500 bg-amber-50 dark:bg-amber-950/30",
                          isNewLine && "border-green-500",
                        )}
                      />
                    )}
                  </td>

                  {/* GST */}
                  <td className="text-center px-1 py-1 text-xs">{row.gstCode}</td>

                  {/* Amount (auto-calculated) */}
                  <td className={cn(
                    "text-right px-2 py-1 text-sm font-mono tabular-nums",
                    isExcluded && "line-through",
                    isDirty && "font-semibold text-amber-700 dark:text-amber-400",
                    isNewLine && "font-semibold text-green-700 dark:text-green-400",
                  )}>
                    {formatCurrency(row.amount)}
                  </td>
                </tr>
              );
            })}

            {/* Grand totals */}
            <tr className="border-t-2 border-primary/30 bg-muted/30">
              <td colSpan={7} className="px-2 py-2 text-right font-semibold">Subtotal (ex GST)</td>
              <td className="text-right px-2 py-2 font-semibold tabular-nums">
                {formatCurrency(totals.includedTotal)}
              </td>
            </tr>
            <tr className="bg-muted/30">
              <td colSpan={7} className="px-2 py-1 text-right text-muted-foreground">GST (10%)</td>
              <td className="text-right px-2 py-1 text-muted-foreground tabular-nums">
                {formatCurrency(totals.includedTotal * 0.1)}
              </td>
            </tr>
            <tr className="bg-muted/30 border-b">
              <td colSpan={7} className="px-2 py-2 text-right font-bold text-base">Total (inc GST)</td>
              <td className="text-right px-2 py-2 font-bold text-base tabular-nums">
                {formatCurrency(totals.includedTotal * 1.1)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Bottom bar */}
      <div className="flex items-center justify-between gap-3 pt-3 border-t mt-3 shrink-0">
        <div className="flex items-center gap-4 text-sm">
          <span className="text-muted-foreground">
            Included: <span className="font-medium text-foreground">{totals.includedCount} lines</span>
            {" "}({formatCurrency(totals.includedTotal)})
          </span>
          {excludedIds.size > 0 && (
            <>
              <span className="text-muted-foreground">|</span>
              <span className="text-orange-600 dark:text-orange-400">
                Excluded: {totals.excludedCount} lines ({formatCurrency(totals.excludedTotal)})
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setExcludedIds(new Set())}
                className="h-6 text-xs text-muted-foreground"
              >
                Clear exclusions
              </Button>
            </>
          )}
        </div>
        <Button
          onClick={handleCreateTender}
          disabled={creatingTender}
          className="gap-2"
        >
          {creatingTender ? <Spinner size={16} /> : <FileSignature className="h-4 w-4" />}
          Create Tender Document
        </Button>
      </div>
    </div>
  );
}

export default JobTenderBuilderTab;
