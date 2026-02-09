"use client";

import * as React from "react";
import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Plus,
  Pencil,
  Trash2,
  Copy,
  Package,
  FileStack,
  ChevronRight,
  ClipboardList,
} from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  BillOfQuantities,
  type BOQGroup,
  type BOQSavePayload,
} from "@/components/ui/bill-of-quantities";

// Types matching backend JSON response
interface TemplateLineItem {
  id: number;
  description: string;
  quantity: number;
  unitPrice: number;
  gstCode: string;
  pricebookItemId: number | null;
  pricebookItemCode: string | null;
  lineNumber: number;
  subtotal: number;
}

interface TemplateItem {
  id: number;
  name: string;
  smScheduleMasterId: number | null;
  smScheduleMasterName: string | null;
  tradeName: string | null;
  stageName: string | null;
  supplierId: number | null;
  supplierName: string | null;
  supplierSyncKey: string | null;
  position: number;
  budget: string | null;
  notes: string | null;
  statusOnCreate: string;
  lineItemCount: number;
  lineItemTotal: number;
  lineItems?: TemplateLineItem[];
}

interface TemplatePack {
  id: number;
  name: string;
  description: string | null;
  isActive: boolean;
  position: number;
  itemCount: number;
  estimatedTotal: number;
  createdAt: string;
  updatedAt: string;
  items: TemplateItem[];
}

function formatCurrency(value: number | null | undefined): string {
  if (value == null) return "$0.00";
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    minimumFractionDigits: 2,
  }).format(value);
}

export function PoTemplatesTab() {
  const [packs, setPacks] = useState<TemplatePack[]>([]);
  const [loading, setLoading] = useState(true);
  const [subTab, setSubTab] = useState<"templates" | "boq">("templates");
  const [selectedPackId, setSelectedPackId] = useState<number | null>(null);
  const [expandedPack, setExpandedPack] = useState<number | null>(null);
  const [expandedItem, setExpandedItem] = useState<number | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingPack, setEditingPack] = useState<TemplatePack | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [saving, setSaving] = useState(false);

  const loadPacks = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.get<{ success: boolean; data: TemplatePack[] }>(
        "/api/v1/po_template_packs"
      );
      const data = response?.data || [];
      setPacks(data);
    } catch (err) {
      console.error("[PoTemplatesTab] Failed to load:", err);
      toast.error("Failed to load PO template packs");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPacks();
  }, [loadPacks]);

  // Load full pack details (with line items) when expanding or for BOQ
  const loadPackDetails = useCallback(async (packId: number) => {
    try {
      const response = await api.get<{ success: boolean; data: TemplatePack }>(
        `/api/v1/po_template_packs/${packId}`
      );
      if (response?.data) {
        setPacks((prev) =>
          prev.map((p) => (p.id === packId ? response.data : p))
        );
      }
    } catch (err) {
      console.error("Failed to load pack details:", err);
    }
  }, []);

  // Load details when switching to BOQ tab or selecting a pack
  useEffect(() => {
    if (subTab === "boq" && selectedPackId) {
      const pack = packs.find((p) => p.id === selectedPackId);
      // Load if we don't have line items yet
      if (pack && (!pack.items[0]?.lineItems || pack.items[0]?.lineItems === undefined)) {
        loadPackDetails(selectedPackId);
      }
    }
  }, [subTab, selectedPackId, packs, loadPackDetails]);

  const handleExpandPack = (packId: number) => {
    if (expandedPack === packId) {
      setExpandedPack(null);
      setExpandedItem(null);
    } else {
      setExpandedPack(packId);
      setExpandedItem(null);
      loadPackDetails(packId);
    }
  };

  const handleEditPack = (pack: TemplatePack) => {
    setEditingPack(pack);
    setEditName(pack.name);
    setEditDescription(pack.description || "");
    setShowEditDialog(true);
  };

  const handleSavePack = async () => {
    if (!editName.trim()) return;
    try {
      setSaving(true);
      if (editingPack) {
        await api.patch(`/api/v1/po_template_packs/${editingPack.id}`, {
          po_template_pack: { name: editName, description: editDescription },
        });
        toast.success("Template pack updated");
      } else {
        await api.post("/api/v1/po_template_packs", {
          po_template_pack: { name: editName, description: editDescription },
        });
        toast.success("Template pack created");
      }
      setShowEditDialog(false);
      loadPacks();
    } catch (err) {
      console.error("Failed to save pack:", err);
      toast.error("Failed to save template pack");
    } finally {
      setSaving(false);
    }
  };

  const handleDuplicate = async (packId: number) => {
    try {
      await api.post(`/api/v1/po_template_packs/${packId}/duplicate`);
      toast.success("Template pack duplicated");
      loadPacks();
    } catch (err) {
      console.error("Failed to duplicate pack:", err);
      toast.error("Failed to duplicate template pack");
    }
  };

  const handleDelete = async (packId: number) => {
    try {
      await api.delete(`/api/v1/po_template_packs/${packId}`);
      toast.success("Template pack deactivated");
      loadPacks();
    } catch (err) {
      console.error("Failed to delete pack:", err);
      toast.error("Failed to delete template pack");
    }
  };

  // Open BOQ for a specific pack
  const handleOpenBoq = (packId: number) => {
    setSelectedPackId(packId);
    setSubTab("boq");
  };

  // Save BOQ changes (quantity edits + new lines) via nested attributes PATCH
  const handleSaveBoq = useCallback(
    async (payload: BOQSavePayload) => {
      if (!selectedPackId) return;
      const pack = packs.find((p) => p.id === selectedPackId);
      if (!pack) return;

      const { quantityChanges, newLines: newLineItems } = payload;

      // Build nested attributes payload
      // Track items by template item ID so we can merge qty changes + new lines
      const itemsMap = new Map<
        number,
        { id: number; lines: Array<Record<string, unknown>> }
      >();

      const ensureItem = (itemId: number) => {
        if (!itemsMap.has(itemId)) {
          itemsMap.set(itemId, { id: itemId, lines: [] });
        }
        return itemsMap.get(itemId)!;
      };

      // 1. Quantity changes for existing lines (key format: "groupId:lineItemId")
      for (const [key, newQty] of quantityChanges) {
        const [groupIdStr, lineIdStr] = key.split(":");
        const itemId = parseInt(groupIdStr, 10);
        const lineId = parseInt(lineIdStr, 10);
        ensureItem(itemId).lines.push({ id: lineId, quantity: newQty });
      }

      // 2. New lines (no id → Rails creates new records)
      for (const nl of newLineItems) {
        const itemId = typeof nl.groupId === "string" ? parseInt(nl.groupId, 10) : nl.groupId;
        ensureItem(itemId).lines.push({
          description: nl.description,
          quantity: nl.quantity,
          unit_price: nl.unitPrice,
          gst_code: nl.gstCode,
        });
      }

      const patchPayload = {
        po_template_pack: {
          po_template_items_attributes: Array.from(itemsMap.values()).map((item) => ({
            id: item.id,
            po_template_line_items_attributes: item.lines,
          })),
        },
      };

      const totalChanges = quantityChanges.size + newLineItems.length;

      try {
        await api.patch(`/api/v1/po_template_packs/${selectedPackId}`, patchPayload);
        toast.success(
          `Saved ${totalChanges} change${totalChanges !== 1 ? "s" : ""}`
        );
        // Reload to get fresh data with recalculated subtotals
        await loadPackDetails(selectedPackId);
      } catch (err) {
        console.error("Failed to save BOQ:", err);
        toast.error("Failed to save changes");
        throw err;
      }
    },
    [selectedPackId, packs, loadPackDetails]
  );

  // Convert selected pack to BOQ groups
  const selectedPack = packs.find((p) => p.id === selectedPackId);
  const boqGroups: BOQGroup[] = React.useMemo(() => {
    if (!selectedPack) return [];
    return selectedPack.items
      .filter((item) => item.lineItems && item.lineItems.length > 0)
      .map((item) => ({
        id: item.id,
        name: item.name,
        supplierName: item.supplierName || item.supplierSyncKey,
        taskName: item.smScheduleMasterName,
        tradeName: item.tradeName,
        stageName: item.stageName,
        items: (item.lineItems || []).map((li) => ({
          id: li.id,
          description: li.description,
          quantity: li.quantity,
          unitPrice: li.unitPrice,
          gstCode: li.gstCode,
          subtotal: li.subtotal,
          pricebookItemCode: li.pricebookItemCode,
        })),
      }));
  }, [selectedPack]);

  const boqLoading =
    subTab === "boq" &&
    selectedPack &&
    selectedPack.items.length > 0 &&
    !selectedPack.items[0]?.lineItems;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner size={24} />
        <span className="ml-2 text-muted-foreground">Loading PO templates...</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <Tabs
        value={subTab}
        onValueChange={(v) => {
          const tab = v as "templates" | "boq";
          setSubTab(tab);
          // Auto-select first pack when switching to BOQ with nothing selected
          if (tab === "boq" && !selectedPackId && packs.length > 0) {
            setSelectedPackId(packs[0].id);
          }
        }}
        className="flex flex-col h-full"
      >
        <div className="flex items-center justify-between px-2 shrink-0">
          <TabsList className="h-9">
            <TabsTrigger value="templates" className="text-sm gap-1.5">
              <Package className="h-3.5 w-3.5" />
              Templates
            </TabsTrigger>
            <TabsTrigger value="boq" className="text-sm gap-1.5">
              <ClipboardList className="h-3.5 w-3.5" />
              Bill of Quantities
            </TabsTrigger>
          </TabsList>

          {/* Pack selector - always visible on BOQ tab */}
          {subTab === "boq" && packs.length > 0 && (
            <div className="flex items-center gap-2">
              <Label className="text-xs text-muted-foreground">Template:</Label>
              <select
                value={selectedPackId || ""}
                onChange={(e) => {
                  const val = e.target.value;
                  setSelectedPackId(val ? parseInt(val, 10) : null);
                }}
                className="h-8 rounded-md border border-input bg-background px-3 text-sm min-w-[200px]"
              >
                <option value="">Select a template pack...</option>
                {packs.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.itemCount} POs &middot; {formatCurrency(p.estimatedTotal)})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Templates sub-tab */}
        <TabsContent value="templates" className="flex-1 min-h-0 overflow-auto mt-3 px-2">
          <TemplatesView
            packs={packs}
            expandedPack={expandedPack}
            expandedItem={expandedItem}
            onExpandPack={handleExpandPack}
            onExpandItem={(id) => setExpandedItem(expandedItem === id ? null : id)}
            onEdit={handleEditPack}
            onDuplicate={handleDuplicate}
            onDelete={handleDelete}
            onOpenBoq={handleOpenBoq}
            onNewPack={() => {
              setEditingPack(null);
              setEditName("");
              setEditDescription("");
              setShowEditDialog(true);
            }}
          />
        </TabsContent>

        {/* BOQ sub-tab */}
        <TabsContent value="boq" className="flex-1 min-h-0 mt-3">
          {selectedPack ? (
            <BillOfQuantities
              groups={boqGroups}
              onSave={handleSaveBoq}
              loading={!!boqLoading}
            />
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
              <ClipboardList className="h-10 w-10 opacity-30" />
              <div className="text-center">
                <p className="font-medium text-foreground">Select a template pack</p>
                <p className="text-sm mt-1">
                  Choose a template from the dropdown above to view and edit its bill of quantities.
                </p>
              </div>
              {packs.length === 0 && (
                <p className="text-xs mt-2">
                  No template packs exist yet. Create one on the Templates tab first.
                </p>
              )}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Edit/Create Pack Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>
              {editingPack ? "Edit Template Pack" : "New Template Pack"}
            </DialogTitle>
            <DialogDescription>
              {editingPack
                ? "Update the template pack name and description."
                : "Create a new empty template pack. Add items from a job's POs later."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="e.g., Standard House, Townhouse, Renovation"
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Input
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                placeholder="Optional description..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowEditDialog(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button onClick={handleSavePack} disabled={saving || !editName.trim()}>
              {saving ? <Spinner size={16} className="mr-2" /> : null}
              {editingPack ? "Save" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Extracted templates list view
function TemplatesView({
  packs,
  expandedPack,
  expandedItem,
  onExpandPack,
  onExpandItem,
  onEdit,
  onDuplicate,
  onDelete,
  onOpenBoq,
  onNewPack,
}: {
  packs: TemplatePack[];
  expandedPack: number | null;
  expandedItem: number | null;
  onExpandPack: (id: number) => void;
  onExpandItem: (id: number) => void;
  onEdit: (pack: TemplatePack) => void;
  onDuplicate: (id: number) => void;
  onDelete: (id: number) => void;
  onOpenBoq: (id: number) => void;
  onNewPack: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">PO Template Packs</h3>
          <p className="text-sm text-muted-foreground">
            Define template packs to stamp purchase orders onto new jobs in one click.
          </p>
        </div>
        <Button size="sm" onClick={onNewPack} className="gap-1">
          <Plus className="h-4 w-4" />
          New Pack
        </Button>
      </div>

      {packs.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <FileStack className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>No template packs yet.</p>
            <p className="text-sm mt-1">
              Create one manually, or use &quot;Create from Job&quot; on a job with existing POs.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {packs.map((pack) => (
            <Card key={pack.id} className={cn(!pack.isActive && "opacity-60")}>
              <CardHeader
                className="py-3 px-4 cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => onExpandPack(pack.id)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <ChevronRight
                      className={cn(
                        "h-4 w-4 transition-transform",
                        expandedPack === pack.id && "rotate-90"
                      )}
                    />
                    <Package className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <CardTitle className="text-base">{pack.name}</CardTitle>
                      {pack.description && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {pack.description}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant="secondary" className="text-xs">
                      {pack.itemCount} POs
                    </Badge>
                    <Badge variant="outline" className="text-xs font-mono">
                      {formatCurrency(pack.estimatedTotal)}
                    </Badge>
                    <div
                      className="flex items-center gap-1"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => onOpenBoq(pack.id)}
                        title="Bill of Quantities"
                      >
                        <ClipboardList className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => onEdit(pack)}
                        title="Edit pack"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => onDuplicate(pack.id)}
                        title="Duplicate pack"
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={() => onDelete(pack.id)}
                        title="Deactivate pack"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              </CardHeader>

              {expandedPack === pack.id && (
                <CardContent className="pt-0 pb-3 px-4">
                  <div className="border rounded-md">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-8">#</TableHead>
                          <TableHead>PO Name</TableHead>
                          <TableHead>SM Task</TableHead>
                          <TableHead>Supplier</TableHead>
                          <TableHead className="text-right">Lines</TableHead>
                          <TableHead className="text-right">Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {pack.items.map((item, idx) => (
                          <React.Fragment key={item.id}>
                            <TableRow
                              className="cursor-pointer hover:bg-muted/50"
                              onClick={() => onExpandItem(item.id)}
                            >
                              <TableCell className="text-muted-foreground text-xs">
                                {idx + 1}
                              </TableCell>
                              <TableCell className="font-medium text-sm">
                                {item.name}
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {item.smScheduleMasterName || (
                                  <span className="italic">No task link</span>
                                )}
                              </TableCell>
                              <TableCell className="text-sm">
                                {item.supplierName ||
                                  item.supplierSyncKey || (
                                    <span className="text-muted-foreground italic">
                                      No supplier
                                    </span>
                                  )}
                              </TableCell>
                              <TableCell className="text-right text-sm">
                                {item.lineItemCount}
                              </TableCell>
                              <TableCell className="text-right text-sm font-mono">
                                {formatCurrency(item.lineItemTotal)}
                              </TableCell>
                            </TableRow>
                            {expandedItem === item.id && item.lineItems && (
                              <TableRow>
                                <TableCell colSpan={6} className="bg-muted/30 p-0">
                                  <div className="px-8 py-2">
                                    <table className="w-full text-xs">
                                      <thead>
                                        <tr className="text-muted-foreground">
                                          <th className="text-left py-1 font-medium">
                                            Description
                                          </th>
                                          <th className="text-right py-1 font-medium w-20">
                                            Qty
                                          </th>
                                          <th className="text-right py-1 font-medium w-24">
                                            Price
                                          </th>
                                          <th className="text-right py-1 font-medium w-16">
                                            GST
                                          </th>
                                          <th className="text-right py-1 font-medium w-24">
                                            Subtotal
                                          </th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {item.lineItems.map((li) => (
                                          <tr
                                            key={li.id}
                                            className="border-t border-border/50"
                                          >
                                            <td className="py-1">{li.description}</td>
                                            <td className="text-right py-1 font-mono">
                                              {li.quantity}
                                            </td>
                                            <td className="text-right py-1 font-mono">
                                              {formatCurrency(li.unitPrice)}
                                            </td>
                                            <td className="text-right py-1">{li.gstCode}</td>
                                            <td className="text-right py-1 font-mono">
                                              {formatCurrency(li.subtotal)}
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                </TableCell>
                              </TableRow>
                            )}
                          </React.Fragment>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
