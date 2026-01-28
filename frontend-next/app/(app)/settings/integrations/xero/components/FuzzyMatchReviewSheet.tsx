"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { ExpandChevron } from "@/components/ui/expand-chevron";
import {
  CheckCircle2,
  ArrowRight,
  AlertTriangle,
  RefreshCw,
  Search,
  ArrowRightLeft,
  Plus,
  Building2,
  User,
} from "lucide-react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

interface PendingReviewItem {
  id: number;
  contact_id: number;
  contact_name: string;
  tenant_id: string;
  tenant_name: string;
  external_contact_id: string;
  external_contact_name: string;
  match_type: string;
  match_confidence: number;
  created_at: string;
}

interface Contact {
  id: number;
  display_name: string;
  entity_type: string | null;
  email?: string | null;
  primary_company?: {
    id: number;
    name: string;
  } | null;
}

interface FuzzyMatchReviewSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onReviewed: () => void;
}

export function FuzzyMatchReviewSheet({
  open,
  onOpenChange,
  onReviewed,
}: FuzzyMatchReviewSheetProps) {
  const router = useRouter();
  const [loading, setLoading] = React.useState(true);
  const [items, setItems] = React.useState<PendingReviewItem[]>([]);
  const [processingId, setProcessingId] = React.useState<number | null>(null);

  // For "Change" functionality
  const [changingItem, setChangingItem] = React.useState<PendingReviewItem | null>(null);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [searchResults, setSearchResults] = React.useState<Contact[]>([]);
  const [searching, setSearching] = React.useState(false);
  const [collapsedCompanies, setCollapsedCompanies] = React.useState<Set<string>>(new Set());

  const fetchPendingReviews = React.useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.get<{
        success: boolean;
        pending_count: number;
        links: PendingReviewItem[];
      }>("/api/v1/xero_links/pending_review");

      if (response?.success) {
        setItems(response.links || []);
      }
    } catch (error) {
      console.error("Failed to fetch pending reviews:", error);
      toast.error("Failed to load pending reviews");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    if (open) {
      fetchPendingReviews();
    }
  }, [open, fetchPendingReviews]);

  // Search contacts when query changes
  React.useEffect(() => {
    if (!changingItem || searchQuery.length < 2) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setSearching(true);
      setCollapsedCompanies(new Set()); // Reset collapsed state on new search
      try {
        const response = await api.get<{ success: boolean; data: Contact[] }>(
          `/api/v1/contacts?search=${encodeURIComponent(searchQuery)}&include_companies=true&per_page=20`
        );
        if (response?.success && response.data) {
          // Filter out current contact
          const filtered = response.data.filter(
            (c) => c.id !== changingItem.contact_id
          );
          setSearchResults(filtered);
        }
      } catch (err) {
        console.error("Search failed:", err);
      } finally {
        setSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, changingItem]);

  // Group contacts by company for tree view
  const groupedContacts = React.useMemo(() => {
    const groups: Record<string, Contact[]> = {};

    searchResults.forEach((contact) => {
      const companyName = contact.primary_company?.name || "Other";
      if (!groups[companyName]) groups[companyName] = [];
      groups[companyName].push(contact);
    });

    // Sort: groups with more results first, "Other" last
    return Object.entries(groups).sort(([a, aContacts], [b, bContacts]) => {
      if (a === "Other") return 1;
      if (b === "Other") return -1;
      return bContacts.length - aContacts.length;
    });
  }, [searchResults]);

  const toggleCompany = (companyName: string) => {
    setCollapsedCompanies((prev) => {
      const next = new Set(prev);
      if (next.has(companyName)) {
        next.delete(companyName);
      } else {
        next.add(companyName);
      }
      return next;
    });
  };

  // Handle "New" - open contact page with prefilled name
  const handleCreateNew = (item: PendingReviewItem) => {
    const name = encodeURIComponent(item.external_contact_name);
    router.push(`/contacts/new?name=${name}`);
    onOpenChange(false);
  };

  const handleApprove = async (item: PendingReviewItem) => {
    setProcessingId(item.id);
    try {
      const response = await api.post<{ success: boolean; error?: string }>(
        `/api/v1/contacts/${item.contact_id}/xero_links/${item.id}/approve`
      );

      if (response?.success) {
        toast.success(`Approved: ${item.external_contact_name}`);
        setItems((prev) => prev.filter((i) => i.id !== item.id));
        onReviewed();
      } else {
        toast.error(response?.error || "Failed to approve");
      }
    } catch (error) {
      console.error("Error approving:", error);
      toast.error("Failed to approve match");
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (item: PendingReviewItem) => {
    setProcessingId(item.id);
    try {
      const response = await api.post<{ success: boolean; error?: string }>(
        `/api/v1/contacts/${item.contact_id}/xero_links/${item.id}/reject`
      );

      if (response?.success) {
        toast.success(`Rejected - will create new contact on next sync`);
        setItems((prev) => prev.filter((i) => i.id !== item.id));
        onReviewed();
      } else {
        toast.error(response?.error || "Failed to reject");
      }
    } catch (error) {
      console.error("Error rejecting:", error);
      toast.error("Failed to reject match");
    } finally {
      setProcessingId(null);
    }
  };

  const handleTransfer = async (item: PendingReviewItem, targetContact: Contact) => {
    setProcessingId(item.id);
    try {
      const response = await api.post<{ success: boolean; error?: string; message?: string }>(
        `/api/v1/contacts/${item.contact_id}/xero_links/${item.id}/transfer`,
        { target_contact_id: targetContact.id }
      );

      if (response?.success) {
        toast.success(`Linked "${item.external_contact_name}" → "${targetContact.display_name}"`);
        setItems((prev) => prev.filter((i) => i.id !== item.id));
        setChangingItem(null);
        setSearchQuery("");
        setSearchResults([]);
        onReviewed();
      } else {
        toast.error(response?.error || "Failed to transfer link");
      }
    } catch (error) {
      console.error("Error transferring:", error);
      toast.error("Failed to transfer link");
    } finally {
      setProcessingId(null);
    }
  };

  const startChange = (item: PendingReviewItem) => {
    setChangingItem(item);
    setSearchQuery("");
    setSearchResults([]);
  };

  const cancelChange = () => {
    setChangingItem(null);
    setSearchQuery("");
    setSearchResults([]);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Review Fuzzy Matches ({items.length})
          </DialogTitle>
          <DialogDescription>
            Approve correct matches, change to link to a different contact, or create new.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center h-48">
              <Spinner size={32} className="text-muted-foreground" />
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-center">
              <CheckCircle2 className="h-12 w-12 text-green-500 mb-4" />
              <p className="text-lg font-medium">All caught up!</p>
              <p className="text-sm text-muted-foreground mt-1">
                No more fuzzy matches need review.
              </p>
            </div>
          ) : (
            <ScrollArea className="h-[60vh]">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pr-4">
                {items.map((item) => {
                  const confidencePercent = Math.round((item.match_confidence || 0) * 100);
                  const isLowConfidence = confidencePercent < 70;
                  const isProcessing = processingId === item.id;
                  const isChanging = changingItem?.id === item.id;

                  return (
                    <div
                      key={item.id}
                      className={`p-4 border rounded-lg ${
                        isChanging
                          ? "border-blue-300 bg-blue-50/50 dark:border-blue-700 dark:bg-blue-950/20"
                          : isLowConfidence
                          ? "border-red-200 bg-red-50/50 dark:border-red-800 dark:bg-red-950/20"
                          : "border-border bg-card"
                      }`}
                    >
                      {/* Match visualization */}
                      <div className="flex items-center gap-2 mb-3">
                        <div className="flex-1 min-w-0">
                          <div className="text-xs text-muted-foreground mb-1">Xero</div>
                          <div className="font-medium text-sm truncate">
                            {item.external_contact_name}
                          </div>
                          <Badge variant="outline" className="text-xs mt-1">
                            {item.tenant_name}
                          </Badge>
                        </div>

                        <div className="flex flex-col items-center px-2">
                          <ArrowRight className="h-4 w-4 text-muted-foreground" />
                          <Badge
                            className={`text-xs mt-1 ${
                              isLowConfidence
                                ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
                                : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
                            }`}
                          >
                            {confidencePercent}%
                          </Badge>
                        </div>

                        <div className="flex-1 min-w-0 text-right">
                          <div className="text-xs text-muted-foreground mb-1">TEEEM</div>
                          <div className="font-medium text-sm truncate">
                            {item.contact_name || "Unknown"}
                          </div>
                        </div>
                      </div>

                      {/* Change mode - show search */}
                      {isChanging ? (
                        <div className="space-y-2">
                          <div className="relative">
                            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                              placeholder="Search for correct contact..."
                              value={searchQuery}
                              onChange={(e) => setSearchQuery(e.target.value)}
                              className="pl-8 h-9"
                              autoFocus
                            />
                          </div>

                          {searching && (
                            <div className="flex items-center justify-center py-2">
                              <Spinner size={16} />
                            </div>
                          )}

                          {groupedContacts.length > 0 && (
                            <div className="border rounded max-h-48 overflow-y-auto">
                              {groupedContacts.map(([companyName, contacts]) => {
                                const isCollapsed = collapsedCompanies.has(companyName);
                                return (
                                  <div key={companyName}>
                                    {/* Company header */}
                                    <div
                                      className="flex items-center gap-1.5 px-2 py-1.5 text-xs font-semibold bg-muted/50 cursor-pointer hover:bg-muted select-none sticky top-0"
                                      onClick={() => toggleCompany(companyName)}
                                    >
                                      <ExpandChevron expanded={!isCollapsed} size={12} />
                                      <Building2 className="h-3 w-3 text-muted-foreground" />
                                      <span className="flex-1 truncate">{companyName}</span>
                                      <span className="text-[10px] text-muted-foreground bg-muted px-1 py-0.5 rounded-full">
                                        {contacts.length}
                                      </span>
                                    </div>

                                    {/* Contacts in this company */}
                                    {!isCollapsed && contacts.map((contact) => (
                                      <button
                                        key={contact.id}
                                        onClick={() => handleTransfer(item, contact)}
                                        disabled={isProcessing}
                                        className={cn(
                                          "w-full text-left px-3 py-1.5 hover:bg-accent/50 text-sm flex items-center gap-2 pl-6",
                                          isProcessing && "opacity-50"
                                        )}
                                      >
                                        {contact.entity_type === "company" ? (
                                          <Building2 className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                                        ) : (
                                          <User className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                                        )}
                                        <span className="truncate flex-1">{contact.display_name}</span>
                                        <Badge variant="outline" className="text-[10px] ml-1 flex-shrink-0">
                                          {contact.entity_type || "contact"}
                                        </Badge>
                                      </button>
                                    ))}
                                  </div>
                                );
                              })}
                            </div>
                          )}

                          {searchQuery.length >= 2 && !searching && searchResults.length === 0 && (
                            <p className="text-xs text-muted-foreground text-center py-2">
                              No contacts found
                            </p>
                          )}

                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={cancelChange}
                            className="w-full"
                          >
                            Cancel
                          </Button>
                        </div>
                      ) : (
                        /* Normal actions */
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleCreateNew(item)}
                            disabled={isProcessing}
                            className="flex-1 text-xs"
                            title="Create new contact"
                          >
                            <Plus className="h-3 w-3 mr-1" />
                            New
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => startChange(item)}
                            disabled={isProcessing}
                            className="flex-1 text-xs"
                            title="Link to different contact"
                          >
                            <ArrowRightLeft className="h-3 w-3 mr-1" />
                            Change
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => handleApprove(item)}
                            disabled={isProcessing}
                            className="flex-1 bg-green-600 hover:bg-green-700 text-white text-xs"
                          >
                            {isProcessing ? (
                              <Spinner size={14} className="mr-1" />
                            ) : (
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                            )}
                            Approve
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          )}
        </div>

        {!loading && items.length > 0 && (
          <div className="pt-4 border-t">
            <Button
              variant="outline"
              className="w-full"
              onClick={fetchPendingReviews}
              disabled={loading}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
