import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  UserGroupIcon,
  MagnifyingGlassIcon,
  EnvelopeIcon,
  PhoneIcon,
  BuildingOfficeIcon,
  CheckCircleIcon,
  ExclamationCircleIcon
} from '@heroicons/react/24/outline'
import { CheckCircleIcon as CheckCircleSolid } from '@heroicons/react/24/solid'
import api from '../api'

// Calculate director compliance score
const calculateDirectorCompliance = (director) => {
  const requiredFields = [
    { field: 'director_id', label: 'Director ID' },
    { field: 'date_of_birth', label: 'Date of Birth' },
    { field: 'residential_address', label: 'Residential Address' },
    { field: 'drivers_licence', label: 'Drivers Licence' },
  ]

  const optionalFields = [
    { field: 'passport_number', label: 'Passport' },
    { field: 'photo_url', label: 'Photo' },
    { field: 'place_of_birth', label: 'Place of Birth' },
  ]

  const filledRequired = requiredFields.filter(f => director[f.field]).length
  const filledOptional = optionalFields.filter(f => director[f.field]).length

  const requiredScore = (filledRequired / requiredFields.length) * 100
  const totalFilled = filledRequired + filledOptional
  const totalFields = requiredFields.length + optionalFields.length

  return {
    requiredScore,
    totalScore: Math.round((totalFilled / totalFields) * 100),
    filledRequired,
    totalRequired: requiredFields.length,
    missingRequired: requiredFields.filter(f => !director[f.field]).map(f => f.label),
    isFullyCompliant: filledRequired === requiredFields.length
  }
}

export default function DirectorsRegistryPage() {
  const navigate = useNavigate()
  const [directors, setDirectors] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    loadDirectors()
  }, [])

  const loadDirectors = async () => {
    try {
      setLoading(true)
      const response = await api.get('/api/v1/contacts', {
        params: { is_director: true }
      })
      setDirectors(response.contacts || [])
    } catch (error) {
      console.error('Failed to load directors:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = (e) => {
    e.preventDefault()
    loadDirectors()
  }

  const filteredDirectors = directors.filter(director => {
    if (!searchQuery) return true
    const query = searchQuery.toLowerCase()
    return (
      director.full_name?.toLowerCase().includes(query) ||
      director.email?.toLowerCase().includes(query) ||
      director.director_tfn?.toLowerCase().includes(query)
    )
  })

  const getDirectorCompanies = (director) => {
    return director.directorships?.map(d => d.company) || []
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border-b border-gray-200 pb-5">
        <h1 className="text-3xl font-bold text-gray-900">Directors Registry</h1>
        <p className="mt-2 text-sm text-gray-700">
          Comprehensive directory of all company directors
        </p>
      </div>

      {/* Search */}
      <div className="bg-white shadow rounded-lg p-4">
        <form onSubmit={handleSearch} className="relative">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
            <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name, email, or TFN..."
            className="block w-full rounded-md border-0 py-1.5 pl-10 pr-3 text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
          />
        </form>
      </div>

      {/* Directors List */}
      {loading ? (
        <div className="text-center py-12">
          <div className="text-gray-500">Loading directors...</div>
        </div>
      ) : filteredDirectors.length === 0 ? (
        <div className="text-center py-12">
          <UserGroupIcon className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-semibold text-gray-900">No directors found</h3>
          <p className="mt-1 text-sm text-gray-500">
            {searchQuery ? 'Try adjusting your search.' : 'No directors have been added yet.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filteredDirectors.map((director) => {
            const companies = getDirectorCompanies(director)
            const compliance = calculateDirectorCompliance(director)
            return (
              <div
                key={director.id}
                className="bg-white shadow rounded-lg overflow-hidden hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => navigate(`/contacts/${director.id}`)}
              >
                <div className="px-4 py-5 sm:p-6">
                  <div className="flex items-center">
                    <div className="flex-shrink-0 relative">
                      {director.photo_url ? (
                        <img
                          src={director.photo_url}
                          alt={director.full_name}
                          className="h-12 w-12 rounded-full object-cover"
                        />
                      ) : (
                        <div className="h-12 w-12 rounded-full bg-indigo-100 flex items-center justify-center">
                          <UserGroupIcon className="h-6 w-6 text-indigo-600" />
                        </div>
                      )}
                      {/* Compliance indicator badge */}
                      <div className={`absolute -bottom-1 -right-1 rounded-full p-0.5 ${compliance.isFullyCompliant ? 'bg-green-100' : 'bg-amber-100'}`}>
                        {compliance.isFullyCompliant ? (
                          <CheckCircleSolid className="h-4 w-4 text-green-600" />
                        ) : (
                          <ExclamationCircleIcon className="h-4 w-4 text-amber-600" />
                        )}
                      </div>
                    </div>
                    <div className="ml-4 flex-1">
                      <h3 className="text-lg font-medium text-gray-900">
                        {director.full_name}
                      </h3>
                      {director.director_position && (
                        <p className="text-sm text-gray-500">{director.director_position}</p>
                      )}
                    </div>
                  </div>

                  {/* Compliance Status Bar */}
                  <div className="mt-3">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className={`font-medium ${compliance.isFullyCompliant ? 'text-green-600' : 'text-amber-600'}`}>
                        {compliance.isFullyCompliant ? 'Fully Compliant' : `${compliance.filledRequired}/${compliance.totalRequired} Required`}
                      </span>
                      <span className="text-gray-500">{compliance.totalScore}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-1.5">
                      <div
                        className={`h-1.5 rounded-full ${compliance.isFullyCompliant ? 'bg-green-500' : compliance.requiredScore >= 50 ? 'bg-amber-500' : 'bg-red-500'}`}
                        style={{ width: `${compliance.totalScore}%` }}
                      />
                    </div>
                    {!compliance.isFullyCompliant && compliance.missingRequired.length > 0 && (
                      <p className="text-xs text-gray-500 mt-1">
                        Missing: {compliance.missingRequired.slice(0, 2).join(', ')}{compliance.missingRequired.length > 2 && ` +${compliance.missingRequired.length - 2}`}
                      </p>
                    )}
                  </div>

                  <div className="mt-4 space-y-2">
                    {director.email && (
                      <div className="flex items-center text-sm text-gray-500">
                        <EnvelopeIcon className="h-4 w-4 mr-2 text-gray-400" />
                        {director.email}
                      </div>
                    )}
                    {director.mobile_phone && (
                      <div className="flex items-center text-sm text-gray-500">
                        <PhoneIcon className="h-4 w-4 mr-2 text-gray-400" />
                        {director.mobile_phone}
                      </div>
                    )}
                  </div>

                  {companies.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-gray-200">
                      <div className="flex items-center text-xs text-gray-500 mb-2">
                        <BuildingOfficeIcon className="h-4 w-4 mr-1 text-gray-400" />
                        Directorships ({companies.length})
                      </div>
                      <div className="space-y-1">
                        {companies.slice(0, 3).map((company) => (
                          <div
                            key={company.id}
                            className="text-xs text-gray-600 truncate"
                          >
                            {company.name}
                          </div>
                        ))}
                        {companies.length > 3 && (
                          <div className="text-xs text-gray-500 italic">
                            +{companies.length - 3} more
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {director.is_beneficial_owner && (
                    <div className="mt-3">
                      <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800">
                        Beneficial Owner
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Results count */}
      {!loading && filteredDirectors.length > 0 && (
        <div className="text-sm text-gray-700">
          Showing {filteredDirectors.length} {filteredDirectors.length === 1 ? 'director' : 'directors'}
        </div>
      )}
    </div>
  )
}
