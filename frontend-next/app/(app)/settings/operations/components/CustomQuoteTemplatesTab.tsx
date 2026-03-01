"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import {
  Pencil,
  Trash2,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════

interface CustomQuoteTemplateSummary {
  id: number;
  name: string;
  description: string | null;
  isActive: boolean;
  position: number;
  poTemplatePackId: number | null;
  lineCount: number;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

interface TemplateTreeNode {
  id: number;
  name: string;
  quote_level: string;
  cost_centre_id: number | null;
  sm_schedule_master_id: number | null;
  tender_description: string | null;
  po_description: string | null;
  default_instructions: string | null;
  default_supplier_ids: number[];
  budget_amount: number | null;
  position: number;
  children: TemplateTreeNode[];
}

interface CustomQuoteTemplateDetail extends CustomQuoteTemplateSummary {
  tree: TemplateTreeNode[];
}

// ═══════════════════════════════════════════════════════════════════════════
// Component
// ═══════════════════════════════════════════════════════════════════════════

export function CustomQuoteTemplatesTab() {
  const [templates, setTemplates] = useState<CustomQuoteTemplateSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [expandedDetail, setExpandedDetail] = useState<CustomQuoteTemplateDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [renameDialog, setRenameDialog] = useState<{ id: number; name: string } | null>(null);
  const [renameName, setRenameName] = useState("");

  const handleUpdateLine = useCallback(async (lineId: number, field: string, value: unknown) => {
    try {
      await api.patch(`/api/v1/custom_quote_template_lines/${lineId}`, { [field]: value });
      // Refresh the expanded detail
      if (expandedId && expandedDetail) {
        const res = await api.get<{ success: boolean; data: CustomQuoteTemplateDetail }>(
          `/api/v1/custom_quote_templates/${expandedId}`
        );
        if (res?.data) setExpandedDetail(res.data);
      }
    } catch (err) {
      console.error("[CustomQuoteTemplatesTab] update line error:", err);
      toast.error("Failed to update line");
    }
  }, [expandedId, expandedDetail]);

  const fetchTemplates = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get<{ success: boolean; data: CustomQuoteTemplateSummary[] }>(
        "/api/v1/custom_quote_templates"
      );
      if (res?.data) setTemplates(res.data);
    } catch (err) {
      console.error("[CustomQuoteTemplatesTab] fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  const handleToggleExpand = useCallback(async (id: number) => {
    if (expandedId === id) {
      setExpandedId(null);
      setExpandedDetail(null);
      return;
    }
    setExpandedId(id);
    setLoadingDetail(true);
    try {
      const res = await api.get<{ success: boolean; data: CustomQuoteTemplateDetail }>(
        `/api/v1/custom_quote_templates/${id}`
      );
      if (res?.data) setExpandedDetail(res.data);
    } catch (err) {
      console.error("[CustomQuoteTemplatesTab] fetch detail error:", err);
    } finally {
      setLoadingDetail(false);
    }
  }, [expandedId]);

  const handleDelete = useCallback(async (id: number, name: string) => {
    if (!window.confirm(`Delete template "${name}"? This cannot be undone.`)) return;
    try {
      await api.delete(`/api/v1/custom_quote_templates/${id}`);
      toast.success(`Deleted "${name}"`);
      await fetchTemplates();
      if (expandedId === id) {
        setExpandedId(null);
        setExpandedDetail(null);
      }
    } catch (err) {
      console.error("[CustomQuoteTemplatesTab] delete error:", err);
      toast.error("Failed to delete template");
    }
  }, [fetchTemplates, expandedId]);

  const handleRename = useCallback(async () => {
    if (!renameDialog || !renameName.trim()) return;
    try {
      await api.patch(`/api/v1/custom_quote_templates/${renameDialog.id}`, {
        name: renameName.trim(),
      });
      toast.success("Template renamed");
      setRenameDialog(null);
      await fetchTemplates();
    } catch (err) {
      console.error("[CustomQuoteTemplatesTab] rename error:", err);
      toast.error("Failed to rename template");
    }
  }, [renameDialog, renameName, fetchTemplates]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Custom Quote Templates</h3>
          <p className="text-sm text-muted-foreground">
            Templates saved from Custom Quotes on jobs. Use these to quickly set up CC/PO trees.
          </p>
        </div>
      </div>

      {templates.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <p className="text-lg font-medium">No custom quote templates yet</p>
          <p className="text-sm mt-1">
            Save a template from any job&apos;s Custom Quotes tab to see it here.
          </p>
        </div>
      ) : (
        <div className="border rounded-lg divide-y">
          {templates.map((t) => (
            <div key={t.id}>
              {/* Template row */}
              <div className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50">
                <button
                  className="shrink-0"
                  onClick={() => handleToggleExpand(t.id)}
                >
                  {expandedId === t.id ? (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  )}
                </button>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium truncate">{t.name}</span>
                    {!t.isActive && (
                      <Badge variant="secondary" className="text-xs">Inactive</Badge>
                    )}
                  </div>
                  {t.description && (
                    <p className="text-sm text-muted-foreground truncate">{t.description}</p>
                  )}
                </div>

                <Badge variant="outline" className="shrink-0">
                  {t.lineCount} lines
                </Badge>

                {t.createdBy && (
                  <span className="text-xs text-muted-foreground shrink-0">
                    by {t.createdBy}
                  </span>
                )}

                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8"
                    onClick={() => {
                      setRenameDialog({ id: t.id, name: t.name });
                      setRenameName(t.name);
                    }}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    onClick={() => handleDelete(t.id, t.name)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Expanded tree */}
              {expandedId === t.id && (
                <div className="px-4 pb-4 bg-muted/30">
                  {loadingDetail ? (
                    <div className="flex items-center justify-center py-6">
                      <Spinner className="h-5 w-5" />
                    </div>
                  ) : expandedDetail ? (
                    <div className="ml-8 space-y-1 pt-2">
                      {expandedDetail.tree.length === 0 ? (
                        <p className="text-sm text-muted-foreground italic">No lines in this template</p>
                      ) : (
                        expandedDetail.tree.map((cc) => (
                          <TemplateTreeRow key={cc.id} node={cc} depth={0} onUpdateLine={handleUpdateLine} />
                        ))
                      )}
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Rename Dialog */}
      <Dialog open={!!renameDialog} onOpenChange={(o) => !o && setRenameDialog(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Rename Template</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="template-name">Name</Label>
            <Input
              id="template-name"
              value={renameName}
              onChange={(e) => setRenameName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleRename()}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameDialog(null)}>Cancel</Button>
            <Button onClick={handleRename} disabled={!renameName.trim()}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Tree row
// ═══════════════════════════════════════════════════════════════════════════

function TemplateTreeRow({ node, depth, onUpdateLine }: {
  node: TemplateTreeNode;
  depth: number;
  onUpdateLine: (lineId: number, field: string, value: unknown) => void;
}) {
  const isCC = depth === 0;
  const hasDetails = node.tender_description || node.po_description || node.default_instructions;

  return (
    <>
      <div
        className="py-1.5 text-sm border-b border-border/50 last:border-b-0"
        style={{ paddingLeft: `${depth * 24}px` }}
      >
        <div className="flex items-center gap-2">
          <Badge variant={isCC ? "default" : "outline"} className="text-xs shrink-0">
            {isCC ? "CC" : "PO"}
          </Badge>
          <span className={isCC ? "font-medium flex-1" : "flex-1"}>{node.name}</span>
          {isCC && node.quote_level && (
            <Badge variant="secondary" className="text-xs">
              {node.quote_level === "cost_centre" ? "Quote at CC" : "Quote at PO"}
            </Badge>
          )}
          {node.default_supplier_ids && node.default_supplier_ids.length > 0 && (
            <span className="text-xs text-muted-foreground">
              {node.default_supplier_ids.length} supplier{node.default_supplier_ids.length !== 1 ? "s" : ""}
            </span>
          )}
          <InlinePrice
            lineId={node.id}
            value={node.budget_amount}
            onSave={(val) => onUpdateLine(node.id, "budget_amount", val)}
          />
        </div>
        {hasDetails && (
          <div className="ml-12 mt-0.5 space-y-0.5">
            {node.tender_description && (
              <p className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground/70">Tender:</span> {node.tender_description}
              </p>
            )}
            {node.po_description && (
              <p className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground/70">PO:</span> {node.po_description}
              </p>
            )}
            {node.default_instructions && (
              <p className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground/70">RFQ Instructions:</span> {node.default_instructions}
              </p>
            )}
          </div>
        )}
      </div>
      {node.children?.map((child) => (
        <TemplateTreeRow key={child.id} node={child} depth={depth + 1} onUpdateLine={onUpdateLine} />
      ))}
    </>
  );
}

/** Inline editable price — click to edit, blur/enter to save */
function InlinePrice({ lineId, value, onSave }: {
  lineId: number;
  value: number | null;
  onSave: (val: number | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  const startEdit = () => {
    setDraft(value ? String(value) : "");
    setEditing(true);
  };

  const save = () => {
    setEditing(false);
    const num = parseFloat(draft);
    const newVal = isNaN(num) ? null : num;
    if (newVal !== value) onSave(newVal);
  };

  if (editing) {
    return (
      <div className="flex items-center gap-1 shrink-0">
        <span className="text-xs text-muted-foreground">$</span>
        <input
          type="number"
          className="w-24 h-6 text-xs text-right border rounded px-1 bg-background"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={save}
          onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") setEditing(false); }}
          autoFocus
        />
      </div>
    );
  }

  return (
    <button
      onClick={startEdit}
      className="shrink-0 text-xs font-mono tabular-nums px-2 py-0.5 rounded hover:bg-muted min-w-[80px] text-right"
      title="Click to set PC price"
    >
      {value ? `$${value.toLocaleString("en-AU", { minimumFractionDigits: 2 })}` : (
        <span className="text-muted-foreground italic">Set price</span>
      )}
    </button>
  );
}
