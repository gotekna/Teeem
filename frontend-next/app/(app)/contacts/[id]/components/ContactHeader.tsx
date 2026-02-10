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
} from "lucide-react";
import { api } from "@/lib/api";

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
  const [xeroLinks, setXeroLinks] = useState<XeroLink[]>([]);
  const [allTenants, setAllTenants] = useState<XeroTenant[]>([]);
  const [loadingLinks, setLoadingLinks] = useState(false);

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
            {/* SSoT: Simple badge showing linked org count. Org management is in Financial tab. */}
            {allTenants.length > 0 && (
              <Badge variant="outline" className="gap-1">
                <ShieldCheck className="h-3 w-3" />
                {new Set(xeroLinks.map(l => l.xero_tenant_id)).size}/{allTenants.length} Xero
              </Badge>
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
