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
import { Checkbox } from "@/components/ui/checkbox";
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
  Package,
  BarChart3,
  ExternalLink,
  Paperclip,
  RefreshCw,
  Link2Off,
} from "lucide-react";
import Link from "next/link";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { DocumentTypePicker } from "@/components/settings/DocumentTypePicker";
import { toast } from "sonner";
import { ComboboxDropdown, type ComboboxItem } from "@/components/ui/combobox-dropdown";
import PriceComparisonSheet from "@/app/(app)/pricebook/components/PriceComparisonSheet";

// ═══════════════════════════════════════════════════════════════════════════
// Types matching backend JSON response (camelCase)
// ═══════════════════════════════════════════════════════════════════════════

interface PoPackItem {
  id: number;
  name: string;
  smScheduleMasterId: number | null;
  smScheduleMasterName: string | null;
  supplierId: number | null;
  supplierName: string | null;
  supplierIsPriceOnly: boolean | null;
  pricebookItemIds: number[];
}

interface PoPack {
  id: number;
  name: string;
  description: string | null;
  itemCount: number;
  smTemplateName: string | null;
  items: PoPackItem[];
}

interface QuoteTemplateSupplier {
  id: number;
  supplierId: number;
  supplierName: string | null;
  supplierEmail: string | null;
  contactPersonId: number | null;
  contactPersonName: string | null;
  contactPersonEmail: string | null;
  position: number;
  isPreferred: boolean;
}

interface QuoteTemplateTask {
  id: number;
  smScheduleMasterId: number;
  taskName: string | null;
  costCentre: number | null;
  poRequired: boolean | null;
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
  poTemplatePackId: number | null;
  poTemplatePackName: string | null;
  smTemplateName: string | null;
  tradeCount: number;
  supplierCount: number;
  syncStatus?: { syncedTenants: string[] } | null;
  createdAt: string;
  updatedAt: string;
  trades?: QuoteTemplateTask[];
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
  const [dialogPackId, setDialogPackId] = useState<number | null>(null);

  // Delete confirmation
  const [deleteId, setDeleteId] = useState<number | null>(null);

  // PO Template Packs (for dropdown)
  const [poPacks, setPoPacks] = useState<PoPack[]>([]);
  const [poPacksLoaded, setPoPacksLoaded] = useState(false);

  // Lookup data (lazy loaded per expanded template)
  const [supplierItems, setSupplierItems] = useState<ComboboxItem[]>([]);
  const [suppliersLoaded, setSuppliersLoaded] = useState(false);
  const [supplierSearchLoading, setSupplierSearchLoading] = useState(false);
  const [showAllSuppliers, setShowAllSuppliers] = useState(false);
  const [saving, setSaving] = useState(false);

  // Price comparison sheet state
  const [priceCompareIds, setPriceCompareIds] = useState<number[]>([]);
  const [priceCompareSupplierIds, setPriceCompareSupplierIds] = useState<number[]>([]);

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

  // Load PO Template Packs for dropdown
  const loadPoPacks = useCallback(async () => {
    if (poPacksLoaded) return;
    try {
      const response = await api.get<{ success: boolean; data: PoPack[] }>(
        "/api/v1/quote_templates/po_packs"
      );
      setPoPacks(response?.data || []);
      setPoPacksLoaded(true);
    } catch (err) {
      console.error("[QuoteTemplatesTab] Failed to load PO packs:", err);
    }
  }, [poPacksLoaded]);

  const loadSuppliers = useCallback(async (query?: string) => {
    try {
      setSupplierSearchLoading(true);
      const searchParam = query ? `&search=${encodeURIComponent(query)}` : "";
      // Contacts is a system foundation — fields are top-level on each record, not nested under `values`
      const response = await api.get<{ success: boolean; records: Array<Record<string, unknown> & { id: number }> }>(
        `/api/v1/foundations/contacts/records?per_page=50${searchParam}`
      );
      const records = response?.records || [];
      // Filter out price_only and person contacts — only real suppliers can be quoted
      setSupplierItems(
        records
          .filter(r => r.entity_type !== "price_only" && r.entity_type !== "person")
          .map(r => ({
            id: String(r.id),
            label: (r.display_name as string) || (r.company_name_or_trust as string) || `Contact ${r.id}`,
          }))
      );
      setSuppliersLoaded(true);
    } catch (err) {
      console.error("[QuoteTemplatesTab] Failed to load suppliers:", err);
    } finally {
      setSupplierSearchLoading(false);
    }
  }, []);


  useEffect(() => {
    loadTemplates();
    loadPoPacks();
  }, [loadTemplates, loadPoPacks]);

  // ─────────────────────────────────────────────────────────────────────────
  // Helpers
  // ─────────────────────────────────────────────────────────────────────────

  // Get the selected pack's real supplier items (excluding price_only contacts)
  const getPackSupplierItems = useCallback((packId: number | null): ComboboxItem[] => {
    if (!packId) return [];
    const pack = poPacks.find(p => p.id === packId);
    if (!pack) return [];

    // Dedupe + filter out price_only contacts (they have no real supplier info)
    const seen = new Set<number>();
    const items: ComboboxItem[] = [];
    for (const item of pack.items) {
      if (item.supplierId && !item.supplierIsPriceOnly && !seen.has(item.supplierId)) {
        seen.add(item.supplierId);
        items.push({ id: String(item.supplierId), label: item.supplierName || `Supplier ${item.supplierId}` });
      }
    }
    return items;
  }, [poPacks]);

  // Open PriceComparisonSheet for a specific task's pricebook items
  const handleViewPrices = useCallback((smScheduleMasterId: number, packId: number | null) => {
    if (!packId) return;
    const pack = poPacks.find(p => p.id === packId);
    if (!pack) return;
    const packItem = pack.items.find(i => i.smScheduleMasterId === smScheduleMasterId);
    if (!packItem || packItem.pricebookItemIds.length === 0) {
      toast.error("No pricebook items linked to this task's PO line items");
      return;
    }
    setPriceCompareIds(packItem.pricebookItemIds);
    setPriceCompareSupplierIds(packItem.supplierId ? [packItem.supplierId] : []);
  }, [poPacks]);

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
          po_template_pack_id: dialogPackId,
        },
      });
      toast.success(`Created "${dialogName.trim()}"`);
      setShowDialog(false);
      setDialogName("");
      setDialogDescription("");
      setDialogPackId(null);
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
          po_template_pack_id: dialogPackId,
        },
      });
      toast.success("Template updated");
      setShowDialog(false);
      loadTemplates();
      if (expandedId === dialogTemplateId) {
        loadTemplateDetail(dialogTemplateId);
      }
    } catch (err) {
      console.error("[QuoteTemplatesTab] Update failed:", err);
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
  // Task Management (within expanded template)
  // ─────────────────────────────────────────────────────────────────────────

  const handleAddTask = async (templateId: number, smScheduleMasterId: number) => {
    if (!editingTemplate) return;
    try {
      setSaving(true);
      const existingTasks = editingTemplate.trades || [];
      const maxPosition = existingTasks.reduce((max, t) => Math.max(max, t.position), -1);

      // Check if the pack has a real supplier for this task — auto-add as preferred
      // Skip price_only contacts (they have no real supplier info for quoting)
      const pack = poPacks.find(p => p.id === editingTemplate.poTemplatePackId);
      const packItem = pack?.items.find(i => i.smScheduleMasterId === smScheduleMasterId);
      const hasRealSupplier = packItem?.supplierId && !packItem.supplierIsPriceOnly;

      const tradeAttrs: Record<string, unknown> = {
        sm_schedule_master_id: smScheduleMasterId,
        position: maxPosition + 1,
      };

      if (hasRealSupplier) {
        tradeAttrs.quote_template_trade_suppliers_attributes = [
          { supplier_id: packItem.supplierId, position: 0, is_preferred: true },
        ];
      }

      await api.patch(`/api/v1/quote_templates/${templateId}`, {
        quote_template: {
          quote_template_trades_attributes: [tradeAttrs],
        },
      });
      const supplierMsg = hasRealSupplier ? ` with ${packItem.supplierName}` : "";
      toast.success(`PO Task added${supplierMsg}`);
      loadTemplateDetail(templateId);
    } catch (err) {
      console.error("[QuoteTemplatesTab] Add task failed:", err);
      toast.error("Failed to add PO task");
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveTask = async (templateId: number, taskRowId: number) => {
    try {
      setSaving(true);
      await api.patch(`/api/v1/quote_templates/${templateId}`, {
        quote_template: {
          quote_template_trades_attributes: [
            { id: taskRowId, _destroy: true },
          ],
        },
      });
      toast.success("PO Task removed");
      loadTemplateDetail(templateId);
    } catch (err) {
      console.error("[QuoteTemplatesTab] Remove task failed:", err);
      toast.error("Failed to remove PO task");
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateTaskInstructions = async (templateId: number, taskRowId: number, instructions: string) => {
    try {
      await api.patch(`/api/v1/quote_templates/${templateId}`, {
        quote_template: {
          quote_template_trades_attributes: [
            { id: taskRowId, default_instructions: instructions },
          ],
        },
      });
    } catch (err) {
      console.error("[QuoteTemplatesTab] Update instructions failed:", err);
      toast.error("Failed to update instructions");
    }
  };

  const handleUpdateDocumentTypes = async (templateId: number, taskRowId: number, docTypes: string[]) => {
    try {
      await api.patch(`/api/v1/quote_templates/${templateId}`, {
        quote_template: {
          quote_template_trades_attributes: [
            { id: taskRowId, required_document_types: docTypes },
          ],
        },
      });
    } catch (err) {
      console.error("[QuoteTemplatesTab] Update document types failed:", err);
      toast.error("Failed to update document types");
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Supplier Management (within a task)
  // ─────────────────────────────────────────────────────────────────────────

  const handleAddSupplier = async (templateId: number, taskRowId: number, supplierId: number) => {
    try {
      setSaving(true);
      const task = editingTemplate?.trades?.find(t => t.id === taskRowId);
      const maxPos = (task?.suppliers || []).reduce((max, s) => Math.max(max, s.position), -1);

      await api.patch(`/api/v1/quote_templates/${templateId}`, {
        quote_template: {
          quote_template_trades_attributes: [{
            id: taskRowId,
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

  const handleRemoveSupplier = async (templateId: number, taskRowId: number, supplierRowId: number) => {
    try {
      setSaving(true);
      await api.patch(`/api/v1/quote_templates/${templateId}`, {
        quote_template: {
          quote_template_trades_attributes: [{
            id: taskRowId,
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

  const handleTogglePreferred = async (templateId: number, taskRowId: number, supplierRow: QuoteTemplateSupplier) => {
    try {
      await api.patch(`/api/v1/quote_templates/${templateId}`, {
        quote_template: {
          quote_template_trades_attributes: [{
            id: taskRowId,
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

  const handleUpdateContactPerson = async (
    templateId: number, taskRowId: number, supplierRowId: number, contactPersonId: number | null
  ) => {
    try {
      await api.patch(`/api/v1/quote_templates/${templateId}`, {
        quote_template: {
          quote_template_trades_attributes: [{
            id: taskRowId,
            quote_template_trade_suppliers_attributes: [
              { id: supplierRowId, contact_person_id: contactPersonId },
            ],
          }],
        },
      });
      loadTemplateDetail(templateId);
    } catch (err) {
      console.error("[QuoteTemplatesTab] Update contact person failed:", err);
      toast.error("Failed to update contact person");
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
      if (!suppliersLoaded) loadSuppliers();
      loadTemplateDetail(id);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Render helpers
  // ─────────────────────────────────────────────────────────────────────────

  const poPackItems: ComboboxItem[] = poPacks.map(p => ({
    id: String(p.id),
    label: `${p.name}${p.smTemplateName ? ` (${p.smTemplateName})` : ""}`,
  }));

  // Get available PO tasks from the selected pack (for "Add Task" dropdown)
  const getAvailableTasksFromPack = (template: QuoteTemplate): ComboboxItem[] => {
    if (!template.poTemplatePackId) return [];
    const pack = poPacks.find(p => p.id === template.poTemplatePackId);
    if (!pack) return [];

    const usedTaskIds = new Set((template.trades || []).map(t => t.smScheduleMasterId));
    return pack.items
      .filter(item => item.smScheduleMasterId && !usedTaskIds.has(item.smScheduleMasterId))
      .map(item => ({
        id: String(item.smScheduleMasterId!),
        label: item.smScheduleMasterName || item.name,
      }));
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
            Link a PO Template to define tasks and suppliers for RFQ workflows
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => {
            setDialogMode("create");
            setDialogName("");
            setDialogDescription("");
            setDialogPackId(null);
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
            <p className="text-sm mt-1">Create a template linked to a PO Template to define tasks and suppliers</p>
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
                    {template.poTemplatePackName && (
                      <Badge variant="secondary" className="text-xs shrink-0">
                        <Package className="h-3 w-3 mr-1" />
                        {template.poTemplatePackName}
                      </Badge>
                    )}
                    {template.smTemplateName && (
                      <Badge variant="outline" className="text-xs shrink-0">
                        {template.smTemplateName}
                      </Badge>
                    )}
                    {template.syncStatus?.syncedTenants && template.syncStatus.syncedTenants.length > 0 && (
                      <Badge className="text-xs bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 border-green-200 dark:border-green-800 shrink-0">
                        <RefreshCw className="h-3 w-3 mr-1" />
                        Synced: {template.syncStatus.syncedTenants.join(", ")}
                      </Badge>
                    )}
                    {template.description && (
                      <span className="text-sm text-muted-foreground truncate hidden sm:inline">
                        — {template.description}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant="outline" className="text-xs">
                    {template.tradeCount} {template.tradeCount === 1 ? "task" : "tasks"}
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
                      title="Edit"
                      onClick={() => {
                        setDialogMode("rename");
                        setDialogTemplateId(template.id);
                        setDialogName(template.name);
                        setDialogDescription(template.description || "");
                        setDialogPackId(template.poTemplatePackId);
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
                      className={`h-7 w-7 ${template.syncStatus?.syncedTenants?.length ? "text-muted-foreground cursor-not-allowed" : "text-destructive hover:text-destructive"}`}
                      title={template.syncStatus?.syncedTenants?.length ? "Synced — cannot delete" : "Delete"}
                      disabled={!!template.syncStatus?.syncedTenants?.length}
                      onClick={() => !template.syncStatus?.syncedTenants?.length && setDeleteId(template.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </div>

              {/* Expanded Detail */}
              {expandedId === template.id && editingTemplate && (
                <div className="border-t bg-muted/30 px-4 py-4">
                  {!template.poTemplatePackId ? (
                    <div className="text-sm text-muted-foreground py-4 text-center">
                      <Package className="h-6 w-6 mx-auto mb-2 opacity-50" />
                      <p className="font-medium">No PO Template linked</p>
                      <p className="mt-1">Edit this template to link it to a PO Template for task and supplier suggestions.</p>
                    </div>
                  ) : (
                    <TemplateEditor
                      template={editingTemplate}
                      availableTaskItems={getAvailableTasksFromPack(editingTemplate)}
                      supplierItems={supplierItems}
                      packSupplierItems={getPackSupplierItems(editingTemplate.poTemplatePackId)}
                      showAllSuppliers={showAllSuppliers}
                      onToggleShowAll={() => setShowAllSuppliers(!showAllSuppliers)}
                      supplierSearchLoading={supplierSearchLoading}
                      saving={saving}
                      onAddTask={(taskId) => handleAddTask(template.id, taskId)}
                      onRemoveTask={(taskRowId) => handleRemoveTask(template.id, taskRowId)}
                      onUpdateInstructions={(taskRowId, instructions) =>
                        handleUpdateTaskInstructions(template.id, taskRowId, instructions)
                      }
                      onUpdateDocumentTypes={(taskRowId, docTypes) =>
                        handleUpdateDocumentTypes(template.id, taskRowId, docTypes)
                      }
                      onAddSupplier={(taskRowId, supplierId) =>
                        handleAddSupplier(template.id, taskRowId, supplierId)
                      }
                      onRemoveSupplier={(taskRowId, supplierRowId) =>
                        handleRemoveSupplier(template.id, taskRowId, supplierRowId)
                      }
                      onTogglePreferred={(taskRowId, supplierRow) =>
                        handleTogglePreferred(template.id, taskRowId, supplierRow)
                      }
                      onUpdateContactPerson={(taskRowId, supplierRowId, contactPersonId) =>
                        handleUpdateContactPerson(template.id, taskRowId, supplierRowId, contactPersonId)
                      }
                      onSearchSuppliers={loadSuppliers}
                      onViewPrices={(smScheduleMasterId) =>
                        handleViewPrices(smScheduleMasterId, editingTemplate.poTemplatePackId)
                      }
                      poPacks={poPacks}
                      packId={editingTemplate.poTemplatePackId}
                    />
                  )}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {dialogMode === "create" ? "New Quote Template" : "Edit Template"}
            </DialogTitle>
            <DialogDescription>
              {dialogMode === "create"
                ? "Create a template linked to a PO Template for RFQ workflows"
                : "Update the template name and linked PO Template"}
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
              <Label>PO Template</Label>
              <ComboboxDropdown
                items={poPackItems}
                selectedItem={dialogPackId ? poPackItems.find(i => i.id === String(dialogPackId)) : undefined}
                onSelect={(item) => setDialogPackId(Number(item.id))}
                placeholder="Select PO template..."
                searchPlaceholder="Search PO templates..."
                emptyResults="No PO templates found"
                className="w-full"
              />
              {dialogPackId && (() => {
                const pack = poPacks.find(p => p.id === dialogPackId);
                return pack ? (
                  <div className="text-xs text-muted-foreground space-y-1">
                    <p>{pack.itemCount} items{pack.smTemplateName ? ` • Schedule: ${pack.smTemplateName}` : ""}</p>
                    {pack.items.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {pack.items.slice(0, 6).map(item => (
                          <Badge key={item.id} variant="outline" className="text-xs">
                            {item.smScheduleMasterName || item.name}
                            {item.supplierName ? ` → ${item.supplierName}` : ""}
                          </Badge>
                        ))}
                        {pack.items.length > 6 && (
                          <Badge variant="outline" className="text-xs">
                            +{pack.items.length - 6} more
                          </Badge>
                        )}
                      </div>
                    )}
                  </div>
                ) : null;
              })()}
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

            {/* Sync status + disconnect */}
            {dialogMode === "rename" && (() => {
              const t = templates.find(t => t.id === dialogTemplateId);
              if (!t?.syncStatus?.syncedTenants?.length) return null;
              return (
                <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <RefreshCw className="h-4 w-4 text-green-600 dark:text-green-400" />
                      <span className="text-sm font-medium text-green-800 dark:text-green-200">
                        Synced with {t.syncStatus.syncedTenants.join(", ")}
                      </span>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-destructive border-destructive/30 hover:bg-destructive/10"
                      onClick={async () => {
                        try {
                          await api.patch(`/api/v1/quote_templates/${t.id}`, {
                            quote_template: { sync_key: null },
                          });
                          toast.success("Disconnected from sync");
                          setShowDialog(false);
                          loadTemplates();
                        } catch (err) {
                          console.error("[QuoteTemplatesTab] disconnect error:", err);
                          toast.error("Failed to disconnect");
                        }
                      }}
                    >
                      <Link2Off className="h-3.5 w-3.5 mr-1" />
                      Disconnect
                    </Button>
                  </div>
                  <p className="text-xs text-green-700 dark:text-green-300">
                    Disconnecting makes this template local-only. Other tenants keep their copy.
                  </p>
                </div>
              );
            })()}
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

      {/* Price Comparison Sheet */}
      <PriceComparisonSheet
        open={priceCompareIds.length > 0}
        onOpenChange={(open: boolean) => { if (!open) setPriceCompareIds([]); }}
        selectedIds={priceCompareIds}
        clearSelection={() => {}}
        onRefresh={() => {}}
        includeSupplierIds={priceCompareSupplierIds}
        expandToSupplierItems={true}
      />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Template Editor (expanded inline view)
// ═══════════════════════════════════════════════════════════════════════════

interface TemplateEditorProps {
  template: QuoteTemplate;
  availableTaskItems: ComboboxItem[];
  supplierItems: ComboboxItem[];
  packSupplierItems: ComboboxItem[];
  showAllSuppliers: boolean;
  onToggleShowAll: () => void;
  supplierSearchLoading: boolean;
  saving: boolean;
  onAddTask: (smScheduleMasterId: number) => void;
  onRemoveTask: (taskRowId: number) => void;
  onUpdateInstructions: (taskRowId: number, instructions: string) => void;
  onUpdateDocumentTypes: (taskRowId: number, docTypes: string[]) => void;
  onAddSupplier: (taskRowId: number, supplierId: number) => void;
  onRemoveSupplier: (taskRowId: number, supplierRowId: number) => void;
  onTogglePreferred: (taskRowId: number, supplierRow: QuoteTemplateSupplier) => void;
  onUpdateContactPerson: (taskRowId: number, supplierRowId: number, contactPersonId: number | null) => void;
  onSearchSuppliers: (query?: string) => void;
  onViewPrices: (smScheduleMasterId: number) => void;
  poPacks: PoPack[];
  packId: number | null;
}

function TemplateEditor({
  template,
  availableTaskItems,
  supplierItems,
  packSupplierItems,
  showAllSuppliers,
  onToggleShowAll,
  supplierSearchLoading,
  saving,
  onAddTask,
  onRemoveTask,
  onUpdateInstructions,
  onUpdateDocumentTypes,
  onAddSupplier,
  onRemoveSupplier,
  onTogglePreferred,
  onUpdateContactPerson,
  onSearchSuppliers,
  onViewPrices,
  poPacks,
  packId,
}: TemplateEditorProps) {
  const templateTasks = template.trades || [];

  return (
    <div className="space-y-4">
      {/* Tasks List */}
      {templateTasks.length === 0 ? (
        <p className="text-sm text-muted-foreground py-2">
          No PO tasks yet. Add a task from the linked PO Template below.
        </p>
      ) : (
        <div className="space-y-3">
          {templateTasks.map((task) => {
            const pack = packId ? poPacks.find(p => p.id === packId) : null;
            const packItem = pack?.items.find(i => i.smScheduleMasterId === task.smScheduleMasterId);
            const hasPricebookItems = (packItem?.pricebookItemIds?.length ?? 0) > 0;
            return (
              <TaskSection
                key={task.id}
                task={task}
                supplierItems={showAllSuppliers ? supplierItems : packSupplierItems}
                supplierSearchLoading={supplierSearchLoading}
                showAllSuppliers={showAllSuppliers}
                onToggleShowAll={onToggleShowAll}
                onRemove={() => onRemoveTask(task.id)}
                onUpdateInstructions={(instructions) => onUpdateInstructions(task.id, instructions)}
                onUpdateDocumentTypes={(docTypes) => onUpdateDocumentTypes(task.id, docTypes)}
                onAddSupplier={(supplierId) => onAddSupplier(task.id, supplierId)}
                onRemoveSupplier={(supplierRowId) => onRemoveSupplier(task.id, supplierRowId)}
                onTogglePreferred={(supplierRow) => onTogglePreferred(task.id, supplierRow)}
                onUpdateContactPerson={(supplierRowId, contactPersonId) => onUpdateContactPerson(task.id, supplierRowId, contactPersonId)}
                onSearchSuppliers={onSearchSuppliers}
                onViewPrices={hasPricebookItems ? () => onViewPrices(task.smScheduleMasterId) : undefined}
              />
            );
          })}
        </div>
      )}

      {/* Add Task */}
      {availableTaskItems.length > 0 && (
        <div className="flex items-center gap-2 pt-2">
          <ComboboxDropdown
            items={availableTaskItems}
            onSelect={(item) => onAddTask(Number(item.id))}
            placeholder="Add PO task..."
            searchPlaceholder="Search PO tasks..."
            emptyResults="No more PO tasks available from this template"
            className="w-64"
          />
          {saving && <Spinner className="h-4 w-4" />}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Task Section (within template editor)
// ═══════════════════════════════════════════════════════════════════════════

interface TaskSectionProps {
  task: QuoteTemplateTask;
  supplierItems: ComboboxItem[];
  supplierSearchLoading: boolean;
  showAllSuppliers: boolean;
  onToggleShowAll: () => void;
  onRemove: () => void;
  onUpdateInstructions: (instructions: string) => void;
  onUpdateDocumentTypes: (docTypes: string[]) => void;
  onAddSupplier: (supplierId: number) => void;
  onRemoveSupplier: (supplierRowId: number) => void;
  onTogglePreferred: (supplierRow: QuoteTemplateSupplier) => void;
  onUpdateContactPerson: (supplierRowId: number, contactPersonId: number | null) => void;
  onSearchSuppliers: (query?: string) => void;
  onViewPrices?: () => void;
}

function TaskSection({
  task,
  supplierItems,
  supplierSearchLoading,
  showAllSuppliers,
  onToggleShowAll,
  onRemove,
  onUpdateInstructions,
  onUpdateDocumentTypes,
  onAddSupplier,
  onRemoveSupplier,
  onTogglePreferred,
  onUpdateContactPerson,
  onSearchSuppliers,
  onViewPrices,
}: TaskSectionProps) {
  const [expanded, setExpanded] = useState(true);
  const [instructionsValue, setInstructionsValue] = useState(task.defaultInstructions || "");
  const instructionsTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Debounced save for instructions
  const handleInstructionsChange = (value: string) => {
    setInstructionsValue(value);
    if (instructionsTimerRef.current) clearTimeout(instructionsTimerRef.current);
    instructionsTimerRef.current = setTimeout(() => onUpdateInstructions(value), 1000);
  };

  // Filter out suppliers already in this task
  const existingSupplierIds = new Set(task.suppliers.map(s => String(s.supplierId)));
  const availableSupplierItems = supplierItems.filter(s => !existingSupplierIds.has(s.id));

  return (
    <div className="border rounded-lg bg-background">
      {/* Task Header */}
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
        <span className="font-medium text-sm flex-1">{task.taskName || `Task #${task.smScheduleMasterId}`}</span>
        {task.requiredDocumentTypes.length > 0 && (
          <Badge variant="outline" className="text-xs">
            <Paperclip className="h-3 w-3 mr-1" />
            {task.requiredDocumentTypes.length}
          </Badge>
        )}
        <Badge variant="secondary" className="text-xs">
          {task.suppliers.length} {task.suppliers.length === 1 ? "supplier" : "suppliers"}
        </Badge>
        {onViewPrices && (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            title="View price history for this task's pricebook items"
            onClick={(e) => {
              e.stopPropagation();
              onViewPrices();
            }}
          >
            <BarChart3 className="h-3.5 w-3.5" />
          </Button>
        )}
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

      {/* Task Detail */}
      {expanded && (
        <div className="border-t px-3 py-3 space-y-3">
          {/* Default Instructions */}
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Default RFQ Instructions</Label>
            <Textarea
              value={instructionsValue}
              onChange={(e) => handleInstructionsChange(e.target.value)}
              placeholder="Instructions that will be included in RFQ emails for this task..."
              rows={2}
              className="text-sm"
            />
          </div>

          {/* Attach Document Types */}
          <DocumentTypePicker
            selected={task.requiredDocumentTypes}
            onChange={onUpdateDocumentTypes}
          />

          {/* Suppliers List */}
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Suppliers</Label>
            {task.suppliers.length === 0 ? (
              <p className="text-xs text-muted-foreground py-1">No suppliers assigned</p>
            ) : (
              <div className="space-y-1">
                {task.suppliers.map((supplier) => (
                  <SupplierRow
                    key={supplier.id}
                    supplier={supplier}
                    onTogglePreferred={() => onTogglePreferred(supplier)}
                    onRemove={() => onRemoveSupplier(supplier.id)}
                    onUpdateContactPerson={(contactPersonId) => onUpdateContactPerson(supplier.id, contactPersonId)}
                  />
                ))}
              </div>
            )}

            {/* Add Supplier */}
            <div className="flex items-center gap-3 pt-1">
              <ComboboxDropdown
                items={availableSupplierItems}
                onSelect={(item) => onAddSupplier(Number(item.id))}
                onInputChange={showAllSuppliers ? (query) => onSearchSuppliers(query) : undefined}
                disableInternalFilter={showAllSuppliers}
                isLoading={supplierSearchLoading}
                placeholder="Add supplier..."
                searchPlaceholder={showAllSuppliers ? "Search all contacts..." : "Search pack suppliers..."}
                emptyResults={showAllSuppliers ? "No matching contacts" : "No more suppliers from this PO template"}
                className="w-56"
              />
              <div className="flex items-center gap-1.5">
                <Checkbox
                  id={`show-all-${task.id}`}
                  checked={showAllSuppliers}
                  onCheckedChange={() => onToggleShowAll()}
                  className="h-3.5 w-3.5"
                  title="Excludes price-only and person contacts"
                />
                <label
                  htmlFor={`show-all-${task.id}`}
                  className="text-xs text-muted-foreground cursor-pointer whitespace-nowrap"
                  title="Search all company and supplier contacts (excludes price-only and person contacts)"
                >
                  Show all contacts
                </label>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Supplier Row (enriched with email, contact link, person picker)
// ═══════════════════════════════════════════════════════════════════════════

interface SupplierRowProps {
  supplier: QuoteTemplateSupplier;
  onTogglePreferred: () => void;
  onRemove: () => void;
  onUpdateContactPerson: (contactPersonId: number | null) => void;
}

function SupplierRow({ supplier, onTogglePreferred, onRemove, onUpdateContactPerson }: SupplierRowProps) {
  const [personItems, setPersonItems] = useState<ComboboxItem[]>([]);
  const [personLoading, setPersonLoading] = useState(false);
  const [personLoaded, setPersonLoaded] = useState(false);

  const loadContactPersons = useCallback(async () => {
    if (personLoaded || !supplier.supplierId) return;
    try {
      setPersonLoading(true);
      const response = await api.get<{
        success: boolean;
        contact_persons: Array<{
          id: number;
          first_name: string | null;
          last_name: string | null;
          email: string | null;
        }>;
      }>(`/api/v1/contacts/${supplier.supplierId}/contact_persons`);
      const persons = response?.contact_persons || [];
      setPersonItems(
        persons.map((p) => {
          const name = [p.first_name, p.last_name].filter(Boolean).join(" ") || `Person #${p.id}`;
          return {
            id: String(p.id),
            label: p.email ? `${name} (${p.email})` : name,
          };
        })
      );
      setPersonLoaded(true);
    } catch {
      // Silently fail — picker shows empty
    } finally {
      setPersonLoading(false);
    }
  }, [supplier.supplierId, personLoaded]);

  // Build selectedItem for ComboboxDropdown
  const selectedPersonItem: ComboboxItem | undefined = supplier.contactPersonId
    ? personItems.find((p) => p.id === String(supplier.contactPersonId)) || {
        id: String(supplier.contactPersonId),
        label: supplier.contactPersonName || `Person #${supplier.contactPersonId}`,
      }
    : undefined;

  const displayEmail = supplier.contactPersonEmail || supplier.supplierEmail;

  return (
    <div className="px-2 py-1.5 rounded hover:bg-muted/50 group">
      {/* Line 1: Star | Name (linked) | Person picker | Preferred | Delete */}
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            "h-5 w-5 shrink-0",
            supplier.isPreferred ? "text-yellow-500" : "text-muted-foreground/30"
          )}
          title={supplier.isPreferred ? "Preferred supplier" : "Set as preferred"}
          onClick={onTogglePreferred}
        >
          <Star className={cn("h-3.5 w-3.5", supplier.isPreferred && "fill-current")} />
        </Button>

        <Link
          href={`/contacts/${supplier.supplierId}`}
          target="_blank"
          className="text-sm font-medium text-foreground hover:text-primary hover:underline truncate shrink-0"
          onClick={(e) => e.stopPropagation()}
          title={`Open ${supplier.supplierName || "supplier"} in new tab`}
        >
          {supplier.supplierName || `Supplier #${supplier.supplierId}`}
          <ExternalLink className="inline h-3 w-3 ml-1 opacity-0 group-hover:opacity-50" />
        </Link>

        {displayEmail && (
          <span className="text-xs text-muted-foreground truncate" title={displayEmail}>
            {displayEmail}
          </span>
        )}

        <div className="flex-1" />

        {/* Contact person picker — lazy loads on first interaction */}
        <ComboboxDropdown
          items={personItems}
          selectedItem={selectedPersonItem}
          onSelect={(item) => onUpdateContactPerson(Number(item.id))}
          onInputChange={() => loadContactPersons()}
          isLoading={personLoading}
          placeholder="Select person..."
          searchPlaceholder="Search people..."
          emptyResults={personLoaded ? "No people at this contact" : "Loading..."}
          className="w-48"
          clearable={!!supplier.contactPersonId}
          onClear={() => onUpdateContactPerson(null)}
        />

        {supplier.isPreferred && (
          <Badge variant="outline" className="text-xs text-yellow-600 dark:text-yellow-400 border-yellow-300 dark:border-yellow-700 shrink-0">
            Preferred
          </Badge>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="h-5 w-5 opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive shrink-0"
          onClick={onRemove}
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}
