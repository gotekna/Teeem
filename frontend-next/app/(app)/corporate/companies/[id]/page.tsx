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
  AlertTriangle,
  BarChart3,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { format } from "date-fns";
import { RefreshCw, Link2, Unlink } from "lucide-react";
import TeeemTableView from "@/components/table/TeeemTableView";
import type { TableColumn, TableRow } from "@/components/table/types";
import DocumentPreviewModal from "@/components/corporate/DocumentPreviewModal";

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
  company_group_id?: number;
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

interface ConsolidatedCompany {
  id: number;
  name: string;
  code?: string;
  acn?: string;
  entity_type?: string;
  status?: string;
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

  React.useEffect(() => {
    loadConsolidatedCompanies();
    loadCompanyGroups();
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

  const handleAddCompany = () => {
    loadAvailableCompanies();
    setShowAddForm(true);
  };

  const handleSaveConsolidation = async () => {
    if (!selectedCompanyId) return;
    try {
      setSaving(true);
      await api.put(`/api/v1/companies/${selectedCompanyId}`, {
        company: { consolidation_parent_id: company.id, company_group_id: company.company_group_id },
      });
      setShowAddForm(false);
      setSelectedCompanyId("");
      loadConsolidatedCompanies();
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
      await api.put(`/api/v1/companies/${companyId}`, {
        company: { consolidation_parent_id: null },
      });
      loadConsolidatedCompanies();
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

// Build column definitions for documents table
// Column types must match Foundation ID 357 (company_documents)
const buildDocumentColumns = (): TableColumn[] => [
  { key: "id", label: "ID", column_type: "whole_number", resizable: true, sortable: true, filterable: true, filterType: "text", width: 60 },
  { key: "document_type", label: "Type", column_type: "choice", resizable: true, sortable: true, filterable: true, filterType: "dropdown", width: 100 },
  { key: "financial_years", label: "FY", column_type: "structured_data", resizable: true, sortable: true, filterable: true, filterType: "dropdown", width: 80 },
  { key: "folder", label: "Folder", column_type: "choice", resizable: true, sortable: true, filterable: true, filterType: "dropdown", width: 100 },
  { key: "source", label: "Source", column_type: "choice", resizable: true, sortable: true, filterable: true, filterType: "dropdown", width: 100 },
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

  // Document preview modal state
  const [selectedDocument, setSelectedDocument] = React.useState<CompanyDocument | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = React.useState(false);

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
    // Open document preview modal instead of opening file directly
    setSelectedDocument(doc);
    setIsPreviewOpen(true);
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
        onRowDoubleClick={handleRowClick}
        enableImport={false}
        enableExport={true}
        enableSchemaEditor={false}
        showDataHealth={true}
        customActions={customActions}
        customCellRenderer={customCellRenderer}
      />

      {/* Document Preview Modal with AI Verification */}
      {selectedDocument && (
        <DocumentPreviewModal
          open={isPreviewOpen}
          onOpenChange={(open) => {
            setIsPreviewOpen(open);
            if (!open) setSelectedDocument(null);
          }}
          document={selectedDocument}
          onDocumentUpdate={loadDocuments}
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

function XeroConnectionCard({ companyId, onSyncComplete, onConnectionChange }: { companyId: string; onSyncComplete?: () => void; onConnectionChange?: (connected: boolean) => void }) {
  const [status, setStatus] = React.useState<XeroConnectionStatus | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [connecting, setConnecting] = React.useState(false);
  const [disconnecting, setDisconnecting] = React.useState(false);
  const [syncing, setSyncing] = React.useState(false);

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

  const handleConnect = async () => {
    try {
      setConnecting(true);
      const response = await api.get<{ success: boolean; authorization_url: string }>(
        `/api/v1/companies/${companyId}/xero/authorize`
      );
      if (response.success && response.authorization_url) {
        // Open Xero OAuth in new window
        window.open(response.authorization_url, "_blank", "width=600,height=700");
        // Start polling for connection status
        const pollInterval = setInterval(async () => {
          const statusCheck = await api.get<{ success: boolean } & XeroConnectionStatus>(
            `/api/v1/companies/${companyId}/xero/status`
          );
          if (statusCheck.connected) {
            clearInterval(pollInterval);
            setStatus(statusCheck);
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
      await api.post(`/api/v1/companies/${companyId}/xero/sync`);
      await loadStatus();
      onSyncComplete?.();
    } catch (error) {
      console.error("Failed to sync with Xero:", error);
    } finally {
      setSyncing(false);
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
      </CardContent>
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

      if (response.success) {
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
            <p className="text-sm mt-1">Click "Sync from Xero" to import transactions.</p>
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
                      {format(new Date(tx.transaction_date), "d MMM yyyy")}
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

export default function CompanyDetailPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const companyId = params.id as string;

  const [loading, setLoading] = React.useState(true);
  const [company, setCompany] = React.useState<Company | null>(null);
  const [activeTab, setActiveTab] = React.useState("overview");
  const [overviewSubTab, setOverviewSubTab] = React.useState("info");
  const [xeroConnected, setXeroConnected] = React.useState(false);

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
              {overviewSubTab === "health" && <HealthTab company={company} onUpdate={loadCompany} />}
              {overviewSubTab === "directors" && <DirectorsTab company={company} />}
              {overviewSubTab === "shareholdings" && <ShareholdingsTab company={company} companyId={companyId} />}
              {overviewSubTab === "trusts" && <TrustsTab company={company} onUpdate={loadCompany} />}
              {overviewSubTab === "consolidation" && <ConsolidationTab company={company} onUpdate={loadCompany} />}
            </div>
          )}

          {/* Document Category Tabs */}
          {DOCUMENT_TABS.find(t => t.id === activeTab)?.name && activeTab !== "activity" && activeTab !== "documents" && (
            <>
              {/* Show Xero connection and transactions on BANK tab */}
              {activeTab === "bank" && (
                <>
                  <XeroConnectionCard
                    companyId={companyId}
                    onConnectionChange={setXeroConnected}
                  />
                  <BankTransactionsCard
                    companyId={companyId}
                    isConnected={xeroConnected}
                  />
                </>
              )}
              <CompanyDocumentsTab
                companyId={companyId}
                company={company}
                category={DOCUMENT_TABS.find(t => t.id === activeTab)?.name}
              />
            </>
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
