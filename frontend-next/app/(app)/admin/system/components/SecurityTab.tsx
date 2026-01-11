"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Users,
  Shield,
  UsersRound,
  MoreHorizontal,
  Plus,
  Search,
  Pencil,
  Trash2,
  Mail,
  Sun,
  Moon,
  Monitor,
} from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/use-toast";
import { UserDetailSheet } from "@/components/admin/UserDetailSheet";
import { Spinner } from "@/components/ui/spinner";

interface User {
  id: number;
  name: string;
  email: string;
  role: string;
  status?: string;
  last_login_at?: string;
  last_seen_at?: string;
  last_email_sync_at?: string;
  presence_status?: 'online' | 'away' | 'offline';
  integrations?: string[];
  integrations_count?: number;
  created_at?: string;
  // For UserDetailSheet
  mobile_phone?: string;
  role_ids?: Array<{ id: number; display_value: string; name: string }>;
  preferred_theme?: string;
  [key: string]: unknown;
}

// Format relative time (e.g., "2 hours ago", "Yesterday", "Dec 3")
function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString('en-AU', { month: 'short', day: 'numeric' });
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

// Users Management Tab
function UsersManagementTab() {
  const { toast } = useToast();
  const [users, setUsers] = React.useState<User[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [searchTerm, setSearchTerm] = React.useState("");
  const [showInviteDialog, setShowInviteDialog] = React.useState(false);
  const [inviteEmail, setInviteEmail] = React.useState("");
  const [inviteRole, setInviteRole] = React.useState("");
  const [roles, setRoles] = React.useState<Role[]>([]);
  const [inviting, setInviting] = React.useState(false);
  const [selectedUser, setSelectedUser] = React.useState<User | null>(null);
  const [showDetailSheet, setShowDetailSheet] = React.useState(false);

  React.useEffect(() => {
    loadUsers();
    loadRoles();
     
  }, []);

  const loadUsers = async () => {
    try {
      const data = await api.get<{ users: User[] }>("/api/v1/users");
      setUsers(data?.users || []);
    } catch (error) {
      console.error("Failed to load users:", error);
      toast({ title: "Error", description: "Failed to load users", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const loadRoles = async () => {
    try {
      const data = await api.get<Role[] | { roles: Role[] }>("/api/v1/permissions/roles");
      // Handle both direct array and { roles: [...] } response formats
      const rolesArray = Array.isArray(data) ? data : (data?.roles || []);
      setRoles(rolesArray);
    } catch (error) {
      console.error("Failed to load roles:", error);
    }
  };

  const handleInvite = async () => {
    if (!inviteEmail) return;
    setInviting(true);
    try {
      await api.post("/api/v1/users/invite", { email: inviteEmail, role: inviteRole });
      toast({ title: "Success", description: "Invitation sent successfully" });
      setShowInviteDialog(false);
      setInviteEmail("");
      setInviteRole("");
      loadUsers();
    } catch (error) {
      console.error("Failed to send invitation:", error);
      toast({ title: "Error", description: "Failed to send invitation", variant: "destructive" });
    } finally {
      setInviting(false);
    }
  };

  const filteredUsers = users.filter(
    (user) =>
      user.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size={32} className="text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="relative w-64">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search users..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8"
          />
        </div>
        <Button onClick={() => setShowInviteDialog(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Invite User
        </Button>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Theme</TableHead>
              <TableHead>Integrations</TableHead>
              <TableHead>Last Login</TableHead>
              <TableHead>Last Email Sync</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredUsers.map((user) => (
              <TableRow
                key={user.id}
                className="cursor-pointer"
                onDoubleClick={() => {
                  setSelectedUser(user);
                  setShowDetailSheet(true);
                }}
              >
                <TableCell className="font-medium">
                  <div className="flex items-center gap-2">
                    <div className={cn(
                      "h-2 w-2 rounded-full",
                      user.presence_status === 'online' && "bg-green-500",
                      user.presence_status === 'away' && "bg-yellow-500",
                      user.presence_status === 'offline' && "bg-muted"
                    )} />
                    {user.name}
                  </div>
                </TableCell>
                <TableCell>{user.email}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {user.role_ids && user.role_ids.length > 0 ? (
                      user.role_ids.map((r) => (
                        <Badge key={r.id} variant="outline">{r.display_value || r.name}</Badge>
                      ))
                    ) : (
                      <Badge variant="outline">{user.role || "user"}</Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge
                    variant={user.status === "active" ? "default" : "secondary"}
                    className={cn(
                      user.presence_status === 'online' && "bg-green-500 hover:bg-green-600"
                    )}
                  >
                    {user.presence_status === 'online' ? 'Online' :
                     user.status === "active" ? "Active" : "Pending"}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1 text-muted-foreground">
                    {user.preferred_theme === 'dark' ? (
                      <Moon className="h-4 w-4" />
                    ) : user.preferred_theme === 'system' ? (
                      <Monitor className="h-4 w-4" />
                    ) : (
                      <Sun className="h-4 w-4" />
                    )}
                    <span className="text-xs capitalize">{user.preferred_theme || 'light'}</span>
                  </div>
                </TableCell>
                <TableCell>
                  {(user.integrations_count ?? 0) > 0 ? (
                    <div className="flex gap-1">
                      {user.integrations?.includes('microsoft') && (
                        <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                          MS
                        </Badge>
                      )}
                      {user.integrations?.includes('outlook') && (
                        <Badge variant="outline" className="text-xs bg-indigo-50 text-indigo-700 border-indigo-200">
                          Email
                        </Badge>
                      )}
                    </div>
                  ) : (
                    <span className="text-muted-foreground text-sm">None</span>
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {user.last_login_at
                    ? formatRelativeTime(user.last_login_at)
                    : "Never"}
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {user.last_email_sync_at
                    ? formatRelativeTime(user.last_email_sync_at)
                    : "Never"}
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem>
                        <Pencil className="h-4 w-4 mr-2" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem>
                        <Mail className="h-4 w-4 mr-2" />
                        Resend Invite
                      </DropdownMenuItem>
                      <DropdownMenuItem className="text-destructive">
                        <Trash2 className="h-4 w-4 mr-2" />
                        Deactivate
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={showInviteDialog} onOpenChange={setShowInviteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite User</DialogTitle>
            <DialogDescription>
              Send an invitation email to add a new user to the system.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                placeholder="user@example.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="role">Role</Label>
              <Select value={inviteRole} onValueChange={setInviteRole}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a role" />
                </SelectTrigger>
                <SelectContent>
                  {roles.map((role) => (
                    <SelectItem key={role.id} value={role.name}>
                      {role.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowInviteDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleInvite} disabled={inviting || !inviteEmail}>
              {inviting ? (
                <>
                  <Spinner size={16} className="mr-2" />
                  Sending...
                </>
              ) : (
                "Send Invitation"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* User Detail Sheet - opens on double-click */}
      <UserDetailSheet
        user={selectedUser}
        isOpen={showDetailSheet}
        onClose={() => {
          setShowDetailSheet(false);
          setSelectedUser(null);
        }}
        onSave={loadUsers}
      />
    </div>
  );
}

// Roles Management Tab
function RolesManagementTab() {
  const { toast } = useToast();
  const [roles, setRoles] = React.useState<Role[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [showAddDialog, setShowAddDialog] = React.useState(false);
  const [showEditDialog, setShowEditDialog] = React.useState(false);
  const [editingRole, setEditingRole] = React.useState<Role | null>(null);
  const [newRoleName, setNewRoleName] = React.useState("");
  const [newRoleDescription, setNewRoleDescription] = React.useState("");
  const [editDisplayName, setEditDisplayName] = React.useState("");
  const [editDescription, setEditDescription] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  // View users in role
  const [showUsersDialog, setShowUsersDialog] = React.useState(false);
  const [selectedRoleForUsers, setSelectedRoleForUsers] = React.useState<Role | null>(null);
  const [roleUsers, setRoleUsers] = React.useState<Array<{ id: number; name: string; email: string }>>([]);
  const [loadingRoleUsers, setLoadingRoleUsers] = React.useState(false);

  React.useEffect(() => {
    loadRoles();
  }, []);

  const loadRoles = async () => {
    try {
      const data = await api.get<Role[] | { roles: Role[] }>("/api/v1/permissions/roles");
      // Handle both direct array and { roles: [...] } response formats
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
      // Fallback: load all users and filter by role
      try {
        const allUsers = await api.get<{ users: User[] }>("/api/v1/users");
        const filtered = (allUsers?.users || []).filter(u =>
          Array.isArray(u.role_ids) && u.role_ids.some(r => r.id === role.id)
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
    if (!confirm(`Are you sure you want to delete the role "${role.display_name || role.name}"?`)) {
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

// Groups Management Tab
function GroupsManagementTab() {
  const { toast } = useToast();
  const [groups, setGroups] = React.useState<Group[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [showAddDialog, setShowAddDialog] = React.useState(false);
  const [newGroupName, setNewGroupName] = React.useState("");
  const [newGroupDescription, setNewGroupDescription] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
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

// Main Security Tab Component
interface SecurityTabProps {
  innertab?: string;
}

export function SecurityTab({ innertab }: SecurityTabProps) {
  const router = useRouter();
  const securityTab = innertab || "users";

  const handleTabChange = React.useCallback((tab: string) => {
    router.push(`/admin/system/company/security/${tab}`, { scroll: false });
  }, [router]);

  return (
    <div className="space-y-6">
      <Tabs value={securityTab} onValueChange={handleTabChange}>
        <TabsList>
          <TabsTrigger value="users" className="gap-2">
            <Users className="h-4 w-4" />
            Users
          </TabsTrigger>
          <TabsTrigger value="roles" className="gap-2">
            <Shield className="h-4 w-4" />
            User Roles
          </TabsTrigger>
          <TabsTrigger value="groups" className="gap-2">
            <UsersRound className="h-4 w-4" />
            Groups
          </TabsTrigger>
        </TabsList>

        <div className="mt-6">
          <TabsContent value="users">
            <UsersManagementTab />
          </TabsContent>
          <TabsContent value="roles">
            <RolesManagementTab />
          </TabsContent>
          <TabsContent value="groups">
            <GroupsManagementTab />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
