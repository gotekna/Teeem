import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import axios from 'axios'
import {
  BriefcaseIcon,
  ClockIcon,
  CheckCircleIcon,
  CalendarIcon,
  MapPinIcon
} from '@heroicons/react/24/outline'

export default function PortalJobs() {
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('upcoming')
  const [jobs, setJobs] = useState({
    upcoming: [],
    in_progress: [],
    completed: []
  })

  useEffect(() => {
    loadJobs()
  }, [])

  const loadJobs = async () => {
    try {
      const token = localStorage.getItem('portal_token')
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`

      const response = await axios.get('/api/v1/portal/jobs')

      if (response.data.success) {
        setJobs(response.data.data)
      }
    } catch (error) {
      console.error('Failed to load jobs:', error)
    } finally {
      setLoading(false)
    }
  }

  const tabs = [
    { key: 'upcoming', name: 'Upcoming', count: jobs.upcoming.length, icon: CalendarIcon, color: 'blue' },
    { key: 'in_progress', name: 'In Progress', count: jobs.in_progress.length, icon: ClockIcon, color: 'yellow' },
    { key: 'completed', name: 'Completed', count: jobs.completed.length, icon: CheckCircleIcon, color: 'green' }
  ]

  const getStatusBadge = (job) => {
    if (job.is_completed) {
      return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">Completed</span>
    }
    if (job.is_arrived) {
      return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">In Progress</span>
    }
    return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">Upcoming</span>
  }

  const formatDate = (dateString) => {
    if (!dateString) return null
    const date = new Date(dateString)
    return date.toLocaleDateString('en-AU', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    )
  }

  const currentJobs = jobs[activeTab] || []

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Jobs</h1>
        <p className="mt-1 text-sm text-gray-500">
          Track your active and completed jobs
        </p>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8" aria-label="Tabs">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.key
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`
                  ${isActive
                    ? 'border-indigo-500 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }
                  whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm
                  flex items-center gap-2
                `}
              >
                <tab.icon className="h-5 w-5" />
                {tab.name}
                <span className={`
                  ml-2 py-0.5 px-2.5 rounded-full text-xs font-medium
                  ${isActive ? 'bg-indigo-100 text-indigo-600' : 'bg-gray-100 text-gray-600'}
                `}>
                  {tab.count}
                </span>
              </button>
            )
          })}
        </nav>
      </div>

      {/* Job List */}
      {currentJobs.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg shadow">
          <BriefcaseIcon className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">No {activeTab.replace('_', ' ')} jobs</h3>
          <p className="mt-1 text-sm text-gray-500">
            {activeTab === 'upcoming'
              ? "You don't have any upcoming jobs scheduled."
              : `No jobs in ${activeTab.replace('_', ' ')} status.`
            }
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {currentJobs.map((job) => (
            <Link
              key={job.id}
              to={`/portal/jobs/${job.id}`}
              className="bg-white rounded-lg shadow hover:shadow-md transition-shadow overflow-hidden"
            >
              <div className="p-5">
                {/* Header */}
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-medium text-gray-900 truncate">
                      {job.construction.name}
                    </h3>
                    <p className="mt-1 text-sm text-gray-500 truncate">
                      PO: {job.po_number}
                    </p>
                  </div>
                  {getStatusBadge(job)}
                </div>

                {/* Amount */}
                <div className="mt-4">
                  <div className="flex items-baseline">
                    <span className="text-2xl font-bold text-gray-900">
                      ${job.total?.toLocaleString()}
                    </span>
                  </div>
                </div>

                {/* Location */}
                <div className="mt-4 flex items-start text-sm text-gray-500">
                  <MapPinIcon className="flex-shrink-0 mr-1.5 h-5 w-5 text-gray-400" />
                  <div className="flex-1">
                    <p>{job.construction.address}</p>
                    <p>{job.construction.city}, {job.construction.state} {job.construction.postcode}</p>
                  </div>
                </div>

                {/* Timestamps */}
                <div className="mt-4 border-t border-gray-200 pt-4 space-y-2">
                  {job.arrived_at && (
                    <div className="flex items-center text-xs text-gray-500">
                      <ClockIcon className="h-4 w-4 mr-1 text-gray-400" />
                      Arrived: {formatDate(job.arrived_at)}
                    </div>
                  )}
                  {job.completed_at && (
                    <div className="flex items-center text-xs text-gray-500">
                      <CheckCircleIcon className="h-4 w-4 mr-1 text-green-500" />
                      Completed: {formatDate(job.completed_at)}
                    </div>
                  )}
                  {job.days_on_site !== null && job.days_on_site !== undefined && (
                    <div className="flex items-center text-xs text-gray-500">
                      <CalendarIcon className="h-4 w-4 mr-1 text-gray-400" />
                      Time on site: {job.days_on_site.toFixed(1)} days
                    </div>
                  )}
                </div>

                {/* Invoice Status */}
                {job.invoice_status !== 'not_invoiced' && (
                  <div className="mt-3">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      job.invoice_status === 'paid'
                        ? 'bg-green-100 text-green-800'
                        : job.invoice_status === 'synced'
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      Invoice: {job.invoice_status}
                    </span>
                  </div>
                )}

                {/* Action needed for upcoming jobs */}
                {activeTab === 'upcoming' && !job.is_arrived && (
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <span className="text-xs font-medium text-indigo-600">
                      → Mark arrival when on site
                    </span>
                  </div>
                )}

                {/* Action needed for in progress jobs */}
                {activeTab === 'in_progress' && job.is_arrived && !job.is_completed && (
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <span className="text-xs font-medium text-indigo-600">
                      → Mark complete when finished
                    </span>
                  </div>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
