/**
 * TeeemPowerPoint Types
 *
 * Type definitions for the presentation editor.
 * Coordinates are in inches (PptxGenJS standard).
 */

// Element types supported in presentations
export type ElementType = "text" | "image" | "shape" | "table" | "chart";

// Shape types (subset of PptxGenJS shapes)
export type ShapeType =
  | "rect"
  | "roundRect"
  | "ellipse"
  | "triangle"
  | "line"
  | "arrow"
  | "star5"
  | "diamond";

// Chart types
export type ChartType = "bar" | "line" | "pie" | "doughnut" | "area" | "scatter";

// Text alignment
export type TextAlign = "left" | "center" | "right" | "justify";
export type VerticalAlign = "top" | "middle" | "bottom";

// Base element interface
export interface BaseElement {
  id: string;
  type: ElementType;
  x: number; // Position in inches from left
  y: number; // Position in inches from top
  w: number; // Width in inches
  h: number; // Height in inches
  rotation?: number; // Rotation in degrees
  zIndex?: number; // Layer order
}

// Text element
export interface TextElement extends BaseElement {
  type: "text";
  content: string;
  options: TextOptions;
}

export interface TextOptions {
  fontSize?: number;
  fontFace?: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strike?: boolean;
  color?: string; // Hex without # (e.g., "363636")
  align?: TextAlign;
  valign?: VerticalAlign;
  bullet?: boolean | { type?: "number" | "bullet" };
  lineSpacing?: number;
  margin?: number | [number, number, number, number]; // TRBL
}

// Image element
export interface ImageElement extends BaseElement {
  type: "image";
  src: string; // Data URL or external URL
  options?: ImageOptions;
}

export interface ImageOptions {
  sizing?: { type: "contain" | "cover" | "crop"; w?: number; h?: number };
  hyperlink?: { url: string };
}

// Shape element
export interface ShapeElement extends BaseElement {
  type: "shape";
  shapeType: ShapeType;
  options?: ShapeOptions;
}

export interface ShapeOptions {
  fill?: { color: string } | { type: "solid"; color: string };
  line?: { color: string; width?: number; dashType?: string };
  shadow?: { type: "outer"; blur?: number; offset?: number; angle?: number; color?: string };
}

// Table element
export interface TableElement extends BaseElement {
  type: "table";
  rows: TableRow[];
  options?: TableOptions;
}

export interface TableRow {
  cells: TableCell[];
}

export interface TableCell {
  text: string;
  options?: TableCellOptions;
}

export interface TableCellOptions {
  fill?: { color: string };
  color?: string;
  bold?: boolean;
  align?: TextAlign;
  valign?: VerticalAlign;
  colspan?: number;
  rowspan?: number;
}

export interface TableOptions {
  colW?: number[]; // Column widths in inches
  rowH?: number | number[]; // Row heights in inches
  border?: { pt: number; color: string };
  fill?: { color: string };
  fontFace?: string;
  fontSize?: number;
}

// Chart element
export interface ChartElement extends BaseElement {
  type: "chart";
  chartType: ChartType;
  data: ChartData[];
  options?: ChartOptions;
}

export interface ChartData {
  name: string;
  labels: string[];
  values: number[];
}

export interface ChartOptions {
  showLegend?: boolean;
  legendPos?: "t" | "b" | "l" | "r";
  showTitle?: boolean;
  title?: string;
  showValue?: boolean;
  chartColors?: string[]; // Array of hex colors
  barDir?: "bar" | "col"; // For bar charts
  lineSmooth?: boolean; // For line charts
}

// Union type for all elements
export type SlideElement =
  | TextElement
  | ImageElement
  | ShapeElement
  | TableElement
  | ChartElement;

// Slide layout types
export type SlideLayout =
  | "title"
  | "titleAndContent"
  | "twoColumn"
  | "blank"
  | "sectionHeader"
  | "titleAndImage";

// Slide background
export interface SlideBackground {
  color?: string; // Hex color
  image?: string; // Data URL or external URL
}

// Single slide
export interface Slide {
  id: string;
  layout: SlideLayout;
  background?: SlideBackground;
  elements: SlideElement[];
  notes?: string; // Speaker notes
}

// Presentation theme
export interface PresentationTheme {
  name: string;
  colors: {
    primary: string;
    secondary: string;
    accent?: string;
    background?: string;
  };
  fonts?: {
    title?: string;
    body?: string;
  };
}

// Presentation metadata
export interface PresentationMetadata {
  version: number;
  title?: string;
  author?: string;
  subject?: string;
  company?: string;
}

// Full presentation data structure (stored in JSONB)
export interface PresentationData {
  slides: Slide[];
  theme: PresentationTheme;
  metadata: PresentationMetadata;
}

// API response types
export interface TeeemPresentation {
  id: number;
  name: string;
  description?: string;
  isTemplate: boolean;
  data: PresentationData;
  jobId?: number;
  jobName?: string;
  updatedAt: string;
  createdAt: string;
}

export interface TeeemPresentationSummary {
  id: number;
  name: string;
  description?: string;
  isTemplate: boolean;
  jobId?: number;
  jobName?: string;
  slideCount: number;
  updatedAt: string;
  createdAt: string;
}

// Default slide templates
export const DEFAULT_SLIDE_LAYOUTS: Record<SlideLayout, Partial<Slide>> = {
  title: {
    layout: "title",
    elements: [
      {
        id: "title-1",
        type: "text",
        content: "Click to add title",
        x: 0.5,
        y: 2.5,
        w: 9,
        h: 1.5,
        options: {
          fontSize: 44,
          fontFace: "Arial",
          bold: true,
          color: "363636",
          align: "center",
        },
      },
      {
        id: "subtitle-1",
        type: "text",
        content: "Click to add subtitle",
        x: 0.5,
        y: 4,
        w: 9,
        h: 1,
        options: {
          fontSize: 24,
          fontFace: "Arial",
          color: "666666",
          align: "center",
        },
      },
    ],
  },
  titleAndContent: {
    layout: "titleAndContent",
    elements: [
      {
        id: "title-1",
        type: "text",
        content: "Click to add title",
        x: 0.5,
        y: 0.5,
        w: 9,
        h: 1,
        options: {
          fontSize: 32,
          fontFace: "Arial",
          bold: true,
          color: "363636",
        },
      },
      {
        id: "content-1",
        type: "text",
        content: "Click to add content",
        x: 0.5,
        y: 1.75,
        w: 9,
        h: 4.5,
        options: {
          fontSize: 18,
          fontFace: "Arial",
          color: "363636",
          valign: "top",
        },
      },
    ],
  },
  twoColumn: {
    layout: "twoColumn",
    elements: [
      {
        id: "title-1",
        type: "text",
        content: "Click to add title",
        x: 0.5,
        y: 0.5,
        w: 9,
        h: 1,
        options: {
          fontSize: 32,
          fontFace: "Arial",
          bold: true,
          color: "363636",
        },
      },
      {
        id: "left-1",
        type: "text",
        content: "Left column",
        x: 0.5,
        y: 1.75,
        w: 4.25,
        h: 4.5,
        options: {
          fontSize: 18,
          fontFace: "Arial",
          color: "363636",
          valign: "top",
        },
      },
      {
        id: "right-1",
        type: "text",
        content: "Right column",
        x: 5.25,
        y: 1.75,
        w: 4.25,
        h: 4.5,
        options: {
          fontSize: 18,
          fontFace: "Arial",
          color: "363636",
          valign: "top",
        },
      },
    ],
  },
  blank: {
    layout: "blank",
    elements: [],
  },
  sectionHeader: {
    layout: "sectionHeader",
    elements: [
      {
        id: "header-1",
        type: "text",
        content: "Section Title",
        x: 0.5,
        y: 2.75,
        w: 9,
        h: 1.5,
        options: {
          fontSize: 48,
          fontFace: "Arial",
          bold: true,
          color: "363636",
          align: "center",
        },
      },
    ],
  },
  titleAndImage: {
    layout: "titleAndImage",
    elements: [
      {
        id: "title-1",
        type: "text",
        content: "Click to add title",
        x: 0.5,
        y: 0.5,
        w: 9,
        h: 1,
        options: {
          fontSize: 32,
          fontFace: "Arial",
          bold: true,
          color: "363636",
        },
      },
    ],
  },
};

// Default theme
export const DEFAULT_THEME: PresentationTheme = {
  name: "default",
  colors: {
    primary: "#0066CC",
    secondary: "#333333",
    accent: "#FF6600",
    background: "#FFFFFF",
  },
  fonts: {
    title: "Arial",
    body: "Arial",
  },
};
