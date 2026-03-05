"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
} from "lucide-react";

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

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function SdaSetupPage() {
  const { copied, copy } = useCopy();

  return (
    <div className="space-y-8">
      {/* Intro */}
      <div className="flex items-start gap-3 p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
        <Info className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
        <div>
          <p className="text-sm font-medium text-blue-900 dark:text-blue-100">NDIS SDA Integration Setup</p>
          <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
            Use the email templates below to request API access from the NDIA. Once approved, configure
            the API credentials in the integration settings. The NDIA Provider Portal is the primary
            interface for managing SDA enrolments and claims.
          </p>
        </div>
      </div>

      {/* ── Section: NDIA Contacts & Access ─────────────────────────────── */}
      <div>
        <h2 className="text-lg font-semibold mb-1 flex items-center gap-2">
          <Key className="h-4 w-4" />
          Request API Access
        </h2>
        <p className="text-sm text-muted-foreground mb-4">
          Email templates to request NDIS system access and API credentials.
        </p>

        <div className="grid gap-4">
          <EmailTemplate
            id="api-access"
            title="NDIS Provider API Access Request"
            description="Request API credentials for bulk claim submission and enrolment management."
            to="provider.support@ndis.gov.au"
            subject="SDA Provider API Access Request - [Your Organisation Name]"
            body={`Dear NDIA Provider Support,

I am writing to request API access for our organisation to integrate with the NDIS Provider Portal for SDA (Specialist Disability Accommodation) management.

Organisation Details:
- Organisation Name: [Your Organisation Name]
- NDIS Provider Registration Number: [Your Registration Number]
- ABN: [Your ABN]
- Primary Contact: [Your Name]
- Contact Email: [Your Email]
- Contact Phone: [Your Phone]

We are seeking API access for the following services:
1. SDA Dwelling Enrolment API - To programmatically manage dwelling enrolments
2. SDA Claims Submission API - For bulk claim submission and tracking
3. Participant Plan Verification API - To verify participant SDA funding

Our property management system (TEEEM) requires these integrations to streamline our SDA portfolio management across [X] dwellings.

Please advise on:
- The application process for API credentials
- Required documentation or agreements
- API sandbox/testing environment access
- Technical documentation and specifications

Thank you for your assistance.

Kind regards,
[Your Name]
[Your Position]
[Your Organisation]`}
            copied={copied}
            onCopy={copy}
          />

          <EmailTemplate
            id="portal-access"
            title="Provider Portal Access Request"
            description="Request login credentials for the NDIS Provider Portal (myplace)."
            to="provider.support@ndis.gov.au"
            subject="Provider Portal Access Request - [Your Organisation Name]"
            body={`Dear NDIA Provider Support,

I am requesting access to the NDIS Provider Portal (myplace) for our SDA provider organisation.

Organisation Details:
- Organisation Name: [Your Organisation Name]
- NDIS Provider Registration Number: [Your Registration Number]
- ABN: [Your ABN]

User requiring access:
- Full Name: [User Name]
- Email: [User Email]
- Role: SDA Manager / Administrator

We require access to:
- SDA Dwelling Management
- Claim Submission and Tracking
- Participant Plan Information
- Payment Summaries

Please provide instructions for portal registration and any required authorisation forms.

Kind regards,
[Your Name]
[Your Organisation]`}
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
- Organisation Name: [Your Organisation Name]
- NDIS Provider Registration Number: [Your Registration Number]

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
[Your Name]
[Your Organisation]`}
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
