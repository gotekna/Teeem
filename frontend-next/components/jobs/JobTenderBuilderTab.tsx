"use client";

import { useState, useEffect, useMemo, useCallback, useRef, Fragment } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import {
  RefreshCw, FileSignature, ChevronDown, ChevronRight, Check,
  Plus, Undo2, X, Camera, ImagePlus, Loader2, ChevronsDownUp, ChevronsUpDown,
  ExternalLink, Save, Search, Paperclip, Percent, RotateCcw, Pencil,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SupplierPicker, type Supplier } from "@/components/ui/supplier-picker";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/utils/formatters";
import type { BOQGroup } from "@/components/ui/bill-of-quantities";
import { PricebookItemEditor, PricebookLineSearch } from "@/components/ui/bill-of-quantities";
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
    hasPricebookImage: boolean;
    pricebookItemId: number | null;
    profitCentreId: number | null;
    profitCentreName: string | null;
  }>;
}

interface BOQData {
  success: boolean;
  job: { id: number; name: string; contract_value: number; job_code?: string };
  groups: BOQApiGroup[];
  profitCentres: Array<{ id: number; label: string }>;
  tenderMarkupPercent?: number;
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

/** Tender line classification */
type TenderClassification = "included" | "incl_qty" | "incl_hidden" | "excluded" | "pc" | "ps";

/** PO-level classification options */
type POClassification = "per_item" | "per_po_incl" | "per_po_incl_qty" | "per_po_nt" | "per_po_exc" | "per_po_pc" | "per_po_ps";

const CLASSIFICATION_LABELS: Record<TenderClassification, string> = {
  included: "Included",
  incl_qty: "Incl (Show Qty)",
  incl_hidden: "Incl (No Tender)",
  excluded: "Excluded",
  pc: "Prime Cost",
  ps: "Prov. Sum",
};

/** Strip common task name prefixes to get a clean tender description */
function cleanTaskName(taskName: string | null | undefined): string {
  if (!taskName) return "";
  return taskName
    .replace(/^Request\s+For\s+/i, "")
    .replace(/^Req\s+/i, "")
    .replace(/^Do\s+/i, "")
    .replace(/^Supply\s+(&|and)\s+Install\s+/i, "")
    .replace(/^Supply\s+/i, "")
    .replace(/^Install\s+/i, "")
    .replace(/^[-–—]\s*/, "") // strip leading dash left after prefix removal
    .trim();
}

/** Apply smart roundup to a sell price (matches backend apply_price_rounding "smart" mode) */
function applySmartRoundup(price: number): number {
  if (price <= 0) return price;
  const increment = price < 10 ? 0.1 : price < 100 ? 0.5 : price < 1000 ? 1.0 : 10.0;
  return Math.ceil(price / increment) * increment;
}

/** SmTask option for the "Add PO" modal task picker */
interface SmTaskOption {
  id: number;
  name: string;
  task_number: string | null;
  start_date: string | null;
  po_required: boolean;
  cost_centre: number | null;
  has_existing_po: boolean;
  existing_po_id: number | null;
}

/** A custom line item added by the user (not from a PO) */
interface NewTenderLine {
  tempId: string;
  poId: string | number;
  sectionName: string;
  headerName: string;
  description: string;
  quantity: number;
  unitPrice: number;
  pricebookItemId?: number | null;
  pricebookItemCode?: string | null;
  costCentreName?: string | null;
}

/** Tender tree section from /api/v1/tenders/tree */
interface TenderTreeSection {
  id: number;
  code: string;
  name: string;
  sortOrder: number;
  sectionType: string;
  defaultNote: string | null;
  description: string | null;
  attachedDocumentTypes: string[];
}
interface TenderTreeHeader {
  id: number;
  code: string;
  name: string;
  sortOrder: number;
  sectionType: string;
  defaultNote: string | null;
  description: string | null;
  headerType: "standard" | "pc_schedule" | "ps_schedule";
  systemLocked: boolean;
  children: TenderTreeSection[];
}

/** Unified row types: Header → Section → (Cost Centre) → PO → Items → PO Footer */
type UnifiedRow =
  | { type: "header"; name: string; subtotal: number; itemCount: number; headerType?: "standard" | "pc_schedule" | "ps_schedule" }
  | { type: "section"; name: string; headerName: string; subtotal: number; itemCount: number; poCount: number }
  | { type: "cost-centre"; name: string; headerName: string; sectionName: string }
  | {
      type: "po";
      poId: string | number;
      poName: string;
      supplierId: number | null | undefined;
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
      taskName: string | null | undefined;
      pricebookCode: string | null | undefined;
      hasPricebookImage: boolean;
      pricebookItemId: number | null | undefined;
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

function nextTempId(): string {
  return `new_${crypto.randomUUID()}`;
}

/** Serialize builder state (Maps/Sets → plain objects/arrays) for sending to backend */
function serializeBuilderState(opts: {
  itemClassifications: Map<string, TenderClassification>;
  poClassifications: Map<string | number, POClassification>;
  editOverrides: Map<string, ItemOverride>;
  newLines: NewTenderLine[];
  sectionNotes: Map<string, string>;
  ccSubtotalEnabled: Set<string>;
  groupByCostCentre: boolean;
  excludedIds: Set<string>;
  tenderMarkupPercent?: number;
  tenderMarkupOverride?: number | null;
}): Record<string, unknown> {
  return {
    itemClassifications: Object.fromEntries(opts.itemClassifications),
    poClassifications: Object.fromEntries(opts.poClassifications),
    editOverrides: Object.fromEntries(opts.editOverrides),
    newLines: opts.newLines,
    sectionNotes: Object.fromEntries(opts.sectionNotes),
    ccSubtotalEnabled: Array.from(opts.ccSubtotalEnabled),
    groupByCostCentre: opts.groupByCostCentre,
    excludedIds: Array.from(opts.excludedIds),
    tenderMarkupPercent: opts.tenderMarkupPercent,
    tenderMarkupOverride: opts.tenderMarkupOverride,
  };
}

/** Deserialize builder state (plain objects/arrays → Maps/Sets) from backend */
function deserializeBuilderState(state: Record<string, unknown>): {
  itemClassifications: Map<string, TenderClassification>;
  poClassifications: Map<string | number, POClassification>;
  editOverrides: Map<string, ItemOverride>;
  newLines: NewTenderLine[];
  sectionNotes: Map<string, string>;
  ccSubtotalEnabled: Set<string>;
  groupByCostCentre: boolean;
  excludedIds: Set<string>;
  tenderMarkupPercent?: number;
  tenderMarkupOverride?: number | null;
} | null {
  if (!state) return null;

  try {
    const itemCls = state.itemClassifications as Record<string, string> | undefined;
    const poCls = state.poClassifications as Record<string, string> | undefined;
    const overrides = state.editOverrides as Record<string, ItemOverride> | undefined;
    const lines = state.newLines as NewTenderLine[] | undefined;
    const notes = state.sectionNotes as Record<string, string> | undefined;
    const ccSub = state.ccSubtotalEnabled as string[] | undefined;
    const groupBy = state.groupByCostCentre as boolean | undefined;
    const excluded = state.excludedIds as string[] | undefined;

    return {
      itemClassifications: new Map(Object.entries(itemCls || {})) as Map<string, TenderClassification>,
      poClassifications: new Map(Object.entries(poCls || {})) as Map<string | number, POClassification>,
      editOverrides: new Map(Object.entries(overrides || {})),
      newLines: (lines || []).map((nl) => ({
        ...nl,
        tempId: nl.tempId || nextTempId(),
      })),
      sectionNotes: new Map(Object.entries(notes || {})),
      ccSubtotalEnabled: new Set(ccSub || []),
      groupByCostCentre: groupBy ?? true,
      excludedIds: new Set(excluded || []),
      tenderMarkupPercent: state.tenderMarkupPercent as number | undefined,
      tenderMarkupOverride: state.tenderMarkupOverride as number | null | undefined,
    };
  } catch (err) {
    console.error("Failed to deserialize builder state:", err);
    return null;
  }
}

// ─── Grouped structure for two-panel rendering ─────────────────────

type SectionGroup = {
  sectionRow: Extract<UnifiedRow, { type: "section" }>;
  contentRows: UnifiedRow[]; // po, item, po-footer rows
};
type HeaderGroup = {
  headerRow: Extract<UnifiedRow, { type: "header" }>;
  sections: SectionGroup[];
};

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
  const [savingBuilder, setSavingBuilder] = useState(false);
  const [collapsedHeaders, setCollapsedHeaders] = useState<Set<string>>(new Set());
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());
  const [collapsedCostCentres, setCollapsedCostCentres] = useState<Set<string>>(new Set());
  const [ccSubtotalEnabled, setCCSubtotalEnabled] = useState<Set<string>>(new Set());
  const [collapsedPOs, setCollapsedPOs] = useState<Set<string>>(new Set());

  // Grouping options
  const [groupByCostCentre, setGroupByCostCentre] = useState(true);
  const [showImages, setShowImages] = useState(true);

  // Tender markup — loaded from SM template default, user can override
  const [tenderMarkupPercent, setTenderMarkupPercent] = useState<number>(0);
  const [tenderMarkupOverride, setTenderMarkupOverride] = useState<number | null>(null);
  const [showMarkupEditor, setShowMarkupEditor] = useState(false);
  const [defaultMarkupPercent, setDefaultMarkupPercent] = useState<number>(0); // template default for reset

  // Editing state
  const [editOverrides, setEditOverrides] = useState<Map<string, ItemOverride>>(new Map());
  const [newLines, setNewLines] = useState<NewTenderLine[]>([]);
  const [searchingDescriptionKey, setSearchingDescriptionKey] = useState<string | null>(null);
  const [itemClassifications, setItemClassifications] = useState<Map<string, TenderClassification>>(new Map());
  const [poClassifications, setPOClassifications] = useState<Map<string | number, POClassification>>(new Map());

  // Tender tree (all headers/sections) and user-edited section notes
  const [tenderTree, setTenderTree] = useState<TenderTreeHeader[]>([]);
  const [sectionNotes, setSectionNotes] = useState<Map<string, string>>(new Map());
  // Excluded doc types per section: "sectionName::docTypeName" → excluded
  const [excludedDocTypes, setExcludedDocTypes] = useState<Set<string>>(new Set());
  // Attached job documents grouped by document type name
  interface TenderAttachedDoc {
    id: number;
    name: string;
    versionNumber: number;
    versionGroupId: number | null;
    isLatest: boolean;
    mimeType: string | null;
    fileSize: number | null;
    createdAt: string;
    updatedAt: string;
  }
  const [tenderAttachedDocs, setTenderAttachedDocs] = useState<Record<string, TenderAttachedDoc[]>>({});

  // Job claims for "Tender Fee Paid" section
  interface TenderJobClaim {
    id: number;
    invoice_number: string;
    description: string | null;
    amount: number;
    amount_paid: number;
    amount_due: number;
    status: string;
    date: string | null;
    due_date: string | null;
    contact_name: string | null;
    payment_percentage: number;
    outstanding_amount: number;
  }
  const [jobClaims, setJobClaims] = useState<TenderJobClaim[]>([]);

  // Image upload
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [uploadingImageForId, setUploadingImageForId] = useState<number | null>(null);

  // Add PO modal
  const [showAddPOModal, setShowAddPOModal] = useState(false);
  const [addPOContext, setAddPOContext] = useState<{ costCentreName: string; sectionName: string; tenderId: number | null }>({ costCentreName: "", sectionName: "", tenderId: null });
  const [sectionTasks, setSectionTasks] = useState<SmTaskOption[]>([]);
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [creatingPO, setCreatingPO] = useState(false);

  const hasEdits = editOverrides.size > 0 || newLines.length > 0;
  const editCount = editOverrides.size + newLines.length;

  useEffect(() => {
    loadBOQData();
    loadTenderTree();
    loadBuilderState();
    loadTenderAttachedDocs();
    loadJobClaims();
  }, [jobId]);

  const loadJobClaims = async () => {
    try {
      const response = await api.get<{ success: boolean; job_claims: TenderJobClaim[] }>(
        `/api/v1/jobs/${jobId}/job_claims`
      );
      if (response?.success && response.job_claims) {
        setJobClaims(response.job_claims);
      }
    } catch (err) {
      console.error("Failed to load job claims:", err);
    }
  };

  const loadTenderAttachedDocs = async () => {
    try {
      const response = await api.get<{ success: boolean; data: Record<string, TenderAttachedDoc[]> }>(
        `/api/v1/tenders/job_documents?job_id=${jobId}`
      );
      if (response?.success && response.data) {
        setTenderAttachedDocs(response.data);
      }
    } catch (err) {
      console.error("Failed to load tender attached documents:", err);
    }
  };

  const loadTenderTree = async () => {
    try {
      const response = await api.get<{ success: boolean; data: TenderTreeHeader[] }>("/api/v1/tenders/tree");
      if (response?.success && response.data) {
        setTenderTree(response.data);
      }
    } catch (err) {
      console.error("Failed to load tender tree:", err);
    }
  };

  /** Load previously saved builder state from the latest tender version */
  const loadBuilderState = async () => {
    try {
      const response = await api.get<{
        success: boolean;
        data: { builder_state: Record<string, unknown>; version: number; created_at: string } | null;
      }>(`/api/v1/jobs/${jobId}/tender_documents/latest_builder_state`);

      if (response?.success && response.data?.builder_state) {
        const restored = deserializeBuilderState(response.data.builder_state);
        if (restored) {
          setItemClassifications(restored.itemClassifications);
          setPOClassifications(restored.poClassifications);
          setEditOverrides(restored.editOverrides);
          setNewLines(restored.newLines);
          setSectionNotes(restored.sectionNotes);
          setCCSubtotalEnabled(restored.ccSubtotalEnabled);
          setGroupByCostCentre(restored.groupByCostCentre);
          setExcludedIds(restored.excludedIds);
          if (restored.tenderMarkupPercent !== undefined) setTenderMarkupPercent(restored.tenderMarkupPercent);
          if (restored.tenderMarkupOverride !== undefined) setTenderMarkupOverride(restored.tenderMarkupOverride);
          // Prevent auto-exclude-qty-0 from overriding restored state
          setAutoDefaultApplied(true);
          toast.success(`Restored builder state from Version ${response.data.version}`);
        }
      }
    } catch (err) {
      // Silently fail - fresh state is fine for first-time use
      console.debug("No saved builder state found:", err);
    }
  };

  const loadBOQData = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get<BOQData>(`/api/v1/jobs/${jobId}/boq`);
      if (response?.success) {
        setBOQData(response);
        // Load tender markup default from template (only set if not already overridden by restored state)
        const apiMarkup = response.tenderMarkupPercent ?? 0;
        setDefaultMarkupPercent(apiMarkup);
        setTenderMarkupPercent((prev) => prev === 0 ? apiMarkup : prev);
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

  /** Look up tender tree section data by section name */
  const tenderTreeSectionMap = useMemo(() => {
    const map = new Map<string, TenderTreeSection>();
    for (const header of tenderTree) {
      for (const section of header.children) {
        map.set(section.name, section);
      }
    }
    return map;
  }, [tenderTree]);

  // ─── Add PO handlers ──────────────────────────────────────────────

  const handleAddPO = useCallback(async (costCentreName: string, sectionName: string) => {
    setSelectedTaskId(null);
    setSelectedSupplier(null);
    setSectionTasks([]);

    // Parse cost centre code from label (e.g., "100" from "100 - SURVEYOR")
    const ccCode = costCentreName.split(/\s*[-–—]\s*/)[0]?.trim();

    // Look up tender section ID from the tender tree
    const tenderSection = tenderTreeSectionMap.get(sectionName);
    const tenderId = tenderSection?.id ?? null;

    setAddPOContext({ costCentreName, sectionName, tenderId });
    setShowAddPOModal(true);

    // Build filter params
    const params = new URLSearchParams({ for: "select" });
    if (ccCode) params.set("cost_centre_code", ccCode);
    if (tenderId) params.set("tender_id", String(tenderId));

    try {
      setLoadingTasks(true);
      const res = await api.get<{ success: boolean; sm_tasks: SmTaskOption[] }>(
        `/api/v1/jobs/${jobId}/sm_tasks?${params.toString()}`
      );
      const tasks = (res?.sm_tasks || []).filter((t) => t.po_required);
      setSectionTasks(tasks);
    } catch (err) {
      console.error("Failed to load tasks for section:", err);
    } finally {
      setLoadingTasks(false);
    }
  }, [jobId, tenderTreeSectionMap]);

  const handleCreatePO = useCallback(async (andOpen: boolean) => {
    if (!selectedTaskId || !selectedSupplier) return;

    try {
      setCreatingPO(true);
      const res = await api.post<{ success: boolean; purchase_order: { id: number } }>(
        `/api/v1/purchase_orders`,
        {
          purchase_order: {
            job_id: jobId,
            supplier_id: selectedSupplier.id,
            schedule_task_id: selectedTaskId,
            status: "draft",
          },
        }
      );

      if (res?.success) {
        toast.success("Purchase order created");
        setShowAddPOModal(false);
        if (andOpen && res.purchase_order?.id) {
          router.push(`/purchase_orders/${res.purchase_order.id}`);
        } else {
          await loadBOQData();
        }
      } else {
        toast.error("Failed to create purchase order");
      }
    } catch (err) {
      console.error("Failed to create PO:", err);
      toast.error("Failed to create purchase order");
    } finally {
      setCreatingPO(false);
    }
  }, [selectedTaskId, selectedSupplier, jobId, router]);

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
        hasPricebookImage: item.hasPricebookImage || false,
        pricebookItemId: item.pricebookItemId,
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

  /** Add a new custom line to a specific PO */
  const addNewLine = useCallback((poId: string | number, headerName: string, sectionName: string, costCentreName?: string | null) => {
    const tempId = nextTempId();
    setNewLines((prev) => [
      ...prev,
      { tempId, poId, sectionName, headerName, description: "", quantity: 1, unitPrice: 0, costCentreName: costCentreName || null },
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

  /** Set classification for a line item */
  const setClassification = useCallback((key: string, cls: TenderClassification) => {
    setItemClassifications((prev) => {
      const next = new Map(prev);
      if (cls === "included") {
        next.delete(key); // default is included, no need to store
      } else {
        next.set(key, cls);
      }
      return next;
    });
  }, []);

  /** Set classification at the PO level */
  const setPOClassification = useCallback((poId: string | number, cls: POClassification) => {
    setPOClassifications((prev) => {
      const next = new Map(prev);
      if (cls === "per_item") {
        next.delete(poId);
      } else {
        next.set(poId, cls);
      }
      return next;
    });
  }, []);

  /** Get PO-level classification (default: per_item) */
  const getPOClassification = useCallback((poId: string | number): POClassification => {
    return poClassifications.get(poId) || "per_item";
  }, [poClassifications]);

  /** Get effective classification for a line item — PO-level overrides item-level */
  const getClassification = useCallback((key: string, poId?: string | number, sectionName?: string): TenderClassification => {
    if (poId !== undefined) {
      const poCls = poClassifications.get(poId);
      if (poCls === "per_po_pc") return "pc";
      if (poCls === "per_po_ps") return "ps";
      if (poCls === "per_po_incl") return "included";
      if (poCls === "per_po_incl_qty") return "incl_qty";
      if (poCls === "per_po_nt") return "incl_hidden";
      if (poCls === "per_po_exc") return "excluded";
    }
    const manualCls = itemClassifications.get(key);
    if (manualCls) return manualCls;

    // Default based on tender section type — only "provisional" sections default to PS
    // NOTE: section_type "priced" is the DB default for ALL sections, it does NOT mean Prime Cost.
    // PC items must be explicitly classified by the user.
    if (sectionName) {
      const section = tenderTreeSectionMap.get(sectionName);
      if (section?.sectionType === "provisional") return "ps";
    }
    return "included";
  }, [itemClassifications, poClassifications, tenderTreeSectionMap]);

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
        // Sort POs by cost centre when grouping is enabled
        const poEntries = Array.from(poMap.entries());
        if (groupByCostCentre) {
          poEntries.sort((a, b) => {
            const ccA = a[1].group.costCentreName || "";
            const ccB = b[1].group.costCentreName || "";
            const numA = parseInt(ccA, 10);
            const numB = parseInt(ccB, 10);
            if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
            if (!isNaN(numA)) return -1;
            if (!isNaN(numB)) return 1;
            return ccA.localeCompare(ccB);
          });
        }
        let lastCostCentre: string | null = null;
        for (const [poId, { group, items }] of poEntries) {
          // Insert cost centre sub-header when it changes
          if (groupByCostCentre) {
            const cc = group.costCentreName || "Uncategorised";
            if (cc !== lastCostCentre) {
              lastCostCentre = cc;
              rows.push({ type: "cost-centre", name: cc, headerName, sectionName });
            }
          }
          let poTotal = 0;
          const poIdx = rows.length;
          rows.push({
            type: "po", poId, poName: group.name,
            supplierId: group.supplierId, supplierName: group.supplierName,
            taskName: group.taskName, tradeName: group.tradeName,
            costCentreName: group.costCentreName,
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
              taskName: group.taskName,
              pricebookCode: item.pricebookItemCode,
              hasPricebookImage: item.hasPricebookImage || false,
              pricebookItemId: item.pricebookItemId,
              description: getEffective(key, "description", item.description) as string,
              quantity: effQty, unitPrice: effPrice, gstCode: item.gstCode,
              amount, headerName, sectionName,
            });
          }

          // New lines for this specific PO
          const poNewLines = newLines.filter((nl) => nl.poId === poId);
          for (const nl of poNewLines) {
            lineNum++;
            const amount = nl.quantity * nl.unitPrice;
            poTotal += amount;
            rows.push({
              type: "item",
              key: nl.tempId,
              lineNum, poId, poName: group.name,
              taskName: group.taskName,
              pricebookCode: nl.pricebookItemCode || null,
              hasPricebookImage: false,
              pricebookItemId: nl.pricebookItemId || null,
              description: nl.description,
              quantity: nl.quantity, unitPrice: nl.unitPrice, gstCode: "GST",
              amount, headerName, sectionName,
              isNewLine: true,
            });
          }

          (rows[poIdx] as Extract<UnifiedRow, { type: "po" }>).subtotal = poTotal;
          (rows[poIdx] as Extract<UnifiedRow, { type: "po" }>).itemCount = items.length + poNewLines.length;

          // PO footer row (+ Add Line & total)
          rows.push({
            type: "po-footer", poId, poName: group.name,
            subtotal: poTotal, headerName, sectionName,
          });

          sectionTotal += poTotal;
          sectionItemCount += items.length + poNewLines.length;
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
  }, [boqGroups, editOverrides, newLines, getEffective, groupByCostCentre]);

  // Auto-default qty=0 items to "excluded" (only on initial load, not overriding manual changes)
  const [autoDefaultApplied, setAutoDefaultApplied] = useState(false);
  useEffect(() => {
    if (autoDefaultApplied || !unifiedRows.length) return;
    const defaults = new Map<string, TenderClassification>();
    for (const row of unifiedRows) {
      if (row.type === "item" && row.quantity === 0 && !row.isNewLine) {
        defaults.set(row.key, "excluded");
      }
    }
    if (defaults.size > 0) {
      setItemClassifications((prev) => {
        const next = new Map(prev);
        for (const [key, cls] of defaults) {
          if (!next.has(key)) next.set(key, cls);
        }
        return next;
      });
    }
    setAutoDefaultApplied(true);
  }, [unifiedRows, autoDefaultApplied]);

  /** Trigger file picker for image upload */
  const triggerImageUpload = useCallback((pricebookItemId: number) => {
    setUploadingImageForId(pricebookItemId);
    imageInputRef.current?.click();
  }, []);

  /** Handle file selection and upload */
  const handleImageFileSelected = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !uploadingImageForId) {
      setUploadingImageForId(null);
      return;
    }

    try {
      const formData = new FormData();
      formData.append("file", file);
      await api.postFormData(`/api/v1/pricebook/${uploadingImageForId}/upload_image`, formData);

      // Optimistic update: mark all items with this pricebook ID as having an image
      setBOQData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          groups: prev.groups.map((g) => ({
            ...g,
            items: g.items.map((item) =>
              item.pricebookItemId === uploadingImageForId
                ? { ...item, hasPricebookImage: true }
                : item
            ),
          })),
        };
      });

      toast.success("Image uploaded");
    } catch (err) {
      console.error("Image upload failed:", err);
      toast.error("Failed to upload image");
    } finally {
      setUploadingImageForId(null);
      // Reset file input so same file can be re-selected
      if (imageInputRef.current) imageInputRef.current.value = "";
    }
  }, [uploadingImageForId]);

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

  const toggleCostCentre = useCallback((key: string) => {
    setCollapsedCostCentres((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }, []);

  const toggleCCSubtotal = useCallback((key: string) => {
    setCCSubtotalEnabled((prev) => {
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

  /** Compute totals considering overrides, exclusions, and classifications */
  const totals = useMemo(() => {
    let included = 0;
    let includedSell = 0;
    let excluded = 0;
    let pcTotal = 0;
    let psTotal = 0;
    let includedCount = 0;
    let excludedCount = 0;
    let pcCount = 0;
    let psCount = 0;
    const headerSubtotals: Record<string, number> = {};

    // Build PO info map for descriptive names (taskName, supplierName from PO rows)
    const poInfoMap = new Map<string | number, { taskName: string | null | undefined; supplierName: string | null | undefined }>();
    for (const row of unifiedRows) {
      if (row.type === "po") poInfoMap.set(row.poId, { taskName: row.taskName, supplierName: row.supplierName });
    }

    // PC/PS schedule: per-PO → aggregate by PO; per-item → individual rows
    const pcPoMap = new Map<string | number, { description: string; amount: number; sectionName: string }>();
    const psPoMap = new Map<string | number, { description: string; amount: number; sectionName: string }>();
    const pcItemList: { description: string; amount: number; sectionName: string }[] = [];
    const psItemList: { description: string; amount: number; sectionName: string }[] = [];

    for (const row of unifiedRows) {
      if (row.type !== "item") continue;
      const cls = excludedIds.has(row.key) ? "excluded" as const : getClassification(row.key, row.poId, row.sectionName);
      const isPerPo = poClassifications.get(row.poId) !== "per_item" && poClassifications.has(row.poId);

      if (cls === "excluded") {
        excluded += row.amount;
        excludedCount++;
      } else if (cls === "pc") {
        pcTotal += row.amount;
        pcCount++;
        if (isPerPo) {
          // PO-level: aggregate into one row per PO
          const existing = pcPoMap.get(row.poId);
          if (existing) { existing.amount += row.amount; }
          else {
            const info = poInfoMap.get(row.poId);
            const desc = cleanTaskName(info?.taskName) || row.poName;
            pcPoMap.set(row.poId, { description: desc, amount: row.amount, sectionName: row.sectionName });
          }
        } else {
          // Per-item: individual row
          pcItemList.push({ description: row.description, amount: row.amount, sectionName: row.sectionName });
        }
      } else if (cls === "ps") {
        psTotal += row.amount;
        psCount++;
        if (isPerPo) {
          const existing = psPoMap.get(row.poId);
          if (existing) { existing.amount += row.amount; }
          else {
            const info = poInfoMap.get(row.poId);
            const desc = cleanTaskName(info?.taskName) || row.poName;
            psPoMap.set(row.poId, { description: desc, amount: row.amount, sectionName: row.sectionName });
          }
        } else {
          psItemList.push({ description: row.description, amount: row.amount, sectionName: row.sectionName });
        }
      } else {
        included += row.amount;
        includedCount++;
        // Calculate sell price with tender markup (smart roundup per unit, then × qty)
        if (tenderMarkupPercent > 0) {
          const sellUnit = applySmartRoundup(row.unitPrice * (1 + tenderMarkupPercent / 100));
          includedSell += sellUnit * row.quantity;
        } else {
          includedSell += row.amount;
        }
      }
      // Track per-header subtotals (included items only — PC/PS shown separately below)
      // Use sell prices (with markup) for header subtotals
      if (cls !== "excluded" && cls !== "pc" && cls !== "ps" && row.headerName) {
        const displayAmount = tenderMarkupPercent > 0
          ? applySmartRoundup(row.unitPrice * (1 + tenderMarkupPercent / 100)) * row.quantity
          : row.amount;
        headerSubtotals[row.headerName] = (headerSubtotals[row.headerName] || 0) + displayAmount;
      }
    }

    // Combine PO-level and item-level entries
    const pcItems = [...Array.from(pcPoMap.values()), ...pcItemList];
    const psItems = [...Array.from(psPoMap.values()), ...psItemList];

    // Calculate effective sell total: override takes precedence over %-based calc
    const markupAmount = tenderMarkupOverride !== null ? tenderMarkupOverride : (includedSell - included);
    const sellTotal = tenderMarkupOverride !== null ? (included + tenderMarkupOverride) : includedSell;

    return { includedTotal: included, excludedTotal: excluded, pcTotal, psTotal, includedCount, excludedCount, pcCount, psCount, headerSubtotals, pcItems, psItems, includedSellTotal: sellTotal, markupAmount };
  }, [unifiedRows, excludedIds, getClassification, poClassifications, tenderMarkupPercent, tenderMarkupOverride]);

  /** Group unified rows into header → section → content for two-panel rendering */
  const groupedRows = useMemo((): HeaderGroup[] => {
    // First pass: group PO-backed rows into header > section structure
    const groups: HeaderGroup[] = [];
    let currentHeader: HeaderGroup | null = null;
    let currentSection: SectionGroup | null = null;

    for (const row of unifiedRows) {
      if (row.type === "header") {
        currentHeader = { headerRow: row, sections: [] };
        groups.push(currentHeader);
        currentSection = null;
      } else if (row.type === "section" && currentHeader) {
        currentSection = { sectionRow: row, contentRows: [] };
        currentHeader.sections.push(currentSection);
      } else if (currentSection) {
        currentSection.contentRows.push(row);
      }
    }

    // Second pass: merge in empty sections from the tender tree
    // This ensures every header/section appears even with no PO items
    if (tenderTree.length > 0) {
      const existingHeaders = new Set(groups.map((g) => g.headerRow.name));
      const existingSections = new Set(
        groups.flatMap((g) => g.sections.map((s) => `${g.headerRow.name}::${s.sectionRow.name}`))
      );

      for (const treeHeader of tenderTree) {
        let headerGroup = groups.find((g) => g.headerRow.name === treeHeader.name);
        if (!headerGroup) {
          // Header doesn't exist yet - add it with all its empty sections
          headerGroup = {
            headerRow: {
              type: "header" as const,
              name: treeHeader.name,
              subtotal: 0,
              itemCount: 0,
              headerType: treeHeader.headerType || "standard",
            },
            sections: [],
          };
          groups.push(headerGroup);
        } else {
          // Stamp headerType on existing header rows from tenderTree
          headerGroup.headerRow.headerType = treeHeader.headerType || "standard";
        }

        // PC/PS schedule headers don't have sections - they render aggregated items
        if (treeHeader.headerType === "pc_schedule" || treeHeader.headerType === "ps_schedule") continue;

        // Add any missing sections under this header
        for (const treeSection of treeHeader.children) {
          const sectionKey = `${treeHeader.name}::${treeSection.name}`;
          if (!existingSections.has(sectionKey)) {
            headerGroup.sections.push({
              sectionRow: {
                type: "section" as const,
                name: treeSection.name,
                headerName: treeHeader.name,
                subtotal: 0,
                itemCount: 0,
                poCount: 0,
              },
              contentRows: [], // Empty - no PO items
            });
            existingSections.add(sectionKey);
          }
        }

        // Sort sections within each header by the tender tree order
        const sectionOrder = new Map(treeHeader.children.map((s, i) => [s.name, i]));
        headerGroup.sections.sort((a, b) => {
          const aOrder = sectionOrder.get(a.sectionRow.name) ?? 999;
          const bOrder = sectionOrder.get(b.sectionRow.name) ?? 999;
          return aOrder - bOrder;
        });
      }

      // Sort headers by the tender tree order
      const headerOrder = new Map(tenderTree.map((h, i) => [h.name, i]));
      groups.sort((a, b) => {
        const aOrder = headerOrder.get(a.headerRow.name) ?? 999;
        const bOrder = headerOrder.get(b.headerRow.name) ?? 999;
        return aOrder - bOrder;
      });
    }

    return groups;
  }, [unifiedRows, tenderTree]);

  // ⚠️ DO NOT SIMPLIFY to collapsedHeaders.size > 0 (Feb 2026)
  // ════════════════════════════════════════════
  // Why: The toggle button must show "collapse all" when ANY header is still
  // expanded. The old check (size > 0) treated "any collapsed" as "all collapsed",
  // so clicking the button with 3/4 headers collapsed would EXPAND instead of
  // collapsing the remaining one.
  // ❌ WRONG: collapsedHeaders.size > 0 — true when ANY is collapsed
  // ✅ CORRECT: Check all headers are collapsed (sections hidden under headers)
  // ════════════════════════════════════════════
  const allCollapsed = groupedRows.length > 0 && groupedRows.every(g => collapsedHeaders.has(g.headerRow.name));

  const collapseAll = useCallback(() => {
    const headers = new Set<string>();
    const sections = new Set<string>();
    const costCentres = new Set<string>();
    const pos = new Set<string>();
    // Use groupedRows (not unifiedRows) to include empty sections from tenderTree
    for (const group of groupedRows) {
      headers.add(group.headerRow.name);
      for (const section of group.sections) {
        sections.add(`${section.sectionRow.headerName}::${section.sectionRow.name}`);
        for (const row of section.contentRows) {
          if (row.type === "cost-centre") costCentres.add(`${row.headerName}::${row.sectionName}::cc::${row.name}`);
          if (row.type === "po") pos.add(`${row.headerName}::${row.sectionName}::${row.poId}`);
        }
      }
    }
    setCollapsedHeaders(headers);
    setCollapsedSections(sections);
    setCollapsedCostCentres(costCentres);
    setCollapsedPOs(pos);
  }, [groupedRows]);

  const expandAll = useCallback(() => {
    setCollapsedHeaders(new Set());
    setCollapsedSections(new Set());
    setCollapsedCostCentres(new Set());
    setCollapsedPOs(new Set());
  }, []);

  /** Get the note text for a section (user-edited or default) */
  const getSectionNote = useCallback((sectionName: string): string => {
    // User-edited note takes priority
    const userNote = sectionNotes.get(sectionName);
    if (userNote !== undefined) return userNote;
    // Fall back to tender tree defaults
    const treeSection = tenderTreeSectionMap.get(sectionName);
    if (treeSection) {
      return treeSection.defaultNote || treeSection.description || treeSection.name;
    }
    return sectionName;
  }, [sectionNotes, tenderTreeSectionMap]);

  /** Update the note for a section */
  const updateSectionNote = useCallback((sectionName: string, note: string) => {
    setSectionNotes((prev) => {
      const next = new Map(prev);
      next.set(sectionName, note);
      return next;
    });
  }, []);

  const handleSaveBuilderState = useCallback(async () => {
    try {
      setSavingBuilder(true);
      const builderState = serializeBuilderState({
        itemClassifications,
        poClassifications,
        editOverrides,
        newLines,
        sectionNotes,
        ccSubtotalEnabled,
        groupByCostCentre,
        excludedIds,
        tenderMarkupPercent,
        tenderMarkupOverride,
      });
      const response = await api.post<{
        success: boolean;
        data?: { created_count: number; updated_count: number; deleted_count: number };
      }>(
        `/api/v1/jobs/${jobId}/tender_documents/save_builder_state`,
        { builder_state: builderState }
      );

      const { created_count = 0, updated_count = 0, deleted_count = 0 } = response?.data || {};
      const hasChanges = created_count > 0 || updated_count > 0 || deleted_count > 0;

      if (hasChanges) {
        // PO is SSoT — clear synced state and reload live data
        setNewLines([]);
        setEditOverrides(new Map());
        setExcludedIds(new Set());
        setSearchingDescriptionKey(null);
        // Clear excluded classifications (items are deleted from PO)
        setItemClassifications((prev) => {
          const next = new Map(prev);
          for (const [key, cls] of next) {
            if (cls === "excluded") next.delete(key);
          }
          return next;
        });
        await loadBOQData();

        const parts: string[] = [];
        if (created_count > 0) parts.push(`${created_count} added`);
        if (updated_count > 0) parts.push(`${updated_count} updated`);
        if (deleted_count > 0) parts.push(`${deleted_count} deleted`);
        toast.success(`Saved to POs — ${parts.join(", ")}`);
      } else {
        toast.success("Builder state saved");
      }
    } catch (err) {
      toast.error("Failed to save");
    } finally {
      setSavingBuilder(false);
    }
  }, [jobId, itemClassifications, poClassifications, editOverrides, newLines, sectionNotes, ccSubtotalEnabled, groupByCostCentre, excludedIds, tenderMarkupPercent, tenderMarkupOverride]);

  const handleCreateTender = useCallback(async () => {
    try {
      setCreatingTender(true);

      // Build item classifications map: { lineItemId: classification }
      // Includes section-type defaults for items in PC/PS sections without manual classification
      const itemClsMap: Record<string, string> = {};
      for (const row of unifiedRows) {
        if (row.type !== "item" || row.key.startsWith("new_")) continue;
        const lineItemId = row.key.split(":")[1];
        if (!lineItemId) continue;
        // Use the same getClassification logic (manual → section-type default → included)
        itemClsMap[lineItemId] = getClassification(row.key, row.poId, row.sectionName);
      }
      // Legacy excludedIds → mark as excluded (override any classification)
      for (const key of excludedIds) {
        if (key.startsWith("new_")) continue;
        const lineItemId = key.split(":")[1];
        if (lineItemId) itemClsMap[lineItemId] = "excluded";
      }

      // Build PO classifications map: { poId: poClassification }
      const poClsMap: Record<string, string> = {};
      for (const [poId, cls] of poClassifications) {
        poClsMap[String(poId)] = cls;
      }

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
          pricebook_item_id: nl.pricebookItemId || null,
          pricebook_item_code: nl.pricebookItemCode || null,
          cost_centre_name: nl.costCentreName || null,
          source_purchase_order_id: typeof nl.poId === "number" ? nl.poId : null,
        }));

      // Build section notes map: { sectionName: userEditedNote }
      const sectionNotesMap: Record<string, string> = {};
      for (const [sectionName, noteText] of sectionNotes) {
        if (noteText.trim()) sectionNotesMap[sectionName] = noteText;
      }

      // Serialize full builder state so it can be restored when reopening
      const builderState = serializeBuilderState({
        itemClassifications,
        poClassifications,
        editOverrides,
        newLines,
        sectionNotes,
        ccSubtotalEnabled,
        groupByCostCentre,
        excludedIds,
        tenderMarkupPercent,
        tenderMarkupOverride,
      });

      // Build section_document_types: { sectionName: ["Plans", "Engineering"] }
      // (only includes non-excluded doc types from the tender tree)
      const sectionDocTypesMap: Record<string, string[]> = {};
      for (const header of tenderTree) {
        for (const section of header.children) {
          const docTypes = section.attachedDocumentTypes || [];
          if (docTypes.length === 0) continue;
          const activeDts = docTypes.filter(
            (dt) => !excludedDocTypes.has(`${section.name}::${dt}`)
          );
          if (activeDts.length > 0) {
            sectionDocTypesMap[section.name] = activeDts;
          }
        }
      }

      const response = await api.post<{ success: boolean; data: { id: number } }>(
        `/api/v1/jobs/${jobId}/tender_documents`,
        {
          item_classifications: itemClsMap,
          po_classifications: poClsMap,
          item_overrides: itemOverrides,
          additional_items: additionalItems,
          section_notes: sectionNotesMap,
          section_document_types: sectionDocTypesMap,
          builder_state: builderState,
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
  }, [jobId, excludedIds, editOverrides, newLines, router, itemClassifications, poClassifications, sectionNotes, ccSubtotalEnabled, groupByCostCentre, tenderTree, excludedDocTypes, getClassification, unifiedRows, tenderMarkupPercent, tenderMarkupOverride]);

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

  // Column layout: Code | Description | Qty | Price | GST | Amount | Type
  return (
    <div className="flex flex-col h-full">
      {/* Hidden file input for pricebook image uploads */}
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleImageFileSelected}
      />

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
          <Button
            variant="ghost"
            size="sm"
            onClick={allCollapsed ? expandAll : collapseAll}
            title={allCollapsed ? "Expand all" : "Collapse all"}
            className="text-muted-foreground px-2"
          >
            {allCollapsed
              ? <ChevronsUpDown className="h-4 w-4" />
              : <ChevronsDownUp className="h-4 w-4" />
            }
          </Button>
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer select-none">
            <input
              type="checkbox"
              checked={groupByCostCentre}
              onChange={(e) => setGroupByCostCentre(e.target.checked)}
              className="rounded border-border"
            />
            Cost Centre
          </label>
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer select-none">
            <input
              type="checkbox"
              checked={showImages}
              onChange={(e) => setShowImages(e.target.checked)}
              className="rounded border-border"
            />
            Images
          </label>
          <Button variant="outline" size="sm" onClick={loadBOQData}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Scrollable content area */}
      <div className="flex-1 min-h-0 overflow-auto border rounded-md">
        {/* Column headers row */}
        <div className="sticky top-0 z-10 bg-muted border-b">
          <div className="flex">
            {/* Left column headers */}
            <div className="w-3/5 min-w-0">
              <div className="grid text-xs uppercase tracking-wider font-medium text-muted-foreground py-2" style={{ gridTemplateColumns: "10% 1fr 8% 10% 14% 60px" }}>
                <div className="px-2 text-left">Code</div>
                <div className="px-2 text-left">Description</div>
                <div className="px-2 text-right">Qty</div>
                <div className="px-2 text-right">Price</div>
                <div className="px-2 text-right">Amount</div>
                <div className="px-1 text-center">Type</div>
              </div>
            </div>
            {/* Right column header */}
            <div className="w-2/5 min-w-0 border-l">
              <div className="px-4 py-2 text-xs uppercase tracking-wider font-medium text-muted-foreground">
                Tender Preview
              </div>
            </div>
          </div>
        </div>

        {/* Grouped rows: headers and sections span full width, items split */}
        {groupedRows.map((headerGroup) => {
          const { headerRow } = headerGroup;
          const isHeaderCollapsed = collapsedHeaders.has(headerRow.name);

          // Compute subtotals by classification for the header
          let headerIncludedTotal = 0;
          let headerPcTotal = 0;
          let headerPsTotal = 0;
          for (const s of headerGroup.sections) {
            for (const r of s.contentRows) {
              if (r.type !== "item" || excludedIds.has(r.key)) continue;
              const c = getClassification(r.key, r.poId, r.sectionName);
              if (c === "included" || c === "incl_qty" || c === "incl_hidden") headerIncludedTotal += r.amount;
              else if (c === "pc") headerPcTotal += r.amount;
              else if (c === "ps") headerPsTotal += r.amount;
            }
          }

          // ── PC/PS schedule headers render aggregated items, not sections ──
          if (headerRow.headerType === "pc_schedule") {
            const colKey = headerRow.name;
            const scheduleItems = totals.pcItems;
            const scheduleTotal = totals.pcTotal;
            const scheduleCount = totals.pcCount;
            return (
              <div key={`h-${headerRow.name}`}>
                <div
                  className="flex items-center bg-blue-50/60 dark:bg-blue-950/20 border-b cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-950/30 px-2 py-2"
                  onClick={() => toggleHeader(colKey)}
                >
                  <div className="shrink-0 w-5">
                    {collapsedHeaders.has(colKey)
                      ? <ChevronRight className="h-4 w-4 text-blue-700 dark:text-blue-400" />
                      : <ChevronDown className="h-4 w-4 text-blue-700 dark:text-blue-400" />
                    }
                  </div>
                  <div className="flex-1 font-semibold text-blue-700 dark:text-blue-400 text-sm">
                    {headerRow.name}
                    <Badge variant="secondary" className="ml-2 text-[10px] font-normal">{scheduleCount} {scheduleCount === 1 ? "item" : "items"}</Badge>
                  </div>
                  <div className="text-right font-semibold text-blue-700 dark:text-blue-400 tabular-nums text-sm">
                    {formatCurrency(scheduleTotal)}
                  </div>
                </div>
                {!collapsedHeaders.has(colKey) && (
                  <div className="px-4 py-3 bg-blue-50/30 dark:bg-blue-950/10 border-b">
                    <p className="text-xs text-muted-foreground italic leading-relaxed mb-2">A Prime Cost is an allowance for items where the actual cost is not yet determined. The contract price will be adjusted to reflect the actual cost of these items when purchased or completed.</p>
                    {scheduleItems.length > 0 ? (
                      <table className="w-full text-sm border-collapse">
                        <thead>
                          <tr className="border-b-2 border-foreground/20">
                            <th className="text-left py-1.5 pr-4 font-semibold w-10">#</th>
                            <th className="text-left py-1.5 pr-4 font-semibold">Description</th>
                            <th className="text-left py-1.5 pr-4 font-semibold w-36">Section</th>
                            <th className="text-right py-1.5 font-semibold w-28">Amount</th>
                          </tr>
                        </thead>
                        <tbody>
                          {scheduleItems.map((item, idx) => (
                            <tr key={idx} className="border-b border-border/30">
                              <td className="py-1.5 pr-4 text-muted-foreground">{idx + 1}</td>
                              <td className="py-1.5 pr-4">{item.description}</td>
                              <td className="py-1.5 pr-4 text-muted-foreground text-xs">{item.sectionName.replace(/^\d+\s*[-–—]\s*/, "").trim()}</td>
                              <td className="py-1.5 text-right tabular-nums">{formatCurrency(item.amount)}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="border-t-2 border-foreground/20">
                            <td colSpan={3} className="py-2 font-semibold text-right pr-4">Total Prime Costs</td>
                            <td className="py-2 text-right font-semibold tabular-nums">{formatCurrency(scheduleTotal)}</td>
                          </tr>
                        </tfoot>
                      </table>
                    ) : (
                      <p className="text-sm text-muted-foreground">No prime cost items</p>
                    )}
                  </div>
                )}
              </div>
            );
          }

          if (headerRow.headerType === "ps_schedule") {
            const colKey = headerRow.name;
            const scheduleItems = totals.psItems;
            const scheduleTotal = totals.psTotal;
            const scheduleCount = totals.psCount;
            return (
              <div key={`h-${headerRow.name}`}>
                <div
                  className="flex items-center bg-violet-50/60 dark:bg-violet-950/20 border-b cursor-pointer hover:bg-violet-50 dark:hover:bg-violet-950/30 px-2 py-2"
                  onClick={() => toggleHeader(colKey)}
                >
                  <div className="shrink-0 w-5">
                    {collapsedHeaders.has(colKey)
                      ? <ChevronRight className="h-4 w-4 text-violet-700 dark:text-violet-400" />
                      : <ChevronDown className="h-4 w-4 text-violet-700 dark:text-violet-400" />
                    }
                  </div>
                  <div className="flex-1 font-semibold text-violet-700 dark:text-violet-400 text-sm">
                    {headerRow.name}
                    <Badge variant="secondary" className="ml-2 text-[10px] font-normal">{scheduleCount} {scheduleCount === 1 ? "item" : "items"}</Badge>
                  </div>
                  <div className="text-right font-semibold text-violet-700 dark:text-violet-400 tabular-nums text-sm">
                    {formatCurrency(scheduleTotal)}
                  </div>
                </div>
                {!collapsedHeaders.has(colKey) && (
                  <div className="px-4 py-3 bg-violet-50/30 dark:bg-violet-950/10 border-b">
                    <p className="text-xs text-muted-foreground italic leading-relaxed mb-2">A Provisional Sum is an allowance for work that cannot be fully defined at the time of tendering. The contract price will be adjusted based on the actual cost when the work is carried out.</p>
                    {scheduleItems.length > 0 ? (
                      <table className="w-full text-sm border-collapse">
                        <thead>
                          <tr className="border-b-2 border-foreground/20">
                            <th className="text-left py-1.5 pr-4 font-semibold w-10">#</th>
                            <th className="text-left py-1.5 pr-4 font-semibold">Description</th>
                            <th className="text-left py-1.5 pr-4 font-semibold w-36">Section</th>
                            <th className="text-right py-1.5 font-semibold w-28">Amount</th>
                          </tr>
                        </thead>
                        <tbody>
                          {scheduleItems.map((item, idx) => (
                            <tr key={idx} className="border-b border-border/30">
                              <td className="py-1.5 pr-4 text-muted-foreground">{idx + 1}</td>
                              <td className="py-1.5 pr-4">{item.description}</td>
                              <td className="py-1.5 pr-4 text-muted-foreground text-xs">{item.sectionName.replace(/^\d+\s*[-–—]\s*/, "").trim()}</td>
                              <td className="py-1.5 text-right tabular-nums">{formatCurrency(item.amount)}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="border-t-2 border-foreground/20">
                            <td colSpan={3} className="py-2 font-semibold text-right pr-4">Total Provisional Sums</td>
                            <td className="py-2 text-right font-semibold tabular-nums">{formatCurrency(scheduleTotal)}</td>
                          </tr>
                        </tfoot>
                      </table>
                    ) : (
                      <p className="text-sm text-muted-foreground">No provisional sum items</p>
                    )}
                  </div>
                )}
              </div>
            );
          }

          return (
            <div key={`h-${headerRow.name}`}>
              {/* ── Header row (full width) ── */}
              <div
                className="flex items-center bg-primary/8 dark:bg-primary/15 border-b cursor-pointer hover:bg-primary/12 dark:hover:bg-primary/20 px-2 py-2"
                onClick={() => toggleHeader(headerRow.name)}
              >
                <div className="shrink-0 w-5">
                  {isHeaderCollapsed
                    ? <ChevronRight className="h-4 w-4 text-primary" />
                    : <ChevronDown className="h-4 w-4 text-primary" />
                  }
                </div>
                <div className="flex-1 font-semibold text-primary text-sm">
                  {headerRow.name}
                  <Badge variant="secondary" className="ml-2 text-[10px] font-normal">{headerRow.itemCount} items</Badge>
                </div>
                {/* Show included total + PC/PS indicators (no combined total — Schedule is SSoT) */}
                <div className="flex items-center gap-3 tabular-nums text-sm">
                  {headerPcTotal > 0 && (
                    <span className="text-blue-600 dark:text-blue-400 text-xs font-medium">PC {formatCurrency(headerPcTotal)}</span>
                  )}
                  {headerPsTotal > 0 && (
                    <span className="text-violet-600 dark:text-violet-400 text-xs font-medium">PS {formatCurrency(headerPsTotal)}</span>
                  )}
                  <span className="text-primary font-semibold">{formatCurrency(headerIncludedTotal)}</span>
                </div>
              </div>

              {/* Sections under this header */}
              {!isHeaderCollapsed && headerGroup.sections
                .map((sectionGroup) => {
                const { sectionRow, contentRows } = sectionGroup;
                const sKey = `${sectionRow.headerName}::${sectionRow.name}`;
                const isSectionCollapsed = collapsedSections.has(sKey);

                const sectionItems = contentRows.filter(
                  (r): r is Extract<UnifiedRow, { type: "item" }> => r.type === "item"
                );
                const includedSectionItems = sectionItems.filter(
                  (r) => {
                    if (excludedIds.has(r.key)) return false;
                    const c = getClassification(r.key, r.poId, r.sectionName);
                    return c === "included" || c === "incl_qty" || c === "incl_hidden";
                  }
                );
                const includedSubtotal = includedSectionItems.reduce((sum, r) => sum + r.amount, 0);

                return (
                  <div key={sKey}>
                    {/* ── Section row (full width) ── */}
                    <div
                      className="flex items-center bg-muted/50 border-b cursor-pointer hover:bg-muted/70 pl-6 pr-2 py-1.5"
                      onClick={() => toggleSection(sKey)}
                    >
                      <div className="shrink-0 w-5">
                        {isSectionCollapsed
                          ? <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                          : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                        }
                      </div>
                      <div className="flex-1 font-medium text-foreground/80 text-sm flex items-center gap-1 flex-wrap">
                        <span>{sectionRow.name}</span>
                        {sectionRow.poCount > 0 ? (
                          <Badge variant="outline" className="text-[10px] font-normal">{sectionRow.poCount} POs</Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] font-normal text-amber-600 dark:text-amber-400 border-amber-300 dark:border-amber-700">Note</Badge>
                        )}
                        {/* Doc type badges from tender tree */}
                        {(() => {
                          const treeSection = tenderTreeSectionMap.get(sectionRow.name);
                          const docTypes = treeSection?.attachedDocumentTypes || [];
                          if (docTypes.length === 0) return null;
                          return docTypes.map((dt) => {
                            const excKey = `${sectionRow.name}::${dt}`;
                            const isExcluded = excludedDocTypes.has(excKey);
                            return (
                              <Badge
                                key={dt}
                                variant="outline"
                                className={cn(
                                  "text-[10px] font-normal gap-0.5 cursor-pointer transition-opacity",
                                  isExcluded
                                    ? "opacity-40 line-through"
                                    : "text-blue-600 dark:text-blue-400 border-blue-300 dark:border-blue-700",
                                )}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setExcludedDocTypes((prev) => {
                                    const next = new Set(prev);
                                    if (next.has(excKey)) next.delete(excKey);
                                    else next.add(excKey);
                                    return next;
                                  });
                                }}
                                title={isExcluded ? `Click to re-include ${dt}` : `Click to exclude ${dt} from this tender`}
                              >
                                <Paperclip className="h-2.5 w-2.5" />
                                {dt}
                                {isExcluded && <X className="h-2.5 w-2.5 ml-0.5" />}
                              </Badge>
                            );
                          });
                        })()}
                        {/* Claims badge for fee/claim sections */}
                        {(() => {
                          const nameLC = sectionRow.name.toLowerCase();
                          const isClaimSection = nameLC.includes("fee") || nameLC.includes("claim") || nameLC.includes("payment");
                          if (!isClaimSection || jobClaims.length === 0) return null;
                          const liveCount = jobClaims.filter((c) => ["draft", "submitted", "authorised"].includes(c.status)).length;
                          const paidCount = jobClaims.filter((c) => c.status === "paid").length;
                          return (
                            <>
                              {liveCount > 0 && (
                                <Badge variant="outline" className="text-[10px] font-normal text-amber-600 dark:text-amber-400 border-amber-300 dark:border-amber-700">
                                  {liveCount} live
                                </Badge>
                              )}
                              {paidCount > 0 && (
                                <Badge variant="outline" className="text-[10px] font-normal text-green-600 dark:text-green-400 border-green-300 dark:border-green-700">
                                  {paidCount} paid
                                </Badge>
                              )}
                            </>
                          );
                        })()}
                      </div>
                      <div className="text-right font-medium text-foreground/80 tabular-nums text-sm">
                        {formatCurrency(includedSubtotal)}
                      </div>
                    </div>

                    {/* ── Empty section: note editing ── */}
                    {!isSectionCollapsed && contentRows.length === 0 && (
                      <div className="flex border-b">
                        {/* Left: note editor */}
                        <div className="w-3/5 min-w-0 px-4 py-3 bg-muted/10">
                          <div className="flex items-start gap-2">
                            <Badge variant="outline" className="text-[10px] shrink-0 mt-0.5 border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-400">
                              Note
                            </Badge>
                            <textarea
                              value={getSectionNote(sectionRow.name)}
                              onChange={(e) => updateSectionNote(sectionRow.name, e.target.value)}
                              placeholder="Enter note for this section..."
                              rows={2}
                              className={cn(
                                "flex-1 bg-transparent text-sm px-2 py-1 rounded border resize-none",
                                "hover:border-border focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/20",
                                sectionNotes.has(sectionRow.name)
                                  ? "border-amber-300 dark:border-amber-700"
                                  : "border-border/50",
                              )}
                            />
                          </div>
                          <p className="text-[10px] text-muted-foreground mt-1 pl-12">
                            No POs assigned. This note will appear in the tender document.
                          </p>
                          {/* Attached documents from job matching this section's document types */}
                          {(() => {
                            const treeSection = tenderTreeSectionMap.get(sectionRow.name);
                            const sectionDocTypes = treeSection?.attachedDocumentTypes || [];
                            if (sectionDocTypes.length === 0) return null;
                            // Collect docs matching this section's attached types
                            const sectionDocs = sectionDocTypes.flatMap(
                              (typeName) => (tenderAttachedDocs[typeName] || []).map((d) => ({ ...d, typeName }))
                            );
                            if (sectionDocs.length === 0) return null;
                            return (
                              <div className="mt-3 pt-3 border-t border-border/30">
                                <table className="w-full text-xs">
                                  <thead>
                                    <tr className="border-b border-border/40">
                                      <th className="text-left py-1 font-medium text-muted-foreground">Document</th>
                                      <th className="text-left py-1 font-medium text-muted-foreground w-20">Type</th>
                                      <th className="text-center py-1 font-medium text-muted-foreground w-12">Ver</th>
                                      <th className="text-right py-1 font-medium text-muted-foreground w-24">Updated</th>
                                      <th className="text-center py-1 font-medium text-muted-foreground w-16">Status</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {sectionDocs.map((doc) => (
                                      <tr key={doc.id} className="border-b border-border/20">
                                        <td className="py-1 flex items-center gap-1.5">
                                          <Paperclip className="h-3 w-3 text-muted-foreground shrink-0" />
                                          <span className="truncate">{doc.name}</span>
                                        </td>
                                        <td className="py-1 text-muted-foreground">{doc.typeName}</td>
                                        <td className="py-1 text-center">
                                          <Badge variant="outline" className="text-[9px] font-normal">v{doc.versionNumber}</Badge>
                                        </td>
                                        <td className="py-1 text-right text-muted-foreground">
                                          {new Date(doc.updatedAt).toLocaleDateString("en-AU", { day: "2-digit", month: "short", year: "numeric" })}
                                        </td>
                                        <td className="py-1 text-center">
                                          {doc.isLatest ? (
                                            <Badge className="text-[9px] bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-0">Current</Badge>
                                          ) : (
                                            <Badge variant="outline" className="text-[9px] text-muted-foreground">Prev</Badge>
                                          )}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            );
                          })()}
                          {/* Job claims display for fee/claim sections */}
                          {(() => {
                            const nameLC = sectionRow.name.toLowerCase();
                            const isClaimSection = nameLC.includes("fee") || nameLC.includes("claim") || nameLC.includes("payment");
                            if (!isClaimSection || jobClaims.length === 0) return null;
                            const liveClaims = jobClaims.filter((c) => ["draft", "submitted", "authorised"].includes(c.status));
                            const paidClaims = jobClaims.filter((c) => c.status === "paid");
                            const claimsTotal = jobClaims.filter((c) => c.status !== "voided").reduce((sum, c) => sum + (c.amount || 0), 0);
                            const paidTotal = paidClaims.reduce((sum, c) => sum + (c.amount_paid || 0), 0);
                            const STATUS_COLORS: Record<string, string> = {
                              draft: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
                              submitted: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
                              authorised: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
                              paid: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
                            };
                            const renderClaimRows = (claims: TenderJobClaim[]) => claims.map((claim) => (
                              <tr key={claim.id} className="border-b border-border/20">
                                <td className="py-1.5 font-mono text-xs">{claim.invoice_number}</td>
                                <td className="py-1.5 truncate max-w-[200px]">{claim.description || claim.contact_name || "—"}</td>
                                <td className="py-1.5 text-right tabular-nums">{formatCurrency(claim.amount)}</td>
                                <td className="py-1.5 text-right tabular-nums">{formatCurrency(claim.amount_paid)}</td>
                                <td className="py-1.5 text-center">
                                  <Badge className={cn("text-[9px] border-0 capitalize", STATUS_COLORS[claim.status] || "")}>{claim.status}</Badge>
                                </td>
                                <td className="py-1.5 text-right text-muted-foreground">
                                  {claim.date ? new Date(claim.date).toLocaleDateString("en-AU", { day: "2-digit", month: "short", year: "numeric" }) : "—"}
                                </td>
                              </tr>
                            ));
                            return (
                              <div className="mt-3 pt-3 border-t border-border/30">
                                {liveClaims.length > 0 && (
                                  <>
                                    <p className="text-xs font-medium text-muted-foreground mb-1.5">Live Claims ({liveClaims.length})</p>
                                    <table className="w-full text-xs mb-3">
                                      <thead>
                                        <tr className="border-b border-border/40">
                                          <th className="text-left py-1 font-medium text-muted-foreground w-24">Invoice #</th>
                                          <th className="text-left py-1 font-medium text-muted-foreground">Description</th>
                                          <th className="text-right py-1 font-medium text-muted-foreground w-24">Amount</th>
                                          <th className="text-right py-1 font-medium text-muted-foreground w-20">Paid</th>
                                          <th className="text-center py-1 font-medium text-muted-foreground w-20">Status</th>
                                          <th className="text-right py-1 font-medium text-muted-foreground w-24">Date</th>
                                        </tr>
                                      </thead>
                                      <tbody>{renderClaimRows(liveClaims)}</tbody>
                                    </table>
                                  </>
                                )}
                                {paidClaims.length > 0 && (
                                  <>
                                    <p className="text-xs font-medium text-muted-foreground mb-1.5">Paid Claims ({paidClaims.length})</p>
                                    <table className="w-full text-xs mb-3">
                                      <thead>
                                        <tr className="border-b border-border/40">
                                          <th className="text-left py-1 font-medium text-muted-foreground w-24">Invoice #</th>
                                          <th className="text-left py-1 font-medium text-muted-foreground">Description</th>
                                          <th className="text-right py-1 font-medium text-muted-foreground w-24">Amount</th>
                                          <th className="text-right py-1 font-medium text-muted-foreground w-20">Paid</th>
                                          <th className="text-center py-1 font-medium text-muted-foreground w-20">Status</th>
                                          <th className="text-right py-1 font-medium text-muted-foreground w-24">Date</th>
                                        </tr>
                                      </thead>
                                      <tbody>{renderClaimRows(paidClaims)}</tbody>
                                    </table>
                                  </>
                                )}
                                <div className="flex items-center justify-between text-xs pt-2 border-t border-border/30">
                                  <span className="text-muted-foreground">Total Claimed: <span className="font-semibold text-foreground">{formatCurrency(claimsTotal)}</span></span>
                                  <span className="text-muted-foreground">Total Paid: <span className="font-semibold text-green-600 dark:text-green-400">{formatCurrency(paidTotal)}</span></span>
                                </div>
                              </div>
                            );
                          })()}
                        </div>
                        {/* Right: preview */}
                        <div className="w-2/5 min-w-0 border-l bg-stone-50/80 dark:bg-zinc-900/30 px-4 py-3">
                          {getSectionNote(sectionRow.name) && (
                            <span className="text-[13px] text-muted-foreground italic leading-snug block mb-2">
                              {getSectionNote(sectionRow.name)}
                            </span>
                          )}
                          {/* Preview: list current-version documents for tender output */}
                          {(() => {
                            const treeSection = tenderTreeSectionMap.get(sectionRow.name);
                            const sectionDocTypes = treeSection?.attachedDocumentTypes || [];
                            const currentDocs = sectionDocTypes.flatMap(
                              (typeName) => (tenderAttachedDocs[typeName] || []).filter((d) => d.isLatest)
                            );
                            if (currentDocs.length === 0) return null;
                            return (
                              <div className="text-xs text-muted-foreground">
                                <p className="font-medium mb-1">Included documents:</p>
                                {currentDocs.map((doc) => (
                                  <p key={doc.id} className="py-0.5">• {doc.name} (v{doc.versionNumber})</p>
                                ))}
                              </div>
                            );
                          })()}
                          {/* Preview: claims summary for fee/claim sections */}
                          {(() => {
                            const nameLC = sectionRow.name.toLowerCase();
                            const isClaimSection = nameLC.includes("fee") || nameLC.includes("claim") || nameLC.includes("payment");
                            if (!isClaimSection || jobClaims.length === 0) return null;
                            const liveClaims = jobClaims.filter((c) => ["draft", "submitted", "authorised"].includes(c.status));
                            const paidClaims = jobClaims.filter((c) => c.status === "paid");
                            const outstanding = liveClaims.reduce((sum, c) => sum + (c.outstanding_amount || 0), 0);
                            return (
                              <div className="text-xs text-muted-foreground">
                                <p className="font-medium mb-1">Claims Summary:</p>
                                {liveClaims.length > 0 && (
                                  <p className="py-0.5">Live: {liveClaims.length} claim{liveClaims.length !== 1 ? "s" : ""} — {formatCurrency(outstanding)} outstanding</p>
                                )}
                                {paidClaims.length > 0 && (
                                  <p className="py-0.5">Paid: {paidClaims.length} claim{paidClaims.length !== 1 ? "s" : ""} — {formatCurrency(paidClaims.reduce((s, c) => s + (c.amount_paid || 0), 0))}</p>
                                )}
                              </div>
                            );
                          })()}
                        </div>
                      </div>
                    )}

                    {/* ── Two-panel content (builder left, preview right) ── */}
                    {!isSectionCollapsed && contentRows.length > 0 && (() => {
                      // Group content rows into a sequence of cost-centre headers and PO groups
                      type POGroup = {
                        poRow: Extract<UnifiedRow, { type: "po" }>;
                        items: Extract<UnifiedRow, { type: "item" }>[];
                        footer: Extract<UnifiedRow, { type: "po-footer" }> | null;
                      };
                      type ContentBlock =
                        | { kind: "cost-centre"; name: string }
                        | { kind: "po-group"; pg: POGroup };

                      const contentBlocks: ContentBlock[] = [];
                      let currentPOGroup: POGroup | null = null;

                      for (const row of contentRows) {
                        if (row.type === "cost-centre") {
                          contentBlocks.push({ kind: "cost-centre", name: row.name });
                        } else if (row.type === "po") {
                          currentPOGroup = { poRow: row, items: [], footer: null };
                          contentBlocks.push({ kind: "po-group", pg: currentPOGroup });
                        } else if (row.type === "item" && currentPOGroup) {
                          currentPOGroup.items.push(row);
                        } else if (row.type === "po-footer" && currentPOGroup) {
                          currentPOGroup.footer = row;
                        }
                      }

                      let previewLineNum = 0;
                      let activeCostCentreKey: string | null = null;
                      let activeCCName: string | null = null;

                      // Pre-compute cost centre subtotals for preview
                      const ccSubtotals = new Map<string, number>();
                      {
                        let currentCCKey: string | null = null;
                        for (const block of contentBlocks) {
                          if (block.kind === "cost-centre") {
                            currentCCKey = `${sKey}::cc::${block.name}`;
                          } else if (block.kind === "po-group" && currentCCKey) {
                            const poItems = block.pg.items.filter((r) => {
                              if (excludedIds.has(r.key)) return false;
                              const c = getClassification(r.key, r.poId, r.sectionName);
                              // Only count items that show a price in the tender (PC/PS)
                              // Included items show description only (no price), so they don't add to subtotal
                              return c === "pc" || c === "ps";
                            });
                            const total = poItems.reduce((sum, r) => sum + r.amount, 0);
                            ccSubtotals.set(currentCCKey, (ccSubtotals.get(currentCCKey) || 0) + total);
                          }
                        }
                      }

                      // Track whether the next block is a new cost centre (to insert subtotal before it)
                      const shouldShowCCSubtotal = (blockIdx: number): boolean => {
                        if (!activeCostCentreKey || !ccSubtotalEnabled.has(activeCostCentreKey)) return false;
                        // Show subtotal if next block is a cost-centre or we're at the end
                        const next = contentBlocks[blockIdx + 1];
                        return !next || next.kind === "cost-centre";
                      };

                      return (
                        <div className="border-b">
                          {contentBlocks.map((block, blockIdx) => {
                            if (block.kind === "cost-centre") {
                              // If previous cost centre needs a subtotal, it was already rendered inline
                              const ccKey = `${sKey}::cc::${block.name}`;
                              activeCostCentreKey = ccKey;
                              activeCCName = block.name;
                              const isCCCollapsed = collapsedCostCentres.has(ccKey);
                              const hasSubtotal = ccSubtotalEnabled.has(ccKey);
                              // Extract just the descriptive part of the cost centre name (strip leading code like "100 - ")
                              const ccDisplayName = block.name.replace(/^\d+\s*[-–—]\s*/, "").trim();
                              return (
                                <div key={`cc-${block.name}-${blockIdx}`} className="flex bg-muted">
                                  {/* Left: builder cost centre row */}
                                  <div
                                    className="w-3/5 min-w-0 flex items-center border-b border-border/50 pl-8 pr-2 py-1 cursor-pointer hover:bg-accent"
                                    onClick={() => toggleCostCentre(ccKey)}
                                  >
                                    <div className="shrink-0 w-5">
                                      {isCCCollapsed
                                        ? <ChevronRight className="h-3 w-3 text-muted-foreground" />
                                        : <ChevronDown className="h-3 w-3 text-muted-foreground" />
                                      }
                                    </div>
                                    <span className="flex-1 text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                                      {block.name}
                                    </span>
                                    {/* Toggle subtotal in tender preview */}
                                    <button
                                      type="button"
                                      onClick={(e) => { e.stopPropagation(); toggleCCSubtotal(ccKey); }}
                                      className={cn(
                                        "text-[10px] px-1.5 py-0.5 rounded border",
                                        hasSubtotal
                                          ? "bg-primary/10 border-primary/30 text-primary font-medium"
                                          : "border-transparent text-muted-foreground/50 hover:text-muted-foreground hover:border-border",
                                      )}
                                      title={hasSubtotal ? "Remove subtotal from tender" : "Show subtotal in tender"}
                                    >
                                      Subtotal
                                    </button>
                                    {/* Add PO to this cost centre */}
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="h-5 ml-1 px-1.5 text-[10px] font-medium gap-0.5 opacity-60 hover:opacity-100 transition-opacity"
                                      title={`Add PO to ${block.name}`}
                                      onClick={(e) => { e.stopPropagation(); handleAddPO(block.name, sectionRow.name); }}
                                    >
                                      <Plus className="h-3 w-3" />
                                      PO
                                    </Button>
                                  </div>
                                  {/* Right: preview heading when subtotal is enabled */}
                                  <div className="w-2/5 min-w-0 border-l border-b border-border/50">
                                    {hasSubtotal && (
                                      <div className="px-4 py-1 flex items-center">
                                        <span className="text-[11px] font-semibold uppercase tracking-wider text-primary/80">
                                          {ccDisplayName}
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            }

                            // Hide PO groups when their cost centre is collapsed
                            if (activeCostCentreKey && collapsedCostCentres.has(activeCostCentreKey)) {
                              return null;
                            }

                            const showCCSubAfter = shouldShowCCSubtotal(blockIdx);
                            const pg = block.pg;
                            const poKey = `${sKey}::${pg.poRow.poId}`;
                            const isPOCollapsed = collapsedPOs.has(poKey);
                            const includedItems = pg.items.filter((r) => !excludedIds.has(r.key));
                            const poLevelCls = getPOClassification(pg.poRow.poId);
                            const isInCCWithSubtotal = activeCostCentreKey && ccSubtotalEnabled.has(activeCostCentreKey);

                            // Pre-compute PO-level roll-up data for preview
                            const poRollup = (() => {
                              if (poLevelCls === "per_item") return null;
                              const isPcPs = poLevelCls === "per_po_pc" || poLevelCls === "per_po_ps";
                              // PC/PS items show at cost; non-PC/PS get tender markup
                              const poTotal = isPcPs
                                ? includedItems.reduce((sum, r) => sum + r.amount, 0)
                                : includedItems.reduce((sum, r) => {
                                    if (tenderMarkupPercent > 0) {
                                      return sum + applySmartRoundup(r.unitPrice * (1 + tenderMarkupPercent / 100)) * r.quantity;
                                    }
                                    return sum + r.amount;
                                  }, 0);
                              const cleanName = cleanTaskName(pg.poRow.taskName) || pg.poRow.poName;
                              const label = poLevelCls === "per_po_pc" ? "PC" : poLevelCls === "per_po_ps" ? "PS" : "";
                              const colorClass = poLevelCls === "per_po_pc"
                                ? "text-blue-700 dark:text-blue-400"
                                : poLevelCls === "per_po_ps"
                                  ? "text-violet-700 dark:text-violet-400"
                                  : "";
                              return { poTotal, cleanName, isPcPs, label, colorClass };
                            })();
                            let shownPORollup = false;
                            const previewPad = isInCCWithSubtotal ? "pl-8 pr-4" : "px-4";

                            return (
                              <Fragment key={poKey}>
                              <div>
                                {/* PO header row — spans both panels */}
                                <div className="flex bg-gray-100 dark:bg-zinc-800/60">
                                  <div
                                    className={cn(
                                      "w-3/5 min-w-0 grid items-center border-b border-border/60 cursor-pointer hover:bg-muted/60 py-1.5",
                                      poLevelCls === "per_po_incl" && "!bg-emerald-50 dark:!bg-emerald-950/30 border-emerald-200 dark:border-emerald-800",
                                      poLevelCls === "per_po_incl_qty" && "!bg-cyan-50 dark:!bg-cyan-950/30 border-cyan-200 dark:border-cyan-800",
                                      poLevelCls === "per_po_nt" && "!bg-amber-50 dark:!bg-amber-950/30 border-amber-200 dark:border-amber-800",
                                      poLevelCls === "per_po_exc" && "!bg-orange-50 dark:!bg-orange-950/30 border-orange-200 dark:border-orange-800 opacity-40",
                                      poLevelCls === "per_po_pc" && "!bg-blue-50 dark:!bg-blue-950/30 border-blue-200 dark:border-blue-800",
                                      poLevelCls === "per_po_ps" && "!bg-violet-50 dark:!bg-violet-950/30 border-violet-200 dark:border-violet-800",
                                    )}
                                    style={{ gridTemplateColumns: "36px 1fr auto 76px" }}
                                    onClick={() => togglePO(poKey)}
                                  >
                                    <div className="pl-4">
                                      {isPOCollapsed
                                        ? <ChevronRight className="h-3 w-3 text-muted-foreground" />
                                        : <ChevronDown className="h-3 w-3 text-muted-foreground" />
                                      }
                                    </div>
                                    <div className="px-2">
                                      <span className="font-semibold text-xs">{pg.poRow.poName}</span>
                                      {pg.poRow.taskName && (
                                        <span className="ml-2 text-xs text-muted-foreground">{pg.poRow.taskName}</span>
                                      )}
                                      {pg.poRow.supplierName && (
                                        <span className="ml-2 text-xs text-muted-foreground">{pg.poRow.supplierName.toUpperCase()}</span>
                                      )}
                                      {pg.poRow.tradeName && (
                                        <span className="ml-2 text-[10px] text-muted-foreground">{pg.poRow.tradeName}</span>
                                      )}
                                      {pg.poRow.costCentreName && (
                                        <span className="ml-2 text-[10px] text-muted-foreground">{pg.poRow.costCentreName}</span>
                                      )}
                                      <span className="ml-2 text-[10px] text-muted-foreground">{pg.poRow.itemCount} Items</span>
                                    </div>
                                    <div />
                                    {/* PO-level classification dropdown */}
                                    <div className="px-1" onClick={(e) => e.stopPropagation()}>
                                      <select
                                        value={poLevelCls}
                                        onChange={(e) => setPOClassification(pg.poRow.poId, e.target.value as POClassification)}
                                        className={cn(
                                          "w-full h-6 text-[10px] rounded border bg-transparent cursor-pointer",
                                          "focus:outline-none focus:ring-1 focus:ring-primary/20",
                                          poLevelCls === "per_item" && "border-border/60 text-muted-foreground",
                                          poLevelCls === "per_po_incl" && "border-emerald-400 text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-950/50 font-medium",
                                          poLevelCls === "per_po_incl_qty" && "border-cyan-400 text-cyan-700 dark:text-cyan-400 bg-cyan-100 dark:bg-cyan-950/50 font-medium",
                                          poLevelCls === "per_po_nt" && "border-amber-400 text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-950/50 font-medium",
                                          poLevelCls === "per_po_exc" && "border-orange-400 text-orange-700 dark:text-orange-400 bg-orange-100 dark:bg-orange-950/50 font-medium",
                                          poLevelCls === "per_po_pc" && "border-blue-400 text-blue-700 dark:text-blue-400 bg-blue-100 dark:bg-blue-950/50 font-medium",
                                          poLevelCls === "per_po_ps" && "border-violet-400 text-violet-700 dark:text-violet-400 bg-violet-100 dark:bg-violet-950/50 font-medium",
                                        )}
                                      >
                                        <option value="per_item">Per Item</option>
                                        <option value="per_po_incl">PO Incl</option>
                                        <option value="per_po_incl_qty">PO Incl Qty</option>
                                        <option value="per_po_nt">PO NT</option>
                                        <option value="per_po_exc">PO Exc</option>
                                        <option value="per_po_pc">PO PC</option>
                                        <option value="per_po_ps">PO PS</option>
                                      </select>
                                    </div>
                                  </div>
                                  {/* Right: empty for PO header */}
                                  <div className="w-2/5 min-w-0 border-l border-b border-border/60" />
                                </div>

                                {/* PO item rows — each row spans both panels for perfect alignment */}
                                {!isPOCollapsed && pg.items.map((row) => {
                                  const isExcluded = excludedIds.has(row.key);
                                  const isNewLine = row.isNewLine || false;
                                  const isDirty = !isNewLine && editOverrides.has(row.key);

                                  const poCls = getPOClassification(pg.poRow.poId);
                                  const cls = getClassification(row.key, row.poId, row.sectionName);

                                  // Compute preview content for this row
                                  let previewContent: React.ReactNode = null;
                                  if (!isExcluded && cls !== "excluded") {
                                    if (poRollup) {
                                      // PO-level roll-up: first non-excluded item shows the summary
                                      if (!shownPORollup) {
                                        shownPORollup = true;
                                        previewLineNum++;
                                        if (poRollup.isPcPs) {
                                          previewContent = (
                                            <div className={cn("flex items-center gap-2", previewPad)}>
                                              <span className="text-[11px] text-muted-foreground/60 w-5 text-right shrink-0 tabular-nums">{previewLineNum}.</span>
                                              <span className={cn("flex-1 truncate text-[13px] font-medium", poRollup.colorClass)}>{poRollup.label} {poRollup.cleanName}</span>
                                              <span className={cn("text-right tabular-nums font-mono text-[13px] shrink-0 ml-2 font-medium", poRollup.colorClass)}>{formatCurrency(poRollup.poTotal)}</span>
                                            </div>
                                          );
                                        } else if (poLevelCls !== "per_po_nt") {
                                          previewContent = (
                                            <div className={cn("flex items-center gap-2", previewPad)}>
                                              <span className="text-[11px] text-muted-foreground/60 w-5 text-right shrink-0 tabular-nums">{previewLineNum}.</span>
                                              <span className="flex-1 truncate text-[13px]">{poRollup.cleanName}</span>
                                            </div>
                                          );
                                        }
                                        // per_po_nt: no preview content (hidden from tender)
                                      }
                                    } else {
                                      // Item-level classification
                                      const itemCls = getClassification(row.key, row.poId, row.sectionName);
                                      if (itemCls !== "incl_hidden" && itemCls !== "excluded") {
                                        previewLineNum++;
                                        if (itemCls === "incl_qty") {
                                          previewContent = (
                                            <div className={cn("flex items-center gap-2", previewPad)}>
                                              <span className="text-[11px] text-muted-foreground/60 w-5 text-right shrink-0 tabular-nums">{previewLineNum}.</span>
                                              <span className="flex-1 truncate text-[13px]">
                                                <span className="font-medium tabular-nums">{row.quantity}x</span>{" "}
                                                {row.description || "—"}
                                              </span>
                                            </div>
                                          );
                                        } else if (itemCls === "pc") {
                                          previewContent = (
                                            <div className={cn("flex items-center gap-2", previewPad)}>
                                              <span className="text-[11px] text-muted-foreground/60 w-5 text-right shrink-0 tabular-nums">{previewLineNum}.</span>
                                              <span className="flex-1 truncate text-[13px]">
                                                <span className="text-blue-700 dark:text-blue-400 mr-1.5">PC</span>
                                                {cleanTaskName(row.taskName) || row.description || "—"}
                                              </span>
                                              <span className="text-right tabular-nums font-mono text-[13px] shrink-0 ml-2 text-blue-700 dark:text-blue-400">{formatCurrency(row.amount)}</span>
                                            </div>
                                          );
                                        } else if (itemCls === "ps") {
                                          previewContent = (
                                            <div className={cn("flex items-center gap-2", previewPad)}>
                                              <span className="text-[11px] text-muted-foreground/60 w-5 text-right shrink-0 tabular-nums">{previewLineNum}.</span>
                                              <span className="flex-1 truncate text-[13px]">
                                                <span className="text-violet-700 dark:text-violet-400 mr-1.5">PS</span>
                                                {cleanTaskName(row.taskName) || row.description || "—"}
                                              </span>
                                              <span className="text-right tabular-nums font-mono text-[13px] shrink-0 ml-2 text-violet-700 dark:text-violet-400">{formatCurrency(row.amount)}</span>
                                            </div>
                                          );
                                        } else {
                                          previewContent = (
                                            <div className={cn("flex items-center gap-2", previewPad)}>
                                              <span className="text-[11px] text-muted-foreground/60 w-5 text-right shrink-0 tabular-nums">{previewLineNum}.</span>
                                              <span className="flex-1 truncate text-[13px]">{row.description || "—"}</span>
                                            </div>
                                          );
                                        }
                                      }
                                    }
                                  }

                                  return (
                                    <div key={row.key} className="flex relative z-10">
                                      {/* Left: builder item */}
                                      <div
                                        className={cn(
                                          "w-3/5 grid items-center border-b border-border/30 hover:bg-muted/20 transition-colors text-sm overflow-visible",
                                          (isExcluded || cls === "excluded") && "opacity-40",
                                          isNewLine && "!bg-green-50 dark:!bg-green-950/30",
                                          cls === "excluded" && "!bg-orange-50/50 dark:!bg-orange-950/20",
                                          cls === "incl_qty" && "!bg-cyan-50/50 dark:!bg-cyan-950/20",
                                          cls === "incl_hidden" && "!bg-amber-50/50 dark:!bg-amber-950/20",
                                          cls === "pc" && "!bg-blue-50/50 dark:!bg-blue-950/20",
                                          cls === "ps" && "!bg-violet-50/50 dark:!bg-violet-950/20",
                                        )}
                                        style={{ gridTemplateColumns: "10% 1fr 8% 10% 14% 60px" }}
                                      >
                                        {/* Code */}
                                        <div className={cn("px-2 py-1 text-xs font-mono text-muted-foreground flex items-center gap-1 bg-muted/40 min-w-0 overflow-hidden", isExcluded && "line-through")}>
                                          {isExcluded ? (
                                            <span className="truncate">{row.pricebookCode || "—"}</span>
                                          ) : (
                                            <PricebookItemEditor
                                              mode="code"
                                              currentValue={row.pricebookCode || ""}
                                              supplierId={pg.poRow.supplierId}
                                              isDirty={isNewLine ? !!row.pricebookCode : isDirty}
                                              onSelect={(selected) => {
                                                if (isNewLine) {
                                                  setNewLines((prev) =>
                                                    prev.map((nl) =>
                                                      nl.tempId === row.key
                                                        ? {
                                                            ...nl,
                                                            description: selected.description,
                                                            unitPrice: selected.unitPrice,
                                                            pricebookItemId: selected.pricebookItemId,
                                                            pricebookItemCode: selected.pricebookItemCode,
                                                          }
                                                        : nl
                                                    )
                                                  );
                                                } else {
                                                  updateOverride(row.key, "description", selected.description);
                                                  updateOverride(row.key, "unitPrice", selected.unitPrice);
                                                }
                                              }}
                                            />
                                          )}
                                        </div>

                                        {/* Description */}
                                        <div className={cn("px-1 py-1 min-w-0", !isExcluded && "overflow-visible")}>
                                          {isExcluded ? (
                                            <span className="text-sm line-through">{row.description}</span>
                                          ) : isNewLine ? (
                                            searchingDescriptionKey === row.key ? (
                                              <PricebookLineSearch
                                                value={row.description}
                                                supplierId={pg.poRow.supplierId}
                                                onChange={(val) => updateNewLine(row.key, "description", val)}
                                                onSelect={(item) => {
                                                  setNewLines((prev) =>
                                                    prev.map((nl) =>
                                                      nl.tempId === row.key
                                                        ? {
                                                            ...nl,
                                                            description: item.description,
                                                            unitPrice: item.unitPrice,
                                                            pricebookItemId: item.pricebookItemId,
                                                            pricebookItemCode: item.pricebookItemCode,
                                                          }
                                                        : nl
                                                    )
                                                  );
                                                  setSearchingDescriptionKey(null);
                                                }}
                                              />
                                            ) : (
                                              <div className="flex gap-1">
                                                <Input
                                                  value={row.description}
                                                  onChange={(e) => updateNewLine(row.key, "description", e.target.value)}
                                                  placeholder="Type description..."
                                                  className="h-7 text-sm border-green-500"
                                                />
                                                <button
                                                  type="button"
                                                  onClick={() => setSearchingDescriptionKey(row.key)}
                                                  className="shrink-0 h-7 w-7 inline-flex items-center justify-center rounded border border-input bg-muted text-muted-foreground hover:text-foreground transition-colors"
                                                  title="Search pricebook by description"
                                                >
                                                  <Search className="h-3.5 w-3.5" />
                                                </button>
                                              </div>
                                            )
                                          ) : (
                                            <PricebookItemEditor
                                              mode="description"
                                              currentValue={row.description}
                                              supplierId={pg.poRow.supplierId}
                                              isDirty={isDirty}
                                              onSelect={(selected) => {
                                                updateOverride(row.key, "description", selected.description);
                                                updateOverride(row.key, "unitPrice", selected.unitPrice);
                                              }}
                                            />
                                          )}
                                        </div>

                                        {/* Qty */}
                                        <div className="px-1 py-1">
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
                                        </div>

                                        {/* Unit Price */}
                                        <div className="px-1 py-1">
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
                                        </div>

                                        {/* Amount (with GST prefix) */}
                                        <div className={cn(
                                          "text-right px-2 py-1 text-sm font-mono tabular-nums flex items-center justify-end gap-1",
                                          isExcluded && "line-through",
                                          isDirty && "font-semibold text-amber-700 dark:text-amber-400",
                                          isNewLine && "font-semibold text-green-700 dark:text-green-400",
                                        )}>
                                          <span>{formatCurrency(row.amount)}</span>
                                          <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-6 w-6 text-destructive/60 hover:text-destructive"
                                            onClick={() => {
                                              if (isNewLine) {
                                                removeNewLine(row.key);
                                              } else {
                                                setClassification(row.key, isExcluded || cls === "excluded" ? "included" : "excluded");
                                              }
                                            }}
                                            title={isNewLine ? "Remove line" : (isExcluded || cls === "excluded" ? "Include line" : "Exclude line")}
                                          >
                                            <X className="h-3.5 w-3.5" />
                                          </Button>
                                        </div>

                                        {/* Classification dropdown — disabled when PO-level is set */}
                                        <div className="px-1 py-1">
                                          <select
                                            value={cls}
                                            disabled={poCls !== "per_item"}
                                            onChange={(e) => setClassification(row.key, e.target.value as TenderClassification)}
                                            className={cn(
                                              "w-full h-6 text-[10px] rounded border bg-transparent cursor-pointer",
                                              "focus:outline-none focus:ring-1 focus:ring-primary/20",
                                              poCls !== "per_item" && "!opacity-40 cursor-not-allowed",
                                              cls === "included" && "border-transparent text-muted-foreground",
                                              cls === "incl_qty" && "border-cyan-400 text-cyan-700 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-950/30",
                                              cls === "excluded" && "border-orange-400 text-orange-700 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/30",
                                              cls === "incl_hidden" && "border-amber-400 text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30",
                                              cls === "pc" && "border-blue-400 text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/30",
                                              cls === "ps" && "border-violet-400 text-violet-700 dark:text-violet-400 bg-violet-50 dark:bg-violet-950/30",
                                            )}
                                          >
                                            <option value="included">Incl</option>
                                            <option value="incl_qty">Incl Qty</option>
                                            <option value="excluded">Exc</option>
                                            <option value="incl_hidden">Incl NT</option>
                                            <option value="pc">PC</option>
                                            <option value="ps">PS</option>
                                          </select>
                                        </div>
                                      </div>

                                      {/* Right: preview for this item */}
                                      <div className="w-2/5 min-w-0 border-l bg-stone-50/80 dark:bg-zinc-900/30 flex items-center border-b border-border/30">
                                        {previewContent}
                                      </div>
                                    </div>
                                  );
                                })}

                                {/* PO footer row — spans both panels */}
                                {!isPOCollapsed && pg.footer && (
                                  <div className="flex">
                                    <div className="w-3/5 min-w-0 flex items-center border-b-2 border-border bg-muted/10 py-1">
                                      <div className="pl-10">
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          className="gap-1 h-6 text-xs text-muted-foreground hover:text-foreground"
                                          onClick={() => addNewLine(pg.poRow.poId, pg.footer!.headerName, pg.footer!.sectionName, pg.poRow.costCentreName)}
                                        >
                                          <Plus className="h-3 w-3" />
                                          Add Line
                                        </Button>
                                      </div>
                                      <div className="flex-1 flex items-center justify-end gap-4 pr-2">
                                        <span className="text-xs font-medium text-muted-foreground">
                                          {pg.footer.poName} total:
                                        </span>
                                        <span className="text-sm font-mono font-semibold tabular-nums">
                                          {formatCurrency(pg.footer.subtotal)}
                                        </span>
                                        <span className="text-xs text-muted-foreground tabular-nums">
                                          GST {formatCurrency(pg.footer.subtotal * 0.1)}
                                        </span>
                                        <span className="text-sm font-mono font-bold tabular-nums">
                                          {formatCurrency(pg.footer.subtotal * 1.1)}
                                        </span>
                                      </div>
                                    </div>
                                    <div className="w-2/5 min-w-0 border-l bg-stone-50/80 dark:bg-zinc-900/30 border-b-2 border-border" />
                                  </div>
                                )}
                              </div>
                              {/* Cost centre subtotal in preview — after last PO in this cost centre */}
                              {showCCSubAfter && activeCostCentreKey && (
                                <div className="flex">
                                  <div className="w-3/5 min-w-0" />
                                  <div className="w-2/5 min-w-0 border-l bg-stone-50/80 dark:bg-zinc-900/30 pl-8 pr-4">
                                    <div className="flex items-baseline justify-between gap-3 py-1.5 border-t border-dashed border-primary/30">
                                      <span className="text-[10px] text-primary/70 font-medium uppercase">
                                        {(activeCCName || "").replace(/^\d+\s*[-–—]\s*/, "").trim()} subtotal
                                      </span>
                                      <span className="text-[12px] font-semibold tabular-nums font-mono">
                                        {formatCurrency(ccSubtotals.get(activeCostCentreKey) || 0)}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </Fragment>
                            );
                          })}

                          {/* Section subtotal in preview */}
                          <div className="flex">
                            <div className="w-3/5 min-w-0" />
                            <div className="w-2/5 min-w-0 border-l bg-stone-50/80 dark:bg-zinc-900/30 px-4">
                              <div className="flex items-baseline justify-end gap-3 py-2 border-t border-muted-foreground/15">
                                <span className="text-xs text-muted-foreground">{sectionRow.name}</span>
                                <span className="text-[13px] font-semibold tabular-nums font-mono">
                                  {formatCurrency(includedSubtotal)}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Section note editor (for sections with PO items) */}
                          <div className="flex border-t border-dashed border-amber-300/50 dark:border-amber-700/50">
                            {/* Left: compact note editor */}
                            <div className="w-3/5 min-w-0 px-4 py-2 bg-amber-50/30 dark:bg-amber-950/10">
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="text-[10px] shrink-0 border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-400">
                                  Note
                                </Badge>
                                <input
                                  type="text"
                                  value={getSectionNote(sectionRow.name)}
                                  onChange={(e) => updateSectionNote(sectionRow.name, e.target.value)}
                                  placeholder="Add a note for this section..."
                                  className={cn(
                                    "flex-1 bg-transparent text-sm px-2 py-1 rounded border",
                                    "hover:border-border focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/20",
                                    sectionNotes.has(sectionRow.name)
                                      ? "border-amber-300 dark:border-amber-700"
                                      : "border-transparent",
                                  )}
                                />
                              </div>
                            </div>
                            {/* Right: note preview */}
                            <div className="w-2/5 min-w-0 border-l bg-stone-50/80 dark:bg-zinc-900/30 px-4 py-2 flex items-center">
                              {getSectionNote(sectionRow.name) && (
                                <span className="text-[12px] text-muted-foreground italic leading-snug">
                                  {getSectionNote(sectionRow.name)}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                );
              })}
            </div>
          );
        })}

        {/* Grand totals — matches TenderDocumentView PriceSummaryBlock (SSoT) */}
        <div className="border-t-2 border-primary/30 bg-muted/30 px-4 py-4">
          {/* Header breakdown — sorted to match tender tree order */}
          {Object.keys(totals.headerSubtotals).length > 0 && (
            <>
              {Object.entries(totals.headerSubtotals)
                .sort(([a], [b]) => {
                  const treeOrder = new Map(tenderTree.map((h, i) => [h.name, i]));
                  return (treeOrder.get(a) ?? 999) - (treeOrder.get(b) ?? 999);
                })
                .map(([headerName, subtotal]) => (
                <div key={headerName} className="flex justify-between items-baseline py-0.5">
                  <span className="text-sm">{headerName.replace(/^\d+\s*[-–—]\s*/, "").trim()}</span>
                  <span className="tabular-nums text-sm w-32 text-right">{formatCurrency(subtotal)}</span>
                </div>
              ))}
              <div className="border-t border-border/50 my-2" />
            </>
          )}

          {/* Base Price (excluding PC & PS) — shows SELL price with markup */}
          <div className="flex justify-between items-baseline py-1">
            <div>
              <span className="font-semibold text-sm">Base Price (ex GST)</span>
              {(totals.pcCount > 0 || totals.psCount > 0) && (
                <span className="text-xs text-muted-foreground ml-1.5">excl. Prime Costs &amp; Provisional Sums</span>
              )}
            </div>
            <span className="font-semibold tabular-nums text-sm w-32 text-right">{formatCurrency(totals.includedSellTotal)}</span>
          </div>

          {/* Tender Markup info line */}
          {(tenderMarkupPercent > 0 || tenderMarkupOverride !== null) && (
            <div className="py-1">
              <div className="flex justify-between items-center">
                <button
                  type="button"
                  onClick={() => setShowMarkupEditor(!showMarkupEditor)}
                  className="flex items-center gap-1.5 text-sm text-emerald-700 dark:text-emerald-400 hover:underline"
                >
                  <Percent className="h-3 w-3" />
                  {tenderMarkupOverride !== null ? (
                    <span>Tender Markup (fixed override)</span>
                  ) : (
                    <span>incl. Tender Markup ({tenderMarkupPercent}%)</span>
                  )}
                  <Pencil className="h-3 w-3 opacity-50" />
                </button>
                <span className="tabular-nums text-sm w-32 text-right text-emerald-700 dark:text-emerald-400">
                  +{formatCurrency(totals.markupAmount)}
                </span>
              </div>

              {/* Inline markup editor */}
              {showMarkupEditor && (
                <div className="mt-2 p-3 rounded-lg bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200/50 dark:border-emerald-800/30 space-y-2">
                  <div className="flex items-center gap-3">
                    <label className="text-xs font-medium text-muted-foreground w-20">Markup %</label>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      step={0.5}
                      value={tenderMarkupPercent}
                      onChange={(e) => {
                        setTenderMarkupPercent(parseFloat(e.target.value) || 0);
                        setTenderMarkupOverride(null); // clear fixed override when changing %
                      }}
                      className="h-7 w-24 text-sm tabular-nums"
                    />
                    <span className="text-xs text-muted-foreground">
                      Cost: {formatCurrency(totals.includedTotal)} → Sell: {formatCurrency(totals.includedSellTotal)}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <label className="text-xs font-medium text-muted-foreground w-20">Fixed $ override</label>
                    <Input
                      type="number"
                      min={0}
                      step={100}
                      value={tenderMarkupOverride ?? ""}
                      placeholder="—"
                      onChange={(e) => {
                        const val = e.target.value;
                        setTenderMarkupOverride(val === "" ? null : parseFloat(val) || 0);
                      }}
                      className="h-7 w-24 text-sm tabular-nums"
                    />
                    <span className="text-xs text-muted-foreground">
                      {tenderMarkupOverride !== null ? "Overrides % calculation" : "Leave blank to use %"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 pt-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 text-xs gap-1"
                      onClick={() => {
                        setTenderMarkupPercent(defaultMarkupPercent);
                        setTenderMarkupOverride(null);
                      }}
                    >
                      <RotateCcw className="h-3 w-3" />
                      Reset to template default ({defaultMarkupPercent}%)
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Show markup toggle when it's 0% and no override (so user can enable it) */}
          {tenderMarkupPercent === 0 && tenderMarkupOverride === null && (
            <button
              type="button"
              onClick={() => setShowMarkupEditor(!showMarkupEditor)}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground py-0.5"
            >
              <Percent className="h-3 w-3" />
              Add tender markup
            </button>
          )}
          {tenderMarkupPercent === 0 && tenderMarkupOverride === null && showMarkupEditor && (
            <div className="mt-1 mb-2 p-3 rounded-lg bg-muted/50 border border-border/50 space-y-2">
              <div className="flex items-center gap-3">
                <label className="text-xs font-medium text-muted-foreground w-20">Markup %</label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  step={0.5}
                  value={tenderMarkupPercent}
                  onChange={(e) => setTenderMarkupPercent(parseFloat(e.target.value) || 0)}
                  className="h-7 w-24 text-sm tabular-nums"
                />
              </div>
              {defaultMarkupPercent > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-xs gap-1"
                  onClick={() => setTenderMarkupPercent(defaultMarkupPercent)}
                >
                  <RotateCcw className="h-3 w-3" />
                  Use template default ({defaultMarkupPercent}%)
                </Button>
              )}
            </div>
          )}

          {/* Prime Costs */}
          {totals.pcCount > 0 && (
            <div className="flex justify-between items-baseline py-0.5">
              <span className="text-sm text-blue-700 dark:text-blue-400">
                + Prime Costs ({totals.pcCount} {totals.pcCount === 1 ? "item" : "items"})
              </span>
              <span className="tabular-nums text-sm w-32 text-right text-blue-700 dark:text-blue-400">{formatCurrency(totals.pcTotal)}</span>
            </div>
          )}

          {/* Provisional Sums */}
          {totals.psCount > 0 && (
            <div className="flex justify-between items-baseline py-0.5">
              <span className="text-sm text-violet-700 dark:text-violet-400">
                + Provisional Sums ({totals.psCount} {totals.psCount === 1 ? "item" : "items"})
              </span>
              <span className="tabular-nums text-sm w-32 text-right text-violet-700 dark:text-violet-400">{formatCurrency(totals.psTotal)}</span>
            </div>
          )}

          {/* Contract Sum (only shown when there are PC or PS items) */}
          {(totals.pcCount > 0 || totals.psCount > 0) && (
            <div className="flex justify-between items-baseline py-1 border-t border-border/50 mt-1">
              <span className="text-sm font-medium">Contract Sum (ex GST)</span>
              <span className="font-medium tabular-nums text-sm w-32 text-right">
                {formatCurrency(totals.includedSellTotal + totals.pcTotal + totals.psTotal)}
              </span>
            </div>
          )}

          {/* GST */}
          <div className="flex justify-between items-baseline py-0.5">
            <span className="text-muted-foreground text-sm">GST (10%)</span>
            <span className="text-muted-foreground tabular-nums text-sm w-32 text-right">
              {formatCurrency((totals.includedSellTotal + totals.pcTotal + totals.psTotal) * 0.1)}
            </span>
          </div>

          {/* Total */}
          <div className="flex justify-between items-baseline py-2 border-t mt-1">
            <span className="font-bold text-base">Total (inc GST)</span>
            <span className="font-bold text-base tabular-nums w-32 text-right">
              {formatCurrency((totals.includedSellTotal + totals.pcTotal + totals.psTotal) * 1.1)}
            </span>
          </div>

        </div>
      </div>

      {/* Bottom bar */}
      <div className="flex items-center justify-between gap-3 pt-3 border-t mt-3 shrink-0">
        <div className="flex items-center gap-4 text-sm">
          <span className="text-muted-foreground">
            Included: <span className="font-medium text-foreground">{totals.includedCount} lines</span>
            {" "}({formatCurrency(totals.includedSellTotal)})
          </span>
          {totals.pcCount > 0 && (
            <>
              <span className="text-muted-foreground">|</span>
              <span className="text-blue-600 dark:text-blue-400">
                PC: {totals.pcCount} ({formatCurrency(totals.pcTotal)})
              </span>
            </>
          )}
          {totals.psCount > 0 && (
            <>
              <span className="text-muted-foreground">|</span>
              <span className="text-violet-600 dark:text-violet-400">
                PS: {totals.psCount} ({formatCurrency(totals.psTotal)})
              </span>
            </>
          )}
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
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={handleSaveBuilderState}
            disabled={savingBuilder}
            className="gap-2"
          >
            {savingBuilder ? <Spinner size={16} /> : <Save className="h-4 w-4" />}
            Save
          </Button>
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

      {/* Add PO Dialog */}
      <Dialog open={showAddPOModal} onOpenChange={setShowAddPOModal}>
        <DialogContent className="sm:max-w-lg p-0 gap-0 overflow-hidden">
          <DialogHeader className="px-5 pt-5 pb-3">
            <DialogTitle className="text-base">
              New Purchase Order
            </DialogTitle>
            <p className="text-sm text-muted-foreground mt-0.5">
              {addPOContext.costCentreName}
              <span className="mx-1.5 text-muted-foreground/40">&rarr;</span>
              {addPOContext.sectionName}
            </p>
          </DialogHeader>

          <div className="px-5 pb-5 space-y-4">
            {/* Task selection */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Task</Label>
              {loadingTasks ? (
                <div className="flex items-center gap-2 py-8 justify-center text-muted-foreground">
                  <Spinner size={16} />
                  <span className="text-sm">Loading tasks...</span>
                </div>
              ) : sectionTasks.length === 0 ? (
                <div className="rounded-lg border border-dashed py-8 text-center">
                  <p className="text-sm text-muted-foreground">
                    No tasks with PO Required found
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Check that tasks are assigned to this cost centre and tender section
                  </p>
                </div>
              ) : (
                <div className="space-y-1 max-h-[280px] overflow-y-auto rounded-lg border p-1">
                  {sectionTasks.map((task) => {
                    const hasPO = task.has_existing_po;
                    const isSelected = selectedTaskId === task.id;
                    return (
                      <button
                        key={task.id}
                        type="button"
                        disabled={hasPO}
                        className={cn(
                          "w-full flex items-center gap-3 rounded-md px-3 py-2.5 text-left transition-all",
                          hasPO
                            ? "opacity-40 cursor-not-allowed"
                            : isSelected
                              ? "bg-primary/10 ring-1 ring-primary/40"
                              : "hover:bg-muted/60 cursor-pointer"
                        )}
                        onClick={() => !hasPO && setSelectedTaskId(task.id)}
                      >
                        <div className={cn(
                          "h-4 w-4 rounded-full border-2 shrink-0 flex items-center justify-center transition-colors",
                          hasPO
                            ? "border-muted-foreground/30"
                            : isSelected
                              ? "border-primary bg-primary"
                              : "border-muted-foreground/40"
                        )}>
                          {isSelected && !hasPO && (
                            <div className="h-1.5 w-1.5 rounded-full bg-white" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className={cn("text-sm font-medium truncate", hasPO && "line-through")}>
                              {task.name}
                            </span>
                            {task.task_number && (
                              <span className="text-xs text-muted-foreground shrink-0">#{task.task_number}</span>
                            )}
                          </div>
                        </div>
                        {hasPO && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-medium text-muted-foreground bg-muted rounded-full px-2 py-0.5 shrink-0">
                            <Check className="h-2.5 w-2.5" />
                            Has PO
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Supplier selection */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Supplier</Label>
              <SupplierPicker
                value={selectedSupplier}
                onSelect={setSelectedSupplier}
                placeholder="Search suppliers..."
                clearable
              />
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 pt-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowAddPOModal(false)}
                disabled={creatingPO}
                className="text-muted-foreground"
              >
                Cancel
              </Button>
              <div className="flex-1" />
              <Button
                size="sm"
                onClick={() => handleCreatePO(false)}
                disabled={!selectedTaskId || !selectedSupplier || creatingPO}
              >
                {creatingPO ? <Spinner size={14} className="mr-2" /> : null}
                Create PO
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleCreatePO(true)}
                disabled={!selectedTaskId || !selectedSupplier || creatingPO}
              >
                <ExternalLink className="h-3 w-3 mr-1.5" />
                Create & Open
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default JobTenderBuilderTab;
