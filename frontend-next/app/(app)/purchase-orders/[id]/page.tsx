"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ArrowLeft,
  Building2,
  Calendar,
  DollarSign,
  FileText,
  Loader2,
  MapPin,
  Phone,
  Mail,
  Send,
  CheckCircle,
  Package,
  User,
  Briefcase,
  Save,
  ChevronsUpDown,
  Check,
  Plus,
  Trash2,
  AlertCircle,
} from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

interface LineItem {
  id?: number;
  description: string;
  quantity: number;
  unit_price: number;
  tax_amount?: number;
  notes?: string;
  _destroy?: boolean;
  pricebook_item?: {
    id: number;
    item_code: string;
    item_name: string;
    current_price: number;
    unit_of_measure?: string;
  };
}

interface Contact {
  id: number;
  name?: string;
  full_name?: string;
  display_name?: string;
  contact_person?: string;
  email?: string;
  phone?: string;
  address?: string;
}

interface TaskTemplate {
  id: number;
  name: string;
  category?: string;
}

interface Job {
  id: number;
  title: string;
  location?: string;
  site_supervisor_info?: {
    name?: string;
    email?: string;
    phone?: string;
  };
}

interface PurchaseOrder {
  id: number;
  purchase_order_number: string;
  description?: string;
  status: string;
  total: number;
  sub_total: number;
  tax: number;
  budget?: number;
  required_date?: string;
  required_on_site_date?: string;
  ordered_date?: string;
  expected_delivery_date?: string;
  received_date?: string;
  delivery_address?: string;
  special_instructions?: string;
  ted_task?: string;
  approved_at?: string;
  approved_by_id?: number;
  supplier_id?: number;
  job_id?: number;
  created_at: string;
  updated_at: string;
  supplier?: Contact;
  job?: Job;
  line_items?: LineItem[];
}

const STATUS_OPTIONS = [
  { value: "draft", label: "Draft" },
  { value: "pending", label: "Pending Approval" },
  { value: "approved", label: "Approved" },
  { value: "sent", label: "Sent" },
  { value: "received", label: "Received" },
  { value: "invoiced", label: "Invoiced" },
  { value: "paid", label: "Paid" },
  { value: "cancelled", label: "Cancelled" },
];

function formatCurrency(value: number | null | undefined): string {
  if (value == null) return "$0.00";
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatDateForInput(dateString: string | null | undefined): string {
  if (!dateString) return "";
  return dateString.split("T")[0];
}

function getStatusBadge(status: string) {
  switch (status?.toLowerCase()) {
    case "draft":
      return <Badge variant="outline">Draft</Badge>;
    case "pending":
      return <Badge variant="secondary">Pending Approval</Badge>;
    case "approved":
      return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Approved</Badge>;
    case "sent":
      return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">Sent</Badge>;
    case "received":
      return <Badge className="bg-purple-100 text-purple-800 hover:bg-purple-100">Received</Badge>;
    case "invoiced":
      return <Badge className="bg-orange-100 text-orange-800 hover:bg-orange-100">Invoiced</Badge>;
    case "paid":
      return <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">Paid</Badge>;
    case "cancelled":
      return <Badge variant="destructive">Cancelled</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

export default function PurchaseOrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const poId = params.id as string;

  const [po, setPo] = React.useState<PurchaseOrder | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [actionLoading, setActionLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [hasChanges, setHasChanges] = React.useState(false);

  // Form state
  const [formData, setFormData] = React.useState<Partial<PurchaseOrder>>({});
  const [lineItems, setLineItems] = React.useState<LineItem[]>([]);

  // Contacts for supplier dropdown
  const [contacts, setContacts] = React.useState<Contact[]>([]);
  const [loadingContacts, setLoadingContacts] = React.useState(false);
  const [supplierOpen, setSupplierOpen] = React.useState(false);

  // Task templates for task dropdown
  const [taskTemplates, setTaskTemplates] = React.useState<TaskTemplate[]>([]);
  const [loadingTasks, setLoadingTasks] = React.useState(false);
  const [taskOpen, setTaskOpen] = React.useState(false);

  const loadPurchaseOrder = React.useCallback(async () => {
    try {
      const data = await api.get<PurchaseOrder>(`/api/v1/purchase_orders/${poId}`);
      setPo(data);
      setFormData({
        description: data.description || "",
        status: data.status,
        budget: data.budget,
        required_date: data.required_date,
        required_on_site_date: data.required_on_site_date,
        ordered_date: data.ordered_date,
        expected_delivery_date: data.expected_delivery_date,
        delivery_address: data.delivery_address || "",
        special_instructions: data.special_instructions || "",
        ted_task: data.ted_task || "",
        supplier_id: data.supplier?.id,
      });
      setLineItems(data.line_items || []);
    } catch (err) {
      console.error("Failed to fetch purchase order:", err);
      setError("Failed to load purchase order");
    } finally {
      setLoading(false);
    }
  }, [poId]);

  const loadContacts = async () => {
    if (contacts.length > 0) return;
    try {
      setLoadingContacts(true);
      const response = await api.get<{ contacts: Contact[] }>("/api/v1/contacts?type=suppliers");
      setContacts(response?.contacts || []);
    } catch (err) {
      console.error("Failed to load contacts:", err);
    } finally {
      setLoadingContacts(false);
    }
  };

  const loadTaskTemplates = async () => {
    if (taskTemplates.length > 0) return;
    try {
      setLoadingTasks(true);
      const response = await api.get<{ task_templates: TaskTemplate[] }>("/api/v1/task_templates");
      setTaskTemplates(response?.task_templates || []);
    } catch (err) {
      console.error("Failed to load task templates:", err);
    } finally {
      setLoadingTasks(false);
    }
  };

  React.useEffect(() => {
    if (poId) {
      loadPurchaseOrder();
    }
  }, [poId, loadPurchaseOrder]);

  const updateFormField = (field: string, value: unknown) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };

  const updateLineItem = (index: number, field: string, value: unknown) => {
    setLineItems((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
    setHasChanges(true);
  };

  const addLineItem = () => {
    setLineItems((prev) => [
      ...prev,
      { description: "", quantity: 1, unit_price: 0 },
    ]);
    setHasChanges(true);
  };

  const removeLineItem = (index: number) => {
    setLineItems((prev) => {
      const item = prev[index];
      if (item.id) {
        // Mark existing item for destruction
        const updated = [...prev];
        updated[index] = { ...item, _destroy: true };
        return updated;
      } else {
        // Remove new item entirely
        return prev.filter((_, i) => i !== index);
      }
    });
    setHasChanges(true);
  };

  const calculateTotals = () => {
    const visibleItems = lineItems.filter((item) => !item._destroy);
    const subTotal = visibleItems.reduce(
      (sum, item) => sum + item.quantity * item.unit_price,
      0
    );
    const tax = subTotal * 0.1; // 10% GST
    return { subTotal, tax, total: subTotal + tax };
  };

  const handleSave = async () => {
    if (!po) return;
    setSaving(true);
    setError(null);

    try {
      const payload = {
        purchase_order: {
          ...formData,
          line_items_attributes: lineItems.map((item) => ({
            id: item.id,
            description: item.description,
            quantity: item.quantity,
            unit_price: item.unit_price,
            notes: item.notes,
            _destroy: item._destroy,
          })),
        },
      };

      await api.patch(`/api/v1/purchase_orders/${po.id}`, payload);
      await loadPurchaseOrder();
      setHasChanges(false);
    } catch (err) {
      console.error("Failed to save purchase order:", err);
      setError("Failed to save changes. The PO may not be editable in its current status.");
    } finally {
      setSaving(false);
    }
  };

  const handleApprove = async () => {
    if (!po) return;
    setActionLoading(true);
    try {
      await api.post(`/api/v1/purchase_orders/${po.id}/approve`);
      await loadPurchaseOrder();
    } catch (err) {
      console.error("Failed to approve PO:", err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleSend = async () => {
    if (!po) return;
    setActionLoading(true);
    try {
      await api.post(`/api/v1/purchase_orders/${po.id}/send_to_supplier`);
      await loadPurchaseOrder();
    } catch (err) {
      console.error("Failed to send PO:", err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleMarkReceived = async () => {
    if (!po) return;
    setActionLoading(true);
    try {
      await api.post(`/api/v1/purchase_orders/${po.id}/mark_received`);
      await loadPurchaseOrder();
    } catch (err) {
      console.error("Failed to mark PO as received:", err);
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!po) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">Purchase order not found</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const canEdit = ["draft", "pending"].includes(po.status);
  const canApprove = po.status === "pending";
  const canSend = po.status === "approved";
  const canMarkReceived = po.status === "sent";
  const { subTotal, tax, total } = calculateTotals();
  const selectedSupplier = contacts.find((c) => c.id === formData.supplier_id) || po.supplier;

  return (
    <div className="h-full overflow-y-auto">
      <div className="space-y-6 pb-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => router.back()}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold tracking-tight font-serif">
                  {po.purchase_order_number}
                </h1>
                <span className="text-muted-foreground">-</span>
                <Popover open={taskOpen} onOpenChange={(open) => {
                  setTaskOpen(open);
                  if (open) loadTaskTemplates();
                }}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="ghost"
                      role="combobox"
                      aria-expanded={taskOpen}
                      className="p-0 h-auto hover:bg-transparent"
                      disabled={!canEdit || loadingTasks}
                    >
                      <span className="text-2xl font-bold tracking-tight font-serif">
                        {formData.description || "Select Task"}
                      </span>
                      {canEdit && <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[300px] p-0">
                    <Command>
                      <CommandInput placeholder="Search tasks..." />
                      <CommandList>
                        <CommandEmpty>No task found.</CommandEmpty>
                        <CommandGroup>
                          {taskTemplates.map((task) => (
                            <CommandItem
                              key={task.id}
                              value={task.name}
                              onSelect={() => {
                                updateFormField("description", task.name);
                                updateFormField("ted_task", task.category || "");
                                setTaskOpen(false);
                              }}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  formData.description === task.name ? "opacity-100" : "opacity-0"
                                )}
                              />
                              {task.name}
                              {task.category && (
                                <span className="ml-auto text-xs text-muted-foreground">{task.category}</span>
                              )}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
                {po.job && (
                  <>
                    <span className="text-muted-foreground">•</span>
                    <Button
                      variant="link"
                      className="p-0 h-auto text-lg font-medium"
                      onClick={() => router.push(`/jobs/${po.job?.id}?tab=purchase-orders`)}
                    >
                      <Briefcase className="h-4 w-4 mr-2" />
                      {po.job.title}
                    </Button>
                  </>
                )}
              </div>
              <div className="flex items-center gap-2 mt-1">
                {getStatusBadge(po.status)}
                {po.job?.site_supervisor_info?.name && (
                  <span className="text-sm text-muted-foreground">
                    • Site Supervisor: {po.job.site_supervisor_info.name}
                  </span>
                )}
                {po.job?.location && (
                  <span className="text-sm text-muted-foreground">
                    • {po.job.location}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {hasChanges && (
              <Button onClick={handleSave} disabled={saving}>
                {saving ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                Save Changes
              </Button>
            )}
            {canApprove && (
              <Button onClick={handleApprove} disabled={actionLoading} variant="outline">
                <CheckCircle className="h-4 w-4 mr-2" />
                Approve
              </Button>
            )}
            {canSend && (
              <Button onClick={handleSend} disabled={actionLoading} variant="outline">
                <Send className="h-4 w-4 mr-2" />
                Send to Supplier
              </Button>
            )}
            {canMarkReceived && (
              <Button onClick={handleMarkReceived} disabled={actionLoading} variant="outline">
                <Package className="h-4 w-4 mr-2" />
                Mark Received
              </Button>
            )}
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="bg-destructive/10 border border-destructive/20 rounded-md p-4 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-destructive" />
            <p className="text-sm text-destructive">{error}</p>
            <Button
              variant="ghost"
              size="sm"
              className="ml-auto"
              onClick={() => setError(null)}
            >
              Dismiss
            </Button>
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Total (Inc GST)</span>
              </div>
              <p className="text-2xl font-bold">{formatCurrency(total)}</p>
              <div className="flex gap-3 text-sm text-muted-foreground mt-1">
                <span>Ex GST: {formatCurrency(subTotal)}</span>
                <span>GST: {formatCurrency(tax)}</span>
              </div>
              <div className="flex items-center gap-2 mt-2 pt-2 border-t">
                <Label className="text-xs text-muted-foreground">Budget:</Label>
                <Input
                  type="number"
                  value={formData.budget || ""}
                  onChange={(e) => updateFormField("budget", e.target.value ? parseFloat(e.target.value) : null)}
                  className="h-7 text-sm"
                  disabled={!canEdit}
                />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-2 mb-2">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Supplier</span>
              </div>
              <Popover open={supplierOpen} onOpenChange={(open) => {
                setSupplierOpen(open);
                if (open) loadContacts();
              }}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={supplierOpen}
                    className="w-full justify-between h-8 text-sm"
                    disabled={!canEdit || loadingContacts}
                  >
                    {loadingContacts ? (
                      <span className="text-muted-foreground">Loading...</span>
                    ) : selectedSupplier ? (
                      <span className="truncate">{selectedSupplier.display_name || selectedSupplier.full_name || selectedSupplier.name}</span>
                    ) : (
                      <span className="text-muted-foreground">Select...</span>
                    )}
                    <ChevronsUpDown className="ml-1 h-3 w-3 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[300px] p-0">
                  <Command value={selectedSupplier?.display_name || selectedSupplier?.full_name || selectedSupplier?.name || ""}>
                    <CommandInput placeholder="Search suppliers..." />
                    <CommandList>
                      <CommandEmpty>No supplier found.</CommandEmpty>
                      <CommandGroup>
                        {contacts.map((contact) => {
                          const isSelected = formData.supplier_id === contact.id;
                          return (
                            <CommandItem
                              key={contact.id}
                              value={contact.display_name || contact.full_name || contact.name}
                              onSelect={() => {
                                updateFormField("supplier_id", contact.id);
                                setSupplierOpen(false);
                              }}
                              className={cn(isSelected && "bg-accent")}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  isSelected ? "opacity-100" : "opacity-0"
                                )}
                              />
                              {contact.display_name || contact.full_name || contact.name}
                            </CommandItem>
                          );
                        })}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              {selectedSupplier && (
                <div className="mt-2 text-xs text-muted-foreground space-y-0.5">
                  {selectedSupplier.contact_person && <p>{selectedSupplier.contact_person}</p>}
                  {selectedSupplier.phone && <p>{selectedSupplier.phone}</p>}
                  {selectedSupplier.email && <p className="truncate">{selectedSupplier.email}</p>}
                  {selectedSupplier.address && <p className="truncate">{selectedSupplier.address}</p>}
                </div>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="space-y-2">
                <div>
                  <Label className="text-xs text-muted-foreground">Required Date</Label>
                  <Input
                    type="date"
                    value={formatDateForInput(formData.required_date)}
                    onChange={(e) => updateFormField("required_date", e.target.value || null)}
                    className="mt-1 h-8 text-sm"
                    disabled={!canEdit}
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Ordered Date</Label>
                  <Input
                    type="date"
                    value={formatDateForInput(formData.ordered_date)}
                    onChange={(e) => updateFormField("ordered_date", e.target.value || null)}
                    className="mt-1 h-8 text-sm"
                    disabled={!canEdit}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <div>
                <Label className="text-xs text-muted-foreground">Notes</Label>
                <Textarea
                  value={formData.special_instructions || ""}
                  onChange={(e) => updateFormField("special_instructions", e.target.value)}
                  rows={3}
                  className="mt-1 text-sm max-h-24 overflow-y-auto resize-none"
                  disabled={!canEdit}
                  placeholder="Additional notes..."
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Line Items */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Line Items
            </CardTitle>
            {canEdit && (
              <Button size="sm" onClick={addLineItem}>
                <Plus className="h-4 w-4 mr-2" />
                Add Item
              </Button>
            )}
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40%]">Description</TableHead>
                  <TableHead className="text-right w-[15%]">Qty</TableHead>
                  <TableHead className="text-right w-[20%]">Unit Price</TableHead>
                  <TableHead className="text-right w-[20%]">Total</TableHead>
                  {canEdit && <TableHead className="w-[5%]"></TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {lineItems.filter((item) => !item._destroy).length > 0 ? (
                  lineItems.map((item, index) =>
                    !item._destroy ? (
                      <TableRow key={item.id || `new-${index}`}>
                        <TableCell>
                          {canEdit ? (
                            <Input
                              value={item.description}
                              onChange={(e) => updateLineItem(index, "description", e.target.value)}
                              placeholder="Item description"
                            />
                          ) : (
                            <div>
                              <p className="font-medium">{item.description}</p>
                              {item.pricebook_item && (
                                <p className="text-sm text-muted-foreground">
                                  {item.pricebook_item.item_code} - {item.pricebook_item.item_name}
                                </p>
                              )}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {canEdit ? (
                            <Input
                              type="number"
                              value={item.quantity}
                              onChange={(e) => updateLineItem(index, "quantity", parseFloat(e.target.value) || 0)}
                              className="text-right"
                              min="0"
                              step="0.01"
                            />
                          ) : (
                            item.quantity
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {canEdit ? (
                            <Input
                              type="number"
                              value={item.unit_price}
                              onChange={(e) => updateLineItem(index, "unit_price", parseFloat(e.target.value) || 0)}
                              className="text-right"
                              min="0"
                              step="0.01"
                            />
                          ) : (
                            formatCurrency(item.unit_price)
                          )}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(item.quantity * item.unit_price)}
                        </TableCell>
                        {canEdit && (
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => removeLineItem(index)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </TableCell>
                        )}
                      </TableRow>
                    ) : null
                  )
                ) : (
                  <TableRow>
                    <TableCell colSpan={canEdit ? 5 : 4} className="text-center py-8">
                      <p className="text-sm text-muted-foreground">
                        No line items added to this purchase order
                      </p>
                      {canEdit && (
                        <Button variant="outline" size="sm" className="mt-2" onClick={addLineItem}>
                          <Plus className="h-4 w-4 mr-2" />
                          Add First Item
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>

            {lineItems.filter((item) => !item._destroy).length > 0 && (
              <>
                <Separator className="my-4" />
                <div className="flex justify-end">
                  <div className="w-64 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Subtotal</span>
                      <span>{formatCurrency(subTotal)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Tax (GST 10%)</span>
                      <span>{formatCurrency(tax)}</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between font-medium">
                      <span>Total</span>
                      <span>{formatCurrency(total)}</span>
                    </div>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
