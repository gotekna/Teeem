/**
 * Display Formatters - Generic formatters that read configuration from ColumnTypeDefinition
 *
 * This is NOT the SSoT - it consumes the SSoT (ColumnTypeDefinition from backend).
 * These are generic formatters that can handle any column type based on its configuration.
 *
 * The display_formatter field in ColumnTypeDefinition determines which formatter is used.
 * Other fields (display_format, link_template, locale) provide the configuration.
 *
 * Usage:
 *   import { formatValue } from '@/lib/formatters/display-formatters';
 *   const rendered = formatValue(value, 'abn');  // Uses type definition config
 */

import React from "react";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { CheckCircle2, Circle, ExternalLink } from "lucide-react";
import { getTypeDefinition, type ColumnTypeDefinition } from "../column-type-registry";

// Consistent link styling
const LINK_CLASSES = "text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 hover:underline text-[11px]";

/**
 * Format empty/null values consistently - returns em-dash
 */
export function formatEmpty(): React.ReactNode {
  return <span className="text-muted-foreground text-[11px]">-</span>;
}

/**
 * Check if value is empty
 */
function isEmpty(value: unknown): boolean {
  return value === null || value === undefined || value === "";
}

/**
 * Extract display text from various value formats
 */
function extractDisplayText(value: unknown): string {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    const obj = value as Record<string, unknown>;
    const displayValue = obj.display_value || obj.display || obj.name || obj.display_name;
    if (displayValue) return String(displayValue);
    if (obj.id !== undefined) return String(obj.id);
  }
  return String(value);
}

/**
 * Convert snake_case or kebab-case to Title Case
 */
function toTitleCase(str: string): string {
  return str
    .replace(/[_-]/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

// ============================================================================
// GENERIC FORMATTERS
// Each reads configuration from the type definition
// ============================================================================

type FormatterConfig = Partial<ColumnTypeDefinition>;
type FormatterFn = (value: unknown, config: FormatterConfig) => React.ReactNode;

const FORMATTERS: Record<string, FormatterFn> = {
  /**
   * Text formatter - basic text display with optional link template
   * Used by: single_line_text, multiple_lines_text, email, phone, mobile, url
   */
  text: (value, config) => {
    if (isEmpty(value)) return formatEmpty();
    const text = extractDisplayText(value);

    // If link_template exists, render as link
    if (config.link_template) {
      const href = config.link_template.replace("{value}", encodeURIComponent(text));
      const isExternal = !href.startsWith("mailto:") && !href.startsWith("tel:");

      return (
        <a
          href={href}
          className={`${LINK_CLASSES} ${isExternal ? "inline-flex items-center gap-1" : ""}`}
          onClick={(e) => e.stopPropagation()}
          target={isExternal ? "_blank" : undefined}
          rel={isExternal ? "noopener noreferrer" : undefined}
          title={text}
        >
          {text}
          {isExternal && <ExternalLink className="h-3 w-3" />}
        </a>
      );
    }

    return <span className="text-[11px]">{text}</span>;
  },

  /**
   * Multiline text - shows preview with truncation
   */
  multiline: (value, _config) => {
    if (isEmpty(value)) return formatEmpty();
    const text = String(value);
    const display = text.length > 100 ? `${text.substring(0, 100)}...` : text;
    return <span className="text-[11px]">{display}</span>;
  },

  /**
   * Number formatter - localized number display
   * Used by: number, whole_number
   */
  number: (value, config) => {
    if (isEmpty(value)) return formatEmpty();

    // Handle objects with display value
    if (typeof value === "object" && value !== null) {
      const obj = value as Record<string, unknown>;
      const displayValue = obj.display_value || obj.display || obj.name;
      if (displayValue) return <span className="text-[11px]">{String(displayValue)}</span>;
      if (obj.id !== undefined) {
        return <span className="text-[11px] tabular-nums">{String(obj.id)}</span>;
      }
    }

    const num = typeof value === "number" ? value : parseFloat(String(value));
    if (isNaN(num)) return <span className="text-[11px]">{String(value)}</span>;

    const locale = config.locale || "en-AU";
    const isWholeNumber = config.type_key === "whole_number";

    const formatted = isWholeNumber
      ? Math.floor(num).toLocaleString(locale)
      : num.toLocaleString(locale);

    return <span className="text-[11px] tabular-nums">{formatted}</span>;
  },

  /**
   * Currency formatter - with currency symbol
   * Used by: currency
   */
  currency: (value, config) => {
    if (isEmpty(value)) return formatEmpty();

    const num = typeof value === "number" ? value : parseFloat(String(value));
    if (isNaN(num)) return <span className="text-[11px]">{String(value)}</span>;

    const locale = config.locale || "en-AU";
    const formatted = num.toLocaleString(locale, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

    return <span className="text-[11px] tabular-nums">${formatted}</span>;
  },

  /**
   * Percentage formatter - with % symbol
   */
  percentage: (value, _config) => {
    if (isEmpty(value)) return formatEmpty();

    const num = typeof value === "number" ? value : parseFloat(String(value));
    if (isNaN(num)) return <span className="text-[11px]">{String(value)}</span>;

    return <span className="text-[11px] tabular-nums">{num}%</span>;
  },

  /**
   * Date formatter - configurable date format
   * Used by: date, datetime
   */
  date: (value, config) => {
    if (isEmpty(value)) return formatEmpty();

    try {
      const date = new Date(String(value));
      if (isNaN(date.getTime())) return <span className="text-[11px]">{String(value)}</span>;

      // Default format based on type
      let dateFormat = "dd/MM/yyyy";
      if (config.type_key === "datetime") {
        dateFormat = "dd/MM/yyyy HH:mm";
      }
      // Override with display_format if provided
      if (config.display_format) {
        dateFormat = config.display_format;
      }

      return <span className="text-[11px]">{format(date, dateFormat)}</span>;
    } catch {
      return <span className="text-[11px]">{String(value)}</span>;
    }
  },

  /**
   * Boolean formatter - checkmark icon
   */
  boolean: (value, _config) => {
    if (value === null || value === undefined) return formatEmpty();

    const boolValue = value === true || value === "true" || value === 1;
    return (
      <span className="flex items-center gap-1">
        {boolValue ? (
          <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
        ) : (
          <Circle className="h-3.5 w-3.5 text-gray-300 dark:text-gray-600" />
        )}
        <span className="text-[11px] text-muted-foreground">{boolValue ? "Yes" : "No"}</span>
      </span>
    );
  },

  /**
   * Choice formatter - badge display
   */
  choice: (value, _config) => {
    if (isEmpty(value)) return formatEmpty();

    let displayText = String(value);
    if (displayText.includes("_") || (displayText.includes("-") && !displayText.includes(" "))) {
      displayText = toTitleCase(displayText);
    }

    return (
      <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
        {displayText}
      </Badge>
    );
  },

  /**
   * Lookup formatter - extracts display value from objects
   */
  lookup: (value, _config) => {
    if (isEmpty(value)) return formatEmpty();

    let displayText = extractDisplayText(value);

    // Convert slugs to title case
    if (displayText.includes("_") || (displayText.includes("-") && !displayText.includes(" "))) {
      displayText = toTitleCase(displayText);
    }

    return <span className="text-[11px]">{displayText}</span>;
  },

  /**
   * Multiple lookups formatter - array as badges
   */
  multiple_lookups: (value, _config) => {
    if (!Array.isArray(value) || value.length === 0) return formatEmpty();

    return (
      <div className="flex flex-wrap gap-1">
        {value.map((item, idx) => {
          const displayText = extractDisplayText(item);
          return (
            <Badge key={idx} variant="secondary" className="text-[10px] px-1.5 py-0">
              {displayText}
            </Badge>
          );
        })}
      </div>
    );
  },

  /**
   * Australian spaced format - XX XXX XXX XXX (ABN, ACN, TFN)
   * Reads pattern from display_format field
   */
  australian_spaced: (value, config) => {
    if (isEmpty(value)) return formatEmpty();

    const digits = String(value).replace(/\D/g, "");
    const pattern = config.display_format || "XX XXX XXX XXX";

    // Parse pattern to determine spacing
    const parts = pattern.split(" ");
    let formatted = "";
    let pos = 0;

    for (let i = 0; i < parts.length; i++) {
      const partLen = parts[i].length;
      if (pos + partLen <= digits.length) {
        formatted += (i > 0 ? " " : "") + digits.slice(pos, pos + partLen);
        pos += partLen;
      } else if (pos < digits.length) {
        formatted += (i > 0 ? " " : "") + digits.slice(pos);
        break;
      }
    }

    // If we couldn't format (wrong length), just return original
    const result = formatted || String(value);

    return <span className="font-mono text-[11px]">{result}</span>;
  },

  /**
   * Australian dashed format - XXX-XXX (BSB)
   */
  australian_dashed: (value, config) => {
    if (isEmpty(value)) return formatEmpty();

    const digits = String(value).replace(/\D/g, "");
    const pattern = config.display_format || "XXX-XXX";

    // Parse pattern for dashed format
    const parts = pattern.split("-");
    let formatted = "";
    let pos = 0;

    for (let i = 0; i < parts.length; i++) {
      const partLen = parts[i].length;
      if (pos + partLen <= digits.length) {
        formatted += (i > 0 ? "-" : "") + digits.slice(pos, pos + partLen);
        pos += partLen;
      }
    }

    const result = formatted || String(value);
    return <span className="font-mono text-[11px]">{result}</span>;
  },

  /**
   * Postcode formatter - zero-padded 4 digits
   */
  postcode: (value, _config) => {
    if (isEmpty(value)) return formatEmpty();

    const formatted = String(value).padStart(4, "0").slice(0, 4);
    return <span className="font-mono text-[11px]">{formatted}</span>;
  },

  /**
   * Masked formatter - shows partial value with masking (TFN)
   */
  masked: (value, config) => {
    if (isEmpty(value)) return formatEmpty();

    const text = String(value).replace(/\D/g, "");

    // Default: show last 3 digits
    const visibleDigits = 3;
    const masked =
      text.length >= visibleDigits
        ? "*** *** " + text.slice(-visibleDigits)
        : "*** *** ***";

    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="font-mono text-muted-foreground cursor-help text-[11px]">
              {masked}
            </span>
          </TooltipTrigger>
          <TooltipContent>
            <span className="text-[11px]">
              {config.display_name || "Value"} hidden for security
            </span>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  },

  /**
   * Color formatter - color swatch with hex code
   */
  color: (value, _config) => {
    if (isEmpty(value)) return formatEmpty();

    const color = String(value);
    return (
      <div className="flex items-center gap-2">
        <div
          className="w-4 h-4 rounded border border-gray-300 dark:border-gray-600"
          style={{ backgroundColor: color }}
        />
        <span className="text-[11px] font-mono">{color}</span>
      </div>
    );
  },

  /**
   * JSON formatter - preview with tooltip
   */
  json: (value, _config) => {
    if (value === null || value === undefined) return formatEmpty();

    try {
      const jsonStr = typeof value === "string" ? value : JSON.stringify(value, null, 2);
      const preview = jsonStr.length > 50 ? jsonStr.substring(0, 50) + "..." : jsonStr;

      return (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <pre className="text-[10px] font-mono bg-muted px-1 py-0.5 rounded max-w-[150px] overflow-hidden truncate cursor-help">
                {preview}
              </pre>
            </TooltipTrigger>
            <TooltipContent className="max-w-md">
              <pre className="text-[11px] font-mono whitespace-pre-wrap">{jsonStr}</pre>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    } catch {
      return <span className="text-[11px]">{String(value)}</span>;
    }
  },

  /**
   * Array formatter - items as badges
   */
  array: (value, _config) => {
    if (!Array.isArray(value) || value.length === 0) return formatEmpty();

    return (
      <div className="flex flex-wrap gap-1">
        {value.map((item, idx) => (
          <Badge key={idx} variant="outline" className="text-[10px] px-1.5 py-0">
            {String(item)}
          </Badge>
        ))}
      </div>
    );
  },

  /**
   * File formatter - filename as link
   */
  file: (value, _config) => {
    if (isEmpty(value)) return formatEmpty();

    const filePath = String(value);
    const fileName = filePath.split("/").pop() || filePath;

    return (
      <a
        href={filePath}
        target="_blank"
        rel="noopener noreferrer"
        className={LINK_CLASSES}
        onClick={(e) => e.stopPropagation()}
      >
        {fileName}
      </a>
    );
  },

  /**
   * GPS formatter - coordinates display
   */
  gps: (value, _config) => {
    if (isEmpty(value)) return formatEmpty();
    return <span className="font-mono text-[11px]">{String(value)}</span>;
  },
};

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Format a value using the type definition from the registry
 * This is the main entry point for displaying cell values
 *
 * @param value - The raw value to format
 * @param typeKey - The column type key (e.g., 'abn', 'currency', 'email')
 * @returns React node with formatted display
 */
export function formatValue(value: unknown, typeKey: string): React.ReactNode {
  const typeDef = getTypeDefinition(typeKey);

  // Get formatter key, fallback to 'text'
  const formatterKey = typeDef?.display_formatter || "text";
  const formatter = FORMATTERS[formatterKey] || FORMATTERS.text;

  // Pass full type definition as config
  return formatter(value, typeDef || {});
}

/**
 * Get a formatter function by key
 * Useful for cases where you need the raw formatter without type definition
 */
export function getFormatter(formatterKey: string): FormatterFn {
  return FORMATTERS[formatterKey] || FORMATTERS.text;
}

/**
 * List all available formatter keys
 */
export function getFormatterKeys(): string[] {
  return Object.keys(FORMATTERS);
}

/**
 * Format with explicit config (bypass registry)
 * Useful for previewing or testing formatters
 */
export function formatWithConfig(
  value: unknown,
  formatterKey: string,
  config: FormatterConfig
): React.ReactNode {
  const formatter = FORMATTERS[formatterKey] || FORMATTERS.text;
  return formatter(value, config);
}

// Re-export formatEmpty for backward compatibility
export { formatEmpty as displayEmpty };

// ============================================================================
// CONTACT DISPLAY UTILITIES
// ============================================================================

/**
 * Contact object interface for display formatting
 */
export interface ContactForDisplay {
  id: number;
  display_name?: string;
  company_name?: string;
  company_name_or_trust?: string;
  first_name?: string;
  last_name?: string;
  employer_name?: string; // Company name for person contacts (from backend)
}

/**
 * SSoT: Format contact label for display in dropdowns/lists
 *
 * Company-aware display shows "Troy Smith - Harvey Norman" format
 * when showCompanyName is true and contact has an employer.
 *
 * @param contact - The contact object
 * @param showCompanyName - Whether to show employer name (default: true)
 * @returns Formatted label string
 *
 * @example
 * formatContactLabel({ display_name: "Troy Smith", employer_name: "Harvey Norman" })
 * // Returns: "Troy Smith - Harvey Norman"
 *
 * formatContactLabel({ display_name: "Troy Smith", employer_name: "Harvey Norman" }, false)
 * // Returns: "Troy Smith"
 */
export function formatContactLabel(
  contact: ContactForDisplay,
  showCompanyName: boolean = true
): string {
  const name =
    contact.display_name ||
    contact.company_name ||
    contact.company_name_or_trust ||
    (contact.first_name && contact.last_name
      ? `${contact.first_name} ${contact.last_name}`.trim()
      : contact.first_name || contact.last_name) ||
    `Contact ${contact.id}`;

  if (showCompanyName && contact.employer_name) {
    return `${name} - ${contact.employer_name}`;
  }
  return name;
}
