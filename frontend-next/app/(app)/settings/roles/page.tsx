"use client";

import * as React from "react";
import { useEffect, useState } from "react";
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
  Save,
  ChevronDown,
  ChevronRight,
  Copy,
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
import {
  ALL_LEVELS,
  PERMISSION_LEVEL_LABELS,
  type PermissionLevel,
  type PermissionSectionData,
  type PermissionSectionGroup,
} from "@/lib/constants/permission-levels";

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

// ============================================
// Permission Matrix Row Component (inline)
// ============================================

function InlinePermissionRow({
  section,
  level,
  onChange,
  isSubFeature,
}: {
  section: PermissionSectionData;
  level: PermissionLevel;
  onChange: (key: string, level: PermissionLevel) => void;
  isSubFeature: boolean;
}) {
  return (
    <tr className={isSubFeature ? "bg-muted/30 dark:bg-muted/10" : ""}>
      <td className="py-2 px-3">
        <div className={isSubFeature ? "pl-6" : "font-medium"}>
          <span className={isSubFeature ? "text-sm text-muted-foreground" : ""}>
            {section.displayName}
          </span>
        </div>
      </td>
      {ALL_LEVELS.map((lvl) => (
        <td key={lvl} className="py-2 px-2 text-center">
          {section.availableLevels.includes(lvl) ? (
            <button
              type="button"
              onClick={() => onChange(section.key, lvl)}
              className={`w-5 h-5 rounded-full border-2 inline-flex items-center justify-center transition-colors ${
                level === lvl
                  ? "border-primary bg-primary"
                  : "border-muted-foreground/40 hover:border-primary/60 dark:border-muted-foreground/30"
              }`}
              aria-label={`Set ${section.displayName} to ${PERMISSION_LEVEL_LABELS[lvl]}`}
            >
              {level === lvl && (
                <div className="w-2 h-2 rounded-full bg-primary-foreground" />
              )}
            </button>
          ) : (
            <span className="text-muted-foreground/30 select-none">—</span>
          )}
        </td>
      ))}
    </tr>
  );
}

function InlineSectionGroup({
  group,
  permissions,
  onChange,
}: {
  group: PermissionSectionGroup;
  permissions: Record<string, number>;
  onChange: (key: string, level: PermissionLevel) => void;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const hasSubFeatures = group.subFeatures.length > 0;

  return (
    <>
      <tr
        className={`border-t dark:border-border ${hasSubFeatures ? "cursor-pointer hover:bg-muted/50 dark:hover:bg-muted/20" : ""}`}
        onClick={hasSubFeatures ? () => setCollapsed(!collapsed) : undefined}
      >
        <td className="py-2.5 px-3">
          <div className="flex items-center gap-1.5 font-medium">
            {hasSubFeatures && (
              collapsed ? (
                <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
              )
            )}
            {!hasSubFeatures && <div className="w-4" />}
            {group.header.displayName}
          </div>
        </td>
        {ALL_LEVELS.map((lvl) => (
          <td key={lvl} className="py-2.5 px-2 text-center">
            {group.header.availableLevels.includes(lvl) ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onChange(group.header.key, lvl);
                }}
                className={`w-5 h-5 rounded-full border-2 inline-flex items-center justify-center transition-colors ${
                  (permissions[group.header.key] ?? 0) === lvl
                    ? "border-primary bg-primary"
                    : "border-muted-foreground/40 hover:border-primary/60 dark:border-muted-foreground/30"
                }`}
                aria-label={`Set ${group.header.displayName} to ${PERMISSION_LEVEL_LABELS[lvl]}`}
              >
                {(permissions[group.header.key] ?? 0) === lvl && (
                  <div className="w-2 h-2 rounded-full bg-primary-foreground" />
                )}
              </button>
            ) : (
              <span className="text-muted-foreground/30 select-none">—</span>
            )}
          </td>
        ))}
      </tr>
      {!collapsed &&
        group.subFeatures.map((sf) => (
          <InlinePermissionRow
            key={sf.key}
            section={sf}
            level={(permissions[sf.key] ?? 0) as PermissionLevel}
            onChange={onChange}
            isSubFeature
          />
        ))}
    </>
  );
}

// ============================================
// Permissions Sub-Tab (Inline Role Selector + Permission Matrix)
// ============================================

interface RoleDetail {
  id: number;
  name: string;
  displayName: string;
  description: string;
  godViewAccess: boolean;
  canApprovePayments: boolean;
  canViewConfidentialFields: boolean;
}

function PermissionsSubTab() {
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
  const [editDefaultTaskView, setEditDefaultTaskView] = useState<"list" | "board" | "gantt">("board");
  const [saving, setSaving] = useState(false);
  const [showUsersDialog, setShowUsersDialog] = useState(false);
  const [selectedRoleForUsers, setSelectedRoleForUsers] = useState<Role | null>(null);
  const [roleUsers, setRoleUsers] = useState<Array<{ id: number; name: string; email: string }>>([]);
  const [loadingRoleUsers, setLoadingRoleUsers] = useState(false);

  // Inline permission matrix state
  const [selectedRoleId, setSelectedRoleId] = useState<number | null>(null);
  const [roleDetail, setRoleDetail] = useState<RoleDetail | null>(null);
  const [sections, setSections] = useState<PermissionSectionData[]>([]);
  const [permissions, setPermissions] = useState<Record<string, number>>({});
  const [originalPermissions, setOriginalPermissions] = useState<Record<string, number>>({});
  const [originalSpecialFlags, setOriginalSpecialFlags] = useState({
    godViewAccess: false,
    canApprovePayments: false,
    canViewConfidentialFields: false,
  });
  const [godViewAccess, setGodViewAccess] = useState(false);
  const [canApprovePayments, setCanApprovePayments] = useState(false);
  const [canViewConfidentialFields, setCanViewConfidentialFields] = useState(false);
  const [loadingPerms, setLoadingPerms] = useState(false);
  const [savingPerms, setSavingPerms] = useState(false);

  useEffect(() => {
    loadRoles();
  }, []);

  // Load permissions when a role is selected
  useEffect(() => {
    if (selectedRoleId) {
      loadRolePermissions(selectedRoleId);
    }
  }, [selectedRoleId]);

  const loadRoles = async () => {
    try {
      const data = await api.get<Role[] | { roles: Role[] }>("/api/v1/permissions/roles");
      const rolesArray = Array.isArray(data) ? data : (data?.roles || []);
      setRoles(rolesArray);
      // Auto-select first role if none selected
      if (!selectedRoleId && rolesArray.length > 0) {
        setSelectedRoleId(rolesArray[0].id);
      }
    } catch (error) {
      console.error("Failed to load roles:", error);
      toast({ title: "Error", description: "Failed to load roles", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const loadRolePermissions = async (roleId: number) => {
    setLoadingPerms(true);
    try {
      const [sectionsRes, rolePermsRes] = await Promise.all([
        sections.length === 0
          ? api.get<{ success: boolean; sections: PermissionSectionData[] }>("/api/v1/permissions/sections")
          : Promise.resolve(null),
        api.get<{
          success: boolean;
          role: RoleDetail;
          permissions: Record<string, number>;
        }>(`/api/v1/permissions/roles/${roleId}/section_permissions`),
      ]);

      if (sectionsRes?.sections) {
        setSections(sectionsRes.sections);
      }

      if (rolePermsRes?.role) {
        setRoleDetail(rolePermsRes.role);
        setGodViewAccess(rolePermsRes.role.godViewAccess);
        setCanApprovePayments(rolePermsRes.role.canApprovePayments);
        setCanViewConfidentialFields(rolePermsRes.role.canViewConfidentialFields);
        setOriginalSpecialFlags({
          godViewAccess: rolePermsRes.role.godViewAccess,
          canApprovePayments: rolePermsRes.role.canApprovePayments,
          canViewConfidentialFields: rolePermsRes.role.canViewConfidentialFields,
        });
      }

      const perms = rolePermsRes?.permissions || {};
      setPermissions(perms);
      setOriginalPermissions(perms);
    } catch (err) {
      console.error("Failed to load role permissions:", err);
      toast({ title: "Error", description: "Failed to load role permissions", variant: "destructive" });
    } finally {
      setLoadingPerms(false);
    }
  };

  // Group sections for display
  const groupedSections = React.useMemo((): PermissionSectionGroup[] => {
    const groups: Record<string, PermissionSectionGroup> = {};
    for (const s of sections) {
      if (!groups[s.section]) {
        groups[s.section] = { header: s, subFeatures: [] };
      }
      if (s.isSectionHeader) {
        groups[s.section].header = s;
      } else {
        groups[s.section].subFeatures.push(s);
      }
    }
    return Object.values(groups);
  }, [sections]);

  // Check for unsaved changes
  const hasChanges = React.useMemo(() => {
    const permsChanged = JSON.stringify(permissions) !== JSON.stringify(originalPermissions);
    const flagsChanged =
      godViewAccess !== originalSpecialFlags.godViewAccess ||
      canApprovePayments !== originalSpecialFlags.canApprovePayments ||
      canViewConfidentialFields !== originalSpecialFlags.canViewConfidentialFields;
    return permsChanged || flagsChanged;
  }, [permissions, originalPermissions, godViewAccess, canApprovePayments, canViewConfidentialFields, originalSpecialFlags]);

  const handlePermissionChange = React.useCallback(
    (key: string, level: PermissionLevel) => {
      setPermissions((prev) => ({ ...prev, [key]: level }));
    },
    []
  );

  // Save permissions
  const handleSavePermissions = async () => {
    if (!roleDetail) return;
    setSavingPerms(true);
    try {
      await api.put(`/api/v1/permissions/roles/${roleDetail.id}/section_permissions`, {
        permissions,
        godViewAccess,
        canApprovePayments,
        canViewConfidentialFields,
      });
      setOriginalPermissions({ ...permissions });
      setOriginalSpecialFlags({ godViewAccess, canApprovePayments, canViewConfidentialFields });
      toast({ title: "Saved", description: "Permissions updated successfully" });
    } catch (err) {
      console.error("Failed to save permissions:", err);
      toast({ title: "Error", description: "Failed to save permissions", variant: "destructive" });
    } finally {
      setSavingPerms(false);
    }
  };

  // Copy from another role
  const handleCopyFrom = async (sourceRoleId: string) => {
    if (!roleDetail) return;
    try {
      await api.post(`/api/v1/permissions/roles/${roleDetail.id}/copy_from`, {
        sourceRoleId: Number(sourceRoleId),
      });
      toast({ title: "Copied", description: "Permissions copied. Click Save to confirm." });
      await loadRolePermissions(roleDetail.id);
    } catch (err) {
      console.error("Failed to copy permissions:", err);
      toast({ title: "Error", description: "Failed to copy permissions", variant: "destructive" });
    }
  };

  // Switch role with unsaved changes check
  const handleSelectRole = async (roleId: number) => {
    if (roleId === selectedRoleId) return;
    if (hasChanges) {
      const proceed = await confirm("You have unsaved changes. Discard and switch roles?");
      if (!proceed) return;
    }
    setSelectedRoleId(roleId);
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
        const filtered = (allUsers?.users || []).filter(u => u.role === role.name);
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
        if (selectedRoleId === role.id) {
          setSelectedRoleId(null);
          setRoleDetail(null);
        }
        loadRoles();
      }
    } catch (error: any) {
      console.error("Failed to delete role:", error);
      const errorMessage = error?.response?.data?.error || "Failed to delete role";
      toast({ title: "Error", description: errorMessage, variant: "destructive" });
    }
  };

  // Other roles for copy-from dropdown (exclude current)
  const copyFromRoles = roles.filter((r) => r.id !== selectedRoleId);

  if (loading) {
    return <LoadingOverlay />;
  }

  return (
    <div className="space-y-4">
      {/* Role selector bar */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-1.5 flex-wrap flex-1">
          {roles.map((role) => (
            <button
              key={role.id}
              onClick={() => handleSelectRole(role.id)}
              className={`
                relative group flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-all
                ${selectedRoleId === role.id
                  ? "border-primary bg-primary/5 dark:bg-primary/10 text-primary font-medium shadow-sm"
                  : "border-border bg-card hover:border-primary/40 hover:bg-muted/50 text-foreground"
                }
              `}
            >
              <span>{role.display_name || role.name}</span>
              <Badge variant="secondary" className="text-xs px-1.5 py-0">
                {role.users_count || 0}
              </Badge>
              {/* Context menu trigger */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                  <span className="opacity-0 group-hover:opacity-100 transition-opacity ml-0.5 cursor-pointer">
                    <MoreHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
                  </span>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleEditRole(role); }}>
                    <Pencil className="h-4 w-4 mr-2" />
                    Edit Role
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
            </button>
          ))}
        </div>
        <Button variant="outline" size="sm" onClick={() => setShowAddDialog(true)}>
          <Plus className="h-4 w-4 mr-1.5" />
          Add Role
        </Button>
      </div>

      {/* Inline permission matrix for selected role */}
      {selectedRoleId && (
        <>
          {loadingPerms ? (
            <div className="flex items-center justify-center py-12">
              <Spinner size={24} />
            </div>
          ) : roleDetail ? (
            <div className="space-y-4">
              {/* Toolbar: Copy from + Save */}
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <Copy className="h-4 w-4 text-muted-foreground" />
                  <Label className="text-sm whitespace-nowrap">Copy from:</Label>
                  <Select onValueChange={handleCopyFrom}>
                    <SelectTrigger className="w-[200px] h-9">
                      <SelectValue placeholder="Select a role..." />
                    </SelectTrigger>
                    <SelectContent>
                      {copyFromRoles.map((r) => (
                        <SelectItem key={r.id} value={String(r.id)}>
                          {r.display_name || r.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  onClick={handleSavePermissions}
                  disabled={!hasChanges || savingPerms}
                  size="sm"
                  className={hasChanges ? "" : "opacity-50"}
                >
                  {savingPerms ? (
                    <Spinner className="h-4 w-4 mr-1.5" />
                  ) : (
                    <Save className="h-4 w-4 mr-1.5" />
                  )}
                  Save
                  {hasChanges && (
                    <span className="ml-1.5 w-2 h-2 rounded-full bg-orange-400 animate-pulse" />
                  )}
                </Button>
              </div>

              {/* Special Permissions */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Special Permissions</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4 sm:grid-cols-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <Label className="text-sm font-medium">God View</Label>
                      <p className="text-xs text-muted-foreground">See all records</p>
                    </div>
                    <Switch checked={godViewAccess} onCheckedChange={setGodViewAccess} />
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <Label className="text-sm font-medium">Approve Payments</Label>
                      <p className="text-xs text-muted-foreground">Approve invoices</p>
                    </div>
                    <Switch checked={canApprovePayments} onCheckedChange={setCanApprovePayments} />
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <Label className="text-sm font-medium">Confidential Fields</Label>
                      <p className="text-xs text-muted-foreground">TFN, bank details</p>
                    </div>
                    <Switch checked={canViewConfidentialFields} onCheckedChange={setCanViewConfidentialFields} />
                  </div>
                </CardContent>
              </Card>

              {/* Permission Matrix */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Permission Matrix</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b dark:border-border bg-muted/50 dark:bg-muted/20">
                          <th className="text-left py-2.5 px-3 text-sm font-medium text-muted-foreground w-[240px]">
                            Feature
                          </th>
                          {ALL_LEVELS.map((lvl) => (
                            <th
                              key={lvl}
                              className="py-2.5 px-2 text-center text-xs font-medium text-muted-foreground w-[90px]"
                            >
                              {PERMISSION_LEVEL_LABELS[lvl]}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {groupedSections.map((group) => (
                          <InlineSectionGroup
                            key={group.header.key}
                            group={group}
                            permissions={permissions}
                            onChange={handlePermissionChange}
                          />
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : null}
        </>
      )}

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

            {/* Role Settings Section */}
            <div className="pt-4 border-t">
              <h4 className="font-medium text-sm mb-3">Default Settings</h4>
              <p className="text-xs text-muted-foreground mb-4">
                These settings apply to users with this role as their primary role.
              </p>
              <div className="space-y-4">
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
