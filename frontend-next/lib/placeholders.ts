/**
 * PLACEHOLDERS - THE SINGLE SOURCE OF TRUTH
 *
 * This file defines ALL placeholder tokens used in template builders across TEEEM.
 * Used by: DocumentType file naming, SharePoint paths, email templates, etc.
 *
 * See: frontend-next/lib/component-registry.ts
 *
 * Placeholder Format:
 * - SHORT: {Code} → "TH" (for file names, compact)
 * - LONG: {CodeLong} → "Teeem Homes" (for display, human-readable)
 */

// =============================================================================
// TYPES
// =============================================================================

export interface PlaceholderToken {
  /** Short code, e.g., "{CompanyCode}" */
  code: string;
  /** Example value for short code, e.g., "TH" */
  example: string;
  /** Long code variant (optional), e.g., "{CompanyName}" */
  longCode?: string;
  /** Example value for long code, e.g., "Teeem Homes" */
  longExample?: string;
  /** Display label (optional), overrides code for display */
  label?: string;
  /** Color for the token badge */
  color: PlaceholderColor;
  /** Description of what this placeholder represents */
  description?: string;
}

export type PlaceholderColor =
  | "purple"  // Company-related
  | "orange"  // Job-related
  | "blue"    // Document-related
  | "green"   // Date-related
  | "gray";   // Other

export type PlaceholderScope = "company" | "job" | "document" | "storage" | "all";

// =============================================================================
// COMPANY PLACEHOLDERS (Purple)
// =============================================================================

export const COMPANY_PLACEHOLDERS: PlaceholderToken[] = [
  {
    code: "{CompanyCode}",
    example: "TH",
    longCode: "{CompanyName}",
    longExample: "Teeem Homes",
    color: "purple",
    description: "Company abbreviation/code",
  },
  {
    code: "{CompanyGroup}",
    example: "Teeem Group",
    color: "purple",
    description: "Parent company group name",
  },
  {
    code: "{LoanID}",
    example: "L001",
    longCode: "{LoanName}",
    longExample: "Loan to ABC Trust",
    color: "purple",
    description: "Loan identifier",
  },
  {
    code: "{AssetCode}",
    example: "PROP1",
    longCode: "{AssetName}",
    longExample: "123 Main Street",
    color: "purple",
    description: "Asset code/address",
  },
  {
    code: "{LenderCode}",
    example: "ABC",
    longCode: "{LenderName}",
    longExample: "ABC Property Trust",
    color: "purple",
    description: "Lender identifier",
  },
  {
    code: "{BankCode}",
    example: "NAB",
    color: "purple",
    description: "Bank code",
  },
  {
    code: "{BSB}",
    example: "082-123",
    color: "purple",
    description: "Bank BSB number",
  },
  {
    code: "{AccountNum}",
    example: "12345678",
    longCode: "{AccountNumber}",
    longExample: "12345678",
    color: "purple",
    description: "Bank account number",
  },
  {
    code: "{PersonCode}",
    example: "RH",
    longCode: "{PersonName}",
    longExample: "Robert Harder",
    color: "purple",
    description: "Person code/name",
  },
];

// =============================================================================
// DATE PLACEHOLDERS (Green)
// =============================================================================

export const DATE_PLACEHOLDERS: PlaceholderToken[] = [
  {
    code: "{FY}",
    label: "FY{FY}",
    example: "FY25",
    color: "green",
    description: "Financial year",
  },
  {
    code: "{Period}",
    example: "Q1",
    longCode: "{PeriodLong}",
    longExample: "Q1 Jul-Sep",
    color: "green",
    description: "Period/quarter",
  },
  {
    code: "{Year}",
    example: "25",
    longCode: "{YearLong}",
    longExample: "2025",
    color: "green",
    description: "Year (2 or 4 digit)",
  },
  {
    code: "{Day}",
    example: "09",
    longCode: "{DayLong}",
    longExample: "9th",
    color: "green",
    description: "Day of month",
  },
  {
    code: "{Month}",
    example: "01",
    longCode: "{MonthLong}",
    longExample: "January",
    color: "green",
    description: "Month (number or name)",
  },
  {
    code: "{MonthYear}",
    example: "Oct-25",
    longCode: "{MonthYearLong}",
    longExample: "October 2025",
    color: "green",
    description: "Month and year",
  },
  {
    code: "{YYYYMMDD}",
    example: "2025-10-09",
    longCode: "{DateISO}",
    longExample: "2025-10-09",
    color: "green",
    description: "ISO date format",
  },
  {
    code: "{DDMMYYYY}",
    example: "09-10-2025",
    longCode: "{DateAU}",
    longExample: "9 October 2025",
    color: "green",
    description: "Australian date format",
  },
  {
    code: "{Date}",
    example: "9-12-25",
    color: "green",
    description: "Short date",
  },
  {
    code: "{EX}",
    example: "EX 15/12/25",
    longCode: "{Expiry}",
    longExample: "Expiry 15 December 2025",
    color: "green",
    description: "Expiry date",
  },
  {
    code: "{Time}",
    example: "14:30",
    longCode: "{TimeLong}",
    longExample: "2:30 PM",
    color: "green",
    description: "Time (24h or 12h format)",
  },
  {
    code: "{DateTime}",
    example: "27-12-25 14:30",
    longCode: "{DateTimeLong}",
    longExample: "27 December 2025 2:30 PM",
    color: "green",
    description: "Date and time combined",
  },
  {
    code: "{UserDateTime}",
    example: "RH 27-12-25 14:30",
    longCode: "{UserDateTimeLong}",
    longExample: "Robert Harder 27-12-2025 14:30",
    color: "green",
    description: "User code/name with date and time",
  },
];

// =============================================================================
// JOB PLACEHOLDERS (Orange)
// =============================================================================

export const JOB_PLACEHOLDERS: PlaceholderToken[] = [
  {
    code: "{JobCode}",
    example: "EB2401",
    color: "orange",
    description: "Job code/number",
  },
  {
    code: "{JobName}",
    example: "05 Wategors",
    color: "orange",
    description: "Job name/title (short)",
  },
  {
    code: "{JobTitle}",
    example: "83 West Ridge",
    color: "orange",
    description: "Job title (full)",
  },
  {
    code: "{JobAddress}",
    example: "Lot 5 Wategois Street Claamvale",
    color: "orange",
    description: "Full job address",
  },
  {
    code: "{LotNumber}",
    example: "5",
    color: "orange",
    description: "Lot number",
  },
  {
    code: "{StreetName}",
    example: "Wategois Street",
    color: "orange",
    description: "Street name",
  },
  {
    code: "{Suburb}",
    example: "Claamvale",
    color: "orange",
    description: "Suburb",
  },
  {
    code: "{ProjectName}",
    example: "Wategors Estate",
    color: "orange",
    description: "Project name",
  },
  {
    code: "{BA}",
    example: "BA",
    longCode: "{BuildingApproval}",
    longExample: "Building Approval",
    color: "orange",
    description: "Building Approval certificate",
  },
  {
    code: "{FIA}",
    example: "FIA",
    longCode: "{FinalInspectionCertificate}",
    longExample: "Final Inspection Certificate",
    color: "orange",
    description: "Final Inspection Certificate",
  },
  {
    code: "{Occ}",
    example: "Occ",
    longCode: "{CertificateOfOccupancy}",
    longExample: "Certificate of Occupancy",
    color: "orange",
    description: "Certificate of Occupancy",
  },
  {
    code: "{FormNumber}",
    example: "Form 15",
    color: "orange",
    description: "Form number based on dwelling type (configurable mapping)",
  },
  {
    code: "{DwellingType}",
    example: "Class 1A",
    color: "orange",
    description: "Dwelling type classification (e.g., Class 1A, Class 2)",
  },
  {
    code: "{Consultant}",
    example: "ABC Eng",
    color: "orange",
    description: "Consultant name",
  },
  {
    code: "{Number}",
    example: "01",
    color: "orange",
    description: "Sequential number",
  },
  {
    code: "{Category}",
    example: "Contract Drawings",
    color: "orange",
    description: "Document category",
  },
  {
    code: "{CategoryCode}",
    example: "ConD",
    color: "orange",
    description: "Category code (short)",
  },
];

// =============================================================================
// TAB PLACEHOLDERS (Orange - the tab/folder context for documents)
// =============================================================================

export const TAB_PLACEHOLDERS: PlaceholderToken[] = [
  {
    code: "{TabCode}",
    example: "Site",
    longCode: "{TabName}",
    longExample: "Site Photo",
    color: "orange",
    description: "Tab/folder code and name",
  },
];

// =============================================================================
// PLAN TYPE PLACEHOLDERS (Blue - specific to plans/drawings)
// =============================================================================

export const PLAN_PLACEHOLDERS: PlaceholderToken[] = [
  {
    code: "{Code}",
    example: "01",
    color: "blue",
    description: "Plan type code (01, 02, 07, etc.)",
  },
  {
    code: "{Name}",
    example: "PERSPECTIVE",
    color: "blue",
    description: "Plan type name (short)",
  },
  {
    code: "{Rev}",
    example: "A",
    color: "blue",
    description: "Revision letter/number",
  },
  {
    code: "{Variant}",
    example: "a",
    color: "blue",
    description: "Variant suffix (a, b, c)",
  },
];

// =============================================================================
// DOCUMENT PLACEHOLDERS (Blue)
// =============================================================================

export const DOCUMENT_PLACEHOLDERS: PlaceholderToken[] = [
  // NOTE: {DocTypeCode} and {DocTypeName} are added DYNAMICALLY in the document type editor
  // based on the current document type being edited. Do NOT add them here to avoid duplicates.
  {
    code: "{Description}",
    example: "Example",
    color: "blue",
    description: "Document description",
  },
  {
    code: "{Folder}",
    example: "ATO",
    color: "blue",
    description: "Folder name",
  },
];

// =============================================================================
// STORAGE PLACEHOLDERS (Used with {{double braces}} for folder paths)
// =============================================================================

export const STORAGE_PLACEHOLDERS: PlaceholderToken[] = [
  // Job-related tokens
  {
    code: "{{JobCode}}",
    example: "J069",
    color: "orange",
    description: "Job code for storage paths",
  },
  {
    code: "{{JobName}}",
    example: "05 Wategors",
    color: "orange",
    description: "Job name/title (short)",
  },
  {
    code: "{{JobTitle}}",
    example: "83 West Ridge",
    color: "orange",
    description: "Job title (full)",
  },
  {
    code: "{{JobAddress}}",
    example: "Lot 5 Wategois Street",
    color: "orange",
    description: "Full job address",
  },
  {
    code: "{{LotNumber}}",
    example: "5",
    color: "orange",
    description: "Lot number",
  },
  {
    code: "{{StreetName}}",
    example: "Wategois Street",
    color: "orange",
    description: "Street name",
  },
  {
    code: "{{Suburb}}",
    example: "Claamvale",
    color: "orange",
    description: "Suburb",
  },
  {
    code: "{{TaskId}}",
    example: "T-001",
    color: "orange",
    description: "Task identifier for storage paths",
  },
  {
    code: "{{TaskNumber}}",
    example: "001",
    color: "orange",
    description: "Task number (sequential)",
  },
  {
    code: "{{TaskName}}",
    example: "Framing Inspection",
    color: "orange",
    description: "Task name/title",
  },
  {
    code: "{{TaskStatus}}",
    example: "In Progress",
    color: "orange",
    description: "Task status",
  },
  // Task folder suffix tokens (literal folder names)
  {
    code: "[[Attachments]]",
    example: "Attachments",
    color: "orange",
    description: "Attachments folder (literal)",
  },
  {
    code: "[[Responses]]",
    example: "Responses",
    color: "orange",
    description: "Responses folder (literal)",
  },
  // Email folder suffix tokens (literal folder names)
  {
    code: "[[Email Body]]",
    example: "Email Body",
    color: "blue",
    description: "Email Body folder (literal)",
  },
  {
    code: "[[Email Attachments]]",
    example: "Email Attachments",
    color: "blue",
    description: "Email Attachments folder (literal)",
  },
  // Task Attachments tokens
  {
    code: "{{AttachmentName}}",
    example: "site-photo.jpg",
    color: "orange",
    description: "Original attachment filename",
  },
  {
    code: "{{AttachmentType}}",
    example: "Photo",
    color: "orange",
    description: "Attachment type (Photo, Document, etc.)",
  },
  // Task Responses tokens
  {
    code: "{{ResponseBy}}",
    example: "John Smith",
    color: "orange",
    description: "Who submitted the response",
  },
  {
    code: "{{ResponseDate}}",
    example: "2026-01-26",
    color: "green",
    description: "Response submission date",
  },
  {
    code: "{{ResponseText}}",
    example: "Approved with notes",
    color: "blue",
    description: "Response text/comment",
  },
  {
    code: "{{Category}}",
    example: "Plans",
    color: "orange",
    description: "Document category",
  },
  {
    code: "{{CompanyGroup}}",
    example: "Teeem Group",
    color: "purple",
    description: "Company group name",
  },
  {
    code: "{{CompanyCode}}",
    example: "TH",
    color: "purple",
    description: "Company code",
  },
  {
    code: "{{CompanyName}}",
    example: "Teeem Homes Pty Ltd",
    color: "purple",
    description: "Company name (full)",
  },
  // Literal folder names use [[...]] syntax (not dynamic placeholders)
  {
    code: "[[TeeemXL]]",
    example: "TeeemXL",
    color: "blue",
    description: "TeeemXL folder (literal)",
  },
  {
    code: "[[TeeemDocs]]",
    example: "TeeemDocs",
    color: "blue",
    description: "TeeemDocs folder (literal)",
  },
  {
    code: "[[TeeemNotes]]",
    example: "TeeemNotes",
    color: "blue",
    description: "TeeemNotes folder (literal)",
  },
  {
    code: "[[TeeemWord]]",
    example: "TeeemWord",
    color: "blue",
    description: "TeeemWord folder (literal)",
  },
  {
    code: "[[TeeemPDF]]",
    example: "TeeemPDF",
    color: "blue",
    description: "TeeemPDF folder (literal)",
  },
  {
    code: "[[TeeemPPT]]",
    example: "TeeemPPT",
    color: "blue",
    description: "TeeemPPT folder (literal)",
  },
  {
    code: "[[TeeemTemplates]]",
    example: "TeeemTemplates",
    color: "blue",
    description: "TeeemTemplates folder (literal)",
  },
  {
    code: "{{SubTabName}}",
    example: "Photos",
    color: "blue",
    description: "Subtab name (use for child tabs)",
  },
  {
    code: "{{ContactName}}",
    example: "John Smith",
    color: "gray",
    description: "Contact name",
  },
  // File name specific placeholders
  {
    code: "{{OriginalFileName}}",
    example: "Invoice.pdf",
    color: "blue",
    description: "Original uploaded file name",
  },
  {
    code: "{{Date}}",
    example: "2025-01-12",
    color: "green",
    description: "Upload date (YYYY-MM-DD)",
  },
  {
    code: "{{Year}}",
    example: "2025",
    color: "green",
    description: "Year (4 digit)",
  },
  {
    code: "{{Month}}",
    example: "01",
    color: "green",
    description: "Month (2 digit)",
  },
  {
    code: "{{UploadedBy}}",
    example: "RH",
    color: "gray",
    description: "User code who uploaded",
  },
  {
    code: "{{Sequence}}",
    example: "001",
    color: "gray",
    description: "Sequential number",
  },
  {
    code: "{{UserCode}}",
    example: "RH",
    color: "gray",
    description: "User code (initials)",
  },
  {
    code: "{{UserName}}",
    example: "Robert Harder",
    color: "gray",
    description: "Full user name",
  },
  {
    code: "{{Mailbox}}",
    example: "robert@teeem.com.au",
    color: "gray",
    description: "Email mailbox address",
  },
  {
    code: "{{Subject}}",
    example: "RE Invoice Question",
    color: "blue",
    description: "Email subject line (sanitized for folder names)",
  },
  {
    code: "{{ReceivedTime}}",
    example: "14-30",
    color: "green",
    description: "Time email was received (HH-MM)",
  },
  {
    code: "{{SenderName}}",
    example: "John Smith",
    color: "blue",
    description: "Email sender's display name",
  },
  {
    code: "{{SenderEmail}}",
    example: "john@example.com",
    color: "blue",
    description: "Email sender's address",
  },
  {
    code: "{{ReceivedDate}}",
    example: "2026-01-30",
    color: "green",
    description: "Date email was received (YYYY-MM-DD)",
  },
  // Case tokens
  {
    code: "{{CaseId}}",
    example: "C-001",
    color: "purple",
    description: "Case identifier",
  },
  {
    code: "{{CaseName}}",
    example: "Insurance Claim",
    color: "purple",
    description: "Case name/title",
  },
  // Asset tokens
  {
    code: "{{AssetName}}",
    example: "Forklift-01",
    color: "purple",
    description: "Asset name/identifier",
  },
  {
    code: "{{AssetId}}",
    example: "A-001",
    color: "purple",
    description: "Asset ID",
  },
  // Template tokens
  {
    code: "{{TemplateType}}",
    example: "Contract",
    color: "blue",
    description: "Template type/category",
  },
  {
    code: "{{TemplateName}}",
    example: "Standard Agreement",
    color: "blue",
    description: "Template name",
  },
  // Chat/Context tokens
  {
    code: "{{Context}}",
    example: "Job-123",
    color: "gray",
    description: "Chat context reference",
  },
  // Bill/Invoice tokens
  {
    code: "{{Status}}",
    example: "Pending",
    color: "gray",
    description: "Status (Pending, Approved, etc.)",
  },
  // Notebook tokens
  {
    code: "{{NotebookName}}",
    example: "Work Notes",
    color: "blue",
    description: "Notebook name",
  },
  // Folder token (generic)
  {
    code: "{{Folder}}",
    example: "Documents",
    color: "blue",
    description: "Folder/category name",
  },
];

// Backwards compatibility alias
export const SHAREPOINT_PLACEHOLDERS = STORAGE_PLACEHOLDERS;

// =============================================================================
// COMBINED EXPORTS BY SCOPE
// =============================================================================

export const PLACEHOLDERS_BY_SCOPE: Record<PlaceholderScope, PlaceholderToken[]> = {
  company: [...COMPANY_PLACEHOLDERS, ...DATE_PLACEHOLDERS],
  job: [...JOB_PLACEHOLDERS, ...TAB_PLACEHOLDERS, ...PLAN_PLACEHOLDERS, ...DATE_PLACEHOLDERS],
  document: [...DOCUMENT_PLACEHOLDERS, ...TAB_PLACEHOLDERS, ...PLAN_PLACEHOLDERS],
  storage: STORAGE_PLACEHOLDERS,
  all: [
    ...DOCUMENT_PLACEHOLDERS,
    ...COMPANY_PLACEHOLDERS,
    ...JOB_PLACEHOLDERS,
    ...TAB_PLACEHOLDERS,
    ...PLAN_PLACEHOLDERS,
    ...DATE_PLACEHOLDERS,
  ],
};

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Get all placeholders for a given scope
 */
export function getPlaceholders(scope: PlaceholderScope = "all"): PlaceholderToken[] {
  return PLACEHOLDERS_BY_SCOPE[scope] || PLACEHOLDERS_BY_SCOPE.all;
}

/**
 * Get placeholder by code
 */
export function getPlaceholderByCode(code: string): PlaceholderToken | undefined {
  const allPlaceholders = PLACEHOLDERS_BY_SCOPE.all;
  return allPlaceholders.find(
    (p) => p.code === code || p.longCode === code
  );
}

/**
 * Get the color for a placeholder code
 */
export function getPlaceholderColor(code: string): PlaceholderColor {
  const placeholder = getPlaceholderByCode(code);
  return placeholder?.color || "gray";
}

/**
 * Convert SHORT placeholder to LONG variant
 */
export function getShortToLongMap(): Record<string, string> {
  const map: Record<string, string> = {};
  PLACEHOLDERS_BY_SCOPE.all.forEach((p) => {
    if (p.longCode) {
      map[p.code] = p.longCode;
    }
  });
  return map;
}

/**
 * Convert LONG placeholder to SHORT variant
 */
export function getLongToShortMap(): Record<string, string> {
  const map: Record<string, string> = {};
  PLACEHOLDERS_BY_SCOPE.all.forEach((p) => {
    if (p.longCode) {
      map[p.longCode] = p.code;
    }
  });
  return map;
}

/**
 * Resolve placeholders in a template string with example values
 *
 * @param template - The template string with {placeholders}
 * @param useLongVariants - If true, prefer long examples for all replacements
 */
export function resolveWithExamples(
  template: string,
  useLongVariants: boolean = false
): string {
  let result = template;
  const allPlaceholders = PLACEHOLDERS_BY_SCOPE.all;

  allPlaceholders.forEach((p) => {
    // Always replace long codes with long examples (if they exist in template)
    if (p.longCode && p.longExample) {
      result = result.replace(new RegExp(escapeRegex(p.longCode), "g"), p.longExample);
    }
    // Replace short codes - use long example if useLongVariants is true
    const exampleValue = useLongVariants && p.longExample ? p.longExample : p.example;
    result = result.replace(new RegExp(escapeRegex(p.code), "g"), exampleValue);
  });

  return result;
}

/**
 * Parse a template string into tokens (placeholders and text)
 */
export function parseTemplate(template: string): Array<{ type: "placeholder" | "text"; value: string }> {
  const tokens: Array<{ type: "placeholder" | "text"; value: string }> = [];
  // Match both {single} and {{double}} brace placeholders
  const regex = /(\{\{[^}]+\}\}|\{[^}]+\})/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(template)) !== null) {
    // Add text before this match
    if (match.index > lastIndex) {
      tokens.push({
        type: "text",
        value: template.slice(lastIndex, match.index),
      });
    }
    // Add the placeholder
    tokens.push({
      type: "placeholder",
      value: match[1],
    });
    lastIndex = regex.lastIndex;
  }

  // Add remaining text
  if (lastIndex < template.length) {
    tokens.push({
      type: "text",
      value: template.slice(lastIndex),
    });
  }

  return tokens;
}

/**
 * Build template string from tokens
 */
export function buildTemplate(tokens: Array<{ type: "placeholder" | "text"; value: string }>): string {
  return tokens.map((t) => t.value).join("");
}

// Helper to escape regex special characters
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Resolve SharePoint path placeholders with example values
 * Handles both {{double}} and {single} brace formats
 *
 * IMPORTANT: Use REAL examples from the database, not made-up values!
 *
 * @param template - The SharePoint path template
 * @returns Resolved path with example values
 */
export function resolveStoragePath(template: string): string {
  if (!template) return "";

  let result = template;

  // Real examples from TEEEM database
  const examples: Record<string, string> = {
    // Double brace format - Job examples
    "{{JobCode}}": "077",
    "{{Category}}": "Contract Drawings",
    "{{CategoryCode}}": "ConD",
    "{{JobName}}": "Tulum Street Jimboomba",
    "{{JobTitle}}": "Tulum Street Jimboomba QLD",
    // Double brace format - Company examples
    "{{CompanyGroup}}": "Teeem Group",
    "{{CompanyCode}}": "TH",
    "{{CompanyName}}": "Teeem Homes Pty Ltd",
    // Literal folder names [[...]] - strips brackets
    "[[TeeemXL]]": "TeeemXL",
    "[[TeeemDocs]]": "TeeemDocs",
    "[[TeeemNotes]]": "TeeemNotes",
    "[[TeeemWord]]": "TeeemWord",
    "[[TeeemPDF]]": "TeeemPDF",
    "[[TeeemPPT]]": "TeeemPPT",
    "[[TeeemTemplates]]": "TeeemTemplates",
    "[[Attachments]]": "Attachments",
    "[[Responses]]": "Responses",
    "[[Email Body]]": "Email Body",
    "[[Email Attachments]]": "Email Attachments",
    "{{SubTabName}}": "Photos",
    "{{ContactName}}": "Robert Harder",
    "{{EntityName}}": "Teeem Homes Pty Ltd",
    // Single brace format (also common in paths)
    "{JobCode}": "077",
    "{Category}": "Contract Drawings",
    "{CategoryCode}": "ConD",
    "{JobName}": "Tulum Street Jimboomba",
    "{JobTitle}": "Tulum Street Jimboomba QLD",
    // Single bracket literal folder names
    "[TeeemXL]": "TeeemXL",
    "[TeeemDocs]": "TeeemDocs",
    "[TeeemNotes]": "TeeemNotes",
    "[TeeemWord]": "TeeemWord",
    "[TeeemPDF]": "TeeemPDF",
    "[TeeemPPT]": "TeeemPPT",
    "[TeeemTemplates]": "TeeemTemplates",
    "{SubTabName}": "Photos",
    "{CompanyGroup}": "Teeem Group",
    "{CompanyCode}": "TH",
    "{CompanyName}": "Teeem Homes Pty Ltd",
  };

  // Replace all placeholders with examples
  Object.entries(examples).forEach(([placeholder, example]) => {
    result = result.replace(new RegExp(escapeRegex(placeholder), "g"), example);
  });

  return result;
}

// =============================================================================
// COLOR UTILITY
// =============================================================================

export const PLACEHOLDER_COLOR_CLASSES: Record<PlaceholderColor, { bg: string; text: string; border: string }> = {
  purple: {
    bg: "bg-purple-100 dark:bg-purple-900/30",
    text: "text-purple-700 dark:text-purple-300",
    border: "border-purple-300 dark:border-purple-700",
  },
  orange: {
    bg: "bg-orange-100 dark:bg-orange-900/30",
    text: "text-orange-700 dark:text-orange-300",
    border: "border-orange-300 dark:border-orange-700",
  },
  blue: {
    bg: "bg-blue-100 dark:bg-blue-900/30",
    text: "text-blue-700 dark:text-blue-300",
    border: "border-blue-300 dark:border-blue-700",
  },
  green: {
    bg: "bg-green-100 dark:bg-green-900/30",
    text: "text-green-700 dark:text-green-300",
    border: "border-green-300 dark:border-green-700",
  },
  gray: {
    bg: "bg-gray-100 dark:bg-gray-800",
    text: "text-gray-700 dark:text-gray-300",
    border: "border-gray-300 dark:border-gray-600",
  },
};
