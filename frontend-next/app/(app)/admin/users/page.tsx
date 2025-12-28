"use client";

import { useState, useEffect } from "react";
import { UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import TeeemTableView from "@/components/table/TeeemTableView";
import { AddUserModal } from "@/components/admin/AddUserModal";
import { UserDetailSheet } from "@/components/admin/UserDetailSheet";
import { api } from "@/lib/api";
import { TablePage } from "@/components/ui/page-wrappers";

// SSoT: Columns are now fetched from Foundation API (ID: 212)
// Removed hardcoded USER_COLUMNS - 2024-12-27
import { TableRow } from "@/components/table/types";

interface User {
  id: number;
  name: string;
  email: string;
  role: string;
  assigned_role?: string;
  last_login_at?: string;
  role_ids?: Array<{ id: number; display_value: string; name: string }>;
  [key: string]: unknown;
}

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showDetailSheet, setShowDetailSheet] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const response = await api.get<{ users: User[] }>("/api/v1/users");
      setUsers(response?.users || []);
      setError(null);
    } catch (err) {
      console.error("Failed to load users:", err);
      setError("Failed to load users");
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = async (row: TableRow) => {
    const user = row as User;
    try {
      const response = await api.patch<{ success: boolean }>(
        `/api/v1/users/${user.id}`,
        {
          user: {
            name: user.name,
            email: user.email,
            role: user.role,
            assigned_role: user.assigned_role || "",
          },
        }
      );

      if (response?.success) {
        toast({
          title: "Success",
          description: "User updated successfully",
        });
        loadUsers();
      }
    } catch (error: unknown) {
      console.error("Update error:", error);
      toast({
        title: "Error",
        description: "Failed to update user",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (row: TableRow) => {
    const user = row as User;
    if (
      !confirm(
        `Are you sure you want to remove ${user.name}? This action cannot be undone.`
      )
    ) {
      return;
    }

    try {
      const response = await api.delete<{ success: boolean }>(
        `/api/v1/users/${user.id}`
      );
      if (response?.success) {
        toast({
          title: "Success",
          description: "User removed successfully",
        });
        loadUsers();
      }
    } catch (err) {
      console.error("Failed to remove user:", err);
      toast({
        title: "Error",
        description: "Failed to remove user",
        variant: "destructive",
      });
    }
  };

  const handleBulkDelete = async (ids: (number | string)[]) => {
    if (
      !confirm(
        `Are you sure you want to remove ${ids.length} user(s)? This action cannot be undone.`
      )
    ) {
      return;
    }

    try {
      await api.post("/api/v1/users/bulk_delete", { ids });
      toast({
        title: "Success",
        description: `${ids.length} user(s) removed successfully`,
      });
      loadUsers();
    } catch (err) {
      console.error("Failed to remove users:", err);
      toast({
        title: "Error",
        description: "Failed to remove some users",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-muted-foreground">Loading users...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <div className="text-destructive">{error}</div>
      </div>
    );
  }

  const handleRowDoubleClick = (row: TableRow) => {
    const user = row as User;
    setSelectedUser(user);
    setShowDetailSheet(true);
  };

  return (
    <TablePage>
      <TeeemTableView
        category="users"
        foundationId="user-management"
        tableName="Users"
        entries={users}
        // columns prop removed - TeeemTableView auto-fetches from Foundation API (SSoT)
        onEdit={handleEdit}
        onDelete={handleDelete}
        onBulkDelete={handleBulkDelete}
        onRowDoubleClick={handleRowDoubleClick}
        leftActions={
          <Button onClick={() => setShowAddModal(true)}>
            <UserPlus className="h-4 w-4 mr-2" />
            Add User
          </Button>
        }
        hideFooter={true}
      />

      {/* Add User Modal */}
      <AddUserModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onUserAdded={() => {
          setShowAddModal(false);
          loadUsers();
          toast({
            title: "Success",
            description: "User added successfully",
          });
        }}
      />

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
    </TablePage>
  );
}
