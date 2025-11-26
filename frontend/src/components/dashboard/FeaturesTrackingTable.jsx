import { useState, useEffect } from 'react'
import TrapidTableView from '../documentation/TrapidTableView'
import { api } from '../../api'

// Column type defaults for TrapidTableView format
const COLUMN_TYPE_DEFAULTS = {
  'single_line_text': { width: 200, filterable: true, filterType: 'text' },
  'multiple_lines_text': { width: 300, sortable: false, filterable: true, filterType: 'text' },
  'boolean': { width: 80, filterable: true, filterType: 'dropdown' },
  'percentage': { width: 100, filterable: false },
  'whole_number': { width: 100, filterable: false },
  'lookup': { width: 200, filterable: true, filterType: 'dropdown' },
}

// Convert API column format to TrapidTableView column format
function convertColumnsToTrapidFormat(apiColumns) {
  // Start with select column for bulk actions
  const columns = [
    { key: 'select', label: '', resizable: false, sortable: false, filterable: false, width: 32, tooltip: 'Select rows for bulk actions' }
  ]

  // Convert each API column
  apiColumns.forEach(col => {
    const defaults = COLUMN_TYPE_DEFAULTS[col.column_type] || { width: 150 }

    columns.push({
      id: col.id,
      key: col.column_name,
      label: col.name,
      column_type: col.column_type,
      resizable: true,
      sortable: defaults.sortable !== false,
      filterable: defaults.filterable || false,
      filterType: defaults.filterType,
      width: defaults.width,
      tooltip: col.description || `${col.column_type} column`,
    })
  })

  return columns
}

/**
 * FeaturesTrackingTable - Uses standard TrapidTableView with database-backed table
 * Table ID: 375 (Feature Tracker)
 */
export default function FeaturesTrackingTable() {
  const TABLE_ID = 375

  const [records, setRecords] = useState([])
  const [columns, setColumns] = useState([])
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Load table data and columns
  useEffect(() => {
    const loadTableData = async () => {
      try {
        setLoading(true)

        // Load table schema and records in parallel
        const [tableResponse, recordsResponse, statsResponse] = await Promise.all([
          api.get(`/api/v1/tables/${TABLE_ID}`),
          api.get(`/api/v1/tables/${TABLE_ID}/records`),
          api.get('/api/v1/feature_trackers')
        ])

        if (tableResponse.table) {
          // Convert columns to TrapidTableView format
          const trapidColumns = convertColumnsToTrapidFormat(tableResponse.table.columns || [])
          setColumns(trapidColumns)
        }

        if (recordsResponse.records) {
          setRecords(recordsResponse.records)
        }

        if (statsResponse.success && statsResponse.stats) {
          setStats(statsResponse.stats)
        }
      } catch (err) {
        console.error('Error loading feature tracker table:', err)
        setError(err.message || 'Failed to load features')
      } finally {
        setLoading(false)
      }
    }

    loadTableData()
  }, [])

  // Handle record edit
  const handleEdit = async (entry) => {
    try {
      const { select, actions, ...recordData } = entry
      await api.put(`/api/v1/tables/${TABLE_ID}/records/${entry.id}`, { record: recordData })
      // Refresh records
      const response = await api.get(`/api/v1/tables/${TABLE_ID}/records`)
      if (response.records) {
        setRecords(response.records)
      }
    } catch (err) {
      console.error('Error updating record:', err)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-600 dark:text-gray-400">Loading features...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-red-600 dark:text-red-400">Error: {error}</div>
      </div>
    )
  }

  return (
    <div className="h-full">
      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3 mb-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Total Features</div>
            <div className="text-xl font-bold text-gray-900 dark:text-white">{stats.total}</div>
          </div>
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800 p-3">
            <div className="text-xs text-blue-600 dark:text-blue-400 mb-1">System Complete</div>
            <div className="text-xl font-bold text-blue-900 dark:text-blue-100">{stats.system_complete}</div>
          </div>
          <div className="bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800 p-3">
            <div className="text-xs text-green-600 dark:text-green-400 mb-1">Dev Checked</div>
            <div className="text-xl font-bold text-green-900 dark:text-green-100">{stats.dev_checked}</div>
          </div>
          <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800 p-3">
            <div className="text-xs text-yellow-600 dark:text-yellow-400 mb-1">Tester Happy</div>
            <div className="text-xl font-bold text-yellow-900 dark:text-yellow-100">{stats.tester_checked}</div>
          </div>
          <div className="bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-200 dark:border-orange-800 p-3">
            <div className="text-xs text-orange-600 dark:text-orange-400 mb-1">UI Checked</div>
            <div className="text-xl font-bold text-orange-900 dark:text-orange-100">{stats.ui_checked}</div>
          </div>
          <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800 p-3">
            <div className="text-xs text-purple-600 dark:text-purple-400 mb-1">User Happy</div>
            <div className="text-xl font-bold text-purple-900 dark:text-purple-100">{stats.user_checked}</div>
          </div>
          <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-lg border border-indigo-200 dark:border-indigo-800 p-3">
            <div className="text-xs text-indigo-600 dark:text-indigo-400 mb-1">Fully Complete</div>
            <div className="text-xl font-bold text-indigo-900 dark:text-indigo-100">{stats.fully_complete}</div>
          </div>
        </div>
      )}

      {/* Standard TrapidTableView */}
      {columns.length > 0 && (
        <TrapidTableView
          tableId={`table-feature-tracker`}
          tableIdNumeric={TABLE_ID}
          tableName="Feature Tracker"
          entries={records}
          columns={columns}
          onEdit={handleEdit}
          enableExport={true}
          initialGroupByColumn="chapter"
        />
      )}
    </div>
  )
}
