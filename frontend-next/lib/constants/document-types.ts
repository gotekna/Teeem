/**
 * SSoT: Document Type Constants
 *
 * Backend SSoT: DocumentType model scopes (for_company, for_job, for_contacts)
 * - "contacts" is the canonical scope (replaces legacy "people")
 * - "both" applies to company AND job documents
 */

/**
 * Document type scope options
 * These determine which entity type a document type applies to
 */
export const DOCUMENT_TYPE_SCOPES = [
  { value: "company", label: "Company", description: "Corporate documents" },
  { value: "job", label: "Job", description: "Construction/job documents" },
  { value: "contacts", label: "Contacts", description: "Contact documents (licenses, insurance, etc.)" },
  { value: "both", label: "Both", description: "Used for both company and job" },
] as const;

/**
 * Get scope label by value
 */
export function getScopeLabel(value: string): string {
  const scope = DOCUMENT_TYPE_SCOPES.find(s => s.value === value);
  return scope?.label || value;
}

/**
 * Document folder options
 * These are the standard folders for organizing corporate documents
 * SSoT: Should eventually come from backend/database
 */
export const DOCUMENT_FOLDER_OPTIONS = [
  "ADVICE", "ASIC", "ASSETS", "ATO", "BANK", "COMPANY",
  "DIVIDENDS", "FINANCIALS", "GENERAL", "INSURANCE",
  "LOANS", "MINUTES", "REGISTRY", "TRUST"
] as const;
