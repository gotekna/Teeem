import {
  DocumentTextIcon,
  HashtagIcon,
  EnvelopeIcon,
  PhoneIcon,
  CalendarIcon,
  ClockIcon,
  CheckCircleIcon,
  CurrencyDollarIcon,
  LinkIcon,
  Bars3BottomLeftIcon,
  UserIcon,
  CalculatorIcon,
  RectangleStackIcon,
  ArrowsRightLeftIcon,
  WrenchScrewdriverIcon,
} from '@heroicons/react/24/outline'
import api from '../api'

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
 *       ├──► gold_standard_items - PROOF (sample data)
 *       └──► THIS FILE - CACHE/FALLBACK ONLY
 *
 * Maintenance Process:
 *   1. Edit Trinity T19.xxx first (via Documentation page UI)
 *   2. Update columns table to match
 *   3. Run gold-standard-sst agent to verify sync
 *   4. This file auto-syncs via API fetch
 *
 * API Access:
 *   - GET /api/v1/column_types (reads from Gold Standard table)
 *   - GET /api/v1/trinity?category=teacher&chapter_number=19 (reads Trinity)
 *
 * NEVER edit this file as the source - it's for offline/fallback only.
 * Always use getColumnTypesWithCache() which fetches from API first.
 *
 * See: SINGLE_SOURCE_OF_TRUTH.md for full documentation.
 * ============================================================================
 */
export const COLUMN_TYPES = [
  // Text Fields
  {
    value: 'single_line_text',
    label: 'Single line text',
    icon: DocumentTextIcon,
    category: 'Text',
    description: 'Short text (up to 255 characters)',
    sqlType: 'VARCHAR(255)',
    validationRules: 'Optional text field, max 255 characters, alphanumeric',
    example: 'CONC-001, STL-042A',
    usedFor: 'Unique identifier code for inventory'
  },
  {
    value: 'multiple_lines_text',
    label: 'Long text',
    icon: Bars3BottomLeftIcon,
    category: 'Text',
    description: 'Multi-line text field',
    sqlType: 'TEXT',
    validationRules: 'Optional text field, supports line breaks',
    example: 'Additional notes\nSecond line\nThird line',
    usedFor: 'Notes, comments, multi-line descriptions'
  },
  {
    value: 'email',
    label: 'Email',
    icon: EnvelopeIcon,
    category: 'Text',
    description: 'Email address',
    sqlType: 'VARCHAR(255)',
    validationRules: 'Must contain @ symbol, valid email format',
    example: 'supplier@example.com, contact@business.com.au',
    usedFor: 'Email addresses for contacts'
  },
  {
    value: 'phone',
    label: 'Phone number',
    icon: PhoneIcon,
    category: 'Text',
    description: 'Phone number',
    sqlType: 'VARCHAR(20)',
    validationRules: 'Format: (03) 9123 4567 or 1300 numbers',
    example: '(03) 9123 4567, 1300 123 456',
    usedFor: 'Landline phone numbers'
  },
  {
    value: 'mobile',
    label: 'Mobile',
    icon: PhoneIcon,
    category: 'Text',
    description: 'Mobile phone number',
    sqlType: 'VARCHAR(20)',
    validationRules: 'Format: 0407 397 541, starts with 04',
    example: '0407 397 541, 0412 345 678',
    usedFor: 'Mobile phone numbers'
  },
  {
    value: 'url',
    label: 'URL',
    icon: LinkIcon,
    category: 'Text',
    description: 'Website URL',
    sqlType: 'VARCHAR(500)',
    validationRules: 'Valid URL format, clickable in table',
    example: 'https://example.com/doc.pdf',
    usedFor: 'Links to external documents or files'
  },

  // Number Fields
  {
    value: 'number',
    label: 'Number',
    icon: HashtagIcon,
    category: 'Numbers',
    description: 'Integer number',
    sqlType: 'INTEGER',
    validationRules: 'Integers (positive or negative), shows sum in footer',
    example: '10, 250, 15, -5',
    usedFor: 'Quantity of items, counts, or any integer value'
  },
  {
    value: 'whole_number',
    label: 'Whole number',
    icon: HashtagIcon,
    category: 'Numbers',
    description: 'Integer number',
    sqlType: 'INTEGER',
    validationRules: 'Integers only (no decimals), shows sum',
    example: '5, 100, 42',
    usedFor: 'Counts, units, days - no fractional values'
  },
  {
    value: 'currency',
    label: 'Currency',
    icon: CurrencyDollarIcon,
    category: 'Numbers',
    description: 'Money amount',
    sqlType: 'NUMERIC(10,2)',
    validationRules: 'Positive numbers, 2 decimal places, shows sum in footer',
    example: '$125.50, $1,234.99',
    usedFor: 'Price in Australian dollars'
  },
  {
    value: 'percentage',
    label: 'Percent',
    icon: HashtagIcon,
    category: 'Numbers',
    description: 'Percentage value',
    sqlType: 'NUMERIC(5,2)',
    validationRules: '0-100, input as number (e.g., 11), displayed with % symbol (e.g., 11%)',
    example: 'Input: 11 → Display: 11%, Input: 25.5 → Display: 25.5%',
    usedFor: 'Discount percentage for pricing'
  },

  // Date & Time
  {
    value: 'date',
    label: 'Date',
    icon: CalendarIcon,
    category: 'Date & Time',
    description: 'Date only',
    sqlType: 'DATE',
    validationRules: 'Stored as YYYY-MM-DD (sortable), displayed as DD-MM-YYYY (Australian format)',
    example: 'Display: 19-11-2025, Stored: 2025-11-19',
    usedFor: 'Date values without time, for contracts, events, start dates'
  },
  {
    value: 'date_and_time',
    label: 'Date & Time',
    icon: ClockIcon,
    category: 'Date & Time',
    description: 'Date and time',
    sqlType: 'TIMESTAMP',
    validationRules: 'Stored as YYYY-MM-DD HH:MM:SS (sortable), displayed as DD-MM-YYYY HH:MM (Australian format)',
    example: 'Display: 19-11-2025 14:30, Stored: 2025-11-19 14:30:00',
    usedFor: 'Timestamps, event times, scheduled dates with time'
  },

  // Special Types
  {
    value: 'gps_coordinates',
    label: 'GPS Coordinates',
    icon: LinkIcon,
    category: 'Special',
    description: 'Latitude and Longitude',
    sqlType: 'VARCHAR(100)',
    validationRules: 'Latitude, Longitude format',
    example: '-33.8688, 151.2093 (Sydney)',
    usedFor: 'GPS coordinates for job sites, delivery addresses, asset tracking'
  },
  {
    value: 'color_picker',
    label: 'Color Picker',
    icon: LinkIcon,
    category: 'Special',
    description: 'Hex color code',
    sqlType: 'VARCHAR(7)',
    validationRules: 'Hex color format (#RRGGBB)',
    example: '#FF5733, #3498DB, #000000',
    usedFor: 'Visual categorization, status indicators, UI customization'
  },
  {
    value: 'file_upload',
    label: 'File Upload',
    icon: LinkIcon,
    category: 'Special',
    description: 'File attachment reference',
    sqlType: 'TEXT',
    validationRules: 'File path or URL to uploaded file',
    example: '/uploads/doc.pdf, https://example.com/file.png',
    usedFor: 'File references, document links, image paths'
  },
  {
    value: 'action_buttons',
    label: 'Action Buttons',
    icon: WrenchScrewdriverIcon,
    category: 'Special',
    description: 'Interactive buttons for row-level actions',
    sqlType: 'VARCHAR(255)',
    validationRules: 'Optional field, stores action configuration as JSON string',
    example: '{"buttons": [{"label": "View", "action": "view"}, {"label": "Edit", "action": "edit"}]}',
    usedFor: 'Row-level actions like View, Edit, Download, Approve, Process'
  },

  // Selection & Boolean
  {
    value: 'boolean',
    label: 'Checkbox',
    icon: CheckCircleIcon,
    category: 'Selection',
    description: 'True/false value',
    sqlType: 'BOOLEAN',
    validationRules: 'True or False only',
    example: 'true, false',
    usedFor: 'Active/inactive status flag'
  },
  {
    value: 'choice',
    label: 'Single select',
    icon: RectangleStackIcon,
    category: 'Selection',
    description: 'Select one option from a list',
    sqlType: 'VARCHAR(50)',
    validationRules: 'Must be one of predefined options, displayed with colored badges',
    example: 'active, pending, completed, cancelled',
    usedFor: 'Status fields, workflow states, categories with visual indicators'
  },

  // Relationships
  {
    value: 'lookup',
    label: 'Link to another record',
    icon: ArrowsRightLeftIcon,
    category: 'Relationships',
    needsConfig: true,
    description: 'Link to records in another table',
    sqlType: 'VARCHAR(255)',
    validationRules: 'Must reference a valid value from the linked table/list',
    example: 'Product #123, Category: Materials, Customer: ACME Corp',
    usedFor: 'Foreign key relationships, dropdown selections from other tables'
  },
  {
    value: 'multiple_lookups',
    label: 'Link to multiple records',
    icon: ArrowsRightLeftIcon,
    category: 'Relationships',
    needsConfig: true,
    description: 'Link to multiple records',
    sqlType: 'TEXT',
    validationRules: 'Array of IDs stored as JSON',
    example: '[1, 5, 12]',
    usedFor: 'Multiple relationships to other records'
  },
  {
    value: 'user',
    label: 'User',
    icon: UserIcon,
    category: 'Relationships',
    description: 'Link to a user',
    sqlType: 'INTEGER',
    validationRules: 'Must reference valid user ID',
    example: 'User #7, User #1',
    usedFor: 'Assignment to users, ownership tracking'
  },

  // Computed
  {
    value: 'computed',
    label: 'Formula',
    icon: CalculatorIcon,
    category: 'Computed',
    description: 'Calculated value based on other fields',
    sqlType: 'VIRTUAL/COMPUTED',
    validationRules: 'Read-only, calculated from formula (e.g., A × B, SUM(C), LOOKUP(D))',
    example: '$1,255.00 (price × quantity), Total: $15,000 (SUM of all rows)',
    usedFor: 'Automatic calculations, aggregations, cross-table lookups'
  },
]

/**
 * Column types that can be edited after creation.
 * Excludes computed fields and special relationship types that require configuration.
 */
export const EDITABLE_COLUMN_TYPES = COLUMN_TYPES.filter(t =>
  !['computed', 'user', 'lookup', 'multiple_lookups'].includes(t.value)
)

/**
 * Get the display label for a column type value
 * @param {string} value - The column type value (e.g., 'single_line_text')
 * @returns {string} The human-readable label
 */
export const getColumnTypeLabel = (value) => {
  const type = COLUMN_TYPES.find(t => t.value === value)
  return type?.label || value
}

/**
 * Get the SQL type for a column type value
 * @param {string} value - The column type value (e.g., 'single_line_text')
 * @returns {string} The SQL type (e.g., 'VARCHAR(255)')
 */
export const getColumnTypeSqlType = (value) => {
  const type = COLUMN_TYPES.find(t => t.value === value)
  return type?.sqlType || 'VARCHAR(255)'
}

/**
 * Get the icon component for a column type value
 * @param {string} value - The column type value
 * @returns {Component} The icon component
 */
export const getColumnTypeIcon = (value) => {
  const type = COLUMN_TYPES.find(t => t.value === value)
  return type?.icon || DocumentTextIcon
}

/**
 * Get all column types in a specific category
 * @param {string} category - The category name
 * @returns {Array} Array of column types in that category
 */
export const getColumnTypesByCategory = (category) => {
  return COLUMN_TYPES.filter(t => t.category === category)
}

/**
 * Get all unique categories
 * @returns {Array} Array of category names
 */
export const getColumnCategories = () => {
  return [...new Set(COLUMN_TYPES.map(t => t.category))]
}

/**
 * Get emoji icon for a column type
 * SINGLE SOURCE OF TRUTH for all column type icons
 * @param {string} columnType - The column type value (e.g., 'single_line_text')
 * @returns {string} The emoji icon
 */
export const getColumnTypeEmoji = (columnType) => {
  const iconMap = {
    'single_line_text': '📝',
    'multiple_lines_text': '📄',
    'email': '📧',
    'phone': '📞',
    'mobile': '📱',
    'url': '🔗',
    'number': '#️⃣',
    'whole_number': '🔢',
    'currency': '💵',
    'percentage': '%',
    'date': '📅',
    'date_and_time': '🕐',
    'gps_coordinates': '📍',
    'color_picker': '🎨',
    'file_upload': '📎',
    'action_buttons': '⚡',
    'boolean': '☑️',
    'choice': '📋',
    'lookup': '🔗',
    'multiple_lookups': '🔗',
    'user': '👤',
    'computed': '🧮',
    'id': '🔑'
  }
  return iconMap[columnType] || '📝'
}

// ============================================================================
// API INTEGRATION - Single Source of Truth from Gold Standard Table
// ============================================================================

const CACHE_KEY = 'trapid_column_types_cache'
const CACHE_TIMESTAMP_KEY = 'trapid_column_types_timestamp'
const CACHE_TTL = 3600000 // 1 hour in milliseconds

/**
 * Fetch column types from the API (Gold Standard Reference table)
 * @returns {Promise<Array>} Array of column type definitions
 */
export const fetchColumnTypesFromAPI = async () => {
  try {
    const data = await api.get('/api/v1/column_types')

    if (data.success && data.data) {
      return data.data
    } else {
      throw new Error('Invalid API response format')
    }
  } catch (error) {
    console.error('Failed to fetch column types from API:', error)
    throw error
  }
}

/**
 * Get column types with caching
 * Fetches from API and caches in localStorage for 1 hour
 * Falls back to COLUMN_TYPES constant if API fails
 * @param {boolean} forceRefresh - Force refresh from API (skip cache)
 * @returns {Promise<Array>} Array of column type definitions
 */
export const getColumnTypesWithCache = async (forceRefresh = false) => {
  // Check cache first (unless force refresh)
  if (!forceRefresh) {
    try {
      const cachedData = localStorage.getItem(CACHE_KEY)
      const cachedTimestamp = localStorage.getItem(CACHE_TIMESTAMP_KEY)

      if (cachedData && cachedTimestamp) {
        const age = Date.now() - parseInt(cachedTimestamp)

        if (age < CACHE_TTL) {
          console.log('✅ Using cached column types (age:', Math.round(age / 1000), 'seconds)')
          return JSON.parse(cachedData)
        } else {
          console.log('⏰ Cache expired (age:', Math.round(age / 1000), 'seconds)')
        }
      }
    } catch (error) {
      console.warn('Cache read error:', error)
    }
  }

  // Fetch from API
  try {
    console.log('🔄 Fetching column types from API...')
    const columnTypes = await fetchColumnTypesFromAPI()

    // Cache the result
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(columnTypes))
      localStorage.setItem(CACHE_TIMESTAMP_KEY, Date.now().toString())
      console.log('💾 Column types cached successfully')
    } catch (error) {
      console.warn('Cache write error:', error)
    }

    return columnTypes
  } catch (error) {
    console.warn('⚠️ API fetch failed, using fallback COLUMN_TYPES constant')
    // Return fallback data (COLUMN_TYPES constant)
    return COLUMN_TYPES
  }
}

/**
 * Clear the column types cache
 * Useful when you want to force a refresh
 */
export const clearColumnTypesCache = () => {
  try {
    localStorage.removeItem(CACHE_KEY)
    localStorage.removeItem(CACHE_TIMESTAMP_KEY)
    console.log('🗑️ Column types cache cleared')
  } catch (error) {
    console.warn('Cache clear error:', error)
  }
}

/**
 * Get cache age in seconds
 * @returns {number|null} Age in seconds, or null if no cache
 */
export const getColumnTypesCacheAge = () => {
  try {
    const cachedTimestamp = localStorage.getItem(CACHE_TIMESTAMP_KEY)
    if (cachedTimestamp) {
      const age = Date.now() - parseInt(cachedTimestamp)
      return Math.round(age / 1000)
    }
  } catch (error) {
    console.warn('Cache age check error:', error)
  }
  return null
}
