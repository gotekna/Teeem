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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
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
  HardDrive,
  RefreshCw,
  RefreshCcw,
  Link2,
  Link2Off,
  Unlink,
  Sparkles,
  Pencil,
  GitMerge,
  Info,
  Mail,
  Phone,
  ChevronRight,
  Download,
  Activity,
  AlertCircle,
} from "lucide-react";
import { CopyableField, CopyableLink } from "@/components/ui/copyable";
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
import { XeroSetupWizard } from "@/components/xero/XeroSetupWizard";
import { XeroContactsTable } from "@/components/xero/XeroContactsTable";
import {
  XeroConnectionCard,
  XeroOverviewCard,
  XeroAccountsCard,
  XeroProfitLossCard,
  XeroBalanceSheetCard,
  XeroPLStatementView,
  XeroBalanceSheetStatementView,
  XeroBankAccountsCard,
  XeroReportsPanel,
  XeroConsolidatedCard,
  XeroCompanyDocSyncCard,
  XeroGroupPLCard,
  XeroGroupBalanceSheetCard,
} from "@/components/xero";

// Extracted tab components (SSoT: lib/tab-component-registry.ts)
import {
  InformationTab,
  ActivityTab,
  DirectorsTab,
  TrustDeedTab,
  DistributionsTab,
  TrusteeTab,
  BeneficiariesTab,
  AppointorTab,
  ShareholdingsTab,
  MembersTab,
  BankAccountsTab,
  HealthTab,
  TrustsTab,
  ConsolidationTab,
} from "@/components/tabs";
// Shared types for corporate entities (SSoT for Company type)
import type { CorporateCompany, Director as CorporateDirector, Shareholding } from "@/lib/types/corporate";

// SSoT: Using unified EntityTabs API (Phase 4 migration)
import { useCorporateEntityTabs } from "@/lib/hooks/useCorporateEntityTabs";
import { useXeroEntityTabs } from "@/lib/hooks/useXeroEntityTabs";
import { getIcon } from "@/lib/icon-map";

// =============================================================================
// TAB CONFIGURATION
// SSoT: GET /api/v1/entity_tabs?scope=corporate_entity (EntityTab model)
// Xero tabs are children of the Xero tab in corporate_entity scope (SSoT)
// Manage via: Admin > System > Entity Configuration
// Phase 4 Migration Complete: Using useCorporateEntityTabs & useXeroEntityTabs hooks
// =============================================================================

// SSoT: All tabs come from API only (EntityTabs database)
// NO FALLBACK ARRAYS - if API fails, show error so we can fix it
// Manage tabs via: Admin > System > Entity Configuration

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

// Company type alias - SSoT: CorporateCompany from @/lib/types/corporate
type Company = CorporateCompany;

// Shareholding type is imported from @/lib/types/corporate

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


// Shareholdings Sub-Tab

// Members Tab - For Charity and Superfund entities (similar to Shareholdings but without shares)

// Bank Accounts Tab - SSoT: Uses bank_accounts table via Foundation (ID: 350)

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


// Trust-specific tabs for Trust/Superfund entities


// AppointorTab removed - now imported from @/components/tabs




// Document interface for table
interface CompanyDocument extends TableRow {
  display_title?: string;
  display_name?: string;
  file_name?: string;
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
        display_title: doc.display_name || doc.file_name,
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

  // Always show TeeemTableView - let it handle empty state for consistent UI
  return (
    <>
      <TeeemTableView
        foundationId={`company-documents-${category || "all"}`}
        foundationIdNumeric={357}
        tableName={`${category ? category.toUpperCase() : "All"} Documents (${documents.length})`}
        entries={documents}
        // columns prop removed - TeeemTableView auto-fetches from Foundation API (SSoT)
        onDelete={handleDelete}
        onBulkDelete={handleBulkDelete}
        onRowClick={handleSingleClick}
        onRowDoubleClick={handleDoubleClick}
        enableImport={false}
        enableExport={true}
        enableSchemaEditor={false}
        showDataHealth={false}
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

// Data Warehouse Tab - Redirects to /admin/system?tab=data-warehouse&company_id={id}
// The Data tab redirects to the admin data warehouse with company filter

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
  const [xeroContacts, setXeroContacts] = React.useState<any[]>([]);
  const [xeroContactsLoading, setXeroContactsLoading] = React.useState(false);
  const [xeroBills, setXeroBills] = React.useState<any[]>([]);
  const [xeroBillsLoading, setXeroBillsLoading] = React.useState(false);
  const [xeroInvoices, setXeroInvoices] = React.useState<any[]>([]);
  const [xeroInvoicesLoading, setXeroInvoicesLoading] = React.useState(false);
  // Bill drawer state
  const [selectedBill, setSelectedBill] = React.useState<any | null>(null);
  const [isBillDrawerOpen, setIsBillDrawerOpen] = React.useState(false);
  const billClickTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  // Company edit sheet state
  const [isEditSheetOpen, setIsEditSheetOpen] = React.useState(false);
  const [savingEdit, setSavingEdit] = React.useState(false);
  const [editFormData, setEditFormData] = React.useState({
    name: "",
    acn: "",
    abn: "",
    status: "",
    entity_type: "",
    date_incorporated: "",
    registered_office_address: "",
    principal_place_of_business: "",
    purpose: "",
  });

  // Bill click handlers (single = drawer, double = navigate to PO)
  const handleBillSingleClick = (bill: any) => {
    if (billClickTimeoutRef.current) {
      clearTimeout(billClickTimeoutRef.current);
    }
    billClickTimeoutRef.current = setTimeout(() => {
      setSelectedBill(bill);
      setIsBillDrawerOpen(true);
      billClickTimeoutRef.current = null;
    }, 200);
  };

  const handleBillDoubleClick = (bill: any) => {
    if (billClickTimeoutRef.current) {
      clearTimeout(billClickTimeoutRef.current);
      billClickTimeoutRef.current = null;
    }
    setIsBillDrawerOpen(false);
    setSelectedBill(null);
    // Navigate to invoice detail page (SSoT: /finance/invoices/[id])
    if (bill.id) {
      router.push(`/finance/invoices/${bill.id}`);
    }
  };

  // Company edit handlers
  const openEditSheet = () => {
    if (company) {
      setEditFormData({
        name: company.name || "",
        acn: company.acn || "",
        abn: company.abn || "",
        status: company.status || "active",
        entity_type: company.entity_type || "Company",
        date_incorporated: company.date_incorporated || "",
        registered_office_address: company.registered_office_address || "",
        principal_place_of_business: company.principal_place_of_business || "",
        purpose: company.purpose || "",
      });
      setIsEditSheetOpen(true);
    }
  };

  const handleSaveCompany = async () => {
    setSavingEdit(true);
    try {
      await api.put(`/api/v1/companies/${companyId}`, { company: editFormData });
      setIsEditSheetOpen(false);
      loadCompany();
    } catch (error) {
      console.error("Failed to save company:", error);
    } finally {
      setSavingEdit(false);
    }
  };

  const [documentCounts, setDocumentCounts] = React.useState<Record<string, number>>({});
  const [healthScore, setHealthScore] = React.useState<{ score: number; status: string } | null>(null);

  // SSoT: Entity type normalization for tab filtering
  const normalizedEntityType = React.useMemo(() => {
    if (!company) return undefined;
    let entityType = company.entity_type || "Company";
    // Normalize entity type (handle lowercase from legacy data)
    if (entityType.toLowerCase() === "company") return "Company";
    if (entityType.toLowerCase() === "trust") return "Trust";
    if (entityType.toLowerCase() === "superfund") return "Superfund";
    if (entityType.toLowerCase() === "charity") return "Charity";
    return entityType;
  }, [company]);

  // SSoT: Using unified EntityTabs API (Phase 4 migration)
  // Corporate tabs - replaces old /api/v1/corporate/entity_tabs
  const {
    overviewTabs: entityOverviewTabs,
    documentTabs: documentFolderTabs,
    xeroSubTabs: xeroDocumentFolders,
    mainTabs: entityMainTabs,
    loading: corporateTabsLoading,
  } = useCorporateEntityTabs(normalizedEntityType);

  // Xero feature tabs - replaces old /api/v1/xero/tabs
  const {
    tabs: xeroFeatureTabs,
    loading: xeroTabsLoading,
  } = useXeroEntityTabs();

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

  // REMOVED: loadEntityTabs - now using useCorporateEntityTabs hook (SSoT)
  // REMOVED: loadXeroTabs - now using useXeroEntityTabs hook (SSoT)

  // Load company details
  const loadCompany = React.useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.get<{ success: boolean; company: Company }>(
        `/api/v1/companies/${companyId}`
      );
      setCompany(response.company);
      // SSoT: Entity tabs now loaded via useCorporateEntityTabs hook (Phase 4)
      // The hook automatically refetches when company.entity_type changes
    } catch (error) {
      console.error("Failed to load company:", error);
    } finally {
      setLoading(false);
    }
  }, [companyId]);

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

  // SSoT: Document tabs from API only (EntityTabs database, group: documents)
  // Convert string icon names to Lucide components
  const computedDocumentTabs = React.useMemo(() => {
    return documentFolderTabs.map(tab => ({
      ...tab,
      icon: tab.id === "xero" ? RefreshCw : getFolderIcon(tab.name.toUpperCase()),
    }));
  }, [documentFolderTabs]);

  // SSoT: Xero tabs from API only - no fallback
  // Backend filters out document folders that match functional tab names
  // Visibility rules:
  // - head_only: Only show if company is a head (has_consolidated_children)
  // - group_member: Show if company is part of a group (is head OR has a parent)
  // SSoT: All tabs sorted by order_position from admin config
  // Used for both Level 1 display and finding children of parent tabs
  const mergedXeroSubTabs = React.useMemo(() => {
    const isHeadCompany = company?.has_consolidated_children === true;
    const isPartOfGroup = isHeadCompany || !!company?.consolidation_parent_id;

    return xeroFeatureTabs
      .filter(tab => {
        // head_only tabs: only for head companies
        if (tab.head_only && !isHeadCompany) return false;
        // group_member tabs: only for companies in a group
        if (tab.group_member && !isPartOfGroup) return false;
        return true;
      })
      // SSoT: Sort by order_position from admin config
      .sort((a, b) => (a.order_position ?? 999) - (b.order_position ?? 999));
  }, [xeroFeatureTabs, company?.has_consolidated_children, company?.consolidation_parent_id]);

  // Level 1 tabs: tabs without a parent (top-level tabs shown in the tab bar)
  const xeroLevel1Tabs = React.useMemo(() => {
    return mergedXeroSubTabs.filter(tab => !tab.parent);
  }, [mergedXeroSubTabs]);

  // Get child tabs for a given parent
  const getXeroChildTabs = React.useCallback((parentKey: string) => {
    return mergedXeroSubTabs.filter(tab => tab.parent === parentKey);
  }, [mergedXeroSubTabs]);

  // Check if current xeroSubTab belongs to a parent group
  const currentXeroParent = React.useMemo(() => {
    const currentTab = mergedXeroSubTabs.find(t => t.id === xeroSubTab);
    // If tab has a parent, return that parent
    if (currentTab?.parent) return currentTab.parent;
    // If tab IS a parent (is_parent=true), return itself
    const level1Tab = xeroLevel1Tabs.find(t => t.id === xeroSubTab);
    if (level1Tab?.is_parent) return xeroSubTab;
    return null;
  }, [xeroSubTab, mergedXeroSubTabs, xeroLevel1Tabs]);

  // SSoT: Overview sub-tabs from CorporateEntityTab API only
  // Returns entity-specific tabs (e.g., Company gets Directors/Shareholdings, Charity gets Directors/Members)
  // No fallback - database is SSoT via Admin > System > Entity Configuration
  const computedOverviewTabs = React.useMemo(() => {
    return entityOverviewTabs;
  }, [entityOverviewTabs]);

  React.useEffect(() => {
    loadCompany();
    loadDocumentCounts();
    loadHealthScore();
    // SSoT: Xero tabs now loaded via useXeroEntityTabs hook (Phase 4)
  }, [loadCompany, loadDocumentCounts, loadHealthScore]);

  // Handle tab from URL
  React.useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab) setActiveTab(tab);
  }, [searchParams]);

  // Load contacts linked to this company's Xero tenant when contacts tab is selected
  React.useEffect(() => {
    const loadXeroContacts = async () => {
      const xeroConnection = company?.corporate_company_xero_connection;
      const tenantId = xeroConnection?.xero_tenant_id;
      if (xeroSubTab !== "contacts" || !tenantId) return;

      setXeroContactsLoading(true);
      try {
        // Use contacts API with xero_tenant_id filter
        const response = await api.get<{ success: boolean; contacts: any[] }>(
          `/api/v1/contacts?xero_tenant_id=${tenantId}`
        );
        if (response.success) {
          setXeroContacts(response.contacts || []);
        }
      } catch (error) {
        console.error("Failed to load Xero contacts:", error);
      } finally {
        setXeroContactsLoading(false);
      }
    };
    loadXeroContacts();
  }, [xeroSubTab, company?.corporate_company_xero_connection?.xero_tenant_id]);

  // Load bills when Bills tab is selected
  React.useEffect(() => {
    const loadXeroBills = async () => {
      const tenantId = company?.corporate_company_xero_connection?.xero_tenant_id;
      if (xeroSubTab !== "xero-bills" || !tenantId) return;

      setXeroBillsLoading(true);
      try {
        const response = await api.get<{ success: boolean; data: any[] }>(
          `/api/v1/external_invoices?tenant_id=${tenantId}&type=bill&per_page=200`
        );
        if (response.success) {
          setXeroBills(response.data || []);
        }
      } catch (error) {
        console.error("Failed to load Xero bills:", error);
      } finally {
        setXeroBillsLoading(false);
      }
    };
    loadXeroBills();
  }, [xeroSubTab, company?.corporate_company_xero_connection?.xero_tenant_id]);

  // Load invoices when Invoices tab is selected
  React.useEffect(() => {
    const loadXeroInvoices = async () => {
      const tenantId = company?.corporate_company_xero_connection?.xero_tenant_id;
      if (xeroSubTab !== "xero-invoices" || !tenantId) return;

      setXeroInvoicesLoading(true);
      try {
        const response = await api.get<{ success: boolean; data: any[] }>(
          `/api/v1/external_invoices?tenant_id=${tenantId}&type=sales_invoice&per_page=200`
        );
        if (response.success) {
          setXeroInvoices(response.data || []);
        }
      } catch (error) {
        console.error("Failed to load Xero invoices:", error);
      } finally {
        setXeroInvoicesLoading(false);
      }
    };
    loadXeroInvoices();
  }, [xeroSubTab, company?.corporate_company_xero_connection?.xero_tenant_id]);

  const handleTabChange = (tabId: string) => {
    // Redirect Data tab to data warehouse page with company filter
    if (tabId === "data-main") {
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
    <div className="flex flex-col h-full -mx-4">
      {/* Back Button + Header - wrapped with px-4 for Gold Standard pattern */}
      <div className="px-4 shrink-0">
        <button
          onClick={() => router.push("/corporate")}
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back to Companies
        </button>
      </div>

      {/* Header */}
      <Card className="mb-4 mx-4">
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
              <Button variant="outline" onClick={openEditSheet}>
                <Edit className="h-4 w-4 mr-2" />
                Edit
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Tabs - flex wrap for two rows */}
      {/* SSoT: Main tabs (Overview) from API, document tabs from API */}
      <div className="border-b mb-4 mx-4 shrink-0">
        <div className="flex flex-wrap gap-1 pb-2">
          {/* Main tabs from API (Overview, etc.) - SSoT: tab_group='main' */}
          {entityMainTabs.map((tab) => {
            const Icon = tab.icon ? getIcon(tab.icon) : Building2;
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
          {/* Fallback Overview button if API hasn't loaded main tabs yet */}
          {entityMainTabs.length === 0 && (
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
          )}
          {computedDocumentTabs.map((tab) => {
            const Icon = tab.icon;
            // Map tab id to count key (handle naming differences)
            const countKey = tab.id === "assets-docs" ? "assets-docs" :
                            tab.id === "dividends-docs" ? "dividends-docs" :
                            tab.id === "loans-docs" ? "loans-docs" :
                            tab.id === "minutes-docs" ? "minutes-docs" :
                            tab.id;
            const count = documentCounts[countKey] || 0;
            const showCount = !["documents-main", "data-main", "activity-main"].includes(tab.id);
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
      <Card className="flex-1 mx-4 min-h-0 overflow-hidden">
        <CardContent className="p-4 h-full overflow-auto">
          {activeTab === "overview" && (
            <div className="space-y-6">
              {/* Overview Sub-tabs - SSoT: From CorporateEntityTab API based on entity type */}
              <div className="border-b">
                <nav className="-mb-px flex gap-6">
                  {computedOverviewTabs.map((subTab) => (
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

              {/* Overview Sub-tab Content - Unified for all entity types */}
              {overviewSubTab === "info" && (
                <>
                  <ATOSetupCard company={company} />
                  <InformationTab company={company} />
                </>
              )}
              {overviewSubTab === "corporate" && <CorporateTab company={company} onUpdate={loadCompany} />}
              {overviewSubTab === "bank-accounts" && <BankAccountsTab company={company} companyId={companyId} />}
              {overviewSubTab === "directors" && <DirectorsTab companyId={companyId} />}
              {overviewSubTab === "shareholdings" && <ShareholdingsTab company={company} companyId={companyId} />}
              {overviewSubTab === "consolidation" && <ConsolidationTab company={company} onUpdate={loadCompany} />}
              {overviewSubTab === "members" && <MembersTab company={company} companyId={companyId} />}
              {/* Trust-specific tabs */}
              {overviewSubTab === "trustees" && <TrusteeTab company={company} />}
              {overviewSubTab === "beneficiaries" && <BeneficiariesTab company={company} />}
              {/* Legacy trust tabs (fallback) */}
              {overviewSubTab === "trustee" && <TrusteeTab company={company} />}
              {overviewSubTab === "appointor" && <AppointorTab company={company} />}
              {overviewSubTab === "trust-deed" && <TrustDeedTab />}
              {overviewSubTab === "distributions" && <DistributionsTab />}
              {overviewSubTab === "trusts" && <TrustsTab company={company} onUpdate={loadCompany} />}
              {overviewSubTab === "health" && <HealthTab company={company} onUpdate={loadCompany} />}
            </div>
          )}

          {/* XERO Tab with two-level navigation - SSoT: Built dynamically from API */}
          {activeTab === "xero" && (
            <>
              {/* Level 1: Main Xero tabs (tabs without a parent) - SSoT: ordered by order_position */}
              <div className="flex gap-2 mb-2 border-b flex-wrap">
                {xeroLevel1Tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => {
                      // Always set the tab's own ID first
                      // For parent tabs, this shows the parent component (e.g., "accounts" -> XeroAccountsCard)
                      // The child tabs will be shown in Level 2 navigation
                      setXeroSubTab(tab.id);
                    }}
                    className={cn(
                      "px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
                      (xeroSubTab === tab.id || (tab.is_parent && currentXeroParent === tab.id))
                        ? "border-primary text-primary"
                        : "border-transparent text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {tab.name}
                  </button>
                ))}
              </div>

              {/* Level 2: Sub-tabs for parent groups (dynamically rendered from getXeroChildTabs) */}
              {currentXeroParent && (
                <div className="flex gap-2 mb-4 bg-muted/50 rounded-lg p-1 w-fit">
                  {getXeroChildTabs(currentXeroParent).map((child) => (
                    <button
                      key={child.id}
                      onClick={() => setXeroSubTab(child.id)}
                      className={cn(
                        "px-3 py-1.5 text-sm font-medium rounded-md transition-colors",
                        xeroSubTab === child.id
                          ? "bg-background shadow text-foreground"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {/* Show short name (strip parent prefix if present) */}
                      {child.name.includes('Transactions') ? 'Transactions' :
                       child.name.includes('Statement') ? 'Statement' : child.name}
                    </button>
                  ))}
                </div>
              )}

              {xeroSubTab === "connection" && (
                <div className="space-y-4">
                  <XeroConnectionCard
                    companyId={companyId}
                    companyName={company?.name}
                    onConnectionChange={setXeroConnected}
                  />
                  {/* Setup Wizard - shows after connection to guide first-time setup */}
                  {xeroConnected && (
                    <>
                      <XeroSetupWizard
                        companyId={companyId}
                        companyName={company?.name}
                        onComplete={() => {
                          // Optionally switch to overview tab when setup is complete
                          setXeroSubTab("overview");
                        }}
                      />
                      {/* Document Sync Status - shows PDF sync progress for this company */}
                      <XeroCompanyDocSyncCard companyId={companyId} />
                    </>
                  )}
                </div>
              )}

              {xeroSubTab === "overview" && (
                <XeroOverviewCard companyId={companyId} />
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

              {xeroSubTab === "reports" && (
                <XeroReportsPanel companyId={companyId} />
              )}

              {/* Statement sub-tabs - show P&L PDF reports in table */}
              {xeroSubTab === "profit-loss-statement" && (
                <XeroPLStatementView companyId={companyId} />
              )}

              {/* Transactions sub-tabs - show raw P&L data from Xero */}
              {xeroSubTab === "xero-profit-loss-transactions" && (
                <XeroProfitLossCard companyId={companyId} />
              )}

              {xeroSubTab === "balance-sheet-statement" && (
                <XeroBalanceSheetStatementView companyId={companyId} />
              )}

              {xeroSubTab === "xero-balance-sheet-transactions" && (
                <XeroBalanceSheetCard companyId={companyId} />
              )}

              {xeroSubTab === "xero-bank-statement" && (
                <XeroStatementView companyId={companyId} />
              )}

              {xeroSubTab === "xero-bank-accounts" && (
                <XeroBankAccountsCard companyId={companyId} />
              )}

              {/* Contacts tab - shows contacts linked to this company's Xero tenant */}
              {xeroSubTab === "contacts" && (
                <div className="flex flex-col h-full -mx-4">
                  {xeroContactsLoading ? (
                    <div className="flex items-center justify-center h-48">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : xeroContacts.length === 0 ? (
                    <Card className="mx-4">
                      <CardContent className="p-6">
                        <div className="text-center text-muted-foreground">
                          <p className="font-medium mb-2">No Contacts Linked</p>
                          <p className="text-sm">No contacts are linked to this Xero account yet.</p>
                          <p className="text-sm mt-2">Link contacts to Xero in the Contacts module.</p>
                        </div>
                      </CardContent>
                    </Card>
                  ) : (
                    <div className="px-4">
                      <XeroContactsTable
                        contacts={xeroContacts}
                        onRowClick={(contact) => router.push(`/contacts/${contact.id}`)}
                        onAddContact={() => router.push("/contacts/new")}
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Invoices tab - shows sales invoices for this company */}
              {xeroSubTab === "xero-invoices" && (
                <div className="flex flex-col h-full -mx-4">
                  {xeroInvoicesLoading ? (
                    <div className="flex items-center justify-center h-48">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : xeroInvoices.length === 0 ? (
                    <Card className="mx-4">
                      <CardContent className="p-6">
                        <div className="text-center text-muted-foreground">
                          <p className="font-medium mb-2">No Sales Invoices</p>
                          <p className="text-sm">No sales invoices found for this Xero account.</p>
                        </div>
                      </CardContent>
                    </Card>
                  ) : (
                    <TeeemTableView
                      entries={xeroInvoices}
                      foundationId="external_invoices"
                      foundationIdNumeric={523}
                      tableName="Sales Invoices"
                      onRefresh={async () => {
                        const tenantId = company?.corporate_company_xero_connection?.xero_tenant_id;
                        if (tenantId) {
                          setXeroInvoicesLoading(true);
                          try {
                            const response = await api.get<{ success: boolean; data: any[] }>(
                              `/api/v1/external_invoices?tenant_id=${tenantId}&type=sales_invoice&per_page=200`
                            );
                            if (response.success) {
                              setXeroInvoices(response.data || []);
                            }
                          } finally {
                            setXeroInvoicesLoading(false);
                          }
                        }
                      }}
                      enableExport={true}
                    />
                  )}
                </div>
              )}

              {/* Bills tab - shows bills for this company */}
              {xeroSubTab === "xero-bills" && (
                <div className="flex flex-col h-full -mx-4">
                  {xeroBillsLoading ? (
                    <div className="flex items-center justify-center h-48">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : xeroBills.length === 0 ? (
                    <Card className="mx-4">
                      <CardContent className="p-6">
                        <div className="text-center text-muted-foreground">
                          <p className="font-medium mb-2">No Bills</p>
                          <p className="text-sm">No bills found for this Xero account.</p>
                        </div>
                      </CardContent>
                    </Card>
                  ) : (
                    <TeeemTableView
                      entries={xeroBills}
                      foundationId="external_invoices"
                      foundationIdNumeric={523}
                      tableName="Bills"
                      onRowClick={handleBillSingleClick}
                      onRowDoubleClick={handleBillDoubleClick}
                      onRefresh={async () => {
                        const tenantId = company?.corporate_company_xero_connection?.xero_tenant_id;
                        if (tenantId) {
                          setXeroBillsLoading(true);
                          try {
                            const response = await api.get<{ success: boolean; data: any[] }>(
                              `/api/v1/external_invoices?tenant_id=${tenantId}&type=bill&per_page=200`
                            );
                            if (response.success) {
                              setXeroBills(response.data || []);
                            }
                          } finally {
                            setXeroBillsLoading(false);
                          }
                        }
                      }}
                      enableExport={true}
                    />
                  )}
                </div>
              )}

              {xeroSubTab === "xero-consolidated-accounts" && (
                <XeroConsolidatedCard companyId={companyId} companyName={company?.name} />
              )}

              {/* Group reports - for any company in a group */}
              {xeroSubTab === "xero-consolidated-pl" && (
                <XeroGroupPLCard companyId={companyId} />
              )}

              {xeroSubTab === "xero-consolidated-bs" && (
                <XeroGroupBalanceSheetCard companyId={companyId} />
              )}

              {/* Document folder sub-tabs from API (SSoT) */}
              {xeroSubTab.startsWith('xero-doc-') && (
                <CompanyDocumentsTab
                  companyId={companyId}
                  company={company}
                  category={mergedXeroSubTabs.find(t => t.id === xeroSubTab)?.name || 'XERO'}
                />
              )}
            </>
          )}

          {/* Document Category Tabs */}
          {computedDocumentTabs.find(t => t.id === activeTab)?.name && activeTab !== "activity-main" && activeTab !== "documents-main" && activeTab !== "data-main" && activeTab !== "xero" && (
            <>
              <CompanyDocumentsTab
                companyId={companyId}
                company={company}
                category={computedDocumentTabs.find(t => t.id === activeTab)?.name}
              />
            </>
          )}

          {activeTab === "documents-main" && (
            <CompanyDocumentsTab companyId={companyId} company={company} category="all" />
          )}
          {/* Data tab redirects to /admin/system?tab=data-warehouse&company_id={id} */}
          {activeTab === "activity-main" && <ActivityTab />}
        </CardContent>
      </Card>

      {/* Bill/Invoice Drawer - Single click preview */}
      <Sheet open={isBillDrawerOpen} onOpenChange={setIsBillDrawerOpen}>
        <SheetContent className="w-[500px] sm:w-[600px]">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              {selectedBill?.invoice_number || "Bill Details"}
            </SheetTitle>
            <SheetDescription>
              {selectedBill?.contact_name || "Unknown Contact"}
            </SheetDescription>
          </SheetHeader>
          {selectedBill && (
            <div className="mt-6 space-y-6">
              {/* Status Badge */}
              <div className="flex items-center gap-2">
                <Badge variant={selectedBill.status === "paid" ? "default" : "secondary"}>
                  {selectedBill.status?.toUpperCase()}
                </Badge>
                {selectedBill.contact_id && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => router.push(`/contacts/${selectedBill.contact_id}`)}
                  >
                    View Contact
                  </Button>
                )}
              </div>

              {/* Amount Summary */}
              <Card>
                <CardContent className="pt-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Total</p>
                      <p className="text-2xl font-bold">
                        ${Number(selectedBill.total || 0).toLocaleString("en-AU", { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Amount Due</p>
                      <p className="text-2xl font-bold text-red-600">
                        ${Number(selectedBill.amount_due || 0).toLocaleString("en-AU", { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Details */}
              <div className="space-y-3">
                <div className="flex justify-between py-2 border-b">
                  <span className="text-muted-foreground">Invoice Date</span>
                  <span className="font-medium">
                    {selectedBill.invoice_date ? safeFormatDate(selectedBill.invoice_date, "d MMM yyyy") : "—"}
                  </span>
                </div>
                <div className="flex justify-between py-2 border-b">
                  <span className="text-muted-foreground">Due Date</span>
                  <span className="font-medium">
                    {selectedBill.due_date ? safeFormatDate(selectedBill.due_date, "d MMM yyyy") : "—"}
                  </span>
                </div>
                <div className="flex justify-between py-2 border-b">
                  <span className="text-muted-foreground">Reference</span>
                  <span className="font-medium">{selectedBill.reference || "—"}</span>
                </div>
                <div className="flex justify-between py-2 border-b">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="font-medium">
                    ${Number(selectedBill.subtotal || 0).toLocaleString("en-AU", { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between py-2 border-b">
                  <span className="text-muted-foreground">Tax</span>
                  <span className="font-medium">
                    ${Number(selectedBill.total_tax || 0).toLocaleString("en-AU", { minimumFractionDigits: 2 })}
                  </span>
                </div>
                {selectedBill.fully_paid_date && (
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-muted-foreground">Paid Date</span>
                    <span className="font-medium text-green-600">
                      {safeFormatDate(selectedBill.fully_paid_date, "d MMM yyyy")}
                    </span>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 pt-4">
                {selectedBill.contact_id && (
                  <Button
                    className="flex-1"
                    onClick={() => {
                      setIsBillDrawerOpen(false);
                      router.push(`/contacts/${selectedBill.contact_id}?tab=purchase-orders`);
                    }}
                  >
                    View Purchase Orders
                  </Button>
                )}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Company Edit Sheet */}
      <Sheet open={isEditSheetOpen} onOpenChange={setIsEditSheetOpen}>
        <SheetContent className="w-[500px] sm:w-[600px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Edit Company</SheetTitle>
            <SheetDescription>
              Update company details. Changes will be saved immediately.
            </SheetDescription>
          </SheetHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Company Name</Label>
              <Input
                id="edit-name"
                value={editFormData.name}
                onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-acn">ACN</Label>
                <Input
                  id="edit-acn"
                  value={editFormData.acn}
                  onChange={(e) => setEditFormData({ ...editFormData, acn: e.target.value })}
                  placeholder="000 000 000"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-abn">ABN</Label>
                <Input
                  id="edit-abn"
                  value={editFormData.abn}
                  onChange={(e) => setEditFormData({ ...editFormData, abn: e.target.value })}
                  placeholder="00 000 000 000"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-status">Status</Label>
                <Select
                  value={editFormData.status}
                  onValueChange={(value) => setEditFormData({ ...editFormData, status: value })}
                >
                  <SelectTrigger id="edit-status">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                    <SelectItem value="deregistered">Deregistered</SelectItem>
                    <SelectItem value="struck_off">Struck Off</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-entity-type">Entity Type</Label>
                <Select
                  value={editFormData.entity_type}
                  onValueChange={(value) => setEditFormData({ ...editFormData, entity_type: value })}
                >
                  <SelectTrigger id="edit-entity-type">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Company">Company</SelectItem>
                    <SelectItem value="Trust">Trust</SelectItem>
                    <SelectItem value="Superfund">Superfund</SelectItem>
                    <SelectItem value="Charity">Charity</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-date-incorporated">Date Incorporated</Label>
              <Input
                id="edit-date-incorporated"
                type="date"
                value={editFormData.date_incorporated}
                onChange={(e) => setEditFormData({ ...editFormData, date_incorporated: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-registered-office">Registered Office Address</Label>
              <Textarea
                id="edit-registered-office"
                value={editFormData.registered_office_address}
                onChange={(e) => setEditFormData({ ...editFormData, registered_office_address: e.target.value })}
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-ppob">Principal Place of Business</Label>
              <Textarea
                id="edit-ppob"
                value={editFormData.principal_place_of_business}
                onChange={(e) => setEditFormData({ ...editFormData, principal_place_of_business: e.target.value })}
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-purpose">Purpose</Label>
              <Textarea
                id="edit-purpose"
                value={editFormData.purpose}
                onChange={(e) => setEditFormData({ ...editFormData, purpose: e.target.value })}
                rows={3}
                placeholder="Company purpose or activities..."
              />
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setIsEditSheetOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSaveCompany} disabled={savingEdit}>
                {savingEdit ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Save Changes
                  </>
                )}
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
