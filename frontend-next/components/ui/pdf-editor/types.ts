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
  | "eraser";

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
}
