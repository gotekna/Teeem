"use client";

import * as React from "react";
import { useState, useEffect, useCallback, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Plus,
  Pencil,
  Trash2,
  Copy,
  ChevronDown,
  ChevronRight,
  Star,
  GripVertical,
  Users,
  FileText,
} from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { ComboboxDropdown, type ComboboxItem } from "@/components/ui/combobox-dropdown";

// ═══════════════════════════════════════════════════════════════════════════
// Types matching backend JSON response (camelCase)
// ═══════════════════════════════════════════════════════════════════════════

interface QuoteTemplateSupplier {
  id: number;
  supplierId: number;
  supplierName: string | null;
  contactPersonId: number | null;
  contactPersonName: string | null;
  position: number;
  isPreferred: boolean;
}

interface QuoteTemplateTrade {
  id: number;
  smTradeId: number;
  tradeName: string | null;
  position: number;
  defaultInstructions: string | null;
  requiredDocumentTypes: string[];
  supplierCount: number;
  suppliers: QuoteTemplateSupplier[];
}

interface QuoteTemplate {
  id: number;
  name: string;
  description: string | null;
  isActive: boolean;
  position: number;
  tradeCount: number;
  supplierCount: number;
  createdAt: string;
  updatedAt: string;
  trades?: QuoteTemplateTrade[];
}

// ═══════════════════════════════════════════════════════════════════════════
// Main Component
// ═══════════════════════════════════════════════════════════════════════════

export function QuoteTemplatesTab() {
  // List state
  const [templates, setTemplates] = useState<QuoteTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  // Expanded template state (for inline editing)
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [editingTemplate, setEditingTemplate] = useState<QuoteTemplate | null>(null);

  // Create/Edit dialog
  const [showDialog, setShowDialog] = useState(false);
  const [dialogMode, setDialogMode] = useState<"create" | "rename">("create");
  const [dialogName, setDialogName] = useState("");
  const [dialogDescription, setDialogDescription] = useState("");
  const [dialogTemplateId, setDialogTemplateId] = useState<number | null>(null);

  // Delete confirmation
  const [deleteId, setDeleteId] = useState<number | null>(null);

  // Lookup data (lazy loaded)
  const [tradeItems, setTradeItems] = useState<ComboboxItem[]>([]);
  const [tradesLoaded, setTradesLoaded] = useState(false);
  const [supplierItems, setSupplierItems] = useState<ComboboxItem[]>([]);
  const [suppliersLoaded, setSuppliersLoaded] = useState(false);
  const [supplierSearchLoading, setSupplierSearchLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // ─────────────────────────────────────────────────────────────────────────
  // Data Loading
  // ─────────────────────────────────────────────────────────────────────────

  const loadTemplates = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.get<{ success: boolean; data: QuoteTemplate[] }>(
        "/api/v1/quote_templates"
      );
      setTemplates(response?.data || []);
    } catch (err) {
      console.error("[QuoteTemplatesTab] Failed to load:", err);
      toast.error("Failed to load quote templates");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadTemplateDetail = useCallback(async (id: number) => {
    try {
      const response = await api.get<{ success: boolean; data: QuoteTemplate }>(
        `/api/v1/quote_templates/${id}`
      );
      if (response?.data) {
        setEditingTemplate(response.data);
        setTemplates(prev => prev.map(t => t.id === id ? { ...t, ...response.data } : t));
      }
    } catch (err) {
      console.error("[QuoteTemplatesTab] Failed to load detail:", err);
      toast.error("Failed to load template details");
    }
  }, []);

  const loadTrades = useCallback(async () => {
    if (tradesLoaded) return;
    try {
      const response = await api.get<{ success: boolean; data: { records: Array<{ id: number; values: Record<string, unknown> }> } }>(
        "/api/v1/foundations/sm_trades/records?per_page=500"
      );
      const records = response?.data?.records || [];
      setTradeItems(records.map(r => ({
        id: String(r.id),
        label: (r.values?.name as string) || `Trade ${r.id}`,
      })));
      setTradesLoaded(true);
    } catch (err) {
      console.error("[QuoteTemplatesTab] Failed to load trades:", err);
    }
  }, [tradesLoaded]);

  const loadSuppliers = useCallback(async (query?: string) => {
    try {
      setSupplierSearchLoading(true);
      const searchParam = query ? `&search=${encodeURIComponent(query)}` : "";
      const response = await api.get<{ success: boolean; data: { records: Array<{ id: number; values: Record<string, unknown> }> } }>(
        `/api/v1/foundations/contacts/records?per_page=50${searchParam}`
      );
      const records = response?.data?.records || [];
      setSupplierItems(records.map(r => ({
        id: String(r.id),
        label: (r.values?.name as string) || (r.values?.display_name as string) || `Contact ${r.id}`,
      })));
      setSuppliersLoaded(true);
    } catch (err) {
      console.error("[QuoteTemplatesTab] Failed to load suppliers:", err);
    } finally {
      setSupplierSearchLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  // ─────────────────────────────────────────────────────────────────────────
  // Template CRUD
  // ─────────────────────────────────────────────────────────────────────────

  const handleCreate = async () => {
    if (!dialogName.trim()) return;
    try {
      setSaving(true);
      await api.post("/api/v1/quote_templates", {
        quote_template: {
          name: dialogName.trim(),
          description: dialogDescription.trim() || null,
        },
      });
      toast.success(`Created "${dialogName.trim()}"`);
      setShowDialog(false);
      setDialogName("");
      setDialogDescription("");
      loadTemplates();
    } catch (err) {
      console.error("[QuoteTemplatesTab] Create failed:", err);
      toast.error("Failed to create template");
    } finally {
      setSaving(false);
    }
  };

  const handleRename = async () => {
    if (!dialogName.trim() || !dialogTemplateId) return;
    try {
      setSaving(true);
      await api.patch(`/api/v1/quote_templates/${dialogTemplateId}`, {
        quote_template: {
          name: dialogName.trim(),
          description: dialogDescription.trim() || null,
        },
      });
      toast.success("Template updated");
      setShowDialog(false);
      loadTemplates();
      if (expandedId === dialogTemplateId) loadTemplateDetail(dialogTemplateId);
    } catch (err) {
      console.error("[QuoteTemplatesTab] Rename failed:", err);
      toast.error("Failed to update template");
    } finally {
      setSaving(false);
    }
  };

  const handleDuplicate = async (id: number) => {
    try {
      await api.post(`/api/v1/quote_templates/${id}/duplicate`);
      toast.success("Template duplicated");
      loadTemplates();
    } catch (err) {
      console.error("[QuoteTemplatesTab] Duplicate failed:", err);
      toast.error("Failed to duplicate template");
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await api.delete(`/api/v1/quote_templates/${id}`);
      toast.success("Template deleted");
      setDeleteId(null);
      if (expandedId === id) {
        setExpandedId(null);
        setEditingTemplate(null);
      }
      loadTemplates();
    } catch (err) {
      console.error("[QuoteTemplatesTab] Delete failed:", err);
      toast.error("Failed to delete template");
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Trade Management (within expanded template)
  // ─────────────────────────────────────────────────────────────────────────

  const handleAddTrade = async (templateId: number, tradeId: number) => {
    if (!editingTemplate) return;
    try {
      setSaving(true);
      const existingTrades = editingTemplate.trades || [];
      const maxPosition = existingTrades.reduce((max, t) => Math.max(max, t.position), -1);

      await api.patch(`/api/v1/quote_templates/${templateId}`, {
        quote_template: {
          quote_template_trades_attributes: [
            { sm_trade_id: tradeId, position: maxPosition + 1 },
          ],
        },
      });
      toast.success("Trade added");
      loadTemplateDetail(templateId);
    } catch (err) {
      console.error("[QuoteTemplatesTab] Add trade failed:", err);
      toast.error("Failed to add trade");
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveTrade = async (templateId: number, tradeRowId: number) => {
    try {
      setSaving(true);
      await api.patch(`/api/v1/quote_templates/${templateId}`, {
        quote_template: {
          quote_template_trades_attributes: [
            { id: tradeRowId, _destroy: true },
          ],
        },
      });
      toast.success("Trade removed");
      loadTemplateDetail(templateId);
    } catch (err) {
      console.error("[QuoteTemplatesTab] Remove trade failed:", err);
      toast.error("Failed to remove trade");
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateTradeInstructions = async (templateId: number, tradeRowId: number, instructions: string) => {
    try {
      await api.patch(`/api/v1/quote_templates/${templateId}`, {
        quote_template: {
          quote_template_trades_attributes: [
            { id: tradeRowId, default_instructions: instructions },
          ],
        },
      });
    } catch (err) {
      console.error("[QuoteTemplatesTab] Update instructions failed:", err);
      toast.error("Failed to update instructions");
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Supplier Management (within a trade)
  // ─────────────────────────────────────────────────────────────────────────

  const handleAddSupplier = async (templateId: number, tradeRowId: number, supplierId: number) => {
    try {
      setSaving(true);
      const trade = editingTemplate?.trades?.find(t => t.id === tradeRowId);
      const maxPos = (trade?.suppliers || []).reduce((max, s) => Math.max(max, s.position), -1);

      await api.patch(`/api/v1/quote_templates/${templateId}`, {
        quote_template: {
          quote_template_trades_attributes: [{
            id: tradeRowId,
            quote_template_trade_suppliers_attributes: [
              { supplier_id: supplierId, position: maxPos + 1 },
            ],
          }],
        },
      });
      toast.success("Supplier added");
      loadTemplateDetail(templateId);
    } catch (err) {
      console.error("[QuoteTemplatesTab] Add supplier failed:", err);
      toast.error("Failed to add supplier");
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveSupplier = async (templateId: number, tradeRowId: number, supplierRowId: number) => {
    try {
      setSaving(true);
      await api.patch(`/api/v1/quote_templates/${templateId}`, {
        quote_template: {
          quote_template_trades_attributes: [{
            id: tradeRowId,
            quote_template_trade_suppliers_attributes: [
              { id: supplierRowId, _destroy: true },
            ],
          }],
        },
      });
      toast.success("Supplier removed");
      loadTemplateDetail(templateId);
    } catch (err) {
      console.error("[QuoteTemplatesTab] Remove supplier failed:", err);
      toast.error("Failed to remove supplier");
    } finally {
      setSaving(false);
    }
  };

  const handleTogglePreferred = async (templateId: number, tradeRowId: number, supplierRow: QuoteTemplateSupplier) => {
    try {
      await api.patch(`/api/v1/quote_templates/${templateId}`, {
        quote_template: {
          quote_template_trades_attributes: [{
            id: tradeRowId,
            quote_template_trade_suppliers_attributes: [
              { id: supplierRow.id, is_preferred: !supplierRow.isPreferred },
            ],
          }],
        },
      });
      loadTemplateDetail(templateId);
    } catch (err) {
      console.error("[QuoteTemplatesTab] Toggle preferred failed:", err);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Expand/Collapse
  // ─────────────────────────────────────────────────────────────────────────

  const handleToggleExpand = async (id: number) => {
    if (expandedId === id) {
      setExpandedId(null);
      setEditingTemplate(null);
    } else {
      setExpandedId(id);
      loadTrades();
      if (!suppliersLoaded) loadSuppliers();
      loadTemplateDetail(id);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner className="h-6 w-6" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Quote Templates</h2>
          <p className="text-sm text-muted-foreground">
            Define trades and preferred suppliers for RFQ workflows
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => {
            setDialogMode("create");
            setDialogName("");
            setDialogDescription("");
            setShowDialog(true);
          }}
        >
          <Plus className="h-4 w-4 mr-1" />
          New Template
        </Button>
      </div>

      {/* Template List */}
      {templates.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <FileText className="h-8 w-8 mx-auto mb-3 opacity-50" />
            <p className="font-medium">No quote templates yet</p>
            <p className="text-sm mt-1">Create a template to define trades and suppliers for RFQ workflows</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {templates.map((template) => (
            <Card key={template.id} className="overflow-hidden">
              {/* Template Row (collapsed) */}
              <div
                className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => handleToggleExpand(template.id)}
              >
                {expandedId === template.id ? (
                  <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                )}

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium truncate">{template.name}</span>
                    {template.description && (
                      <span className="text-sm text-muted-foreground truncate hidden sm:inline">
                        — {template.description}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant="outline" className="text-xs">
                    {template.tradeCount} {template.tradeCount === 1 ? "trade" : "trades"}
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    <Users className="h-3 w-3 mr-1" />
                    {template.supplierCount}
                  </Badge>

                  {/* Action buttons */}
                  <div className="flex items-center gap-1 ml-2" onClick={e => e.stopPropagation()}>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      title="Rename"
                      onClick={() => {
                        setDialogMode("rename");
                        setDialogTemplateId(template.id);
                        setDialogName(template.name);
                        setDialogDescription(template.description || "");
                        setShowDialog(true);
                      }}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      title="Duplicate"
                      onClick={() => handleDuplicate(template.id)}
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      title="Delete"
                      onClick={() => setDeleteId(template.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </div>

              {/* Expanded Detail */}
              {expandedId === template.id && editingTemplate && (
                <div className="border-t bg-muted/30 px-4 py-4">
                  <TemplateEditor
                    template={editingTemplate}
                    tradeItems={tradeItems}
                    supplierItems={supplierItems}
                    supplierSearchLoading={supplierSearchLoading}
                    saving={saving}
                    onAddTrade={(tradeId) => handleAddTrade(template.id, tradeId)}
                    onRemoveTrade={(tradeRowId) => handleRemoveTrade(template.id, tradeRowId)}
                    onUpdateInstructions={(tradeRowId, instructions) =>
                      handleUpdateTradeInstructions(template.id, tradeRowId, instructions)
                    }
                    onAddSupplier={(tradeRowId, supplierId) =>
                      handleAddSupplier(template.id, tradeRowId, supplierId)
                    }
                    onRemoveSupplier={(tradeRowId, supplierRowId) =>
                      handleRemoveSupplier(template.id, tradeRowId, supplierRowId)
                    }
                    onTogglePreferred={(tradeRowId, supplierRow) =>
                      handleTogglePreferred(template.id, tradeRowId, supplierRow)
                    }
                    onSearchSuppliers={loadSuppliers}
                  />
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* Create/Rename Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {dialogMode === "create" ? "New Quote Template" : "Edit Template"}
            </DialogTitle>
            <DialogDescription>
              {dialogMode === "create"
                ? "Create a template to define trades and suppliers for RFQ workflows"
                : "Update the template name and description"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                value={dialogName}
                onChange={(e) => setDialogName(e.target.value)}
                placeholder="e.g. Standard Home, Double Storey"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    dialogMode === "create" ? handleCreate() : handleRename();
                  }
                }}
              />
            </div>
            <div className="space-y-2">
              <Label>Description (optional)</Label>
              <Textarea
                value={dialogDescription}
                onChange={(e) => setDialogDescription(e.target.value)}
                placeholder="Brief description of this template"
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={dialogMode === "create" ? handleCreate : handleRename}
              disabled={!dialogName.trim() || saving}
            >
              {saving ? <Spinner className="h-4 w-4 mr-1" /> : null}
              {dialogMode === "create" ? "Create" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Template</DialogTitle>
            <DialogDescription>
              This will deactivate the template. Existing quote trackers created from this template will not be affected.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteId && handleDelete(deleteId)}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Template Editor (expanded inline view)
// ═══════════════════════════════════════════════════════════════════════════

interface TemplateEditorProps {
  template: QuoteTemplate;
  tradeItems: ComboboxItem[];
  supplierItems: ComboboxItem[];
  supplierSearchLoading: boolean;
  saving: boolean;
  onAddTrade: (tradeId: number) => void;
  onRemoveTrade: (tradeRowId: number) => void;
  onUpdateInstructions: (tradeRowId: number, instructions: string) => void;
  onAddSupplier: (tradeRowId: number, supplierId: number) => void;
  onRemoveSupplier: (tradeRowId: number, supplierRowId: number) => void;
  onTogglePreferred: (tradeRowId: number, supplierRow: QuoteTemplateSupplier) => void;
  onSearchSuppliers: (query?: string) => void;
}

function TemplateEditor({
  template,
  tradeItems,
  supplierItems,
  supplierSearchLoading,
  saving,
  onAddTrade,
  onRemoveTrade,
  onUpdateInstructions,
  onAddSupplier,
  onRemoveSupplier,
  onTogglePreferred,
  onSearchSuppliers,
}: TemplateEditorProps) {
  const templateTrades = template.trades || [];

  // Filter trades not already in template
  const usedTradeIds = new Set(templateTrades.map(t => String(t.smTradeId)));
  const availableTradeItems = tradeItems.filter(t => !usedTradeIds.has(t.id));

  return (
    <div className="space-y-4">
      {/* Trades List */}
      {templateTrades.length === 0 ? (
        <p className="text-sm text-muted-foreground py-2">
          No trades added yet. Add a trade to start building this template.
        </p>
      ) : (
        <div className="space-y-3">
          {templateTrades.map((trade) => (
            <TradeSection
              key={trade.id}
              trade={trade}
              supplierItems={supplierItems}
              supplierSearchLoading={supplierSearchLoading}
              onRemove={() => onRemoveTrade(trade.id)}
              onUpdateInstructions={(instructions) => onUpdateInstructions(trade.id, instructions)}
              onAddSupplier={(supplierId) => onAddSupplier(trade.id, supplierId)}
              onRemoveSupplier={(supplierRowId) => onRemoveSupplier(trade.id, supplierRowId)}
              onTogglePreferred={(supplierRow) => onTogglePreferred(trade.id, supplierRow)}
              onSearchSuppliers={onSearchSuppliers}
            />
          ))}
        </div>
      )}

      {/* Add Trade */}
      <div className="flex items-center gap-2 pt-2">
        <ComboboxDropdown
          items={availableTradeItems}
          onSelect={(item) => onAddTrade(Number(item.id))}
          placeholder="Add trade..."
          searchPlaceholder="Search trades..."
          emptyResults="No trades available"
          className="w-64"
        />
        {saving && <Spinner className="h-4 w-4" />}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Trade Section (within template editor)
// ═══════════════════════════════════════════════════════════════════════════

interface TradeSectionProps {
  trade: QuoteTemplateTrade;
  supplierItems: ComboboxItem[];
  supplierSearchLoading: boolean;
  onRemove: () => void;
  onUpdateInstructions: (instructions: string) => void;
  onAddSupplier: (supplierId: number) => void;
  onRemoveSupplier: (supplierRowId: number) => void;
  onTogglePreferred: (supplierRow: QuoteTemplateSupplier) => void;
  onSearchSuppliers: (query?: string) => void;
}

function TradeSection({
  trade,
  supplierItems,
  supplierSearchLoading,
  onRemove,
  onUpdateInstructions,
  onAddSupplier,
  onRemoveSupplier,
  onTogglePreferred,
  onSearchSuppliers,
}: TradeSectionProps) {
  const [expanded, setExpanded] = useState(true);
  const [instructionsValue, setInstructionsValue] = useState(trade.defaultInstructions || "");
  const instructionsTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Debounced save for instructions
  const handleInstructionsChange = (value: string) => {
    setInstructionsValue(value);
    if (instructionsTimerRef.current) clearTimeout(instructionsTimerRef.current);
    instructionsTimerRef.current = setTimeout(() => onUpdateInstructions(value), 1000);
  };

  // Filter out suppliers already in this trade
  const existingSupplierIds = new Set(trade.suppliers.map(s => String(s.supplierId)));
  const availableSupplierItems = supplierItems.filter(s => !existingSupplierIds.has(s.id));

  return (
    <div className="border rounded-lg bg-background">
      {/* Trade Header */}
      <div
        className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-muted/50"
        onClick={() => setExpanded(!expanded)}
      >
        <GripVertical className="h-4 w-4 text-muted-foreground/50" />
        {expanded ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        )}
        <span className="font-medium text-sm flex-1">{trade.tradeName || `Trade #${trade.smTradeId}`}</span>
        <Badge variant="secondary" className="text-xs">
          {trade.suppliers.length} {trade.suppliers.length === 1 ? "supplier" : "suppliers"}
        </Badge>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-destructive hover:text-destructive"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Trade Detail */}
      {expanded && (
        <div className="border-t px-3 py-3 space-y-3">
          {/* Default Instructions */}
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Default RFQ Instructions</Label>
            <Textarea
              value={instructionsValue}
              onChange={(e) => handleInstructionsChange(e.target.value)}
              placeholder="Instructions that will be included in RFQ emails for this trade..."
              rows={2}
              className="text-sm"
            />
          </div>

          {/* Suppliers List */}
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Suppliers</Label>
            {trade.suppliers.length === 0 ? (
              <p className="text-xs text-muted-foreground py-1">No suppliers assigned</p>
            ) : (
              <div className="space-y-1">
                {trade.suppliers.map((supplier) => (
                  <div
                    key={supplier.id}
                    className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted/50 group"
                  >
                    <Button
                      variant="ghost"
                      size="icon"
                      className={cn(
                        "h-5 w-5 shrink-0",
                        supplier.isPreferred ? "text-yellow-500" : "text-muted-foreground/30"
                      )}
                      title={supplier.isPreferred ? "Preferred supplier" : "Set as preferred"}
                      onClick={() => onTogglePreferred(supplier)}
                    >
                      <Star className={cn("h-3.5 w-3.5", supplier.isPreferred && "fill-current")} />
                    </Button>
                    <span className="text-sm flex-1 truncate">
                      {supplier.supplierName || `Supplier #${supplier.supplierId}`}
                    </span>
                    {supplier.contactPersonName && (
                      <span className="text-xs text-muted-foreground truncate">
                        {supplier.contactPersonName}
                      </span>
                    )}
                    {supplier.isPreferred && (
                      <Badge variant="outline" className="text-xs text-yellow-600 dark:text-yellow-400 border-yellow-300 dark:border-yellow-700">
                        Preferred
                      </Badge>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5 opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive"
                      onClick={() => onRemoveSupplier(supplier.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {/* Add Supplier */}
            <div className="pt-1">
              <ComboboxDropdown
                items={availableSupplierItems}
                onSelect={(item) => onAddSupplier(Number(item.id))}
                onInputChange={(query) => onSearchSuppliers(query)}
                disableInternalFilter
                isLoading={supplierSearchLoading}
                placeholder="Add supplier..."
                searchPlaceholder="Search contacts..."
                emptyResults="No matching contacts"
                className="w-56"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
