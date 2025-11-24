import { useState, useEffect, useCallback } from 'react'
import {
  ChartBarIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  ClockIcon,
  CurrencyDollarIcon,
  ArrowPathIcon,
  LightBulbIcon,
  DocumentArrowDownIcon,
  DocumentArrowUpIcon,
  BellIcon
} from '@heroicons/react/24/outline'
import { api } from '../../api'

// ============================================
// Critical Path Display
// ============================================

export const CriticalPathView = ({ constructionId }) => {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await api.get(`/api/v1/constructions/${constructionId}/sm_analytics/critical_path`)
        setData(res.data.critical_path)
      } catch (err) {
        console.error('Failed to fetch critical path:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [constructionId])

  if (loading) {
    return <div className="flex justify-center py-8"><ArrowPathIcon className="w-6 h-6 animate-spin" /></div>
  }

  if (!data) return null

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
        <ChartBarIcon className="w-5 h-5 text-red-500" />
        Critical Path
      </h3>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4 mb-4">
        <div className="bg-red-50 rounded-lg p-3">
          <div className="text-2xl font-bold text-red-600">{data.summary?.critical_tasks || 0}</div>
          <div className="text-xs text-red-600">Critical Tasks</div>
        </div>
        <div className="bg-gray-50 rounded-lg p-3">
          <div className="text-2xl font-bold text-gray-700">{data.project_duration || 0}</div>
          <div className="text-xs text-gray-500">Days Duration</div>
        </div>
        <div className="bg-green-50 rounded-lg p-3">
          <div className="text-2xl font-bold text-green-600">{data.summary?.average_float?.toFixed(1) || 0}</div>
          <div className="text-xs text-green-600">Avg Float (days)</div>
        </div>
      </div>

      {/* Critical Path Tasks */}
      <div className="space-y-2">
        <div className="text-sm font-medium text-gray-700">Critical Path Sequence:</div>
        <div className="flex flex-wrap gap-2">
          {data.critical_path?.map((task, index) => (
            <div key={task.id} className="flex items-center">
              <div className="px-3 py-1 bg-red-100 text-red-700 rounded text-sm">
                {task.name}
                <span className="text-xs ml-1">({task.duration}d)</span>
              </div>
              {index < data.critical_path.length - 1 && (
                <span className="mx-1 text-gray-400">&rarr;</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ============================================
// EVM Dashboard
// ============================================

export const EvmDashboard = ({ constructionId }) => {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await api.get(`/api/v1/constructions/${constructionId}/sm_analytics/evm`)
        setData(res.data.evm)
      } catch (err) {
        console.error('Failed to fetch EVM:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [constructionId])

  if (loading) {
    return <div className="flex justify-center py-8"><ArrowPathIcon className="w-6 h-6 animate-spin" /></div>
  }

  if (!data) return null

  const spiColor = data.indices?.spi >= 1 ? 'text-green-600' : data.indices?.spi >= 0.9 ? 'text-yellow-600' : 'text-red-600'
  const cpiColor = data.indices?.cpi >= 1 ? 'text-green-600' : data.indices?.cpi >= 0.9 ? 'text-yellow-600' : 'text-red-600'

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
        <CurrencyDollarIcon className="w-5 h-5 text-blue-500" />
        Earned Value Management
      </h3>

      {/* Key Indices */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        <div className="bg-gray-50 rounded-lg p-3">
          <div className={`text-2xl font-bold ${spiColor}`}>
            {data.indices?.spi?.toFixed(2) || '-'}
          </div>
          <div className="text-xs text-gray-500">SPI (Schedule)</div>
          <div className="text-xs text-gray-400">{data.progress?.schedule_status?.replace(/_/g, ' ')}</div>
        </div>
        <div className="bg-gray-50 rounded-lg p-3">
          <div className={`text-2xl font-bold ${cpiColor}`}>
            {data.indices?.cpi?.toFixed(2) || '-'}
          </div>
          <div className="text-xs text-gray-500">CPI (Cost)</div>
          <div className="text-xs text-gray-400">{data.progress?.cost_status?.replace(/_/g, ' ')}</div>
        </div>
        <div className="bg-gray-50 rounded-lg p-3">
          <div className="text-2xl font-bold text-gray-700">
            {data.progress?.percent_complete?.toFixed(0) || 0}%
          </div>
          <div className="text-xs text-gray-500">Complete</div>
        </div>
        <div className="bg-gray-50 rounded-lg p-3">
          <div className={`text-2xl font-bold ${data.health === 'excellent' || data.health === 'good' ? 'text-green-600' : 'text-yellow-600'}`}>
            {data.health?.charAt(0).toUpperCase() + data.health?.slice(1) || '-'}
          </div>
          <div className="text-xs text-gray-500">Health</div>
        </div>
      </div>

      {/* Values */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
        <div>
          <span className="text-gray-500">Planned Value:</span>
          <span className="ml-2 font-medium">${data.core_values?.pv?.toLocaleString() || 0}</span>
        </div>
        <div>
          <span className="text-gray-500">Earned Value:</span>
          <span className="ml-2 font-medium">${data.core_values?.ev?.toLocaleString() || 0}</span>
        </div>
        <div>
          <span className="text-gray-500">Actual Cost:</span>
          <span className="ml-2 font-medium">${data.core_values?.ac?.toLocaleString() || 0}</span>
        </div>
        <div>
          <span className="text-gray-500">Est. at Completion:</span>
          <span className="ml-2 font-medium">${data.forecasts?.eac?.toLocaleString() || 0}</span>
        </div>
      </div>

      {/* Variances */}
      <div className="mt-4 pt-4 border-t border-gray-100 grid grid-cols-2 gap-4 text-sm">
        <div className="flex items-center gap-2">
          {data.variances?.sv >= 0 ? (
            <ArrowTrendingUpIcon className="w-4 h-4 text-green-500" />
          ) : (
            <ArrowTrendingDownIcon className="w-4 h-4 text-red-500" />
          )}
          <span>Schedule Variance: ${data.variances?.sv?.toLocaleString() || 0}</span>
        </div>
        <div className="flex items-center gap-2">
          {data.variances?.cv >= 0 ? (
            <ArrowTrendingUpIcon className="w-4 h-4 text-green-500" />
          ) : (
            <ArrowTrendingDownIcon className="w-4 h-4 text-red-500" />
          )}
          <span>Cost Variance: ${data.variances?.cv?.toLocaleString() || 0}</span>
        </div>
      </div>
    </div>
  )
}

// ============================================
// AI Suggestions Panel
// ============================================

export const AiSuggestionsPanel = ({ constructionId }) => {
  const [suggestions, setSuggestions] = useState([])
  const [predictions, setPredictions] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('suggestions')

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [suggestionsRes, predictionsRes] = await Promise.all([
          api.get(`/api/v1/constructions/${constructionId}/sm_ai/suggestions`),
          api.get(`/api/v1/constructions/${constructionId}/sm_ai/predictions`)
        ])
        setSuggestions(suggestionsRes.data.suggestions || [])
        setPredictions(predictionsRes.data.predictions || [])
      } catch (err) {
        console.error('Failed to fetch AI data:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [constructionId])

  if (loading) {
    return <div className="flex justify-center py-8"><ArrowPathIcon className="w-6 h-6 animate-spin" /></div>
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
        <LightBulbIcon className="w-5 h-5 text-yellow-500" />
        AI Insights
      </h3>

      {/* Tabs */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setActiveTab('suggestions')}
          className={`px-3 py-1 rounded text-sm ${activeTab === 'suggestions' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}
        >
          Suggestions ({suggestions.length})
        </button>
        <button
          onClick={() => setActiveTab('predictions')}
          className={`px-3 py-1 rounded text-sm ${activeTab === 'predictions' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}
        >
          Risk Predictions ({predictions.length})
        </button>
      </div>

      {/* Content */}
      <div className="space-y-3 max-h-80 overflow-y-auto">
        {activeTab === 'suggestions' && suggestions.map((s, i) => (
          <div key={i} className="p-3 bg-blue-50 rounded-lg">
            <div className="flex items-start gap-2">
              <span className={`px-2 py-0.5 rounded text-xs ${
                s.priority >= 8 ? 'bg-red-100 text-red-700' :
                s.priority >= 5 ? 'bg-yellow-100 text-yellow-700' :
                'bg-gray-100 text-gray-600'
              }`}>
                {s.type?.replace(/_/g, ' ')}
              </span>
            </div>
            <div className="mt-1 text-sm text-gray-700">{s.message}</div>
            {s.impact && <div className="mt-1 text-xs text-blue-600">{s.impact}</div>}
          </div>
        ))}

        {activeTab === 'predictions' && predictions.map((p, i) => (
          <div key={i} className="p-3 bg-amber-50 rounded-lg">
            <div className="flex items-center justify-between">
              <span className="font-medium text-gray-900">{p.task_name}</span>
              <span className={`px-2 py-0.5 rounded text-xs ${
                p.risk_level === 'critical' ? 'bg-red-100 text-red-700' :
                p.risk_level === 'high' ? 'bg-orange-100 text-orange-700' :
                p.risk_level === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                'bg-gray-100 text-gray-600'
              }`}>
                {p.risk_level} risk
              </span>
            </div>
            <div className="mt-1 text-sm text-gray-600">
              Risk score: {(p.risk_score * 100).toFixed(0)}%
              {p.estimated_delay_days > 0 && ` • Est. delay: ${p.estimated_delay_days} days`}
            </div>
            {p.factors?.length > 0 && (
              <div className="mt-2 text-xs text-gray-500">
                Factors: {p.factors.join(', ')}
              </div>
            )}
          </div>
        ))}

        {((activeTab === 'suggestions' && suggestions.length === 0) ||
          (activeTab === 'predictions' && predictions.length === 0)) && (
          <div className="text-center py-4 text-gray-400">
            No {activeTab} at this time
          </div>
        )}
      </div>
    </div>
  )
}

// ============================================
// Baseline Comparison
// ============================================

export const BaselineComparison = ({ constructionId }) => {
  const [baselines, setBaselines] = useState([])
  const [comparison, setComparison] = useState(null)
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)

  const fetchBaselines = useCallback(async () => {
    try {
      const res = await api.get(`/api/v1/constructions/${constructionId}/sm_analytics/baselines`)
      setBaselines(res.data.baselines || [])
    } catch (err) {
      console.error('Failed to fetch baselines:', err)
    } finally {
      setLoading(false)
    }
  }, [constructionId])

  const fetchComparison = async (baselineId) => {
    try {
      const res = await api.get(`/api/v1/constructions/${constructionId}/sm_analytics/baselines/${baselineId}/compare`)
      setComparison(res.data.comparison)
    } catch (err) {
      console.error('Failed to fetch comparison:', err)
    }
  }

  const createBaseline = async () => {
    setCreating(true)
    try {
      const name = prompt('Baseline name:', `Baseline ${new Date().toLocaleDateString()}`)
      if (!name) return

      await api.post(`/api/v1/constructions/${constructionId}/sm_analytics/baselines`, { name })
      fetchBaselines()
    } catch (err) {
      console.error('Failed to create baseline:', err)
    } finally {
      setCreating(false)
    }
  }

  useEffect(() => {
    fetchBaselines()
  }, [fetchBaselines])

  if (loading) {
    return <div className="flex justify-center py-8"><ArrowPathIcon className="w-6 h-6 animate-spin" /></div>
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-900">Baseline Comparison</h3>
        <button
          onClick={createBaseline}
          disabled={creating}
          className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50"
        >
          {creating ? 'Creating...' : 'Create Baseline'}
        </button>
      </div>

      {baselines.length === 0 ? (
        <div className="text-center py-8 text-gray-400">
          No baselines yet. Create one to track schedule variance.
        </div>
      ) : (
        <div className="space-y-2">
          {baselines.map(baseline => (
            <div
              key={baseline.id}
              onClick={() => fetchComparison(baseline.id)}
              className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                baseline.is_active ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-medium">{baseline.name}</span>
                  {baseline.is_active && (
                    <span className="ml-2 px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">Active</span>
                  )}
                </div>
                <span className="text-sm text-gray-500">{baseline.task_count} tasks</span>
              </div>
              <div className="text-xs text-gray-400 mt-1">
                Created {new Date(baseline.baseline_date).toLocaleDateString()}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Comparison results */}
      {comparison && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <h4 className="font-medium text-gray-700 mb-3">Variance Summary</h4>
          <div className="grid grid-cols-3 gap-3 text-sm">
            <div className="bg-red-50 rounded p-2 text-center">
              <div className="text-xl font-bold text-red-600">{comparison.summary?.delayed_tasks || 0}</div>
              <div className="text-xs text-red-600">Delayed</div>
            </div>
            <div className="bg-green-50 rounded p-2 text-center">
              <div className="text-xl font-bold text-green-600">{comparison.summary?.ahead_tasks || 0}</div>
              <div className="text-xs text-green-600">Ahead</div>
            </div>
            <div className="bg-gray-50 rounded p-2 text-center">
              <div className="text-xl font-bold text-gray-600">{comparison.summary?.on_track_tasks || 0}</div>
              <div className="text-xs text-gray-600">On Track</div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ============================================
// Import/Export Panel
// ============================================

export const ImportExportPanel = ({ constructionId, constructionName }) => {
  const [importing, setImporting] = useState(false)
  const [exporting, setExporting] = useState(false)

  const handleImport = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    setImporting(true)
    const formData = new FormData()
    formData.append('file', file)
    formData.append('construction_id', constructionId)

    try {
      const res = await api.post('/api/v1/sm_integrations/import_ms_project', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      alert(`Imported ${res.data.tasks_imported} tasks successfully!`)
      window.location.reload()
    } catch (err) {
      console.error('Import failed:', err)
      alert('Import failed: ' + (err.response?.data?.error || err.message))
    } finally {
      setImporting(false)
    }
  }

  const handleExport = async () => {
    setExporting(true)
    try {
      const res = await api.get(`/api/v1/sm_integrations/export_ms_project`, {
        params: { construction_id: constructionId },
        responseType: 'blob'
      })

      const url = window.URL.createObjectURL(new Blob([res.data]))
      const link = document.createElement('a')
      link.href = url
      link.download = `${constructionName?.replace(/\s+/g, '-') || 'schedule'}.xml`
      link.click()
      window.URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Export failed:', err)
      alert('Export failed')
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <h3 className="font-semibold text-gray-900 mb-4">Import / Export</h3>

      <div className="flex gap-3">
        <label className="flex-1">
          <input
            type="file"
            accept=".xml"
            onChange={handleImport}
            className="hidden"
            disabled={importing}
          />
          <div className="flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-blue-500 hover:bg-blue-50 transition-colors">
            <DocumentArrowUpIcon className="w-5 h-5 text-gray-400" />
            <span className="text-sm text-gray-600">
              {importing ? 'Importing...' : 'Import MS Project XML'}
            </span>
          </div>
        </label>

        <button
          onClick={handleExport}
          disabled={exporting}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
        >
          <DocumentArrowDownIcon className="w-5 h-5 text-gray-600" />
          <span className="text-sm text-gray-700">
            {exporting ? 'Exporting...' : 'Export MS Project XML'}
          </span>
        </button>
      </div>
    </div>
  )
}

export default {
  CriticalPathView,
  EvmDashboard,
  AiSuggestionsPanel,
  BaselineComparison,
  ImportExportPanel
}
