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
  Check,
  CornerDownRight,
  User,
  Users,
} from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api } from "@/lib/api";
import TeeemTableView from "@/components/table/TeeemTableView";
import type { TableRow } from "@/components/table/types";
import { Spinner } from "@/components/ui/spinner";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

// Foundation table name for Purchase Orders
const PURCHASE_ORDERS_TABLE_NAME = "purchase-orders";

// Internal team roles for assignment (SSoT: JobPeopleTab.tsx INTERNAL_ROLES)
const INTERNAL_TEAM_ROLES = [
  { key: "supervisor", label: "Supervisor" },
  { key: "site_coordinator", label: "Site Coordinator" },
  { key: "estimator", label: "Estimator" },
  { key: "internal_sales", label: "Internal Sales" },
  { key: "coordinator", label: "Client Coordinator" },
] as const;

interface Contact {
  id: number;
  display_name?: string;
  employee_names?: string[];
  employee_count?: number;
}

// Extended ComboboxItem with employee data for cascading view
interface SupplierItem {
  id: string;
  label: string;
  searchText?: string;
  employeeNames: string[];
}

// SmTask represents a task from the job's schedule
// PO modal shows tasks where po_required=true so user can link PO to specific task
interface SmTask {
  id: number;
  name: string;
  po_required?: boolean;
  supplier_id?: number;
  assigned_user_id?: number;
  assigned_role?: string;
}

interface User {
  id: number;
  name: string;
}

interface JobPurchaseOrdersTabProps {
  jobId: string | number;
  jobTitle?: string;
}

export function JobPurchaseOrdersTab({ jobId, jobTitle }: JobPurchaseOrdersTabProps) {
  const router = useRouter();
  const { user: currentUser } = useAuth();
  const [refreshKey, setRefreshKey] = useState(0);

  // Modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [poTasks, setPoTasks] = useState<SmTask[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [loadingPoTasks, setLoadingPoTasks] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [selectedTask, setSelectedTask] = useState<SmTask | null>(null);
  const [customTaskName, setCustomTaskName] = useState("");
  const [assignedUserId, setAssignedUserId] = useState<string>("");
  const [assignedRole, setAssignedRole] = useState<string>("");
  const [assignMode, setAssignMode] = useState<"user" | "role">("user");

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

  // Load PO tasks from job's schedule (sm_tasks where po_required=true)
  // This shows actual tasks from this job that can have a PO created
  const loadPoTasks = async () => {
    if (poTasks.length > 0) return;
    try {
      setLoadingPoTasks(true);
      // Get sm_tasks for this job
      const response = await api.get<{ tasks: SmTask[] }>(
        `/api/v1/sm_tasks?job_id=${jobId}`
      );
      // Filter for po_required tasks and sort by name
      const filteredTasks = (response?.tasks || [])
        .filter(t => t.po_required)
        .sort((a, b) => a.name.localeCompare(b.name));
      setPoTasks(filteredTasks);
    } catch (err) {
      console.error("Failed to load PO tasks:", err);
    } finally {
      setLoadingPoTasks(false);
    }
  };

  // Load users for assignment dropdown
  const loadUsers = async () => {
    if (users.length > 0) return;
    try {
      const response = await api.get<{ users?: User[] } | User[]>("/api/v1/users");
      setUsers(Array.isArray(response) ? response : response?.users || []);
    } catch (err) {
      console.error("Failed to load users:", err);
    }
  };

  const handleOpenCreateModal = async () => {
    setError(null);
    setSelectedContact(null);
    setSelectedTask(null);
    setCustomTaskName("");
    // Default assignment to current user
    setAssignedUserId(currentUser ? String(currentUser.id) : "");
    setAssignedRole("");
    setAssignMode("user");
    setShowCreateModal(true);
    await Promise.all([loadContacts(), loadPoTasks(), loadUsers()]);
  };

  // Create PO and optionally navigate to detail page
  const handleCreate = async (openAfterCreate = false) => {
    if (!selectedContact) {
      setError("Please select a supplier");
      return;
    }
    if (!selectedTask && !customTaskName.trim()) {
      setError("Please select a PO task or enter a custom task name");
      return;
    }

    try {
      setSaving(true);
      setError(null);
      // Link PO to schedule_task_id if task selected, store name in ted_task
      // Backend expects schedule_task_id, which it then saves to sm_task_id
      // For custom tasks, include assignment info (user or role)
      const response = await api.post<{ purchase_order: { id: number; purchase_order_number: string } }>(`/api/v1/purchase_orders`, {
        purchase_order: {
          job_id: jobId,
          supplier_id: selectedContact.id,
          schedule_task_id: selectedTask?.id || null,
          ted_task: selectedTask?.name || customTaskName.trim(),
          status: "draft",
          // Only pass assignment for custom tasks (not existing sm_tasks)
          ...(customTaskName.trim() && !selectedTask && {
            assigned_user_id: assignedUserId ? Number(assignedUserId) : null,
            assigned_role: assignedRole || null,
          }),
        },
      });
      setShowCreateModal(false);
      setRefreshKey(k => k + 1);

      // Navigate to PO detail page if requested
      if (openAfterCreate && response?.purchase_order) {
        const poNumber = response.purchase_order.purchase_order_number;
        const slug = poNumber?.replace('PO-', '') || response.purchase_order.id;
        router.push(`/purchase_orders/${slug}`);
      }
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
      {/* SSoT: onAddRow opens the PO modal - single way to create POs */}
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
        onRowDoubleClick={handleRowClick}
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
              <ComboboxDropdown<SupplierItem>
                items={contacts.map((contact) => ({
                  id: String(contact.id),
                  label: contact.display_name || `Contact ${contact.id}`,
                  // Include employee names in searchText so searching "Sandy" finds "Titus Tekform Pty Ltd"
                  searchText: contact.employee_names?.join(" ") || undefined,
                  employeeNames: contact.employee_names || [],
                }))}
                selectedItem={selectedContact ? {
                  id: String(selectedContact.id),
                  label: selectedContact.display_name || `Contact ${selectedContact.id}`,
                  searchText: selectedContact.employee_names?.join(" ") || undefined,
                  employeeNames: selectedContact.employee_names || [],
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
                renderListItem={({ isChecked, item, searchTerm }) => {
                  // Find matching employees based on search term
                  const searchLower = searchTerm.toLowerCase();
                  const matchingEmployees = searchTerm
                    ? item.employeeNames.filter(name =>
                        name.toLowerCase().includes(searchLower)
                      )
                    : [];

                  // Check if company name matches (not just employee)
                  const companyMatches = item.label.toLowerCase().includes(searchLower);

                  return (
                    <div className="flex flex-col w-full">
                      <div className="flex items-center">
                        <Check
                          className={`mr-2 h-4 w-4 flex-shrink-0 ${
                            isChecked ? "opacity-100" : "opacity-0"
                          }`}
                        />
                        <span className="truncate">{item.label}</span>
                      </div>
                      {/* Show matching employees when search matches employee name (not company name) */}
                      {matchingEmployees.length > 0 && !companyMatches && (
                        <div className="ml-6 mt-0.5">
                          {matchingEmployees.slice(0, 2).map((employee, idx) => (
                            <div
                              key={idx}
                              className="flex items-center text-xs text-muted-foreground"
                            >
                              <CornerDownRight className="h-3 w-3 mr-1 flex-shrink-0" />
                              <span className="truncate">{employee} (Employee)</span>
                            </div>
                          ))}
                          {matchingEmployees.length > 2 && (
                            <div className="text-xs text-muted-foreground ml-4">
                              +{matchingEmployees.length - 2} more
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                }}
              />
            </div>

            {/* PO Task Select - tasks from job's schedule */}
            <div className="space-y-2">
              <Label>PO Task</Label>
              <ComboboxDropdown
                items={poTasks.map((task) => ({
                  id: String(task.id),
                  label: task.name,
                }))}
                selectedItem={selectedTask ? {
                  id: String(selectedTask.id),
                  label: selectedTask.name,
                } : undefined}
                onSelect={(item) => {
                  const task = poTasks.find((t) => String(t.id) === item.id);
                  setSelectedTask(task || null);
                  if (task) setCustomTaskName(""); // Clear custom name when task selected
                }}
                placeholder={loadingPoTasks ? "Loading tasks..." : "Select PO task..."}
                searchPlaceholder="Search tasks..."
                emptyResults={poTasks.length === 0 ? "No PO tasks on this job" : "No task found."}
                disabled={loadingPoTasks || !!customTaskName}
                isLoading={loadingPoTasks}
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
                Use this if no PO task matches your needs
              </p>
            </div>

            {/* Assign To - only show when Custom Task Name is used */}
            {customTaskName.trim() && !selectedTask && (
              <div className="space-y-2">
                <Label>Assign To</Label>
                <Tabs value={assignMode} onValueChange={(v) => {
                  setAssignMode(v as "user" | "role");
                  if (v === "user") {
                    setAssignedRole("");
                  } else {
                    setAssignedUserId("");
                  }
                }} className="w-full">
                  <TabsList className="grid w-full grid-cols-2 h-8">
                    <TabsTrigger value="user" className="text-xs h-7">
                      <User className="h-3 w-3 mr-1" />
                      User
                    </TabsTrigger>
                    <TabsTrigger value="role" className="text-xs h-7">
                      <Users className="h-3 w-3 mr-1" />
                      Role
                    </TabsTrigger>
                  </TabsList>
                </Tabs>

                {assignMode === "user" ? (
                  <ComboboxDropdown
                    items={users.map((u) => ({
                      id: String(u.id),
                      label: u.name,
                    }))}
                    selectedItem={assignedUserId ? {
                      id: assignedUserId,
                      label: users.find(u => String(u.id) === assignedUserId)?.name || "",
                    } : undefined}
                    onSelect={(item) => setAssignedUserId(item.id)}
                    placeholder="Search users..."
                    clearable
                    onClear={() => setAssignedUserId("")}
                  />
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {INTERNAL_TEAM_ROLES.map((role) => (
                      <Button
                        key={role.key}
                        type="button"
                        variant={assignedRole === role.key ? "default" : "outline"}
                        size="sm"
                        onClick={() => setAssignedRole(
                          assignedRole === role.key ? "" : role.key
                        )}
                        className={cn(
                          "text-xs",
                          assignedRole === role.key && "ring-2 ring-offset-1"
                        )}
                      >
                        {role.label}
                      </Button>
                    ))}
                  </div>
                )}
              </div>
            )}
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
