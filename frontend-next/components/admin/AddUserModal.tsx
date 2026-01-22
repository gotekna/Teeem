"use client";

import { useState, useEffect, useCallback } from "react";
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
import { ComboboxDropdown } from "@/components/ui/combobox-dropdown";
import { api } from "@/lib/api";
import { User, UserPlus } from "lucide-react";

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
  mobile_phone: string;
  contact_id: number | null;
  role_ids: number[];
}

interface ContactOption {
  id: number;
  display_name: string;
  email?: string;
}

interface RoleOption {
  id: number;
  name: string;
  display_name: string;
}

export function AddUserModal({ isOpen, onClose, onUserAdded }: AddUserModalProps) {
  const [formData, setFormData] = useState<FormData>({
    name: "",
    email: "",
    password: "",
    password_confirmation: "",
    mobile_phone: "",
    contact_id: null,
    role_ids: [],
  });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [contactSearch, setContactSearch] = useState("");
  const [contactOptions, setContactOptions] = useState<ContactOption[]>([]);
  const [searchingContacts, setSearchingContacts] = useState(false);
  const [createNewContact, setCreateNewContact] = useState(true);

  // Fetch available roles
  useEffect(() => {
    const fetchRoles = async () => {
      try {
        const response = await api.get<{ data: RoleOption[] }>("/api/v1/roles");
        setRoles(response.data || []);
      } catch (error) {
        console.error("Failed to fetch roles:", error);
      }
    };
    if (isOpen) fetchRoles();
  }, [isOpen]);

  // Search contacts when typing
  const searchContacts = useCallback(async (query: string) => {
    if (query.length < 2) {
      setContactOptions([]);
      return;
    }

    setSearchingContacts(true);
    try {
      const response = await api.get<{ data: { records: ContactOption[] } }>(
        `/api/v1/foundations/contacts/records?search=${encodeURIComponent(query)}&limit=10`
      );
      setContactOptions(response.data?.records || []);
    } catch (error) {
      console.error("Failed to search contacts:", error);
      setContactOptions([]);
    } finally {
      setSearchingContacts(false);
    }
  }, []);

  // Debounce contact search
  useEffect(() => {
    if (!createNewContact && contactSearch.length >= 2) {
      const timeout = setTimeout(() => searchContacts(contactSearch), 300);
      return () => clearTimeout(timeout);
    }
  }, [contactSearch, createNewContact, searchContacts]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrors([]);

    // Validation
    if (!createNewContact && !formData.contact_id) {
      setErrors(["Please select an existing contact or choose to create a new one"]);
      setLoading(false);
      return;
    }

    if (createNewContact && !formData.name.trim()) {
      setErrors(["Name is required"]);
      setLoading(false);
      return;
    }

    if (createNewContact && !formData.email.trim()) {
      setErrors(["Email is required"]);
      setLoading(false);
      return;
    }

    if (formData.password && formData.password !== formData.password_confirmation) {
      setErrors(["Passwords do not match"]);
      setLoading(false);
      return;
    }

    if (formData.password && formData.password.length < 8) {
      setErrors(["Password must be at least 8 characters"]);
      setLoading(false);
      return;
    }

    try {
      const payload: Record<string, unknown> = {};

      if (createNewContact) {
        // Creating new contact - send user info
        payload.name = formData.name;
        payload.email = formData.email;
        payload.mobile_phone = formData.mobile_phone || undefined;
      } else {
        // Linking to existing contact
        payload.contact_id = formData.contact_id;
        payload.email = formData.email; // Still need email for login
        payload.name = formData.name; // Name for the user record
      }

      // Password is required for new users
      if (formData.password) {
        payload.password = formData.password;
        payload.password_confirmation = formData.password_confirmation;
      }

      // Role assignment
      if (formData.role_ids.length > 0) {
        payload.role_ids = formData.role_ids;
      }

      const response = await api.post<{ success: boolean; errors?: string[] }>(
        "/api/v1/users",
        { user: payload }
      );

      if (response?.success) {
        onUserAdded();
        handleClose();
      } else {
        setErrors(response?.errors || ["Failed to create user"]);
      }
    } catch (error: unknown) {
      console.error("Failed to create user:", error);
      const apiError = error as { response?: { data?: { error?: string; errors?: string[] } } };
      const errorMessage = apiError.response?.data?.error ||
                          apiError.response?.data?.errors?.join(", ") ||
                          "Failed to create user";
      setErrors([errorMessage]);
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
      mobile_phone: "",
      contact_id: null,
      role_ids: [],
    });
    setErrors([]);
    setContactSearch("");
    setContactOptions([]);
    setCreateNewContact(true);
    onClose();
  };

  const handleContactSelect = (contact: ContactOption | null) => {
    if (contact) {
      setFormData({
        ...formData,
        contact_id: contact.id,
        name: contact.display_name || "",
        email: contact.email || formData.email,
      });
    } else {
      setFormData({
        ...formData,
        contact_id: null,
      });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add New User</DialogTitle>
          <DialogDescription>
            Create a new user account by linking to an existing contact or creating a new one
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

          {/* Contact Selection Mode */}
          <div className="space-y-3">
            <Label>Contact</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant={createNewContact ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  setCreateNewContact(true);
                  setFormData({ ...formData, contact_id: null });
                }}
                className="flex-1"
              >
                <UserPlus className="h-4 w-4 mr-2" />
                Create New
              </Button>
              <Button
                type="button"
                variant={!createNewContact ? "default" : "outline"}
                size="sm"
                onClick={() => setCreateNewContact(false)}
                className="flex-1"
              >
                <User className="h-4 w-4 mr-2" />
                Link Existing
              </Button>
            </div>
          </div>

          {/* Existing Contact Search */}
          {!createNewContact && (
            <div className="space-y-2">
              <Label>Search Contact</Label>
              <ComboboxDropdown
                placeholder="Search contacts by name or email..."
                searchPlaceholder="Type to search..."
                items={contactOptions.map(c => ({
                  id: c.id.toString(),
                  label: c.display_name || `Contact #${c.id}`,
                  searchText: c.email,
                }))}
                selectedItem={formData.contact_id ? {
                  id: formData.contact_id.toString(),
                  label: formData.name,
                } : undefined}
                onSelect={(item) => {
                  const contact = contactOptions.find(c => c.id.toString() === item.id);
                  handleContactSelect(contact || null);
                }}
                onInputChange={setContactSearch}
                isLoading={searchingContacts}
                disableInternalFilter={true}
                emptyResults={contactSearch.length < 2 ? "Type at least 2 characters..." : "No contacts found"}
                clearable
                onClear={() => handleContactSelect(null)}
                onCreate={(searchValue) => {
                  // Switch to create mode with search term as name
                  setCreateNewContact(true);
                  setFormData({
                    ...formData,
                    contact_id: null,
                    name: searchValue,
                  });
                  setContactSearch("");
                  setContactOptions([]);
                }}
                renderOnCreate={(searchValue) => (
                  <div className="flex items-center gap-2">
                    <UserPlus className="h-4 w-4" />
                    <span>Create &quot;{searchValue}&quot; as new contact</span>
                  </div>
                )}
              />
              {formData.contact_id && (
                <p className="text-sm text-muted-foreground">
                  Selected: {formData.name} {formData.email && `(${formData.email})`}
                </p>
              )}
            </div>
          )}

          {/* Name - always shown but may be pre-filled from contact */}
          <div className="space-y-2">
            <Label htmlFor="name">Full Name</Label>
            <Input
              id="name"
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="John Doe"
              disabled={!createNewContact && !!formData.contact_id}
            />
          </div>

          {/* Email - always required for login */}
          <div className="space-y-2">
            <Label htmlFor="email">Login Email</Label>
            <Input
              id="email"
              type="email"
              required
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="john@example.com"
            />
            <p className="text-xs text-muted-foreground">
              This email will be used for login
            </p>
          </div>

          {/* Mobile Phone - only when creating new contact */}
          {createNewContact && (
            <div className="space-y-2">
              <Label htmlFor="mobile_phone">Mobile Phone (Optional)</Label>
              <Input
                id="mobile_phone"
                type="tel"
                value={formData.mobile_phone}
                onChange={(e) => setFormData({ ...formData, mobile_phone: e.target.value })}
                placeholder="0400 000 000"
              />
            </div>
          )}

          {/* Password */}
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

          {/* Role Selection */}
          <div className="space-y-2">
            <Label htmlFor="role">Role</Label>
            <Select
              value={formData.role_ids[0]?.toString() || ""}
              onValueChange={(value) => setFormData({ ...formData, role_ids: value ? [parseInt(value)] : [] })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a role" />
              </SelectTrigger>
              <SelectContent>
                {roles.map((role) => (
                  <SelectItem key={role.id} value={role.id.toString()}>
                    {role.display_name || role.name}
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
