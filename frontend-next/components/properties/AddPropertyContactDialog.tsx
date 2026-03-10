"use client";

import { useState, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";
import { Spinner } from "@/components/ui/spinner";

const PROPERTY_CONTACT_ROLES = [
  { value: "owner", label: "Owner" },
  { value: "tenant", label: "Tenant" },
  { value: "co_tenant", label: "Co-Tenant" },
  { value: "guarantor", label: "Guarantor" },
  { value: "agent", label: "Agent" },
  { value: "property_manager", label: "Property Manager" },
  { value: "sda_participant", label: "SDA Participant" },
] as const;

interface ContactOption {
  id: number;
  display_name: string;
  email?: string;
}

interface AddPropertyContactDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  propertyId: string;
  onSuccess: () => void;
}

export function AddPropertyContactDialog({
  open,
  onOpenChange,
  propertyId,
  onSuccess,
}: AddPropertyContactDialogProps) {
  const { toast } = useToast();
  const [role, setRole] = useState("tenant");
  const [isPrimary, setIsPrimary] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [contacts, setContacts] = useState<ContactOption[]>([]);
  const [selectedContact, setSelectedContact] = useState<ContactOption | null>(null);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const searchContacts = useCallback(async (query: string) => {
    if (query.length < 2) {
      setContacts([]);
      return;
    }
    setSearching(true);
    try {
      const res = await api.get<{ contacts: ContactOption[] }>(
        `/api/v1/contacts?search=${encodeURIComponent(query)}&per_page=20`
      );
      setContacts(res.contacts || []);
    } catch {
      setContacts([]);
    } finally {
      setSearching(false);
    }
  }, []);

  const handleSearchChange = useCallback(
    (value: string) => {
      setSearch(value);
      setSelectedContact(null);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => searchContacts(value), 300);
    },
    [searchContacts]
  );

  const handleSelectContact = useCallback((contact: ContactOption) => {
    setSelectedContact(contact);
    setSearch(contact.display_name);
    setContacts([]);
  }, []);

  const handleSave = async () => {
    if (!selectedContact) return;
    setSaving(true);
    try {
      const res = await api.post<{ success: boolean; error?: string }>(
        `/api/v1/properties/${propertyId}/add_contact`,
        {
          contact_id: selectedContact.id,
          role,
          is_primary: isPrimary,
        }
      );
      if (res?.success) {
        toast({ title: "Contact added" });
        onSuccess();
        onOpenChange(false);
        setSearch("");
        setSelectedContact(null);
        setRole("tenant");
        setIsPrimary(false);
      } else {
        toast({
          title: "Error",
          description: res?.error || "Failed to add contact",
          variant: "destructive",
        });
      }
    } catch {
      toast({
        title: "Error",
        description: "Failed to add contact",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Property Contact</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Contact Search */}
          <div className="space-y-2">
            <Label>Contact</Label>
            <div className="relative">
              <Input
                placeholder="Search contacts..."
                value={search}
                onChange={(e) => handleSearchChange(e.target.value)}
              />
              {searching && (
                <div className="absolute right-2 top-2.5">
                  <Spinner className="h-4 w-4" />
                </div>
              )}
            </div>
            {contacts.length > 0 && !selectedContact && (
              <div className="border rounded-md max-h-48 overflow-auto bg-popover">
                {contacts.map((c) => (
                  <button
                    key={c.id}
                    className="w-full text-left px-3 py-2 hover:bg-accent text-sm flex justify-between items-center"
                    onClick={() => handleSelectContact(c)}
                  >
                    <span className="font-medium">{c.display_name}</span>
                    {c.email && (
                      <span className="text-muted-foreground text-xs ml-2">
                        {c.email}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Role */}
          <div className="space-y-2">
            <Label>Role</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PROPERTY_CONTACT_ROLES.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Primary toggle */}
          <div className="flex items-center justify-between">
            <Label>Primary contact for this role</Label>
            <Switch checked={isPrimary} onCheckedChange={setIsPrimary} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!selectedContact || saving}>
            {saving ? "Adding..." : "Add Contact"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
