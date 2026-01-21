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
import { User, Mail, Shield, Calendar, Clock, Sun, Moon, Briefcase, ExternalLink } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { format } from "date-fns";
import Link from "next/link";

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
  job_title?: string;
  contact_id?: number | null;
  contact?: { id: number; display_name?: string; first_name?: string; last_name?: string } | null;
  last_login_at?: string;
  created_at?: string;
  status?: string;
  presence_status?: string;
  integrations?: string[];
  preferred_theme?: string;
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
        const response = await api.get<{ records: Role[] }>("/api/v1/foundations/roles/records");
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
  // Phase 5: User sheet focuses on auth - profile info managed via Contact
  useEffect(() => {
    if (user) {
      setEditData({
        email: user.email,
        job_title: user.job_title || "",
        // SSoT: Always ensure role_ids is an array to prevent .map errors
        role_ids: Array.isArray(user.role_ids) ? user.role_ids : [],
        preferred_theme: user.preferred_theme || "light",
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

      // Phase 5: User sheet only edits auth fields
      // Name/mobile/address managed via Contact (linked automatically)
      const response = await api.patch<{ success: boolean }>(
        `/api/v1/users/${user.id}`,
        {
          user: {
            email: editData.email,
            job_title: editData.job_title,
            role_ids: roleIds,
            preferred_theme: editData.preferred_theme,
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

  // Get Contact display name for header
  const contactDisplayName = user?.contact?.display_name
    || (user?.contact?.first_name && user?.contact?.last_name
      ? `${user.contact.first_name} ${user.contact.last_name}`
      : user?.name) || "Unknown User";

  if (!user) return null;

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-[500px] sm:max-w-[500px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            User Account
          </SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Contact Profile Card - SSoT: Contact is identity, User is auth */}
          <div className="p-4 rounded-lg border bg-muted/30 dark:bg-muted/10">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-lg font-semibold">{contactDisplayName}</p>
                <p className="text-sm text-muted-foreground">Profile managed via Contact</p>
              </div>
              {user.contact_id && (
                <Link href={`/contacts/${user.contact_id}`}>
                  <Button variant="outline" size="sm" className="gap-2">
                    <ExternalLink className="h-4 w-4" />
                    View Profile
                  </Button>
                </Link>
              )}
            </div>
          </div>

          {/* Status badges */}
          <div className="flex gap-2 flex-wrap">
            {user.presence_status === "online" && (
              <Badge className="bg-status-success text-status-success-foreground dark:bg-green-900/30 dark:text-green-400">
                Online
              </Badge>
            )}
            {user.status === "active" && user.presence_status !== "online" && (
              <Badge className="bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 dark:bg-blue-900/30 dark:text-blue-400">
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

          {/* Login Email */}
          <div className="space-y-2">
            <Label htmlFor="email" className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-muted-foreground" />
              Login Email
            </Label>
            <Input
              id="email"
              type="email"
              value={editData.email || ""}
              onChange={(e) => setEditData({ ...editData, email: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">
              Used for login. Changes sync to Contact record.
            </p>
          </div>

          {/* Job Title - kept for email signature */}
          <div className="space-y-2">
            <Label htmlFor="job_title" className="flex items-center gap-2">
              <Briefcase className="h-4 w-4 text-muted-foreground" />
              Job Title
            </Label>
            <Input
              id="job_title"
              value={editData.job_title || ""}
              onChange={(e) => setEditData({ ...editData, job_title: e.target.value })}
              placeholder="e.g. Sales, Project Manager"
            />
            <p className="text-xs text-muted-foreground">
              Used in email signature. Leave blank to hide from signature.
            </p>
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

          {/* Theme Preference */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              {editData.preferred_theme === "dark" ? (
                <Moon className="h-4 w-4 text-muted-foreground" />
              ) : (
                <Sun className="h-4 w-4 text-muted-foreground" />
              )}
              Theme Preference
            </Label>
            <Select
              value={editData.preferred_theme || "light"}
              onValueChange={(value) => setEditData({ ...editData, preferred_theme: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select theme" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="light">
                  <div className="flex items-center gap-2">
                    <Sun className="h-4 w-4" />
                    Light
                  </div>
                </SelectItem>
                <SelectItem value="dark">
                  <div className="flex items-center gap-2">
                    <Moon className="h-4 w-4" />
                    Dark
                  </div>
                </SelectItem>
                <SelectItem value="system">
                  <div className="flex items-center gap-2">
                    <span className="text-sm">💻</span>
                    System
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Theme applied when user logs in.
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
