/**
 * Email utility functions for parsing and extracting email addresses
 */

import { EMAIL_REGEX } from "./email-constants";

/**
 * Parse email with optional display name
 * @param emailString - Email string in format "Name <email>" or "email"
 * @returns Object with name and email
 *
 * @example
 * parseEmailWithName("John Doe <john@example.com>")
 * // Returns: { name: "John Doe", email: "john@example.com" }
 *
 * parseEmailWithName("john@example.com")
 * // Returns: { name: null, email: "john@example.com" }
 */
export function parseEmailWithName(emailString: string): {
  name: string | null;
  email: string;
} {
  const trimmed = emailString.trim();

  // Check for "Name <email>" format
  const match = trimmed.match(/^(.+?)\s*<(.+?)>$/);

  if (match) {
    return {
      name: match[1].trim(),
      email: match[2].trim(),
    };
  }

  return {
    name: null,
    email: trimmed,
  };
}

/**
 * Extract all email addresses from a table row
 * Looks for fields with "email" in the key name
 *
 * @param row - Table row object
 * @returns Array of unique email addresses
 *
 * @example
 * extractEmailsFromRow({
 *   from_email: "john@example.com",
 *   to_emails: ["jane@example.com", "bob@example.com"],
 *   cc_emails: ["alice@example.com"]
 * })
 * // Returns: ["john@example.com", "jane@example.com", "bob@example.com", "alice@example.com"]
 */
export function extractEmailsFromRow(row: Record<string, unknown>): string[] {
  const emails: string[] = [];

  Object.entries(row).forEach(([key, value]) => {
    // Check if key contains "email"
    if (key.toLowerCase().includes('email')) {
      if (typeof value === 'string' && value) {
        emails.push(value);
      } else if (Array.isArray(value)) {
        // Filter out non-string values and add to emails
        emails.push(...value.filter((v) => typeof v === 'string' && v));
      }
    }
  });

  // Filter to only valid emails (contains @) and deduplicate
  const validEmails = emails.filter((e) => e && e.includes('@'));
  return Array.from(new Set(validEmails));
}

/**
 * Extract all emails from multiple table rows
 *
 * @param rows - Array of table row objects
 * @returns Array of unique email addresses from all rows
 */
export function extractEmailsFromRows(rows: Array<Record<string, unknown>>): string[] {
  const allEmails: string[] = [];

  rows.forEach((row) => {
    const rowEmails = extractEmailsFromRow(row);
    allEmails.push(...rowEmails);
  });

  // Deduplicate and normalize
  const uniqueEmails = Array.from(new Set(allEmails.map(normalizeEmail)));
  return uniqueEmails;
}

/**
 * Normalize email address (lowercase and trim)
 *
 * @param email - Email address
 * @returns Normalized email address
 *
 * @example
 * normalizeEmail("  John@Example.COM  ")
 * // Returns: "john@example.com"
 */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Basic email validation
 *
 * @param email - Email address to validate
 * @returns True if email appears valid
 */
export function isValidEmail(email: string): boolean {
  // SSoT: Use EMAIL_REGEX from email-constants.ts
  return email.includes("@") && EMAIL_REGEX.test(email);
}

/**
 * Extract domain from email address
 *
 * @param email - Email address
 * @returns Domain part of the email
 *
 * @example
 * extractDomain("john@example.com")
 * // Returns: "example.com"
 */
export function extractDomain(email: string): string {
  const parts = email.split('@');
  return parts.length > 1 ? parts[1].toLowerCase() : '';
}

/**
 * Check if domain is a generic consumer email domain
 *
 * @param domain - Email domain
 * @returns True if domain is generic (gmail, outlook, etc.)
 */
export function isGenericDomain(domain: string): boolean {
  const genericDomains = [
    'gmail.com',
    'googlemail.com',
    'outlook.com',
    'hotmail.com',
    'live.com',
    'msn.com',
    'yahoo.com',
    'ymail.com',
    'icloud.com',
    'me.com',
    'mac.com',
    'protonmail.com',
    'proton.me',
    'aol.com',
    'mail.com',
    'zoho.com',
    'fastmail.com',
    'fastmail.fm',
    'gmx.com',
    'gmx.net',
    'yandex.com',
    'yandex.ru',
    'qq.com',
    '163.com',
  ];

  return genericDomains.includes(domain.toLowerCase());
}
