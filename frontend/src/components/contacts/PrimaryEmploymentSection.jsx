import { useNavigate } from 'react-router-dom'
import { BriefcaseIcon, BuildingOfficeIcon } from '@heroicons/react/24/outline'

export default function PrimaryEmploymentSection({ contact }) {
  const navigate = useNavigate()

  // Get primary company from contact data
  const primaryCompany = contact?.primary_company

  if (!primaryCompany) {
    return null
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-6">
      <h2 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-2 mb-4">
        <BriefcaseIcon className="h-5 w-5" />
        Primary Employment
      </h2>

      <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-gray-50 dark:bg-gray-900/30">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <BuildingOfficeIcon className="h-5 w-5 text-gray-400" />
              <button
                onClick={() => navigate(`/contacts/${primaryCompany.id}`)}
                className="text-lg font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300"
              >
                {primaryCompany.name}
              </button>
            </div>

            <div className="ml-7 space-y-2">
              {contact.primary_role && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Role:</span>
                  <span className="inline-flex items-center px-2 py-0.5 text-sm font-medium rounded bg-indigo-100 dark:bg-indigo-900/30 text-indigo-800 dark:text-indigo-200">
                    {contact.primary_role}
                  </span>
                </div>
              )}

              {contact.employment_status && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Status:</span>
                  <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded ${
                    contact.employment_status === 'active'
                      ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200'
                      : contact.employment_status === 'contractor'
                      ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                  }`}>
                    {contact.employment_status}
                  </span>
                </div>
              )}

              {primaryCompany.contact_types && primaryCompany.contact_types.length > 0 && (
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Company Type:</span>
                  {primaryCompany.contact_types.map((type, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
                    >
                      {type}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
