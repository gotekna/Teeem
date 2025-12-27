"use client";

import { useState, useEffect } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import MultipleSelector, { type Option } from "@/components/ui/multiple-selector";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";
import { User, Mail, Phone, Shield, Calendar, Clock } from "lucide-react";
import { format } from "date-fns";

interface Role {
  id: number;
  name: string;
  display_name: string;
}

interface UserData {
  id: number;
  name: string;
  email: string;
  role: string;
  role_ids?: Array<{ id: number; display_value: string; name: string }>;
  mobile_phone?: string;
  last_login_at?: string;
  created_at?: string;
  status?: string;
  presence_status?: string;
  integrations?: string[];
  [key: string]: unknown;
}

interface UserDetailSheetProps {
  user: UserData | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
}

export function UserDetailSheet({ user, isOpen, onClose, onSave }: UserDetailSheetProps) {
  const [editData, setEditData] = useState<Partial<UserData>>({});
  const [roles, setRoles] = useState<Role[]>([]);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  // Load available roles
  useEffect(() => {
    const loadRoles = async () => {
      try {
        const response = await api.get<{ records: Role[] }>("/api/v1/foundations/413/records");
        if (response?.records) {
          setRoles(response.records);
        }
      } catch (err) {
        console.error("Failed to load roles:", err);
      }
    };
    if (isOpen) {
      loadRoles();
    }
  }, [isOpen]);

  // Initialize edit data when user changes
  useEffect(() => {
    if (user) {
      setEditData({
        name: user.name,
        email: user.email,
        mobile_phone: user.mobile_phone || "",
        // SSoT: Always ensure role_ids is an array to prevent .map errors
        role_ids: Array.isArray(user.role_ids) ? user.role_ids : [],
      });
    }
  }, [user]);

  const handleSave = async () => {
    if (!user) return;

    setSaving(true);
    try {
      // Extract role IDs from the selected options
      // SSoT: Always ensure role_ids is an array before calling .map
      const roleIdsData = Array.isArray(editData.role_ids) ? editData.role_ids : [];
      const roleIds = roleIdsData.map((r: { id: number }) => r.id);

      const response = await api.patch<{ success: boolean }>(
        `/api/v1/users/${user.id}`,
        {
          user: {
            name: editData.name,
            email: editData.email,
            mobile_phone: editData.mobile_phone,
            role_ids: roleIds,
          },
        }
      );

      if (response?.success) {
        toast({
          title: "Success",
          description: "User updated successfully",
        });
        onSave();
        onClose();
      }
    } catch (error) {
      console.error("Update error:", error);
      toast({
        title: "Error",
        description: "Failed to update user",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  // Convert roles to MultipleSelector options
  const roleOptions: Option[] = roles.map((r) => ({
    value: String(r.id),
    label: r.display_name || r.name,
  }));

  // Get selected role options
  // SSoT: Always ensure role_ids is an array before calling .map
  const roleIdsArray = Array.isArray(editData.role_ids) ? editData.role_ids : [];
  const selectedRoleIds = roleIdsArray.map((r: { id: number }) => String(r.id));
  const selectedOptions = roleOptions.filter((opt) => selectedRoleIds.includes(opt.value));

  if (!user) return null;

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-[500px] sm:max-w-[500px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            User Details
          </SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Status badges */}
          <div className="flex gap-2 flex-wrap">
            {user.presence_status === "online" && (
              <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                Online
              </Badge>
            )}
            {user.status === "active" && user.presence_status !== "online" && (
              <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
                Active
              </Badge>
            )}
            {user.status === "pending" && (
              <Badge variant="secondary">Pending</Badge>
            )}
            {user.integrations?.includes("microsoft") && (
              <Badge variant="outline">MS Connected</Badge>
            )}
            {user.integrations?.includes("outlook") && (
              <Badge variant="outline">Email Sync</Badge>
            )}
          </div>

          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="name" className="flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              Name
            </Label>
            <Input
              id="name"
              value={editData.name || ""}
              onChange={(e) => setEditData({ ...editData, name: e.target.value })}
            />
          </div>

          {/* Email */}
          <div className="space-y-2">
            <Label htmlFor="email" className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-muted-foreground" />
              Email
            </Label>
            <Input
              id="email"
              type="email"
              value={editData.email || ""}
              onChange={(e) => setEditData({ ...editData, email: e.target.value })}
            />
          </div>

          {/* Mobile */}
          <div className="space-y-2">
            <Label htmlFor="mobile" className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-muted-foreground" />
              Mobile
            </Label>
            <Input
              id="mobile"
              type="tel"
              value={editData.mobile_phone || ""}
              onChange={(e) => setEditData({ ...editData, mobile_phone: e.target.value })}
              placeholder="04XX XXX XXX"
            />
          </div>

          {/* Roles - Multi-select */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-muted-foreground" />
              Roles
            </Label>
            <MultipleSelector
              value={selectedOptions}
              onChange={(selected) => {
                // Convert selected options back to role objects
                const newRoleIds = selected.map((opt) => {
                  const role = roles.find((r) => String(r.id) === opt.value);
                  return role ? { id: role.id, display_value: role.display_name, name: role.name } : null;
                }).filter(Boolean);
                setEditData({ ...editData, role_ids: newRoleIds as Array<{ id: number; display_value: string; name: string }> });
              }}
              options={roleOptions}
              placeholder="Select roles..."
              emptyIndicator={
                <p className="text-center text-sm text-muted-foreground py-2">
                  No roles available
                </p>
              }
            />
            <p className="text-xs text-muted-foreground">
              Users can have multiple roles. Roles determine permissions and access levels.
            </p>
          </div>

          {/* Read-only info */}
          <div className="pt-4 border-t space-y-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="h-4 w-4" />
              <span>Created: {user.created_at ? format(new Date(user.created_at), "d MMM yyyy") : "Unknown"}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span>Last login: {user.last_login_at ? format(new Date(user.last_login_at), "d MMM yyyy 'at' h:mm a") : "Never"}</span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-4">
            <Button onClick={handleSave} disabled={saving} className="flex-1">
              {saving ? "Saving..." : "Save Changes"}
            </Button>
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
