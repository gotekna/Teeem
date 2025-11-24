import React, { useState, useEffect } from 'react'
import { ExclamationTriangleIcon, CheckCircleIcon } from '@heroicons/react/24/outline'
import { api } from '../../api'

/**
 * Gold Table Sync Check Tab
 *
 * Displays all columns from the Gold Standard Reference table and compares
 * their SQL type definitions across multiple sources:
 * - Trinity documentation (Teacher entries)
 * - Backend Column::COLUMN_SQL_TYPE_MAP
 * - Frontend COLUMN_TYPES constant
 * - Actual database schema
 *
 * System-generated columns (id, created_at, updated_at) are highlighted in red.
 */
export default function GoldTableSyncCheckTab() {
  const [syncData, setSyncData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetchSyncData()
  }, [])

  const fetchSyncData = async () => {
    try {
      setLoading(true)
      setError(null)

      const data = await api.get('/api/v1/gold_table_sync')

      if (data.success) {
        setSyncData(data)
      } else {
        throw new Error(data.error || 'Failed to fetch sync data')
      }
    } catch (err) {
      console.error('Error fetching sync data:', err)
      setError(err.message || 'Failed to fetch sync data')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-gray-500">Loading sync data...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="flex items-center gap-2 text-red-800">
          <ExclamationTriangleIcon className="h-5 w-5" />
          <span className="font-semibold">Error loading sync data:</span>
        </div>
        <p className="text-red-700 mt-2">{error}</p>
        <button
          onClick={fetchSyncData}
          className="mt-4 px-4 py-2 bg-red-100 hover:bg-red-200 text-red-800 rounded"
        >
          Retry
        </button>
      </div>
    )
  }

  if (!syncData || !syncData.data) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-gray-500">No sync data available</div>
      </div>
    )
  }

  // Transform data for table display
  const tableData = syncData.data.map((col, index) => ({
    id: index + 1,
    column_name: col.column_name,
    display_name: col.display_name,
    column_type: col.column_type,
    trinity_sql: col.trinity_sql,
    backend_sql: col.backend_sql,
    frontend_sql: col.frontend_sql,
    actual_db_sql: col.actual_db_sql,
    status: col.status,
    is_system: col.is_system
  }))

  // Define columns for the table
  const columns = [
    {
      id: 'column_name',
      name: 'Column Name',
      column_type: 'single_line_text',
      width: 150
    },
    {
      id: 'display_name',
      name: 'Display Name',
      column_type: 'single_line_text',
      width: 150
    },
    {
      id: 'column_type',
      name: 'Column Type',
      column_type: 'single_line_text',
      width: 150
    },
    {
      id: 'trinity_sql',
      name: 'Trinity SQL',
      column_type: 'single_line_text',
      width: 150
    },
    {
      id: 'backend_sql',
      name: 'Backend SQL',
      column_type: 'single_line_text',
      width: 150
    },
    {
      id: 'frontend_sql',
      name: 'Frontend SQL',
      column_type: 'single_line_text',
      width: 150
    },
    {
      id: 'actual_db_sql',
      name: 'Actual DB SQL',
      column_type: 'single_line_text',
      width: 150
    },
    {
      id: 'status',
      name: 'Status',
      column_type: 'choice',
      width: 120
    }
  ]

  const { summary } = syncData

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-2">
          Gold Table Sync Check
        </h2>
        <p className="text-gray-600 text-sm">
          Compares column type definitions across Trinity documentation, backend code,
          frontend constants, and actual database schema.
        </p>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-600">Total Columns</div>
          <div className="text-2xl font-bold text-gray-900">{summary.total_columns}</div>
        </div>

        <div className="bg-green-50 rounded-lg shadow p-4">
          <div className="text-sm text-green-600">Matching</div>
          <div className="text-2xl font-bold text-green-900 flex items-center gap-2">
            {summary.matching}
            <CheckCircleIcon className="h-6 w-6" />
          </div>
        </div>

        <div className="bg-yellow-50 rounded-lg shadow p-4">
          <div className="text-sm text-yellow-600">Mismatched</div>
          <div className="text-2xl font-bold text-yellow-900 flex items-center gap-2">
            {summary.mismatched}
            <ExclamationTriangleIcon className="h-6 w-6" />
          </div>
        </div>

        <div className="bg-red-50 rounded-lg shadow p-4">
          <div className="text-sm text-red-600">System Columns</div>
          <div className="text-2xl font-bold text-red-900">{summary.system_columns}</div>
        </div>
      </div>

      {/* Legend */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-blue-900 mb-2">Legend</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-red-100 border border-red-300 rounded"></div>
            <span className="text-gray-700">System-generated column (id, created_at, updated_at)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-green-100 border border-green-300 rounded"></div>
            <span className="text-gray-700">All sources match</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-yellow-100 border border-yellow-300 rounded"></div>
            <span className="text-gray-700">Sources do not match</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-gray-100 border border-gray-300 rounded"></div>
            <span className="text-gray-700">No type defined (expected for relationships)</span>
          </div>
        </div>
      </div>

      {/* Sync Data Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {columns.map((col) => (
                  <th
                    key={col.id}
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    {col.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {tableData.map((row) => {
                // Determine row background color
                let rowClass = ''
                if (row.is_system) {
                  rowClass = 'bg-red-50'
                } else if (row.status === 'match') {
                  rowClass = 'bg-green-50'
                } else if (row.status === 'mismatch') {
                  rowClass = 'bg-yellow-50'
                } else {
                  rowClass = 'bg-gray-50'
                }

                return (
                  <tr key={row.id} className={rowClass}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {row.column_name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {row.display_name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {row.column_type || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {row.trinity_sql}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {row.backend_sql}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {row.frontend_sql}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {row.actual_db_sql}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          row.status === 'system'
                            ? 'bg-red-100 text-red-800'
                            : row.status === 'match'
                            ? 'bg-green-100 text-green-800'
                            : row.status === 'mismatch'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {row.status}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Refresh Button */}
      <div className="flex justify-end">
        <button
          onClick={fetchSyncData}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
        >
          Refresh Sync Data
        </button>
      </div>
    </div>
  )
}
