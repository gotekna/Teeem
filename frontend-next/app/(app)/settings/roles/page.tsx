"use client";

import * as React from "react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useConfirm } from "@/contexts/ConfirmationContext";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePathTabs } from "@/hooks/usePathTabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";
import { LoadingOverlay } from "@/components/ui/loading-overlay";
import { Spinner } from "@/components/ui/spinner";
import { EmptyState } from "@/components/ui/empty-state";
import { API } from "@/lib/constants/api-endpoints";
import {
  ShieldCheckIcon,
} from "@heroicons/react/24/outline";
import {
  Shield,
  UsersRound,
  MoreHorizontal,
  Plus,
  Pencil,
  Trash2,
  Users,
  LayoutGrid,
  List,
  GanttChart,
  ToggleLeft,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import TeeemTableView from "@/components/table/TeeemTableView";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { User } from "@/lib/types";

/**
 * Access Control Page - Organization Settings
 *
 * SSoT: This is THE ONE location for managing:
 * - Permissions (define what each role can do via role cards + permission matrix)
 * - Users (assign roles to users via TeeemTableView)
 * - Features (enable/disable company modules)
 * - Groups (user groups)
 *
 * Part of the Settings/Admin merge - Organization section.
 * Admin role required (enforced by layout).
 *
 * URL is SSoT for tab state: /settings/roles/[tab]
 */

// Tab definitions
const ROLES_TABS = [
  { id: "permissions", label: "Permissions", icon: Shield },
  { id: "users", label: "Users", icon: UsersRound },
  { id: "features", label: "Features", icon: ToggleLeft },
  { id: "groups", label: "Groups", icon: Users },
];

const DEFAULT_TAB = "permissions";

// ============================================
// Types
// ============================================

interface Role {
  id: number;
  name: string;
  display_name?: string;
  description: string;
  users_count: number;
  tasks_count?: number;
  settings?: {
    default_task_view?: "list" | "board" | "gantt";
  };
  default_task_view?: "list" | "board" | "gantt";
}

interface Group {
  id: number;
  name: string;
  description: string;
  members_count: number;
}

// ============================================
// Permissions Sub-Tab (Role Cards + Permission Matrix)
// ============================================

function PermissionsSubTab() {
  const router = useRouter();
  const { toast } = useToast();
  const { confirm } = useConfirm();
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [newRoleName, setNewRoleName] = useState("");
  const [newRoleDescription, setNewRoleDescription] = useState("");
  const [editDisplayName, setEditDisplayName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  // Role settings state (Jan 2026)
  const [editDefaultTaskView, setEditDefaultTaskView] = useState<"list" | "board" | "gantt">("board");
  const [saving, setSaving] = useState(false);
  // View users in role
  const [showUsersDialog, setShowUsersDialog] = useState(false);
  const [selectedRoleForUsers, setSelectedRoleForUsers] = useState<Role | null>(null);
  const [roleUsers, setRoleUsers] = useState<Array<{ id: number; name: string; email: string }>>([]);
  const [loadingRoleUsers, setLoadingRoleUsers] = useState(false);

  useEffect(() => {
    loadRoles();
  }, []);

  const loadRoles = async () => {
    try {
      const data = await api.get<Role[] | { roles: Role[] }>("/api/v1/permissions/roles");
      const rolesArray = Array.isArray(data) ? data : (data?.roles || []);
      setRoles(rolesArray);
    } catch (error) {
      console.error("Failed to load roles:", error);
      toast({ title: "Error", description: "Failed to load roles", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleViewRoleUsers = async (role: Role) => {
    setSelectedRoleForUsers(role);
    setShowUsersDialog(true);
    setLoadingRoleUsers(true);
    try {
      const data = await api.get<{ users: Array<{ id: number; name: string; email: string }> }>(
        `/api/v1/permissions/roles/${role.id}/users`
      );
      setRoleUsers(data?.users || []);
    } catch (error) {
      console.error("Failed to load role users:", error);
      try {
        const allUsers = await api.get<{ users: User[] }>(API.users.list);
        const filtered = (allUsers?.users || []).filter(u =>
          u.role === role.name
        );
        setRoleUsers(filtered.map(u => ({ id: u.id, name: u.name, email: u.email })));
      } catch (err) {
        console.error("[RolesPage] Failed to load role users (fallback):", err);
        setRoleUsers([]);
      }
    } finally {
      setLoadingRoleUsers(false);
    }
  };

  const handleAddRole = async () => {
    if (!newRoleName) return;
    setSaving(true);
    try {
      const response = await api.post<{ success: boolean; error?: string }>("/api/v1/permissions/roles", {
        role: { name: newRoleName, description: newRoleDescription },
      });
      if (response?.success === false && response?.error) {
        toast({ title: "Error", description: response.error, variant: "destructive" });
      } else {
        toast({ title: "Success", description: "Role created successfully" });
        setShowAddDialog(false);
        setNewRoleName("");
        setNewRoleDescription("");
        loadRoles();
      }
    } catch (error: any) {
      console.error("Failed to create role:", error);
      const errorMessage = error?.response?.data?.error || error?.message || "Failed to create role";
      toast({ title: "Error", description: errorMessage, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleEditRole = (role: Role) => {
    setEditingRole(role);
    setEditDisplayName(role.display_name || role.name);
    setEditDescription(role.description || "");
    // Initialize settings (Jan 2026)
    setEditDefaultTaskView(role.default_task_view || role.settings?.default_task_view || "board");
    setShowEditDialog(true);
  };

  const handleSaveEdit = async () => {
    if (!editingRole) return;
    setSaving(true);
    try {
      await api.patch(`/api/v1/permissions/roles/${editingRole.id}`, {
        role: {
          display_name: editDisplayName,
          description: editDescription,
          // Include settings (Jan 2026)
          default_task_view: editDefaultTaskView,
        },
      });
      toast({ title: "Success", description: "Role updated successfully" });
      setShowEditDialog(false);
      setEditingRole(null);
      loadRoles();
    } catch (error: any) {
      console.error("Failed to update role:", error);
      const errorMessage = error?.response?.data?.error || "Failed to update role";
      toast({ title: "Error", description: errorMessage, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteRole = async (role: Role) => {
    if (!(await confirm(`Are you sure you want to delete the role "${role.display_name || role.name}"?`))) {
      return;
    }
    try {
      const response = await api.delete<{ success: boolean; error?: string }>(`/api/v1/permissions/roles/${role.id}`);
      if (response?.success === false && response?.error) {
        toast({ title: "Error", description: response.error, variant: "destructive" });
      } else {
        toast({ title: "Success", description: "Role deleted successfully" });
        loadRoles();
      }
    } catch (error: any) {
      console.error("Failed to delete role:", error);
      const errorMessage = error?.response?.data?.error || "Failed to delete role";
      toast({ title: "Error", description: errorMessage, variant: "destructive" });
    }
  };

  if (loading) {
    return <LoadingOverlay />;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end">
        <Button onClick={() => setShowAddDialog(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Role
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {roles.map((role) => (
          <Card
            key={role.id}
            className="cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => router.push(`/settings/roles/roles/${role.id}`)}
          >
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">{role.display_name || role.name}</CardTitle>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                    <Button variant="ghost" size="icon">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={(e) => { e.stopPropagation(); router.push(`/settings/roles/roles/${role.id}`); }}>
                      <Shield className="h-4 w-4 mr-2" />
                      Manage Permissions
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleEditRole(role); }}>
                      <Pencil className="h-4 w-4 mr-2" />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleViewRoleUsers(role); }}>
                      <Users className="h-4 w-4 mr-2" />
                      View Users
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-destructive"
                      onClick={(e) => { e.stopPropagation(); handleDeleteRole(role); }}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-2">
                {role.description || "No description"}
              </p>
              <div className="flex gap-2 flex-wrap">
                <Badge variant="secondary">
                  {role.users_count || 0} users
                </Badge>
                {(role.tasks_count ?? 0) > 0 && (
                  <Badge variant="outline">
                    {role.tasks_count} tasks
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Add Role Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Role</DialogTitle>
            <DialogDescription>
              Create a new role for user permission management.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="roleName">Role Name</Label>
              <Input
                id="roleName"
                placeholder="e.g., Project Manager"
                value={newRoleName}
                onChange={(e) => setNewRoleName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="roleDescription">Description</Label>
              <Input
                id="roleDescription"
                placeholder="Brief description of this role"
                value={newRoleDescription}
                onChange={(e) => setNewRoleDescription(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddRole} disabled={saving || !newRoleName}>
              {saving ? (
                <>
                  <Spinner size={16} className="mr-2" />
                  Creating...
                </>
              ) : (
                "Create Role"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Role Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Role</DialogTitle>
            <DialogDescription>
              Update role settings and display options.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Role ID</Label>
              <Input value={editingRole?.name || ""} disabled className="bg-muted" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="editDisplayName">Display Name</Label>
              <Input
                id="editDisplayName"
                value={editDisplayName}
                onChange={(e) => setEditDisplayName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="editDescription">Description</Label>
              <Input
                id="editDescription"
                placeholder="Brief description of this role"
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
              />
            </div>

            {/* Role Settings Section (Jan 2026) */}
            <div className="pt-4 border-t">
              <h4 className="font-medium text-sm mb-3">Default Settings</h4>
              <p className="text-xs text-muted-foreground mb-4">
                These settings apply to users with this role as their primary role.
              </p>

              <div className="space-y-4">
                {/* Default Task View */}
                <div className="space-y-2">
                  <Label>Default Task View</Label>
                  <Select
                    value={editDefaultTaskView}
                    onValueChange={(value: "list" | "board" | "gantt") => setEditDefaultTaskView(value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select default view" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="board">
                        <div className="flex items-center gap-2">
                          <LayoutGrid className="h-4 w-4" />
                          Board
                        </div>
                      </SelectItem>
                      <SelectItem value="list">
                        <div className="flex items-center gap-2">
                          <List className="h-4 w-4" />
                          List
                        </div>
                      </SelectItem>
                      <SelectItem value="gantt">
                        <div className="flex items-center gap-2">
                          <GanttChart className="h-4 w-4" />
                          Gantt
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Default view when users first open Tasks.
                  </p>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveEdit} disabled={saving}>
              {saving ? (
                <>
                  <Spinner size={16} className="mr-2" />
                  Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Users in Role Dialog */}
      <Dialog open={showUsersDialog} onOpenChange={setShowUsersDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              {selectedRoleForUsers?.display_name || selectedRoleForUsers?.name} Users
            </DialogTitle>
            <DialogDescription>
              Users assigned to this role
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[400px] overflow-y-auto">
            {loadingRoleUsers ? (
              <div className="flex items-center justify-center py-8">
                <Spinner size={24} className="text-muted-foreground" />
              </div>
            ) : roleUsers.length === 0 ? (
              <EmptyState title="No users assigned to this role" size="sm" />
            ) : (
              <div className="space-y-2">
                {roleUsers.map((user) => (
                  <div
                    key={user.id}
                    className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-muted/50"
                  >
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium text-primary">
                      {user.name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate">{user.name}</div>
                      <div className="text-xs text-muted-foreground truncate">{user.email}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowUsersDialog(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============================================
// Users Sub-Tab (TeeemTableView)
// ============================================

function UsersSubTab() {
  return (
    <div className="flex flex-col h-full -mx-4">
      <TeeemTableView
        foundationId="user-management"
        autoFetchRecords={true}
      />
    </div>
  );
}

// ============================================
// Features Sub-Tab (Module Toggles)
// ============================================

interface ModuleConfig {
  key: string;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}

const AVAILABLE_MODULES: ModuleConfig[] = [
  { key: "finance", label: "Finance", description: "Invoices, Purchase Orders, Estimates, Bill Inbox", icon: LayoutGrid },
  { key: "warehouse", label: "File Warehouse", description: "Document storage and management", icon: LayoutGrid },
  { key: "corporate", label: "Corporate", description: "Corporate companies, groups, cases", icon: LayoutGrid },
  { key: "properties", label: "Properties", description: "Property management", icon: LayoutGrid },
  { key: "calendar", label: "Calendar", description: "Calendar and scheduling", icon: LayoutGrid },
  { key: "meetings", label: "Meetings", description: "Meeting management", icon: LayoutGrid },
  { key: "docsort", label: "DocSort", description: "AI document sorting", icon: LayoutGrid },
  { key: "esignature", label: "E-Signatures", description: "Digital signature workflows", icon: LayoutGrid },
  { key: "library", label: "Library", description: "Templates and resources", icon: LayoutGrid },
  { key: "portal", label: "Portal", description: "Client portal", icon: LayoutGrid },
  { key: "schedule_master", label: "Schedule Master", description: "Gantt charts and scheduling", icon: LayoutGrid },
  { key: "leads", label: "Leads", description: "Lead management", icon: LayoutGrid },
];

function FeaturesSubTab() {
  const { toast } = useToast();
  const [modules, setModules] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    loadModules();
  }, []);

  const loadModules = async () => {
    try {
      setLoading(true);
      const response = await api.get<{ success: boolean; modules: Record<string, boolean> }>(
        "/api/v1/tenant_settings/modules"
      );
      if (response?.success) {
        setModules(response.modules || {});
      }
    } catch (err) {
      console.error("Failed to load modules:", err);
      // Default: all enabled
      const defaults: Record<string, boolean> = {};
      AVAILABLE_MODULES.forEach(m => { defaults[m.key] = true; });
      setModules(defaults);
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (moduleKey: string, enabled: boolean) => {
    setSaving(moduleKey);
    // Optimistic update
    setModules(prev => ({ ...prev, [moduleKey]: enabled }));
    try {
      await api.patch("/api/v1/tenant_settings/modules", {
        modules: { [moduleKey]: enabled },
      });
      toast({
        title: enabled ? "Module enabled" : "Module disabled",
        description: `${AVAILABLE_MODULES.find(m => m.key === moduleKey)?.label} has been ${enabled ? "enabled" : "disabled"}.`,
      });
    } catch (err) {
      console.error("Failed to toggle module:", err);
      // Revert on error
      setModules(prev => ({ ...prev, [moduleKey]: !enabled }));
      toast({
        title: "Error",
        description: "Failed to update module setting",
        variant: "destructive",
      });
    } finally {
      setSaving(null);
    }
  };

  if (loading) {
    return <LoadingOverlay height="py-12" />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-foreground">Features</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Enable or disable modules for your company. Disabled modules are hidden from navigation.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {AVAILABLE_MODULES.map((mod) => {
          const isEnabled = modules[mod.key] !== false; // Default: enabled
          return (
            <Card key={mod.key} className={!isEnabled ? "opacity-60" : ""}>
              <CardContent className="pt-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-foreground">{mod.label}</h4>
                    <p className="text-sm text-muted-foreground mt-1">
                      {mod.description}
                    </p>
                  </div>
                  <Switch
                    checked={isEnabled}
                    onCheckedChange={(checked) => handleToggle(mod.key, checked)}
                    disabled={saving === mod.key}
                  />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

// ============================================
// Groups Sub-Tab
// ============================================

function GroupsSubTab() {
  const { toast } = useToast();
  const { confirm } = useConfirm();
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showMembersDialog, setShowMembersDialog] = useState(false);
  const [editingGroup, setEditingGroup] = useState<Group | null>(null);
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupDescription, setNewGroupDescription] = useState("");
  const [editGroupName, setEditGroupName] = useState("");
  const [editGroupDescription, setEditGroupDescription] = useState("");
  const [saving, setSaving] = useState(false);
  // Members management
  const [selectedGroupForMembers, setSelectedGroupForMembers] = useState<Group | null>(null);
  const [members, setMembers] = useState<Array<{ id: number; name: string; email: string }>>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [addingMember, setAddingMember] = useState(false);

  useEffect(() => {
    loadGroups();
  }, []);

  const loadGroups = async () => {
    try {
      const data = await api.get<Group[] | { groups: Group[] }>("/api/v1/groups");
      // Backend returns flat array, handle both formats
      const groupsArray = Array.isArray(data) ? data : (data?.groups || []);
      setGroups(groupsArray);
    } catch (error) {
      console.error("Failed to load groups:", error);
      toast({ title: "Error", description: "Failed to load groups", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleAddGroup = async () => {
    if (!newGroupName) return;
    setSaving(true);
    try {
      await api.post("/api/v1/groups", {
        group: { name: newGroupName, description: newGroupDescription },
      });
      toast({ title: "Success", description: "Group created successfully" });
      setShowAddDialog(false);
      setNewGroupName("");
      setNewGroupDescription("");
      loadGroups();
    } catch (error) {
      console.error("Failed to create group:", error);
      toast({ title: "Error", description: "Failed to create group", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleEditGroup = (group: Group) => {
    setEditingGroup(group);
    setEditGroupName(group.name);
    setEditGroupDescription(group.description || "");
    setShowEditDialog(true);
  };

  const handleSaveEdit = async () => {
    if (!editingGroup || !editGroupName) return;
    setSaving(true);
    try {
      await api.patch(`/api/v1/groups/${editingGroup.id}`, {
        name: editGroupName,
        description: editGroupDescription,
      });
      toast({ title: "Success", description: "Group updated successfully" });
      setShowEditDialog(false);
      setEditingGroup(null);
      loadGroups();
    } catch (error) {
      console.error("Failed to update group:", error);
      toast({ title: "Error", description: "Failed to update group", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteGroup = async (group: Group) => {
    if (!(await confirm(`Delete group "${group.name}"? Users in this group will be unassigned.`))) return;
    try {
      const response = await api.delete<{ success: boolean; error?: string }>(`/api/v1/groups/${group.id}`);
      if (response?.success === false && response?.error) {
        toast({ title: "Error", description: response.error, variant: "destructive" });
      } else {
        toast({ title: "Success", description: "Group deleted" });
        loadGroups();
      }
    } catch (error: any) {
      const errorMessage = error?.response?.data?.error || "Failed to delete group";
      toast({ title: "Error", description: errorMessage, variant: "destructive" });
    }
  };

  const handleManageMembers = async (group: Group) => {
    setSelectedGroupForMembers(group);
    setShowMembersDialog(true);
    setLoadingMembers(true);
    try {
      const [membersRes, usersRes] = await Promise.all([
        api.get<{ success: boolean; members: Array<{ id: number; name: string; email: string }> }>(
          `/api/v1/groups/${group.id}/members`
        ),
        api.get<{ users: User[] }>(API.users.list),
      ]);
      setMembers(membersRes?.members || []);
      setAllUsers(usersRes?.users || []);
    } catch (err) {
      console.error("Failed to load members:", err);
    } finally {
      setLoadingMembers(false);
    }
  };

  const handleAddMember = async (userId: number) => {
    if (!selectedGroupForMembers) return;
    setAddingMember(true);
    try {
      await api.post(`/api/v1/groups/${selectedGroupForMembers.id}/add_member`, { user_id: userId });
      // Refresh members
      const res = await api.get<{ success: boolean; members: Array<{ id: number; name: string; email: string }> }>(
        `/api/v1/groups/${selectedGroupForMembers.id}/members`
      );
      setMembers(res?.members || []);
      loadGroups(); // Refresh counts
    } catch (error: any) {
      const msg = error?.response?.data?.error || "Failed to add member";
      toast({ title: "Error", description: msg, variant: "destructive" });
    } finally {
      setAddingMember(false);
    }
  };

  const handleRemoveMember = async (userId: number) => {
    if (!selectedGroupForMembers) return;
    try {
      await api.delete(`/api/v1/groups/${selectedGroupForMembers.id}/remove_member?user_id=${userId}`);
      setMembers((prev) => prev.filter((m) => m.id !== userId));
      loadGroups();
    } catch (error: any) {
      const msg = error?.response?.data?.error || "Failed to remove member";
      toast({ title: "Error", description: msg, variant: "destructive" });
    }
  };

  // Users not already in this group
  const availableUsers = allUsers.filter(
    (u) => !members.some((m) => m.id === u.id)
  );

  if (loading) {
    return <LoadingOverlay />;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end">
        <Button onClick={() => setShowAddDialog(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Group
        </Button>
      </div>

      {groups.length === 0 ? (
        <EmptyState title="No groups created yet" icon={<UsersRound className="h-12 w-12" />} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {groups.map((group) => (
            <Card key={group.id}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{group.name}</CardTitle>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleManageMembers(group)}>
                        <Users className="h-4 w-4 mr-2" />
                        Manage Members
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleEditGroup(group)}>
                        <Pencil className="h-4 w-4 mr-2" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem className="text-destructive" onClick={() => handleDeleteGroup(group)}>
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-2">
                  {group.description || "No description"}
                </p>
                <Badge variant="secondary">
                  {group.members_count || 0} members
                </Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add Group Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Group</DialogTitle>
            <DialogDescription>Create a new group to organize users.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="groupName">Group Name</Label>
              <Input id="groupName" placeholder="e.g., Site Team A" value={newGroupName} onChange={(e) => setNewGroupName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="groupDescription">Description</Label>
              <Input id="groupDescription" placeholder="Brief description" value={newGroupDescription} onChange={(e) => setNewGroupDescription(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>Cancel</Button>
            <Button onClick={handleAddGroup} disabled={saving || !newGroupName}>
              {saving ? <><Spinner size={16} className="mr-2" />Creating...</> : "Create Group"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Group Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Group</DialogTitle>
            <DialogDescription>Update group details.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Group Name</Label>
              <Input value={editGroupName} onChange={(e) => setEditGroupName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Input value={editGroupDescription} onChange={(e) => setEditGroupDescription(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>Cancel</Button>
            <Button onClick={handleSaveEdit} disabled={saving || !editGroupName}>
              {saving ? <><Spinner size={16} className="mr-2" />Saving...</> : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manage Members Dialog */}
      <Dialog open={showMembersDialog} onOpenChange={setShowMembersDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              {selectedGroupForMembers?.name} — Members
            </DialogTitle>
            <DialogDescription>Add or remove users from this group.</DialogDescription>
          </DialogHeader>

          {loadingMembers ? (
            <div className="flex justify-center py-8"><Spinner size={24} /></div>
          ) : (
            <div className="space-y-4">
              {/* Current members */}
              <div>
                <h4 className="text-sm font-medium mb-2">Current Members ({members.length})</h4>
                {members.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No members yet.</p>
                ) : (
                  <div className="space-y-1 max-h-[200px] overflow-y-auto">
                    {members.map((m) => (
                      <div key={m.id} className="flex items-center justify-between p-2 rounded border bg-card">
                        <div>
                          <div className="text-sm font-medium">{m.name}</div>
                          <div className="text-xs text-muted-foreground">{m.email}</div>
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => handleRemoveMember(m.id)}>
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Add member */}
              {availableUsers.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium mb-2">Add Member</h4>
                  <div className="space-y-1 max-h-[200px] overflow-y-auto">
                    {availableUsers.map((u) => (
                      <div key={u.id} className="flex items-center justify-between p-2 rounded border bg-card hover:bg-muted/50">
                        <div>
                          <div className="text-sm font-medium">{u.name}</div>
                          <div className="text-xs text-muted-foreground">{u.email}</div>
                        </div>
                        <Button variant="outline" size="sm" disabled={addingMember} onClick={() => handleAddMember(u.id)}>
                          <Plus className="h-3.5 w-3.5 mr-1" />
                          Add
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowMembersDialog(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============================================
// Main Page Component
// ============================================

export default function RolesSettingsPage() {
  // URL is SSoT for tab state (path-based navigation)
  // redirectToDefault ensures URL always includes tab for breadcrumb visibility
  const [activeTab, setActiveTab] = usePathTabs(
    "/settings/roles",
    DEFAULT_TAB,
    ROLES_TABS.map(t => t.id),
    { redirectToDefault: true }
  );

  return (
    <div className="space-y-6">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-foreground flex items-center gap-3">
          <ShieldCheckIcon className="h-6 w-6 text-primary" />
          Access Control
        </h2>
        <p className="text-muted-foreground mt-1">
          Manage permissions, roles, features, and groups
        </p>
      </div>

      <Tabs expandKey="settings-roles-tabs" value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex-wrap h-auto gap-1">
          {ROLES_TABS.map((tab) => {
            const Icon = tab.icon;
            return (
              <TabsTrigger
                key={tab.id}
                value={tab.id}
                className="text-sm gap-2"
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </TabsTrigger>
            );
          })}
        </TabsList>

        <div className="mt-6">
          <TabsContent value="permissions">
            <PermissionsSubTab />
          </TabsContent>
          <TabsContent value="users">
            <UsersSubTab />
          </TabsContent>
          <TabsContent value="features">
            <FeaturesSubTab />
          </TabsContent>
          <TabsContent value="groups">
            <GroupsSubTab />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
