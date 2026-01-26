/**
 * DOCX Import Utility
 * Converts Word documents (.docx) to HTML using mammoth
 */

import mammoth from "mammoth";

export interface ImportResult {
  html: string;
  messages: string[];
}

/**
 * Import a DOCX file and convert it to HTML
 * @param file - The File object to import
 * @returns Promise with HTML content and any conversion messages
 */
export async function importDocx(file: File): Promise<ImportResult> {
  const arrayBuffer = await file.arrayBuffer();

  const result = await mammoth.convertToHtml(
    { arrayBuffer },
    {
      // Style mapping for better conversion
      styleMap: [
        "p[style-name='Heading 1'] => h1:fresh",
        "p[style-name='Heading 2'] => h2:fresh",
        "p[style-name='Heading 3'] => h3:fresh",
        "p[style-name='Heading 4'] => h4:fresh",
        "p[style-name='Heading 5'] => h5:fresh",
        "p[style-name='Heading 6'] => h6:fresh",
        "p[style-name='Title'] => h1.title:fresh",
        "p[style-name='Subtitle'] => p.subtitle:fresh",
        "r[style-name='Strong'] => strong",
        "r[style-name='Emphasis'] => em",
      ],
      // Convert images to base64 data URLs
      convertImage: mammoth.images.imgElement(async (image) => {
        const buffer = await image.read("base64");
        const contentType = image.contentType || "image/png";
        return {
          src: `data:${contentType};base64,${buffer}`,
        };
      }),
    }
  );

  // Collect any warnings or messages
  const messages = result.messages.map((msg) => {
    if (msg.type === "warning") {
      return `Warning: ${msg.message}`;
    }
    return msg.message;
  });

  return {
    html: result.value,
    messages,
  };
}

/**
 * Read a file as ArrayBuffer
 */
export function readFileAsArrayBuffer(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(file);
  });
}
