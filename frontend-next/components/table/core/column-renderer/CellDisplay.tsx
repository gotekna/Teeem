/**
 * Cell Display Functions
 *
 * Display (read-only) rendering for all column types.
 *
 * THE NEW WAY (SSoT):
 *   Use displayCell() which reads formatting rules from ColumnTypeDefinition.
 *   The backend database is the single source of truth.
 *
 * THE OLD WAY (deprecated):
 *   Individual displayXxx() functions are kept for backward compatibility
 *   but will be removed once all consumers migrate to displayCell().
 *
 * Migration:
 *   BEFORE: displayAbn(value)
 *   AFTER:  displayCell(value, column) or formatValue(value, 'abn')
 */

import React from "react";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CheckCircle2, Circle, ExternalLink, Check, ShieldCheck } from "lucide-react";
import type { TableColumn, TableRow } from "../../types";
import { formatValue } from "@/lib/formatters/display-formatters";
import { isTypeDefinitionsLoaded } from "@/lib/column-type-registry";

// Consistent link styling
const LINK_CLASSES = "text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 hover:underline text-[11px]";

/**
 * Format empty/null values consistently - returns em-dash
 */
export function formatEmpty(): React.ReactNode {
  return <span className="text-muted-foreground text-[11px]">—</span>;
}

/**
 * Display single line text
 * Also handles objects with display value (defensive for misconfigured columns)
 */
export function displaySingleLineText(value: unknown): React.ReactNode {
  if (value === null || value === undefined || value === "") return formatEmpty();

  // Handle objects with display value (backend may return {id, display} objects)
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    const obj = value as Record<string, unknown>;
    const displayValue = obj.display_value || obj.display || obj.name || obj.display_name;
    if (displayValue) {
      return <span className="text-[11px]">{String(displayValue)}</span>;
    }
    // If object has only id, show that
    if (obj.id !== undefined && Object.keys(obj).length <= 2) {
      return <span className="text-[11px]">{String(obj.id)}</span>;
    }
  }

  return <span className="text-[11px]">{String(value)}</span>;
}

/**
 * Display multiple lines text
 */
export function displayMultipleLinesText(value: unknown): React.ReactNode {
  if (value === null || value === undefined || value === "") return formatEmpty();
  const text = String(value);
  // Show first 100 chars with ellipsis if longer
  const display = text.length > 100 ? `${text.substring(0, 100)}...` : text;
  return <span className="text-[11px]">{display}</span>;
}

/**
 * Display email with mailto link
 */
export function displayEmail(value: unknown): React.ReactNode {
  if (value === null || value === undefined || value === "") return formatEmpty();
  const email = String(value);
  return (
    <a
      href={`mailto:${email}`}
      className={LINK_CLASSES}
      onClick={(e) => e.stopPropagation()}
      title={`Send email to ${email}`}
    >
      {email}
    </a>
  );
}

/**
 * Display phone number with tel: link
 */
export function displayPhone(value: unknown): React.ReactNode {
  if (value === null || value === undefined || value === "") return formatEmpty();
  const phone = String(value);
  const phoneNumber = phone.replace(/[^\d+]/g, '');
  return (
    <a
      href={`tel:${phoneNumber}`}
      className={LINK_CLASSES}
      onClick={(e) => e.stopPropagation()}
      title={`Call ${phone}`}
    >
      {phone}
    </a>
  );
}

/**
 * Display mobile number with tel: link
 */
export function displayMobile(value: unknown): React.ReactNode {
  if (value === null || value === undefined || value === "") return formatEmpty();
  const mobile = String(value);
  const phoneNumber = mobile.replace(/[^\d+]/g, '');
  return (
    <a
      href={`tel:${phoneNumber}`}
      className={LINK_CLASSES}
      onClick={(e) => e.stopPropagation()}
      title={`Call ${mobile}`}
    >
      {mobile}
    </a>
  );
}

/**
 * Display URL with external link
 */
export function displayUrl(value: unknown): React.ReactNode {
  if (value === null || value === undefined || value === "") return formatEmpty();
  const url = String(value);
  // Add https:// if no protocol specified
  const href = url.match(/^https?:\/\//) ? url : `https://${url}`;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`${LINK_CLASSES} inline-flex items-center gap-1`}
      onClick={(e) => e.stopPropagation()}
      title={`Open ${url}`}
    >
      {url}
      <ExternalLink className="h-3 w-3" />
    </a>
  );
}

/**
 * Display number with formatting
 */
export function displayNumber(value: unknown): React.ReactNode {
  if (value === null || value === undefined || value === "") return formatEmpty();
  const num = typeof value === "number" ? value : parseFloat(String(value));
  if (isNaN(num)) return <span className="text-[11px]">{String(value)}</span>;
  return <span className="text-[11px] tabular-nums">{num.toLocaleString("en-AU")}</span>;
}

/**
 * Display whole number
 * Also handles objects with {id, display} format (backend expands _id columns)
 */
export function displayWholeNumber(value: unknown): React.ReactNode {
  if (value === null || value === undefined || value === "") return formatEmpty();

  // Handle objects with display value (backend returns {id, display} for _id columns)
  if (typeof value === "object" && value !== null) {
    const obj = value as Record<string, unknown>;
    const displayValue = obj.display_value || obj.display || obj.name || obj.display_name;
    if (displayValue) {
      return <span className="text-[11px]">{String(displayValue)}</span>;
    }
    // If object has id but no display, show the id
    if (obj.id !== undefined) {
      return <span className="text-[11px] tabular-nums">{String(obj.id)}</span>;
    }
  }

  const num = typeof value === "number" ? value : parseInt(String(value), 10);
  if (isNaN(num)) return <span className="text-[11px]">{String(value)}</span>;
  return <span className="text-[11px] tabular-nums">{Math.floor(num).toLocaleString("en-AU")}</span>;
}

/**
 * Display currency with $ symbol
 */
export function displayCurrency(value: unknown): React.ReactNode {
  if (value === null || value === undefined || value === "") return formatEmpty();
  const num = typeof value === "number" ? value : parseFloat(String(value));
  if (isNaN(num)) return <span className="text-[11px]">{String(value)}</span>;
  return (
    <span className="text-[11px] tabular-nums">
      ${num.toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
    </span>
  );
}

/**
 * Display percentage with % symbol
 */
export function displayPercentage(value: unknown): React.ReactNode {
  if (value === null || value === undefined || value === "") return formatEmpty();
  const num = typeof value === "number" ? value : parseFloat(String(value));
  if (isNaN(num)) return <span className="text-[11px]">{String(value)}</span>;
  return <span className="text-[11px] tabular-nums">{num}%</span>;
}

/**
 * Display date in DD/MM/YYYY format
 */
export function displayDate(value: unknown): React.ReactNode {
  if (value === null || value === undefined || value === "") return formatEmpty();

  try {
    const date = new Date(String(value));
    if (isNaN(date.getTime())) return <span className="text-[11px]">{String(value)}</span>;
    return <span className="text-[11px]">{format(date, "dd/MM/yyyy")}</span>;
  } catch {
    return <span className="text-[11px]">{String(value)}</span>;
  }
}

/**
 * Display date and time
 */
export function displayDateTime(value: unknown): React.ReactNode {
  if (value === null || value === undefined || value === "") return formatEmpty();

  try {
    const date = new Date(String(value));
    if (isNaN(date.getTime())) return <span className="text-[11px]">{String(value)}</span>;
    return <span className="text-[11px]">{format(date, "dd/MM/yyyy HH:mm")}</span>;
  } catch {
    return <span className="text-[11px]">{String(value)}</span>;
  }
}

/**
 * Display boolean as checkmark icon
 */
export function displayBoolean(value: unknown): React.ReactNode {
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
}

/**
 * Convert snake_case or kebab-case to Title Case
 * "accounts_department" -> "Accounts Department"
 * "po-tasks-only" -> "Po Tasks Only"
 */
function toTitleCase(str: string): string {
  return str
    .replace(/[_-]/g, ' ')  // Replace underscores/hyphens with spaces
    .replace(/\b\w/g, (char) => char.toUpperCase());  // Capitalize first letter of each word
}

/**
 * Display choice as badge
 * Converts snake_case slugs to Title Case for display
 */
export function displayChoice(value: unknown): React.ReactNode {
  if (value === null || value === undefined || value === "") return formatEmpty();
  let displayText = String(value);

  // If value looks like a slug, convert to Title Case
  if (displayText.includes('_') || (displayText.includes('-') && !displayText.includes(' '))) {
    displayText = toTitleCase(displayText);
  }

  return <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{displayText}</Badge>;
}

/**
 * Display lookup value
 * Handles both {id, display_value} objects and simple values
 * Converts snake_case slugs to Title Case for display
 */
export function displayLookup(value: unknown): React.ReactNode {
  if (value === null || value === undefined || value === "") return formatEmpty();

  let displayText = "";

  // Handle object with various display properties
  if (typeof value === "object" && value !== null) {
    const obj = value as Record<string, unknown>;
    displayText = String(
      obj.display_value || obj.display || obj.name || obj.display_name || obj.id || ""
    );
    if (!displayText) {
      console.warn("[displayLookup] Object without display property:", value);
      return formatEmpty();
    }
  } else {
    displayText = String(value);
  }

  // If value looks like a slug (contains underscores/hyphens), convert to Title Case
  if (displayText.includes('_') || (displayText.includes('-') && !displayText.includes(' '))) {
    displayText = toTitleCase(displayText);
  }

  return <span className="text-[11px]">{displayText}</span>;
}

/**
 * Display multiple lookups as badges
 */
export function displayMultipleLookups(value: unknown): React.ReactNode {
  if (value === null || value === undefined) return formatEmpty();
  if (!Array.isArray(value) || value.length === 0) return formatEmpty();

  return (
    <div className="flex flex-wrap gap-1">
      {value.map((item, idx) => {
        let displayText = "";

        if (typeof item === "object" && item !== null) {
          const obj = item as Record<string, unknown>;
          displayText = String(obj.display_value || obj.display || obj.name || obj.id || "");
        } else {
          displayText = String(item);
        }

        return (
          <Badge key={idx} variant="secondary" className="text-[10px] px-1.5 py-0">
            {displayText}
          </Badge>
        );
      })}
    </div>
  );
}

/**
 * Display GPS coordinates
 */
export function displayGpsCoordinates(value: unknown): React.ReactNode {
  if (value === null || value === undefined || value === "") return formatEmpty();
  return <span className="font-mono text-[11px]">{String(value)}</span>;
}

/**
 * Display color picker with color swatch
 */
export function displayColorPicker(value: unknown): React.ReactNode {
  if (value === null || value === undefined || value === "") return formatEmpty();

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
}

/**
 * Display file upload as link
 */
export function displayFileUpload(value: unknown): React.ReactNode {
  if (value === null || value === undefined || value === "") return formatEmpty();

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
}

/**
 * Display structured data (JSON)
 */
export function displayStructuredData(value: unknown): React.ReactNode {
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
}

/**
 * Display array of items as badges
 */
export function displayArrayOfItems(value: unknown): React.ReactNode {
  if (value === null || value === undefined) return formatEmpty();
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
}

/**
 * Display searchable text (read-only search terms)
 */
export function displaySearchableText(value: unknown): React.ReactNode {
  if (value === null || value === undefined || value === "") return formatEmpty();
  const text = String(value);
  const preview = text.length > 30 ? text.slice(0, 30) + "..." : text;
  return (
    <span className="font-mono text-[10px] text-muted-foreground italic">
      🔍 {preview}
    </span>
  );
}

/**
 * Display action buttons
 */
export function displayActionButtons(value: unknown): React.ReactNode {
  if (value === null || value === undefined || value === "") return formatEmpty();

  try {
    const config = typeof value === "string" ? JSON.parse(value) : value;
    const buttons = (config as { buttons?: Array<{ label: string; action: string }> }).buttons || [];
    if (buttons.length === 0) return formatEmpty();

    return (
      <div className="flex gap-1">
        {buttons.slice(0, 3).map((btn, idx) => (
          <Button key={idx} variant="outline" size="sm" className="h-5 text-[10px] px-2">
            {btn.label}
          </Button>
        ))}
      </div>
    );
  } catch {
    return formatEmpty();
  }
}

/**
 * Display computed value (read-only)
 */
export function displayComputed(value: unknown, column: TableColumn): React.ReactNode {
  if (value === null || value === undefined || value === "") return formatEmpty();

  // Computed values might be formatted based on their type
  const computedType = (column as { computed_type?: string }).computed_type;

  if (computedType === "currency") {
    return displayCurrency(value);
  }

  if (computedType === "number") {
    return displayNumber(value);
  }

  if (computedType === "percentage") {
    return displayPercentage(value);
  }

  return <span className="text-[11px]">{String(value)}</span>;
}

// ============================================================================
// AUSTRALIAN IDENTIFIERS
// ============================================================================

/**
 * Display ABN: XX XXX XXX XXX (11 digits)
 */
export function displayAbn(value: unknown): React.ReactNode {
  if (value === null || value === undefined || value === "") return formatEmpty();
  const digits = String(value).replace(/\D/g, '');
  const formatted = digits.length === 11
    ? `${digits.slice(0,2)} ${digits.slice(2,5)} ${digits.slice(5,8)} ${digits.slice(8,11)}`
    : String(value);
  return <span className="font-mono text-[11px]">{formatted}</span>;
}

/**
 * Display ACN: XXX XXX XXX (9 digits)
 */
export function displayAcn(value: unknown): React.ReactNode {
  if (value === null || value === undefined || value === "") return formatEmpty();
  const digits = String(value).replace(/\D/g, '');
  const formatted = digits.length === 9
    ? `${digits.slice(0,3)} ${digits.slice(3,6)} ${digits.slice(6,9)}`
    : String(value);
  return <span className="font-mono text-[11px]">{formatted}</span>;
}

/**
 * Display BSB: XXX-XXX (6 digits)
 */
export function displayBsb(value: unknown): React.ReactNode {
  if (value === null || value === undefined || value === "") return formatEmpty();
  const digits = String(value).replace(/\D/g, '');
  const formatted = digits.length === 6
    ? `${digits.slice(0,3)}-${digits.slice(3,6)}`
    : String(value);
  return <span className="font-mono text-[11px]">{formatted}</span>;
}

/**
 * Display Bank Account: up to 9 digits
 */
export function displayBankAccount(value: unknown): React.ReactNode {
  if (value === null || value === undefined || value === "") return formatEmpty();
  return <span className="font-mono text-[11px]">{String(value)}</span>;
}

/**
 * Display Postcode: 4 digits
 */
export function displayPostcode(value: unknown): React.ReactNode {
  if (value === null || value === undefined || value === "") return formatEmpty();
  const formatted = String(value).padStart(4, '0').slice(0, 4);
  return <span className="font-mono text-[11px]">{formatted}</span>;
}

/**
 * Display TFN: masked for security (*** *** XXX)
 */
export function displayTfn(value: unknown): React.ReactNode {
  if (value === null || value === undefined || value === "") return formatEmpty();
  const digits = String(value).replace(/\D/g, '');
  const masked = digits.length === 9
    ? `*** *** ${digits.slice(6,9)}`
    : '*** *** ***';
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="font-mono text-muted-foreground cursor-help text-[11px]">{masked}</span>
        </TooltipTrigger>
        <TooltipContent>
          <span className="text-[11px]">TFN hidden for security</span>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// ============================================================================
// XERO INTEGRATION
// ============================================================================

/**
 * Display Xero links count with popover showing org names
 * Shows "X/Y" format where X is linked orgs, Y is total available
 * Click to see which orgs are linked
 */
export function displayXeroLinks(
  value: unknown,
  _column: TableColumn,
  row?: TableRow,
  totalTenants?: number
): React.ReactNode {
  const linkedCount = typeof value === "number" ? value : parseInt(String(value || 0), 10);
  const tenantNames: string[] = row?.xero_tenant_names as string[] || [];
  const linkSummary = row?.xero_link_summary as {
    linked_count?: number;
    total_tenants?: number;
    tenant_names?: string[];
    has_sync_errors?: boolean;
    has_conflicts?: boolean;
  } | undefined;
  // SSoT: Get total from xero_link_summary (backend provides actual XeroCredential.count)
  // If not available (cached data), don't show denominator
  const total = linkSummary?.total_tenants || totalTenants || null;
  const displayCount = total ? `${linkedCount}/${total}` : `${linkedCount}`;

  // If no links, show empty state
  if (linkedCount === 0) {
    return (
      <span className="text-muted-foreground text-[11px]">
        {total ? `0/${total}` : "—"}
      </span>
    );
  }

  // Determine badge color based on sync status
  const hasErrors = linkSummary?.has_sync_errors || linkSummary?.has_conflicts;
  const badgeColor = hasErrors
    ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300"
    : "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300";

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Badge
          variant="outline"
          className={`${badgeColor} gap-1 cursor-pointer hover:bg-opacity-80 text-[10px] px-1.5 py-0`}
        >
          <ShieldCheck className="h-3 w-3" />
          {displayCount}
        </Badge>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-2" align="start">
        <div className="text-xs font-medium text-muted-foreground mb-2">
          Linked to {linkedCount} Xero org{linkedCount !== 1 ? "s" : ""}
        </div>
        <div className="space-y-1">
          {tenantNames.length > 0 ? (
            tenantNames.map((name, idx) => (
              <div
                key={idx}
                className="flex items-center gap-2 py-1 px-2 rounded bg-green-50 dark:bg-green-900/20"
              >
                <Check className="h-3 w-3 text-green-600 flex-shrink-0" />
                <span className="text-[11px] text-green-700 dark:text-green-300 truncate">
                  {name}
                </span>
              </div>
            ))
          ) : (
            <div className="text-[11px] text-muted-foreground py-1">
              Linked to {linkedCount} organization{linkedCount !== 1 ? "s" : ""}
            </div>
          )}
        </div>
        {hasErrors && (
          <div className="mt-2 pt-2 border-t text-[10px] text-yellow-600 dark:text-yellow-400">
            ⚠️ Has sync errors or conflicts
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

/**
 * Default display function for unknown types
 */
export function displayDefault(value: unknown): React.ReactNode {
  if (value === null || value === undefined || value === "") return formatEmpty();

  // Handle arrays
  if (Array.isArray(value)) {
    if (value.length === 0) return formatEmpty();
    return <span className="text-[11px]">{value.join(", ")}</span>;
  }

  // Handle objects - try to extract display value
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const displayValue = obj.display_value || obj.display || obj.name || obj.display_name;
    if (displayValue) {
      return <span className="text-[11px]">{String(displayValue)}</span>;
    }
    try {
      return <span className="text-[11px]">{JSON.stringify(value)}</span>;
    } catch {
      return <span className="text-[11px]">[Object]</span>;
    }
  }

  return <span className="text-[11px]">{String(value)}</span>;
}

// ============================================================================
// NEW SSoT-BASED DISPLAY FUNCTION
// This is THE ONE function that should be used going forward.
// It reads formatting rules from ColumnTypeDefinition (the database SSoT).
// ============================================================================

/**
 * Display a cell value using the SSoT type registry
 *
 * This is the main entry point for rendering cell values.
 * It uses the ColumnTypeDefinition from the backend to determine formatting.
 *
 * If type definitions aren't loaded yet, falls back to legacy functions.
 *
 * @param value - The raw cell value
 * @param column - The column definition
 * @param row - Optional row for special types (xero_links)
 * @returns Rendered React node
 */
export function displayCell(
  value: unknown,
  column: TableColumn,
  row?: TableRow
): React.ReactNode {
  const columnType = column.column_type || "single_line_text";

  // Special case: xero_links needs row data
  if (columnType === "xero_links") {
    return displayXeroLinks(value, column, row);
  }

  // If type definitions are loaded, use the new SSoT-based formatters
  if (isTypeDefinitionsLoaded()) {
    return formatValue(value, columnType);
  }

  // Fallback to legacy functions if type definitions not loaded
  return displayCellLegacy(value, column, row);
}

/**
 * Legacy display function - uses hardcoded switch statement
 * This is kept as a fallback in case the SSoT registry fails to load.
 * The registry loads on auth in AuthContext, so this should rarely be used.
 * @deprecated Fallback only - SSoT formatters handle all rendering when registry is loaded
 */
function displayCellLegacy(
  value: unknown,
  column: TableColumn,
  row?: TableRow
): React.ReactNode {
  const columnType = column.column_type;

  switch (columnType) {
    case "single_line_text":
      return displaySingleLineText(value);
    case "multiple_lines_text":
      return displayMultipleLinesText(value);
    case "email":
      return displayEmail(value);
    case "phone":
      return displayPhone(value);
    case "mobile":
      return displayMobile(value);
    case "url":
      return displayUrl(value);
    case "number":
      return displayNumber(value);
    case "whole_number":
      return displayWholeNumber(value);
    case "currency":
      return displayCurrency(value);
    case "percentage":
      return displayPercentage(value);
    case "date":
      return displayDate(value);
    case "date_and_time":
      return displayDateTime(value);
    case "boolean":
      return displayBoolean(value);
    case "choice":
      return displayChoice(value);
    case "lookup":
    case "relation":
    case "user":
      return displayLookup(value);
    case "multiple_lookups":
      return displayMultipleLookups(value);
    case "gps_coordinates":
      return displayGpsCoordinates(value);
    case "color_picker":
      return displayColorPicker(value);
    case "file_upload":
      return displayFileUpload(value);
    case "structured_data":
      return displayStructuredData(value);
    case "array_of_items":
      return displayArrayOfItems(value);
    case "searchable_text":
      return displaySearchableText(value);
    case "action_buttons":
      return displayActionButtons(value);
    case "computed":
      return displayComputed(value, column);
    case "abn":
      return displayAbn(value);
    case "acn":
      return displayAcn(value);
    case "bsb":
      return displayBsb(value);
    case "bank_account":
      return displayBankAccount(value);
    case "postcode":
      return displayPostcode(value);
    case "tfn":
      return displayTfn(value);
    case "xero_links":
      return displayXeroLinks(value, column, row);
    default:
      return displayDefault(value);
  }
}
