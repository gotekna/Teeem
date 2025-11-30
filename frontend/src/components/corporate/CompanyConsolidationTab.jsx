import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  PlusIcon,
  XMarkIcon,
  BuildingOfficeIcon
} from '@heroicons/react/24/outline'
import { api } from '../../api'

export default function CompanyConsolidationTab({ company, onUpdate }) {
  const [consolidatedCompanies, setConsolidatedCompanies] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  const [availableCompanies, setAvailableCompanies] = useState([])
  const [selectedCompanyId, setSelectedCompanyId] = useState('')
  const [saving, setSaving] = useState(false)
  const [companyGroups, setCompanyGroups] = useState([])
  const [selectedGroupId, setSelectedGroupId] = useState(company.company_group_id || '')
  const [savingGroup, setSavingGroup] = useState(false)

  useEffect(() => {
    loadConsolidatedCompanies()
    loadCompanyGroups()
  }, [company.id])

  useEffect(() => {
    setSelectedGroupId(company.company_group_id || '')
  }, [company.company_group_id])

  const loadConsolidatedCompanies = async () => {
    try {
      setLoading(true)
      // Get companies that have this company as their consolidation_parent_id
      const response = await api.get('/api/v1/companies', {
        params: { consolidation_parent_id: company.id }
      })
      setConsolidatedCompanies(response.companies || [])
    } catch (error) {
      console.error('Failed to load consolidated companies:', error)
      setConsolidatedCompanies([])
    } finally {
      setLoading(false)
    }
  }

  const loadAvailableCompanies = async () => {
    try {
      // Get ALL companies - adding to consolidation will also add them to this group
      const response = await api.get('/api/v1/companies')
      // Filter out the current company and companies already in consolidation
      const available = (response.companies || []).filter(c =>
        c.id !== company.id &&
        !consolidatedCompanies.find(cc => cc.id === c.id)
      )
      setAvailableCompanies(available)
    } catch (error) {
      console.error('Failed to load available companies:', error)
    }
  }

  const loadCompanyGroups = async () => {
    try {
      const response = await api.get('/api/v1/company_groups')
      setCompanyGroups(response.data || [])
    } catch (error) {
      console.error('Failed to load company groups:', error)
    }
  }

  const handleGroupChange = async (newGroupId) => {
    if (newGroupId === selectedGroupId) return

    try {
      setSavingGroup(true)
      await api.put(`/api/v1/companies/${company.id}`, {
        company: {
          company_group_id: newGroupId || null
        }
      })
      setSelectedGroupId(newGroupId)
      if (onUpdate) onUpdate()
    } catch (error) {
      console.error('Failed to update company group:', error)
      alert('Failed to update company group')
    } finally {
      setSavingGroup(false)
    }
  }

  const handleAddCompany = () => {
    loadAvailableCompanies()
    setShowAddForm(true)
  }

  const handleSaveConsolidation = async () => {
    if (!selectedCompanyId) return

    try {
      setSaving(true)
      // Update the selected company to have this company as its consolidation parent
      // Also set the company_group_id to match this company's group
      await api.put(`/api/v1/companies/${selectedCompanyId}`, {
        company: {
          consolidation_parent_id: company.id,
          company_group_id: company.company_group_id
        }
      })

      setShowAddForm(false)
      setSelectedCompanyId('')
      loadConsolidatedCompanies()
      if (onUpdate) onUpdate()
    } catch (error) {
      console.error('Failed to add to consolidation:', error)
      alert('Failed to add company to consolidation')
    } finally {
      setSaving(false)
    }
  }

  const handleRemoveConsolidation = async (companyId) => {
    if (!confirm('Remove this company from consolidation?')) return

    try {
      await api.put(`/api/v1/companies/${companyId}`, {
        company: {
          consolidation_parent_id: null
        }
      })
      loadConsolidatedCompanies()
      if (onUpdate) onUpdate()
    } catch (error) {
      console.error('Failed to remove from consolidation:', error)
      alert('Failed to remove company from consolidation')
    }
  }

  if (loading) {
    return <div className="text-center py-8 text-gray-500">Loading...</div>
  }

  return (
    <div className="space-y-6">
      {/* Company Group Selector */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex items-center gap-4">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">
            Company Group:
          </label>
          <select
            value={selectedGroupId}
            onChange={(e) => handleGroupChange(e.target.value)}
            disabled={savingGroup}
            className="block w-full max-w-md rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-gray-900 dark:text-white focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm disabled:opacity-50"
          >
            <option value="">Select a group...</option>
            {companyGroups.map((group) => (
              <option key={group.id} value={group.id}>
                {group.name}
              </option>
            ))}
          </select>
          {savingGroup && (
            <span className="text-sm text-gray-500">Saving...</span>
          )}
        </div>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">
            Consolidation
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Companies included in this entity's financial consolidation
          </p>
        </div>
        {!showAddForm && (
          <button
            onClick={handleAddCompany}
            className="inline-flex items-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500"
          >
            <PlusIcon className="h-4 w-4 mr-1" />
            Add Company
          </button>
        )}
      </div>

      {/* Add Company Form */}
      {showAddForm && (
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
          <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-3">
            Add Company to Consolidation
          </h4>
          <div className="space-y-4">
            <select
              value={selectedCompanyId}
              onChange={(e) => setSelectedCompanyId(e.target.value)}
              className="block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-gray-900 dark:text-white focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
            >
              <option value="">Select a company...</option>
              {availableCompanies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.abbreviation ? `(${c.abbreviation})` : ''}
                </option>
              ))}
            </select>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowAddForm(false)
                  setSelectedCompanyId('')
                }}
                className="rounded-md bg-white dark:bg-gray-700 px-3 py-2 text-sm font-semibold text-gray-900 dark:text-white shadow-sm ring-1 ring-inset ring-gray-300 dark:ring-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveConsolidation}
                disabled={!selectedCompanyId || saving}
                className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:opacity-50"
              >
                {saving ? 'Adding...' : 'Add to Consolidation'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Consolidated Companies List */}
      {consolidatedCompanies.length === 0 && !showAddForm ? (
        <div className="text-center py-12 bg-gray-50 dark:bg-gray-800 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600">
          <BuildingOfficeIcon className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-semibold text-gray-900 dark:text-white">No consolidated companies</h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Add subsidiaries that are included in this company's financial consolidation.
          </p>
          <button
            onClick={handleAddCompany}
            className="mt-4 inline-flex items-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500"
          >
            <PlusIcon className="h-4 w-4 mr-1" />
            Add Company
          </button>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 shadow-sm ring-1 ring-gray-900/5 dark:ring-white/10 rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Company
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  ACN
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {consolidatedCompanies.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                  <td className="px-4 py-3">
                    <Link
                      to={`/companies/${c.id}`}
                      className="text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
                    >
                      {c.name}
                    </Link>
                    {c.abbreviation && (
                      <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">
                        ({c.abbreviation})
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                    {c.acn || '-'}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                    {c.entity_type || 'Company'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                      c.status === 'active'
                        ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                        : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                    }`}>
                      {c.status || 'active'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleRemoveConsolidation(c.id)}
                      className="text-gray-400 hover:text-red-600 dark:hover:text-red-400"
                      title="Remove from consolidation"
                    >
                      <XMarkIcon className="h-5 w-5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Info box */}
      {consolidatedCompanies.length > 0 && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <p className="text-sm text-blue-800 dark:text-blue-300">
            <strong>Consolidation Summary:</strong> {consolidatedCompanies.length} {consolidatedCompanies.length === 1 ? 'company' : 'companies'} consolidated under {company.name}
          </p>
        </div>
      )}
    </div>
  )
}
