import {
  FileText,
  Hash,
  Mail,
  Phone,
  Smartphone,
  Calendar,
  Clock,
  CheckCircle,
  DollarSign,
  Link,
  AlignLeft,
  User,
  Calculator,
  Layers,
  ArrowRightLeft,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { api } from "./api";

/**
 * ============================================================================
 * CACHE/FALLBACK ONLY - DO NOT EDIT AS SOURCE OF TRUTH
 * ============================================================================
 *
 * SINGLE SOURCE OF TRUTH: Trinity T19.001-T19.021 (see Bible Rule #19.37)
 *
 * The Hierarchy:
 *   Trinity T19.001-T19.021 (SSoT - RULES)
 *       │
 *       ├──► columns table (Table ID 1) - IMPLEMENTATION
 *       ├──► gold_standard_table - PROOF (sample data)
 *       └──► THIS FILE - CACHE/FALLBACK ONLY
 * ============================================================================
 */

export interface ColumnType {
  value: string;
  label: string;
  icon: LucideIcon;
  category: string;
  description: string;
  sqlType: string;
  validationRules: string;
  example: string;
  usedFor: string;
  needsConfig?: boolean;
}

export const COLUMN_TYPES: ColumnType[] = [
  // Text Fields
  {
    value: "single_line_text",
    label: "Single line text",
    icon: FileText,
    category: "Text",
    description: "Short text (up to 255 characters)",
    sqlType: "VARCHAR(255)",
    validationRules: "Optional text field, max 255 characters, alphanumeric",
    example: "CONC-001, STL-042A",
    usedFor: "Unique identifier code for inventory",
  },
  {
    value: "multiple_lines_text",
    label: "Long text",
    icon: AlignLeft,
    category: "Text",
    description: "Multi-line text field",
    sqlType: "TEXT",
    validationRules: "Optional text field, supports line breaks",
    example: "Additional notes\nSecond line\nThird line",
    usedFor: "Notes, comments, multi-line descriptions",
  },
  {
    value: "email",
    label: "Email",
    icon: Mail,
    category: "Text",
    description: "Email address",
    sqlType: "VARCHAR(255)",
    validationRules: "Must contain @ symbol, valid email format",
    example: "supplier@example.com, contact@business.com.au",
    usedFor: "Email addresses for contacts",
  },
  {
    value: "phone",
    label: "Phone number",
    icon: Phone,
    category: "Text",
    description: "Phone number",
    sqlType: "VARCHAR(20)",
    validationRules: "Format: (03) 9123 4567 or 1300 numbers",
    example: "(03) 9123 4567, 1300 123 456",
    usedFor: "Landline phone numbers",
  },
  {
    value: "mobile",
    label: "Mobile",
    icon: Smartphone,
    category: "Text",
    description: "Mobile phone number",
    sqlType: "VARCHAR(20)",
    validationRules: "Format: 0407 397 541, starts with 04",
    example: "0407 397 541, 0412 345 678",
    usedFor: "Mobile phone numbers",
  },
  {
    value: "url",
    label: "URL",
    icon: Link,
    category: "Text",
    description: "Website URL",
    sqlType: "VARCHAR(500)",
    validationRules: "Valid URL format, clickable in table",
    example: "https://example.com/doc.pdf",
    usedFor: "Links to external documents or files",
  },

  // Number Fields
  {
    value: "number",
    label: "Number",
    icon: Hash,
    category: "Numbers",
    description: "Integer number",
    sqlType: "INTEGER",
    validationRules: "Integers (positive or negative), shows sum in footer",
    example: "10, 250, 15, -5",
    usedFor: "Quantity of items, counts, or any integer value",
  },
  {
    value: "whole_number",
    label: "Whole number",
    icon: Hash,
    category: "Numbers",
    description: "Integer number",
    sqlType: "INTEGER",
    validationRules: "Integers only (no decimals), shows sum",
    example: "5, 100, 42",
    usedFor: "Counts, units, days - no fractional values",
  },
  {
    value: "currency",
    label: "Currency",
    icon: DollarSign,
    category: "Numbers",
    description: "Money amount",
    sqlType: "NUMERIC(10,2)",
    validationRules: "Positive numbers, 2 decimal places, shows sum in footer",
    example: "$125.50, $1,234.99",
    usedFor: "Price in Australian dollars",
  },
  {
    value: "percentage",
    label: "Percent",
    icon: Hash,
    category: "Numbers",
    description: "Percentage value",
    sqlType: "NUMERIC(5,2)",
    validationRules: "0-100, input as number, displayed with % symbol",
    example: "Input: 11 → Display: 11%, Input: 25.5 → Display: 25.5%",
    usedFor: "Discount percentage for pricing",
  },

  // Date & Time
  {
    value: "date",
    label: "Date",
    icon: Calendar,
    category: "Date & Time",
    description: "Date only",
    sqlType: "DATE",
    validationRules: "Stored as YYYY-MM-DD, displayed as DD-MM-YYYY",
    example: "Display: 19-11-2025, Stored: 2025-11-19",
    usedFor: "Date values without time",
  },
  {
    value: "date_and_time",
    label: "Date & Time",
    icon: Clock,
    category: "Date & Time",
    description: "Date and time",
    sqlType: "TIMESTAMP",
    validationRules: "Stored as YYYY-MM-DD HH:MM:SS, displayed as DD-MM-YYYY HH:MM",
    example: "Display: 19-11-2025 14:30, Stored: 2025-11-19 14:30:00",
    usedFor: "Timestamps, event times, scheduled dates with time",
  },

  // Special Types
  {
    value: "gps_coordinates",
    label: "GPS Coordinates",
    icon: Link,
    category: "Special",
    description: "Latitude and Longitude",
    sqlType: "VARCHAR(100)",
    validationRules: "Latitude, Longitude format",
    example: "-33.8688, 151.2093 (Sydney)",
    usedFor: "GPS coordinates for job sites",
  },
  {
    value: "color_picker",
    label: "Color Picker",
    icon: Link,
    category: "Special",
    description: "Hex color code",
    sqlType: "VARCHAR(7)",
    validationRules: "Hex color format (#RRGGBB)",
    example: "#FF5733, #3498DB, #000000",
    usedFor: "Visual categorization, status indicators",
  },
  {
    value: "file_upload",
    label: "File Upload",
    icon: Link,
    category: "Special",
    description: "File attachment reference",
    sqlType: "TEXT",
    validationRules: "File path or URL to uploaded file",
    example: "/uploads/doc.pdf, https://example.com/file.png",
    usedFor: "File references, document links",
  },
  {
    value: "action_buttons",
    label: "Action Buttons",
    icon: Wrench,
    category: "Special",
    description: "Interactive buttons for row-level actions",
    sqlType: "VARCHAR(255)",
    validationRules: "Optional field, stores action configuration as JSON",
    example: '{"buttons": [{"label": "View", "action": "view"}]}',
    usedFor: "Row-level actions like View, Edit, Download",
  },

  // Selection & Boolean
  {
    value: "boolean",
    label: "Checkbox",
    icon: CheckCircle,
    category: "Selection",
    description: "True/false value",
    sqlType: "BOOLEAN",
    validationRules: "True or False only",
    example: "true, false",
    usedFor: "Active/inactive status flag",
  },
  {
    value: "choice",
    label: "Single select",
    icon: Layers,
    category: "Selection",
    description: "Select one option from a list",
    sqlType: "VARCHAR(50)",
    validationRules: "Must be one of predefined options",
    example: "active, pending, completed, cancelled",
    usedFor: "Status fields, workflow states",
  },

  // Relationships
  {
    value: "lookup",
    label: "Link to another record",
    icon: ArrowRightLeft,
    category: "Relationships",
    needsConfig: true,
    description: "Link to records in another table",
    sqlType: "VARCHAR(255)",
    validationRules: "Must reference a valid value from the linked table",
    example: "Product #123, Category: Materials",
    usedFor: "Foreign key relationships",
  },
  {
    value: "multiple_lookups",
    label: "Link to multiple records",
    icon: ArrowRightLeft,
    category: "Relationships",
    needsConfig: true,
    description: "Link to multiple records",
    sqlType: "TEXT",
    validationRules: "Array of IDs stored as JSON",
    example: "[1, 5, 12]",
    usedFor: "Multiple relationships to other records",
  },
  {
    value: "user",
    label: "User",
    icon: User,
    category: "Relationships",
    description: "Link to a user",
    sqlType: "INTEGER",
    validationRules: "Must reference valid user ID",
    example: "User #7, User #1",
    usedFor: "Assignment to users, ownership tracking",
  },

  // Computed
  {
    value: "computed",
    label: "Formula",
    icon: Calculator,
    category: "Computed",
    description: "Calculated value based on other fields",
    sqlType: "VIRTUAL/COMPUTED",
    validationRules: "Read-only, calculated from formula",
    example: "$1,255.00 (price × quantity)",
    usedFor: "Automatic calculations, aggregations",
  },
];

/**
 * Get the display label for a column type value
 */
export const getColumnTypeLabel = (value: string): string => {
  const type = COLUMN_TYPES.find((t) => t.value === value);
  return type?.label || value;
};

/**
 * Get the SQL type for a column type value
 */
export const getColumnTypeSqlType = (value: string): string => {
  const type = COLUMN_TYPES.find((t) => t.value === value);
  return type?.sqlType || "VARCHAR(255)";
};

/**
 * Get the icon component for a column type value
 */
export const getColumnTypeIcon = (value: string): LucideIcon => {
  const type = COLUMN_TYPES.find((t) => t.value === value);
  return type?.icon || FileText;
};

/**
 * Get emoji icon for a column type
 */
export const getColumnTypeEmoji = (columnType: string): string => {
  const iconMap: Record<string, string> = {
    single_line_text: "📝",
    multiple_lines_text: "📄",
    email: "📧",
    phone: "📞",
    mobile: "📱",
    url: "🔗",
    number: "#️⃣",
    whole_number: "🔢",
    currency: "💵",
    percentage: "%",
    date: "📅",
    date_and_time: "🕐",
    gps_coordinates: "📍",
    color_picker: "🎨",
    file_upload: "📎",
    action_buttons: "⚡",
    boolean: "☑️",
    choice: "📋",
    lookup: "🔗",
    multiple_lookups: "🔗",
    user: "👤",
    computed: "🧮",
    id: "🔑",
  };
  return iconMap[columnType] || "📝";
};

// ============================================================================
// API INTEGRATION
// ============================================================================

const CACHE_KEY = "teeem_column_types_cache";
const CACHE_TIMESTAMP_KEY = "teeem_column_types_timestamp";
const CACHE_TTL = 3600000; // 1 hour in milliseconds

interface ColumnTypesResponse {
  success: boolean;
  data: ColumnType[];
}

/**
 * Fetch column types from the API
 */
export const fetchColumnTypesFromAPI = async (): Promise<ColumnType[]> => {
  const data = await api.get<ColumnTypesResponse>("/api/v1/column_types");
  if (data.success && data.data) {
    return data.data;
  }
  throw new Error("Invalid API response format");
};

/**
 * Get column types with caching
 */
export const getColumnTypesWithCache = async (
  forceRefresh = false
): Promise<ColumnType[]> => {
  if (typeof window === "undefined") {
    return COLUMN_TYPES;
  }

  // Check cache first
  if (!forceRefresh) {
    try {
      const cachedData = localStorage.getItem(CACHE_KEY);
      const cachedTimestamp = localStorage.getItem(CACHE_TIMESTAMP_KEY);

      if (cachedData && cachedTimestamp) {
        const age = Date.now() - parseInt(cachedTimestamp);
        if (age < CACHE_TTL) {
          return JSON.parse(cachedData);
        }
      }
    } catch {
      // Ignore cache errors
    }
  }

  // Fetch from API
  try {
    const columnTypes = await fetchColumnTypesFromAPI();

    // Cache the result
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(columnTypes));
      localStorage.setItem(CACHE_TIMESTAMP_KEY, Date.now().toString());
    } catch {
      // Ignore cache errors
    }

    return columnTypes;
  } catch {
    // Return fallback data
    return COLUMN_TYPES;
  }
};

/**
 * Clear the column types cache
 */
export const clearColumnTypesCache = (): void => {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(CACHE_KEY);
    localStorage.removeItem(CACHE_TIMESTAMP_KEY);
  } catch {
    // Ignore errors
  }
};
