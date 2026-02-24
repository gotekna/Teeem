/**
 * SSoT for formatting file links in email HTML bodies.
 *
 * Used by Library (document sharing) and Tasks (Q&A email responses).
 * Format: "FileName.pdf · Download · Open"
 *   - File name is plain text (NOT a hyperlink)
 *   - Download = presigned URL with Content-Disposition: attachment
 *   - Open = viewer URL (browser displays file inline)
 */

const LINK_STYLE = 'color: #666; font-size: 0.9em;';

/**
 * Format a single file's link HTML for an email body.
 *
 * @returns HTML string like: `FileName.pdf · <a>Download</a> · <a>Open</a>`
 */
export function formatFileLink(
  fileName: string,
  downloadUrl?: string,
  openUrl?: string
): string {
  if (downloadUrl && openUrl) {
    return `${fileName} · <a href="${downloadUrl}" style="${LINK_STYLE}">Download</a> · <a href="${openUrl}" target="_blank" style="${LINK_STYLE}">Open</a>`;
  }
  if (downloadUrl) {
    return `${fileName} · <a href="${downloadUrl}" style="${LINK_STYLE}">Download</a>`;
  }
  if (openUrl) {
    return `${fileName} · <a href="${openUrl}" target="_blank" style="${LINK_STYLE}">Open</a>`;
  }
  return fileName;
}

/**
 * Build a complete "File links:" section for an email body.
 *
 * @returns HTML string with header, `<ul>` of file links, and expiry note.
 */
export function formatFileLinksSection(
  files: Array<{ name: string; downloadUrl?: string; openUrl?: string }>,
  options?: { expiryDays?: number }
): string {
  if (files.length === 0) return '';

  const expiryDays = options?.expiryDays ?? 7;

  let html = `<p><strong>File links:</strong></p>\n<ul>\n`;
  for (const file of files) {
    html += `<li>${formatFileLink(file.name, file.downloadUrl, file.openUrl)}</li>\n`;
  }
  html += `</ul>\n`;
  html += `<p style="font-size: 12px; color: #666;"><em>Note: These download links expire in ${expiryDays} days.</em></p>\n`;

  return html;
}
