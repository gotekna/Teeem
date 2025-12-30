"use client";

import * as React from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Spinner } from "@/components/ui/spinner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Building2,
  Check,
  Link2,
  LinkIcon,
  Search,
  Unlink,
  User,
  ArrowRightLeft,
} from "lucide-react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Contact {
  id: number;
  display_name: string;
  entity_type: string | null;
  email: string | null;
  xero_linked_count?: number;
}

interface XeroLinkToContactSheetProps {
  isOpen: boolean;
  onClose: () => void;
  // Xero contact info (from the row)
  xeroName: string;
  xeroId: string | null;
  xeroTenantName: string | null;
  xeroLinkId: number | null;
  // Current TEEEM contact link (if any)
  currentContactId: number | null;
  currentContactName: string | null;
  synced: boolean;
  matchConfidence: number | null;
  // Callback
  onLinkChanged: () => void;
}

export function XeroLinkToContactSheet({
  isOpen,
  onClose,
  xeroName,
  xeroId,
  xeroTenantName,
  xeroLinkId,
  currentContactId,
  currentContactName,
  synced,
  matchConfidence,
  onLinkChanged,
}: XeroLinkToContactSheetProps) {
  const [search, setSearch] = React.useState("");
  const [searchResults, setSearchResults] = React.useState<Contact[]>([]);
  const [searching, setSearching] = React.useState(false);
  const [linking, setLinking] = React.useState(false);
  const [unlinking, setUnlinking] = React.useState(false);
  const [showUnlinkConfirm, setShowUnlinkConfirm] = React.useState(false);

  // Reset state when sheet opens
  React.useEffect(() => {
    if (isOpen) {
      setSearch("");
      setSearchResults([]);
    }
  }, [isOpen]);

  // Debounce timer ref
  const searchTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  // Search for TEEEM contacts with debounce
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearch(value);

    // Clear previous timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (!value.trim()) {
      setSearchResults([]);
      setSearching(false);
      return;
    }

    setSearching(true);

    // Debounce the API call
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const response = await api.get<{
          success: boolean;
          data: { records: Contact[] };
        }>(`/api/v1/contacts?q=${encodeURIComponent(value)}&per_page=10`);

        if (response?.success && response?.data?.records) {
          // Filter out the currently linked contact
          const filtered = response.data.records.filter(
            (c) => c.id !== currentContactId
          );
          setSearchResults(filtered);
        }
      } catch (error) {
        console.error("Search failed:", error);
      } finally {
        setSearching(false);
      }
    }, 300);
  };

  // Cleanup timeout on unmount
  React.useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  // Link Xero contact to a TEEEM contact
  const handleLinkToContact = async (contactId: number) => {
    if (!xeroId) {
      toast.error("Missing Xero contact ID");
      return;
    }

    setLinking(true);
    try {
      // If already linked, we need to transfer the link
      if (currentContactId && xeroLinkId) {
        const response = await api.post<{ success: boolean }>(
          `/api/v1/contacts/${currentContactId}/xero_links/${xeroLinkId}/transfer`,
          { target_contact_id: contactId }
        );
        if (response?.success) {
          toast.success("Link transferred successfully");
          onLinkChanged();
          onClose();
        }
      } else {
        // Create new link
        const response = await api.post<{ success: boolean }>(
          `/api/v1/xero/link_unlinked_contact`,
          {
            xero_contact_id: xeroId,
            contact_id: contactId,
          }
        );
        if (response?.success) {
          toast.success("Linked successfully");
          onLinkChanged();
          onClose();
        }
      }
    } catch (error) {
      console.error("Link failed:", error);
      toast.error("Failed to link contact");
    } finally {
      setLinking(false);
    }
  };

  // Unlink the Xero contact
  const handleUnlink = async () => {
    if (!currentContactId || !xeroLinkId) {
      toast.error("No link to remove");
      return;
    }

    setUnlinking(true);
    try {
      const response = await api.delete<{ success: boolean }>(
        `/api/v1/contacts/${currentContactId}/xero_links/${xeroLinkId}`
      );
      if (response?.success) {
        toast.success("Unlinked successfully");
        onLinkChanged();
        onClose();
      }
    } catch (error) {
      console.error("Unlink failed:", error);
      toast.error("Failed to unlink contact");
    } finally {
      setUnlinking(false);
      setShowUnlinkConfirm(false);
    }
  };

  return (
    <>
      <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <SheetContent side="right" className="w-[450px] sm:w-[540px] p-0">
          <SheetHeader className="p-6 pb-4 border-b">
            <SheetTitle className="flex items-center gap-2">
              <LinkIcon className="h-5 w-5 text-blue-500" />
              Manage Xero Link
            </SheetTitle>
            <SheetDescription>
              Change which TEEEM contact this Xero contact is linked to
            </SheetDescription>
          </SheetHeader>

          <div className="flex flex-col h-[calc(100vh-120px)]">
            {/* Xero Contact Info */}
            <div className="p-4 border-b bg-blue-50 dark:bg-blue-950/30">
              <div className="text-xs font-semibold text-blue-700 dark:text-blue-300 mb-2">
                Xero Contact
              </div>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded">
                  <Building2 className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <div className="font-semibold">{xeroName}</div>
                  {xeroTenantName && (
                    <div className="text-sm text-muted-foreground">
                      {xeroTenantName}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Current Link */}
            {synced && currentContactName && (
              <div className="p-4 border-b bg-green-50 dark:bg-green-950/30">
                <div className="text-xs font-semibold text-green-700 dark:text-green-300 mb-2">
                  Currently Linked To
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-green-100 dark:bg-green-900 rounded">
                      <User className="h-5 w-5 text-green-600 dark:text-green-400" />
                    </div>
                    <div>
                      <div className="font-semibold">{currentContactName}</div>
                      {matchConfidence !== null && (
                        <div className="text-xs text-muted-foreground">
                          Match confidence: {matchConfidence}%
                        </div>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowUnlinkConfirm(true)}
                    disabled={unlinking}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    {unlinking ? (
                      <Spinner size={14} className="mr-1" />
                    ) : (
                      <Unlink className="h-4 w-4 mr-1" />
                    )}
                    Unlink
                  </Button>
                </div>
              </div>
            )}

            {/* Search Section */}
            <div className="p-4 border-b">
              <div className="text-xs font-semibold text-muted-foreground mb-2">
                {synced ? "Change Link To" : "Link To TEEEM Contact"}
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search TEEEM contacts..."
                  value={search}
                  onChange={handleSearchChange}
                  className="pl-9"
                />
              </div>
            </div>

            {/* Search Results */}
            <ScrollArea className="flex-1">
              <div className="p-4 space-y-2">
                {searching ? (
                  <div className="flex items-center justify-center py-8">
                    <Spinner size={24} className="text-muted-foreground" />
                  </div>
                ) : searchResults.length > 0 ? (
                  searchResults.map((contact) => (
                    <div
                      key={contact.id}
                      className="flex items-center gap-3 p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <div className="p-2 bg-muted rounded">
                        {contact.entity_type === "company" ? (
                          <Building2 className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <User className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">
                          {contact.display_name}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          {contact.entity_type && (
                            <Badge variant="outline" className="text-xs">
                              {contact.entity_type}
                            </Badge>
                          )}
                          {contact.xero_linked_count && contact.xero_linked_count > 0 && (
                            <span className="flex items-center gap-1 text-green-600">
                              <Check className="h-3 w-3" />
                              linked
                            </span>
                          )}
                        </div>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => handleLinkToContact(contact.id)}
                        disabled={linking}
                      >
                        {linking ? (
                          <Spinner size={14} />
                        ) : synced ? (
                          <>
                            <ArrowRightLeft className="h-4 w-4 mr-1" />
                            Transfer
                          </>
                        ) : (
                          <>
                            <Link2 className="h-4 w-4 mr-1" />
                            Link
                          </>
                        )}
                      </Button>
                    </div>
                  ))
                ) : search.trim() ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No contacts found matching "{search}"
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    Start typing to search for TEEEM contacts
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>
        </SheetContent>
      </Sheet>

      {/* Unlink Confirmation Dialog */}
      <AlertDialog open={showUnlinkConfirm} onOpenChange={setShowUnlinkConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unlink Xero Contact?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the link between "{xeroName}" and "{currentContactName}".
              The Xero contact will appear as unlinked.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleUnlink}
              className="bg-red-600 hover:bg-red-700"
            >
              {unlinking ? <Spinner size={14} className="mr-1" /> : null}
              Unlink
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
