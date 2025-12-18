"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  Plus,
  MoreVertical,
  Eye,
  Pencil,
  Trash2,
  Search,
  Loader2,
  ShoppingCart,
  ChevronsUpDown,
  Check,
  AlertTriangle,
  X,
} from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

interface Contact {
  id: number;
  display_name?: string;
  employee_names?: string[];
  employee_count?: number;
}

interface TaskTemplate {
  id: number;
  name: string;
  category?: string;
  default_duration_days?: number;
}

interface PurchaseOrder {
  id: number;
  purchase_order_number: string;
  description?: string;
  status: string;
  total: number;
  required_date?: string;
  supplier?: {
    id: number;
    display_name?: string;
  };
  schedule_task?: {
    id: number;
    title: string;
  };
}

interface JobPurchaseOrdersTabProps {
  jobId: string | number;
  jobTitle?: string;
}

const STATUS_VARIANTS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  approved: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  sent: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
  received: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  paid: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
  cancelled: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
};

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatDate(dateString: string | undefined): string {
  if (!dateString) return "-";
  return new Date(dateString).toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function JobPurchaseOrdersTab({ jobId, jobTitle }: JobPurchaseOrdersTabProps) {
  const router = useRouter();
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [taskTemplates, setTaskTemplates] = useState<TaskTemplate[]>([]);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<TaskTemplate | null>(null);
  const [contactOpen, setContactOpen] = useState(false);
  const [taskOpen, setTaskOpen] = useState(false);

  // Delete confirmation
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    loadPurchaseOrders();
     
  }, [jobId]);

  const loadPurchaseOrders = async () => {
    try {
      setLoading(true);
      const response = await api.get<{ purchase_orders: PurchaseOrder[] }>(
        `/api/v1/purchase_orders?job_id=${jobId}`
      );
      setPurchaseOrders(response?.purchase_orders || []);
    } catch (err) {
      console.error("Failed to load purchase orders:", err);
    } finally {
      setLoading(false);
    }
  };

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
      const response = await api.get<{ task_templates: TaskTemplate[] }>(
        `/api/v1/task_templates`
      );
      setTaskTemplates(response?.task_templates || []);
    } catch (err) {
      console.error("Failed to load task templates:", err);
    } finally {
      setLoadingTasks(false);
    }
  };

  const handleOpenCreateModal = async () => {
    setError(null);
    setSelectedContact(null);
    setSelectedTemplate(null);
    setShowCreateModal(true);
    await Promise.all([loadContacts(), loadTaskTemplates()]);
  };

  const handleCreate = async () => {
    if (!selectedContact) {
      setError("Please select a contact");
      return;
    }
    if (!selectedTemplate) {
      setError("Please select a task template");
      return;
    }

    try {
      setSaving(true);
      setError(null);
      await api.post(`/api/v1/purchase_orders`, {
        purchase_order: {
          job_id: jobId,
          supplier_id: selectedContact.id,
          task_template_id: selectedTemplate.id,
          status: "draft",
        },
      });
      setShowCreateModal(false);
      await loadPurchaseOrders();
    } catch (err) {
      console.error("Failed to create purchase order:", err);
      setError("Failed to create purchase order");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      setDeleting(true);
      await api.delete(`/api/v1/purchase_orders/${deleteId}`);
      setDeleteId(null);
      await loadPurchaseOrders();
    } catch (err) {
      console.error("Failed to delete purchase order:", err);
    } finally {
      setDeleting(false);
    }
  };

  const filteredPOs = purchaseOrders.filter((po) => {
    const supplierName = po.supplier?.display_name || po.supplier?.display_name || "";
    const matchesSearch =
      !searchQuery ||
      po.purchase_order_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      supplierName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      po.description?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = !statusFilter || po.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  // Stats
  const totalValue = purchaseOrders.reduce((sum, po) => sum + (Number(po.total) || 0), 0);
  const draftCount = purchaseOrders.filter((po) => po.status === "draft").length;
  const pendingCount = purchaseOrders.filter((po) => po.status === "pending").length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{purchaseOrders.length}</div>
            <p className="text-sm text-muted-foreground">Total POs</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{formatCurrency(totalValue)}</div>
            <p className="text-sm text-muted-foreground">Total Value</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-gray-600">{draftCount}</div>
            <p className="text-sm text-muted-foreground">Drafts</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-yellow-600">{pendingCount}</div>
            <p className="text-sm text-muted-foreground">Pending Approval</p>
          </CardContent>
        </Card>
      </div>

      {/* Header with Actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ShoppingCart className="h-6 w-6 text-muted-foreground" />
          <div>
            <h3 className="text-lg font-semibold">Purchase Orders</h3>
            <p className="text-sm text-muted-foreground">
              Manage purchase orders for {jobTitle || "this job"}
            </p>
          </div>
        </div>
        <Button onClick={handleOpenCreateModal}>
          <Plus className="h-4 w-4 mr-2" />
          New Purchase Order
        </Button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search PO number, supplier..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="h-10 px-3 py-2 border border-input rounded-md text-sm bg-background"
        >
          <option value="">All Statuses</option>
          <option value="draft">Draft</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="sent">Sent</option>
          <option value="received">Received</option>
          <option value="paid">Paid</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      {/* PO Table */}
      {filteredPOs.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <ShoppingCart className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">
              {searchQuery || statusFilter
                ? "No purchase orders match your filters"
                : "No purchase orders yet"}
            </p>
            {!searchQuery && !statusFilter && (
              <Button className="mt-4" onClick={handleOpenCreateModal}>
                <Plus className="h-4 w-4 mr-2" />
                Create First PO
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>PO Number</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Required Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPOs.map((po) => (
                  <TableRow
                    key={po.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => router.push(`/purchase_orders/${po.purchase_order_number?.replace('PO-', '') || po.id}`)}
                  >
                    <TableCell className="font-medium">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          router.push(`/purchase_orders/${po.purchase_order_number?.replace('PO-', '') || po.id}`);
                        }}
                        className="text-primary hover:underline"
                      >
                        {po.purchase_order_number}
                      </button>
                    </TableCell>
                    <TableCell>
                      {po.supplier ? (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(`/contacts/${po.supplier!.id}`);
                          }}
                          className="text-primary hover:underline"
                        >
                          {po.supplier.display_name || po.supplier.display_name}
                        </button>
                      ) : (
                        "-"
                      )}
                    </TableCell>
                    <TableCell className="max-w-xs truncate">
                      {po.description || "-"}
                    </TableCell>
                    <TableCell>{formatDate(po.required_date)}</TableCell>
                    <TableCell>
                      <Badge className={STATUS_VARIANTS[po.status] || STATUS_VARIANTS.draft}>
                        {po.status.charAt(0).toUpperCase() + po.status.slice(1)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(Number(po.total) || 0)}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="icon">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              router.push(`/purchase_orders/${po.purchase_order_number?.replace('PO-', '') || po.id}`);
                            }}
                          >
                            <Eye className="h-4 w-4 mr-2" />
                            View
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              router.push(`/purchase_orders/${po.purchase_order_number?.replace('PO-', '') || po.id}/edit`);
                            }}
                          >
                            <Pencil className="h-4 w-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          {po.status !== "paid" && (
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeleteId(po.id);
                              }}
                              className="text-destructive"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Create PO Modal */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>New Purchase Order</DialogTitle>
            <DialogDescription>
              Create a new purchase order for {jobTitle || "this job"}.
            </DialogDescription>
          </DialogHeader>

          {error && (
            <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              <p className="text-sm text-destructive">{error}</p>
              <Button
                variant="ghost"
                size="icon"
                className="ml-auto h-6 w-6"
                onClick={() => setError(null)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}

          <div className="space-y-4 py-4">
            {/* Supplier (Contact) Select */}
            <div className="space-y-2">
              <Label>Supplier</Label>
              <Popover open={contactOpen} onOpenChange={setContactOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={contactOpen}
                    className="w-full justify-between"
                    disabled={loadingContacts}
                  >
                    {loadingContacts ? (
                      <span className="text-muted-foreground">Loading suppliers...</span>
                    ) : selectedContact ? (
                      selectedContact.display_name || selectedContact.display_name
                    ) : (
                      <span className="text-muted-foreground">Select supplier...</span>
                    )}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[450px] p-0">
                  <Command>
                    <CommandInput placeholder="Search by company or employee name..." />
                    <CommandList className="max-h-[350px]">
                      <CommandEmpty>No supplier found.</CommandEmpty>
                      <CommandGroup>
                        {contacts.map((contact) => {
                          // Build searchable value including employee names
                          const searchValue = [
                            contact.display_name,
                            ...(contact.employee_names || [])
                          ].filter(Boolean).join(" ");

                          return (
                            <CommandItem
                              key={contact.id}
                              value={searchValue}
                              onSelect={() => {
                                setSelectedContact(contact);
                                setContactOpen(false);
                              }}
                              className="flex-col items-start py-2"
                            >
                              <div className="flex items-center w-full">
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4 shrink-0",
                                    selectedContact?.id === contact.id ? "opacity-100" : "opacity-0"
                                  )}
                                />
                                <span className="font-medium">{contact.display_name}</span>
                              </div>
                              {contact.employee_names && contact.employee_names.length > 0 && (
                                <div className="ml-6 mt-1 space-y-0.5">
                                  {contact.employee_names.slice(0, 5).map((name, idx) => (
                                    <div key={idx} className="text-xs text-muted-foreground pl-2 border-l border-muted">
                                      {name}
                                    </div>
                                  ))}
                                  {(contact.employee_count || 0) > 5 && (
                                    <div className="text-xs text-muted-foreground/70 pl-2 italic">
                                      +{(contact.employee_count || 0) - 5} more employees
                                    </div>
                                  )}
                                </div>
                              )}
                            </CommandItem>
                          );
                        })}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            {/* Task Template Select */}
            <div className="space-y-2">
              <Label>Task Template</Label>
              <Popover open={taskOpen} onOpenChange={setTaskOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={taskOpen}
                    className="w-full justify-between"
                    disabled={loadingTasks}
                  >
                    {loadingTasks ? (
                      <span className="text-muted-foreground">Loading templates...</span>
                    ) : selectedTemplate ? (
                      <div className="flex flex-col items-start">
                        <span>{selectedTemplate.name}</span>
                        {selectedTemplate.category && (
                          <span className="text-xs text-muted-foreground">
                            {selectedTemplate.category}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">Select task template...</span>
                    )}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[400px] p-0">
                  <Command>
                    <CommandInput placeholder="Search templates..." />
                    <CommandList>
                      <CommandEmpty>
                        {taskTemplates.length === 0
                          ? "No task templates available"
                          : "No template found."}
                      </CommandEmpty>
                      <CommandGroup>
                        {taskTemplates.map((template) => (
                          <CommandItem
                            key={template.id}
                            value={template.name}
                            onSelect={() => {
                              setSelectedTemplate(template);
                              setTaskOpen(false);
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                selectedTemplate?.id === template.id ? "opacity-100" : "opacity-0"
                              )}
                            />
                            <div className="flex flex-col">
                              <span>{template.name}</span>
                              {template.category && (
                                <span className="text-xs text-muted-foreground">
                                  {template.category}
                                </span>
                              )}
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateModal(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create Purchase Order"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Purchase Order</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this purchase order? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)} disabled={deleting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default JobPurchaseOrdersTab;
