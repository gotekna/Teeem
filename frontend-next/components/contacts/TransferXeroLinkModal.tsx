"use client";

import { useState, useEffect, useCallback } from "react";
import { ArrowRightLeft, Search, User } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { api } from "@/lib/api";
import type { XeroLink } from "@/types/xero";

interface Contact {
  id: number;
  display_name: string;
  entity_type: string | null;
  email?: string | null;
  [key: string]: any;
}

interface TransferXeroLinkModalProps {
  isOpen: boolean;
  onClose: () => void;
  link: XeroLink | null;
  currentContact: Contact;
  onSuccess: () => void;
}

export function TransferXeroLinkModal({
  isOpen,
  onClose,
  link,
  currentContact,
  onSuccess,
}: TransferXeroLinkModalProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Contact[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [transferring, setTransferring] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Debounced search
  const searchContacts = useCallback(async (query: string) => {
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }

    setSearching(true);
    setError(null);
    try {
      const response = await api.get<{ success: boolean; data: Contact[] }>(
        `/api/v1/contacts?q=${encodeURIComponent(query)}&per_page=10`
      );
      if (response?.success && response.data) {
        // Filter out current contact
        const filtered = response.data.filter(
          (c) => c.id !== currentContact.id
        );
        setSearchResults(filtered);
      }
    } catch (_err) {
      console.error("Search failed:", _err);
      setError("Failed to search contacts");
    } finally {
      setSearching(false);
    }
  }, [currentContact.id]);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery) {
        searchContacts(searchQuery);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, searchContacts]);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (!isOpen) {
      setSearchQuery("");
      setSearchResults([]);
      setSelectedContact(null);
      setError(null);
    }
  }, [isOpen]);

  const handleTransfer = async () => {
    if (!link || !selectedContact) return;

    setTransferring(true);
    setError(null);
    try {
      const response = await api.post<{ success: boolean; error?: string }>(
        `/api/v1/contacts/${currentContact.id}/xero_links/${link.id}/transfer`,
        { target_contact_id: selectedContact.id }
      );

      if (response?.success) {
        onSuccess();
        onClose();
      } else {
        setError(response?.error || "Transfer failed");
      }
    } catch (_err) {
      console.error("Transfer failed:", _err);
      setError(_err instanceof Error ? _err.message : "Transfer failed");
    } finally {
      setTransferring(false);
    }
  };

  if (!link) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRightLeft className="h-5 w-5" />
            Transfer Xero Link
          </DialogTitle>
          <DialogDescription>
            Transfer the link to <strong>{link.xero_tenant_name}</strong> from{" "}
            <strong>{currentContact.display_name}</strong> to another contact.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Search Input */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search for a contact..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
              autoFocus
            />
          </div>

          {/* Search Results */}
          <div className="max-h-60 overflow-y-auto space-y-1">
            {searching && (
              <div className="flex items-center justify-center py-4">
                <Spinner size={20} className="text-muted-foreground" />
              </div>
            )}

            {!searching && searchQuery.length >= 2 && searchResults.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                No contacts found
              </p>
            )}

            {!searching && searchResults.map((contact) => (
              <button
                key={contact.id}
                type="button"
                onClick={() => setSelectedContact(contact)}
                className={`w-full text-left p-3 rounded-lg border transition-colors ${
                  selectedContact?.id === contact.id
                    ? "border-primary bg-primary/5"
                    : "border-transparent hover:bg-accent"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
                    <User className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{contact.display_name}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {contact.entity_type || "Contact"} {contact.email && `• ${contact.email}`}
                    </p>
                  </div>
                </div>
              </button>
            ))}
          </div>

          {/* Error */}
          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          {/* Selected Contact Confirmation */}
          {selectedContact && (
            <div className="p-3 rounded-lg bg-muted/50 border">
              <p className="text-sm">
                Transfer Xero link to: <strong>{selectedContact.display_name}</strong>
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={transferring}>
            Cancel
          </Button>
          <Button
            onClick={handleTransfer}
            disabled={!selectedContact || transferring}
          >
            {transferring ? (
              <>
                <Spinner size={16} className="mr-2" />
                Transferring...
              </>
            ) : (
              <>
                <ArrowRightLeft className="h-4 w-4 mr-2" />
                Transfer
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
