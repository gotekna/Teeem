"use client";

import { useState, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Spinner } from "@/components/ui/spinner";
import {
  ExternalLink,
  Shield,
  ShieldOff,
  KeyRound,
  Copy,
  Eye,
  EyeOff,
  User,
  Users,
} from "lucide-react";
import { api } from "@/lib/api";
import { getApiBaseUrl } from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";

interface PortalContact {
  id: number;
  display_name: string;
  email?: string;
  phone?: string;
  portal_enabled?: boolean;
  portal_type?: string | null;
  portal_active?: boolean | null;
  last_login_at?: string | null;
}

interface Property {
  id: number;
  owner_contact?: PortalContact | null;
}

interface PropertyContact {
  id: number;
  role: string;
  is_primary: boolean;
  contact: PortalContact;
}

interface Props {
  propertyId: string;
  property: Property;
  contacts: PropertyContact[];
}

export function PropertyPortalTab({ propertyId, property, contacts }: Props) {
  const [activeSubTab, setActiveSubTab] = useState("setup");

  return (
    <div className="space-y-4">
      <Tabs value={activeSubTab} onValueChange={setActiveSubTab}>
        <TabsList>
          <TabsTrigger value="setup" className="gap-1.5">
            <Shield className="h-3.5 w-3.5" />
            Setup
          </TabsTrigger>
          <TabsTrigger value="owner" className="gap-1.5">
            <User className="h-3.5 w-3.5" />
            Owner
          </TabsTrigger>
          <TabsTrigger value="tenant" className="gap-1.5">
            <Users className="h-3.5 w-3.5" />
            Tenant
          </TabsTrigger>
        </TabsList>

        <TabsContent value="setup" className="mt-4">
          <PortalSetupTab
            propertyId={propertyId}
            property={property}
            contacts={contacts}
          />
        </TabsContent>

        <TabsContent value="owner" className="mt-4">
          <PortalEmbedTab
            portalType="owner"
            contact={property.owner_contact ?? null}
            onSwitchToSetup={() => setActiveSubTab("setup")}
          />
        </TabsContent>

        <TabsContent value="tenant" className="mt-4">
          <PortalEmbedTab
            portalType="tenant"
            contact={findTenantContact(contacts)}
            onSwitchToSetup={() => setActiveSubTab("setup")}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function findTenantContact(contacts: PropertyContact[]): PortalContact | null {
  const tenantPC = contacts.find(
    (pc) => pc.role === "tenant" && pc.contact.portal_active
  );
  if (tenantPC) return tenantPC.contact;
  // Fallback: any tenant contact even without portal
  const anyTenant = contacts.find((pc) => pc.role === "tenant");
  return anyTenant?.contact ?? null;
}

// ─────────────────────────────────────────────
// Setup Sub-Tab
// ─────────────────────────────────────────────

function PortalSetupTab({
  propertyId,
  property,
  contacts,
}: {
  propertyId: string;
  property: Property;
  contacts: PropertyContact[];
}) {
  const tenantContacts = contacts.filter((pc) => pc.role === "tenant");

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-1">Portal Account Management</h3>
        <p className="text-sm text-muted-foreground">
          Manage portal access for this property&apos;s owner and tenant contacts.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Owner Portal Account */}
        <PortalAccountCard
          title="Owner Portal Account"
          icon={<User className="h-4 w-4" />}
          contact={property.owner_contact ?? null}
          portalType="owner"
          emptyMessage="No owner contact assigned to this property. Assign one in the Overview tab."
        />

        {/* Tenant Portal Accounts */}
        {tenantContacts.length > 0 ? (
          tenantContacts.map((pc) => (
            <PortalAccountCard
              key={pc.contact.id}
              title={`Tenant Portal Account${tenantContacts.length > 1 ? ` - ${pc.contact.display_name}` : ""}`}
              icon={<Users className="h-4 w-4" />}
              contact={pc.contact}
              portalType="tenant"
            />
          ))
        ) : (
          <PortalAccountCard
            title="Tenant Portal Account"
            icon={<Users className="h-4 w-4" />}
            contact={null}
            portalType="tenant"
            emptyMessage="No tenant contacts on this property. Add one in the Tenancy tab."
          />
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Portal Account Card
// ─────────────────────────────────────────────

function PortalAccountCard({
  title,
  icon,
  contact,
  portalType,
  emptyMessage,
}: {
  title: string;
  icon: React.ReactNode;
  contact: PortalContact | null;
  portalType: string;
  emptyMessage?: string;
}) {
  const { toast } = useToast();
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showEnableForm, setShowEnableForm] = useState(false);
  const [enableEmail, setEnableEmail] = useState("");
  const [enablePassword, setEnablePassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [generatedPassword, setGeneratedPassword] = useState<string | null>(null);

  // Pre-fill email when contact changes or when form opens
  useEffect(() => {
    if (contact?.email) {
      setEnableEmail(contact.email);
    } else {
      setEnableEmail("");
    }
  }, [contact?.email, contact?.id]);

  const hasPortal = contact?.portal_enabled && contact?.portal_active;

  const enablePortal = async () => {
    if (!contact || !enableEmail || !enablePassword) return;
    setActionLoading("enable");
    try {
      const res = await api.post<{ success: boolean; portal_user?: unknown; error?: string }>(
        `/api/v1/contacts/portal_users/${contact.id}`,
        { portal_type: portalType, email: enableEmail, password: enablePassword }
      );
      if (res?.success) {
        toast({ title: "Portal enabled", description: `${contact.display_name} can now access the portal.` });
        setShowEnableForm(false);
        setGeneratedPassword(enablePassword);
        // Force page refresh to get updated portal status
        window.location.reload();
      } else {
        toast({ title: "Error", description: res?.error || "Failed to enable portal", variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Failed to enable portal access", variant: "destructive" });
    } finally {
      setActionLoading(null);
    }
  };

  const resetPassword = async () => {
    if (!contact?.email) return;
    setActionLoading("reset");
    try {
      const baseUrl = getApiBaseUrl();
      const res = await fetch(`${baseUrl}/api/v1/portal/auth/forgot_password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: contact.email }),
      });
      const data = await res.json();
      if (data?.success) {
        toast({ title: "Password reset sent", description: `Reset instructions sent to ${contact.email}` });
      } else {
        toast({ title: "Error", description: data?.error || "Failed to send reset", variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Failed to send password reset", variant: "destructive" });
    } finally {
      setActionLoading(null);
    }
  };

  const copyLoginLink = async () => {
    if (!contact) return;
    setActionLoading("link");
    try {
      const res = await api.post<{ success: boolean; token?: string; error?: string }>(
        `/api/v1/portal/auth/impersonate/${contact.id}`
      );
      if (res?.success && res.token) {
        const link = `${window.location.origin}/portal/login?token=${res.token}`;
        await navigator.clipboard.writeText(link);
        toast({ title: "Login link copied", description: "Paste this link to share portal access." });
      } else {
        toast({ title: "Error", description: res?.error || "Failed to generate link", variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Failed to generate login link", variant: "destructive" });
    } finally {
      setActionLoading(null);
    }
  };

  const disablePortal = async () => {
    if (!contact) return;
    setActionLoading("disable");
    try {
      const res = await api.delete<{ success: boolean; error?: string }>(
        `/api/v1/contacts/portal_users/${contact.id}`
      );
      if (res?.success) {
        toast({ title: "Portal disabled", description: `${contact.display_name} can no longer access the portal.` });
        window.location.reload();
      } else {
        toast({ title: "Error", description: res?.error || "Failed to disable portal", variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Failed to disable portal access", variant: "destructive" });
    } finally {
      setActionLoading(null);
    }
  };

  const generateRandomPassword = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
    let pwd = "";
    for (let i = 0; i < 12; i++) {
      pwd += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setEnablePassword(pwd);
    setShowPassword(true);
  };

  if (!contact) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            {icon}
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{emptyMessage}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            {icon}
            {title}
          </CardTitle>
          <Badge variant={hasPortal ? "default" : "secondary"}>
            {hasPortal ? "Active" : "Not Enabled"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Contact Info */}
        <div className="space-y-1">
          <p className="text-sm font-medium">{contact.display_name}</p>
          <p className="text-xs text-muted-foreground">
            {contact.email || <span className="text-amber-600 dark:text-amber-400">No email on file</span>}
          </p>
          {contact.last_login_at && (
            <p className="text-xs text-muted-foreground">
              Last login: {new Date(contact.last_login_at).toLocaleDateString("en-AU", {
                day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit"
              })}
            </p>
          )}
        </div>

        {hasPortal ? (
          /* Actions for active portal */
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={resetPassword}
              disabled={actionLoading !== null}
            >
              <KeyRound className="h-3.5 w-3.5 mr-1.5" />
              {actionLoading === "reset" ? "Sending..." : "Reset Password"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={copyLoginLink}
              disabled={actionLoading !== null}
            >
              <Copy className="h-3.5 w-3.5 mr-1.5" />
              {actionLoading === "link" ? "Generating..." : "Copy Login Link"}
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={disablePortal}
              disabled={actionLoading !== null}
            >
              <ShieldOff className="h-3.5 w-3.5 mr-1.5" />
              {actionLoading === "disable" ? "Disabling..." : "Disable Portal"}
            </Button>
          </div>
        ) : showEnableForm ? (
          /* Enable portal form */
          <div className="space-y-3 border rounded-lg p-3 bg-muted/30">
            <div className="space-y-2">
              <Label htmlFor={`email-${contact.id}`} className="text-xs">Portal Email</Label>
              <Input
                id={`email-${contact.id}`}
                type="email"
                value={enableEmail}
                onChange={(e) => setEnableEmail(e.target.value)}
                placeholder={contact?.email || "email@example.com"}
                className="h-8 text-sm"
              />
              {!contact?.email && (
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  No email on file for this contact. Enter an email address above.
                </p>
              )}
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor={`password-${contact.id}`} className="text-xs">Password</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-5 text-xs px-1"
                  onClick={generateRandomPassword}
                >
                  Generate
                </Button>
              </div>
              <div className="relative">
                <Input
                  id={`password-${contact.id}`}
                  type={showPassword ? "text" : "password"}
                  value={enablePassword}
                  onChange={(e) => setEnablePassword(e.target.value)}
                  placeholder="Set a password"
                  className="h-8 text-sm pr-8"
                />
                <button
                  type="button"
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={enablePortal}
                disabled={actionLoading !== null || !enableEmail || !enablePassword}
              >
                <Shield className="h-3.5 w-3.5 mr-1.5" />
                {actionLoading === "enable" ? "Enabling..." : "Enable Portal"}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowEnableForm(false)}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          /* Enable portal button */
          <div>
            <Button
              size="sm"
              onClick={() => {
                generateRandomPassword();
                setShowEnableForm(true);
              }}
              disabled={actionLoading !== null}
            >
              <Shield className="h-3.5 w-3.5 mr-1.5" />
              Enable Portal Access
            </Button>
          </div>
        )}

        {/* Show generated password notice */}
        {generatedPassword && (
          <div className="border rounded-lg p-3 bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800">
            <p className="text-xs font-medium text-green-800 dark:text-green-300 mb-1">
              Portal access enabled. Share these credentials:
            </p>
            <p className="text-xs text-green-700 dark:text-green-400 font-mono">
              Email: {enableEmail}
            </p>
            <p className="text-xs text-green-700 dark:text-green-400 font-mono">
              Password: {generatedPassword}
            </p>
            <Button
              size="sm"
              variant="ghost"
              className="mt-2 h-6 text-xs"
              onClick={() => {
                navigator.clipboard.writeText(`Email: ${enableEmail}\nPassword: ${generatedPassword}`);
                toast({ title: "Credentials copied" });
              }}
            >
              <Copy className="h-3 w-3 mr-1" />
              Copy Credentials
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────
// Portal Embed Sub-Tab (Owner / Tenant)
// ─────────────────────────────────────────────

function PortalEmbedTab({
  portalType,
  contact,
  onSwitchToSetup,
}: {
  portalType: "owner" | "tenant";
  contact: PortalContact | null;
  onSwitchToSetup: () => void;
}) {
  const { toast } = useToast();
  const [iframeUrl, setIframeUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enabling, setEnabling] = useState(false);

  const label = portalType === "owner" ? "Owner" : "Tenant";
  const hasPortal = contact?.portal_enabled && contact?.portal_active;

  const loadPortal = useCallback(async () => {
    if (!contact) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.post<{ success: boolean; token?: string; error?: string }>(
        `/api/v1/portal/auth/impersonate/${contact.id}`
      );
      if (res?.success && res.token) {
        const url = `${window.location.origin}/portal/login?token=${res.token}&embed=1`;
        setIframeUrl(url);
      } else {
        setError(res?.error || "Failed to generate portal session");
      }
    } catch {
      setError("Failed to load portal. The contact may not have an active portal account.");
    } finally {
      setLoading(false);
    }
  }, [contact]);

  // Quick-enable portal and immediately load preview
  const enableAndPreview = useCallback(async () => {
    if (!contact) return;
    setEnabling(true);
    setError(null);
    try {
      // Generate a random password
      const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
      let pwd = "";
      for (let i = 0; i < 12; i++) {
        pwd += chars.charAt(Math.floor(Math.random() * chars.length));
      }

      const email = contact.email || `${contact.display_name?.replace(/\s+/g, ".").toLowerCase()}@portal.teeem.au`;

      const res = await api.post<{ success: boolean; portal_user?: unknown; error?: string }>(
        `/api/v1/contacts/portal_users/${contact.id}`,
        { portal_type: portalType, email, password: pwd }
      );
      if (res?.success) {
        toast({
          title: "Portal enabled",
          description: `Portal access created for ${contact.display_name}. Loading preview...`,
        });
        // Now impersonate and show the portal
        const impRes = await api.post<{ success: boolean; token?: string; error?: string }>(
          `/api/v1/portal/auth/impersonate/${contact.id}`
        );
        if (impRes?.success && impRes.token) {
          const url = `${window.location.origin}/portal/login?token=${impRes.token}&embed=1`;
          setIframeUrl(url);
        } else {
          setError("Portal enabled but failed to load preview. Refresh the page and try again.");
        }
      } else {
        setError(res?.error || "Failed to enable portal");
      }
    } catch {
      setError("Failed to enable portal access");
    } finally {
      setEnabling(false);
    }
  }, [contact, portalType, toast]);

  // Auto-load on mount if portal is available
  useEffect(() => {
    if (hasPortal && !iframeUrl && !loading && !error) {
      loadPortal();
    }
  }, [hasPortal, iframeUrl, loading, error, loadPortal]);

  // ── Demo preview mode (no contact or no portal account) ──────────────
  // Show the portal pages directly so the user can see the portal design
  const showDemoPreview = !contact || !hasPortal;

  if (showDemoPreview) {
    return (
      <DemoPortalPreview
        portalType={portalType}
        label={label}
        contact={contact}
        hasPortal={!!hasPortal}
        enabling={enabling}
        error={error}
        onEnableAndPreview={contact ? enableAndPreview : undefined}
        onSwitchToSetup={onSwitchToSetup}
      />
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Spinner className="mb-4" />
        <p className="text-sm text-muted-foreground">Loading {label.toLowerCase()} portal...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <p className="text-sm text-destructive mb-4">{error}</p>
        <Button size="sm" variant="outline" onClick={loadPortal}>
          Try Again
        </Button>
      </div>
    );
  }

  if (iframeUrl) {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            Viewing portal as <span className="font-medium">{contact.display_name}</span> ({label.toLowerCase()})
          </p>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-xs"
              onClick={() => {
                window.open(iframeUrl.replace("&embed=1", ""), "_blank");
              }}
            >
              <ExternalLink className="h-3 w-3 mr-1" />
              Open in New Tab
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-xs"
              onClick={loadPortal}
            >
              Refresh
            </Button>
          </div>
        </div>
        <div className="border rounded-lg overflow-hidden bg-white dark:bg-card" style={{ height: "calc(100vh - 320px)", minHeight: "500px" }}>
          <iframe
            src={iframeUrl}
            className="w-full h-full border-0"
            title={`${label} Portal Preview`}
            sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
          />
        </div>
      </div>
    );
  }

  return null;
}

// ─────────────────────────────────────────────
// Demo Portal Preview (no contact or no portal)
// ─────────────────────────────────────────────

const PORTAL_PAGES = {
  owner: [
    { label: "Dashboard", path: "/portal/dashboard" },
    { label: "Property", path: "/portal/property" },
    { label: "Documents", path: "/portal/property/documents" },
    { label: "Inspections", path: "/portal/property/inspections" },
    { label: "Maintenance", path: "/portal/property/maintenance" },
    { label: "Invoices", path: "/portal/invoices" },
  ],
  tenant: [
    { label: "Dashboard", path: "/portal/dashboard" },
    { label: "Property", path: "/portal/property" },
    { label: "Maintenance", path: "/portal/property/maintenance" },
    { label: "Documents", path: "/portal/property/documents" },
    { label: "Inspections", path: "/portal/property/inspections" },
  ],
};

function DemoPortalPreview({
  portalType,
  label,
  contact,
  hasPortal,
  enabling,
  error,
  onEnableAndPreview,
  onSwitchToSetup,
}: {
  portalType: "owner" | "tenant";
  label: string;
  contact: PortalContact | null;
  hasPortal: boolean;
  enabling: boolean;
  error: string | null;
  onEnableAndPreview?: () => void;
  onSwitchToSetup: () => void;
}) {
  const pages = PORTAL_PAGES[portalType];

  if (enabling) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Spinner className="mb-4" />
        <p className="text-sm text-muted-foreground">Enabling portal and loading preview...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Status banner */}
      <div className="flex items-start gap-3 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
        <ShieldOff className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
        <div className="flex-1">
          <p className="text-sm font-medium text-amber-900 dark:text-amber-100">
            {!contact
              ? `No ${label.toLowerCase()} contact assigned`
              : `${contact.display_name} — portal not enabled`}
          </p>
          <p className="text-xs text-amber-700 dark:text-amber-300 mt-0.5">
            {!contact
              ? `Assign a ${label.toLowerCase()} contact in the Overview tab, or open the portal preview below.`
              : "Enable portal access in the Setup tab, or open the portal preview below."}
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          {onEnableAndPreview && (
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={onEnableAndPreview}>
              <Eye className="h-3 w-3 mr-1" />
              Enable &amp; Preview
            </Button>
          )}
          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={onSwitchToSetup}>
            <Shield className="h-3 w-3 mr-1" />
            Setup
          </Button>
        </div>
      </div>

      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      {/* Portal preview — opens in new window */}
      <div>
        <h3 className="text-base font-semibold mb-1">{label} Portal Preview</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Open portal pages in a new window to see the {label.toLowerCase()} experience.
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {pages.map((page) => (
            <button
              key={page.path}
              type="button"
              onClick={() => window.open(page.path, "_blank")}
              className="group flex items-center gap-3 p-4 rounded-lg border border-border bg-card hover:bg-secondary/30 transition-colors text-left"
            >
              <ExternalLink className="h-4 w-4 text-muted-foreground group-hover:text-primary shrink-0" />
              <span className="text-sm font-medium group-hover:text-primary transition-colors">{page.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
