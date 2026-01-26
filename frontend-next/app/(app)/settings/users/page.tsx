"use client";

import { useState, useCallback } from "react";
import { useToast } from "@/components/ui/use-toast";
import TeeemTableView from "@/components/table/TeeemTableView";
import { TablePage } from "@/components/ui/page-wrappers";
import { AddUserModal } from "@/components/admin/AddUserModal";
import { UserDetailSheet } from "@/components/admin/UserDetailSheet";
import { api } from "@/lib/api";
import { TableRow } from "@/components/table/types";

/**
 * Users Management Page - Organization Settings
 *
 * SSoT: This is THE ONE location for user management.
 * Part of the Settings/Admin merge - Organization section.
 * Admin role required (enforced by layout).
 *
 * Uses autoFetchRecords for:
 * - SSR hydration (faster initial load)
 * - Built-in caching (instant back navigation)
 * - Server-side search
 */

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

export default function UsersSettingsPage() {
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showDetailSheet, setShowDetailSheet] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const { toast } = useToast();

  // Trigger table refresh after mutations
  const triggerRefresh = useCallback(() => {
    setRefreshKey(k => k + 1);
  }, []);

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
        triggerRefresh();
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
      triggerRefresh();
    } catch (err) {
      console.error("Failed to remove users:", err);
      toast({
        title: "Error",
        description: "Failed to remove some users",
        variant: "destructive",
      });
    }
  };

  const handleRowDoubleClick = (row: TableRow) => {
    const user = row as User;
    setSelectedUser(user);
    setShowDetailSheet(true);
  };

  return (
    <TablePage>
      <TeeemTableView
        key={refreshKey}
        foundationId="user-management"
        autoFetchRecords
        onDelete={handleDelete}
        onBulkDelete={handleBulkDelete}
        onRowDoubleClick={handleRowDoubleClick}
        onRefresh={triggerRefresh}
        onAddRow={() => setShowAddModal(true)}  // SSoT: Override built-in Add to use custom AddUserModal
      />

      <AddUserModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onUserAdded={() => {
          setShowAddModal(false);
          triggerRefresh();
          toast({
            title: "Success",
            description: "User added successfully",
          });
        }}
      />

      <UserDetailSheet
        user={selectedUser}
        isOpen={showDetailSheet}
        onClose={() => {
          setShowDetailSheet(false);
          setSelectedUser(null);
        }}
        onSave={triggerRefresh}
      />
    </TablePage>
  );
}
