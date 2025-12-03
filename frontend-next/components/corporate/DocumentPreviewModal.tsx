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
import { api } from "@/lib/api";
import {
  FileText,
  ExternalLink,
  CheckCircle2,
  Check,
  Sparkles,
  Loader2,
  AlertTriangle,
  Pencil,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

// Folder options for document organization
const FOLDER_OPTIONS = [
  "ADVICE",
  "ASIC",
  "ASSETS",
  "ATO",
  "BANK",
  "COMPANY",
  "DIVIDENDS",
  "FINANCIALS",
  "GENERAL",
  "INSURANCE",
  "LOANS",
  "MINUTES",
  "REGISTRY",
  "TRUST",
];

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
  title?: string;
  display_title?: string;
  file_name?: string;
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
  onedrive_file_id?: string;
  user_validated_at?: string;
  user_validated_by_id?: number;
  ai_verification_status?: "pending" | "processing" | "verified" | "mismatch" | "error" | string;
  ai_suggested_name?: string;
  ai_suggested_folder?: string;
  ai_suggested_type?: string;
  ai_suggested_fy?: number[] | string;
  ai_confidence_score?: number;
  ai_analysis_notes?: string;
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
  const [document, setDocument] = React.useState<CompanyDocument>(initialDocument);
  const [validating, setValidating] = React.useState(false);
  const [validated, setValidated] = React.useState(initialDocument?.user_validated_at != null);
  const [aiVerifying, setAiVerifying] = React.useState(false);
  const [applyingSuggestion, setApplyingSuggestion] = React.useState(false);

  // Editing states
  const [isEditing, setIsEditing] = React.useState(false);
  const [editedTitle, setEditedTitle] = React.useState(initialDocument?.title || "");
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
  const [saving, setSaving] = React.useState(false);

  // Document types from database
  const [documentTypes, setDocumentTypes] = React.useState<DocumentTypeOption[]>([]);

  const pollingRef = React.useRef<NodeJS.Timeout | null>(null);
  const titleInputRef = React.useRef<HTMLInputElement>(null);

  // Fetch document types from database
  React.useEffect(() => {
    const fetchDocumentTypes = async () => {
      try {
        const response = await api.get<{ success: boolean; data: DocumentTypeOption[] }>("/api/v1/document_types");
        if (response.success && response.data) {
          setDocumentTypes(response.data);
        }
      } catch (error) {
        console.error("Failed to fetch document types:", error);
      }
    };
    fetchDocumentTypes();
  }, []);

  // Get the full document type record from database (includes naming_format)
  const getDocumentTypeRecord = React.useCallback((docTypeName: string) => {
    return documentTypes.find(dt => dt.name === docTypeName);
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

  // Update state when initialDocument changes - also auto-detect from filename
  React.useEffect(() => {
    setDocument(initialDocument);
    setValidated(initialDocument?.user_validated_at != null);
    setEditedTitle(initialDocument?.title || "");
    setEditedCompanyId(String(initialDocument?.company_id || initialDocument?.company?.id || ""));
    setEditedFolder(initialDocument?.folder || "");

    // Auto-detect document type from filename if not already set or if current type is unknown
    const currentDocType = initialDocument?.document_type || "";
    const filename = initialDocument?.file_name || initialDocument?.title || "";
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

  const fileType = getFileType(document?.file_name || document?.title);

  // Poll for AI verification results
  React.useEffect(() => {
    if (document?.ai_verification_status === "processing") {
      pollingRef.current = setInterval(async () => {
        try {
          const response = await api.get<{ document: CompanyDocument }>(
            `/api/v1/company_documents/${document.id}`
          );
          if (response.document) {
            setDocument(response.document);
            // Stop polling when status changes from processing
            if (response.document.ai_verification_status !== "processing") {
              if (pollingRef.current) clearInterval(pollingRef.current);
              setAiVerifying(false);
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
  }, [document?.id, document?.ai_verification_status]);

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

  // Auto-fill document name when selections change
  React.useEffect(() => {
    const companyCode = companies.find(c => String(c.id) === editedCompanyId)?.code || "";
    const docTypeRecord = getDocumentTypeRecord(editedDocumentType);
    const docTypeAbbrev = docTypeRecord?.abbreviation ||
      getDocumentTypesForFolder(editedFolder).find(t => t.value === editedDocumentType)?.abbrev || "";

    // Check if this doc type uses Description + Date format (like ATO Documents)
    const usesDescriptionDate = editedDocumentType === "other" ||
      (docTypeRecord?.naming_format?.includes("{Description}") ||
       docTypeRecord?.naming_format?.includes("{Date}"));

    if (usesDescriptionDate) {
      // Format: {CompanyCode} {Abbrev} {Description} {Date}
      if (companyCode && docTypeAbbrev && editedDescription) {
        let newName = `${companyCode} ${docTypeAbbrev} ${editedDescription}`;
        if (editedRefDate) {
          newName += ` ${formatDateForFilename(editedRefDate)}`;
        }
        setEditedTitle(newName.trim());
      }
      return;
    }

    // Standard document type format with FY
    const fyPart = editedFinancialYears.length > 0
      ? editedFinancialYears.map(y => `FY${y.toString().slice(-2)}`).join(" ")
      : "";
    const descPart = editedDescription ? ` ${editedDescription}` : "";

    // Only auto-fill if we have the required fields
    if (companyCode && docTypeAbbrev && fyPart) {
      const newName = `${companyCode} ${docTypeAbbrev} ${fyPart}${descPart}`.trim();
      setEditedTitle(newName);
    }
  }, [editedCompanyId, editedDocumentType, editedFinancialYears, editedDescription, editedRefDate, editedFiledDate, editedFolder, companies, getDocumentTypesForFolder, getDocumentTypeRecord]);

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
      alert("Failed to validate document");
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
      alert(errorMessage);
      setAiVerifying(false);
    }
  };

  // Start editing mode
  const startEditing = () => {
    setEditedTitle(document.title || "");
    setEditedCompanyId(String(document.company_id || document.company?.id || ""));
    setEditedFolder(document.folder || "");
    setEditedFinancialYears(parseFinancialYears(document.financial_years));
    setIsEditing(true);
  };

  // Cancel editing
  const cancelEditing = () => {
    setIsEditing(false);
  };

  // Save all changes - uses relocate endpoint to move file in OneDrive
  const handleSave = async () => {
    try {
      setSaving(true);

      // Use relocate endpoint which moves/renames in OneDrive
      const response = await api.post<{ success: boolean; document: CompanyDocument }>(
        `/api/v1/company_documents/${document.id}/relocate`,
        {
          relocate: {
            title: editedTitle.trim(),
            company_id: editedCompanyId || null,
            folder: editedFolder || null,
            document_type: editedDocumentType || null,
            financial_years: editedFinancialYears,
            ref_date: editedRefDate || null,
            filed_date: editedFiledDate || null,
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
                final_name: editedTitle.trim(),
                final_folder: editedFolder,
                final_fy: editedFinancialYears.join(","),
              },
            });
          } catch {
            // Feedback recording is non-critical
            console.error("Failed to record feedback");
          }
        }

        if (response.document) {
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
      alert(errorMessage);
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
              final_name: response.document.title,
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
      alert(errorMessage);
    } finally {
      setApplyingSuggestion(false);
    }
  };

  // Handle rejecting AI suggestion (keep current name)
  const handleRejectSuggestion = async () => {
    // Record feedback that user rejected suggestion
    try {
      await api.post(`/api/v1/company_documents/${document.id}/feedback`, {
        feedback: {
          action: "rejected",
          final_name: document.title,
          final_folder: document.folder,
          reason: "User preferred original name",
        },
      });
    } catch {
      // Feedback is optional
    }
    await handleValidate();
  };

  // Handle financial year checkbox toggle
  const toggleFinancialYear = (year: number) => {
    setEditedFinancialYears((prev) => {
      if (prev.includes(year)) {
        return prev.filter((y) => y !== year);
      } else {
        return [...prev, year].sort((a, b) => b - a);
      }
    });
  };

  // Format file size
  const formatFileSize = (bytes?: number) => {
    if (!bytes) return "-";
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${Math.round((bytes / Math.pow(1024, i)) * 100) / 100} ${sizes[i]}`;
  };

  // Check if document has OneDrive file for AI verification
  const canAiVerify = document?.onedrive_file_id && !validated;

  // AI verification status
  const aiStatus = document?.ai_verification_status;
  const hasAiSuggestion = document?.ai_suggested_name && aiStatus === "mismatch";
  const isProcessing = aiStatus === "processing" || aiVerifying;

  // Get current company name
  const currentCompanyName =
    document?.company?.name ||
    companies.find((c) => c.id === document?.company_id)?.name ||
    "-";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-0">
        {/* Header */}
        <DialogHeader className="px-6 py-4 border-b">
          <div className="flex items-center gap-3">
            <FileText className="h-6 w-6 text-muted-foreground flex-shrink-0" />
            {isEditing ? (
              <Input
                ref={titleInputRef}
                value={editedTitle}
                onChange={(e) => setEditedTitle(e.target.value)}
                className="flex-1 text-lg font-semibold"
                placeholder="Document title"
              />
            ) : (
              <button
                onClick={startEditing}
                className="group flex items-center gap-2 text-left flex-1 min-w-0"
                title="Click to edit"
              >
                <DialogTitle className="truncate mb-0">
                  {document.display_title || document.title}
                </DialogTitle>
                <Pencil className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
              </button>
            )}
          </div>
        </DialogHeader>

        {/* Content */}
        <div className="px-6 py-4">
          {/* Document Details - Editable or Display */}
          {isEditing ? (
            <div className="mb-6 p-4 bg-muted/50 rounded-lg border">
              <h3 className="text-sm font-medium text-muted-foreground mb-4">
                Edit Document Details
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Company Dropdown */}
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Company</Label>
                  <Select value={editedCompanyId} onValueChange={setEditedCompanyId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select company..." />
                    </SelectTrigger>
                    <SelectContent>
                      {companies.map((company) => (
                        <SelectItem key={company.id} value={String(company.id)}>
                          {company.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Folder Dropdown */}
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Folder (Tab)</Label>
                  <Select value={editedFolder} onValueChange={setEditedFolder}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select folder..." />
                    </SelectTrigger>
                    <SelectContent>
                      {FOLDER_OPTIONS.map((folder) => (
                        <SelectItem key={folder} value={folder}>
                          {folder}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Financial Year Multi-Select */}
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Financial Year(s)</Label>
                  <div className="flex flex-wrap gap-1 min-h-[38px] p-2 border rounded-md bg-background">
                    {editedFinancialYears.length > 0 ? (
                      editedFinancialYears.map((year) => (
                        <Badge
                          key={year}
                          variant="secondary"
                          className="gap-1 cursor-pointer"
                          onClick={() => toggleFinancialYear(year)}
                        >
                          FY{year.toString().slice(-2)}
                          <X className="h-3 w-3" />
                        </Badge>
                      ))
                    ) : (
                      <span className="text-muted-foreground text-sm">Select years...</span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {FY_OPTIONS.slice(0, 6).map((year) => (
                      <Button
                        key={year}
                        type="button"
                        size="sm"
                        variant={editedFinancialYears.includes(year) ? "default" : "outline"}
                        onClick={() => toggleFinancialYear(year)}
                        className="h-7 px-2 text-xs"
                      >
                        FY{year.toString().slice(-2)}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Save/Cancel buttons */}
              <div className="mt-4 flex items-center gap-3">
                <Button onClick={handleSave} disabled={saving}>
                  {saving ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Check className="h-4 w-4 mr-2" />
                      Save Changes
                    </>
                  )}
                </Button>
                <Button variant="outline" onClick={cancelEditing} disabled={saving}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="mb-6 grid grid-cols-2 md:grid-cols-7 gap-4">
              <div>
                <p className="text-xs text-muted-foreground">Company</p>
                <p className="text-sm font-medium">{currentCompanyName}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Tab/Folder</p>
                <p className="text-sm font-medium">{document.folder || "-"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Doc Type</p>
                <p className="text-sm font-medium">
                  {document.document_type ? (
                    <span className="flex items-center gap-1">
                      <Badge variant="outline" className="font-mono text-xs">
                        {getDocumentTypesForFolder(document.folder).find(t => t.value === document.document_type)?.abbrev || "?"}
                      </Badge>
                      {getDocumentTypesForFolder(document.folder).find(t => t.value === document.document_type)?.label || document.document_type.replace(/_/g, " ")}
                    </span>
                  ) : "-"}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Financial Year</p>
                <p className="text-sm font-medium">
                  {Array.isArray(document.financial_years) && document.financial_years.length > 0
                    ? document.financial_years.map((y) => `FY${y.toString().slice(-2)}`).join(", ")
                    : "-"}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Linked To</p>
                <p className="text-sm font-medium">
                  {document.asset ? (
                    <span className="flex items-center gap-1">
                      <Badge variant="secondary" className="text-xs">
                        {document.asset.abbreviation || document.asset.display_name || document.asset.name || `Asset #${document.asset.id}`}
                      </Badge>
                    </span>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">File Size</p>
                <p className="text-sm font-medium">{formatFileSize(document.file_size)}</p>
              </div>
            </div>
          )}

          {/* Naming Information Section */}
          <div className="mb-6 p-4 bg-muted/30 rounded-lg border space-y-3">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Naming Information
            </h3>

            {/* Original Filename */}
            <div className="grid grid-cols-[120px_1fr] gap-2 text-sm">
              <span className="text-muted-foreground">Original File:</span>
              <span className="font-mono text-xs bg-muted px-2 py-1 rounded break-all">
                {document.file_name || document.title || "-"}
              </span>
            </div>

            {/* Current Title */}
            <div className="grid grid-cols-[120px_1fr] gap-2 text-sm">
              <span className="text-muted-foreground">Current Title:</span>
              <span className="font-mono text-xs bg-muted px-2 py-1 rounded break-all">
                {document.title || "-"}
              </span>
            </div>

            {/* Naming Convention Guide */}
            <div className="grid grid-cols-[120px_1fr] gap-2 text-sm">
              <span className="text-muted-foreground">TEEEM Format:</span>
              <div className="space-y-2">
                <span className="font-mono text-xs bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200 px-2 py-1 rounded inline-block">
                  {"{CompanyCode}"} {"{DocType}"} FY{"{YY}"} {"{Details/Asset}"}.pdf
                </span>
                <div className="text-xs text-muted-foreground space-y-1">
                  <p className="font-medium text-foreground">Format breakdown:</p>
                  <ul className="list-disc list-inside ml-2 space-y-0.5">
                    <li><span className="font-mono">CompanyCode</span> - Company abbreviation (e.g., TD, ANZ)</li>
                    <li><span className="font-mono">DocType</span> - Document type abbreviation (CTR, BAS, LA)</li>
                    <li><span className="font-mono">FY{"{YY}"}</span> - Financial year (FY24, FY25)</li>
                    <li><span className="font-mono">Details/Asset</span> - Additional info: period, asset name, description</li>
                  </ul>
                  <p className="mt-2 font-medium text-foreground">Examples:</p>
                  <ul className="list-disc list-inside ml-2 space-y-0.5">
                    <li><span className="font-mono">TD CTR FY24.pdf</span> - Company Tax Return</li>
                    <li><span className="font-mono">TD BAS Q1 FY24.pdf</span> - BAS for Quarter 1</li>
                    <li><span className="font-mono">TD LA FY24 ANZ Loan.pdf</span> - Loan Agreement linked to ANZ Loan asset</li>
                    <li><span className="font-mono">TD MTG FY24 123 Main St.pdf</span> - Mortgage for property</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Linked Asset Info (if any) */}
            {document.asset && (
              <div className="grid grid-cols-[120px_1fr] gap-2 text-sm">
                <span className="text-muted-foreground">Linked Asset:</span>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="font-medium">
                    {document.asset.abbreviation || document.asset.display_name || document.asset.name}
                  </Badge>
                  {document.asset.description && (
                    <span className="text-xs text-muted-foreground">
                      {document.asset.description}
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* AI Suggestion (if available) */}
            {document.ai_suggested_name && (
              <div className="grid grid-cols-[120px_1fr] gap-2 text-sm">
                <span className="text-muted-foreground flex items-center gap-1">
                  <Sparkles className="h-3 w-3 text-purple-500" />
                  AI Suggestion:
                </span>
                <div className="space-y-1">
                  <span className="font-mono text-xs bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-200 px-2 py-1 rounded inline-block">
                    {document.ai_suggested_name}
                  </span>
                  {document.ai_confidence_score && (
                    <span className={cn(
                      "text-xs ml-2",
                      document.ai_confidence_score >= 80 ? "text-green-600" :
                      document.ai_confidence_score >= 60 ? "text-yellow-600" : "text-red-600"
                    )}>
                      ({document.ai_confidence_score}% confidence)
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* AI Reasoning (if available) */}
            {document.ai_analysis_notes && (
              <div className="grid grid-cols-[120px_1fr] gap-2 text-sm">
                <span className="text-muted-foreground">AI Reasoning:</span>
                <p className="text-xs text-muted-foreground italic bg-muted/50 px-2 py-1 rounded">
                  {document.ai_analysis_notes}
                </p>
              </div>
            )}

            {/* Current Tab/Folder and Document Type - side by side */}
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="grid grid-cols-[120px_1fr] gap-2">
                <span className="text-muted-foreground">Tab/Folder:</span>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="font-medium">
                    {document.folder || "GENERAL"}
                  </Badge>
                  {document.ai_suggested_folder && document.ai_suggested_folder !== document.folder && (
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Sparkles className="h-3 w-3 text-purple-500" />
                      <Badge variant="outline" className="text-purple-600 border-purple-300">{document.ai_suggested_folder}</Badge>
                    </span>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-[100px_1fr] gap-2">
                <span className="text-muted-foreground">Doc Type:</span>
                <div className="flex items-center gap-2">
                  <span className="font-medium capitalize">
                    {document.document_type?.replace(/_/g, " ") || "-"}
                  </span>
                  {document.ai_suggested_type && document.ai_suggested_type !== document.document_type && (
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Sparkles className="h-3 w-3 text-purple-500" />
                      <span className="text-purple-600 capitalize">{document.ai_suggested_type.replace(/_/g, " ")}</span>
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Company, Folder, Type & Details - User can modify document location */}
            <div className="pt-3 border-t space-y-3">
              {/* Move to Company */}
              <div className="grid grid-cols-[120px_1fr] gap-2 text-sm items-center">
                <span className="text-muted-foreground">Move to Company:</span>
                <div className="flex gap-2 items-center">
                  <Select value={editedCompanyId} onValueChange={setEditedCompanyId}>
                    <SelectTrigger className="w-[280px]">
                      <SelectValue placeholder="Select company...">
                        {companies.find(c => String(c.id) === editedCompanyId)?.name || "Select company..."}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {companies.map((company) => (
                        <SelectItem key={company.id} value={String(company.id)}>
                          <div className="flex items-center gap-2">
                            {company.code && (
                              <Badge variant="outline" className="font-mono text-xs">
                                {company.code}
                              </Badge>
                            )}
                            {company.name}
                            {String(company.id) === String(document.company_id || document.company?.id) && " (current)"}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {editedCompanyId !== String(document.company_id || document.company?.id || "") && (
                    <span className="text-xs text-amber-600">⚠️ Will move file to new company folder</span>
                  )}
                </div>
              </div>

              {/* Tab/Folder */}
              <div className="grid grid-cols-[120px_1fr] gap-2 text-sm items-center">
                <span className="text-muted-foreground">Tab/Folder:</span>
                <Select value={editedFolder} onValueChange={setEditedFolder}>
                  <SelectTrigger className="w-full max-w-[300px]">
                    <SelectValue placeholder="Select tab..." />
                  </SelectTrigger>
                  <SelectContent>
                    {FOLDER_OPTIONS.map((folder) => (
                      <SelectItem key={folder} value={folder}>
                        {folder}
                        {folder === document.folder && " (current)"}
                        {folder === document.ai_suggested_folder && folder !== document.folder && " ✨ AI"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Document Type - filtered by selected folder */}
              <div className="grid grid-cols-[120px_1fr] gap-2 text-sm items-start">
                <span className="text-muted-foreground pt-2">Doc Type:</span>
                <div className="space-y-1">
                  <Select value={editedDocumentType} onValueChange={setEditedDocumentType}>
                    <SelectTrigger className="w-full max-w-[400px]">
                      <SelectValue placeholder="Select type...">
                        {editedDocumentType ? (
                          <span className="flex items-center gap-2">
                            <Badge variant="outline" className="font-mono text-xs">
                              {getDocumentTypesForFolder(editedFolder).find(t => t.value === editedDocumentType)?.abbrev || "?"}
                            </Badge>
                            {getDocumentTypesForFolder(editedFolder).find(t => t.value === editedDocumentType)?.label || editedDocumentType}
                          </span>
                        ) : "Select type..."}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {getDocumentTypesForFolder(editedFolder).map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          <span className="flex items-center gap-2">
                            <Badge variant="outline" className="font-mono text-xs">
                              {type.abbrev}
                            </Badge>
                            {type.label}
                            {type.value === document.document_type && " (current)"}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {/* Show naming format for selected doc type */}
                  {editedDocumentType && getDocumentTypeRecord(editedDocumentType)?.naming_format && (
                    <p className="text-xs text-muted-foreground font-mono pl-1">
                      Format: {getDocumentTypeRecord(editedDocumentType)?.naming_format}
                    </p>
                  )}
                </div>
              </div>

              {/* Financial Year fields - shown when doc type needs FY */}
              {editedDocumentType && needsFinancialYear && (
                <div className={needsDetails ? "grid grid-cols-2 gap-4" : ""}>
                  {/* Financial Year Selector */}
                  <div className="grid grid-cols-[80px_1fr] gap-2 text-sm items-start">
                    <span className="text-muted-foreground pt-2">Fin. Year:</span>
                    <div className="space-y-2">
                      <div className="flex flex-wrap gap-1">
                        {editedFinancialYears.length > 0 ? (
                          editedFinancialYears.map((year) => (
                            <Badge
                              key={year}
                              variant="secondary"
                              className="gap-1 cursor-pointer hover:bg-destructive/20"
                              onClick={() => toggleFinancialYear(year)}
                            >
                              FY{year.toString().slice(-2)}
                              <X className="h-3 w-3" />
                            </Badge>
                          ))
                        ) : (
                          <span className="text-xs text-muted-foreground">Select year(s)...</span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {FY_OPTIONS.slice(0, 5).map((year) => (
                          <Button
                            key={year}
                            type="button"
                            size="sm"
                            variant={editedFinancialYears.includes(year) ? "default" : "outline"}
                            onClick={() => toggleFinancialYear(year)}
                            className="h-6 px-2 text-xs"
                          >
                            FY{year.toString().slice(-2)}
                          </Button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Manual Description/Details - only shown if naming format requires it */}
                  {needsDetails && (
                    <div className="grid grid-cols-[80px_1fr] gap-2 text-sm items-center">
                      <span className="text-muted-foreground">Details:</span>
                      <Input
                        value={editedDescription}
                        onChange={(e) => setEditedDescription(e.target.value)}
                        placeholder="e.g., Q1, ANZ Loan, 123 Main St..."
                        className="text-sm"
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Description and Date fields - shown when doc type needs them (e.g., ATO Documents, Other) */}
              {editedDocumentType && needsDescriptionAndDate && (
                <div className="space-y-3 p-3 bg-amber-50 dark:bg-amber-900/20 rounded border border-amber-200 dark:border-amber-800">
                  <p className="text-xs text-amber-700 dark:text-amber-300 font-medium">
                    {getDocumentTypeRecord(editedDocumentType)?.name || "Other"} - Please provide details:
                  </p>

                  {/* Description (required) */}
                  <div className="grid grid-cols-[100px_1fr] gap-2 text-sm items-center">
                    <span className="text-muted-foreground">Description:</span>
                    <Input
                      value={editedDescription}
                      onChange={(e) => setEditedDescription(e.target.value)}
                      placeholder="What is this document? e.g., Letter from ATO, Notice..."
                      className="text-sm"
                    />
                  </div>

                  {/* Document Date */}
                  <div className="grid grid-cols-[100px_1fr] gap-2 text-sm items-center">
                    <span className="text-muted-foreground">Doc Date:</span>
                    <Input
                      type="date"
                      value={editedRefDate}
                      onChange={(e) => setEditedRefDate(e.target.value)}
                      className="text-sm w-[180px]"
                    />
                  </div>
                </div>
              )}

              {/* New Name section */}
              <div className="bg-muted/50 p-3 rounded space-y-3">
                {/* Human-readable display name - shows what fields are filled/missing */}
                <div className="grid grid-cols-[120px_1fr] gap-2 text-sm items-center">
                  <span className="text-muted-foreground">Display As:</span>
                  {needsDescriptionAndDate ? (
                    /* Description + Date format display (ATO Documents, Other, etc.) */
                    <div className="flex flex-wrap gap-1 text-xs">
                      <span className={cn(
                        "px-2 py-0.5 rounded",
                        companies.find(c => String(c.id) === editedCompanyId)?.code
                          ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                          : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
                      )}>
                        {companies.find(c => String(c.id) === editedCompanyId)?.code || "Company?"}
                      </span>
                      <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                        {getDocumentTypeRecord(editedDocumentType)?.abbreviation ||
                         getDocumentTypesForFolder(editedFolder).find(t => t.value === editedDocumentType)?.abbrev ||
                         "OTH"}
                      </span>
                      <span className={cn(
                        "px-2 py-0.5 rounded",
                        editedDescription
                          ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                          : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
                      )}>
                        {editedDescription || "Description?"}
                      </span>
                      <span className={cn(
                        "px-2 py-0.5 rounded",
                        editedRefDate
                          ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                          : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
                      )}>
                        {editedRefDate ? formatDateForFilename(editedRefDate) : "Date?"}
                      </span>
                    </div>
                  ) : (
                    /* Standard document type display with FY */
                    <div className="flex flex-wrap gap-1 text-xs">
                      <span className={cn(
                        "px-2 py-0.5 rounded",
                        companies.find(c => String(c.id) === editedCompanyId)?.code
                          ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                          : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
                      )}>
                        {companies.find(c => String(c.id) === editedCompanyId)?.code || "Company?"}
                      </span>
                      <span className={cn(
                        "px-2 py-0.5 rounded",
                        editedDocumentType
                          ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                          : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
                      )}>
                        {getDocumentTypesForFolder(editedFolder).find(t => t.value === editedDocumentType)?.label || "Doc Type?"}
                      </span>
                      <span className={cn(
                        "px-2 py-0.5 rounded",
                        editedFinancialYears.length > 0
                          ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                          : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
                      )}>
                        {editedFinancialYears.length > 0
                          ? editedFinancialYears.map(y => y.toString()).join(", ")
                          : "Year?"}
                      </span>
                      {editedDescription && (
                        <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                          {editedDescription}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Divider */}
                <div className="border-t" />

                {/* Actual file rename input */}
                <div className="grid grid-cols-[120px_1fr] gap-2 text-sm items-center">
                  <span className="text-muted-foreground">Rename To:</span>
                  <div className="flex gap-2">
                    <Input
                      value={editedTitle}
                      onChange={(e) => setEditedTitle(e.target.value)}
                      placeholder="File name auto-fills from selections..."
                      className="flex-1 font-mono text-sm"
                    />
                    {document.ai_suggested_name && editedTitle !== document.ai_suggested_name && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setEditedTitle(document.ai_suggested_name || "")}
                        className="whitespace-nowrap text-purple-600 border-purple-300 hover:bg-purple-50"
                      >
                        <Sparkles className="h-3 w-3 mr-1" />
                        Use AI
                      </Button>
                    )}
                  </div>
                </div>
              </div>

              {/* Save button - show when there are changes */}
              {((editedTitle && editedTitle !== document.title) ||
                (editedFolder && editedFolder !== document.folder) ||
                (editedDocumentType && editedDocumentType !== document.document_type) ||
                (editedCompanyId && editedCompanyId !== String(document.company_id || document.company?.id || ""))) && (
                <div className="flex items-center gap-2 pt-2">
                  <Button
                    onClick={handleSave}
                    disabled={saving || !editedTitle.trim()}
                    size="sm"
                    className="bg-green-600 hover:bg-green-700"
                  >
                    {saving ? (
                      <>
                        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Check className="h-3 w-3 mr-1" />
                        Save Changes
                      </>
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setEditedTitle(document.title || "");
                      setEditedFolder(document.folder || "");
                      setEditedDocumentType(document.document_type || "");
                      setEditedCompanyId(String(document.company_id || document.company?.id || ""));
                      setEditedFinancialYears(parseFinancialYears(document.financial_years));
                      setEditedDescription("");
                      setEditedRefDate("");
                      setEditedFiledDate("");
                    }}
                  >
                    Cancel
                  </Button>
                  <span className="text-xs text-muted-foreground">
                    {editedCompanyId !== String(document.company_id || document.company?.id || "")
                      ? "Will move file to new company folder in OneDrive"
                      : editedFolder !== document.folder
                        ? "Will move file in OneDrive"
                        : "Will rename in OneDrive"}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Preview Area */}
          <div
            className="bg-muted rounded-lg overflow-hidden mb-6"
            style={{ minHeight: "400px" }}
          >
            {fileType === "pdf" && document.file_url ? (
              <iframe
                src={document.file_url}
                className="w-full h-[500px]"
                title="Document Preview"
              />
            ) : fileType === "image" && document.file_url ? (
              <div className="flex items-center justify-center p-4">
                <img
                  src={document.file_url}
                  alt={document.title}
                  className="max-w-full max-h-[500px] object-contain"
                />
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-[400px] text-muted-foreground">
                <FileText className="h-16 w-16 mb-4" />
                <p className="text-lg font-medium mb-2">Preview not available</p>
                <p className="text-sm mb-4">
                  {fileType === "word"
                    ? "Word documents"
                    : fileType === "excel"
                    ? "Excel spreadsheets"
                    : "This file type"}{" "}
                  cannot be previewed inline
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

          {/* AI Verification Results */}
          {hasAiSuggestion && (
            <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <div className="flex items-start gap-3">
                <Sparkles className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5" />
                <div className="flex-1">
                  <h4 className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-2">
                    AI Suggests a Better Name
                  </h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground w-20">Current:</span>
                      <span className="font-mono bg-muted px-2 py-1 rounded">
                        {document.title}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground w-20">Suggested:</span>
                      <span className="font-mono text-blue-700 dark:text-blue-300 bg-blue-100 dark:bg-blue-900/50 px-2 py-1 rounded">
                        {document.ai_suggested_name}
                      </span>
                    </div>
                    {document.ai_confidence_score && (
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground w-20">Confidence:</span>
                        <span className="font-medium text-blue-700 dark:text-blue-300">
                          {document.ai_confidence_score}%
                        </span>
                      </div>
                    )}
                    {document.ai_analysis_notes && (
                      <div className="mt-2 text-muted-foreground italic">
                        {document.ai_analysis_notes}
                      </div>
                    )}
                  </div>
                  <div className="mt-3 flex items-center gap-3">
                    <Button
                      onClick={handleApplySuggestion}
                      disabled={applyingSuggestion}
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      <Check className="h-4 w-4 mr-2" />
                      {applyingSuggestion ? "Applying..." : "Apply Suggestion"}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={handleRejectSuggestion}
                      disabled={validating}
                    >
                      {validating ? "Keeping..." : "Keep Current Name"}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* AI Error Status */}
          {aiStatus === "error" && document.ai_analysis_notes && (
            <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400 mt-0.5" />
                <div>
                  <h4 className="text-sm font-medium text-red-800 dark:text-red-200">
                    AI Verification Failed
                  </h4>
                  <p className="text-sm text-red-600 dark:text-red-400 mt-1">
                    {document.ai_analysis_notes}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* AI Processing Status */}
          {isProcessing && (
            <div className="mb-4 p-4 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg">
              <div className="flex items-center gap-3">
                <Loader2 className="h-5 w-5 text-purple-600 dark:text-purple-400 animate-spin" />
                <span className="text-sm font-medium text-purple-800 dark:text-purple-200">
                  AI is analyzing document...
                </span>
              </div>
            </div>
          )}

          {/* Validation Status */}
          {validated ? (
            <div className="flex items-center gap-2 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
              <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
              <span className="text-sm font-medium text-green-800 dark:text-green-200">
                Document naming has been validated
              </span>
            </div>
          ) : (
            !hasAiSuggestion &&
            !isProcessing &&
            !isEditing && (
              <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                <p className="text-sm text-amber-800 dark:text-amber-200 mb-3">
                  Please review the document and confirm the naming is correct.
                </p>
                <div className="flex items-center gap-4">
                  <Button
                    onClick={handleValidate}
                    disabled={validating}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    <Check className="h-4 w-4 mr-2" />
                    {validating ? "Validating..." : "Confirm Naming is Correct"}
                  </Button>
                  {canAiVerify && (
                    <Button
                      variant="outline"
                      onClick={handleAiVerify}
                      disabled={isProcessing}
                      className="text-purple-700 dark:text-purple-300 border-purple-300 hover:bg-purple-100 dark:hover:bg-purple-900/50"
                    >
                      <Sparkles className="h-4 w-4 mr-2" />
                      {isProcessing ? "Verifying..." : "AI Verify"}
                    </Button>
                  )}
                </div>
              </div>
            )
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 bg-muted/50 border-t">
          <div className="text-sm text-muted-foreground">{currentCompanyName}</div>
          <div className="flex items-center gap-3">
            {!isEditing && (
              <Button variant="outline" onClick={startEditing}>
                <Pencil className="h-4 w-4 mr-2" />
                Edit
              </Button>
            )}
            {document.file_url && (
              <Button variant="outline" asChild>
                <a href={document.file_url} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Open
                </a>
              </Button>
            )}
            <Button onClick={() => onOpenChange(false)}>Close</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
