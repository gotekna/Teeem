"use client";

import { useState, useEffect } from "react";
import { X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { api } from "@/lib/api";
import { useAssignableRoles } from "@/hooks/useAssignableRoles";

interface AddUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUserAdded: () => void;
}

interface FormData {
  name: string;
  email: string;
  password: string;
  password_confirmation: string;
  role: string;
  assigned_role: string;
}

export function AddUserModal({ isOpen, onClose, onUserAdded }: AddUserModalProps) {
  // SSoT: Fetch assignable roles from backend (rolesWithNone includes "None" option)
  const { rolesWithNone: assignableRoles } = useAssignableRoles();
  const [formData, setFormData] = useState<FormData>({
    name: "",
    email: "",
    password: "",
    password_confirmation: "",
    role: "user",
    assigned_role: "",
  });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [roles, setRoles] = useState<Array<{ value: string; label: string }>>([]);

  useEffect(() => {
    const fetchRoles = async () => {
      try {
        const response = await api.get<{ data: Array<{ value: string; label: string }> }>("/api/v1/roles");
        setRoles(response.data || []);
      } catch (error) {
        console.error("Failed to fetch roles:", error);
        setRoles([
          { value: "user", label: "User" },
          { value: "admin", label: "Admin" },
        ]);
      }
    };
    fetchRoles();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrors([]);

    if (formData.password !== formData.password_confirmation) {
      setErrors(["Passwords do not match"]);
      setLoading(false);
      return;
    }

    try {
      const response = await api.post<{ success: boolean; user: { id: number }; errors?: string[] }>(
        "/api/v1/auth/signup",
        {
          user: {
            name: formData.name,
            email: formData.email,
            password: formData.password,
            password_confirmation: formData.password_confirmation,
          },
        }
      );

      if (response?.success) {
        // If role or assigned_role is different from default, update them
        if (formData.role !== "user" || formData.assigned_role) {
          await api.patch(`/api/v1/users/${response?.user?.id}`, {
            user: {
              role: formData.role,
              assigned_role: formData.assigned_role || null,
            },
          });
        }

        onUserAdded();
        handleClose();
      } else {
        setErrors(response?.errors || ["Failed to create user"]);
      }
    } catch (error: any) {
      console.error("Failed to create user:", error);
      setErrors([error.response?.data?.error || "Failed to create user"]);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setFormData({
      name: "",
      email: "",
      password: "",
      password_confirmation: "",
      role: "user",
      assigned_role: "",
    });
    setErrors([]);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add New User</DialogTitle>
          <DialogDescription>
            Create a new user account with role and group assignment
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {errors.length > 0 && (
            <Alert variant="destructive">
              <AlertDescription>
                <ul className="list-disc list-inside text-sm">
                  {errors.map((error, index) => (
                    <li key={index}>{error}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="name">Full Name</Label>
            <Input
              id="name"
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="John Doe"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              required
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="john@example.com"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              required
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              placeholder="Min 8 characters"
              minLength={8}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password_confirmation">Confirm Password</Label>
            <Input
              id="password_confirmation"
              type="password"
              required
              value={formData.password_confirmation}
              onChange={(e) =>
                setFormData({ ...formData, password_confirmation: e.target.value })
              }
              placeholder="Re-enter password"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="role">Role</Label>
            <Select
              value={formData.role}
              onValueChange={(value) => setFormData({ ...formData, role: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {roles.map((role) => (
                  <SelectItem key={role.value} value={role.value}>
                    {role.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="assigned_role">Group Assignment</Label>
            <Select
              value={formData.assigned_role}
              onValueChange={(value) => setFormData({ ...formData, assigned_role: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a group" />
              </SelectTrigger>
              <SelectContent>
                {assignableRoles.map((role) => (
                  <SelectItem key={role.value} value={role.value}>
                    <div>
                      <div className="font-medium">{role.label}</div>
                      {role.description && (
                        <div className="text-xs text-muted-foreground">{role.description}</div>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={handleClose} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Creating..." : "Create User"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
