/**
 * Cell Display Functions
 *
 * Display (read-only) rendering for all 31 column types.
 * Extracted from the massive renderCellValue function.
 *
 * Each function takes a value and column definition, returns a React node.
 */

import React from "react";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Circle } from "lucide-react";
import type { TableColumn, TableRow } from "../../types";

/**
 * Format empty/null values consistently
 */
function formatEmpty(): string {
  return "";
}

/**
 * Display single line text
 */
export function displaySingleLineText(value: unknown): React.ReactNode {
  if (value === null || value === undefined || value === "") return formatEmpty();
  return String(value);
}

/**
 * Display multiple lines text
 */
export function displayMultipleLinesText(value: unknown): React.ReactNode {
  if (value === null || value === undefined || value === "") return formatEmpty();
  const text = String(value);
  // Show first 100 chars with ellipsis if longer
  return text.length > 100 ? `${text.substring(0, 100)}...` : text;
}

/**
 * Display email with mailto link
 */
export function displayEmail(value: unknown): React.ReactNode {
  if (value === null || value === undefined || value === "") return formatEmpty();
  const email = String(value);
  return (
    <a href={`mailto:${email}`} className="text-blue-600 hover:underline" onClick={(e) => e.stopPropagation()}>
      {email}
    </a>
  );
}

/**
 * Display phone number
 */
export function displayPhone(value: unknown): React.ReactNode {
  if (value === null || value === undefined || value === "") return formatEmpty();
  return String(value);
}

/**
 * Display mobile number
 */
export function displayMobile(value: unknown): React.ReactNode {
  if (value === null || value === undefined || value === "") return formatEmpty();
  return String(value);
}

/**
 * Display URL with link
 */
export function displayUrl(value: unknown): React.ReactNode {
  if (value === null || value === undefined || value === "") return formatEmpty();
  const url = String(value);
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="text-blue-600 hover:underline"
      onClick={(e) => e.stopPropagation()}
    >
      {url}
    </a>
  );
}

/**
 * Display number with formatting
 */
export function displayNumber(value: unknown): React.ReactNode {
  if (value === null || value === undefined || value === "") return formatEmpty();
  if (typeof value === "number") {
    return value.toLocaleString("en-US");
  }
  return String(value);
}

/**
 * Display whole number
 */
export function displayWholeNumber(value: unknown): React.ReactNode {
  if (value === null || value === undefined || value === "") return formatEmpty();
  if (typeof value === "number") {
    return Math.floor(value).toLocaleString("en-US");
  }
  return String(value);
}

/**
 * Display currency with $ symbol
 */
export function displayCurrency(value: unknown): React.ReactNode {
  if (value === null || value === undefined || value === "") return formatEmpty();
  if (typeof value === "number") {
    return `$${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  return String(value);
}

/**
 * Display percentage with % symbol
 */
export function displayPercentage(value: unknown): React.ReactNode {
  if (value === null || value === undefined || value === "") return formatEmpty();
  if (typeof value === "number") {
    return `${value}%`;
  }
  return String(value);
}

/**
 * Display date in DD/MM/YYYY format
 */
export function displayDate(value: unknown): React.ReactNode {
  if (value === null || value === undefined || value === "") return formatEmpty();

  try {
    const date = new Date(String(value));
    if (isNaN(date.getTime())) return String(value);
    return format(date, "dd/MM/yyyy");
  } catch {
    return String(value);
  }
}

/**
 * Display date and time
 */
export function displayDateTime(value: unknown): React.ReactNode {
  if (value === null || value === undefined || value === "") return formatEmpty();

  try {
    const date = new Date(String(value));
    if (isNaN(date.getTime())) return String(value);
    return format(date, "dd/MM/yyyy HH:mm");
  } catch {
    return String(value);
  }
}

/**
 * Display boolean as Yes/No or checkmark
 */
export function displayBoolean(value: unknown): React.ReactNode {
  if (value === null || value === undefined) return formatEmpty();

  const boolValue = value === true || value === "true";
  return (
    <span className="flex items-center gap-1">
      {boolValue ? (
        <CheckCircle2 className="h-4 w-4 text-green-600" />
      ) : (
        <Circle className="h-4 w-4 text-gray-300" />
      )}
      <span className="text-xs text-muted-foreground">{boolValue ? "Yes" : "No"}</span>
    </span>
  );
}

/**
 * Display choice as badge
 */
export function displayChoice(value: unknown): React.ReactNode {
  if (value === null || value === undefined || value === "") return formatEmpty();
  return <Badge variant="secondary">{String(value)}</Badge>;
}

/**
 * Display lookup value
 * Handles both {id, display_value} objects and simple values
 */
export function displayLookup(value: unknown): React.ReactNode {
  if (value === null || value === undefined || value === "") return formatEmpty();

  // Handle object with display_value
  if (typeof value === "object" && value !== null && "display_value" in value) {
    return String((value as { display_value: unknown }).display_value);
  }

  // Handle object with display
  if (typeof value === "object" && value !== null && "display" in value) {
    return String((value as { display: unknown }).display);
  }

  return String(value);
}

/**
 * Display multiple lookups as comma-separated badges
 */
export function displayMultipleLookups(value: unknown): React.ReactNode {
  if (value === null || value === undefined) return formatEmpty();

  if (!Array.isArray(value) || value.length === 0) return formatEmpty();

  return (
    <div className="flex flex-wrap gap-1">
      {value.map((item, idx) => {
        let displayText = "";

        if (typeof item === "object" && item !== null) {
          if ("display_value" in item) {
            displayText = String(item.display_value);
          } else if ("display" in item) {
            displayText = String(item.display);
          } else {
            displayText = JSON.stringify(item);
          }
        } else {
          displayText = String(item);
        }

        return (
          <Badge key={idx} variant="secondary" className="text-xs">
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
  return String(value);
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
        className="w-6 h-6 rounded border border-gray-300"
        style={{ backgroundColor: color }}
      />
      <span className="text-xs font-mono">{color}</span>
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
      className="text-blue-600 hover:underline text-sm"
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
    return (
      <pre className="text-xs font-mono bg-muted p-1 rounded max-w-xs overflow-x-auto">
        {jsonStr}
      </pre>
    );
  } catch {
    return String(value);
  }
}

/**
 * Display array of items as comma-separated badges
 */
export function displayArrayOfItems(value: unknown): React.ReactNode {
  if (value === null || value === undefined) return formatEmpty();

  if (!Array.isArray(value) || value.length === 0) return formatEmpty();

  return (
    <div className="flex flex-wrap gap-1">
      {value.map((item, idx) => (
        <Badge key={idx} variant="outline" className="text-xs">
          {String(item)}
        </Badge>
      ))}
    </div>
  );
}

/**
 * Display computed value (read-only)
 */
export function displayComputed(value: unknown, column: TableColumn): React.ReactNode {
  if (value === null || value === undefined || value === "") return formatEmpty();

  // Computed values might be formatted based on their type
  if (column.computed_type === "currency") {
    return displayCurrency(value);
  }

  if (column.computed_type === "number") {
    return displayNumber(value);
  }

  return String(value);
}

/**
 * Default display function for unknown types
 */
export function displayDefault(value: unknown): React.ReactNode {
  if (value === null || value === undefined || value === "") return formatEmpty();

  // Handle arrays
  if (Array.isArray(value)) {
    return value.join(", ");
  }

  // Handle objects
  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return "[Object]";
    }
  }

  return String(value);
}
