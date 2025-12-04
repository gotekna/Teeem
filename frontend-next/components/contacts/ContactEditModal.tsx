"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Save, X, User, Building2, Phone, Globe, FileText } from "lucide-react";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";

interface Contact {
  id: number;
  full_name: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  mobile_phone: string | null;
  office_phone: string | null;
  website: string | null;
  tax_number: string | null;
  address: string | null;
  notes: string | null;
  is_active: boolean;
  is_family_member: boolean;
  entity_type: string | null;
  sync_with_xero: boolean;
  xero_contact_id: string | null;
}

interface ContactEditModalProps {
  contact: Contact | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

export function ContactEditModal({ contact, open, onOpenChange, onSaved }: ContactEditModalProps) {
  const { toast } = useToast();
  const [saving, setSaving] = React.useState(false);
  const [formData, setFormData] = React.useState({
    first_name: "",
    last_name: "",
    email: "",
    mobile_phone: "",
    office_phone: "",
    website: "",
    tax_number: "",
    address: "",
    notes: "",
    is_active: true,
    is_family_member: false,
    entity_type: "person",
    sync_with_xero: false,
  });

  // Initialize form data when contact changes
  React.useEffect(() => {
    if (contact) {
      setFormData({
        first_name: contact.first_name || "",
        last_name: contact.last_name || "",
        email: contact.email || "",
        mobile_phone: contact.mobile_phone || "",
        office_phone: contact.office_phone || "",
        website: contact.website || "",
        tax_number: contact.tax_number || "",
        address: contact.address || "",
        notes: contact.notes || "",
        is_active: contact.is_active,
        is_family_member: contact.is_family_member,
        entity_type: contact.entity_type || "person",
        sync_with_xero: contact.sync_with_xero,
      });
    }
  }, [contact]);

  const handleInputChange = (field: string, value: string | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    if (!contact) return;

    setSaving(true);
    try {
      // Build full_name from first_name and last_name
      const full_name = [formData.first_name, formData.last_name].filter(Boolean).join(" ") || "Unknown";

      await api.patch(`/api/v1/contacts/${contact.id}`, {
        contact: {
          ...formData,
          full_name,
        },
      });

      toast({
        title: "Success",
        description: "Contact updated successfully",
      });
      onSaved();
      onOpenChange(false);
    } catch (error) {
      console.error("Failed to save contact:", error);
      toast({
        title: "Error",
        description: "Failed to update contact",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (!contact) return null;

  const isXeroSynced = !!contact.xero_contact_id;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Edit Contact
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="basic" className="mt-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="basic">Basic Info</TabsTrigger>
            <TabsTrigger value="contact">Contact Details</TabsTrigger>
            <TabsTrigger value="other">Other</TabsTrigger>
          </TabsList>

          {/* Basic Info Tab */}
          <TabsContent value="basic" className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="first_name">First Name</Label>
                <Input
                  id="first_name"
                  value={formData.first_name}
                  onChange={(e) => handleInputChange("first_name", e.target.value)}
                  placeholder="First name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="last_name">Last Name</Label>
                <Input
                  id="last_name"
                  value={formData.last_name}
                  onChange={(e) => handleInputChange("last_name", e.target.value)}
                  placeholder="Last name"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => handleInputChange("email", e.target.value)}
                placeholder="email@example.com"
                disabled={isXeroSynced}
              />
              {isXeroSynced && (
                <p className="text-xs text-muted-foreground">Email is synced from Xero</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="entity_type">Entity Type</Label>
              <select
                id="entity_type"
                value={formData.entity_type}
                onChange={(e) => handleInputChange("entity_type", e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <option value="person">Person</option>
                <option value="company">Company</option>
                <option value="trust">Trust</option>
              </select>
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Active</Label>
                <p className="text-xs text-muted-foreground">Is this contact active?</p>
              </div>
              <Switch
                checked={formData.is_active}
                onCheckedChange={(checked) => handleInputChange("is_active", checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Family Member</Label>
                <p className="text-xs text-muted-foreground">Is this a family member?</p>
              </div>
              <Switch
                checked={formData.is_family_member}
                onCheckedChange={(checked) => handleInputChange("is_family_member", checked)}
              />
            </div>
          </TabsContent>

          {/* Contact Details Tab */}
          <TabsContent value="contact" className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="mobile_phone" className="flex items-center gap-2">
                  <Phone className="h-4 w-4" />
                  Mobile Phone
                </Label>
                <Input
                  id="mobile_phone"
                  value={formData.mobile_phone}
                  onChange={(e) => handleInputChange("mobile_phone", e.target.value)}
                  placeholder="0400 000 000"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="office_phone" className="flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  Office Phone
                </Label>
                <Input
                  id="office_phone"
                  value={formData.office_phone}
                  onChange={(e) => handleInputChange("office_phone", e.target.value)}
                  placeholder="07 0000 0000"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="website" className="flex items-center gap-2">
                <Globe className="h-4 w-4" />
                Website
              </Label>
              <Input
                id="website"
                value={formData.website}
                onChange={(e) => handleInputChange("website", e.target.value)}
                placeholder="https://example.com"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="address">Address</Label>
              <Textarea
                id="address"
                value={formData.address}
                onChange={(e) => handleInputChange("address", e.target.value)}
                placeholder="Full address"
                rows={3}
              />
            </div>
          </TabsContent>

          {/* Other Tab */}
          <TabsContent value="other" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="tax_number">ABN / Tax Number</Label>
              <Input
                id="tax_number"
                value={formData.tax_number}
                onChange={(e) => handleInputChange("tax_number", e.target.value)}
                placeholder="XX XXX XXX XXX"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes" className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Notes
              </Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => handleInputChange("notes", e.target.value)}
                placeholder="Internal notes about this contact"
                rows={4}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Sync with Xero</Label>
                <p className="text-xs text-muted-foreground">Keep this contact synced with Xero</p>
              </div>
              <Switch
                checked={formData.sync_with_xero}
                onCheckedChange={(checked) => handleInputChange("sync_with_xero", checked)}
              />
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter className="mt-6">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            <X className="h-4 w-4 mr-2" />
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
