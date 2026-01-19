"use client";

import * as React from "react";
import { useEffect, useState, useCallback, useMemo } from "react";
import { useConfirm } from "@/contexts/ConfirmationContext";
import { usePathname, useRouter } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { Spinner } from "@/components/ui/spinner";
import {
  UserGroupIcon,
  ShieldCheckIcon,
  MagnifyingGlassIcon,
  CheckIcon,
} from "@heroicons/react/24/outline";
import {
  Shield,
  UsersRound,
  MoreHorizontal,
  Plus,
  Search,
  Pencil,
  Trash2,
  Users,
  KeyRound,
} from "lucide-react";

/**
 * Roles & Permissions Page - Organization Settings
 *
 * SSoT: This is THE ONE location for managing:
 * - User Permissions (assign permissions to users)
 * - User Roles (define role types like Admin, Supervisor)
 * - Groups (user groups)
 *
 * Part of the Settings/Admin merge - Organization section.
 * Admin role required (enforced by layout).
 *
 * URL is SSoT for tab state: /settings/roles/[tab]
 */

// Tab definitions
const ROLES_TABS = [
  { id: "permissions", label: "Permissions", icon: KeyRound },
  { id: "roles", label: "User Roles", icon: Shield },
  { id: "groups", label: "Groups", icon: UsersRound },
];

const DEFAULT_TAB = "permissions";

// ============================================
// Types
// ============================================

interface User {
  id: number;
  name: string;
  email: string;
  role: string;
}

interface Permission {
  id: number;
  name: string;
  description: string;
}

interface PermissionsMap {
  [category: string]: Permission[];
}

interface CategoriesMap {
  [key: string]: string;
}

interface Role {
  id: number;
  name: string;
  display_name?: string;
  description: string;
  users_count: number;
  tasks_count?: number;
}

interface Group {
  id: number;
  name: string;
  description: string;
  members_count: number;
}

// ============================================
// Permissions Sub-Tab
// ============================================

function PermissionsSubTab() {
  const [users, setUsers] = useState<User[]>([]);
  const [permissions, setPermissions] = useState<PermissionsMap>({});
  const [categories, setCategories] = useState<CategoriesMap>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userPermissions, setUserPermissions] = useState<string[]>([]);
  const [rolePermissions, setRolePermissions] = useState<string[]>([]);
  const [updatingPermission, setUpdatingPermission] = useState<string | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const selectedUser = selectedUserId
    ? users.find((u) => u.id === selectedUserId) || null
    : null;

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [usersRes, permissionsRes] = await Promise.all([
        api.get<{ users: User[] }>("/api/v1/users"),
        api.get<{
          success: boolean;
          permissions: PermissionsMap;
          categories: CategoriesMap;
        }>("/api/v1/permissions"),
      ]);

      setUsers(usersRes?.users || []);

      if (permissionsRes.success) {
        setPermissions(permissionsRes.permissions || {});
        setCategories(permissionsRes.categories || {});
      }
    } catch (err) {
      console.error("Failed to load permissions data:", err);
      setError("Failed to load permissions data");
    } finally {
      setLoading(false);
    }
  };

  const loadUserPermissions = useCallback(async (userId: number) => {
    try {
      const response = await api.get<{
        success: boolean;
        user: User;
        permissions: string[];
        role_permissions: string[];
      }>(`/api/v1/permissions/user/${userId}`);
      if (response?.success) {
        setUserPermissions(response.permissions || []);
        setRolePermissions(response.role_permissions || []);
      }
    } catch (err) {
      console.error("Failed to load user permissions:", err);
    }
  }, []);

  useEffect(() => {
    if (selectedUser) {
      loadUserPermissions(selectedUser.id);
    } else {
      setUserPermissions([]);
      setRolePermissions([]);
    }
  }, [selectedUser, loadUserPermissions]);

  const togglePermission = async (
    permissionName: string,
    currentlyGranted: boolean
  ) => {
    if (!selectedUser) return;

    try {
      setUpdatingPermission(permissionName);

      const response = await api.post<{ success: boolean }>(
        "/api/v1/permissions/grant",
        {
          user_id: selectedUser.id,
          permission_name: permissionName,
          granted: !currentlyGranted,
        }
      );

      if (response?.success) {
        await loadUserPermissions(selectedUser.id);
      }
    } catch (err) {
      console.error("Failed to update permission:", err);
      alert("Failed to update permission");
    } finally {
      setUpdatingPermission(null);
    }
  };

  const hasPermission = (permissionName: string): boolean => {
    return userPermissions.includes(permissionName);
  };

  const isFromRole = (permissionName: string): boolean => {
    return rolePermissions.includes(permissionName);
  };

  const filteredUsers = users.filter(
    (user) =>
      user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.role.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner size={32} className="text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-12">
        <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
          <p className="text-destructive">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-12 gap-6">
      {/* User List */}
      <div className="col-span-4 bg-card rounded-lg border border-border">
        <div className="p-4 border-b border-border">
          <div className="relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search users..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-border rounded-lg bg-background text-foreground focus:ring-2 focus:ring-primary focus:border-transparent"
            />
          </div>
        </div>

        <div className="divide-y divide-border max-h-[600px] overflow-y-auto">
          {filteredUsers.map((user) => (
            <button
              key={user.id}
              onClick={() => setSelectedUserId(user.id)}
              className={`w-full p-4 text-left hover:bg-muted transition-colors ${
                selectedUser?.id === user.id
                  ? "bg-primary/10 border-l-4 border-primary"
                  : ""
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="font-semibold text-foreground">
                    {user.name}
                  </h3>
                  <p className="text-sm text-muted-foreground">{user.email}</p>
                  <span className="inline-block mt-2 px-2 py-1 text-xs font-medium bg-muted text-foreground rounded">
                    {user.role}
                  </span>
                </div>
                {selectedUser?.id === user.id && (
                  <CheckIcon className="h-5 w-5 text-primary flex-shrink-0 ml-2" />
                )}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Permissions Panel */}
      <div className="col-span-8 bg-card rounded-lg border border-border">
        {!selectedUser ? (
          <div className="p-12 text-center text-muted-foreground">
            <UserGroupIcon className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
            <p className="text-lg">
              Select a user to manage their permissions
            </p>
          </div>
        ) : (
          <div>
            <div className="p-6 border-b border-border bg-muted/50">
              <h2 className="text-xl font-bold text-foreground">
                {selectedUser.name}
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                {selectedUser.email}
              </p>
              <div className="mt-3">
                <span className="inline-block px-3 py-1 text-sm font-medium bg-primary/20 text-primary rounded">
                  Role: {selectedUser.role}
                </span>
              </div>
            </div>

            <div className="p-6 max-h-[600px] overflow-y-auto">
              <div className="mb-4 p-4 bg-primary/5 border border-primary/20 rounded-lg">
                <h4 className="font-semibold text-foreground mb-2">
                  Permission Legend
                </h4>
                <div className="space-y-1 text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-green-500 rounded"></div>
                    <span className="text-foreground">
                      Permission granted (from role or user override)
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-muted rounded"></div>
                    <span className="text-foreground">
                      Permission not granted
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-blue-500 rounded"></div>
                    <span className="text-foreground">
                      User override (custom permission)
                    </span>
                  </div>
                </div>
              </div>

              {Object.entries(permissions).map(([category, perms]) => (
                <div key={category} className="mb-6">
                  <h3 className="text-lg font-semibold text-foreground mb-3 pb-2 border-b border-border">
                    {categories[category] || category}
                  </h3>
                  <div className="space-y-2">
                    {perms.map((perm) => {
                      const granted = hasPermission(perm.name);
                      const fromRole = isFromRole(perm.name);
                      const isOverride = granted !== fromRole;

                      return (
                        <div
                          key={perm.id}
                          className={`flex items-start gap-3 p-3 rounded-lg border ${
                            granted
                              ? "bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800"
                              : "bg-muted border-border"
                          } ${isOverride ? "ring-2 ring-blue-400" : ""}`}
                        >
                          <button
                            onClick={() =>
                              togglePermission(perm.name, granted)
                            }
                            disabled={updatingPermission === perm.name}
                            className={`flex-shrink-0 w-6 h-6 rounded border-2 flex items-center justify-center transition-colors ${
                              granted
                                ? isOverride
                                  ? "bg-blue-600 border-blue-600"
                                  : "bg-green-600 border-green-600"
                                : "bg-background border-border hover:border-primary"
                            } ${
                              updatingPermission === perm.name
                                ? "opacity-50 cursor-wait"
                                : "cursor-pointer"
                            }`}
                          >
                            {granted && (
                              <CheckIcon className="h-4 w-4 text-white" />
                            )}
                          </button>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <h4 className="font-medium text-foreground">
                                {perm.name}
                              </h4>
                              {fromRole && !isOverride && (
                                <span className="text-xs px-2 py-0.5 bg-muted text-foreground rounded">
                                  from role
                                </span>
                              )}
                              {isOverride && (
                                <span className="text-xs px-2 py-0.5 bg-blue-200 dark:bg-blue-800 text-blue-800 dark:text-blue-200 rounded">
                                  override
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground mt-1">
                              {perm.description}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================
// User Roles Sub-Tab
// ============================================

function UserRolesSubTab() {
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
        const allUsers = await api.get<{ users: User[] }>("/api/v1/users");
        const filtered = (allUsers?.users || []).filter(u =>
          u.role === role.name
        );
        setRoleUsers(filtered.map(u => ({ id: u.id, name: u.name, email: u.email })));
      } catch {
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
    setShowEditDialog(true);
  };

  const handleSaveEdit = async () => {
    if (!editingRole) return;
    setSaving(true);
    try {
      await api.patch(`/api/v1/permissions/roles/${editingRole.id}`, {
        role: { display_name: editDisplayName, description: editDescription },
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
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size={32} className="text-muted-foreground" />
      </div>
    );
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
            onDoubleClick={() => handleViewRoleUsers(role)}
          >
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">{role.display_name || role.name}</CardTitle>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => handleEditRole(role)}>
                      <Pencil className="h-4 w-4 mr-2" />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-destructive"
                      onClick={() => handleDeleteRole(role)}
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Role</DialogTitle>
            <DialogDescription>
              Update the display name and description for this role.
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
              <div className="text-center py-8 text-muted-foreground">
                No users assigned to this role
              </div>
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
// Groups Sub-Tab
// ============================================

function GroupsSubTab() {
  const { toast } = useToast();
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupDescription, setNewGroupDescription] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadGroups();
  }, []);

  const loadGroups = async () => {
    try {
      const data = await api.get<Group[]>("/api/v1/groups");
      setGroups(data);
    } catch (error) {
      console.error("Failed to load groups:", error);
      // Mock data for development
      setGroups([
        { id: 1, name: "Supervisors", description: "Site supervisors", members_count: 5 },
        { id: 2, name: "Office Staff", description: "Office administration", members_count: 8 },
      ]);
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size={32} className="text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end">
        <Button onClick={() => setShowAddDialog(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Group
        </Button>
      </div>

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
                    <DropdownMenuItem>
                      <Users className="h-4 w-4 mr-2" />
                      Manage Members
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                      <Pencil className="h-4 w-4 mr-2" />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem className="text-destructive">
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

      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Group</DialogTitle>
            <DialogDescription>
              Create a new group to organize users.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="groupName">Group Name</Label>
              <Input
                id="groupName"
                placeholder="e.g., Site Team A"
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="groupDescription">Description</Label>
              <Input
                id="groupDescription"
                placeholder="Brief description of this group"
                value={newGroupDescription}
                onChange={(e) => setNewGroupDescription(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddGroup} disabled={saving || !newGroupName}>
              {saving ? (
                <>
                  <Spinner size={16} className="mr-2" />
                  Creating...
                </>
              ) : (
                "Create Group"
              )}
            </Button>
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
  const pathname = usePathname();
  const router = useRouter();

  // URL is SSoT for tab state (path-based navigation)
  const activeTab = useMemo(() => {
    const parts = pathname.replace("/settings/roles", "").split("/").filter(Boolean);
    const tab = parts[0] || DEFAULT_TAB;
    // Validate tab exists
    return ROLES_TABS.some((t) => t.id === tab) ? tab : DEFAULT_TAB;
  }, [pathname]);

  // Redirect to default tab if no tab in URL
  useEffect(() => {
    if (!pathname.includes("/settings/roles/")) {
      router.replace(`/settings/roles/${DEFAULT_TAB}`, { scroll: false });
    }
  }, [pathname, router]);

  const handleTabChange = useCallback((tabId: string) => {
    router.push(`/settings/roles/${tabId}`, { scroll: false });
  }, [router]);

  return (
    <div className="space-y-6">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-foreground flex items-center gap-3">
          <ShieldCheckIcon className="h-6 w-6 text-primary" />
          Access Control
        </h2>
        <p className="text-muted-foreground mt-1">
          Manage permissions, roles, and groups
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange}>
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
          <TabsContent value="roles">
            <UserRolesSubTab />
          </TabsContent>
          <TabsContent value="groups">
            <GroupsSubTab />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
