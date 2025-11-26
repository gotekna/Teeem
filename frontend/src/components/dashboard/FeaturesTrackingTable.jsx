import { useState, useEffect } from 'react'
import TrapidTableView from '../documentation/TrapidTableView'
import { api } from '../../api'

/**
 * FeaturesTrackingTable - Uses TrapidTableView to display feature tracking data
 * This is a VIEW-ONLY table - no editing allowed
 */
export default function FeaturesTrackingTable() {
  const [features, setFeatures] = useState([])
  const [featureChapters, setFeatureChapters] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [stats, setStats] = useState(null)

  // Define columns for TrapidTableView - chapter is now a lookup column for grouping
  const COLUMNS = [
    {
      key: 'feature_chapter',
      label: 'Chapter',
      column_type: 'lookup',
      resizable: true,
      sortable: true,
      filterable: true,
      filterType: 'dropdown',
      width: 280,
      lookup_table: 'feature_chapters',
      lookup_display_field: 'display_name'
    },
    { key: 'feature_name', label: 'Feature', column_type: 'single_line_text', resizable: true, sortable: true, filterable: true, filterType: 'text', width: 280 },
    { key: 'detail_point_1', label: 'Detail 1', column_type: 'single_line_text', resizable: true, sortable: false, filterable: false, width: 180 },
    { key: 'detail_point_2', label: 'Detail 2', column_type: 'single_line_text', resizable: true, sortable: false, filterable: false, width: 180 },
    { key: 'detail_point_3', label: 'Detail 3', column_type: 'single_line_text', resizable: true, sortable: false, filterable: false, width: 180 },
    { key: 'dev_progress', label: 'Progress', column_type: 'percentage', resizable: true, sortable: true, filterable: false, width: 100 },
    { key: 'system_complete', label: 'System', column_type: 'boolean', resizable: true, sortable: true, filterable: true, filterType: 'dropdown', width: 80 },
    { key: 'dev_checked', label: 'Dev', column_type: 'boolean', resizable: true, sortable: true, filterable: true, filterType: 'dropdown', width: 70 },
    { key: 'tester_checked', label: 'Tester', column_type: 'boolean', resizable: true, sortable: true, filterable: true, filterType: 'dropdown', width: 70 },
    { key: 'ui_checked', label: 'UI', column_type: 'boolean', resizable: true, sortable: true, filterable: true, filterType: 'dropdown', width: 60 },
    { key: 'user_checked', label: 'User', column_type: 'boolean', resizable: true, sortable: true, filterable: true, filterType: 'dropdown', width: 70 },
    { key: 'trapid_has', label: 'Trapid', column_type: 'boolean', resizable: true, sortable: true, filterable: true, filterType: 'dropdown', width: 80 },
    { key: 'buildertrend_has', label: 'BuilderTrend', column_type: 'boolean', resizable: true, sortable: true, filterable: true, filterType: 'dropdown', width: 100 },
    { key: 'buildexact_has', label: 'BuildExact', column_type: 'boolean', resizable: true, sortable: true, filterable: true, filterType: 'dropdown', width: 90 },
    { key: 'jacks_has', label: 'Jacks', column_type: 'boolean', resizable: true, sortable: true, filterable: true, filterType: 'dropdown', width: 70 },
    { key: 'wunderbuilt_has', label: 'Wunderbuilt', column_type: 'boolean', resizable: true, sortable: true, filterable: true, filterType: 'dropdown', width: 100 },
    { key: 'databuild_has', label: 'DataBuild', column_type: 'boolean', resizable: true, sortable: true, filterable: true, filterType: 'dropdown', width: 90 },
    { key: 'simpro_has', label: 'Simpro', column_type: 'boolean', resizable: true, sortable: true, filterable: true, filterType: 'dropdown', width: 80 },
    { key: 'smarterbuild_has', label: 'SmarterBuild', column_type: 'boolean', resizable: true, sortable: true, filterable: true, filterType: 'dropdown', width: 100 },
    { key: 'clickhome_has', label: 'ClickHome', column_type: 'boolean', resizable: true, sortable: true, filterable: true, filterType: 'dropdown', width: 90 },
    { key: 'clickup_has', label: 'ClickUp', column_type: 'boolean', resizable: true, sortable: true, filterable: true, filterType: 'dropdown', width: 80 }
  ]

  useEffect(() => {
    loadFeatures()
  }, [])

  const loadFeatures = async () => {
    try {
      setLoading(true)
      const response = await api.get('/api/v1/feature_trackers')

      if (response.success) {
        // Transform feature_chapter to lookup format { id, display }
        const processedFeatures = response.feature_trackers.map(f => ({
          ...f,
          // Convert feature_chapter to lookup column format for TrapidTableView
          feature_chapter: f.feature_chapter ? {
            id: f.feature_chapter.id,
            display: f.feature_chapter.display_name
          } : null
        }))
        setFeatures(processedFeatures)
        setFeatureChapters(response.feature_chapters || [])
        setStats(response.stats)
      } else {
        setError('Failed to load features')
      }
    } catch (err) {
      console.error('Error loading features:', err)
      setError(err.message || 'Failed to load features')
    } finally {
      setLoading(false)
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

      {/* TrapidTableView - View Only Mode */}
      <TrapidTableView
        tableName="Feature Tracking"
        tableId="feature_tracking"
        entries={features}
        columns={COLUMNS}
        viewOnly={true}
        enableExport={true}
        initialGroupByColumn="feature_chapter"
      />
    </div>
  )
}
