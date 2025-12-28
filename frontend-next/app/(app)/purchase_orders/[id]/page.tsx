"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Spinner } from "@/components/ui/spinner";
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
  ListTodo,
  ExternalLink,
  Clock,
  Users,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

interface Supplier {
  id: number;
  display_name?: string;
  email?: string;
  phone?: string;
  address?: string;
  /** Pricebook item IDs this supplier has price histories for */
  supplied_pricebook_item_ids?: number[];
  /** Payment terms for calculating PO due date */
  bill_due_day?: number;
  bill_due_type?: string; // DAYSAFTERBILLDATE, OFFOLLOWINGMONTH, etc.
  payment_terms?: string;
}

interface PricebookItem {
  id: number;
  item_code: string;
  item_name: string;
  active_price?: number;  // From PO line items (includes active_price method)
  current_price?: number; // From pricebook search API
  unit_of_measure?: string;
  gst_code?: string;
}

// GST codes and their tax rates
const GST_CODES = [
  { value: "GST", label: "GST", rate: 0.10 },
  { value: "GST Free", label: "GST Free", rate: 0.00 },
  { value: "Input Taxed", label: "Input Taxed", rate: 0.00 },
] as const;

function getGstRate(gstCode: string | undefined): number {
  const code = GST_CODES.find((c) => c.value === gstCode);
  return code?.rate ?? 0.10; // Default to 10% GST
}

interface LineItem {
  id?: number;
  pricebook_item_id?: number;
  pricebook_item?: PricebookItem;
  description: string;
  quantity: number;
  unit_price: number;
  gst_code?: string;
  notes?: string;
  line_number?: number;
  _destroy?: boolean;
}

interface Job {
  id: number;
  title: string;
  site_supervisor_info?: {
    id: number;
    display_name: string;
  } | null;
}

interface SmTask {
  id: number;
  name: string;
  task_number: number;
  sequence_order: number;
  sm_schedule_master_id: number;
  start_date?: string; // SSoT: Used to auto-populate PO required_date
}

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

interface PurchaseOrder {
  id: number;
  purchase_order_number: string;
  description?: string;
  status: string;
  sub_total: number;
  tax: number;
  total: number;
  budget?: number;
  required_date?: string;
  due_date?: string; // Payment due date (from supplier terms)
  ordered_date?: string;
  special_instructions?: string;
  delivery_address?: string;
  supplier?: Supplier;
  supplier_id?: number;
  job?: Job;
  job_id?: number;
  line_items: LineItem[];
  sm_tasks?: SmTask[]; // SSoT: Linked tasks via SmTask.purchase_order_id
  // Labour budget tracking (Site Presence)
  is_labour_po?: boolean;
  labour_budget?: number;
  labour_actual?: number;
}

const STATUS_OPTIONS = [
  { value: "draft", label: "Draft" },
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "sent", label: "Sent" },
  { value: "received", label: "Received" },
  { value: "invoiced", label: "Invoiced" },
  { value: "paid", label: "Paid" },
  { value: "cancelled", label: "Cancelled" },
];

const STATUS_BADGE_VARIANTS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700 border-gray-300",
  pending: "bg-yellow-100 text-yellow-800 border-yellow-300",
  approved: "bg-blue-100 text-blue-800 border-blue-300",
  sent: "bg-purple-100 text-purple-800 border-purple-300",
  received: "bg-green-100 text-green-800 border-green-300",
  invoiced: "bg-indigo-100 text-indigo-800 border-indigo-300",
  paid: "bg-emerald-100 text-emerald-800 border-emerald-300",
  cancelled: "bg-red-100 text-red-800 border-red-300",
};

function formatCurrency(value: number | undefined | null): string {
  if (value === undefined || value === null) return "$0.00";
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
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
     
  }, [recordId]);

  // Refetch data when window regains focus (e.g., switching back from pricebook tab)
  useEffect(() => {
    const handleFocus = () => {
      console.log('[PO Detail] Window focused - reloading data');
      loadPurchaseOrder();
    };

    window.addEventListener('focus', handleFocus);
    return () => {
      window.removeEventListener('focus', handleFocus);
    };
     
  }, [recordId]);

  // Load SmTasks when purchaseOrder is loaded (for task dropdown)
  useEffect(() => {
    if (purchaseOrder?.job_id) {
      loadSmTasks();
    }
  }, [purchaseOrder?.job_id]);

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
    try {
      setLoading(true);
      const response = await api.get<PurchaseOrder>(`/api/v1/purchase_orders/${recordId}`);
      setPurchaseOrder(response);

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

  // Load local SmTasks for this job (for task/description lookup)
  const loadSmTasks = async () => {
    if (!purchaseOrder?.job_id) return;
    if (taskItems.length > 0) return;
    try {
      setLoadingTasks(true);
      // Fetch SmTasks for this specific job (nested under jobs)
      const response = await api.get<{ sm_tasks: SmTask[] }>(`/api/v1/jobs/${purchaseOrder.job_id}/sm_tasks`);
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

      await api.patch(`/api/v1/purchase_orders/${recordId}`, updateData);

      // Reload the purchase order data
      const response = await api.get<PurchaseOrder>(`/api/v1/purchase_orders/${recordId}`);
      setPurchaseOrder(response);

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
    const currentItems = lineItems.filter((item) => !isBlankLineItem(item) || item.id);
    const originalItems = originalState.lineItems.filter((item) => !isBlankLineItem(item) || item.id);

    if (currentItems.length !== originalItems.length) return true;

    for (let i = 0; i < currentItems.length; i++) {
      const curr = currentItems[i];
      const orig = originalItems[i];

      if (
        curr.description !== orig.description ||
        curr.quantity !== orig.quantity ||
        curr.unit_price !== orig.unit_price ||
        curr.gst_code !== orig.gst_code ||
        curr.notes !== orig.notes ||
        curr.pricebook_item_id !== orig.pricebook_item_id ||
        curr._destroy !== orig._destroy
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Spinner />
      </div>
    );
  }

  if (!purchaseOrder) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <div className="flex items-center justify-center h-96">
          <p className="text-muted-foreground">Purchase order not found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.back()}
          className="mt-1"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>

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
          <Button
            onClick={openSyncModal}
            variant="outline"
            disabled={saving || loadingSyncPreview}
            title="Sync dates from Schedule Master"
          >
            <RefreshCw className={cn("h-4 w-4 mr-2", loadingSyncPreview && "animate-spin")} />
            Sync with Schedule
          </Button>
          {hasChanges() && (
            <>
              <Button onClick={handleDiscard} variant="outline" disabled={saving}>
                Discard Changes
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? (
                  <>
                    <Spinner className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save Changes"
                )}
              </Button>
            </>
          )}
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
              <label className="text-sm text-muted-foreground">Budget:</label>
              <Input
                type="number"
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
                placeholder="0.00"
                className="mt-1"
              />
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
                      ? "text-red-500"
                      : "text-green-500"
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
                        ? "text-red-500"
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
              <div className="text-sm text-muted-foreground mb-1">Due Date</div>
              <Input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
              {selectedSupplier?.payment_terms && (
                <p className="text-xs text-muted-foreground mt-1">
                  Terms: {selectedSupplier.payment_terms}
                </p>
              )}
            </div>
            <div>
              <div className="text-sm text-muted-foreground mb-1">Ordered Date</div>
              <Input
                type="date"
                value={orderedDate}
                onChange={(e) => setOrderedDate(e.target.value)}
              />
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
              onClick={loadPurchaseOrder}
              disabled={loading}
            >
              {loading ? "Refreshing..." : "Refresh Prices"}
            </Button>
          </div>

          <div className="border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[150px] py-2">CODE</TableHead>
                  <TableHead className="py-2">DESCRIPTION</TableHead>
                  <TableHead className="w-[70px] text-right py-2">QTY</TableHead>
                  <TableHead className="w-[100px] text-right py-2">UNIT PRICE</TableHead>
                  <TableHead className="w-[100px] py-2">GST TYPE</TableHead>
                  <TableHead className="w-[100px] text-right py-2">SUBTOTAL</TableHead>
                  <TableHead className="w-[80px] text-right py-2">GST</TableHead>
                  <TableHead className="w-[100px] text-right py-2">TOTAL</TableHead>
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
                    <TableCell className="py-1 border-b" style={rowBgColor ? { backgroundColor: rowBgColor } : undefined}>
                      <PricebookCodePicker
                        value={item.pricebook_item ? {
                          id: item.pricebook_item.id,
                          item_code: item.pricebook_item.item_code,
                          item_name: item.pricebook_item.item_name,
                          current_price: item.pricebook_item.current_price,
                          active_price: item.pricebook_item.active_price,
                          gst_code: item.pricebook_item.gst_code,
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
                            });
                          }
                        }}
                        placeholder="Search items..."
                        showPrice
                      />
                    </TableCell>
                    <TableCell className="py-1 border-b" style={rowBgColor ? { backgroundColor: rowBgColor } : undefined}>
                      <Input
                        value={item.description}
                        onChange={(e) => updateLineItem(originalIndex, "description", e.target.value)}
                        placeholder="Item description"
                        className="border-0 rounded-none focus-visible:ring-0 focus-visible:ring-offset-0 h-10"
                        style={rowBgColor ? { backgroundColor: rowBgColor } : undefined}
                      />
                    </TableCell>
                    <TableCell className="py-1 border-b" style={rowBgColor ? { backgroundColor: rowBgColor } : undefined}>
                      <Input
                        type="number"
                        value={item.quantity}
                        onChange={(e) =>
                          updateLineItem(originalIndex, "quantity", parseFloat(e.target.value) || 0)
                        }
                        className={cn(
                          "text-right text-sm h-10 border-0 rounded-none focus-visible:ring-0 focus-visible:ring-offset-0 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none",
                          shouldGreyOut && "text-muted-foreground"
                        )}
                        style={rowBgColor ? { backgroundColor: rowBgColor } : undefined}
                        min={0}
                      />
                    </TableCell>
                    <TableCell className="py-1 border-b" style={rowBgColor ? { backgroundColor: rowBgColor } : undefined}>
                      <Input
                        type="number"
                        value={item.unit_price}
                        onChange={(e) =>
                          updateLineItem(originalIndex, "unit_price", parseFloat(e.target.value) || 0)
                        }
                        className={cn(
                          "text-right text-sm h-10 border-0 rounded-none focus-visible:ring-0 focus-visible:ring-offset-0 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none",
                          shouldGreyOut && "text-muted-foreground",
                          hasPriceChanged && "text-orange-600 font-semibold"
                        )}
                        style={rowBgColor ? { backgroundColor: rowBgColor } : undefined}
                        min={0}
                        step={0.01}
                      />
                    </TableCell>
                    <TableCell className="py-1 border-b" style={rowBgColor ? { backgroundColor: rowBgColor } : undefined}>
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
                    <TableCell className={cn("text-right py-1 text-base border-b", shouldGreyOut ? "text-muted-foreground" : "text-muted-foreground")} style={rowBgColor ? { backgroundColor: rowBgColor } : undefined}>
                      {formatCurrency((item.quantity || 0) * (item.unit_price || 0))}
                    </TableCell>
                    <TableCell className={cn("text-right py-1 text-base border-b", shouldGreyOut ? "text-muted-foreground" : "text-muted-foreground")} style={rowBgColor ? { backgroundColor: rowBgColor } : undefined}>
                      {formatCurrency((item.quantity || 0) * (item.unit_price || 0) * getGstRate(item.gst_code))}
                    </TableCell>
                    <TableCell className={cn("text-right py-1 text-base border-b", shouldGreyOut ? "text-muted-foreground" : "font-medium")} style={rowBgColor ? { backgroundColor: rowBgColor } : undefined}>
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
                          <h4 className="font-semibold flex items-center gap-2">
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
                        <Badge variant={task.status === "completed" ? "default" : "outline"}>
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
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50">
                        <tr>
                          <th className="text-left p-3 font-medium">Field</th>
                          <th className="text-left p-3 font-medium">PO Value</th>
                          <th className="text-left p-3 font-medium">Task Value</th>
                          <th className="text-center p-3 font-medium">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-t">
                          <td className="p-3">Required Date</td>
                          <td className="p-3">{formatDate(syncPreview.po.required_date)}</td>
                          <td className="p-3">{formatDate(syncPreview.linked_tasks[0]?.start_date)}</td>
                          <td className="p-3 text-center">
                            {syncPreview.linked_tasks[0]?.date_matches ? (
                              <CheckCircle2 className="h-5 w-5 text-green-600 inline" />
                            ) : (
                              <AlertTriangle className="h-5 w-5 text-amber-500 inline" />
                            )}
                          </td>
                        </tr>
                        <tr className="border-t">
                          <td className="p-3">Supplier</td>
                          <td className="p-3">{syncPreview.po.supplier_name || "Not set"}</td>
                          <td className="p-3">{syncPreview.linked_tasks[0]?.supplier_name || "Not set"}</td>
                          <td className="p-3 text-center">
                            {syncPreview.linked_tasks[0]?.supplier_matches ? (
                              <CheckCircle2 className="h-5 w-5 text-green-600 inline" />
                            ) : (
                              <AlertTriangle className="h-5 w-5 text-amber-500 inline" />
                            )}
                          </td>
                        </tr>
                      </tbody>
                    </table>
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
                      <CheckCircle2 className="h-6 w-6 text-green-600" />
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
                    syncPreview.summary.status === "in_sync" && "bg-gray-50 dark:bg-gray-950/30 border border-gray-200 dark:border-gray-800"
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
    </div>
  );
}
