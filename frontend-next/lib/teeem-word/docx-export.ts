/**
 * DOCX Export Utility
 * Converts HTML content to Word documents (.docx) using the docx library
 */

import {
  Document,
  Paragraph,
  TextRun,
  HeadingLevel,
  Table,
  TableRow,
  TableCell,
  WidthType,
  AlignmentType,
  Packer,
  ImageRun,
  ExternalHyperlink,
  UnderlineType,
  BorderStyle,
} from "docx";

// Heading level mapping
const HEADING_LEVELS: Record<string, (typeof HeadingLevel)[keyof typeof HeadingLevel]> = {
  H1: HeadingLevel.HEADING_1,
  H2: HeadingLevel.HEADING_2,
  H3: HeadingLevel.HEADING_3,
  H4: HeadingLevel.HEADING_4,
  H5: HeadingLevel.HEADING_5,
  H6: HeadingLevel.HEADING_6,
};

// Text alignment mapping
const ALIGNMENT_MAP: Record<string, (typeof AlignmentType)[keyof typeof AlignmentType]> = {
  left: AlignmentType.LEFT,
  center: AlignmentType.CENTER,
  right: AlignmentType.RIGHT,
  justify: AlignmentType.JUSTIFIED,
};

interface TextStyle {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strike?: boolean;
  color?: string;
  highlight?: string;
}

/**
 * Export HTML content to a DOCX file
 * @param html - The HTML content to export
 * @param filename - The filename for the exported document
 */
export async function exportDocx(html: string, filename: string): Promise<void> {
  const doc = await htmlToDocx(html);
  const blob = await Packer.toBlob(doc);

  // Trigger download
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".docx") ? filename : `${filename}.docx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Convert HTML string to a DOCX Document object
 */
export async function htmlToDocx(html: string): Promise<Document> {
  // Parse HTML
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  const body = doc.body;

  // Convert body children to paragraphs
  const children = await convertChildrenToDocx(body);

  return new Document({
    sections: [
      {
        properties: {},
        children,
      },
    ],
  });
}

/**
 * Convert DOM children to DOCX elements
 */
async function convertChildrenToDocx(
  parent: Element
): Promise<(Paragraph | Table)[]> {
  const result: (Paragraph | Table)[] = [];

  for (const node of Array.from(parent.childNodes)) {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent?.trim();
      if (text) {
        result.push(new Paragraph({ children: [new TextRun(text)] }));
      }
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const element = node as Element;
      const converted = await convertElementToDocx(element);
      if (converted) {
        if (Array.isArray(converted)) {
          result.push(...converted);
        } else {
          result.push(converted);
        }
      }
    }
  }

  return result;
}

/**
 * Convert a single DOM element to DOCX element(s)
 */
async function convertElementToDocx(
  element: Element
): Promise<Paragraph | Table | (Paragraph | Table)[] | null> {
  const tagName = element.tagName.toUpperCase();

  // Handle headings
  if (HEADING_LEVELS[tagName]) {
    const textRuns = await extractTextRuns(element, {});
    const alignment = getAlignment(element);
    return new Paragraph({
      heading: HEADING_LEVELS[tagName],
      children: textRuns,
      alignment,
    });
  }

  // Handle paragraphs
  if (tagName === "P") {
    const textRuns = await extractTextRuns(element, {});
    const alignment = getAlignment(element);
    return new Paragraph({
      children: textRuns,
      alignment,
    });
  }

  // Handle divs (treat as containers)
  if (tagName === "DIV") {
    return convertChildrenToDocx(element);
  }

  // Handle unordered lists
  if (tagName === "UL") {
    return convertListToDocx(element, false);
  }

  // Handle ordered lists
  if (tagName === "OL") {
    return convertListToDocx(element, true);
  }

  // Handle tables
  if (tagName === "TABLE") {
    return convertTableToDocx(element);
  }

  // Handle blockquotes
  if (tagName === "BLOCKQUOTE") {
    const children = await convertChildrenToDocx(element);
    // Add indentation to blockquote paragraphs
    return children.map((child) => {
      if (child instanceof Paragraph) {
        return new Paragraph({
          ...child,
          indent: { left: 720 }, // 0.5 inch indent
        });
      }
      return child;
    });
  }

  // Handle horizontal rules
  if (tagName === "HR") {
    return new Paragraph({
      children: [],
      border: {
        bottom: {
          color: "999999",
          space: 1,
          size: 6,
          style: BorderStyle.SINGLE,
        },
      },
    });
  }

  // Handle line breaks - create empty paragraph
  if (tagName === "BR") {
    return new Paragraph({ children: [] });
  }

  // Handle images
  if (tagName === "IMG") {
    const src = element.getAttribute("src");
    if (src && src.startsWith("data:")) {
      try {
        const imageRun = await createImageFromDataUrl(src);
        if (imageRun) {
          return new Paragraph({ children: [imageRun] });
        }
      } catch (e) {
        console.warn("Failed to convert image:", e);
      }
    }
    return null;
  }

  // For other inline elements, try to extract text
  if (isInlineElement(tagName)) {
    const textRuns = await extractTextRuns(element, {});
    if (textRuns.length > 0) {
      return new Paragraph({ children: textRuns });
    }
  }

  // Default: try to convert children
  return convertChildrenToDocx(element);
}

/**
 * Extract text runs from an element, preserving formatting
 */
async function extractTextRuns(
  element: Element | ChildNode,
  inheritedStyle: TextStyle
): Promise<(TextRun | ExternalHyperlink)[]> {
  const runs: (TextRun | ExternalHyperlink)[] = [];

  for (const node of Array.from(element.childNodes)) {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent || "";
      if (text) {
        runs.push(
          new TextRun({
            text,
            bold: inheritedStyle.bold,
            italics: inheritedStyle.italic,
            underline: inheritedStyle.underline
              ? { type: UnderlineType.SINGLE }
              : undefined,
            strike: inheritedStyle.strike,
            color: inheritedStyle.color,
            highlight: inheritedStyle.highlight as any,
          })
        );
      }
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as Element;
      const tagName = el.tagName.toUpperCase();
      const newStyle = { ...inheritedStyle };

      // Update style based on tag
      if (tagName === "STRONG" || tagName === "B") newStyle.bold = true;
      if (tagName === "EM" || tagName === "I") newStyle.italic = true;
      if (tagName === "U") newStyle.underline = true;
      if (tagName === "S" || tagName === "STRIKE" || tagName === "DEL")
        newStyle.strike = true;

      // Handle links
      if (tagName === "A") {
        const href = el.getAttribute("href") || "";
        const linkText = el.textContent || "";
        if (href && linkText) {
          runs.push(
            new ExternalHyperlink({
              children: [
                new TextRun({
                  text: linkText,
                  style: "Hyperlink",
                }),
              ],
              link: href,
            })
          );
          continue;
        }
      }

      // Handle spans with styles
      if (tagName === "SPAN") {
        const style = el.getAttribute("style") || "";
        if (style.includes("color:")) {
          const colorMatch = style.match(/color:\s*([^;]+)/);
          if (colorMatch) {
            newStyle.color = colorMatch[1].replace("#", "").trim();
          }
        }
        if (style.includes("background-color:")) {
          const bgMatch = style.match(/background-color:\s*([^;]+)/);
          if (bgMatch) {
            // Map common colors to Word highlight colors
            const bg = bgMatch[1].toLowerCase();
            if (bg.includes("yellow")) newStyle.highlight = "yellow";
            else if (bg.includes("green")) newStyle.highlight = "green";
            else if (bg.includes("cyan")) newStyle.highlight = "cyan";
            else if (bg.includes("magenta")) newStyle.highlight = "magenta";
            else if (bg.includes("blue")) newStyle.highlight = "blue";
            else if (bg.includes("red")) newStyle.highlight = "red";
          }
        }
      }

      // Handle mark (highlight)
      if (tagName === "MARK") {
        newStyle.highlight = "yellow";
      }

      // Recursively extract text runs
      const childRuns = await extractTextRuns(el, newStyle);
      runs.push(...childRuns);
    }
  }

  return runs;
}

/**
 * Convert a list element to DOCX paragraphs
 */
function convertListToDocx(
  listElement: Element,
  ordered: boolean
): Paragraph[] {
  const paragraphs: Paragraph[] = [];
  let index = 1;

  for (const li of Array.from(listElement.querySelectorAll(":scope > li"))) {
    const text = li.textContent || "";
    const bullet = ordered ? `${index}. ` : "• ";

    paragraphs.push(
      new Paragraph({
        children: [new TextRun(bullet + text)],
        indent: { left: 720 }, // 0.5 inch indent
      })
    );

    index++;
  }

  return paragraphs;
}

/**
 * Convert a table element to DOCX Table
 */
function convertTableToDocx(tableElement: Element): Table {
  const rows: TableRow[] = [];

  // Get all rows (from thead and tbody)
  const allRows = tableElement.querySelectorAll("tr");

  for (const tr of Array.from(allRows)) {
    const cells: TableCell[] = [];
    const cellElements = tr.querySelectorAll("th, td");

    for (const cell of Array.from(cellElements)) {
      const isHeader = cell.tagName.toUpperCase() === "TH";
      const text = cell.textContent || "";

      cells.push(
        new TableCell({
          children: [
            new Paragraph({
              children: [
                new TextRun({
                  text,
                  bold: isHeader,
                }),
              ],
            }),
          ],
          width: { size: 100 / cellElements.length, type: WidthType.PERCENTAGE },
        })
      );
    }

    if (cells.length > 0) {
      rows.push(new TableRow({ children: cells }));
    }
  }

  return new Table({
    rows,
    width: { size: 100, type: WidthType.PERCENTAGE },
  });
}

/**
 * Create an ImageRun from a data URL
 */
async function createImageFromDataUrl(dataUrl: string): Promise<ImageRun | null> {
  try {
    // Extract base64 data
    const matches = dataUrl.match(/^data:image\/(\w+);base64,(.+)$/);
    if (!matches) return null;

    const base64Data = matches[2];

    // Convert base64 to Uint8Array
    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    return new ImageRun({
      data: bytes,
      transformation: {
        width: 400,
        height: 300,
      },
      type: "png",
    });
  } catch (e) {
    console.warn("Failed to create image:", e);
    return null;
  }
}

/**
 * Get alignment from element style
 */
function getAlignment(
  element: Element
): (typeof AlignmentType)[keyof typeof AlignmentType] | undefined {
  const style = element.getAttribute("style") || "";
  const alignMatch = style.match(/text-align:\s*(\w+)/);
  if (alignMatch && ALIGNMENT_MAP[alignMatch[1]]) {
    return ALIGNMENT_MAP[alignMatch[1]];
  }
  return undefined;
}

/**
 * Check if an element is an inline element
 */
function isInlineElement(tagName: string): boolean {
  return [
    "SPAN",
    "STRONG",
    "B",
    "EM",
    "I",
    "U",
    "S",
    "STRIKE",
    "DEL",
    "A",
    "MARK",
    "CODE",
    "SUB",
    "SUP",
  ].includes(tagName);
}
