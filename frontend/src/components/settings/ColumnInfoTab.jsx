import { useState, useEffect } from 'react'
import { CheckCircleIcon, InformationCircleIcon, ArrowDownTrayIcon, ArrowPathIcon } from '@heroicons/react/24/outline'
import { COLUMN_TYPES, getColumnTypeEmoji, clearColumnTypesCache } from '../../constants/columnTypes'
import api from '../../api'

// Fallback function - Convert COLUMN_TYPES to column info format
// Used if API call fails
const getFallbackColumns = () => {
  // Start with ID column (not in COLUMN_TYPES, but always present in tables)
  const columns = [
    {
      columnName: 'id',
      sqlType: 'INTEGER',
      displayType: 'ID / Primary Key',
      icon: getColumnTypeEmoji('id'),
      validationRules: 'Auto-increment, unique, not null',
      example: '1, 2, 3, 100',
      usedFor: 'Primary key for identifying records'
    }
  ]

  // Add all COLUMN_TYPES
  const typeColumns = COLUMN_TYPES.map(type => {
    // Special handling for date_and_time to show as created_at
    if (type.value === 'date_and_time') {
      return {
        columnName: 'created_at',
        sqlType: type.sqlType || 'UNKNOWN',
        displayType: 'Date & Time (Created)',
        icon: getColumnTypeEmoji('date_and_time'),
        validationRules: type.validationRules || 'No validation rules defined',
        example: type.example || 'No example provided',
        usedFor: type.usedFor || 'No usage description'
      }
    }

    // Special handling for boolean to show as checkbox
    if (type.value === 'boolean') {
      return {
        columnName: 'checkbox',
        sqlType: type.sqlType || 'UNKNOWN',
        displayType: 'Checkbox',
        icon: getColumnTypeEmoji('boolean'),
        validationRules: type.validationRules || 'No validation rules defined',
        example: type.example || 'No example provided',
        usedFor: type.usedFor || 'No usage description'
      }
    }

    // Special handling for choice to show as choice
    if (type.value === 'choice') {
      return {
        columnName: 'choice',
        sqlType: type.sqlType || 'UNKNOWN',
        displayType: 'Choice',
        icon: getColumnTypeEmoji('choice'),
        validationRules: type.validationRules || 'No validation rules defined',
        example: type.example || 'No example provided',
        usedFor: type.usedFor || 'No usage description'
      }
    }

    return {
      columnName: type.value,
      sqlType: type.sqlType || 'UNKNOWN',
      displayType: type.label || type.value,
      icon: getColumnTypeEmoji(type.value),
      validationRules: type.validationRules || 'No validation rules defined',
      example: type.example || 'No example provided',
      usedFor: type.usedFor || 'No usage description'
    }
  })

  columns.push(...typeColumns)

  // Add updated_at (second instance of date_and_time)
  const dateTimeType = COLUMN_TYPES.find(t => t.value === 'date_and_time')
  if (dateTimeType) {
    columns.push({
      columnName: 'updated_at',
      sqlType: dateTimeType.sqlType,
      displayType: 'Date & Time (Updated)',
      icon: getColumnTypeEmoji('date_and_time'),
      validationRules: 'Auto-updated on any modification',
      example: dateTimeType.example,
      usedFor: 'Last modification timestamp'
    })
  }

  return columns
}

// Legacy static columns for reference (kept for backwards compatibility)
const LEGACY_COLUMNS = [
  {
    columnName: 'id',
    sqlType: 'INTEGER',
    displayType: 'ID / Primary Key',
    validationRules: 'Auto-increment, unique, not null',
    example: '1, 2, 3, 100',
    usedFor: 'Primary key for identifying records'
  },
  {
    columnName: 'item_code',
    sqlType: 'VARCHAR(255)',
    displayType: 'Single Line Text',
    validationRules: 'Optional text field, max 255 characters, alphanumeric',
    example: 'CONC-001, STL-042A',
    usedFor: 'Unique identifier code for inventory'
  },
  {
    columnName: 'email',
    sqlType: 'VARCHAR(255)',
    displayType: 'Email',
    validationRules: 'Must contain @ symbol, valid email format',
    example: 'supplier@example.com, contact@business.com.au',
    usedFor: 'Email addresses for contacts'
  },
  {
    columnName: 'phone',
    sqlType: 'VARCHAR(20)',
    displayType: 'Phone (Landline)',
    validationRules: 'Format: (03) 9123 4567 or 1300 numbers',
    example: '(03) 9123 4567, 1300 123 456',
    usedFor: 'Landline phone numbers'
  },
  {
    columnName: 'mobile',
    sqlType: 'VARCHAR(20)',
    displayType: 'Phone (Mobile)',
    validationRules: 'Format: 0407 397 541, starts with 04',
    example: '0407 397 541, 0412 345 678',
    usedFor: 'Mobile phone numbers'
  },
  {
    columnName: 'start_date',
    sqlType: 'DATE',
    displayType: 'Date Only',
    validationRules: 'Format: YYYY-MM-DD, no time component',
    example: '2025-11-19, 1990-01-15',
    usedFor: 'Date values without time, for contracts, events, start dates'
  },
  {
    columnName: 'location_coords',
    sqlType: 'VARCHAR(100)',
    displayType: 'GPS Coordinates',
    validationRules: 'Latitude, Longitude format',
    example: '-33.8688, 151.2093 (Sydney)',
    usedFor: 'GPS coordinates for job sites, delivery addresses, asset tracking'
  },
  {
    columnName: 'color_code',
    sqlType: 'VARCHAR(7)',
    displayType: 'Color Picker',
    validationRules: 'Hex color format (#RRGGBB)',
    example: '#FF5733, #3498DB, #000000',
    usedFor: 'Visual categorization, status indicators, UI customization'
  },
  {
    columnName: 'file_attachment',
    sqlType: 'TEXT',
    displayType: 'File Upload',
    validationRules: 'File path or URL to uploaded file',
    example: '/uploads/doc.pdf, https://example.com/file.png',
    usedFor: 'File references, document links, image paths'
  },
  {
    columnName: 'category_type',
    sqlType: 'VARCHAR(255)',
    displayType: 'Lookup / Dropdown',
    validationRules: 'Must match predefined category list',
    example: 'Concrete, Timber, Steel, Plasterboard',
    usedFor: 'Material type classification'
  },
  {
    columnName: 'is_active',
    sqlType: 'BOOLEAN',
    displayType: 'Boolean / Checkbox',
    validationRules: 'True or False only',
    example: 'true, false',
    usedFor: 'Active/inactive status flag'
  },
  {
    columnName: 'discount',
    sqlType: 'DECIMAL(5,2)',
    displayType: 'Percentage',
    validationRules: '0-100, displayed with % symbol',
    example: '10.5%, 25%, 0%',
    usedFor: 'Discount percentage for pricing'
  },
  {
    columnName: 'status',
    sqlType: 'VARCHAR(50)',
    displayType: 'Choice / Badge',
    validationRules: 'Limited options: active, inactive (with colored badges)',
    example: 'active (green), inactive (red)',
    usedFor: 'Status with visual indicators'
  },
  {
    columnName: 'price',
    sqlType: 'DECIMAL(10,2)',
    displayType: 'Currency (AUD)',
    validationRules: 'Positive numbers, 2 decimal places, shows sum in footer',
    example: '$125.50, $1,234.99',
    usedFor: 'Price in Australian dollars'
  },
  {
    columnName: 'quantity',
    sqlType: 'INTEGER',
    displayType: 'Number',
    validationRules: 'Positive integers, shows sum in footer',
    example: '10, 250, 15',
    usedFor: 'Quantity of items'
  },
  {
    columnName: 'whole_number',
    sqlType: 'INTEGER',
    displayType: 'Whole Number',
    validationRules: 'Integers only (no decimals), shows sum',
    example: '5, 100, 42',
    usedFor: 'Counts, units, days - no fractional values'
  },
  {
    columnName: 'total_cost',
    sqlType: 'COMPUTED',
    displayType: 'Computed Field',
    validationRules: 'Formula: price × quantity, read-only, shows sum',
    example: '$1,255.00 (from $125.50 × 10)',
    usedFor: 'Automatic calculations from other columns'
  },
  {
    columnName: 'created_at',
    sqlType: 'DATETIME',
    displayType: 'Date & Time',
    validationRules: 'Auto-populated on creation, not editable',
    example: '19/11/2024 14:30',
    usedFor: 'Record creation timestamp'
  },
  {
    columnName: 'updated_at',
    sqlType: 'DATETIME',
    displayType: 'Date & Time',
    validationRules: 'Auto-updated on any modification',
    example: '19/11/2024 16:45',
    usedFor: 'Last modification timestamp'
  },
  {
    columnName: 'document_link',
    sqlType: 'VARCHAR(500)',
    displayType: 'URL / Link',
    validationRules: 'Valid URL format, clickable in table',
    example: 'https://example.com/doc.pdf',
    usedFor: 'Links to external documents or files'
  },
  {
    columnName: 'notes',
    sqlType: 'TEXT',
    displayType: 'Multi-Line Text',
    validationRules: 'Optional text field, supports line breaks',
    example: 'Additional notes\nSecond line\nThird line',
    usedFor: 'Notes, comments, multi-line descriptions'
  }
]


export default function ColumnInfoTab() {
  // State for column types from API
  const [columns, setColumns] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [dataSource, setDataSource] = useState('Loading...')

  // Editing state
  const [editingCell, setEditingCell] = useState(null) // { rowIndex, field }
  const [editValue, setEditValue] = useState('')
  const [saving, setSaving] = useState(false)

  // Fetch column types from API on mount
  useEffect(() => {
    const fetchColumnTypes = async () => {
      try {
        setLoading(true)
        const data = await api.get('/api/v1/column_types')

        if (data.success && data.data) {
          // Transform API response to column info format
          const columnTypes = data.data.map(type => ({
            columnName: type.columnName || type.value,
            sqlType: type.sqlType || 'UNKNOWN',
            displayType: type.label || type.value,
            icon: getColumnTypeEmoji(type.value),
            validationRules: type.validationRules || 'No validation rules defined',
            example: type.example || 'No example provided',
            usedFor: type.usedFor || 'No usage description',
            sampleValue: type.sampleValue
          }))

          // Add system columns (id, created_at, updated_at)
          const systemColumns = [
            {
              columnName: 'id',
              sqlType: 'INTEGER',
              displayType: 'ID / Primary Key',
              icon: getColumnTypeEmoji('id'),
              validationRules: 'Auto-increment, unique, not null',
              example: '1, 2, 3, 100',
              usedFor: 'Primary key for identifying records'
            },
            ...columnTypes,
            {
              columnName: 'created_at',
              sqlType: 'TIMESTAMP',
              displayType: 'Date & Time (Created)',
              icon: getColumnTypeEmoji('date_and_time'),
              validationRules: 'Auto-populated on creation, not editable',
              example: '19/11/2024 14:30',
              usedFor: 'Record creation timestamp'
            },
            {
              columnName: 'updated_at',
              sqlType: 'TIMESTAMP',
              displayType: 'Date & Time (Updated)',
              icon: getColumnTypeEmoji('date_and_time'),
              validationRules: 'Auto-updated on any modification',
              example: '19/11/2024 16:45',
              usedFor: 'Last modification timestamp'
            }
          ]

          setColumns(systemColumns)
          setDataSource(`Gold Standard Reference Table (ID: ${data.table_id})`)
          setError(null)
        } else {
          throw new Error('Invalid API response')
        }
      } catch (err) {
        console.error('Failed to fetch column types from API, using fallback:', err)
        setColumns(getFallbackColumns())
        setDataSource('Local Fallback (COLUMN_TYPES constant)')
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    fetchColumnTypes()
  }, [])

  // Handle starting to edit a cell
  const handleStartEdit = (rowIndex, field, currentValue) => {
    // Don't allow editing system columns (id, created_at, updated_at) or read-only fields
    const column = columns[rowIndex]
    if (column.columnName === 'id' || column.columnName === 'created_at' || column.columnName === 'updated_at') {
      return
    }

    setEditingCell({ rowIndex, field })
    setEditValue(currentValue)
  }

  // Handle saving an edit
  const handleSaveEdit = async () => {
    if (!editingCell) return

    const { rowIndex, field } = editingCell
    const column = columns[rowIndex]

    // Don't save if value hasn't changed
    if (editValue === column[field]) {
      setEditingCell(null)
      return
    }

    try {
      setSaving(true)

      // Update local state optimistically
      const updatedColumns = [...columns]
      updatedColumns[rowIndex] = {
        ...updatedColumns[rowIndex],
        [field]: editValue
      }
      setColumns(updatedColumns)

      // Update via API
      const data = await api.patch(`/api/v1/column_types/${column.columnName}`, {
        [field]: editValue
      })

      if (data.success) {
        console.log('✅ Saved to Gold Standard table:', data.message)
        // Clear cache to force refresh on next load
        clearColumnTypesCache()
      } else {
        throw new Error(data.error || 'Failed to save')
      }

      setEditingCell(null)
    } catch (err) {
      console.error('Failed to save edit:', err)
      // Revert optimistic update on error
      const revertedColumns = [...columns]
      revertedColumns[rowIndex] = {
        ...revertedColumns[rowIndex],
        [field]: column[field] // Restore original value
      }
      setColumns(revertedColumns)
      alert('Failed to save changes: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  // Handle canceling an edit
  const handleCancelEdit = () => {
    setEditingCell(null)
    setEditValue('')
  }

  // Handle key press in edit input
  const handleEditKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSaveEdit()
    } else if (e.key === 'Escape') {
      handleCancelEdit()
    }
  }

  // Export to CSV
  const exportToCSV = () => {
    const headers = ['Column Name (Database)', 'Display Name', 'SQL Type', 'Display Type', 'Validation Rules', 'Example', 'Used For']
    const csvRows = [
      headers.join(','),
      ...columns.map(col => [
        col.columnName,
        `"${col.displayName || col.displayType}"`,
        `"${col.sqlType}"`,
        `"${col.displayType}"`,
        `"${col.validationRules.replace(/"/g, '""')}"`,
        `"${col.example.replace(/"/g, '""')}"`,
        `"${col.usedFor.replace(/"/g, '""')}"`
      ].join(','))
    ]

    const csvContent = csvRows.join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', 'gold_standard_columns.csv')
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // Export to JSON
  const exportToJSON = () => {
    const data = {
      exportDate: new Date().toISOString(),
      columns: columns,
      statistics: {
        totalColumns: columns.length,
        uniqueSQLTypes: new Set(columns.map(c => c.sqlType)).size
      }
    }

    const jsonContent = JSON.stringify(data, null, 2)
    const blob = new Blob([jsonContent], { type: 'application/json' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', 'gold_standard_columns.json')
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              Gold Standard Column Reference
            </h2>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              Complete reference of all column types with validation rules and usage guidelines
            </p>
            <div className="mt-2 flex items-center gap-2">
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                error
                  ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-200'
                  : 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200'
              }`}>
                <span className={`inline-block w-2 h-2 rounded-full ${
                  error ? 'bg-yellow-500' : 'bg-green-500 animate-pulse'
                }`} />
                {dataSource}
              </span>
              {loading && (
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  Loading...
                </span>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2">
            <button
              onClick={() => {
                clearColumnTypesCache()
                window.location.reload()
              }}
              className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-lg transition-colors"
              title="Clear cache and refresh column data from database"
            >
              <ArrowPathIcon className="h-5 w-5" />
              Refresh Data
            </button>
            <button
              onClick={exportToCSV}
              className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-colors"
            >
              <ArrowDownTrayIcon className="h-5 w-5" />
              Export CSV
            </button>
            <button
              onClick={exportToJSON}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
            >
              <ArrowDownTrayIcon className="h-5 w-5" />
              Export JSON
            </button>
          </div>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 border border-gray-200 dark:border-gray-700">
          <div className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Columns</div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{columns.length}</div>
        </div>
        <div className="bg-green-50 dark:bg-green-900/20 rounded-lg shadow p-4 border border-green-200 dark:border-green-700">
          <div className="text-sm font-medium text-green-800 dark:text-green-400">Unique SQL Types</div>
          <div className="text-2xl font-bold text-green-900 dark:text-green-300 mt-1">
            {new Set(columns.map(c => c.sqlType)).size}
          </div>
        </div>
        <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg shadow p-4 border border-purple-200 dark:border-purple-700">
          <div className="text-sm font-medium text-purple-800 dark:text-purple-400">Always Live</div>
          <div className="text-sm font-bold text-purple-900 dark:text-purple-300 mt-1">
            ✓ Real-time from source
          </div>
        </div>
      </div>

      {/* Columns Section */}
      <div className="mb-8">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="px-6 py-4 bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <CheckCircleIcon className="h-5 w-5 text-green-600" />
              Column Types ({columns.length})
            </h3>
            <div className="mt-2 flex items-center gap-4 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700 rounded"></div>
                <span className="text-gray-600 dark:text-gray-400">🔒 System-Generated Columns (Auto-managed by database)</span>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700/30 border-b border-gray-200 dark:border-gray-700">
                <tr>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    #
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Column Name (Database)
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Display Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    SQL Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Display Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Validation Rules
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Example
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Sample Data
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Used For
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {columns.map((column, index) => {
                  // Check if this is a system-generated column (id, created_at, updated_at)
                  const isSystemGenerated = ['id', 'created_at', 'updated_at'].includes(column.columnName)

                  return (
                    <tr
                      key={index}
                      className={`transition-colors ${
                        isSystemGenerated
                          ? 'bg-red-50 dark:bg-red-900/10 hover:bg-red-100 dark:hover:bg-red-900/20'
                          : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
                      }`}
                    >
                      <td className="px-3 py-4 whitespace-nowrap">
                        <span className="text-sm font-bold text-gray-500 dark:text-gray-400">
                          {index + 1}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <code className={`text-sm font-mono font-semibold ${
                            isSystemGenerated
                              ? 'text-red-600 dark:text-red-400'
                              : 'text-indigo-600 dark:text-indigo-400'
                          }`}>
                            {column.columnName}
                          </code>
                          {isSystemGenerated && <span className="text-sm">🔒</span>}
                        </div>
                      </td>
                      {/* Display Name - Editable */}
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">
                        {editingCell?.rowIndex === index && editingCell?.field === 'displayName' ? (
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              onKeyDown={handleEditKeyDown}
                              onBlur={handleSaveEdit}
                              autoFocus
                              className="flex-1 px-2 py-1 border border-blue-500 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm font-medium bg-white dark:bg-gray-700"
                            />
                          </div>
                        ) : (
                          <div
                            onClick={() => !isSystemGenerated && handleStartEdit(index, 'displayName', column.displayName || column.displayType)}
                            className={`${!isSystemGenerated ? 'cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 rounded px-2 py-1' : ''}`}
                            title={!isSystemGenerated ? 'Click to edit' : 'System column - not editable'}
                          >
                            {column.displayName || column.displayType}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`text-xs font-mono px-2 py-1 rounded ${
                          isSystemGenerated
                            ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                            : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                        }`}>
                          {column.sqlType}
                        </span>
                      </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">
                      <span className="inline-flex items-center gap-2">
                        <span>{column.icon}</span>
                        <span>{column.displayType}</span>
                      </span>
                    </td>
                    {/* Validation Rules - Auto-Generated (Read-Only) */}
                    <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                      {column.validationRules}
                    </td>

                    {/* Example - Auto-Generated (Read-Only) */}
                    <td className="px-6 py-4 text-xs text-gray-500 dark:text-gray-500">
                      <code className="bg-gray-50 dark:bg-gray-800 px-2 py-1 rounded">
                        {column.example}
                      </code>
                    </td>

                    {/* Sample Data - From Gold Standard Table */}
                    <td className="px-6 py-4 text-xs">
                      {column.sampleValue !== null && column.sampleValue !== undefined ? (
                        <code className="bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 px-2 py-1 rounded font-semibold">
                          {String(column.sampleValue)}
                        </code>
                      ) : (
                        <span className="text-gray-400 dark:text-gray-600 italic">No data</span>
                      )}
                    </td>

                    {/* Used For - Auto-Generated (Read-Only) */}
                    <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                      {column.usedFor}
                    </td>
                  </tr>
                )})}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Info Box */}
      <div className="mt-6 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
        <div className="flex gap-3">
          <InformationCircleIcon className="h-5 w-5 text-gray-500 dark:text-gray-400 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-gray-600 dark:text-gray-400">
            <p className="font-medium text-gray-900 dark:text-white mb-1">Usage Notes:</p>
            <ul className="space-y-1 list-disc list-inside">
              <li>All validation rules are enforced at the database and application level</li>
              <li>Computed fields are read-only and calculated automatically</li>
              <li>Timestamp fields (created_at, updated_at) are managed by the database</li>
              <li>Export data as CSV or JSON using the buttons above</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
