import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import axios from 'axios'
import {
  BriefcaseIcon,
  DocumentTextIcon,
  DocumentDuplicateIcon,
  TrophyIcon,
  ClockIcon,
  CheckCircleIcon,
  XCircleIcon
} from '@heroicons/react/24/outline'

export default function PortalDashboard() {
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState(null)
  const [recentJobs, setRecentJobs] = useState([])
  const [pendingQuotes, setPendingQuotes] = useState([])
  const [kudosScore, setKudosScore] = useState(null)

  useEffect(() => {
    loadDashboardData()
  }, [])

  const loadDashboardData = async () => {
    try {
      const token = localStorage.getItem('portal_token')
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`

      // Load dashboard data in parallel
      const [jobsRes, quotesRes, kudosRes] = await Promise.all([
        axios.get('/api/v1/portal/jobs'),
        axios.get('/api/v1/portal/quote_requests'),
        axios.get('/api/v1/portal/kudos')
      ])

      if (jobsRes.data.success) {
        setRecentJobs(jobsRes.data.data.in_progress.slice(0, 5))
        setStats({
          activeJobs: jobsRes.data.data.in_progress.length,
          completedJobs: jobsRes.data.data.completed.length
        })
      }

      if (quotesRes.data.success) {
        setPendingQuotes(quotesRes.data.data.pending.slice(0, 5))
      }

      if (kudosRes.data.success) {
        setKudosScore(kudosRes.data.data)
      }
    } catch (error) {
      console.error('Failed to load dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    )
  }

  const statCards = [
    {
      name: 'Active Jobs',
      value: stats?.activeJobs || 0,
      icon: BriefcaseIcon,
      link: '/portal/jobs',
      color: 'bg-blue-500'
    },
    {
      name: 'Pending Quotes',
      value: pendingQuotes.length,
      icon: DocumentTextIcon,
      link: '/portal/quotes',
      color: 'bg-yellow-500'
    },
    {
      name: 'Kudos Score',
      value: kudosScore?.kudos_score?.toFixed(0) || 0,
      icon: TrophyIcon,
      link: '/portal/kudos',
      color: 'bg-purple-500'
    },
    {
      name: 'Completed Jobs',
      value: stats?.completedJobs || 0,
      icon: CheckCircleIcon,
      link: '/portal/jobs',
      color: 'bg-green-500'
    }
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="mt-1 text-sm text-gray-500">
          Welcome back! Here's what's happening with your jobs and quotes.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat) => (
          <Link
            key={stat.name}
            to={stat.link}
            className="bg-white overflow-hidden shadow rounded-lg hover:shadow-md transition-shadow"
          >
            <div className="p-5">
              <div className="flex items-center">
                <div className={`flex-shrink-0 ${stat.color} rounded-md p-3`}>
                  <stat.icon className="h-6 w-6 text-white" aria-hidden="true" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      {stat.name}
                    </dt>
                    <dd className="text-2xl font-semibold text-gray-900">
                      {stat.value}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Pending Quotes */}
      {pendingQuotes.length > 0 && (
        <div className="bg-white shadow rounded-lg">
          <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-medium text-gray-900">Pending Quote Requests</h2>
              <Link
                to="/portal/quotes"
                className="text-sm font-medium text-indigo-600 hover:text-indigo-500"
              >
                View all
              </Link>
            </div>
          </div>
          <ul role="list" className="divide-y divide-gray-200">
            {pendingQuotes.map((quote) => (
              <li key={quote.id} className="px-4 py-4 sm:px-6 hover:bg-gray-50">
                <Link to={`/portal/quotes/${quote.id}`} className="block">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {quote.title}
                      </p>
                      <p className="text-sm text-gray-500">
                        {quote.construction.name}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        Waiting {quote.days_waiting} days
                      </p>
                    </div>
                    <div className="ml-4 flex-shrink-0">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                        Respond Now
                      </span>
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Active Jobs */}
      {recentJobs.length > 0 && (
        <div className="bg-white shadow rounded-lg">
          <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-medium text-gray-900">Active Jobs</h2>
              <Link
                to="/portal/jobs"
                className="text-sm font-medium text-indigo-600 hover:text-indigo-500"
              >
                View all
              </Link>
            </div>
          </div>
          <ul role="list" className="divide-y divide-gray-200">
            {recentJobs.map((job) => (
              <li key={job.id} className="px-4 py-4 sm:px-6 hover:bg-gray-50">
                <Link to={`/portal/jobs/${job.id}`} className="block">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {job.construction.name}
                      </p>
                      <p className="text-sm text-gray-500">
                        PO: {job.po_number}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        {job.construction.address}
                      </p>
                    </div>
                    <div className="ml-4 flex-shrink-0">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        job.is_arrived
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {job.is_arrived ? 'In Progress' : 'Scheduled'}
                      </span>
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Kudos Summary */}
      {kudosScore && (
        <div className="bg-gradient-to-r from-purple-500 to-indigo-600 shadow rounded-lg overflow-hidden">
          <div className="px-4 py-5 sm:p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <TrophyIcon className="h-12 w-12 text-white" aria-hidden="true" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-purple-100 truncate">
                    Your Kudos Score
                  </dt>
                  <dd className="flex items-baseline">
                    <div className="text-3xl font-semibold text-white">
                      {kudosScore.kudos_score.toFixed(0)}
                    </div>
                    <div className="ml-2 flex items-baseline text-sm font-semibold text-purple-100">
                      {kudosScore.tier}
                    </div>
                  </dd>
                </dl>
              </div>
              <div className="ml-5 flex-shrink-0">
                <Link
                  to="/portal/kudos"
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-indigo-600 bg-white hover:bg-gray-50"
                >
                  View Details
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
