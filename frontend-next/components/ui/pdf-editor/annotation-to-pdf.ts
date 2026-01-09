/**
 * Annotation to PDF Export Utility
 *
 * Converts Fabric.js annotation objects to pdf-lib drawing commands.
 * This enables annotations drawn in the PDF Editor to be embedded
 * into the exported PDF file.
 */

import { PDFDocument, PDFPage, rgb, StandardFonts, PDFFont } from "pdf-lib";

// Fabric.js object types we support
interface FabricPath {
  type: "path";
  path: Array<[string, ...number[]]>;
  stroke: string;
  strokeWidth: number;
  fill?: string;
  left: number;
  top: number;
  scaleX?: number;
  scaleY?: number;
}

interface FabricRect {
  type: "rect";
  left: number;
  top: number;
  width: number;
  height: number;
  fill?: string;
  stroke: string;
  strokeWidth: number;
  scaleX?: number;
  scaleY?: number;
}

interface FabricEllipse {
  type: "ellipse";
  left: number;
  top: number;
  rx: number;
  ry: number;
  fill?: string;
  stroke: string;
  strokeWidth: number;
  scaleX?: number;
  scaleY?: number;
}

interface FabricLine {
  type: "line";
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  stroke: string;
  strokeWidth: number;
  left: number;
  top: number;
}

interface FabricIText {
  type: "i-text";
  text: string;
  left: number;
  top: number;
  fontSize: number;
  fill: string;
  fontFamily?: string;
  scaleX?: number;
  scaleY?: number;
}

interface FabricImage {
  type: "image";
  src: string;
  left: number;
  top: number;
  width: number;
  height: number;
  scaleX?: number;
  scaleY?: number;
}

type FabricObject = FabricPath | FabricRect | FabricEllipse | FabricLine | FabricIText | FabricImage;

interface PageInfo {
  width: number;  // Canvas/thumbnail width at 100% zoom
  height: number; // Canvas/thumbnail height at 100% zoom
}

/**
 * Parse a CSS color string to RGB values (0-1 range)
 */
function parseColor(color: string): { r: number; g: number; b: number; a: number } {
  // Default to black
  let r = 0, g = 0, b = 0, a = 1;

  if (!color || color === "transparent") {
    return { r: 0, g: 0, b: 0, a: 0 };
  }

  // Handle hex colors
  if (color.startsWith("#")) {
    const hex = color.slice(1);
    if (hex.length === 3) {
      r = parseInt(hex[0] + hex[0], 16) / 255;
      g = parseInt(hex[1] + hex[1], 16) / 255;
      b = parseInt(hex[2] + hex[2], 16) / 255;
    } else if (hex.length === 6) {
      r = parseInt(hex.slice(0, 2), 16) / 255;
      g = parseInt(hex.slice(2, 4), 16) / 255;
      b = parseInt(hex.slice(4, 6), 16) / 255;
    } else if (hex.length === 8) {
      r = parseInt(hex.slice(0, 2), 16) / 255;
      g = parseInt(hex.slice(2, 4), 16) / 255;
      b = parseInt(hex.slice(4, 6), 16) / 255;
      a = parseInt(hex.slice(6, 8), 16) / 255;
    }
  }
  // Handle rgb/rgba
  else if (color.startsWith("rgb")) {
    const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
    if (match) {
      r = parseInt(match[1]) / 255;
      g = parseInt(match[2]) / 255;
      b = parseInt(match[3]) / 255;
      a = match[4] ? parseFloat(match[4]) : 1;
    }
  }
  // Handle named colors (basic set)
  else {
    const namedColors: Record<string, [number, number, number]> = {
      black: [0, 0, 0],
      white: [255, 255, 255],
      red: [255, 0, 0],
      green: [0, 255, 0],
      blue: [0, 0, 255],
      yellow: [255, 255, 0],
      cyan: [0, 255, 255],
      magenta: [255, 0, 255],
      orange: [255, 165, 0],
      purple: [128, 0, 128],
    };
    const named = namedColors[color.toLowerCase()];
    if (named) {
      r = named[0] / 255;
      g = named[1] / 255;
      b = named[2] / 255;
    }
  }

  return { r, g, b, a };
}

/**
 * Convert canvas Y coordinate to PDF Y coordinate
 * Canvas: Y increases downward (0 at top)
 * PDF: Y increases upward (0 at bottom)
 */
function canvasToPdfY(canvasY: number, canvasHeight: number, pdfHeight: number): number {
  const ratio = pdfHeight / canvasHeight;
  return pdfHeight - (canvasY * ratio);
}

/**
 * Scale a value from canvas space to PDF space
 */
function scaleValue(value: number, canvasSize: number, pdfSize: number): number {
  return (value / canvasSize) * pdfSize;
}

/**
 * Draw a freehand path annotation onto a PDF page
 */
function drawPath(
  page: PDFPage,
  annotation: FabricPath,
  pageInfo: PageInfo
): void {
  const { width: pdfWidth, height: pdfHeight } = page.getSize();
  const { width: canvasWidth, height: canvasHeight } = pageInfo;

  const color = parseColor(annotation.stroke);
  if (color.a === 0) return;

  const scaleX = annotation.scaleX ?? 1;
  const scaleY = annotation.scaleY ?? 1;
  const strokeWidth = scaleValue(annotation.strokeWidth * scaleX, canvasWidth, pdfWidth);

  // Convert Fabric.js path commands to PDF drawing
  // Path format: [["M", x, y], ["Q", cx, cy, x, y], ["L", x, y], ...]
  let pathData = "";

  for (const cmd of annotation.path) {
    const [command, ...coords] = cmd;

    switch (command) {
      case "M": // Move to
        const mx = scaleValue((annotation.left + coords[0] * scaleX), canvasWidth, pdfWidth);
        const my = canvasToPdfY(annotation.top + coords[1] * scaleY, canvasHeight, pdfHeight);
        pathData += `${mx} ${my} m `;
        break;
      case "L": // Line to
        const lx = scaleValue((annotation.left + coords[0] * scaleX), canvasWidth, pdfWidth);
        const ly = canvasToPdfY(annotation.top + coords[1] * scaleY, canvasHeight, pdfHeight);
        pathData += `${lx} ${ly} l `;
        break;
      case "Q": // Quadratic curve
        const qcx = scaleValue((annotation.left + coords[0] * scaleX), canvasWidth, pdfWidth);
        const qcy = canvasToPdfY(annotation.top + coords[1] * scaleY, canvasHeight, pdfHeight);
        const qx = scaleValue((annotation.left + coords[2] * scaleX), canvasWidth, pdfWidth);
        const qy = canvasToPdfY(annotation.top + coords[3] * scaleY, canvasHeight, pdfHeight);
        // PDF uses cubic curves, convert quadratic to cubic
        // Control points for cubic: cp1 = start + 2/3*(qcp - start), cp2 = end + 2/3*(qcp - end)
        pathData += `${qcx} ${qcy} ${qx} ${qy} v `;
        break;
      case "C": // Cubic curve
        const cx1 = scaleValue((annotation.left + coords[0] * scaleX), canvasWidth, pdfWidth);
        const cy1 = canvasToPdfY(annotation.top + coords[1] * scaleY, canvasHeight, pdfHeight);
        const cx2 = scaleValue((annotation.left + coords[2] * scaleX), canvasWidth, pdfWidth);
        const cy2 = canvasToPdfY(annotation.top + coords[3] * scaleY, canvasHeight, pdfHeight);
        const cx = scaleValue((annotation.left + coords[4] * scaleX), canvasWidth, pdfWidth);
        const cy = canvasToPdfY(annotation.top + coords[5] * scaleY, canvasHeight, pdfHeight);
        pathData += `${cx1} ${cy1} ${cx2} ${cy2} ${cx} ${cy} c `;
        break;
    }
  }

  // Draw the path using low-level PDF operators
  page.drawSvgPath(pathData, {
    borderColor: rgb(color.r, color.g, color.b),
    borderWidth: strokeWidth,
    borderOpacity: color.a,
  });
}

/**
 * Draw a rectangle annotation onto a PDF page
 */
function drawRect(
  page: PDFPage,
  annotation: FabricRect,
  pageInfo: PageInfo
): void {
  const { width: pdfWidth, height: pdfHeight } = page.getSize();
  const { width: canvasWidth, height: canvasHeight } = pageInfo;

  const scaleX = annotation.scaleX ?? 1;
  const scaleY = annotation.scaleY ?? 1;

  const x = scaleValue(annotation.left, canvasWidth, pdfWidth);
  const width = scaleValue(annotation.width * scaleX, canvasWidth, pdfWidth);
  const height = scaleValue(annotation.height * scaleY, canvasHeight, pdfHeight);
  const y = canvasToPdfY(annotation.top + annotation.height * scaleY, canvasHeight, pdfHeight);

  const strokeColor = parseColor(annotation.stroke);
  const fillColor = parseColor(annotation.fill || "transparent");
  const strokeWidth = scaleValue(annotation.strokeWidth, canvasWidth, pdfWidth);

  page.drawRectangle({
    x,
    y,
    width,
    height,
    borderColor: strokeColor.a > 0 ? rgb(strokeColor.r, strokeColor.g, strokeColor.b) : undefined,
    borderWidth: strokeColor.a > 0 ? strokeWidth : 0,
    borderOpacity: strokeColor.a,
    color: fillColor.a > 0 ? rgb(fillColor.r, fillColor.g, fillColor.b) : undefined,
    opacity: fillColor.a,
  });
}

/**
 * Draw an ellipse annotation onto a PDF page
 */
function drawEllipse(
  page: PDFPage,
  annotation: FabricEllipse,
  pageInfo: PageInfo
): void {
  const { width: pdfWidth, height: pdfHeight } = page.getSize();
  const { width: canvasWidth, height: canvasHeight } = pageInfo;

  const scaleX = annotation.scaleX ?? 1;
  const scaleY = annotation.scaleY ?? 1;

  const rx = scaleValue(annotation.rx * scaleX, canvasWidth, pdfWidth);
  const ry = scaleValue(annotation.ry * scaleY, canvasHeight, pdfHeight);
  const x = scaleValue(annotation.left + annotation.rx * scaleX, canvasWidth, pdfWidth);
  const y = canvasToPdfY(annotation.top + annotation.ry * scaleY, canvasHeight, pdfHeight);

  const strokeColor = parseColor(annotation.stroke);
  const fillColor = parseColor(annotation.fill || "transparent");
  const strokeWidth = scaleValue(annotation.strokeWidth, canvasWidth, pdfWidth);

  page.drawEllipse({
    x,
    y,
    xScale: rx,
    yScale: ry,
    borderColor: strokeColor.a > 0 ? rgb(strokeColor.r, strokeColor.g, strokeColor.b) : undefined,
    borderWidth: strokeColor.a > 0 ? strokeWidth : 0,
    borderOpacity: strokeColor.a,
    color: fillColor.a > 0 ? rgb(fillColor.r, fillColor.g, fillColor.b) : undefined,
    opacity: fillColor.a,
  });
}

/**
 * Draw a line annotation onto a PDF page
 */
function drawLine(
  page: PDFPage,
  annotation: FabricLine,
  pageInfo: PageInfo
): void {
  const { width: pdfWidth, height: pdfHeight } = page.getSize();
  const { width: canvasWidth, height: canvasHeight } = pageInfo;

  // Fabric.js Line stores coordinates relative to left/top
  const x1 = scaleValue(annotation.left + annotation.x1, canvasWidth, pdfWidth);
  const y1 = canvasToPdfY(annotation.top + annotation.y1, canvasHeight, pdfHeight);
  const x2 = scaleValue(annotation.left + annotation.x2, canvasWidth, pdfWidth);
  const y2 = canvasToPdfY(annotation.top + annotation.y2, canvasHeight, pdfHeight);

  const strokeColor = parseColor(annotation.stroke);
  const strokeWidth = scaleValue(annotation.strokeWidth, canvasWidth, pdfWidth);

  page.drawLine({
    start: { x: x1, y: y1 },
    end: { x: x2, y: y2 },
    color: rgb(strokeColor.r, strokeColor.g, strokeColor.b),
    thickness: strokeWidth,
    opacity: strokeColor.a,
  });
}

/**
 * Draw a text annotation onto a PDF page
 */
async function drawText(
  doc: PDFDocument,
  page: PDFPage,
  annotation: FabricIText,
  pageInfo: PageInfo,
  fontCache: Map<string, PDFFont>
): Promise<void> {
  const { width: pdfWidth, height: pdfHeight } = page.getSize();
  const { width: canvasWidth, height: canvasHeight } = pageInfo;

  const scaleX = annotation.scaleX ?? 1;
  const scaleY = annotation.scaleY ?? 1;

  const x = scaleValue(annotation.left, canvasWidth, pdfWidth);
  const fontSize = scaleValue(annotation.fontSize * scaleY, canvasHeight, pdfHeight);
  // Adjust Y for text baseline (PDF draws from baseline, Fabric from top)
  const y = canvasToPdfY(annotation.top + annotation.fontSize * scaleY, canvasHeight, pdfHeight);

  const fillColor = parseColor(annotation.fill);

  // Get or embed font
  let font = fontCache.get("Helvetica");
  if (!font) {
    font = await doc.embedFont(StandardFonts.Helvetica);
    fontCache.set("Helvetica", font);
  }

  // Handle multi-line text
  const lines = annotation.text.split("\n");
  const lineHeight = fontSize * 1.2;

  lines.forEach((line, index) => {
    page.drawText(line, {
      x,
      y: y - (index * lineHeight),
      font,
      size: fontSize,
      color: rgb(fillColor.r, fillColor.g, fillColor.b),
      opacity: fillColor.a,
    });
  });
}

/**
 * Draw an image annotation (signature/stamp) onto a PDF page
 */
async function drawImage(
  doc: PDFDocument,
  page: PDFPage,
  annotation: FabricImage,
  pageInfo: PageInfo
): Promise<void> {
  const { width: pdfWidth, height: pdfHeight } = page.getSize();
  const { width: canvasWidth, height: canvasHeight } = pageInfo;

  const scaleX = annotation.scaleX ?? 1;
  const scaleY = annotation.scaleY ?? 1;

  const x = scaleValue(annotation.left, canvasWidth, pdfWidth);
  const width = scaleValue(annotation.width * scaleX, canvasWidth, pdfWidth);
  const height = scaleValue(annotation.height * scaleY, canvasHeight, pdfHeight);
  const y = canvasToPdfY(annotation.top + annotation.height * scaleY, canvasHeight, pdfHeight);

  // Only support data URLs for now
  if (!annotation.src.startsWith("data:image")) {
    console.warn("Image annotation source not supported:", annotation.src.substring(0, 50));
    return;
  }

  try {
    const base64Data = annotation.src.split(",")[1];
    const imageBytes = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));

    let image;
    if (annotation.src.includes("image/png")) {
      image = await doc.embedPng(imageBytes);
    } else if (annotation.src.includes("image/jpeg") || annotation.src.includes("image/jpg")) {
      image = await doc.embedJpg(imageBytes);
    } else {
      console.warn("Unsupported image format:", annotation.src.substring(0, 30));
      return;
    }

    page.drawImage(image, {
      x,
      y,
      width,
      height,
    });
  } catch (err) {
    console.error("Failed to embed image annotation:", err);
  }
}

/**
 * Draw all annotations from a page onto the PDF page
 *
 * @param doc - The PDFDocument being created
 * @param page - The PDF page to draw on
 * @param annotations - Array of Fabric.js annotation objects
 * @param pageInfo - Original canvas dimensions for coordinate conversion
 */
export async function drawAnnotationsOnPage(
  doc: PDFDocument,
  page: PDFPage,
  annotations: any[],
  pageInfo: PageInfo
): Promise<void> {
  const fontCache = new Map<string, PDFFont>();

  for (const annotation of annotations) {
    try {
      switch (annotation.type) {
        case "path":
          drawPath(page, annotation as FabricPath, pageInfo);
          break;
        case "rect":
          drawRect(page, annotation as FabricRect, pageInfo);
          break;
        case "ellipse":
          drawEllipse(page, annotation as FabricEllipse, pageInfo);
          break;
        case "line":
          drawLine(page, annotation as FabricLine, pageInfo);
          break;
        case "i-text":
        case "text":
          await drawText(doc, page, annotation as FabricIText, pageInfo, fontCache);
          break;
        case "image":
          await drawImage(doc, page, annotation as FabricImage, pageInfo);
          break;
        default:
          console.warn("Unknown annotation type:", annotation.type);
      }
    } catch (err) {
      console.error(`Failed to draw annotation of type ${annotation.type}:`, err);
    }
  }
}
