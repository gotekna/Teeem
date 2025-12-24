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
import {
  ArrowLeft,
  DollarSign,
  Building2,
  Calendar,
  FileText,
  Trash2,
  ChevronsUpDown,
  Check,
} from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

interface Supplier {
  id: number;
  display_name?: string;
  email?: string;
  phone?: string;
  address?: string;
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
  sm_template_row_id: number;
}

// ComboboxDropdown item type for tasks
interface TaskComboboxItem extends ComboboxItem {
  sm_template_row_id: number;
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
  ordered_date?: string;
  special_instructions?: string;
  delivery_address?: string;
  supplier?: Supplier;
  supplier_id?: number;
  job?: Job;
  job_id?: number;
  line_items: LineItem[];
  sm_template_row_id?: number; // SSoT link to Schedule Master
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

export default function PurchaseOrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const recordId = params.id as string;

  const [purchaseOrder, setPurchaseOrder] = useState<PurchaseOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Supplier search
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loadingSuppliers, setLoadingSuppliers] = useState(false);
  const [supplierOpen, setSupplierOpen] = useState(false);

  // Local SmTasks for this job (for task/description lookup)
  const [taskItems, setTaskItems] = useState<TaskComboboxItem[]>([]);
  const [loadingTasks, setLoadingTasks] = useState(false);

  // Pricebook items for line item code selection
  const [pricebookItems, setPricebookItems] = useState<PricebookItem[]>([]);
  const [loadingPricebook, setLoadingPricebook] = useState(false);
  const [pricebookOpenFor, setPricebookOpenFor] = useState<number | null>(null);
  const [pricebookSearch, setPricebookSearch] = useState("");

  // Editable fields
  const [description, setDescription] = useState("");
  const [smTemplateRowId, setSmTemplateRowId] = useState<number | null>(null); // SSoT link
  const [status, setStatus] = useState("draft");
  const [budget, setBudget] = useState("");
  const [requiredDate, setRequiredDate] = useState("");
  const [orderedDate, setOrderedDate] = useState("");
  const [notes, setNotes] = useState("");
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [lineItems, setLineItems] = useState<LineItem[]>([]);

  // Original state for change tracking
  const [originalState, setOriginalState] = useState<{
    description: string;
    smTemplateRowId: number | null;
    status: string;
    budget: string;
    requiredDate: string;
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

  // Debounced server-side search for pricebook items
  useEffect(() => {
    if (pricebookOpenFor === null) return;

    const timer = setTimeout(() => {
      loadPricebookItems(pricebookSearch || undefined);
    }, 300);

    return () => clearTimeout(timer);
  }, [pricebookSearch, pricebookOpenFor]);

  // Load SmTasks when purchaseOrder is loaded (for task dropdown)
  useEffect(() => {
    if (purchaseOrder?.job_id) {
      loadSmTasks();
    }
  }, [purchaseOrder?.job_id]);

  const loadPurchaseOrder = async () => {
    try {
      setLoading(true);
      const response = await api.get<PurchaseOrder>(`/api/v1/purchase_orders/${recordId}`);
      setPurchaseOrder(response);

      // Initialize editable fields
      const desc = response.description || "";
      const templateRowId = response.sm_template_row_id || null;
      const stat = response.status || "draft";
      const budg = response.budget?.toString() || "";
      const reqDate = response.required_date || "";
      const ordDate = response.ordered_date || "";
      const note = response.special_instructions || "";
      const supp = response.supplier || null;

      // Sort line items by price and ensure there's always one blank line at the end
      const items = response.line_items || [];
      const sortedItems = [...items].sort((a, b) => (b.unit_price || 0) - (a.unit_price || 0));
      const itemsWithBlank = [...sortedItems, { description: "", quantity: 0, unit_price: 0 }];

      setDescription(desc);
      setSmTemplateRowId(templateRowId);
      setStatus(stat);
      setBudget(budg);
      setRequiredDate(reqDate);
      setOrderedDate(ordDate);
      setNotes(note);
      setSelectedSupplier(supp);
      setLineItems(itemsWithBlank);

      // Store original state for change tracking (with sorted items)
      setOriginalState({
        description: desc,
        smTemplateRowId: templateRowId,
        status: stat,
        budget: budg,
        requiredDate: reqDate,
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

  // Load suppliers
  const loadSuppliers = async () => {
    if (suppliers.length > 0) return;
    try {
      setLoadingSuppliers(true);
      const response = await api.get<{ contacts: Supplier[] }>("/api/v1/contacts?type=suppliers");
      setSuppliers(response?.contacts || []);
    } catch (err) {
      console.error("Failed to load suppliers:", err);
    } finally {
      setLoadingSuppliers(false);
    }
  };

  // Load local SmTasks for this job (for task/description lookup)
  const loadSmTasks = async () => {
    if (!purchaseOrder?.job_id) return;
    if (taskItems.length > 0) return;
    try {
      setLoadingTasks(true);
      // Fetch SmTasks for this specific job (LOCAL schedule master)
      const response = await api.get<{ tasks: SmTask[] }>(`/api/v1/sm_tasks?job_id=${purchaseOrder.job_id}`);
      // Convert to ComboboxItem format
      const items: TaskComboboxItem[] = (response?.tasks || []).map((task) => ({
        id: String(task.sm_template_row_id), // Use sm_template_row_id as the key for matching
        label: task.name,
        sm_template_row_id: task.sm_template_row_id,
      }));
      setTaskItems(items);
    } catch (err) {
      console.error("Failed to load SmTasks:", err);
    } finally {
      setLoadingTasks(false);
    }
  };

  // Helper to check if a line item is blank (no meaningful data)
  const isBlankLineItem = (item: LineItem) => {
    return !item.id && !item.pricebook_item_id && !item.description && item.quantity <= 0 && item.unit_price <= 0;
  };

  // Load pricebook items with server-side search
  const loadPricebookItems = async (search?: string) => {
    // TODO: Re-enable supplier filter when pricebook items are properly linked to suppliers
    try {
      setLoadingPricebook(true);
      const searchParam = search ? `&search=${encodeURIComponent(search)}` : "";
      const response = await api.get<{ items: PricebookItem[] }>(
        `/api/v1/pricebook?per_page=100${searchParam}`
      );
      setPricebookItems(response?.items || []);
    } catch (err) {
      console.error("Failed to load pricebook items:", err);
    } finally {
      setLoadingPricebook(false);
    }
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
          sm_template_row_id: smTemplateRowId,
          status,
          budget: budget ? parseFloat(budget) : null,
          required_date: requiredDate || null,
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
      const templateRowId = response.sm_template_row_id || null;
      const stat = response.status || "draft";
      const budg = response.budget?.toString() || "";
      const reqDate = response.required_date || "";
      const ordDate = response.ordered_date || "";
      const note = response.special_instructions || "";
      const supp = response.supplier || null;

      // Sort line items by price and ensure there's always one blank line at the end
      const items = response.line_items || [];
      const sortedItems = [...items].sort((a, b) => (b.unit_price || 0) - (a.unit_price || 0));
      const itemsWithBlank = [...sortedItems, { description: "", quantity: 0, unit_price: 0 }];

      setDescription(desc);
      setSmTemplateRowId(templateRowId);
      setStatus(stat);
      setBudget(budg);
      setRequiredDate(reqDate);
      setOrderedDate(ordDate);
      setNotes(note);
      setSelectedSupplier(supp);
      setLineItems(itemsWithBlank);

      // Store original state for change tracking (with sorted items)
      setOriginalState({
        description: desc,
        smTemplateRowId: templateRowId,
        status: stat,
        budget: budg,
        requiredDate: reqDate,
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
      smTemplateRowId !== originalState.smTemplateRowId ||
      status !== originalState.status ||
      budget !== originalState.budget ||
      requiredDate !== originalState.requiredDate ||
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
    smTemplateRowId,
    status,
    budget,
    requiredDate,
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
    setSmTemplateRowId(originalState.smTemplateRowId);
    setStatus(originalState.status);
    setBudget(originalState.budget);
    setRequiredDate(originalState.requiredDate);
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
    setPricebookOpenFor(null);
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
          onClick={() => router.push("/purchase_orders")}
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
                selectedItem={taskItems.find((t) => t.sm_template_row_id === smTemplateRowId)}
                onSelect={(item) => {
                  setDescription(item.label);
                  setSmTemplateRowId(item.sm_template_row_id); // SSoT link
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

        {/* Supplier Card */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
              <Building2 className="h-4 w-4" />
              Supplier
            </div>
            <Popover
              open={supplierOpen}
              onOpenChange={(open) => {
                setSupplierOpen(open);
                if (open) loadSuppliers();
              }}
            >
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={supplierOpen}
                  className="w-full justify-between"
                  disabled={loadingSuppliers}
                >
                  {loadingSuppliers ? (
                    <span className="text-muted-foreground">Loading...</span>
                  ) : selectedSupplier ? (
                    selectedSupplier.display_name || selectedSupplier.display_name
                  ) : (
                    <span className="text-muted-foreground">Select...</span>
                  )}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[300px] p-0">
                <Command>
                  <CommandInput placeholder="Search suppliers..." />
                  <CommandList>
                    <CommandEmpty>No supplier found.</CommandEmpty>
                    <CommandGroup>
                      {suppliers.map((supplier) => (
                        <CommandItem
                          key={supplier.id}
                          value={supplier.display_name || supplier.display_name}
                          onSelect={() => {
                            setSelectedSupplier(supplier);
                            setSupplierOpen(false);
                            // Clear pricebook cache when supplier changes
                            setPricebookItems([]);
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              selectedSupplier?.id === supplier.id ? "opacity-100" : "opacity-0"
                            )}
                          />
                          {supplier.display_name || supplier.display_name}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
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

                  // Determine background color (priority: grey out > price changed > normal)
                  const rowBgColor = shouldGreyOut ? '#f1f5f9' : (hasPriceChanged ? '#fb923c' : undefined);

                  return (
                  <TableRow
                    key={item.id || `new-${originalIndex}`}
                    className="h-auto"
                    style={rowBgColor ? { backgroundColor: rowBgColor } : undefined}
                  >
                    <TableCell className="py-1 border-b" style={rowBgColor ? { backgroundColor: rowBgColor } : undefined}>
                      <Popover
                        open={pricebookOpenFor === originalIndex}
                        onOpenChange={(open) => {
                          setPricebookOpenFor(open ? originalIndex : null);
                          if (!open) setPricebookSearch(""); // Clear search when closing
                        }}
                      >
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            role="combobox"
                            className="w-full justify-between border-0 rounded-none h-10 focus-visible:ring-0 focus-visible:ring-offset-0"
                            style={rowBgColor ? { backgroundColor: rowBgColor } : undefined}
                          >
                            {item.pricebook_item?.item_code || (
                              <span className="text-muted-foreground">-</span>
                            )}
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[300px] p-0">
                          <Command shouldFilter={false}>
                            <CommandInput
                              placeholder="Search items..."
                              value={pricebookSearch}
                              onValueChange={setPricebookSearch}
                            />
                            <CommandList>
                              <CommandEmpty>
                                {loadingPricebook ? "Loading..." : "No items found."}
                              </CommandEmpty>
                              <CommandGroup>
                                {pricebookItems.slice(0, 50).map((pbItem) => (
                                  <CommandItem
                                    key={pbItem.id}
                                    value={`${pbItem.item_code} ${pbItem.item_name}`}
                                    onSelect={() => {
                                      selectPricebookItem(originalIndex, pbItem);
                                      setPricebookSearch("");
                                    }}
                                  >
                                    <Check
                                      className={cn(
                                        "mr-2 h-4 w-4",
                                        item.pricebook_item_id === pbItem.id
                                          ? "opacity-100"
                                          : "opacity-0"
                                      )}
                                    />
                                    <div>
                                      <div className="font-medium">{pbItem.item_code}</div>
                                      <div className="text-sm text-muted-foreground">
                                        {pbItem.item_name}
                                      </div>
                                    </div>
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
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
    </div>
  );
}
