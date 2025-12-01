"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertTriangle,
  Check,
  Loader2,
  Mail,
  Phone,
  Building2,
  ExternalLink,
  Trash2,
} from "lucide-react";
import { api } from "@/lib/api";

interface Contact {
  id: number;
  name?: string;
  full_name?: string;
  email?: string | null;
  phone?: string | null;
  mobile_phone?: string | null;
  company?: string | null;
  type?: "customer" | "supplier" | "both" | string | null;
  entity_type?: string | null;
  xero_contact_id?: string | null;
  xero_id?: string | null;
  jobs_count?: number;
  purchase_orders_count?: number;
  completeness_score?: number;
  created_at?: string;
}

interface MergeContactsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contacts: Contact[];
  onMergeComplete: () => void;
}

function getInitials(name: string | undefined | null): string {
  if (!name) return "?";
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function getCompletenessColor(score: number | undefined | null): string {
  if (!score) return "text-gray-400";
  if (score >= 80) return "text-green-600";
  if (score >= 50) return "text-yellow-600";
  return "text-red-600";
}

export function MergeContactsModal({
  open,
  onOpenChange,
  contacts,
  onMergeComplete,
}: MergeContactsModalProps) {
  const [primaryContactId, setPrimaryContactId] = React.useState<number | null>(null);
  const [merging, setMerging] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Auto-select the best contact (highest completeness score, has Xero connection)
  React.useEffect(() => {
    if (contacts.length > 0 && !primaryContactId) {
      const sorted = [...contacts].sort((a, b) => {
        // Prefer contacts with Xero connection
        const aXero = a.xero_contact_id || a.xero_id;
        const bXero = b.xero_contact_id || b.xero_id;
        if (aXero && !bXero) return -1;
        if (!aXero && bXero) return 1;
        // Then by completeness score
        return (b.completeness_score || 0) - (a.completeness_score || 0);
      });
      setPrimaryContactId(sorted[0].id);
    }
  }, [contacts, primaryContactId]);

  const handleMerge = async () => {
    if (!primaryContactId) return;

    const secondaryIds = contacts
      .filter((c) => c.id !== primaryContactId)
      .map((c) => c.id);

    setMerging(true);
    setError(null);

    try {
      await api.post("/api/v1/contacts/merge", {
        primary_contact_id: primaryContactId,
        secondary_contact_ids: secondaryIds,
      });
      onMergeComplete();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to merge contacts");
    } finally {
      setMerging(false);
    }
  };

  const primaryContact = contacts.find((c) => c.id === primaryContactId);
  const secondaryContacts = contacts.filter((c) => c.id !== primaryContactId);

  const hasXeroConflict = contacts.filter((c) => c.xero_contact_id).length > 1;
  const xeroContactsToLose = secondaryContacts.filter((c) => c.xero_contact_id);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Merge Duplicate Contacts</DialogTitle>
          <DialogDescription>
            Select the primary contact to keep. Data from other contacts will be merged into it.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Xero Warning */}
          {hasXeroConflict && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Multiple contacts are linked to Xero. Only the primary contact's Xero connection
                will be preserved. The following Xero links will be lost:{" "}
                {xeroContactsToLose.map((c) => c.name).join(", ")}
              </AlertDescription>
            </Alert>
          )}

          {/* Contact Selection */}
          <RadioGroup
            value={primaryContactId?.toString()}
            onValueChange={(v) => setPrimaryContactId(parseInt(v))}
          >
            <div className="space-y-3">
              {contacts.map((contact) => (
                <div
                  key={contact.id}
                  className={`flex items-start gap-4 p-4 rounded-lg border transition-colors cursor-pointer ${
                    primaryContactId === contact.id
                      ? "border-primary bg-primary/5"
                      : "hover:bg-secondary/50"
                  }`}
                  onClick={() => setPrimaryContactId(contact.id)}
                >
                  <RadioGroupItem value={contact.id.toString()} id={`contact-${contact.id}`} />
                  <Avatar className="h-10 w-10">
                    <AvatarFallback>{getInitials(contact.name)}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Label
                        htmlFor={`contact-${contact.id}`}
                        className="font-medium cursor-pointer"
                      >
                        {contact.name}
                      </Label>
                      {contact.xero_contact_id && (
                        <Badge variant="outline" className="text-blue-600 border-blue-200">
                          <ExternalLink className="h-3 w-3 mr-1" />
                          Xero
                        </Badge>
                      )}
                      {primaryContactId === contact.id && (
                        <Badge className="bg-green-100 text-green-700">
                          <Check className="h-3 w-3 mr-1" />
                          Primary
                        </Badge>
                      )}
                    </div>
                    <div className="mt-1 space-y-1 text-sm text-muted-foreground">
                      {contact.email && (
                        <div className="flex items-center gap-1">
                          <Mail className="h-3 w-3" />
                          {contact.email}
                        </div>
                      )}
                      {contact.phone && (
                        <div className="flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          {contact.phone}
                        </div>
                      )}
                      {contact.company && (
                        <div className="flex items-center gap-1">
                          <Building2 className="h-3 w-3" />
                          {contact.company}
                        </div>
                      )}
                    </div>
                    <div className="mt-2 flex items-center gap-4 text-xs">
                      <span>{contact.jobs_count} jobs</span>
                      <span>{contact.purchase_orders_count} POs</span>
                      <span className={getCompletenessColor(contact.completeness_score)}>
                        {contact.completeness_score}% complete
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </RadioGroup>

          <Separator />

          {/* Merge Preview */}
          {primaryContact && secondaryContacts.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium">What will happen:</p>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-600" />
                  Keep "{primaryContact.name}" as the primary contact
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-600" />
                  Merge {secondaryContacts.reduce((sum, c) => sum + (c.jobs_count || 0), 0)} jobs
                  and {secondaryContacts.reduce((sum, c) => sum + (c.purchase_orders_count || 0), 0)} POs
                </li>
                <li className="flex items-center gap-2">
                  <Trash2 className="h-4 w-4 text-red-600" />
                  Delete {secondaryContacts.length} duplicate contact(s)
                </li>
              </ul>
            </div>
          )}

          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={merging}>
            Cancel
          </Button>
          <Button onClick={handleMerge} disabled={!primaryContactId || merging}>
            {merging && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Merge Contacts
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
