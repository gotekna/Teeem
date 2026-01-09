"use client";

import { useState, useEffect } from "react";
import {
  Search,
  Link as LinkIcon,
  CheckCircle,
  Building2,
} from "lucide-react";
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
import { Spinner } from "@/components/ui/spinner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api } from "@/lib/api";
import type { XeroContact } from "@/types/xero";

interface XeroTenant {
  tenant_id: string;
  tenant_name: string;
  connection_status?: string;
}

interface XeroLink {
  id: number;
  tenant_id: string;
  tenant_name: string;
  external_contact_id: string;
}

interface LinkXeroContactModalProps {
  isOpen: boolean;
  onClose: () => void;
  contact: {
    id: number;
    display_name: string;
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

  // Tenant selection state
  const [availableTenants, setAvailableTenants] = useState<XeroTenant[]>([]);
  const [existingLinks, setExistingLinks] = useState<XeroLink[]>([]);
  const [selectedTenant, setSelectedTenant] = useState<string | null>(null);
  const [loadingTenants, setLoadingTenants] = useState(false);

  // Load tenants and existing links when modal opens
  useEffect(() => {
    if (isOpen) {
      loadTenants();
      loadExistingLinks();
    }
  }, [isOpen, contact.id]);

  const loadTenants = async () => {
    setLoadingTenants(true);
    try {
      const response = await api.get<{ success: boolean; tenants: XeroTenant[] }>(
        "/api/v1/xero/tenants"
      );
      if (response?.success && response.tenants) {
        setAvailableTenants(response.tenants);
      }
    } catch (err) {
      console.error("Failed to load tenants:", err);
    } finally {
      setLoadingTenants(false);
    }
  };

  const loadExistingLinks = async () => {
    try {
      const response = await api.get<{ success: boolean; xero_links: XeroLink[] }>(
        `/api/v1/contacts/${contact.id}/xero_links`
      );
      if (response?.success && response.xero_links) {
        setExistingLinks(response.xero_links);
      }
    } catch (err) {
      console.error("Failed to load existing links:", err);
    }
  };

  // Filter out already-linked tenants
  const unlinkedTenants = availableTenants.filter(
    (t) => !existingLinks.some((l) => l.tenant_id === t.tenant_id)
  );

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim() || !selectedTenant) return;

    setSearching(true);
    setError(null);
    setSelectedXeroContact(null);
    try {
      const response = await api.get<{ success: boolean; contacts: XeroContact[] }>(
        `/api/v1/xero/search_contacts?query=${encodeURIComponent(searchQuery)}&tenant_id=${selectedTenant}`
      );
      if (response?.success) {
        setSearchResults(response.contacts || []);
        if (!response.contacts || response.contacts.length === 0) {
          setError("No Xero contacts found matching your search in this organization");
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
    if (!selectedXeroContact || !selectedTenant) return;

    setLinking(true);
    setError(null);
    try {
      const response = await api.post<{ success: boolean; xero_link: any; message: string }>(
        `/api/v1/contacts/${contact.id}/link_to_xero_tenant`,
        {
          tenant_id: selectedTenant,
          xero_contact_id: selectedXeroContact.ContactID,
        }
      );

      if (response?.success) {
        onSuccess(response.xero_link);
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
    setSelectedTenant(null);
    setError(null);
    onClose();
  };

  const handleTenantChange = (value: string) => {
    setSelectedTenant(value);
    setSearchResults([]);
    setSelectedXeroContact(null);
    setError(null);
  };

  const selectedTenantName = availableTenants.find(t => t.tenant_id === selectedTenant)?.tenant_name;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <LinkIcon className="h-5 w-5" />
            Link {contact.display_name} to Xero Contact
          </DialogTitle>
          <DialogDescription>
            Select a Xero organization and search for the corresponding contact to link.
          </DialogDescription>
        </DialogHeader>

        {/* Already Linked Orgs */}
        {existingLinks.length > 0 && (
          <div className="bg-muted/50 p-3 rounded-lg">
            <p className="text-sm text-muted-foreground mb-2">Already linked to:</p>
            <div className="flex flex-wrap gap-2">
              {existingLinks.map((link) => (
                <Badge key={link.id} variant="secondary">
                  <Building2 className="h-3 w-3 mr-1" />
                  {link.tenant_name}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Tenant Selector */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Select Xero Organization</label>
          {loadingTenants ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Spinner size={16} />
              Loading organizations...
            </div>
          ) : unlinkedTenants.length === 0 ? (
            <div className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg">
              This contact is already linked to all available Xero organizations.
            </div>
          ) : (
            <Select value={selectedTenant || ""} onValueChange={handleTenantChange}>
              <SelectTrigger>
                <SelectValue placeholder="Select a Xero organization..." />
              </SelectTrigger>
              <SelectContent>
                {unlinkedTenants.map((tenant) => (
                  <SelectItem key={tenant.tenant_id} value={tenant.tenant_id}>
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4" />
                      {tenant.tenant_name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {/* Search Form - only show after tenant selected */}
        {selectedTenant && (
          <form onSubmit={handleSearch} className="flex gap-2">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder={`Search contacts in ${selectedTenantName}...`}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
                disabled={searching}
              />
            </div>
            <Button type="submit" disabled={searching || !searchQuery.trim()}>
              {searching ? (
                <>
                  <Spinner size={16} className="mr-2" />
                  Searching...
                </>
              ) : (
                "Search"
              )}
            </Button>
          </form>
        )}

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
              Found {searchResults.length} contact{searchResults.length !== 1 ? "s" : ""} in {selectedTenantName}
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
          <Button onClick={handleLink} disabled={!selectedXeroContact || !selectedTenant || linking}>
            {linking ? (
              <>
                <Spinner size={16} className="mr-2" />
                Linking...
              </>
            ) : (
              <>
                <LinkIcon className="mr-2 h-4 w-4" />
                Link to {selectedTenantName || "Xero"}
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
