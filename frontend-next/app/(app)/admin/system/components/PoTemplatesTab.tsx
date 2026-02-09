"use client";

import * as React from "react";
import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  Plus,
  Pencil,
  Trash2,
  Copy,
  Package,
  FileStack,
  ChevronRight,
} from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

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
  console.log("[PoTemplatesTab] Component mounted");
  const [packs, setPacks] = useState<TemplatePack[]>([]);
  const [loading, setLoading] = useState(true);
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
      console.log("[PoTemplatesTab] Loading packs...");
      const response = await api.get<{ success: boolean; data: TemplatePack[] }>(
        "/api/v1/po_template_packs"
      );
      console.log("[PoTemplatesTab] Response:", response);
      setPacks(response?.data || []);
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

  // Load full pack details (with line items) when expanding
  const loadPackDetails = async (packId: number) => {
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
  };

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

  console.log("[PoTemplatesTab] Render - loading:", loading, "packs:", packs.length);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 border-4 border-blue-500">
        <Spinner size={24} />
        <span className="ml-2 text-muted-foreground">Loading PO templates...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4 border-4 border-red-500 bg-red-50 dark:bg-red-950 p-2 min-h-[200px]">
      <p className="text-red-500 text-2xl font-bold">DEBUG: PoTemplatesTab rendered with {packs.length} packs</p>
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">PO Template Packs</h3>
          <p className="text-sm text-muted-foreground">
            Define template packs to stamp purchase orders onto new jobs in one click.
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => {
            setEditingPack(null);
            setEditName("");
            setEditDescription("");
            setShowEditDialog(true);
          }}
          className="gap-1"
        >
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
                onClick={() => handleExpandPack(pack.id)}
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
                        onClick={() => handleEditPack(pack)}
                        title="Edit pack"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => handleDuplicate(pack.id)}
                        title="Duplicate pack"
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={() => handleDelete(pack.id)}
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
                  {/* Items list */}
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
                              onClick={() =>
                                setExpandedItem(
                                  expandedItem === item.id ? null : item.id
                                )
                              }
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
                            {/* Expanded line items */}
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
                                            <td className="py-1">
                                              {li.description}
                                            </td>
                                            <td className="text-right py-1 font-mono">
                                              {li.quantity}
                                            </td>
                                            <td className="text-right py-1 font-mono">
                                              {formatCurrency(li.unitPrice)}
                                            </td>
                                            <td className="text-right py-1">
                                              {li.gstCode}
                                            </td>
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
