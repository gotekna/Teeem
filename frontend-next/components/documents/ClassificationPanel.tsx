"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ComboboxDropdown } from "@/components/ui/combobox-dropdown";
import { Spinner } from "@/components/ui/spinner";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Check,
  Sparkles,
  AlertTriangle,
  Pencil,
  RefreshCw,
  Eye,
  ScanSearch,
  Brain,
  FileText,
  ChevronDown,
  Briefcase,
  Users,
  Building2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { DOCUMENT_FOLDER_OPTIONS } from "@/lib/constants/document-types";
import type {
  ClassificationData,
  ClassificationBreakdown,
  ClassificationDocument,
  ClassificationDocumentType,
  ClassificationCompany,
} from "@/lib/types/classification-types";
import {
  getDocumentTypeRecord,
  getAutoFields,
  parseFinancialYears,
  generateFYOptions,
} from "@/lib/utils/classification-utils";

// ── Constants ──

const DOCUMENT_TYPE_BY_FOLDER: Record<string, { value: string; label: string; abbrev: string }[]> = {
  ATO: [
    { value: "tax_return", label: "Company Tax Return", abbrev: "CTR" },
    { value: "trust_tax_return", label: "Trust Tax Return", abbrev: "TTR" },
    { value: "tax", label: "Tax (General)", abbrev: "TAX" },
    { value: "bas", label: "BAS", abbrev: "BAS" },
    { value: "ias", label: "IAS", abbrev: "IAS" },
    { value: "tfn", label: "Tax File Number", abbrev: "TFN" },
    { value: "ato_correspondence", label: "ATO Correspondence", abbrev: "ATO" },
    { value: "other", label: "Other", abbrev: "OTH" },
  ],
  ASIC: [
    { value: "annual_statement", label: "Annual Statement", abbrev: "AS" },
    { value: "company_extract", label: "Company Extract", abbrev: "CE" },
    { value: "asic_correspondence", label: "ASIC Correspondence", abbrev: "ASIC" },
    { value: "form_484", label: "Form 484", abbrev: "484" },
    { value: "form_492", label: "Form 492", abbrev: "492" },
    { value: "other", label: "Other", abbrev: "OTH" },
  ],
  FINANCIALS: [
    { value: "financial_statement", label: "Financial Statement", abbrev: "FS" },
    { value: "annual_report", label: "Annual Report", abbrev: "AR" },
    { value: "management_accounts", label: "Management Accounts", abbrev: "MA" },
    { value: "trial_balance", label: "Trial Balance", abbrev: "TB" },
    { value: "other", label: "Other", abbrev: "OTH" },
  ],
  MINUTES: [
    { value: "minutes", label: "Minutes", abbrev: "MIN" },
    { value: "resolution", label: "Resolution", abbrev: "RES" },
    { value: "consent", label: "Consent", abbrev: "CON" },
    { value: "other", label: "Other", abbrev: "OTH" },
  ],
  COMPANY: [
    { value: "constitution", label: "Constitution", abbrev: "CON" },
    { value: "shareholder_agreement", label: "Shareholder Agreement", abbrev: "SHA" },
    { value: "share_certificate", label: "Share Certificate", abbrev: "SC" },
    { value: "register", label: "Register", abbrev: "REG" },
    { value: "other", label: "Other", abbrev: "OTH" },
  ],
  LOANS: [
    { value: "loan_agreement", label: "Loan Agreement", abbrev: "LA" },
    { value: "security_deed", label: "Security Deed", abbrev: "SD" },
    { value: "ppsr", label: "PPSR Registration", abbrev: "PPSR" },
    { value: "mortgage", label: "Mortgage", abbrev: "MTG" },
    { value: "guarantee", label: "Guarantee", abbrev: "GTY" },
    { value: "other", label: "Other", abbrev: "OTH" },
  ],
  BANK: [
    { value: "bank_statement", label: "Bank Statement", abbrev: "BS" },
    { value: "bank_letter", label: "Bank Letter", abbrev: "BL" },
    { value: "account_opening", label: "Account Opening", abbrev: "AO" },
    { value: "other", label: "Other", abbrev: "OTH" },
  ],
  INSURANCE: [
    { value: "policy", label: "Policy", abbrev: "POL" },
    { value: "certificate", label: "Certificate of Currency", abbrev: "COC" },
    { value: "renewal", label: "Renewal", abbrev: "REN" },
    { value: "claim", label: "Claim", abbrev: "CLM" },
    { value: "other", label: "Other", abbrev: "OTH" },
  ],
  TRUST: [
    { value: "trust_deed", label: "Trust Deed", abbrev: "TD" },
    { value: "deed_variation", label: "Deed of Variation", abbrev: "DOV" },
    { value: "vesting", label: "Vesting", abbrev: "VST" },
    { value: "distribution", label: "Distribution Resolution", abbrev: "DR" },
    { value: "other", label: "Other", abbrev: "OTH" },
  ],
  ADVICE: [
    { value: "accountant_advice", label: "Accountant Advice", abbrev: "AA" },
    { value: "client_advice", label: "Client Advice", abbrev: "CA" },
    { value: "legal_advice", label: "Legal Advice", abbrev: "LA" },
    { value: "other", label: "Other", abbrev: "OTH" },
  ],
  DIVIDENDS: [
    { value: "dividend_statement", label: "Dividend Statement", abbrev: "DS" },
    { value: "dividend_resolution", label: "Dividend Resolution", abbrev: "DR" },
    { value: "other", label: "Other", abbrev: "OTH" },
  ],
  ASSETS: [
    { value: "valuation", label: "Valuation", abbrev: "VAL" },
    { value: "purchase_contract", label: "Purchase Contract", abbrev: "PC" },
    { value: "sale_contract", label: "Sale Contract", abbrev: "SC" },
    { value: "title", label: "Title", abbrev: "TTL" },
    { value: "other", label: "Other", abbrev: "OTH" },
  ],
  REGISTRY: [
    { value: "share_register", label: "Share Register", abbrev: "SR" },
    { value: "member_register", label: "Member Register", abbrev: "MR" },
    { value: "director_register", label: "Director Register", abbrev: "DR" },
    { value: "other", label: "Other", abbrev: "OTH" },
  ],
  GENERAL: [
    { value: "correspondence", label: "Correspondence", abbrev: "COR" },
    { value: "contract", label: "Contract", abbrev: "CON" },
    { value: "other", label: "Other", abbrev: "OTH" },
  ],
};

const QUARTERLY_PERIODS = [
  { value: "Q1", label: "Q1", subtitle: "Jul-Sep" },
  { value: "Q2", label: "Q2", subtitle: "Oct-Dec" },
  { value: "Q3", label: "Q3", subtitle: "Jan-Mar" },
  { value: "Q4", label: "Q4", subtitle: "Apr-Jun" },
];
const MONTHLY_PERIODS = ["Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar", "Apr", "May", "Jun"];

const FY_OPTIONS = generateFYOptions(10);

// ── Props ──

interface ClassificationPanelProps {
  document: ClassificationDocument;
  classificationData: ClassificationData | null;
  classificationLoading?: boolean;
  documentTypes: ClassificationDocumentType[];
  companies: ClassificationCompany[];
  mode: "review" | "validate";
  aiProcessing?: boolean;
  onValidate?: () => Promise<void>;
  onSave?: (data: {
    title: string;
    companyId: string;
    folder: string;
    documentType: string;
    financialYears: number[];
    description: string;
    refDate: string;
    notes: string;
  }) => Promise<void>;
  onApplyAI?: () => Promise<void>;
  onRerunAI?: () => Promise<void>;
  onRerunOCR?: () => Promise<void>;
  onEditToggle?: (editing: boolean) => void;
  onRoute?: (companyId?: string) => Promise<void>;
  onReclassify?: () => Promise<void>;
  onOpenPdfEditor?: () => void;
}

// ── Helpers (component-local) ──

function getDocumentTypesForFolder(folder: string | undefined, documentTypes: ClassificationDocumentType[]) {
  const normalizedFolder = (folder || "GENERAL").toUpperCase();
  let types: { value: string; label: string; abbrev: string }[] = [];

  if (documentTypes.length > 0) {
    const filtered = documentTypes.filter(dt => {
      const dtFolder = (dt.primary_folder_path || "").toUpperCase();
      return dtFolder === normalizedFolder || dt.name.toUpperCase() === normalizedFolder;
    });
    if (filtered.length > 0) {
      types = filtered.map(dt => ({
        value: dt.name.toLowerCase(),
        label: dt.name,
        abbrev: dt.abbreviation || dt.name.substring(0, 3).toUpperCase()
      }));
    }
  }

  if (types.length === 0) {
    const hardcoded = DOCUMENT_TYPE_BY_FOLDER[normalizedFolder] || DOCUMENT_TYPE_BY_FOLDER.GENERAL;
    types = [...hardcoded];
  }

  if (!types.some(t => t.value === "other")) {
    types.push({ value: "other", label: "Other", abbrev: "OTH" });
  }

  return types;
}

// ── Component ──

export default function ClassificationPanel({
  document,
  classificationData,
  classificationLoading = false,
  documentTypes,
  companies,
  mode,
  aiProcessing = false,
  onValidate,
  onSave,
  onApplyAI,
  onRerunAI,
  onRerunOCR,
  onRoute,
  onReclassify,
  onOpenPdfEditor,
}: ClassificationPanelProps) {
  // ── Internal editing state ──
  const [isEditing, setIsEditing] = React.useState(false);
  const [editedDocumentType, setEditedDocumentType] = React.useState(document.document_type || "");
  const [editedFolder, setEditedFolder] = React.useState(document.folder || "");
  const [editedCompanyId, setEditedCompanyId] = React.useState<string>(
    String(document.company_id || document.company?.id || "")
  );
  const [editedFinancialYears, setEditedFinancialYears] = React.useState<number[]>(
    parseFinancialYears(document.financial_years)
  );
  const [editedDescription, setEditedDescription] = React.useState("");
  const [editedRefDate, setEditedRefDate] = React.useState("");
  const [isAmended, setIsAmended] = React.useState(false);
  const [signedStatus, setSignedStatus] = React.useState<"signed" | "unsigned" | null>(null);
  const [actionNotes, setActionNotes] = React.useState("");

  const [docTypeScopeFilter, setDocTypeScopeFilter] = React.useState<string | null>(null);
  const [validating, setValidating] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [applyingSuggestion, setApplyingSuggestion] = React.useState(false);

  // Collapsible column state
  const [openColumns, setOpenColumns] = React.useState<Set<string>>(
    new Set(["current", "ocr", "ai", "name"])
  );
  const toggleColumn = (col: string) =>
    setOpenColumns(prev => {
      const next = new Set(prev);
      if (next.has(col)) next.delete(col); else next.add(col);
      return next;
    });

  // Re-initialize from document prop when it changes (e.g. AI results arrive)
  React.useEffect(() => {
    if (!isEditing) {
      setEditedDocumentType(document.document_type || "");
      setEditedFolder(document.folder || "");
      setEditedCompanyId(String(document.company_id || document.company?.id || ""));
      setEditedFinancialYears(parseFinancialYears(document.financial_years));
      if (document.ai_extracted_description) setEditedDescription(document.ai_extracted_description);
      if (document.ai_extracted_date) setEditedRefDate(document.ai_extracted_date);
    }
  }, [document.id, document.document_type, document.folder, document.company_id, document.ai_verification_status]);

  // Auto-fill date when Amended is checked
  React.useEffect(() => {
    if (isAmended && !editedRefDate) {
      const today = new Date();
      const yyyy = today.getFullYear();
      const mm = String(today.getMonth() + 1).padStart(2, "0");
      const dd = String(today.getDate()).padStart(2, "0");
      setEditedRefDate(`${yyyy}-${mm}-${dd}`);
    }
  }, [isAmended]);

  // ── Computed ──

  const isProcessing = aiProcessing || document.ai_verification_status === "processing";
  const hasAiResults = !!document.ai_suggested_name || !!classificationData?.ai?.document_type;
  const hasNameResults = !!classificationData?.name_match?.document_type;
  const canAiVerify = !isProcessing;

  const currentCompanyName =
    document.company?.name ||
    companies.find(c => c.id === document.company_id)?.name ||
    "-";

  const isBASDocument = React.useMemo(() => {
    const basTypes = ["bas", "ias"];
    return basTypes.some(t => editedDocumentType.toLowerCase().includes(t));
  }, [editedDocumentType]);

  const selectedCompanyBasFrequency = React.useMemo(() => {
    const company = companies.find(c => String(c.id) === editedCompanyId);
    return company?.bas_frequency || "quarterly";
  }, [editedCompanyId, companies]);

  const needsSignedToggle = React.useMemo(() => {
    const dt = getDocumentTypeRecord(editedDocumentType, documentTypes);
    return false; // Simplified - signed toggle was naming_format based which ClassificationDocumentType doesn't expose
  }, [editedDocumentType, documentTypes]);

  const localGetAutoFields = React.useCallback(
    (docTypeName?: string | null) => getAutoFields(docTypeName, documentTypes),
    [documentTypes]
  );

  const localGetDocTypeRecord = React.useCallback(
    (docTypeName?: string | null) => getDocumentTypeRecord(docTypeName, documentTypes),
    [documentTypes]
  );

  const localGetDocTypesForFolder = React.useCallback(
    (folder?: string) => getDocumentTypesForFolder(folder, documentTypes),
    [documentTypes]
  );

  // ── Handlers ──

  const toggleFinancialYear = (year: number) => {
    setEditedFinancialYears(prev =>
      prev.includes(year) ? prev.filter(y => y !== year) : [year]
    );
  };

  const handleSaveClick = async () => {
    if (!onSave) return;
    setSaving(true);
    try {
      await onSave({
        title: document.display_name || document.file_name || "",
        companyId: editedCompanyId,
        folder: editedFolder,
        documentType: editedDocumentType,
        financialYears: editedFinancialYears,
        description: editedDescription,
        refDate: editedRefDate,
        notes: actionNotes,
      });
      setIsEditing(false);
      setActionNotes("");
    } finally {
      setSaving(false);
    }
  };

  const handleValidateClick = async () => {
    if (!onValidate) return;
    setValidating(true);
    try {
      await onValidate();
    } finally {
      setValidating(false);
    }
  };

  const handleApplyAIClick = async () => {
    if (!onApplyAI) return;
    setApplyingSuggestion(true);
    try {
      await onApplyAI();
    } finally {
      setApplyingSuggestion(false);
    }
  };

  const cancelEditing = () => {
    setIsEditing(false);
    setEditedFolder(document.folder || "");
    setEditedDocumentType(document.document_type || "");
    setEditedCompanyId(String(document.company_id || document.company?.id || ""));
    setEditedFinancialYears(parseFinancialYears(document.financial_years));
    setActionNotes("");
  };

  // ── Render ──

  return (
    <div className="flex h-full overflow-hidden">
      {/* ═══ COLUMN 1: CURRENT (blue) ═══ */}
      <div className={cn("overflow-y-auto border-r flex flex-col transition-all", openColumns.has("current") ? "flex-1 p-2" : "w-10 p-1")}>
        <Collapsible open={openColumns.has("current")} onOpenChange={() => toggleColumn("current")}>
        <CollapsibleTrigger className="flex items-center gap-1.5 mb-2 w-full cursor-pointer">
          <Eye className="h-3 w-3 text-blue-500 dark:text-blue-400 shrink-0" />
          {openColumns.has("current") && <span className="text-[10px] font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wide">Current</span>}
          <ChevronDown className={cn("h-3 w-3 text-muted-foreground ml-auto shrink-0 transition-transform", !openColumns.has("current") && "-rotate-90")} />
        </CollapsibleTrigger>
        <CollapsibleContent>
        <div className="flex items-center gap-1.5 -mt-2 mb-2">
          <div className="flex-1" />
          {!isEditing && (
            <Button
              variant="ghost"
              size="sm"
              className="h-5 px-1.5 ml-auto text-[10px] text-blue-600 dark:text-blue-400"
              onClick={() => setIsEditing(true)}
            >
              <Pencil className="h-2.5 w-2.5 mr-0.5" />Edit
            </Button>
          )}
        </div>

        <div className="space-y-1.5 flex-1">
          {/* Document Type */}
          <div>
            <Label className="text-xs text-muted-foreground">Doc Type</Label>
            {isEditing ? (
              <>
                {/* Scope quick-filter buttons */}
                <div className="flex items-center gap-0.5 mt-0.5 mb-1">
                  {([
                    { scope: "job", label: "Job", icon: Briefcase },
                    { scope: "contacts", label: "Contact", icon: Users },
                    { scope: "company", label: "Corp", icon: Building2 },
                  ] as const).map(({ scope, label, icon: Icon }) => (
                    <Button
                      key={scope}
                      type="button"
                      size="sm"
                      variant={docTypeScopeFilter === scope ? "default" : "outline"}
                      onClick={() => setDocTypeScopeFilter(prev => prev === scope ? null : scope)}
                      className={cn("h-5 px-1.5 text-[9px] gap-0.5", docTypeScopeFilter === scope && "bg-blue-600 hover:bg-blue-700")}
                    >
                      <Icon className="h-2.5 w-2.5" />{label}
                    </Button>
                  ))}
                  {docTypeScopeFilter && (
                    <Button type="button" size="sm" variant="ghost" onClick={() => setDocTypeScopeFilter(null)} className="h-5 px-1 text-[9px] text-muted-foreground">All</Button>
                  )}
                </div>
                {/* Searchable doc type dropdown */}
                <ComboboxDropdown
                  items={documentTypes
                    .filter(dt => !docTypeScopeFilter || dt.scope === docTypeScopeFilter)
                    .map(dt => ({
                      id: dt.name.toLowerCase(),
                      label: `${dt.abbreviation ? `[${dt.abbreviation}] ` : ""}${dt.name}`,
                    }))}
                  selectedItem={editedDocumentType ? {
                    id: editedDocumentType,
                    label: (() => {
                      const dt = documentTypes.find(d => d.name.toLowerCase() === editedDocumentType);
                      return dt ? `${dt.abbreviation ? `[${dt.abbreviation}] ` : ""}${dt.name}` : editedDocumentType;
                    })()
                  } : undefined}
                  onSelect={item => setEditedDocumentType(item.id)}
                  placeholder="Search doc types..."
                  searchInTrigger
                  className="h-7 text-xs"
                />
                <div className="flex items-center gap-2 mt-1">
                  {needsSignedToggle && (
                    <div className="flex items-center gap-0.5 bg-muted rounded px-1 py-0.5">
                      <Button type="button" size="sm" variant={signedStatus === "unsigned" ? "default" : "ghost"} onClick={() => setSignedStatus("unsigned")} className={cn("h-4 px-1.5 text-[9px]", signedStatus === "unsigned" && "bg-orange-500 hover:bg-orange-600")}>US</Button>
                      <Button type="button" size="sm" variant={signedStatus === "signed" ? "default" : "ghost"} onClick={() => setSignedStatus("signed")} className={cn("h-4 px-1.5 text-[9px]", signedStatus === "signed" && "bg-green-500 hover:bg-green-600")}>S</Button>
                    </div>
                  )}
                  <div className="flex items-center gap-1">
                    <Checkbox id="amended" checked={isAmended} onCheckedChange={(checked) => setIsAmended(checked === true)} className="h-3 w-3" />
                    <label htmlFor="amended" className="text-[10px] text-muted-foreground cursor-pointer select-none">Amended</label>
                  </div>
                </div>
              </>
            ) : (
              <div className="mt-0.5 h-7 text-xs border rounded-md px-2 flex items-center bg-blue-50/50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800">
                {document.document_type ? (
                  (() => {
                    const dt = localGetDocTypeRecord(document.document_type);
                    return dt ? (
                      <a href={`/admin/system/document-types/${dt.id}`} target="_blank" className="flex items-center gap-1 hover:underline cursor-pointer truncate" title={`Open ${dt.name} settings`}>
                        <Badge variant="outline" className="font-mono text-[10px] shrink-0">{dt.abbreviation || document.document_type}</Badge>
                        <span className="truncate">{dt.name}</span>
                      </a>
                    ) : <span className="truncate">{document.document_type}</span>;
                  })()
                ) : <span className="text-muted-foreground">-</span>}
              </div>
            )}
          </div>

          {/* Company */}
          <div>
            <Label className="text-xs text-muted-foreground">Company</Label>
            {isEditing ? (
              <ComboboxDropdown
                items={companies.map(c => ({
                  id: String(c.id),
                  label: `${c.code ? `[${c.code}] ` : ""}${c.name}`,
                }))}
                selectedItem={editedCompanyId ? {
                  id: editedCompanyId,
                  label: (() => {
                    const c = companies.find(c => String(c.id) === editedCompanyId);
                    return c ? `${c.code ? `[${c.code}] ` : ""}${c.name}` : "";
                  })()
                } : undefined}
                onSelect={item => setEditedCompanyId(item.id)}
                placeholder="Search..."
                searchInTrigger
                className="mt-0.5 h-7 text-xs"
              />
            ) : (
              <div className="mt-0.5 h-7 text-xs border rounded-md px-2 flex items-center bg-blue-50/50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800 truncate">
                {currentCompanyName}
              </div>
            )}
          </div>

          {/* Folder */}
          <div className={cn(localGetAutoFields(isEditing ? editedDocumentType : document.document_type).folder && !isEditing && "opacity-40")}>
            <Label className="text-xs text-muted-foreground">
              Folder {localGetAutoFields(isEditing ? editedDocumentType : document.document_type).folder && <span className="italic">(auto)</span>}
            </Label>
            {isEditing ? (
              <Select value={editedFolder} onValueChange={setEditedFolder}>
                <SelectTrigger className="mt-0.5 h-7 text-xs">
                  <SelectValue placeholder="Select..." />
                </SelectTrigger>
                <SelectContent>
                  {DOCUMENT_FOLDER_OPTIONS.map(folder => (
                    <SelectItem key={folder} value={folder}>{folder}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <div className="mt-0.5 h-7 text-xs border rounded-md px-2 flex items-center bg-blue-50/50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800" title={document.folder_path}>
                {document.folder || classificationData?.current?.resolved_folder?.toUpperCase() || "GENERAL"}
              </div>
            )}
          </div>

          {/* Description */}
          <div>
            <Label className="text-xs text-muted-foreground">Description</Label>
            {isEditing ? (
              isBASDocument ? (
                <div className="mt-0.5 flex flex-wrap gap-0.5">
                  {selectedCompanyBasFrequency === "monthly" ? (
                    MONTHLY_PERIODS.map(period => (
                      <Button key={period} type="button" size="sm" variant={editedDescription === period ? "default" : "outline"} onClick={() => setEditedDescription(period)} className="h-5 px-1 text-[9px]">{period}</Button>
                    ))
                  ) : (
                    QUARTERLY_PERIODS.map(period => (
                      <Button key={period.value} type="button" size="sm" variant={editedDescription === period.value ? "default" : "outline"} onClick={() => setEditedDescription(period.value)} className="h-auto py-0.5 px-1 text-[9px] flex flex-col items-center">
                        <span>{period.label}</span>
                        <span className="text-[8px] opacity-70">{period.subtitle}</span>
                      </Button>
                    ))
                  )}
                </div>
              ) : (
                <Input value={editedDescription} onChange={e => setEditedDescription(e.target.value)} className="mt-0.5 h-7 text-xs" placeholder="e.g., Q1, Draft..." />
              )
            ) : (
              <div className="mt-0.5 h-7 text-xs border rounded-md px-2 flex items-center bg-blue-50/50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800 truncate">
                {document.ai_extracted_description || "-"}
              </div>
            )}
          </div>

          {/* Financial Year */}
          <div>
            <Label className="text-xs text-muted-foreground">FY</Label>
            {isEditing ? (
              <div className="mt-0.5 flex flex-wrap gap-0.5">
                {FY_OPTIONS.slice(0, 6).map(opt => (
                  <Button key={opt.value} type="button" size="sm" variant={editedFinancialYears.includes(opt.value) ? "default" : "outline"} onClick={() => toggleFinancialYear(opt.value)} className="h-5 px-1 text-[9px]">
                    {opt.label}
                  </Button>
                ))}
              </div>
            ) : (
              <div className="mt-0.5 h-7 text-xs border rounded-md px-2 flex items-center bg-blue-50/50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800">
                {Array.isArray(document.financial_years) && document.financial_years.length > 0
                  ? (document.financial_years as number[]).map(y => `FY${y.toString().slice(-2)}`).join(", ")
                  : "-"}
              </div>
            )}
          </div>

          {/* UI Name */}
          {(() => {
            const isAuto = localGetAutoFields(isEditing ? editedDocumentType : document.document_type).uiName;
            // SSoT: For auto fields, ONLY show the resolved template value (not stale saved value).
            // Show loading placeholder while classification data is being fetched.
            const uiName = isAuto
              ? (classificationData?.current?.resolved_ui_name || (classificationLoading ? null : document.display_name))
              : (document.display_name || classificationData?.current?.resolved_ui_name);
            return (
              <div className={cn(isAuto && "opacity-40")}>
                <Label className="text-xs text-muted-foreground">
                  UI Name {isAuto && <span className="italic">(auto)</span>}
                </Label>
                <div className="mt-0.5 h-7 text-xs border rounded-md px-2 flex items-center bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 truncate">
                  {isAuto && classificationLoading && !classificationData?.current?.resolved_ui_name
                    ? <span className="text-muted-foreground/50 italic">loading...</span>
                    : (uiName || "-")}
                </div>
              </div>
            );
          })()}

          {/* DL Name */}
          {(() => {
            const isAuto = localGetAutoFields(isEditing ? editedDocumentType : document.document_type).dlName;
            // SSoT: For auto fields, ONLY show the resolved template value (not stale saved value).
            const dlName = isAuto
              ? (classificationData?.current?.resolved_dl_name || (classificationLoading ? null : document.download_name))
              : (document.download_name || classificationData?.current?.resolved_dl_name);
            return (
              <div className={cn(isAuto && "opacity-40")}>
                <Label className="text-xs text-muted-foreground">
                  DL Name {isAuto && <span className="italic">(auto)</span>}
                </Label>
                <div className="mt-0.5 h-7 text-xs border rounded-md px-2 flex items-center bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 truncate">
                  {isAuto && classificationLoading && !classificationData?.current?.resolved_dl_name
                    ? <span className="text-muted-foreground/50 italic">loading...</span>
                    : (dlName || "-")}
                </div>
              </div>
            );
          })()}


          {/* Action buttons — min-h keeps all 3 columns' action rows aligned */}
          <div className="pt-1.5 border-t mt-auto space-y-1.5 min-h-[60px]">
            {isEditing ? (
              <>
                <div className="flex items-center gap-1">
                  <Button onClick={handleSaveClick} disabled={saving} size="sm" className="h-6 text-[10px] bg-green-600 hover:bg-green-700">
                    {saving ? <><Spinner size={10} className="mr-0.5" />Saving</> : <><Check className="h-2.5 w-2.5 mr-0.5" />Save</>}
                  </Button>
                  <Button variant="ghost" size="sm" className="h-6 text-[10px]" onClick={cancelEditing}>Cancel</Button>
                </div>
                <Input value={actionNotes} onChange={e => setActionNotes(e.target.value)} className="h-6 text-[10px]" placeholder="Notes (optional)..." />
              </>
            ) : mode === "review" ? (
              <Button onClick={handleValidateClick} disabled={validating} size="sm" className="h-6 text-[10px] w-full bg-green-600 hover:bg-green-700">
                {validating ? <><Spinner size={10} className="mr-0.5" />Validating</> : <><Check className="h-2.5 w-2.5 mr-0.5" />Validate</>}
              </Button>
            ) : mode === "validate" && onRoute ? (
              <Button onClick={() => onRoute(editedCompanyId || undefined)} size="sm" className="h-6 text-[10px] w-full bg-green-600 hover:bg-green-700">
                <Check className="h-2.5 w-2.5 mr-0.5" />Route
              </Button>
            ) : null}
          </div>
        </div>
        </CollapsibleContent>
        </Collapsible>
      </div>

      {/* ═══ COLUMN 2: OCR (amber) ═══ */}
      <div className={cn("overflow-y-auto border-r flex flex-col bg-amber-50/30 dark:bg-amber-900/5 transition-all", openColumns.has("ocr") ? "flex-1 p-2" : "w-10 p-1")}>
        <Collapsible open={openColumns.has("ocr")} onOpenChange={() => toggleColumn("ocr")}>
        <CollapsibleTrigger className="flex items-center gap-1.5 mb-2 w-full cursor-pointer">
          <ScanSearch className="h-3 w-3 text-amber-500 dark:text-amber-400 shrink-0" />
          {openColumns.has("ocr") && <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wide">OCR</span>}
          {openColumns.has("ocr") && classificationData?.ocr?.confidence != null && classificationData.ocr.confidence > 0 && (
            <Badge variant="outline" className={cn(
              "text-[10px] ml-auto px-1",
              classificationData.ocr.confidence >= 80 ? "border-green-500 text-green-600" :
              classificationData.ocr.confidence >= 60 ? "border-yellow-500 text-yellow-600" : "border-red-500 text-red-600"
            )}>{classificationData.ocr.confidence}%</Badge>
          )}
          <ChevronDown className={cn("h-3 w-3 text-muted-foreground shrink-0 transition-transform", !openColumns.has("ocr") && "-rotate-90", openColumns.has("ocr") && classificationData?.ocr?.confidence != null && classificationData.ocr.confidence > 0 ? "" : "ml-auto")} />
        </CollapsibleTrigger>

        <CollapsibleContent>
        {classificationLoading ? (
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
            <Spinner size={20} className="mb-2 text-amber-500" />
            <p className="text-[10px]">Loading...</p>
          </div>
        ) : (
          <div className={cn("space-y-1.5 flex flex-col flex-1", !classificationData?.has_classification && "opacity-40")}>
            {/* Doc Type */}
            {(() => {
              const ocrType = classificationData?.ocr?.document_type;
              const ocrDt = ocrType ? localGetDocTypeRecord(ocrType) : null;
              return (
                <div>
                  <Label className="text-xs text-muted-foreground">Doc Type</Label>
                  <div className={cn(
                    "mt-0.5 h-7 text-xs border rounded-md px-2 flex items-center bg-muted/50 truncate",
                    ocrType
                      ? (ocrType === document.document_type
                        ? "border-green-500 bg-green-50 dark:bg-green-900/20"
                        : "border-red-500 bg-red-50 dark:bg-red-900/20")
                      : ""
                  )}>
                    {ocrDt ? (
                      <a href={`/admin/system/document-types/${ocrDt.id}`} target="_blank" className="flex items-center gap-1 hover:underline cursor-pointer truncate" title={`Open ${ocrDt.name} settings`}>
                        <Badge variant="outline" className="font-mono text-[10px] shrink-0">{ocrDt.abbreviation || ocrType?.substring(0, 3).toUpperCase()}</Badge>
                        <span className="truncate">{ocrDt.name}</span>
                      </a>
                    ) : ocrType ? (
                      <span>{ocrType.replace(/_/g, " ")}</span>
                    ) : "-"}
                  </div>
                </div>
              );
            })()}

            {/* Company */}
            <div>
              <Label className="text-xs text-muted-foreground">Company</Label>
              <div className={cn("mt-0.5 h-7 text-xs border rounded-md px-2 flex items-center bg-muted/50 truncate", !document.company && "text-muted-foreground italic font-mono")}>
                {document.company ? (
                  <span className="truncate">{document.company.code ? `[${document.company.code}]` : ""} {document.company.name}</span>
                ) : "{Company}"}
              </div>
            </div>

            {/* Folder */}
            {(() => {
              const ocrFolder = classificationData?.ocr?.resolved_folder;
              const auto = localGetAutoFields(classificationData?.ocr?.document_type);
              return (
                <div className={cn(auto.folder && "opacity-40")}>
                  <Label className="text-xs text-muted-foreground">Folder {auto.folder && <span className="italic">(auto)</span>}</Label>
                  <div className={cn(
                    "mt-0.5 h-7 text-xs border rounded-md px-2 flex items-center bg-muted/50",
                    ocrFolder
                      ? (ocrFolder.toUpperCase() === (document.folder || "GENERAL").toUpperCase()
                        ? "border-green-500 bg-green-50 dark:bg-green-900/20"
                        : "border-red-500 bg-red-50 dark:bg-red-900/20")
                      : "text-muted-foreground"
                  )}>
                    {ocrFolder ? ocrFolder.toUpperCase() : "-"}
                  </div>
                </div>
              );
            })()}

            {/* Description - OCR doesn't extract */}
            <div>
              <Label className="text-xs text-muted-foreground">Description</Label>
              <div className="mt-0.5 h-7 text-xs border rounded-md px-2 flex items-center bg-muted/50 text-muted-foreground">-</div>
            </div>

            {/* FY - OCR doesn't detect */}
            <div>
              <Label className="text-xs text-muted-foreground">FY</Label>
              <div className="mt-0.5 h-7 text-xs border rounded-md px-2 flex items-center bg-muted/50 text-muted-foreground">-</div>
            </div>

            {/* UI Name */}
            {(() => {
              const ocrUiName = classificationData?.ocr?.resolved_ui_name;
              const auto = localGetAutoFields(classificationData?.ocr?.document_type);
              return (
                <div className={cn(auto.uiName && "opacity-40")}>
                  <Label className="text-xs text-muted-foreground">UI Name {auto.uiName && <span className="italic">(auto)</span>}</Label>
                  <div className={cn(
                    "mt-0.5 h-7 text-xs border rounded-md px-2 flex items-center truncate",
                    ocrUiName
                      ? (ocrUiName === document.display_name
                        ? "border-green-500 bg-green-50 dark:bg-green-900/20"
                        : "border-red-500 bg-red-50 dark:bg-red-900/20")
                      : "bg-muted/50 text-muted-foreground"
                  )}>
                    {ocrUiName || "-"}
                  </div>
                </div>
              );
            })()}

            {/* DL Name */}
            {(() => {
              const ocrDlName = classificationData?.ocr?.resolved_dl_name;
              const auto = localGetAutoFields(classificationData?.ocr?.document_type);
              return (
                <div className={cn(auto.dlName && "opacity-40")}>
                  <Label className="text-xs text-muted-foreground">DL Name {auto.dlName && <span className="italic">(auto)</span>}</Label>
                  <div className={cn(
                    "mt-0.5 h-7 text-xs border rounded-md px-2 flex items-center truncate",
                    ocrDlName
                      ? (ocrDlName === document.download_name
                        ? "border-green-500 bg-green-50 dark:bg-green-900/20"
                        : "border-red-500 bg-red-50 dark:bg-red-900/20")
                      : "bg-muted/50 text-muted-foreground"
                  )}>
                    {ocrDlName || "-"}
                  </div>
                </div>
              );
            })()}

            {/* Re-run OCR — min-h keeps aligned with Validate / Apply AI buttons */}
            {onRerunOCR && (
              <div className="pt-1.5 border-t min-h-[60px]">
                <Button
                  onClick={onRerunOCR}
                  disabled={classificationLoading}
                  variant="outline"
                  size="sm"
                  className="h-6 text-[10px] w-full text-amber-600 dark:text-amber-400 border-amber-300 hover:bg-amber-100"
                >
                  {classificationLoading ? (
                    <><Spinner size={12} className="mr-1" />Re-running</>
                  ) : (
                    <><RefreshCw className="h-3 w-3 mr-1" />Re-run</>
                  )}
                </Button>
              </div>
            )}

            {/* OCR extras */}
            <div className="pt-1 border-t border-amber-200 dark:border-amber-800/50">
              <div>
                <Label className="text-xs text-muted-foreground">Signals</Label>
                <div className="mt-0.5 min-h-[28px] text-xs border rounded-md px-2 py-1 bg-muted/50">
                  {classificationData?.ocr?.signals && classificationData.ocr.signals.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {classificationData.ocr.signals.map((s, i) => (
                        <span key={i}>{s}{i < classificationData.ocr.signals.length - 1 ? "," : ""}</span>
                      ))}
                    </div>
                  ) : "-"}
                </div>
              </div>

              <div className="mt-1.5">
                <Label className="text-xs text-muted-foreground">Text Preview</Label>
                <div className="mt-0.5 text-xs border rounded-md px-2 py-1 bg-muted/50 max-h-20 overflow-y-auto text-muted-foreground leading-tight">
                  {classificationData?.ocr?.text_preview || "-"}
                </div>
              </div>

              <div className="mt-1.5">
                <Label className="text-xs text-muted-foreground">Status</Label>
                <div className="mt-0.5 h-7 text-xs border rounded-md px-2 flex items-center bg-muted/50">
                  {classificationData?.ocr?.status === "completed" ? (
                    <Badge variant="outline" className="text-[10px] border-green-500 text-green-600">completed</Badge>
                  ) : classificationData?.ocr?.status === "not_applicable" ? (
                    <Badge variant="outline" className="text-[10px] border-gray-400 text-gray-500">n/a</Badge>
                  ) : classificationData?.ocr?.status || "-"}
                </div>
              </div>
            </div>
          </div>
        )}
        </CollapsibleContent>
        </Collapsible>
      </div>

      {/* ═══ COLUMN 3: AI (purple) ═══ */}
      <div className={cn(
        "overflow-y-auto border-r flex flex-col transition-all",
        openColumns.has("ai") ? "flex-1 p-2" : "w-10 p-1",
        hasAiResults ? "bg-purple-50/30 dark:bg-purple-900/5" : "bg-muted/20"
      )}>
        <Collapsible open={openColumns.has("ai")} onOpenChange={() => toggleColumn("ai")}>
        <CollapsibleTrigger className="flex items-center gap-1.5 mb-2 w-full cursor-pointer">
          <Brain className={cn("h-3 w-3 shrink-0", hasAiResults ? "text-purple-500 dark:text-purple-400" : "text-muted-foreground/50")} />
          {openColumns.has("ai") && <span className={cn(
            "text-[10px] font-semibold uppercase tracking-wide",
            hasAiResults ? "text-purple-600 dark:text-purple-400" : "text-muted-foreground/50"
          )}>AI</span>}
          {openColumns.has("ai") && (() => {
            const aiConf = classificationData?.ai?.confidence ?? document.ai_confidence_score;
            return aiConf != null && aiConf > 0 ? (
              <Badge variant="outline" className={cn(
                "text-[10px] ml-auto px-1",
                aiConf >= 80 ? "border-green-500 text-green-600 dark:text-green-400" :
                aiConf >= 60 ? "border-yellow-500 text-yellow-600 dark:text-yellow-400" : "border-red-500 text-red-600 dark:text-red-400"
              )}>{aiConf}%</Badge>
            ) : null;
          })()}
          <ChevronDown className={cn("h-3 w-3 text-muted-foreground shrink-0 transition-transform", !openColumns.has("ai") && "-rotate-90", !openColumns.has("ai") && "ml-auto")} />
        </CollapsibleTrigger>

        <CollapsibleContent>
        {isProcessing ? (
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
            <Spinner size={20} className="mb-2 text-purple-500 dark:text-purple-400" />
            <p className="text-[10px]">AI analyzing...</p>
          </div>
        ) : (
          <div className={cn("space-y-1.5", !hasAiResults && "opacity-40")}>
            {/* Doc Type */}
            {(() => {
              const aiType = classificationData?.ai?.document_type || document.ai_suggested_type;
              const aiDt = aiType ? localGetDocTypeRecord(aiType) : null;
              return (
                <div>
                  <Label className="text-xs text-muted-foreground">Doc Type</Label>
                  <div className={cn(
                    "mt-0.5 h-7 text-xs border rounded-md px-2 flex items-center bg-muted/50 truncate",
                    aiType
                      ? (aiType.toLowerCase().replace(/[_\s]/g, "") === (document.document_type || "").toLowerCase().replace(/[_\s]/g, "")
                        ? "border-green-500 bg-green-50 dark:bg-green-900/20"
                        : "border-red-500 bg-red-50 dark:bg-red-900/20")
                      : ""
                  )}>
                    {aiDt ? (
                      <a href={`/admin/system/document-types/${aiDt.id}`} target="_blank" className="flex items-center gap-1 hover:underline cursor-pointer truncate" title={`Open ${aiDt.name} settings`}>
                        <Badge variant="outline" className="font-mono text-[10px] shrink-0">{aiDt.abbreviation || aiType?.substring(0, 3).toUpperCase()}</Badge>
                        <span className="truncate">{aiDt.name}</span>
                      </a>
                    ) : aiType ? (
                      <span>{aiType.replace(/_/g, " ")}</span>
                    ) : "-"}
                  </div>
                </div>
              );
            })()}

            {/* Company */}
            <div>
              <Label className="text-xs text-muted-foreground">Company</Label>
              <div className={cn("mt-0.5 h-7 text-xs border rounded-md px-2 flex items-center bg-muted/50 truncate")}>
                {document.company ? (
                  <span className="truncate">{document.company.code ? `[${document.company.code}]` : ""} {document.company.name}</span>
                ) : "-"}
              </div>
            </div>

            {/* Folder */}
            {(() => {
              const aiFolder = classificationData?.ai?.resolved_folder || document.ai_suggested_folder;
              const auto = localGetAutoFields(classificationData?.ai?.document_type || document.ai_suggested_type);
              return (
                <div className={cn(auto.folder && "opacity-40")}>
                  <Label className="text-xs text-muted-foreground">Folder {auto.folder && <span className="italic">(auto)</span>}</Label>
                  <div className={cn(
                    "mt-0.5 h-7 text-xs border rounded-md px-2 flex items-center bg-muted/50",
                    aiFolder
                      ? (aiFolder.toUpperCase() === (document.folder || "GENERAL").toUpperCase()
                        ? "border-green-500 bg-green-50 dark:bg-green-900/20"
                        : "border-red-500 bg-red-50 dark:bg-red-900/20")
                      : "text-muted-foreground"
                  )}>
                    {aiFolder ? aiFolder.toUpperCase() : "-"}
                  </div>
                </div>
              );
            })()}

            {/* Description */}
            <div>
              <Label className="text-xs text-muted-foreground">Description</Label>
              <div className={cn(
                "mt-0.5 h-7 text-xs border rounded-md px-2 flex items-center bg-muted/50 truncate",
                document.ai_extracted_description ? "border-green-500 bg-green-50 dark:bg-green-900/20" : ""
              )}>
                {document.ai_extracted_description || "-"}
              </div>
            </div>

            {/* FY */}
            <div>
              <Label className="text-xs text-muted-foreground">FY</Label>
              <div className={cn(
                "mt-0.5 h-7 text-xs border rounded-md px-2 flex items-center bg-muted/50",
                document.ai_suggested_fy
                  ? (JSON.stringify(parseFinancialYears(document.ai_suggested_fy)) === JSON.stringify(parseFinancialYears(document.financial_years))
                    ? "border-green-500 bg-green-50 dark:bg-green-900/20"
                    : "border-red-500 bg-red-50 dark:bg-red-900/20")
                  : ""
              )}>
                {document.ai_suggested_fy
                  ? parseFinancialYears(document.ai_suggested_fy).map(y => `FY${y.toString().slice(-2)}`).join(", ")
                  : "-"}
              </div>
            </div>

            {/* UI Name — resolved_ui_name (template-expanded) takes priority over raw AI suggestion */}
            {(() => {
              const aiUiName = classificationData?.ai?.resolved_ui_name || document.ai_suggested_name;
              const auto = localGetAutoFields(classificationData?.ai?.document_type || document.ai_suggested_type);
              return (
                <div className={cn(auto.uiName && "opacity-40")}>
                  <Label className="text-xs text-muted-foreground">UI Name {auto.uiName && <span className="italic">(auto)</span>}</Label>
                  <div className={cn(
                    "mt-0.5 h-7 text-xs border rounded-md px-2 flex items-center truncate",
                    aiUiName
                      ? (aiUiName === document.display_name
                        ? "border-green-500 bg-green-50 dark:bg-green-900/20"
                        : "border-red-500 bg-red-50 dark:bg-red-900/20")
                      : "bg-muted/50 text-muted-foreground"
                  )}>
                    {aiUiName || "-"}
                  </div>
                </div>
              );
            })()}

            {/* DL Name */}
            {(() => {
              const aiDlName = classificationData?.ai?.resolved_dl_name;
              const auto = localGetAutoFields(classificationData?.ai?.document_type || document.ai_suggested_type);
              return (
                <div className={cn(auto.dlName && "opacity-40")}>
                  <Label className="text-xs text-muted-foreground">DL Name {auto.dlName && <span className="italic">(auto)</span>}</Label>
                  <div className={cn(
                    "mt-0.5 h-7 text-xs border rounded-md px-2 flex items-center truncate",
                    aiDlName
                      ? (aiDlName === document.download_name
                        ? "border-green-500 bg-green-50 dark:bg-green-900/20"
                        : "border-red-500 bg-red-50 dark:bg-red-900/20")
                      : "bg-muted/50 text-muted-foreground"
                  )}>
                    {aiDlName || "-"}
                  </div>
                </div>
              );
            })()}

            {/* AI Action buttons — min-h keeps all 3 columns' action rows aligned */}
            {hasAiResults ? (
              <div className="pt-1.5 border-t space-y-1 min-h-[60px]">
                {onApplyAI && (
                  <Button
                    onClick={handleApplyAIClick}
                    disabled={applyingSuggestion}
                    size="sm"
                    className="h-6 text-[10px] w-full bg-purple-600 hover:bg-purple-700"
                  >
                    {applyingSuggestion ? (
                      <><Spinner size={12} className="mr-1" />Applying</>
                    ) : (
                      <><Sparkles className="h-3 w-3 mr-1" />Apply AI</>
                    )}
                  </Button>
                )}
                {onRerunAI && (
                  <Button
                    onClick={onRerunAI}
                    disabled={isProcessing}
                    variant="outline"
                    size="sm"
                    className="h-6 text-[10px] w-full text-purple-600 dark:text-purple-400 border-purple-300 hover:bg-purple-100"
                  >
                    {isProcessing ? (
                      <><Spinner size={12} className="mr-1" />Analyzing</>
                    ) : (
                      <><RefreshCw className="h-3 w-3 mr-1" />Re-run</>
                    )}
                  </Button>
                )}
                {mode === "validate" && onReclassify && (
                  <Button
                    onClick={onReclassify}
                    variant="outline"
                    size="sm"
                    className="h-6 text-[10px] w-full"
                  >
                    <RefreshCw className="h-3 w-3 mr-1" />Re-classify
                  </Button>
                )}
              </div>
            ) : canAiVerify && onRerunAI ? (
              <div className="pt-2 border-t min-h-[60px]">
                <Button
                  onClick={onRerunAI}
                  disabled={isProcessing}
                  variant="outline"
                  size="sm"
                  className="w-full h-7 text-xs text-purple-600 dark:text-purple-400 border-purple-300 hover:bg-purple-100"
                >
                  {isProcessing ? (
                    <><Spinner size={12} className="mr-1" />Analyzing...</>
                  ) : (
                    <><Sparkles className="h-3 w-3 mr-1" />Run AI Analysis</>
                  )}
                </Button>
              </div>
            ) : mode === "validate" && onReclassify ? (
              <div className="pt-2 border-t">
                <Button onClick={onReclassify} variant="outline" size="sm" className="w-full h-7 text-xs">
                  <RefreshCw className="h-3 w-3 mr-1" />Re-classify
                </Button>
              </div>
            ) : null}

            {/* Split Recommendation */}
            {(document as any).ai_contains_multiple_documents && (document as any).ai_split_recommendation && (
              <div className="pt-2 border-t">
                <div className="bg-orange-50 dark:bg-orange-900/20 rounded-md px-2 py-1.5 border border-orange-300 dark:border-orange-700">
                  <p className="text-[10px] text-orange-700 dark:text-orange-300 font-semibold flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    Multiple Documents Detected
                  </p>
                  <div className="mt-1 space-y-1">
                    {((document as any).ai_split_recommendation as Array<{ pages: string; type: string; suggested_name: string }>).map((rec, idx) => (
                      <div key={idx} className="text-[10px] bg-card rounded px-1.5 py-1 border">
                        <p className="font-medium text-orange-800 dark:text-orange-200">Pages {rec.pages}: {rec.type}</p>
                        <p className="text-muted-foreground font-mono truncate">&rarr; {rec.suggested_name}</p>
                      </div>
                    ))}
                  </div>
                  {onOpenPdfEditor && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full mt-2 h-6 text-[10px] text-orange-600 dark:text-orange-400 border-orange-300 hover:bg-orange-100"
                      onClick={onOpenPdfEditor}
                    >
                      <Pencil className="h-3 w-3 mr-1" />Open PDF Editor to Split
                    </Button>
                  )}
                </div>
              </div>
            )}

            {/* AI Reasoning */}
            {((document as any).ai_analysis_notes || (document as any).ai_source_page || (document as any).ai_source_quote) && (
              <div className="pt-1 space-y-1">
                {((document as any).ai_source_page || (document as any).ai_source_quote) && (
                  <div className="bg-blue-50 dark:bg-blue-900/20 rounded-md px-1.5 py-1 border border-blue-200 dark:border-blue-800">
                    {(document as any).ai_source_page && (
                      <p className="text-[10px] text-blue-600 dark:text-blue-400 font-medium">Page {(document as any).ai_source_page}</p>
                    )}
                    {(document as any).ai_source_quote && (
                      <p className="text-[10px] text-blue-700 dark:text-blue-300 italic mt-0.5 line-clamp-2">&ldquo;{(document as any).ai_source_quote}&rdquo;</p>
                    )}
                  </div>
                )}
                {(document as any).ai_analysis_notes && (
                  <div>
                    <Label className="text-xs text-muted-foreground">AI Reasoning</Label>
                    <p className="mt-0.5 text-[10px] text-muted-foreground italic bg-muted/50 rounded-md px-1.5 py-1 max-h-24 overflow-y-auto">
                      {(document as any).ai_analysis_notes}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
        </CollapsibleContent>
        </Collapsible>
      </div>

      {/* ═══ COLUMN 4: NAME (teal) ═══ */}
      <div className={cn(
        "overflow-y-auto flex flex-col transition-all",
        openColumns.has("name") ? "flex-1 p-2" : "w-10 p-1",
        hasNameResults ? "bg-teal-50/30 dark:bg-teal-900/5" : "bg-muted/20"
      )}>
        <Collapsible open={openColumns.has("name")} onOpenChange={() => toggleColumn("name")}>
        <CollapsibleTrigger className="flex items-center gap-1.5 mb-2 w-full cursor-pointer">
          <FileText className={cn("h-3 w-3 shrink-0", hasNameResults ? "text-teal-500 dark:text-teal-400" : "text-muted-foreground/50")} />
          {openColumns.has("name") && <span className={cn(
            "text-[10px] font-semibold uppercase tracking-wide",
            hasNameResults ? "text-teal-600 dark:text-teal-400" : "text-muted-foreground/50"
          )}>Name</span>}
          {openColumns.has("name") && classificationData?.name_match?.confidence != null && classificationData.name_match.confidence > 0 && (
            <Badge variant="outline" className={cn(
              "text-[10px] ml-auto px-1",
              classificationData.name_match.confidence >= 80 ? "border-green-500 text-green-600 dark:text-green-400" :
              classificationData.name_match.confidence >= 60 ? "border-yellow-500 text-yellow-600 dark:text-yellow-400" : "border-red-500 text-red-600 dark:text-red-400"
            )}>{classificationData.name_match.confidence}%</Badge>
          )}
          <ChevronDown className={cn("h-3 w-3 text-muted-foreground shrink-0 transition-transform", !openColumns.has("name") && "-rotate-90", !openColumns.has("name") && "ml-auto")} />
        </CollapsibleTrigger>

        <CollapsibleContent>
        {classificationLoading ? (
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
            <Spinner size={20} className="mb-2 text-teal-500" />
            <p className="text-[10px]">Loading...</p>
          </div>
        ) : (
          <div className={cn("space-y-1.5 flex flex-col flex-1", !hasNameResults && "opacity-40")}>
            {/* Doc Type */}
            {(() => {
              const nameType = classificationData?.name_match?.document_type;
              const nameDt = nameType ? localGetDocTypeRecord(nameType) : null;
              return (
                <div>
                  <Label className="text-xs text-muted-foreground">Doc Type</Label>
                  <div className={cn(
                    "mt-0.5 h-7 text-xs border rounded-md px-2 flex items-center bg-muted/50 truncate",
                    nameType
                      ? (nameType === document.document_type
                        ? "border-green-500 bg-green-50 dark:bg-green-900/20"
                        : "border-red-500 bg-red-50 dark:bg-red-900/20")
                      : ""
                  )}>
                    {nameDt ? (
                      <a href={`/admin/system/document-types/${nameDt.id}`} target="_blank" className="flex items-center gap-1 hover:underline cursor-pointer truncate" title={`Open ${nameDt.name} settings`}>
                        <Badge variant="outline" className="font-mono text-[10px] shrink-0">{nameDt.abbreviation || nameType?.substring(0, 3).toUpperCase()}</Badge>
                        <span className="truncate">{nameDt.name}</span>
                      </a>
                    ) : nameType ? (
                      <span>{nameType.replace(/_/g, " ")}</span>
                    ) : "-"}
                  </div>
                </div>
              );
            })()}

            {/* Company - name match doesn't detect company */}
            <div>
              <Label className="text-xs text-muted-foreground">Company</Label>
              <div className="mt-0.5 h-7 text-xs border rounded-md px-2 flex items-center bg-muted/50 text-muted-foreground">-</div>
            </div>

            {/* Folder */}
            {(() => {
              const nameFolder = classificationData?.name_match?.resolved_folder;
              const auto = localGetAutoFields(classificationData?.name_match?.document_type);
              return (
                <div className={cn(auto.folder && "opacity-40")}>
                  <Label className="text-xs text-muted-foreground">Folder {auto.folder && <span className="italic">(auto)</span>}</Label>
                  <div className={cn(
                    "mt-0.5 h-7 text-xs border rounded-md px-2 flex items-center bg-muted/50",
                    nameFolder
                      ? (nameFolder.toUpperCase() === (document.folder || "GENERAL").toUpperCase()
                        ? "border-green-500 bg-green-50 dark:bg-green-900/20"
                        : "border-red-500 bg-red-50 dark:bg-red-900/20")
                      : "text-muted-foreground"
                  )}>
                    {nameFolder ? nameFolder.toUpperCase() : "-"}
                  </div>
                </div>
              );
            })()}

            {/* Description - name match doesn't extract */}
            <div>
              <Label className="text-xs text-muted-foreground">Description</Label>
              <div className="mt-0.5 h-7 text-xs border rounded-md px-2 flex items-center bg-muted/50 text-muted-foreground">-</div>
            </div>

            {/* FY - name match doesn't detect */}
            <div>
              <Label className="text-xs text-muted-foreground">FY</Label>
              <div className="mt-0.5 h-7 text-xs border rounded-md px-2 flex items-center bg-muted/50 text-muted-foreground">-</div>
            </div>

            {/* UI Name */}
            {(() => {
              const nameUiName = classificationData?.name_match?.resolved_ui_name;
              const auto = localGetAutoFields(classificationData?.name_match?.document_type);
              return (
                <div className={cn(auto.uiName && "opacity-40")}>
                  <Label className="text-xs text-muted-foreground">UI Name {auto.uiName && <span className="italic">(auto)</span>}</Label>
                  <div className={cn(
                    "mt-0.5 h-7 text-xs border rounded-md px-2 flex items-center truncate",
                    nameUiName
                      ? (nameUiName === document.display_name
                        ? "border-green-500 bg-green-50 dark:bg-green-900/20"
                        : "border-red-500 bg-red-50 dark:bg-red-900/20")
                      : "bg-muted/50 text-muted-foreground"
                  )}>
                    {nameUiName || "-"}
                  </div>
                </div>
              );
            })()}

            {/* DL Name */}
            {(() => {
              const nameDlName = classificationData?.name_match?.resolved_dl_name;
              const auto = localGetAutoFields(classificationData?.name_match?.document_type);
              return (
                <div className={cn(auto.dlName && "opacity-40")}>
                  <Label className="text-xs text-muted-foreground">DL Name {auto.dlName && <span className="italic">(auto)</span>}</Label>
                  <div className={cn(
                    "mt-0.5 h-7 text-xs border rounded-md px-2 flex items-center truncate",
                    nameDlName
                      ? (nameDlName === document.download_name
                        ? "border-green-500 bg-green-50 dark:bg-green-900/20"
                        : "border-red-500 bg-red-50 dark:bg-red-900/20")
                      : "bg-muted/50 text-muted-foreground"
                  )}>
                    {nameDlName || "-"}
                  </div>
                </div>
              );
            })()}

            {/* Name match extras */}
            <div className="pt-1 border-t border-teal-200 dark:border-teal-800/50">
              <div>
                <Label className="text-xs text-muted-foreground">Signals</Label>
                <div className="mt-0.5 min-h-[28px] text-xs border rounded-md px-2 py-1 bg-muted/50">
                  {classificationData?.name_match?.signals && classificationData.name_match.signals.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {classificationData.name_match.signals.map((s, i) => (
                        <span key={i}>{s}{i < classificationData.name_match.signals.length - 1 ? "," : ""}</span>
                      ))}
                    </div>
                  ) : "-"}
                </div>
              </div>

              <div className="mt-1.5">
                <Label className="text-xs text-muted-foreground">Status</Label>
                <div className="mt-0.5 h-7 text-xs border rounded-md px-2 flex items-center bg-muted/50">
                  {classificationData?.name_match?.status === "completed" ? (
                    <Badge variant="outline" className="text-[10px] border-green-500 text-green-600">completed</Badge>
                  ) : classificationData?.name_match?.status === "not_applicable" ? (
                    <Badge variant="outline" className="text-[10px] border-gray-400 text-gray-500">n/a</Badge>
                  ) : classificationData?.name_match?.status || "-"}
                </div>
              </div>
            </div>
          </div>
        )}
        </CollapsibleContent>
        </Collapsible>
      </div>
    </div>
  );
}
