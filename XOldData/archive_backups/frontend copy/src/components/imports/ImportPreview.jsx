import { useState } from 'react'
import { api } from '../../api'
import { TrashIcon } from '@heroicons/react/24/outline'
import ImportProgress from './ImportProgress'

const COLUMN_TYPES = [
  { value: 'single_line_text', label: 'Single Line Text' },
  { value: 'multiple_lines_text', label: 'Multiple Lines Text' },
  { value: 'email', label: 'Email' },
  { value: 'number', label: 'Number' },
  { value: 'whole_number', label: 'Whole Number' },
  { value: 'currency', label: 'Currency' },
  { value: 'percentage', label: 'Percentage' },
  { value: 'date', label: 'Date' },
  { value: 'date_and_time', label: 'Date and Time' },
  { value: 'boolean', label: 'Boolean' },
]

export default function ImportPreview({ data, onComplete, onBack }) {
  console.log('ImportPreview received data:', data)
  console.log('Session key in preview:', data.session_key)

  const [tableName, setTableName] = useState(data.suggested_table_name || '')
  const [columns, setColumns] = useState(
    data.headers.map((header, index) => ({
      name: header,
      original_header: header, // Keep track of the original header for data mapping
      column_name: header.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, ''),
      column_type: data.detected_types[header] || 'single_line_text',
      is_title: index === 0,
      searchable: true,
    }))
  )
  const [importing, setImporting] = useState(false)
  const [error, setError] = useState(null)
  const [showProgress, setShowProgress] = useState(false)
  const [importSessionKey, setImportSessionKey] = useState(null)

  const handleColumnChange = (index, field, value) => {
    const newColumns = [...columns]
    newColumns[index] = { ...newColumns[index], [field]: value }
    setColumns(newColumns)
  }

  const handleDeleteColumn = (index) => {
    if (columns.length === 1) {
      setError('Cannot delete all columns. At least one column is required.')
      return
    }

    const newColumns = columns.filter((_, i) => i !== index)

    // If the deleted column was the title, make the first remaining column the title
    const hasTitle = newColumns.some(col => col.is_title)
    if (!hasTitle && newColumns.length > 0) {
      newColumns[0].is_title = true
    }

    setColumns(newColumns)
    setError(null)
  }

  const handleImport = async () => {
    setError(null)

    if (!tableName.trim()) {
      setError('Please enter a table name')
      return
    }

    // Validate session key exists
    if (!data.session_key) {
      setError('Session expired. Please upload the file again.')
      return
    }

    try {
      setImporting(true)

      const response = await api.post('/api/v1/imports/execute', {
        session_key: data.session_key,
        table_name: tableName,
        columns: columns,
      })

      if (response.success) {
        // Show progress screen with the session key
        setImportSessionKey(response.session_key || data.session_key)
        setShowProgress(true)
      } else {
        setError(response.error || response.errors?.[0] || 'Import failed')
      }
    } catch (err) {
      setError('Failed to import data. Please try again.')
      console.error(err)
    } finally {
      setImporting(false)
    }
  }

  // Show progress screen if import has started
  if (showProgress && importSessionKey) {
    return <ImportProgress sessionKey={importSessionKey} onComplete={onComplete} />
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Review Import</h2>
          <p className="text-gray-600 mt-1">
            {data.total_rows} rows will be imported
          </p>
        </div>
        <button
          onClick={onBack}
          className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
        >
          Back
        </button>
      </div>

      {/* Table Name */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Table Name
        </label>
        <input
          type="text"
          value={tableName}
          onChange={(e) => setTableName(e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder="Enter table name..."
        />
      </div>

      {/* Column Configuration */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Column Types</h3>
        <div className="space-y-4">
          {columns.map((column, index) => (
            <div key={index} className="flex items-center gap-4 pb-4 border-b border-gray-200 last:border-b-0">
              <div className="flex-1">
                <input
                  type="text"
                  value={column.name}
                  onChange={(e) => handleColumnChange(index, 'name', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  placeholder="Column name"
                />
              </div>
              <div className="flex-1">
                <select
                  value={column.column_type}
                  onChange={(e) => handleColumnChange(index, 'column_type', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                >
                  {COLUMN_TYPES.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <label className="flex items-center text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={column.is_title}
                    onChange={(e) => {
                      // Only one column can be the title
                      const newColumns = columns.map((col, i) => ({
                        ...col,
                        is_title: i === index ? e.target.checked : false,
                      }))
                      setColumns(newColumns)
                    }}
                    className="mr-2 rounded border-gray-300"
                  />
                  Title
                </label>
              </div>
              <button
                type="button"
                onClick={() => handleDeleteColumn(index)}
                className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                title="Delete column"
              >
                <TrashIcon className="h-5 w-5" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Preview Data */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Data Preview ({data.preview_rows.length} of {data.total_rows} rows)
        </h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {columns.map((column, index) => (
                  <th
                    key={index}
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    {column.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {data.preview_rows.map((row, rowIndex) => (
                <tr key={rowIndex}>
                  {columns.map((column, cellIndex) => {
                    // Use the original_header to access the correct data from the row
                    const cellValue = row[column.original_header]

                    return (
                      <td
                        key={cellIndex}
                        className="px-6 py-4 whitespace-nowrap text-sm text-gray-900"
                      >
                        {cellValue !== null && cellValue !== undefined
                          ? String(cellValue)
                          : '-'}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="text-red-800 text-sm">{error}</div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex justify-end gap-4">
        <button
          onClick={onBack}
          disabled={importing}
          className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          onClick={handleImport}
          disabled={importing}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {importing ? 'Importing...' : 'Import Data'}
        </button>
      </div>
    </div>
  )
}
