"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api } from "@/lib/api";
import { User, ExternalLink } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { Spinner } from "@/components/ui/spinner";
import { formatDateTime } from "@/utils/formatters";
import Link from "next/link";

interface CaseContactData {
  id: number;
  contact_id: number;
  contact_name: string;
  contact_email?: string;
  relationship_type?: string;
  alignment?: string;
  role?: string;
  is_primary: boolean;
  include_all_emails?: boolean;
  auto_linked_email_count?: number;
  notes?: string;
  reason?: string;
  added_by_name?: string;
  added_at?: string;
}

interface SelectOption {
  value: string;
  label: string;
}

interface EditCaseContactDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  caseId: number;
  contactId: number;
  onSaved?: () => void;
}

export function EditCaseContactDialog({
  open,
  onOpenChange,
  caseId,
  contactId,
  onSaved,
}: EditCaseContactDialogProps) {
  const { toast } = useToast();
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [contactData, setContactData] = React.useState<CaseContactData | null>(null);
  const [relationshipTypes, setRelationshipTypes] = React.useState<SelectOption[]>([]);
  const [alignments, setAlignments] = React.useState<SelectOption[]>([]);
  const [roles, setRoles] = React.useState<SelectOption[]>([]);

  // Form state
  const [formData, setFormData] = React.useState({
    relationship_type: "",
    alignment: "",
    role: "",
    is_primary: false,
    include_all_emails: false,
    notes: "",
    reason: "",
  });

  // Load contact data when dialog opens
  React.useEffect(() => {
    if (open && caseId && contactId) {
      loadContactData();
    }
     
  }, [open, caseId, contactId]);

  const loadContactData = async () => {
    setLoading(true);
    try {
      const response = await api.get<{
        success: boolean;
        case_contact: CaseContactData;
        relationship_types: SelectOption[];
        alignments: SelectOption[];
        roles: SelectOption[];
      }>(`/api/v1/cases/${caseId}/contacts/${contactId}`);

      if (response?.success) {
        setContactData(response.case_contact);
        setRelationshipTypes(response.relationship_types);
        setAlignments(response.alignments);
        setRoles(response.roles);
        setFormData({
          relationship_type: response.case_contact.relationship_type || "",
          alignment: response.case_contact.alignment || "",
          role: response.case_contact.role || "",
          is_primary: response.case_contact.is_primary || false,
          include_all_emails: response.case_contact.include_all_emails || false,
          notes: response.case_contact.notes || "",
          reason: response.case_contact.reason || "",
        });
      }
    } catch (error) {
      console.error("Failed to load contact data:", error);
      toast({
        title: "Error",
        description: "Failed to load contact details",
        variant: "destructive",
      });
      onOpenChange(false);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const response = await api.patch<{ success: boolean; errors?: string[] }>(
        `/api/v1/cases/${caseId}/contacts/${contactId}`,
        {
          case_contact: formData,
        }
      );

      if (response?.success) {
        toast({
          title: "Success",
          description: "Contact relationship updated",
        });
        onSaved?.();
        onOpenChange(false);
      } else {
        const errors = response.errors || [];
        const errorMsg = Array.isArray(errors)
          ? errors.map((e: any) => typeof e === 'string' ? e : (e.error || JSON.stringify(e))).join("; ")
          : "Failed to update contact";
        toast({
          title: "Error",
          description: errorMsg,
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Failed to save:", error);
      toast({
        title: "Error",
        description: "Failed to save changes",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Edit Contact Relationship
          </DialogTitle>
          <DialogDescription>
            Update how this contact relates to the case
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Spinner size={32} className="text-muted-foreground" />
          </div>
        ) : contactData ? (
          <form onSubmit={handleSubmit}>
            {/* Contact Info (read-only) */}
            <div className="mb-6 p-4 bg-muted rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold">{contactData.contact_name}</p>
                  {contactData.contact_email && (
                    <p className="text-sm text-muted-foreground">
                      {contactData.contact_email}
                    </p>
                  )}
                </div>
                <Link
                  href={`/contacts/${contactData.contact_id}`}
                  className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-500 dark:text-blue-400 flex items-center gap-1"
                >
                  View Contact
                  <ExternalLink className="h-3 w-3" />
                </Link>
              </div>
            </div>

            <div className="space-y-4">
              {/* Relationship Type */}
              <div className="space-y-2">
                <Label htmlFor="relationship_type">Relationship Type</Label>
                <Select
                  value={formData.relationship_type || "_none"}
                  onValueChange={(value) =>
                    setFormData({ ...formData, relationship_type: value === "_none" ? "" : value })
                  }
                >
                  <SelectTrigger id="relationship_type">
                    <SelectValue placeholder="Select relationship type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">Not specified</SelectItem>
                    {relationshipTypes.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Alignment */}
              <div className="space-y-2">
                <Label htmlFor="alignment">Alignment</Label>
                <Select
                  value={formData.alignment || "_none"}
                  onValueChange={(value) =>
                    setFormData({ ...formData, alignment: value === "_none" ? "" : value })
                  }
                >
                  <SelectTrigger id="alignment">
                    <SelectValue placeholder="Select alignment" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">Not specified</SelectItem>
                    {alignments.map((a) => (
                      <SelectItem key={a.value} value={a.value}>
                        {a.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Friendly contacts appear on the left, opposing on the right
                </p>
              </div>

              {/* Role */}
              <div className="space-y-2">
                <Label htmlFor="role">Role in Case</Label>
                <Select
                  value={formData.role || "_none"}
                  onValueChange={(value) =>
                    setFormData({ ...formData, role: value === "_none" ? "" : value })
                  }
                >
                  <SelectTrigger id="role">
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">Not specified</SelectItem>
                    {roles.map((r) => (
                      <SelectItem key={r.value} value={r.value}>
                        {r.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Primary Contact */}
              <div className="flex items-center justify-between py-2">
                <div className="space-y-0.5">
                  <Label htmlFor="is_primary">Primary Contact</Label>
                  <p className="text-xs text-muted-foreground">
                    Mark as the main contact for this case
                  </p>
                </div>
                <Switch
                  id="is_primary"
                  checked={formData.is_primary}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, is_primary: checked })
                  }
                />
              </div>

              {/* Auto-include All Emails */}
              <div className="flex items-center justify-between py-2 border-t pt-4">
                <div className="space-y-0.5">
                  <Label htmlFor="include_all_emails">Auto-include All Emails</Label>
                  <p className="text-xs text-muted-foreground">
                    Automatically link ALL emails from/to this contact to the case
                  </p>
                  {contactData.auto_linked_email_count !== undefined && contactData.auto_linked_email_count > 0 && (
                    <p className="text-xs font-medium text-green-600 dark:text-green-400 mt-1">
                      ✓ {contactData.auto_linked_email_count} emails auto-linked
                    </p>
                  )}
                </div>
                <Switch
                  id="include_all_emails"
                  checked={formData.include_all_emails}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, include_all_emails: checked })
                  }
                />
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  placeholder="Add any notes about this contact's involvement..."
                  value={formData.notes}
                  onChange={(e) =>
                    setFormData({ ...formData, notes: e.target.value })
                  }
                  rows={3}
                />
              </div>

              {/* Reason */}
              <div className="space-y-2">
                <Label htmlFor="reason">
                  Reason <span className="text-red-500 dark:text-red-400">*</span>
                </Label>
                <Textarea
                  id="reason"
                  placeholder="Why was this contact added to the case?"
                  value={formData.reason}
                  onChange={(e) =>
                    setFormData({ ...formData, reason: e.target.value })
                  }
                  rows={3}
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Explain the contact's relevance to this case
                </p>
              </div>

              {/* Added by metadata (read-only) */}
              {contactData.added_by_name && contactData.added_at && (
                <div className="p-3 bg-muted rounded-lg text-sm">
                  <p className="text-muted-foreground">
                    Added {formatDateTime(contactData.added_at)} by {contactData.added_by_name}
                  </p>
                </div>
              )}
            </div>

            <DialogFooter className="mt-6">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving && <Spinner size={16} className="mr-2" />}
                Save Changes
              </Button>
            </DialogFooter>
          </form>
        ) : (
          <div className="py-8 text-center text-muted-foreground">
            Contact not found
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
