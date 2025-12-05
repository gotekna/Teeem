"use client";

import { useState } from "react";
import { Search, X, Link as LinkIcon, CheckCircle, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { api } from "@/lib/api";
import type { XeroContact } from "@/types/xero";

interface LinkXeroContactModalProps {
  isOpen: boolean;
  onClose: () => void;
  contact: {
    id: number;
    full_name: string;
  };
  onSuccess: (updatedContact: any) => void;
}

export function LinkXeroContactModal({
  isOpen,
  onClose,
  contact,
  onSuccess,
}: LinkXeroContactModalProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<XeroContact[]>([]);
  const [selectedXeroContact, setSelectedXeroContact] = useState<XeroContact | null>(null);
  const [linking, setLinking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setSearching(true);
    setError(null);
    try {
      const response = await api.get<{ success: boolean; contacts: XeroContact[] }>(
        `/api/v1/xero/search_contacts?query=${encodeURIComponent(searchQuery)}`
      );
      if (response?.success) {
        setSearchResults(response.contacts);
        if (response?.contacts.length === 0) {
          setError("No Xero contacts found matching your search");
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to search Xero contacts");
      console.error("Search error:", err);
    } finally {
      setSearching(false);
    }
  };

  const handleLink = async () => {
    if (!selectedXeroContact) return;

    setLinking(true);
    setError(null);
    try {
      const response = await api.post<{ success: boolean; contact: any }>(
        `/api/v1/contacts/${contact.id}/link_xero_contact`,
        {
          xero_id: selectedXeroContact.ContactID,
        }
      );

      if (response?.success) {
        onSuccess(response.contact);
        handleClose();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to link contact to Xero");
      console.error("Link error:", err);
    } finally {
      setLinking(false);
    }
  };

  const handleClose = () => {
    setSearchQuery("");
    setSearchResults([]);
    setSelectedXeroContact(null);
    setError(null);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <LinkIcon className="h-5 w-5" />
            Link {contact.full_name} to Xero Contact
          </DialogTitle>
          <DialogDescription>
            Search for the corresponding contact in Xero and link them to enable automatic syncing.
          </DialogDescription>
        </DialogHeader>

        {/* Search Form */}
        <form onSubmit={handleSearch} className="flex gap-2">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search Xero contacts by name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
              disabled={searching}
            />
          </div>
          <Button type="submit" disabled={searching || !searchQuery.trim()}>
            {searching ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Searching...
              </>
            ) : (
              "Search"
            )}
          </Button>
        </form>

        {/* Error Message */}
        {error && (
          <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-md">
            {error}
          </div>
        )}

        {/* Search Results */}
        {searchResults.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Found {searchResults.length} contact{searchResults.length !== 1 ? "s" : ""}
            </p>
            <ScrollArea className="h-[300px] rounded-md border">
              <div className="p-2 space-y-2">
                {searchResults.map((xeroContact) => (
                  <button
                    key={xeroContact.ContactID}
                    onClick={() => setSelectedXeroContact(xeroContact)}
                    className={`w-full text-left p-3 rounded-lg border transition-colors ${
                      selectedXeroContact?.ContactID === xeroContact.ContactID
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/50 hover:bg-accent"
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{xeroContact.Name}</span>
                          {selectedXeroContact?.ContactID === xeroContact.ContactID && (
                            <CheckCircle className="h-4 w-4 text-primary" />
                          )}
                        </div>
                        {(xeroContact.FirstName || xeroContact.LastName) && (
                          <p className="text-sm text-muted-foreground">
                            {xeroContact.FirstName} {xeroContact.LastName}
                          </p>
                        )}
                        {xeroContact.EmailAddress && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {xeroContact.EmailAddress}
                          </p>
                        )}
                        {xeroContact.ContactNumber && (
                          <p className="text-xs text-muted-foreground font-mono">
                            #{xeroContact.ContactNumber}
                          </p>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        {xeroContact.ContactStatus && (
                          <Badge
                            variant={
                              xeroContact.ContactStatus === "ACTIVE" ? "default" : "secondary"
                            }
                          >
                            {xeroContact.ContactStatus}
                          </Badge>
                        )}
                        <div className="flex gap-1">
                          {xeroContact.IsCustomer && (
                            <Badge variant="outline" className="text-xs">
                              Customer
                            </Badge>
                          )}
                          {xeroContact.IsSupplier && (
                            <Badge variant="outline" className="text-xs">
                              Supplier
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-4">
          <Button variant="outline" onClick={handleClose} disabled={linking}>
            Cancel
          </Button>
          <Button onClick={handleLink} disabled={!selectedXeroContact || linking}>
            {linking ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Linking...
              </>
            ) : (
              <>
                <LinkIcon className="mr-2 h-4 w-4" />
                Link Contact
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
