import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  PlusIcon,
  XMarkIcon,
  BuildingOfficeIcon
} from '@heroicons/react/24/outline'
import { api } from '../../api'

// Triangle icon for Trust entities
const TrustIcon = ({ className = "h-5 w-5" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M12 3L22 20H2L12 3Z" strokeLinejoin="round" />
  </svg>
)

export default function CompanyTrustsTab({ company, onUpdate }) {
  const [trusts, setTrusts] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  const [availableTrusts, setAvailableTrusts] = useState([])
  const [selectedTrustId, setSelectedTrustId] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    loadTrusts()
  }, [company.id])

  const loadTrusts = async () => {
    try {
      setLoading(true)
      // If this company is a trustee, find the trust it manages
      if (company.is_trustee && company.trust_name) {
        // Find the trust entity by name
        const response = await api.get('/api/v1/companies', {
          params: {
            entity_type: 'Trust',
            search: company.trust_name,
            company_group_id: company.company_group_id
          }
        })
        const matchingTrust = (response.companies || []).find(t => t.name === company.trust_name)
        setTrusts(matchingTrust ? [matchingTrust] : [])
      } else {
        setTrusts([])
      }
    } catch (error) {
      console.error('Failed to load trusts:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadAvailableTrusts = async () => {
    try {
      // Get all Trust entities in the same company group that don't have a trustee yet
      const response = await api.get('/api/v1/companies', {
        params: {
          entity_type: 'Trust',
          company_group_id: company.company_group_id
        }
      })
      setAvailableTrusts(response.companies || [])
    } catch (error) {
      console.error('Failed to load available trusts:', error)
    }
  }

  const handleAddTrust = () => {
    loadAvailableTrusts()
    setShowAddForm(true)
  }

  const handleSaveTrust = async () => {
    if (!selectedTrustId) return

    try {
      setSaving(true)
      const selectedTrust = availableTrusts.find(t => t.id === parseInt(selectedTrustId))

      // Update the company to be a trustee for this trust
      await api.put(`/api/v1/companies/${company.id}`, {
        company: {
          is_trustee: true,
          trust_name: selectedTrust.name
        }
      })

      setShowAddForm(false)
      setSelectedTrustId('')
      if (onUpdate) onUpdate()
      loadTrusts()
    } catch (error) {
      console.error('Failed to save trust link:', error)
      alert('Failed to link trust')
    } finally {
      setSaving(false)
    }
  }

  const handleRemoveTrust = async () => {
    if (!confirm('Remove this company as trustee for this trust?')) return

    try {
      await api.put(`/api/v1/companies/${company.id}`, {
        company: {
          is_trustee: false,
          trust_name: ''
        }
      })
      if (onUpdate) onUpdate()
      loadTrusts()
    } catch (error) {
      console.error('Failed to remove trust link:', error)
      alert('Failed to remove trust link')
    }
  }

  if (loading) {
    return <div className="text-center py-8 text-gray-500">Loading...</div>
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">
            Trusts
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {company.is_trustee
              ? 'This company acts as trustee for the following trust(s)'
              : 'Make this company a trustee for a trust'}
          </p>
        </div>
        {!company.is_trustee && !showAddForm && (
          <button
            onClick={handleAddTrust}
            className="inline-flex items-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500"
          >
            <PlusIcon className="h-4 w-4 mr-1" />
            Link Trust
          </button>
        )}
      </div>

      {/* Add Trust Form */}
      {showAddForm && (
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
          <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-3">
            Select Trust to Link
          </h4>
          <div className="space-y-4">
            <select
              value={selectedTrustId}
              onChange={(e) => setSelectedTrustId(e.target.value)}
              className="block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-gray-900 dark:text-white focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
            >
              <option value="">Select a trust...</option>
              {availableTrusts.map((trust) => (
                <option key={trust.id} value={trust.id}>
                  {trust.name}
                </option>
              ))}
            </select>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowAddForm(false)
                  setSelectedTrustId('')
                }}
                className="rounded-md bg-white dark:bg-gray-700 px-3 py-2 text-sm font-semibold text-gray-900 dark:text-white shadow-sm ring-1 ring-inset ring-gray-300 dark:ring-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveTrust}
                disabled={!selectedTrustId || saving}
                className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Link Trust'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Trusts List */}
      {trusts.length === 0 && !showAddForm ? (
        <div className="text-center py-12 bg-gray-50 dark:bg-gray-800 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600">
          <TrustIcon className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-semibold text-gray-900 dark:text-white">No trusts linked</h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            This company is not a trustee for any trust.
          </p>
          <button
            onClick={handleAddTrust}
            className="mt-4 inline-flex items-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500"
          >
            <PlusIcon className="h-4 w-4 mr-1" />
            Link Trust
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {trusts.map((trust) => (
            <div
              key={trust.id}
              className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex-shrink-0 text-purple-600 dark:text-purple-400">
                    <TrustIcon className="h-8 w-8" />
                  </div>
                  <div>
                    <Link
                      to={`/companies/${trust.id}`}
                      className="text-lg font-medium text-gray-900 dark:text-white hover:text-indigo-600 dark:hover:text-indigo-400"
                    >
                      {trust.name}
                    </Link>
                    <div className="flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
                      {trust.abn && <span>ABN: {trust.abn}</span>}
                      <span className="inline-flex items-center rounded-full bg-purple-100 dark:bg-purple-900/30 px-2 py-0.5 text-xs font-medium text-purple-800 dark:text-purple-300">
                        Trust
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      {company.name} acts as trustee for this trust
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleRemoveTrust}
                  className="text-gray-400 hover:text-red-600 dark:hover:text-red-400"
                  title="Remove trust link"
                >
                  <XMarkIcon className="h-5 w-5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Info box about ATF display */}
      {company.is_trustee && trusts.length > 0 && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <p className="text-sm text-blue-800 dark:text-blue-300">
            <strong>Note:</strong> In the Company Groups hierarchy view, this company will display as
            "{company.name} ATF {company.trust_name}" and the trust will appear as a child when expanded.
          </p>
        </div>
      )}
    </div>
  )
}
