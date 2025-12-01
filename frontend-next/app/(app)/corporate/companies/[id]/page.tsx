"use client";

import * as React from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import {
  ArrowLeft,
  Building2,
  Users,
  FileText,
  DollarSign,
  Shield,
  Edit,
  Loader2,
  ExternalLink,
  ChevronRight,
  Copy,
  Check,
  Briefcase,
  Heart,
  Clock,
  CreditCard,
  Landmark,
  FolderOpen,
  Percent,
  Banknote,
  Save,
  X,
  Plus,
  Upload,
  Cloud,
  CheckCircle,
  XCircle,
  Eye,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { format } from "date-fns";
import TeeemTableView from "@/components/table/TeeemTableView";
import type { TableColumn, TableRow } from "@/components/table/types";

// Document category tabs
const DOCUMENT_TABS = [
  { id: "advice", name: "ADVICE", icon: Briefcase },
  { id: "asic", name: "ASIC", icon: FileText },
  { id: "assets-docs", name: "ASSETS", icon: Briefcase },
  { id: "ato", name: "ATO", icon: FileText },
  { id: "bank", name: "BANK", icon: Landmark },
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
  { id: "activity", name: "Activity", icon: Clock },
];

// Overview sub-tabs
const OVERVIEW_SUB_TABS = [
  { id: "info", name: "Information" },
  { id: "corporate", name: "Corporate" },
  { id: "health", name: "Health" },
  { id: "directors", name: "Directors" },
  { id: "shareholdings", name: "Shareholdings" },
  { id: "trusts", name: "Trusts" },
  { id: "consolidation", name: "Consolidation" },
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
    full_name: string;
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
  slug?: string;
  code?: string;
  acn?: string;
  abn?: string;
  tfn?: string;
  entity_type?: string;
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
  group_name?: string;
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
}

interface Investment {
  id: number;
  company_id: number;
  company_name: string;
  company_acn?: string;
  number_of_shares: number;
  percentage: number;
  share_class?: string;
  acquisition_date?: string;
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      className="p-1 hover:bg-muted rounded transition-colors"
      title="Copy to clipboard"
    >
      {copied ? (
        <Check className="h-3.5 w-3.5 text-green-600" />
      ) : (
        <Copy className="h-3.5 w-3.5 text-muted-foreground" />
      )}
    </button>
  );
}

function InfoRow({ label, value, copyable = false, mono = false }: { label: string; value?: string | number | null; copyable?: boolean; mono?: boolean }) {
  if (value === undefined || value === null || value === "") return null;
  return (
    <div className="flex justify-between py-2 border-b border-border/50 last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className={cn("text-sm font-medium flex items-center gap-1", mono && "font-mono")}>
        {value}
        {copyable && typeof value === "string" && <CopyButton value={value} />}
      </span>
    </div>
  );
}

// Information Sub-Tab
function InformationTab({ company }: { company: Company }) {
  return (
    <div className="space-y-6">
      <h3 className="text-lg font-medium">Company Information</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
        <div>
          <p className="text-sm text-muted-foreground">Legal Name</p>
          <p className="text-sm font-medium">{company.name}</p>
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
          <h4 className="text-sm font-medium text-muted-foreground mb-2">Current Directors</h4>
          <ul className="space-y-1">
            {company.current_directors.map((director) => (
              <li key={director.id} className="text-sm">
                {director.contact?.full_name || "Unknown"}
              </li>
            ))}
          </ul>
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
    registered_office_address: company.registered_office_address || "",
    corporate_key: company.corporate_key || "",
    asic_username: company.asic_username || "",
    asic_password: "",
    recovery_question: company.recovery_question || "",
    recovery_answer: "",
    bank_name: company.bank_name || "",
    bank_bsb: company.bank_bsb || "",
    bank_account_number: company.bank_account_number || "",
    bank_account_name: company.bank_account_name || "",
    bank_start_date: company.bank_start_date || "",
    bank_end_date: company.bank_end_date || "",
  });

  const handleSave = async () => {
    setSaving(true);
    try {
      const dataToSend = { ...formData };
      if (!dataToSend.asic_password) delete (dataToSend as Record<string, unknown>).asic_password;
      if (!dataToSend.recovery_answer) delete (dataToSend as Record<string, unknown>).recovery_answer;
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

      {/* Bank Account */}
      <div className="border-t pt-6">
        <h4 className="text-sm font-semibold mb-4">Bank Account</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <Label className="text-muted-foreground">Bank Name</Label>
            {isEditing ? (
              <Input
                value={formData.bank_name}
                onChange={(e) => setFormData({ ...formData, bank_name: e.target.value })}
                placeholder="e.g. Commonwealth Bank"
                className="mt-1"
              />
            ) : (
              <p className="text-sm mt-1">{company.bank_name || "-"}</p>
            )}
          </div>
          <div>
            <Label className="text-muted-foreground">BSB</Label>
            {isEditing ? (
              <Input
                value={formData.bank_bsb}
                onChange={(e) => setFormData({ ...formData, bank_bsb: e.target.value })}
                placeholder="000-000"
                className="mt-1"
              />
            ) : (
              <p className="text-sm font-mono mt-1">{company.bank_bsb || "-"}</p>
            )}
          </div>
          <div>
            <Label className="text-muted-foreground">Account Number</Label>
            {isEditing ? (
              <Input
                value={formData.bank_account_number}
                onChange={(e) => setFormData({ ...formData, bank_account_number: e.target.value })}
                className="mt-1"
              />
            ) : (
              <p className="text-sm font-mono mt-1">{company.bank_account_number || "-"}</p>
            )}
          </div>
          <div>
            <Label className="text-muted-foreground">Account Name</Label>
            {isEditing ? (
              <Input
                value={formData.bank_account_name}
                onChange={(e) => setFormData({ ...formData, bank_account_name: e.target.value })}
                className="mt-1"
              />
            ) : (
              <p className="text-sm mt-1">{company.bank_account_name || "-"}</p>
            )}
          </div>
          <div>
            <Label className="text-muted-foreground">Start Date</Label>
            {isEditing ? (
              <Input
                type="date"
                value={formData.bank_start_date}
                onChange={(e) => setFormData({ ...formData, bank_start_date: e.target.value })}
                className="mt-1"
              />
            ) : (
              <p className="text-sm mt-1">
                {company.bank_start_date ? format(new Date(company.bank_start_date), "dd/MM/yyyy") : "-"}
              </p>
            )}
          </div>
          <div>
            <Label className="text-muted-foreground">End Date</Label>
            {isEditing ? (
              <Input
                type="date"
                value={formData.bank_end_date}
                onChange={(e) => setFormData({ ...formData, bank_end_date: e.target.value })}
                className="mt-1"
              />
            ) : (
              <p className="text-sm mt-1">
                {company.bank_end_date ? format(new Date(company.bank_end_date), "dd/MM/yyyy") : "-"}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Directors Sub-Tab
function DirectorsTab({ company }: { company: Company }) {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-medium">Directors</h3>
      {company.current_directors && company.current_directors.length > 0 ? (
        <div className="space-y-4">
          {company.current_directors.map((director) => (
            <div key={director.id} className="flex items-center justify-between py-3 border-b last:border-0">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-medium">
                  {director.contact?.full_name?.split(" ").map((n) => n[0]).join("").toUpperCase() || "?"}
                </div>
                <div>
                  <p className="font-medium">{director.contact?.full_name || "Unknown"}</p>
                  <p className="text-sm text-muted-foreground">{director.formatted_position}</p>
                </div>
              </div>
              <div className="text-right text-sm">
                <p className="text-muted-foreground">
                  Appointed {format(new Date(director.appointment_date), "d MMM yyyy")}
                </p>
                {director.contact?.email && (
                  <a href={`mailto:${director.contact.email}`} className="text-primary hover:underline">
                    {director.contact.email}
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-muted-foreground text-center py-8">No directors recorded</p>
      )}
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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">Shareholdings</h3>
        {company.shares_on_issue && (
          <span className="text-sm text-muted-foreground">
            {company.shares_on_issue.toLocaleString()} shares on issue
          </span>
        )}
      </div>
      {shareholders.length > 0 ? (
        <div className="space-y-3">
          {shareholders.map((sh) => (
            <div key={sh.id} className="flex items-center justify-between py-3 border-b last:border-0">
              <div>
                <p className="font-medium">{sh.shareholder_name}</p>
                <p className="text-sm text-muted-foreground">
                  {sh.share_class || "Ordinary"} shares
                  {sh.beneficially_held && ` (Beneficial owner: ${sh.beneficial_owner})`}
                </p>
              </div>
              <div className="text-right">
                <p className="font-medium">{sh.number_of_shares.toLocaleString()} shares</p>
                <p className="text-sm text-muted-foreground">{sh.percentage}%</p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-muted-foreground text-center py-8">No shareholders recorded</p>
      )}
    </div>
  );
}

// Placeholder tabs
function HealthTab() {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-medium">Health</h3>
      <p className="text-muted-foreground">Health information coming soon</p>
    </div>
  );
}

function TrustsTab() {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-medium">Trusts</h3>
      <p className="text-muted-foreground">Trust relationships coming soon</p>
    </div>
  );
}

function ConsolidationTab() {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-medium">Consolidation</h3>
      <p className="text-muted-foreground">Consolidation information coming soon</p>
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
  ai_verification_status?: string;
}

// Build column definitions for documents table
const buildDocumentColumns = (): TableColumn[] => [
  { key: "id", label: "ID", column_type: "whole_number", resizable: true, sortable: true, filterable: true, filterType: "text", width: 60 },
  { key: "document_type", label: "Type", column_type: "single_line_text", resizable: true, sortable: true, filterable: true, filterType: "dropdown", width: 100 },
  { key: "financial_years", label: "FY", column_type: "single_line_text", resizable: true, sortable: true, filterable: true, filterType: "dropdown", width: 80 },
  { key: "folder", label: "Folder", column_type: "single_line_text", resizable: true, sortable: true, filterable: true, filterType: "dropdown", width: 100 },
  { key: "source", label: "Source", column_type: "single_line_text", resizable: true, sortable: true, filterable: true, filterType: "dropdown", width: 100 },
  { key: "file_size", label: "Size", column_type: "whole_number", resizable: true, sortable: true, filterable: false, width: 100 },
  { key: "document_date", label: "Doc Date", column_type: "date", resizable: true, sortable: true, filterable: true, filterType: "date", width: 120 },
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
  const [sharepointConnected, setShaepointConnected] = React.useState(false);
  const [columns] = React.useState(buildDocumentColumns());

  React.useEffect(() => {
    loadDocuments();
    checkSharePointConnection();
  }, [companyId, category]);

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
      }));
      setDocuments(transformed);
    } catch (error) {
      console.error("Failed to load documents:", error);
    } finally {
      setLoading(false);
    }
  };

  const checkSharePointConnection = async () => {
    try {
      const response = await api.get<{ connected: boolean }>("/api/v1/organization_onedrive/status");
      setShaepointConnected(response.connected === true);
    } catch {
      setShaepointConnected(false);
    }
  };

  const handleRowClick = (doc: CompanyDocument) => {
    if (doc.file_url) {
      window.open(doc.file_url, "_blank");
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
        return doc.folder ? (
          <Badge variant="outline" className="bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
            {doc.folder}
          </Badge>
        ) : null;
      case "document_type":
        return doc.document_type ? (
          <span className="text-muted-foreground capitalize">{doc.document_type.replace(/_/g, " ")}</span>
        ) : null;
      default:
        return null;
    }
  };

  // Get SharePoint folder URL for this tab
  const getSharePointUrl = () => {
    if (!company.sharepoint_folder_url) return null;
    if (category && category !== "all") {
      return `${company.sharepoint_folder_url}/${encodeURIComponent(category.toUpperCase())}`;
    }
    return company.sharepoint_folder_url;
  };

  // Custom actions for table header
  const customActions = (
    <div className="flex items-center gap-2">
      {/* SharePoint status badge */}
      {sharepointConnected && getSharePointUrl() ? (
        <a
          href={getSharePointUrl()!}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors"
        >
          <CheckCircle className="h-3.5 w-3.5" />
          SharePoint
          <ExternalLink className="h-3 w-3" />
        </a>
      ) : (
        <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium bg-muted text-muted-foreground">
          <XCircle className="h-3.5 w-3.5" />
          SharePoint Offline
        </span>
      )}
      <Button>
        <Plus className="h-4 w-4 mr-2" />
        Upload
      </Button>
      <Button variant="outline">
        <Edit className="h-4 w-4 mr-2" />
        Edit
      </Button>
    </div>
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
          {customActions}
        </div>
      </div>
    );
  }

  return (
    <TeeemTableView
      foundationId={`company-documents-${category || "all"}`}
      tableName={`${category ? category.toUpperCase() : "All"} Documents (${documents.length})`}
      entries={documents}
      columns={columns}
      onDelete={handleDelete}
      onBulkDelete={handleBulkDelete}
      onRowDoubleClick={handleRowClick}
      enableImport={false}
      enableExport={true}
      enableSchemaEditor={false}
      hideUpdateViewButton={true}
      customActions={customActions}
      customCellRenderer={customCellRenderer}
    />
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

export default function CompanyDetailPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const companyId = params.id as string;

  const [loading, setLoading] = React.useState(true);
  const [company, setCompany] = React.useState<Company | null>(null);
  const [activeTab, setActiveTab] = React.useState("overview");
  const [overviewSubTab, setOverviewSubTab] = React.useState("info");

  // Load company details
  const loadCompany = React.useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.get<{ success: boolean; company: Company }>(
        `/api/v1/companies/${companyId}`
      );
      setCompany(response.company);
    } catch (error) {
      console.error("Failed to load company:", error);
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  React.useEffect(() => {
    loadCompany();
  }, [loadCompany]);

  // Handle tab from URL
  React.useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab) setActiveTab(tab);
  }, [searchParams]);

  const handleTabChange = (tabId: string) => {
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
            <div className="flex items-center gap-2">
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

      {/* Main Tabs */}
      <div className="border-b mb-4">
        <ScrollArea className="w-full whitespace-nowrap">
          <div className="flex gap-1 pb-2">
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
            {DOCUMENT_TABS.map((tab) => {
              const Icon = tab.icon;
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
                </button>
              );
            })}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </div>

      {/* Tab Content */}
      <Card className="flex-1">
        <CardContent className="p-6">
          {activeTab === "overview" && (
            <div className="space-y-6">
              {/* Overview Sub-tabs */}
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

              {/* Overview Sub-tab Content */}
              {overviewSubTab === "info" && <InformationTab company={company} />}
              {overviewSubTab === "corporate" && <CorporateTab company={company} onUpdate={loadCompany} />}
              {overviewSubTab === "health" && <HealthTab />}
              {overviewSubTab === "directors" && <DirectorsTab company={company} />}
              {overviewSubTab === "shareholdings" && <ShareholdingsTab company={company} companyId={companyId} />}
              {overviewSubTab === "trusts" && <TrustsTab />}
              {overviewSubTab === "consolidation" && <ConsolidationTab />}
            </div>
          )}

          {/* Document Category Tabs */}
          {DOCUMENT_TABS.find(t => t.id === activeTab)?.name && activeTab !== "activity" && activeTab !== "documents" && (
            <CompanyDocumentsTab
              companyId={companyId}
              company={company}
              category={DOCUMENT_TABS.find(t => t.id === activeTab)?.name}
            />
          )}

          {activeTab === "documents" && (
            <CompanyDocumentsTab companyId={companyId} company={company} category="all" />
          )}
          {activeTab === "activity" && <ActivityTab />}
        </CardContent>
      </Card>
    </div>
  );
}
