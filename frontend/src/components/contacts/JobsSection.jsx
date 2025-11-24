import { useNavigate } from 'react-router-dom'
import { WrenchScrewdriverIcon, MapPinIcon, FlagIcon } from '@heroicons/react/24/outline'

export default function JobsSection({ contact }) {
  const navigate = useNavigate()

  // Get jobs from contact data
  const jobs = contact?.jobs || []

  if (jobs.length === 0) {
    return null
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-6">
      <h2 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-2 mb-4">
        <WrenchScrewdriverIcon className="h-5 w-5" />
        Jobs & Constructions
        <span className="ml-2 inline-flex items-center px-2 py-0.5 text-xs font-medium rounded bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
          {jobs.length}
        </span>
      </h2>

      <div className="space-y-3">
        {jobs.map((job, idx) => (
          <div key={idx} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-900/30 transition-colors">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <button
                    onClick={() => navigate(`/constructions/${job.construction_id}`)}
                    className="font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300"
                  >
                    {job.construction_title || `Job #${job.construction_id}`}
                  </button>
                  {job.primary && (
                    <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200">
                      Primary Contact
                    </span>
                  )}
                </div>

                <div className="space-y-1">
                  {job.location && (
                    <div className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-400">
                      <MapPinIcon className="h-4 w-4" />
                      {job.location}
                    </div>
                  )}

                  {job.role && (
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-600 dark:text-gray-400">Role:</span>
                      <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded bg-indigo-100 dark:bg-indigo-900/30 text-indigo-800 dark:text-indigo-200">
                        {job.role.replace(/_/g, ' ')}
                      </span>
                    </div>
                  )}

                  <div className="flex items-center gap-2 flex-wrap">
                    {job.status && (
                      <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded ${
                        job.status === 'Active'
                          ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                      }`}>
                        {job.status}
                      </span>
                    )}
                    {job.stage && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200">
                        <FlagIcon className="h-3 w-3" />
                        {job.stage}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
