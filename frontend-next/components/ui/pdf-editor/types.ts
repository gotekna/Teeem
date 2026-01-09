// PDF Editor Types

export interface PDFPage {
  id: string;
  pageIndex: number;
  thumbnail: string; // base64 data URL
  width: number;
  height: number;
  annotations: Annotation[];
}

export interface Annotation {
  id: string;
  type: "draw" | "text" | "highlight" | "rectangle" | "circle" | "arrow" | "stamp";
  data: any; // Fabric.js object data
  pageId: string;
}

export interface PDFEditorState {
  pages: PDFPage[];
  selectedPageId: string | null;
  currentTool: AnnotationTool;
  zoom: number;
  isDirty: boolean;
}

export type AnnotationTool =
  | "select"
  | "draw"
  | "text"
  | "highlight"
  | "rectangle"
  | "circle"
  | "arrow"
  | "stamp"
  | "eraser"
  // E-signature field tools
  | "signature_field"
  | "initials_field"
  | "date_field"
  | "text_field";

export interface ToolbarProps {
  currentTool: AnnotationTool;
  onToolChange: (tool: AnnotationTool) => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  zoom: number;
  onZoomChange: (zoom: number) => void;
  strokeColor: string;
  onStrokeColorChange: (color: string) => void;
  strokeWidth: number;
  onStrokeWidthChange: (width: number) => void;
  onSave: () => void;
  onMerge: () => void;
  isSaving: boolean;
  // E-signature mode
  esignMode?: boolean;
  selectedSigner?: Signer | null;
}

export interface PageThumbnailProps {
  page: PDFPage;
  isSelected: boolean;
  onSelect: () => void;
  onDelete: () => void;
  isDragging?: boolean;
}

export interface PDFEditorProps {
  url: string;
  fileName?: string;
  onSave?: (pdfBytes: Uint8Array, fileName: string) => Promise<void>;
  onClose?: () => void;
  className?: string;
  // E-signature mode props
  esignMode?: boolean;
  signers?: Signer[];
  signatureFields?: SignatureField[];
  onSignersChange?: (signers: Signer[]) => void;
  onFieldsChange?: (fields: SignatureField[]) => void;
}

// ============================================================================
// E-Signature Types
// ============================================================================

/**
 * Predefined colors for distinguishing signers visually
 */
export const SIGNER_COLORS = [
  "#3B82F6", // Blue
  "#10B981", // Green
  "#F59E0B", // Amber
  "#EF4444", // Red
  "#8B5CF6", // Purple
  "#EC4899", // Pink
  "#06B6D4", // Cyan
  "#F97316", // Orange
] as const;

/**
 * A signer who needs to complete signature fields
 */
export interface Signer {
  id: string;
  email: string;
  name?: string;
  color: string;
  order: number; // Signing order (0 = parallel, 1+ = sequential)
}

/**
 * Field types that can be placed on a document for signing
 */
export type SignatureFieldType = "signature" | "initials" | "date" | "text";

/**
 * A signature field placed on a PDF page
 * Positions are stored as percentages (0-100) for PDF scaling independence
 */
export interface SignatureField {
  id: string;
  type: SignatureFieldType;
  pageId: string;
  pageNumber: number;
  signerId: string; // Which signer completes this field
  signerEmail: string;
  signerColor: string;
  // Position as percentage of page dimensions
  xPercent: number;
  yPercent: number;
  widthPercent: number;
  heightPercent: number;
  // Configuration
  label?: string;
  required: boolean;
  dateFormat?: string; // For date fields, e.g., "DD/MM/YYYY"
  placeholder?: string; // For text fields
  // Completion state (populated when signed)
  value?: string;
  completedAt?: string;
}

/**
 * Props for the signer assignment panel
 */
export interface SignerPanelProps {
  signers: Signer[];
  selectedSigner: Signer | null;
  onAddSigner: (email: string, name?: string) => void;
  onRemoveSigner: (signerId: string) => void;
  onSelectSigner: (signer: Signer | null) => void;
  onReorderSigners: (signers: Signer[]) => void;
}

/**
 * Default field dimensions as percentage of page
 */
export const DEFAULT_FIELD_DIMENSIONS: Record<SignatureFieldType, { width: number; height: number }> = {
  signature: { width: 20, height: 8 },
  initials: { width: 10, height: 6 },
  date: { width: 15, height: 4 },
  text: { width: 25, height: 4 },
};
