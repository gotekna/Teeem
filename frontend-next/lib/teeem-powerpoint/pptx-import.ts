/**
 * TeeemPowerPoint Import
 *
 * Parses PPTX files into our JSON data structure using JSZip.
 * PPTX is a ZIP archive containing XML files and media.
 *
 * Structure:
 * - [Content_Types].xml - Content type mappings
 * - ppt/presentation.xml - Main presentation
 * - ppt/slides/slide1.xml, slide2.xml, ... - Individual slides
 * - ppt/slideLayouts/ - Slide layout templates
 * - ppt/slideMasters/ - Slide masters
 * - ppt/media/ - Images and other media
 * - ppt/notesSlides/ - Speaker notes
 */

import JSZip from "jszip";
import type {
  PresentationData,
  Slide,
  SlideElement,
  TextElement,
  ImageElement,
  ShapeElement,
  PresentationTheme,
  PresentationMetadata,
  SlideLayout,
  SlideBackground,
} from "./types";
import { DEFAULT_THEME } from "./types";

// EMU (English Metric Units) to inches conversion
// 1 inch = 914400 EMU
const EMU_PER_INCH = 914400;

/**
 * Import a PPTX file and convert to our data structure
 */
export async function importFromPptx(file: File | Blob): Promise<PresentationData> {
  const zip = await JSZip.loadAsync(file);

  // Parse presentation.xml for slide order and metadata
  const presentationXml = await zip.file("ppt/presentation.xml")?.async("string");
  if (!presentationXml) {
    throw new Error("Invalid PPTX: missing presentation.xml");
  }

  // Get slide relationships to map rId to slide files
  const presentationRels = await zip.file("ppt/_rels/presentation.xml.rels")?.async("string");
  const slideRelMap = parseRelationships(presentationRels || "");

  // Parse core.xml for metadata
  const coreXml = await zip.file("docProps/core.xml")?.async("string");
  const metadata = parseMetadata(coreXml || "");

  // Get slide order from presentation.xml
  const slideIds = parseSlideOrder(presentationXml);

  // Parse each slide
  const slides: Slide[] = [];
  for (let i = 0; i < slideIds.length; i++) {
    const rId = slideIds[i];
    const slideFile = slideRelMap[rId];
    if (!slideFile) continue;

    const slideXml = await zip.file(`ppt/${slideFile}`)?.async("string");
    if (!slideXml) continue;

    // Get slide relationships for media
    const slideNum = slideFile.match(/slide(\d+)\.xml/)?.[1];
    const slideRelsXml = await zip.file(`ppt/slides/_rels/slide${slideNum}.xml.rels`)?.async("string");
    const slideRels = parseRelationships(slideRelsXml || "");

    // Get notes if available
    const notesRel = Object.entries(slideRels).find(([, path]) => path.includes("notesSlides"));
    let notes: string | undefined;
    if (notesRel) {
      const notesXml = await zip.file(`ppt/${notesRel[1]}`)?.async("string");
      notes = parseNotes(notesXml || "");
    }

    const slide = await parseSlide(slideXml, slideRels, zip, i);
    if (notes) slide.notes = notes;
    slides.push(slide);
  }

  // Parse theme (basic)
  const theme = await parseTheme(zip);

  return {
    slides,
    theme,
    metadata,
  };
}

/**
 * Parse relationships XML to get rId -> file mappings
 */
function parseRelationships(xml: string): Record<string, string> {
  const map: Record<string, string> = {};
  const relationshipRegex = /<Relationship[^>]*Id="([^"]+)"[^>]*Target="([^"]+)"[^>]*>/g;
  let match;

  while ((match = relationshipRegex.exec(xml)) !== null) {
    const [, id, target] = match;
    // Normalize target path (remove leading ../)
    const normalizedTarget = target.replace(/^\.\.\//, "");
    map[id] = normalizedTarget;
  }

  return map;
}

/**
 * Parse slide order from presentation.xml
 */
function parseSlideOrder(xml: string): string[] {
  const slideIds: string[] = [];
  const sldIdRegex = /<p:sldId[^>]*r:id="([^"]+)"[^>]*\/>/g;
  let match;

  while ((match = sldIdRegex.exec(xml)) !== null) {
    slideIds.push(match[1]);
  }

  return slideIds;
}

/**
 * Parse metadata from core.xml
 */
function parseMetadata(xml: string): PresentationMetadata {
  const metadata: PresentationMetadata = {
    version: 1,
  };

  const titleMatch = xml.match(/<dc:title>([^<]*)<\/dc:title>/);
  if (titleMatch) metadata.title = titleMatch[1];

  const creatorMatch = xml.match(/<dc:creator>([^<]*)<\/dc:creator>/);
  if (creatorMatch) metadata.author = creatorMatch[1];

  const subjectMatch = xml.match(/<dc:subject>([^<]*)<\/dc:subject>/);
  if (subjectMatch) metadata.subject = subjectMatch[1];

  // Company is often in extended properties
  const companyMatch = xml.match(/<Company>([^<]*)<\/Company>/);
  if (companyMatch) metadata.company = companyMatch[1];

  return metadata;
}

/**
 * Parse speaker notes from notesSlide XML
 */
function parseNotes(xml: string): string {
  const textContent: string[] = [];
  const textRegex = /<a:t>([^<]*)<\/a:t>/g;
  let match;

  while ((match = textRegex.exec(xml)) !== null) {
    textContent.push(match[1]);
  }

  // Filter out placeholder text patterns
  return textContent
    .filter((t) => !t.includes("Click to add") && t.trim().length > 0)
    .join("\n");
}

/**
 * Parse a single slide
 */
async function parseSlide(
  xml: string,
  rels: Record<string, string>,
  zip: JSZip,
  index: number
): Promise<Slide> {
  const slide: Slide = {
    id: `slide-${index + 1}`,
    layout: detectLayout(xml),
    elements: [],
  };

  // Parse background
  const background = parseBackground(xml);
  if (background) {
    slide.background = background;
  }

  // Parse shape tree (contains all elements)
  const spTreeMatch = xml.match(/<p:spTree>([\s\S]*?)<\/p:spTree>/);
  if (!spTreeMatch) return slide;

  const spTree = spTreeMatch[1];

  // Parse text shapes (sp elements)
  const textElements = await parseTextShapes(spTree);
  slide.elements.push(...textElements);

  // Parse images (pic elements)
  const imageElements = await parseImages(spTree, rels, zip);
  slide.elements.push(...imageElements);

  // Parse shapes (sp elements with preset geometry)
  const shapeElements = parseShapes(spTree);
  slide.elements.push(...shapeElements);

  return slide;
}

/**
 * Detect slide layout based on content
 */
function detectLayout(xml: string): SlideLayout {
  // Check for common layout patterns
  if (xml.includes('type="ctrTitle"') || xml.includes('type="subTitle"')) {
    return "title";
  }
  if (xml.includes('type="body"') && xml.includes('type="title"')) {
    return "titleAndContent";
  }
  if (xml.match(/<p:sp[^>]*>[\s\S]*?<p:sp[^>]*>/)) {
    // Multiple shapes might indicate two-column
    const bodyCount = (xml.match(/type="body"/g) || []).length;
    if (bodyCount >= 2) {
      return "twoColumn";
    }
  }
  return "blank";
}

/**
 * Parse slide background
 */
function parseBackground(xml: string): SlideBackground | undefined {
  // Check for solid fill background
  const bgColorMatch = xml.match(/<p:bg>[\s\S]*?<a:srgbClr val="([A-Fa-f0-9]+)"[\s\S]*?<\/p:bg>/);
  if (bgColorMatch) {
    return { color: `#${bgColorMatch[1]}` };
  }

  // Check for image background
  const bgImageMatch = xml.match(/<p:bgPr>[\s\S]*?<a:blip[^>]*r:embed="([^"]+)"[\s\S]*?<\/p:bgPr>/);
  if (bgImageMatch) {
    // Would need to load image from zip - simplified for now
    return undefined;
  }

  return undefined;
}

/**
 * Parse text shapes from spTree
 */
async function parseTextShapes(spTree: string): Promise<TextElement[]> {
  const elements: TextElement[] = [];
  const spRegex = /<p:sp>([\s\S]*?)<\/p:sp>/g;
  let match;
  let elementId = 1;

  while ((match = spRegex.exec(spTree)) !== null) {
    const spContent = match[1];

    // Skip if this is a picture or has preset geometry (it's a shape, not text)
    if (spContent.includes("<a:prstGeom") && !spContent.includes('prst="rect"')) {
      continue;
    }

    // Get position and size
    const xfrm = parseTransform(spContent);
    if (!xfrm) continue;

    // Get text content
    const textContent = parseTextContent(spContent);
    if (!textContent || textContent.trim().length === 0) continue;

    // Skip placeholder text
    if (textContent.includes("Click to add")) continue;

    // Get text formatting
    const textOptions = parseTextOptions(spContent);

    elements.push({
      id: `text-${elementId++}`,
      type: "text",
      content: textContent,
      x: xfrm.x,
      y: xfrm.y,
      w: xfrm.w,
      h: xfrm.h,
      rotation: xfrm.rotation,
      options: textOptions,
    });
  }

  return elements;
}

/**
 * Parse images from spTree
 */
async function parseImages(
  spTree: string,
  rels: Record<string, string>,
  zip: JSZip
): Promise<ImageElement[]> {
  const elements: ImageElement[] = [];
  const picRegex = /<p:pic>([\s\S]*?)<\/p:pic>/g;
  let match;
  let elementId = 1;

  while ((match = picRegex.exec(spTree)) !== null) {
    const picContent = match[1];

    // Get position and size
    const xfrm = parseTransform(picContent);
    if (!xfrm) continue;

    // Get image relationship ID
    const blipMatch = picContent.match(/<a:blip[^>]*r:embed="([^"]+)"/);
    if (!blipMatch) continue;

    const rId = blipMatch[1];
    const imagePath = rels[rId];
    if (!imagePath) continue;

    // Load image data as base64
    const imageFile = zip.file(`ppt/${imagePath}`);
    if (!imageFile) continue;

    const imageData = await imageFile.async("base64");
    const ext = imagePath.split(".").pop()?.toLowerCase() || "png";
    const mimeType = ext === "jpg" || ext === "jpeg" ? "image/jpeg" : `image/${ext}`;

    elements.push({
      id: `image-${elementId++}`,
      type: "image",
      src: `data:${mimeType};base64,${imageData}`,
      x: xfrm.x,
      y: xfrm.y,
      w: xfrm.w,
      h: xfrm.h,
      rotation: xfrm.rotation,
    });
  }

  return elements;
}

/**
 * Parse shape elements from spTree
 */
function parseShapes(spTree: string): ShapeElement[] {
  const elements: ShapeElement[] = [];
  const spRegex = /<p:sp>([\s\S]*?)<\/p:sp>/g;
  let match;
  let elementId = 1;

  while ((match = spRegex.exec(spTree)) !== null) {
    const spContent = match[1];

    // Only process shapes with preset geometry (not text boxes)
    const prstGeomMatch = spContent.match(/<a:prstGeom prst="([^"]+)"/);
    if (!prstGeomMatch) continue;

    const prstGeom = prstGeomMatch[1];

    // Skip rectangle if it has significant text content (it's a text box)
    if (prstGeom === "rect") {
      const textContent = parseTextContent(spContent);
      if (textContent && textContent.trim().length > 0 && !textContent.includes("Click to add")) {
        continue;
      }
    }

    // Get position and size
    const xfrm = parseTransform(spContent);
    if (!xfrm) continue;

    // Map PPTX preset geometry to our shape types
    const shapeType = mapPresetGeometry(prstGeom);
    if (!shapeType) continue;

    // Parse fill and line
    const fill = parseFill(spContent);
    const line = parseLine(spContent);

    elements.push({
      id: `shape-${elementId++}`,
      type: "shape",
      shapeType,
      x: xfrm.x,
      y: xfrm.y,
      w: xfrm.w,
      h: xfrm.h,
      rotation: xfrm.rotation,
      options: {
        fill: fill ? { color: fill } : undefined,
        line: line,
      },
    });
  }

  return elements;
}

/**
 * Parse transform (position, size, rotation) from element XML
 */
function parseTransform(
  xml: string
): { x: number; y: number; w: number; h: number; rotation?: number } | null {
  const xfrmMatch = xml.match(/<a:xfrm[^>]*>([\s\S]*?)<\/a:xfrm>/);
  if (!xfrmMatch) return null;

  const xfrmContent = xfrmMatch[0];

  // Parse offset (position)
  const offMatch = xfrmContent.match(/<a:off x="(\d+)" y="(\d+)"\/>/);
  if (!offMatch) return null;

  // Parse extent (size)
  const extMatch = xfrmContent.match(/<a:ext cx="(\d+)" cy="(\d+)"\/>/);
  if (!extMatch) return null;

  // Parse rotation (optional)
  const rotMatch = xfrmContent.match(/rot="(-?\d+)"/);
  const rotation = rotMatch ? parseInt(rotMatch[1]) / 60000 : undefined; // EMU angle to degrees

  return {
    x: parseInt(offMatch[1]) / EMU_PER_INCH,
    y: parseInt(offMatch[2]) / EMU_PER_INCH,
    w: parseInt(extMatch[1]) / EMU_PER_INCH,
    h: parseInt(extMatch[2]) / EMU_PER_INCH,
    rotation: rotation !== 0 ? rotation : undefined,
  };
}

/**
 * Parse text content from element XML
 */
function parseTextContent(xml: string): string {
  const textParts: string[] = [];
  const paragraphRegex = /<a:p>([\s\S]*?)<\/a:p>/g;
  let pMatch;

  while ((pMatch = paragraphRegex.exec(xml)) !== null) {
    const paragraph = pMatch[1];
    const textRegex = /<a:t>([^<]*)<\/a:t>/g;
    let tMatch;
    const paragraphText: string[] = [];

    while ((tMatch = textRegex.exec(paragraph)) !== null) {
      paragraphText.push(tMatch[1]);
    }

    if (paragraphText.length > 0) {
      textParts.push(paragraphText.join(""));
    }
  }

  return textParts.join("\n");
}

/**
 * Parse text formatting options
 */
function parseTextOptions(xml: string): TextElement["options"] {
  const options: TextElement["options"] = {};

  // Font size (in hundredths of a point)
  const szMatch = xml.match(/<a:defRPr[^>]*sz="(\d+)"/);
  if (szMatch) {
    options.fontSize = parseInt(szMatch[1]) / 100;
  }

  // Font face
  const fontMatch = xml.match(/<a:latin typeface="([^"]+)"/);
  if (fontMatch) {
    options.fontFace = fontMatch[1];
  }

  // Bold
  if (xml.includes('b="1"')) {
    options.bold = true;
  }

  // Italic
  if (xml.includes('i="1"')) {
    options.italic = true;
  }

  // Underline
  if (xml.includes('u="sng"')) {
    options.underline = true;
  }

  // Text color
  const colorMatch = xml.match(/<a:solidFill>[\s\S]*?<a:srgbClr val="([A-Fa-f0-9]+)"[\s\S]*?<\/a:solidFill>/);
  if (colorMatch) {
    options.color = colorMatch[1];
  }

  // Alignment
  const alignMatch = xml.match(/algn="([^"]+)"/);
  if (alignMatch) {
    const alignMap: Record<string, "left" | "center" | "right" | "justify"> = {
      l: "left",
      ctr: "center",
      r: "right",
      just: "justify",
    };
    options.align = alignMap[alignMatch[1]];
  }

  return options;
}

/**
 * Parse fill color from element XML
 */
function parseFill(xml: string): string | undefined {
  const fillMatch = xml.match(/<a:solidFill>[\s\S]*?<a:srgbClr val="([A-Fa-f0-9]+)"[\s\S]*?<\/a:solidFill>/);
  if (fillMatch) {
    return `#${fillMatch[1]}`;
  }
  return undefined;
}

/**
 * Parse line (stroke) from element XML
 */
function parseLine(
  xml: string
): { color: string; width?: number } | undefined {
  const lnMatch = xml.match(/<a:ln[^>]*w="(\d+)"[^>]*>([\s\S]*?)<\/a:ln>/);
  if (!lnMatch) return undefined;

  const width = parseInt(lnMatch[1]) / EMU_PER_INCH; // Convert EMU to inches
  const lnContent = lnMatch[2];

  const colorMatch = lnContent.match(/<a:srgbClr val="([A-Fa-f0-9]+)"/);
  const color = colorMatch ? `#${colorMatch[1]}` : "#000000";

  return { color, width };
}

/**
 * Map PPTX preset geometry to our shape types
 */
function mapPresetGeometry(prst: string): ShapeElement["shapeType"] | null {
  const map: Record<string, ShapeElement["shapeType"]> = {
    rect: "rect",
    roundRect: "roundRect",
    ellipse: "ellipse",
    triangle: "triangle",
    line: "line",
    rightArrow: "arrow",
    leftArrow: "arrow",
    upArrow: "arrow",
    downArrow: "arrow",
    star5: "star5",
    diamond: "diamond",
  };

  return map[prst] || null;
}

/**
 * Parse theme from presentation
 */
async function parseTheme(zip: JSZip): Promise<PresentationTheme> {
  // Try to find theme file
  const themeFile = zip.file(/ppt\/theme\/theme\d+\.xml/)?.[0];
  if (!themeFile) {
    return DEFAULT_THEME;
  }

  const themeXml = await themeFile.async("string");

  // Parse theme colors (simplified - just grab first few scheme colors)
  const colors: PresentationTheme["colors"] = {
    primary: "#0066CC",
    secondary: "#333333",
  };

  // Look for accent colors
  const accentMatch = themeXml.match(/<a:accent1>[\s\S]*?<a:srgbClr val="([A-Fa-f0-9]+)"[\s\S]*?<\/a:accent1>/);
  if (accentMatch) {
    colors.primary = `#${accentMatch[1]}`;
  }

  const dk1Match = themeXml.match(/<a:dk1>[\s\S]*?<a:srgbClr val="([A-Fa-f0-9]+)"[\s\S]*?<\/a:dk1>/);
  if (dk1Match) {
    colors.secondary = `#${dk1Match[1]}`;
  }

  const lt1Match = themeXml.match(/<a:lt1>[\s\S]*?<a:srgbClr val="([A-Fa-f0-9]+)"[\s\S]*?<\/a:lt1>/);
  if (lt1Match) {
    colors.background = `#${lt1Match[1]}`;
  }

  return {
    name: "imported",
    colors,
  };
}
