"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
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
  Loader2,
  ChevronsUpDown,
  Check,
  AlertTriangle,
  X,
} from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import TeeemTableView from "@/components/table/TeeemTableView";
import type { TableRow } from "@/components/table/types";

// Foundation table name for Purchase Orders
const PURCHASE_ORDERS_TABLE_NAME = "purchase_orders";

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

interface JobPurchaseOrdersTabProps {
  jobId: string | number;
  jobTitle?: string;
}

export function JobPurchaseOrdersTab({ jobId, jobTitle }: JobPurchaseOrdersTabProps) {
  const router = useRouter();
  const [refreshKey, setRefreshKey] = useState(0);


  // Modal state
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

  // Handle row click - navigate to PO detail page
  const handleRowClick = useCallback((row: TableRow) => {
    const poNumber = row.purchase_order_number as string | undefined;
    const slug = poNumber?.replace('PO-', '') || row.id;
    if (slug) {
      router.push(`/purchase_orders/${slug}`);
    }
  }, [router]);

  // Handle inline row update - use slug-based API
  const handleRowUpdate = useCallback(async (rowId: number | string, field: string, value: unknown) => {
    try {
      await api.patch(`/api/v1/foundations/${PURCHASE_ORDERS_TABLE_NAME}/records/${rowId}`, {
        record: { [field]: value }
      });
      setRefreshKey(k => k + 1);
    } catch (err) {
      console.error("Failed to update purchase order:", err);
      throw err;
    }
  }, []);

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
      setRefreshKey(k => k + 1);
    } catch (err) {
      console.error("Failed to create purchase order:", err);
      setError("Failed to create purchase order");
    } finally {
      setSaving(false);
    }
  };


  return (
    <div className="flex flex-col h-full -mx-4">
      {/* TeeemTableView with server-side filtering by job_id */}
      <TeeemTableView
        key={refreshKey}
        foundationId={PURCHASE_ORDERS_TABLE_NAME}
        autoFetchRecords={true}
        initialFilters={[
          { id: "job-filter", column: "job_id", operator: "=", value: String(jobId) }
        ]}
        tableName="Purchase Orders"
        enableExport={true}
        onRefresh={() => setRefreshKey(k => k + 1)}
        onRowClick={handleRowClick}
        onRowUpdate={handleRowUpdate}
        leftActions={
          <Button onClick={handleOpenCreateModal}>
            <Plus className="h-4 w-4 mr-2" />
            New Purchase Order
          </Button>
        }
      />

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
    </div>
  );
}

export default JobPurchaseOrdersTab;
