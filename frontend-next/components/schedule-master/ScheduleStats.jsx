import { CheckCircleIcon, ClockIcon, CalendarDaysIcon } from '@heroicons/react/24/outline'

export default function ScheduleStats({ matchedCount, unmatchedCount, totalCount }) {
  const matchPercentage = totalCount > 0 ? Math.round((matchedCount / totalCount) * 100) : 0

  return (
    <div className="bg-white dark:bg-gray-800 shadow sm:rounded-lg border border-gray-200 dark:border-gray-700">
      <div className="px-6 py-5">
        <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-4">
          Schedule Overview
        </h3>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-3 mb-6">
          {/* Total Tasks */}
          <div className="overflow-hidden rounded-lg bg-gray-50 dark:bg-gray-900/50 px-4 py-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <CalendarDaysIcon className="h-6 w-6 text-gray-400 dark:text-gray-500" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dt className="truncate text-sm font-medium text-gray-500 dark:text-gray-400">
                  Total Tasks
                </dt>
                <dd className="mt-1 text-3xl font-semibold text-gray-900 dark:text-white">
                  {totalCount}
                </dd>
              </div>
            </div>
          </div>

          {/* Matched Tasks */}
          <div className="overflow-hidden rounded-lg bg-green-50 dark:bg-green-900/20 px-4 py-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <CheckCircleIcon className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dt className="truncate text-sm font-medium text-green-700 dark:text-green-400">
                  Matched to POs
                </dt>
                <dd className="mt-1 text-3xl font-semibold text-green-900 dark:text-green-300">
                  {matchedCount}
                </dd>
              </div>
            </div>
          </div>

          {/* Unmatched Tasks */}
          <div className="overflow-hidden rounded-lg bg-yellow-50 dark:bg-yellow-900/20 px-4 py-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <ClockIcon className="h-6 w-6 text-yellow-600 dark:text-yellow-400" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dt className="truncate text-sm font-medium text-yellow-700 dark:text-yellow-400">
                  Unmatched
                </dt>
                <dd className="mt-1 text-3xl font-semibold text-yellow-900 dark:text-yellow-300">
                  {unmatchedCount}
                </dd>
              </div>
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Matching Progress
            </span>
            <span className="text-sm font-medium text-gray-900 dark:text-white">
              {matchPercentage}%
            </span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
            <div
              className="bg-indigo-600 dark:bg-indigo-500 h-2.5 rounded-full transition-all duration-300"
              style={{ width: `${matchPercentage}%` }}
            ></div>
          </div>
          <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
            {matchedCount} of {totalCount} tasks matched to purchase orders
            {matchedCount > 0 && (
              <span className="ml-1">
                - Gantt chart available below
              </span>
            )}
          </p>
        </div>
      </div>
    </div>
  )
}
