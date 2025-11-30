import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  BuildingOfficeIcon,
  KeyIcon,
  EyeIcon,
  EyeSlashIcon,
  ClipboardIcon,
  CheckIcon
} from '@heroicons/react/24/outline'
import api from '../api'

export default function AsicLoginsPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [loading, setLoading] = useState(true)
  const [companies, setCompanies] = useState([])
  const [companyGroups, setCompanyGroups] = useState([])
  const [selectedGroup, setSelectedGroup] = useState(searchParams.get('company_group_id') || '')
  const [showPasswords, setShowPasswords] = useState({})
  const [copiedField, setCopiedField] = useState(null)

  useEffect(() => {
    loadCompanyGroups()
    loadAsicLogins()
  }, [selectedGroup])

  const loadCompanyGroups = async () => {
    try {
      const response = await api.get('/api/v1/company_groups')
      setCompanyGroups(response.company_groups || [])
    } catch (error) {
      console.error('Failed to load company groups:', error)
    }
  }

  const loadAsicLogins = async () => {
    try {
      setLoading(true)
      const params = {}
      if (selectedGroup) {
        params.company_group_id = selectedGroup
      }
      const response = await api.get('/api/v1/companies/asic_logins', { params })
      setCompanies(response.companies || [])
    } catch (error) {
      console.error('Failed to load ASIC logins:', error)
    } finally {
      setLoading(false)
    }
  }

  const togglePassword = (companyId, field) => {
    const key = `${companyId}-${field}`
    setShowPasswords(prev => ({
      ...prev,
      [key]: !prev[key]
    }))
  }

  const copyToClipboard = async (text, companyId, field) => {
    try {
      await navigator.clipboard.writeText(text)
      const key = `${companyId}-${field}`
      setCopiedField(key)
      setTimeout(() => setCopiedField(null), 2000)
    } catch (error) {
      console.error('Failed to copy:', error)
    }
  }

  const handleGroupChange = (e) => {
    const groupId = e.target.value
    setSelectedGroup(groupId)
    if (groupId) {
      navigate(`/corporate/asic-logins?company_group_id=${groupId}`)
    } else {
      navigate('/corporate/asic-logins')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-500">Loading ASIC logins...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border-b border-gray-200 pb-5 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">ASIC Logins</h1>
          <p className="mt-2 text-sm text-gray-700">
            View and manage ASIC portal credentials for all companies
          </p>
        </div>
        <div className="flex items-center gap-4">
          <select
            value={selectedGroup}
            onChange={handleGroupChange}
            className="rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
          >
            <option value="">All Company Groups</option>
            {companyGroups.map(group => (
              <option key={group.id} value={group.id}>{group.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Companies Table */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Company
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Group
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  ACN
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Corporate Key
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Username
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Password
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Recovery Q&A
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {companies.map((company) => (
                <tr
                  key={company.id}
                  className="hover:bg-gray-50"
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div
                      className="flex items-center cursor-pointer"
                      onClick={() => navigate(`/corporate/companies/${company.id}`)}
                    >
                      <BuildingOfficeIcon className="h-5 w-5 text-gray-400 mr-2" />
                      <span className="text-sm font-medium text-indigo-600 hover:text-indigo-900">
                        {company.name}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {company.company_group_name || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-mono">
                    {company.formatted_acn || company.acn || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {company.corporate_key ? (
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-900 font-mono">{company.corporate_key}</span>
                        <button
                          onClick={() => copyToClipboard(company.corporate_key, company.id, 'corporate_key')}
                          className="text-gray-400 hover:text-gray-600"
                        >
                          {copiedField === `${company.id}-corporate_key` ? (
                            <CheckIcon className="h-4 w-4 text-green-500" />
                          ) : (
                            <ClipboardIcon className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    ) : (
                      <span className="text-sm text-gray-400">-</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {company.asic_username ? (
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-900 font-mono">{company.asic_username}</span>
                        <button
                          onClick={() => copyToClipboard(company.asic_username, company.id, 'username')}
                          className="text-gray-400 hover:text-gray-600"
                        >
                          {copiedField === `${company.id}-username` ? (
                            <CheckIcon className="h-4 w-4 text-green-500" />
                          ) : (
                            <ClipboardIcon className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    ) : (
                      <span className="text-sm text-gray-400">-</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {company.asic_password ? (
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-900 font-mono">
                          {showPasswords[`${company.id}-password`] ? company.asic_password : '••••••••'}
                        </span>
                        <button
                          onClick={() => togglePassword(company.id, 'password')}
                          className="text-gray-400 hover:text-gray-600"
                        >
                          {showPasswords[`${company.id}-password`] ? (
                            <EyeSlashIcon className="h-4 w-4" />
                          ) : (
                            <EyeIcon className="h-4 w-4" />
                          )}
                        </button>
                        <button
                          onClick={() => copyToClipboard(company.asic_password, company.id, 'password')}
                          className="text-gray-400 hover:text-gray-600"
                        >
                          {copiedField === `${company.id}-password` ? (
                            <CheckIcon className="h-4 w-4 text-green-500" />
                          ) : (
                            <ClipboardIcon className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    ) : (
                      <span className="text-sm text-gray-400">-</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    {company.recovery_question ? (
                      <div className="space-y-1">
                        <p className="text-xs text-gray-500">{company.recovery_question}</p>
                        {company.recovery_answer && (
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-gray-900 font-mono">
                              {showPasswords[`${company.id}-recovery`] ? company.recovery_answer : '••••••••'}
                            </span>
                            <button
                              onClick={() => togglePassword(company.id, 'recovery')}
                              className="text-gray-400 hover:text-gray-600"
                            >
                              {showPasswords[`${company.id}-recovery`] ? (
                                <EyeSlashIcon className="h-4 w-4" />
                              ) : (
                                <EyeIcon className="h-4 w-4" />
                              )}
                            </button>
                            <button
                              onClick={() => copyToClipboard(company.recovery_answer, company.id, 'recovery')}
                              className="text-gray-400 hover:text-gray-600"
                            >
                              {copiedField === `${company.id}-recovery` ? (
                                <CheckIcon className="h-4 w-4 text-green-500" />
                              ) : (
                                <ClipboardIcon className="h-4 w-4" />
                              )}
                            </button>
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="text-sm text-gray-400">-</span>
                    )}
                  </td>
                </tr>
              ))}
              {companies.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                    <KeyIcon className="mx-auto h-12 w-12 text-gray-400" />
                    <h3 className="mt-2 text-sm font-medium text-gray-900">No ASIC logins found</h3>
                    <p className="mt-1 text-sm text-gray-500">
                      {selectedGroup
                        ? 'No companies with ASIC credentials in this group.'
                        : 'No companies with ASIC credentials found.'}
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Summary */}
      <div className="text-sm text-gray-500">
        Showing {companies.length} companies
        {companies.filter(c => c.has_credentials).length > 0 && (
          <span> ({companies.filter(c => c.has_credentials).length} with ASIC credentials)</span>
        )}
      </div>
    </div>
  )
}
