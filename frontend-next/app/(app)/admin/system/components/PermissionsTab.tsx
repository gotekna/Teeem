"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, Shield, User } from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/use-toast";
import { Spinner } from "@/components/ui/spinner";

interface UserType {
  id: number;
  name: string;
  email: string;
  role: string;
}

interface Permission {
  id: number;
  name: string;
  description: string;
  category: string;
}

interface PermissionCategory {
  [category: string]: Permission[];
}

export function PermissionsTab() {
  const { toast } = useToast();
  const [users, setUsers] = React.useState<UserType[]>([]);
  const [permissions, setPermissions] = React.useState<PermissionCategory>({});
  const [selectedUser, setSelectedUser] = React.useState<UserType | null>(null);
  const [userPermissions, setUserPermissions] = React.useState<string[]>([]);
  const [rolePermissions, setRolePermissions] = React.useState<string[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [loadingPermissions, setLoadingPermissions] = React.useState(false);
  const [searchTerm, setSearchTerm] = React.useState("");
  const [toggling, setToggling] = React.useState<string | null>(null);

  React.useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    try {
      const [usersData, permissionsData] = await Promise.all([
        api.get<{ users: UserType[] }>("/api/v1/users"),
        api.get<PermissionCategory>("/api/v1/permissions"),
      ]);
      setUsers(usersData?.users || []);
      setPermissions(permissionsData);
    } catch (error) {
      console.error("Failed to load data:", error);
      // Mock data for development
      setUsers([
        { id: 1, name: "John Doe", email: "john@example.com", role: "admin" },
        { id: 2, name: "Jane Smith", email: "jane@example.com", role: "user" },
      ]);
      setPermissions({
        "Jobs": [
          { id: 1, name: "jobs.view", description: "View jobs", category: "Jobs" },
          { id: 2, name: "jobs.create", description: "Create jobs", category: "Jobs" },
          { id: 3, name: "jobs.edit", description: "Edit jobs", category: "Jobs" },
          { id: 4, name: "jobs.delete", description: "Delete jobs", category: "Jobs" },
        ],
        "Schedule": [
          { id: 5, name: "schedule.view", description: "View schedule", category: "Schedule" },
          { id: 6, name: "schedule.edit", description: "Edit schedule", category: "Schedule" },
        ],
        "Contacts": [
          { id: 7, name: "contacts.view", description: "View contacts", category: "Contacts" },
          { id: 8, name: "contacts.create", description: "Create contacts", category: "Contacts" },
        ],
      });
    } finally {
      setLoading(false);
    }
  };

  const loadUserPermissions = async (user: UserType) => {
    setSelectedUser(user);
    setLoadingPermissions(true);
    try {
      const data = await api.get<{ user_permissions: string[]; role_permissions: string[] }>(
        `/api/v1/permissions/user/${user.id}`
      );
      setUserPermissions(data.user_permissions || []);
      setRolePermissions(data.role_permissions || []);
    } catch (error) {
      console.error("Failed to load user permissions:", error);
      // Mock data
      setUserPermissions(["jobs.view", "contacts.view"]);
      setRolePermissions(["jobs.view", "schedule.view"]);
    } finally {
      setLoadingPermissions(false);
    }
  };

  const togglePermission = async (permissionName: string) => {
    if (!selectedUser) return;
    setToggling(permissionName);
    try {
      await api.post("/api/v1/permissions/grant", {
        user_id: selectedUser.id,
        permission: permissionName,
      });

      // Toggle permission in local state
      if (userPermissions.includes(permissionName)) {
        setUserPermissions(userPermissions.filter((p) => p !== permissionName));
      } else {
        setUserPermissions([...userPermissions, permissionName]);
      }

      toast({ title: "Success", description: "Permission updated" });
    } catch (error) {
      console.error("Failed to toggle permission:", error);
      toast({ title: "Error", description: "Failed to update permission", variant: "destructive" });
    } finally {
      setToggling(null);
    }
  };

  const getPermissionStatus = (permissionName: string) => {
    const hasRolePermission = rolePermissions.includes(permissionName);
    const hasUserPermission = userPermissions.includes(permissionName);

    if (hasRolePermission && hasUserPermission) return "both";
    if (hasRolePermission) return "role";
    if (hasUserPermission) return "user";
    return "none";
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
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* User List */}
      <Card className="lg:col-span-1">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Users</CardTitle>
          <div className="relative mt-2">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search users..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8"
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-[500px]">
            <div className="space-y-1 p-2">
              {filteredUsers.map((user) => (
                <button
                  key={user.id}
                  onClick={() => loadUserPermissions(user)}
                  className={cn(
                    "w-full flex items-center gap-3 p-3 rounded-md text-left transition-colors",
                    selectedUser?.id === user.id
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-muted"
                  )}
                >
                  <div
                    className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium",
                      selectedUser?.id === user.id
                        ? "bg-primary-foreground text-primary"
                        : "bg-muted"
                    )}
                  >
                    {user.name?.charAt(0).toUpperCase() || "U"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{user.name}</p>
                    <p
                      className={cn(
                        "text-xs truncate",
                        selectedUser?.id === user.id
                          ? "text-primary-foreground/70"
                          : "text-muted-foreground"
                      )}
                    >
                      {user.email}
                    </p>
                  </div>
                  <Badge
                    variant={selectedUser?.id === user.id ? "secondary" : "outline"}
                    className="text-xs"
                  >
                    {user.role || "User"}
                  </Badge>
                </button>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Permissions Grid */}
      <Card className="lg:col-span-2">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">
              {selectedUser ? `Permissions for ${selectedUser.name}` : "Select a user"}
            </CardTitle>
            {selectedUser && (
              <div className="flex items-center gap-4 text-xs">
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded bg-green-500" />
                  <span>From Role</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded bg-blue-500" />
                  <span>User Override</span>
                </div>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {!selectedUser ? (
            <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
              <User className="h-12 w-12 mb-4 opacity-50" />
              <p>Select a user from the list to manage their permissions</p>
            </div>
          ) : loadingPermissions ? (
            <div className="flex items-center justify-center h-64">
              <Spinner size={32} className="text-muted-foreground" />
            </div>
          ) : (
            <ScrollArea className="h-[500px]">
              <div className="space-y-6">
                {Object.entries(permissions).map(([category, perms]) => (
                  <div key={category}>
                    <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                      <Shield className="h-4 w-4" />
                      {category}
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {perms.map((permission) => {
                        const status = getPermissionStatus(permission.name);
                        const isChecked = status !== "none";
                        const isFromRole = status === "role" || status === "both";
                        const isUserOverride = status === "user" || status === "both";

                        return (
                          <div
                            key={permission.id}
                            className={cn(
                              "flex items-center gap-3 p-3 rounded-md border",
                              isFromRole && "border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950",
                              isUserOverride && !isFromRole && "border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950",
                              !isChecked && "border-border"
                            )}
                          >
                            <Checkbox
                              id={permission.name}
                              checked={isChecked}
                              disabled={toggling === permission.name}
                              onCheckedChange={() => togglePermission(permission.name)}
                            />
                            <div className="flex-1">
                              <label
                                htmlFor={permission.name}
                                className="text-sm font-medium cursor-pointer"
                              >
                                {permission.description}
                              </label>
                              <p className="text-xs text-muted-foreground">
                                {permission.name}
                              </p>
                            </div>
                            {isFromRole && (
                              <Badge variant="outline" className="text-green-600 border-green-600">
                                Role
                              </Badge>
                            )}
                            {isUserOverride && !isFromRole && (
                              <Badge variant="outline" className="text-blue-600 border-blue-600">
                                Override
                              </Badge>
                            )}
                            {toggling === permission.name && (
                              <Spinner size={16} />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
