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
  tradeCount: number;
  supplierCount: number;
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

  // Delete confirmation
  const [deleteId, setDeleteId] = useState<number | null>(null);

  // Lookup data (lazy loaded)
  const [taskItems, setTaskItems] = useState<ComboboxItem[]>([]);
  const [tasksLoaded, setTasksLoaded] = useState(false);
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

  // Load PO Tasks (SmScheduleMaster records that require POs)
  const loadTasks = useCallback(async () => {
    if (tasksLoaded) return;
    try {
      const response = await api.get<{ success: boolean; data: { records: Array<{ id: number; values: Record<string, unknown> }> } }>(
        "/api/v1/foundations/sm-schedule-master/records?per_page=500&filters=" +
        encodeURIComponent(JSON.stringify([{ column: "po_required", operator: "=", value: "true" }]))
      );
      const records = response?.data?.records || [];
      setTaskItems(records.map(r => ({
        id: String(r.id),
        label: (r.values?.name as string) || `Task ${r.id}`,
      })));
      setTasksLoaded(true);
    } catch (err) {
      console.error("[QuoteTemplatesTab] Failed to load PO tasks:", err);
    }
  }, [tasksLoaded]);

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
  // Task Management (within expanded template)
  // ─────────────────────────────────────────────────────────────────────────

  const handleAddTask = async (templateId: number, smScheduleMasterId: number) => {
    if (!editingTemplate) return;
    try {
      setSaving(true);
      const existingTasks = editingTemplate.trades || [];
      const maxPosition = existingTasks.reduce((max, t) => Math.max(max, t.position), -1);

      await api.patch(`/api/v1/quote_templates/${templateId}`, {
        quote_template: {
          quote_template_trades_attributes: [
            { sm_schedule_master_id: smScheduleMasterId, position: maxPosition + 1 },
          ],
        },
      });
      toast.success("PO Task added");
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

  // ─────────────────────────────────────────────────────────────────────────
  // Expand/Collapse
  // ─────────────────────────────────────────────────────────────────────────

  const handleToggleExpand = async (id: number) => {
    if (expandedId === id) {
      setExpandedId(null);
      setEditingTemplate(null);
    } else {
      setExpandedId(id);
      loadTasks();
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
            Define PO tasks and preferred suppliers for RFQ workflows
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
            <p className="text-sm mt-1">Create a template to define PO tasks and suppliers for RFQ workflows</p>
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
                    taskItems={taskItems}
                    supplierItems={supplierItems}
                    supplierSearchLoading={supplierSearchLoading}
                    saving={saving}
                    onAddTask={(taskId) => handleAddTask(template.id, taskId)}
                    onRemoveTask={(taskRowId) => handleRemoveTask(template.id, taskRowId)}
                    onUpdateInstructions={(taskRowId, instructions) =>
                      handleUpdateTaskInstructions(template.id, taskRowId, instructions)
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
                ? "Create a template to define PO tasks and suppliers for RFQ workflows"
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
  taskItems: ComboboxItem[];
  supplierItems: ComboboxItem[];
  supplierSearchLoading: boolean;
  saving: boolean;
  onAddTask: (smScheduleMasterId: number) => void;
  onRemoveTask: (taskRowId: number) => void;
  onUpdateInstructions: (taskRowId: number, instructions: string) => void;
  onAddSupplier: (taskRowId: number, supplierId: number) => void;
  onRemoveSupplier: (taskRowId: number, supplierRowId: number) => void;
  onTogglePreferred: (taskRowId: number, supplierRow: QuoteTemplateSupplier) => void;
  onSearchSuppliers: (query?: string) => void;
}

function TemplateEditor({
  template,
  taskItems,
  supplierItems,
  supplierSearchLoading,
  saving,
  onAddTask,
  onRemoveTask,
  onUpdateInstructions,
  onAddSupplier,
  onRemoveSupplier,
  onTogglePreferred,
  onSearchSuppliers,
}: TemplateEditorProps) {
  const templateTasks = template.trades || [];

  // Filter tasks not already in template
  const usedTaskIds = new Set(templateTasks.map(t => String(t.smScheduleMasterId)));
  const availableTaskItems = taskItems.filter(t => !usedTaskIds.has(t.id));

  return (
    <div className="space-y-4">
      {/* Tasks List */}
      {templateTasks.length === 0 ? (
        <p className="text-sm text-muted-foreground py-2">
          No PO tasks added yet. Add a PO task to start building this template.
        </p>
      ) : (
        <div className="space-y-3">
          {templateTasks.map((task) => (
            <TaskSection
              key={task.id}
              task={task}
              supplierItems={supplierItems}
              supplierSearchLoading={supplierSearchLoading}
              onRemove={() => onRemoveTask(task.id)}
              onUpdateInstructions={(instructions) => onUpdateInstructions(task.id, instructions)}
              onAddSupplier={(supplierId) => onAddSupplier(task.id, supplierId)}
              onRemoveSupplier={(supplierRowId) => onRemoveSupplier(task.id, supplierRowId)}
              onTogglePreferred={(supplierRow) => onTogglePreferred(task.id, supplierRow)}
              onSearchSuppliers={onSearchSuppliers}
            />
          ))}
        </div>
      )}

      {/* Add Task */}
      <div className="flex items-center gap-2 pt-2">
        <ComboboxDropdown
          items={availableTaskItems}
          onSelect={(item) => onAddTask(Number(item.id))}
          placeholder="Add PO task..."
          searchPlaceholder="Search PO tasks..."
          emptyResults="No PO tasks available"
          className="w-64"
        />
        {saving && <Spinner className="h-4 w-4" />}
      </div>
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
  onRemove: () => void;
  onUpdateInstructions: (instructions: string) => void;
  onAddSupplier: (supplierId: number) => void;
  onRemoveSupplier: (supplierRowId: number) => void;
  onTogglePreferred: (supplierRow: QuoteTemplateSupplier) => void;
  onSearchSuppliers: (query?: string) => void;
}

function TaskSection({
  task,
  supplierItems,
  supplierSearchLoading,
  onRemove,
  onUpdateInstructions,
  onAddSupplier,
  onRemoveSupplier,
  onTogglePreferred,
  onSearchSuppliers,
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
        <Badge variant="secondary" className="text-xs">
          {task.suppliers.length} {task.suppliers.length === 1 ? "supplier" : "suppliers"}
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

          {/* Suppliers List */}
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Suppliers</Label>
            {task.suppliers.length === 0 ? (
              <p className="text-xs text-muted-foreground py-1">No suppliers assigned</p>
            ) : (
              <div className="space-y-1">
                {task.suppliers.map((supplier) => (
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
