"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  ArrowLeft,
  Globe,
  Trash2,
  ShieldCheck,
  ChevronDown,
  Check,
  Loader2,
  Plus,
} from "lucide-react";
import { api } from "@/lib/api";

interface XeroLink {
  id: number;
  xero_tenant_id: string;
  xero_tenant_name: string;
  xero_contact_id: string;
  invoice_count?: number;
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
  };
  onBack: () => void;
  onDelete: () => void;
  onEnrichFromWeb: () => void;
  enrichingFromWeb: boolean;
}

export function ContactHeader({
  contact,
  onBack,
  onDelete,
  onEnrichFromWeb,
  enrichingFromWeb,
}: ContactHeaderProps) {
  const [xeroLinks, setXeroLinks] = useState<XeroLink[]>([]);
  const [allTenants, setAllTenants] = useState<XeroTenant[]>([]);
  const [loadingLinks, setLoadingLinks] = useState(false);
  const [pushingToTenant, setPushingToTenant] = useState<string | null>(null);

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

  const handlePushToXero = async (tenantId: string, tenantName: string) => {
    setPushingToTenant(tenantId);
    try {
      await api.post(`/api/v1/contacts/${contact.id}/xero_links`, {
        xero_link: {
          tenant_id: tenantId,
          tenant_name: tenantName,
        }
      });
      // Reload links to show the new connection
      await loadXeroLinks();
    } catch (err) {
      console.error("Failed to push to Xero:", err);
    } finally {
      setPushingToTenant(null);
    }
  };

  // Check if a tenant is linked
  const isLinked = (tenantId: string) =>
    xeroLinks.some(link => link.xero_tenant_id === tenantId);

  return (
    <div className="flex items-start justify-between">
      <div className="flex items-start gap-4">
        <Button variant="ghost" onClick={onBack}>
          <ArrowLeft className="h-5 w-5 mr-2" />
          Contacts
        </Button>
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight font-serif">
              {contact.display_name}
            </h1>
            {contact["is_supplier?"] && (
              <Badge className="bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300">
                Supplier
              </Badge>
            )}
            {contact["is_customer?"] && (
              <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                Customer
              </Badge>
            )}
            {contact.is_family_member && (
              <Badge className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
                Family
              </Badge>
            )}
            {allTenants.length > 0 && (
              <Popover>
                <PopoverTrigger asChild>
                  <Badge variant="outline" className="gap-1 cursor-pointer hover:bg-accent">
                    <ShieldCheck className="h-3 w-3" />
                    {xeroLinks.length}/{allTenants.length} Xero
                    <ChevronDown className="h-3 w-3" />
                  </Badge>
                </PopoverTrigger>
                <PopoverContent className="w-72 p-2" align="start">
                  <div className="text-xs font-medium text-muted-foreground mb-2">
                    Xero Organizations ({xeroLinks.length}/{allTenants.length} linked)
                  </div>
                  <div className="space-y-1">
                    {[...allTenants].sort((a, b) => a.tenant_name.localeCompare(b.tenant_name)).map((tenant) => {
                      const link = xeroLinks.find(l => l.xero_tenant_id === tenant.tenant_id);
                      const linked = !!link;
                      const pushing = pushingToTenant === tenant.tenant_id;
                      return (
                        <div
                          key={tenant.tenant_id}
                          className={`flex items-center justify-between text-sm py-1.5 px-2 rounded ${
                            linked ? "bg-green-50 dark:bg-green-900/20" : "hover:bg-accent"
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            {linked ? (
                              <Check className="h-4 w-4 text-green-600" />
                            ) : (
                              <div className="h-4 w-4" />
                            )}
                            <span className={linked ? "text-green-700 dark:text-green-300" : ""}>
                              {tenant.tenant_name}
                            </span>
                            {linked && link?.invoice_count !== undefined && link.invoice_count > 0 && (
                              <span className="text-xs text-muted-foreground">
                                ({link.invoice_count})
                              </span>
                            )}
                          </div>
                          {!linked && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 px-2 text-xs"
                              onClick={() => handlePushToXero(tenant.tenant_id, tenant.tenant_name)}
                              disabled={pushing}
                            >
                              {pushing ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <>
                                  <Plus className="h-3 w-3 mr-1" />
                                  Push
                                </>
                              )}
                            </Button>
                          )}
                        </div>
                      );
                    })}
                  </div>
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
