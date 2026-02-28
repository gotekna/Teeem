/**
 * SSoT for formatting file links in email HTML bodies.
 *
 * Used by Library (document sharing) and Tasks (Q&A email responses).
 *
 * Exports (layered — use the highest-level function that fits):
 *   formatFileEmailBody    — full email: greeting + files + ZIP + closing + sig + footer (Library)
 *   formatTeeemFooter      — TEEEM marketing footer (logo + tagline)
 *   formatZipAndClosing    — ZIP + expiry + closing tail (Tasks, after Q&A content)
 *   formatFileLinksSection — "File links:" header + <ul> (Tasks linked-files block)
 *   formatFileLink         — single line: "Name · Download · Open" (Tasks inline)
 */

import { generateSimpleSignature, type SignatureUserData, type SignatureCompanyData } from '@/lib/email-signature';

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
 */
export function formatZipAndClosing(options: {
  linkedFileCount: number;
  zipUrl?: string;
  zipFileCount?: number;
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

// ─── TEEEM marketing footer ─────────────────────────────────────────

/**
 * SSoT: TEEEM branded footer with logo and tagline.
 * Used at the bottom of all outgoing emails (after signature).
 */
export function formatTeeemFooter(): string {
  const teeemLogoUrl = 'https://app.teeem.com.au/icons/teeem-logo-28.png';
  const teeemLogoSmallUrl = 'https://app.teeem.com.au/icons/teeem-logo-10.png';

  let html = '\n<br><br>\n';
  html += '<table style="border-top: 1px solid #eee; padding-top: 12px; margin-top: 20px;"><tr>';
  html += '<td style="vertical-align: middle; padding-right: 8px;">';
  html += `<img src="${teeemLogoUrl}" alt="t" style="vertical-align:middle;">`;
  html += `<span style="font-family:Georgia,'Times New Roman',serif;font-size:22px;font-weight:normal;color:#18181b;margin-left:6px;vertical-align:middle;">teeem</span>`;
  html += '</td>';
  html += '<td style="vertical-align: middle; padding-left: 12px;">';
  html += '<p style="font-size: 11px; color: #999; margin: 0;">Complete Business Solution</p>';
  html += '<p style="font-size: 10px; color: #aaa; margin-top: 4px;">\ud83d\udee1\ufe0f <strong>T</strong>rust \u00b7 \u26a1 <strong>E</strong>mpower \u00b7 \ud83d\udcc8 <strong>E</strong>volve \u00b7 \ud83d\ude0a <strong>E</strong>njoy \u00b7 \ud83c\udfaf <strong>M</strong>easure</p>';
  html += `<p style="font-size: 10px; color: #aaa; margin-top: 6px;">This email was produced by <img src="${teeemLogoSmallUrl}" alt="t" style="vertical-align:middle;margin-right:2px;"><span style="font-family:Georgia,'Times New Roman',serif;font-size:10px;font-weight:normal;color:#18181b;vertical-align:middle;">teeem</span> <a href="https://www.teeem.com.au" style="font-size:10px;color:#666;margin-left:4px;">teeem.com.au</a></p>`;
  html += '</td>';
  html += '</tr></table>\n';

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
 *   6. Signature  (from user/company data)
 *   7. TEEEM footer
 *
 * Caller should pass skipSignature={true} to ComposeEmailModal since
 * the signature is embedded in the body.
 */
export function formatFileEmailBody(options: {
  recipientName?: string;
  files: FileLink[];
  zipUrl?: string;
  zipFileCount?: number;
  expiryDays?: number;
  /** Current user for signature. Omit to skip signature. */
  user?: SignatureUserData;
  /** Company data for signature. */
  company?: SignatureCompanyData;
}): string {
  const { recipientName, files, zipUrl, zipFileCount, expiryDays = 7, user, company } = options;

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

  // Signature
  if (user) {
    const signature = generateSimpleSignature(user, company);
    if (signature) {
      html += '\n' + signature + '\n';
    }
  }

  // TEEEM footer
  html += formatTeeemFooter();

  return html;
}
