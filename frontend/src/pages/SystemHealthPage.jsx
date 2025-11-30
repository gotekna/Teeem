import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ArrowPathIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  TableCellsIcon,
  InformationCircleIcon
} from '@heroicons/react/24/outline'
import { api } from '../api'
import MergeContactsModal from '../components/contacts/MergeContactsModal'

/**
 * SystemHealthPage - Company-wide data health overview
 *
 * Shows all health checks across all tables in one unified view.
 * Allows users to see and fix data quality issues across the entire system.
 */
export default function SystemHealthPage() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [foundations, setFoundations] = useState([])
  const [healthData, setHealthData] = useState({})
  const [expandedFoundation, setExpandedFoundation] = useState(null)
  const [expandedCheck, setExpandedCheck] = useState(null)

  // Merge modal state
  const [showMergeModal, setShowMergeModal] = useState(false)
  const [selectedDuplicates, setSelectedDuplicates] = useState([])

  useEffect(() => {
    loadAllHealthData()
  }, [])

  const loadAllHealthData = async () => {
    try {
      setLoading(true)
      setError(null)

      // Get all foundations
      const foundationsResponse = await api.get('/api/v1/foundations')
      const allFoundations = foundationsResponse.foundations || []

      // Filter to foundations that might have health checks
      // (we'll load health for all and filter out empty ones)
      const foundationsWithData = allFoundations.filter(f => f.record_count > 0 || f.is_live)

      // Load health data for each foundation in parallel
      const healthPromises = foundationsWithData.map(async (foundation) => {
        try {
          const health = await api.get(`/api/v1/foundations/${foundation.id}/health`)
          return { foundationId: foundation.id, health }
        } catch (err) {
          // Silently skip foundations that fail
          return { foundationId: foundation.id, health: null }
        }
      })

      const healthResults = await Promise.all(healthPromises)

      // Build health data map, filtering to only those with issues
      const healthMap = {}
      healthResults.forEach(({ foundationId, health }) => {
        if (health && health.has_issues) {
          healthMap[foundationId] = health
        }
      })

      // Filter foundations to only those with health issues
      const foundationsWithIssues = foundationsWithData.filter(f => healthMap[f.id])

      setFoundations(foundationsWithIssues)
      setHealthData(healthMap)
    } catch (err) {
      console.error('Failed to load health data:', err)
      setError(err.message || 'Failed to load health data')
    } finally {
      setLoading(false)
    }
  }

  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'critical': return 'red'
      case 'warning': return 'orange'
      case 'info': return 'blue'
      default: return 'gray'
    }
  }

  const getHealthColor = (score) => {
    if (score === 100) return 'green'
    if (score >= 75) return 'orange'
    return 'red'
  }

  const toggleFoundationExpansion = (foundationId) => {
    setExpandedFoundation(expandedFoundation === foundationId ? null : foundationId)
    setExpandedCheck(null) // Reset check expansion when changing foundation
  }

  const toggleCheckExpansion = (checkId) => {
    setExpandedCheck(expandedCheck === checkId ? null : checkId)
  }

  const handleItemClick = (item, check, foundation) => {
    // Handle duplicate contacts specially - open merge modal
    if (check.check_type === 'duplicates' && item.contacts) {
      setSelectedDuplicates(item.contacts)
      setShowMergeModal(true)
      return
    }

    // Default navigation based on action_path
    if (check.action_path) {
      let path = check.action_path.replace(':id', item.id)
      // Handle company documents special case
      if (item.company_id) {
        path = path.replace(':company_id', item.company_id)
      }
      navigate(path)
    } else {
      // Fallback: navigate to the table with the record
      navigate(`/tables/${foundation.id}/${foundation.slug}`)
    }
  }

  const handleMergeContacts = async (targetId, sourceIds) => {
    try {
      await api.post('/api/v1/contacts/merge', {
        target_id: targetId,
        source_ids: sourceIds
      })
      // Refresh health data after merge
      await loadAllHealthData()
    } catch (err) {
      console.error('Failed to merge contacts:', err)
      throw err
    }
  }

  // Calculate overall stats
  const totalIssues = Object.values(healthData).reduce((sum, h) => sum + (h?.total_issues || 0), 0)
  const tablesWithIssues = Object.keys(healthData).length
  const criticalIssues = Object.values(healthData).reduce((sum, h) => {
    return sum + (h?.checks?.filter(c => c.severity === 'critical').reduce((s, c) => s + c.count, 0) || 0)
  }, 0)
  const warningIssues = Object.values(healthData).reduce((sum, h) => {
    return sum + (h?.checks?.filter(c => c.severity === 'warning').reduce((s, c) => s + c.count, 0) || 0)
  }, 0)

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-center py-12">
            <ArrowPathIcon className="h-8 w-8 animate-spin text-indigo-600" />
            <span className="ml-3 text-lg text-gray-600 dark:text-gray-400">Loading system health data...</span>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
        <div className="max-w-6xl mx-auto">
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <p className="text-red-700 dark:text-red-400">{error}</p>
            <button
              onClick={loadAllHealthData}
              className="mt-2 text-sm text-red-600 dark:text-red-400 hover:underline"
            >
              Try again
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">System Health</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Data quality overview across all tables
            </p>
          </div>
          <button
            onClick={loadAllHealthData}
            className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition"
          >
            <ArrowPathIcon className="h-4 w-4 text-gray-500" />
            <span className="text-sm text-gray-700 dark:text-gray-300">Refresh</span>
          </button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
            <div className="flex items-center gap-3">
              <div className={`flex items-center justify-center w-10 h-10 rounded-lg ${
                totalIssues === 0 ? 'bg-green-100 dark:bg-green-900/30' : 'bg-orange-100 dark:bg-orange-900/30'
              }`}>
                {totalIssues === 0 ? (
                  <CheckCircleIcon className="h-6 w-6 text-green-600 dark:text-green-400" />
                ) : (
                  <ExclamationTriangleIcon className="h-6 w-6 text-orange-600 dark:text-orange-400" />
                )}
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{totalIssues.toLocaleString()}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Total Issues</p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-indigo-100 dark:bg-indigo-900/30">
                <TableCellsIcon className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{tablesWithIssues}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Tables with Issues</p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-red-100 dark:bg-red-900/30">
                <ExclamationTriangleIcon className="h-6 w-6 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{criticalIssues.toLocaleString()}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Critical Issues</p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-orange-100 dark:bg-orange-900/30">
                <ExclamationTriangleIcon className="h-6 w-6 text-orange-600 dark:text-orange-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{warningIssues.toLocaleString()}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Warnings</p>
              </div>
            </div>
          </div>
        </div>

        {/* No Issues State */}
        {foundations.length === 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-8 text-center">
            <CheckCircleIcon className="h-12 w-12 text-green-500 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">All Clear!</h3>
            <p className="text-gray-500 dark:text-gray-400">
              No data quality issues found across your system.
            </p>
          </div>
        )}

        {/* Tables with Issues */}
        {foundations.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700">
            {foundations.map((foundation) => {
              const health = healthData[foundation.id]
              if (!health) return null

              const healthColor = getHealthColor(health.overall_health)
              const isExpanded = expandedFoundation === foundation.id
              const checksWithIssues = health.checks?.filter(c => c.count > 0) || []

              return (
                <div key={foundation.id}>
                  {/* Foundation Row */}
                  <div
                    className="px-4 py-4 flex items-center justify-between cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50"
                    onClick={() => toggleFoundationExpansion(foundation.id)}
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      {isExpanded ? (
                        <ChevronDownIcon className="h-5 w-5 text-gray-400 flex-shrink-0" />
                      ) : (
                        <ChevronRightIcon className="h-5 w-5 text-gray-400 flex-shrink-0" />
                      )}
                      <div className={`flex items-center justify-center w-10 h-10 rounded-lg ${
                        healthColor === 'green' ? 'bg-green-100 dark:bg-green-900/30' :
                        healthColor === 'orange' ? 'bg-orange-100 dark:bg-orange-900/30' :
                        'bg-red-100 dark:bg-red-900/30'
                      }`}>
                        {healthColor === 'green' ? (
                          <CheckCircleIcon className="h-5 w-5 text-green-600 dark:text-green-400" />
                        ) : (
                          <ExclamationTriangleIcon className={`h-5 w-5 ${
                            healthColor === 'orange' ? 'text-orange-600 dark:text-orange-400' : 'text-red-600 dark:text-red-400'
                          }`} />
                        )}
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-sm font-medium text-gray-900 dark:text-white truncate">
                          {foundation.name}
                        </h3>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {health.total_issues.toLocaleString()} issues • {checksWithIssues.length} check{checksWithIssues.length !== 1 ? 's' : ''} failing
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 flex-shrink-0">
                      <span className={`text-xl font-bold ${
                        healthColor === 'green' ? 'text-green-600 dark:text-green-400' :
                        healthColor === 'orange' ? 'text-orange-600 dark:text-orange-400' :
                        'text-red-600 dark:text-red-400'
                      }`}>
                        {health.overall_health}%
                      </span>
                      <Link
                        to={`/tables/${foundation.id}/${foundation.slug}`}
                        className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        View Table →
                      </Link>
                    </div>
                  </div>

                  {/* Expanded Checks */}
                  {isExpanded && (
                    <div className="bg-gray-50 dark:bg-gray-900/50 border-t border-gray-100 dark:border-gray-700">
                      {checksWithIssues.map((check) => {
                        const color = getSeverityColor(check.severity)
                        const isCheckExpanded = expandedCheck === check.id
                        const hasItems = check.items?.length > 0

                        return (
                          <div key={check.id}>
                            {/* Check Row */}
                            <div
                              className={`px-6 py-3 flex items-center justify-between ${
                                hasItems ? 'cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800' : ''
                              }`}
                              onClick={() => hasItems && toggleCheckExpansion(check.id)}
                            >
                              <div className="flex items-center gap-3 flex-1 min-w-0">
                                {hasItems && (
                                  isCheckExpanded ? (
                                    <ChevronDownIcon className="h-4 w-4 text-gray-400 flex-shrink-0" />
                                  ) : (
                                    <ChevronRightIcon className="h-4 w-4 text-gray-400 flex-shrink-0" />
                                  )
                                )}
                                {!hasItems && <div className="w-4 flex-shrink-0" />}
                                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                                  color === 'red' ? 'bg-red-500' :
                                  color === 'orange' ? 'bg-orange-500' :
                                  color === 'blue' ? 'bg-blue-500' :
                                  'bg-gray-500'
                                }`} />
                                <div className="min-w-0">
                                  <span className="text-sm text-gray-700 dark:text-gray-300 block truncate">
                                    {check.name}
                                  </span>
                                  {check.description && (
                                    <span className="text-xs text-gray-500 dark:text-gray-400 block truncate">
                                      {check.description}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                                <span className={`text-sm font-medium ${
                                  color === 'red' ? 'text-red-600 dark:text-red-400' :
                                  color === 'orange' ? 'text-orange-600 dark:text-orange-400' :
                                  color === 'blue' ? 'text-blue-600 dark:text-blue-400' :
                                  'text-gray-600 dark:text-gray-400'
                                }`}>
                                  {check.count.toLocaleString()} {check.count === 1 ? 'issue' : 'issues'}
                                </span>
                                <span className={`text-xs px-1.5 py-0.5 rounded uppercase font-medium ${
                                  color === 'red' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                                  color === 'orange' ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' :
                                  color === 'blue' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                                  'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400'
                                }`}>
                                  {check.severity}
                                </span>
                              </div>
                            </div>

                            {/* Expanded Items List */}
                            {isCheckExpanded && check.items?.length > 0 && (
                              <div className="bg-white dark:bg-gray-800 border-t border-gray-100 dark:border-gray-700">
                                <div className="max-h-64 overflow-y-auto">
                                  <div className="divide-y divide-gray-100 dark:divide-gray-700">
                                    {check.items.map((item, idx) => (
                                      <div
                                        key={item.id || idx}
                                        className="px-8 py-2 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer flex items-center justify-between"
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          handleItemClick(item, check, foundation)
                                        }}
                                      >
                                        <span className="text-sm text-gray-700 dark:text-gray-300 truncate">
                                          {item.display || item.item_name || `Item ${item.id}`}
                                        </span>
                                        <button
                                          className="ml-2 px-2 py-1 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded transition-colors flex-shrink-0"
                                        >
                                          Fix
                                        </button>
                                      </div>
                                    ))}
                                    {check.count > check.items.length && (
                                      <div className="px-8 py-2 text-center text-xs text-gray-500 dark:text-gray-400">
                                        + {(check.count - check.items.length).toLocaleString()} more items
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* Info Footer */}
        <div className="flex items-start gap-2 text-sm text-gray-500 dark:text-gray-400">
          <InformationCircleIcon className="h-5 w-5 flex-shrink-0 mt-0.5" />
          <p>
            Health checks run automatically when viewing tables. Issues are grouped by severity:
            <span className="text-red-600 dark:text-red-400 font-medium"> Critical</span> issues block functionality,
            <span className="text-orange-600 dark:text-orange-400 font-medium"> Warnings</span> should be addressed soon, and
            <span className="text-blue-600 dark:text-blue-400 font-medium"> Info</span> items are suggestions for improvement.
          </p>
        </div>
      </div>

      {/* Merge Contacts Modal */}
      <MergeContactsModal
        isOpen={showMergeModal}
        onClose={() => {
          setShowMergeModal(false)
          setSelectedDuplicates([])
        }}
        selectedContacts={selectedDuplicates}
        onMerge={handleMergeContacts}
      />
    </div>
  )
}
