"use client";

import { useEffect, useState, useCallback } from "react";
import { useUrlState } from "@/hooks/useUrlState";
import { api } from "@/lib/api";
import {
  UserGroupIcon,
  ShieldCheckIcon,
  MagnifyingGlassIcon,
  CheckIcon,
} from "@heroicons/react/24/outline";

/**
 * Roles & Permissions Page - Organization Settings
 *
 * SSoT: This is THE ONE location for managing user permissions.
 * Part of the Settings/Admin merge - Organization section.
 * Admin role required (enforced by layout).
 */

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

export default function RolesSettingsPage() {
  const [urlState, setUrlState] = useUrlState({
    user: null as string | null,
    search: null as string | null,
  });

  const [users, setUsers] = useState<User[]>([]);
  const [permissions, setPermissions] = useState<PermissionsMap>({});
  const [categories, setCategories] = useState<CategoriesMap>({});
  const [, setRoles] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userPermissions, setUserPermissions] = useState<string[]>([]);
  const [rolePermissions, setRolePermissions] = useState<string[]>([]);
  const [updatingPermission, setUpdatingPermission] = useState<string | null>(
    null
  );

  const selectedUser = urlState.user
    ? users.find((u) => u.id === parseInt(urlState.user as string, 10)) || null
    : null;

  const searchQuery = urlState.search || "";

  const setSelectedUser = useCallback(
    (user: User | null) => {
      setUrlState({ user: user ? String(user.id) : null });
    },
    [setUrlState]
  );

  const setSearchQuery = useCallback(
    (query: string) => {
      setUrlState({ search: query || null });
    },
    [setUrlState]
  );

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [usersRes, permissionsRes, rolesRes] = await Promise.all([
        api.get<{ users: User[] }>("/api/v1/users"),
        api.get<{
          success: boolean;
          permissions: PermissionsMap;
          categories: CategoriesMap;
        }>("/api/v1/permissions"),
        api.get<{ success: boolean; roles: string[] }>(
          "/api/v1/permissions/roles"
        ),
      ]);

      setUsers(usersRes?.users || []);

      if (permissionsRes.success) {
        setPermissions(permissionsRes.permissions || {});
        setCategories(permissionsRes.categories || {});
      }

      if (rolesRes.success) {
        setRoles(rolesRes.roles || []);
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
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
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
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-foreground flex items-center gap-3">
          <ShieldCheckIcon className="h-6 w-6 text-primary" />
          User Permissions
        </h2>
        <p className="text-muted-foreground mt-1">
          Manage user permissions and access control
        </p>
      </div>

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
                onClick={() => setSelectedUser(user)}
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
    </div>
  );
}
