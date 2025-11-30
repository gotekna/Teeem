import { useState, useEffect } from 'react'
import {
  CheckCircleIcon,
  ExclamationTriangleIcon,
  XCircleIcon,
  ArrowPathIcon,
  ChartBarIcon
} from '@heroicons/react/24/outline'
import api from '../../api'

const HEALTH_STATUS_COLORS = {
  excellent: { bg: 'bg-green-100', text: 'text-green-800', border: 'border-green-200' },
  good: { bg: 'bg-blue-100', text: 'text-blue-800', border: 'border-blue-200' },
  needs_attention: { bg: 'bg-yellow-100', text: 'text-yellow-800', border: 'border-yellow-200' },
  critical: { bg: 'bg-red-100', text: 'text-red-800', border: 'border-red-200' }
}

export default function CompanyHealthTab({ company, onUpdate }) {
  const [healthData, setHealthData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [reloading, setReloading] = useState(false)

  useEffect(() => {
    loadHealthReport()
  }, [company.id])

  const loadHealthReport = async () => {
    try {
      setLoading(true)
      const response = await api.get('/api/v1/companies/health_report')
      // Find this company's health data
      const companyHealth = response.companies?.find(c => c.id === company.id)
      setHealthData({
        company: companyHealth,
        summary: response.summary,
        allCompanies: response.companies
      })
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
      if (onUpdate) onUpdate()
    } catch (error) {
      console.error('Failed to reload:', error)
      alert('Failed to reload data from spreadsheet')
    } finally {
      setReloading(false)
    }
  }

  if (loading) {
    return <div className="text-center py-8 text-gray-500">Loading health report...</div>
  }

  const companyHealth = healthData?.company
  const colors = companyHealth ? HEALTH_STATUS_COLORS[companyHealth.health_status] : HEALTH_STATUS_COLORS.critical

  return (
    <div className="space-y-6">
      {/* Actions */}
      <div className="flex justify-end">
        <button
          onClick={handleReloadFromSpreadsheet}
          disabled={reloading}
          className="inline-flex items-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:opacity-50"
        >
          <ArrowPathIcon className={`h-4 w-4 mr-1 ${reloading ? 'animate-spin' : ''}`} />
          {reloading ? 'Reloading...' : 'Reload from Spreadsheet'}
        </button>
      </div>

      {/* Health Score Card */}
      {companyHealth && (
        <div className={`rounded-lg p-6 ${colors.bg} ${colors.border} border`}>
          <div className="flex items-center justify-between">
            <div>
              <h3 className={`text-lg font-medium ${colors.text}`}>
                Health Score: {companyHealth.health_score}%
              </h3>
              <p className={`text-sm ${colors.text} opacity-75 mt-1`}>
                Status: {companyHealth.health_status.replace('_', ' ').toUpperCase()}
              </p>
            </div>
            <div className={`text-5xl font-bold ${colors.text}`}>
              {companyHealth.health_score}
            </div>
          </div>
        </div>
      )}

      {/* Issues */}
      {companyHealth?.issues?.length > 0 && (
        <div className="bg-red-50 rounded-lg p-4 border border-red-200">
          <h4 className="text-sm font-medium text-red-800 flex items-center mb-3">
            <XCircleIcon className="h-5 w-5 mr-2" />
            Critical Issues ({companyHealth.issues.length})
          </h4>
          <ul className="space-y-2">
            {companyHealth.issues.map((issue, idx) => (
              <li key={idx} className="text-sm text-red-700 flex items-start">
                <span className="inline-block w-2 h-2 bg-red-500 rounded-full mt-1.5 mr-2"></span>
                {issue}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Warnings */}
      {companyHealth?.warnings?.length > 0 && (
        <div className="bg-yellow-50 rounded-lg p-4 border border-yellow-200">
          <h4 className="text-sm font-medium text-yellow-800 flex items-center mb-3">
            <ExclamationTriangleIcon className="h-5 w-5 mr-2" />
            Warnings ({companyHealth.warnings.length})
          </h4>
          <ul className="space-y-2">
            {companyHealth.warnings.map((warning, idx) => (
              <li key={idx} className="text-sm text-yellow-700 flex items-start">
                <span className="inline-block w-2 h-2 bg-yellow-500 rounded-full mt-1.5 mr-2"></span>
                {warning}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* All Clear */}
      {companyHealth?.issues?.length === 0 && companyHealth?.warnings?.length === 0 && (
        <div className="bg-green-50 rounded-lg p-4 border border-green-200">
          <h4 className="text-sm font-medium text-green-800 flex items-center">
            <CheckCircleIcon className="h-5 w-5 mr-2" />
            All checks passed - company data is complete
          </h4>
        </div>
      )}

      {/* Data Completeness */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <h4 className="text-sm font-medium text-gray-900 mb-4">Data Completeness</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <CompletionItem label="ACN" completed={companyHealth?.has_acn} />
          <CompletionItem label="ABN" completed={companyHealth?.has_abn} />
          <CompletionItem label="TFN" completed={companyHealth?.has_tfn} />
          <CompletionItem label="Registered Office" completed={companyHealth?.has_registered_office} />
          <CompletionItem label="Corporate Key" completed={companyHealth?.has_corporate_key} />
          <CompletionItem label="Directors" completed={companyHealth?.director_count > 0} value={companyHealth?.director_count} />
          <CompletionItem label="Bank Accounts" completed={companyHealth?.bank_account_count > 0} value={companyHealth?.bank_account_count} />
          <CompletionItem label="Shareholders" completed={companyHealth?.shareholder_count > 0} value={companyHealth?.shareholder_count} />
        </div>
      </div>

      {/* All Companies Summary */}
      {healthData?.summary && (
        <div className="bg-gray-50 rounded-lg p-4">
          <h4 className="text-sm font-medium text-gray-900 mb-4 flex items-center">
            <ChartBarIcon className="h-5 w-5 mr-2" />
            All Companies Overview
          </h4>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-gray-900">{healthData.summary.total}</div>
              <div className="text-xs text-gray-500">Total</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-green-600">{healthData.summary.excellent}</div>
              <div className="text-xs text-gray-500">Excellent</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-blue-600">{healthData.summary.good}</div>
              <div className="text-xs text-gray-500">Good</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-yellow-600">{healthData.summary.needs_attention}</div>
              <div className="text-xs text-gray-500">Needs Attention</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-red-600">{healthData.summary.critical}</div>
              <div className="text-xs text-gray-500">Critical</div>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-gray-200 text-center">
            <div className="text-sm text-gray-500">
              Average Health Score: <span className="font-medium text-gray-900">{healthData.summary.average_score}%</span>
            </div>
          </div>
        </div>
      )}

      {/* Companies needing attention */}
      {healthData?.allCompanies?.filter(c => c.health_status === 'critical').length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h4 className="text-sm font-medium text-gray-900 mb-4">Companies Needing Attention</h4>
          <div className="space-y-2">
            {healthData.allCompanies
              .filter(c => c.health_status === 'critical' || c.health_status === 'needs_attention')
              .slice(0, 10)
              .map(c => (
                <div key={c.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                  <div className="flex items-center">
                    <span className={`inline-block w-2 h-2 rounded-full mr-2 ${
                      c.health_status === 'critical' ? 'bg-red-500' : 'bg-yellow-500'
                    }`}></span>
                    <span className="text-sm text-gray-900">{c.name}</span>
                  </div>
                  <div className="flex items-center">
                    <span className="text-sm text-gray-500 mr-2">{c.health_score}%</span>
                    <span className="text-xs text-gray-400">
                      {c.issues.length} issues, {c.warnings.length} warnings
                    </span>
                  </div>
                </div>
              ))
            }
          </div>
        </div>
      )}
    </div>
  )
}

function CompletionItem({ label, completed, value }) {
  return (
    <div className="flex items-center space-x-2">
      {completed ? (
        <CheckCircleIcon className="h-5 w-5 text-green-500" />
      ) : (
        <XCircleIcon className="h-5 w-5 text-red-400" />
      )}
      <span className="text-sm text-gray-700">
        {label}
        {value !== undefined && value > 0 && (
          <span className="ml-1 text-gray-400">({value})</span>
        )}
      </span>
    </div>
  )
}
