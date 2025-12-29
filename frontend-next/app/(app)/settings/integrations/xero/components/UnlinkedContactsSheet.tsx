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
  AlertTriangle,
  Check,
  ChevronRight,
  Copy,
  FileText,
  Globe,
  Link2,
  Mail,
  MapPin,
  Phone,
  Plus,
  Search,
  Sparkles,
  User,
  X,
} from "lucide-react";
import { api } from "@/lib/api";
import { toast } from "sonner";

interface PotentialMatch {
  id: number;
  name: string;
  match_type: "exact" | "company_exact" | "partial" | "word";
  score: number;
}

interface XeroPhone {
  type: string;
  number: string;
}

interface XeroAddress {
  type: string;
  lines: string[];
  formatted: string;
}

interface XeroDetails {
  email?: string;
  phones?: XeroPhone[];
  addresses?: XeroAddress[];
  website?: string;
  tax_number?: string;
  first_name?: string;
  last_name?: string;
}

interface UnlinkedContact {
  xero_contact_name: string;
  xero_contact_id: string;
  invoice_count: number;
  total_amount: number;
  potential_matches: PotentialMatch[];
  best_match: PotentialMatch | null;
  xero_details?: XeroDetails | null;
}

interface UnlinkedContactsData {
  total_unlinked: number;
  total_invoices: number;
  contacts: UnlinkedContact[];
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onLinked?: () => void;
}

export function UnlinkedContactsSheet({ isOpen, onClose, onLinked }: Props) {
  const [loading, setLoading] = React.useState(true);
  const [data, setData] = React.useState<UnlinkedContactsData | null>(null);
  const [search, setSearch] = React.useState("");
  const [linking, setLinking] = React.useState<string | null>(null);
  const [autoMatching, setAutoMatching] = React.useState(false);
  const [expandedContact, setExpandedContact] = React.useState<string | null>(null);

  const fetchData = React.useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.get<{ success: boolean; data: UnlinkedContactsData }>(
        "/api/v1/xero/unlinked_contacts"
      );
      console.log("Unlinked contacts response:", response);
      if (response?.success && response?.data) {
        setData(response.data);
      } else {
        console.error("Invalid response format:", response);
        toast.error("Invalid response from server");
      }
    } catch (error) {
      console.error("Failed to fetch unlinked contacts:", error);
      toast.error("Failed to load unlinked contacts");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    if (isOpen) {
      fetchData();
    }
  }, [isOpen, fetchData]);

  const handleLink = async (xeroContactName: string, contactId: number) => {
    setLinking(xeroContactName);
    try {
      const response = await api.post<{ success: boolean; data: { invoices_linked: number } }>(
        "/api/v1/xero/link_unlinked_contact",
        { xero_contact_name: xeroContactName, contact_id: contactId }
      );
      if (response?.success) {
        toast.success(`Linked ${response.data.invoices_linked} invoices`);
        fetchData();
        onLinked?.();
      }
    } catch (error) {
      console.error("Failed to link contact:", error);
      toast.error("Failed to link contact");
    } finally {
      setLinking(null);
    }
  };

  const handleCreateNew = async (xeroContactName: string) => {
    setLinking(xeroContactName);
    try {
      const response = await api.post<{
        success: boolean;
        data: { contact_id: number; invoices_linked: number };
      }>("/api/v1/xero/link_unlinked_contact", {
        xero_contact_name: xeroContactName,
        create_new: true,
      });
      if (response?.success) {
        toast.success(
          `Created new contact and linked ${response.data.invoices_linked} invoices`
        );
        fetchData();
        onLinked?.();
      }
    } catch (error) {
      console.error("Failed to create contact:", error);
      toast.error("Failed to create contact");
    } finally {
      setLinking(null);
    }
  };

  const handleAutoMatch = async () => {
    setAutoMatching(true);
    try {
      const response = await api.post<{
        success: boolean;
        data: { matched_count: number; skipped_count: number };
      }>("/api/v1/xero/auto_match_contacts");
      if (response?.success) {
        const { matched_count } = response.data;
        if (matched_count > 0) {
          toast.success(`Auto-matched ${matched_count} contacts`);
          fetchData();
          onLinked?.();
        } else {
          toast.info("No exact matches found");
        }
      }
    } catch (error) {
      console.error("Failed to auto-match:", error);
      toast.error("Failed to auto-match contacts");
    } finally {
      setAutoMatching(false);
    }
  };

  const filteredContacts = React.useMemo(() => {
    if (!data?.contacts) return [];
    if (!search.trim()) return data.contacts;
    const searchLower = search.toLowerCase();
    return data.contacts.filter(
      (c) =>
        c.xero_contact_name.toLowerCase().includes(searchLower) ||
        c.potential_matches.some((m) => m.name.toLowerCase().includes(searchLower))
    );
  }, [data?.contacts, search]);

  const getMatchBadge = (matchType: string, score: number) => {
    if (matchType === "exact" || score === 100) {
      return (
        <Badge className="bg-green-100 text-green-800 text-xs">
          <Check className="h-3 w-3 mr-1" />
          Exact
        </Badge>
      );
    }
    if (matchType === "company_exact" || score >= 90) {
      return (
        <Badge className="bg-blue-100 text-blue-800 text-xs">Company Match</Badge>
      );
    }
    if (score >= 50) {
      return (
        <Badge className="bg-amber-100 text-amber-800 text-xs">Partial</Badge>
      );
    }
    return <Badge variant="secondary" className="text-xs">Possible</Badge>;
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-AU", {
      style: "currency",
      currency: "AUD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right-half" className="p-0">
        <SheetHeader className="p-6 pb-4 border-b">
          <SheetTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Unlinked Xero Contacts
          </SheetTitle>
          <SheetDescription>
            {data ? (
              <>
                {data.total_unlinked} Xero contacts with {data.total_invoices} invoices
                need to be linked to TEEEM contacts
              </>
            ) : (
              "Loading..."
            )}
          </SheetDescription>
        </SheetHeader>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <Spinner size={32} className="text-muted-foreground" />
          </div>
        ) : (
          <div className="flex flex-col h-full">
            {/* Actions Bar */}
            <div className="p-4 border-b space-y-3">
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search contacts..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <Button
                  onClick={handleAutoMatch}
                  disabled={autoMatching}
                  className="shrink-0"
                >
                  {autoMatching ? (
                    <Spinner size={16} className="mr-2" />
                  ) : (
                    <Sparkles className="h-4 w-4 mr-2" />
                  )}
                  Auto-Match
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Exact matches are linked automatically during sync. Click to re-scan remaining contacts.
              </p>
            </div>

            {/* Contacts List */}
            <ScrollArea className="flex-1">
              <div className="p-4 space-y-2">
                {filteredContacts.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    {search ? "No contacts match your search" : "All contacts are linked!"}
                  </div>
                ) : (
                  filteredContacts.map((contact) => (
                    <div
                      key={contact.xero_contact_name}
                      className="border rounded-lg overflow-hidden"
                    >
                      {/* Contact Header */}
                      <button
                        onClick={() =>
                          setExpandedContact(
                            expandedContact === contact.xero_contact_name
                              ? null
                              : contact.xero_contact_name
                          )
                        }
                        className="w-full p-3 flex items-center justify-between hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-amber-100 rounded">
                            <User className="h-4 w-4 text-amber-600" />
                          </div>
                          <div className="text-left">
                            <div className="font-medium">{contact.xero_contact_name}</div>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <FileText className="h-3 w-3" />
                              <span>{contact.invoice_count} invoices</span>
                              <span className="text-muted-foreground/50">|</span>
                              <span>{formatCurrency(contact.total_amount)}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {contact.best_match && (
                            <Badge
                              className={`text-xs ${
                                contact.best_match.score === 100
                                  ? "bg-green-100 text-green-800"
                                  : "bg-blue-100 text-blue-800"
                              }`}
                            >
                              {contact.potential_matches.length} match
                              {contact.potential_matches.length !== 1 ? "es" : ""}
                            </Badge>
                          )}
                          <ChevronRight
                            className={`h-4 w-4 text-muted-foreground transition-transform ${
                              expandedContact === contact.xero_contact_name
                                ? "rotate-90"
                                : ""
                            }`}
                          />
                        </div>
                      </button>

                      {/* Expanded Content */}
                      {expandedContact === contact.xero_contact_name && (
                        <div className="border-t bg-muted/30 p-3 space-y-3">
                          {/* Xero Contact Details - Show when available */}
                          {contact.xero_details && (
                            <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-3 space-y-2">
                              <div className="text-xs font-semibold text-blue-700 dark:text-blue-300 flex items-center gap-1">
                                <FileText className="h-3 w-3" />
                                Xero Contact Details (copy to new contact)
                              </div>

                              {/* Email */}
                              {contact.xero_details.email && (
                                <div className="flex items-center gap-2 text-sm">
                                  <Mail className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                  <span className="truncate flex-1">{contact.xero_details.email}</span>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 w-6 p-0 shrink-0"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      navigator.clipboard.writeText(contact.xero_details!.email!);
                                      toast.success("Email copied");
                                    }}
                                  >
                                    <Copy className="h-3 w-3" />
                                  </Button>
                                </div>
                              )}

                              {/* Phones */}
                              {contact.xero_details.phones && contact.xero_details.phones.length > 0 && (
                                <div className="space-y-1">
                                  {contact.xero_details.phones.map((phone, idx) => (
                                    <div key={idx} className="flex items-center gap-2 text-sm">
                                      <Phone className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                      <span className="text-xs text-muted-foreground capitalize shrink-0">
                                        ({phone.type || "phone"})
                                      </span>
                                      <span className="truncate flex-1">{phone.number}</span>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-6 w-6 p-0 shrink-0"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          navigator.clipboard.writeText(phone.number);
                                          toast.success("Phone copied");
                                        }}
                                      >
                                        <Copy className="h-3 w-3" />
                                      </Button>
                                    </div>
                                  ))}
                                </div>
                              )}

                              {/* Addresses */}
                              {contact.xero_details.addresses && contact.xero_details.addresses.length > 0 && (
                                <div className="space-y-1">
                                  {contact.xero_details.addresses.map((addr, idx) => (
                                    <div key={idx} className="flex items-start gap-2 text-sm">
                                      <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
                                      <span className="text-xs text-muted-foreground capitalize shrink-0">
                                        ({addr.type || "address"})
                                      </span>
                                      <span className="flex-1 text-xs leading-relaxed">{addr.formatted}</span>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-6 w-6 p-0 shrink-0"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          navigator.clipboard.writeText(addr.formatted);
                                          toast.success("Address copied");
                                        }}
                                      >
                                        <Copy className="h-3 w-3" />
                                      </Button>
                                    </div>
                                  ))}
                                </div>
                              )}

                              {/* Website */}
                              {contact.xero_details.website && (
                                <div className="flex items-center gap-2 text-sm">
                                  <Globe className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                  <span className="truncate flex-1">{contact.xero_details.website}</span>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 w-6 p-0 shrink-0"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      navigator.clipboard.writeText(contact.xero_details!.website!);
                                      toast.success("Website copied");
                                    }}
                                  >
                                    <Copy className="h-3 w-3" />
                                  </Button>
                                </div>
                              )}

                              {/* No details message */}
                              {!contact.xero_details.email &&
                               (!contact.xero_details.phones || contact.xero_details.phones.length === 0) &&
                               (!contact.xero_details.addresses || contact.xero_details.addresses.length === 0) &&
                               !contact.xero_details.website && (
                                <div className="text-xs text-muted-foreground italic">
                                  No contact details stored in Xero
                                </div>
                              )}
                            </div>
                          )}

                          {/* Potential Matches */}
                          {contact.potential_matches.length > 0 ? (
                            <>
                              <div className="text-xs font-medium text-muted-foreground mb-2">
                                Potential TEEEM Matches:
                              </div>
                              {contact.potential_matches.map((match) => (
                                <div
                                  key={match.id}
                                  className="flex items-center gap-2 p-2 bg-background rounded-lg border"
                                >
                                  <div className="flex items-center gap-2 min-w-0 flex-1 overflow-hidden">
                                    <span className="shrink-0">{getMatchBadge(match.match_type, match.score)}</span>
                                    <span className="font-medium truncate">{match.name}</span>
                                  </div>
                                  <Button
                                    size="sm"
                                    className="shrink-0 ml-auto"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleLink(contact.xero_contact_name, match.id);
                                    }}
                                    disabled={linking === contact.xero_contact_name}
                                  >
                                    {linking === contact.xero_contact_name ? (
                                      <Spinner size={12} />
                                    ) : (
                                      <>
                                        <Link2 className="h-3 w-3 mr-1" />
                                        Link
                                      </>
                                    )}
                                  </Button>
                                </div>
                              ))}
                            </>
                          ) : (
                            <div className="text-sm text-muted-foreground">
                              No potential matches found in TEEEM.
                            </div>
                          )}

                          {/* Create New Button */}
                          <div className="pt-2 border-t mt-3">
                            <Button
                              variant="outline"
                              size="sm"
                              className="w-full"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCreateNew(contact.xero_contact_name);
                              }}
                              disabled={linking === contact.xero_contact_name}
                            >
                              {linking === contact.xero_contact_name ? (
                                <Spinner size={12} className="mr-1" />
                              ) : (
                                <Plus className="h-3 w-3 mr-1" />
                              )}
                              Create New Contact
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
