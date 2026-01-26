/**
 * TeeemPowerPoint Library
 *
 * A PowerPoint presentation editor library for creating, editing,
 * importing, and exporting PPTX files in the browser.
 *
 * @example
 * ```tsx
 * import {
 *   exportToPptx,
 *   downloadPptx,
 *   importFromPptx,
 *   DEFAULT_SLIDE_LAYOUTS,
 *   DEFAULT_THEME,
 * } from '@/lib/teeem-powerpoint';
 *
 * // Export to PPTX blob
 * const blob = await exportToPptx(presentationData);
 *
 * // Download PPTX file
 * await downloadPptx(presentationData, 'my-presentation.pptx');
 *
 * // Import from PPTX file
 * const data = await importFromPptx(file);
 * ```
 */

// Export functions
export { exportToPptx, downloadPptx } from "./pptx-export";
export { importFromPptx } from "./pptx-import";

// Export types
export type {
  // Element types
  ElementType,
  ShapeType,
  ChartType,
  TextAlign,
  VerticalAlign,

  // Elements
  BaseElement,
  TextElement,
  TextOptions,
  ImageElement,
  ImageOptions,
  ShapeElement,
  ShapeOptions,
  TableElement,
  TableRow,
  TableCell,
  TableCellOptions,
  TableOptions,
  ChartElement,
  ChartData,
  ChartOptions,
  SlideElement,

  // Slide
  SlideLayout,
  SlideBackground,
  Slide,

  // Presentation
  PresentationTheme,
  PresentationMetadata,
  PresentationData,

  // API types
  TeeemPresentation,
  TeeemPresentationSummary,
} from "./types";

// Export constants
export { DEFAULT_SLIDE_LAYOUTS, DEFAULT_THEME } from "./types";

/**
 * Create an empty presentation with default settings
 */
export function createEmptyPresentation(): import("./types").PresentationData {
  const { DEFAULT_SLIDE_LAYOUTS, DEFAULT_THEME } = require("./types");

  return {
    slides: [
      {
        id: "slide-1",
        layout: "title" as const,
        elements: [...(DEFAULT_SLIDE_LAYOUTS.title.elements || [])],
      },
    ],
    theme: { ...DEFAULT_THEME },
    metadata: {
      version: 1,
    },
  };
}

/**
 * Create a new slide from a layout template
 */
export function createSlideFromLayout(
  layout: import("./types").SlideLayout,
  slideNumber: number
): import("./types").Slide {
  const { DEFAULT_SLIDE_LAYOUTS } = require("./types");

  const template = DEFAULT_SLIDE_LAYOUTS[layout];
  const elements = (template.elements || []).map(
    (el: import("./types").SlideElement, idx: number) => ({
      ...el,
      id: `${el.id}-${slideNumber}-${idx}`,
    })
  );

  return {
    id: `slide-${slideNumber}`,
    layout,
    elements,
  };
}

/**
 * Generate a unique element ID
 */
export function generateElementId(
  type: import("./types").ElementType,
  slideId: string
): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 7);
  return `${type}-${slideId}-${timestamp}-${random}`;
}

/**
 * Deep clone a slide (for duplication)
 */
export function cloneSlide(
  slide: import("./types").Slide,
  newId: string
): import("./types").Slide {
  return {
    ...JSON.parse(JSON.stringify(slide)),
    id: newId,
    elements: slide.elements.map((el, idx) => ({
      ...JSON.parse(JSON.stringify(el)),
      id: `${el.type}-${newId}-${idx}`,
    })),
  };
}

/**
 * Reorder slides
 */
export function reorderSlides(
  slides: import("./types").Slide[],
  fromIndex: number,
  toIndex: number
): import("./types").Slide[] {
  const result = [...slides];
  const [removed] = result.splice(fromIndex, 1);
  result.splice(toIndex, 0, removed);
  return result;
}
