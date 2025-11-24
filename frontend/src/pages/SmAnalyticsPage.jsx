import { useState, useEffect } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import {
  ChartBarIcon,
  CpuChipIcon,
  ClockIcon,
  ArrowPathIcon,
  Cog6ToothIcon
} from '@heroicons/react/24/outline'
import {
  CriticalPathView,
  EvmDashboard,
  AiSuggestionsPanel,
  BaselineComparison,
  ImportExportPanel
} from '../components/sm-gantt/SmAnalyticsComponents'
import { api } from '../api'

export default function SmAnalyticsPage() {
  const { id: constructionId } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const activeTab = searchParams.get('tab') || 'overview'

  const [construction, setConstruction] = useState(null)
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [constructionRes, summaryRes] = await Promise.all([
          api.get(`/api/v1/constructions/${constructionId}`),
          api.get(`/api/v1/constructions/${constructionId}/sm_analytics/summary`)
        ])
        setConstruction(constructionRes.data.construction || constructionRes.data)
        setSummary(summaryRes.data.summary)
      } catch (err) {
        console.error('Failed to fetch data:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [constructionId])

  const setTab = (tab) => {
    setSearchParams({ tab })
  }

  const tabs = [
    { id: 'overview', label: 'Overview', icon: ChartBarIcon },
    { id: 'critical-path', label: 'Critical Path', icon: ClockIcon },
    { id: 'ai', label: 'AI Insights', icon: CpuChipIcon },
    { id: 'integrations', label: 'Integrations', icon: Cog6ToothIcon }
  ]

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <ArrowPathIcon className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    )
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Analytics & Insights</h1>
        <p className="text-gray-500">{construction?.name}</p>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="text-sm text-gray-500">Project Duration</div>
            <div className="text-2xl font-bold text-gray-900">
              {summary.critical_path?.duration_days || 0} days
            </div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="text-sm text-gray-500">Schedule Performance</div>
            <div className={`text-2xl font-bold ${summary.evm?.spi >= 1 ? 'text-green-600' : 'text-red-600'}`}>
              {summary.evm?.spi?.toFixed(2) || '-'} SPI
            </div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="text-sm text-gray-500">Cost Performance</div>
            <div className={`text-2xl font-bold ${summary.evm?.cpi >= 1 ? 'text-green-600' : 'text-red-600'}`}>
              {summary.evm?.cpi?.toFixed(2) || '-'} CPI
            </div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="text-sm text-gray-500">Completion</div>
            <div className="text-2xl font-bold text-blue-600">
              {summary.evm?.percent_complete?.toFixed(0) || 0}%
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="flex gap-4">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="space-y-6">
        {activeTab === 'overview' && (
          <>
            <div className="grid md:grid-cols-2 gap-6">
              <EvmDashboard constructionId={constructionId} />
              <CriticalPathView constructionId={constructionId} />
            </div>
            <div className="grid md:grid-cols-2 gap-6">
              <AiSuggestionsPanel constructionId={constructionId} />
              <BaselineComparison constructionId={constructionId} />
            </div>
          </>
        )}

        {activeTab === 'critical-path' && (
          <div className="space-y-6">
            <CriticalPathView constructionId={constructionId} />
            <BaselineComparison constructionId={constructionId} />
          </div>
        )}

        {activeTab === 'ai' && (
          <div className="grid md:grid-cols-2 gap-6">
            <AiSuggestionsPanel constructionId={constructionId} />
            <div className="space-y-6">
              <div className="bg-white rounded-lg border border-gray-200 p-4">
                <h3 className="font-semibold text-gray-900 mb-4">AI Features</h3>
                <ul className="space-y-2 text-sm text-gray-600">
                  <li className="flex items-center gap-2">
                    <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                    Scheduling optimization suggestions
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                    Delay risk predictions
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                    Resource conflict detection
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                    Critical path analysis
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-2 h-2 bg-yellow-500 rounded-full"></span>
                    Duration estimation (based on historical data)
                  </li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'integrations' && (
          <div className="grid md:grid-cols-2 gap-6">
            <ImportExportPanel
              constructionId={constructionId}
              constructionName={construction?.name}
            />
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <h3 className="font-semibold text-gray-900 mb-4">Calendar Sync</h3>
              <div className="space-y-3">
                <button className="w-full flex items-center gap-3 px-4 py-3 border border-gray-200 rounded-lg hover:bg-gray-50">
                  <img src="https://www.gstatic.com/images/branding/product/1x/calendar_48dp.png" alt="Google" className="w-6 h-6" />
                  <span className="text-sm">Sync with Google Calendar</span>
                </button>
                <button className="w-full flex items-center gap-3 px-4 py-3 border border-gray-200 rounded-lg hover:bg-gray-50">
                  <img src="https://res.cdn.office.net/assets/mail/pwa/v1/pngs/outlook-icon-144-fluent.png" alt="Outlook" className="w-6 h-6" />
                  <span className="text-sm">Sync with Outlook Calendar</span>
                </button>
              </div>
              <p className="text-xs text-gray-400 mt-3">
                Calendar sync requires OAuth authorization
              </p>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <h3 className="font-semibold text-gray-900 mb-4">Notifications</h3>
              <div className="space-y-3 text-sm">
                <label className="flex items-center justify-between">
                  <span>Task reminders</span>
                  <input type="checkbox" defaultChecked className="rounded text-blue-600" />
                </label>
                <label className="flex items-center justify-between">
                  <span>Schedule updates</span>
                  <input type="checkbox" defaultChecked className="rounded text-blue-600" />
                </label>
                <label className="flex items-center justify-between">
                  <span>Delay alerts</span>
                  <input type="checkbox" defaultChecked className="rounded text-blue-600" />
                </label>
                <label className="flex items-center justify-between">
                  <span>Push notifications</span>
                  <input type="checkbox" className="rounded text-blue-600" />
                </label>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
