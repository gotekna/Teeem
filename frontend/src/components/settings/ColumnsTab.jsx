import { useState, useEffect, useMemo } from 'react'
import { api } from '../../api'
import TeeemTableView from '../documentation/TeeemTableView'
import { getColumnTypeEmoji } from '../../constants/columnTypes'

// Column definitions for the Columns table view
const COLUMNS_TABLE_COLUMNS = [
  { key: 'select', label: '', resizable: false, sortable: false, filterable: false, width: 32 },
  { key: 'id', label: 'ID', resizable: true, sortable: true, filterable: true, filterType: 'text', width: 60 },
  { key: 'table_name', label: 'Table', resizable: true, sortable: true, filterable: true, filterType: 'dropdown', width: 150 },
  { key: 'name', label: 'Display Name', resizable: true, sortable: true, filterable: true, filterType: 'text', width: 180 },
  { key: 'column_name', label: 'Column Name', resizable: true, sortable: true, filterable: true, filterType: 'text', width: 150 },
  { key: 'column_type', label: 'Type', resizable: true, sortable: true, filterable: true, filterType: 'dropdown', width: 140 },
  { key: 'position', label: 'Pos', resizable: true, sortable: true, filterable: false, width: 50 },
  { key: 'required', label: 'Required', resizable: true, sortable: true, filterable: true, filterType: 'dropdown', width: 80 },
  { key: 'searchable', label: 'Searchable', resizable: true, sortable: true, filterable: true, filterType: 'dropdown', width: 90 },
  { key: 'is_title', label: 'Title', resizable: true, sortable: true, filterable: true, filterType: 'dropdown', width: 70 },
  { key: 'lookup_table_name', label: 'Lookup Table', resizable: true, sortable: true, filterable: true, filterType: 'dropdown', width: 140 },
  { key: 'description', label: 'Description', resizable: true, sortable: false, filterable: true, filterType: 'text', width: 250 },
  { key: 'updated_at', label: 'Updated', resizable: true, sortable: true, filterable: false, width: 140 }
]

export default function ColumnsTab() {
  const [columns, setColumns] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchColumns = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await api.get('/api/v1/schema/columns')
      setColumns(response.columns || [])
    } catch (err) {
      console.error('ColumnsTab: Failed to fetch columns:', err)
      setError(err.message || 'Failed to load columns')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchColumns()
  }, [])

  // Transform columns data for TeeemTableView
  const entries = useMemo(() => {
    return columns.map(col => ({
      id: col.id,
      table_name: col.table_name || '(orphaned)',
      name: col.name,
      column_name: col.column_name,
      column_type: `${getColumnTypeEmoji(col.column_type)} ${col.column_type}`,
      position: col.position,
      required: col.required ? 'Yes' : 'No',
      searchable: col.searchable ? 'Yes' : 'No',
      is_title: col.is_title ? 'Yes' : 'No',
      lookup_table_name: col.lookup_table_name || '-',
      description: col.description || '',
      updated_at: col.updated_at ? new Date(col.updated_at).toLocaleDateString() : '-',
      // Keep raw data for reference
      _raw: col
    }))
  }, [columns])

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-md bg-red-50 dark:bg-red-900/10 p-4">
        <p className="text-sm text-red-800 dark:text-red-400">{error}</p>
        <button
          onClick={fetchColumns}
          className="mt-2 text-sm text-indigo-600 hover:text-indigo-500"
        >
          Try again
        </button>
      </div>
    )
  }

  return (
    <div className="px-4 py-6">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          Column Definitions ({columns.length})
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          All column definitions across user and import tables. System tables use Rails models and are not listed here.
        </p>
      </div>

      <TeeemTableView
        entries={entries}
        columns={COLUMNS_TABLE_COLUMNS}
        foundationId="dev-columns"
        tableName="Columns"
        viewOnly={true}
        hideUpdateViewButton={true}
      />
    </div>
  )
}
