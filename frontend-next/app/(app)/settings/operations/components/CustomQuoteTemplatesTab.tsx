"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Pencil,
  Trash2,
  ChevronDown,
  ChevronRight,
  ChevronsDownUp,
  ChevronsUpDown,
  Search,
  RefreshCw,
  Link2Off,
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
// SSoT: Use the SAME components as the job Custom Quotes page
import { CostCentreSection } from "@/components/jobs/custom-quotes/CostCentreSection";
import type { CustomQuoteLineNode, QuoteLevel } from "@/components/jobs/custom-quotes/types";

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
  syncStatus?: { syncedTenants: string[] } | null;
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
  document_type_ids: number[];
  budget_amount: number | null;
  position: number;
  children: TemplateTreeNode[];
}

interface CustomQuoteTemplateDetail extends CustomQuoteTemplateSummary {
  tree: TemplateTreeNode[];
}

// ═══════════════════════════════════════════════════════════════════════════
// Map template tree → job CustomQuoteLineNode (SSoT type)
// ═══════════════════════════════════════════════════════════════════════════

function mapTemplateToLineNode(node: TemplateTreeNode): CustomQuoteLineNode {
  return {
    id: node.id,
    name: node.name,
    quoteLevel: node.quote_level as QuoteLevel,
    costCentreId: node.cost_centre_id,
    smScheduleMasterId: node.sm_schedule_master_id,
    smTaskId: null,
    documentTypeIds: node.document_type_ids || [],
    documentTypeNames: [],
    tenderDescription: node.tender_description,
    poDescription: node.po_description,
    rfqInstructions: node.default_instructions,
    budgetAmount: node.budget_amount,
    position: node.position,
    suppliers: [],
    defaultSupplierIds: node.default_supplier_ids || [],
    children: node.children.map(mapTemplateToLineNode),
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Main Component
// ═══════════════════════════════════════════════════════════════════════════

export function CustomQuoteTemplatesTab() {
  const [templates, setTemplates] = useState<CustomQuoteTemplateSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [expandedDetail, setExpandedDetail] = useState<CustomQuoteTemplateDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [renameDialog, setRenameDialog] = useState<{ id: number; name: string } | null>(null);
  const [renameName, setRenameName] = useState("");

  // Map field names: template uses default_instructions, job uses rfq_instructions
  const handleUpdateLine = useCallback(async (lineId: number, field: string, value: unknown) => {
    // Remap rfq_instructions → default_instructions for template API
    const apiField = field === "rfq_instructions" ? "default_instructions" : field;
    try {
      await api.patch(`/api/v1/custom_quote_template_lines/${lineId}`, { [apiField]: value });
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

  // Template uses handleUpdateLine for quote_level (not a separate endpoint)
  const handleToggleQuoteLevel = useCallback((lineId: number, level: QuoteLevel) => {
    handleUpdateLine(lineId, "quote_level", level);
  }, [handleUpdateLine]);

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
              {/* Template header row */}
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
                    {t.syncStatus?.syncedTenants && t.syncStatus.syncedTenants.length > 0 && (
                      <Badge className="text-xs bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 border-green-200 dark:border-green-800 shrink-0">
                        <RefreshCw className="h-3 w-3 mr-1" />
                        Synced: {t.syncStatus.syncedTenants.join(", ")}
                      </Badge>
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
                    className={`h-8 w-8 ${t.syncStatus?.syncedTenants?.length ? "text-muted-foreground cursor-not-allowed" : "text-destructive hover:text-destructive"}`}
                    title={t.syncStatus?.syncedTenants?.length ? "Synced — cannot delete" : "Delete"}
                    disabled={!!t.syncStatus?.syncedTenants?.length}
                    onClick={() => !t.syncStatus?.syncedTenants?.length && handleDelete(t.id, t.name)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Expanded template tree — uses SAME components as job Custom Quotes */}
              {expandedId === t.id && (
                <div className="bg-muted/20 border-t">
                  {loadingDetail ? (
                    <div className="flex items-center justify-center py-6">
                      <Spinner className="h-5 w-5" />
                    </div>
                  ) : expandedDetail ? (
                    <TemplateTreeView
                      tree={expandedDetail.tree}
                      onUpdateLine={handleUpdateLine}
                      onToggleQuoteLevel={handleToggleQuoteLevel}
                    />
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
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="template-name">Name</Label>
              <Input
                id="template-name"
                value={renameName}
                onChange={(e) => setRenameName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleRename()}
              />
            </div>

            {/* Sync status — always show in edit mode */}
            {(() => {
              const tmpl = renameDialog ? templates.find(x => x.id === renameDialog.id) : null;
              if (!tmpl) return null;
              const isSynced = !!tmpl.syncStatus?.syncedTenants?.length;
              return isSynced ? (
                <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <RefreshCw className="h-4 w-4 text-green-600 dark:text-green-400" />
                      <span className="text-sm font-medium text-green-800 dark:text-green-200">
                        Synced with {tmpl.syncStatus!.syncedTenants.join(", ")}
                      </span>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="text-destructive border-destructive/30 hover:bg-destructive/10"
                      onClick={async () => {
                        try {
                          await api.post("/api/v1/config_sync/toggle_record_sync", {
                            table_key: "custom_quote_templates", record_id: tmpl.id,
                          });
                          toast.success("Disconnected from sync");
                          setRenameDialog(null);
                          fetchTemplates();
                        } catch (err) {
                          console.error("[CustomQuoteTemplatesTab] disconnect error:", err);
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
              ) : (
                <div className="bg-muted/50 border rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Link2Off className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium text-muted-foreground">
                        Not synced — local only
                      </span>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        console.log("[CustomQuoteTemplatesTab] Connect clicked, id:", tmpl.id);
                        try {
                          const res = await api.post("/api/v1/config_sync/toggle_record_sync", {
                            table_key: "custom_quote_templates", record_id: tmpl.id,
                          });
                          console.log("[CustomQuoteTemplatesTab] Connect response:", res);
                          toast.success("Connected to sync");
                          setRenameDialog(null);
                          fetchTemplates();
                        } catch (err) {
                          console.error("[CustomQuoteTemplatesTab] connect error:", err);
                          toast.error("Failed to connect");
                        }
                      }}
                    >
                      <RefreshCw className="h-3.5 w-3.5 mr-1" />
                      Connect
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Connect to sync this template with other tenants via SM Sync.
                  </p>
                </div>
              );
            })()}
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
// Template Tree View (matches CustomQuoteTree toolbar + uses CostCentreSection)
// ═══════════════════════════════════════════════════════════════════════════

function TemplateTreeView({ tree, onUpdateLine, onToggleQuoteLevel }: {
  tree: TemplateTreeNode[];
  onUpdateLine: (lineId: number, field: string, value: unknown) => void;
  onToggleQuoteLevel: (lineId: number, level: QuoteLevel) => void;
}) {
  const [expandedCCs, setExpandedCCs] = useState<Set<number>>(new Set());
  const [ccSearch, setCcSearch] = useState("");

  const anyExpanded = expandedCCs.size > 0;

  const expandAllCCs = useCallback(() => {
    setExpandedCCs(new Set(tree.map((cc) => cc.id)));
  }, [tree]);

  const collapseAllCCs = useCallback(() => {
    setExpandedCCs(new Set());
  }, []);

  const toggleCCExpanded = useCallback((ccId: number) => {
    setExpandedCCs((prev) => {
      const next = new Set(prev);
      if (next.has(ccId)) next.delete(ccId);
      else next.add(ccId);
      return next;
    });
  }, []);

  const filteredTree = useMemo(() => {
    if (!ccSearch.trim()) return tree;
    const q = ccSearch.toLowerCase();
    return tree.filter((cc) =>
      cc.name.toLowerCase().includes(q) ||
      cc.children.some((child) => child.name.toLowerCase().includes(q))
    );
  }, [tree, ccSearch]);

  // Map template nodes to CustomQuoteLineNode for the shared components
  const mappedTree = useMemo(() =>
    filteredTree.map(mapTemplateToLineNode),
    [filteredTree]
  );

  if (tree.length === 0) {
    return (
      <div className="flex items-center justify-center py-8 text-muted-foreground">
        <p className="text-sm italic">No lines in this template</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {/* Toolbar — same as job Custom Quotes */}
      <div className="flex items-center gap-2 px-4 py-2 bg-muted/30 border-b">
        <button
          type="button"
          onClick={anyExpanded ? collapseAllCCs : expandAllCCs}
          className="shrink-0 px-2 py-0.5 text-[10px] rounded text-muted-foreground hover:text-foreground hover:bg-muted"
        >
          {anyExpanded ? (
            <>
              <ChevronsDownUp className="h-3 w-3 inline mr-0.5" />
              Collapse
            </>
          ) : (
            <>
              <ChevronsUpDown className="h-3 w-3 inline mr-0.5" />
              Expand
            </>
          )}
        </button>
        <div className="relative flex-1 min-w-0 max-w-xs">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
          <Input
            value={ccSearch}
            onChange={(e) => setCcSearch(e.target.value)}
            placeholder="Search cost centres..."
            className="h-7 pl-7 text-xs"
          />
        </div>
      </div>

      {/* CC Sections — uses the SAME CostCentreSection as job page */}
      {/* No supplier props passed = template mode (hides supplier UI) */}
      <div className="p-4 space-y-1">
        {mappedTree.map((ccLine) => (
          <CostCentreSection
            key={ccLine.id}
            line={ccLine}
            expanded={expandedCCs.has(ccLine.id)}
            onToggleExpanded={() => toggleCCExpanded(ccLine.id)}
            onToggleQuoteLevel={onToggleQuoteLevel}
            onUpdateLine={onUpdateLine}
          />
        ))}
      </div>
    </div>
  );
}
