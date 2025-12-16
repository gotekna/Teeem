"use client";

import { useState, useEffect } from "react";
import { ArrowRight, Loader2, AlertCircle, CheckCircle } from "lucide-react";
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
import { api } from "@/lib/api";

interface Contact {
  id: number;
  display_name: string;
  [key: string]: unknown;
}

interface XeroLink {
  id: number;
  contact_id: number;
  xero_tenant_id: string;
  xero_tenant_name: string;
  xero_contact_id: string;
  sync_enabled: boolean;
}

interface XeroLinkTransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  contactIds: (number | string)[];
  onSuccess: () => void;
}

export function XeroLinkTransferModal({
  isOpen,
  onClose,
  contactIds,
  onSuccess,
}: XeroLinkTransferModalProps) {
  const [loading, setLoading] = useState(true);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [linksMap, setLinksMap] = useState<Record<number, XeroLink[]>>({});
  const [transferring, setTransferring] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedTransfer, setSelectedTransfer] = useState<{
    linkId: number;
    fromContactId: number;
    toContactId: number;
  } | null>(null);

  // Load contacts and their Xero links
  useEffect(() => {
    if (!isOpen || contactIds.length !== 2) return;

    const loadData = async () => {
      setLoading(true);
      setError(null);
      setSelectedTransfer(null);

      try {
        // Load both contacts and their Xero links in parallel
        const [contact1Res, contact2Res, links1Res, links2Res] = await Promise.all([
          api.get<{ success: boolean; contact: Contact }>(`/api/v1/contacts/${contactIds[0]}`),
          api.get<{ success: boolean; contact: Contact }>(`/api/v1/contacts/${contactIds[1]}`),
          api.get<{ success: boolean; xero_links: XeroLink[] }>(`/api/v1/contacts/${contactIds[0]}/xero_links`),
          api.get<{ success: boolean; xero_links: XeroLink[] }>(`/api/v1/contacts/${contactIds[1]}/xero_links`),
        ]);

        const loadedContacts: Contact[] = [];
        const loadedLinks: Record<number, XeroLink[]> = {};

        if (contact1Res?.success && contact1Res.contact) {
          loadedContacts.push(contact1Res.contact);
          loadedLinks[contact1Res.contact.id] = links1Res?.xero_links || [];
        }
        if (contact2Res?.success && contact2Res.contact) {
          loadedContacts.push(contact2Res.contact);
          loadedLinks[contact2Res.contact.id] = links2Res?.xero_links || [];
        }

        setContacts(loadedContacts);
        setLinksMap(loadedLinks);
      } catch (err) {
        console.error("Failed to load data:", err);
        setError("Failed to load contact data");
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [isOpen, contactIds]);

  const handleTransfer = async () => {
    if (!selectedTransfer) return;

    setTransferring(true);
    setError(null);

    try {
      const response = await api.post<{ success: boolean; error?: string }>(
        `/api/v1/contacts/${selectedTransfer.fromContactId}/xero_links/${selectedTransfer.linkId}/transfer`,
        { target_contact_id: selectedTransfer.toContactId }
      );

      if (response?.success) {
        onSuccess();
        onClose();
      } else {
        setError(response?.error || "Transfer failed");
      }
    } catch (err) {
      console.error("Transfer failed:", err);
      setError(err instanceof Error ? err.message : "Transfer failed");
    } finally {
      setTransferring(false);
    }
  };

  // Get all links from both contacts
  const allLinks = contacts.flatMap((c) =>
    (linksMap[c.id] || []).map((link) => ({
      ...link,
      contactName: c.display_name,
    }))
  );

  // Check if there are any links to transfer
  const hasLinks = allLinks.length > 0;

  // Get the "other" contact for a given contact
  const getOtherContact = (contactId: number) => {
    return contacts.find((c) => c.id !== contactId);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Transfer Xero Link</DialogTitle>
          <DialogDescription>
            Select a Xero link to transfer between the two contacts.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : !hasLinks ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <AlertCircle className="h-8 w-8 text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">
              Neither contact has any Xero links to transfer.
            </p>
          </div>
        ) : (
          <div className="space-y-4 py-4">
            {/* Show contacts */}
            <div className="grid grid-cols-2 gap-4 p-3 bg-muted/50 rounded-lg">
              {contacts.map((contact) => (
                <div key={contact.id} className="text-center">
                  <p className="font-medium text-sm truncate">{contact.display_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {(linksMap[contact.id] || []).length} Xero link(s)
                  </p>
                </div>
              ))}
            </div>

            {/* Show transferable links */}
            <div className="space-y-2">
              <p className="text-sm font-medium">Select a link to transfer:</p>
              {allLinks.map((link) => {
                const otherContact = getOtherContact(link.contact_id);
                if (!otherContact) return null;

                const isSelected =
                  selectedTransfer?.linkId === link.id &&
                  selectedTransfer?.toContactId === otherContact.id;

                return (
                  <button
                    key={`${link.id}-${otherContact.id}`}
                    type="button"
                    onClick={() =>
                      setSelectedTransfer({
                        linkId: link.id,
                        fromContactId: link.contact_id,
                        toContactId: otherContact.id,
                      })
                    }
                    className={`w-full text-left p-3 rounded-lg border transition-colors ${
                      isSelected
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/50 hover:bg-accent"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {link.xero_tenant_name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          From: {link.contactName}
                        </p>
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">To:</p>
                        <p className="text-sm font-medium truncate">
                          {otherContact.display_name}
                        </p>
                      </div>
                      {isSelected && (
                        <CheckCircle className="h-4 w-4 text-primary shrink-0" />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={transferring}>
            Cancel
          </Button>
          <Button
            onClick={handleTransfer}
            disabled={!selectedTransfer || transferring || !hasLinks}
          >
            {transferring ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Transferring...
              </>
            ) : (
              "Transfer"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
