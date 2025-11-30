import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowPathIcon, ChevronDownIcon, ChevronRightIcon, ExclamationTriangleIcon, CheckCircleIcon, InformationCircleIcon } from '@heroicons/react/24/outline'
import { api } from '../../api'

/**
 * TableHealthWidget - Universal health check component for any table
 *
 * Dynamically loads health checks from the API based on the table's
 * registered health checks in the database.
 *
 * Props:
 * - foundationId: number - The foundation/table ID to load health checks for
 * - compact: boolean - Start collapsed (default: false)
 * - onIssueClick: function - Optional callback when clicking an issue item
 */
export default function TableHealthWidget({ foundationId, compact = false, onIssueClick }) {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [healthData, setHealthData] = useState(null)
  const [expanded, setExpanded] = useState(!compact)
  const [expandedCheck, setExpandedCheck] = useState(null)

  useEffect(() => {
    if (foundationId) {
      loadHealthData()
    }
  }, [foundationId])

  const loadHealthData = async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await api.get(`/api/v1/foundations/${foundationId}/health`)
      setHealthData(data)
    } catch (err) {
      console.error('Failed to load health data:', err)
      setError(err.message || 'Failed to load health data')
      setHealthData(null)
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

  const toggleCheckExpansion = (checkId) => {
    setExpandedCheck(expandedCheck === checkId ? null : checkId)
  }

  const handleItemClick = (item, check) => {
    if (onIssueClick) {
      onIssueClick(item, check)
      return
    }

    // Default navigation based on action_path
    if (check.action_path) {
      const path = check.action_path.replace(':id', item.id)
      navigate(path)
    }
  }

  // Don't render anything if no health checks exist for this table
  if (!loading && (!healthData || healthData.checks?.length === 0)) {
    return null
  }

  // Don't render if no issues (user doesn't need to see "everything is fine" constantly)
  if (!loading && healthData && !healthData.has_issues) {
    return null
  }

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex items-center justify-center py-2">
          <ArrowPathIcon className="h-5 w-5 animate-spin text-gray-400" />
          <span className="ml-2 text-sm text-gray-500">Checking data health...</span>
        </div>
      </div>
    )
  }

  if (error) {
    return null // Silently fail - don't block the page for health check errors
  }

  const overallColor = getHealthColor(healthData.overall_health)
  const checksWithIssues = healthData.checks?.filter(c => c.count > 0) || []

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
      {/* Header */}
      <div
        className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3">
          <div className={`flex items-center justify-center w-10 h-10 rounded-lg ${
            overallColor === 'green' ? 'bg-green-100 dark:bg-green-900/30' :
            overallColor === 'orange' ? 'bg-orange-100 dark:bg-orange-900/30' :
            'bg-red-100 dark:bg-red-900/30'
          }`}>
            {overallColor === 'green' ? (
              <CheckCircleIcon className="h-6 w-6 text-green-600 dark:text-green-400" />
            ) : (
              <ExclamationTriangleIcon className={`h-6 w-6 ${
                overallColor === 'orange' ? 'text-orange-600 dark:text-orange-400' : 'text-red-600 dark:text-red-400'
              }`} />
            )}
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
              Data Health
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {healthData.total_issues.toLocaleString()} issues found • Click to fix
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className={`text-2xl font-bold ${
            overallColor === 'green' ? 'text-green-600 dark:text-green-400' :
            overallColor === 'orange' ? 'text-orange-600 dark:text-orange-400' :
            'text-red-600 dark:text-red-400'
          }`}>
            {healthData.overall_health}%
          </span>
          <button
            onClick={(e) => {
              e.stopPropagation()
              loadHealthData()
            }}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
            title="Refresh"
          >
            <ArrowPathIcon className="h-4 w-4 text-gray-400" />
          </button>
          {expanded ? (
            <ChevronDownIcon className="h-5 w-5 text-gray-400" />
          ) : (
            <ChevronRightIcon className="h-5 w-5 text-gray-400" />
          )}
        </div>
      </div>

      {/* Expanded Details */}
      {expanded && (
        <div className="divide-y divide-gray-100 dark:divide-gray-700">
          {checksWithIssues.map((check) => {
            const color = getSeverityColor(check.severity)
            const isExpanded = expandedCheck === check.id
            const hasItems = check.count > 0

            return (
              <div key={check.id}>
                {/* Check Row */}
                <div
                  className={`px-4 py-3 flex items-center justify-between ${
                    hasItems ? 'cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50' : ''
                  }`}
                  onClick={() => hasItems && toggleCheckExpansion(check.id)}
                >
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    {hasItems && (
                      isExpanded ? (
                        <ChevronDownIcon className="h-4 w-4 text-gray-400 flex-shrink-0" />
                      ) : (
                        <ChevronRightIcon className="h-4 w-4 text-gray-400 flex-shrink-0" />
                      )
                    )}
                    {!hasItems && <div className="w-4 flex-shrink-0" />}
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                      color === 'green' ? 'bg-green-500' :
                      color === 'orange' ? 'bg-orange-500' :
                      color === 'red' ? 'bg-red-500' :
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
                      color === 'green' ? 'text-green-600 dark:text-green-400' :
                      color === 'orange' ? 'text-orange-600 dark:text-orange-400' :
                      color === 'red' ? 'text-red-600 dark:text-red-400' :
                      color === 'blue' ? 'text-blue-600 dark:text-blue-400' :
                      'text-gray-600 dark:text-gray-400'
                    }`}>
                      {check.count} {check.count === 1 ? 'issue' : 'issues'}
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
                {isExpanded && check.items?.length > 0 && (
                  <div className="bg-gray-50 dark:bg-gray-900/50 border-t border-gray-100 dark:border-gray-700">
                    <div className="max-h-64 overflow-y-auto">
                      <div className="divide-y divide-gray-100 dark:divide-gray-700">
                        {check.items.map((item, idx) => (
                          <div
                            key={item.id || idx}
                            className="px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer flex items-center justify-between"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleItemClick(item, check)
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
                          <div className="px-4 py-2 text-center text-xs text-gray-500 dark:text-gray-400">
                            + {check.count - check.items.length} more items
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )
          })}

          {/* Link to full health page */}
          <div className="px-4 py-2 text-center">
            <Link
              to="/system-health"
              className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline"
            >
              View all health checks →
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
