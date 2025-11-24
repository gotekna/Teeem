import { useState, useEffect, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  ChartBarIcon,
  ClockIcon,
  CurrencyDollarIcon,
  CalendarDaysIcon,
  UserGroupIcon,
  ArrowPathIcon,
  ArrowDownTrayIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  PlayIcon
} from '@heroicons/react/24/outline'
import {
  StatCard,
  ProgressRing,
  TrendChart,
  DonutChart,
  HorizontalBarChart,
  CostBreakdownTable
} from '../components/sm-gantt/SmDashboardCharts'
import { api } from '../api'

// Tab definitions
const TABS = [
  { id: 'overview', name: 'Overview', icon: ChartBarIcon },
  { id: 'utilization', name: 'Utilization', icon: UserGroupIcon },
  { id: 'costs', name: 'Costs', icon: CurrencyDollarIcon },
  { id: 'forecast', name: 'Forecast', icon: CalendarDaysIcon }
]

// Alert component
const Alert = ({ type, message, resourceName }) => {
  const styles = {
    warning: 'bg-amber-50 border-amber-200 text-amber-800',
    info: 'bg-blue-50 border-blue-200 text-blue-800',
    error: 'bg-red-50 border-red-200 text-red-800'
  }

  return (
    <div className={`px-3 py-2 rounded-lg border text-sm ${styles[type] || styles.info}`}>
      {resourceName && <span className="font-medium">{resourceName}:</span>} {message}
    </div>
  )
}

export default function SmDashboardPage() {
  const { constructionId } = useParams()

  const [activeTab, setActiveTab] = useState('overview')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Data states
  const [dashboardData, setDashboardData] = useState(null)
  const [utilizationData, setUtilizationData] = useState(null)
  const [costData, setCostData] = useState(null)
  const [trendsData, setTrendsData] = useState(null)
  const [forecastData, setForecastData] = useState(null)

  // Date range for reports
  const [dateRange, setDateRange] = useState({
    start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  })

  // Fetch dashboard data
  const fetchDashboard = useCallback(async () => {
    try {
      const res = await api.get('/api/v1/sm_reports/dashboard', {
        params: { construction_id: constructionId }
      })
      setDashboardData(res.data)
    } catch (err) {
      console.error('Dashboard fetch error:', err)
    }
  }, [constructionId])

  // Fetch utilization data
  const fetchUtilization = useCallback(async () => {
    try {
      const res = await api.get('/api/v1/sm_reports/utilization', {
        params: {
          construction_id: constructionId,
          start_date: dateRange.start,
          end_date: dateRange.end
        }
      })
      setUtilizationData(res.data)
    } catch (err) {
      console.error('Utilization fetch error:', err)
    }
  }, [constructionId, dateRange])

  // Fetch cost data
  const fetchCosts = useCallback(async () => {
    try {
      const res = await api.get('/api/v1/sm_reports/costs', {
        params: {
          construction_id: constructionId,
          start_date: dateRange.start,
          end_date: dateRange.end
        }
      })
      setCostData(res.data)
    } catch (err) {
      console.error('Costs fetch error:', err)
    }
  }, [constructionId, dateRange])

  // Fetch trends data
  const fetchTrends = useCallback(async () => {
    try {
      const res = await api.get('/api/v1/sm_reports/trends', {
        params: { construction_id: constructionId, weeks: 8 }
      })
      setTrendsData(res.data.weeks || [])
    } catch (err) {
      console.error('Trends fetch error:', err)
    }
  }, [constructionId])

  // Fetch forecast data
  const fetchForecast = useCallback(async () => {
    try {
      const res = await api.get('/api/v1/sm_reports/forecast', {
        params: { construction_id: constructionId, days: 14 }
      })
      setForecastData(res.data)
    } catch (err) {
      console.error('Forecast fetch error:', err)
    }
  }, [constructionId])

  // Initial load
  useEffect(() => {
    const loadData = async () => {
      setLoading(true)
      setError(null)
      try {
        await Promise.all([
          fetchDashboard(),
          fetchUtilization(),
          fetchCosts(),
          fetchTrends(),
          fetchForecast()
        ])
      } catch (err) {
        setError('Failed to load dashboard data')
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [fetchDashboard, fetchUtilization, fetchCosts, fetchTrends, fetchForecast])

  // Export handler
  const handleExport = async (type) => {
    try {
      const res = await api.get('/api/v1/sm_reports/export', {
        params: {
          construction_id: constructionId,
          type,
          format: 'csv',
          start_date: dateRange.start,
          end_date: dateRange.end
        },
        responseType: 'blob'
      })

      const url = URL.createObjectURL(res.data)
      const a = document.createElement('a')
      a.href = url
      a.download = `sm_${type}_report.csv`
      a.click()
    } catch (err) {
      console.error('Export error:', err)
      alert('Failed to export report')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <ArrowPathIcon className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    )
  }

  const projectSummary = dashboardData?.project_summary
  const tradeBreakdown = dashboardData?.trade_breakdown || []

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ChartBarIcon className="w-8 h-8 text-gray-400" />
            <div>
              <h1 className="text-xl font-semibold text-gray-900">SM Gantt Dashboard</h1>
              <p className="text-sm text-gray-500">
                Project analytics and resource reports
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Date range picker */}
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={dateRange.start}
                onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                className="border border-gray-300 rounded-md px-2 py-1 text-sm"
              />
              <span className="text-gray-400">to</span>
              <input
                type="date"
                value={dateRange.end}
                onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                className="border border-gray-300 rounded-md px-2 py-1 text-sm"
              />
            </div>

            <button
              onClick={() => Promise.all([fetchUtilization(), fetchCosts()])}
              className="p-2 border border-gray-300 rounded-md hover:bg-gray-50"
              title="Refresh"
            >
              <ArrowPathIcon className="w-5 h-5" />
            </button>

            <div className="relative group">
              <button className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-md hover:bg-gray-50">
                <ArrowDownTrayIcon className="w-4 h-4" />
                Export
              </button>
              <div className="absolute right-0 mt-1 w-40 bg-white rounded-lg shadow-lg border border-gray-200 hidden group-hover:block z-10">
                <button
                  onClick={() => handleExport('utilization')}
                  className="block w-full text-left px-4 py-2 text-sm hover:bg-gray-50"
                >
                  Utilization CSV
                </button>
                <button
                  onClick={() => handleExport('costs')}
                  className="block w-full text-left px-4 py-2 text-sm hover:bg-gray-50"
                >
                  Costs CSV
                </button>
                <button
                  onClick={() => handleExport('trends')}
                  className="block w-full text-left px-4 py-2 text-sm hover:bg-gray-50"
                >
                  Trends CSV
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mt-4">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-t-lg border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'bg-white border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.name}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        )}

        {/* Overview Tab */}
        {activeTab === 'overview' && projectSummary && (
          <div className="space-y-6">
            {/* Stats row */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard
                title="Total Tasks"
                value={projectSummary.task_counts.total}
                subtitle={`${projectSummary.task_counts.completed} completed`}
                icon={CalendarDaysIcon}
                color="blue"
              />
              <StatCard
                title="In Progress"
                value={projectSummary.task_counts.in_progress}
                icon={PlayIcon}
                color="amber"
              />
              <StatCard
                title="Overdue"
                value={projectSummary.schedule_health.overdue}
                subtitle={`${projectSummary.schedule_health.due_this_week} due this week`}
                icon={ExclamationTriangleIcon}
                color={projectSummary.schedule_health.overdue > 0 ? 'red' : 'green'}
              />
              <StatCard
                title="On Hold"
                value={projectSummary.task_counts.on_hold}
                icon={ClockIcon}
                color="indigo"
              />
            </div>

            {/* Progress and charts */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Progress ring */}
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h3 className="font-medium mb-4">Overall Progress</h3>
                <div className="flex justify-center">
                  <ProgressRing
                    value={projectSummary.progress.percentage}
                    size={160}
                    color={projectSummary.progress.percentage >= 80 ? '#22c55e' : '#3b82f6'}
                  />
                </div>
                <div className="mt-4 text-center text-sm text-gray-500">
                  {projectSummary.progress.completed} of {projectSummary.task_counts.total} tasks completed
                </div>
              </div>

              {/* Task status donut */}
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h3 className="font-medium mb-4">Task Status</h3>
                <DonutChart
                  data={[
                    { label: 'Completed', value: projectSummary.task_counts.completed, color: '#22c55e' },
                    { label: 'In Progress', value: projectSummary.task_counts.in_progress, color: '#3b82f6' },
                    { label: 'Not Started', value: projectSummary.task_counts.not_started, color: '#9ca3af' }
                  ]}
                  size={120}
                />
              </div>

              {/* Schedule health */}
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h3 className="font-medium mb-4">Schedule Health</h3>
                <div className="flex justify-center mb-4">
                  <ProgressRing
                    value={projectSummary.schedule_health.health_score}
                    size={120}
                    color={projectSummary.schedule_health.health_score >= 80 ? '#22c55e' : projectSummary.schedule_health.health_score >= 50 ? '#f59e0b' : '#ef4444'}
                  />
                </div>
                <div className="text-center">
                  <div className="text-sm text-gray-500">Health Score</div>
                  {projectSummary.timeline.days_remaining && (
                    <div className="text-sm text-gray-600 mt-2">
                      {projectSummary.timeline.days_remaining} days remaining
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Trends and trades */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Weekly trends */}
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h3 className="font-medium mb-4">Weekly Trends</h3>
                {trendsData && trendsData.length > 0 ? (
                  <TrendChart
                    data={trendsData.map(w => ({
                      label: w.week_label,
                      value: w.hours_logged
                    }))}
                    height={200}
                  />
                ) : (
                  <div className="h-48 flex items-center justify-center text-gray-400">
                    No trend data available
                  </div>
                )}
              </div>

              {/* Trade breakdown */}
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h3 className="font-medium mb-4">Progress by Trade</h3>
                {tradeBreakdown.length > 0 ? (
                  <HorizontalBarChart
                    data={tradeBreakdown.slice(0, 6).map(t => ({
                      label: t.trade,
                      value: t.progress,
                      color: t.progress >= 80 ? 'green' : t.progress >= 50 ? 'blue' : 'gray'
                    }))}
                    maxValue={100}
                  />
                ) : (
                  <div className="h-48 flex items-center justify-center text-gray-400">
                    No trade data available
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Utilization Tab */}
        {activeTab === 'utilization' && utilizationData && (
          <div className="space-y-6">
            {/* Totals */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <StatCard
                title="Total Capacity"
                value={`${utilizationData.totals?.capacity || 0}h`}
                icon={ClockIcon}
                color="gray"
              />
              <StatCard
                title="Allocated"
                value={`${utilizationData.totals?.allocated || 0}h`}
                icon={UserGroupIcon}
                color="blue"
              />
              <StatCard
                title="Logged"
                value={`${utilizationData.totals?.logged || 0}h`}
                icon={CheckCircleIcon}
                color="green"
              />
              <StatCard
                title="Utilization"
                value={`${utilizationData.totals?.utilization || 0}%`}
                icon={ChartBarIcon}
                color={utilizationData.totals?.utilization > 80 ? 'amber' : 'blue'}
              />
            </div>

            {/* Alerts */}
            {utilizationData.alerts && utilizationData.alerts.length > 0 && (
              <div className="bg-white rounded-lg border border-gray-200 p-4">
                <h3 className="font-medium mb-3">Alerts</h3>
                <div className="space-y-2">
                  {utilizationData.alerts.map((alert, i) => (
                    <Alert
                      key={i}
                      type={alert.severity}
                      message={alert.message}
                      resourceName={alert.resource_name}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Resource list */}
            <div className="bg-white rounded-lg border border-gray-200">
              <div className="px-4 py-3 border-b border-gray-200">
                <h3 className="font-medium">Resource Utilization</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="text-left text-xs font-medium text-gray-500 py-3 px-4">Resource</th>
                      <th className="text-left text-xs font-medium text-gray-500 py-3 px-4">Type</th>
                      <th className="text-right text-xs font-medium text-gray-500 py-3 px-4">Capacity</th>
                      <th className="text-right text-xs font-medium text-gray-500 py-3 px-4">Allocated</th>
                      <th className="text-right text-xs font-medium text-gray-500 py-3 px-4">Logged</th>
                      <th className="text-right text-xs font-medium text-gray-500 py-3 px-4">Utilization</th>
                      <th className="text-center text-xs font-medium text-gray-500 py-3 px-4">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(utilizationData.resources || []).map((r, i) => (
                      <tr key={i} className="border-t border-gray-100 hover:bg-gray-50">
                        <td className="py-3 px-4">
                          <Link to={`/admin/resources?resource=${r.id}`} className="text-blue-600 hover:underline">
                            {r.name}
                          </Link>
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-500">{r.type}</td>
                        <td className="py-3 px-4 text-sm text-right">{r.capacity}h</td>
                        <td className="py-3 px-4 text-sm text-right">{r.allocated}h</td>
                        <td className="py-3 px-4 text-sm text-right">{r.logged}h</td>
                        <td className="py-3 px-4 text-sm text-right font-medium">{r.utilization}%</td>
                        <td className="py-3 px-4 text-center">
                          <span className={`px-2 py-1 text-xs rounded-full ${
                            r.status === 'over' ? 'bg-red-100 text-red-700' :
                            r.status === 'high' ? 'bg-amber-100 text-amber-700' :
                            r.status === 'optimal' ? 'bg-green-100 text-green-700' :
                            'bg-gray-100 text-gray-700'
                          }`}>
                            {r.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Costs Tab */}
        {activeTab === 'costs' && costData && (
          <div className="space-y-6">
            {/* Summary stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <StatCard
                title="Total Cost"
                value={`$${costData.summary?.total_cost?.toLocaleString() || 0}`}
                icon={CurrencyDollarIcon}
                color="blue"
              />
              {costData.summary?.budget && (
                <StatCard
                  title="Budget"
                  value={`$${costData.summary.budget.toLocaleString()}`}
                  icon={CurrencyDollarIcon}
                  color="gray"
                />
              )}
              {costData.summary?.variance !== null && (
                <StatCard
                  title="Variance"
                  value={`$${Math.abs(costData.summary.variance).toLocaleString()}`}
                  subtitle={costData.summary.variance >= 0 ? 'Under budget' : 'Over budget'}
                  icon={CurrencyDollarIcon}
                  color={costData.summary.variance >= 0 ? 'green' : 'red'}
                />
              )}
              <StatCard
                title="Total Hours"
                value={`${costData.hours_summary?.total || 0}h`}
                subtitle={`${costData.hours_summary?.overtime || 0}h overtime`}
                icon={ClockIcon}
                color="indigo"
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Cost by trade */}
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h3 className="font-medium mb-4">Cost by Trade</h3>
                {costData.by_trade && Object.keys(costData.by_trade).length > 0 ? (
                  <HorizontalBarChart
                    data={Object.entries(costData.by_trade).slice(0, 8).map(([trade, cost]) => ({
                      label: trade,
                      value: cost
                    }))}
                  />
                ) : (
                  <div className="h-48 flex items-center justify-center text-gray-400">
                    No cost data by trade
                  </div>
                )}
              </div>

              {/* Top tasks by cost */}
              {costData.top_tasks && costData.top_tasks.length > 0 && (
                <CostBreakdownTable
                  title="Top Tasks by Cost"
                  data={costData.top_tasks.map(t => ({
                    label: t.task_name,
                    hours: t.hours,
                    cost: t.cost
                  }))}
                />
              )}
            </div>
          </div>
        )}

        {/* Forecast Tab */}
        {activeTab === 'forecast' && forecastData && (
          <div className="space-y-6">
            {/* Summary */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <StatCard
                title="Tasks Starting"
                value={forecastData.summary?.total_tasks_starting || 0}
                subtitle="Next 14 days"
                icon={CalendarDaysIcon}
                color="blue"
              />
              <StatCard
                title="Hours Allocated"
                value={`${forecastData.summary?.total_allocated_hours || 0}h`}
                icon={ClockIcon}
                color="indigo"
              />
              <StatCard
                title="Resources Needed"
                value={forecastData.summary?.resources_involved || 0}
                icon={UserGroupIcon}
                color="green"
              />
            </div>

            {/* Day-by-day forecast */}
            <div className="bg-white rounded-lg border border-gray-200">
              <div className="px-4 py-3 border-b border-gray-200">
                <h3 className="font-medium">Upcoming Schedule</h3>
              </div>
              <div className="divide-y divide-gray-100">
                {(forecastData.days || []).map((day, i) => (
                  <div
                    key={i}
                    className={`px-4 py-3 flex items-center justify-between ${
                      day.is_weekend ? 'bg-gray-50' : ''
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-20">
                        <div className="text-sm font-medium">{day.day_name}</div>
                        <div className="text-xs text-gray-500">
                          {new Date(day.date).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {day.tasks.slice(0, 3).map((task, ti) => (
                          <span
                            key={ti}
                            className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded"
                          >
                            {task.name}
                          </span>
                        ))}
                        {day.tasks.length > 3 && (
                          <span className="text-xs text-gray-500">
                            +{day.tasks.length - 3} more
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-6 text-sm">
                      <div>
                        <span className="text-gray-500">Tasks:</span>{' '}
                        <span className="font-medium">{day.tasks_starting}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Hours:</span>{' '}
                        <span className="font-medium">{day.allocated_hours}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Resources:</span>{' '}
                        <span className="font-medium">{day.resources_needed}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
