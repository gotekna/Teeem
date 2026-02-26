"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { BackButton } from "@/components/ui/back-button";
import {
  Globe,
  Trash2,
  ShieldCheck,
  ChevronDown,
  AlertTriangle,
  Upload,
  Check,
} from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";

// Exported for use in other components (ContactFinancialTab)
// SSoT: Must match types/xero.ts XeroLink for compatibility with XeroTransactionsSection
export interface XeroLink {
  id: number;
  contact_id: number;
  xero_contact_id: string;
  xero_tenant_id: string;
  xero_tenant_name: string;
  sync_enabled: boolean;
  last_synced_at: string | null;
  created_at: string;
  updated_at: string;
  invoice_count?: number;
  external_name?: string | null;
}

interface XeroTenant {
  tenant_id: string;
  tenant_name: string;
  tenant_type: string;
}

export interface ContactHeaderProps {
  contact: {
    id: number;
    display_name: string;
    company_name: string | null;
    position: string | null;
    "is_supplier?": boolean;
    "is_customer?": boolean;
    is_family_member: boolean;
    xero_contact_id: string | null;
    email: string | null;
    website: string | null;
    // SSoT: Xero data from contact_external_links
    xero_linked_count?: number;
    xero_tenant_names?: string[];
    xero_customer?: boolean;
    xero_supplier?: boolean;
    xero_contact_types?: string[];
  };
  onDelete: () => void;
  onEnrichFromWeb: () => void;
  enrichingFromWeb: boolean;
  // SSoT: Callback when Xero links are loaded (for passing to Financial tab)
  onXeroLinksChange?: (links: XeroLink[]) => void;
}

export function ContactHeader({
  contact,
  onDelete,
  onEnrichFromWeb,
  enrichingFromWeb,
  onXeroLinksChange,
}: ContactHeaderProps) {
  const { toast } = useToast();
  const [xeroLinks, setXeroLinks] = useState<XeroLink[]>([]);
  const [allTenants, setAllTenants] = useState<XeroTenant[]>([]);
  const [loadingLinks, setLoadingLinks] = useState(false);
  const [selectedMismatchIds, setSelectedMismatchIds] = useState<Set<number>>(new Set());
  const [pushing, setPushing] = useState(false);

  // Load Xero links and all tenants when contact changes
  useEffect(() => {
    if (contact?.id) {
      loadXeroLinks();
      loadAllTenants();
    }
  }, [contact?.id]);

  const loadXeroLinks = async () => {
    setLoadingLinks(true);
    try {
      const response = await api.get<{ success: boolean; xero_links: XeroLink[] }>(
        `/api/v1/contacts/${contact.id}/xero_links`
      );
      if (response?.success && response.xero_links) {
        setXeroLinks(response.xero_links);
        // SSoT: Notify parent of xero links for Financial tab
        onXeroLinksChange?.(response.xero_links);
      }
    } catch (err) {
      console.error("Failed to load Xero links:", err);
    } finally {
      setLoadingLinks(false);
    }
  };

  const loadAllTenants = async () => {
    try {
      const response = await api.get<{ success: boolean; tenants: XeroTenant[] }>(
        "/api/v1/xero/tenants"
      );
      if (response?.success && response.tenants) {
        setAllTenants(response.tenants);
      }
    } catch (err) {
      console.error("Failed to load Xero tenants:", err);
    }
  };

  // Mismatch link IDs for convenience
  const mismatchedLinks = xeroLinks.filter(
    (l) => l.external_name && l.external_name !== contact.display_name
  );

  const toggleMismatchSelection = (linkId: number) => {
    setSelectedMismatchIds((prev) => {
      const next = new Set(prev);
      if (next.has(linkId)) next.delete(linkId);
      else next.add(linkId);
      return next;
    });
  };

  const handlePushSelected = async () => {
    if (selectedMismatchIds.size === 0) return;
    setPushing(true);
    try {
      const response = await api.post<{
        success: boolean;
        data: { success: number; failed: number; errors: Array<{ error: string }> };
      }>("/api/v1/xero/push_contact_names", {
        xero_link_ids: Array.from(selectedMismatchIds),
      });

      const ok = response?.data?.success ?? 0;
      const failed = response?.data?.failed ?? 0;

      if (ok > 0 && failed === 0) {
        toast({
          title: "Updated",
          description: `Pushed "${contact.display_name}" to ${ok} Xero org${ok !== 1 ? "s" : ""}`,
        });
      } else if (ok > 0) {
        toast({
          title: `${ok} updated, ${failed} failed`,
          description: response?.data?.errors?.[0]?.error || "Some updates failed",
        });
      } else {
        toast({
          title: "Failed",
          description: response?.data?.errors?.[0]?.error || "Failed to push names",
          variant: "destructive",
        });
      }
      setSelectedMismatchIds(new Set());
      loadXeroLinks();
    } catch {
      toast({ title: "Error", description: "Failed to push names to Xero", variant: "destructive" });
    } finally {
      setPushing(false);
    }
  };

  return (
    <div className="flex items-start justify-between">
      <div className="flex items-start gap-4">
        <BackButton fallbackHref="/contacts" label="Contacts" />
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight font-serif">
              {contact.display_name}
            </h1>
            {/* Xero Customer/Supplier badges (from Xero sync) */}
            {contact.xero_customer && (
              <Badge className="bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 dark:bg-blue-900 dark:text-blue-300">
                <ShieldCheck className="h-3 w-3 mr-1" />
                Xero Customer
              </Badge>
            )}
            {contact.xero_supplier && (
              <Badge className="bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 dark:bg-purple-900 dark:text-purple-300">
                <ShieldCheck className="h-3 w-3 mr-1" />
                Xero Supplier
              </Badge>
            )}
            {/* TEEEM-based badges (from transactions) */}
            {contact["is_supplier?"] && !contact.xero_supplier && (
              <Badge variant="outline" className="text-purple-700 dark:text-purple-300">
                Supplier
              </Badge>
            )}
            {contact["is_customer?"] && !contact.xero_customer && (
              <Badge variant="outline" className="text-blue-700 dark:text-blue-300">
                Customer
              </Badge>
            )}
            {contact.is_family_member && (
              <Badge className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 dark:bg-green-900 dark:text-green-300">
                Family
              </Badge>
            )}
            {/* Xero links popover - shows which orgs and name in each */}
            {allTenants.length > 0 && (
              <Popover>
                <PopoverTrigger asChild>
                  <button className="inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors hover:bg-accent cursor-pointer">
                    <ShieldCheck className="h-3 w-3" />
                    {new Set(xeroLinks.map(l => l.xero_tenant_id)).size}/{allTenants.length} Xero
                    <ChevronDown className="h-3 w-3 opacity-50" />
                  </button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-80 p-0">
                  <div className="px-3 py-2 border-b">
                    <p className="text-sm font-medium">Xero Connections</p>
                    {mismatchedLinks.length > 0 && (
                      <p className="text-xs text-muted-foreground">Select mismatches to push TEEEM name</p>
                    )}
                  </div>
                  <div className="py-1 max-h-[320px] overflow-y-auto">
                    {allTenants.map((tenant) => {
                      const link = xeroLinks.find(l => l.xero_tenant_id === tenant.tenant_id);
                      const isLinked = !!link;
                      const nameMismatch = isLinked && link.external_name && link.external_name !== contact.display_name;
                      return (
                        <div
                          key={tenant.tenant_id}
                          className="px-3 py-2 flex items-start gap-2"
                        >
                          {nameMismatch ? (
                            <Checkbox
                              className="mt-0.5 shrink-0"
                              checked={selectedMismatchIds.has(link.id)}
                              onCheckedChange={() => toggleMismatchSelection(link.id)}
                            />
                          ) : (
                            <div className={`mt-1.5 h-2 w-2 rounded-full shrink-0 ${isLinked ? "bg-green-500" : "bg-muted-foreground/30"}`} />
                          )}
                          <div className="min-w-0 flex-1">
                            <p className={`text-sm ${isLinked ? "font-medium" : "text-muted-foreground"}`}>
                              {tenant.tenant_name}
                            </p>
                            {isLinked && link.external_name && (
                              <p className={`text-xs truncate ${nameMismatch ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"}`}>
                                {nameMismatch && <AlertTriangle className="h-3 w-3 inline mr-1 -mt-0.5" />}
                                {link.external_name}
                              </p>
                            )}
                            {isLinked && !link.external_name && (
                              <p className="text-xs text-muted-foreground italic">No name stored</p>
                            )}
                            {!isLinked && (
                              <p className="text-xs text-muted-foreground">Not linked</p>
                            )}
                          </div>
                          {isLinked && !nameMismatch && link.external_name && (
                            <Check className="h-3.5 w-3.5 text-green-500 shrink-0 mt-0.5" />
                          )}
                        </div>
                      );
                    })}
                  </div>
                  {mismatchedLinks.length > 0 && (
                    <div className="px-3 py-2 border-t flex items-center justify-between gap-2">
                      <button
                        className="text-xs text-muted-foreground hover:text-foreground"
                        onClick={() => {
                          if (selectedMismatchIds.size === mismatchedLinks.length) {
                            setSelectedMismatchIds(new Set());
                          } else {
                            setSelectedMismatchIds(new Set(mismatchedLinks.map(l => l.id)));
                          }
                        }}
                      >
                        {selectedMismatchIds.size === mismatchedLinks.length ? "Deselect all" : "Select all"}
                      </button>
                      <Button
                        size="sm"
                        disabled={selectedMismatchIds.size === 0 || pushing}
                        onClick={handlePushSelected}
                        className="h-7 text-xs"
                      >
                        {pushing ? (
                          <Spinner size={12} className="mr-1" />
                        ) : (
                          <Upload className="h-3 w-3 mr-1" />
                        )}
                        Push to Xero ({selectedMismatchIds.size})
                      </Button>
                    </div>
                  )}
                </PopoverContent>
              </Popover>
            )}
          </div>
          {contact.company_name && (
            <p className="text-sm text-muted-foreground mt-1">
              {contact.position && `${contact.position} at `}
              {contact.company_name}
            </p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          onClick={onEnrichFromWeb}
          disabled={enrichingFromWeb || (!contact?.email && !contact?.website)}
        >
          {enrichingFromWeb ? (
            <>
              <Spinner className="h-4 w-4 mr-2" />
              Enriching...
            </>
          ) : (
            <>
              <Globe className="h-4 w-4 mr-2" />
              Get Info from Web
            </>
          )}
        </Button>
        <Button variant="destructive" onClick={onDelete}>
          <Trash2 className="h-4 w-4 mr-2" />
          Delete
        </Button>
      </div>
    </div>
  );
}
