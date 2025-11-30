import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  CheckCircleIcon,
  ExclamationTriangleIcon,
  XCircleIcon,
  ArrowPathIcon,
  ChartBarIcon,
  BuildingOfficeIcon
} from '@heroicons/react/24/outline'
import api from '../api'

const HEALTH_STATUS_COLORS = {
  excellent: { bg: 'bg-green-100', text: 'text-green-800', border: 'border-green-200', dot: 'bg-green-500' },
  good: { bg: 'bg-blue-100', text: 'text-blue-800', border: 'border-blue-200', dot: 'bg-blue-500' },
  needs_attention: { bg: 'bg-yellow-100', text: 'text-yellow-800', border: 'border-yellow-200', dot: 'bg-yellow-500' },
  critical: { bg: 'bg-red-100', text: 'text-red-800', border: 'border-red-200', dot: 'bg-red-500' }
}

export default function CorporateHealthPage() {
  const navigate = useNavigate()
  const [healthData, setHealthData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [reloading, setReloading] = useState(false)
  const [filter, setFilter] = useState('all')

  useEffect(() => {
    loadHealthReport()
  }, [])

  const loadHealthReport = async () => {
    try {
      setLoading(true)
      const response = await api.get('/api/v1/companies/health_report')
      setHealthData(response)
    } catch (error) {
      console.error('Failed to load health report:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleReloadFromSpreadsheet = async () => {
    try {
      setReloading(true)
      await api.post('/api/v1/companies/reload')
      await loadHealthReport()
    } catch (error) {
      console.error('Failed to reload:', error)
      alert('Failed to reload data from spreadsheet')
    } finally {
      setReloading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-500">Loading health report...</div>
      </div>
    )
  }

  const filteredCompanies = healthData?.companies?.filter(c => {
    if (filter === 'all') return true
    return c.health_status === filter
  }) || []

  return (
    <div className="flex-1 overflow-y-auto overscroll-none p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Corporate Health Dashboard</h1>
          <p className="mt-1 text-sm text-gray-500">
            Overview of data completeness and compliance across all companies
          </p>
        </div>
        <button
          onClick={handleReloadFromSpreadsheet}
          disabled={reloading}
          className="inline-flex items-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:opacity-50"
        >
          <ArrowPathIcon className={`h-4 w-4 mr-1 ${reloading ? 'animate-spin' : ''}`} />
          {reloading ? 'Reloading...' : 'Reload from Spreadsheet'}
        </button>
      </div>

      {/* Summary Cards */}
      {healthData?.summary && (
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
          <div className="bg-white rounded-lg shadow p-4 text-center">
            <div className="text-3xl font-bold text-gray-900">{healthData.summary.total}</div>
            <div className="text-sm text-gray-500">Total Companies</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4 text-center">
            <div className="text-3xl font-bold text-indigo-600">{healthData.summary.average_score}%</div>
            <div className="text-sm text-gray-500">Average Score</div>
          </div>
          <div
            onClick={() => setFilter('excellent')}
            className={`bg-white rounded-lg shadow p-4 text-center cursor-pointer hover:ring-2 hover:ring-green-500 ${filter === 'excellent' ? 'ring-2 ring-green-500' : ''}`}
          >
            <div className="text-3xl font-bold text-green-600">{healthData.summary.excellent}</div>
            <div className="text-sm text-gray-500">Excellent</div>
          </div>
          <div
            onClick={() => setFilter('good')}
            className={`bg-white rounded-lg shadow p-4 text-center cursor-pointer hover:ring-2 hover:ring-blue-500 ${filter === 'good' ? 'ring-2 ring-blue-500' : ''}`}
          >
            <div className="text-3xl font-bold text-blue-600">{healthData.summary.good}</div>
            <div className="text-sm text-gray-500">Good</div>
          </div>
          <div
            onClick={() => setFilter('needs_attention')}
            className={`bg-white rounded-lg shadow p-4 text-center cursor-pointer hover:ring-2 hover:ring-yellow-500 ${filter === 'needs_attention' ? 'ring-2 ring-yellow-500' : ''}`}
          >
            <div className="text-3xl font-bold text-yellow-600">{healthData.summary.needs_attention}</div>
            <div className="text-sm text-gray-500">Needs Attention</div>
          </div>
          <div
            onClick={() => setFilter('critical')}
            className={`bg-white rounded-lg shadow p-4 text-center cursor-pointer hover:ring-2 hover:ring-red-500 ${filter === 'critical' ? 'ring-2 ring-red-500' : ''}`}
          >
            <div className="text-3xl font-bold text-red-600">{healthData.summary.critical}</div>
            <div className="text-sm text-gray-500">Critical</div>
          </div>
        </div>
      )}

      {/* Filter indicator */}
      {filter !== 'all' && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">Filtering by:</span>
          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${HEALTH_STATUS_COLORS[filter]?.bg} ${HEALTH_STATUS_COLORS[filter]?.text}`}>
            {filter.replace('_', ' ').toUpperCase()}
          </span>
          <button
            onClick={() => setFilter('all')}
            className="text-sm text-indigo-600 hover:text-indigo-800"
          >
            Clear filter
          </button>
        </div>
      )}

      {/* Companies List */}
      <div className="bg-white shadow rounded-lg">
        <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900 flex items-center">
            <ChartBarIcon className="h-5 w-5 mr-2" />
            All Companies ({filteredCompanies.length})
          </h3>
        </div>
        <ul className="divide-y divide-gray-200">
          {filteredCompanies.map((company) => {
            const colors = HEALTH_STATUS_COLORS[company.health_status] || HEALTH_STATUS_COLORS.critical
            return (
              <li
                key={company.id}
                className="hover:bg-gray-50 cursor-pointer"
                onClick={() => navigate(`/corporate/companies/${company.id}?tab=health`)}
              >
                <div className="px-4 py-4 sm:px-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center min-w-0">
                      <BuildingOfficeIcon className="h-8 w-8 text-gray-400 mr-3" />
                      <div>
                        <p className="text-sm font-medium text-indigo-600 truncate">{company.name}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${colors.bg} ${colors.text}`}>
                            {company.health_status.replace('_', ' ')}
                          </span>
                          {company.issues.length > 0 && (
                            <span className="text-xs text-red-600">
                              {company.issues.length} issue{company.issues.length !== 1 ? 's' : ''}
                            </span>
                          )}
                          {company.warnings.length > 0 && (
                            <span className="text-xs text-yellow-600">
                              {company.warnings.length} warning{company.warnings.length !== 1 ? 's' : ''}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      {/* Health Score Bar */}
                      <div className="w-32 hidden sm:block">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-gray-200 rounded-full h-2">
                            <div
                              className={`h-2 rounded-full ${colors.dot}`}
                              style={{ width: `${company.health_score}%` }}
                            />
                          </div>
                          <span className="text-sm font-medium text-gray-700 w-10 text-right">
                            {company.health_score}%
                          </span>
                        </div>
                      </div>
                      {/* Quick Stats */}
                      <div className="hidden md:flex items-center gap-3 text-xs text-gray-500">
                        <span className={company.has_acn ? 'text-green-600' : 'text-red-500'}>
                          ACN {company.has_acn ? '✓' : '✗'}
                        </span>
                        <span className={company.has_abn ? 'text-green-600' : 'text-red-500'}>
                          ABN {company.has_abn ? '✓' : '✗'}
                        </span>
                        <span className={company.director_count > 0 ? 'text-green-600' : 'text-red-500'}>
                          Directors: {company.director_count}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Issues & Warnings Preview */}
                  {(company.issues.length > 0 || company.warnings.length > 0) && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {company.issues.slice(0, 3).map((issue, idx) => (
                        <span key={idx} className="inline-flex items-center rounded bg-red-50 px-1.5 py-0.5 text-xs text-red-700">
                          <XCircleIcon className="h-3 w-3 mr-0.5" />
                          {issue}
                        </span>
                      ))}
                      {company.warnings.slice(0, 2).map((warning, idx) => (
                        <span key={idx} className="inline-flex items-center rounded bg-yellow-50 px-1.5 py-0.5 text-xs text-yellow-700">
                          <ExclamationTriangleIcon className="h-3 w-3 mr-0.5" />
                          {warning}
                        </span>
                      ))}
                      {(company.issues.length > 3 || company.warnings.length > 2) && (
                        <span className="text-xs text-gray-400">
                          +{Math.max(0, company.issues.length - 3) + Math.max(0, company.warnings.length - 2)} more
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}
