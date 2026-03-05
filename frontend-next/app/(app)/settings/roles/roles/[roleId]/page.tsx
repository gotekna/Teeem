"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BackButton } from "@/components/ui/back-button";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Save, ChevronDown, ChevronRight, Copy } from "lucide-react";
import {
  ALL_LEVELS,
  PERMISSION_LEVEL_LABELS,
  type PermissionLevel,
  type PermissionSectionData,
  type PermissionSectionGroup,
} from "@/lib/constants/permission-levels";

// ============================================
// Types
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

interface RoleListItem {
  id: number;
  name: string;
  display_name?: string;
}

// ============================================
// Permission Matrix Row Component
// ============================================

function PermissionRow({
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

// ============================================
// Permission Section Group Component
// ============================================

function SectionGroup({
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
          <PermissionRow
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
// Main Page Component
// ============================================

export default function RoleDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const roleId = params.roleId as string;

  // State
  const [role, setRole] = useState<RoleDetail | null>(null);
  const [sections, setSections] = useState<PermissionSectionData[]>([]);
  const [permissions, setPermissions] = useState<Record<string, number>>({});
  const [originalPermissions, setOriginalPermissions] = useState<Record<string, number>>({});
  const [originalSpecialFlags, setOriginalSpecialFlags] = useState({
    godViewAccess: false,
    canApprovePayments: false,
    canViewConfidentialFields: false,
  });
  const [allRoles, setAllRoles] = useState<RoleListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Special permission flags (edited locally)
  const [godViewAccess, setGodViewAccess] = useState(false);
  const [canApprovePayments, setCanApprovePayments] = useState(false);
  const [canViewConfidentialFields, setCanViewConfidentialFields] = useState(false);

  // Load data
  useEffect(() => {
    if (!roleId) return;
    loadData();
  }, [roleId]);

  const loadData = async () => {
    try {
      setLoading(true);

      const [sectionsRes, rolePermsRes, rolesRes] = await Promise.all([
        api.get<{ success: boolean; sections: PermissionSectionData[] }>(
          "/api/v1/permissions/sections"
        ),
        api.get<{
          success: boolean;
          role: RoleDetail;
          permissions: Record<string, number>;
        }>(`/api/v1/permissions/roles/${roleId}/section_permissions`),
        api.get<{ success: boolean; roles: RoleListItem[] }>(
          "/api/v1/permissions/roles"
        ),
      ]);

      setSections(sectionsRes?.sections || []);

      if (rolePermsRes?.role) {
        setRole(rolePermsRes.role);
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

      // Filter out current role from the copy-from list
      const rolesList = Array.isArray(rolesRes) ? rolesRes : (rolesRes?.roles || []);
      setAllRoles(rolesList.filter((r) => r.id !== Number(roleId)));
    } catch (err) {
      console.error("Failed to load role permissions:", err);
      toast({
        title: "Error",
        description: "Failed to load role permissions",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Group sections for display
  const groupedSections = useMemo((): PermissionSectionGroup[] => {
    const groups: Record<string, PermissionSectionGroup> = {};

    for (const s of sections) {
      if (!groups[s.section]) {
        groups[s.section] = {
          header: s,
          subFeatures: [],
        };
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
  const hasChanges = useMemo(() => {
    const permsChanged =
      JSON.stringify(permissions) !== JSON.stringify(originalPermissions);
    const flagsChanged =
      godViewAccess !== originalSpecialFlags.godViewAccess ||
      canApprovePayments !== originalSpecialFlags.canApprovePayments ||
      canViewConfidentialFields !== originalSpecialFlags.canViewConfidentialFields;
    return permsChanged || flagsChanged;
  }, [
    permissions,
    originalPermissions,
    godViewAccess,
    canApprovePayments,
    canViewConfidentialFields,
    originalSpecialFlags,
  ]);

  // Handle permission change
  const handlePermissionChange = useCallback(
    (key: string, level: PermissionLevel) => {
      setPermissions((prev) => ({ ...prev, [key]: level }));
    },
    []
  );

  // Save permissions
  const handleSave = async () => {
    if (!role) return;
    setSaving(true);

    try {
      await api.put(`/api/v1/permissions/roles/${role.id}/section_permissions`, {
        permissions,
        godViewAccess,
        canApprovePayments,
        canViewConfidentialFields,
      });

      setOriginalPermissions({ ...permissions });
      setOriginalSpecialFlags({
        godViewAccess,
        canApprovePayments,
        canViewConfidentialFields,
      });

      toast({ title: "Saved", description: "Permissions updated successfully" });
    } catch (err) {
      console.error("Failed to save permissions:", err);
      toast({
        title: "Error",
        description: "Failed to save permissions",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  // Copy from another role
  const handleCopyFrom = async (sourceRoleId: string) => {
    if (!role) return;

    try {
      await api.post(`/api/v1/permissions/roles/${role.id}/copy_from`, {
        sourceRoleId: Number(sourceRoleId),
      });

      toast({
        title: "Copied",
        description: "Permissions copied. Click Save to confirm.",
      });

      // Reload to get the copied permissions
      await loadData();
    } catch (err) {
      console.error("Failed to copy permissions:", err);
      toast({
        title: "Error",
        description: "Failed to copy permissions",
        variant: "destructive",
      });
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner />
      </div>
    );
  }

  if (!role) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">Role not found</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b dark:border-border">
        <div className="flex items-center gap-4">
          <BackButton fallbackHref="/settings/roles/roles" />
          <div>
            <h1 className="text-xl font-semibold">
              {role.displayName}
            </h1>
            <p className="text-sm text-muted-foreground">
              {role.description || "No description"}
            </p>
          </div>
          {role.name === "admin" && (
            <Badge variant="default">System Role</Badge>
          )}
        </div>
        <Button
          onClick={handleSave}
          disabled={!hasChanges || saving}
          className={hasChanges ? "" : "opacity-50"}
        >
          {saving ? (
            <Spinner className="h-4 w-4 mr-2" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          Save
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
        {/* Copy From Role */}
        <div className="flex items-center gap-3">
          <Copy className="h-4 w-4 text-muted-foreground" />
          <Label className="text-sm">Copy permissions from:</Label>
          <Select onValueChange={handleCopyFrom}>
            <SelectTrigger className="w-[220px]">
              <SelectValue placeholder="Select a role..." />
            </SelectTrigger>
            <SelectContent>
              {allRoles.map((r) => (
                <SelectItem key={r.id} value={String(r.id)}>
                  {r.display_name || r.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Special Permissions */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Special Permissions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm font-medium">God View Access</Label>
                <p className="text-xs text-muted-foreground">
                  See all records across the organization
                </p>
              </div>
              <Switch
                checked={godViewAccess}
                onCheckedChange={setGodViewAccess}
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm font-medium">
                  Can Approve Payments
                </Label>
                <p className="text-xs text-muted-foreground">
                  Approve payment requests and invoices
                </p>
              </div>
              <Switch
                checked={canApprovePayments}
                onCheckedChange={setCanApprovePayments}
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm font-medium">
                  View Confidential Fields
                </Label>
                <p className="text-xs text-muted-foreground">
                  Access TFN, bank details, passport numbers
                </p>
              </div>
              <Switch
                checked={canViewConfidentialFields}
                onCheckedChange={setCanViewConfidentialFields}
              />
            </div>
          </CardContent>
        </Card>

        {/* Permission Matrix */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Permission Matrix</CardTitle>
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
                    <SectionGroup
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
    </div>
  );
}
