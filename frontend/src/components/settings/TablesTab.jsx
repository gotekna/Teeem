import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../api'
import { TableCellsIcon, PencilIcon, EyeIcon, XMarkIcon, PlusIcon, Cog6ToothIcon, TrashIcon, ArrowTopRightOnSquareIcon, ArrowPathIcon, CheckCircleIcon, ExclamationTriangleIcon, XCircleIcon, ChevronUpIcon, ChevronDownIcon } from '@heroicons/react/24/outline'
import TableColumnManager from './TableColumnManager'

// Feature categories to group related tables
const FEATURE_OPTIONS = [
  '',
  'Jobs',
  'Contacts',
  'Purchase Orders',
  'Pricebook',
  'Estimates',
  'Quotes',
  'WHS',
  'Schedule',
  'Meetings',
  'Financial',
  'Workflows',
  'Companies',
  'Users',
  'Xero',
  'OneDrive',
  'Documentation',
  'System'
]

export default function TablesTab() {
  const navigate = useNavigate()
  const [tables, setTables] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [editingId, setEditingId] = useState(null)
  const [editingName, setEditingName] = useState('')
  const [editingFeatureId, setEditingFeatureId] = useState(null)
  const [editingFeature, setEditingFeature] = useState('')
  const [saving, setSaving] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeFilter, setActiveFilter] = useState('all')
  const [featureFilter, setFeatureFilter] = useState('all')
  const [sortColumn, setSortColumn] = useState('feature')
  const [sortDirection, setSortDirection] = useState('asc')
  const [previewTable, setPreviewTable] = useState(null)
  const [previewColumns, setPreviewColumns] = useState([])
  const [loadingPreview, setLoadingPreview] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newTableName, setNewTableName] = useState('')
  const [creating, setCreating] = useState(false)
  const [managingTable, setManagingTable] = useState(null)
  const [syncResults, setSyncResults] = useState(null)
  const [syncing, setSyncing] = useState(false)
  const [creatingSetupViews, setCreatingSetupViews] = useState(false)
  const [setupViewResults, setSetupViewResults] = useState(null)

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

  useEffect(() => {
    fetchTables()
  }, [])

  const handleRefreshTables = async () => {
    try {
      setSyncing(true)
      setSyncResults(null)

      // Sync has_ui from production first
      try {
        const syncResponse = await api.post('/api/v1/schema/sync_has_ui_from_production')
        if (syncResponse.updated_count > 0) {
          console.log(`Synced has_ui for ${syncResponse.updated_count} tables from production`)
        }
      } catch (syncErr) {
        // Don't fail the whole refresh if sync fails (e.g., production doesn't have has_ui yet)
        console.warn('Could not sync has_ui from production:', syncErr.message)
      }

      // Refresh tables data
      await fetchTables()
    } catch (err) {
      console.error('Failed to refresh tables:', err)
      alert(err.message || 'Failed to refresh tables')
    } finally {
      setSyncing(false)
    }
  }

  const handleSyncSystemTables = async () => {
    try {
      setSyncing(true)
      setSyncResults(null)

      const response = await api.post('/api/v1/schema/sync_system_tables')

      // Add debug metadata to response
      const debugResponse = {
        ...response,
        _debug: {
          fetchedAt: new Date().toISOString(),
          goldStandard: response.results?.find(r => r.name === 'Gold Standard Reference'),
          apiUrl: '/api/v1/schema/sync_system_tables'
        }
      }

      setSyncResults(debugResponse)

      // Refresh tables data after sync check
      await fetchTables()
    } catch (err) {
      console.error('Failed to sync system tables:', err)
      alert(err.message || 'Failed to sync system tables')
    } finally {
      setSyncing(false)
    }
  }

  const handleCreateAllSetupViews = async () => {
    try {
      setCreatingSetupViews(true)
      setSetupViewResults(null)

      const response = await api.post('/api/v1/foundation_views/create_all_setup_views')

      if (response.success) {
        setSetupViewResults(response)
      } else {
        alert('Failed to create setup views: ' + (response.error || 'Unknown error'))
      }
    } catch (err) {
      console.error('Failed to create setup views:', err)
      // Show more detailed error
      const errorMsg = err.response?.data?.error || err.message || 'Failed to create setup views'
      alert('Error: ' + errorMsg + '\n\nMake sure you are logged in.')
    } finally {
      setCreatingSetupViews(false)
    }
  }

  const handleNavigateToTable = (table) => {
    // Use combined ID/slug format for better URLs
    navigate(`/tables/${table.id}/${table.slug}`)
  }

  const handleStartEdit = (table) => {
    setEditingId(table.id)
    setEditingName(table.name)
  }

  const handleCancelEdit = () => {
    setEditingId(null)
    setEditingName('')
  }

  const handleSaveEdit = async (foundationId) => {
    try {
      setSaving(true)
      await api.patch(`/api/v1/foundations/${foundationId}`, {
        foundation: {
          name: editingName
        }
      })

      // Update local state
      setTables(tables.map(t =>
        t.id === foundationId ? { ...t, name: editingName } : t
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

  const handleStartEditFeature = (table) => {
    setEditingFeatureId(table.id)
    setEditingFeature(table.feature || '')
  }

  const handleSaveFeature = async (foundationId, newFeature) => {
    try {
      setSaving(true)
      await api.patch(`/api/v1/foundations/${foundationId}`, {
        foundation: {
          feature: newFeature || null
        }
      })

      // Update local state
      setTables(tables.map(t =>
        t.id === foundationId ? { ...t, feature: newFeature || null } : t
      ))

      setEditingFeatureId(null)
      setEditingFeature('')
    } catch (err) {
      console.error('Failed to update feature:', err)
      alert(err.message || 'Failed to update feature')
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
      const response = await api.post('/api/v1/foundations', {
        foundation: {
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

        // Navigate to the new table to add columns (combined ID/slug format)
        const tableData = response.foundation || response.table
        navigate(`/tables/${tableData.id}/${tableData.slug}`)
      }
    } catch (err) {
      console.error('Failed to create table:', err)
      alert(err.message || 'Failed to create table')
    } finally {
      setCreating(false)
    }
  }

  const handleToggleHasUi = async (foundationId, hasUi) => {
    try {
      setSaving(true)
      await api.patch(`/api/v1/foundations/${foundationId}`, {
        foundation: {
          has_ui: hasUi
        }
      })

      // Update local state
      setTables(tables.map(t =>
        t.id === foundationId ? { ...t, has_ui: hasUi } : t
      ))
    } catch (err) {
      console.error('Failed to update has_ui:', err)
      alert(err.message || 'Failed to update has_ui')
    } finally {
      setSaving(false)
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
      t.columns?.some(col => col.lookup_foundation_id === table.id)
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
      const response = await api.delete(`/api/v1/foundations/${table.id}`)

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

  // Use tables directly from the API - it already has correct type and database_table_name
  const allTables = tables

  // Get unique features for filter dropdown
  const uniqueFeatures = [...new Set(allTables.map(t => t.feature).filter(Boolean))].sort()

  // Handle column sort
  const handleSort = (column) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortColumn(column)
      setSortDirection('asc')
    }
  }

  // Filter tables based on search query, type filter, and feature filter, then sort
  const filteredTables = allTables.filter(table => {
    // Apply search filter
    const matchesSearch = !searchQuery ||
      table.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      table.database_table_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      table.plural_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      table.feature?.toLowerCase().includes(searchQuery.toLowerCase())

    // Apply type filter
    const matchesType = activeFilter === 'all' || table.type === activeFilter

    // Apply feature filter
    const matchesFeature = featureFilter === 'all' ||
      (featureFilter === 'none' && !table.feature) ||
      table.feature === featureFilter

    return matchesSearch && matchesType && matchesFeature
  }).sort((a, b) => {
    const multiplier = sortDirection === 'asc' ? 1 : -1

    // Numeric columns
    if (sortColumn === 'id') {
      return (a.id - b.id) * multiplier
    }
    if (sortColumn === 'columns') {
      return ((a.column_count || 0) - (b.column_count || 0)) * multiplier
    }
    if (sortColumn === 'records') {
      return ((a.record_count || 0) - (b.record_count || 0)) * multiplier
    }
    if (sortColumn === 'compliance') {
      // Put null/undefined at the end when sorting ascending, at the start when descending
      const aScore = a.compliance_score ?? -1
      const bScore = b.compliance_score ?? -1
      return (aScore - bScore) * multiplier
    }

    // Boolean columns
    if (sortColumn === 'has_ui') {
      const aVal = a.has_ui ? 1 : 0
      const bVal = b.has_ui ? 1 : 0
      return (aVal - bVal) * multiplier
    }

    // String columns
    const stringColumns = {
      'database_table': 'database_table_name',
      'name': 'name',
      'feature': 'feature',
      'type': 'type',
      'usage': 'usage_type',
      'status': 'is_live'
    }

    if (stringColumns[sortColumn]) {
      const field = stringColumns[sortColumn]
      const aVal = String(a[field] || '')
      const bVal = String(b[field] || '')
      return aVal.localeCompare(bVal) * multiplier
    }

    return 0
  })

  // Calculate counts for each filter (including all tables now)
  const allCount = allTables.length
  const userCount = allTables.filter(t => t.type === 'user').length
  const importCount = allTables.filter(t => t.type === 'import').length
  const systemCount = allTables.filter(t => t.type === 'system').length

  return (
    <div className="grid max-w-7xl grid-cols-1 gap-x-8 gap-y-10 px-4 py-10 sm:px-6 lg:px-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base/7 font-semibold text-gray-900 dark:text-white">Heroku Backend Table View</h2>
          <p className="mt-1 text-sm/6 text-gray-500 dark:text-gray-400">
            All database tables from the Heroku backend, including user-created tables, imported data, and system tables.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleCreateAllSetupViews}
            disabled={creatingSetupViews}
            className="inline-flex items-center gap-2 rounded-md bg-green-600 px-3.5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-green-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-600 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Create Setup views for all tables that don't have one"
          >
            <CheckCircleIcon className={`h-5 w-5 ${creatingSetupViews ? 'animate-pulse' : ''}`} />
            {creatingSetupViews ? 'Creating...' : 'Create Setup Views'}
          </button>
          <button
            onClick={handleRefreshTables}
            disabled={syncing}
            className="inline-flex items-center gap-2 rounded-md bg-purple-600 px-3.5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-purple-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ArrowPathIcon className={`h-5 w-5 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Refreshing...' : 'Refresh'}
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-3.5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
          >
            <PlusIcon className="h-5 w-5" />
            Create Table
          </button>
        </div>
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
          <button
            onClick={() => setActiveFilter('system')}
            className={`inline-flex items-center px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeFilter === 'system'
                ? 'bg-purple-600 text-white shadow-sm'
                : 'bg-white text-gray-700 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:ring-gray-600 dark:hover:bg-gray-700'
            }`}
          >
            System ({systemCount})
          </button>
        </div>

        {/* Search and Feature Filter */}
        <div className="mb-4 flex gap-3">
          <input
            type="text"
            placeholder="Search tables by name, database table, or feature..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 rounded-md bg-white px-3 py-2 text-base text-gray-900 outline outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus:outline focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-600 sm:text-sm/6 dark:bg-white/5 dark:text-white dark:outline-white/10"
          />
          <select
            value={featureFilter}
            onChange={(e) => setFeatureFilter(e.target.value)}
            className="rounded-md bg-white px-3 py-2 text-sm text-gray-900 outline outline-1 -outline-offset-1 outline-gray-300 focus:outline focus:outline-2 focus:-outline-offset-2 focus:outline-cyan-600 dark:bg-gray-800 dark:text-white dark:outline-white/10"
          >
            <option value="all">All Features</option>
            <option value="none">No Feature</option>
            {uniqueFeatures.map(feature => (
              <option key={feature} value={feature}>{feature}</option>
            ))}
          </select>
        </div>

        {/* Sync Results Panel */}
        {syncResults && (
          <div className="mb-6 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
            {/* Summary Header */}
            <div className="bg-gray-50 dark:bg-gray-800 px-4 py-3 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white">System Tables Sync Results</h3>
                  <div className="flex items-center gap-3 text-sm">
                    <span className="inline-flex items-center gap-1 text-green-600 dark:text-green-400">
                      <CheckCircleIcon className="h-4 w-4" />
                      {syncResults.summary?.synced || 0} Synced
                    </span>
                    <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400">
                      <ExclamationTriangleIcon className="h-4 w-4" />
                      {syncResults.summary?.warnings || 0} Warnings
                    </span>
                    <span className="inline-flex items-center gap-1 text-red-600 dark:text-red-400">
                      <XCircleIcon className="h-4 w-4" />
                      {syncResults.summary?.errors || 0} Errors
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => setSyncResults(null)}
                  className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
                >
                  <XMarkIcon className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Results Details */}
            <div className="bg-white dark:bg-gray-900 px-4 py-3">
              <div className="text-sm text-gray-600 dark:text-gray-400">
                {syncResults.results?.map((result, idx) => (
                  <div key={idx} className="mb-2">
                    <span className="font-medium">{result.icon} {result.name}:</span>{' '}
                    {result.status === 'synced' && <span className="text-green-600 dark:text-green-400">✓ Synced</span>}
                    {result.status === 'warning' && <span className="text-amber-600 dark:text-amber-400">⚠ {result.warnings?.join(', ')}</span>}
                    {result.status === 'error' && <span className="text-red-600 dark:text-red-400">✗ {result.issues?.join(', ')}</span>}
                  </div>
                ))}
              </div>
            </div>

            {/* Footer */}
            <div className="bg-gray-50 dark:bg-gray-800 px-4 py-2 text-xs text-gray-500 dark:text-gray-400 border-t border-gray-200 dark:border-gray-700">
              Last synced: {syncResults.timestamp ? new Date(syncResults.timestamp).toLocaleString() : 'Unknown'}
            </div>

            {/* Debug Panel */}
            {syncResults._debug && (
              <div className="bg-yellow-50 dark:bg-yellow-900/20 px-4 py-3 border-t border-yellow-200 dark:border-yellow-700">
                <details className="text-xs">
                  <summary className="cursor-pointer font-semibold text-yellow-800 dark:text-yellow-400 mb-2">
                    🔍 Debug Info (Click to expand)
                  </summary>
                  <div className="space-y-2 text-yellow-900 dark:text-yellow-300 font-mono">
                    <div>Fetched at: {syncResults._debug.fetchedAt}</div>
                    <div>API URL: {syncResults._debug.apiUrl}</div>
                    <div className="mt-2 p-2 bg-white dark:bg-gray-900 rounded">
                      <div className="font-bold mb-1">Gold Standard Data:</div>
                      <pre className="text-xs overflow-auto">
                        {JSON.stringify(syncResults._debug.goldStandard, null, 2)}
                      </pre>
                    </div>
                    <div className="mt-2 p-2 bg-white dark:bg-gray-900 rounded">
                      <div className="font-bold mb-1">Full Summary:</div>
                      <pre className="text-xs overflow-auto">
                        {JSON.stringify(syncResults.summary, null, 2)}
                      </pre>
                    </div>
                  </div>
                </details>
              </div>
            )}
          </div>
        )}

        {/* Setup Views Results Panel */}
        {setupViewResults && (
          <div className="mb-6 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
            {/* Summary Header */}
            <div className="bg-green-50 dark:bg-green-900/20 px-4 py-3 border-b border-green-200 dark:border-green-700">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <h3 className="text-sm font-semibold text-green-900 dark:text-green-100">Setup Views Created</h3>
                  <div className="flex items-center gap-3 text-sm">
                    <span className="inline-flex items-center gap-1 text-green-600 dark:text-green-400">
                      <CheckCircleIcon className="h-4 w-4" />
                      {setupViewResults.results?.created?.length || 0} Created
                    </span>
                    <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400">
                      <ExclamationTriangleIcon className="h-4 w-4" />
                      {setupViewResults.results?.skipped?.length || 0} Skipped
                    </span>
                    <span className="inline-flex items-center gap-1 text-red-600 dark:text-red-400">
                      <XCircleIcon className="h-4 w-4" />
                      {setupViewResults.results?.errors?.length || 0} Errors
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => setSetupViewResults(null)}
                  className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
                >
                  <XMarkIcon className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Results Details */}
            <div className="bg-white dark:bg-gray-900 px-4 py-3 max-h-48 overflow-y-auto">
              <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                {setupViewResults.results?.created?.map((item, idx) => (
                  <div key={`created-${idx}`} className="text-green-600 dark:text-green-400">
                    ✓ Created Setup view for: {item.table_name} (ID: {item.foundation_id})
                  </div>
                ))}
                {setupViewResults.results?.skipped?.map((item, idx) => (
                  <div key={`skipped-${idx}`} className="text-amber-600 dark:text-amber-400">
                    ⊘ Skipped: {item.table_name} - {item.reason}
                  </div>
                ))}
                {setupViewResults.results?.errors?.map((item, idx) => (
                  <div key={`error-${idx}`} className="text-red-600 dark:text-red-400">
                    ✗ Error: {item.table_name} - {item.error}
                  </div>
                ))}
              </div>
            </div>

            {/* Message */}
            <div className="bg-gray-50 dark:bg-gray-800 px-4 py-2 text-xs text-gray-500 dark:text-gray-400 border-t border-gray-200 dark:border-gray-700">
              {setupViewResults.message}
            </div>
          </div>
        )}

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
                  <th
                    scope="col"
                    className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 dark:text-white sm:pl-6 w-12 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
                    onClick={() => handleSort('id')}
                  >
                    <div className="flex items-center gap-1">
                      ID
                      {sortColumn === 'id' && (
                        sortDirection === 'asc' ? <ChevronUpIcon className="h-4 w-4" /> : <ChevronDownIcon className="h-4 w-4" />
                      )}
                    </div>
                  </th>
                  <th
                    scope="col"
                    className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-white cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
                    onClick={() => handleSort('database_table')}
                  >
                    <div className="flex items-center gap-1">
                      Database Table
                      {sortColumn === 'database_table' && (
                        sortDirection === 'asc' ? <ChevronUpIcon className="h-4 w-4" /> : <ChevronDownIcon className="h-4 w-4" />
                      )}
                    </div>
                  </th>
                  <th
                    scope="col"
                    className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-white cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
                    onClick={() => handleSort('name')}
                  >
                    <div className="flex items-center gap-1">
                      Table Name
                      {sortColumn === 'name' && (
                        sortDirection === 'asc' ? <ChevronUpIcon className="h-4 w-4" /> : <ChevronDownIcon className="h-4 w-4" />
                      )}
                    </div>
                  </th>
                  <th
                    scope="col"
                    className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-white cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
                    onClick={() => handleSort('feature')}
                  >
                    <div className="flex items-center gap-1">
                      Feature
                      {sortColumn === 'feature' && (
                        sortDirection === 'asc' ? <ChevronUpIcon className="h-4 w-4" /> : <ChevronDownIcon className="h-4 w-4" />
                      )}
                    </div>
                  </th>
                  <th
                    scope="col"
                    className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-white cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
                    onClick={() => handleSort('type')}
                  >
                    <div className="flex items-center gap-1">
                      Type
                      {sortColumn === 'type' && (
                        sortDirection === 'asc' ? <ChevronUpIcon className="h-4 w-4" /> : <ChevronDownIcon className="h-4 w-4" />
                      )}
                    </div>
                  </th>
                  <th
                    scope="col"
                    className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-white cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
                    onClick={() => handleSort('usage')}
                  >
                    <div className="flex items-center gap-1">
                      Usage Status
                      {sortColumn === 'usage' && (
                        sortDirection === 'asc' ? <ChevronUpIcon className="h-4 w-4" /> : <ChevronDownIcon className="h-4 w-4" />
                      )}
                    </div>
                  </th>
                  <th
                    scope="col"
                    className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-white cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
                    onClick={() => handleSort('columns')}
                  >
                    <div className="flex items-center gap-1">
                      Columns
                      {sortColumn === 'columns' && (
                        sortDirection === 'asc' ? <ChevronUpIcon className="h-4 w-4" /> : <ChevronDownIcon className="h-4 w-4" />
                      )}
                    </div>
                  </th>
                  <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-white">
                    Virtual
                  </th>
                  <th
                    scope="col"
                    className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-white cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
                    onClick={() => handleSort('records')}
                  >
                    <div className="flex items-center gap-1">
                      Records
                      {sortColumn === 'records' && (
                        sortDirection === 'asc' ? <ChevronUpIcon className="h-4 w-4" /> : <ChevronDownIcon className="h-4 w-4" />
                      )}
                    </div>
                  </th>
                  <th
                    scope="col"
                    className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-white cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
                    onClick={() => handleSort('status')}
                  >
                    <div className="flex items-center gap-1">
                      Status
                      {sortColumn === 'status' && (
                        sortDirection === 'asc' ? <ChevronUpIcon className="h-4 w-4" /> : <ChevronDownIcon className="h-4 w-4" />
                      )}
                    </div>
                  </th>
                  <th
                    scope="col"
                    className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-white cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
                    onClick={() => handleSort('compliance')}
                  >
                    <div className="flex items-center gap-1">
                      Compliance
                      {sortColumn === 'compliance' && (
                        sortDirection === 'asc' ? <ChevronUpIcon className="h-4 w-4" /> : <ChevronDownIcon className="h-4 w-4" />
                      )}
                    </div>
                  </th>
                  <th
                    scope="col"
                    className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-white cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
                    onClick={() => handleSort('has_ui')}
                  >
                    <div className="flex items-center gap-1">
                      Has UI
                      {sortColumn === 'has_ui' && (
                        sortDirection === 'asc' ? <ChevronUpIcon className="h-4 w-4" /> : <ChevronDownIcon className="h-4 w-4" />
                      )}
                    </div>
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
                      className={`transition-colors cursor-pointer ${
                        isSystemTable
                          ? 'bg-purple-50 dark:bg-purple-900/10 hover:bg-purple-100 dark:hover:bg-purple-900/20'
                          : 'hover:bg-gray-50 dark:hover:bg-gray-800'
                      }`}
                      onClick={() => {
                        if (isSystemTable && table.slug) {
                          navigate(`/tables/${table.id}/${table.slug}`)
                        } else if (!isSystemTable) {
                          handleNavigateToTable(table)
                        }
                      }}
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
                      <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-400">
                        {editingFeatureId === table.id ? (
                          <select
                            value={editingFeature}
                            onChange={(e) => {
                              const newValue = e.target.value
                              setEditingFeature(newValue)
                              // Auto-save on change with the new value
                              handleSaveFeature(table.id, newValue)
                            }}
                            onBlur={() => {
                              setEditingFeatureId(null)
                              setEditingFeature('')
                            }}
                            onClick={(e) => e.stopPropagation()}
                            className="block w-full rounded-md bg-white px-2 py-1 text-sm text-gray-900 outline outline-1 -outline-offset-1 outline-gray-300 focus:outline focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-600 dark:bg-gray-800 dark:text-white dark:outline-white/10"
                            autoFocus
                          >
                            {FEATURE_OPTIONS.map(opt => (
                              <option key={opt} value={opt}>{opt || '(none)'}</option>
                            ))}
                          </select>
                        ) : (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleStartEditFeature(table)
                            }}
                            className="group flex items-center gap-1 hover:text-cyan-600 dark:hover:text-cyan-400"
                          >
                            {table.feature ? (
                              <span className="inline-flex items-center rounded-md bg-cyan-50 dark:bg-cyan-500/10 px-2 py-1 text-xs font-medium text-cyan-700 dark:text-cyan-400 ring-1 ring-inset ring-cyan-600/20 dark:ring-cyan-500/20">
                                {table.feature}
                              </span>
                            ) : (
                              <span className="text-gray-400 dark:text-gray-600 group-hover:text-cyan-500">-</span>
                            )}
                            <PencilIcon className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </button>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm">
                        <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset ${typeColor}`}>
                          {tableType}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm">
                        {(() => {
                          const status = table.usage_status || 'Unknown'
                          const statusColors = {
                            'TeeemTableView': 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400 ring-indigo-600/20',
                            'Rails System': 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400 ring-purple-600/20',
                            'User Table': 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 ring-blue-600/20',
                            'Import': 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 ring-green-600/20',
                            'Needs Deleting': 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 ring-red-600/20',
                            'Unknown': 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400 ring-gray-600/20'
                          }
                          return (
                            <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset ${statusColors[status] || statusColors['Unknown']}`}>
                              {status}
                            </span>
                          )
                        })()}
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-400">
                        {table.columns_count || table.columns?.length || 0}
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-400">
                        {(() => {
                          // Find sync result for this table
                          const syncResult = syncResults?.results?.find(r => r.foundation_id === table.id)
                          if (syncResult && syncResult.db_exists) {
                            const virtualCount = syncResult.registered_columns_count - syncResult.db_columns_count

                            // Debug logging
                            if (table.id === 221 || table.id === 220) {
                              console.log(`🔍 Virtual count for ${table.name} (ID ${table.id}):`, {
                                registered: syncResult.registered_columns_count,
                                db: syncResult.db_columns_count,
                                virtual: virtualCount,
                                syncResult
                              })
                            }

                            if (virtualCount > 0) {
                              return (
                                <span className="inline-flex items-center rounded-md bg-amber-50 dark:bg-amber-500/10 px-2 py-1 text-xs font-medium text-amber-700 dark:text-amber-400 ring-1 ring-inset ring-amber-600/20 dark:ring-amber-500/20">
                                  {virtualCount}
                                </span>
                              )
                            } else {
                              return (
                                <span className="text-gray-400 dark:text-gray-600">0</span>
                              )
                            }
                          }
                          return <span className="text-gray-400 dark:text-gray-600">-</span>
                        })()}
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
                      <td className="whitespace-nowrap px-3 py-4 text-sm">
                        {(() => {
                          // Skip compliance display for system tables
                          if (table.type === 'system') {
                            return <span className="text-gray-400 dark:text-gray-600">-</span>
                          }

                          const score = table.compliance_score
                          const nonCompliantCount = table.non_compliant_count || 0

                          // No score yet
                          if (score === null || score === undefined) {
                            return (
                              <span className="inline-flex items-center rounded-md bg-gray-50 dark:bg-gray-400/10 px-2 py-1 text-xs font-medium text-gray-500 dark:text-gray-500 ring-1 ring-inset ring-gray-500/10 dark:ring-gray-400/20">
                                Not checked
                              </span>
                            )
                          }

                          // Color based on score
                          let colorClass = ''
                          if (score >= 100) {
                            colorClass = 'bg-green-50 dark:bg-green-500/10 text-green-700 dark:text-green-400 ring-green-600/20 dark:ring-green-500/20'
                          } else if (score >= 70) {
                            colorClass = 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 ring-amber-600/20 dark:ring-amber-500/20'
                          } else {
                            colorClass = 'bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400 ring-red-600/20 dark:ring-red-500/20'
                          }

                          return (
                            <span
                              className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset ${colorClass}`}
                              title={nonCompliantCount > 0 ? `${nonCompliantCount} non-compliant column${nonCompliantCount > 1 ? 's' : ''}` : 'All columns compliant'}
                            >
                              {score}%
                            </span>
                          )
                        })()}
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm text-center">
                        <input
                          type="checkbox"
                          checked={table.has_ui || false}
                          onChange={(e) => {
                            e.stopPropagation()
                            handleToggleHasUi(table.id, e.target.checked)
                          }}
                          onClick={(e) => e.stopPropagation()}
                          className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-600 dark:border-gray-600 dark:bg-gray-700"
                        />
                      </td>
                      <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                        {isSystemTable ? (
                          <div className="flex items-center gap-2 justify-end">
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
                            {table.slug && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  navigate(`/tables/${table.id}/${table.slug}`)
                                }}
                                className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300"
                                title="Open table"
                              >
                                <ArrowTopRightOnSquareIcon className="h-5 w-5" />
                              </button>
                            )}
                          </div>
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
