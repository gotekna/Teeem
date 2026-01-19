"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Plus,
  RefreshCw,
  MoreHorizontal,
  Play,
  Pause,
  XCircle,
  Repeat,
  Calendar,
  DollarSign,
  CheckCircle,
  AlertCircle,
} from "lucide-react";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";
import { useConfirm } from "@/contexts/ConfirmationContext";

interface RecurringInvoice {
  id: number;
  name: string;
  invoice_type: "sales_invoice" | "bill";
  description: string | null;
  contact_id: number | null;
  contact_name: string | null;
  job_id: number | null;
  job_name: string | null;
  frequency: string;
  frequency_interval: number;
  frequency_description: string;
  day_of_month: number | null;
  day_of_week: number | null;
  start_date: string;
  end_date: string | null;
  occurrences_limit: number | null;
  occurrences_count: number;
  remaining_occurrences: number | null;
  next_generation_date: string | null;
  last_generated_at: string | null;
  payment_terms_days: number | null;
  currency_code: string;
  subtotal: number;
  total_tax: number;
  total: number;
  line_items_template: LineItem[];
  is_active: boolean;
  status: "active" | "paused" | "cancelled" | "completed";
  auto_approve: boolean;
  send_email_on_generation: boolean;
  email_to: string | null;
  created_by_id: number | null;
  created_by_name: string | null;
  created_at: string;
  updated_at: string;
}

interface LineItem {
  item_code?: string;
  description: string;
  quantity: number;
  unit_price: number;
  discount_percent?: number;
  tax_type?: string;
  tax_rate?: number;
  account_code?: string;
}

interface Summary {
  active_count: number;
  paused_count: number;
  due_today: number;
  total_monthly_value: number;
}

interface Contact {
  id: number;
  name: string;
}

interface Job {
  id: number;
  name: string;
}

const FREQUENCIES = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "fortnightly", label: "Fortnightly" },
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "annually", label: "Annually" },
];

const DAYS_OF_WEEK = [
  { value: "0", label: "Sunday" },
  { value: "1", label: "Monday" },
  { value: "2", label: "Tuesday" },
  { value: "3", label: "Wednesday" },
  { value: "4", label: "Thursday" },
  { value: "5", label: "Friday" },
  { value: "6", label: "Saturday" },
];

export default function RecurringInvoicesTab() {
  const { toast } = useToast();
  const { confirm } = useConfirm();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [invoices, setInvoices] = useState<RecurringInvoice[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<RecurringInvoice | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [filter, setFilter] = useState<"all" | "active" | "paused">("all");

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    invoice_type: "sales_invoice" as "sales_invoice" | "bill",
    description: "",
    contact_id: "",
    job_id: "",
    frequency: "monthly",
    frequency_interval: 1,
    day_of_month: "",
    day_of_week: "",
    start_date: new Date().toISOString().split("T")[0],
    end_date: "",
    occurrences_limit: "",
    payment_terms_days: "14",
    auto_approve: false,
    send_email_on_generation: false,
    email_to: "",
    email_cc: "",
    line_items_template: [
      { description: "", quantity: 1, unit_price: 0, tax_rate: 10 },
    ] as LineItem[],
  });

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [invoicesRes, summaryRes] = await Promise.all([
        api.get<{ success: boolean; data: RecurringInvoice[] }>("/api/v1/gl/recurring_invoices"),
        api.get<{ success: boolean; data: Summary }>("/api/v1/gl/recurring_invoices/summary"),
      ]);

      if (invoicesRes?.success) {
        setInvoices(invoicesRes.data || []);
      }
      if (summaryRes?.success) {
        setSummary(summaryRes.data);
      }
    } catch (err) {
      console.error("Failed to fetch recurring invoices:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchContacts = useCallback(async () => {
    try {
      const res = await api.get<{ success: boolean; data: Contact[] }>("/api/v1/contacts?limit=100");
      if (res?.success) {
        setContacts(res.data || []);
      }
    } catch (err) {
      console.error("Failed to fetch contacts:", err);
    }
  }, []);

  const fetchJobs = useCallback(async () => {
    try {
      const res = await api.get<{ success: boolean; data: Job[] }>("/api/v1/jobs?limit=100");
      if (res?.success) {
        setJobs(res.data || []);
      }
    } catch (err) {
      console.error("Failed to fetch jobs:", err);
    }
  }, []);

  useEffect(() => {
    fetchData();
    fetchContacts();
    fetchJobs();
  }, [fetchData, fetchContacts, fetchJobs]);

  const resetForm = () => {
    setFormData({
      name: "",
      invoice_type: "sales_invoice",
      description: "",
      contact_id: "",
      job_id: "",
      frequency: "monthly",
      frequency_interval: 1,
      day_of_month: "",
      day_of_week: "",
      start_date: new Date().toISOString().split("T")[0],
      end_date: "",
      occurrences_limit: "",
      payment_terms_days: "14",
      auto_approve: false,
      send_email_on_generation: false,
      email_to: "",
      email_cc: "",
      line_items_template: [
        { description: "", quantity: 1, unit_price: 0, tax_rate: 10 },
      ],
    });
    setEditingInvoice(null);
  };

  const handleCreate = async () => {
    try {
      setSaving(true);
      const payload = {
        recurring_invoice: {
          ...formData,
          contact_id: formData.contact_id ? parseInt(formData.contact_id) : null,
          job_id: formData.job_id ? parseInt(formData.job_id) : null,
          day_of_month: formData.day_of_month ? parseInt(formData.day_of_month) : null,
          day_of_week: formData.day_of_week ? parseInt(formData.day_of_week) : null,
          occurrences_limit: formData.occurrences_limit ? parseInt(formData.occurrences_limit) : null,
          payment_terms_days: formData.payment_terms_days ? parseInt(formData.payment_terms_days) : 14,
          end_date: formData.end_date || null,
        },
      };

      const res = await api.post<{ success: boolean; error?: string }>("/api/v1/gl/recurring_invoices", payload);

      if (res?.success) {
        setShowCreateDialog(false);
        resetForm();
        await fetchData();
        toast({ title: "Success", description: "Recurring invoice created successfully" });
      } else {
        toast({ title: "Error", description: res?.error || "Failed to create recurring invoice", variant: "destructive" });
      }
    } catch (err) {
      console.error("Failed to create recurring invoice:", err);
      toast({ title: "Error", description: "Failed to create recurring invoice", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleAction = async (invoice: RecurringInvoice, action: "pause" | "resume" | "cancel" | "generate_now") => {
    try {
      const res = await api.post<{ success: boolean; error?: string }>(
        `/api/v1/gl/recurring_invoices/${invoice.id}/${action}`
      );

      if (res?.success) {
        await fetchData();
        toast({ title: "Success", description: `Recurring invoice ${action === "generate_now" ? "generated" : action + "d"} successfully` });
      } else {
        toast({ title: "Error", description: res?.error || `Failed to ${action} recurring invoice`, variant: "destructive" });
      }
    } catch (err) {
      console.error(`Failed to ${action} recurring invoice:`, err);
      toast({ title: "Error", description: `Failed to ${action} recurring invoice`, variant: "destructive" });
    }
  };

  const handleDelete = async (invoice: RecurringInvoice) => {
    const confirmed = await confirm({
      title: "Delete Recurring Invoice",
      description: `Are you sure you want to delete "${invoice.name}"?`,
      confirmText: "Delete",
      cancelText: "Cancel",
      variant: "destructive",
    });
    if (!confirmed) return;

    try {
      const res = await api.delete<{ success: boolean; error?: string }>(
        `/api/v1/gl/recurring_invoices/${invoice.id}`
      );

      if (res?.success) {
        await fetchData();
        toast({ title: "Success", description: "Recurring invoice deleted successfully" });
      } else {
        toast({ title: "Error", description: res?.error || "Failed to delete recurring invoice", variant: "destructive" });
      }
    } catch (err) {
      console.error("Failed to delete recurring invoice:", err);
      toast({ title: "Error", description: "Failed to delete recurring invoice", variant: "destructive" });
    }
  };

  const addLineItem = () => {
    setFormData((prev) => ({
      ...prev,
      line_items_template: [
        ...prev.line_items_template,
        { description: "", quantity: 1, unit_price: 0, tax_rate: 10 },
      ],
    }));
  };

  const removeLineItem = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      line_items_template: prev.line_items_template.filter((_, i) => i !== index),
    }));
  };

  const updateLineItem = (index: number, field: keyof LineItem, value: string | number) => {
    setFormData((prev) => ({
      ...prev,
      line_items_template: prev.line_items_template.map((item, i) =>
        i === index ? { ...item, [field]: value } : item
      ),
    }));
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return (
          <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
            <CheckCircle className="h-3 w-3 mr-1" />
            Active
          </Badge>
        );
      case "paused":
        return (
          <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400">
            <Pause className="h-3 w-3 mr-1" />
            Paused
          </Badge>
        );
      case "cancelled":
        return (
          <Badge className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">
            <XCircle className="h-3 w-3 mr-1" />
            Cancelled
          </Badge>
        );
      case "completed":
        return (
          <Badge className="bg-muted text-foreground dark:bg-background/30 dark:text-muted-foreground">
            <CheckCircle className="h-3 w-3 mr-1" />
            Completed
          </Badge>
        );
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-AU", {
      style: "currency",
      currency: "AUD",
    }).format(amount);
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "-";
    return new Date(dateString).toLocaleDateString("en-AU", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const filteredInvoices = invoices.filter((invoice) => {
    if (filter === "all") return true;
    if (filter === "active") return invoice.status === "active";
    if (filter === "paused") return invoice.status === "paused";
    return true;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Active Recurring
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{summary.active_count}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Paused
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">{summary.paused_count}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Due Today
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{summary.due_today}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Monthly Value
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(summary.total_monthly_value)}</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Invoices List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Repeat className="h-5 w-5" />
              Recurring Invoices
            </CardTitle>
            <div className="flex items-center gap-2">
              <Select value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="paused">Paused</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" size="icon" onClick={fetchData}>
                <RefreshCw className="h-4 w-4" />
              </Button>
              <Button onClick={() => setShowCreateDialog(true)}>
                <Plus className="h-4 w-4 mr-2" />
                New Recurring Invoice
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredInvoices.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Repeat className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium">No recurring invoices</p>
              <p className="text-sm mt-1">Create your first recurring invoice to automate billing</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Frequency</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Next Date</TableHead>
                  <TableHead>Generated</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredInvoices.map((invoice) => (
                  <TableRow key={invoice.id}>
                    <TableCell className="font-medium">{invoice.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {invoice.invoice_type === "sales_invoice" ? "Invoice" : "Bill"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {invoice.contact_name || "-"}
                    </TableCell>
                    <TableCell>{invoice.frequency_description}</TableCell>
                    <TableCell className="font-mono">{formatCurrency(invoice.total)}</TableCell>
                    <TableCell>
                      {invoice.next_generation_date ? (
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3 text-muted-foreground" />
                          {formatDate(invoice.next_generation_date)}
                        </div>
                      ) : (
                        "-"
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{invoice.occurrences_count}</Badge>
                      {invoice.remaining_occurrences !== null && (
                        <span className="text-xs text-muted-foreground ml-1">
                          / {invoice.occurrences_count + invoice.remaining_occurrences}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>{getStatusBadge(invoice.status)}</TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {invoice.status === "active" && (
                            <>
                              <DropdownMenuItem onClick={() => handleAction(invoice, "generate_now")}>
                                <Play className="h-4 w-4 mr-2" />
                                Generate Now
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleAction(invoice, "pause")}>
                                <Pause className="h-4 w-4 mr-2" />
                                Pause
                              </DropdownMenuItem>
                            </>
                          )}
                          {invoice.status === "paused" && (
                            <DropdownMenuItem onClick={() => handleAction(invoice, "resume")}>
                              <Play className="h-4 w-4 mr-2" />
                              Resume
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          {invoice.status !== "cancelled" && invoice.status !== "completed" && (
                            <DropdownMenuItem
                              onClick={() => handleAction(invoice, "cancel")}
                              className="text-red-600"
                            >
                              <XCircle className="h-4 w-4 mr-2" />
                              Cancel
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem
                            onClick={() => handleDelete(invoice)}
                            className="text-red-600"
                          >
                            <XCircle className="h-4 w-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Recurring Invoice</DialogTitle>
            <DialogDescription>
              Set up an invoice that will be automatically generated on a schedule.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Basic Info */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  placeholder="e.g., Monthly Hosting Fee"
                  value={formData.name}
                  onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="invoice_type">Type</Label>
                <Select
                  value={formData.invoice_type}
                  onValueChange={(v) => setFormData((prev) => ({ ...prev, invoice_type: v as "sales_invoice" | "bill" }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sales_invoice">Sales Invoice</SelectItem>
                    <SelectItem value="bill">Bill</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Contact & Job */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="contact">Contact</Label>
                <Select
                  value={formData.contact_id}
                  onValueChange={(v) => setFormData((prev) => ({ ...prev, contact_id: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select contact" />
                  </SelectTrigger>
                  <SelectContent>
                    {contacts.map((contact) => (
                      <SelectItem key={contact.id} value={contact.id.toString()}>
                        {contact.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="job">Job (Optional)</Label>
                <Select
                  value={formData.job_id}
                  onValueChange={(v) => setFormData((prev) => ({ ...prev, job_id: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select job" />
                  </SelectTrigger>
                  <SelectContent>
                    {jobs.map((job) => (
                      <SelectItem key={job.id} value={job.id.toString()}>
                        {job.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Schedule */}
            <div className="space-y-4">
              <h4 className="font-medium">Schedule</h4>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="frequency">Frequency</Label>
                  <Select
                    value={formData.frequency}
                    onValueChange={(v) => setFormData((prev) => ({ ...prev, frequency: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {FREQUENCIES.map((f) => (
                        <SelectItem key={f.value} value={f.value}>
                          {f.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="start_date">Start Date *</Label>
                  <Input
                    id="start_date"
                    type="date"
                    value={formData.start_date}
                    onChange={(e) => setFormData((prev) => ({ ...prev, start_date: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="end_date">End Date (Optional)</Label>
                  <Input
                    id="end_date"
                    type="date"
                    value={formData.end_date}
                    onChange={(e) => setFormData((prev) => ({ ...prev, end_date: e.target.value }))}
                  />
                </div>
              </div>

              {formData.frequency === "monthly" && (
                <div className="space-y-2">
                  <Label htmlFor="day_of_month">Day of Month</Label>
                  <Input
                    id="day_of_month"
                    type="number"
                    min="1"
                    max="28"
                    placeholder="e.g., 1 for 1st of month (-1 for last day)"
                    value={formData.day_of_month}
                    onChange={(e) => setFormData((prev) => ({ ...prev, day_of_month: e.target.value }))}
                  />
                </div>
              )}

              {formData.frequency === "weekly" && (
                <div className="space-y-2">
                  <Label htmlFor="day_of_week">Day of Week</Label>
                  <Select
                    value={formData.day_of_week}
                    onValueChange={(v) => setFormData((prev) => ({ ...prev, day_of_week: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select day" />
                    </SelectTrigger>
                    <SelectContent>
                      {DAYS_OF_WEEK.map((d) => (
                        <SelectItem key={d.value} value={d.value}>
                          {d.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="occurrences_limit">Max Occurrences (Optional)</Label>
                <Input
                  id="occurrences_limit"
                  type="number"
                  min="1"
                  placeholder="Leave empty for unlimited"
                  value={formData.occurrences_limit}
                  onChange={(e) => setFormData((prev) => ({ ...prev, occurrences_limit: e.target.value }))}
                />
              </div>
            </div>

            {/* Line Items */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-medium">Line Items</h4>
                <Button variant="outline" size="sm" onClick={addLineItem}>
                  <Plus className="h-3 w-3 mr-1" />
                  Add Line
                </Button>
              </div>

              {formData.line_items_template.map((item, index) => (
                <div key={index} className="grid grid-cols-12 gap-2 items-end">
                  <div className="col-span-5 space-y-1">
                    <Label className="text-xs">Description</Label>
                    <Input
                      placeholder="Item description"
                      value={item.description}
                      onChange={(e) => updateLineItem(index, "description", e.target.value)}
                    />
                  </div>
                  <div className="col-span-2 space-y-1">
                    <Label className="text-xs">Qty</Label>
                    <Input
                      type="number"
                      min="1"
                      value={item.quantity}
                      onChange={(e) => updateLineItem(index, "quantity", parseFloat(e.target.value) || 0)}
                    />
                  </div>
                  <div className="col-span-2 space-y-1">
                    <Label className="text-xs">Unit Price</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={item.unit_price}
                      onChange={(e) => updateLineItem(index, "unit_price", parseFloat(e.target.value) || 0)}
                    />
                  </div>
                  <div className="col-span-2 space-y-1">
                    <Label className="text-xs">GST %</Label>
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      value={item.tax_rate || 0}
                      onChange={(e) => updateLineItem(index, "tax_rate", parseFloat(e.target.value) || 0)}
                    />
                  </div>
                  <div className="col-span-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeLineItem(index)}
                      disabled={formData.line_items_template.length <= 1}
                    >
                      <XCircle className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            {/* Options */}
            <div className="space-y-4">
              <h4 className="font-medium">Options</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="payment_terms_days">Payment Terms (days)</Label>
                  <Input
                    id="payment_terms_days"
                    type="number"
                    min="0"
                    value={formData.payment_terms_days}
                    onChange={(e) => setFormData((prev) => ({ ...prev, payment_terms_days: e.target.value }))}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label>Auto-Approve</Label>
                  <p className="text-xs text-muted-foreground">Automatically approve generated invoices</p>
                </div>
                <Switch
                  checked={formData.auto_approve}
                  onCheckedChange={(checked) => setFormData((prev) => ({ ...prev, auto_approve: checked }))}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label>Send Email on Generation</Label>
                  <p className="text-xs text-muted-foreground">Email invoice when generated</p>
                </div>
                <Switch
                  checked={formData.send_email_on_generation}
                  onCheckedChange={(checked) => setFormData((prev) => ({ ...prev, send_email_on_generation: checked }))}
                />
              </div>

              {formData.send_email_on_generation && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="email_to">Email To</Label>
                    <Input
                      id="email_to"
                      type="email"
                      placeholder="recipient@example.com"
                      value={formData.email_to}
                      onChange={(e) => setFormData((prev) => ({ ...prev, email_to: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email_cc">Email CC</Label>
                    <Input
                      id="email_cc"
                      type="email"
                      placeholder="cc@example.com"
                      value={formData.email_cc}
                      onChange={(e) => setFormData((prev) => ({ ...prev, email_cc: e.target.value }))}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">Description / Notes</Label>
              <Textarea
                id="description"
                placeholder="Optional notes for this recurring invoice"
                value={formData.description}
                onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={saving || !formData.name || !formData.start_date}>
              {saving && <Spinner className="h-4 w-4 mr-2" />}
              Create Recurring Invoice
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
