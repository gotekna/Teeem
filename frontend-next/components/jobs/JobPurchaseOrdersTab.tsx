"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ComboboxDropdown } from "@/components/ui/combobox-dropdown";
import {
  Plus,
  AlertTriangle,
  X,
} from "lucide-react";
import { api } from "@/lib/api";
import TeeemTableView from "@/components/table/TeeemTableView";
import type { TableRow } from "@/components/table/types";
import { Spinner } from "@/components/ui/spinner";

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
  const [customTaskName, setCustomTaskName] = useState("");

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
      // FRC FIX: Use entity_type filter instead of type=suppliers
      // type=suppliers only returns contacts with is_supplier_cached=true (existing suppliers with POs)
      // But we need to show ALL potential suppliers (companies/trusts/sole_traders)
      // so users can create their first PO for a new supplier
      const response = await api.get<{ contacts: Contact[] }>("/api/v1/contacts?entity_type=company,trust,sole_trader");
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
    setCustomTaskName("");
    setShowCreateModal(true);
    await Promise.all([loadContacts(), loadTaskTemplates()]);
  };

  const handleCreate = async () => {
    if (!selectedContact) {
      setError("Please select a supplier");
      return;
    }
    if (!selectedTemplate && !customTaskName.trim()) {
      setError("Please select a task template or enter a custom task name");
      return;
    }

    try {
      setSaving(true);
      setError(null);
      await api.post(`/api/v1/purchase_orders`, {
        purchase_order: {
          job_id: jobId,
          supplier_id: selectedContact.id,
          task_template_id: selectedTemplate?.id || null,
          task_name: selectedTemplate ? null : customTaskName.trim(),
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
              <ComboboxDropdown
                items={contacts.map((contact) => ({
                  id: String(contact.id),
                  label: contact.display_name || `Contact ${contact.id}`,
                }))}
                selectedItem={selectedContact ? {
                  id: String(selectedContact.id),
                  label: selectedContact.display_name || `Contact ${selectedContact.id}`,
                } : undefined}
                onSelect={(item) => {
                  const contact = contacts.find((c) => String(c.id) === item.id);
                  setSelectedContact(contact || null);
                }}
                placeholder={loadingContacts ? "Loading suppliers..." : "Select supplier..."}
                searchPlaceholder="Search suppliers..."
                emptyResults="No supplier found."
                disabled={loadingContacts}
                isLoading={loadingContacts}
              />
            </div>

            {/* Task Template Select */}
            <div className="space-y-2">
              <Label>Task Template</Label>
              <ComboboxDropdown
                items={taskTemplates.map((template) => ({
                  id: String(template.id),
                  label: template.name,
                }))}
                selectedItem={selectedTemplate ? {
                  id: String(selectedTemplate.id),
                  label: selectedTemplate.name,
                } : undefined}
                onSelect={(item) => {
                  const template = taskTemplates.find((t) => String(t.id) === item.id);
                  setSelectedTemplate(template || null);
                  if (template) setCustomTaskName(""); // Clear custom name when template selected
                }}
                placeholder={loadingTasks ? "Loading templates..." : "Select task template..."}
                searchPlaceholder="Search templates..."
                emptyResults={taskTemplates.length === 0 ? "No task templates available" : "No template found."}
                disabled={loadingTasks || !!customTaskName}
                isLoading={loadingTasks}
                clearable
                onClear={() => setSelectedTemplate(null)}
              />
            </div>

            {/* OR divider */}
            <div className="flex items-center gap-3">
              <div className="flex-1 border-t border-muted" />
              <span className="text-xs text-muted-foreground">OR</span>
              <div className="flex-1 border-t border-muted" />
            </div>

            {/* Custom Task Name */}
            <div className="space-y-2">
              <Label>Custom Task Name</Label>
              <Input
                value={customTaskName}
                onChange={(e) => {
                  setCustomTaskName(e.target.value);
                  if (e.target.value) setSelectedTemplate(null); // Clear template when typing custom name
                }}
                placeholder="Enter custom task name..."
                disabled={!!selectedTemplate}
              />
              <p className="text-xs text-muted-foreground">
                Use this if no template matches your needs
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateModal(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={saving}>
              {saving ? (
                <>
                  <Spinner size={16} className="mr-2" />
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
