import { useState, useEffect } from 'react'
import { PlusIcon, ChevronDownIcon, ChevronRightIcon, ArrowDownTrayIcon } from '@heroicons/react/24/outline'
import TrapidTableView from '../documentation/TrapidTableView'
import { api } from '../../api'

const COLUMNS = [
  {
    key: 'select',
    label: '',
    resizable: false,
    sortable: false,
    filterable: false,
    width: 32
  },
  {
    key: 'chapter',
    label: 'Chapter',
    resizable: true,
    sortable: true,
    filterable: true,
    filterType: 'dropdown',
    width: 250,
    tooltip: 'Feature chapter/category'
  },
  {
    key: 'feature_name',
    label: 'Feature',
    resizable: true,
    sortable: true,
    filterable: true,
    filterType: 'text',
    width: 250,
    tooltip: 'Feature name'
  },
  {
    key: 'detail_point_1',
    label: 'Detail 1',
    resizable: true,
    sortable: false,
    filterable: false,
    width: 200,
    tooltip: 'First detail point'
  },
  {
    key: 'detail_point_2',
    label: 'Detail 2',
    resizable: true,
    sortable: false,
    filterable: false,
    width: 200,
    tooltip: 'Second detail point'
  },
  {
    key: 'detail_point_3',
    label: 'Detail 3',
    resizable: true,
    sortable: false,
    filterable: false,
    width: 200,
    tooltip: 'Third detail point'
  },
  {
    key: 'system_complete',
    label: 'System Complete',
    resizable: true,
    sortable: true,
    filterable: true,
    filterType: 'dropdown',
    width: 140,
    tooltip: 'Feature completed by the system'
  },
  {
    key: 'dev_checked',
    label: 'Dev Checked',
    resizable: true,
    sortable: true,
    filterable: true,
    filterType: 'dropdown',
    width: 120,
    tooltip: 'Developer has checked and is happy'
  },
  {
    key: 'tester_checked',
    label: 'Tester Happy',
    resizable: true,
    sortable: true,
    filterable: true,
    filterType: 'dropdown',
    width: 120,
    tooltip: 'Tester has verified and approved'
  },
  {
    key: 'user_checked',
    label: 'User Happy',
    resizable: true,
    sortable: true,
    filterable: true,
    filterType: 'dropdown',
    width: 120,
    tooltip: 'End user has tested and approved'
  },
  {
    key: 'completion_percentage',
    label: 'Progress',
    resizable: true,
    sortable: true,
    width: 100,
    tooltip: 'Overall completion percentage',
    isComputed: true,
    computeFunction: (entry) => `${entry.completion_percentage}%`
  }
]

export default function FeaturesTrackingTable() {
  const [features, setFeatures] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [stats, setStats] = useState(null)
  const [expandedChapters, setExpandedChapters] = useState({})
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    console.log('🚀 FeaturesTrackingTable mounted - loading features')
    loadFeatures()
  }, [])

  const toggleChapter = (chapter) => {
    setExpandedChapters(prev => ({
      ...prev,
      [chapter]: !prev[chapter]
    }))
  }

  const expandAll = () => {
    const allChapters = {}
    features.forEach(f => {
      allChapters[f.chapter] = true
    })
    setExpandedChapters(allChapters)
  }

  const collapseAll = () => {
    setExpandedChapters({})
  }

  const exportToExcel = () => {
    // Create CSV content with proper Excel formatting
    const headers = [
      'Chapter',
      'Feature Name',
      'Detail Point 1',
      'Detail Point 2',
      'Detail Point 3',
      'Dev Progress %',
      'System Complete',
      'Dev Checked',
      'Tester Happy',
      'UI Checked',
      'User Happy',
      'Trapid',
      'BuilderTrend',
      'BuildExact',
      'Jacks',
      'Wunderbuilt',
      'DataBuild',
      'Simpro',
      'SmarterBuild',
      'ClickHome',
      'ClickUp'
    ]

    const rows = features.map(feature => [
      feature.chapter,
      feature.feature_name,
      feature.detail_point_1 || '',
      feature.detail_point_2 || '',
      feature.detail_point_3 || '',
      feature.dev_progress || 0,
      feature.system_complete ? 'Yes' : 'No',
      feature.dev_checked ? 'Yes' : 'No',
      feature.tester_checked ? 'Yes' : 'No',
      feature.ui_checked ? 'Yes' : 'No',
      feature.user_checked ? 'Yes' : 'No',
      feature.trapid_has ? 'Yes' : 'No',
      feature.buildertrend_has ? 'Yes' : 'No',
      feature.buildexact_has ? 'Yes' : 'No',
      feature.jacks_has ? 'Yes' : 'No',
      feature.wunderbuilt_has ? 'Yes' : 'No',
      feature.databuild_has ? 'Yes' : 'No',
      feature.simpro_has ? 'Yes' : 'No',
      feature.smarterbuild_has ? 'Yes' : 'No',
      feature.clickhome_has ? 'Yes' : 'No',
      feature.clickup_has ? 'Yes' : 'No'
    ])

    // Create CSV string with proper escaping
    const csvContent = [
      headers.map(h => `"${h}"`).join(','),
      ...rows.map(row => row.map(cell => {
        // Escape quotes and wrap in quotes
        const escaped = String(cell).replace(/"/g, '""')
        return `"${escaped}"`
      }).join(','))
    ].join('\n')

    // Add BOM for Excel UTF-8 support
    const BOM = '\uFEFF'
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' })

    // Create download link
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `trapid-features-tracking-${new Date().toISOString().split('T')[0]}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  // Filter features based on search query (MUST come before featuresByChapter)
  const filteredFeatures = searchQuery.trim() === ''
    ? features
    : features.filter(feature => {
        const query = searchQuery.toLowerCase()
        return (
          feature.feature_name?.toLowerCase().includes(query) ||
          feature.chapter?.toLowerCase().includes(query) ||
          feature.detail_point_1?.toLowerCase().includes(query) ||
          feature.detail_point_2?.toLowerCase().includes(query) ||
          feature.detail_point_3?.toLowerCase().includes(query)
        )
      })

  // Group features by chapter (using filtered features for search)
  const featuresByChapter = filteredFeatures.reduce((acc, feature) => {
    if (!acc[feature.chapter]) {
      acc[feature.chapter] = []
    }
    acc[feature.chapter].push(feature)
    return acc
  }, {})

  const loadFeatures = async () => {
    try {
      setLoading(true)
      console.log('📡 Calling API: /api/v1/feature_trackers')
      const response = await api.get('/api/v1/feature_trackers')
      console.log('📦 API Response received:', {
        success: response.success,
        featureCount: response.feature_trackers?.length,
        statsTotal: response.stats?.total
      })

      if (response.success) {
        setFeatures(response.feature_trackers)
        setStats(response.stats)
        console.log('✅ Features state updated with', response.feature_trackers.length, 'features')
      } else {
        console.error('❌ API returned success=false')
        setError('Failed to load features')
      }
    } catch (err) {
      console.error('❌ Error loading features:', err)
      setError(err.message || 'Failed to load features')
    } finally {
      setLoading(false)
      console.log('⏹️ Loading complete')
    }
  }

  const handleEdit = async (entry) => {
    try {
      const response = await api.put(`/api/v1/feature_trackers/${entry.id}`, {
        feature_tracker: {
          chapter: entry.chapter,
          feature_name: entry.feature_name,
          detail_point_1: entry.detail_point_1,
          detail_point_2: entry.detail_point_2,
          detail_point_3: entry.detail_point_3,
          system_complete: entry.system_complete,
          dev_progress: entry.dev_progress,
          dev_checked: entry.dev_checked,
          tester_checked: entry.tester_checked,
          ui_checked: entry.ui_checked,
          user_checked: entry.user_checked,
          sort_order: entry.sort_order,
          trapid_has: entry.trapid_has,
          buildertrend_has: entry.buildertrend_has,
          buildexact_has: entry.buildexact_has,
          jacks_has: entry.jacks_has,
          wunderbuilt_has: entry.wunderbuilt_has,
          databuild_has: entry.databuild_has,
          simpro_has: entry.simpro_has,
          smarterbuild_has: entry.smarterbuild_has,
          clickhome_has: entry.clickhome_has,
          clickup_has: entry.clickup_has
        }
      })

      if (response.success) {
        setFeatures(prev => prev.map(item =>
          item.id === entry.id ? response.feature_tracker : item
        ))
        // Reload to get updated stats
        loadFeatures()
      } else {
        alert('Failed to update feature: ' + (response.errors?.join(', ') || 'Unknown error'))
      }
    } catch (err) {
      console.error('Error updating feature:', err)
      alert('Failed to update feature: ' + err.message)
    }
  }

  const handleDelete = async (entry) => {
    if (!confirm(`Are you sure you want to delete "${entry.feature_name}"?`)) {
      return
    }

    try {
      const response = await api.delete(`/api/v1/feature_trackers/${entry.id}`)

      if (response.success) {
        setFeatures(prev => prev.filter(item => item.id !== entry.id))
        loadFeatures() // Reload to get updated stats
      } else {
        alert('Failed to delete feature: ' + (response.error || 'Unknown error'))
      }
    } catch (err) {
      console.error('Error deleting feature:', err)
      alert('Failed to delete feature: ' + err.message)
    }
  }

  const handleAddNew = async () => {
    const chapter = prompt('Enter chapter name (e.g., "1. PROJECT MANAGEMENT"):')
    if (!chapter) return

    const featureName = prompt('Enter feature name:')
    if (!featureName) return

    try {
      const response = await api.post('/api/v1/feature_trackers', {
        feature_tracker: {
          chapter: chapter,
          feature_name: featureName,
          detail_point_1: '',
          detail_point_2: '',
          detail_point_3: '',
          system_complete: false,
          dev_progress: 0,
          dev_checked: false,
          tester_checked: false,
          ui_checked: false,
          user_checked: false,
          sort_order: features.length * 10 + 10
        }
      })

      if (response.success) {
        setFeatures(prev => [...prev, response.feature_tracker])
        loadFeatures() // Reload to get updated stats
      } else {
        alert('Failed to create feature: ' + (response.errors?.join(', ') || 'Unknown error'))
      }
    } catch (err) {
      console.error('Error creating feature:', err)
      alert('Failed to create feature: ' + err.message)
    }
  }

  const handleExport = () => {
    // Convert features to CSV
    const headers = ['Chapter', 'Feature', 'Detail 1', 'Detail 2', 'Detail 3',
                     'System Complete', 'Dev Checked', 'Tester Happy', 'User Happy', 'Progress']
    const rows = features.map(f => [
      f.chapter,
      f.feature_name,
      f.detail_point_1 || '',
      f.detail_point_2 || '',
      f.detail_point_3 || '',
      f.system_complete ? 'Yes' : 'No',
      f.dev_checked ? 'Yes' : 'No',
      f.tester_checked ? 'Yes' : 'No',
      f.user_checked ? 'Yes' : 'No',
      `${f.completion_percentage}%`
    ])

    const csv = [headers, ...rows]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n')

    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `trapid-features-tracking-${new Date().toISOString().split('T')[0]}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
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

  // Calculate competitor coverage percentages
  const totalFeatures = filteredFeatures.length
  const competitorCoverage = {
    trapid: totalFeatures > 0 ? Math.round((filteredFeatures.filter(f => f.trapid_has).length / totalFeatures) * 100) : 0,
    buildertrend: totalFeatures > 0 ? Math.round((filteredFeatures.filter(f => f.buildertrend_has).length / totalFeatures) * 100) : 0,
    buildexact: totalFeatures > 0 ? Math.round((filteredFeatures.filter(f => f.buildexact_has).length / totalFeatures) * 100) : 0,
    jacks: totalFeatures > 0 ? Math.round((filteredFeatures.filter(f => f.jacks_has).length / totalFeatures) * 100) : 0,
    wunderbuilt: totalFeatures > 0 ? Math.round((filteredFeatures.filter(f => f.wunderbuilt_has).length / totalFeatures) * 100) : 0,
    databuild: totalFeatures > 0 ? Math.round((filteredFeatures.filter(f => f.databuild_has).length / totalFeatures) * 100) : 0,
    simpro: totalFeatures > 0 ? Math.round((filteredFeatures.filter(f => f.simpro_has).length / totalFeatures) * 100) : 0,
    smarterbuild: totalFeatures > 0 ? Math.round((filteredFeatures.filter(f => f.smarterbuild_has).length / totalFeatures) * 100) : 0,
    clickhome: totalFeatures > 0 ? Math.round((filteredFeatures.filter(f => f.clickhome_has).length / totalFeatures) * 100) : 0,
    clickup: totalFeatures > 0 ? Math.round((filteredFeatures.filter(f => f.clickup_has).length / totalFeatures) * 100) : 0
  }

  // Create sorted array of competitors by coverage percentage (highest first)
  const sortedCompetitors = [
    { key: 'trapid', name: 'Trapid', field: 'trapid_has', coverage: competitorCoverage.trapid, isTrapid: true },
    { key: 'buildertrend', name: 'BuilderTrend', field: 'buildertrend_has', coverage: competitorCoverage.buildertrend, isTrapid: false },
    { key: 'buildexact', name: 'BuildExact', field: 'buildexact_has', coverage: competitorCoverage.buildexact, isTrapid: false },
    { key: 'jacks', name: 'Jacks', field: 'jacks_has', coverage: competitorCoverage.jacks, isTrapid: false },
    { key: 'wunderbuilt', name: 'Wunderbuilt', field: 'wunderbuilt_has', coverage: competitorCoverage.wunderbuilt, isTrapid: false },
    { key: 'databuild', name: 'DataBuild', field: 'databuild_has', coverage: competitorCoverage.databuild, isTrapid: false },
    { key: 'simpro', name: 'Simpro', field: 'simpro_has', coverage: competitorCoverage.simpro, isTrapid: false },
    { key: 'smarterbuild', name: 'SmarterBuild', field: 'smarterbuild_has', coverage: competitorCoverage.smarterbuild, isTrapid: false },
    { key: 'clickhome', name: 'ClickHome', field: 'clickhome_has', coverage: competitorCoverage.clickhome, isTrapid: false },
    { key: 'clickup', name: 'ClickUp', field: 'clickup_has', coverage: competitorCoverage.clickup, isTrapid: false }
  ].sort((a, b) => b.coverage - a.coverage)

  return (
    <div>
      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3 mb-6">
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Total Features</div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">{stats.total}</div>
          </div>
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800 p-4">
            <div className="text-xs text-blue-600 dark:text-blue-400 mb-1">System Complete</div>
            <div className="text-2xl font-bold text-blue-900 dark:text-blue-100">{stats.system_complete}</div>
          </div>
          <div className="bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800 p-4">
            <div className="text-xs text-green-600 dark:text-green-400 mb-1">Dev Checked</div>
            <div className="text-2xl font-bold text-green-900 dark:text-green-100">{stats.dev_checked}</div>
          </div>
          <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800 p-4">
            <div className="text-xs text-yellow-600 dark:text-yellow-400 mb-1">Tester Happy</div>
            <div className="text-2xl font-bold text-yellow-900 dark:text-yellow-100">{stats.tester_checked}</div>
          </div>
          <div className="bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-200 dark:border-orange-800 p-4">
            <div className="text-xs text-orange-600 dark:text-orange-400 mb-1">UI Checked</div>
            <div className="text-2xl font-bold text-orange-900 dark:text-orange-100">{stats.ui_checked}</div>
          </div>
          <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800 p-4">
            <div className="text-xs text-purple-600 dark:text-purple-400 mb-1">User Happy</div>
            <div className="text-2xl font-bold text-purple-900 dark:text-purple-100">{stats.user_checked}</div>
          </div>
          <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-lg border border-indigo-200 dark:border-indigo-800 p-4">
            <div className="text-xs text-indigo-600 dark:text-indigo-400 mb-1">Fully Complete</div>
            <div className="text-2xl font-bold text-indigo-900 dark:text-indigo-100">{stats.fully_complete}</div>
          </div>
        </div>
      )}

      {/* Table */}
      {features.length === 0 ? (
        <div className="text-center py-8 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <p className="text-gray-600 dark:text-gray-400">No features found</p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Search and Controls */}
          <div className="flex flex-col sm:flex-row gap-3 justify-between items-start sm:items-center">
            {/* Search Input */}
            <div className="relative flex-1 max-w-md">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search features, chapters, details..."
                className="w-full px-4 py-2 pl-10 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <svg className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>

            {/* Expand/Collapse All Controls */}
            <div className="flex gap-2">
              <button
                onClick={exportToExcel}
                className="inline-flex items-center gap-2 px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition shadow-sm"
              >
                <ArrowDownTrayIcon className="h-4 w-4" />
                Export to Excel
              </button>
              <button
                onClick={expandAll}
                className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
              >
                Expand All
              </button>
              <button
                onClick={collapseAll}
                className="px-3 py-1.5 text-sm bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition"
              >
                Collapse All
              </button>
            </div>
          </div>

          {/* Chapter Accordion */}
          <div className="space-y-2">
            {Object.entries(featuresByChapter)
              .sort(([a], [b]) => {
                // Extract chapter number from strings like "1. PRE-CONSTRUCTION" or "10. QUALITY"
                const numA = parseInt(a.match(/^\d+/)?.[0] || '999')
                const numB = parseInt(b.match(/^\d+/)?.[0] || '999')
                return numA - numB
              })
              .map(([chapter, chapterFeatures]) => {
              const isExpanded = expandedChapters[chapter]
              const chapterStats = {
                total: chapterFeatures.length,
                systemComplete: chapterFeatures.filter(f => f.system_complete).length,
                devChecked: chapterFeatures.filter(f => f.dev_checked).length,
                testerChecked: chapterFeatures.filter(f => f.tester_checked).length,
                uiChecked: chapterFeatures.filter(f => f.ui_checked).length,
                userChecked: chapterFeatures.filter(f => f.user_checked).length,
                fullyComplete: chapterFeatures.filter(f =>
                  f.system_complete && f.dev_checked && f.tester_checked && f.ui_checked && f.user_checked
                ).length
              }

              // Calculate average progress percentage for chapter
              const avgProgress = chapterFeatures.length > 0
                ? Math.round(chapterFeatures.reduce((sum, f) => sum + (f.dev_progress || 0), 0) / chapterFeatures.length)
                : 0

              return (
                <div key={chapter} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                  {/* Chapter Header */}
                  <button
                    onClick={() => toggleChapter(chapter)}
                    className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-750 transition"
                  >
                    <div className="flex items-center gap-3">
                      {isExpanded ? (
                        <ChevronDownIcon className="h-5 w-5 text-gray-500 dark:text-gray-400" />
                      ) : (
                        <ChevronRightIcon className="h-5 w-5 text-gray-500 dark:text-gray-400" />
                      )}
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white text-left">
                        {chapter} <span className="text-blue-600 dark:text-blue-400">({avgProgress}%)</span>
                      </h3>
                      <span className="text-sm text-gray-500 dark:text-gray-400">
                        ({chapterFeatures.length} features)
                      </span>
                    </div>

                    {/* Chapter Progress Stats */}
                    <div className="flex items-center gap-4">
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        <span className="font-medium">{chapterStats.fullyComplete}</span> / {chapterStats.total} complete
                      </div>
                      <div className="flex gap-2">
                        <div className="flex items-center gap-1">
                          <div className={`w-2 h-2 rounded-full ${chapterStats.systemComplete === chapterStats.total ? 'bg-green-500' : 'bg-gray-300'}`} />
                          <span className="text-xs text-gray-500">Sys</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <div className={`w-2 h-2 rounded-full ${chapterStats.devChecked === chapterStats.total ? 'bg-green-500' : 'bg-gray-300'}`} />
                          <span className="text-xs text-gray-500">Dev</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <div className={`w-2 h-2 rounded-full ${chapterStats.testerChecked === chapterStats.total ? 'bg-green-500' : 'bg-gray-300'}`} />
                          <span className="text-xs text-gray-500">Test</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <div className={`w-2 h-2 rounded-full ${chapterStats.uiChecked === chapterStats.total ? 'bg-green-500' : 'bg-gray-300'}`} />
                          <span className="text-xs text-gray-500">UI</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <div className={`w-2 h-2 rounded-full ${chapterStats.userChecked === chapterStats.total ? 'bg-green-500' : 'bg-gray-300'}`} />
                          <span className="text-xs text-gray-500">User</span>
                        </div>
                      </div>
                    </div>
                  </button>

                  {/* Chapter Features Table */}
                  {isExpanded && (
                    <div className="border-t border-gray-200 dark:border-gray-700">
                      <div className="overflow-x-auto overflow-y-auto max-h-[600px]" style={{
                        scrollbarWidth: 'thin',
                        scrollbarColor: '#CBD5E0 #F7FAFC'
                      }}>
                        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                          <thead className="bg-gray-50 dark:bg-gray-900">
                            <tr>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Feature</th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Detail 1</th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Detail 2</th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Detail 3</th>
                              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Progress</th>
                              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">System</th>
                              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Dev</th>
                              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Tester</th>
                              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">UI</th>
                              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">User</th>
                              {sortedCompetitors.map((competitor, index) => (
                                <th
                                  key={competitor.key}
                                  className={`px-3 py-3 text-center text-xs font-medium uppercase ${
                                    competitor.isTrapid
                                      ? 'text-blue-600 dark:text-blue-400 font-bold'
                                      : 'text-gray-500 dark:text-gray-400'
                                  }`}
                                >
                                  <div className="flex items-center justify-center gap-1">
                                    <span className={`text-xs font-bold ${
                                      competitor.isTrapid
                                        ? 'text-blue-500 dark:text-blue-400'
                                        : 'text-gray-400 dark:text-gray-500'
                                    }`}>#{index + 1}</span>
                                    <span>{competitor.name}</span>
                                  </div>
                                  <div className={`font-normal ${
                                    competitor.isTrapid
                                      ? 'text-blue-500 dark:text-blue-400'
                                      : 'text-gray-400 dark:text-gray-500'
                                  }`}>({competitor.coverage}%)</div>
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                            {chapterFeatures.map((feature) => (
                              <tr key={feature.id} className="hover:bg-gray-50 dark:hover:bg-gray-750">
                                <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-gray-100">{feature.feature_name}</td>
                                <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">{feature.detail_point_1}</td>
                                <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">{feature.detail_point_2}</td>
                                <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">{feature.detail_point_3}</td>
                                <td className="px-4 py-4 text-center">
                                  <div className="flex items-center justify-center gap-2">
                                    <input
                                      type="number"
                                      min="0"
                                      max="100"
                                      value={feature.dev_progress || 0}
                                      onChange={(e) => {
                                        const value = Math.min(100, Math.max(0, parseInt(e.target.value) || 0))
                                        handleEdit({ ...feature, dev_progress: value })
                                      }}
                                      className="w-14 px-2 py-1 text-center text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                                    />
                                    <span className="text-xs text-gray-500">%</span>
                                  </div>
                                </td>
                                <td className="px-4 py-4 text-center">
                                  <input
                                    type="checkbox"
                                    checked={feature.system_complete}
                                    onChange={(e) => handleEdit({ ...feature, system_complete: e.target.checked })}
                                    className="rounded border-gray-300 dark:border-gray-600 cursor-pointer"
                                  />
                                </td>
                                <td className="px-4 py-4 text-center">
                                  <input
                                    type="checkbox"
                                    checked={feature.dev_checked}
                                    onChange={(e) => handleEdit({ ...feature, dev_checked: e.target.checked })}
                                    className="rounded border-gray-300 dark:border-gray-600 cursor-pointer"
                                  />
                                </td>
                                <td className="px-4 py-4 text-center">
                                  <input
                                    type="checkbox"
                                    checked={feature.tester_checked}
                                    onChange={(e) => handleEdit({ ...feature, tester_checked: e.target.checked })}
                                    className="rounded border-gray-300 dark:border-gray-600 cursor-pointer"
                                  />
                                </td>
                                <td className="px-4 py-4 text-center">
                                  <input
                                    type="checkbox"
                                    checked={feature.ui_checked}
                                    onChange={(e) => handleEdit({ ...feature, ui_checked: e.target.checked })}
                                    className="rounded border-gray-300 dark:border-gray-600 cursor-pointer"
                                  />
                                </td>
                                <td className="px-4 py-4 text-center">
                                  <input
                                    type="checkbox"
                                    checked={feature.user_checked}
                                    onChange={(e) => handleEdit({ ...feature, user_checked: e.target.checked })}
                                    className="rounded border-gray-300 dark:border-gray-600 cursor-pointer"
                                  />
                                </td>
                                {sortedCompetitors.map((competitor) => (
                                  <td
                                    key={competitor.key}
                                    className={`px-3 py-4 text-center ${
                                      competitor.isTrapid ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                                    }`}
                                  >
                                    <button
                                      onClick={() => handleEdit({ ...feature, [competitor.field]: !feature[competitor.field] })}
                                      className="text-2xl cursor-pointer hover:scale-110 transition-transform"
                                    >
                                      {feature[competitor.field] ? '✅' : '❌'}
                                    </button>
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
