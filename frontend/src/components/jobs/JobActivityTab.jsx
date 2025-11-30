import { useState, useEffect } from 'react'
import {
  ArrowPathIcon,
  PlusCircleIcon,
  PencilIcon,
  ArrowPathRoundedSquareIcon,
  UserPlusIcon,
  UserMinusIcon,
  DocumentTextIcon,
  BanknotesIcon,
  DocumentArrowUpIcon,
  EnvelopeIcon,
  ChatBubbleLeftIcon,
  InformationCircleIcon,
  ArrowTopRightOnSquareIcon,
} from '@heroicons/react/24/outline'
import { api } from '../../api'

// Icon mapping based on activity type
const getActivityIcon = (iconName) => {
  const icons = {
    'plus-circle': PlusCircleIcon,
    'pencil': PencilIcon,
    'arrow-path': ArrowPathRoundedSquareIcon,
    'user-plus': UserPlusIcon,
    'user-minus': UserMinusIcon,
    'document-text': DocumentTextIcon,
    'banknotes': BanknotesIcon,
    'document-arrow-up': DocumentArrowUpIcon,
    'arrow-path-rounded-square': ArrowPathRoundedSquareIcon,
    'envelope': EnvelopeIcon,
    'chat-bubble-left': ChatBubbleLeftIcon,
    'information-circle': InformationCircleIcon,
  }
  return icons[iconName] || InformationCircleIcon
}

// Color mapping
const getIconColorClasses = (color) => {
  const colors = {
    green: 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400',
    blue: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
    indigo: 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400',
    purple: 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400',
    red: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400',
    orange: 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400',
    emerald: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400',
    cyan: 'bg-cyan-100 text-cyan-600 dark:bg-cyan-900/30 dark:text-cyan-400',
    sky: 'bg-sky-100 text-sky-600 dark:bg-sky-900/30 dark:text-sky-400',
    gray: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
  }
  return colors[color] || colors.gray
}

export default function JobActivityTab({ jobId }) {
  const [activities, setActivities] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalCount, setTotalCount] = useState(0)

  useEffect(() => {
    if (jobId) {
      loadActivities()
    }
  }, [jobId, page])

  const loadActivities = async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await api.get(`/api/v1/jobs/${jobId}/activities`, {
        params: { page, per_page: 50 }
      })

      if (response.success) {
        setActivities(response.activities || [])
        setTotalPages(response.meta?.total_pages || 1)
        setTotalCount(response.meta?.total_count || 0)
      } else {
        setError(response.error || 'Failed to load activities')
      }
    } catch (err) {
      console.error('Failed to load activities:', err)
      setError('Failed to load activities')
    } finally {
      setLoading(false)
    }
  }

  const handleRefresh = () => {
    setPage(1)
    loadActivities()
  }

  if (loading && activities.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-6 text-center">
        <p className="text-red-700 dark:text-red-300">{error}</p>
        <button
          onClick={handleRefresh}
          className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
        >
          Retry
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Activity Timeline
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {totalCount} {totalCount === 1 ? 'activity' : 'activities'} recorded
          </p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
        >
          <ArrowPathIcon className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Activity Timeline */}
      {activities.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-12 text-center">
          <InformationCircleIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            No activities yet
          </h4>
          <p className="text-gray-500 dark:text-gray-400">
            Activities will be recorded here as changes are made to this job.
          </p>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="flow-root">
            <ul className="-mb-8 p-6">
              {activities.map((activity, idx) => {
                const Icon = getActivityIcon(activity.icon)
                const isLast = idx === activities.length - 1

                return (
                  <li key={activity.id}>
                    <div className="relative pb-8">
                      {/* Timeline line */}
                      {!isLast && (
                        <span
                          className="absolute left-5 top-10 -ml-px h-full w-0.5 bg-gray-200 dark:bg-gray-700"
                          aria-hidden="true"
                        />
                      )}

                      <div className="relative flex items-start space-x-4">
                        {/* Icon */}
                        <div className="relative">
                          <div className={`h-10 w-10 rounded-full flex items-center justify-center ring-8 ring-white dark:ring-gray-800 ${getIconColorClasses(activity.icon_color)}`}>
                            <Icon className="h-5 w-5" aria-hidden="true" />
                          </div>
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-4">
                            <div>
                              <p className="text-sm font-medium text-gray-900 dark:text-white">
                                {activity.description}
                              </p>
                              <div className="mt-1 flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                                <span>{activity.performed_by}</span>
                                <span className="text-gray-300 dark:text-gray-600">•</span>
                                <span title={new Date(activity.occurred_at).toLocaleString()}>
                                  {activity.time_ago}
                                </span>
                              </div>
                            </div>

                            {/* Related URL link (e.g., PO PDF) */}
                            {activity.related_url && (
                              <a
                                href={activity.related_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors"
                              >
                                <ArrowTopRightOnSquareIcon className="h-3.5 w-3.5" />
                                View Document
                              </a>
                            )}
                          </div>

                          {/* Metadata details */}
                          {activity.metadata && Object.keys(activity.metadata).length > 0 && (
                            <div className="mt-2">
                              {activity.activity_type === 'status_changed' && activity.metadata.old_status && (
                                <div className="flex items-center gap-2 text-xs">
                                  <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded">
                                    {activity.metadata.old_status}
                                  </span>
                                  <ArrowPathIcon className="h-3 w-3 text-gray-400" />
                                  <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded">
                                    {activity.metadata.new_status}
                                  </span>
                                </div>
                              )}

                              {activity.activity_type === 'stage_changed' && (
                                <div className="flex items-center gap-2 text-xs">
                                  <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded">
                                    {activity.metadata.old_stage || 'None'}
                                  </span>
                                  <ArrowPathIcon className="h-3 w-3 text-gray-400" />
                                  <span className="px-2 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded">
                                    {activity.metadata.new_stage}
                                  </span>
                                </div>
                              )}

                              {(activity.activity_type === 'purchase_order_created' || activity.activity_type === 'purchase_order_sent') && activity.metadata.supplier_name && (
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                  Supplier: {activity.metadata.supplier_name}
                                </p>
                              )}

                              {(activity.activity_type === 'invoice_received' || activity.activity_type === 'bill_received') && activity.metadata.contact_name && (
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                  From: {activity.metadata.contact_name}
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Page {page} of {totalPages}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1 || loading}
                  className="px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages || loading}
                  className="px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
