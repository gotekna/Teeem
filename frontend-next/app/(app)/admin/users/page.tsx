"use client";

import { useState, useEffect } from "react";
import { UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import TeeemTableView from "@/components/table/TeeemTableView";
import { AddUserModal } from "@/components/admin/AddUserModal";
import { api } from "@/lib/api";

// Define columns for Users table
import { TableColumn, TableRow } from "@/components/table/types";

const USER_COLUMNS: TableColumn[] = [
  {
    key: "select",
    label: "",
    resizable: false,
    sortable: false,
    filterable: false,
    width: 32,
    tooltip: "Select rows for bulk actions",
  },
  {
    key: "id",
    label: "ID",
    resizable: true,
    sortable: true,
    filterable: true,
    filterType: "text",
    width: 80,
    tooltip: "User ID",
  },
  {
    key: "name",
    label: "Name",
    resizable: true,
    sortable: true,
    filterable: true,
    filterType: "text",
    width: 200,
    tooltip: "User full name",
  },
  {
    key: "email",
    label: "Email",
    resizable: true,
    sortable: true,
    filterable: true,
    filterType: "text",
    width: 250,
    tooltip: "Email address",
  },
  {
    key: "role",
    label: "Role",
    resizable: true,
    sortable: true,
    filterable: true,
    filterType: "dropdown",
    width: 150,
    tooltip: "User role (admin, user, etc.)",
  },
  {
    key: "assigned_role",
    label: "Group",
    resizable: true,
    sortable: true,
    filterable: true,
    filterType: "dropdown",
    width: 150,
    tooltip: "Assigned group/department",
  },
  {
    key: "last_login_at",
    label: "Last Login",
    resizable: true,
    sortable: true,
    filterable: false,
    width: 180,
    tooltip: "Last login timestamp",
  },
];

interface User {
  id: number;
  name: string;
  email: string;
  role: string;
  assigned_role?: string;
  last_login_at?: string;
  [key: string]: unknown;
}

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const response = await api.get<User[]>("/api/v1/users");
      setUsers(Array.isArray(response) ? response : []);
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

  return (
    <div className="flex flex-col h-full -mx-4">
      <TeeemTableView
        category="users"
        foundationId="users"
        foundationIdNumeric={212}
        tableName="Users"
        entries={users}
        // columns prop removed - TeeemTableView auto-fetches from Foundation API (SSoT)
        onEdit={handleEdit}
        onDelete={handleDelete}
        onBulkDelete={handleBulkDelete}
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
    </div>
  );
}
