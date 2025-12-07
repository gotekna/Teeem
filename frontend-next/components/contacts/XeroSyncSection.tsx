"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  CheckCircle,
  XCircle,
  AlertTriangle,
  LinkIcon,
  Settings,
  ChevronDown,
  ChevronRight,
  ArrowLeftRight,
  ArrowRight,
  ArrowLeft,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Alert,
  AlertDescription,
} from "@/components/ui/alert";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { api } from "@/lib/api";
import { LinkXeroContactModal } from "./LinkXeroContactModal";
import type {
  XeroLink,
  XeroTenant,
  XeroContact,
  SyncConfiguration,
  FieldMapping,
} from "@/types/xero";

interface Contact {
  id: number;
  display_name: string;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  mobile_phone?: string | null;
  office_phone?: string | null;
  company_name_or_trust?: string | null;
  tax_number?: string | null;
  entity_type: string | null;
  xero_contact_id?: string | null;
  sync_with_xero?: boolean;
  [key: string]: any;
}

interface XeroSyncSectionProps {
  contact: Contact;
  onContactUpdate: (updatedContact: Contact) => void;
}

export function XeroSyncSection({ contact, onContactUpdate }: XeroSyncSectionProps) {
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [xeroLinks, setXeroLinks] = useState<XeroLink[]>([]);
  const [selectedLinkId, setSelectedLinkId] = useState<number | null>(null);
  const [loadingLinks, setLoadingLinks] = useState(true);
  const [availableTenants, setAvailableTenants] = useState<XeroTenant[]>([]);
  const [loadingTenants, setLoadingTenants] = useState(true);
  const [linkingToTenant, setLinkingToTenant] = useState<string | null>(null);
  const [xeroContactData, setXeroContactData] = useState<XeroContact | null>(null);
  const [syncConfig, setSyncConfig] = useState<SyncConfiguration | null>(null);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});
  const [showLinkModal, setShowLinkModal] = useState(false);

  const selectedLink = xeroLinks.find((link) => link.id === selectedLinkId);
  const hasXeroConnection = xeroLinks.length > 0;

  // Load Xero links for this contact
  useEffect(() => {
    loadXeroLinks();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally watching contact.id only (loadXeroLinks is stable)
  }, [contact.id]);

  // Load available tenants
  useEffect(() => {
    loadAvailableTenants();
  }, []);

  // Load Xero contact data when a link is selected
  useEffect(() => {
    if (selectedLink && selectedLink.xero_contact_id) {
      loadXeroContactData();
      loadSyncConfig(selectedLink.xero_tenant_id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally watching selectedLinkId only (functions are stable, selectedLink derived from it)
  }, [selectedLinkId]);

  const loadXeroLinks = async () => {
    setLoadingLinks(true);
    try {
      const response = await api.get<{ success: boolean; xero_links: XeroLink[] }>(
        `/api/v1/contacts/${contact.id}/xero_links`
      );
      if (response?.success && response.xero_links) {
        setXeroLinks(response.xero_links);
        // Auto-select first link if available
        if (response?.xero_links.length > 0 && !selectedLinkId) {
          setSelectedLinkId(response.xero_links[0].id);
        }
      }
    } catch (_err) {
      console.error("Failed to load Xero links:", _err);
      setSyncError(_err instanceof Error ? _err.message : "Failed to load Xero links");
    } finally {
      setLoadingLinks(false);
    }
  };

  const loadSyncConfig = async (tenantId: string) => {
    try {
      const response = await api.get<{ success: boolean; config: SyncConfiguration }>(
        `/api/v1/sync_configurations/${tenantId}`
      );
      if (response?.success && response.config) {
        setSyncConfig(response.config);
      }
    } catch (_err) {
      console.error("Failed to load sync config:", _err);
    }
  };

  const loadAvailableTenants = async () => {
    setLoadingTenants(true);
    try {
      const response = await api.get<{ success: boolean; tenants: XeroTenant[] }>(
        "/api/v1/xero/tenants"
      );
      if (response?.success && response.tenants) {
        setAvailableTenants(response.tenants);
      }
    } catch (_err) {
      console.error("Failed to load Xero tenants:", _err);
    } finally {
      setLoadingTenants(false);
    }
  };

  const handleLinkToTenant = async (tenantId: string, tenantName: string) => {
    setLinkingToTenant(tenantId);
    setSyncError(null);
    try {
      const response = await api.post<{ success: boolean; xero_link: XeroLink }>(
        `/api/v1/contacts/${contact.id}/xero_links`,
        {
          xero_tenant_id: tenantId,
          xero_tenant_name: tenantName,
        }
      );

      if (response?.success && response.xero_link) {
        setXeroLinks((prev) => [...prev, response.xero_link]);
        setSelectedLinkId(response.xero_link.id);
      }
    } catch (_err) {
      setSyncError(_err instanceof Error ? _err.message : "Failed to link to tenant");
      console.error("Link to tenant error:", _err);
    } finally {
      setLinkingToTenant(null);
    }
  };

  const loadXeroContactData = async () => {
    if (!selectedLink) return;

    setSyncError(null);
    try {
      const response = await api.get<{ success: boolean; contact: XeroContact }>(
        `/api/v1/xero/contacts/${selectedLink.xero_contact_id}?tenant_id=${selectedLink.xero_tenant_id}`
      );
      if (response?.success && response.contact) {
        setXeroContactData(response.contact);
      }
    } catch (_err) {
      console.error("Failed to load Xero contact data:", _err);
      setSyncError(_err instanceof Error ? _err.message : "Failed to load Xero contact data");
    }
  };

  const handleSyncFromXero = async () => {
    setSyncing(true);
    setSyncError(null);
    try {
      const response = await api.post<{ success: boolean; contact: Contact }>(
        `/api/v1/contacts/${contact.id}/sync_from_xero`
      );

      if (response?.success && response.contact) {
        onContactUpdate(response.contact);
        // Reload Xero contact data to see updated sync
        await loadXeroContactData();
      }
    } catch (_err) {
      setSyncError(_err instanceof Error ? _err.message : "Failed to sync from Xero");
      console.error("Sync from Xero error:", _err);
    } finally {
      setSyncing(false);
    }
  };

  const handleSyncToXero = async () => {
    if (!selectedLink) return;

    setSyncing(true);
    setSyncError(null);
    try {
      const response = await api.post<{ success: boolean; contact: Contact }>(
        `/api/v1/contacts/${contact.id}/sync_to_xero?tenant_id=${selectedLink.xero_tenant_id}`
      );

      if (response?.success && response.contact) {
        onContactUpdate(response.contact);
        // Reload Xero contact data to see updated sync
        await loadXeroContactData();
      }
    } catch (_err) {
      setSyncError(_err instanceof Error ? _err.message : "Failed to sync to Xero");
      console.error("Sync to Xero error:", _err);
    } finally {
      setSyncing(false);
    }
  };

  const handleBidirectionalSync = async () => {
    if (!selectedLink) return;

    setSyncing(true);
    setSyncError(null);
    try {
      // First pull from Xero
      const pullResponse = await api.post<{ success: boolean; contact: Contact }>(
        `/api/v1/contacts/${contact.id}/sync_from_xero`
      );

      if (pullResponse?.success && pullResponse.contact) {
        onContactUpdate(pullResponse.contact);
      }

      // Then push to Xero
      const pushResponse = await api.post<{ success: boolean; contact: Contact }>(
        `/api/v1/contacts/${contact.id}/sync_to_xero?tenant_id=${selectedLink.xero_tenant_id}`
      );

      if (pushResponse?.success && pushResponse.contact) {
        onContactUpdate(pushResponse.contact);
        // Reload Xero contact data
        await loadXeroContactData();
      }
    } catch (_err) {
      setSyncError(_err instanceof Error ? _err.message : "Bidirectional sync failed");
      console.error("Bidirectional sync error:", _err);
    } finally {
      setSyncing(false);
    }
  };

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  const expandAllSections = () => {
    const allSections = ["contact", "addresses", "phones", "banking", "accounting", "other"];
    const newExpanded: Record<string, boolean> = {};
    allSections.forEach((section) => {
      newExpanded[section] = true;
    });
    setExpandedSections(newExpanded);
  };

  const collapseAllSections = () => {
    setExpandedSections({});
  };

  // Build field mappings from contact data and xero data
  const getFieldMappings = (): FieldMapping[] => {
    if (!xeroContactData || !syncConfig) return [];

    const mappings: FieldMapping[] = [];

    // Contact fields
    const contactMappings = [
      {
        teeemField: "display_name",
        xeroField: "Name",
        teeemValue: contact.display_name,
        xeroValue: xeroContactData.Name,
      },
      {
        teeemField: "first_name",
        xeroField: "FirstName",
        teeemValue: contact.first_name,
        xeroValue: xeroContactData.FirstName,
      },
      {
        teeemField: "last_name",
        xeroField: "LastName",
        teeemValue: contact.last_name,
        xeroValue: xeroContactData.LastName,
      },
      {
        teeemField: "email",
        xeroField: "EmailAddress",
        teeemValue: contact.email,
        xeroValue: xeroContactData.EmailAddress,
      },
      {
        teeemField: "tax_number",
        xeroField: "TaxNumber",
        teeemValue: contact.tax_number,
        xeroValue: xeroContactData.TaxNumber,
      },
    ];

    contactMappings.forEach((mapping) => {
      const direction = syncConfig.field_mappings[mapping.teeemField] || "none";
      mappings.push({
        ...mapping,
        direction,
        isDifferent: mapping.teeemValue !== mapping.xeroValue,
        isReadOnly: direction === "import", // Import-only fields are read-only in TEEEM
      });
    });

    return mappings;
  };

  const fieldMappings = getFieldMappings();

  if (loadingLinks) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Sync Buttons */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-2xl font-bold">Xero Integration</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Sync contact data between TEEEM and Xero
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/settings/integrations/xero">
            <Button variant="ghost" size="sm">
              <Settings className="h-4 w-4 mr-2" />
              Settings
            </Button>
          </Link>
          {hasXeroConnection && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={handleSyncFromXero}
                disabled={syncing || !selectedLink}
                title="Pull changes from Xero to TEEEM"
              >
                <ArrowLeft className={`h-4 w-4 mr-2 ${syncing ? "animate-spin" : ""}`} />
                From Xero
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleSyncToXero}
                disabled={syncing || !selectedLink}
                title="Push TEEEM changes to Xero"
              >
                <ArrowRight className={`h-4 w-4 mr-2 ${syncing ? "animate-spin" : ""}`} />
                To Xero
              </Button>
              <Button
                size="sm"
                onClick={handleBidirectionalSync}
                disabled={syncing || !selectedLink}
                title="Sync both ways (pull then push)"
              >
                <ArrowLeftRight className={`h-4 w-4 mr-2 ${syncing ? "animate-spin" : ""}`} />
                Bidirectional
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Sync Error Alert */}
      {syncError && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{syncError}</AlertDescription>
        </Alert>
      )}

      {/* No Connection State */}
      {!hasXeroConnection && (
        <Card>
          <CardHeader>
            <CardTitle>Not Connected to Xero</CardTitle>
            <CardDescription>
              Link this contact to a Xero contact to enable automatic syncing
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => setShowLinkModal(true)}>
              <LinkIcon className="h-4 w-4 mr-2" />
              Link to Xero Contact
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Xero Tenants Selection */}
      {hasXeroConnection && xeroLinks.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Connected Xero Organizations</CardTitle>
            <CardDescription>
              This contact is linked to {xeroLinks.length} Xero organization{xeroLinks.length !== 1 ? "s" : ""}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {xeroLinks.map((link) => (
              <button
                key={link.id}
                onClick={() => setSelectedLinkId(link.id)}
                className={`w-full text-left p-4 rounded-lg border transition-colors ${
                  selectedLinkId === link.id
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/50 hover:bg-accent"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {selectedLinkId === link.id && (
                      <CheckCircle className="h-5 w-5 text-primary" />
                    )}
                    <div>
                      <p className="font-medium">{link.xero_tenant_name}</p>
                      <p className="text-xs text-muted-foreground font-mono">
                        {link.xero_contact_id}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {link.sync_enabled ? (
                      <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300">
                        Sync Enabled
                      </Badge>
                    ) : (
                      <Badge variant="secondary">Sync Disabled</Badge>
                    )}
                    {link.last_synced_at && (
                      <span className="text-xs text-muted-foreground">
                        Synced {new Date(link.last_synced_at).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Available Tenants to Link */}
      {!loadingTenants && availableTenants.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Available Xero Organizations</CardTitle>
            <CardDescription>
              Link this contact to additional Xero organizations
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {availableTenants
              .filter((tenant) => !xeroLinks.some((link) => link.xero_tenant_id === tenant.tenant_id))
              .map((tenant) => (
                <div
                  key={tenant.tenant_id}
                  className="flex items-center justify-between p-3 rounded-lg border"
                >
                  <div>
                    <p className="font-medium">{tenant.tenant_name}</p>
                    <p className="text-xs text-muted-foreground">{tenant.tenant_type}</p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleLinkToTenant(tenant.tenant_id, tenant.tenant_name)}
                    disabled={linkingToTenant === tenant.tenant_id}
                  >
                    {linkingToTenant === tenant.tenant_id ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Linking...
                      </>
                    ) : (
                      <>
                        <LinkIcon className="h-4 w-4 mr-2" />
                        Link
                      </>
                    )}
                  </Button>
                </div>
              ))}
          </CardContent>
        </Card>
      )}

      {/* Field Mappings */}
      {selectedLink && xeroContactData && fieldMappings.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">Field Mappings</CardTitle>
                <CardDescription>
                  Comparison of data between TEEEM and Xero
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={expandAllSections}>
                  <ChevronDown className="h-4 w-4 mr-2" />
                  Expand All
                </Button>
                <Button variant="ghost" size="sm" onClick={collapseAllSections}>
                  <ChevronRight className="h-4 w-4 mr-2" />
                  Collapse All
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Contact Fields */}
            <Collapsible
              open={expandedSections["contact"]}
              onOpenChange={() => toggleSection("contact")}
            >
              <CollapsibleTrigger asChild>
                <Button variant="ghost" className="w-full justify-between p-3">
                  <span className="font-medium">Contact Information</span>
                  {expandedSections["contact"] ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-2 pt-2">
                {fieldMappings.map((mapping, index) => (
                  <div
                    key={index}
                    className={`grid grid-cols-[1fr,auto,1fr] gap-4 p-3 rounded-lg ${
                      mapping.isDifferent ? "bg-yellow-50 dark:bg-yellow-900/10" : "bg-muted/50"
                    }`}
                  >
                    <div>
                      <p className="text-xs text-muted-foreground font-medium">
                        TEEEM ({mapping.teeemField})
                      </p>
                      <p className="text-sm">{mapping.teeemValue || <span className="text-muted-foreground italic">empty</span>}</p>
                    </div>
                    <div className="flex items-center">
                      {mapping.direction === "bidirectional" && <ArrowLeftRight className="h-4 w-4 text-muted-foreground" />}
                      {mapping.direction === "import" && <ArrowLeft className="h-4 w-4 text-blue-500" />}
                      {mapping.direction === "export" && <ArrowRight className="h-4 w-4 text-green-500" />}
                      {mapping.direction === "none" && <XCircle className="h-4 w-4 text-muted-foreground" />}
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground font-medium">
                        Xero ({mapping.xeroField})
                      </p>
                      <p className="text-sm">{mapping.xeroValue || <span className="text-muted-foreground italic">empty</span>}</p>
                    </div>
                  </div>
                ))}
              </CollapsibleContent>
            </Collapsible>
          </CardContent>
        </Card>
      )}

      {/* Link Xero Contact Modal */}
      <LinkXeroContactModal
        isOpen={showLinkModal}
        onClose={() => setShowLinkModal(false)}
        contact={contact}
        onSuccess={(updatedContact) => {
          onContactUpdate(updatedContact);
          loadXeroLinks(); // Reload links after successful link
        }}
      />
    </div>
  );
}
