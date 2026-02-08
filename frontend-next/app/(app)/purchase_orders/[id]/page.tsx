"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { TASK_STATUS } from "@/lib/constants/task-status";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Spinner } from "@/components/ui/spinner";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ComboboxDropdown, type ComboboxItem } from "@/components/ui/combobox-dropdown";
import { SupplierPicker, type Supplier as SupplierPickerType } from "@/components/ui/supplier-picker";
import { PricebookCodePicker, type PricebookItem as PricebookPickerType } from "@/components/ui/pricebook-code-picker";
import { BackButton } from "@/components/ui/back-button";
import {
  DollarSign,
  Building2,
  Calendar,
  FileText,
  Trash2,
  ChevronsUpDown,
  Check,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Lock,
  Unlock,
  ListTodo,
  ExternalLink,
  Clock,
  Users,
  FolderOpen,
  Printer,
  Eye,
  Save,
  Send,
  Paperclip,
  Files,
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { api, getApiBaseUrl } from "@/lib/api";
import { getStorageItem, STORAGE_KEYS } from "@/lib/storage-utils";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/utils/formatters";
import {
  type PurchaseOrder,
  type POSupplier as Supplier,
  type POPricebookItem as PricebookItem,
  type POLineItem as LineItem,
  type POJob as Job,
  type POSmTask as SmTask,
  GST_CODES,
  getGstRate,
  STATUS_OPTIONS,
  STATUS_BADGE_VARIANTS,
} from "@/lib/constants/purchase-order-constants";

// Schedule Sync Preview Types
interface SyncTaskPredecessor {
  id: number;
  name: string;
  end_date?: string;
  status: string;
}

interface SyncLinkedTask {
  id: number;
  task_number: number;
  name: string;
  start_date?: string;
  end_date?: string;
  duration_days?: number;
  status: string;
  trade?: string;
  stage?: string;
  supplier_id?: number;
  supplier_name?: string;
  locked: boolean;
  lock_type?: string;
  confirm?: boolean;
  supplier_confirm?: boolean;
  hold?: boolean;
  is_blocker: boolean;
  blocker_reason?: string;
  predecessor_count: number;
  predecessors: SyncTaskPredecessor[];
  date_matches: boolean;
  date_diff_days?: number;
  supplier_matches: boolean;
}

interface SyncPreviewData {
  po: {
    id: number;
    purchase_order_number: string;
    required_date?: string;
    effective_required_date?: string;
    supplier_id?: number;
    supplier_name?: string;
    status: string;
  };
  linked_tasks: SyncLinkedTask[];
  sync_available: boolean;
  blockers: {
    type: string;
    task_id?: number;
    task_name?: string;
    message: string;
    severity: string;
  }[];
  sync_preview?: {
    will_update: {
      required_date?: {
        from?: string;
        to: string;
        diff_days?: number;
      };
      supplier?: {
        from?: string;
        to?: string;
      };
    };
    nothing_to_sync: boolean;
    source_task?: {
      id: number;
      name: string;
      task_number: number;
    };
  };
  summary: {
    status: string;
    message: string;
    can_sync: boolean;
  };
}

// ComboboxDropdown item type for tasks
interface TaskComboboxItem extends ComboboxItem {
  taskId: number; // SmTask.id - SSoT link
  start_date?: string; // SSoT: Used to auto-populate PO required_date
}


/**
 * Calculate payment due date based on supplier's payment terms
 * @param billDueDay - Number of days (e.g., 30 for Net 30)
 * @param billDueType - Type: DAYSAFTERBILLDATE, OFFOLLOWINGMONTH, etc.
 * @param fromDate - Base date (defaults to today)
 * @returns ISO date string (YYYY-MM-DD)
 */
function calculateDueDate(
  billDueDay: number | undefined,
  billDueType: string | undefined,
  fromDate?: Date
): string {
  if (!billDueDay) return "";

  const baseDate = fromDate || new Date();
  let dueDate: Date;

  switch (billDueType) {
    case "DAYSAFTERBILLDATE":
      // Add X days to the bill date
      dueDate = new Date(baseDate);
      dueDate.setDate(dueDate.getDate() + billDueDay);
      break;
    case "OFFOLLOWINGMONTH":
      // Xth day of the following month
      dueDate = new Date(baseDate);
      dueDate.setMonth(dueDate.getMonth() + 1);
      dueDate.setDate(Math.min(billDueDay, new Date(dueDate.getFullYear(), dueDate.getMonth() + 1, 0).getDate()));
      break;
    case "DAYSAFTERBILLMONTH":
      // X days after end of bill month
      dueDate = new Date(baseDate.getFullYear(), baseDate.getMonth() + 1, 0); // End of month
      dueDate.setDate(dueDate.getDate() + billDueDay);
      break;
    default:
      // Default: Net X days
      dueDate = new Date(baseDate);
      dueDate.setDate(dueDate.getDate() + billDueDay);
  }

  return dueDate.toISOString().split("T")[0];
}

export default function PurchaseOrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const recordId = params.id as string;

  const [purchaseOrder, setPurchaseOrder] = useState<PurchaseOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Performance: Track last fetch time and abort controller for deduplication
  const lastFetchTimeRef = useRef<number>(0);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Local SmTasks for this job (for task/description lookup)
  const [taskItems, setTaskItems] = useState<TaskComboboxItem[]>([]);
  const [loadingTasks, setLoadingTasks] = useState(false);

  // Schedule Sync modal state
  const [syncModalOpen, setSyncModalOpen] = useState(false);
  const [syncPreview, setSyncPreview] = useState<SyncPreviewData | null>(null);
  const [loadingSyncPreview, setLoadingSyncPreview] = useState(false);
  const [executingSync, setExecutingSync] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);

  // Editable fields
  const [description, setDescription] = useState("");
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null); // SSoT: SmTask.id
  const [status, setStatus] = useState("draft");
  const [budget, setBudget] = useState("");
  const [requiredDate, setRequiredDate] = useState("");
  const [dueDate, setDueDate] = useState(""); // Payment due date
  const [orderedDate, setOrderedDate] = useState("");
  const [notes, setNotes] = useState("");
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [lineItems, setLineItems] = useState<LineItem[]>([]);

  // Budget lockdown state
  const [budgetLocked, setBudgetLocked] = useState(false);
  const [budgetLockedBy, setBudgetLockedBy] = useState<string | null>(null);
  const [budgetLockedAt, setBudgetLockedAt] = useState<string | null>(null);
  const [lockingBudget, setLockingBudget] = useState(false);

  // PDF action states
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [previewHtml, setPreviewHtml] = useState<string>("");
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [savingPdf, setSavingPdf] = useState(false);
  const [sendModalOpen, setSendModalOpen] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);

  // Refresh prices confirmation dialog
  const [refreshPricesDialogOpen, setRefreshPricesDialogOpen] = useState(false);
  const [itemsToResetCount, setItemsToResetCount] = useState(0);

  const { toast } = useToast();

  // Original state for change tracking
  const [originalState, setOriginalState] = useState<{
    description: string;
    selectedTaskId: number | null;
    status: string;
    budget: string;
    requiredDate: string;
    dueDate: string;
    orderedDate: string;
    notes: string;
    selectedSupplier: Supplier | null;
    lineItems: LineItem[];
  } | null>(null);

  // Load purchase order
  useEffect(() => {
    loadPurchaseOrder();

    // Cleanup: abort pending requests on unmount or recordId change
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [recordId]);

  // Performance: Only refetch on window focus if it's been > 5 minutes since last fetch
  // This prevents slow page loads when switching tabs frequently
  useEffect(() => {
    const STALE_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

    const handleFocus = () => {
      const timeSinceLastFetch = Date.now() - lastFetchTimeRef.current;
      if (timeSinceLastFetch > STALE_THRESHOLD_MS) {
        console.log('[PO Detail] Window focused after stale period - reloading data');
        loadPurchaseOrder();
      }
    };

    window.addEventListener('focus', handleFocus);
    return () => {
      window.removeEventListener('focus', handleFocus);
    };

  }, [recordId]);

  // Fallback: Load SmTasks if not already loaded (parallel fetch in loadPurchaseOrder is primary)
  useEffect(() => {
    if (purchaseOrder?.job_id && taskItems.length === 0) {
      loadSmTasksForJob(purchaseOrder.job_id);
    }
  }, [purchaseOrder?.job_id, taskItems.length]);

  // SSoT: Auto-populate required date from linked task
  // This runs after taskItems are loaded, since loadPurchaseOrder runs before tasks load
  useEffect(() => {
    // Only auto-populate if:
    // 1. We have a selectedTaskId set
    // 2. requiredDate is still empty
    // 3. taskItems are loaded
    // 4. No direct sm_tasks are linked (those are handled in loadPurchaseOrder)
    if (
      selectedTaskId &&
      !requiredDate &&
      taskItems.length > 0 &&
      (!purchaseOrder?.sm_tasks || purchaseOrder.sm_tasks.length === 0)
    ) {
      const matchingTask = taskItems.find((t) => t.taskId === selectedTaskId);
      if (matchingTask?.start_date) {
        console.log('[PO Detail] Auto-populating required date from linked task:', matchingTask.start_date);
        setRequiredDate(matchingTask.start_date);
      }
    }
  }, [taskItems, selectedTaskId, requiredDate, purchaseOrder?.sm_tasks]);

  const loadPurchaseOrder = async () => {
    // Performance: Cancel any pending request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    try {
      setLoading(true);

      // Performance: Track fetch time for stale data checks
      lastFetchTimeRef.current = Date.now();

      const response = await api.get<PurchaseOrder>(`/api/v1/purchase_orders/${recordId}`);

      // Check if request was aborted
      if (abortControllerRef.current?.signal.aborted) {
        return;
      }

      setPurchaseOrder(response);

      // Performance: Start loading tasks immediately if we have job_id (parallel fetch)
      if (response.job_id && taskItems.length === 0) {
        // Fire and forget - don't await, let it load in background
        loadSmTasksForJob(response.job_id);
      }

      // Initialize editable fields
      const desc = response.description || "";
      // SSoT: Get linked task ID from sm_tasks (SmTask.purchase_order_id is THE link)
      const linkedTaskId = response.sm_tasks && response.sm_tasks.length > 0
        ? response.sm_tasks[0].id
        : null;
      const stat = response.status || "draft";
      const budg = response.budget?.toString() || "";
      // SSoT: Auto-populate required_date from linked task's start_date if not already set
      const linkedTaskStartDate = response.sm_tasks && response.sm_tasks.length > 0
        ? response.sm_tasks[0].start_date
        : null;
      const reqDate = response.required_date || linkedTaskStartDate || "";
      const payDueDate = response.due_date || "";
      const ordDate = response.ordered_date || "";
      const note = response.special_instructions || "";
      const supp = response.supplier || null;

      // Sort line items by price and ensure there's always one blank line at the end
      const items = response.line_items || [];
      const sortedItems = [...items].sort((a, b) => (b.unit_price || 0) - (a.unit_price || 0));
      const itemsWithBlank = [...sortedItems, { description: "", quantity: 0, unit_price: 0 }];

      setDescription(desc);
      setSelectedTaskId(linkedTaskId);
      setStatus(stat);
      setBudget(budg);
      setRequiredDate(reqDate);
      setDueDate(payDueDate);
      setOrderedDate(ordDate);
      setNotes(note);
      setSelectedSupplier(supp);
      setLineItems(itemsWithBlank);

      // Initialize budget lock state
      setBudgetLocked(response.budget_locked || false);
      setBudgetLockedBy(response.budget_locked_by_name || null);
      setBudgetLockedAt(response.budget_locked_at || null);

      // Store original state for change tracking (with sorted items)
      setOriginalState({
        description: desc,
        selectedTaskId: linkedTaskId,
        status: stat,
        budget: budg,
        requiredDate: reqDate,
        dueDate: payDueDate,
        orderedDate: ordDate,
        notes: note,
        selectedSupplier: supp,
        lineItems: itemsWithBlank,
      });
    } catch (err) {
      console.error("Failed to load purchase order:", err);
      setError("Failed to load purchase order");
    } finally {
      setLoading(false);
    }
  };

  // Performance: Load SmTasks with job_id parameter (allows parallel fetch)
  // Uses lightweight endpoint (?for=select) for fast dropdown loading
  const loadSmTasksForJob = async (jobId: number) => {
    if (taskItems.length > 0) return; // Already loaded
    try {
      setLoadingTasks(true);
      // Fetch SmTasks for this specific job - use lightweight endpoint for dropdown
      const response = await api.get<{ sm_tasks: Array<{ id: number; name: string; task_number: number; start_date?: string }> }>(
        `/api/v1/jobs/${jobId}/sm_tasks?for=select`
      );
      // Convert to ComboboxItem format - SSoT: Use SmTask.id as the key
      const items: TaskComboboxItem[] = (response?.sm_tasks || []).map((task) => ({
        id: String(task.id), // Use SmTask.id as the key (SSoT)
        label: task.name,
        taskId: task.id, // SmTask.id for linking
        start_date: task.start_date, // SSoT: For auto-populating PO required_date
      }));
      setTaskItems(items);
    } catch (err) {
      console.error("Failed to load SmTasks:", err);
    } finally {
      setLoadingTasks(false);
    }
  };

  // Legacy wrapper for backward compatibility
  const loadSmTasks = () => {
    if (purchaseOrder?.job_id) {
      loadSmTasksForJob(purchaseOrder.job_id);
    }
  };

  // Load Schedule Sync preview data
  const loadSyncPreview = async () => {
    if (!purchaseOrder) return;
    try {
      setLoadingSyncPreview(true);
      setSyncError(null);
      const response = await api.get<{ success: boolean; data: SyncPreviewData }>(
        `/api/v1/purchase_orders/${recordId}/schedule_sync_preview`
      );
      if (response.success) {
        setSyncPreview(response.data);
      } else {
        setSyncError("Failed to load sync preview");
      }
    } catch (err) {
      console.error("Failed to load sync preview:", err);
      setSyncError(err instanceof Error ? err.message : "Failed to load sync preview");
    } finally {
      setLoadingSyncPreview(false);
    }
  };

  // Open sync modal and load preview
  const openSyncModal = async () => {
    setSyncModalOpen(true);
    await loadSyncPreview();
  };

  // Execute the sync
  const executeSync = async () => {
    if (!purchaseOrder) return;
    try {
      setExecutingSync(true);
      setSyncError(null);
      const response = await api.post<{ success: boolean; data: { message: string; changes: Record<string, unknown> }; error?: string }>(
        `/api/v1/purchase_orders/${recordId}/schedule_sync`
      );
      if (!response) {
        setSyncError("Sync failed - no response from server");
        return;
      }
      if (response.success) {
        // Reload the PO data to reflect changes
        await loadPurchaseOrder();
        setSyncModalOpen(false);
        setSyncPreview(null);
      } else {
        setSyncError(response.error || "Sync failed");
      }
    } catch (err) {
      console.error("Failed to execute sync:", err);
      setSyncError(err instanceof Error ? err.message : "Sync failed");
    } finally {
      setExecutingSync(false);
    }
  };

  // Format date for display
  const formatDate = (dateStr: string | undefined | null): string => {
    if (!dateStr) return "Not set";
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-AU", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  // Helper to check if a line item is blank (no meaningful data)
  const isBlankLineItem = (item: LineItem) => {
    return !item.id && !item.pricebook_item_id && !item.description && item.quantity <= 0 && item.unit_price <= 0;
  };

  // Save changes
  const handleSave = async () => {
    if (!purchaseOrder) return;

    try {
      setSaving(true);
      setError(null);

      const updateData = {
        purchase_order: {
          description,
          schedule_task_id: selectedTaskId, // SSoT: SmTask.id for linking
          status,
          budget: budget ? parseFloat(budget) : null,
          required_date: requiredDate || null,
          due_date: dueDate || null,
          ordered_date: orderedDate || null,
          special_instructions: notes || null,
          supplier_id: selectedSupplier?.id || null,
          line_items_attributes: lineItems
            .filter((item) => !isBlankLineItem(item) || item.id) // Only include non-blank items or existing items (for deletion)
            .map((item, index) => ({
              id: item.id,
              pricebook_item_id: item.pricebook_item_id || null,
              description: item.description,
              quantity: item.quantity,
              unit_price: item.unit_price,
              gst_code: item.gst_code || "GST",
              notes: item.notes || null,
              line_number: index + 1,
              _destroy: item._destroy || false,
            })),
        },
      };

      console.log('[PO Save] Sending update with schedule_task_id:', selectedTaskId, 'updateData:', updateData);
      const patchResponse = await api.patch(`/api/v1/purchase_orders/${recordId}`, updateData);
      console.log('[PO Save] Patch response:', patchResponse);

      // Reload the purchase order data
      const response = await api.get<PurchaseOrder>(`/api/v1/purchase_orders/${recordId}`);
      console.log('[PO Save] Reloaded PO, sm_tasks:', response.sm_tasks, 'response:', response);
      setPurchaseOrder(response);

      // Initialize editable fields
      const desc = response.description || "";
      // SSoT: Get linked task ID from sm_tasks (SmTask.purchase_order_id is THE link)
      const linkedTaskId = response.sm_tasks && response.sm_tasks.length > 0
        ? response.sm_tasks[0].id
        : null;
      console.log('[PO Save] Setting linkedTaskId to:', linkedTaskId);
      const stat = response.status || "draft";
      const budg = response.budget?.toString() || "";
      // SSoT: Auto-populate required_date from linked task's start_date if not already set
      const linkedTaskStartDate = response.sm_tasks && response.sm_tasks.length > 0
        ? response.sm_tasks[0].start_date
        : null;
      const reqDate = response.required_date || linkedTaskStartDate || "";
      const payDueDate = response.due_date || "";
      const ordDate = response.ordered_date || "";
      const note = response.special_instructions || "";
      const supp = response.supplier || null;

      // Sort line items by price and ensure there's always one blank line at the end
      const items = response.line_items || [];
      const sortedItems = [...items].sort((a, b) => (b.unit_price || 0) - (a.unit_price || 0));
      const itemsWithBlank = [...sortedItems, { description: "", quantity: 0, unit_price: 0 }];

      setDescription(desc);
      setSelectedTaskId(linkedTaskId);
      setStatus(stat);
      setBudget(budg);
      setRequiredDate(reqDate);
      setDueDate(payDueDate);
      setOrderedDate(ordDate);
      setNotes(note);
      setSelectedSupplier(supp);
      setLineItems(itemsWithBlank);

      // Update budget lock state after save
      setBudgetLocked(response.budget_locked || false);
      setBudgetLockedBy(response.budget_locked_by_name || null);
      setBudgetLockedAt(response.budget_locked_at || null);

      // Store original state for change tracking (with sorted items)
      setOriginalState({
        description: desc,
        selectedTaskId: linkedTaskId,
        status: stat,
        budget: budg,
        requiredDate: reqDate,
        dueDate: payDueDate,
        orderedDate: ordDate,
        notes: note,
        selectedSupplier: supp,
        lineItems: itemsWithBlank,
      });
    } catch (err) {
      console.error("Failed to save purchase order:", err);
      setError("Failed to save changes");
    } finally {
      setSaving(false);
    }
  };

  // Check if changes have been made
  const hasChanges = useCallback(() => {
    if (!originalState) return false;

    // Compare simple fields
    if (
      description !== originalState.description ||
      selectedTaskId !== originalState.selectedTaskId ||
      status !== originalState.status ||
      budget !== originalState.budget ||
      requiredDate !== originalState.requiredDate ||
      dueDate !== originalState.dueDate ||
      orderedDate !== originalState.orderedDate ||
      notes !== originalState.notes ||
      selectedSupplier?.id !== originalState.selectedSupplier?.id
    ) {
      return true;
    }

    // Compare line items (excluding the blank line at the end)
    // Filter to only items with content or existing IDs
    const currentItems = lineItems.filter((item) => !isBlankLineItem(item) || item.id);
    const originalItems = originalState.lineItems.filter((item) => !isBlankLineItem(item) || item.id);

    if (currentItems.length !== originalItems.length) return true;

    // Sort both arrays by ID (if available) then by description for consistent comparison
    // This handles the case where items might be re-sorted after save
    const sortForComparison = (items: LineItem[]) =>
      [...items].sort((a, b) => {
        if (a.id && b.id) return a.id - b.id;
        if (a.id) return -1;
        if (b.id) return 1;
        return (a.description || "").localeCompare(b.description || "");
      });

    const sortedCurrent = sortForComparison(currentItems);
    const sortedOriginal = sortForComparison(originalItems);

    for (let i = 0; i < sortedCurrent.length; i++) {
      const curr = sortedCurrent[i];
      const orig = sortedOriginal[i];

      // Normalize values for comparison (handle undefined vs "GST", undefined vs "", etc.)
      const normalizeGstCode = (code: string | undefined) => code || "GST";
      const normalizeNotes = (notes: string | undefined) => notes || "";

      if (
        curr.description !== orig.description ||
        curr.quantity !== orig.quantity ||
        curr.unit_price !== orig.unit_price ||
        normalizeGstCode(curr.gst_code) !== normalizeGstCode(orig.gst_code) ||
        normalizeNotes(curr.notes) !== normalizeNotes(orig.notes) ||
        curr.pricebook_item_id !== orig.pricebook_item_id ||
        (curr._destroy || false) !== (orig._destroy || false)
      ) {
        return true;
      }
    }

    return false;
  }, [
    description,
    selectedTaskId,
    status,
    budget,
    requiredDate,
    dueDate,
    orderedDate,
    notes,
    selectedSupplier,
    lineItems,
    originalState,
  ]);

  // Discard changes
  const handleDiscard = () => {
    if (!originalState) return;

    setDescription(originalState.description);
    setSelectedTaskId(originalState.selectedTaskId);
    setStatus(originalState.status);
    setBudget(originalState.budget);
    setRequiredDate(originalState.requiredDate);
    setDueDate(originalState.dueDate);
    setOrderedDate(originalState.orderedDate);
    setNotes(originalState.notes);
    setSelectedSupplier(originalState.selectedSupplier);
    setLineItems([...originalState.lineItems]);
  };

  // Budget lockdown handlers
  const handleLockBudget = async () => {
    if (!purchaseOrder || lockingBudget) return;

    try {
      setLockingBudget(true);
      setError(null);

      const response = await api.post<{
        success: boolean;
        data: PurchaseOrder;
        message?: string;
        error?: string;
      }>(`/api/v1/purchase_orders/${recordId}/lock_budget`);

      if (response?.success && response.data) {
        setBudgetLocked(true);
        setBudget(response.data.budget?.toString() || "");
        setBudgetLockedBy(response.data.budget_locked_by_name || null);
        setBudgetLockedAt(response.data.budget_locked_at || null);
        setPurchaseOrder(response.data);
      } else {
        setError(response?.error || "Failed to lock budget");
      }
    } catch (err) {
      console.error("Failed to lock budget:", err);
      setError("Failed to lock budget");
    } finally {
      setLockingBudget(false);
    }
  };

  const handleUnlockBudget = async () => {
    if (!purchaseOrder || lockingBudget) return;

    const reason = prompt("Reason for unlocking budget:");
    if (!reason) return;

    try {
      setLockingBudget(true);
      setError(null);

      const response = await api.post<{
        success: boolean;
        data: PurchaseOrder;
        message?: string;
        error?: string;
      }>(`/api/v1/purchase_orders/${recordId}/unlock_budget`, { reason });

      if (response?.success && response.data) {
        setBudgetLocked(false);
        setBudgetLockedBy(null);
        setBudgetLockedAt(null);
        setPurchaseOrder(response.data);
      } else {
        setError(response?.error || "Failed to unlock budget");
      }
    } catch (err) {
      console.error("Failed to unlock budget:", err);
      setError("Failed to unlock budget");
    } finally {
      setLockingBudget(false);
    }
  };

  // PDF action handlers
  const hasLineItems = lineItems.filter((item) => !item._destroy && (item.description || item.pricebook_item_id)).length > 0;
  const canSendEmail = hasLineItems && selectedSupplier?.email;

  const handlePrint = () => {
    if (!purchaseOrder) return;
    // Open PDF in new tab (browser's native print dialog)
    window.open(`/api/v1/purchase_orders/${recordId}/generate_pdf`, "_blank");
  };

  const handlePreview = async () => {
    if (!purchaseOrder) return;

    try {
      setLoadingPreview(true);
      const baseUrl = getApiBaseUrl();
      const token = getStorageItem<string | null>(STORAGE_KEYS.TOKEN, null);
      const headers: HeadersInit = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      const response = await fetch(`${baseUrl}/api/v1/purchase_orders/${recordId}/generate_pdf?format=html`, {
        headers,
        credentials: "include",
      });
      const html = await response.text();
      setPreviewHtml(html);
      setPreviewModalOpen(true);
    } catch (err) {
      console.error("Failed to load preview:", err);
      toast({
        variant: "destructive",
        title: "Preview failed",
        description: "Could not load PDF preview",
      });
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleSavePdf = async () => {
    if (!purchaseOrder || !hasLineItems) return;

    try {
      setSavingPdf(true);
      const response = await api.post<{
        success: boolean;
        filename: string;
        message: string;
        error?: string;
      }>(`/api/v1/purchase_orders/${recordId}/save_pdf`);

      if (response?.success) {
        toast({
          title: "PDF Saved",
          description: response.message || `Saved as ${response.filename}`,
        });
      } else {
        toast({
          variant: "destructive",
          title: "Save failed",
          description: response?.error || "Failed to save PDF",
        });
      }
    } catch (err) {
      console.error("Failed to save PDF:", err);
      toast({
        variant: "destructive",
        title: "Save failed",
        description: "Could not save PDF to warehouse",
      });
    } finally {
      setSavingPdf(false);
    }
  };

  const handleSendEmail = async () => {
    if (!purchaseOrder || !canSendEmail) return;

    try {
      setSendingEmail(true);
      const response = await api.post<{
        success: boolean;
        message: string;
        purchase_order?: PurchaseOrder;
        error?: string;
      }>(`/api/v1/purchase_orders/${recordId}/send_email`);

      if (response?.success) {
        toast({
          title: "Email Sent",
          description: response.message,
        });
        setSendModalOpen(false);

        // Update local state with new PO status
        if (response.purchase_order) {
          setPurchaseOrder(response.purchase_order);
          setStatus(response.purchase_order.status);
          setOrderedDate(response.purchase_order.ordered_date || "");
        }
      } else {
        toast({
          variant: "destructive",
          title: "Send failed",
          description: response?.error || "Failed to send email",
        });
      }
    } catch (err) {
      console.error("Failed to send email:", err);
      toast({
        variant: "destructive",
        title: "Send failed",
        description: "Could not send email to supplier",
      });
    } finally {
      setSendingEmail(false);
    }
  };

  // Line item handlers
  const updateLineItem = (index: number, field: keyof LineItem, value: unknown) => {
    const updated = [...lineItems];
    updated[index] = { ...updated[index], [field]: value };
    // If we're editing the last item and it now has content, add a new blank line
    const activeItems = updated.filter((item) => !item._destroy);
    const isLastItem = activeItems[activeItems.length - 1] === updated[index];
    if (isLastItem && !isBlankLineItem(updated[index])) {
      updated.push({ description: "", quantity: 0, unit_price: 0 });
    }
    setLineItems(updated);
  };

  const removeLineItem = (index: number) => {
    const updated = [...lineItems];
    if (updated[index].id) {
      updated[index]._destroy = true;
    } else {
      updated.splice(index, 1);
    }
    setLineItems(updated);
  };

  const selectPricebookItem = (index: number, item: PricebookItem) => {
    const updated = [...lineItems];
    // Use active_price (from PO line items) or current_price (from pricebook search API)
    const price = item.active_price ?? item.current_price ?? 0;
    updated[index] = {
      ...updated[index],
      pricebook_item_id: item.id,
      pricebook_item: item,
      description: item.item_name,
      unit_price: price,
      gst_code: item.gst_code || "GST", // Copy GST code from pricebook item
    };
    // If selecting on the last item, add a new blank line
    const activeItems = updated.filter((i) => !i._destroy);
    const isLastItem = activeItems[activeItems.length - 1] === updated[index];
    if (isLastItem) {
      updated.push({ description: "", quantity: 0, unit_price: 0 });
    }
    setLineItems(updated);
  };

  // Refresh all line item prices from their linked pricebook items
  const refreshPricesFromPricebook = () => {
    // Count how many prices will be reset
    const itemsToReset = lineItems.filter(
      (item) => item.pricebook_item?.active_price != null &&
        Number(item.unit_price) !== Number(item.pricebook_item.active_price)
    );

    if (itemsToReset.length === 0) {
      return; // Nothing to reset
    }

    // Show confirmation dialog
    setItemsToResetCount(itemsToReset.length);
    setRefreshPricesDialogOpen(true);
  };

  // Execute the price refresh after confirmation
  const executeRefreshPrices = () => {
    const updated = lineItems.map((item) => {
      // Only update items that have a linked pricebook item with an active price
      if (item.pricebook_item?.active_price != null) {
        return {
          ...item,
          unit_price: item.pricebook_item.active_price,
        };
      }
      return item;
    });
    setLineItems(updated);
    setRefreshPricesDialogOpen(false);
  };

  // Calculate totals with per-line GST rates
  const calculateTotals = useCallback(() => {
    const activeItems = lineItems.filter((item) => !item._destroy);
    const subtotal = activeItems.reduce(
      (sum, item) => sum + (item.quantity || 0) * (item.unit_price || 0),
      0
    );
    const gst = activeItems.reduce(
      (sum, item) =>
        sum + (item.quantity || 0) * (item.unit_price || 0) * getGstRate(item.gst_code),
      0
    );
    return { subtotal, gst, total: subtotal + gst };
  }, [lineItems]);

  const { subtotal, gst, total } = calculateTotals();

  // SSoT: Show skeleton layout during loading to prevent flash/CLS
  if (loading) {
    return (
      <div className="space-y-6 pb-12">
        {/* Header skeleton */}
        <div className="flex items-start gap-4">
          <BackButton fallbackHref="/purchase_orders" className="mt-1" />
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-3">
              <Skeleton className="h-8 w-28" />
              <Skeleton className="h-6 w-64" />
            </div>
            <div className="flex items-center gap-4">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-5 w-24" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-9 w-24" />
            <Skeleton className="h-9 w-20" />
          </div>
        </div>
        {/* Table skeleton */}
        <Card>
          <CardContent className="p-0">
            <div className="border-b p-3 flex gap-4">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-48 flex-1" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-24" />
            </div>
            {[1, 2, 3].map((i) => (
              <div key={i} className="border-b p-3 flex gap-4">
                <Skeleton className="h-8 w-16" />
                <Skeleton className="h-8 w-48 flex-1" />
                <Skeleton className="h-8 w-20" />
                <Skeleton className="h-8 w-24" />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!purchaseOrder) {
    return (
      <div className="space-y-6">
        <BackButton fallbackHref="/purchase_orders" label="Back" />
        <div className="flex items-center justify-center h-96">
          <p className="text-muted-foreground">Purchase order not found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-24">
      {/* Header */}
      <div className="flex items-start gap-4">
        <BackButton fallbackHref="/purchase_orders" className="mt-1" />

        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold tracking-tight font-serif">
              {purchaseOrder.purchase_order_number}
            </h1>
            <span className="text-muted-foreground">-</span>
            <div className="min-w-[300px]">
              <ComboboxDropdown<TaskComboboxItem>
                items={taskItems}
                selectedItem={taskItems.find((t) => t.taskId === selectedTaskId)}
                onSelect={(item) => {
                  setDescription(item.label);
                  setSelectedTaskId(item.taskId); // SSoT: SmTask.id
                  // Auto-populate required date from task's start_date (SSoT)
                  if (item.start_date) {
                    setRequiredDate(item.start_date);
                  }
                }}
                placeholder="Search tasks..."
                isLoading={loadingTasks}
                emptyResults="No task found"
                popoverProps={{ className: "w-[350px]" }}
              />
            </div>
            {purchaseOrder.job && (
              <>
                <span className="text-muted-foreground">-</span>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Building2 className="h-4 w-4" />
                  <button
                    onClick={() => router.push(`/jobs/${purchaseOrder.job!.id}`)}
                    className="hover:text-foreground hover:underline"
                  >
                    {purchaseOrder.job.title}
                  </button>
                </div>
                <span className="text-muted-foreground">-</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => router.push(`/jobs/${purchaseOrder.job!.id}/plans`)}
                  className="h-7 px-2 text-muted-foreground hover:text-foreground"
                >
                  <FileText className="h-4 w-4 mr-1" />
                  Plans
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => router.push(`/jobs/${purchaseOrder.job!.id}/documents`)}
                  className="h-7 px-2 text-muted-foreground hover:text-foreground"
                >
                  <FolderOpen className="h-4 w-4 mr-1" />
                  Documents
                </Button>
              </>
            )}
          </div>

          <div className="flex items-center gap-3 mt-2">
            <Popover>
              <PopoverTrigger asChild>
                <button className="focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 rounded-md">
                  <Badge
                    variant="outline"
                    className={cn(
                      "border cursor-pointer hover:opacity-80 transition-opacity",
                      STATUS_BADGE_VARIANTS[status] || STATUS_BADGE_VARIANTS.draft
                    )}
                  >
                    {STATUS_OPTIONS.find((s) => s.value === status)?.label || "Draft"}
                    <ChevronsUpDown className="ml-1 h-3 w-3 opacity-50" />
                  </Badge>
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-[200px] p-0" align="start">
                <Command>
                  <CommandList>
                    <CommandGroup>
                      {STATUS_OPTIONS.map((option) => (
                        <CommandItem
                          key={option.value}
                          value={option.value}
                          onSelect={() => setStatus(option.value)}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              status === option.value ? "opacity-100" : "opacity-0"
                            )}
                          />
                          <Badge
                            variant="outline"
                            className={cn(
                              "border",
                              STATUS_BADGE_VARIANTS[option.value]
                            )}
                          >
                            {option.label}
                          </Badge>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            {purchaseOrder.job?.site_supervisor_info?.display_name && (
              <span className="text-sm text-muted-foreground">
                Site Supervisor: {purchaseOrder.job.site_supervisor_info.display_name}
              </span>
            )}
          </div>
        </div>

        <div className="flex gap-2">
          {/* PDF Actions */}
          <Button
            onClick={handlePrint}
            variant="outline"
            size="sm"
            disabled={!hasLineItems || saving}
            title={hasLineItems ? "Print PDF" : "Add line items to enable print"}
          >
            <Printer className="h-4 w-4 mr-1.5" />
            Print
          </Button>
          <Button
            onClick={handlePreview}
            variant="outline"
            size="sm"
            disabled={!hasLineItems || loadingPreview || saving}
            title={hasLineItems ? "Preview PDF" : "Add line items to enable preview"}
          >
            <Eye className={cn("h-4 w-4 mr-1.5", loadingPreview && "animate-pulse")} />
            Preview
          </Button>
          <Button
            onClick={handleSavePdf}
            variant="outline"
            size="sm"
            disabled={!hasLineItems || savingPdf || saving}
            title={hasLineItems ? "Save PDF to warehouse" : "Add line items to save PDF"}
          >
            <Save className={cn("h-4 w-4 mr-1.5", savingPdf && "animate-pulse")} />
            {savingPdf ? "Saving..." : "Save PDF"}
          </Button>
          <Button
            onClick={() => setSendModalOpen(true)}
            variant="outline"
            size="sm"
            disabled={!canSendEmail || saving}
            title={
              !hasLineItems
                ? "Add line items to enable send"
                : !selectedSupplier
                ? "Select a supplier first"
                : !selectedSupplier.email
                ? "Supplier has no email address"
                : "Send PO to supplier via email"
            }
          >
            <Send className="h-4 w-4 mr-1.5" />
            Send
          </Button>

          <div className="w-px h-8 bg-border mx-1" />

          <Button
            onClick={openSyncModal}
            variant="outline"
            disabled={saving || loadingSyncPreview}
            title="Sync dates from Schedule Master"
          >
            <RefreshCw className={cn("h-4 w-4 mr-2", loadingSyncPreview && "animate-spin")} />
            Sync with Schedule
          </Button>
          <Button
            onClick={handleDiscard}
            variant="outline"
            disabled={saving}
            className={cn(!hasChanges() && "invisible")}
          >
            Discard Changes
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving}
            className={cn(!hasChanges() && "invisible")}
          >
            {saving ? (
              <>
                <Spinner className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              "Save Changes"
            )}
          </Button>
        </div>
      </div>

      {error && (
        <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      {/* Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Total Card */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
              <DollarSign className="h-4 w-4" />
              Total (Inc GST)
            </div>
            <div className="text-2xl font-bold">{formatCurrency(total)}</div>
            <div className="text-sm text-muted-foreground mt-1">
              Ex GST: {formatCurrency(subtotal)} GST: {formatCurrency(gst)}
            </div>
            <div className="mt-3">
              <div className="flex items-center justify-between mb-1">
                <label className="text-sm text-muted-foreground">Budget:</label>
                {budgetLocked && (
                  <Badge variant="secondary" className="gap-1 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 dark:bg-amber-900/30 dark:text-amber-300">
                    <Lock className="h-3 w-3" />
                    Locked
                  </Badge>
                )}
              </div>

              {budgetLocked ? (
                <div className="text-2xl font-bold">{formatCurrency(parseFloat(budget) || 0)}</div>
              ) : (
                <Input
                  type="number"
                  value={budget}
                  onChange={(e) => setBudget(e.target.value)}
                  placeholder="0.00"
                />
              )}

              <div className="mt-2 flex gap-2">
                {!budgetLocked ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleLockBudget}
                    disabled={lockingBudget}
                    className="gap-1 text-xs"
                  >
                    {lockingBudget ? (
                      <Spinner className="h-3 w-3" />
                    ) : (
                      <Lock className="h-3 w-3" />
                    )}
                    Lock from PO Total
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleUnlockBudget}
                    disabled={lockingBudget}
                    className="gap-1 text-xs text-amber-600 hover:text-amber-700"
                  >
                    {lockingBudget ? (
                      <Spinner className="h-3 w-3" />
                    ) : (
                      <Unlock className="h-3 w-3" />
                    )}
                    Unlock (Admin)
                  </Button>
                )}
              </div>

              {budgetLocked && budgetLockedBy && (
                <p className="text-xs text-muted-foreground mt-2">
                  Locked by {budgetLockedBy}
                  {budgetLockedAt && ` on ${formatDate(budgetLockedAt)}`}
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Labour Budget Card - Shows for labour POs */}
        {(purchaseOrder.is_labour_po || purchaseOrder.labour_budget) && (
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                <Clock className="h-4 w-4" />
                Labour Budget
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-baseline">
                  <span className="text-sm text-muted-foreground">Budget:</span>
                  <span className="text-lg font-semibold">
                    {purchaseOrder.labour_budget ? formatCurrency(purchaseOrder.labour_budget) : "-"}
                  </span>
                </div>
                <div className="flex justify-between items-baseline">
                  <span className="text-sm text-muted-foreground">Actual:</span>
                  <span className={cn(
                    "text-lg font-semibold",
                    purchaseOrder.labour_actual && purchaseOrder.labour_budget &&
                    purchaseOrder.labour_actual > purchaseOrder.labour_budget
                      ? "text-red-500 dark:text-red-400"
                      : "text-green-500 dark:text-green-400"
                  )}>
                    {purchaseOrder.labour_actual ? formatCurrency(purchaseOrder.labour_actual) : "$0.00"}
                  </span>
                </div>
                {purchaseOrder.labour_budget && purchaseOrder.labour_budget > 0 && (
                  <div className="flex justify-between items-baseline">
                    <span className="text-sm text-muted-foreground">Remaining:</span>
                    <span className={cn(
                      "text-lg font-semibold",
                      (purchaseOrder.labour_budget - (purchaseOrder.labour_actual || 0)) < 0
                        ? "text-red-500 dark:text-red-400"
                        : "text-muted-foreground"
                    )}>
                      {formatCurrency(purchaseOrder.labour_budget - (purchaseOrder.labour_actual || 0))}
                    </span>
                  </div>
                )}
                {/* Progress bar */}
                {purchaseOrder.labour_budget && purchaseOrder.labour_budget > 0 && (
                  <div className="mt-2">
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className={cn(
                          "h-full transition-all",
                          ((purchaseOrder.labour_actual || 0) / purchaseOrder.labour_budget) > 1
                            ? "bg-red-500"
                            : ((purchaseOrder.labour_actual || 0) / purchaseOrder.labour_budget) > 0.8
                            ? "bg-yellow-500"
                            : "bg-green-500"
                        )}
                        style={{
                          width: `${Math.min(100, ((purchaseOrder.labour_actual || 0) / purchaseOrder.labour_budget) * 100)}%`
                        }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground text-center mt-1">
                      {Math.round(((purchaseOrder.labour_actual || 0) / purchaseOrder.labour_budget) * 100)}% used
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Supplier Card */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
              <Building2 className="h-4 w-4" />
              Supplier
            </div>
            <SupplierPicker
              value={selectedSupplier}
              onSelect={(supplier) => {
                // Cast to include payment terms
                const typedSupplier = supplier as Supplier | null;
                setSelectedSupplier(typedSupplier);

                // Auto-calculate due date from supplier's payment terms
                if (typedSupplier?.bill_due_day) {
                  const calculatedDueDate = calculateDueDate(
                    typedSupplier.bill_due_day,
                    typedSupplier.bill_due_type
                  );
                  if (calculatedDueDate) {
                    setDueDate(calculatedDueDate);
                  }
                }
              }}
              placeholder="Search suppliers..."
              clearable
              forPricebookItemIds={lineItems
                .filter((li) => li.pricebook_item_id && !li._destroy)
                .map((li) => li.pricebook_item_id!)
              }
              showAllToggle
            />
            {selectedSupplier?.email && (
              <p className="text-sm text-muted-foreground mt-2">{selectedSupplier.email}</p>
            )}
          </CardContent>
        </Card>

        {/* Dates Card */}
        <Card>
          <CardContent className="pt-6 space-y-3">
            <div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <Calendar className="h-4 w-4" />
                Required Date
              </div>
              <Input
                type="date"
                value={requiredDate}
                onChange={(e) => setRequiredDate(e.target.value)}
              />
            </div>
            <div>
              <div className="text-sm text-muted-foreground mb-1">Ordered Date</div>
              <Input
                type="date"
                value={orderedDate}
                onChange={(e) => setOrderedDate(e.target.value)}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Auto-fills when status = Sent
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Notes Card */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
              <FileText className="h-4 w-4" />
              Notes
            </div>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Additional notes..."
              className="min-h-[100px] resize-none"
            />
          </CardContent>
        </Card>
      </div>

      {/* Line Items */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-muted-foreground" />
              <h3 className="text-lg font-semibold">Line Items</h3>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={refreshPricesFromPricebook}
              title="Reset all prices to their pricebook values"
            >
              Refresh Prices
            </Button>
          </div>

          <div className="border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[150px] py-2 border-r">CODE</TableHead>
                  <TableHead className="py-2 border-r">DESCRIPTION</TableHead>
                  <TableHead className="w-[90px] text-right py-2 border-r">QTY</TableHead>
                  <TableHead className="w-[90px] text-right py-2 border-r">PRICE</TableHead>
                  <TableHead className="w-[80px] py-2 border-r">TAX</TableHead>
                  <TableHead className="w-[100px] text-right py-2 border-r">SUBTOTAL</TableHead>
                  <TableHead className="w-[80px] text-right py-2 border-r">GST</TableHead>
                  <TableHead className="w-[100px] text-right py-2 border-r">TOTAL</TableHead>
                  <TableHead className="w-[50px] py-2"></TableHead>
                </TableRow>
              </TableHeader>
            <TableBody>
              {lineItems
                .map((item, originalIndex) => ({ item, originalIndex }))
                .filter(({ item }) => !item._destroy)
                .map(({ item, originalIndex }, displayIndex) => {
                  const activeItems = lineItems.filter((item) => !item._destroy);
                  const isLastItem = displayIndex === activeItems.length - 1;
                  const isBlank = isBlankLineItem(item);
                  const shouldGreyOut = isLastItem && isBlank;

                  // Check if price has changed from pricebook
                  // Convert to numbers for comparison to handle both string and number types
                  const hasPriceChanged = item.pricebook_item?.active_price != null &&
                    Number(item.unit_price) !== Number(item.pricebook_item.active_price);

                  // Check if item is NOT supplied by the selected supplier
                  const isNotSuppliedBySelectedSupplier =
                    selectedSupplier &&
                    item.pricebook_item_id &&
                    selectedSupplier.supplied_pricebook_item_ids &&
                    !selectedSupplier.supplied_pricebook_item_ids.includes(item.pricebook_item_id);

                  // Debug logging
                  if (item.pricebook_item && hasPriceChanged) {
                    console.log('Price mismatch detected:', {
                      item_code: item.pricebook_item.item_code,
                      po_unit_price: item.unit_price,
                      pricebook_active_price: item.pricebook_item.active_price,
                      po_as_number: Number(item.unit_price),
                      pricebook_as_number: Number(item.pricebook_item.active_price),
                      are_equal: Number(item.unit_price) === Number(item.pricebook_item.active_price)
                    });
                  }

                  // Determine background color (priority: grey out > not supplied > price changed > normal)
                  // Not supplied = amber, Price changed = orange
                  const rowBgColor = shouldGreyOut
                    ? '#f1f5f9'
                    : isNotSuppliedBySelectedSupplier
                      ? '#fef3c7' // amber-100 for items not supplied
                      : hasPriceChanged
                        ? '#fb923c' // orange for price changed
                        : undefined;

                  return (
                  <TableRow
                    key={item.id || `new-${originalIndex}`}
                    className="h-auto"
                    style={rowBgColor ? { backgroundColor: rowBgColor } : undefined}
                  >
                    <TableCell className="py-1 border-b border-r" style={rowBgColor ? { backgroundColor: rowBgColor } : undefined}>
                      <div className="flex flex-col">
                        <PricebookCodePicker
                          value={item.pricebook_item ? {
                            id: item.pricebook_item.id,
                            item_code: item.pricebook_item.item_code,
                            item_name: item.pricebook_item.item_name,
                            current_price: item.pricebook_item.current_price,
                            active_price: item.pricebook_item.active_price,
                            gst_code: item.pricebook_item.gst_code,
                            default_supplier: item.pricebook_item.default_supplier,
                          } : null}
                          onSelect={(pbItem) => {
                            if (pbItem) {
                              selectPricebookItem(originalIndex, {
                                id: pbItem.id,
                                item_code: pbItem.item_code,
                                item_name: pbItem.item_name,
                                current_price: pbItem.current_price,
                                active_price: pbItem.active_price,
                                gst_code: pbItem.gst_code,
                                default_supplier: pbItem.default_supplier,
                              });
                            }
                          }}
                          placeholder="Search items..."
                          showPrice
                          className="border-0 rounded-none shadow-none focus-visible:ring-0"
                        />
                        {item.pricebook_item?.default_supplier && (
                          <div className="px-3 pb-1 -mt-1 text-xs text-muted-foreground truncate">
                            {item.pricebook_item.default_supplier.display_name || item.pricebook_item.default_supplier.name}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="py-1 border-b border-r" style={rowBgColor ? { backgroundColor: rowBgColor } : undefined}>
                      <Input
                        value={item.description}
                        onChange={(e) => updateLineItem(originalIndex, "description", e.target.value)}
                        placeholder="Item description"
                        className="border-0 rounded-none focus-visible:ring-0 focus-visible:ring-offset-0 h-10"
                        style={rowBgColor ? { backgroundColor: rowBgColor } : undefined}
                      />
                    </TableCell>
                    <TableCell className="py-1 border-b border-r" style={rowBgColor ? { backgroundColor: rowBgColor } : undefined}>
                      <Input
                        type="number"
                        value={item.quantity}
                        onChange={(e) =>
                          updateLineItem(originalIndex, "quantity", parseFloat(e.target.value) || 0)
                        }
                        onFocus={(e) => e.target.select()}
                        className={cn(
                          "text-right text-base h-10 border-0 rounded-none focus-visible:ring-0 focus-visible:ring-offset-0 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none",
                          shouldGreyOut ? "text-muted-foreground" : "text-muted-foreground"
                        )}
                        style={rowBgColor ? { backgroundColor: rowBgColor } : undefined}
                        min={0}
                      />
                    </TableCell>
                    <TableCell className="py-1 border-b border-r" style={rowBgColor ? { backgroundColor: rowBgColor } : undefined}>
                      <Input
                        type="number"
                        value={item.unit_price}
                        onChange={(e) =>
                          updateLineItem(originalIndex, "unit_price", parseFloat(e.target.value) || 0)
                        }
                        onFocus={(e) => e.target.select()}
                        className={cn(
                          "text-right text-base h-10 border-0 rounded-none focus-visible:ring-0 focus-visible:ring-offset-0 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none",
                          shouldGreyOut ? "text-muted-foreground" : "text-muted-foreground",
                          hasPriceChanged && "text-orange-600 dark:text-orange-400 font-semibold"
                        )}
                        style={rowBgColor ? { backgroundColor: rowBgColor } : undefined}
                        min={0}
                        step={0.01}
                      />
                    </TableCell>
                    <TableCell className="py-1 border-b border-r" style={rowBgColor ? { backgroundColor: rowBgColor } : undefined}>
                      {/* GST Type selector - disabled if pricebook item is selected */}
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            role="combobox"
                            className={cn(
                              "w-full justify-between text-xs border-0 rounded-none h-10 focus-visible:ring-0 focus-visible:ring-offset-0",
                              item.pricebook_item_id && "opacity-60",
                              shouldGreyOut && "text-muted-foreground"
                            )}
                            style={rowBgColor ? { backgroundColor: rowBgColor } : undefined}
                            disabled={!!item.pricebook_item_id}
                          >
                            {GST_CODES.find((c) => c.value === (item.gst_code || "GST"))?.label || "GST"}
                            {!item.pricebook_item_id && (
                              <ChevronsUpDown className="ml-1 h-3 w-3 shrink-0 opacity-50" />
                            )}
                          </Button>
                        </PopoverTrigger>
                        {!item.pricebook_item_id && (
                          <PopoverContent className="w-[140px] p-0">
                            <Command>
                              <CommandList>
                                <CommandGroup>
                                  {GST_CODES.map((gstOption) => (
                                    <CommandItem
                                      key={gstOption.value}
                                      value={gstOption.value}
                                      onSelect={() => updateLineItem(originalIndex, "gst_code", gstOption.value)}
                                    >
                                      <Check
                                        className={cn(
                                          "mr-2 h-4 w-4",
                                          (item.gst_code || "GST") === gstOption.value
                                            ? "opacity-100"
                                            : "opacity-0"
                                        )}
                                      />
                                      {gstOption.label}
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        )}
                      </Popover>
                    </TableCell>
                    <TableCell className={cn("text-right py-1 text-base border-b border-r", shouldGreyOut ? "text-muted-foreground" : "text-muted-foreground")} style={rowBgColor ? { backgroundColor: rowBgColor } : undefined}>
                      {formatCurrency((item.quantity || 0) * (item.unit_price || 0))}
                    </TableCell>
                    <TableCell className={cn("text-right py-1 text-base border-b border-r", shouldGreyOut ? "text-muted-foreground" : "text-muted-foreground")} style={rowBgColor ? { backgroundColor: rowBgColor } : undefined}>
                      {formatCurrency((item.quantity || 0) * (item.unit_price || 0) * getGstRate(item.gst_code))}
                    </TableCell>
                    <TableCell className={cn("text-right py-1 text-base border-b border-r", shouldGreyOut ? "text-muted-foreground" : "font-medium")} style={rowBgColor ? { backgroundColor: rowBgColor } : undefined}>
                      {formatCurrency((item.quantity || 0) * (item.unit_price || 0) * (1 + getGstRate(item.gst_code)))}
                    </TableCell>
                    <TableCell className="py-1 border-b" style={rowBgColor ? { backgroundColor: rowBgColor } : undefined}>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeLineItem(originalIndex)}
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                  );
                })}
            </TableBody>
            </Table>
          </div>

          {/* Totals Summary */}
          <div className="flex justify-end mt-6">
            <div className="w-[350px] space-y-3">
              <div className="flex justify-between text-lg">
                <span className="text-muted-foreground">Subtotal (Ex GST)</span>
                <span className="font-medium">{formatCurrency(subtotal)}</span>
              </div>
              <div className="flex justify-between text-lg">
                <span className="text-muted-foreground">GST</span>
                <span className="font-medium">{formatCurrency(gst)}</span>
              </div>
              <div className="flex justify-between text-xl font-bold border-t pt-3">
                <span>Total (Inc GST)</span>
                <span>{formatCurrency(total)}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Schedule Sync Modal */}
      <Dialog open={syncModalOpen} onOpenChange={setSyncModalOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RefreshCw className="h-5 w-5" />
              Sync with Schedule Master
            </DialogTitle>
            <DialogDescription>
              Compare and sync PO dates with linked Schedule Master task
            </DialogDescription>
          </DialogHeader>

          {loadingSyncPreview ? (
            <div className="flex items-center justify-center py-8">
              <Spinner className="h-8 w-8" />
            </div>
          ) : syncError ? (
            <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
              <div className="flex items-center gap-2 text-destructive">
                <XCircle className="h-5 w-5" />
                <span>{syncError}</span>
              </div>
            </div>
          ) : syncPreview ? (
            <div className="space-y-6">
              {/* No linked tasks */}
              {syncPreview.linked_tasks.length === 0 ? (
                <div className="bg-muted/50 rounded-lg p-6 text-center">
                  <AlertTriangle className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                  <p className="text-muted-foreground">No Schedule Master tasks linked to this PO</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Link a task using the task dropdown in the header
                  </p>
                </div>
              ) : (
                <>
                  {/* Linked Task Info */}
                  {syncPreview.linked_tasks.map((task) => (
                    <div key={task.id} className="border rounded-lg p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="text-sm font-semibold flex items-center gap-2">
                            #{task.task_number} {task.name}
                            {task.locked && (
                              <Badge variant="outline" className="text-amber-600 border-amber-300">
                                <Lock className="h-3 w-3 mr-1" />
                                {task.lock_type}
                              </Badge>
                            )}
                          </h4>
                          <p className="text-sm text-muted-foreground">
                            {task.trade} {task.stage && `• ${task.stage}`}
                          </p>
                        </div>
                        <Badge variant={task.status === TASK_STATUS.COMPLETED ? "default" : "outline"}>
                          {task.status}
                        </Badge>
                      </div>

                      {/* Task dates */}
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground">Start Date:</span>{" "}
                          <span className="font-medium">{formatDate(task.start_date)}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">End Date:</span>{" "}
                          <span className="font-medium">{formatDate(task.end_date)}</span>
                        </div>
                      </div>

                      {/* Predecessors */}
                      {task.predecessors.length > 0 && (
                        <div className="text-sm">
                          <span className="text-muted-foreground">Predecessors ({task.predecessor_count}):</span>
                          <ul className="mt-1 space-y-1">
                            {task.predecessors.map((pred) => (
                              <li key={pred.id} className="flex items-center gap-2 text-muted-foreground">
                                <span>• {pred.name}</span>
                                <span className="text-xs">(ends {formatDate(pred.end_date)})</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Blocker warning */}
                      {task.is_blocker && task.blocker_reason && (
                        <div className="bg-destructive/10 border border-destructive/20 rounded p-3 flex items-start gap-2">
                          <XCircle className="h-4 w-4 text-destructive mt-0.5" />
                          <div>
                            <p className="text-sm font-medium text-destructive">Sync Blocked</p>
                            <p className="text-sm text-destructive/80">{task.blocker_reason}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}

                  {/* Comparison Table */}
                  <div className="border rounded-lg overflow-hidden">
                    <Table className="w-full text-sm">
                      <TableHeader className="bg-muted/50">
                        <TableRow>
                          <TableHead className="text-left p-3 font-medium">Field</TableHead>
                          <TableHead className="text-left p-3 font-medium">PO Value</TableHead>
                          <TableHead className="text-left p-3 font-medium">Task Value</TableHead>
                          <TableHead className="text-center p-3 font-medium">Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        <TableRow className="border-t">
                          <TableCell className="p-3">Required Date</TableCell>
                          <TableCell className="p-3">{formatDate(syncPreview.po.required_date)}</TableCell>
                          <TableCell className="p-3">{formatDate(syncPreview.linked_tasks[0]?.start_date)}</TableCell>
                          <TableCell className="p-3 text-center">
                            {syncPreview.linked_tasks[0]?.date_matches ? (
                              <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 inline" />
                            ) : (
                              <AlertTriangle className="h-5 w-5 text-amber-500 inline" />
                            )}
                          </TableCell>
                        </TableRow>
                        <TableRow className="border-t">
                          <TableCell className="p-3">Supplier</TableCell>
                          <TableCell className="p-3">{syncPreview.po.supplier_name || "Not set"}</TableCell>
                          <TableCell className="p-3">{syncPreview.linked_tasks[0]?.supplier_name || "Not set"}</TableCell>
                          <TableCell className="p-3 text-center">
                            {syncPreview.linked_tasks[0]?.supplier_matches ? (
                              <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 inline" />
                            ) : (
                              <AlertTriangle className="h-5 w-5 text-amber-500 inline" />
                            )}
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>

                  {/* Sync Preview */}
                  {syncPreview.sync_preview && !syncPreview.sync_preview.nothing_to_sync && (
                    <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                      <h4 className="font-medium text-blue-800 dark:text-blue-200 mb-2">
                        Sync Preview
                      </h4>
                      <p className="text-sm text-blue-700 dark:text-blue-300">
                        Will sync from: <strong>{syncPreview.sync_preview.source_task?.name}</strong>
                      </p>
                      <ul className="mt-2 space-y-1 text-sm text-blue-700 dark:text-blue-300">
                        {syncPreview.sync_preview.will_update.required_date && (
                          <li>
                            • Required Date: {formatDate(syncPreview.sync_preview.will_update.required_date.from)} → {formatDate(syncPreview.sync_preview.will_update.required_date.to)}
                            {syncPreview.sync_preview.will_update.required_date.diff_days && (
                              <span className="text-xs ml-1">
                                ({syncPreview.sync_preview.will_update.required_date.diff_days > 0 ? "+" : ""}
                                {syncPreview.sync_preview.will_update.required_date.diff_days} days)
                              </span>
                            )}
                          </li>
                        )}
                        {syncPreview.sync_preview.will_update.supplier && (
                          <li>
                            • Supplier: {syncPreview.sync_preview.will_update.supplier.from || "Not set"} → {syncPreview.sync_preview.will_update.supplier.to}
                          </li>
                        )}
                      </ul>
                    </div>
                  )}

                  {/* Already in sync */}
                  {syncPreview.sync_preview?.nothing_to_sync && (
                    <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg p-4 flex items-center gap-3">
                      <CheckCircle2 className="h-6 w-6 text-green-600 dark:text-green-400" />
                      <div>
                        <p className="font-medium text-green-800 dark:text-green-200">Already in Sync</p>
                        <p className="text-sm text-green-700 dark:text-green-300">
                          PO dates match the linked Schedule Master task
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Summary */}
                  <div className={cn(
                    "rounded-lg p-4",
                    syncPreview.summary.status === "ready" && "bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800",
                    syncPreview.summary.status === "blocked" && "bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800",
                    syncPreview.summary.status === "in_sync" && "bg-muted dark:bg-background/30 border border-border dark:border-border"
                  )}>
                    <p className="text-sm font-medium">{syncPreview.summary.message}</p>
                  </div>
                </>
              )}
            </div>
          ) : null}

          <DialogFooter>
            <Button variant="outline" onClick={() => setSyncModalOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={executeSync}
              disabled={!syncPreview?.summary.can_sync || executingSync}
            >
              {executingSync ? (
                <>
                  <Spinner className="h-4 w-4 mr-2" />
                  Syncing...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Sync from Schedule
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Modal */}
      <Dialog open={previewModalOpen} onOpenChange={setPreviewModalOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              Purchase Order Preview
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 min-h-0 overflow-auto border rounded-lg bg-white">
            {previewHtml ? (
              <iframe
                srcDoc={previewHtml}
                className="w-full h-full min-h-[60vh]"
                title="PO Preview"
              />
            ) : (
              <div className="flex items-center justify-center py-12">
                <Spinner className="h-8 w-8" />
              </div>
            )}
          </div>
          <DialogFooter className="flex-wrap gap-2 sm:gap-0">
            <div className="flex-1">
              <Button variant="outline" onClick={() => setPreviewModalOpen(false)}>
                Close
              </Button>
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button
                variant="outline"
                onClick={() => {
                  // TODO: Open attach plans modal/picker
                  toast({ title: "Coming soon", description: "Attach Plans functionality" });
                }}
              >
                <Paperclip className="h-4 w-4 mr-2" />
                Attach Plans
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  // TODO: Open site document picker
                  toast({ title: "Coming soon", description: "Site Doc functionality" });
                }}
              >
                <Files className="h-4 w-4 mr-2" />
                Site Doc
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  setPreviewModalOpen(false);
                  setSendModalOpen(true);
                }}
                disabled={!canSendEmail}
                title={!canSendEmail ? "Add line items and supplier email to enable" : "Send PO to supplier"}
              >
                <Send className="h-4 w-4 mr-2" />
                Send
              </Button>
              <Button onClick={handlePrint}>
                <Printer className="h-4 w-4 mr-2" />
                Print
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Send Email Confirmation Modal */}
      <Dialog open={sendModalOpen} onOpenChange={setSendModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="h-5 w-5" />
              Send Purchase Order
            </DialogTitle>
            <DialogDescription>
              This will email the purchase order PDF to the supplier.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
              <Building2 className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="font-medium">{selectedSupplier?.display_name || "Supplier"}</p>
                <p className="text-sm text-muted-foreground">{selectedSupplier?.email}</p>
              </div>
            </div>

            <div className="text-sm text-muted-foreground space-y-2">
              <p>The following will happen:</p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>PDF will be generated with current line items</li>
                <li>Email will be sent to supplier</li>
                <li>PO status will change to &quot;Sent&quot;</li>
                <li>Ordered date will be set to today</li>
                <li>PDF copy saved to warehouse</li>
              </ul>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setSendModalOpen(false)} disabled={sendingEmail}>
              Cancel
            </Button>
            <Button onClick={handleSendEmail} disabled={sendingEmail}>
              {sendingEmail ? (
                <>
                  <Spinner className="h-4 w-4 mr-2" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Send Email
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Refresh Prices Confirmation Dialog */}
      <Dialog open={refreshPricesDialogOpen} onOpenChange={setRefreshPricesDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RefreshCw className="h-5 w-5" />
              Refresh Prices
            </DialogTitle>
            <DialogDescription>
              This will reset {itemsToResetCount} price{itemsToResetCount > 1 ? 's' : ''} to their current pricebook values.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <div className="flex items-start gap-3 p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg">
              <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-500 mt-0.5" />
              <div className="text-sm text-amber-800 dark:text-amber-200">
                <p className="font-medium">This cannot be undone</p>
                <p className="mt-1 text-amber-700 dark:text-amber-300">
                  Any manual price adjustments you&apos;ve made will be overwritten with the pricebook values.
                </p>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setRefreshPricesDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={executeRefreshPrices}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh Prices
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
