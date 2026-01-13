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
  ExternalLink,
  Lock,
  LockOpen,
} from "lucide-react";
import { api } from "@/lib/api";
import TeeemTableView from "@/components/table/TeeemTableView";
import type { TableRow } from "@/components/table/types";
import { Spinner } from "@/components/ui/spinner";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { useAtom, useSetAtom } from "jotai";
import { selectedRowsAtom, clearSelectionAtom } from "@/lib/table-atoms";

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
  task_number?: number;
  po_required?: boolean;
  supplier_id?: number;
  assigned_user_id?: number;
  assigned_role?: string;
}

interface User {
  id: number;
  name: string;
}

// Role from /api/v1/roles
interface Role {
  id: number;
  value: string;  // e.g., "supervisor"
  label: string;  // e.g., "Supervisor"
}

// Job's internal team member (from job_contacts)
interface JobInternalTeamMember {
  role: string;
  user_id: number | null;
  user?: { id: number; name: string };
}

interface JobPurchaseOrdersTabProps {
  jobId: string | number;
  jobTitle?: string;
}

export function JobPurchaseOrdersTab({ jobId, jobTitle }: JobPurchaseOrdersTabProps) {
  const router = useRouter();
  const { user: currentUser } = useAuth();
  const [refreshKey, setRefreshKey] = useState(0);

  // Selection state from Jotai atoms (shared with TeeemTableView)
  const [selectedRowIds] = useAtom(selectedRowsAtom);
  const clearSelection = useSetAtom(clearSelectionAtom);
  const [lockingBudgets, setLockingBudgets] = useState(false);

  // Modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [poTasks, setPoTasks] = useState<SmTask[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [internalTeam, setInternalTeam] = useState<JobInternalTeamMember[]>([]);
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
      // Get sm_tasks for this job - use lightweight endpoint for fast loading
      const response = await api.get<{ sm_tasks: SmTask[] }>(
        `/api/v1/jobs/${jobId}/sm_tasks?for=select`
      );
      // Filter for po_required tasks and sort by task_number then name
      const filteredTasks = (response?.sm_tasks || [])
        .filter(t => t.po_required)
        .sort((a, b) => {
          if (a.task_number && b.task_number) return a.task_number - b.task_number;
          if (a.task_number) return -1;
          if (b.task_number) return 1;
          return a.name.localeCompare(b.name);
        });
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

  // Load roles for assignment dropdown
  const loadRoles = async () => {
    if (roles.length > 0) return;
    try {
      const response = await api.get<Role[]>("/api/v1/roles");
      setRoles(Array.isArray(response) ? response : []);
    } catch (err) {
      console.error("Failed to load roles:", err);
    }
  };

  // Load job's internal team members (Supervisor, Site Coordinator, etc.)
  const loadInternalTeam = async () => {
    try {
      const response = await api.get<{ job_contacts: JobInternalTeamMember[] }>(
        `/api/v1/jobs/${jobId}/job_contacts`
      );
      // Filter for internal team roles only (those with user_id)
      const internalRoleKeys = INTERNAL_TEAM_ROLES.map(r => r.key) as string[];
      const team = (response?.job_contacts || []).filter(
        jc => internalRoleKeys.includes(jc.role) && jc.user_id
      );
      setInternalTeam(team);
    } catch (err) {
      console.error("Failed to load internal team:", err);
    }
  };

  // Get the user assigned to a role on this job
  const getTeamMemberForRole = (roleKey: string): JobInternalTeamMember | undefined => {
    return internalTeam.find(m => m.role === roleKey);
  };

  // Handle role button click - auto-fill user if assigned on job
  const handleRoleClick = (roleKey: string) => {
    // Find the Role ID for this key
    const role = roles.find(r => r.value === roleKey);
    const roleId = role ? String(role.id) : "";

    if (assignedRole === roleId) {
      // Deselect
      setAssignedRole("");
      setAssignedUserId(currentUser ? String(currentUser.id) : "");
    } else {
      // Select role and auto-fill user if one is assigned to this role
      setAssignedRole(roleId);
      const teamMember = getTeamMemberForRole(roleKey);
      if (teamMember?.user_id) {
        setAssignedUserId(String(teamMember.user_id));
      }
    }
  };

  // Check if a role button is selected (by Role ID)
  const isRoleButtonSelected = (roleKey: string): boolean => {
    const role = roles.find(r => r.value === roleKey);
    return role ? assignedRole === String(role.id) : false;
  };

  const handleOpenCreateModal = async () => {
    setError(null);
    setSelectedContact(null);
    setSelectedTask(null);
    setCustomTaskName("");
    // Default assignment to current user
    setAssignedUserId(currentUser ? String(currentUser.id) : "");
    setAssignedRole("");
    setShowCreateModal(true);
    await Promise.all([loadContacts(), loadPoTasks(), loadUsers(), loadRoles(), loadInternalTeam()]);
  };

  // Create PO and optionally navigate to detail page
  const handleCreate = async (openAfterCreate = false) => {
    if (!selectedContact) {
      setError("Please select a supplier");
      return;
    }
    // Either select a task OR enter a custom task name
    if (!selectedTask && !customTaskName.trim()) {
      setError("Please select a PO task or enter a custom task name");
      return;
    }

    try {
      setSaving(true);
      setError(null);
      // SSoT: Every PO must link to a real SmTask via sm_task_id
      // - If existing task selected: send schedule_task_id → backend links it
      // - If custom task name: send task_name → backend CREATES SmTask then links it
      const response = await api.post<{ purchase_order: { id: number; purchase_order_number: string } }>(`/api/v1/purchase_orders`, {
        purchase_order: {
          job_id: jobId,
          supplier_id: selectedContact.id,
          // Existing task: link directly
          schedule_task_id: selectedTask?.id || null,
          // Custom task: backend creates SmTask with this name
          task_name: !selectedTask && customTaskName.trim() ? customTaskName.trim() : null,
          status: "draft",
          // Assignment info for custom tasks (role is Role.id integer)
          ...(customTaskName.trim() && !selectedTask && {
            assigned_user_id: assignedUserId ? Number(assignedUserId) : null,
            assigned_role: assignedRole ? Number(assignedRole) : null,
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

  // Handle toggle budget lock for selected POs
  // Backend intelligently locks unlocked POs or unlocks locked POs
  const handleToggleBudgetLock = async () => {
    if (selectedRowIds.size === 0 || lockingBudgets) return;

    try {
      setLockingBudgets(true);
      setError(null);
      const ids = Array.from(selectedRowIds);

      const response = await api.post<{ success: boolean; message?: string; error?: string; count?: number; action?: string }>(
        "/api/v1/purchase_orders/toggle_budget_lock",
        { ids }
      );

      if (response?.success) {
        console.log(`Budget ${response.action}: ${response.count} POs`);
        setRefreshKey((k) => k + 1);
        clearSelection();
      } else {
        setError(response?.error || "Failed to toggle budget lock");
      }
    } catch (err) {
      console.error("Failed to toggle budget lock:", err);
      setError("Failed to toggle budget lock");
    } finally {
      setLockingBudgets(false);
    }
  };

  // Custom cell renderer - shows lock icon next to PO number
  const customCellRenderer = useCallback((entry: TableRow, columnKey: string) => {
    // Attach lock icon to PO number column so it's always visible
    if (columnKey === "purchase_order_number") {
      const isLocked = !!entry.budget_locked_at || entry.budget_locked === true;
      const poNumber = entry.purchase_order_number as string || "";

      return (
        <span className="flex items-center gap-1.5">
          {isLocked ? (
            <Lock className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
          ) : (
            <LockOpen className="h-3.5 w-3.5 text-muted-foreground/30 shrink-0" />
          )}
          <span>{poNumber}</span>
        </span>
      );
    }
    return null; // Use default renderer for other columns
  }, []);

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
        customCellRenderer={customCellRenderer}
        leftActions={
          <Button
            variant="outline"
            size="sm"
            onClick={handleToggleBudgetLock}
            disabled={selectedRowIds.size === 0 || lockingBudgets}
            className="gap-1"
          >
            {lockingBudgets ? (
              <Spinner size={14} />
            ) : (
              <Lock className="h-4 w-4" />
            )}
            Lock/Unlock {selectedRowIds.size > 0 && `(${selectedRowIds.size})`}
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
                  label: task.task_number ? `${task.task_number}. ${task.name}` : task.name,
                }))}
                selectedItem={selectedTask ? {
                  id: String(selectedTask.id),
                  label: selectedTask.task_number ? `${selectedTask.task_number}. ${selectedTask.name}` : selectedTask.name,
                } : undefined}
                onSelect={(item) => {
                  const task = poTasks.find((t) => String(t.id) === item.id);
                  setSelectedTask(task || null);
                  // Clear custom task name when selecting a task
                  if (task) setCustomTaskName("");
                }}
                placeholder={loadingPoTasks ? "Loading tasks..." : "Select PO task..."}
                searchPlaceholder="Search tasks..."
                emptyResults={poTasks.length === 0 ? "No PO tasks on this job" : "No task found."}
                disabled={loadingPoTasks}
                isLoading={loadingPoTasks}
                clearable={!!selectedTask}
                onClear={() => setSelectedTask(null)}
              />
            </div>

            {/* OR divider */}
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <div className="flex-1 border-t" />
              <span>OR</span>
              <div className="flex-1 border-t" />
            </div>

            {/* Custom Task Name - alternative to selecting from list */}
            <div className="space-y-2">
              <Label>Custom Task Name</Label>
              <Input
                value={customTaskName}
                onChange={(e) => {
                  setCustomTaskName(e.target.value);
                  // Clear selected task when typing custom name
                  if (e.target.value) setSelectedTask(null);
                }}
                placeholder="Enter custom task name..."
                disabled={!!selectedTask}
              />
            </div>

            {/* Assign To - Only show when typing custom task name */}
            {customTaskName.trim() && (
              <div className="space-y-3">
                <Label>Assign To</Label>
                {/* Quick-select buttons for job's internal team */}
                <div className="flex flex-wrap gap-2">
                  {INTERNAL_TEAM_ROLES.map((role) => {
                    const teamMember = getTeamMemberForRole(role.key);
                    const isSelected = isRoleButtonSelected(role.key);
                    return (
                      <Button
                        key={role.key}
                        type="button"
                        variant={isSelected ? "default" : "outline"}
                        size="sm"
                        onClick={() => handleRoleClick(role.key)}
                        className={cn(
                          "text-xs flex-col h-auto py-1.5 px-3",
                          isSelected && "ring-2 ring-offset-1"
                        )}
                      >
                        <span>{role.label}</span>
                        {teamMember?.user?.name && (
                          <span className={cn(
                            "text-[10px] font-normal",
                            isSelected ? "text-primary-foreground/80" : "text-muted-foreground"
                          )}>
                            {teamMember.user.name}
                          </span>
                        )}
                      </Button>
                    );
                  })}
                </div>
                {/* Role dropdown - select any role */}
                <ComboboxDropdown
                  items={roles.map((role) => ({
                    id: String(role.id),
                    label: role.label,
                  }))}
                  selectedItem={assignedRole ? {
                    id: assignedRole,
                    label: roles.find(r => String(r.id) === assignedRole)?.label || "Select role",
                  } : undefined}
                  onSelect={(item) => setAssignedRole(item.id)}
                  placeholder="Select role..."
                  searchPlaceholder="Search roles..."
                  emptyResults="No role found."
                  clearable={!!assignedRole}
                  onClear={() => setAssignedRole("")}
                />
                {/* User dropdown - select any user */}
                <ComboboxDropdown
                  items={users.map((user) => ({
                    id: String(user.id),
                    label: user.name,
                  }))}
                  selectedItem={assignedUserId ? {
                    id: assignedUserId,
                    label: users.find(u => String(u.id) === assignedUserId)?.name || "Select user",
                  } : undefined}
                  onSelect={(item) => {
                    setAssignedUserId(item.id);
                    // Clear role if user manually selects a different user
                    const roleUser = assignedRole ? getTeamMemberForRole(assignedRole) : null;
                    if (roleUser && String(roleUser.user_id) !== item.id) {
                      setAssignedRole("");
                    }
                  }}
                  placeholder="Select user..."
                  searchPlaceholder="Search users..."
                  emptyResults="No user found."
                  clearable={!!assignedUserId}
                  onClear={() => {
                    setAssignedUserId("");
                    setAssignedRole("");
                  }}
                />
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" onClick={() => setShowCreateModal(false)} disabled={saving}>
              Cancel
            </Button>
            <Button variant="outline" onClick={() => handleCreate(false)} disabled={saving}>
              {saving ? (
                <>
                  <Spinner size={16} className="mr-2" />
                  Creating...
                </>
              ) : (
                "Create"
              )}
            </Button>
            <Button onClick={() => handleCreate(true)} disabled={saving}>
              {saving ? (
                <>
                  <Spinner size={16} className="mr-2" />
                  Creating...
                </>
              ) : (
                <>
                  Save & Open
                  <ExternalLink className="h-4 w-4 ml-2" />
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default JobPurchaseOrdersTab;
