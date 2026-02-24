/**
 * SSoT for formatting file links in email HTML bodies.
 *
 * Used by Library (document sharing) and Tasks (Q&A email responses).
 *
 * Exports (layered — use the highest-level function that fits):
 *   formatFileEmailBody  — full email: greeting + files + ZIP + closing (Library)
 *   formatZipAndClosing  — ZIP + expiry + closing tail (Tasks, after Q&A content)
 *   formatFileLinksSection — "File links:" header + <ul> (Tasks linked-files block)
 *   formatFileLink       — single line: "Name · Download · Open" (Tasks inline)
 */

const LINK_STYLE = 'color: #666; font-size: 0.9em;';

export interface FileLink {
  name: string;
  downloadUrl?: string;
  openUrl?: string;
}

// ─── Single file line ────────────────────────────────────────────────

/**
 * Format one file as: `FileName.pdf · Download · Open`
 * File name is plain text (NOT a hyperlink).
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

// ─── File links section (header + list) ──────────────────────────────

/**
 * "File links:" header + bullet list. No expiry note (caller adds via
 * formatZipAndClosing or formatFileEmailBody).
 */
export function formatFileLinksSection(files: FileLink[]): string {
  if (files.length === 0) return '';

  let html = `<p><strong>File links:</strong></p>\n<ul>\n`;
  for (const file of files) {
    html += `<li>${formatFileLink(file.name, file.downloadUrl, file.openUrl)}</li>\n`;
  }
  html += `</ul>\n`;
  return html;
}

// ─── ZIP + expiry + closing ──────────────────────────────────────────

/**
 * Tail section for file-sharing emails:
 *   - ZIP link (if provided and > 1 file)
 *   - Expiry note
 *   - Closing line
 *
 * Used by Tasks after Q&A content + linked files block.
 */
export function formatZipAndClosing(options: {
  /** Total linked-file count (for expiry note even without ZIP) */
  linkedFileCount: number;
  /** ZIP download URL (omit if not available) */
  zipUrl?: string;
  /** File count shown in ZIP message (defaults to linkedFileCount) */
  zipFileCount?: number;
  /** Days until links expire (default 7) */
  expiryDays?: number;
}): string {
  const { linkedFileCount, zipUrl, expiryDays = 7 } = options;
  const zipFileCount = options.zipFileCount ?? linkedFileCount;
  let html = '';

  if (zipUrl && zipFileCount > 1) {
    html += `<p>For your convenience, you can download all ${zipFileCount} files in a single ZIP archive:</p>\n`;
    html += `<p>\ud83d\udce6 <a href="${zipUrl}"><strong>Download All Files (ZIP)</strong></a></p>\n`;
    html += `<p style="font-size: 12px; color: #666;"><em>Note: This download link expires in ${expiryDays} day${expiryDays === 1 ? '' : 's'}.</em></p>\n`;
  } else if (linkedFileCount > 0) {
    html += `<p style="font-size: 12px; color: #666;"><em>Note: These download links expire in ${expiryDays} days.</em></p>\n`;
  }

  html += `<p></p>\n`;
  html += `<p>Please let me know if you have any further questions.</p>\n`;
  return html;
}

// ─── Full email body ─────────────────────────────────────────────────

/**
 * SSoT: Complete file-sharing email body.
 *
 *   1. Greeting  ("Hi {name},")
 *   2. File links (bullet list with Download · Open)
 *   3. ZIP link   (optional, for multiple files)
 *   4. Expiry note
 *   5. Closing line
 *
 * Signature is NOT included — ComposeEmailModal adds it automatically.
 */
export function formatFileEmailBody(options: {
  /** Recipient first name for greeting. Omit for generic "Hi," */
  recipientName?: string;
  /** Files to list with Download/Open links */
  files: FileLink[];
  /** Optional ZIP download URL (shown when > 1 file) */
  zipUrl?: string;
  /** Total file count for ZIP message (defaults to files.length) */
  zipFileCount?: number;
  /** Days until links expire (default 7) */
  expiryDays?: number;
}): string {
  const { recipientName, files, zipUrl, zipFileCount, expiryDays = 7 } = options;

  // Greeting
  const name = recipientName || '';
  let html = `<p>Hi${name ? ` ${name}` : ''},</p>\n`;
  html += `<p>&nbsp;</p>\n`;

  // File links
  html += formatFileLinksSection(files);

  // ZIP + expiry + closing
  html += formatZipAndClosing({
    linkedFileCount: files.length,
    zipUrl,
    zipFileCount,
    expiryDays,
  });

  return html;
}
