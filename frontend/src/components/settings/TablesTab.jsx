import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../api'
import { TableCellsIcon, PencilIcon, EyeIcon, XMarkIcon, PlusIcon, Cog6ToothIcon, TrashIcon, ArrowTopRightOnSquareIcon } from '@heroicons/react/24/outline'
import TableColumnManager from './TableColumnManager'

export default function TablesTab() {
  const navigate = useNavigate()
  const [tables, setTables] = useState([])
  const [inMemoryTables, setInMemoryTables] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadingInMemory, setLoadingInMemory] = useState(true)
  const [error, setError] = useState(null)
  const [editingId, setEditingId] = useState(null)
  const [editingName, setEditingName] = useState('')
  const [saving, setSaving] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeFilter, setActiveFilter] = useState('all')
  const [previewTable, setPreviewTable] = useState(null)
  const [previewColumns, setPreviewColumns] = useState([])
  const [loadingPreview, setLoadingPreview] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newTableName, setNewTableName] = useState('')
  const [creating, setCreating] = useState(false)
  const [managingTable, setManagingTable] = useState(null)

  const fetchTables = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await api.get('/api/v1/schema/tables')
      setTables(response.tables || [])
    } catch (err) {
      console.error('TablesTab: Failed to fetch tables:', err)
      setError(err.message || 'Failed to load tables')
    } finally {
      setLoading(false)
    }
  }

  const fetchInMemoryTables = async () => {
    try {
      setLoadingInMemory(true)
      const response = await api.get('/api/v1/schema/in_memory_tables')
      setInMemoryTables(response.tables || [])
    } catch (err) {
      console.error('TablesTab: Failed to fetch in-memory tables:', err)
      // Don't set error - in-memory tables are supplementary
    } finally {
      setLoadingInMemory(false)
    }
  }

  useEffect(() => {
    fetchTables()
    fetchInMemoryTables()
  }, [])

  const handleNavigateToTable = (table) => {
    navigate(`/tables/${table.slug}`)
  }

  const handleStartEdit = (table) => {
    setEditingId(table.id)
    setEditingName(table.name)
  }

  const handleCancelEdit = () => {
    setEditingId(null)
    setEditingName('')
  }

  const handleSaveEdit = async (tableId) => {
    try {
      setSaving(true)
      await api.patch(`/api/v1/tables/${tableId}`, {
        table: {
          name: editingName
        }
      })

      // Update local state
      setTables(tables.map(t =>
        t.id === tableId ? { ...t, name: editingName } : t
      ))

      setEditingId(null)
      setEditingName('')
    } catch (err) {
      console.error('Failed to rename table:', err)
      alert(err.message || 'Failed to rename table')
    } finally {
      setSaving(false)
    }
  }

  const handlePreviewTable = async (table) => {
    try {
      setLoadingPreview(true)
      setPreviewTable(table)

      // Fetch column information for the system table using raw SQL introspection
      const response = await api.get(`/api/v1/schema/system_table_columns/${table.database_table_name}`)
      setPreviewColumns(response.columns || [])
    } catch (err) {
      console.error('Failed to fetch table columns:', err)
      alert(err.message || 'Failed to fetch table columns')
      setPreviewTable(null)
    } finally {
      setLoadingPreview(false)
    }
  }

  const handleClosePreview = () => {
    setPreviewTable(null)
    setPreviewColumns([])
  }

  const handleCreateTable = async () => {
    if (!newTableName.trim()) {
      alert('Please enter a table name')
      return
    }

    try {
      setCreating(true)
      const response = await api.post('/api/v1/tables', {
        table: {
          name: newTableName,
          is_live: false
        }
      })

      if (response.success) {
        // Refresh tables list
        await fetchTables()

        // Close modal and reset
        setShowCreateModal(false)
        setNewTableName('')

        // Navigate to the new table to add columns
        navigate(`/tables/${response.table.slug}`)
      }
    } catch (err) {
      console.error('Failed to create table:', err)
      alert(err.message || 'Failed to create table')
    } finally {
      setCreating(false)
    }
  }

  const handleDeleteTable = async (table) => {
    // Only allow deletion if table is draft and has no records
    if (table.is_live) {
      alert('Cannot delete a live table. Set it to draft first.')
      return
    }

    if (table.record_count > 0) {
      alert('Cannot delete a table that contains records. Delete all records first.')
      return
    }

    // Check if other tables have lookup columns referencing this table
    const referencingTables = tables.filter(t =>
      t.id !== table.id &&
      t.columns?.some(col => col.lookup_table_id === table.id)
    )

    if (referencingTables.length > 0) {
      const tableNames = referencingTables.map(t => t.name).join(', ')
      alert(`Cannot delete this table because it is referenced by lookup columns in: ${tableNames}. Remove those lookup columns first.`)
      return
    }

    if (!confirm(`Are you sure you want to delete the table "${table.name}"? This action cannot be undone.`)) {
      return
    }

    try {
      const response = await api.delete(`/api/v1/tables/${table.id}`)

      if (response.success) {
        // Refresh tables list
        await fetchTables()
      }
    } catch (err) {
      console.error('Failed to delete table:', err)
      alert(err.message || 'Failed to delete table')
    }
  }

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
      </div>
    )
  }

  // Filter out system tables from the top section (they're shown in the System Tables section below)
  const nonSystemTables = tables.filter(t => t.type !== 'system')

  // Filter tables based on search query and type filter
  const filteredTables = nonSystemTables.filter(table => {
    // Apply search filter
    const matchesSearch = !searchQuery ||
      table.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      table.database_table_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      table.plural_name?.toLowerCase().includes(searchQuery.toLowerCase())

    // Apply type filter
    const matchesType = activeFilter === 'all' || table.type === activeFilter

    return matchesSearch && matchesType
  })

  // Calculate counts for each filter (excluding system tables since they're in separate section)
  const allCount = nonSystemTables.length
  const userCount = nonSystemTables.filter(t => t.type === 'user').length
  const importCount = nonSystemTables.filter(t => t.type === 'import').length

  return (
    <div className="grid max-w-7xl grid-cols-1 gap-x-8 gap-y-10 px-4 py-10 sm:px-6 lg:px-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base/7 font-semibold text-gray-900 dark:text-white">User & Import Tables</h2>
          <p className="mt-1 text-sm/6 text-gray-500 dark:text-gray-400">
            Custom tables created by users and imported data tables. System tables are shown separately below.
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-3.5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
        >
          <PlusIcon className="h-5 w-5" />
          Create Table
        </button>
      </div>

      <div className="md:col-span-2">
        {/* Filter buttons */}
        <div className="mb-4 flex gap-2">
          <button
            onClick={() => setActiveFilter('all')}
            className={`inline-flex items-center px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeFilter === 'all'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-white text-gray-700 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:ring-gray-600 dark:hover:bg-gray-700'
            }`}
          >
            All ({allCount})
          </button>
          <button
            onClick={() => setActiveFilter('user')}
            className={`inline-flex items-center px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeFilter === 'user'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-white text-gray-700 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:ring-gray-600 dark:hover:bg-gray-700'
            }`}
          >
            User ({userCount})
          </button>
          <button
            onClick={() => setActiveFilter('import')}
            className={`inline-flex items-center px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeFilter === 'import'
                ? 'bg-green-600 text-white shadow-sm'
                : 'bg-white text-gray-700 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:ring-gray-600 dark:hover:bg-gray-700'
            }`}
          >
            Import ({importCount})
          </button>
        </div>

        {/* Search input */}
        <div className="mb-4">
          <input
            type="text"
            placeholder="Search tables by name or database table..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="block w-full rounded-md bg-white px-3 py-2 text-base text-gray-900 outline outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus:outline focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-600 sm:text-sm/6 dark:bg-white/5 dark:text-white dark:outline-white/10"
          />
        </div>

        {filteredTables.length === 0 ? (
          <div className="text-center py-12">
            <TableCellsIcon className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-semibold text-gray-900 dark:text-white">No tables</h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {searchQuery ? 'No tables match your search.' : 'No database tables found.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto shadow ring-1 ring-black ring-opacity-5 dark:ring-white/10 sm:rounded-lg">
            <table className="min-w-full divide-y divide-gray-300 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-800">
                <tr>
                  <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 dark:text-white sm:pl-6 w-12">
                    ID
                  </th>
                  <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-white">
                    Database Table
                  </th>
                  <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-white">
                    Table Name
                  </th>
                  <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-white">
                    Type
                  </th>
                  <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-white">
                    Columns
                  </th>
                  <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-white">
                    Records
                  </th>
                  <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-white">
                    Status
                  </th>
                  <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-6">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-gray-900">
                {filteredTables.map((table) => {
                  // Use type from API response
                  let tableType = 'User'
                  let typeColor = 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'

                  if (table.type === 'system') {
                    tableType = 'System'
                    typeColor = 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400'
                  } else if (table.type === 'import') {
                    tableType = 'Import'
                    typeColor = 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                  }

                  const isSystemTable = table.type === 'system'

                  return (
                    <tr
                      key={table.id}
                      className={`transition-colors ${
                        isSystemTable
                          ? 'bg-green-50 dark:bg-green-900/10 hover:bg-green-100 dark:hover:bg-green-900/20'
                          : 'hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer'
                      }`}
                      onClick={() => !isSystemTable && handleNavigateToTable(table)}
                    >
                      <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm text-gray-500 dark:text-gray-400 sm:pl-6">
                        {table.id}
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm">
                        <code className="text-xs bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded text-gray-600 dark:text-gray-400">
                          {table.database_table_name}
                        </code>
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm font-medium">
                        {editingId === table.id ? (
                          <input
                            type="text"
                            value={editingName}
                            onChange={(e) => setEditingName(e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                            className="block w-full rounded-md bg-white px-3 py-1.5 text-base text-gray-900 outline outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus:outline focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-600 sm:text-sm/6 dark:bg-white/5 dark:text-white dark:outline-white/10"
                            autoFocus
                          />
                        ) : (
                          <div className="flex items-center text-gray-900 dark:text-white">
                            {table.icon && <span className="mr-2">{table.icon}</span>}
                            {table.plural_name || table.name}
                          </div>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm">
                        <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset ${typeColor}`}>
                          {tableType}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-400">
                        {table.columns_count || table.columns?.length || 0}
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-400">
                        {table.record_count?.toLocaleString() || 0}
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm">
                        {table.is_live ? (
                          <span className="inline-flex items-center rounded-md bg-green-50 dark:bg-green-500/10 px-2 py-1 text-xs font-medium text-green-700 dark:text-green-400 ring-1 ring-inset ring-green-600/20 dark:ring-green-500/20">
                            Live
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-md bg-gray-50 dark:bg-gray-400/10 px-2 py-1 text-xs font-medium text-gray-600 dark:text-gray-400 ring-1 ring-inset ring-gray-500/10 dark:ring-gray-400/20">
                            Draft
                          </span>
                        )}
                      </td>
                      <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                        {isSystemTable ? (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handlePreviewTable(table)
                            }}
                            className="text-purple-600 hover:text-purple-900 dark:text-purple-400 dark:hover:text-purple-300"
                            title="Preview table columns"
                          >
                            <EyeIcon className="h-5 w-5" />
                          </button>
                        ) : editingId === table.id ? (
                          <div className="flex items-center gap-2 justify-end" onClick={(e) => e.stopPropagation()}>
                            <button
                              onClick={() => handleSaveEdit(table.id)}
                              disabled={saving}
                              className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300 disabled:opacity-50"
                            >
                              {saving ? 'Saving...' : 'Save'}
                            </button>
                            <button
                              onClick={handleCancelEdit}
                              disabled={saving}
                              className="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-300 disabled:opacity-50"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 justify-end">
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                setManagingTable(table)
                              }}
                              className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
                              title="Manage columns"
                            >
                              <Cog6ToothIcon className="h-5 w-5" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                handleStartEdit(table)
                              }}
                              className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300"
                              title="Edit table name"
                            >
                              <PencilIcon className="h-5 w-5" />
                            </button>
                            {!table.is_live && (table.record_count === 0 || !table.record_count) && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleDeleteTable(table)
                                }}
                                className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                                title="Delete table"
                              >
                                <TrashIcon className="h-5 w-5" />
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* System Tables Section */}
      <div className="mt-10 border-t border-gray-200 dark:border-gray-700 pt-10">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base/7 font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <span className="text-xl">🔧</span> System Tables (TrapidTableView)
              <span className="ml-2 text-sm font-normal text-gray-500 dark:text-gray-400">
                ({inMemoryTables.length} tables)
              </span>
            </h2>
            <p className="mt-1 text-sm/6 text-gray-500 dark:text-gray-400">
              System tables use TrapidTableView and are backed by dedicated Rails models. They now have proper numeric Table IDs
              and are registered in the tables database for unified management.
            </p>
          </div>
        </div>

        {loadingInMemory ? (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600"></div>
          </div>
        ) : (
          <div className="overflow-x-auto shadow ring-1 ring-black ring-opacity-5 dark:ring-white/10 sm:rounded-lg">
            <table className="min-w-full divide-y divide-gray-300 dark:divide-gray-700">
              <thead className="bg-indigo-50 dark:bg-indigo-900/20">
                <tr>
                  <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 dark:text-white sm:pl-6">
                    ID
                  </th>
                  <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-white">
                    Display Name
                  </th>
                  <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-white">
                    Rails Model
                  </th>
                  <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-white">
                    DB Table
                  </th>
                  <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-white">
                    Columns
                  </th>
                  <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-white">
                    Records
                  </th>
                  <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-white">
                    API Endpoint
                  </th>
                  <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-white">
                    Features
                  </th>
                  <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-6">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-gray-900">
                {inMemoryTables.map((table, index) => (
                  <tr key={table.table_id || index} className="hover:bg-indigo-50 dark:hover:bg-indigo-900/10">
                    <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm sm:pl-6">
                      <code className="text-xs bg-indigo-100 dark:bg-indigo-900/30 px-2 py-1 rounded text-indigo-700 dark:text-indigo-300 font-mono font-bold">
                        {table.table_id}
                      </code>
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm font-medium text-gray-900 dark:text-white">
                      <span className="mr-2">{table.icon}</span>
                      {table.name}
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-400">
                      <code className="text-xs bg-purple-100 dark:bg-purple-900/30 px-2 py-1 rounded text-purple-700 dark:text-purple-300">
                        {table.model}
                      </code>
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-400">
                      <code className="text-xs bg-amber-100 dark:bg-amber-900/30 px-2 py-1 rounded text-amber-700 dark:text-amber-300">
                        {table.database_table_name || '-'}
                      </code>
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-400">
                      {table.columns_count || 0}
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-400">
                      {table.record_count?.toLocaleString() || 0}
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm">
                      <code className="text-xs bg-green-100 dark:bg-green-900/30 px-2 py-1 rounded text-green-700 dark:text-green-300">
                        {table.api_endpoint}
                      </code>
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm">
                      <div className="flex gap-1">
                        {table.has_saved_views && (
                          <span className="inline-flex items-center rounded-md bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 px-2 py-1 text-xs font-medium">
                            Views
                          </span>
                        )}
                        {table.is_live && (
                          <span className="inline-flex items-center rounded-md bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 px-2 py-1 text-xs font-medium">
                            Live
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                      {(table.slug || table.legacy_id) && (
                        <button
                          onClick={() => navigate(`/tables/${table.slug || table.legacy_id}`)}
                          className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300"
                          title="Open table"
                        >
                          <ArrowTopRightOnSquareIcon className="h-5 w-5" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-4 p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg border border-indigo-200 dark:border-indigo-800">
          <h4 className="text-sm font-semibold text-indigo-800 dark:text-indigo-200 mb-2">ℹ️ For Claude Agents</h4>
          <p className="text-sm text-indigo-700 dark:text-indigo-300 mb-2">
            <strong>API:</strong> <code className="bg-indigo-100 dark:bg-indigo-800 px-1 rounded">GET /api/v1/schema/in_memory_tables</code> - Returns system tables with numeric IDs
          </p>
          <p className="text-sm text-indigo-700 dark:text-indigo-300 mb-2">
            System tables now have proper numeric <code className="bg-indigo-100 dark:bg-indigo-800 px-1 rounded">table_id</code> values (199-220 in production).
            The <code className="bg-indigo-100 dark:bg-indigo-800 px-1 rounded">legacy_id</code> (slug) is preserved for backwards compatibility with existing saved views.
          </p>
          <p className="text-sm text-indigo-700 dark:text-indigo-300 mb-2">
            <strong>Query by type:</strong> <code className="bg-indigo-100 dark:bg-indigo-800 px-1 rounded">Table.where(table_type: 'system')</code> in Rails
          </p>
          <p className="text-sm text-indigo-700 dark:text-indigo-300">
            Saved views use localStorage pattern: <code className="bg-indigo-100 dark:bg-indigo-800 px-1 rounded">trapid-saved-filters-{'{slug}'}</code>
          </p>
        </div>
      </div>

      {/* Preview Modal */}
      {previewTable && (
        <div className="fixed inset-0 z-50 overflow-y-auto" onClick={handleClosePreview}>
          <div className="flex min-h-screen items-center justify-center p-4">
            {/* Backdrop */}
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity dark:bg-gray-900 dark:bg-opacity-80" />

            {/* Modal */}
            <div
              className="relative transform overflow-hidden rounded-lg bg-white dark:bg-gray-800 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-4xl"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="bg-white dark:bg-gray-800 px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                      {previewTable.name}
                    </h3>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                      Table: <code className="text-xs bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">{previewTable.database_table_name}</code>
                    </p>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                      {previewColumns.length} columns • {previewTable.record_count?.toLocaleString() || 0} records
                    </p>
                  </div>
                  <button
                    onClick={handleClosePreview}
                    className="rounded-md text-gray-400 hover:text-gray-500 focus:outline-none dark:hover:text-gray-300"
                  >
                    <XMarkIcon className="h-6 w-6" />
                  </button>
                </div>

                {/* Columns Table */}
                {loadingPreview ? (
                  <div className="flex justify-center items-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                  </div>
                ) : (
                  <div className="overflow-x-auto border border-gray-200 dark:border-gray-700 rounded-lg">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                      <thead className="bg-gray-50 dark:bg-gray-700">
                        <tr>
                          <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                            #
                          </th>
                          <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                            Column Name
                          </th>
                          <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                            Data Type
                          </th>
                          <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                            Nullable
                          </th>
                          <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                            Default
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                        {previewColumns.map((column, index) => (
                          <tr key={index}>
                            <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                              {index + 1}
                            </td>
                            <td className="px-3 py-3 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                              {column.name}
                            </td>
                            <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                              <code className="text-xs bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
                                {column.type}
                              </code>
                            </td>
                            <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                              {column.nullable ? (
                                <span className="inline-flex items-center rounded-md bg-green-50 dark:bg-green-500/10 px-2 py-1 text-xs font-medium text-green-700 dark:text-green-400">
                                  Yes
                                </span>
                              ) : (
                                <span className="inline-flex items-center rounded-md bg-red-50 dark:bg-red-500/10 px-2 py-1 text-xs font-medium text-red-700 dark:text-red-400">
                                  No
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-3 text-sm text-gray-500 dark:text-gray-400">
                              {column.default ? (
                                <code className="text-xs bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
                                  {column.default}
                                </code>
                              ) : (
                                <span className="text-gray-400 dark:text-gray-500">—</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="bg-gray-50 dark:bg-gray-700 px-4 py-3 sm:flex sm:flex-row-reverse sm:px-6">
                <button
                  onClick={handleClosePreview}
                  className="inline-flex w-full justify-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 sm:ml-3 sm:w-auto"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create Table Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto" onClick={() => setShowCreateModal(false)}>
          <div className="flex min-h-screen items-center justify-center p-4">
            {/* Backdrop */}
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity dark:bg-gray-900 dark:bg-opacity-80" />

            {/* Modal */}
            <div
              className="relative transform overflow-hidden rounded-lg bg-white dark:bg-gray-800 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="bg-white dark:bg-gray-800 px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                      Create New Table
                    </h3>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                      Create a custom table to store and manage your data.
                    </p>
                  </div>
                  <button
                    onClick={() => setShowCreateModal(false)}
                    className="rounded-md text-gray-400 hover:text-gray-500 focus:outline-none dark:hover:text-gray-300"
                  >
                    <XMarkIcon className="h-6 w-6" />
                  </button>
                </div>

                {/* Form */}
                <div className="mt-4">
                  <label htmlFor="table-name" className="block text-sm font-medium text-gray-900 dark:text-white">
                    Table Name
                  </label>
                  <input
                    id="table-name"
                    type="text"
                    value={newTableName}
                    onChange={(e) => setNewTableName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !creating) {
                        handleCreateTable()
                      }
                    }}
                    placeholder="e.g., Customers, Products, Invoices"
                    className="mt-2 block w-full rounded-md bg-white px-3 py-2 text-base text-gray-900 outline outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus:outline focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-600 sm:text-sm/6 dark:bg-white/5 dark:text-white dark:outline-white/10"
                    autoFocus
                  />
                  <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                    Choose a descriptive name for your table. You'll be able to add columns after creation.
                  </p>
                </div>
              </div>

              {/* Footer */}
              <div className="bg-gray-50 dark:bg-gray-700 px-4 py-3 sm:flex sm:flex-row-reverse sm:px-6 gap-3">
                <button
                  onClick={handleCreateTable}
                  disabled={creating || !newTableName.trim()}
                  className="inline-flex w-full justify-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed sm:w-auto"
                >
                  {creating ? 'Creating...' : 'Create Table'}
                </button>
                <button
                  onClick={() => setShowCreateModal(false)}
                  disabled={creating}
                  className="mt-3 inline-flex w-full justify-center rounded-md bg-white dark:bg-gray-800 px-3 py-2 text-sm font-semibold text-gray-900 dark:text-white shadow-sm ring-1 ring-inset ring-gray-300 dark:ring-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 sm:mt-0 sm:w-auto"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Table Column Manager Modal */}
      {managingTable && (
        <TableColumnManager
          table={managingTable}
          onClose={() => setManagingTable(null)}
          onUpdate={fetchTables}
        />
      )}
    </div>
  )
}
