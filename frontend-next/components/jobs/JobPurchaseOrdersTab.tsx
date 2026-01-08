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
  AlertTriangle,
  X,
} from "lucide-react";
import { api } from "@/lib/api";
import TeeemTableView from "@/components/table/TeeemTableView";
import type { TableRow } from "@/components/table/types";
import { Spinner } from "@/components/ui/spinner";

// Foundation table name for Purchase Orders
const PURCHASE_ORDERS_TABLE_NAME = "purchase-orders";

interface Contact {
  id: number;
  display_name?: string;
  employee_names?: string[];
  employee_count?: number;
}

interface JobTask {
  id: number;
  name: string;
  task_number?: number;
  status?: string;
  trade?: string;
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
  const [jobTasks, setJobTasks] = useState<JobTask[]>([]);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [selectedTask, setSelectedTask] = useState<JobTask | null>(null);
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
      const response = await api.get<{ contacts: Contact[] }>("/api/v1/contacts?type=suppliers");
      setContacts(response?.contacts || []);
    } catch (err) {
      console.error("Failed to load contacts:", err);
    } finally {
      setLoadingContacts(false);
    }
  };

  const loadJobTasks = async () => {
    if (jobTasks.length > 0) return;
    try {
      setLoadingTasks(true);
      const response = await api.get<{ sm_tasks: JobTask[] }>(
        `/api/v1/jobs/${jobId}/sm_tasks`
      );
      setJobTasks(response?.sm_tasks || []);
    } catch (err) {
      console.error("Failed to load job tasks:", err);
    } finally {
      setLoadingTasks(false);
    }
  };

  const handleOpenCreateModal = async () => {
    setError(null);
    setSelectedContact(null);
    setSelectedTask(null);
    setCustomTaskName("");
    setShowCreateModal(true);
    await Promise.all([loadContacts(), loadJobTasks()]);
  };

  const handleCreate = async () => {
    if (!selectedContact) {
      setError("Please select a supplier");
      return;
    }
    if (!selectedTask && !customTaskName.trim()) {
      setError("Please select a task or enter a custom task name");
      return;
    }

    try {
      setSaving(true);
      setError(null);
      await api.post(`/api/v1/purchase_orders`, {
        purchase_order: {
          job_id: jobId,
          supplier_id: selectedContact.id,
          // Link to existing task if selected, otherwise create new task with custom name
          schedule_task_id: selectedTask?.id || null,
          task_name: selectedTask ? null : customTaskName.trim(),
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
        onAddRow={handleOpenCreateModal}
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

            {/* Task Select - existing tasks from this job */}
            <div className="space-y-2">
              <Label>Task</Label>
              <ComboboxDropdown
                items={jobTasks.map((task) => ({
                  id: String(task.id),
                  label: task.task_number ? `${task.task_number}. ${task.name}` : task.name,
                }))}
                selectedItem={selectedTask ? {
                  id: String(selectedTask.id),
                  label: selectedTask.task_number ? `${selectedTask.task_number}. ${selectedTask.name}` : selectedTask.name,
                } : undefined}
                onSelect={(item) => {
                  const task = jobTasks.find((t) => String(t.id) === item.id);
                  setSelectedTask(task || null);
                  if (task) setCustomTaskName(""); // Clear custom name when task selected
                }}
                placeholder={loadingTasks ? "Loading tasks..." : "Select task..."}
                searchPlaceholder="Search tasks..."
                emptyResults={jobTasks.length === 0 ? "No tasks available" : "No task found."}
                disabled={loadingTasks || !!customTaskName}
                isLoading={loadingTasks}
                clearable
                onClear={() => setSelectedTask(null)}
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
                  if (e.target.value) setSelectedTask(null); // Clear task when typing custom name
                }}
                placeholder="Enter custom task name..."
                disabled={!!selectedTask}
              />
              <p className="text-xs text-muted-foreground">
                Use this to create a new task if none match your needs
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
