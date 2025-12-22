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
 * - LONG: {CodeLong} → "Tekna Homes" (for display, human-readable)
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
  /** Example value for long code, e.g., "Tekna Homes" */
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

export type PlaceholderScope = "company" | "job" | "document" | "sharepoint" | "all";

// =============================================================================
// COMPANY PLACEHOLDERS (Purple)
// =============================================================================

export const COMPANY_PLACEHOLDERS: PlaceholderToken[] = [
  {
    code: "{CompanyCode}",
    example: "TH",
    longCode: "{CompanyName}",
    longExample: "Tekna Homes",
    color: "purple",
    description: "Company abbreviation/code",
  },
  {
    code: "{CompanyGroup}",
    example: "Tekna Group",
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
    code: "{BankNumber}",
    example: "12345678",
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
];

// =============================================================================
// JOB PLACEHOLDERS (Orange)
// =============================================================================

export const JOB_PLACEHOLDERS: PlaceholderToken[] = [
  {
    code: "{JobCode}",
    example: "J069",
    color: "orange",
    description: "Job code/number",
  },
  {
    code: "{JobTitle}",
    example: "83 West Ridge",
    color: "orange",
    description: "Job title/name",
  },
  {
    code: "{CertType}",
    example: "Occupancy",
    color: "orange",
    description: "Certificate type",
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
    example: "Plans",
    color: "orange",
    description: "Document category",
  },
];

// =============================================================================
// DOCUMENT PLACEHOLDERS (Blue)
// =============================================================================

export const DOCUMENT_PLACEHOLDERS: PlaceholderToken[] = [
  {
    code: "{DocTypeCode}",
    example: "ASIC",
    longCode: "{DocTypeName}",
    longExample: "ASIC Documents",
    color: "blue",
    description: "Document type code/name",
  },
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
// SHAREPOINT PLACEHOLDERS (Used with {{double braces}})
// =============================================================================

export const SHAREPOINT_PLACEHOLDERS: PlaceholderToken[] = [
  {
    code: "{{JobCode}}",
    example: "J069",
    color: "orange",
    description: "Job code for SharePoint paths",
  },
  {
    code: "{{Category}}",
    example: "Plans",
    color: "orange",
    description: "Document category",
  },
  {
    code: "{{CompanyGroup}}",
    example: "Tekna Group",
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
    code: "{{Folder}}",
    example: "Finance",
    color: "blue",
    description: "Folder name",
  },
  {
    code: "{{ContactName}}",
    example: "John Smith",
    color: "gray",
    description: "Contact name",
  },
];

// =============================================================================
// COMBINED EXPORTS BY SCOPE
// =============================================================================

export const PLACEHOLDERS_BY_SCOPE: Record<PlaceholderScope, PlaceholderToken[]> = {
  company: [...COMPANY_PLACEHOLDERS, ...DATE_PLACEHOLDERS],
  job: [...JOB_PLACEHOLDERS, ...DATE_PLACEHOLDERS],
  document: [...DOCUMENT_PLACEHOLDERS],
  sharepoint: SHAREPOINT_PLACEHOLDERS,
  all: [
    ...DOCUMENT_PLACEHOLDERS,
    ...COMPANY_PLACEHOLDERS,
    ...JOB_PLACEHOLDERS,
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
 */
export function resolveWithExamples(
  template: string,
  useLongVariants: boolean = false
): string {
  let result = template;
  const allPlaceholders = PLACEHOLDERS_BY_SCOPE.all;

  allPlaceholders.forEach((p) => {
    if (useLongVariants && p.longCode && p.longExample) {
      result = result.replace(new RegExp(escapeRegex(p.longCode), "g"), p.longExample);
    }
    result = result.replace(new RegExp(escapeRegex(p.code), "g"), p.example);
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
