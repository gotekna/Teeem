"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/components/ui/use-toast";
import { api } from "@/lib/api";
import { useContacts } from "@/lib/hooks/useContacts";
import type { ContactSelect } from "@/lib/hooks/useContacts";
import {
  Mail,
  Copy,
  Check,
  ExternalLink,
  Globe,
  Key,
  FileText,
  Building2,
  Receipt,
  Shield,
  ArrowRight,
  Info,
  Users,
  Save,
  UserCircle,
  Hash,
  X,
} from "lucide-react";

// ─── NDIS Role Definitions ──────────────────────────────────────────────────

const NDIS_ROLES = [
  {
    key: "registration_holder",
    label: "Registration Holder",
    description: "Person who holds the NDIS provider registration",
  },
  {
    key: "sda_manager",
    label: "SDA Manager",
    description: "Day-to-day SDA portfolio and enrolment manager",
  },
  {
    key: "compliance_officer",
    label: "Compliance Officer",
    description: "Ensures SDA properties meet NDIS standards and requirements",
  },
  {
    key: "primary_ndis_contact",
    label: "Primary NDIS Contact",
    description: "Main point of contact with the NDIA for SDA matters",
  },
  {
    key: "claims_officer",
    label: "Claims / Finance Officer",
    description: "Handles SDA claim submissions, billing, and payment tracking",
  },
] as const;

type NdisRoleKey = (typeof NDIS_ROLES)[number]["key"];

interface SdaConfig {
  ndis_registration_number?: string;
  proda_ra_number?: string;
  contacts?: Record<string, { id: number; display_name: string; email?: string | null } | null>;
}

interface TenantSettings {
  company_name?: string;
  abn?: string;
  address?: string;
  phone?: string;
  email?: string;
}

// ─── Copy helper ─────────────────────────────────────────────────────────────

function useCopy() {
  const [copied, setCopied] = useState<string | null>(null);
  const copy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };
  return { copied, copy };
}

function CopyButton({ text, id, copied, onCopy }: { text: string; id: string; copied: string | null; onCopy: (text: string, id: string) => void }) {
  const isCopied = copied === id;
  return (
    <Button
      variant="ghost"
      size="sm"
      className="h-7 gap-1 text-xs"
      onClick={() => onCopy(text, id)}
    >
      {isCopied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
      {isCopied ? "Copied" : "Copy"}
    </Button>
  );
}

// ─── Email template block ────────────────────────────────────────────────────

function EmailTemplate({
  title,
  description,
  to,
  subject,
  body,
  id,
  copied,
  onCopy,
}: {
  title: string;
  description: string;
  to: string;
  subject: string;
  body: string;
  id: string;
  copied: string | null;
  onCopy: (text: string, id: string) => void;
}) {
  const fullEmail = `To: ${to}\nSubject: ${subject}\n\n${body}`;
  const mailtoLink = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-base">{title}</CardTitle>
            <CardDescription className="mt-1">{description}</CardDescription>
          </div>
          <Badge variant="outline" className="text-xs shrink-0">
            <Mail className="h-3 w-3 mr-1" />
            Email
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground font-medium w-16">To:</span>
            <code className="text-xs bg-secondary px-2 py-0.5 rounded">{to}</code>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground font-medium w-16">Subject:</span>
            <span className="text-xs">{subject}</span>
          </div>
        </div>
        <div className="bg-secondary/50 rounded-md p-3 border border-border">
          <pre className="text-xs text-foreground whitespace-pre-wrap font-sans leading-relaxed">{body}</pre>
        </div>
        <div className="flex gap-2">
          <CopyButton text={fullEmail} id={id} copied={copied} onCopy={onCopy} />
          <Button variant="outline" size="sm" className="h-7 gap-1 text-xs" asChild>
            <a href={mailtoLink}>
              <Mail className="h-3 w-3" />
              Open in Mail
            </a>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── API Reference Card ──────────────────────────────────────────────────────

function ApiReferenceCard({
  title,
  description,
  endpoint,
  method,
  status,
  docs,
  notes,
}: {
  title: string;
  description: string;
  endpoint: string;
  method: string;
  status: "available" | "coming-soon" | "request-access";
  docs?: string;
  notes?: string[];
}) {
  const statusConfig = {
    "available": { label: "Available", className: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300" },
    "coming-soon": { label: "Coming Soon", className: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300" },
    "request-access": { label: "Request Access", className: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" },
  };

  const s = statusConfig[status];

  return (
    <Card>
      <CardContent className="pt-5 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold">{title}</h3>
            <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
          </div>
          <Badge variant="outline" className={`text-[10px] shrink-0 ${s.className}`}>
            {s.label}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-[10px] font-mono">{method}</Badge>
          <code className="text-xs text-muted-foreground">{endpoint}</code>
        </div>
        {notes && notes.length > 0 && (
          <ul className="space-y-1">
            {notes.map((note, i) => (
              <li key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
                <ArrowRight className="h-3 w-3 mt-0.5 shrink-0" />
                {note}
              </li>
            ))}
          </ul>
        )}
        {docs && (
          <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" asChild>
            <a href={docs} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-3 w-3" />
              View Documentation
            </a>
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

// ─── NDIS Contact Picker ─────────────────────────────────────────────────────

function NdisContactPicker({
  roleKey,
  label,
  description,
  assignedContact,
  allContacts,
  onAssign,
  onRemove,
}: {
  roleKey: string;
  label: string;
  description: string;
  assignedContact: { id: number; display_name: string; email?: string | null } | null;
  allContacts: ContactSelect[];
  onAssign: (roleKey: string, contactId: number) => void;
  onRemove: (roleKey: string) => void;
}) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState("");

  const filtered = search
    ? allContacts.filter((c) =>
        c.display_name.toLowerCase().includes(search.toLowerCase()) ||
        (c.email && c.email.toLowerCase().includes(search.toLowerCase()))
      )
    : allContacts;

  return (
    <div className="flex items-start gap-3 p-3 rounded-lg border border-border bg-card">
      <div className="p-2 rounded-md bg-secondary shrink-0 mt-0.5">
        <UserCircle className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{description}</p>

        {assignedContact ? (
          <div className="mt-2 flex items-center gap-2">
            <Badge variant="secondary" className="text-xs gap-1">
              {assignedContact.display_name}
              {assignedContact.email && (
                <span className="text-muted-foreground ml-1">{assignedContact.email}</span>
              )}
            </Badge>
            <button
              type="button"
              onClick={() => onRemove(roleKey)}
              className="text-muted-foreground hover:text-destructive transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : searchOpen ? (
          <div className="mt-2 space-y-2">
            <Input
              autoFocus
              placeholder="Search contacts..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 text-sm"
            />
            <div className="max-h-40 overflow-y-auto border rounded-md divide-y divide-border">
              {filtered.length === 0 ? (
                <p className="text-xs text-muted-foreground p-2">No contacts found</p>
              ) : (
                filtered.slice(0, 20).map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className="w-full text-left px-3 py-2 hover:bg-secondary/50 transition-colors"
                    onClick={() => {
                      onAssign(roleKey, c.id);
                      setSearchOpen(false);
                      setSearch("");
                    }}
                  >
                    <p className="text-sm">{c.display_name}</p>
                    {c.email && <p className="text-xs text-muted-foreground">{c.email}</p>}
                  </button>
                ))
              )}
            </div>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-xs"
              onClick={() => { setSearchOpen(false); setSearch(""); }}
            >
              Cancel
            </Button>
          </div>
        ) : (
          <Button
            size="sm"
            variant="outline"
            className="mt-2 h-7 text-xs"
            onClick={() => setSearchOpen(true)}
          >
            Assign Contact
          </Button>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function SdaSetupPage() {
  const { copied, copy } = useCopy();
  const { toast } = useToast();

  // Load tenant settings for company data (auto-populate templates)
  const [tenantSettings, setTenantSettings] = useState<TenantSettings | null>(null);
  const [sdaConfig, setSdaConfig] = useState<SdaConfig>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // NDIS registration fields (local state for editing)
  const [ndisRegNumber, setNdisRegNumber] = useState("");
  const [prodaRaNumber, setProdaRaNumber] = useState("");

  // Load contacts for picker
  const { contacts: allContacts, loading: contactsLoading } = useContacts({ mode: "select" });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [tsRes, sdaRes] = await Promise.all([
        api.get<TenantSettings>("/api/v1/tenant_settings"),
        api.get<{ success: boolean; data: SdaConfig }>("/api/v1/tenant_settings/sda_config"),
      ]);
      if (tsRes) setTenantSettings(tsRes);
      if (sdaRes?.data) {
        setSdaConfig(sdaRes.data);
        setNdisRegNumber(sdaRes.data.ndis_registration_number || "");
        setProdaRaNumber(sdaRes.data.proda_ra_number || "");
      }
    } catch {
      // Silently fail - fields will show placeholders
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Save NDIS registration details
  const saveRegistration = async () => {
    setSaving(true);
    try {
      const res = await api.patch<{ success: boolean }>("/api/v1/tenant_settings/sda_config", {
        ndis_registration_number: ndisRegNumber,
        proda_ra_number: prodaRaNumber,
      });
      if (res?.success) {
        toast({ title: "Saved", description: "NDIS registration details updated." });
      }
    } catch {
      toast({ title: "Error", description: "Failed to save registration details.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  // Assign/remove contact for an NDIS role
  const assignContact = async (roleKey: string, contactId: number) => {
    const res = await api.patch<{ success: boolean; data: Record<string, unknown> }>("/api/v1/tenant_settings/sda_config", {
      contacts: { [roleKey]: contactId },
    });
    if (res?.success) {
      // Update local state with the assigned contact
      const contact = allContacts.find((c) => c.id === contactId);
      setSdaConfig((prev) => ({
        ...prev,
        contacts: {
          ...(prev.contacts || {}),
          [roleKey]: contact ? { id: contact.id, display_name: contact.display_name, email: contact.email } : null,
        },
      }));
      toast({ title: "Contact assigned" });
    }
  };

  const removeContact = async (roleKey: string) => {
    const res = await api.patch<{ success: boolean }>("/api/v1/tenant_settings/sda_config", {
      contacts: { [roleKey]: null },
    });
    if (res?.success) {
      setSdaConfig((prev) => ({
        ...prev,
        contacts: { ...(prev.contacts || {}), [roleKey]: null },
      }));
      toast({ title: "Contact removed" });
    }
  };

  // Company data for email templates (from tenant settings SSoT)
  const org = tenantSettings?.company_name || "[Your Organisation Name]";
  const abn = tenantSettings?.abn || "[Your ABN]";
  const orgEmail = tenantSettings?.email || "[Your Email]";
  const orgPhone = tenantSettings?.phone || "[Your Phone]";
  const regNum = ndisRegNumber || "[Your Registration Number]";

  // Find the primary NDIS contact for email signatures
  const primaryContact = sdaConfig.contacts?.primary_ndis_contact;
  const contactName = primaryContact?.display_name || "[Your Name]";
  const contactEmail = primaryContact?.email || orgEmail;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Intro */}
      <div className="flex items-start gap-3 p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
        <Info className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
        <div>
          <p className="text-sm font-medium text-blue-900 dark:text-blue-100">NDIS SDA Integration Setup</p>
          <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
            Configure your NDIS registration details, assign team contacts for SDA roles, and use
            pre-filled email templates to request API access from the NDIA.
          </p>
        </div>
      </div>

      {/* ── Section: NDIS Registration ─────────────────────────────────────── */}
      <div>
        <h2 className="text-lg font-semibold mb-1 flex items-center gap-2">
          <Hash className="h-4 w-4" />
          NDIS Registration
        </h2>
        <p className="text-sm text-muted-foreground mb-4">
          Your organisation details from Settings, plus NDIS-specific registration numbers.
        </p>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Company info (read-only, from tenant settings SSoT) */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                Organisation Details
              </CardTitle>
              <CardDescription>From company settings (SSoT)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="grid grid-cols-[100px_1fr] gap-y-2 gap-x-3 text-sm">
                <span className="text-muted-foreground">Trading Name</span>
                <span className="font-medium">{tenantSettings?.company_name || <span className="text-amber-600 dark:text-amber-400">Not set</span>}</span>
                <span className="text-muted-foreground">ABN</span>
                <span className="font-medium">{tenantSettings?.abn || <span className="text-amber-600 dark:text-amber-400">Not set</span>}</span>
                <span className="text-muted-foreground">Address</span>
                <span className="font-medium">{tenantSettings?.address || <span className="text-amber-600 dark:text-amber-400">Not set</span>}</span>
                <span className="text-muted-foreground">Phone</span>
                <span className="font-medium">{tenantSettings?.phone || <span className="text-amber-600 dark:text-amber-400">Not set</span>}</span>
                <span className="text-muted-foreground">Email</span>
                <span className="font-medium">{tenantSettings?.email || <span className="text-amber-600 dark:text-amber-400">Not set</span>}</span>
              </div>
            </CardContent>
          </Card>

          {/* NDIS-specific registration */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Shield className="h-4 w-4" />
                NDIS Registration
              </CardTitle>
              <CardDescription>NDIS-specific registration numbers</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="ndis-reg" className="text-xs">NDIS Provider Registration Number</Label>
                <Input
                  id="ndis-reg"
                  placeholder="e.g. 4-123456789"
                  value={ndisRegNumber}
                  onChange={(e) => setNdisRegNumber(e.target.value)}
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="proda-ra" className="text-xs">PRODA RA Number</Label>
                <Input
                  id="proda-ra"
                  placeholder="e.g. RA-123456"
                  value={prodaRaNumber}
                  onChange={(e) => setProdaRaNumber(e.target.value)}
                  className="h-8 text-sm"
                />
              </div>
              <Button size="sm" onClick={saveRegistration} disabled={saving}>
                <Save className="h-3.5 w-3.5 mr-1.5" />
                {saving ? "Saving..." : "Save"}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ── Section: NDIS Team Contacts ────────────────────────────────────── */}
      <div>
        <h2 className="text-lg font-semibold mb-1 flex items-center gap-2">
          <Users className="h-4 w-4" />
          NDIS Team Contacts
        </h2>
        <p className="text-sm text-muted-foreground mb-4">
          Assign existing contacts to NDIS roles. These are used in email templates and NDIS correspondence.
        </p>

        {contactsLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
            <Spinner className="h-4 w-4" /> Loading contacts...
          </div>
        ) : (
          <div className="grid gap-3">
            {NDIS_ROLES.map((role) => (
              <NdisContactPicker
                key={role.key}
                roleKey={role.key}
                label={role.label}
                description={role.description}
                assignedContact={sdaConfig.contacts?.[role.key] ?? null}
                allContacts={allContacts}
                onAssign={assignContact}
                onRemove={removeContact}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Section: Email Templates ───────────────────────────────────────── */}
      <div>
        <h2 className="text-lg font-semibold mb-1 flex items-center gap-2">
          <Key className="h-4 w-4" />
          Request API Access
        </h2>
        <p className="text-sm text-muted-foreground mb-4">
          Pre-filled email templates using your organisation details. Update any missing fields above first.
        </p>

        <div className="grid gap-4">
          <EmailTemplate
            id="api-access"
            title="NDIS Provider API Access Request"
            description="Request API credentials for bulk claim submission and enrolment management."
            to="provider.support@ndis.gov.au"
            subject={`SDA Provider API Access Request - ${org}`}
            body={`Dear NDIA Provider Support,

I am writing to request API access for our organisation to integrate with the NDIS Provider Portal for SDA (Specialist Disability Accommodation) management.

Organisation Details:
- Organisation Name: ${org}
- NDIS Provider Registration Number: ${regNum}
- ABN: ${abn}
- Primary Contact: ${contactName}
- Contact Email: ${contactEmail}
- Contact Phone: ${orgPhone}

We are seeking API access for the following services:
1. SDA Dwelling Enrolment API - To programmatically manage dwelling enrolments
2. SDA Claims Submission API - For bulk claim submission and tracking
3. Participant Plan Verification API - To verify participant SDA funding

Our property management system (TEEEM) requires these integrations to streamline our SDA portfolio management.

Please advise on:
- The application process for API credentials
- Required documentation or agreements
- API sandbox/testing environment access
- Technical documentation and specifications

Thank you for your assistance.

Kind regards,
${contactName}
${org}`}
            copied={copied}
            onCopy={copy}
          />

          <EmailTemplate
            id="portal-access"
            title="Provider Portal Access Request"
            description="Request login credentials for the NDIS Provider Portal (myplace)."
            to="provider.support@ndis.gov.au"
            subject={`Provider Portal Access Request - ${org}`}
            body={`Dear NDIA Provider Support,

I am requesting access to the NDIS Provider Portal (myplace) for our SDA provider organisation.

Organisation Details:
- Organisation Name: ${org}
- NDIS Provider Registration Number: ${regNum}
- ABN: ${abn}

User requiring access:
- Full Name: ${contactName}
- Email: ${contactEmail}
- Role: SDA Manager / Administrator

We require access to:
- SDA Dwelling Management
- Claim Submission and Tracking
- Participant Plan Information
- Payment Summaries

Please provide instructions for portal registration and any required authorisation forms.

Kind regards,
${contactName}
${org}`}
            copied={copied}
            onCopy={copy}
          />

          <EmailTemplate
            id="dwelling-enrolment"
            title="New SDA Dwelling Enrolment Request"
            description="Submit a new dwelling for SDA enrolment with the NDIA."
            to="sda.enrolments@ndis.gov.au"
            subject="SDA Dwelling Enrolment Application - [Property Address]"
            body={`Dear SDA Enrolment Team,

I am submitting a new dwelling for SDA enrolment on behalf of our registered SDA provider.

Provider Details:
- Organisation Name: ${org}
- NDIS Provider Registration Number: ${regNum}

Dwelling Details:
- Address: [Full Property Address]
- SDA Design Category: [HPS / Fully Accessible / Improved Liveability / Robust]
- Building Type: [Apartment / House / Duplex / Villa / Group Home]
- Number of Bedrooms: [X]
- Maximum Residents: [X]
- Year Built/Renovated: [Year]

SDA Assessment:
- Assessor Name: [Assessor Name]
- Assessor Registration: [Assessor Number]
- Assessment Date: [Date]
- Assessment Report: [Attached / To Follow]

Required Documentation:
- [ ] SDA Assessment Report
- [ ] Fire Safety Certificate
- [ ] Building Compliance Certificate
- [ ] Occupancy Certificate
- [ ] Insurance Certificate of Currency
- [ ] Property Photos (exterior and all rooms)

Please advise on the enrolment timeline and any additional requirements.

Kind regards,
${contactName}
${org}`}
            copied={copied}
            onCopy={copy}
          />
        </div>
      </div>

      {/* ── Section: NDIS API Reference ─────────────────────────────────── */}
      <div>
        <h2 className="text-lg font-semibold mb-1 flex items-center gap-2">
          <Globe className="h-4 w-4" />
          NDIS API Reference
        </h2>
        <p className="text-sm text-muted-foreground mb-4">
          Available and upcoming NDIS integration endpoints.
        </p>

        <div className="grid gap-3">
          <ApiReferenceCard
            title="Provider Portal (myplace)"
            description="Web-based portal for managing all SDA operations including enrolments, claims, and participant information."
            endpoint="https://provider.ndis.gov.au"
            method="WEB"
            status="available"
            docs="https://www.ndis.gov.au/providers/working-provider/myplace-provider-portal"
            notes={[
              "Primary interface for SDA dwelling enrolment submissions",
              "Manual claim submission and payment tracking",
              "Participant plan verification and service booking management",
            ]}
          />

          <ApiReferenceCard
            title="Bulk Payment Request API"
            description="Submit SDA payment requests in bulk via the Provider Digital Access (PRODA) system."
            endpoint="https://api.ndis.gov.au/providers/v1/payment-requests"
            method="POST"
            status="request-access"
            docs="https://www.ndis.gov.au/providers/working-provider/provider-digital-access"
            notes={[
              "Requires PRODA registration and API key approval",
              "Supports bulk SDA claim submission (CSV or JSON format)",
              "Claims must reference valid service booking numbers",
              "Processing time: typically 2-5 business days",
            ]}
          />

          <ApiReferenceCard
            title="SDA Dwelling Enrolment API"
            description="Programmatically submit and track SDA dwelling enrolment applications."
            endpoint="https://api.ndis.gov.au/providers/v1/sda/dwellings"
            method="POST"
            status="coming-soon"
            notes={[
              "Currently managed through Provider Portal only",
              "API access expected in future NDIS digital roadmap",
              "Contact provider.support@ndis.gov.au for updates",
              "Use email template above to register interest in early access",
            ]}
          />

          <ApiReferenceCard
            title="Participant Plan Verification"
            description="Verify participant SDA funding and plan details for service delivery."
            endpoint="https://api.ndis.gov.au/providers/v1/participants/plans"
            method="GET"
            status="request-access"
            notes={[
              "Verify participant has active SDA funding in their plan",
              "Check service booking validity and remaining budget",
              "Required for automated claim generation",
            ]}
          />

          <ApiReferenceCard
            title="SDA Price Guide API"
            description="Retrieve current SDA price limits by design category, building type, and location."
            endpoint="https://api.ndis.gov.au/providers/v1/sda/price-guide"
            method="GET"
            status="coming-soon"
            notes={[
              "Price limits updated annually (1 July each year)",
              "Currently published as PDF on NDIS website",
              "TEEEM maintains a local copy via SDA Price Guides in the system",
            ]}
          />
        </div>
      </div>

      {/* ── Section: Useful Links ───────────────────────────────────────── */}
      <div>
        <h2 className="text-lg font-semibold mb-1 flex items-center gap-2">
          <FileText className="h-4 w-4" />
          Useful Resources
        </h2>
        <p className="text-sm text-muted-foreground mb-4">
          Key NDIS documents and reference materials for SDA providers.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {[
            {
              title: "SDA Price Guide 2024-25",
              description: "Current maximum SDA prices by design category and building type",
              icon: Receipt,
              url: "https://www.ndis.gov.au/providers/pricing-arrangements/specialist-disability-accommodation-pricing",
            },
            {
              title: "SDA Rules 2020",
              description: "Legislative rules governing SDA under the NDIS",
              icon: Shield,
              url: "https://www.ndis.gov.au/providers/housing-and-living/specialist-disability-accommodation",
            },
            {
              title: "SDA Design Standard",
              description: "Technical design requirements for each SDA category",
              icon: Building2,
              url: "https://www.ndis.gov.au/providers/housing-and-living/specialist-disability-accommodation/sda-design-standard",
            },
            {
              title: "Provider Digital Access (PRODA)",
              description: "Register for API access and manage digital credentials",
              icon: Key,
              url: "https://www.ndis.gov.au/providers/working-provider/provider-digital-access",
            },
          ].map((link) => {
            const Icon = link.icon;
            return (
              <a
                key={link.title}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group"
              >
                <Card className="h-full hover:bg-secondary/30 transition-colors">
                  <CardContent className="pt-5">
                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded-md bg-secondary">
                        <Icon className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-medium group-hover:text-primary transition-colors flex items-center gap-1">
                          {link.title}
                          <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </h3>
                        <p className="text-xs text-muted-foreground mt-0.5">{link.description}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </a>
            );
          })}
        </div>
      </div>
    </div>
  );
}
