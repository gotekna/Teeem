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
  Receipt,
  ChevronRight,
  FileStack,
  GripVertical,
} from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

// Types matching backend JSON response
interface TemplateLine {
  id: number;
  name: string;
  percentage: number;
  sequenceOrder: number;
  description: string | null;
  retainagePercentage: number | null;
  matchKeywords: string | null;
  overheadPoName: string | null;
}

interface ClaimTemplate {
  id: number;
  name: string;
  description: string | null;
  isActive: boolean;
  position: number;
  defaultRetainagePct: number | null;
  lineCount: number;
  totalPercentage: number;
  percentagesValid: boolean;
  createdAt: string;
  updatedAt: string;
  lines: TemplateLine[];
}

// Editing state for lines within the dialog
interface EditingLine {
  id?: number;
  name: string;
  percentage: string;
  description: string;
  retainagePercentage: string;
  matchKeywords: string;
  overheadPoName: string;
  _destroy?: boolean;
}

export function ClaimTemplatesTab() {
  const [templates, setTemplates] = useState<ClaimTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedTemplate, setExpandedTemplate] = useState<number | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<ClaimTemplate | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editDefaultRetainage, setEditDefaultRetainage] = useState("");
  const [editLines, setEditLines] = useState<EditingLine[]>([]);
  const [saving, setSaving] = useState(false);

  const loadTemplates = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.get<{ success: boolean; data: ClaimTemplate[] }>(
        "/api/v1/claim_stage_templates"
      );
      const data = response?.data || [];
      setTemplates(data);
    } catch (err) {
      console.error("[ClaimTemplatesTab] Failed to load:", err);
      toast.error("Failed to load claim templates");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  const handleExpandTemplate = (templateId: number) => {
    setExpandedTemplate(expandedTemplate === templateId ? null : templateId);
  };

  const handleNewTemplate = () => {
    setEditingTemplate(null);
    setEditName("");
    setEditDescription("");
    setEditDefaultRetainage("");
    setEditLines([
      { name: "", percentage: "", description: "", retainagePercentage: "", matchKeywords: "", overheadPoName: "" },
    ]);
    setShowEditDialog(true);
  };

  const handleEditTemplate = (template: ClaimTemplate) => {
    setEditingTemplate(template);
    setEditName(template.name);
    setEditDescription(template.description || "");
    setEditDefaultRetainage(template.defaultRetainagePct?.toString() || "");
    setEditLines(
      template.lines.map((line) => ({
        id: line.id,
        name: line.name,
        percentage: line.percentage.toString(),
        description: line.description || "",
        retainagePercentage: line.retainagePercentage?.toString() || "",
        matchKeywords: line.matchKeywords || "",
        overheadPoName: line.overheadPoName || "",
      }))
    );
    setShowEditDialog(true);
  };

  const handleAddLine = () => {
    setEditLines((prev) => [
      ...prev,
      { name: "", percentage: "", description: "", retainagePercentage: "", matchKeywords: "", overheadPoName: "" },
    ]);
  };

  const handleRemoveLine = (index: number) => {
    setEditLines((prev) => {
      const line = prev[index];
      if (line.id) {
        // Mark existing line for destruction
        return prev.map((l, i) => (i === index ? { ...l, _destroy: true } : l));
      }
      // Remove new line entirely
      return prev.filter((_, i) => i !== index);
    });
  };

  const handleUpdateLine = (index: number, field: keyof EditingLine, value: string) => {
    setEditLines((prev) =>
      prev.map((line, i) => (i === index ? { ...line, [field]: value } : line))
    );
  };

  const editTotalPercentage = editLines
    .filter((l) => !l._destroy)
    .reduce((sum, l) => sum + (parseFloat(l.percentage) || 0), 0);

  const handleSaveTemplate = async () => {
    if (!editName.trim()) return;

    const activeLines = editLines.filter((l) => !l._destroy);
    if (activeLines.length === 0) {
      toast.error("At least one stage is required");
      return;
    }

    const hasEmptyNames = activeLines.some((l) => !l.name.trim());
    if (hasEmptyNames) {
      toast.error("All stages must have a name");
      return;
    }

    const hasEmptyPercentages = activeLines.some(
      (l) => !l.percentage || parseFloat(l.percentage) <= 0
    );
    if (hasEmptyPercentages) {
      toast.error("All stages must have a percentage > 0");
      return;
    }

    try {
      setSaving(true);
      const payload = {
        claim_stage_template: {
          name: editName,
          description: editDescription || null,
          default_retainage_pct: editDefaultRetainage ? parseFloat(editDefaultRetainage) : null,
          lines_attributes: editLines.map((line, idx) => ({
            ...(line.id ? { id: line.id } : {}),
            name: line.name,
            percentage: parseFloat(line.percentage) || 0,
            sequence_order: idx + 1,
            description: line.description || null,
            retainage_percentage: line.retainagePercentage
              ? parseFloat(line.retainagePercentage)
              : null,
            match_keywords: line.matchKeywords || null,
            overhead_po_name: line.overheadPoName || null,
            ...(line._destroy ? { _destroy: true } : {}),
          })),
        },
      };

      if (editingTemplate) {
        await api.patch(`/api/v1/claim_stage_templates/${editingTemplate.id}`, payload);
        toast.success("Template updated");
      } else {
        await api.post("/api/v1/claim_stage_templates", payload);
        toast.success("Template created");
      }
      setShowEditDialog(false);
      loadTemplates();
    } catch (err) {
      console.error("Failed to save template:", err);
      toast.error("Failed to save template");
    } finally {
      setSaving(false);
    }
  };

  const handleDuplicate = async (templateId: number) => {
    try {
      await api.post(`/api/v1/claim_stage_templates/${templateId}/duplicate`);
      toast.success("Template duplicated");
      loadTemplates();
    } catch (err) {
      console.error("Failed to duplicate:", err);
      toast.error("Failed to duplicate template");
    }
  };

  const handleDelete = async (templateId: number) => {
    try {
      await api.delete(`/api/v1/claim_stage_templates/${templateId}`);
      toast.success("Template deactivated");
      loadTemplates();
    } catch (err) {
      console.error("Failed to delete:", err);
      toast.error("Failed to delete template");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner size={24} />
        <span className="ml-2 text-muted-foreground">Loading claim templates...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Claim Stage Templates</h3>
          <p className="text-sm text-muted-foreground">
            Define progress claim templates to apply to jobs. Each template defines stages with percentage splits.
          </p>
        </div>
        <Button size="sm" onClick={handleNewTemplate} className="gap-1">
          <Plus className="h-4 w-4" />
          New Template
        </Button>
      </div>

      {templates.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <FileStack className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>No claim templates yet.</p>
            <p className="text-sm mt-1">
              Create a template to define standard claim stages for your jobs.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {templates.map((template) => (
            <Card key={template.id} className={cn(!template.isActive && "opacity-60")}>
              <CardHeader
                className="py-3 px-4 cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => handleExpandTemplate(template.id)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <ChevronRight
                      className={cn(
                        "h-4 w-4 transition-transform",
                        expandedTemplate === template.id && "rotate-90"
                      )}
                    />
                    <Receipt className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <CardTitle className="text-base">{template.name}</CardTitle>
                      {template.description && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {template.description}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant="secondary" className="text-xs">
                      {template.lineCount} stages
                    </Badge>
                    <Badge
                      variant={template.percentagesValid ? "default" : "outline"}
                      className={cn(
                        "text-xs font-mono",
                        template.percentagesValid
                          ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                          : "border-amber-500 text-amber-600 dark:text-amber-400"
                      )}
                    >
                      {template.totalPercentage}%
                    </Badge>
                    <div
                      className="flex items-center gap-1"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => handleEditTemplate(template)}
                        title="Edit template"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => handleDuplicate(template.id)}
                        title="Duplicate template"
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={() => handleDelete(template.id)}
                        title="Deactivate template"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              </CardHeader>

              {expandedTemplate === template.id && (
                <CardContent className="pt-0 pb-3 px-4">
                  <div className="border rounded-md">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-12">#</TableHead>
                          <TableHead>Stage Name</TableHead>
                          <TableHead className="text-right w-24">%</TableHead>
                          <TableHead className="w-40">Description</TableHead>
                          <TableHead className="w-40">Match Keywords</TableHead>
                          <TableHead className="w-40">Overhead PO</TableHead>
                          {template.lines.some((l) => l.retainagePercentage && l.retainagePercentage > 0) && (
                            <TableHead className="text-right w-24">Retainage %</TableHead>
                          )}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {template.lines.map((line) => (
                          <TableRow key={line.id}>
                            <TableCell className="text-muted-foreground text-xs">
                              {line.sequenceOrder}
                            </TableCell>
                            <TableCell className="font-medium text-sm">
                              {line.name}
                            </TableCell>
                            <TableCell className="text-right text-sm font-mono">
                              {line.percentage}%
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {line.description || ""}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground font-mono">
                              {line.matchKeywords || ""}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {line.overheadPoName || ""}
                            </TableCell>
                            {template.lines.some((l) => l.retainagePercentage && l.retainagePercentage > 0) && (
                              <TableCell className="text-right text-sm font-mono">
                                {line.retainagePercentage ? `${line.retainagePercentage}%` : ""}
                              </TableCell>
                            )}
                          </TableRow>
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

      {/* Edit/Create Template Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="sm:max-w-[600px] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingTemplate ? "Edit Claim Template" : "New Claim Template"}
            </DialogTitle>
            <DialogDescription>
              {editingTemplate
                ? "Update the template name and claim stages."
                : "Create a new claim stage template. Define stages with percentage splits that add to 100%."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="e.g., 5-Stage Residential"
                />
              </div>
              <div className="space-y-2">
                <Label>Default Retainage %</Label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  step="0.5"
                  value={editDefaultRetainage}
                  onChange={(e) => setEditDefaultRetainage(e.target.value)}
                  placeholder="0"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Input
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                placeholder="Optional description..."
              />
            </div>

            {/* Stages editor */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Stages</Label>
                <div className="flex items-center gap-2">
                  <Badge
                    variant={Math.abs(editTotalPercentage - 100) < 0.01 ? "default" : "outline"}
                    className={cn(
                      "text-xs font-mono",
                      Math.abs(editTotalPercentage - 100) < 0.01
                        ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                        : "border-amber-500 text-amber-600 dark:text-amber-400"
                    )}
                  >
                    Total: {editTotalPercentage.toFixed(1)}%
                  </Badge>
                </div>
              </div>
              <div className="border rounded-md divide-y">
                {editLines.map((line, index) =>
                  line._destroy ? null : (
                    <div key={line.id || `new-${index}`} className="flex items-center gap-2 p-2">
                      <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />
                      <Input
                        value={line.name}
                        onChange={(e) => handleUpdateLine(index, "name", e.target.value)}
                        placeholder="Stage name"
                        className="flex-1 h-8 text-sm"
                      />
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        step="0.5"
                        value={line.percentage}
                        onChange={(e) => handleUpdateLine(index, "percentage", e.target.value)}
                        placeholder="%"
                        className="w-20 h-8 text-sm text-right font-mono"
                      />
                      <Input
                        value={line.description}
                        onChange={(e) => handleUpdateLine(index, "description", e.target.value)}
                        placeholder="Description"
                        className="w-32 h-8 text-sm"
                      />
                      <Input
                        value={line.matchKeywords}
                        onChange={(e) => handleUpdateLine(index, "matchKeywords", e.target.value)}
                        placeholder="Keywords"
                        title="Comma-separated keywords for auto-matching Xero invoices (e.g., lock,lockup,enclosed)"
                        className="w-36 h-8 text-sm text-muted-foreground"
                      />
                      <Input
                        value={line.overheadPoName}
                        onChange={(e) => handleUpdateLine(index, "overheadPoName", e.target.value)}
                        placeholder="Overhead PO"
                        title="SM template task name to map this stage's % as the overhead split (e.g., Pay Overhead Slab)"
                        className="w-36 h-8 text-sm text-muted-foreground"
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 shrink-0 text-destructive hover:text-destructive"
                        onClick={() => handleRemoveLine(index)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )
                )}
                <div className="p-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleAddLine}
                    className="gap-1 text-xs w-full"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add Stage
                  </Button>
                </div>
              </div>
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
            <Button onClick={handleSaveTemplate} disabled={saving || !editName.trim()}>
              {saving ? <Spinner size={16} className="mr-2" /> : null}
              {editingTemplate ? "Save" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
