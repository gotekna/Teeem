import { useState, useEffect } from 'react'
import TrapidTableView from '../documentation/TrapidTableView'
import { api } from '../../api'

/**
 * FeaturesTrackingTable - Uses TrapidTableView to display feature tracking data
 * Shows competitor comparison with percentage bars in header
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
    { key: 'trapid_has', label: 'Trapid', column_type: 'boolean', resizable: true, sortable: true, filterable: true, filterType: 'dropdown', width: 80 },
    { key: 'simpro_has', label: 'Simpro', column_type: 'boolean', resizable: true, sortable: true, filterable: true, filterType: 'dropdown', width: 80 },
    { key: 'buildertrend_has', label: 'BuilderTrend', column_type: 'boolean', resizable: true, sortable: true, filterable: true, filterType: 'dropdown', width: 100 },
    { key: 'buildexact_has', label: 'BuildExact', column_type: 'boolean', resizable: true, sortable: true, filterable: true, filterType: 'dropdown', width: 90 },
    { key: 'databuild_has', label: 'DataBuild', column_type: 'boolean', resizable: true, sortable: true, filterable: true, filterType: 'dropdown', width: 90 },
    { key: 'clickhome_has', label: 'ClickHome', column_type: 'boolean', resizable: true, sortable: true, filterable: true, filterType: 'dropdown', width: 90 },
    { key: 'wunderbuilt_has', label: 'Wunderbuilt', column_type: 'boolean', resizable: true, sortable: true, filterable: true, filterType: 'dropdown', width: 100 },
    { key: 'smarterbuild_has', label: 'SmarterBuild', column_type: 'boolean', resizable: true, sortable: true, filterable: true, filterType: 'dropdown', width: 100 },
    { key: 'jacks_has', label: 'Jacks', column_type: 'boolean', resizable: true, sortable: true, filterable: true, filterType: 'dropdown', width: 70 },
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

  // Get color classes for competitor bars
  const getColorClasses = (color, isTrapid = false) => {
    const colors = {
      blue: { bg: 'bg-blue-500', light: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-300' },
      purple: { bg: 'bg-purple-500', light: 'bg-purple-100 dark:bg-purple-900/30', text: 'text-purple-700 dark:text-purple-300' },
      green: { bg: 'bg-green-500', light: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-300' },
      orange: { bg: 'bg-orange-500', light: 'bg-orange-100 dark:bg-orange-900/30', text: 'text-orange-700 dark:text-orange-300' },
      teal: { bg: 'bg-teal-500', light: 'bg-teal-100 dark:bg-teal-900/30', text: 'text-teal-700 dark:text-teal-300' },
      pink: { bg: 'bg-pink-500', light: 'bg-pink-100 dark:bg-pink-900/30', text: 'text-pink-700 dark:text-pink-300' },
      yellow: { bg: 'bg-yellow-500', light: 'bg-yellow-100 dark:bg-yellow-900/30', text: 'text-yellow-700 dark:text-yellow-300' },
      gray: { bg: 'bg-gray-500', light: 'bg-gray-100 dark:bg-gray-900/30', text: 'text-gray-700 dark:text-gray-300' },
      red: { bg: 'bg-red-500', light: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-300' },
      indigo: { bg: 'bg-indigo-500', light: 'bg-indigo-100 dark:bg-indigo-900/30', text: 'text-indigo-700 dark:text-indigo-300' }
    }
    return colors[color] || colors.gray
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
      {/* Summary Stats Row */}
      {stats && (
        <div className="mb-4">
          {/* Top row - Key metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
              <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Total Features</div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">{stats.total}</div>
            </div>
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800 p-4">
              <div className="text-xs text-blue-600 dark:text-blue-400 mb-1">Trapid Progress</div>
              <div className="text-2xl font-bold text-blue-900 dark:text-blue-100">{stats.avg_progress}%</div>
            </div>
            <div className="bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800 p-4">
              <div className="text-xs text-green-600 dark:text-green-400 mb-1">Trapid Features</div>
              <div className="text-2xl font-bold text-green-900 dark:text-green-100">
                {stats.competitors?.find(c => c.key === 'trapid')?.count || 0}/{stats.total}
              </div>
            </div>
            <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800 p-4">
              <div className="text-xs text-purple-600 dark:text-purple-400 mb-1">Market Leader</div>
              <div className="text-2xl font-bold text-purple-900 dark:text-purple-100">
                {stats.competitors?.[0]?.name || '-'}
              </div>
            </div>
          </div>

          {/* Competitor Comparison Bars */}
          {stats.competitors && stats.competitors.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                Competitor Feature Comparison
              </h3>
              <div className="space-y-2">
                {stats.competitors.map((competitor, index) => {
                  const colors = getColorClasses(competitor.color)
                  const isTrapid = competitor.key === 'trapid'
                  const isLeader = index === 0

                  return (
                    <div key={competitor.key} className="flex items-center gap-3">
                      {/* Rank */}
                      <div className={`w-6 text-xs font-medium ${isLeader ? 'text-yellow-600 dark:text-yellow-400' : 'text-gray-400 dark:text-gray-500'}`}>
                        {isLeader ? '🏆' : `#${index + 1}`}
                      </div>

                      {/* Name */}
                      <div className={`w-28 text-sm font-medium truncate ${isTrapid ? 'text-blue-600 dark:text-blue-400 font-bold' : 'text-gray-700 dark:text-gray-300'}`}>
                        {competitor.name}
                      </div>

                      {/* Progress Bar */}
                      <div className="flex-1 h-5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${isTrapid ? 'bg-blue-500' : colors.bg} transition-all duration-500`}
                          style={{ width: `${competitor.percentage}%` }}
                        />
                      </div>

                      {/* Stats */}
                      <div className={`w-20 text-right text-sm font-medium ${isTrapid ? 'text-blue-600 dark:text-blue-400' : 'text-gray-600 dark:text-gray-400'}`}>
                        {competitor.count}/{competitor.total}
                      </div>

                      {/* Percentage */}
                      <div className={`w-16 text-right text-sm font-bold ${isTrapid ? 'text-blue-600 dark:text-blue-400' : isLeader ? 'text-green-600 dark:text-green-400' : 'text-gray-700 dark:text-gray-300'}`}>
                        {competitor.percentage}%
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TrapidTableView */}
      <TrapidTableView
        tableName="Feature Tracking"
        tableId="feature_tracking"
        tableIdNumeric={454}
        entries={features}
        columns={COLUMNS}
        viewOnly={true}
        enableExport={true}
        initialGroupByColumn="feature_chapter"
      />
    </div>
  )
}
