// Pure helper functions for the ClassificationPanel component
import type { ClassificationDocumentType } from "@/lib/types/classification-types";

// Find a document type record by slug, name, or abbreviation
export function getDocumentTypeRecord(
  docTypeName: string | undefined | null,
  documentTypes: ClassificationDocumentType[]
): ClassificationDocumentType | undefined {
  if (!docTypeName) return undefined;
  const lower = docTypeName.toLowerCase();
  const slug = lower.replace(/\s+/g, "_");
  return documentTypes.find(
    (dt) =>
      dt.name.toLowerCase() === lower ||
      dt.name.toLowerCase().replace(/\s+/g, "_") === slug ||
      dt.abbreviation?.toLowerCase() === lower
  );
}

// Determine which fields are auto-derived from a doc type's templates
export function getAutoFields(
  docTypeName: string | undefined | null,
  documentTypes: ClassificationDocumentType[]
): { folder: boolean; uiName: boolean; dlName: boolean } {
  const dt = getDocumentTypeRecord(docTypeName, documentTypes);
  return {
    folder: !!dt?.target_folder,
    uiName: !!dt?.uiName,
    dlName: !!dt?.downloadName,
  };
}

// Parse financial years from various formats into number[]
export function parseFinancialYears(
  fy: number[] | string | undefined | null
): number[] {
  if (!fy) return [];
  if (Array.isArray(fy)) return fy;
  if (typeof fy === "string") {
    try {
      const parsed = JSON.parse(fy);
      if (Array.isArray(parsed)) return parsed.map(Number).filter((n) => !isNaN(n));
    } catch {
      // Try comma-separated
      return fy
        .split(",")
        .map((s) => parseInt(s.trim(), 10))
        .filter((n) => !isNaN(n));
    }
  }
  return [];
}

// Generate FY options for the last N years
export function generateFYOptions(count = 10): { value: number; label: string }[] {
  const currentYear = new Date().getFullYear();
  const options: { value: number; label: string }[] = [];
  for (let i = 0; i < count; i++) {
    const year = currentYear - i;
    options.push({
      value: year,
      label: `FY${String(year).slice(-2)}/${String(year + 1).slice(-2)}`,
    });
  }
  return options;
}
