import { useState, useEffect } from 'react'
import axios from 'axios'
import {
  TrophyIcon,
  ChartBarIcon,
  ClockIcon,
  CheckCircleIcon,
  FireIcon
} from '@heroicons/react/24/outline'

export default function PortalKudos() {
  const [loading, setLoading] = useState(true)
  const [kudosData, setKudosData] = useState(null)
  const [activeView, setActiveView] = useState('overview')

  useEffect(() => {
    loadKudosData()
  }, [])

  const loadKudosData = async () => {
    try {
      const token = localStorage.getItem('portal_token')
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`

      const response = await axios.get('/api/v1/portal/kudos')

      if (response.data.success) {
        setKudosData(response.data.data)
      }
    } catch (error) {
      console.error('Failed to load kudos data:', error)
    } finally {
      setLoading(false)
    }
  }

  const getTierColor = (tier) => {
    const colors = {
      bronze: 'from-orange-400 to-orange-600',
      silver: 'from-gray-300 to-gray-500',
      gold: 'from-yellow-400 to-yellow-600',
      platinum: 'from-blue-400 to-blue-600',
      diamond: 'from-purple-400 to-purple-600'
    }
    return colors[tier] || colors.bronze
  }

  const getTierIcon = (tier) => {
    return (
      <div className={`h-20 w-20 rounded-full bg-gradient-to-br ${getTierColor(tier)} flex items-center justify-center`}>
        <TrophyIcon className="h-10 w-10 text-white" />
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    )
  }

  if (!kudosData) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Failed to load kudos data</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Kudos Score</h1>
        <p className="mt-1 text-sm text-gray-500">
          Your performance reputation and ranking
        </p>
      </div>

      {/* Main Score Card */}
      <div className={`bg-gradient-to-br ${getTierColor(kudosData.tier)} rounded-lg shadow-xl overflow-hidden`}>
        <div className="px-6 py-8 sm:p-10">
          <div className="flex flex-col sm:flex-row items-center gap-6">
            {/* Tier Badge */}
            {getTierIcon(kudosData.tier)}

            {/* Score Info */}
            <div className="flex-1 text-center sm:text-left">
              <h2 className="text-sm font-medium text-white/80 uppercase tracking-wide">
                Your Current Tier
              </h2>
              <p className="mt-1 text-4xl font-extrabold text-white capitalize">
                {kudosData.tier}
              </p>
              <div className="mt-4 flex items-baseline gap-2">
                <span className="text-5xl font-bold text-white">
                  {kudosData.kudos_score.toFixed(0)}
                </span>
                <span className="text-xl text-white/80">/ 1000</span>
              </div>
            </div>

            {/* Progress to Next Tier */}
            <div className="w-full sm:w-64 bg-white/10 backdrop-blur-sm rounded-lg p-4">
              <div className="text-sm text-white/90 mb-2">
                Progress to {kudosData.next_tier || 'Max Tier'}
              </div>
              <div className="w-full bg-white/20 rounded-full h-3">
                <div
                  className="bg-white rounded-full h-3 transition-all duration-500"
                  style={{ width: `${kudosData.tier_progress}%` }}
                />
              </div>
              <div className="mt-2 text-xs text-white/80">
                {kudosData.points_to_next_tier > 0
                  ? `${kudosData.points_to_next_tier} points to go`
                  : 'Maximum tier reached!'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <BriefcaseIcon className="h-6 w-6 text-gray-400" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    Total Jobs
                  </dt>
                  <dd className="text-2xl font-semibold text-gray-900">
                    {kudosData.statistics.total_jobs_completed}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <CheckCircleIcon className="h-6 w-6 text-green-400" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    On-Time Arrivals
                  </dt>
                  <dd className="text-2xl font-semibold text-gray-900">
                    {kudosData.statistics.on_time_arrivals}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <CheckCircleIcon className="h-6 w-6 text-green-400" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    On-Time Completions
                  </dt>
                  <dd className="text-2xl font-semibold text-gray-900">
                    {kudosData.statistics.on_time_completions}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <FireIcon className="h-6 w-6 text-orange-400" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    Fast Quotes
                  </dt>
                  <dd className="text-2xl font-semibold text-gray-900">
                    {kudosData.statistics.fast_quote_responses}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Breakdown by Event Type */}
      <div className="bg-white shadow rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          <h3 className="text-lg font-medium leading-6 text-gray-900 mb-4">
            Points Breakdown
          </h3>
          <div className="space-y-4">
            {Object.entries(kudosData.breakdown).map(([eventType, data]) => (
              <div key={eventType} className="border-b border-gray-200 pb-4 last:border-0 last:pb-0">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700 capitalize">
                    {eventType.replace('_', ' ')}
                  </span>
                  <span className="text-sm font-semibold text-gray-900">
                    {data.weighted_points.toFixed(0)} pts
                  </span>
                </div>
                <div className="flex items-center gap-4 text-xs text-gray-500">
                  <span>{data.total_events} events</span>
                  <span>Avg: {data.average_points.toFixed(0)} pts/event</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Events */}
      <div className="bg-white shadow rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          <h3 className="text-lg font-medium leading-6 text-gray-900 mb-4">
            Recent Events
          </h3>
          <div className="space-y-3">
            {kudosData.recent_events.map((event, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <div className={`h-2 w-2 rounded-full ${
                    event.points_awarded > 0 ? 'bg-green-500' : 'bg-red-500'
                  }`} />
                  <div>
                    <p className="text-sm font-medium text-gray-900 capitalize">
                      {event.event_type.replace('_', ' ')}
                    </p>
                    <p className="text-xs text-gray-500">
                      {new Date(event.created_at).toLocaleDateString('en-AU', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric'
                      })}
                    </p>
                  </div>
                </div>
                <div className={`text-sm font-semibold ${
                  event.points_awarded > 0 ? 'text-green-600' : 'text-red-600'
                }`}>
                  {event.points_awarded > 0 ? '+' : ''}{event.points_awarded} pts
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* How to Improve */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h3 className="text-lg font-medium text-blue-900 mb-3 flex items-center gap-2">
          <ChartBarIcon className="h-5 w-5" />
          How to Improve Your Score
        </h3>
        <ul className="space-y-2 text-sm text-blue-800">
          <li className="flex items-start gap-2">
            <CheckCircleIcon className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <span>Respond to quote requests within 2 hours for maximum points (100 pts)</span>
          </li>
          <li className="flex items-start gap-2">
            <CheckCircleIcon className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <span>Arrive on time or early for jobs (100 pts)</span>
          </li>
          <li className="flex items-start gap-2">
            <CheckCircleIcon className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <span>Complete jobs on or before the expected date (100 pts)</span>
          </li>
          <li className="flex items-start gap-2">
            <CheckCircleIcon className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <span>Maintain consistent performance - scores decay over 90 days</span>
          </li>
        </ul>
      </div>
    </div>
  )
}
