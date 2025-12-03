"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Loader } from "@/components/ui/loader";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import {
  ArrowLeft,
  DollarSign,
  Building2,
  Calendar,
  FileText,
  Plus,
  Trash2,
  ChevronsUpDown,
  Check,
  Loader2,
} from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

interface Supplier {
  id: number;
  full_name: string;
  display_name?: string;
  email?: string;
  phone?: string;
  address?: string;
}

interface PricebookItem {
  id: number;
  item_code: string;
  item_name: string;
  current_price: number;
  unit_of_measure?: string;
}

interface LineItem {
  id?: number;
  pricebook_item_id?: number;
  pricebook_item?: PricebookItem;
  description: string;
  quantity: number;
  unit_price: number;
  notes?: string;
  line_number?: number;
  _destroy?: boolean;
}

interface Job {
  id: number;
  title: string;
  site_supervisor_info?: {
    id: number;
    full_name: string;
  } | null;
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

  // Pricebook items for line item code selection
  const [pricebookItems, setPricebookItems] = useState<PricebookItem[]>([]);
  const [loadingPricebook, setLoadingPricebook] = useState(false);
  const [pricebookOpenFor, setPricebookOpenFor] = useState<number | null>(null);
  const [pricebookSearch, setPricebookSearch] = useState("");

  // Editable fields
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState("draft");
  const [budget, setBudget] = useState("");
  const [requiredDate, setRequiredDate] = useState("");
  const [orderedDate, setOrderedDate] = useState("");
  const [notes, setNotes] = useState("");
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [lineItems, setLineItems] = useState<LineItem[]>([]);

  // Load purchase order
  useEffect(() => {
    loadPurchaseOrder();
  }, [recordId]);

  // Debounced pricebook search
  useEffect(() => {
    if (pricebookOpenFor === null) return;

    const timer = setTimeout(() => {
      loadPricebookItems(pricebookSearch || undefined);
    }, 300);

    return () => clearTimeout(timer);
  }, [pricebookSearch, pricebookOpenFor]);

  const loadPurchaseOrder = async () => {
    try {
      setLoading(true);
      const response = await api.get<PurchaseOrder>(`/api/v1/purchase_orders/${recordId}`);
      setPurchaseOrder(response);

      // Initialize editable fields
      setDescription(response.description || "");
      setStatus(response.status || "draft");
      setBudget(response.budget?.toString() || "");
      setRequiredDate(response.required_date || "");
      setOrderedDate(response.ordered_date || "");
      setNotes(response.special_instructions || "");
      setSelectedSupplier(response.supplier || null);
      setLineItems(response.line_items || [{ description: "", quantity: 1, unit_price: 0 }]);
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

  // Load pricebook items with supplier filter and optional search
  const loadPricebookItems = async (search?: string) => {
    // Only load if we have a supplier selected
    if (!selectedSupplier?.id) {
      setPricebookItems([]);
      return;
    }
    try {
      setLoadingPricebook(true);
      const searchParam = search ? `&search=${encodeURIComponent(search)}` : "";
      const response = await api.get<{ items: PricebookItem[] }>(
        `/api/v1/pricebook?per_page=500&supplier_id=${selectedSupplier.id}${searchParam}`
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
          status,
          budget: budget ? parseFloat(budget) : null,
          required_date: requiredDate || null,
          ordered_date: orderedDate || null,
          special_instructions: notes || null,
          supplier_id: selectedSupplier?.id || null,
          line_items_attributes: lineItems.map((item, index) => ({
            id: item.id,
            pricebook_item_id: item.pricebook_item_id || null,
            description: item.description,
            quantity: item.quantity,
            unit_price: item.unit_price,
            notes: item.notes || null,
            line_number: index + 1,
            _destroy: item._destroy || false,
          })),
        },
      };

      await api.patch(`/api/v1/purchase_orders/${recordId}`, updateData);
      await loadPurchaseOrder();
    } catch (err) {
      console.error("Failed to save purchase order:", err);
      setError("Failed to save changes");
    } finally {
      setSaving(false);
    }
  };

  // Line item handlers
  const addLineItem = () => {
    setLineItems([...lineItems, { description: "", quantity: 1, unit_price: 0 }]);
  };

  const updateLineItem = (index: number, field: keyof LineItem, value: unknown) => {
    const updated = [...lineItems];
    updated[index] = { ...updated[index], [field]: value };
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
    updated[index] = {
      ...updated[index],
      pricebook_item_id: item.id,
      pricebook_item: item,
      description: item.item_name,
      unit_price: item.current_price,
    };
    setLineItems(updated);
    setPricebookOpenFor(null);
  };

  // Calculate totals
  const calculateSubtotal = useCallback(() => {
    return lineItems
      .filter((item) => !item._destroy)
      .reduce((sum, item) => sum + (item.quantity || 0) * (item.unit_price || 0), 0);
  }, [lineItems]);

  const subtotal = calculateSubtotal();
  const gst = subtotal * 0.1;
  const total = subtotal + gst;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader />
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
            <Select value={description} onValueChange={setDescription}>
              <SelectTrigger className="w-auto min-w-[200px] border-none bg-transparent text-xl font-semibold">
                <SelectValue placeholder="Select description..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="CLAIM - DEPOSIT">CLAIM - DEPOSIT</SelectItem>
                <SelectItem value="CLAIM - PROGRESS">CLAIM - PROGRESS</SelectItem>
                <SelectItem value="CLAIM - FINAL">CLAIM - FINAL</SelectItem>
                <SelectItem value="MATERIALS">MATERIALS</SelectItem>
                <SelectItem value="LABOUR">LABOUR</SelectItem>
                <SelectItem value="SUBCONTRACTOR">SUBCONTRACTOR</SelectItem>
              </SelectContent>
            </Select>
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
            <Badge
              variant="outline"
              className={cn("border", STATUS_BADGE_VARIANTS[status] || STATUS_BADGE_VARIANTS.draft)}
            >
              {STATUS_OPTIONS.find((s) => s.value === status)?.label || "Draft"}
            </Badge>
            {purchaseOrder.job?.site_supervisor_info?.full_name && (
              <span className="text-sm text-muted-foreground">
                Site Supervisor: {purchaseOrder.job.site_supervisor_info.full_name}
              </span>
            )}
          </div>
        </div>

        <Button onClick={handleSave} disabled={saving}>
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            "Save Changes"
          )}
        </Button>
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
                    selectedSupplier.display_name || selectedSupplier.full_name
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
                          value={supplier.display_name || supplier.full_name}
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
                          {supplier.display_name || supplier.full_name}
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

      {/* Status Select */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <label className="text-sm font-medium">Status:</label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Line Items */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-muted-foreground" />
              <h3 className="text-lg font-semibold">Line Items</h3>
            </div>
            <Button variant="outline" size="sm" onClick={addLineItem}>
              <Plus className="h-4 w-4 mr-2" />
              Add Item
            </Button>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[180px]">CODE</TableHead>
                <TableHead>DESCRIPTION</TableHead>
                <TableHead className="w-[100px] text-right">QTY</TableHead>
                <TableHead className="w-[120px] text-right">UNIT PRICE</TableHead>
                <TableHead className="w-[120px] text-right">TOTAL</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lineItems
                .filter((item) => !item._destroy)
                .map((item, index) => (
                  <TableRow key={item.id || `new-${index}`}>
                    <TableCell>
                      <Popover
                        open={pricebookOpenFor === index}
                        onOpenChange={(open) => {
                          setPricebookOpenFor(open ? index : null);
                          if (open) loadPricebookItems();
                        }}
                      >
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            role="combobox"
                            className="w-full justify-between"
                            disabled={!selectedSupplier}
                            title={!selectedSupplier ? "Select a supplier first" : undefined}
                          >
                            {item.pricebook_item?.item_code || (!selectedSupplier ? "Select supplier first" : "Select...")}
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
                                {pricebookItems
                                  .filter((pbItem) => {
                                    if (!pricebookSearch) return true;
                                    const search = pricebookSearch.toLowerCase();
                                    return (
                                      pbItem.item_code?.toLowerCase().includes(search) ||
                                      pbItem.item_name?.toLowerCase().includes(search)
                                    );
                                  })
                                  .slice(0, 50)
                                  .map((pbItem) => (
                                  <CommandItem
                                    key={pbItem.id}
                                    value={`${pbItem.item_code} ${pbItem.item_name}`}
                                    onSelect={() => {
                                      selectPricebookItem(index, pbItem);
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
                    <TableCell>
                      <Input
                        value={item.description}
                        onChange={(e) => updateLineItem(index, "description", e.target.value)}
                        placeholder="Item description"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        value={item.quantity}
                        onChange={(e) =>
                          updateLineItem(index, "quantity", parseFloat(e.target.value) || 0)
                        }
                        className="text-right"
                        min={0}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        value={item.unit_price}
                        onChange={(e) =>
                          updateLineItem(index, "unit_price", parseFloat(e.target.value) || 0)
                        }
                        className="text-right"
                        min={0}
                        step={0.01}
                      />
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency((item.quantity || 0) * (item.unit_price || 0))}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeLineItem(index)}
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              {lineItems.filter((item) => !item._destroy).length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    No line items yet. Click &quot;Add Item&quot; to add one.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
