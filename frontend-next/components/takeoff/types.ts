// PDF Takeoff Types - Browser-based Bluebeam competitor
// Feb 2026

// =============================================================================
// Tool Types
// =============================================================================

export type TakeoffTool =
  | "select"        // Select/move existing measurements
  | "pan"           // Pan the canvas
  | "calibrate"     // Scale calibration (draw reference line)
  | "count"         // Click to place numbered markers
  | "area"          // Draw polygon for m² calculation
  | "linear"        // Draw polyline for lineal meters
  | "perimeter"     // Draw closed shape for perimeter
  | "deduction";    // Subtract from parent measurement

export const TAKEOFF_TOOLS: Record<TakeoffTool, { label: string; icon: string; shortcut: string }> = {
  select: { label: "Select", icon: "MousePointer2", shortcut: "V" },
  pan: { label: "Pan", icon: "Hand", shortcut: "H" },
  calibrate: { label: "Calibrate Scale", icon: "Ruler", shortcut: "S" },
  count: { label: "Count", icon: "Hash", shortcut: "C" },
  area: { label: "Area", icon: "Square", shortcut: "A" },
  linear: { label: "Linear", icon: "Minus", shortcut: "L" },
  perimeter: { label: "Perimeter", icon: "Pentagon", shortcut: "P" },
  deduction: { label: "Deduction", icon: "MinusSquare", shortcut: "D" },
};

// =============================================================================
// Page Scale
// =============================================================================

export interface PageScale {
  id: number;
  page_number: number;
  scale_factor: number | null;  // mm per pixel
  scale_label: string;
  calibrated: boolean;
  calibration_line: {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
  } | null;
  reference_length_mm: number | null;
}

// =============================================================================
// Takeoff Layer
// =============================================================================

export interface TakeoffLayer {
  id: number;
  name: string;
  color: string;  // Hex color
  display_order: number;
  visible: boolean;
  locked: boolean;
  measurement_count: number;
}

export const DEFAULT_LAYER_COLORS = [
  "#6B7280",  // Gray - General
  "#3B82F6",  // Blue - Flooring
  "#22C55E",  // Green - Walls
  "#A855F7",  // Purple - Ceiling
  "#EAB308",  // Yellow - Electrical
  "#EF4444",  // Red - Plumbing
  "#06B6D4",  // Cyan - HVAC
  "#F97316",  // Orange - Roofing
];

// =============================================================================
// Measurement
// =============================================================================

export type MeasurementType = "area" | "length" | "perimeter" | "count";

export interface TakeoffMeasurement {
  id: number;
  measurement_type: MeasurementType;
  value: number;
  net_value: number;
  formatted_value: string;
  formatted_net_value: string;
  unit: string;
  category: string | null;
  page_number: number | null;
  display_label: string | null;
  color: string;
  is_deduction: boolean;
  parent_measurement_id: number | null;
  geometry_data: GeometryData;
  layer: { id: number; name: string; color: string } | null;
  pricebook_item: PricebookItemSummary | null;
  line_total: number | null;
  net_line_total: number | null;
  created_at: string;
}

export interface PricebookItemSummary {
  id: number;
  name: string;
  code: string;
  current_price: number | null;
}

// =============================================================================
// Geometry Data
// =============================================================================

export interface Point {
  x: number;
  y: number;
}

export interface GeometryData {
  type: "point" | "line" | "polygon" | "polyline";
  points: Point[];
  // For canvas reconstruction
  canvasWidth?: number;
  canvasHeight?: number;
}

// =============================================================================
// Calibration
// =============================================================================

export interface CalibrationData {
  lineStart: Point;
  lineEnd: Point;
  referenceLengthMm: number;
  canvasWidth: number;
  canvasHeight: number;
}

// =============================================================================
// Measurement Creation
// =============================================================================

export interface MeasurementCreateOptions {
  isDeduction?: boolean;
  parentMeasurementId?: number;
}

// =============================================================================
// API Types
// =============================================================================

export interface TakeoffPlanResponse {
  job_plan: {
    id: number;
    display_name: string;
    job_id: number;
    job_code: string;
  };
  current_revision: {
    id: number;
    revision: string;
    file_name: string;
    download_url: string;
  } | null;
  revisions: Array<{
    id: number;
    revision: string;
    revision_date: string;
    is_on_issue: boolean;
    file_name: string;
    download_url: string;
  }>;
  page_scales: PageScale[];
}

export interface MeasurementSummary {
  total_count: number;
  by_type: {
    area: number;
    length: number;
    perimeter: number;
    count: number;
  };
  total_cost: number;
}

export interface MeasurementsResponse {
  measurements: TakeoffMeasurement[];
  summary: MeasurementSummary;
}

// =============================================================================
// Canvas State
// =============================================================================

export interface TakeoffCanvasState {
  tool: TakeoffTool;
  activeLayerId: number | null;
  pageNumber: number;
  zoom: number;
  isDrawing: boolean;
  currentPoints: Point[];  // Points being drawn
  calibrationMode: "idle" | "drawing" | "input";  // For calibration workflow
  tempCalibrationLine: { start: Point; end: Point } | null;
}

// =============================================================================
// Drawing Styles
// =============================================================================

export interface DrawingStyle {
  strokeColor: string;
  strokeWidth: number;
  fillColor: string;
  fillOpacity: number;
  markerSize: number;
  fontSize: number;
}

export const DEFAULT_DRAWING_STYLE: DrawingStyle = {
  strokeColor: "#3B82F6",
  strokeWidth: 2,
  fillColor: "#3B82F6",
  fillOpacity: 0.2,
  markerSize: 24,
  fontSize: 14,
};

// =============================================================================
// Room Instances (Template-Based Measurement Checklists)
// =============================================================================

export interface TakeoffRoomSlot {
  id: number;
  step_index: number;
  label: string;
  measurement_type: "count" | "area" | "linear" | "perimeter";
  color: string | null;
  prompt: string | null;
  pricebook_item_id: number | null;
  pricebook_item_code: string | null;
  pricebook_item_name: string | null;
  pricebook_item_price: number | null;
  measurement_id: number | null;
  quantity: number;
  is_filled: boolean;
  line_total: number | null;
  unit_display: string;
}

export interface TakeoffRoomInstance {
  id: number;
  name: string;
  status: "in_progress" | "complete";
  display_order: number;
  notes: string | null;
  template_name: string;
  template_category: string | null;
  filled: number;
  total: number;
  total_cost: number;
  slots: TakeoffRoomSlot[];
  created_at: string;
}

// =============================================================================
// Events
// =============================================================================

export interface MeasurementCreatedEvent {
  measurement: TakeoffMeasurement;
  pageNumber: number;
}

export interface ScaleCalibratedEvent {
  pageScale: PageScale;
  pageNumber: number;
}
