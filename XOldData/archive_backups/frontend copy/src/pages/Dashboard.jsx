import { useEffect, useState } from 'react'
import { Link, useSearchParams, useNavigate } from 'react-router-dom'
import { api } from '../api'
import {
  XMarkIcon,
  TableCellsIcon,
  ChartBarIcon,
  ClockIcon,
  PlusIcon,
  ArrowUpTrayIcon
} from '@heroicons/react/24/outline'

export default function Dashboard() {
  const navigate = useNavigate()
  const [tables, setTables] = useState([])
  const [filteredTables, setFilteredTables] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [searchParams] = useSearchParams()
  const searchQuery = searchParams.get('search') || ''
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newTableName, setNewTableName] = useState('')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState(null)

  useEffect(() => {
    loadTables()
  }, [])

  useEffect(() => {
    if (searchQuery) {
      const filtered = tables.filter(table =>
        table.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (table.description && table.description.toLowerCase().includes(searchQuery.toLowerCase()))
      )
      setFilteredTables(filtered)
    } else {
      setFilteredTables(tables)
    }
  }, [searchQuery, tables])

  const loadTables = async () => {
    try {
      setLoading(true)
      const response = await api.get('/api/v1/tables')
      // Only show tables that are marked as live
      const liveTables = (response.tables || []).filter(table => table.is_live)
      setTables(liveTables)
    } catch (err) {
      setError('Failed to load tables')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateTable = async () => {
    if (!newTableName.trim()) {
      setCreateError('Table name is required')
      return
    }

    setCreating(true)
    setCreateError(null)

    try {
      // Step 1: Create the table
      const tableResponse = await api.post('/api/v1/tables', {
        table: {
          name: newTableName,
          searchable: true
        }
      })

      if (!tableResponse.success || !tableResponse.table) {
        setCreateError('Failed to create table')
        return
      }

      const tableId = tableResponse.table.id

      // Step 2: Create default columns
      const defaultColumns = [
        { name: 'Name', column_type: 'single_line_text', is_title: true },
        { name: 'Email', column_type: 'email', is_title: false },
        { name: 'Phone', column_type: 'single_line_text', is_title: false },
        { name: 'Status', column_type: 'single_line_text', is_title: false },
        { name: 'Created Date', column_type: 'date', is_title: false },
      ]

      for (let index = 0; index < defaultColumns.length; index++) {
        const col = defaultColumns[index]
        const columnData = {
          name: col.name,
          column_name: col.name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, ''),
          column_type: col.column_type,
          is_title: col.is_title,
          searchable: true,
          required: false
        }

        const columnResponse = await api.post(`/api/v1/tables/${tableId}/columns`, {
          column: columnData
        })

        if (!columnResponse.success) {
          setCreateError(`Failed to create column: ${col.name}`)
          return
        }
      }

      // Step 3: Mark table as live
      await api.put(`/api/v1/tables/${tableId}`, {
        table: { is_live: true }
      })

      // Step 4: Navigate to the spreadsheet view
      navigate(`/tables/${tableId}`)
    } catch (err) {
      console.error('Table creation error:', err)
      setCreateError(err.response?.data?.error || err.message || 'Failed to create table')
    } finally {
      setCreating(false)
    }
  }

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="text-gray-600">Loading tables...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <div className="text-red-600">{error}</div>
      </div>
    )
  }

  // Calculate stats
  const totalTables = tables.length
  const totalRecords = tables.reduce((sum, table) => sum + (table.record_count || 0), 0)

  // Format date helper
  const formatDate = (dateString) => {
    if (!dateString) return 'Never'
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now - date
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-6">Dashboard</h1>

          {/* Stats Overview */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <TableCellsIcon className="h-8 w-8 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Tables</p>
                  <p className="text-2xl font-semibold text-gray-900 dark:text-white">{totalTables}</p>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <ChartBarIcon className="h-8 w-8 text-green-600 dark:text-green-400" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Records</p>
                  <p className="text-2xl font-semibold text-gray-900 dark:text-white">{totalRecords.toLocaleString()}</p>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <ClockIcon className="h-8 w-8 text-purple-600 dark:text-purple-400" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Last Activity</p>
                  <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                    {tables.length > 0 ? formatDate(tables.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))[0]?.updated_at) : 'Never'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex gap-3">
            <button
              onClick={() => {
                setShowCreateModal(true)
                setNewTableName('')
                setCreateError(null)
              }}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition shadow-sm"
            >
              <PlusIcon className="h-5 w-5" />
              Create New Table
            </button>
            <Link
              to="/import"
              className="inline-flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition shadow-sm"
            >
              <ArrowUpTrayIcon className="h-5 w-5" />
              Import Spreadsheet
            </Link>
          </div>
        </div>

      {searchQuery && (
        <div className="mb-4 text-sm text-gray-600 dark:text-gray-400">
          Showing {filteredTables.length} result{filteredTables.length !== 1 ? 's' : ''} for "{searchQuery}"
          <Link to="/dashboard" className="ml-2 text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300">
            Clear search
          </Link>
        </div>
      )}

      {tables.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-lg shadow-sm border border-gray-200 dark:bg-gray-800 dark:border-gray-700">
          <TableCellsIcon className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No tables yet</h3>
          <p className="text-gray-600 dark:text-gray-400 mb-6 max-w-md mx-auto">
            Get started by creating a new table or importing a spreadsheet to begin organizing your data.
          </p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => {
                setShowCreateModal(true)
                setNewTableName('')
                setCreateError(null)
              }}
              className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition shadow-sm"
            >
              <PlusIcon className="h-5 w-5" />
              Create Your First Table
            </button>
            <Link
              to="/import"
              className="inline-flex items-center gap-2 px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition shadow-sm"
            >
              <ArrowUpTrayIcon className="h-5 w-5" />
              Import Spreadsheet
            </Link>
          </div>
        </div>
      ) : filteredTables.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg shadow-sm border border-gray-200 dark:bg-gray-800 dark:border-gray-700">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No tables found</h3>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            No tables match your search query "{searchQuery}".
          </p>
          <Link
            to="/dashboard"
            className="inline-block px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
          >
            Clear search
          </Link>
        </div>
      ) : (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">All Tables</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {filteredTables.length} {filteredTables.length === 1 ? 'table' : 'tables'}
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredTables.map((table) => (
              <Link
                key={table.id}
                to={`/tables/${table.id}`}
                className="group block p-5 bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md hover:border-blue-400 transition-all dark:bg-gray-800 dark:border-gray-700 dark:hover:border-blue-500"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-base font-semibold text-gray-900 dark:text-white truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                      {table.name}
                    </h3>
                    {table.description && (
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">{table.description}</p>
                    )}
                  </div>
                  {table.icon && (
                    <span className="text-2xl ml-3 flex-shrink-0">{table.icon}</span>
                  )}
                </div>

                <div className="flex items-center justify-between text-sm pt-3 border-t border-gray-100 dark:border-gray-700">
                  <div className="flex items-center gap-1 text-gray-600 dark:text-gray-400">
                    <ChartBarIcon className="h-4 w-4" />
                    <span>{(table.record_count || 0).toLocaleString()} {table.record_count === 1 ? 'record' : 'records'}</span>
                  </div>
                  <div className="flex items-center gap-1 text-gray-500 dark:text-gray-500">
                    <ClockIcon className="h-4 w-4" />
                    <span>{formatDate(table.updated_at)}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Create Table Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-screen items-center justify-center p-4">
            {/* Backdrop */}
            <div
              className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
              onClick={() => setShowCreateModal(false)}
            />

            {/* Modal */}
            <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Create New Table
                </h3>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
                >
                  <XMarkIcon className="h-6 w-6" />
                </button>
              </div>

              <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                Give your table a name. We'll create it with default columns (Name, Email, Phone, Status, Created Date) that you can customize later.
              </p>

              <div className="mb-6">
                <label htmlFor="tableName" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Table Name
                </label>
                <input
                  type="text"
                  id="tableName"
                  value={newTableName}
                  onChange={(e) => setNewTableName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !creating) {
                      handleCreateTable()
                    }
                  }}
                  placeholder="e.g., Contacts, Tasks, Projects..."
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                  autoFocus
                />
                {createError && (
                  <p className="mt-2 text-sm text-red-600 dark:text-red-400">{createError}</p>
                )}
              </div>

              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setShowCreateModal(false)}
                  disabled={creating}
                  className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateTable}
                  disabled={creating || !newTableName.trim()}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {creating ? 'Creating...' : 'Create Table'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  )
}
