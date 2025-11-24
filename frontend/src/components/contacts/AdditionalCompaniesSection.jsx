import { useNavigate } from 'react-router-dom'
import { BuildingOffice2Icon } from '@heroicons/react/24/outline'

export default function AdditionalCompaniesSection({ contact }) {
  const navigate = useNavigate()

  // Get additional companies from contact data
  const additionalCompanies = contact?.additional_companies || []

  if (additionalCompanies.length === 0) {
    return null
  }

  // Helper to format relationship type
  const formatRelationshipType = (type) => {
    return type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-6">
      <h2 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-2 mb-4">
        <BuildingOffice2Icon className="h-5 w-5" />
        Additional Companies & Trusts
        <span className="ml-2 inline-flex items-center px-2 py-0.5 text-xs font-medium rounded bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
          {additionalCompanies.length}
        </span>
      </h2>

      <div className="space-y-3">
        {additionalCompanies.map((company, idx) => (
          <div key={idx} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-900/30 transition-colors">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <button
                    onClick={() => navigate(`/contacts/${company.id}`)}
                    className="font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300"
                  >
                    {company.name}
                  </button>
                  <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-200">
                    {formatRelationshipType(company.relationship_type)}
                  </span>
                  {!company.is_active && (
                    <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                      Inactive
                    </span>
                  )}
                </div>

                <div className="space-y-1 ml-7">
                  {company.role_in_relationship && (
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-600 dark:text-gray-400">Role:</span>
                      <span className="text-sm font-medium text-gray-900 dark:text-white">
                        {company.role_in_relationship}
                      </span>
                    </div>
                  )}

                  {company.ownership_percentage && (
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-600 dark:text-gray-400">Ownership:</span>
                      <span className="inline-flex items-center px-2 py-0.5 text-sm font-medium rounded bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200">
                        {company.ownership_percentage}%
                      </span>
                    </div>
                  )}

                  {company.context && (
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-600 dark:text-gray-400">Context:</span>
                      <span className="text-sm text-gray-700 dark:text-gray-300">
                        {company.context}
                      </span>
                    </div>
                  )}

                  {(company.start_date || company.end_date) && (
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-600 dark:text-gray-400">Period:</span>
                      <span className="text-sm text-gray-700 dark:text-gray-300">
                        {company.start_date || 'N/A'} - {company.end_date || 'Present'}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
