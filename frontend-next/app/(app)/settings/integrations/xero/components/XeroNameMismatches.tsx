"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import {
  Users,
  Building2,
  AlertTriangle,
  RefreshCw,
  Upload,
  Check,
  X,
  ExternalLink,
} from "lucide-react";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";

interface MismatchLink {
  link_id: number;
  xero_org_id: string;
  tenant_name: string;
  external_name: string;
  external_contact_id: string;
  match_confidence: number | null;
  match_type: string | null;
  sync_enabled: boolean;
  is_mismatch: boolean;
}

interface MismatchContact {
  id: number;
  display_name: string;
  entity_type: string;
  email: string | null;
  has_mismatch: boolean;
  links: MismatchLink[];
}

interface NameMismatchesResponse {
  success: boolean;
  data: {
    total_count: number;
    contacts: MismatchContact[];
  };
  error?: string;
}

export function XeroNameMismatches() {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [contacts, setContacts] = React.useState<MismatchContact[]>([]);
  const [totalCount, setTotalCount] = React.useState(0);
  const [pushingLinks, setPushingLinks] = React.useState<Set<number>>(new Set());

  const fetchMismatches = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get<NameMismatchesResponse>("/api/v1/xero/name_mismatches");
      if (response.success && response.data) {
        setContacts(response.data.contacts);
        setTotalCount(response.data.total_count);
      } else {
        setError(response.error || "Failed to fetch name mismatches");
      }
    } catch (err) {
      console.error("Error fetching name mismatches:", err);
      setError("Failed to fetch name mismatches");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchMismatches();
  }, [fetchMismatches]);

  // Push TEEEM name to Xero for a single link
  const handlePushSingleLink = async (linkId: number, contactName: string) => {
    setPushingLinks((prev) => new Set(prev).add(linkId));
    try {
      const response = await api.post<{
        success: boolean;
        data: { success: number; failed: number; errors: Array<{ error: string }> };
      }>("/api/v1/xero/push_contact_names", { xero_link_ids: [linkId] });

      if ((response?.data?.success ?? 0) > 0) {
        toast({ title: "Updated", description: `Pushed "${contactName}" to Xero` });
        // Refresh to show updated state
        fetchMismatches();
      } else {
        const err = response?.data?.errors?.[0]?.error || "Failed to push";
        toast({ title: "Failed", description: err, variant: "destructive" });
      }
    } catch (err) {
      toast({ title: "Error", description: "Failed to push name to Xero", variant: "destructive" });
    } finally {
      setPushingLinks((prev) => {
        const next = new Set(prev);
        next.delete(linkId);
        return next;
      });
    }
  };

  // Push TEEEM name to ALL mismatched links for a contact
  const handlePushAllForContact = async (contact: MismatchContact) => {
    const mismatchedLinkIds = contact.links
      .filter((l) => l.is_mismatch)
      .map((l) => l.link_id);

    if (mismatchedLinkIds.length === 0) return;

    // Mark all as pushing
    setPushingLinks((prev) => {
      const next = new Set(prev);
      mismatchedLinkIds.forEach((id) => next.add(id));
      return next;
    });

    try {
      const response = await api.post<{
        success: boolean;
        data: { success: number; failed: number; errors: Array<{ error: string }> };
      }>("/api/v1/xero/push_contact_names", { xero_link_ids: mismatchedLinkIds });

      if (response?.data) {
        const { success: ok, failed } = response.data;
        if (failed === 0) {
          toast({
            title: "Updated",
            description: `Pushed "${contact.display_name}" to ${ok} Xero org${ok !== 1 ? "s" : ""}`,
          });
        } else {
          toast({
            title: `${ok} updated, ${failed} failed`,
            description: response.data.errors?.[0]?.error || "Some updates failed",
            variant: "default",
          });
        }
        fetchMismatches();
      }
    } catch (err) {
      toast({ title: "Error", description: "Failed to push names to Xero", variant: "destructive" });
    } finally {
      setPushingLinks((prev) => {
        const next = new Set(prev);
        mismatchedLinkIds.forEach((id) => next.delete(id));
        return next;
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <Spinner size={32} className="text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center h-48 gap-4">
          <AlertTriangle className="h-8 w-8 text-amber-500" />
          <p className="text-muted-foreground">{error}</p>
          <Button variant="outline" onClick={fetchMismatches}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
                Name Mismatches
              </CardTitle>
              <CardDescription>
                Contacts where TEEEM name differs from Xero name. Push TEEEM name to Xero or click the contact to re-link.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Badge className={cn(
                "hover:bg-current",
                totalCount > 0
                  ? "bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300"
                  : "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300"
              )}>
                {totalCount} {totalCount === 1 ? "Mismatch" : "Mismatches"}
              </Badge>
              <Button variant="ghost" size="sm" onClick={fetchMismatches}>
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {contacts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Check className="h-12 w-12 text-green-500/50 mb-4" />
              <p className="text-muted-foreground">All Xero contact names match TEEEM.</p>
              <p className="text-sm text-muted-foreground mt-1">
                No action needed.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {contacts.map((contact) => {
                const mismatchCount = contact.links.filter((l) => l.is_mismatch).length;
                return (
                  <div
                    key={contact.id}
                    className="border rounded-lg p-4 space-y-3"
                  >
                    {/* Contact Header */}
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
                          {contact.entity_type === "company" ? (
                            <Building2 className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                          ) : (
                            <Users className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                          )}
                        </div>
                        <div>
                          <button
                            className="font-medium hover:underline text-primary text-left"
                            onClick={() => router.push(`/contacts/${contact.id}`)}
                          >
                            {contact.display_name}
                          </button>
                          <div className="flex items-center gap-3 text-sm text-muted-foreground">
                            <Badge variant="outline" className="text-xs">
                              {contact.entity_type || "unknown"}
                            </Badge>
                            {contact.email && (
                              <span className="text-xs">{contact.email}</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className="bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 hover:bg-amber-100">
                          {mismatchCount} / {contact.links.length} differ
                        </Badge>
                        {mismatchCount > 1 && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handlePushAllForContact(contact)}
                            disabled={contact.links.some((l) => pushingLinks.has(l.link_id))}
                            className="text-blue-600 dark:text-blue-400 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/30"
                          >
                            <Upload className="h-3 w-3 mr-1" />
                            Push All to Xero
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* Xero Links */}
                    <div className="pl-12 space-y-2">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        Xero Links
                      </p>
                      <div className="grid gap-2">
                        {contact.links.map((link) => (
                          <div
                            key={link.link_id}
                            className={cn(
                              "flex items-center justify-between p-2 rounded text-sm",
                              link.is_mismatch
                                ? "bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800"
                                : "bg-muted"
                            )}
                          >
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                              <span className="font-medium shrink-0">{link.tenant_name}</span>
                              <span className="text-muted-foreground shrink-0">→</span>
                              <span
                                className={cn(
                                  "truncate",
                                  link.is_mismatch
                                    ? "text-amber-700 dark:text-amber-300 font-medium"
                                    : "text-muted-foreground"
                                )}
                              >
                                {link.external_name || "—"}
                              </span>
                              {link.is_mismatch && (
                                <X className="h-3 w-3 text-amber-500 shrink-0" />
                              )}
                              {!link.is_mismatch && (
                                <Check className="h-3 w-3 text-green-500 shrink-0" />
                              )}
                            </div>
                            <div className="flex items-center gap-2 shrink-0 ml-2">
                              {link.is_mismatch && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() =>
                                    handlePushSingleLink(link.link_id, contact.display_name)
                                  }
                                  disabled={pushingLinks.has(link.link_id)}
                                  className="h-7 px-2 text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/30"
                                >
                                  {pushingLinks.has(link.link_id) ? (
                                    <Spinner size={12} className="mr-1" />
                                  ) : (
                                    <Upload className="h-3 w-3 mr-1" />
                                  )}
                                  Push
                                </Button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
