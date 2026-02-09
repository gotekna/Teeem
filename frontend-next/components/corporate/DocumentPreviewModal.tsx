"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { api, getApiBaseUrl } from "@/lib/api";
import {
  FileText,
  ExternalLink,
  Check,
  Sparkles,
  AlertTriangle,
  Pencil,
  X,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { PDFViewer } from "@/components/ui/pdf-viewer";
import { PDFEditor } from "@/components/ui/pdf-editor";
import { ExcelViewer, ExcelViewerLoading, ExcelViewerError, type ExcelData } from "@/components/ui/excel-viewer";
import { WordViewer, WordViewerLoading, WordViewerError, type WordData } from "@/components/ui/word-viewer";
import { Spinner } from "@/components/ui/spinner";
import { DOCUMENT_FOLDER_OPTIONS } from "@/lib/constants/document-types";
import { useToast } from "@/components/ui/use-toast";
import { formatFileSize } from "@/utils/formatters";

// SSoT: DOCUMENT_FOLDER_OPTIONS imported from @/lib/constants/document-types

// Document type options mapped to folders/tabs
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

// Get document types for a specific folder from hardcoded fallback
const getHardcodedDocumentTypesForFolder = (folder: string | undefined) => {
  const normalizedFolder = (folder || "GENERAL").toUpperCase();
  return DOCUMENT_TYPE_BY_FOLDER[normalizedFolder] || DOCUMENT_TYPE_BY_FOLDER.GENERAL;
};

// Generate financial year options (last 10 years)
const generateFYOptions = () => {
  const currentYear = new Date().getFullYear();
  const options = [];
  for (let i = 0; i < 10; i++) {
    options.push(currentYear - i);
  }
  return options;
};

const FY_OPTIONS = generateFYOptions();

// BAS period options based on reporting frequency
// Australian Financial Year quarters: Q1=Jul-Sep, Q2=Oct-Dec, Q3=Jan-Mar, Q4=Apr-Jun
const QUARTERLY_PERIODS = [
  { value: "Q1", label: "Q1", subtitle: "Jul-Sep" },
  { value: "Q2", label: "Q2", subtitle: "Oct-Dec" },
  { value: "Q3", label: "Q3", subtitle: "Jan-Mar" },
  { value: "Q4", label: "Q4", subtitle: "Apr-Jun" },
];
const MONTHLY_PERIODS = ["Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar", "Apr", "May", "Jun"];

// Helper to parse financial years from various formats
const parseFinancialYears = (fy: number[] | string | undefined): number[] => {
  if (!fy) return [];
  if (Array.isArray(fy)) return fy;
  if (typeof fy === "string") {
    // Parse comma-separated string like "2023, 2024" or "FY23, FY24"
    return fy.split(",").map(s => {
      const cleaned = s.trim().replace(/^FY/i, "");
      const num = parseInt(cleaned, 10);
      // Handle 2-digit years (e.g., 23 -> 2023)
      if (num < 100) return 2000 + num;
      return num;
    }).filter(n => !isNaN(n));
  }
  return [];
};

interface Company {
  id: number;
  name: string;
  code?: string;
  bas_frequency?: "quarterly" | "monthly";
}

interface DocumentTypeOption {
  id: number;
  name: string;
  abbreviation?: string;
  naming_format?: string;
  folder?: string;
  tabs?: string[];
  primary_tab?: string;
  category?: string;
}

interface Asset {
  id: number;
  name?: string;
  description?: string;
  abbreviation?: string;
  display_name?: string;
}

interface CompanyDocument {
  id: number | string;
  file_name?: string;
  display_name?: string;
  file_url?: string;
  file_size?: number;
  folder?: string;
  document_type?: string;
  financial_years?: number[] | string;
  ref_date?: string;
  filed_date?: string;
  source?: string;
  company_id?: number;
  company?: Company;
  asset_id?: number;
  asset?: Asset;
  storage_item_id?: string;
  storage_file_id?: string;
  user_validated_at?: string;
  user_validated_by_id?: number;
  ai_verification_status?: "pending" | "processing" | "verified" | "mismatch" | "error" | string;
  ai_suggested_name?: string;
  ai_suggested_folder?: string;
  ai_suggested_type?: string;
  ai_suggested_fy?: number[] | string;
  ai_confidence_score?: number;
  ai_analysis_notes?: string;
  ai_extracted_description?: string;
  ai_extracted_date?: string;
  ai_source_page?: number;
  ai_source_quote?: string;
  ai_contains_multiple_documents?: boolean;
  ai_split_recommendation?: Array<{
    pages: string;
    type: string;
    suggested_name: string;
  }>;
}

interface DocumentPreviewModalProps {
  document: CompanyDocument;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDocumentUpdate?: () => Promise<void>;
  companies?: Company[];
}

export default function DocumentPreviewModal({
  document: initialDocument,
  open,
  onOpenChange,
  onDocumentUpdate,
  companies = [],
}: DocumentPreviewModalProps) {
  const { toast } = useToast();
  const [document, setDocument] = React.useState<CompanyDocument>(initialDocument);
  const [validating, setValidating] = React.useState(false);
  const [validated, setValidated] = React.useState(initialDocument?.user_validated_at != null);
  const [aiVerifying, setAiVerifying] = React.useState(false);
  const [applyingSuggestion, setApplyingSuggestion] = React.useState(false);

  // Editing states
  const [isEditing, setIsEditing] = React.useState(false);
  const [editedTitle, setEditedTitle] = React.useState(initialDocument?.file_name || "");
  const [editedCompanyId, setEditedCompanyId] = React.useState<string>(
    String(initialDocument?.company_id || initialDocument?.company?.id || "")
  );
  const [editedFolder, setEditedFolder] = React.useState(initialDocument?.folder || "");
  const [editedDocumentType, setEditedDocumentType] = React.useState(initialDocument?.document_type || "");
  const [editedFinancialYears, setEditedFinancialYears] = React.useState<number[]>(
    parseFinancialYears(initialDocument?.financial_years)
  );
  const [editedDescription, setEditedDescription] = React.useState("");
  const [editedRefDate, setEditedRefDate] = React.useState("");
  const [editedFiledDate, setEditedFiledDate] = React.useState("");
  const [isAmended, setIsAmended] = React.useState(false);
  const [signedStatus, setSignedStatus] = React.useState<'signed' | 'unsigned' | null>(null);
  const [actionNotes, setActionNotes] = React.useState("");
  const [amendedNumber, setAmendedNumber] = React.useState<number | null>(null);
  const [existingAmendedDocs, setExistingAmendedDocs] = React.useState<CompanyDocument[]>([]);
  const [saving, setSaving] = React.useState(false);

  // Document types from database
  const [documentTypes, setDocumentTypes] = React.useState<DocumentTypeOption[]>([]);

  const pollingRef = React.useRef<NodeJS.Timeout | null>(null);
  const titleInputRef = React.useRef<HTMLInputElement>(null);

  // Preview URL state - for OneDrive embedded preview
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = React.useState(false);
  const [previewError, setPreviewError] = React.useState<string | null>(null);

  // Universal Document Reader state - for Excel/Word preview
  const [documentData, setDocumentData] = React.useState<{
    type: string;
    content: ExcelData | WordData | null;
    error?: string;
  } | null>(null);
  const [documentDataLoading, setDocumentDataLoading] = React.useState(false);

  // PDF Editor mode
  const [isEditingPdf, setIsEditingPdf] = React.useState(false);

  // Fetch document types from database
  React.useEffect(() => {
    const fetchDocumentTypes = async () => {
      try {
        const response = await api.get<{ success: boolean; data: DocumentTypeOption[] }>("/api/v1/document_types");
        if (response?.success && response.data) {
          setDocumentTypes(response.data);
        }
      } catch (error) {
        console.error("Failed to fetch document types:", error);
      }
    };
    fetchDocumentTypes();
  }, []);

  // Auto-fill date with today when Amended is checked
  React.useEffect(() => {
    if (isAmended && !editedRefDate) {
      // Set to today's date in YYYY-MM-DD format for the date input
      const today = new Date();
      const yyyy = today.getFullYear();
      const mm = String(today.getMonth() + 1).padStart(2, "0");
      const dd = String(today.getDate()).padStart(2, "0");
      setEditedRefDate(`${yyyy}-${mm}-${dd}`);
    }
     
  }, [isAmended]);

  // Check for existing amended documents when amended checkbox is ticked
  React.useEffect(() => {
    const checkExistingAmendedDocs = async () => {
      if (!isAmended || !editedCompanyId || !editedDocumentType) {
        setAmendedNumber(null);
        setExistingAmendedDocs([]);
        return;
      }

      try {
        // Fetch documents for this company with same type that contain "Amended"
        const response = await api.get<{ success: boolean; documents: CompanyDocument[] }>(
          `/api/v1/company_documents?company_id=${editedCompanyId}&document_type=${editedDocumentType}`
        );

        if (response?.success && response.documents) {
          // Filter for amended documents (case-insensitive)
          const amendedDocs = response.documents.filter(doc =>
            doc.file_name?.toLowerCase().includes("amended")
          );

          // Sort by date to determine next number
          const sortedDocs = amendedDocs.sort((a, b) => {
            const dateA = new Date(a.ref_date || a.filed_date || "").getTime();
            const dateB = new Date(b.ref_date || b.filed_date || "").getTime();
            return dateA - dateB;
          });

          setExistingAmendedDocs(sortedDocs);

          // Calculate next amended number
          if (sortedDocs.length === 0) {
            setAmendedNumber(null); // First amended, no number needed
          } else {
            // Find highest existing amended number
            let maxNumber = 0;
            for (const doc of sortedDocs) {
              const match = (doc.file_name || "").match(/Amended\s*(\d+)/i);
              if (match) {
                maxNumber = Math.max(maxNumber, parseInt(match[1], 10));
              } else {
                // If there's an "Amended" without a number, count it as 1
                maxNumber = Math.max(maxNumber, 1);
              }
            }
            setAmendedNumber(maxNumber + 1);
          }
        }
      } catch (error) {
        console.error("Failed to check existing amended docs:", error);
        setAmendedNumber(null);
      }
    };

    checkExistingAmendedDocs();
  }, [isAmended, editedCompanyId, editedDocumentType, editedFinancialYears]);

  // Fetch embeddable preview URL for cloud storage files
  const storageRef = document?.storage_item_id || document?.storage_file_id;

  React.useEffect(() => {
    const fetchPreviewUrl = async () => {
      // Only fetch preview for cloud storage files
      if (!storageRef || !open) {
        setPreviewUrl(null);
        return;
      }

      setPreviewLoading(true);
      setPreviewError(null);

      try {
        const response = await api.get<{
          success: boolean;
          preview_url?: string;
          error?: string;
          fallback_url?: string;
        }>(`/api/v1/company_documents/${document.id}/preview`);

        if (response?.success && response.preview_url) {
          setPreviewUrl(response.preview_url);
        } else {
          setPreviewError(response.error || "Preview not available");
          // Fall back to file_url if available
          setPreviewUrl(null);
        }
      } catch (error: unknown) {
        // Don't log cloud storage credential errors - expected in local dev
        const errorMessage = error instanceof Error ? error.message : String(error);
        if (!errorMessage.includes("OneDrive credentials not available")) {
          console.error("Failed to fetch preview URL:", error);
        }
        setPreviewError("Preview not available");
        setPreviewUrl(null);
      } finally {
        setPreviewLoading(false);
      }
    };

    fetchPreviewUrl();
  }, [document?.id, storageRef, open]);

  // Fetch document data for Excel/Word files using Universal Document Reader
  React.useEffect(() => {
    const fetchDocumentData = async () => {
      // Only fetch for Excel/Word files
      const fType = getFileType(document?.file_name);
      if (!document?.id || !open || (fType !== "excel" && fType !== "word")) {
        setDocumentData(null);
        return;
      }

      setDocumentDataLoading(true);
      setDocumentData(null);

      try {
        const response = await api.get<{
          success: boolean;
          data?: {
            type: string;
            filename: string;
            content: ExcelData | WordData;
          };
          error?: string;
        }>(`/api/v1/documents/${document.id}/preview`);

        if (response?.success && response.data) {
          setDocumentData({
            type: response.data.type,
            content: response.data.content,
          });
        } else {
          setDocumentData({
            type: fType,
            content: null,
            error: response?.error || "Could not load document",
          });
        }
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error("Failed to fetch document data:", error);
        setDocumentData({
          type: fType,
          content: null,
          error: errorMessage,
        });
      } finally {
        setDocumentDataLoading(false);
      }
    };

    fetchDocumentData();
  }, [document?.id, document?.file_name, open]);

  // Get the full document type record from database (includes naming_format)
  const getDocumentTypeRecord = React.useCallback((docTypeName: string) => {
    // Try exact match first
    let record = documentTypes.find(dt => dt.name === docTypeName);
    if (record) return record;

    // Try matching without the abbreviation suffix like "(ASICR)" that AI might add
    const nameWithoutAbbrev = docTypeName.replace(/\s*\([^)]+\)\s*$/, '').trim();
    if (nameWithoutAbbrev !== docTypeName) {
      record = documentTypes.find(dt => dt.name === nameWithoutAbbrev);
      if (record) return record;
    }

    // Try case-insensitive match
    const docTypeNameLower = docTypeName.toLowerCase();
    return documentTypes.find(dt => dt.name.toLowerCase() === docTypeNameLower);
  }, [documentTypes]);

  // Get document types for a specific folder - uses database if available, fallback to hardcoded
  const getDocumentTypesForFolder = React.useCallback((folder: string | undefined) => {
    const normalizedFolder = (folder || "GENERAL").toUpperCase();
    let types: { value: string; label: string; abbrev: string }[] = [];

    // Filter database types by folder or tabs containing this folder
    if (documentTypes.length > 0) {
      const filtered = documentTypes.filter(dt =>
        dt.folder?.toUpperCase() === normalizedFolder ||
        dt.primary_tab?.toUpperCase() === normalizedFolder ||
        dt.tabs?.some(t => t.toUpperCase() === normalizedFolder)
      );

      if (filtered.length > 0) {
        types = filtered.map(dt => ({
          value: dt.name,
          label: dt.name,
          abbrev: dt.abbreviation || dt.name.substring(0, 3).toUpperCase()
        }));
      }
    }

    // Fallback to hardcoded if no database types
    if (types.length === 0) {
      types = [...getHardcodedDocumentTypesForFolder(folder)];
    }

    // Always ensure "Other" is at the end as a catch-all
    if (!types.some(t => t.value === "other")) {
      types.push({ value: "other", label: "Other", abbrev: "OTH" });
    }

    return types;
  }, [documentTypes]);

  // Auto-detect document type from filename by matching abbreviations
  const detectDocumentTypeFromFilename = React.useCallback((filename: string, folder: string) => {
    if (!filename) return null;

    // Uppercase for matching
    const filenameUpper = filename.toUpperCase();

    // Get all possible types for this folder (from both database and hardcoded)
    const folderTypes = getDocumentTypesForFolder(folder);

    // Also include database types that might match
    const allTypes = [
      ...folderTypes,
      ...documentTypes.map(dt => ({
        value: dt.name,
        label: dt.name,
        abbrev: dt.abbreviation || dt.name.substring(0, 3).toUpperCase()
      }))
    ];

    // Remove duplicates by value
    const uniqueTypes = allTypes.filter((type, index, self) =>
      index === self.findIndex(t => t.value === type.value)
    );

    // Common abbreviation mappings that might appear in filenames
    // Maps document type values to possible abbreviations/patterns in filenames
    const abbreviationMappings: Record<string, string[]> = {
      // ATO types
      "tax_return": ["CTR", "TAX RETURN", "COMPANY TAX RETURN"],
      "trust_tax_return": ["TTR", "TRUST TAX RETURN"],
      "bas": ["BAS"],
      "ias": ["IAS"],
      "tfn": ["TFN"],
      "ato_correspondence": ["ATO CORR", "ATO LETTER"],
      // Database ATO document types (by name)
      "ATO Documents": ["ATO", "EOY", "END OF YEAR"],
      "ATO Submission": ["SUBMISSION", "SUBMIT"],
      // ASIC types
      "annual_statement": ["AS", "ANNUAL STATEMENT"],
      "company_extract": ["CE", "COMPANY EXTRACT"],
      "form_484": ["484", "FORM 484"],
      "form_492": ["492", "FORM 492"],
      // Financial types
      "financial_statement": ["FS", "FINANCIAL STATEMENT"],
      "annual_report": ["AR", "ANNUAL REPORT"],
      "management_accounts": ["MA", "MANAGEMENT ACCOUNTS"],
      "trial_balance": ["TB", "TRIAL BALANCE"],
      // Trust types
      "trust_deed": ["TD", "TRUST DEED"],
      "deed_variation": ["DOV", "DEED OF VARIATION"],
      // Loan types
      "loan_agreement": ["LA", "LOAN AGREEMENT"],
      "security_deed": ["SD", "SECURITY DEED"],
      // Other common
      "minutes": ["MIN", "MINUTES"],
      "resolution": ["RES", "RESOLUTION"],
      "constitution": ["CON", "CONSTITUTION"],
    };

    // First, try to match database types by abbreviation in filename
    for (const dt of documentTypes) {
      if (dt.abbreviation) {
        const regex = new RegExp(`\\b${dt.abbreviation}\\b`, "i");
        if (regex.test(filenameUpper)) {
          return dt.name;
        }
      }
    }

    // Then try hardcoded mappings (includes database type names as keys)
    for (const [typeValue, abbrevs] of Object.entries(abbreviationMappings)) {
      for (const abbrev of abbrevs) {
        // Check if abbreviation appears as a word in the filename
        const regex = new RegExp(`\\b${abbrev}\\b`, "i");
        if (regex.test(filenameUpper)) {
          // Check if this is a database type name directly
          const dbType = documentTypes.find(dt => dt.name === typeValue);
          if (dbType) {
            return dbType.name;
          }
          // Otherwise find matching type in available folder options
          const matchingType = uniqueTypes.find(t => t.value === typeValue);
          if (matchingType) {
            return matchingType.value;
          }
        }
      }
    }

    // Finally, check each type's abbreviation directly
    for (const type of uniqueTypes) {
      if (type.abbrev && type.abbrev !== "?" && type.abbrev.length >= 2) {
        const regex = new RegExp(`\\b${type.abbrev}\\b`, "i");
        if (regex.test(filenameUpper)) {
          return type.value;
        }
      }
    }

    return null;
  }, [documentTypes, getDocumentTypesForFolder]);

  // Auto-detect financial year(s) from filename
  const detectFinancialYearsFromFilename = React.useCallback((filename: string): number[] => {
    if (!filename) return [];

    const fyPattern = /FY(\d{2,4})/gi;
    const matches = filename.matchAll(fyPattern);
    const years: number[] = [];

    for (const match of matches) {
      let year = parseInt(match[1], 10);
      // Convert 2-digit to 4-digit year
      if (year < 100) {
        year = 2000 + year;
      }
      if (!years.includes(year)) {
        years.push(year);
      }
    }

    return years.sort((a, b) => b - a); // Sort descending
  }, []);

  // Check if the selected document type needs Description and Date fields
  const needsDescriptionAndDate = React.useMemo(() => {
    if (editedDocumentType === "other") return true;
    const docTypeRecord = getDocumentTypeRecord(editedDocumentType);
    if (docTypeRecord?.naming_format) {
      // Check if naming format contains {Description} or {Date}
      return docTypeRecord.naming_format.includes("{Description}") ||
             docTypeRecord.naming_format.includes("{Date}");
    }
    return false;
  }, [editedDocumentType, getDocumentTypeRecord]);

  // Check if document type uses FY (financial year)
  const needsFinancialYear = React.useMemo(() => {
    if (editedDocumentType === "other") return false;
    const docTypeRecord = getDocumentTypeRecord(editedDocumentType);
    if (docTypeRecord?.naming_format) {
      return docTypeRecord.naming_format.includes("FY{YY}") ||
             docTypeRecord.naming_format.includes("{FY}");
    }
    // Default to true for hardcoded types
    return true;
  }, [editedDocumentType, getDocumentTypeRecord]);

  // Check if document type naming format includes a Details/Asset placeholder
  const needsDetails = React.useMemo(() => {
    if (editedDocumentType === "other") return true; // Other always needs details

    // Document types that commonly need a period/details field
    const typesNeedingDetails = ["bas", "ias"];
    if (typesNeedingDetails.includes(editedDocumentType)) return true;

    const docTypeRecord = getDocumentTypeRecord(editedDocumentType);
    if (docTypeRecord?.naming_format) {
      // Check for common detail placeholders in naming format
      return docTypeRecord.naming_format.includes("{Details}") ||
             docTypeRecord.naming_format.includes("{Asset}") ||
             docTypeRecord.naming_format.includes("{Period}") ||
             docTypeRecord.naming_format.includes("{Quarter}");
    }
    // Default to false for database types without explicit details placeholder
    return false;
  }, [editedDocumentType, getDocumentTypeRecord]);

  // Check if this is a BAS or IAS document type (needs period selector)
  const isBASDocument = React.useMemo(() => {
    const basTypes = ["bas", "ias", "BAS - Business Activity Statement", "IAS - Instalment Activity Statement"];
    return basTypes.some(t =>
      editedDocumentType.toLowerCase() === t.toLowerCase() ||
      editedDocumentType.toLowerCase().includes("bas") ||
      editedDocumentType.toLowerCase().includes("ias")
    );
  }, [editedDocumentType]);

  // Check if this document type needs signed/unsigned toggle (based on naming format)
  const needsSignedToggle = React.useMemo(() => {
    const docTypeRecord = getDocumentTypeRecord(editedDocumentType);
    if (docTypeRecord?.naming_format) {
      // Check if naming format includes {Signed} placeholder
      return docTypeRecord.naming_format.includes("{Signed}");
    }
    return false;
  }, [editedDocumentType, getDocumentTypeRecord]);

  // Set default signed status when document type changes
  React.useEffect(() => {
    if (needsSignedToggle && !signedStatus) {
      // Default to unsigned when toggle becomes needed
      setSignedStatus('unsigned');
    } else if (!needsSignedToggle) {
      setSignedStatus(null);
    }
  }, [needsSignedToggle, signedStatus]);

  // Check if AI suggested type needs Description field
  const aiNeedsDescription = React.useMemo(() => {
    if (!document.ai_suggested_type) return false;

    // Find the document type record for AI suggested type
    const aiDocType = documentTypes.find(t =>
      t.name?.toLowerCase() === document.ai_suggested_type?.toLowerCase() ||
      t.abbreviation?.toLowerCase() === document.ai_suggested_type?.toLowerCase()
    );

    if (aiDocType?.naming_format) {
      return aiDocType.naming_format.includes("{Description}") ||
             aiDocType.naming_format.includes("{Details}") ||
             aiDocType.naming_format.includes("{Period}") ||
             aiDocType.naming_format.includes("{Asset}");
    }

    // For hardcoded types, CTR/TTR don't need description
    const noDescriptionTypes = ["ctr", "ttr", "company tax return", "trust tax return"];
    const suggestedLower = document.ai_suggested_type.toLowerCase();
    if (noDescriptionTypes.some(t => suggestedLower.includes(t))) {
      return false;
    }

    return true; // Default to showing for unknown types
  }, [document.ai_suggested_type, documentTypes]);

  // Check if AI suggested type needs FY field
  const aiNeedsFinancialYear = React.useMemo(() => {
    if (!document.ai_suggested_type) return true; // Default to showing FY

    const aiDocType = documentTypes.find(t =>
      t.name?.toLowerCase() === document.ai_suggested_type?.toLowerCase() ||
      t.abbreviation?.toLowerCase() === document.ai_suggested_type?.toLowerCase()
    );

    if (aiDocType?.naming_format) {
      return aiDocType.naming_format.includes("FY{YY}") ||
             aiDocType.naming_format.includes("{FY}");
    }

    return true; // Default to showing FY
  }, [document.ai_suggested_type, documentTypes]);

  // Get the selected company's BAS frequency
  const selectedCompanyBasFrequency = React.useMemo(() => {
    const company = companies.find(c => String(c.id) === editedCompanyId);
    return company?.bas_frequency || "quarterly"; // Default to quarterly
  }, [editedCompanyId, companies]);

  // Update state when initialDocument changes - also auto-detect from filename
  React.useEffect(() => {
    setDocument(initialDocument);
    setValidated(initialDocument?.user_validated_at != null);
    setEditedTitle(initialDocument?.file_name || "");
    setEditedCompanyId(String(initialDocument?.company_id || initialDocument?.company?.id || ""));
    setEditedFolder(initialDocument?.folder || "");

    // Auto-detect document type from filename if not already set or if current type is unknown
    const currentDocType = initialDocument?.document_type || "";
    const filename = initialDocument?.file_name || "";
    const folder = initialDocument?.folder || "";

    // Check if current doc type exists in available options
    const folderTypes = getDocumentTypesForFolder(folder);
    const currentTypeExists = folderTypes.some(t => t.value === currentDocType);

    if (!currentDocType || !currentTypeExists) {
      // Try to detect from filename
      const detectedType = detectDocumentTypeFromFilename(filename, folder);
      if (detectedType) {
        setEditedDocumentType(detectedType);
      } else {
        setEditedDocumentType(currentDocType);
      }
    } else {
      setEditedDocumentType(currentDocType);
    }

    // Auto-detect financial years from filename if not already set
    const existingFYs = parseFinancialYears(initialDocument?.financial_years);
    if (existingFYs.length === 0) {
      const detectedFYs = detectFinancialYearsFromFilename(filename);
      if (detectedFYs.length > 0) {
        setEditedFinancialYears(detectedFYs);
      } else {
        setEditedFinancialYears([]);
      }
    } else {
      setEditedFinancialYears(existingFYs);
    }
  }, [initialDocument, detectDocumentTypeFromFilename, detectFinancialYearsFromFilename, getDocumentTypesForFolder]);

  // Determine file type for preview
  const getFileType = (filename?: string) => {
    if (!filename) return "unknown";
    const ext = filename.split(".").pop()?.toLowerCase();
    if (ext === "pdf") return "pdf";
    if (["png", "jpg", "jpeg", "gif", "webp"].includes(ext || "")) return "image";
    if (["doc", "docx"].includes(ext || "")) return "word";
    if (["xls", "xlsx"].includes(ext || "")) return "excel";
    return "unknown";
  };

  const fileType = getFileType(document?.file_name);

  // Poll for AI verification results
  React.useEffect(() => {
    if (document?.ai_verification_status === "processing") {
      pollingRef.current = setInterval(async () => {
        try {
          const response = await api.get<{ document: CompanyDocument }>(
            `/api/v1/company_documents/${document.id}`
          );
          if (response?.document) {
            setDocument(response.document);
            // Stop polling when status changes from processing
            if (response?.document.ai_verification_status !== "processing") {
              if (pollingRef.current) clearInterval(pollingRef.current);
              setAiVerifying(false);

              // Refresh parent list to update AI status in table
              if (onDocumentUpdate) {
                onDocumentUpdate();
              }

              // Auto-fill ALL fields from AI when results arrive
              const doc = response.document;

              // Auto-select company (document already has company_id)
              if (doc.company_id && !editedCompanyId) {
                setEditedCompanyId(String(doc.company_id));
              }
              // Auto-select folder from AI suggestion
              if (doc.ai_suggested_folder) {
                setEditedFolder(doc.ai_suggested_folder);
              }
              // Auto-select document type from AI suggestion
              if (doc.ai_suggested_type) {
                setEditedDocumentType(doc.ai_suggested_type);
              }
              // Auto-fill description from AI extraction
              if (doc.ai_extracted_description) {
                setEditedDescription(doc.ai_extracted_description);
              }
              // Auto-select financial years from AI suggestion
              if (doc.ai_suggested_fy) {
                setEditedFinancialYears(parseFinancialYears(doc.ai_suggested_fy));
              }
              // Auto-fill date from AI extraction
              if (doc.ai_extracted_date) {
                setEditedRefDate(doc.ai_extracted_date);
              }
            }
          }
        } catch (error) {
          console.error("Failed to poll document status:", error);
        }
      }, 2000);
    }

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
     
  }, [document?.id, document?.ai_verification_status, editedCompanyId, editedDescription, editedRefDate, editedDocumentType, editedFolder, editedFinancialYears]);

  // Focus title input when editing starts
  React.useEffect(() => {
    if (isEditing && titleInputRef.current) {
      titleInputRef.current.focus();
      titleInputRef.current.select();
    }
  }, [isEditing]);

  // Format date for filename (DD-MM-YYYY)
  const formatDateForFilename = (dateStr: string) => {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    const day = date.getDate().toString().padStart(2, "0");
    const month = (date.getMonth() + 1).toString().padStart(2, "0");
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
  };

  // Build amended suffix for filename
  const getAmendedSuffix = React.useCallback(() => {
    if (!isAmended) return "";
    // Use the edited date from the date picker, or today if not set
    const dateStr = editedRefDate
      ? formatDateForFilename(editedRefDate)
      : formatDateForFilename(new Date().toISOString());
    if (amendedNumber !== null && amendedNumber > 1) {
      return ` Amended ${amendedNumber} ${dateStr}`;
    }
    return ` Amended ${dateStr}`;
  }, [isAmended, amendedNumber, editedRefDate]);

  // Auto-fill document name when selections change - follows naming_format template order
  React.useEffect(() => {
    const companyCode = companies.find(c => String(c.id) === editedCompanyId)?.code || "";
    const docTypeRecord = getDocumentTypeRecord(editedDocumentType);
    const baseAbbrev = docTypeRecord?.abbreviation ||
      getDocumentTypesForFolder(editedFolder).find(t => t.value === editedDocumentType)?.abbrev || "";
    // Signed/unsigned prefix for {Signed} placeholder (S or US, empty if not selected)
    const signedPrefix = signedStatus === 'signed' ? 'S ' : signedStatus === 'unsigned' ? 'US ' : '';
    const namingFormat = docTypeRecord?.naming_format;
    const amendedSuffix = getAmendedSuffix();

    // If we have a naming format from the database, use it as template
    // Only require companyCode - abbreviation is optional since some formats don't use it
    if (namingFormat && companyCode) {
      let newName = namingFormat;

      // Replace placeholders in the exact order they appear in the format
      newName = newName.replace("{CompanyCode}", companyCode);
      // Handle {Signed} placeholder - only add prefix if selected, remove placeholder if not
      if (signedStatus) {
        newName = newName.replace("{Signed}", signedPrefix);
      } else {
        newName = newName.replace("{Signed}", "");
      }
      newName = newName.replace("{Abbreviation}", baseAbbrev);
      newName = newName.replace("{Type}", baseAbbrev);

      // Handle Period/Details/Description/Quarter placeholders
      if (editedDescription) {
        newName = newName.replace("{Period}", editedDescription);
        newName = newName.replace("{Details}", editedDescription);
        newName = newName.replace("{Description}", editedDescription);
        newName = newName.replace("{Quarter}", editedDescription);
        newName = newName.replace("{Asset}", editedDescription);
      } else {
        // Remove unfilled placeholders (but keep the rest of the format)
        newName = newName.replace(/\{Period\}\s*/g, "");
        newName = newName.replace(/\{Details\}\s*/g, "");
        newName = newName.replace(/\{Description\}\s*/g, "");
        newName = newName.replace(/\{Quarter\}\s*/g, "");
        newName = newName.replace(/\{Asset\}\s*/g, "");
      }

      // Handle Financial Year placeholder
      const fyPart = editedFinancialYears.length > 0
        ? editedFinancialYears.map(y => `FY${y.toString().slice(-2)}`).join(" ")
        : "";
      if (fyPart) {
        newName = newName.replace("FY{YY}", fyPart);
        newName = newName.replace("{FY}", fyPart);
      } else {
        newName = newName.replace(/FY\{YY\}\s*/g, "");
        newName = newName.replace(/\{FY\}\s*/g, "");
      }

      // Handle Date placeholder (only if not amended - amended has its own date)
      if (editedRefDate && !isAmended) {
        newName = newName.replace("{Date}", formatDateForFilename(editedRefDate));
      } else {
        newName = newName.replace(/\{Date\}\s*/g, "");
      }

      // Clean up multiple spaces and trim
      newName = newName.replace(/\s+/g, " ").trim();

      // Add amended suffix at the end
      if (amendedSuffix) {
        newName = newName + amendedSuffix;
      }

      if (newName && newName !== companyCode) {
        setEditedTitle(newName);
      }
      return;
    }

    // Fallback for hardcoded types or "other" - use generic format
    const usesDescriptionDate = editedDocumentType === "other";
    // For fallback, include signed prefix in abbrev
    const fallbackAbbrev = signedPrefix + baseAbbrev;

    if (usesDescriptionDate) {
      // Format: {CompanyCode} {Abbrev} {Description} {Date}
      if (companyCode && fallbackAbbrev && editedDescription) {
        let newName = `${companyCode} ${fallbackAbbrev} ${editedDescription}`;
        if (editedRefDate && !isAmended) {
          newName += ` ${formatDateForFilename(editedRefDate)}`;
        }
        newName += amendedSuffix;
        setEditedTitle(newName.trim());
      }
      return;
    }

    // Standard document type format with FY (for hardcoded types)
    const fyPart = editedFinancialYears.length > 0
      ? editedFinancialYears.map(y => `FY${y.toString().slice(-2)}`).join(" ")
      : "";
    const descPart = editedDescription ? ` ${editedDescription}` : "";

    // Only auto-fill if we have the required fields
    if (companyCode && fallbackAbbrev && fyPart) {
      const newName = `${companyCode} ${fallbackAbbrev} ${fyPart}${descPart}${amendedSuffix}`.trim();
      setEditedTitle(newName);
    }
  }, [editedCompanyId, editedDocumentType, editedFinancialYears, editedDescription, editedRefDate, editedFolder, companies, getDocumentTypesForFolder, getDocumentTypeRecord, isAmended, getAmendedSuffix, signedStatus]);

  // Handle user validation
  const handleValidate = async () => {
    try {
      setValidating(true);
      await api.post(`/api/v1/company_documents/${document.id}/validate`);
      setValidated(true);
      if (onDocumentUpdate) {
        await onDocumentUpdate();
      }
    } catch (error) {
      console.error("Failed to validate document:", error);
      toast({ title: "Error", description: "Failed to validate document", variant: "destructive" });
    } finally {
      setValidating(false);
    }
  };

  // Handle AI verification
  const handleAiVerify = async () => {
    try {
      setAiVerifying(true);
      const response = await api.post<{ success: boolean }>(
        `/api/v1/company_documents/${document.id}/ai_verify`
      );
      if (response?.success) {
        // Update document status to processing
        setDocument((prev) => ({ ...prev, ai_verification_status: "processing" }));
      }
    } catch (error: unknown) {
      console.error("Failed to start AI verification:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to start AI verification";
      toast({ title: "Error", description: errorMessage, variant: "destructive" });
      setAiVerifying(false);
    }
  };

  // Sanitize filename for OneDrive - remove characters not allowed by Microsoft
  // Invalid characters: " * : < > ? / \ |
  const sanitizeFilename = (filename: string): string => {
    if (!filename) return '';
    // Remove invalid characters
    let sanitized = filename.replace(/["*:<>?/\\|]/g, '');
    // Replace multiple spaces with single space
    sanitized = sanitized.replace(/\s+/g, ' ');
    // Remove leading/trailing spaces and periods
    sanitized = sanitized.trim().replace(/^\.+|\.+$/g, '');
    return sanitized || 'Untitled';
  };

  // Save all changes - uses relocate endpoint to move file in OneDrive
  const handleSave = async () => {
    try {
      setSaving(true);

      // Sanitize the title before sending to prevent OneDrive API errors
      const sanitizedTitle = sanitizeFilename(editedTitle);

      // Use relocate endpoint which moves/renames in OneDrive
      const response = await api.post<{ success: boolean; document: CompanyDocument }>(
        `/api/v1/company_documents/${document.id}/relocate`,
        {
          relocate: {
            title: sanitizedTitle,
            company_id: editedCompanyId || null,
            folder: editedFolder || null,
            document_type: editedDocumentType || null,
            financial_years: editedFinancialYears,
            ref_date: editedRefDate || null,
            filed_date: editedFiledDate || null,
            notes: actionNotes.trim() || null,
          },
        }
      );

      if (response?.success) {
        // Record feedback if there was an AI suggestion (user modified it)
        if (document.ai_suggested_name) {
          try {
            await api.post(`/api/v1/company_documents/${document.id}/feedback`, {
              feedback: {
                action: "modified",
                final_name: sanitizedTitle,
                final_folder: editedFolder,
                final_fy: editedFinancialYears.join(","),
              },
            });
          } catch {
            // Feedback recording is non-critical
            console.error("Failed to record feedback");
          }
        }

        if (response?.document) {
          setDocument(response.document);
        }
        setIsEditing(false);

        // Refresh parent list
        if (onDocumentUpdate) {
          await onDocumentUpdate();
        }
      }
    } catch (error: unknown) {
      console.error("Failed to save document:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to save document";
      toast({ title: "Error", description: errorMessage, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  // Handle applying AI suggestion
  const handleApplySuggestion = async () => {
    try {
      setApplyingSuggestion(true);
      const response = await api.post<{ success: boolean; document: CompanyDocument }>(
        `/api/v1/company_documents/${document.id}/apply_ai_suggestion`
      );
      if (response?.success && response.document) {
        setDocument(response.document);
        setValidated(true);

        // Record feedback that user accepted suggestion
        try {
          await api.post(`/api/v1/company_documents/${document.id}/feedback`, {
            feedback: {
              action: "accepted",
              final_name: response.document.file_name,
              final_folder: response.document.folder,
            },
          });
        } catch {
          // Feedback is optional, don't fail if it errors
        }

        if (onDocumentUpdate) {
          await onDocumentUpdate();
        }
      }
    } catch (error: unknown) {
      console.error("Failed to apply suggestion:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to apply suggestion";
      toast({ title: "Error", description: errorMessage, variant: "destructive" });
    } finally {
      setApplyingSuggestion(false);
    }
  };

  // Handle financial year checkbox toggle
  const toggleFinancialYear = (year: number) => {
    setEditedFinancialYears((prev) => {
      if (prev.includes(year)) {
        // Clicking same year deselects it
        return prev.filter((y) => y !== year);
      } else {
        // Single selection - replace previous
        return [year];
      }
    });
  };

  // Check if document has cloud storage file for AI verification
  const canAiVerify = storageRef && !validated;

  // AI verification status
  const aiStatus = document?.ai_verification_status;
  const isProcessing = aiStatus === "processing" || aiVerifying;

  // Get current company name
  const currentCompanyName =
    document?.company?.name ||
    companies.find((c) => c.id === document?.company_id)?.name ||
    "-";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="!max-w-[100vw] !w-[100vw] !max-h-[calc(100vh-36px)] !h-[calc(100vh-36px)] !top-0 !translate-y-0 !rounded-none overflow-hidden p-0 flex flex-col"
        aria-describedby={undefined}
        hideClose
      >
        {/* Header - compact */}
        <DialogHeader className="px-4 py-2 border-b flex-shrink-0">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <DialogTitle className="truncate text-sm font-medium mb-0 flex-1">
              {document.display_name || document.file_name}
              {isEditingPdf && <span className="ml-2 text-xs text-orange-500 dark:text-orange-400">(Editing)</span>}
            </DialogTitle>
            {/* Edit PDF button - only for PDFs */}
            {fileType === "pdf" && (previewUrl || document.file_url) && (
              <Button
                variant={isEditingPdf ? "default" : "outline"}
                size="sm"
                className="h-6 px-2"
                onClick={() => setIsEditingPdf(!isEditingPdf)}
              >
                <Pencil className="h-3 w-3 mr-1" />
                <span className="text-xs">{isEditingPdf ? "View Mode" : "Edit PDF"}</span>
              </Button>
            )}
            {document.file_url && (
              <Button variant="ghost" size="sm" asChild className="h-6 px-2">
                <a href={document.file_url} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-3 w-3 mr-1" />
                  <span className="text-xs">Open</span>
                </a>
              </Button>
            )}
            <Button variant="ghost" size="sm" className="h-6 px-2" onClick={() => onOpenChange(false)}>
              <X className="h-3 w-3" />
            </Button>
          </div>
        </DialogHeader>

        {/* Main Content Area - Three Panels */}
        <div className="flex flex-1 overflow-hidden min-h-0">
          {/* Left Section - Current Info + Edit + AI (stacked) */}
          <div className="w-1/2 flex flex-col overflow-hidden border-r">
            {/* Top Bar - Current Document Info (read-only) - compact */}
            <div className="px-3 py-2 bg-muted/30 border-b flex-shrink-0">
              <div className="flex items-center gap-2 mb-2">
                <FileText className="h-3 w-3 text-muted-foreground" />
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Current</span>
              </div>
              <div className="grid grid-cols-6 gap-2 text-xs">
                <div>
                  <p className="text-[10px] text-muted-foreground">Company</p>
                  <p className="font-medium truncate text-xs">{currentCompanyName}</p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground">Folder</p>
                  <Badge variant="secondary" className="text-[10px]">{document.folder || "GENERAL"}</Badge>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground">Type</p>
                  {document.document_type ? (
                    <Badge variant="outline" className="font-mono text-[10px]">
                      {getDocumentTypesForFolder(document.folder).find(t => t.value === document.document_type)?.abbrev || "?"}
                    </Badge>
                  ) : <span className="text-muted-foreground">-</span>}
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground">FY</p>
                  <p className="font-medium text-xs">
                    {Array.isArray(document.financial_years) && document.financial_years.length > 0
                      ? document.financial_years.map((y) => `FY${y.toString().slice(-2)}`).join(", ")
                      : <span className="text-muted-foreground">-</span>}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground">Asset</p>
                  {document.asset ? (
                    <Badge variant="secondary" className="text-[10px]">
                      {document.asset.abbreviation || document.asset.display_name || document.asset.name}
                    </Badge>
                  ) : <span className="text-muted-foreground">-</span>}
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground">Size</p>
                  <p className="font-medium text-xs">{formatFileSize(document.file_size)}</p>
                </div>
              </div>
            </div>

            {/* Edit + AI Panels side by side */}
            <div className="flex flex-1 overflow-hidden min-h-0">
              {/* Left Panel - User Editable */}
              <div className="w-1/2 overflow-y-auto border-r p-3">
              <div className="flex items-center gap-2 mb-2">
                <Pencil className="h-3 w-3 text-blue-500 dark:text-blue-400" />
                <span className="text-[10px] font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wide">Edit</span>
              </div>

              <div className="space-y-2">
                {/* Company (searchable) + Folder side by side */}
                <div className="grid grid-cols-2 gap-1">
                  <div>
                    <Label className="text-[10px] text-muted-foreground">Company</Label>
                    <ComboboxDropdown
                      items={companies.map(c => ({
                        id: String(c.id),
                        label: `${c.code ? `[${c.code}] ` : ''}${c.name}`,
                      }))}
                      selectedItem={editedCompanyId ? {
                        id: editedCompanyId,
                        label: (() => {
                          const c = companies.find(c => String(c.id) === editedCompanyId);
                          return c ? `${c.code ? `[${c.code}] ` : ''}${c.name}` : '';
                        })()
                      } : undefined}
                      onSelect={(item) => setEditedCompanyId(item.id)}
                      placeholder="Search..."
                      searchInTrigger
                      className="mt-0.5 h-7 text-xs"
                    />
                  </div>
                  <div>
                    <Label className="text-[10px] text-muted-foreground">Tab/Folder</Label>
                    <Select value={editedFolder} onValueChange={setEditedFolder}>
                      <SelectTrigger className="mt-0.5 h-7 text-xs">
                        <SelectValue placeholder="Select..." />
                      </SelectTrigger>
                      <SelectContent>
                        {DOCUMENT_FOLDER_OPTIONS.map((folder) => (
                          <SelectItem key={folder} value={folder}>{folder}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Document Type + Signed/Unsigned + Amended */}
                <div>
                  <div className="flex items-center justify-between">
                    <Label className="text-[10px] text-muted-foreground">Document Type</Label>
                    <div className="flex items-center gap-2">
                      {/* Signed/Unsigned toggle - required for CTR/TTR, must pick one */}
                      {needsSignedToggle && (
                        <div className="flex items-center gap-0.5 bg-muted rounded px-1 py-0.5">
                          <Button
                            type="button"
                            size="sm"
                            variant={signedStatus === 'unsigned' ? "default" : "ghost"}
                            onClick={() => setSignedStatus('unsigned')}
                            className={cn(
                              "h-4 px-1.5 text-[9px]",
                              signedStatus === 'unsigned' && "bg-orange-500 hover:bg-orange-600"
                            )}
                          >
                            US
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant={signedStatus === 'signed' ? "default" : "ghost"}
                            onClick={() => setSignedStatus('signed')}
                            className={cn(
                              "h-4 px-1.5 text-[9px]",
                              signedStatus === 'signed' && "bg-green-500 hover:bg-green-600"
                            )}
                          >
                            S
                          </Button>
                        </div>
                      )}
                      {/* Amended checkbox */}
                      <div className="flex items-center gap-1">
                        <Checkbox
                          id="amended"
                          checked={isAmended}
                          onCheckedChange={(checked) => setIsAmended(checked === true)}
                          className="h-3 w-3"
                        />
                        <label
                          htmlFor="amended"
                          className="text-[10px] text-muted-foreground cursor-pointer select-none"
                        >
                          Amended
                          {isAmended && amendedNumber !== null && amendedNumber > 1 && (
                            <Badge variant="secondary" className="ml-1 text-[10px] px-1">
                              #{amendedNumber}
                            </Badge>
                          )}
                        </label>
                      </div>
                    </div>
                  </div>
                  <Select value={editedDocumentType} onValueChange={setEditedDocumentType}>
                    <SelectTrigger className="mt-0.5 h-7 text-xs">
                      <SelectValue placeholder="Select type...">
                        {editedDocumentType ? (
                          <span className="flex items-center gap-1">
                            <Badge variant="outline" className="font-mono text-[10px] px-1">
                              {getDocumentTypesForFolder(editedFolder).find(t => t.value === editedDocumentType)?.abbrev || "?"}
                            </Badge>
                            <span className="truncate">{getDocumentTypesForFolder(editedFolder).find(t => t.value === editedDocumentType)?.label || editedDocumentType}</span>
                          </span>
                        ) : "Select..."}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {getDocumentTypesForFolder(editedFolder).map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          <span className="flex items-center gap-1">
                            <Badge variant="outline" className="font-mono text-[10px] px-1">{type.abbrev}</Badge>
                            {type.label}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {editedDocumentType && getDocumentTypeRecord(editedDocumentType)?.naming_format && (
                    <p className="mt-0.5 text-[10px] text-muted-foreground font-mono bg-muted px-1.5 py-0.5 rounded truncate">
                      {getDocumentTypeRecord(editedDocumentType)?.naming_format}
                      {isAmended && " + Amended"}
                    </p>
                  )}
                  {isAmended && existingAmendedDocs.length > 0 && (
                    <p className="mt-0.5 text-[10px] text-orange-600 dark:text-orange-400">
                      {existingAmendedDocs.length} amended doc{existingAmendedDocs.length > 1 ? "s" : ""} found
                    </p>
                  )}
                </div>

                {/* Details/Period field - only show when format requires it */}
                {(needsDescriptionAndDate || needsDetails || isBASDocument) && (
                  <div>
                    <Label className="text-[10px] text-muted-foreground">
                      {needsDescriptionAndDate ? "Description" : isBASDocument ? "Period" : "Details"}
                      {isBASDocument && (
                        <span className="text-muted-foreground/50 ml-1">
                          ({selectedCompanyBasFrequency === "monthly" ? "Mth" : "Qtr"})
                        </span>
                      )}
                    </Label>
                    {isBASDocument ? (
                      <div className="mt-0.5 flex flex-wrap gap-0.5">
                        {selectedCompanyBasFrequency === "monthly" ? (
                          MONTHLY_PERIODS.map((period) => (
                            <Button
                              key={period}
                              type="button"
                              size="sm"
                              variant={editedDescription === period ? "default" : "outline"}
                              onClick={() => setEditedDescription(period)}
                              className="h-5 px-1.5 text-[10px]"
                            >
                              {period}
                            </Button>
                          ))
                        ) : (
                          QUARTERLY_PERIODS.map((period) => (
                            <Button
                              key={period.value}
                              type="button"
                              size="sm"
                              variant={editedDescription === period.value ? "default" : "outline"}
                              onClick={() => setEditedDescription(period.value)}
                              className="h-auto py-0.5 px-1.5 text-[10px] flex flex-col items-center"
                            >
                              <span>{period.label}</span>
                              <span className="text-[8px] opacity-70">{period.subtitle}</span>
                            </Button>
                          ))
                        )}
                      </div>
                    ) : (
                      <Input
                        value={editedDescription}
                        onChange={(e) => setEditedDescription(e.target.value)}
                        className="mt-0.5 h-9 text-sm"
                        placeholder={needsDescriptionAndDate ? "e.g., Notice of Assessment..." : "e.g., Q1, Draft..."}
                      />
                    )}
                  </div>
                )}

                {/* Financial Year - after Period to match format order */}
                {needsFinancialYear && (
                  <div>
                    <Label className="text-[10px] text-muted-foreground">Financial Year</Label>
                    <div className="mt-0.5 flex flex-wrap gap-0.5">
                      {FY_OPTIONS.slice(0, 6).map((year) => (
                        <Button
                          key={year}
                          type="button"
                          size="sm"
                          variant={editedFinancialYears.includes(year) ? "default" : "outline"}
                          onClick={() => toggleFinancialYear(year)}
                          className="h-5 px-1.5 text-[10px]"
                        >
                          FY{year.toString().slice(-2)}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Date field (when format needs it or when Amended is checked) */}
                {(needsDescriptionAndDate || isAmended) && (
                  <div>
                    <Label className="text-[10px] text-muted-foreground">
                      {isAmended ? "Amended Date" : "Date"}
                    </Label>
                    <Input
                      type="date"
                      value={editedRefDate}
                      onChange={(e) => setEditedRefDate(e.target.value)}
                      className="mt-0.5 h-9 text-sm"
                    />
                  </div>
                )}

                {/* New filename - auto-generated from above fields */}
                <div>
                  <Label className="text-[10px] text-muted-foreground">New File Name</Label>
                  <Input
                    value={editedTitle}
                    onChange={(e) => setEditedTitle(e.target.value)}
                    className="mt-0.5 h-10 font-mono text-sm bg-muted/50"
                    placeholder="Auto-generated..."
                  />
                </div>

                {/* Table Title Preview - shows full document type name + dates/FY + Signed/Unsigned + Amended */}
                <div>
                  <Label className="text-[10px] text-muted-foreground">Table Title Preview</Label>
                  <div className="mt-0.5 min-h-[2.5rem] text-xs border rounded-md px-2 py-1 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 line-clamp-2">
                    {(() => {
                      const docTypeRecord = getDocumentTypeRecord(editedDocumentType);
                      const fullTypeName = docTypeRecord?.name || editedDocumentType || "";
                      const fullTypeNameLower = fullTypeName.toLowerCase();

                      // Check if this is a date-range document (statements, etc)
                      const isDateRangeDoc = fullTypeNameLower.includes("statement") ||
                        fullTypeNameLower.includes("summary") ||
                        editedTitle?.includes(" to ");

                      // Extract date range and print date from edited title
                      // Format: "TD Income Tax Statement 01-07-2023 to 01-07-2025 (01-07-2025).pdf"
                      const dateRangeMatch = editedTitle?.match(/(\d{2}-\d{2}-\d{4})\s*to\s*(\d{2}-\d{2}-\d{4})/);
                      const printDateMatch = editedTitle?.match(/\((\d{2}-\d{2}-\d{4})\)/);

                      let datePart = "";
                      if (isDateRangeDoc && dateRangeMatch) {
                        // Use full date range for statement-type documents
                        datePart = `${dateRangeMatch[1]} to ${dateRangeMatch[2]}`;
                        // Add print date if present
                        if (printDateMatch) {
                          datePart += ` (${printDateMatch[1]})`;
                        }
                      } else {
                        // Use FY format for other documents (2-digit)
                        datePart = editedFinancialYears.length > 0
                          ? editedFinancialYears.map(y => `FY${String(y).slice(-2)}`).join(" ")
                          : "";
                      }

                      const signedPart = signedStatus === 'signed' ? 'Signed' : signedStatus === 'unsigned' ? 'Unsigned' : '';
                      const amendedPart = isAmended ? (amendedNumber && amendedNumber > 1 ? `Amended ${amendedNumber}` : 'Amended') : '';
                      const parts = [fullTypeName, datePart, signedPart, amendedPart].filter(Boolean);
                      return parts.length > 0 ? parts.join(" ") : "-";
                    })()}
                  </div>
                </div>

                {/* Validate button - shown when document can be validated */}
                <div className="pt-2 border-t">
                  {validated ? (
                    <div className="flex items-center gap-1.5 text-green-600 dark:text-green-400">
                      <Check className="h-4 w-4" />
                      <span className="text-xs font-medium">Document Validated</span>
                      {document.user_validated_at && (
                        <span className="text-[10px] text-muted-foreground">
                          ({new Date(document.user_validated_at).toLocaleDateString()})
                        </span>
                      )}
                    </div>
                  ) : (
                    <Button
                      onClick={handleValidate}
                      disabled={validating}
                      size="sm"
                      className="h-7 text-xs bg-green-600 hover:bg-green-700"
                    >
                      {validating ? (
                        <><Spinner size={12} className="mr-1" />Validating</>
                      ) : (
                        <><Check className="h-3 w-3 mr-1" />Validate Document</>
                      )}
                    </Button>
                  )}
                </div>

                {/* Save button and action notes */}
                {((editedTitle && editedTitle !== document.file_name) ||
                  (editedFolder && editedFolder !== document.folder) ||
                  (editedDocumentType && editedDocumentType !== document.document_type) ||
                  (editedCompanyId && editedCompanyId !== String(document.company_id || document.company?.id || "")) ||
                  (JSON.stringify(editedFinancialYears) !== JSON.stringify(parseFinancialYears(document.financial_years)))) && (
                  <div className="pt-2 border-t space-y-1.5">
                    <div className="flex items-center gap-1">
                      <Button onClick={handleSave} disabled={saving || !editedTitle.trim()} size="sm" className="h-7 text-xs bg-green-600 hover:bg-green-700">
                        {saving ? <><Spinner size={12} className="mr-1" />Saving</> : <><Check className="h-3 w-3 mr-1" />Apply</>}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => {
                          setEditedTitle(document.file_name || "");
                          setEditedFolder(document.folder || "");
                          setEditedDocumentType(document.document_type || "");
                          setEditedCompanyId(String(document.company_id || document.company?.id || ""));
                          setEditedFinancialYears(parseFinancialYears(document.financial_years));
                          setActionNotes("");
                        }}
                      >
                        Reset
                      </Button>
                    </div>
                    <div>
                      <Label className="text-[10px] text-muted-foreground">Notes (optional)</Label>
                      <Input
                        value={actionNotes}
                        onChange={(e) => setActionNotes(e.target.value)}
                        className="mt-0.5 h-9 text-sm"
                        placeholder="e.g., Renamed per client request..."
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

              {/* Right Panel - AI Suggestion (mirrors Edit panel layout exactly) */}
              <div className={cn(
                "w-1/2 overflow-y-auto p-3",
                document.ai_suggested_name ? "bg-purple-50/50 dark:bg-purple-900/10" : "bg-muted/30"
              )}>
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className={cn("h-3 w-3", document.ai_suggested_name ? "text-purple-500 dark:text-purple-400" : "text-muted-foreground/50")} />
                  <span className={cn(
                    "text-[10px] font-semibold uppercase tracking-wide",
                    document.ai_suggested_name ? "text-purple-600 dark:text-purple-400" : "text-muted-foreground/50"
                  )}>AI Suggestion</span>
                  {document.ai_confidence_score && (
                    <Badge variant="outline" className={cn(
                      "text-[10px] ml-auto px-1",
                      document.ai_confidence_score >= 80 ? "border-green-500 text-green-600 dark:text-green-400" :
                      document.ai_confidence_score >= 60 ? "border-yellow-500 text-yellow-600 dark:text-yellow-400" : "border-red-500 text-red-600 dark:text-red-400"
                    )}>
                      {document.ai_confidence_score}%
                    </Badge>
                  )}
                </div>

                {isProcessing ? (
                  <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                    <Spinner size={24} className="mb-2 text-purple-500 dark:text-purple-400" />
                    <p className="text-xs">AI analyzing...</p>
                  </div>
                ) : (
                  <div className={cn("space-y-2", !document.ai_suggested_name && "opacity-40")}>
                    {/* Company + Folder - matching Edit panel */}
                    <div className="grid grid-cols-2 gap-1">
                      <div>
                        <Label className="text-[10px] text-muted-foreground">Company</Label>
                        <div className={cn(
                          "mt-0.5 h-7 text-xs border rounded-md px-2 flex items-center bg-muted/50",
                          document.ai_suggested_name && editedCompanyId === String(document.company_id || document.company?.id || "")
                            ? "border-green-500 bg-green-50 dark:bg-green-900/20"
                            : document.ai_suggested_name ? "border-red-500 bg-red-50 dark:bg-red-900/20" : ""
                        )}>
                          {document.ai_suggested_name ? (
                            document.company ? (
                              <span className="truncate">{document.company.code ? `[${document.company.code}] ` : ''}{document.company.name}</span>
                            ) : "-"
                          ) : "-"}
                        </div>
                      </div>
                      <div>
                        <Label className="text-[10px] text-muted-foreground">Tab/Folder</Label>
                        <div className={cn(
                          "mt-0.5 h-7 text-xs border rounded-md px-2 flex items-center bg-muted/50",
                          document.ai_suggested_name && document.ai_suggested_folder
                            ? (editedFolder === document.ai_suggested_folder
                              ? "border-green-500 bg-green-50 dark:bg-green-900/20"
                              : "border-red-500 bg-red-50 dark:bg-red-900/20")
                            : ""
                        )}>
                          {document.ai_suggested_folder || "-"}
                        </div>
                      </div>
                    </div>

                    {/* Document Type - with Signed/Unsigned and Amended indicators */}
                    <div>
                      <div className="flex items-center justify-between">
                        <Label className="text-[10px] text-muted-foreground">Document Type</Label>
                        <div className="flex items-center gap-2">
                          {/* Show Signed/Unsigned toggle if AI suggested type needs it - same style as Edit */}
                          {(() => {
                            const suggestedType = document.ai_suggested_type?.toLowerCase() || "";
                            const aiDocType = documentTypes.find(t =>
                              t.name?.toLowerCase() === suggestedType ||
                              t.abbreviation?.toLowerCase() === suggestedType ||
                              t.name?.toLowerCase().includes(suggestedType) ||
                              suggestedType.includes(t.abbreviation?.toLowerCase() || "")
                            );
                            // Also check if it's a CTR/TTR type directly
                            const isTaxReturn = suggestedType.includes("ctr") || suggestedType.includes("ttr") ||
                              suggestedType.includes("company tax return") || suggestedType.includes("trust tax return");
                            const aiNeedsSigned = aiDocType?.naming_format?.includes("{Signed}") || isTaxReturn;
                            if (aiNeedsSigned) {
                              // Detect from suggested name which one AI picked (can be at start like "TD US CTR" or end like "TD CTR FY24 US.pdf")
                              // Look for standalone S (not part of US) by checking for " S " or " S." pattern
                              const hasUS = document.ai_suggested_name?.match(/\bUS\b/i);
                              const hasStandaloneS = document.ai_suggested_name?.match(/(?<![U])\bS\b(?![\w])/i) && !hasUS;
                              // Default to Unsigned if neither is explicitly present (for CTR/TTR)
                              const isUnsigned = hasUS || !hasStandaloneS;
                              const isSigned = hasStandaloneS;
                              return (
                                <div className="flex items-center gap-0.5 bg-muted rounded px-1 py-0.5">
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant={isUnsigned ? "default" : "ghost"}
                                    disabled
                                    className={cn(
                                      "h-4 px-1.5 text-[9px]",
                                      isUnsigned && "bg-orange-500 hover:bg-orange-600"
                                    )}
                                  >
                                    US
                                  </Button>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant={isSigned ? "default" : "ghost"}
                                    disabled
                                    className={cn(
                                      "h-4 px-1.5 text-[9px]",
                                      isSigned && "bg-green-500 hover:bg-green-600"
                                    )}
                                  >
                                    S
                                  </Button>
                                </div>
                              );
                            }
                            return null;
                          })()}
                          {/* Show Amended checkbox indicator - same style as Edit */}
                          <div className="flex items-center gap-1">
                            <Checkbox
                              checked={document.ai_suggested_name?.toLowerCase().includes("amended") || false}
                              disabled
                              className="h-3 w-3"
                            />
                            <span className="text-[10px] text-muted-foreground">Amended</span>
                          </div>
                        </div>
                      </div>
                      <div className={cn(
                        "mt-0.5 h-7 text-xs border rounded-md px-2 flex items-center bg-muted/50",
                        document.ai_suggested_name && document.ai_suggested_type
                          ? (editedDocumentType.toLowerCase().replace(/[_\s]/g, '') === document.ai_suggested_type.toLowerCase().replace(/[_\s]/g, '')
                            ? "border-green-500 bg-green-50 dark:bg-green-900/20"
                            : "border-red-500 bg-red-50 dark:bg-red-900/20")
                          : ""
                      )}>
                        {document.ai_suggested_type || "-"}
                      </div>
                      {/* Show naming format for AI suggested type */}
                      {document.ai_suggested_type && (() => {
                        const aiDocType = documentTypes.find(t =>
                          t.name?.toLowerCase() === document.ai_suggested_type?.toLowerCase() ||
                          t.abbreviation?.toLowerCase() === document.ai_suggested_type?.toLowerCase()
                        );
                        return aiDocType?.naming_format ? (
                          <p className="mt-0.5 text-[10px] text-muted-foreground font-mono bg-muted px-1.5 py-0.5 rounded truncate">
                            {aiDocType.naming_format}
                          </p>
                        ) : null;
                      })()}
                    </div>

                    {/* Description/Period - only show if AI suggested type needs it */}
                    {aiNeedsDescription && (
                      <div>
                        <Label className="text-[10px] text-muted-foreground">Description</Label>
                        <div className={cn(
                          "mt-0.5 min-h-[2.5rem] text-xs border rounded-md px-2 py-1 bg-muted/50 line-clamp-2",
                          document.ai_extracted_description
                            ? (editedDescription === document.ai_extracted_description
                              ? "border-green-500 bg-green-50 dark:bg-green-900/20"
                              : "border-purple-500 bg-purple-50 dark:bg-purple-900/20")
                            : ""
                        )}>
                          {document.ai_extracted_description || "-"}
                        </div>
                      </div>
                    )}

                    {/* Financial Year - only show if AI suggested type needs it */}
                    {aiNeedsFinancialYear && (
                      <div>
                        <Label className="text-[10px] text-muted-foreground">Financial Year</Label>
                        <div className={cn(
                          "mt-0.5 h-7 text-xs border rounded-md px-2 flex items-center bg-muted/50",
                          document.ai_suggested_name && document.ai_suggested_fy
                            ? (JSON.stringify(editedFinancialYears) === JSON.stringify(parseFinancialYears(document.ai_suggested_fy))
                              ? "border-green-500 bg-green-50 dark:bg-green-900/20"
                              : "border-red-500 bg-red-50 dark:bg-red-900/20")
                            : ""
                        )}>
                          {document.ai_suggested_fy
                            ? parseFinancialYears(document.ai_suggested_fy).map(y => `FY${y.toString().slice(-2)}`).join(", ")
                            : "-"}
                        </div>
                      </div>
                    )}

                    {/* Date field - only show if Edit panel shows it */}
                    {(needsDescriptionAndDate || isAmended) && (
                      <div>
                        <Label className="text-[10px] text-muted-foreground">
                          {isAmended ? "Amended Date" : "Date"}
                        </Label>
                        <div className={cn(
                          "mt-0.5 h-7 text-xs border rounded-md px-2 flex items-center bg-muted/50",
                          document.ai_extracted_date
                            ? (editedRefDate === document.ai_extracted_date
                              ? "border-green-500 bg-green-50 dark:bg-green-900/20"
                              : "border-purple-500 bg-purple-50 dark:bg-purple-900/20")
                            : ""
                        )}>
                          {document.ai_extracted_date
                            ? document.ai_extracted_date.match(/^\d{4}-\d{2}-\d{2}$/)
                              ? document.ai_extracted_date.split('-').reverse().join('-')  // Convert YYYY-MM-DD to DD-MM-YYYY
                              : document.ai_extracted_date
                            : "-"}
                        </div>
                      </div>
                    )}

                    {/* Suggested File Name */}
                    <div>
                      <Label className="text-[10px] text-muted-foreground">Suggested File Name</Label>
                      <div className={cn(
                        "mt-0.5 h-7 text-xs border rounded-md px-2 flex items-center font-mono bg-muted/50 overflow-hidden",
                        document.ai_suggested_name
                          ? ((() => {
                              // Compare filenames ignoring .pdf extension
                              const normalizeFilename = (name: string) => name?.replace(/\.pdf$/i, '').trim().toLowerCase() || '';
                              return normalizeFilename(editedTitle) === normalizeFilename(document.ai_suggested_name || '');
                            })()
                            ? "border-green-500 bg-green-50 dark:bg-green-900/20"
                            : "border-red-500 bg-red-50 dark:bg-red-900/20")
                          : ""
                      )}>
                        <span className="truncate">{(() => {
                          // Auto-inject US for CTR/TTR if missing signed status
                          let suggestedName = document.ai_suggested_name || "-";
                          if (suggestedName !== "-") {
                            const isCtrOrTtr = /\b(CTR|TTR)\b/i.test(suggestedName);
                            const hasSignedStatus = /\b(US|S)\b/.test(suggestedName);
                            if (isCtrOrTtr && !hasSignedStatus) {
                              // Insert "US" before .pdf or at end
                              suggestedName = suggestedName.replace(/\.pdf$/i, ' US.pdf');
                              if (!suggestedName.endsWith('.pdf')) {
                                suggestedName = suggestedName + ' US';
                              }
                            }
                          }
                          return suggestedName;
                        })()}</span>
                      </div>
                    </div>

                    {/* Table Title Preview - shows full document type name + dates/FY + Signed/Unsigned + Amended */}
                    <div>
                      <Label className="text-[10px] text-muted-foreground">Table Title Preview</Label>
                      <div className="mt-0.5 min-h-[2.5rem] text-xs border rounded-md px-2 py-1 bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800 line-clamp-2">
                        {(() => {
                          // Use the AI suggested type directly (it's already the full name from backend)
                          const fullTypeName = document.ai_suggested_type || "";
                          const suggestedTypeLower = fullTypeName.toLowerCase();

                          // Check if this is a date-range document (statements, etc)
                          const isDateRangeDoc = suggestedTypeLower.includes("statement") ||
                            suggestedTypeLower.includes("summary") ||
                            document.ai_suggested_name?.includes(" to ");

                          // Extract date range and print date from suggested filename
                          // Format: "TD Income Tax Statement 01-07-2023 to 01-07-2025 (01-07-2025).pdf"
                          const dateRangeMatch = document.ai_suggested_name?.match(/(\d{2}-\d{2}-\d{4})\s*to\s*(\d{2}-\d{2}-\d{4})/);
                          const printDateMatch = document.ai_suggested_name?.match(/\((\d{2}-\d{2}-\d{4})\)/);

                          let datePart = "";
                          if (isDateRangeDoc && dateRangeMatch) {
                            // Use full date range for statement-type documents
                            datePart = `${dateRangeMatch[1]} to ${dateRangeMatch[2]}`;
                            // Add print date if present
                            if (printDateMatch) {
                              datePart += ` (${printDateMatch[1]})`;
                            }
                          } else {
                            // Use FY format for other documents (2-digit)
                            const fyArray = parseFinancialYears(document.ai_suggested_fy);
                            datePart = fyArray.length > 0
                              ? fyArray.map(y => `FY${String(y).slice(-2)}`).join(" ")
                              : "";
                          }

                          // Check if this type needs signed/unsigned
                          const isTaxReturn = suggestedTypeLower.includes("ctr") || suggestedTypeLower.includes("ttr") ||
                            suggestedTypeLower.includes("company tax return") || suggestedTypeLower.includes("trust tax return");
                          // Detect signed/unsigned from AI suggested name (can be at start or end of filename)
                          const isUnsigned = document.ai_suggested_name?.match(/\bUS\b/i);
                          const isSigned = document.ai_suggested_name?.match(/\bS\b/) && !isUnsigned;
                          const signedPart = isTaxReturn ? (isSigned ? 'Signed' : isUnsigned ? 'Unsigned' : 'Unsigned') : '';

                          // Extract amendment number from AI suggested name (e.g., "Amended 2" -> 2)
                          const amendedMatch = document.ai_suggested_name?.match(/amended\s*(\d+)?/i);
                          const amendedPart = amendedMatch
                            ? (amendedMatch[1] && parseInt(amendedMatch[1]) > 1 ? `Amended ${amendedMatch[1]}` : 'Amended')
                            : '';
                          const parts = [fullTypeName, datePart, signedPart, amendedPart].filter(Boolean);
                          return parts.length > 0 ? parts.join(" ") : "-";
                        })()}
                      </div>
                    </div>

                    {/* Action buttons - matching Edit panel button position */}
                    {document.ai_suggested_name ? (
                      <div className="pt-2 border-t flex items-center gap-2">
                        <Button
                          onClick={handleApplySuggestion}
                          disabled={applyingSuggestion}
                          size="sm"
                          className="h-7 text-xs bg-purple-600 hover:bg-purple-700"
                        >
                          {applyingSuggestion ? (
                            <><Spinner size={12} className="mr-1" />Applying</>
                          ) : (
                            <><Sparkles className="h-3 w-3 mr-1" />Apply AI</>
                          )}
                        </Button>
                        <Button
                          onClick={handleAiVerify}
                          disabled={aiVerifying}
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs text-purple-600 dark:text-purple-400 border-purple-300 hover:bg-purple-100"
                        >
                          {aiVerifying ? (
                            <><Spinner size={12} className="mr-1" />Analyzing</>
                          ) : (
                            <><RefreshCw className="h-3 w-3 mr-1" />Re-run</>
                          )}
                        </Button>
                      </div>
                    ) : canAiVerify ? (
                      <div className="pt-2 border-t">
                        <Button
                          onClick={handleAiVerify}
                          disabled={aiVerifying}
                          variant="outline"
                          size="sm"
                          className="w-full h-7 text-xs text-purple-600 dark:text-purple-400 border-purple-300 hover:bg-purple-100"
                        >
                          {aiVerifying ? (
                            <><Spinner size={12} className="mr-1" />Analyzing...</>
                          ) : (
                            <><Sparkles className="h-3 w-3 mr-1" />Run AI Analysis</>
                          )}
                        </Button>
                      </div>
                    ) : null}

                    {/* Split Recommendation - shown when multiple docs detected */}
                    {document.ai_contains_multiple_documents && document.ai_split_recommendation && (
                      <div className="pt-2 border-t">
                        <div className="bg-orange-50 dark:bg-orange-900/20 rounded-md px-2 py-1.5 border border-orange-300 dark:border-orange-700">
                          <p className="text-[10px] text-orange-700 dark:text-orange-300 font-semibold flex items-center gap-1">
                            <AlertTriangle className="h-3 w-3" />
                            Multiple Documents Detected - Recommend Split
                          </p>
                          <div className="mt-1 space-y-1">
                            {document.ai_split_recommendation.map((rec, idx) => (
                              <div key={idx} className="text-[10px] bg-card rounded px-1.5 py-1 border">
                                <p className="font-medium text-orange-800 dark:text-orange-200">
                                  Pages {rec.pages}: {rec.type}
                                </p>
                                <p className="text-muted-foreground font-mono truncate">
                                  → {rec.suggested_name}
                                </p>
                              </div>
                            ))}
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full mt-2 h-6 text-[10px] text-orange-600 dark:text-orange-400 border-orange-300 hover:bg-orange-100"
                            onClick={() => setIsEditingPdf(true)}
                          >
                            <Pencil className="h-3 w-3 mr-1" />
                            Open PDF Editor to Split
                          </Button>
                        </div>
                      </div>
                    )}

                    {/* AI Reasoning - at bottom */}
                    {(document.ai_analysis_notes || document.ai_source_page || document.ai_source_quote) && (
                      <div className="pt-1 space-y-1">
                        {/* Source info - page and quote */}
                        {(document.ai_source_page || document.ai_source_quote) && (
                          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-md px-1.5 py-1 border border-blue-200 dark:border-blue-800">
                            {document.ai_source_page && (
                              <p className="text-[10px] text-blue-600 dark:text-blue-400 font-medium">
                                📄 Page {document.ai_source_page}
                              </p>
                            )}
                            {document.ai_source_quote && (
                              <p className="text-[10px] text-blue-700 dark:text-blue-300 italic mt-0.5 line-clamp-2">
                                "{document.ai_source_quote}"
                              </p>
                            )}
                          </div>
                        )}
                        {/* AI reasoning notes */}
                        {document.ai_analysis_notes && (
                          <div>
                            <Label className="text-[10px] text-muted-foreground">AI Reasoning</Label>
                            <p className="mt-0.5 text-[10px] text-muted-foreground italic bg-muted/50 rounded-md px-1.5 py-1 max-h-24 overflow-y-auto">
                              {document.ai_analysis_notes}
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Half - Document Preview or Editor (full height) */}
          <div className="w-1/2 bg-muted flex flex-col overflow-hidden">
              {isEditingPdf && fileType === "pdf" && document.id ? (
                // PDF Editor Mode - use /content endpoint to bypass CORS
                <PDFEditor
                  url={`${getApiBaseUrl()}/api/v1/company_documents/${document.id}/content`}
                  fileName={document.file_name || "document.pdf"}
                  onSave={async (pdfBytes, fileName) => {
                    try {
                      // Convert bytes to base64 for JSON transport
                      const base64 = btoa(
                        new Uint8Array(pdfBytes).reduce(
                          (data, byte) => data + String.fromCharCode(byte),
                          ''
                        )
                      );

                      // Upload to SharePoint via backend
                      const response = await api.post<{ success: boolean; document?: CompanyDocument; error?: string }>(
                        `/api/v1/company_documents/${document.id}/upload_edited`,
                        {
                          file_data: base64,
                          file_name: fileName,
                          create_new: false, // Replace existing file
                        }
                      );

                      if (response?.success) {
                        // Update local document state with new data
                        if (response?.document) {
                          setDocument(response.document);
                        }
                        // Refresh parent list
                        if (onDocumentUpdate) {
                          await onDocumentUpdate();
                        }
                        setIsEditingPdf(false);
                      } else {
                        console.error("Failed to save PDF:", response?.error);
                        toast({ title: "Error", description: `Failed to save: ${response?.error || 'Unknown error'}`, variant: "destructive" });
                      }
                    } catch (error) {
                      console.error("Error saving PDF:", error);
                      toast({ title: "Error", description: "Failed to save PDF. Please try again.", variant: "destructive" });
                    }
                  }}
                  onClose={() => setIsEditingPdf(false)}
                  className="flex-1"
                />
              ) : previewLoading ? (
                <div className="flex flex-col items-center justify-center flex-1 text-muted-foreground">
                  <Spinner size={48} className="mb-4" />
                  <p className="text-sm">Loading preview...</p>
                </div>
              ) : fileType === "pdf" && document.id ? (
                // For PDFs, always use the /content endpoint to bypass CORS
                // SharePoint embed URLs don't work with PDF.js due to CORS restrictions
                <PDFViewer
                  url={`${getApiBaseUrl()}/api/v1/company_documents/${document.id}/content`}
                  className="flex-1"
                  showThumbnails={false}
                  fallbackUrl={document.file_url}
                />
              ) : fileType === "image" && document.file_url ? (
                <div className="flex items-center justify-center flex-1 p-4 overflow-auto">
                  <img
                    src={document.file_url}
                    alt={document.file_name}
                    className="max-w-full max-h-full object-contain"
                  />
                </div>
              ) : fileType === "excel" ? (
                // Excel file - use ExcelViewer with Universal Document Reader
                documentDataLoading ? (
                  <ExcelViewerLoading className="flex-1" />
                ) : documentData?.error ? (
                  <ExcelViewerError error={documentData.error} className="flex-1" />
                ) : documentData?.content ? (
                  <ExcelViewer
                    data={documentData.content as ExcelData}
                    filename={document.file_name}
                    className="flex-1"
                  />
                ) : (
                  <ExcelViewerLoading className="flex-1" />
                )
              ) : fileType === "word" ? (
                // Word file - use WordViewer with Universal Document Reader
                documentDataLoading ? (
                  <WordViewerLoading className="flex-1" />
                ) : documentData?.error ? (
                  <WordViewerError error={documentData.error} className="flex-1" />
                ) : documentData?.content ? (
                  <WordViewer
                    data={documentData.content as WordData}
                    filename={document.file_name}
                    className="flex-1"
                  />
                ) : (
                  <WordViewerLoading className="flex-1" />
                )
              ) : previewUrl ? (
                // For non-PDF OneDrive files (Word, Excel, etc), use iframe
                <iframe
                  src={previewUrl}
                  className="w-full flex-1 border-0"
                  title="Document Preview"
                  allow="fullscreen"
                />
              ) : (
                <div className="flex flex-col items-center justify-center flex-1 text-muted-foreground p-8">
                  <FileText className="h-16 w-16 mb-4" />
                  <p className="text-lg font-medium mb-2">
                    {previewError || "Preview not available"}
                  </p>
                  <p className="text-sm mb-4 text-center">
                    {storageRef
                      ? "Could not load cloud storage preview."
                      : "This file type cannot be previewed inline."}
                  </p>
                  {document.file_url && (
                    <Button asChild>
                      <a href={document.file_url} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-4 w-4 mr-2" />
                        Open in New Tab
                      </a>
                    </Button>
                  )}
                </div>
              )}
          </div>
        </div>

      </DialogContent>
    </Dialog>
  );
}
