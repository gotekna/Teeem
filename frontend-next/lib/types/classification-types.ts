// Shared types for the ClassificationPanel component
// Used by DocumentEditModal (Company Docs) and DocSort page

export interface ClassificationCompany {
  id: number;
  name: string;
  code?: string;
  bas_frequency?: "quarterly" | "monthly";
}

export interface ClassificationDocumentType {
  id: number;
  name: string;
  abbreviation?: string;
  primary_folder_path?: string;
  target_folder?: string;
  uiName?: string;
  downloadName?: string;
  scope?: string;
}

export interface ClassificationBreakdown {
  document_type: string | null;
  confidence: number;
  signals: string[];
  text_preview?: string;
  status: string;
  duration_ms?: number;
  suggested_folder?: string;
  suggested_name?: string;
  // Resolved fields from doc type config
  resolved_folder?: string | null;
  resolved_ui_name?: string | null;
  resolved_dl_name?: string | null;
}

export interface ClassificationData {
  success: boolean;
  has_classification: boolean;
  winner?: string;
  current?: {
    resolved_folder?: string | null;
    resolved_ui_name?: string | null;
    resolved_dl_name?: string | null;
  };
  ocr: ClassificationBreakdown;
  ai: ClassificationBreakdown;
  name_match: ClassificationBreakdown;
  classified_at?: string;
}

// Normalized document shape that works for both WarehouseDocument and DocumentInboxItem
export interface ClassificationDocument {
  id: number | string;
  document_type?: string;
  folder?: string;
  folder_path?: string;
  display_name?: string;
  download_name?: string;
  file_name?: string;
  company_id?: number;
  company?: { id: number; name: string; code?: string; bas_frequency?: "quarterly" | "monthly" };
  financial_years?: number[] | string;
  ref_date?: string;
  source?: string;
  // AI fields
  ai_suggested_type?: string;
  ai_suggested_name?: string;
  ai_suggested_folder?: string;
  ai_suggested_fy?: number[] | string;
  ai_confidence_score?: number;
  ai_extracted_description?: string;
  ai_extracted_date?: string;
  ai_verification_status?: string;
  // Validation
  user_validated_at?: string;
  user_validated_by_name?: string;
}
