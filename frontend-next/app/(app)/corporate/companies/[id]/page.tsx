"use client";

import * as React from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  Building2,
  Users,
  FileText,
  DollarSign,
  Edit,
  Loader2,
  ExternalLink,
  Briefcase,
  Heart,
  Clock,
  Landmark,
  FolderOpen,
  Banknote,
  Save,
  X,
  Plus,
  Cloud,
  CheckCircle,
  XCircle,
  Eye,
  AlertTriangle,
  BarChart3,
  Database,
  HardDrive,
  RefreshCw,
  RefreshCcw,
  Link2,
  Unlink,
  Sparkles,
  Pencil,
  GitMerge,
  Info,
  Mail,
  Phone,
  ChevronRight,
  Download,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { format, isValid } from "date-fns";
import { useToast } from "@/components/ui/use-toast";

// Safe date formatter that handles null/invalid dates
const safeFormatDate = (dateValue: string | Date | null | undefined, formatStr: string, fallback = "—"): string => {
  if (!dateValue) return fallback;
  const date = typeof dateValue === "string" ? new Date(dateValue) : dateValue;
  return isValid(date) ? format(date, formatStr) : fallback;
};
import TeeemTableView from "@/components/table/TeeemTableView";
import type { TableColumn, TableRow } from "@/components/table/types";
import DocumentPreviewModal from "@/components/corporate/DocumentPreviewModal";
import DocumentSidePanel from "@/components/corporate/DocumentSidePanel";
import { XeroStatementView } from "@/components/corporate/XeroStatementView";

// Document category tabs
const DOCUMENT_TABS = [
  { id: "advice", name: "ADVICE", icon: Briefcase },
  { id: "asic", name: "ASIC", icon: FileText },
  { id: "assets-docs", name: "ASSETS", icon: Briefcase },
  { id: "ato", name: "ATO", icon: FileText },
  { id: "bank", name: "BANK", icon: Landmark },
  { id: "xero", name: "XERO", icon: RefreshCw },
  { id: "company", name: "COMPANY", icon: Building2 },
  { id: "dividends-docs", name: "DIVIDENDS", icon: DollarSign },
  { id: "financials", name: "FINANCIALS", icon: FileText },
  { id: "general", name: "GENERAL", icon: FolderOpen },
  { id: "insurance", name: "INSURANCE", icon: Heart },
  { id: "loans-docs", name: "LOANS", icon: Banknote },
  { id: "minutes-docs", name: "MINUTES", icon: FileText },
  { id: "registry", name: "REGISTRY", icon: FileText },
  { id: "trust", name: "TRUST", icon: Users },
  { id: "documents", name: "Documents", icon: FileText },
  { id: "data", name: "Data", icon: Database },
  { id: "activity", name: "Activity", icon: Clock },
];

// Overview sub-tabs for Companies (Health accessed via header badge)
const OVERVIEW_SUB_TABS = [
  { id: "info", name: "Information" },
  { id: "corporate", name: "Corporate" },
  { id: "bank-accounts", name: "Bank Accounts" },
  { id: "directors", name: "Directors" },
  { id: "shareholdings", name: "Shareholdings" },
  { id: "consolidation", name: "Consolidation" },
];

// Trust-specific sub-tabs (only shown for Trust/Superfund entities)
const TRUST_SUB_TABS = [
  { id: "info", name: "Information" },
  { id: "trustee", name: "Trustee" },
  { id: "beneficiaries", name: "Beneficiaries" },
  { id: "appointor", name: "Appointor" },
  { id: "trust-deed", name: "Trust Deed" },
  { id: "distributions", name: "Distributions" },
];

// Corporate Trustee sub-tabs (simplified - companies that act as trustees)
const TRUSTEE_COMPANY_SUB_TABS = [
  { id: "info", name: "Information" },
  { id: "corporate", name: "Corporate" },
  { id: "directors", name: "Directors" },
  { id: "shareholdings", name: "Shareholdings" },
  { id: "trusts", name: "Trusts Managed" },
];

// Xero sub-tabs
const XERO_SUB_TABS = [
  { id: "connection", name: "Connection" },
  { id: "accounts", name: "Accounts" },
  { id: "profit-loss", name: "Profit & Loss" },
  { id: "balance-sheet", name: "Balance Sheet" },
  { id: "profit-loss-pdf", name: "P&L PDF Reports" },
  { id: "balance-sheet-pdf", name: "Balance Sheet PDF" },
  { id: "bank-accounts", name: "Bank Accounts" },
  { id: "bank-statement", name: "Bank Statement" },
];

interface Director {
  id: number;
  position: string;
  appointment_date: string;
  resignation_date?: string;
  is_current: boolean;
  formatted_position: string;
  contact: {
    id: number;
    display_name: string;
    email?: string;
    mobile_phone?: string;
  };
}

interface ComplianceItem {
  id: number;
  title: string;
  due_date: string;
  completed: boolean;
  days_until_due: number;
  formatted_compliance_type: string;
}

interface Company {
  id: number;
  name: string;
  previous_names?: string;
  business_names?: string;
  slug?: string;
  code?: string;
  acn?: string;
  abn?: string;
  tfn?: string;
  entity_type?: string;
  contact_id?: number; // SSoT: Link to Contact record
  status?: string;
  date_incorporated?: string;
  purpose?: string;
  is_trustee?: boolean;
  trust_name?: string;
  registered_office_address?: string;
  principal_place_of_business?: string;
  gst_registration_status?: string;
  accounting_method?: string;
  shares_on_issue?: number;
  carry_forward_losses?: number;
  franking_balance?: number;
  amount_owing?: number;
  review_date?: string;
  formatted_acn?: string;
  formatted_abn?: string;
  has_xero_connection?: boolean;
  sharepoint_folder_url?: string;
  current_directors?: Director[];
  pending_compliance_items?: ComplianceItem[];
  company_group?: string | { name: string };
  company_group_id?: number;
  group_name?: string;
  parent_company_id?: number;
  parent_company?: { id: number; name: string };
  // Consolidation
  consolidation_parent_id?: number;
  consolidation_parent?: { id: number; name: string };
  // Corporate details
  corporate_key?: string;
  asic_username?: string;
  has_asic_password?: boolean;
  recovery_question?: string;
  has_recovery_answer?: boolean;
  bank_name?: string;
  bank_bsb?: string;
  bank_account_number?: string;
  bank_account_name?: string;
  bank_start_date?: string;
  bank_end_date?: string;
  company_xero_connection?: {
    id: number;
    connection_status: string;
    xero_tenant_name: string;
    last_sync_at?: string;
  };
}

interface Shareholding {
  id: number;
  shareholder_type: string;
  shareholder_id: number;
  shareholder_name: string;
  number_of_shares: number;
  percentage: number;
  share_class?: string;
  beneficially_held?: boolean;
  beneficial_owner?: string;
  acquisition_date?: string;
  disposal_date?: string;
  certificate_number?: string;
  consideration_paid?: number;
}

// SSoT: Bank account data from bank_accounts table
interface BankAccount {
  id: number;
  institution_name: string;
  bsb?: string;
  account_number: string;
  account_name?: string;
  bank_code?: string;
  xero_account_id?: string;
  status: "active" | "closed";
  date_opened?: string;
  date_closed?: string;
  display_name: string;
  formatted_bsb?: string;
  masked_account_number?: string;
  linked_to_xero?: boolean;
  last_transaction_date?: string;
  first_transaction_date?: string;
}

// Unused - keeping for future implementation
// interface Investment {
//   id: number;
//   company_id: number;
//   company_name: string;
//   company_acn?: string;
//   number_of_shares: number;
//   percentage: number;
//   share_class?: string;
//   acquisition_date?: string;
// }

interface TrustRolesMember {
  membership_id: number;
  contact_id: number;
  contact_name: string;
  contact_email?: string;
  contact_entity_type?: string;
  membership_type: string;
  beneficiary_type?: "named" | "class" | "default";
  class_description?: string;
  can_view_confidential: boolean;
  is_active: boolean;
}

interface TrustRolesData {
  trust: {
    id: number;
    name: string;
    entity_type: string;
    status: string;
    company_group_id: number;
    date_incorporated?: string;
  } | null;
  corporate_trustee: {
    id: number;
    name: string;
    code?: string;
    acn?: string;
    is_trustee: boolean;
    trust_name?: string;
  } | null;
  beneficiaries: TrustRolesMember[];
  appointors: TrustRolesMember[];
  contact_relationships: {
    id: number;
    contact_id: number;
    contact_name: string;
    related_contact_id: number;
    related_contact_name: string;
    relationship_type: string;
    ownership_percentage?: number;
    start_date?: string;
    end_date?: string;
    is_current: boolean;
  }[];
}

// Unused - keeping for future implementation
// function CopyButton({ value }: { value: string }) {
//   const [copied, setCopied] = React.useState(false);
//
//   const handleCopy = async () => {
//     await navigator.clipboard.writeText(value);
//     setCopied(true);
//     setTimeout(() => setCopied(false), 2000);
//   };
//
//   return (
//     <button
//       onClick={handleCopy}
//       className="p-1 hover:bg-muted rounded transition-colors"
//       title="Copy to clipboard"
//     >
//       {copied ? (
//         <Check className="h-3.5 w-3.5 text-green-600" />
//       ) : (
//         <Copy className="h-3.5 w-3.5 text-muted-foreground" />
//       )}
//     </button>
//   );
// }

// Unused - keeping for future implementation
// function InfoRow({ label, value, copyable = false, mono = false }: { label: string; value?: string | number | null; copyable?: boolean; mono?: boolean }) {
//   if (value === undefined || value === null || value === "") return null;
//   return (
//     <div className="flex justify-between py-2 border-b border-border/50 last:border-0">
//       <span className="text-sm text-muted-foreground">{label}</span>
//       <span className={cn("text-sm font-medium flex items-center gap-1", mono && "font-mono")}>
//         {value}
//         {copyable && typeof value === "string" && <CopyButton value={value} />}
//       </span>
//     </div>
//   );
// }

// Information Sub-Tab
function InformationTab({ company }: { company: Company }) {
  return (
    <div className="space-y-6">
      <h3 className="text-lg font-medium">Company Information</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
        <div>
          <p className="text-sm text-muted-foreground">Legal Name</p>
          <p className="text-sm font-medium">{company.name}</p>
          {company.previous_names && (
            <p className="text-xs text-muted-foreground mt-1">Previously: {company.previous_names}</p>
          )}
          {company.business_names && (
            <p className="text-xs text-muted-foreground mt-1">Trading as: {company.business_names}</p>
          )}
        </div>
        {company.date_incorporated && (
          <div>
            <p className="text-sm text-muted-foreground">Date Incorporated</p>
            <p className="text-sm font-medium">{format(new Date(company.date_incorporated), "dd/MM/yyyy")}</p>
          </div>
        )}
        {company.registered_office_address && (
          <div>
            <p className="text-sm text-muted-foreground">Registered Office</p>
            <p className="text-sm font-medium">{company.registered_office_address}</p>
          </div>
        )}
        {company.principal_place_of_business && (
          <div>
            <p className="text-sm text-muted-foreground">Principal Place of Business</p>
            <p className="text-sm font-medium">{company.principal_place_of_business}</p>
          </div>
        )}
        {company.purpose && (
          <div className="md:col-span-2">
            <p className="text-sm text-muted-foreground">Purpose</p>
            <p className="text-sm font-medium">{company.purpose}</p>
          </div>
        )}
      </div>

      {company.current_directors && company.current_directors.length > 0 && (
        <div className="pt-4">
          <h4 className="text-sm font-medium text-muted-foreground mb-3">Current Directors</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {company.current_directors.map((director) => (
              <div key={director.id} className="border rounded-lg p-3 hover:bg-muted/50 transition-colors">
                <div className="flex items-center gap-2 mb-2">
                  <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-medium text-sm">
                    {(director.contact?.display_name || "?")[0].toUpperCase()}
                  </div>
                  <div>
                    <p className="font-medium text-sm">{director.contact?.display_name || "Unknown"}</p>
                    {director.formatted_position && (
                      <p className="text-xs text-muted-foreground">{director.formatted_position}</p>
                    )}
                  </div>
                </div>
                {(director.contact?.email || director.contact?.mobile_phone) && (
                  <div className="space-y-1 text-xs">
                    {director.contact?.email && (
                      <a href={`mailto:${director.contact.email}`} className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground">
                        <Mail className="h-3 w-3" />
                        <span className="truncate">{director.contact.email}</span>
                      </a>
                    )}
                    {director.contact?.mobile_phone && (
                      <a href={`tel:${director.contact.mobile_phone}`} className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground">
                        <Phone className="h-3 w-3" />
                        <span>{director.contact.mobile_phone}</span>
                      </a>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Corporate Sub-Tab (editable sensitive information)
function CorporateTab({ company, onUpdate }: { company: Company; onUpdate: () => void }) {
  const [isEditing, setIsEditing] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [formData, setFormData] = React.useState({
    tfn: company.tfn || "",
    business_names: company.business_names || "",
    previous_names: company.previous_names || "",
    registered_office_address: company.registered_office_address || "",
    corporate_key: company.corporate_key || "",
    asic_username: company.asic_username || "",
    asic_password: "",
    recovery_question: company.recovery_question || "",
    recovery_answer: "",
  });

  const handleSave = async () => {
    setSaving(true);
    try {
      const dataToSend: Record<string, unknown> = { ...formData };
      if (!dataToSend.asic_password) delete dataToSend.asic_password;
      if (!dataToSend.recovery_answer) delete dataToSend.recovery_answer;
      // Convert previous_names string to array (comma-separated)
      if (typeof dataToSend.previous_names === "string") {
        const names = (dataToSend.previous_names as string)
          .split(",")
          .map((n) => n.trim())
          .filter((n) => n.length > 0);
        dataToSend.previous_names = names;
      }
      await api.put(`/api/v1/companies/${company.id}`, { company: dataToSend });
      setIsEditing(false);
      onUpdate();
    } catch (error) {
      console.error("Failed to save:", error);
    } finally {
      setSaving(false);
    }
  };

  const formatTFN = (tfn?: string) => {
    if (!tfn) return "-";
    const digits = tfn.replace(/\D/g, "");
    if (digits.length === 9) {
      return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
    }
    return tfn;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">Corporate Details</h3>
        {!isEditing ? (
          <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
            <Edit className="h-4 w-4 mr-2" />
            Edit
          </Button>
        ) : (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setIsEditing(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
              Save
            </Button>
          </div>
        )}
      </div>

      <div className="bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-900 rounded-lg p-4">
        <p className="text-sm text-yellow-800 dark:text-yellow-200">
          This section contains sensitive corporate information. Keep this data secure and limit access.
        </p>
      </div>

      {/* Tax & Registration */}
      <div>
        <h4 className="text-sm font-semibold mb-4">Tax & Registration</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label className="text-muted-foreground">TFN</Label>
            {isEditing ? (
              <Input
                value={formData.tfn}
                onChange={(e) => setFormData({ ...formData, tfn: e.target.value })}
                placeholder="000 000 000"
                className="mt-1"
              />
            ) : (
              <p className="text-sm font-mono mt-1">{formatTFN(company.tfn)}</p>
            )}
          </div>
          <div>
            <Label className="text-muted-foreground">Business Names (Trading As)</Label>
            {isEditing ? (
              <Input
                value={formData.business_names}
                onChange={(e) => setFormData({ ...formData, business_names: e.target.value })}
                placeholder="Trading names"
                className="mt-1"
              />
            ) : (
              <p className="text-sm mt-1">{company.business_names || "-"}</p>
            )}
          </div>
          <div>
            <Label className="text-muted-foreground">Previous Names</Label>
            {isEditing ? (
              <Input
                value={formData.previous_names}
                onChange={(e) => setFormData({ ...formData, previous_names: e.target.value })}
                placeholder="Comma-separated previous names"
                className="mt-1"
              />
            ) : (
              <p className="text-sm mt-1">{company.previous_names || "-"}</p>
            )}
            <p className="text-xs text-muted-foreground mt-1">Separate multiple names with commas</p>
          </div>
          <div className="md:col-span-2">
            <Label className="text-muted-foreground">Registered Office</Label>
            {isEditing ? (
              <Textarea
                value={formData.registered_office_address}
                onChange={(e) => setFormData({ ...formData, registered_office_address: e.target.value })}
                rows={2}
                className="mt-1"
              />
            ) : (
              <p className="text-sm mt-1">{company.registered_office_address || "-"}</p>
            )}
          </div>
        </div>
      </div>

      {/* ASIC Portal Access */}
      <div className="border-t pt-6">
        <h4 className="text-sm font-semibold mb-4">ASIC Portal Access</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <div>
            <Label className="text-muted-foreground">Corporate Key</Label>
            {isEditing ? (
              <Input
                value={formData.corporate_key}
                onChange={(e) => setFormData({ ...formData, corporate_key: e.target.value })}
                className="mt-1"
              />
            ) : (
              <p className="text-sm font-mono mt-1">{company.corporate_key || "-"}</p>
            )}
          </div>
          <div>
            <Label className="text-muted-foreground">User Name</Label>
            {isEditing ? (
              <Input
                value={formData.asic_username}
                onChange={(e) => setFormData({ ...formData, asic_username: e.target.value })}
                className="mt-1"
              />
            ) : (
              <p className="text-sm mt-1">{company.asic_username || "-"}</p>
            )}
          </div>
          <div>
            <Label className="text-muted-foreground">Password</Label>
            {isEditing ? (
              <Input
                value={formData.asic_password}
                onChange={(e) => setFormData({ ...formData, asic_password: e.target.value })}
                placeholder="Enter to change"
                className="mt-1"
              />
            ) : (
              <p className="text-sm mt-1">{company.has_asic_password ? "••••••••" : "-"}</p>
            )}
          </div>
          <div>
            <Label className="text-muted-foreground">Recovery Question</Label>
            {isEditing ? (
              <Input
                value={formData.recovery_question}
                onChange={(e) => setFormData({ ...formData, recovery_question: e.target.value })}
                className="mt-1"
              />
            ) : (
              <p className="text-sm mt-1">{company.recovery_question || "-"}</p>
            )}
          </div>
          <div>
            <Label className="text-muted-foreground">Answer</Label>
            {isEditing ? (
              <Input
                value={formData.recovery_answer}
                onChange={(e) => setFormData({ ...formData, recovery_answer: e.target.value })}
                placeholder="Enter to change"
                className="mt-1"
              />
            ) : (
              <p className="text-sm mt-1">{company.has_recovery_answer ? "••••••••" : "-"}</p>
            )}
          </div>
        </div>
      </div>

    </div>
  );
}

// Directors Sub-Tab
interface OfficerRecord {
  id: number;
  position: string;
  formatted_position: string;
  appointment_date: string;
  resignation_date?: string;
  is_current: boolean;
  notes?: string;
  contact: {
    id: number;
    display_name: string;
    email?: string;
    mobile_phone?: string;
  };
}

function DirectorsTab({ companyId }: { companyId: string }) {
  const [officers, setOfficers] = React.useState<OfficerRecord[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const loadOfficers = async () => {
      try {
        const response = await api.get<{ success: boolean; directors: OfficerRecord[] }>(
          `/api/v1/companies/${companyId}/directors`
        );
        setOfficers(response.directors || []);
      } catch (error) {
        console.error("Failed to load officers:", error);
      } finally {
        setLoading(false);
      }
    };
    loadOfficers();
  }, [companyId]);

  // Group officers by role type
  const directors = officers.filter(o => o.position?.includes("director") || o.position === "chairman");
  const secretaries = officers.filter(o => o.position?.includes("secretary"));
  const publicOfficers = officers.filter(o => o.position?.includes("public_officer"));

  const renderOfficerList = (title: string, officerList: OfficerRecord[]) => {
    const current = officerList.filter(o => o.is_current);
    const former = officerList.filter(o => !o.is_current);

    return (
      <div className="space-y-3">
        <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">{title}</h4>
        {officerList.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2">No {title.toLowerCase()} recorded</p>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">Name</th>
                  <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">Position</th>
                  <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">Appointed</th>
                  <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">Resigned</th>
                  <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {/* Current officers first */}
                {current.map((officer) => (
                  <tr key={officer.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center text-green-700 dark:text-green-300 text-xs font-medium">
                          {officer.contact?.display_name?.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2) || "?"}
                        </div>
                        <div>
                          <p className="text-sm font-medium">{officer.contact?.display_name || "Unknown"}</p>
                          {officer.contact?.email && (
                            <a href={`mailto:${officer.contact.email}`} className="text-xs text-muted-foreground hover:text-primary">
                              {officer.contact.email}
                            </a>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm">{officer.formatted_position}</td>
                    <td className="px-4 py-3 text-sm">{officer.appointment_date ? format(new Date(officer.appointment_date), "dd/MM/yyyy") : "-"}</td>
                    <td className="px-4 py-3 text-sm">-</td>
                    <td className="px-4 py-3">
                      <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">Current</Badge>
                    </td>
                  </tr>
                ))}
                {/* Former officers */}
                {former.map((officer) => (
                  <tr key={officer.id} className="hover:bg-muted/30 opacity-60">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-500 text-xs font-medium">
                          {officer.contact?.display_name?.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2) || "?"}
                        </div>
                        <div>
                          <p className="text-sm font-medium">{officer.contact?.display_name || "Unknown"}</p>
                          {officer.contact?.email && (
                            <span className="text-xs text-muted-foreground">{officer.contact.email}</span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm">{officer.formatted_position}</td>
                    <td className="px-4 py-3 text-sm">{officer.appointment_date ? format(new Date(officer.appointment_date), "dd/MM/yyyy") : "-"}</td>
                    <td className="px-4 py-3 text-sm">{officer.resignation_date ? format(new Date(officer.resignation_date), "dd/MM/yyyy") : "-"}</td>
                    <td className="px-4 py-3">
                      <Badge variant="secondary">Former</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-medium">Corporate Officers History</h3>
      {renderOfficerList("Directors", directors)}
      {renderOfficerList("Secretaries", secretaries)}
      {renderOfficerList("Public Officers", publicOfficers)}
    </div>
  );
}

// Shareholdings Sub-Tab
function ShareholdingsTab({ company, companyId }: { company: Company; companyId: string }) {
  const [shareholders, setShareholders] = React.useState<Shareholding[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const loadShareholders = async () => {
      try {
        const response = await api.get<{ success: boolean; data: { shareholdings: Shareholding[] } }>(
          `/api/v1/companies/${companyId}/shareholders`
        );
        setShareholders(response.data?.shareholdings || []);
      } catch (error) {
        console.error("Failed to load shareholders:", error);
      } finally {
        setLoading(false);
      }
    };
    loadShareholders();
  }, [companyId]);

  // Separate current and former shareholders
  const currentShareholders = shareholders.filter(sh => !sh.disposal_date);
  const formerShareholders = shareholders.filter(sh => sh.disposal_date);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">Shareholding History</h3>
        {company.shares_on_issue && (
          <span className="text-sm text-muted-foreground">
            {company.shares_on_issue.toLocaleString()} shares on issue
          </span>
        )}
      </div>

      {shareholders.length > 0 ? (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">Shareholder</th>
                <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">Class</th>
                <th className="text-right px-4 py-2 text-xs font-medium text-muted-foreground">Shares</th>
                <th className="text-right px-4 py-2 text-xs font-medium text-muted-foreground">%</th>
                <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">Acquired</th>
                <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">Disposed</th>
                <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {/* Current shareholders first */}
              {currentShareholders.map((sh) => (
                <tr key={sh.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center text-green-700 dark:text-green-300 text-xs font-medium">
                        {sh.shareholder_name?.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2) || "?"}
                      </div>
                      <div>
                        <p className="text-sm font-medium">{sh.shareholder_name}</p>
                        {sh.beneficially_held && (
                          <p className="text-xs text-muted-foreground">Beneficial: {sh.beneficial_owner}</p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm capitalize">{sh.share_class || "Ordinary"}</td>
                  <td className="px-4 py-3 text-sm text-right font-mono">{sh.number_of_shares.toLocaleString()}</td>
                  <td className="px-4 py-3 text-sm text-right">{sh.percentage}%</td>
                  <td className="px-4 py-3 text-sm">{sh.acquisition_date ? format(new Date(sh.acquisition_date), "dd/MM/yyyy") : "-"}</td>
                  <td className="px-4 py-3 text-sm">-</td>
                  <td className="px-4 py-3">
                    <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">Current</Badge>
                  </td>
                </tr>
              ))}
              {/* Former shareholders */}
              {formerShareholders.map((sh) => (
                <tr key={sh.id} className="hover:bg-muted/30 opacity-60">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-500 text-xs font-medium">
                        {sh.shareholder_name?.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2) || "?"}
                      </div>
                      <div>
                        <p className="text-sm font-medium">{sh.shareholder_name}</p>
                        {sh.beneficially_held && (
                          <p className="text-xs text-muted-foreground">Beneficial: {sh.beneficial_owner}</p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm capitalize">{sh.share_class || "Ordinary"}</td>
                  <td className="px-4 py-3 text-sm text-right font-mono">{sh.number_of_shares.toLocaleString()}</td>
                  <td className="px-4 py-3 text-sm text-right">{sh.percentage}%</td>
                  <td className="px-4 py-3 text-sm">{sh.acquisition_date ? format(new Date(sh.acquisition_date), "dd/MM/yyyy") : "-"}</td>
                  <td className="px-4 py-3 text-sm">{sh.disposal_date ? format(new Date(sh.disposal_date), "dd/MM/yyyy") : "-"}</td>
                  <td className="px-4 py-3">
                    <Badge variant="secondary">Former</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-muted-foreground text-center py-8">No shareholders recorded</p>
      )}
    </div>
  );
}

// Bank Accounts Tab - SSoT: Uses bank_accounts table via Foundation (ID: 350)
function BankAccountsTab({ company, companyId }: { company: Company; companyId: string }) {
  const [entries, setEntries] = React.useState<any[]>([]);
  const [columns, setColumns] = React.useState<any[]>([]);
  const [foundation, setFoundation] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);

  const loadData = React.useCallback(async () => {
    try {
      setLoading(true);

      // Load foundation definition for Bank Account (ID: 350)
      const foundationResponse = await api.get<{ success: boolean; foundation: any }>(
        `/api/v1/foundations/350`
      );
      if (foundationResponse.success) {
        setFoundation(foundationResponse.foundation);
        setColumns(foundationResponse.foundation.columns || []);
      }

      // Load bank account entries for this company
      const entriesResponse = await api.get<{ success: boolean; bank_accounts: any[] }>(
        `/api/v1/companies/${companyId}/bank_accounts`
      );
      if (entriesResponse.success) {
        setEntries(entriesResponse.bank_accounts || []);
      }
    } catch (error) {
      console.error("Failed to load bank accounts:", error);
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRefresh = async () => {
    await loadData();
  };

  const handleRowUpdate = async (rowId: number | string, field: string, value: unknown) => {
    try {
      await api.put(`/api/v1/bank_accounts/${rowId}`, {
        bank_account: { [field]: value }
      });
      await loadData();
    } catch (error) {
      console.error("Failed to update bank account:", error);
      throw error;
    }
  };

  const handleDelete = async (row: { id: number | string; [key: string]: unknown }) => {
    try {
      await api.delete(`/api/v1/bank_accounts/${row.id}`);
      await loadData();
    } catch (error) {
      console.error("Failed to delete bank account:", error);
      throw error;
    }
  };

  const handleBulkDelete = async (ids: (number | string)[]) => {
    try {
      await Promise.all(ids.map(id => api.delete(`/api/v1/bank_accounts/${id}`)));
      await loadData();
    } catch (error) {
      console.error("Failed to bulk delete bank accounts:", error);
      throw error;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!foundation) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        Failed to load bank accounts configuration
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <TeeemTableView
        entries={entries}
        columns={columns}
        foundationId="bank_accounts"
        foundationIdNumeric={350}
        tableName="Bank Accounts"
        enableExport={true}
        enableImport={false}
        onRefresh={handleRefresh}
        onRowUpdate={handleRowUpdate}
        onDelete={handleDelete}
        onBulkDelete={handleBulkDelete}
      />
    </div>
  );
}

// Health status colors
const HEALTH_STATUS_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  excellent: { bg: "bg-green-100 dark:bg-green-900/30", text: "text-green-800 dark:text-green-300", border: "border-green-200 dark:border-green-800" },
  good: { bg: "bg-blue-100 dark:bg-blue-900/30", text: "text-blue-800 dark:text-blue-300", border: "border-blue-200 dark:border-blue-800" },
  needs_attention: { bg: "bg-yellow-100 dark:bg-yellow-900/30", text: "text-yellow-800 dark:text-yellow-300", border: "border-yellow-200 dark:border-yellow-800" },
  critical: { bg: "bg-red-100 dark:bg-red-900/30", text: "text-red-800 dark:text-red-300", border: "border-red-200 dark:border-red-800" },
};

interface HealthData {
  company?: {
    id: number;
    name: string;
    health_score: number;
    health_status: string;
    issues?: string[];
    warnings?: string[];
    has_acn?: boolean;
    has_abn?: boolean;
    has_tfn?: boolean;
    has_registered_office?: boolean;
    has_corporate_key?: boolean;
    director_count?: number;
    bank_account_count?: number;
    shareholder_count?: number;
  };
  summary?: {
    total: number;
    excellent: number;
    good: number;
    needs_attention: number;
    critical: number;
    average_score: number;
  };
  allCompanies?: Array<{
    id: number;
    name: string;
    health_score: number;
    health_status: string;
    issues: string[];
    warnings: string[];
  }>;
}

function CompletionItem({ label, completed, value }: { label: string; completed?: boolean; value?: number }) {
  return (
    <div className="flex items-center space-x-2">
      {completed ? (
        <CheckCircle className="h-5 w-5 text-green-500" />
      ) : (
        <XCircle className="h-5 w-5 text-red-400" />
      )}
      <span className="text-sm text-muted-foreground">
        {label}
        {value !== undefined && value > 0 && <span className="ml-1 opacity-60">({value})</span>}
      </span>
    </div>
  );
}

function HealthTab({ company, onUpdate }: { company: Company; onUpdate: () => void }) {
  const [healthData, setHealthData] = React.useState<HealthData | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [reloading, setReloading] = React.useState(false);

  React.useEffect(() => {
    loadHealthReport();
     
  }, [company.id]);

  const loadHealthReport = async () => {
    try {
      setLoading(true);
      const response = await api.get<{ companies: HealthData["allCompanies"]; summary: HealthData["summary"] }>("/api/v1/companies/health_report");
      const companyHealth = response.companies?.find((c) => c.id === company.id);
      setHealthData({
        company: companyHealth,
        summary: response.summary,
        allCompanies: response.companies,
      });
    } catch (error) {
      console.error("Failed to load health report:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleReloadFromSpreadsheet = async () => {
    try {
      setReloading(true);
      await api.post("/api/v1/companies/reload");
      await loadHealthReport();
      onUpdate();
    } catch (error) {
      console.error("Failed to reload:", error);
    } finally {
      setReloading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const companyHealth = healthData?.company;
  const colors = companyHealth ? HEALTH_STATUS_COLORS[companyHealth.health_status] || HEALTH_STATUS_COLORS.critical : HEALTH_STATUS_COLORS.critical;

  return (
    <div className="space-y-6">
      {/* Actions */}
      <div className="flex justify-end">
        <Button onClick={handleReloadFromSpreadsheet} disabled={reloading}>
          <Loader2 className={cn("h-4 w-4 mr-2", reloading ? "animate-spin" : "hidden")} />
          {reloading ? "Reloading..." : "Reload from Spreadsheet"}
        </Button>
      </div>

      {/* Health Score Card */}
      {companyHealth && (
        <div className={cn("rounded-lg p-6 border", colors.bg, colors.border)}>
          <div className="flex items-center justify-between">
            <div>
              <h3 className={cn("text-lg font-medium", colors.text)}>Health Score: {companyHealth.health_score}%</h3>
              <p className={cn("text-sm mt-1 opacity-75", colors.text)}>
                Status: {companyHealth.health_status.replace("_", " ").toUpperCase()}
              </p>
            </div>
            <div className={cn("text-5xl font-bold", colors.text)}>{companyHealth.health_score}</div>
          </div>
        </div>
      )}

      {/* Issues */}
      {companyHealth?.issues && companyHealth.issues.length > 0 && (
        <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4 border border-red-200 dark:border-red-800">
          <h4 className="text-sm font-medium text-red-800 dark:text-red-300 flex items-center mb-3">
            <XCircle className="h-5 w-5 mr-2" />
            Critical Issues ({companyHealth.issues.length})
          </h4>
          <ul className="space-y-2">
            {companyHealth.issues.map((issue, idx) => (
              <li key={idx} className="text-sm text-red-700 dark:text-red-400 flex items-start">
                <span className="inline-block w-2 h-2 bg-red-500 rounded-full mt-1.5 mr-2" />
                {issue}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Warnings */}
      {companyHealth?.warnings && companyHealth.warnings.length > 0 && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-4 border border-yellow-200 dark:border-yellow-800">
          <h4 className="text-sm font-medium text-yellow-800 dark:text-yellow-300 flex items-center mb-3">
            <AlertTriangle className="h-5 w-5 mr-2" />
            Warnings ({companyHealth.warnings.length})
          </h4>
          <ul className="space-y-2">
            {companyHealth.warnings.map((warning, idx) => (
              <li key={idx} className="text-sm text-yellow-700 dark:text-yellow-400 flex items-start">
                <span className="inline-block w-2 h-2 bg-yellow-500 rounded-full mt-1.5 mr-2" />
                {warning}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* All Clear */}
      {companyHealth?.issues?.length === 0 && companyHealth?.warnings?.length === 0 && (
        <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4 border border-green-200 dark:border-green-800">
          <h4 className="text-sm font-medium text-green-800 dark:text-green-300 flex items-center">
            <CheckCircle className="h-5 w-5 mr-2" />
            All checks passed - company data is complete
          </h4>
        </div>
      )}

      {/* Data Completeness */}
      <Card>
        <CardContent className="p-4">
          <h4 className="text-sm font-medium mb-4">Data Completeness</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <CompletionItem label="ACN" completed={companyHealth?.has_acn} />
            <CompletionItem label="ABN" completed={companyHealth?.has_abn} />
            <CompletionItem label="TFN" completed={companyHealth?.has_tfn} />
            <CompletionItem label="Registered Office" completed={companyHealth?.has_registered_office} />
            <CompletionItem label="Corporate Key" completed={companyHealth?.has_corporate_key} />
            <CompletionItem label="Directors" completed={(companyHealth?.director_count || 0) > 0} value={companyHealth?.director_count} />
            <CompletionItem label="Bank Accounts" completed={(companyHealth?.bank_account_count || 0) > 0} value={companyHealth?.bank_account_count} />
            <CompletionItem label="Shareholders" completed={(companyHealth?.shareholder_count || 0) > 0} value={companyHealth?.shareholder_count} />
          </div>
        </CardContent>
      </Card>

      {/* All Companies Summary */}
      {healthData?.summary && (
        <div className="bg-muted/50 rounded-lg p-4">
          <h4 className="text-sm font-medium mb-4 flex items-center">
            <BarChart3 className="h-5 w-5 mr-2" />
            All Companies Overview
          </h4>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold">{healthData.summary.total}</div>
              <div className="text-xs text-muted-foreground">Total</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-green-600">{healthData.summary.excellent}</div>
              <div className="text-xs text-muted-foreground">Excellent</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-blue-600">{healthData.summary.good}</div>
              <div className="text-xs text-muted-foreground">Good</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-yellow-600">{healthData.summary.needs_attention}</div>
              <div className="text-xs text-muted-foreground">Needs Attention</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-red-600">{healthData.summary.critical}</div>
              <div className="text-xs text-muted-foreground">Critical</div>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t text-center">
            <div className="text-sm text-muted-foreground">
              Average Health Score: <span className="font-medium">{healthData.summary.average_score}%</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Trust icon SVG component
function TrustIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 3L22 20H2L12 3Z" strokeLinejoin="round" />
    </svg>
  );
}

interface CompanyGroup {
  id: number;
  name: string;
}

interface TrustCompany {
  id: number;
  name: string;
  abn?: string;
  entity_type?: string;
}

function TrustsTab({ company, onUpdate }: { company: Company; onUpdate: () => void }) {
  const router = useRouter();
  const [trusts, setTrusts] = React.useState<TrustCompany[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [showAddForm, setShowAddForm] = React.useState(false);
  const [availableTrusts, setAvailableTrusts] = React.useState<TrustCompany[]>([]);
  const [selectedTrustId, setSelectedTrustId] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [companyGroups, setCompanyGroups] = React.useState<CompanyGroup[]>([]);
  const [selectedGroupId, setSelectedGroupId] = React.useState(String(company.company_group_id || ""));
  const [savingGroup, setSavingGroup] = React.useState(false);

  React.useEffect(() => {
    loadTrusts();
    loadCompanyGroups();
     
  }, [company.id]);

  const loadTrusts = async () => {
    try {
      setLoading(true);
      if (company.is_trustee && company.trust_name) {
        const params: Record<string, string | number | boolean> = { search: company.trust_name };
        if (company.company_group_id) {
          params.company_group_id = company.company_group_id;
        }
        const response = await api.get<{ companies: TrustCompany[] }>("/api/v1/companies", { params });
        const matchingTrust = (response.companies || []).find(
          (t) => t.name === company.trust_name && ["Trust", "Superfund"].includes(t.entity_type || "")
        );
        setTrusts(matchingTrust ? [matchingTrust] : []);
      } else {
        setTrusts([]);
      }
    } catch (error) {
      console.error("Failed to load trusts:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadAvailableTrusts = async () => {
    try {
      const params: Record<string, string | number | boolean> = {};
      if (company.company_group_id) {
        params.company_group_id = company.company_group_id;
      }
      const response = await api.get<{ companies: TrustCompany[] }>("/api/v1/companies", { params });
      const trustsAndSuperfunds = (response.companies || []).filter((c) =>
        ["Trust", "Superfund"].includes(c.entity_type || "")
      );
      setAvailableTrusts(trustsAndSuperfunds);
    } catch (error) {
      console.error("Failed to load available trusts:", error);
    }
  };

  const loadCompanyGroups = async () => {
    try {
      const response = await api.get<{ data: CompanyGroup[] }>("/api/v1/company_groups");
      setCompanyGroups(response.data || []);
    } catch (error) {
      console.error("Failed to load company groups:", error);
    }
  };

  const handleGroupChange = async (newGroupId: string) => {
    if (newGroupId === selectedGroupId) return;
    try {
      setSavingGroup(true);
      await api.put(`/api/v1/companies/${company.id}`, {
        company: { company_group_id: newGroupId || null },
      });
      setSelectedGroupId(newGroupId);
      onUpdate();
    } catch (error) {
      console.error("Failed to update company group:", error);
    } finally {
      setSavingGroup(false);
    }
  };

  const handleAddTrust = () => {
    loadAvailableTrusts();
    setShowAddForm(true);
  };

  const handleSaveTrust = async () => {
    if (!selectedTrustId) return;
    try {
      setSaving(true);
      const selectedTrust = availableTrusts.find((t) => t.id === parseInt(selectedTrustId));
      await api.put(`/api/v1/companies/${company.id}`, {
        company: { is_trustee: true, trust_name: selectedTrust?.name },
      });
      setShowAddForm(false);
      setSelectedTrustId("");
      onUpdate();
      loadTrusts();
    } catch (error) {
      console.error("Failed to save trust link:", error);
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveTrust = async () => {
    if (!confirm("Remove this company as trustee for this trust?")) return;
    try {
      await api.put(`/api/v1/companies/${company.id}`, {
        company: { is_trustee: false, trust_name: "" },
      });
      onUpdate();
      loadTrusts();
    } catch (error) {
      console.error("Failed to remove trust link:", error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Company Group Selector */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <Label className="whitespace-nowrap">Company Group:</Label>
            <select
              value={selectedGroupId}
              onChange={(e) => handleGroupChange(e.target.value)}
              disabled={savingGroup}
              className="block w-full max-w-md rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
            >
              <option value="">Select a group...</option>
              {companyGroups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name}
                </option>
              ))}
            </select>
            {savingGroup && <span className="text-sm text-muted-foreground">Saving...</span>}
          </div>
        </CardContent>
      </Card>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">Trusts</h3>
          <p className="text-sm text-muted-foreground">
            {company.is_trustee
              ? "This company acts as trustee for the following trust(s)"
              : "Make this company a trustee for a trust"}
          </p>
        </div>
        {!company.is_trustee && !showAddForm && (
          <Button onClick={handleAddTrust}>
            <Plus className="h-4 w-4 mr-2" />
            Link Trust
          </Button>
        )}
      </div>

      {/* Add Trust Form */}
      {showAddForm && (
        <Card className="bg-muted/50">
          <CardContent className="p-4">
            <h4 className="text-sm font-medium mb-3">Select Trust to Link</h4>
            <div className="space-y-4">
              <select
                value={selectedTrustId}
                onChange={(e) => setSelectedTrustId(e.target.value)}
                className="block w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">Select a trust...</option>
                {availableTrusts.map((trust) => (
                  <option key={trust.id} value={trust.id}>
                    {trust.name}
                  </option>
                ))}
              </select>
              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => { setShowAddForm(false); setSelectedTrustId(""); }}>
                  Cancel
                </Button>
                <Button onClick={handleSaveTrust} disabled={!selectedTrustId || saving}>
                  {saving ? "Saving..." : "Link Trust"}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Trusts List */}
      {trusts.length === 0 && !showAddForm ? (
        <div className="text-center py-12 bg-muted/50 rounded-lg border-2 border-dashed">
          <TrustIcon className="mx-auto h-12 w-12 text-muted-foreground" />
          <h3 className="mt-2 text-sm font-semibold">No trusts linked</h3>
          <p className="mt-1 text-sm text-muted-foreground">This company is not a trustee for any trust.</p>
          <Button className="mt-4" onClick={handleAddTrust}>
            <Plus className="h-4 w-4 mr-2" />
            Link Trust
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {trusts.map((trust) => (
            <Card key={trust.id}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex-shrink-0 text-purple-600 dark:text-purple-400">
                      <TrustIcon className="h-8 w-8" />
                    </div>
                    <div>
                      <button
                        onClick={() => router.push(`/corporate/companies/${trust.id}`)}
                        className="text-lg font-medium hover:text-primary"
                      >
                        {trust.name}
                      </button>
                      <div className="flex items-center gap-3 text-sm text-muted-foreground">
                        {trust.abn && <span>ABN: {trust.abn}</span>}
                        <Badge variant="secondary" className="bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300">
                          Trust
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        {company.name} acts as trustee for this trust
                      </p>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" onClick={handleRemoveTrust} title="Remove trust link">
                    <X className="h-5 w-5 text-muted-foreground hover:text-destructive" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Info box */}
      {company.is_trustee && trusts.length > 0 && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <p className="text-sm text-blue-800 dark:text-blue-300">
            <strong>Note:</strong> In the Company Groups hierarchy view, this company will display as
            &quot;{company.name} ATF {company.trust_name}&quot; and the trust will appear as a child when expanded.
          </p>
        </div>
      )}
    </div>
  );
}

// Trust-specific tabs for Trust/Superfund entities
function TrusteeTab({ company }: { company: Company }) {
  const router = useRouter();
  const [trustRoles, setTrustRoles] = React.useState<TrustRolesData | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const loadTrustRoles = async () => {
      try {
        const response = await api.get<{ success: boolean; data: TrustRolesData }>(
          `/api/v1/companies/${company.id}/trust_roles`
        );
        setTrustRoles(response.data);
      } catch (error) {
        console.error("Failed to load trust roles:", error);
      } finally {
        setLoading(false);
      }
    };
    loadTrustRoles();
  }, [company.id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const trustee = trustRoles?.corporate_trustee;

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Trustee</h3>
      {trustee ? (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium">{trustee.name}</div>
                {trustee.acn && (
                  <div className="text-sm text-muted-foreground">ACN: {trustee.acn}</div>
                )}
                <Badge variant="outline" className="mt-1 bg-purple-100 text-purple-700">
                  Corporate Trustee
                </Badge>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push(`/corporate/companies/${trustee.id}`)}
              >
                <ExternalLink className="h-4 w-4 mr-1" />
                View
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="text-center text-muted-foreground py-8 border rounded-lg">
          No trustee assigned to this trust
        </div>
      )}
    </div>
  );
}

function BeneficiariesTab({ company }: { company: Company }) {
  const router = useRouter();
  const [trustRoles, setTrustRoles] = React.useState<TrustRolesData | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const loadTrustRoles = async () => {
      try {
        const response = await api.get<{ success: boolean; data: TrustRolesData }>(
          `/api/v1/companies/${company.id}/trust_roles`
        );
        setTrustRoles(response.data);
      } catch (error) {
        console.error("Failed to load trust roles:", error);
      } finally {
        setLoading(false);
      }
    };
    loadTrustRoles();
  }, [company.id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const beneficiaries = trustRoles?.beneficiaries || [];

  // Group beneficiaries by type
  const namedBeneficiaries = beneficiaries.filter(b => b.beneficiary_type === "named" || !b.beneficiary_type);
  const classBeneficiaries = beneficiaries.filter(b => b.beneficiary_type === "class");
  const defaultBeneficiary = beneficiaries.filter(b => b.beneficiary_type === "default");

  const renderBeneficiaryCard = (b: TrustRolesMember, colorClass: string) => (
    <Card key={b.membership_id}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-medium">{b.contact_name}</div>
            {b.class_description && (
              <div className="text-sm text-muted-foreground italic">{b.class_description}</div>
            )}
            {b.contact_email && (
              <div className="text-sm text-muted-foreground">{b.contact_email}</div>
            )}
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="outline" className={colorClass}>
                {b.beneficiary_type === "class" ? "Class" :
                 b.beneficiary_type === "default" ? "Taker in Default" : "Named"}
              </Badge>
              {b.contact_entity_type && (
                <Badge variant="outline">{b.contact_entity_type}</Badge>
              )}
              {!b.is_active && (
                <Badge variant="destructive">Inactive</Badge>
              )}
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push(`/contacts/${b.contact_id}`)}
          >
            <ExternalLink className="h-4 w-4 mr-1" />
            View
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Beneficiaries ({beneficiaries.length})</h3>
        <Button variant="outline" size="sm">
          <Plus className="h-4 w-4 mr-1" />
          Add Beneficiary
        </Button>
      </div>

      {beneficiaries.length > 0 ? (
        <>
          {/* Named Beneficiaries */}
          {namedBeneficiaries.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Named Beneficiaries ({namedBeneficiaries.length})
              </h4>
              <div className="space-y-2">
                {namedBeneficiaries.map((b) => renderBeneficiaryCard(b, "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"))}
              </div>
            </div>
          )}

          {/* Class/Group Beneficiaries */}
          {classBeneficiaries.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Class Beneficiaries ({classBeneficiaries.length})
              </h4>
              <p className="text-xs text-muted-foreground">Groups or classes of beneficiaries (e.g., &quot;children of X&quot;, &quot;relatives&quot;)</p>
              <div className="space-y-2">
                {classBeneficiaries.map((b) => renderBeneficiaryCard(b, "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"))}
              </div>
            </div>
          )}

          {/* Taker in Default */}
          {defaultBeneficiary.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Taker in Default
              </h4>
              <p className="text-xs text-muted-foreground">Receives trust property if trustee fails to exercise discretion or trust winds up</p>
              <div className="space-y-2">
                {defaultBeneficiary.map((b) => renderBeneficiaryCard(b, "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"))}
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="text-center text-muted-foreground py-8 border rounded-lg">
          No beneficiaries recorded for this trust.
          <div className="text-sm mt-2">Add named beneficiaries, class beneficiaries, or a taker in default.</div>
        </div>
      )}
    </div>
  );
}

function AppointorTab({ company }: { company: Company }) {
  const router = useRouter();
  const [trustRoles, setTrustRoles] = React.useState<TrustRolesData | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const loadTrustRoles = async () => {
      try {
        const response = await api.get<{ success: boolean; data: TrustRolesData }>(
          `/api/v1/companies/${company.id}/trust_roles`
        );
        setTrustRoles(response.data);
      } catch (error) {
        console.error("Failed to load trust roles:", error);
      } finally {
        setLoading(false);
      }
    };
    loadTrustRoles();
  }, [company.id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const appointors = trustRoles?.appointors || [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Appointor</h3>
        {appointors.length === 0 && (
          <Button variant="outline" size="sm">
            <Plus className="h-4 w-4 mr-1" />
            Set Appointor
          </Button>
        )}
      </div>
      <p className="text-sm text-muted-foreground">
        The appointor has the power to remove and appoint trustees.
      </p>
      {appointors.length > 0 ? (
        <div className="space-y-2">
          {appointors.map((a) => (
            <Card key={a.membership_id}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">{a.contact_name}</div>
                    {a.contact_email && (
                      <div className="text-sm text-muted-foreground">{a.contact_email}</div>
                    )}
                    <Badge variant="outline" className="mt-1 bg-rose-100 text-rose-700">
                      Appointor
                    </Badge>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => router.push(`/contacts/${a.contact_id}`)}
                  >
                    <ExternalLink className="h-4 w-4 mr-1" />
                    View
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="text-center text-muted-foreground py-8 border rounded-lg">
          No appointor recorded for this trust.
          <div className="text-sm mt-2">Check the trust deed for appointor details.</div>
        </div>
      )}
    </div>
  );
}

function TrustDeedTab() {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Trust Deed</h3>
      <p className="text-sm text-muted-foreground">
        View the trust deed document and any deed variations.
      </p>
      <div className="text-center text-muted-foreground py-8 border rounded-lg">
        Trust deed documents are shown in the TRUST document category tab.
        <div className="mt-4">
          <Button variant="outline" size="sm">
            Go to TRUST Documents
          </Button>
        </div>
      </div>
    </div>
  );
}

function DistributionsTab() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Distributions</h3>
        <Button variant="outline" size="sm">
          <Plus className="h-4 w-4 mr-1" />
          Record Distribution
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">
        Track income and capital distributions to beneficiaries.
      </p>
      <div className="text-center text-muted-foreground py-8 border rounded-lg">
        No distributions recorded yet.
        <div className="text-sm mt-2">
          Distributions will appear here once recorded.
        </div>
      </div>
    </div>
  );
}

interface ConsolidatedCompany {
  id: number;
  name: string;
  code?: string;
  acn?: string;
  entity_type?: string;
  status?: string;
}

// Org chart node interface for structure display
interface OrgChartNodeData {
  id: number;
  name: string;
  code?: string;
  entity_type?: string;
  is_trustee?: boolean;
  trust_name?: string;
  is_trust_of_trustee?: boolean;
  children: OrgChartNodeData[];
}

// Recursive component to render org chart nodes
function OrgChartNode({
  node,
  currentCompanyId,
  onNavigate,
  level,
}: {
  node: OrgChartNodeData;
  currentCompanyId: number;
  onNavigate: (id: number) => void;
  level: number;
}) {
  const isCurrentCompany = node.id === currentCompanyId;
  const isTrust = node.entity_type === "Trust" || node.entity_type === "Superfund";
  const hasChildren = node.children && node.children.length > 0;

  // Get icon based on entity type
  const getEntityIcon = () => {
    if (node.is_trust_of_trustee) return "🔐"; // Trust managed by trustee
    if (isTrust) return "📜"; // Trust/Superfund
    if (node.is_trustee) return "🏛️"; // Corporate trustee
    return "🏢"; // Regular company
  };

  return (
    <div className="relative">
      {/* Node box */}
      <div className="flex items-start gap-2 mb-2">
        {/* Indent based on level with connecting line */}
        {level > 0 && (
          <div className="flex items-center" style={{ width: `${level * 24}px` }}>
            <div className="flex items-center justify-end w-full">
              <div className="w-4 h-px bg-border" />
              <ChevronRight className="h-3 w-3 text-muted-foreground -ml-1" />
            </div>
          </div>
        )}

        <button
          onClick={() => onNavigate(node.id)}
          className={cn(
            "flex items-center gap-2 px-3 py-2 rounded-lg border text-left transition-all hover:shadow-md",
            isCurrentCompany
              ? "bg-primary/10 border-primary ring-2 ring-primary/20"
              : isTrust
              ? "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800 hover:bg-amber-100 dark:hover:bg-amber-900/30"
              : "bg-background border-border hover:bg-muted"
          )}
        >
          <span className="text-lg">{getEntityIcon()}</span>
          <div>
            <div className={cn(
              "text-sm font-medium",
              isCurrentCompany && "text-primary"
            )}>
              {node.name}
              {node.code && <span className="ml-1 text-xs text-muted-foreground">({node.code})</span>}
            </div>
            <div className="text-xs text-muted-foreground">
              {node.is_trust_of_trustee ? "Trust" : node.entity_type || "Company"}
              {node.is_trustee && node.trust_name && (
                <span className="ml-1">(Trustee for {node.trust_name})</span>
              )}
            </div>
          </div>
          {isCurrentCompany && (
            <Badge variant="outline" className="ml-2 text-xs bg-primary/10 text-primary border-primary/30">
              Current
            </Badge>
          )}
        </button>
      </div>

      {/* Render children recursively */}
      {hasChildren && (
        <div className="ml-0">
          {node.children.map((child) => (
            <OrgChartNode
              key={child.id}
              node={child}
              currentCompanyId={currentCompanyId}
              onNavigate={onNavigate}
              level={level + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ConsolidationTab({ company, onUpdate }: { company: Company; onUpdate: () => void }) {
  const router = useRouter();
  const [consolidatedCompanies, setConsolidatedCompanies] = React.useState<ConsolidatedCompany[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [showAddForm, setShowAddForm] = React.useState(false);
  const [availableCompanies, setAvailableCompanies] = React.useState<ConsolidatedCompany[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [companyGroups, setCompanyGroups] = React.useState<CompanyGroup[]>([]);
  const [selectedGroupId, setSelectedGroupId] = React.useState(String(company.company_group_id || ""));
  const [savingGroup, setSavingGroup] = React.useState(false);
  // Parent company state - SSoT: Use consolidation_parent_id for hierarchy
  const [parentCompanyOptions, setParentCompanyOptions] = React.useState<{ id: number; name: string }[]>([]);
  const [selectedParentId, setSelectedParentId] = React.useState(String(company.consolidation_parent_id || ""));
  const [savingParent, setSavingParent] = React.useState(false);
  // Trustee state
  const [availableTrusts, setAvailableTrusts] = React.useState<{ id: number; name: string; entity_type?: string }[]>([]);
  const [selectedTrustName, setSelectedTrustName] = React.useState(company.trust_name || "");
  const [savingTrustee, setSavingTrustee] = React.useState(false);
  // Group structure for org chart
  const [groupStructure, setGroupStructure] = React.useState<{
    group: { id: number; name: string };
    companies: OrgChartNodeData[];
  } | null>(null);

  React.useEffect(() => {
    loadConsolidatedCompanies();
    loadCompanyGroups();
    loadParentCompanyOptions();
    loadAvailableTrusts();
    loadGroupStructure();
     
  }, [company.id]);

  const loadConsolidatedCompanies = async () => {
    try {
      setLoading(true);
      const response = await api.get<{ companies: ConsolidatedCompany[] }>("/api/v1/companies", {
        params: { consolidation_parent_id: company.id },
      });
      setConsolidatedCompanies(response.companies || []);
    } catch (error) {
      console.error("Failed to load consolidated companies:", error);
      setConsolidatedCompanies([]);
    } finally {
      setLoading(false);
    }
  };

  const loadAvailableCompanies = async () => {
    try {
      const response = await api.get<{ companies: ConsolidatedCompany[] }>("/api/v1/companies");
      const available = (response.companies || []).filter(
        (c) => c.id !== company.id && !consolidatedCompanies.find((cc) => cc.id === c.id)
      );
      setAvailableCompanies(available);
    } catch (error) {
      console.error("Failed to load available companies:", error);
    }
  };

  const loadCompanyGroups = async () => {
    try {
      const response = await api.get<{ data: CompanyGroup[] }>("/api/v1/company_groups");
      setCompanyGroups(response.data || []);
    } catch (error) {
      console.error("Failed to load company groups:", error);
    }
  };

  const loadParentCompanyOptions = async () => {
    try {
      const params: Record<string, string | number> = {};
      if (company.company_group_id) {
        params.company_group_id = company.company_group_id;
      }
      const response = await api.get<{ companies: { id: number; name: string }[] }>("/api/v1/companies", { params });
      // Exclude current company from parent options
      const filtered = (response.companies || []).filter((c) => c.id !== company.id);
      setParentCompanyOptions(filtered);
    } catch (error) {
      console.error("Failed to load parent company options:", error);
    }
  };

  const handleParentChange = async (newParentId: string) => {
    if (newParentId === selectedParentId) return;
    try {
      setSavingParent(true);
      // SSoT: Use consolidation_parent_id for hierarchy (single source of truth)
      await api.put(`/api/v1/companies/${company.id}`, {
        company: { consolidation_parent_id: newParentId || null },
      });
      setSelectedParentId(newParentId);
      onUpdate();
    } catch (error) {
      console.error("Failed to update parent company:", error);
    } finally {
      setSavingParent(false);
    }
  };

  const loadAvailableTrusts = async () => {
    try {
      const params: Record<string, string | number> = {};
      if (company.company_group_id) {
        params.company_group_id = company.company_group_id;
      }
      const response = await api.get<{ companies: { id: number; name: string; entity_type?: string }[] }>("/api/v1/companies", { params });
      // Filter to only trusts and superfunds
      const trusts = (response.companies || []).filter((c) =>
        ["Trust", "Superfund"].includes(c.entity_type || "")
      );
      setAvailableTrusts(trusts);
    } catch (error) {
      console.error("Failed to load available trusts:", error);
    }
  };

  const loadGroupStructure = async () => {
    if (!company.company_group_id) {
      setGroupStructure(null);
      return;
    }
    try {
      const response = await api.get<{ success: boolean; data: { group: { id: number; name: string }; companies: OrgChartNodeData[] } }>(
        `/api/v1/company_groups/${company.company_group_id}/structure`
      );
      if (response.success) {
        setGroupStructure(response.data);
      }
    } catch (error) {
      console.error("Failed to load group structure:", error);
    }
  };

  const handleTrusteeChange = async (trustName: string) => {
    if (trustName === selectedTrustName) return;
    try {
      setSavingTrustee(true);
      await api.put(`/api/v1/companies/${company.id}`, {
        company: {
          is_trustee: trustName ? true : false,
          trust_name: trustName || null,
        },
      });
      setSelectedTrustName(trustName);
      onUpdate();
    } catch (error) {
      console.error("Failed to update trustee:", error);
    } finally {
      setSavingTrustee(false);
    }
  };

  const handleGroupChange = async (newGroupId: string) => {
    if (newGroupId === selectedGroupId) return;
    try {
      setSavingGroup(true);
      await api.put(`/api/v1/companies/${company.id}`, {
        company: { company_group_id: newGroupId || null },
      });
      setSelectedGroupId(newGroupId);
      onUpdate();
      // Reload structure after group change
      if (newGroupId) {
        setTimeout(() => loadGroupStructure(), 500);
      } else {
        setGroupStructure(null);
      }
    } catch (error) {
      console.error("Failed to update company group:", error);
    } finally {
      setSavingGroup(false);
    }
  };

  const handleAddCompany = () => {
    loadAvailableCompanies();
    setShowAddForm(true);
  };

  const handleSaveConsolidation = async () => {
    if (!selectedCompanyId) return;
    try {
      setSaving(true);
      // SSoT: Only use consolidation_parent_id for hierarchy (single source of truth)
      await api.put(`/api/v1/companies/${selectedCompanyId}`, {
        company: {
          consolidation_parent_id: company.id,
          company_group_id: company.company_group_id
        },
      });
      setShowAddForm(false);
      setSelectedCompanyId("");
      loadConsolidatedCompanies();
      loadGroupStructure(); // Refresh org chart
      onUpdate();
    } catch (error) {
      console.error("Failed to add to consolidation:", error);
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveConsolidation = async (companyId: number) => {
    if (!confirm("Remove this company from consolidation?")) return;
    try {
      // SSoT: Only clear consolidation_parent_id (single source of truth)
      await api.put(`/api/v1/companies/${companyId}`, {
        company: { consolidation_parent_id: null },
      });
      loadConsolidatedCompanies();
      loadGroupStructure(); // Refresh org chart
      onUpdate();
    } catch (error) {
      console.error("Failed to remove from consolidation:", error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Company Group & Parent Company Selectors */}
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex items-center gap-4">
            <Label className="whitespace-nowrap w-32">Company Group:</Label>
            <select
              value={selectedGroupId}
              onChange={(e) => handleGroupChange(e.target.value)}
              disabled={savingGroup}
              className="block w-full max-w-md rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
            >
              <option value="">Select a group...</option>
              {companyGroups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name}
                </option>
              ))}
            </select>
            {savingGroup && <span className="text-sm text-muted-foreground">Saving...</span>}
          </div>
          <div className="flex items-center gap-4">
            <Label className="whitespace-nowrap w-32">Parent Company:</Label>
            <select
              value={selectedParentId}
              onChange={(e) => handleParentChange(e.target.value)}
              disabled={savingParent}
              className="block w-full max-w-md rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
            >
              <option value="">None (Top-level entity)</option>
              {parentCompanyOptions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            {savingParent && <span className="text-sm text-muted-foreground">Saving...</span>}
          </div>
          <div className="flex items-center gap-4">
            <Label className="whitespace-nowrap w-32">Trustee For:</Label>
            <select
              value={selectedTrustName}
              onChange={(e) => handleTrusteeChange(e.target.value)}
              disabled={savingTrustee}
              className="block w-full max-w-md rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
            >
              <option value="">Not a trustee</option>
              {availableTrusts.map((trust) => (
                <option key={trust.id} value={trust.name}>
                  {trust.name}
                </option>
              ))}
            </select>
            {savingTrustee && <span className="text-sm text-muted-foreground">Saving...</span>}
          </div>
          <p className="text-xs text-muted-foreground">
            Set relationships: Parent Company for hierarchy, Trustee For if this company acts as trustee for a trust
          </p>
        </CardContent>
      </Card>

      {/* Consolidated Under Banner */}
      {company.consolidation_parent && (
        <Card className="border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/30">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                <GitMerge className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                  This entity is consolidated under{" "}
                  <button
                    onClick={() => router.push(`/corporate/companies/${company.consolidation_parent!.id}`)}
                    className="text-blue-600 dark:text-blue-400 hover:underline font-semibold"
                  >
                    {company.consolidation_parent.name}
                  </button>
                </p>
                <p className="text-xs text-blue-700 dark:text-blue-300">
                  Financial results are reported through the consolidation parent
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Group Structure Chart */}
      {groupStructure && groupStructure.companies.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-muted-foreground" />
                <h4 className="font-medium">{groupStructure.group.name} Structure</h4>
              </div>
            </div>
            <div className="overflow-x-auto">
              <div className="min-w-fit">
                {groupStructure.companies.map((node) => (
                  <OrgChartNode
                    key={node.id}
                    node={node}
                    currentCompanyId={company.id}
                    onNavigate={(id) => router.push(`/corporate/companies/${id}`)}
                    level={0}
                  />
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">Consolidation</h3>
          <p className="text-sm text-muted-foreground">Companies included in this entity&apos;s financial consolidation</p>
        </div>
        {!showAddForm && (
          <Button onClick={handleAddCompany}>
            <Plus className="h-4 w-4 mr-2" />
            Add Company
          </Button>
        )}
      </div>

      {/* Add Company Form */}
      {showAddForm && (
        <Card className="bg-muted/50">
          <CardContent className="p-4">
            <h4 className="text-sm font-medium mb-3">Add Company to Consolidation</h4>
            <div className="space-y-4">
              <select
                value={selectedCompanyId}
                onChange={(e) => setSelectedCompanyId(e.target.value)}
                className="block w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">Select a company...</option>
                {availableCompanies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.code ? `(${c.code})` : ""}
                  </option>
                ))}
              </select>
              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => { setShowAddForm(false); setSelectedCompanyId(""); }}>
                  Cancel
                </Button>
                <Button onClick={handleSaveConsolidation} disabled={!selectedCompanyId || saving}>
                  {saving ? "Adding..." : "Add to Consolidation"}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Consolidated Companies List */}
      {consolidatedCompanies.length === 0 && !showAddForm ? (
        <div className="text-center py-12 bg-muted/50 rounded-lg border-2 border-dashed">
          <Building2 className="mx-auto h-12 w-12 text-muted-foreground" />
          <h3 className="mt-2 text-sm font-semibold">No consolidated companies</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Add subsidiaries that are included in this company&apos;s financial consolidation.
          </p>
          <Button className="mt-4" onClick={handleAddCompany}>
            <Plus className="h-4 w-4 mr-2" />
            Add Company
          </Button>
        </div>
      ) : (
        <Card>
          <div className="overflow-hidden">
            <table className="min-w-full divide-y divide-border">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Company</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">ACN</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Type</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {consolidatedCompanies.map((c) => (
                  <tr key={c.id} className="hover:bg-muted/50">
                    <td className="px-4 py-3">
                      <button
                        onClick={() => router.push(`/corporate/companies/${c.id}`)}
                        className="text-sm font-medium text-primary hover:underline"
                      >
                        {c.name}
                      </button>
                      {c.code && <span className="ml-2 text-xs text-muted-foreground">({c.code})</span>}
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{c.acn || "-"}</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{c.entity_type || "Company"}</td>
                    <td className="px-4 py-3">
                      <Badge variant={c.status === "active" ? "default" : "secondary"} className={c.status === "active" ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300" : ""}>
                        {c.status || "active"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button variant="ghost" size="icon" onClick={() => handleRemoveConsolidation(c.id)} title="Remove from consolidation">
                        <X className="h-5 w-5 text-muted-foreground hover:text-destructive" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Info box */}
      {consolidatedCompanies.length > 0 && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <p className="text-sm text-blue-800 dark:text-blue-300">
            <strong>Consolidation Summary:</strong> {consolidatedCompanies.length}{" "}
            {consolidatedCompanies.length === 1 ? "company" : "companies"} consolidated under {company.name}
          </p>
        </div>
      )}
    </div>
  );
}

// Document interface for table
interface CompanyDocument extends TableRow {
  display_title?: string;
  title?: string;
  validated?: boolean;
  validation_source?: string;
  financial_years?: string;
  folder?: string;
  document_type?: string;
  source?: string;
  file_size?: number;
  document_date?: string;
  created_at?: string;
  file_url?: string;
  user_validated_at?: string;
  // AI verification fields
  ai_verification_status?: "pending" | "processing" | "verified" | "mismatch" | "error";
  ai_suggested_name?: string;
  ai_suggested_folder?: string;
  ai_suggested_type?: string;
  ai_suggested_fy?: string;
  ai_confidence_score?: number;
  ai_analysis_notes?: string;
  ai_error_message?: string;
  user_validated_by_id?: number;
  company_id?: number;
}

// Folder options for documents
const DOCUMENT_FOLDER_OPTIONS = [
  "ADVICE", "ASIC", "ASSETS", "ATO", "BANK", "COMPANY",
  "DIVIDENDS", "FINANCIALS", "GENERAL", "INSURANCE",
  "LOANS", "MINUTES", "REGISTRY", "TRUST"
];

// Document type options
const DOCUMENT_TYPE_OPTIONS = [
  { value: "tax_return", label: "Tax Return" },
  { value: "bas", label: "BAS" },
  { value: "financial_statement", label: "Financial Statement" },
  { value: "annual_report", label: "Annual Report" },
  { value: "minutes", label: "Minutes" },
  { value: "resolution", label: "Resolution" },
  { value: "contract", label: "Contract" },
  { value: "loan", label: "Loan Document" },
  { value: "insurance", label: "Insurance" },
  { value: "asic", label: "ASIC Document" },
  { value: "other", label: "Other" },
];

// Build column definitions for documents table
// Column types must match Foundation ID 357 (company_documents)
const buildDocumentColumns = (): TableColumn[] => [
  { key: "id", label: "ID", column_type: "whole_number", resizable: true, sortable: true, filterable: true, filterType: "text", width: 60 },
  { key: "title", label: "Title", column_type: "string", resizable: true, sortable: true, filterable: true, filterType: "text", width: 300 },
  { key: "validated", label: "Validated", column_type: "boolean", resizable: false, sortable: true, filterable: true, filterType: "dropdown", width: 80 },
  { key: "ai_confidence", label: "AI", column_type: "whole_number", resizable: false, sortable: true, filterable: true, filterType: "dropdown", width: 50 },
  { key: "document_type", label: "Type", column_type: "choice", resizable: true, sortable: true, filterable: true, filterType: "dropdown", width: 100 },
  { key: "financial_years", label: "FY", column_type: "structured_data", resizable: true, sortable: true, filterable: true, filterType: "dropdown", width: 80 },
  { key: "folder", label: "Folder", column_type: "choice", resizable: true, sortable: true, filterable: true, filterType: "dropdown", width: 100 },
  { key: "ref_date", label: "REF Date", column_type: "date", resizable: true, sortable: true, filterable: true, filterType: "date", width: 100 },
  { key: "filed_date", label: "Filed", column_type: "date", resizable: true, sortable: true, filterable: true, filterType: "date", width: 100 },
  { key: "source", label: "Source", column_type: "choice", resizable: true, sortable: true, filterable: true, filterType: "dropdown", width: 100 },
  { key: "file_size", label: "Size", column_type: "whole_number", resizable: true, sortable: true, filterable: false, width: 100 },
  { key: "created_at", label: "Uploaded", column_type: "date_and_time", resizable: true, sortable: true, filterable: false, width: 150 },
];

// Format file size helper
function formatFileSize(bytes?: number): string {
  if (!bytes) return "-";
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${Math.round((bytes / Math.pow(1024, i)) * 100) / 100} ${sizes[i]}`;
}

function CompanyDocumentsTab({ companyId, company, category }: { companyId: string; company: Company; category?: string }) {
  const [documents, setDocuments] = React.useState<CompanyDocument[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [columns] = React.useState(buildDocumentColumns());
  const [companies, setCompanies] = React.useState<Company[]>([]);

  // Document preview state - side panel for single click, fullscreen modal for double click
  const [selectedDocument, setSelectedDocument] = React.useState<CompanyDocument | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = React.useState(false);
  const [sidePanelDocument, setSidePanelDocument] = React.useState<CompanyDocument | null>(null);
  const [isSidePanelOpen, setIsSidePanelOpen] = React.useState(false);

  React.useEffect(() => {
    loadDocuments();
    // checkSharePointConnection(); // Unused - SharePoint connection state was never defined
    loadCompanies();
     
  }, [companyId, category]);

  const loadCompanies = async () => {
    try {
      const response = await api.get<{ companies: Company[] }>("/api/v1/companies");
      setCompanies(response.companies || []);
    } catch (error) {
      console.error("Failed to load companies:", error);
    }
  };

  const loadDocuments = async () => {
    try {
      setLoading(true);
      const params: Record<string, string> = { company_id: companyId };
      if (category && category !== "all") {
        params.tab = category;
      }
      const response = await api.get<{ documents: CompanyDocument[] }>("/api/v1/company_documents", { params });
      const docs = response.documents || [];
      // Transform documents for table display
      const transformed = docs.map((doc) => ({
        ...doc,
        display_title: doc.display_title || doc.title,
        file_size_display: formatFileSize(doc.file_size),
        source_display: doc.source === "sharepoint" ? "SharePoint" : "Upload",
        financial_years: Array.isArray(doc.financial_years)
          ? (doc.financial_years as unknown as string[]).join(", ")
          : doc.financial_years || "",
        validated: !!(doc.user_validated_at || doc.ai_verification_status === "verified"),
        validation_source: doc.user_validated_at ? "user" : doc.ai_verification_status === "verified" ? "ai" : undefined,
        ai_confidence: doc.ai_confidence_score || null,
      }));
      setDocuments(transformed);
    } catch (error) {
      console.error("Failed to load documents:", error);
    } finally {
      setLoading(false);
    }
  };

  // Unused - SharePoint connection state was never defined
  // const checkSharePointConnection = async () => {
  //   try {
  //     const response = await api.get<{ connected: boolean }>("/api/v1/organization_onedrive/status");
  //     setSharepointConnected(response.connected === true);
  //   } catch {
  //     setSharepointConnected(false);
  //   }
  // };

  // Debounce ref to distinguish single vs double click
  const clickTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  // Single click - open side panel preview (debounced to avoid triggering on double-click)
  const handleSingleClick = (doc: CompanyDocument) => {
    // Clear any pending single-click action
    if (clickTimeoutRef.current) {
      clearTimeout(clickTimeoutRef.current);
    }
    // Delay single-click action to see if it's actually a double-click
    clickTimeoutRef.current = setTimeout(() => {
      setSidePanelDocument(doc);
      setIsSidePanelOpen(true);
      clickTimeoutRef.current = null;
    }, 200); // 200ms delay to detect double-click
  };

  // Double click - open fullscreen modal for editing
  const handleDoubleClick = (doc: CompanyDocument) => {
    // Cancel the pending single-click action
    if (clickTimeoutRef.current) {
      clearTimeout(clickTimeoutRef.current);
      clickTimeoutRef.current = null;
    }
    // Close side panel if open
    setIsSidePanelOpen(false);
    setSidePanelDocument(null);
    // Open fullscreen modal
    setSelectedDocument(doc);
    setIsPreviewOpen(true);
  };

  // Expand from side panel to fullscreen modal
  const handleExpandToFullscreen = () => {
    if (sidePanelDocument) {
      setSelectedDocument(sidePanelDocument);
      setIsPreviewOpen(true);
      setIsSidePanelOpen(false);
      setSidePanelDocument(null);
    }
  };

  const handleDelete = async (doc: CompanyDocument) => {
    if (!confirm("Are you sure you want to delete this document?")) return;
    try {
      await api.delete(`/api/v1/company_documents/${doc.id}`);
      await loadDocuments();
    } catch (error) {
      console.error("Failed to delete document:", error);
    }
  };

  const handleBulkDelete = async (ids: (number | string)[]) => {
    if (!confirm(`Delete ${ids.length} documents? This cannot be undone.`)) return;
    try {
      await Promise.all(ids.map((id) => api.delete(`/api/v1/company_documents/${id}`)));
      await loadDocuments();
    } catch (error) {
      console.error("Failed to bulk delete documents:", error);
    }
  };

  // Handle inline document field update (folder, type, etc.)
  const handleInlineUpdate = async (docId: number | string, field: string, value: string) => {
    try {
      // Use relocate endpoint for folder changes (moves file in OneDrive)
      if (field === "folder") {
        await api.post(`/api/v1/company_documents/${docId}/relocate`, {
          relocate: { folder: value }
        });
      } else {
        // Regular update for other fields
        await api.patch(`/api/v1/company_documents/${docId}`, {
          company_document: { [field]: value }
        });
      }
      await loadDocuments();
    } catch (error) {
      console.error(`Failed to update document ${field}:`, error);
      alert(`Failed to update ${field}`);
    }
  };

  // Custom cell renderer
  const customCellRenderer = (doc: CompanyDocument, columnKey: string) => {
    switch (columnKey) {
      case "validated":
        if (doc.validated) {
          return (
            <div className="flex justify-center" title={doc.validation_source === "user" ? "Validated by user" : "Validated by AI"}>
              <CheckCircle className={cn("h-5 w-5", doc.validation_source === "ai" ? "text-blue-500" : "text-green-500")} />
            </div>
          );
        }
        return (
          <div className="flex justify-center" title="Not validated">
            <span className="h-5 w-5 rounded-full border-2 border-muted-foreground/30" />
          </div>
        );
      case "ai_confidence":
        // Show AI verification status with confidence percentage
        if (doc.ai_verification_status === "processing") {
          return (
            <div className="flex justify-center" title="AI analyzing...">
              <Loader2 className="h-4 w-4 animate-spin text-purple-500" />
            </div>
          );
        }
        if (doc.ai_confidence_score) {
          const score = doc.ai_confidence_score;
          const colorClass = score >= 90 ? "text-green-600 bg-green-100 dark:bg-green-900/30"
            : score >= 70 ? "text-yellow-600 bg-yellow-100 dark:bg-yellow-900/30"
            : "text-red-600 bg-red-100 dark:bg-red-900/30";
          return (
            <div className="flex justify-center" title={`AI confidence: ${score}%\n${doc.ai_analysis_notes || ''}`}>
              <Badge variant="outline" className={cn("text-[10px] px-1 py-0 font-mono", colorClass)}>
                {score}%
              </Badge>
            </div>
          );
        }
        if (doc.ai_verification_status === "error") {
          return (
            <div className="flex justify-center" title={doc.ai_error_message || "AI analysis failed"}>
              <XCircle className="h-4 w-4 text-red-400" />
            </div>
          );
        }
        return (
          <div className="flex justify-center" title="Not analyzed by AI">
            <span className="text-muted-foreground text-xs">-</span>
          </div>
        );
      case "source":
        if (doc.source === "sharepoint") {
          return (
            <Badge variant="secondary" className="bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300">
              <Cloud className="h-3 w-3 mr-1" />
              SharePoint
            </Badge>
          );
        }
        return <Badge variant="outline">Upload</Badge>;
      case "file_size":
        return <span className="text-muted-foreground">{formatFileSize(doc.file_size)}</span>;
      case "folder":
        return (
          <Select
            value={doc.folder || ""}
            onValueChange={(value) => handleInlineUpdate(doc.id, "folder", value)}
          >
            <SelectTrigger
              className="h-7 w-[120px] text-xs border-0 bg-transparent hover:bg-muted"
              onClick={(e) => e.stopPropagation()}
            >
              <SelectValue placeholder="Select...">
                {doc.folder ? (
                  <Badge variant="outline" className="bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                    {doc.folder}
                  </Badge>
                ) : (
                  <span className="text-muted-foreground">-</span>
                )}
              </SelectValue>
            </SelectTrigger>
            <SelectContent onClick={(e) => e.stopPropagation()}>
              {DOCUMENT_FOLDER_OPTIONS.map((folder) => (
                <SelectItem key={folder} value={folder}>
                  {folder}
                  {folder === doc.folder && " ✓"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      case "document_type":
        return (
          <Select
            value={doc.document_type || ""}
            onValueChange={(value) => handleInlineUpdate(doc.id, "document_type", value)}
          >
            <SelectTrigger
              className="h-7 w-[130px] text-xs border-0 bg-transparent hover:bg-muted"
              onClick={(e) => e.stopPropagation()}
            >
              <SelectValue placeholder="Select...">
                {doc.document_type ? (
                  <span className="capitalize">{doc.document_type.replace(/_/g, " ")}</span>
                ) : (
                  <span className="text-muted-foreground">-</span>
                )}
              </SelectValue>
            </SelectTrigger>
            <SelectContent onClick={(e) => e.stopPropagation()}>
              {DOCUMENT_TYPE_OPTIONS.map((type) => (
                <SelectItem key={type.value} value={type.value}>
                  {type.label}
                  {type.value === doc.document_type && " ✓"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      case "financial_years":
        // Show FY badges that can be used for filtering
        // Parse the financial_years - it could be an array, string, or comma-separated
        const fyValue = doc.financial_years;
        let fyArray: number[] = [];
        if (Array.isArray(fyValue)) {
          fyArray = fyValue.map(y => typeof y === 'number' ? y : parseInt(String(y), 10)).filter(y => !isNaN(y));
        } else if (typeof fyValue === 'string' && fyValue) {
          fyArray = fyValue.split(',').map(s => parseInt(s.trim(), 10)).filter(y => !isNaN(y));
        }

        if (fyArray.length === 0) {
          return <span className="text-muted-foreground text-xs">-</span>;
        }

        return (
          <div className="flex flex-wrap gap-0.5">
            {fyArray.map(year => (
              <Badge
                key={year}
                variant="outline"
                className="text-[10px] px-1 py-0 font-mono bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 cursor-pointer hover:bg-blue-100"
                title={`Filter by FY${year.toString().slice(-2)}`}
              >
                FY{year.toString().slice(-2)}
              </Badge>
            ))}
          </div>
        );
      default:
        return null;
    }
  };

  // Get SharePoint folder URL for this tab
  // const getSharePointUrl = () => {
  //   if (!company.sharepoint_folder_url) return null;
  //   if (category && category !== "all") {
  //     return `${company.sharepoint_folder_url}/${encodeURIComponent(category.toUpperCase())}`;
  //   }
  //   return company.sharepoint_folder_url;
  // };

  // Bulk AI verification state
  const [bulkAiProcessing, setBulkAiProcessing] = React.useState(false);
  const [bulkAiProgress, setBulkAiProgress] = React.useState<{ current: number; total: number } | null>(null);

  // Helper to poll document status until verification completes
  const waitForVerification = async (docId: number | string, maxWaitMs = 120000): Promise<CompanyDocument | null> => {
    const startTime = Date.now();
    const pollInterval = 2000; // 2 seconds

    while (Date.now() - startTime < maxWaitMs) {
      try {
        const response = await api.get<{ document: CompanyDocument }>(
          `/api/v1/company_documents/${docId}`
        );

        if (response?.document) {
          const status = response.document.ai_verification_status;
          // Done when not processing
          if (status !== "processing") {
            return response.document;
          }
        }
      } catch (err) {
        console.error(`Failed to poll document ${docId}:`, err);
      }

      // Wait before next poll
      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }

    console.warn(`Verification timeout for document ${docId}`);
    return null;
  };

  // Bulk AI verification handler - uses async mode to avoid Heroku timeouts
  const handleBulkAiVerify = async (ids: (number | string)[], clearSelection: () => void) => {
    setBulkAiProcessing(true);
    setBulkAiProgress({ current: 0, total: ids.length });

    try {
      // Process documents one by one using async mode
      for (let i = 0; i < ids.length; i++) {
        const docId = ids[i];
        setBulkAiProgress({ current: i + 1, total: ids.length });

        try {
          // Trigger async AI verification (no auto_apply_threshold = async mode)
          // The DocumentVerificationService already auto-applies at 90%+ confidence
          await api.post<{ success: boolean }>(`/api/v1/company_documents/${docId}/ai_verify`);

          // Update local state to show processing
          setDocuments(prev => prev.map(d =>
            d.id === docId ? { ...d, ai_verification_status: "processing" as const } : d
          ));

          // Wait for verification to complete
          const updatedDoc = await waitForVerification(docId);

          // Update local state with result
          if (updatedDoc) {
            setDocuments(prev => prev.map(d =>
              d.id === docId ? {
                ...d,
                ...updatedDoc,
                ai_confidence: updatedDoc.ai_confidence_score || null,
              } : d
            ));
          }
        } catch (err) {
          console.error(`Failed to AI verify document ${docId}:`, err);
        }
      }

      // Reload documents to get final state
      await loadDocuments();
      clearSelection();
    } catch (error) {
      console.error("Bulk AI verification failed:", error);
    } finally {
      setBulkAiProcessing(false);
      setBulkAiProgress(null);
    }
  };

  // Left actions for table toolbar (Add Record button)
  const leftActions = (
    <Button>
      <Plus className="h-4 w-4 mr-2" />
      Upload
    </Button>
  );

  if (loading && documents.length === 0) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (documents.length === 0 && !loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <FileText className="h-12 w-12 text-muted-foreground/50 mb-4" />
        <h3 className="text-lg font-medium mb-1">No documents</h3>
        <p className="text-muted-foreground text-sm max-w-md">
          {category && category !== "all"
            ? `No ${category.toUpperCase()} documents found for this company.`
            : "No documents found. Upload a document or sync from SharePoint."}
        </p>
        <div className="flex gap-2 mt-4">
          {leftActions}
        </div>
      </div>
    );
  }

  // Now a real foundation table (ID 357) with company scoping via filter
  return (
    <>
      <TeeemTableView
        foundationId={`company-documents-${category || "all"}`}
        foundationIdNumeric={357}
        tableName={`${category ? category.toUpperCase() : "All"} Documents (${documents.length})`}
        entries={documents}
        columns={columns}
        onDelete={handleDelete}
        onBulkDelete={handleBulkDelete}
        onRowClick={handleSingleClick}
        onRowDoubleClick={handleDoubleClick}
        enableImport={false}
        enableExport={true}
        enableSchemaEditor={false}
        showDataHealth={true}
        leftActions={leftActions}
        customCellRenderer={customCellRenderer}
        customBulkActions={(selectedIds, clearSelection) => (
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleBulkAiVerify(selectedIds, clearSelection)}
            disabled={bulkAiProcessing}
            className="bg-purple-50 hover:bg-purple-100 border-purple-200 text-purple-700"
          >
            {bulkAiProcessing ? (
              <>
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                {bulkAiProgress ? `${bulkAiProgress.current}/${bulkAiProgress.total}` : "Processing..."}
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-1" />
                Run AI ({selectedIds.length})
              </>
            )}
          </Button>
        )}
      />

      {/* Document Side Panel - Single click preview */}
      <DocumentSidePanel
        document={sidePanelDocument}
        open={isSidePanelOpen}
        onOpenChange={(open) => {
          setIsSidePanelOpen(open);
          if (!open) setSidePanelDocument(null);
        }}
        onExpandToFullscreen={handleExpandToFullscreen}
      />

      {/* Document Preview Modal with AI Verification - Double click for editing */}
      {selectedDocument && (
        <DocumentPreviewModal
          open={isPreviewOpen}
          onOpenChange={(open) => {
            setIsPreviewOpen(open);
            if (!open) setSelectedDocument(null);
          }}
          document={selectedDocument}
          onDocumentUpdate={loadDocuments}
          companies={companies}
        />
      )}
    </>
  );
}

function ActivityTab() {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-medium">Activity</h3>
      <p className="text-muted-foreground">Activity log coming soon</p>
    </div>
  );
}

// Data Warehouse Tab - Redirects to /admin/system?tab=data-warehouse&company_id={id}
// The Data tab redirects to the admin data warehouse with company filter


// Xero Connection Card for BANK tab
interface XeroConnectionStatus {
  connected: boolean;
  connection_status?: string;
  xero_tenant_name?: string;
  xero_tenant_id?: string;
  last_sync_at?: string;
  last_sync_error?: string;
  token_expires_at?: string;
  days_since_sync?: number;
}

// SSoT: ATO Setup Card - Shows Contact data as source of truth
function ATOSetupCard({ company }: { company: Company }) {
  const router = useRouter();

  if (!company.contact_id) {
    return (
      <Card className="mb-4 border-yellow-200 bg-yellow-50 dark:bg-yellow-900/10">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2 text-yellow-700 dark:text-yellow-400">
            <AlertTriangle className="h-5 w-5" />
            Contact Not Linked
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-3">
            This company is not linked to a Contact record. Link to a Contact for centralised data management.
          </p>
          <Button variant="outline" size="sm" onClick={() => router.push("/contacts")}>
            Link to Contact
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mb-4 border-blue-200 dark:border-blue-800">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-5 w-5 text-blue-600" />
            ATO Registration
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push(`/contacts/${company.contact_id}?edit=true`)}
            className="text-amber-600 hover:text-amber-700 hover:bg-amber-50"
          >
            <Pencil className="h-4 w-4 mr-1" />
            Edit
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Data sourced from linked Contact record
        </p>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-xs text-muted-foreground">ABN</p>
            <p className="font-medium">{company.formatted_abn || company.abn || "—"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">TFN</p>
            <p className="font-medium">{company.tfn ? "••• ••• •••" : "—"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">GST Status</p>
            <Badge
              variant="outline"
              className={company.gst_registration_status === "registered"
                ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
              }
            >
              {company.gst_registration_status === "registered" ? "Registered" : "Not Registered"}
            </Badge>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Source</p>
            <Button
              variant="link"
              size="sm"
              className="h-auto p-0 text-blue-600"
              onClick={() => router.push(`/contacts/${company.contact_id}`)}
            >
              View Contact →
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface TenantStats {
  tenant_id: string;
  tenant_name: string;
  status: string;
  contacts: { total_links: number; pending_review: number; last_synced_at: string | null };
  documents: { invoices: number; bills: number; quotes: number; total: number; last_synced_at: string | null };
  rate_limits: { daily_percentage: number } | null;
}

function XeroConnectionCard({ companyId, companyName, onSyncComplete, onConnectionChange }: { companyId: string; companyName?: string; onSyncComplete?: () => void; onConnectionChange?: (connected: boolean) => void }) {
  const { toast } = useToast();
  const [status, setStatus] = React.useState<XeroConnectionStatus | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [connecting, setConnecting] = React.useState(false);
  const [disconnecting, setDisconnecting] = React.useState(false);
  const [syncing, setSyncing] = React.useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = React.useState(false);
  const [pendingConnection, setPendingConnection] = React.useState<XeroConnectionStatus | null>(null);
  const [tenantStats, setTenantStats] = React.useState<TenantStats | null>(null);

  React.useEffect(() => {
    loadStatus();

  }, [companyId]);

  const loadStatus = async () => {
    try {
      setLoading(true);
      const response = await api.get<{ success: boolean } & XeroConnectionStatus>(
        `/api/v1/companies/${companyId}/xero/status`
      );
      setStatus(response);
    } catch (error) {
      console.error("Failed to load Xero status:", error);
      setStatus({ connected: false });
      onConnectionChange?.(false);
    } finally {
      setLoading(false);
    }
  };

  // Notify parent when status changes
  React.useEffect(() => {
    if (status !== null) {
      onConnectionChange?.(status.connected);
    }

  }, [status?.connected]);

  // Load tenant stats when connected
  React.useEffect(() => {
    const loadTenantStats = async () => {
      if (!status?.connected || !status?.xero_tenant_id) {
        setTenantStats(null);
        return;
      }
      try {
        const response = await api.get<{ success: boolean; data: { tenants: TenantStats[] } }>("/api/v1/xero/sync_stats");
        if (response.success && response.data?.tenants) {
          const tenant = response.data.tenants.find(t => t.tenant_id === status.xero_tenant_id);
          setTenantStats(tenant || null);
        }
      } catch (error) {
        console.error("Failed to load tenant stats:", error);
      }
    };
    loadTenantStats();
  }, [status?.connected, status?.xero_tenant_id]);

  const handleConnect = async () => {
    try {
      setConnecting(true);
      const response = await api.get<{ success: boolean; authorization_url: string }>(
        `/api/v1/companies/${companyId}/xero/authorize`
      );
      if (response?.success && response.authorization_url) {
        // Open Xero OAuth in new window
        window.open(response.authorization_url, "_blank", "width=600,height=700");
        // Start polling for connection status
        const pollInterval = setInterval(async () => {
          const statusCheck = await api.get<{ success: boolean } & XeroConnectionStatus>(
            `/api/v1/companies/${companyId}/xero/status`
          );
          if (statusCheck.connected) {
            clearInterval(pollInterval);
            // Show confirmation dialog instead of auto-accepting
            setPendingConnection(statusCheck);
            setShowConfirmDialog(true);
            setConnecting(false);
          }
        }, 3000);
        // Stop polling after 5 minutes
        setTimeout(() => {
          clearInterval(pollInterval);
          setConnecting(false);
        }, 300000);
      }
    } catch (error) {
      console.error("Failed to start Xero connection:", error);
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm("Are you sure you want to disconnect from Xero? This will remove the connection for this company.")) {
      return;
    }
    try {
      setDisconnecting(true);
      await api.post(`/api/v1/companies/${companyId}/xero/disconnect`);
      setStatus({ connected: false });
    } catch (error) {
      console.error("Failed to disconnect from Xero:", error);
    } finally {
      setDisconnecting(false);
    }
  };

  const handleSync = async () => {
    try {
      setSyncing(true);
      const response = await api.post<{
        success: boolean;
        message?: string;
        bank_accounts_synced?: number;
        transactions_synced?: number;
        error?: string;
      }>(`/api/v1/companies/${companyId}/xero/sync`);

      if (response && response.success) {
        const bankAccountsMsg = response.bank_accounts_synced
          ? `${response.bank_accounts_synced} bank account${response.bank_accounts_synced !== 1 ? 's' : ''}`
          : '0 bank accounts';
        const transactionsMsg = response.transactions_synced
          ? `${response.transactions_synced} transaction${response.transactions_synced !== 1 ? 's' : ''}`
          : '0 transactions';

        toast({
          title: "Sync completed successfully",
          description: `Synced ${bankAccountsMsg} and ${transactionsMsg}`,
        });
      }

      await loadStatus();
      onSyncComplete?.();
    } catch (error: any) {
      console.error("Failed to sync with Xero:", error);
      const errorMessage = error?.response?.data?.error || error?.message || "Failed to sync with Xero";
      toast({
        title: "Sync failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setSyncing(false);
    }
  };

  // User confirms the Xero connection is correct
  const handleConfirmConnection = () => {
    if (pendingConnection) {
      setStatus(pendingConnection);
      setPendingConnection(null);
    }
    setShowConfirmDialog(false);
  };

  // User says wrong connection - disconnect
  const handleRejectConnection = async () => {
    setShowConfirmDialog(false);
    setPendingConnection(null);
    try {
      setDisconnecting(true);
      await api.post(`/api/v1/companies/${companyId}/xero/disconnect`);
      setStatus({ connected: false });
    } catch (error) {
      console.error("Failed to disconnect from Xero:", error);
    } finally {
      setDisconnecting(false);
    }
  };

  if (loading) {
    return (
      <Card className="mb-4">
        <CardContent className="p-4">
          <div className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm text-muted-foreground">Loading Xero status...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mb-4">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className={cn(
              "w-10 h-10 rounded-lg flex items-center justify-center",
              status?.connected ? "bg-blue-100 dark:bg-blue-900/30" : "bg-muted"
            )}>
              <svg viewBox="0 0 24 24" className={cn("h-6 w-6", status?.connected ? "text-blue-600" : "text-muted-foreground")}>
                <path fill="currentColor" d="M12.076 2.018C5.956 2.018 1.001 6.974 1.001 13.093c0 6.12 4.955 11.075 11.075 11.075 6.119 0 11.075-4.955 11.075-11.075 0-6.12-4.956-11.075-11.075-11.075zm0 19.875c-4.863 0-8.8-3.937-8.8-8.8s3.937-8.8 8.8-8.8 8.8 3.937 8.8 8.8-3.937 8.8-8.8 8.8z"/>
                <path fill="currentColor" d="M15.951 10.343l-3.875 2.75-3.875-2.75c-.325-.231-.778-.156-1.009.169-.231.325-.156.778.169 1.009l4.5 3.193c.131.094.281.14.432.14s.3-.047.431-.14l4.5-3.193c.325-.231.4-.684.169-1.009-.231-.325-.684-.4-1.009-.169h-.433z"/>
              </svg>
            </div>
            <div>
              <h3 className="font-medium">
                Xero Integration
                {status?.connected && status.xero_tenant_name && (
                  <span className="ml-2 text-sm font-normal text-muted-foreground">
                    ({status.xero_tenant_name})
                  </span>
                )}
              </h3>
              <div className="flex items-center gap-3 text-sm">
                {status?.connected ? (
                  <>
                    <span className="flex items-center gap-1.5 text-green-600 dark:text-green-400">
                      <CheckCircle className="h-3.5 w-3.5" />
                      Connected
                    </span>
                    {status.last_sync_at && (
                      <span className="text-muted-foreground">
                        Last sync: {format(new Date(status.last_sync_at), "d MMM yyyy, h:mm a")}
                      </span>
                    )}
                    {status.days_since_sync !== undefined && status.days_since_sync !== null && status.days_since_sync > 7 && (
                      <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300">
                        <AlertTriangle className="h-3 w-3 mr-1" />
                        {status.days_since_sync} days since last sync
                      </Badge>
                    )}
                  </>
                ) : (
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <XCircle className="h-3.5 w-3.5" />
                    Not connected
                  </span>
                )}
                {status?.last_sync_error && (
                  <Badge variant="destructive" className="text-xs">
                    Error: {status.last_sync_error}
                  </Badge>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {status?.connected ? (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open("https://go.xero.com/", "_blank")}
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Open Xero
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSync}
                  disabled={syncing}
                >
                  {syncing ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4 mr-2" />
                  )}
                  Sync Now
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleDisconnect}
                  disabled={disconnecting}
                  className="text-destructive hover:text-destructive"
                >
                  {disconnecting ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Unlink className="h-4 w-4 mr-2" />
                  )}
                  Disconnect
                </Button>
              </>
            ) : (
              <Button
                onClick={handleConnect}
                disabled={connecting}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                {connecting ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Link2 className="h-4 w-4 mr-2" />
                )}
                Connect to Xero
              </Button>
            )}
          </div>
        </div>

        {/* Tenant Stats */}
        {status?.connected && tenantStats && (
          <div className="mt-4 pt-4 border-t">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="p-3 bg-muted/50 rounded-lg">
                <div className="text-2xl font-bold">{tenantStats.contacts.total_links}</div>
                <div className="text-xs text-muted-foreground">Contacts</div>
              </div>
              <div className="p-3 bg-muted/50 rounded-lg">
                <div className="text-2xl font-bold">{tenantStats.documents.total}</div>
                <div className="text-xs text-muted-foreground">Documents</div>
              </div>
              <div className="p-3 bg-muted/50 rounded-lg">
                <div className="text-2xl font-bold">{tenantStats.rate_limits?.daily_percentage || 0}%</div>
                <div className="text-xs text-muted-foreground">Daily API</div>
              </div>
            </div>
            <div className="flex justify-between text-xs text-muted-foreground mt-3 px-1">
              <span>{tenantStats.documents.invoices} invoices</span>
              <span>{tenantStats.documents.bills} bills</span>
              <span>{tenantStats.documents.quotes} quotes</span>
            </div>
            {tenantStats.contacts.pending_review > 0 && (
              <div className="flex items-center gap-2 text-xs text-amber-600 bg-amber-50 dark:bg-amber-900/20 p-2 rounded mt-3">
                <AlertTriangle className="h-3 w-3" />
                {tenantStats.contacts.pending_review} pending review
              </div>
            )}
          </div>
        )}
      </CardContent>

      {/* Confirmation Dialog */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              Confirm Xero Connection
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-4">
                <p>Please verify this connection is correct:</p>
                <div className="rounded-lg border p-4 space-y-2 bg-muted/50">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">TEEEM Company:</span>
                    <span className="font-medium text-foreground">{companyName || "Unknown"}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Connected to Xero:</span>
                    <span className="font-medium text-blue-600">{pendingConnection?.xero_tenant_name || "Unknown"}</span>
                  </div>
                </div>
                <p className="text-sm text-yellow-600 dark:text-yellow-400">
                  Make sure the Xero organisation matches this company. Connecting to the wrong Xero file will sync incorrect data.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={handleRejectConnection}
              className="bg-red-50 text-red-700 hover:bg-red-100 border-red-200"
            >
              Wrong Company - Disconnect
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmConnection}
              className="bg-green-600 hover:bg-green-700"
            >
              Yes, This is Correct
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

// Bank Transactions Card for BANK tab
interface BankTransaction {
  id: number;
  transaction_date: string;
  transaction_type: string;
  amount: number;
  signed_amount: number;
  description: string;
  contact_name: string;
  reference: string;
  status: string;
  is_reconciled: boolean;
  bank_account_name: string;
}

interface TransactionSummary {
  total_transactions: number;
  total_credits: number;
  total_debits: number;
  net_change: number;
  reconciled_count: number;
  unreconciled_count: number;
  date_range: { from: string; to: string };
}

function BankTransactionsCard({ companyId, isConnected }: { companyId: string; isConnected: boolean }) {
  const [transactions, setTransactions] = React.useState<BankTransaction[]>([]);
  const [summary, setSummary] = React.useState<TransactionSummary | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [syncing, setSyncing] = React.useState(false);
  const [dateRange, setDateRange] = React.useState<{ from: string; to: string }>({
    from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    to: new Date().toISOString().split('T')[0]
  });

  React.useEffect(() => {
    if (isConnected) {
      loadTransactions();
    }
     
  }, [companyId, isConnected, dateRange]);

  const loadTransactions = async () => {
    try {
      setLoading(true);
      const response = await api.get<{
        success: boolean;
        transactions: BankTransaction[];
        summary: TransactionSummary;
      }>(`/api/v1/companies/${companyId}/xero/transactions?from_date=${dateRange.from}&to_date=${dateRange.to}`);

      if (response?.success) {
        setTransactions(response.transactions);
        setSummary(response.summary);
      }
    } catch (error) {
      console.error("Failed to load transactions:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSyncTransactions = async () => {
    try {
      setSyncing(true);
      await api.post(`/api/v1/companies/${companyId}/xero/sync_transactions`, {
        from_date: dateRange.from,
        to_date: dateRange.to
      });
      await loadTransactions();
    } catch (error) {
      console.error("Failed to sync transactions:", error);
    } finally {
      setSyncing(false);
    }
  };

  if (!isConnected) {
    return null;
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(amount);
  };

  return (
    <Card className="mb-4">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-medium">Bank Transactions</CardTitle>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 text-sm">
              <input
                type="date"
                value={dateRange.from}
                onChange={(e) => setDateRange(prev => ({ ...prev, from: e.target.value }))}
                className="px-2 py-1 border rounded text-sm"
              />
              <span className="text-muted-foreground">to</span>
              <input
                type="date"
                value={dateRange.to}
                onChange={(e) => setDateRange(prev => ({ ...prev, to: e.target.value }))}
                className="px-2 py-1 border rounded text-sm"
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleSyncTransactions}
              disabled={syncing}
            >
              {syncing ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Sync from Xero
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Summary Cards */}
        {summary && (
          <div className="grid grid-cols-4 gap-4 mb-4">
            <div className="p-3 bg-muted/50 rounded-lg">
              <div className="text-xs text-muted-foreground">Total In</div>
              <div className="text-lg font-semibold text-green-600">{formatCurrency(summary.total_credits)}</div>
            </div>
            <div className="p-3 bg-muted/50 rounded-lg">
              <div className="text-xs text-muted-foreground">Total Out</div>
              <div className="text-lg font-semibold text-red-600">{formatCurrency(summary.total_debits)}</div>
            </div>
            <div className="p-3 bg-muted/50 rounded-lg">
              <div className="text-xs text-muted-foreground">Net Change</div>
              <div className={cn("text-lg font-semibold", summary.net_change >= 0 ? "text-green-600" : "text-red-600")}>
                {formatCurrency(summary.net_change)}
              </div>
            </div>
            <div className="p-3 bg-muted/50 rounded-lg">
              <div className="text-xs text-muted-foreground">Transactions</div>
              <div className="text-lg font-semibold">{summary.total_transactions}</div>
            </div>
          </div>
        )}

        {/* Transactions Table */}
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : transactions.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p>No transactions found for this period.</p>
            <p className="text-sm mt-1">Click &quot;Sync from Xero&quot; to import transactions.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-2 font-medium">Date</th>
                  <th className="text-left py-2 px-2 font-medium">Description</th>
                  <th className="text-left py-2 px-2 font-medium">Contact</th>
                  <th className="text-left py-2 px-2 font-medium">Account</th>
                  <th className="text-right py-2 px-2 font-medium">Amount</th>
                  <th className="text-center py-2 px-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {transactions.slice(0, 20).map((tx) => (
                  <tr key={tx.id} className="border-b hover:bg-muted/50">
                    <td className="py-2 px-2 whitespace-nowrap">
                      {safeFormatDate(tx.transaction_date, "d MMM yyyy")}
                    </td>
                    <td className="py-2 px-2 max-w-[200px] truncate" title={tx.description}>
                      {tx.description || tx.reference || "-"}
                    </td>
                    <td className="py-2 px-2 max-w-[150px] truncate" title={tx.contact_name}>
                      {tx.contact_name || "-"}
                    </td>
                    <td className="py-2 px-2 max-w-[150px] truncate" title={tx.bank_account_name}>
                      {tx.bank_account_name || "-"}
                    </td>
                    <td className={cn(
                      "py-2 px-2 text-right font-mono whitespace-nowrap",
                      tx.transaction_type === "RECEIVE" ? "text-green-600" : "text-red-600"
                    )}>
                      {tx.transaction_type === "RECEIVE" ? "+" : "-"}{formatCurrency(tx.amount)}
                    </td>
                    <td className="py-2 px-2 text-center">
                      {tx.is_reconciled ? (
                        <Badge variant="secondary" className="bg-green-100 text-green-800 text-xs">
                          Reconciled
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-xs">
                          Pending
                        </Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {transactions.length > 20 && (
              <div className="text-center py-2 text-sm text-muted-foreground">
                Showing 20 of {transactions.length} transactions
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Xero Accounts Card - Shows Chart of Accounts from Xero with comparison
interface XeroAccount {
  account_id: string;
  code: string;
  name: string;
  type: string;
  class: string;
  status: string;
  tax_type: string;
  description: string;
}

interface CompanyComparison {
  company_id: number;
  company_name: string;
  name: string;
  status: string;
}

interface AccountComparison {
  code: string;
  name: string;
  type: string;
  company_count: number;
  all_companies: boolean;
  names_match: boolean;
  companies: CompanyComparison[];
}

function XeroAccountsCard({ companyId, companyName }: { companyId: string; companyName?: string }) {
  const [accounts, setAccounts] = React.useState<XeroAccount[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [showComparison, setShowComparison] = React.useState(false);
  const [comparison, setComparison] = React.useState<AccountComparison[]>([]);
  const [comparisonLoading, setComparisonLoading] = React.useState(false);
  const [comparisonSummary, setComparisonSummary] = React.useState<{
    total_unique_accounts: number;
    accounts_in_all: number;
    accounts_with_differences: number;
    missing_in_some: number;
  } | null>(null);
  const [filterType, setFilterType] = React.useState<string>("all");
  const [searchTerm, setSearchTerm] = React.useState("");

  const loadAccounts = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get<{
        success: boolean;
        accounts: XeroAccount[];
        summary: { total: number; by_type: Record<string, number> };
        error?: string;
      }>(`/api/v1/companies/${companyId}/xero/accounts`);

      if (response?.success) {
        setAccounts(response.accounts);
      } else {
        setError(response?.error || "Failed to load accounts");
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const loadComparison = async () => {
    try {
      setComparisonLoading(true);
      const response = await api.get<{
        success: boolean;
        comparison: AccountComparison[];
        summary: {
          total_unique_accounts: number;
          accounts_in_all: number;
          accounts_with_differences: number;
          missing_in_some: number;
        };
        error?: string;
      }>(`/api/v1/companies/${companyId}/xero/accounts/compare`);

      if (response?.success) {
        setComparison(response.comparison);
        setComparisonSummary(response.summary);
        setShowComparison(true);
      } else {
        setError(response?.error || "Failed to load comparison");
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setComparisonLoading(false);
    }
  };

  React.useEffect(() => {
    loadAccounts();
     
  }, [companyId]);

  // Get unique types for filter
  const accountTypes = React.useMemo(() => {
    const types = new Set(accounts.map(a => a.type));
    return Array.from(types).sort();
  }, [accounts]);

  // Filter accounts
  const filteredAccounts = React.useMemo(() => {
    return accounts.filter(acc => {
      const matchesType = filterType === "all" || acc.type === filterType;
      const matchesSearch = !searchTerm ||
        acc.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        acc.name.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesType && matchesSearch;
    });
  }, [accounts, filterType, searchTerm]);

  // Filter comparison
  const filteredComparison = React.useMemo(() => {
    return comparison.filter(acc => {
      const matchesType = filterType === "all" || acc.type === filterType;
      const matchesSearch = !searchTerm ||
        acc.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        acc.name.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesType && matchesSearch;
    });
  }, [comparison, filterType, searchTerm]);

  if (loading && accounts.length === 0) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Loading Xero accounts...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error && accounts.length === 0) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-muted-foreground">
            <XCircle className="h-8 w-8 mx-auto mb-2 text-red-500" />
            <p>{error}</p>
            <Button variant="outline" size="sm" className="mt-4" onClick={loadAccounts}>
              Try Again
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg font-medium">Xero Chart of Accounts</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              {accounts.length} accounts from {companyName || "this company"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={loadAccounts}
              disabled={loading}
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              <span className="ml-2">Refresh</span>
            </Button>
            <Button
              variant={showComparison ? "secondary" : "default"}
              size="sm"
              onClick={() => showComparison ? setShowComparison(false) : loadComparison()}
              disabled={comparisonLoading}
            >
              {comparisonLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <GitMerge className="h-4 w-4" />
              )}
              <span className="ml-2">{showComparison ? "Hide Comparison" : "Compare Group"}</span>
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-2 mt-4">
          <Input
            placeholder="Search by code or name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="max-w-xs"
          />
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {accountTypes.map(type => (
                <SelectItem key={type} value={type}>{type}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>

      <CardContent>
        {/* Comparison Summary */}
        {showComparison && comparisonSummary && (
          <div className="mb-4 p-4 rounded-lg bg-muted/50 border">
            <h4 className="font-medium mb-2">Comparison Summary</h4>
            <div className="grid grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Unique Accounts:</span>
                <span className="ml-2 font-medium">{comparisonSummary.total_unique_accounts}</span>
              </div>
              <div>
                <span className="text-muted-foreground">In All Companies:</span>
                <span className="ml-2 font-medium text-green-600">{comparisonSummary.accounts_in_all}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Missing in Some:</span>
                <span className="ml-2 font-medium text-yellow-600">{comparisonSummary.missing_in_some}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Name Differences:</span>
                <span className="ml-2 font-medium text-red-600">{comparisonSummary.accounts_with_differences}</span>
              </div>
            </div>
          </div>
        )}

        {/* Comparison View */}
        {showComparison ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-3 font-medium">Code</th>
                  <th className="text-left py-2 px-3 font-medium">Name</th>
                  <th className="text-left py-2 px-3 font-medium">Type</th>
                  <th className="text-center py-2 px-3 font-medium">Status</th>
                  <th className="text-left py-2 px-3 font-medium">Companies</th>
                </tr>
              </thead>
              <tbody>
                {filteredComparison.map((acc) => (
                  <tr
                    key={acc.code}
                    className={cn(
                      "border-b hover:bg-muted/50",
                      !acc.all_companies && "bg-yellow-50 dark:bg-yellow-900/10",
                      !acc.names_match && "bg-red-50 dark:bg-red-900/10"
                    )}
                  >
                    <td className="py-2 px-3 font-mono">{acc.code}</td>
                    <td className="py-2 px-3">
                      {acc.names_match ? (
                        acc.name
                      ) : (
                        <div className="space-y-1">
                          {acc.companies.map((c, i) => (
                            <div key={i} className="text-xs">
                              <span className="text-muted-foreground">{c.company_name}:</span>{" "}
                              <span className="font-medium">{c.name}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="py-2 px-3">{acc.type}</td>
                    <td className="py-2 px-3 text-center">
                      {acc.all_companies ? (
                        <Badge variant="outline" className="bg-green-50 text-green-700">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          All
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-yellow-50 text-yellow-700">
                          {acc.company_count} of {comparison.length > 0 ? Math.max(...comparison.map(c => c.companies.length)) : 0}
                        </Badge>
                      )}
                    </td>
                    <td className="py-2 px-3">
                      <div className="flex flex-wrap gap-1">
                        {acc.companies.map((c, i) => (
                          <Badge key={i} variant="secondary" className="text-xs">
                            {c.company_name}
                          </Badge>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          /* Standard Account List */
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-3 font-medium">Code</th>
                  <th className="text-left py-2 px-3 font-medium">Name</th>
                  <th className="text-left py-2 px-3 font-medium">Type</th>
                  <th className="text-left py-2 px-3 font-medium">Tax Type</th>
                  <th className="text-center py-2 px-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredAccounts.map((acc) => (
                  <tr key={acc.account_id} className="border-b hover:bg-muted/50">
                    <td className="py-2 px-3 font-mono">{acc.code}</td>
                    <td className="py-2 px-3">{acc.name}</td>
                    <td className="py-2 px-3">
                      <Badge variant="outline">{acc.type}</Badge>
                    </td>
                    <td className="py-2 px-3 text-muted-foreground">{acc.tax_type || "—"}</td>
                    <td className="py-2 px-3 text-center">
                      {acc.status === "ACTIVE" ? (
                        <Badge variant="outline" className="bg-green-50 text-green-700">Active</Badge>
                      ) : (
                        <Badge variant="outline" className="bg-gray-50 text-gray-500">Archived</Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredAccounts.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                No accounts found matching your filters
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Xero Profit & Loss Report Card
function XeroProfitLossCard({ companyId }: { companyId: string }) {
  const [report, setReport] = React.useState<{
    rows: Array<{
      row_type: string;
      title?: string;
      cells?: Array<{ value: string }>;
    }>;
  } | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [dateRange, setDateRange] = React.useState({
    from: new Date(new Date().getFullYear(), 0, 1).toISOString().split("T")[0], // Jan 1 of current year
    to: new Date().toISOString().split("T")[0], // Today
  });

  const loadReport = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get<{
        success: boolean;
        report: typeof report;
        error?: string;
      }>(`/api/v1/companies/${companyId}/xero/profit_loss`, {
        params: { from_date: dateRange.from, to_date: dateRange.to }
      });

      if (response?.success && response.report) {
        setReport(response.report);
      } else {
        setError(response?.error || "Failed to load report");
      }
    } catch (err: unknown) {
      // Extract error message from API response
      const axiosError = err as { response?: { data?: { error?: string } } };
      const errorMessage = axiosError?.response?.data?.error || "Failed to load Profit & Loss report from Xero";
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Profit & Loss Report</CardTitle>
          <div className="flex items-center gap-2">
            <Input
              type="date"
              value={dateRange.from}
              onChange={(e) => setDateRange({ ...dateRange, from: e.target.value })}
              className="w-36"
            />
            <span className="text-muted-foreground">to</span>
            <Input
              type="date"
              value={dateRange.to}
              onChange={(e) => setDateRange({ ...dateRange, to: e.target.value })}
              className="w-36"
            />
            <Button onClick={loadReport} disabled={loading} size="sm">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              <span className="ml-2">Load</span>
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {error && (
          <div className="bg-destructive/10 text-destructive px-4 py-3 rounded-lg text-sm mb-4">
            {error}
          </div>
        )}

        {!report && !loading && !error && (
          <div className="text-center py-12 text-muted-foreground">
            <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Select a date range and click Load to view the Profit & Loss report</p>
          </div>
        )}

        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        )}

        {report && report.rows && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <tbody>
                {report.rows.map((row, idx) => {
                  if (row.row_type === "Header") {
                    return (
                      <tr key={idx} className="bg-muted/50 font-semibold">
                        {row.cells?.map((cell, cellIdx) => (
                          <td key={cellIdx} className="py-2 px-3">{cell.value}</td>
                        ))}
                      </tr>
                    );
                  }
                  if (row.row_type === "Section" && row.title) {
                    return (
                      <tr key={idx} className="bg-muted/30 font-medium">
                        <td colSpan={10} className="py-2 px-3">{row.title}</td>
                      </tr>
                    );
                  }
                  if (row.row_type === "Row" && row.cells) {
                    return (
                      <tr key={idx} className="border-b hover:bg-muted/20">
                        {row.cells.map((cell, cellIdx) => (
                          <td key={cellIdx} className={cn("py-1.5 px-3", cellIdx > 0 && "text-right font-mono")}>
                            {cell.value}
                          </td>
                        ))}
                      </tr>
                    );
                  }
                  if (row.row_type === "SummaryRow" && row.cells) {
                    return (
                      <tr key={idx} className="border-t-2 font-semibold bg-muted/20">
                        {row.cells.map((cell, cellIdx) => (
                          <td key={cellIdx} className={cn("py-2 px-3", cellIdx > 0 && "text-right font-mono")}>
                            {cell.value}
                          </td>
                        ))}
                      </tr>
                    );
                  }
                  return null;
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Xero Balance Sheet Report Card
function XeroBalanceSheetCard({ companyId }: { companyId: string }) {
  const [report, setReport] = React.useState<{
    rows: Array<{
      row_type: string;
      title?: string;
      cells?: Array<{ value: string }>;
    }>;
  } | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [asOfDate, setAsOfDate] = React.useState(new Date().toISOString().split("T")[0]);

  const loadReport = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get<{
        success: boolean;
        report: typeof report;
        error?: string;
      }>(`/api/v1/companies/${companyId}/xero/balance_sheet`, {
        params: { date: asOfDate }
      });

      if (response?.success && response.report) {
        setReport(response.report);
      } else {
        setError(response?.error || "Failed to load report");
      }
    } catch (err: unknown) {
      // Extract error message from API response
      const axiosError = err as { response?: { data?: { error?: string } } };
      const errorMessage = axiosError?.response?.data?.error || "Failed to load Balance Sheet from Xero";
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Balance Sheet</CardTitle>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">As of:</span>
            <Input
              type="date"
              value={asOfDate}
              onChange={(e) => setAsOfDate(e.target.value)}
              className="w-36"
            />
            <Button onClick={loadReport} disabled={loading} size="sm">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              <span className="ml-2">Load</span>
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {error && (
          <div className="bg-destructive/10 text-destructive px-4 py-3 rounded-lg text-sm mb-4">
            {error}
          </div>
        )}

        {!report && !loading && !error && (
          <div className="text-center py-12 text-muted-foreground">
            <Database className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Select a date and click Load to view the Balance Sheet</p>
          </div>
        )}

        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        )}

        {report && report.rows && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <tbody>
                {report.rows.map((row, idx) => {
                  if (row.row_type === "Header") {
                    return (
                      <tr key={idx} className="bg-muted/50 font-semibold">
                        {row.cells?.map((cell, cellIdx) => (
                          <td key={cellIdx} className="py-2 px-3">{cell.value}</td>
                        ))}
                      </tr>
                    );
                  }
                  if (row.row_type === "Section" && row.title) {
                    return (
                      <tr key={idx} className="bg-muted/30 font-medium">
                        <td colSpan={10} className="py-2 px-3">{row.title}</td>
                      </tr>
                    );
                  }
                  if (row.row_type === "Row" && row.cells) {
                    return (
                      <tr key={idx} className="border-b hover:bg-muted/20">
                        {row.cells.map((cell, cellIdx) => (
                          <td key={cellIdx} className={cn("py-1.5 px-3", cellIdx > 0 && "text-right font-mono")}>
                            {cell.value}
                          </td>
                        ))}
                      </tr>
                    );
                  }
                  if (row.row_type === "SummaryRow" && row.cells) {
                    return (
                      <tr key={idx} className="border-t-2 font-semibold bg-muted/20">
                        {row.cells.map((cell, cellIdx) => (
                          <td key={cellIdx} className={cn("py-2 px-3", cellIdx > 0 && "text-right font-mono")}>
                            {cell.value}
                          </td>
                        ))}
                      </tr>
                    );
                  }
                  return null;
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Xero Bank Accounts Card - Shows bank accounts as tabs with transactions
interface XeroBankAccount {
  account_id: string;
  name: string;
  code: string;
  type: string;
  bank_account_number?: string;
  currency_code?: string;
}

interface XeroBankTransaction {
  transaction_id: string;
  date: string;
  description: string;
  reference?: string;
  amount: number;
  balance?: number;
  type: string;
  contact_name?: string;
  line_items?: Array<{
    description: string;
    amount: number;
    account_code: string;
  }>;
}

function XeroBankAccountsCard({ companyId }: { companyId: string }) {
  const [bankAccounts, setBankAccounts] = React.useState<XeroBankAccount[]>([]);
  const [selectedAccount, setSelectedAccount] = React.useState<string | null>(null);
  const [transactions, setTransactions] = React.useState<XeroBankTransaction[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [transactionsLoading, setTransactionsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [dateRange, setDateRange] = React.useState({
    from: new Date(new Date().setMonth(new Date().getMonth() - 3)).toISOString().split("T")[0],
    to: new Date().toISOString().split("T")[0],
  });

  // Load bank accounts on mount
  React.useEffect(() => {
    loadBankAccounts();
  }, [companyId]);

  // Load transactions when account is selected
  React.useEffect(() => {
    if (selectedAccount) {
      loadTransactions(selectedAccount);
    }
  }, [selectedAccount, dateRange]);

  const loadBankAccounts = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get<{
        success: boolean;
        xero_accounts?: Array<{
          xero_account_id: string;
          xero_account_name: string;
          xero_account_number?: string;
          xero_bank_account_type?: string;
          local_bank_account_id?: number;
          local_bank_account_name?: string;
          matched: boolean;
          linked: boolean;
        }>;
        error?: string;
      }>(`/api/v1/companies/${companyId}/xero/bank_accounts`);

      if (response?.success && response.xero_accounts) {
        // Map backend response to our interface
        const mapped = response.xero_accounts.map(acc => ({
          account_id: acc.xero_account_id,
          name: acc.xero_account_name,
          code: acc.xero_bank_account_type || "",
          type: acc.xero_bank_account_type || "BANK",
          bank_account_number: acc.xero_account_number,
          currency_code: "AUD",
        }));
        setBankAccounts(mapped);
        // Auto-select first account
        if (mapped.length > 0 && !selectedAccount) {
          setSelectedAccount(mapped[0].account_id);
        }
      } else {
        setError(response?.error || "Failed to load bank accounts");
      }
    } catch (err: unknown) {
      // Extract error message from API response
      const axiosError = err as { response?: { data?: { error?: string } } };
      const errorMessage = axiosError?.response?.data?.error || "Failed to load bank accounts from Xero";
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const loadTransactions = async (accountId: string) => {
    try {
      setTransactionsLoading(true);
      const response = await api.get<{
        success: boolean;
        transactions?: XeroBankTransaction[];
        error?: string;
      }>(`/api/v1/companies/${companyId}/xero/bank_transactions`, {
        params: {
          bank_account_id: accountId,
          from_date: dateRange.from,
          to_date: dateRange.to,
        }
      });

      if (response?.success && response.transactions) {
        setTransactions(response.transactions);
      } else {
        setTransactions([]);
      }
    } catch (err) {
      setTransactions([]);
    } finally {
      setTransactionsLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-AU", {
      style: "currency",
      currency: "AUD",
    }).format(amount);
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    const isNotConnected = error.toLowerCase().includes("not connected");
    return (
      <Card>
        <CardContent className="py-8">
          <div className="text-center text-muted-foreground">
            <AlertTriangle className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="font-medium">{error}</p>
            {isNotConnected && (
              <p className="text-sm mt-2">Go to the Connection tab to connect this company to Xero.</p>
            )}
            <Button variant="outline" size="sm" className="mt-4" onClick={loadBankAccounts}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (bankAccounts.length === 0) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="text-center text-muted-foreground">
            <Landmark className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="font-medium">No Bank Accounts Found in Xero</p>
            <p className="text-sm mt-2">Connect a bank account in Xero to see transactions here.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const selectedAccountDetails = bankAccounts.find(a => a.account_id === selectedAccount);

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Bank Account Transactions</CardTitle>
          <div className="flex items-center gap-2">
            <Input
              type="date"
              value={dateRange.from}
              onChange={(e) => setDateRange({ ...dateRange, from: e.target.value })}
              className="w-36"
            />
            <span className="text-muted-foreground">to</span>
            <Input
              type="date"
              value={dateRange.to}
              onChange={(e) => setDateRange({ ...dateRange, to: e.target.value })}
              className="w-36"
            />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Bank Account Tabs */}
        <div className="flex gap-1 mb-4 border-b overflow-x-auto">
          {bankAccounts.map((account) => (
            <button
              key={account.account_id}
              onClick={() => setSelectedAccount(account.account_id)}
              className={cn(
                "px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap",
                selectedAccount === account.account_id
                  ? "border-primary text-primary bg-primary/5"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50"
              )}
            >
              {account.name}
              {account.bank_account_number && (
                <span className="ml-2 text-xs text-muted-foreground">
                  (...{account.bank_account_number.slice(-4)})
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Selected Account Info */}
        {selectedAccountDetails && (
          <div className="flex items-center gap-4 mb-4 p-3 bg-muted/30 rounded-lg">
            <div>
              <p className="font-medium">{selectedAccountDetails.name}</p>
              <p className="text-sm text-muted-foreground">
                {selectedAccountDetails.bank_account_number || "No account number"}
                {selectedAccountDetails.code && ` • Code: ${selectedAccountDetails.code}`}
              </p>
            </div>
          </div>
        )}

        {/* Transactions Table */}
        {transactionsLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : transactions.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <p>No transactions found for this date range</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="py-2 px-3 text-left font-medium">Date</th>
                  <th className="py-2 px-3 text-left font-medium">Description</th>
                  <th className="py-2 px-3 text-left font-medium">Reference</th>
                  <th className="py-2 px-3 text-left font-medium">Contact</th>
                  <th className="py-2 px-3 text-right font-medium">Spent</th>
                  <th className="py-2 px-3 text-right font-medium">Received</th>
                  <th className="py-2 px-3 text-right font-medium">Balance</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx) => {
                  const isSpend = tx.amount < 0;
                  return (
                    <tr key={tx.transaction_id} className="border-b hover:bg-muted/30">
                      <td className="py-2 px-3 whitespace-nowrap">
                        {safeFormatDate(tx.date, "dd MMM yyyy")}
                      </td>
                      <td className="py-2 px-3">
                        <div className="max-w-xs truncate" title={tx.description}>
                          {tx.description}
                        </div>
                      </td>
                      <td className="py-2 px-3 text-muted-foreground">
                        {tx.reference || "—"}
                      </td>
                      <td className="py-2 px-3 text-muted-foreground">
                        {tx.contact_name || "—"}
                      </td>
                      <td className="py-2 px-3 text-right font-mono text-red-600">
                        {isSpend ? formatCurrency(Math.abs(tx.amount)) : ""}
                      </td>
                      <td className="py-2 px-3 text-right font-mono text-green-600">
                        {!isSpend ? formatCurrency(tx.amount) : ""}
                      </td>
                      <td className="py-2 px-3 text-right font-mono">
                        {tx.balance !== undefined ? formatCurrency(tx.balance) : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// PDF Reports Card for P&L and Balance Sheet
interface PdfReport {
  id: number;
  company_name: string;
  company_code: string;
  financial_year: string;
  status: string;
  cloudinary_url?: string;
  file_name?: string;
  generated_at?: string;
  total_revenue?: number;
  total_expenses?: number;
  net_profit?: number;
  total_assets?: number;
  total_liabilities?: number;
  net_assets?: number;
}

function XeroPdfReportsCard({
  companyId,
  reportType,
  title,
  foundationId
}: {
  companyId: string;
  reportType: "profit_loss" | "balance_sheet";
  title: string;
  foundationId: number;
}) {
  const [reports, setReports] = React.useState<PdfReport[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [generating, setGenerating] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [selectedYear, setSelectedYear] = React.useState("FY2025");

  // Financial years list
  const financialYears = ["FY2025", "FY2024", "FY2023", "FY2022"];

  // Format currency for display
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-AU", {
      style: "currency",
      currency: "AUD",
      minimumFractionDigits: 2,
    }).format(amount);
  };

  React.useEffect(() => {
    loadReports();
  }, [companyId, reportType]);

  const loadReports = async () => {
    try {
      setLoading(true);
      setError(null);
      const endpoint = reportType === "profit_loss"
        ? `/api/v1/companies/${companyId}/profit_loss_reports`
        : `/api/v1/companies/${companyId}/balance_sheet_reports`;

      const response = await api.get<{
        success: boolean;
        data?: PdfReport[];
        error?: string;
      }>(endpoint);

      if (response?.success && response.data) {
        setReports(response.data);
      } else {
        setReports([]);
      }
    } catch (err) {
      setError("Failed to load reports");
      setReports([]);
    } finally {
      setLoading(false);
    }
  };

  const generateReport = async () => {
    try {
      setGenerating(true);
      setError(null);
      const endpoint = reportType === "profit_loss"
        ? `/api/v1/companies/${companyId}/profit_loss_reports/generate`
        : `/api/v1/companies/${companyId}/balance_sheet_reports/generate`;

      const response = await api.post<{
        success: boolean;
        data?: PdfReport;
        error?: string;
      }>(endpoint, { financial_year: selectedYear });

      if (response?.success) {
        loadReports(); // Refresh the list
      } else {
        setError(response?.error || "Failed to generate report");
      }
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { error?: string } } };
      setError(axiosError?.response?.data?.error || "Failed to generate report");
    } finally {
      setGenerating(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <Badge className="bg-green-100 text-green-800">Completed</Badge>;
      case "generating":
        return <Badge className="bg-yellow-100 text-yellow-800">Generating...</Badge>;
      case "failed":
        return <Badge className="bg-red-100 text-red-800">Failed</Badge>;
      default:
        return <Badge className="bg-gray-100 text-gray-800">Pending</Badge>;
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            {title}
          </CardTitle>
          <CardDescription>
            PDF reports stored in SharePoint - Foundation ID: {foundationId}
          </CardDescription>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(e.target.value)}
            className="px-3 py-2 border rounded-md text-sm"
          >
            {financialYears.map(fy => (
              <option key={fy} value={fy}>{fy}</option>
            ))}
          </select>
          <Button
            onClick={generateReport}
            disabled={generating}
            size="sm"
          >
            {generating ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Plus className="h-4 w-4 mr-2" />
                Generate Report
              </>
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : reports.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No reports generated yet</p>
            <p className="text-sm mt-2">Click "Generate Report" to create a PDF from Xero</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left py-2 px-3 font-medium">Financial Year</th>
                  <th className="text-left py-2 px-3 font-medium">Status</th>
                  {reportType === "profit_loss" && (
                    <>
                      <th className="text-right py-2 px-3 font-medium">Revenue</th>
                      <th className="text-right py-2 px-3 font-medium">Expenses</th>
                      <th className="text-right py-2 px-3 font-medium">Net Profit</th>
                    </>
                  )}
                  {reportType === "balance_sheet" && (
                    <>
                      <th className="text-right py-2 px-3 font-medium">Assets</th>
                      <th className="text-right py-2 px-3 font-medium">Liabilities</th>
                      <th className="text-right py-2 px-3 font-medium">Net Assets</th>
                    </>
                  )}
                  <th className="text-left py-2 px-3 font-medium">Generated</th>
                  <th className="text-center py-2 px-3 font-medium">PDF</th>
                </tr>
              </thead>
              <tbody>
                {reports.map((report) => (
                  <tr key={report.id} className="border-b hover:bg-muted/30">
                    <td className="py-2 px-3 font-medium">{report.financial_year}</td>
                    <td className="py-2 px-3">{getStatusBadge(report.status)}</td>
                    {reportType === "profit_loss" && (
                      <>
                        <td className="py-2 px-3 text-right font-mono text-green-600">
                          {report.total_revenue ? formatCurrency(report.total_revenue) : "—"}
                        </td>
                        <td className="py-2 px-3 text-right font-mono text-red-600">
                          {report.total_expenses ? formatCurrency(report.total_expenses) : "—"}
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-semibold">
                          {report.net_profit !== undefined ? (
                            <span className={report.net_profit >= 0 ? "text-green-600" : "text-red-600"}>
                              {formatCurrency(report.net_profit)}
                            </span>
                          ) : "—"}
                        </td>
                      </>
                    )}
                    {reportType === "balance_sheet" && (
                      <>
                        <td className="py-2 px-3 text-right font-mono text-green-600">
                          {report.total_assets ? formatCurrency(report.total_assets) : "—"}
                        </td>
                        <td className="py-2 px-3 text-right font-mono text-red-600">
                          {report.total_liabilities ? formatCurrency(report.total_liabilities) : "—"}
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-semibold text-blue-600">
                          {report.net_assets !== undefined ? formatCurrency(report.net_assets) : "—"}
                        </td>
                      </>
                    )}
                    <td className="py-2 px-3 text-muted-foreground">
                      {report.generated_at ? safeFormatDate(report.generated_at, "dd MMM yyyy HH:mm") : "—"}
                    </td>
                    <td className="py-2 px-3 text-center">
                      {report.cloudinary_url ? (
                        <a
                          href={report.cloudinary_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-primary hover:underline"
                        >
                          <Download className="h-4 w-4" />
                          <span className="text-xs">{report.file_name || "Download"}</span>
                        </a>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function CompanyDetailPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const companyId = params.id as string;

  const [loading, setLoading] = React.useState(true);
  const [company, setCompany] = React.useState<Company | null>(null);
  const [activeTab, setActiveTab] = React.useState("overview");
  const [overviewSubTab, setOverviewSubTab] = React.useState("info");
  const [bankSubTab, setBankSubTab] = React.useState("transactions");
  const [xeroSubTab, setXeroSubTab] = React.useState("connection");
  const [xeroConnected, setXeroConnected] = React.useState(false);
  const [documentCounts, setDocumentCounts] = React.useState<Record<string, number>>({});
  const [healthScore, setHealthScore] = React.useState<{ score: number; status: string } | null>(null);
  const [documentFolderTabs, setDocumentFolderTabs] = React.useState<Array<{ id: string; name: string; icon: any }>>([]);
  const [xeroDocumentFolders, setXeroDocumentFolders] = React.useState<Array<{ id: string; name: string; description: string; folderId: number }>>([]);

  // Map folder names to icons
  const getFolderIcon = (folderName: string) => {
    const iconMap: Record<string, any> = {
      'ADVICE': Briefcase,
      'ASIC': FileText,
      'ASSETS': Briefcase,
      'ATO': FileText,
      'BANK': Landmark,
      'XERO': RefreshCw,
      'COMPANY': Building2,
      'DIVIDENDS': DollarSign,
      'FINANCIALS': FileText,
      'GENERAL': FolderOpen,
      'INSURANCE': Heart,
      'LOANS': Banknote,
      'MINUTES': FileText,
      'REGISTRY': FileText,
      'TRUST': Users,
      'PAYROLL': DollarSign,
      'SUPERANNUATION': DollarSign,
      'CONTRACTS': FileText,
      'COMPLIANCE': CheckCircle,
    };
    return iconMap[folderName] || FileText;
  };

  // Load document folders from API (SSoT) based on company entity type
  const loadDocumentFolders = React.useCallback(async (company: Company) => {
    try {
      // Determine entity type for folder filtering
      let entityType = "trading_company";
      if (company.entity_type === "Trust" || company.entity_type === "Superfund") {
        entityType = "trust";
      } else if (company.is_trustee) {
        entityType = "trustee_company";
      }

      // Fetch with hierarchy to get parent/child relationships
      const data = await api.get<{ success: boolean; data: any[] }>(`/api/v1/document_folders?entity_type=${entityType}&active=true&hierarchy=true`);

      if (data.success) {
        // Map folder data to tab format with appropriate icons
        const folderTabs = data.data.map((folder: any) => {
          // Some folders need "-docs" suffix to avoid conflicts with other pages
          const needsDocsSuffix = ['ASSETS', 'DIVIDENDS', 'LOANS', 'MINUTES'].includes(folder.name);
          const tabId = folder.name.toLowerCase().replace(/_/g, '-') + (needsDocsSuffix ? '-docs' : '');

          return {
            id: tabId,
            name: folder.name,
            icon: getFolderIcon(folder.name)
          };
        });
        setDocumentFolderTabs(folderTabs);

        // Extract XERO children for sub-tabs (SSoT for document folder sub-tabs)
        const xeroFolder = data.data.find((f: any) => f.name === 'XERO');
        if (xeroFolder?.children && xeroFolder.children.length > 0) {
          const xeroChildren = xeroFolder.children.map((child: any) => ({
            id: `xero-doc-${child.name.toLowerCase().replace(/\s+/g, '-')}`,
            name: child.name,
            description: child.description || '',
            folderId: child.id
          }));
          setXeroDocumentFolders(xeroChildren);
        }
      }
    } catch (error) {
      console.error("Failed to load document folders:", error);
      // Fallback to hard-coded list if API fails
      setDocumentFolderTabs([]);
      setXeroDocumentFolders([]);
    }
  }, []);

  // Load company details
  const loadCompany = React.useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.get<{ success: boolean; company: Company }>(
        `/api/v1/companies/${companyId}`
      );
      setCompany(response.company);
      // Load document folders based on company entity type
      await loadDocumentFolders(response.company);
    } catch (error) {
      console.error("Failed to load company:", error);
    } finally {
      setLoading(false);
    }
  }, [companyId, loadDocumentFolders]);

  // Load document counts for tabs
  const loadDocumentCounts = React.useCallback(async () => {
    try {
      const response = await api.get<{ success: boolean; counts: Record<string, number> }>(
        `/api/v1/company_documents/counts`,
        { params: { company_id: companyId } }
      );
      setDocumentCounts(response.counts || {});
    } catch (error) {
      console.error("Failed to load document counts:", error);
    }
  }, [companyId]);

  // Load health score for header badge (fast endpoint - loads only this company)
  const loadHealthScore = React.useCallback(async () => {
    try {
      const response = await api.get<{ success: boolean; health: { health_score: number; health_status: string } }>(
        `/api/v1/companies/${companyId}/health`
      );
      if (response.health) {
        setHealthScore({ score: response.health.health_score, status: response.health.health_status });
      }
    } catch (error) {
      console.error("Failed to load health score:", error);
    }
  }, [companyId]);

  // Compute final DOCUMENT_TABS: folder tabs + special UI tabs
  const computedDocumentTabs = React.useMemo(() => {
    // Special UI tabs (not document folders)
    const specialTabs = [
      { id: "documents", name: "Documents", icon: FileText },
      { id: "data", name: "Data", icon: Database },
      { id: "activity", name: "Activity", icon: Clock },
    ];

    // Combine: folder tabs + special tabs
    // Keep original DOCUMENT_TABS order as fallback if folders not loaded yet
    if (documentFolderTabs.length === 0) {
      return DOCUMENT_TABS;
    }

    return [...documentFolderTabs, ...specialTabs];
  }, [documentFolderTabs]);

  // Merged XERO sub-tabs: functional tabs (from code) + document folder tabs (from DB)
  const mergedXeroSubTabs = React.useMemo(() => {
    // Functional tabs first (these have actual UI components)
    const functionalTabs = XERO_SUB_TABS.map(tab => ({
      ...tab,
      type: 'functional' as const
    }));

    // Document folder tabs from database (for document storage)
    const documentTabs = xeroDocumentFolders.map(folder => ({
      id: folder.id,
      name: folder.name,
      type: 'document' as const,
      folderId: folder.folderId,
      description: folder.description
    }));

    // Return functional tabs first, then document folder tabs
    return [...functionalTabs, ...documentTabs];
  }, [xeroDocumentFolders]);

  React.useEffect(() => {
    loadCompany();
    loadDocumentCounts();
    loadHealthScore();
  }, [loadCompany, loadDocumentCounts, loadHealthScore]);

  // Handle tab from URL
  React.useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab) setActiveTab(tab);
  }, [searchParams]);

  const handleTabChange = (tabId: string) => {
    // Redirect Data tab to data warehouse page with company filter
    if (tabId === "data") {
      router.push(`/data-warehouse?company_id=${companyId}`);
      return;
    }
    setActiveTab(tabId);
    router.push(`/corporate/companies/${companyId}?tab=${tabId}`, { scroll: false });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!company) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-4">
        <p className="text-muted-foreground">Company not found</p>
        <Button variant="outline" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Go Back
        </Button>
      </div>
    );
  }

  const getStatusColor = (status?: string) => {
    switch (status?.toLowerCase()) {
      case "active":
        return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300";
      case "inactive":
        return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300";
      case "deregistered":
        return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300";
      default:
        return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300";
    }
  };

  const getCompanyGroup = () => {
    if (typeof company.company_group === "string") {
      return company.company_group.split("_").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
    }
    return company.company_group?.name || company.group_name || null;
  };

  const getSharePointUrl = () => {
    if (company.sharepoint_folder_url) return company.sharepoint_folder_url;
    return "https://gotekna-my.sharepoint.com/personal/robert_tekna_com_au/_layouts/15/onedrive.aspx?id=%2Fpersonal%2Frobert%5Ftekna%5Fcom%5Fau%2FDocuments%2FAccounts%20%2D%20Internal%2FCorporate%20File";
  };

  return (
    <div className="flex flex-col h-full">
      {/* Back Button */}
      <button
        onClick={() => router.push("/corporate")}
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-4"
      >
        <ArrowLeft className="h-4 w-4 mr-1" />
        Back to Companies
      </button>

      {/* Header */}
      <Card className="mb-4">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Building2 className="h-10 w-10 text-muted-foreground" />
              <div>
                <h1 className="text-2xl font-bold">{company.name}</h1>
                <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                  {company.formatted_acn && <span>ACN: {company.formatted_acn}</span>}
                  {company.formatted_abn && <span>ABN: {company.formatted_abn}</span>}
                  {getCompanyGroup() && (
                    <Badge variant="secondary">{getCompanyGroup()}</Badge>
                  )}
                  <Badge className={getStatusColor(company.status)}>
                    {company.status || "active"}
                  </Badge>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {/* Health Score Badge */}
              {healthScore && (
                <button
                  onClick={() => {
                    setActiveTab("overview");
                    setOverviewSubTab("health");
                  }}
                  className={cn(
                    "flex items-center gap-2 px-3 py-2 rounded-lg border transition-all hover:scale-105",
                    healthScore.status === "excellent" && "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800",
                    healthScore.status === "good" && "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800",
                    healthScore.status === "needs_attention" && "bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800",
                    healthScore.status === "critical" && "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800"
                  )}
                >
                  <span className={cn(
                    "text-2xl font-bold",
                    healthScore.status === "excellent" && "text-green-700 dark:text-green-300",
                    healthScore.status === "good" && "text-blue-700 dark:text-blue-300",
                    healthScore.status === "needs_attention" && "text-yellow-700 dark:text-yellow-300",
                    healthScore.status === "critical" && "text-red-700 dark:text-red-300"
                  )}>
                    {healthScore.score}%
                  </span>
                  <span className={cn(
                    "text-xs uppercase font-medium",
                    healthScore.status === "excellent" && "text-green-600 dark:text-green-400",
                    healthScore.status === "good" && "text-blue-600 dark:text-blue-400",
                    healthScore.status === "needs_attention" && "text-yellow-600 dark:text-yellow-400",
                    healthScore.status === "critical" && "text-red-600 dark:text-red-400"
                  )}>
                    Health
                  </span>
                </button>
              )}
              <Button variant="outline" asChild>
                <a href={getSharePointUrl()} target="_blank" rel="noopener noreferrer">
                  <FolderOpen className="h-4 w-4 mr-2" />
                  SharePoint
                </a>
              </Button>
              <Button variant="outline">
                <Edit className="h-4 w-4 mr-2" />
                Edit
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Tabs - flex wrap for two rows */}
      <div className="border-b mb-4">
        <div className="flex flex-wrap gap-1 pb-2">
          <button
            onClick={() => handleTabChange("overview")}
            className={cn(
              "inline-flex items-center px-3 py-2 text-sm font-medium border-b-2 transition-colors",
              activeTab === "overview"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
            )}
          >
            <Building2 className="h-4 w-4 mr-2" />
            Overview
          </button>
          {computedDocumentTabs.map((tab) => {
            const Icon = tab.icon;
            // Map tab id to count key (handle naming differences)
            const countKey = tab.id === "assets-docs" ? "assets-docs" :
                            tab.id === "dividends-docs" ? "dividends-docs" :
                            tab.id === "loans-docs" ? "loans-docs" :
                            tab.id === "minutes-docs" ? "minutes-docs" :
                            tab.id;
            const count = documentCounts[countKey] || 0;
            const showCount = !["documents", "data", "activity"].includes(tab.id);
            return (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={cn(
                  "inline-flex items-center px-3 py-2 text-sm font-medium border-b-2 transition-colors",
                  activeTab === tab.id
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
                )}
              >
                <Icon className="h-4 w-4 mr-2" />
                {tab.name}
                {showCount && count > 0 && (
                  <span className="ml-1.5 px-1.5 py-0.5 text-xs rounded-full bg-muted text-muted-foreground">
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab Content */}
      <Card className="flex-1">
        <CardContent className="p-6">
          {activeTab === "overview" && (
            <div className="space-y-6">
              {/* Overview Sub-tabs - Different tabs for Trust/Superfund entities */}
              {company.entity_type === "Trust" || company.entity_type === "Superfund" ? (
                <>
                  <div className="border-b">
                    <nav className="-mb-px flex gap-6">
                      {TRUST_SUB_TABS.map((subTab) => (
                        <button
                          key={subTab.id}
                          onClick={() => setOverviewSubTab(subTab.id)}
                          className={cn(
                            "border-b-2 py-2 px-1 text-sm font-medium transition-colors",
                            overviewSubTab === subTab.id
                              ? "border-primary text-primary"
                              : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
                          )}
                        >
                          {subTab.name}
                        </button>
                      ))}
                    </nav>
                  </div>

                  {/* Trust-specific Sub-tab Content */}
                  {overviewSubTab === "info" && <InformationTab company={company} />}
                  {overviewSubTab === "trustee" && <TrusteeTab company={company} />}
                  {overviewSubTab === "beneficiaries" && <BeneficiariesTab company={company} />}
                  {overviewSubTab === "appointor" && <AppointorTab company={company} />}
                  {overviewSubTab === "trust-deed" && <TrustDeedTab />}
                  {overviewSubTab === "distributions" && <DistributionsTab />}
                </>
              ) : company.is_trustee ? (
                // Corporate Trustee - Simplified tabs (company that acts as trustee for trusts)
                <>
                  <div className="border-b">
                    <nav className="-mb-px flex gap-6">
                      {TRUSTEE_COMPANY_SUB_TABS.map((subTab) => (
                        <button
                          key={subTab.id}
                          onClick={() => setOverviewSubTab(subTab.id)}
                          className={cn(
                            "border-b-2 py-2 px-1 text-sm font-medium transition-colors",
                            overviewSubTab === subTab.id
                              ? "border-primary text-primary"
                              : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
                          )}
                        >
                          {subTab.name}
                        </button>
                      ))}
                    </nav>
                  </div>

                  {/* Corporate Trustee Sub-tab Content */}
                  {overviewSubTab === "info" && <InformationTab company={company} />}
                  {overviewSubTab === "corporate" && <CorporateTab company={company} onUpdate={loadCompany} />}
                  {overviewSubTab === "bank-accounts" && <BankAccountsTab company={company} companyId={companyId} />}
                  {overviewSubTab === "directors" && <DirectorsTab companyId={companyId} />}
                  {overviewSubTab === "shareholdings" && <ShareholdingsTab company={company} companyId={companyId} />}
                  {overviewSubTab === "trusts" && <TrustsTab company={company} onUpdate={loadCompany} />}
                </>
              ) : (
                // Trading Company - Full tabs
                <>
                  <div className="border-b">
                    <nav className="-mb-px flex gap-6">
                      {OVERVIEW_SUB_TABS.map((subTab) => (
                        <button
                          key={subTab.id}
                          onClick={() => setOverviewSubTab(subTab.id)}
                          className={cn(
                            "border-b-2 py-2 px-1 text-sm font-medium transition-colors",
                            overviewSubTab === subTab.id
                              ? "border-primary text-primary"
                              : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
                          )}
                        >
                          {subTab.name}
                        </button>
                      ))}
                    </nav>
                  </div>

                  {/* Company Sub-tab Content */}
                  {overviewSubTab === "info" && <InformationTab company={company} />}
                  {overviewSubTab === "corporate" && <CorporateTab company={company} onUpdate={loadCompany} />}
                  {overviewSubTab === "bank-accounts" && <BankAccountsTab company={company} companyId={companyId} />}
                  {overviewSubTab === "health" && <HealthTab company={company} onUpdate={loadCompany} />}
                  {overviewSubTab === "directors" && <DirectorsTab companyId={companyId} />}
                  {overviewSubTab === "shareholdings" && <ShareholdingsTab company={company} companyId={companyId} />}
                  {overviewSubTab === "trusts" && <TrustsTab company={company} onUpdate={loadCompany} />}
                  {overviewSubTab === "consolidation" && <ConsolidationTab company={company} onUpdate={loadCompany} />}
                </>
              )}
            </div>
          )}

          {/* XERO Tab with sub-tabs */}
          {activeTab === "xero" && (
            <>
              {/* Xero Sub-tabs - merged from code (functional) + database (document folders) */}
              <div className="flex gap-2 mb-4 border-b flex-wrap">
                {mergedXeroSubTabs.map((subTab) => (
                  <button
                    key={subTab.id}
                    onClick={() => setXeroSubTab(subTab.id)}
                    className={cn(
                      "px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
                      xeroSubTab === subTab.id
                        ? "border-primary text-primary"
                        : "border-transparent text-muted-foreground hover:text-foreground",
                      subTab.type === 'document' && "text-blue-600"
                    )}
                  >
                    {subTab.type === 'document' && <FileText className="h-3 w-3 inline mr-1" />}
                    {subTab.name}
                  </button>
                ))}
              </div>

              {xeroSubTab === "connection" && (
                <XeroConnectionCard
                  companyId={companyId}
                  companyName={company?.name}
                  onConnectionChange={setXeroConnected}
                />
              )}

              {xeroSubTab === "accounts" && (
                <XeroAccountsCard companyId={companyId} companyName={company?.name} />
              )}

              {xeroSubTab === "profit-loss" && (
                <XeroProfitLossCard companyId={companyId} />
              )}

              {xeroSubTab === "balance-sheet" && (
                <XeroBalanceSheetCard companyId={companyId} />
              )}

              {xeroSubTab === "profit-loss-pdf" && (
                <XeroPdfReportsCard
                  companyId={companyId}
                  reportType="profit_loss"
                  title="Profit & Loss PDF Reports"
                  foundationId={488}
                />
              )}

              {xeroSubTab === "balance-sheet-pdf" && (
                <XeroPdfReportsCard
                  companyId={companyId}
                  reportType="balance_sheet"
                  title="Balance Sheet PDF Reports"
                  foundationId={489}
                />
              )}

              {xeroSubTab === "bank-accounts" && (
                <XeroBankAccountsCard companyId={companyId} />
              )}

              {xeroSubTab === "bank-statement" && (
                <div className="p-4 text-center text-gray-500">
                  <p>Bank Statement reports are available in the Gold Standard Tables.</p>
                  <p className="text-sm mt-2">Foundation ID: 487</p>
                </div>
              )}

              {/* Document folder sub-tabs from database (SSoT) */}
              {xeroSubTab.startsWith('xero-doc-') && (
                <CompanyDocumentsTab
                  companyId={companyId}
                  company={company}
                  category={xeroDocumentFolders.find(f => f.id === xeroSubTab)?.name || 'XERO'}
                />
              )}
            </>
          )}

          {/* Document Category Tabs */}
          {computedDocumentTabs.find(t => t.id === activeTab)?.name && activeTab !== "activity" && activeTab !== "documents" && activeTab !== "data" && activeTab !== "xero" && (
            <>
              {/* SSoT: Show ATO Setup Card on ATO tab */}
              {activeTab === "ato" && (
                <ATOSetupCard company={company} />
              )}
              <CompanyDocumentsTab
                companyId={companyId}
                company={company}
                category={computedDocumentTabs.find(t => t.id === activeTab)?.name}
              />
            </>
          )}

          {activeTab === "documents" && (
            <CompanyDocumentsTab companyId={companyId} company={company} category="all" />
          )}
          {/* Data tab redirects to /admin/system?tab=data-warehouse&company_id={id} */}
          {activeTab === "activity" && <ActivityTab />}
        </CardContent>
      </Card>
    </div>
  );
}
