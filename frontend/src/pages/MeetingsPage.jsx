import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '../api'
import {
  PlusIcon,
  MagnifyingGlassIcon,
  CalendarIcon,
  UserGroupIcon,
  ClockIcon,
  MapPinIcon,
  VideoCameraIcon,
  CheckCircleIcon,
  XCircleIcon,
  PlayIcon
} from '@heroicons/react/24/outline'
import NewMeetingModal from '../components/meetings/NewMeetingModal'
import Toast from '../components/Toast'

export default function MeetingsPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const constructionId = searchParams.get('construction_id')

  const [meetings, setMeetings] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [showNewMeetingModal, setShowNewMeetingModal] = useState(false)
  const [selectedMeeting, setSelectedMeeting] = useState(null)
  const [toast, setToast] = useState(null)
  const [filterStatus, setFilterStatus] = useState('all') // all, scheduled, in_progress, completed, cancelled

  useEffect(() => {
    loadMeetings()
  }, [constructionId])

  const loadMeetings = async () => {
    try {
      setLoading(true)
      const url = constructionId
        ? `/api/v1/jobs/${constructionId}/meetings`
        : `/api/v1/meetings`
      const response = await api.get(url)

      if (response.success) {
        setMeetings(response.data || [])
      } else {
        setError(response.error || 'Failed to load meetings')
      }
    } catch (err) {
      console.error('Error loading meetings:', err)
      setError('Failed to load meetings')
    } finally {
      setLoading(false)
    }
  }

  const handleCreateMeeting = async (meetingData) => {
    try {
      const url = constructionId
        ? `/api/v1/jobs/${constructionId}/meetings`
        : `/api/v1/meetings`

      const response = await api.post(url, { meeting: meetingData })

      if (response.success) {
        setToast({ type: 'success', message: 'Meeting created successfully' })
        loadMeetings()
        setShowNewMeetingModal(false)
      } else {
        setToast({ type: 'error', message: response.error || 'Failed to create meeting' })
      }
    } catch (err) {
      console.error('Error creating meeting:', err)
      setToast({ type: 'error', message: 'Failed to create meeting' })
    }
  }

  const handleStartMeeting = async (meetingId) => {
    try {
      const response = await api.post(`/api/v1/meetings/${meetingId}/start`)

      if (response.success) {
        setToast({ type: 'success', message: 'Meeting started' })
        loadMeetings()
      } else {
        setToast({ type: 'error', message: response.error || 'Failed to start meeting' })
      }
    } catch (err) {
      console.error('Error starting meeting:', err)
      setToast({ type: 'error', message: 'Failed to start meeting' })
    }
  }

  const handleCompleteMeeting = async (meetingId) => {
    try {
      const response = await api.post(`/api/v1/meetings/${meetingId}/complete`)

      if (response.success) {
        setToast({ type: 'success', message: 'Meeting completed' })
        loadMeetings()
      } else {
        setToast({ type: 'error', message: response.error || 'Failed to complete meeting' })
      }
    } catch (err) {
      console.error('Error completing meeting:', err)
      setToast({ type: 'error', message: 'Failed to complete meeting' })
    }
  }

  const handleCancelMeeting = async (meetingId) => {
    if (!confirm('Are you sure you want to cancel this meeting?')) return

    try {
      const response = await api.post(`/api/v1/meetings/${meetingId}/cancel`)

      if (response.success) {
        setToast({ type: 'success', message: 'Meeting cancelled' })
        loadMeetings()
      } else {
        setToast({ type: 'error', message: response.error || 'Failed to cancel meeting' })
      }
    } catch (err) {
      console.error('Error cancelling meeting:', err)
      setToast({ type: 'error', message: 'Failed to cancel meeting' })
    }
  }

  const handleDeleteMeeting = async (meetingId) => {
    if (!confirm('Are you sure you want to delete this meeting?')) return

    try {
      const response = await api.delete(`/api/v1/meetings/${meetingId}`)

      if (response.success) {
        setToast({ type: 'success', message: 'Meeting deleted' })
        loadMeetings()
      } else {
        setToast({ type: 'error', message: response.error || 'Failed to delete meeting' })
      }
    } catch (err) {
      console.error('Error deleting meeting:', err)
      setToast({ type: 'error', message: 'Failed to delete meeting' })
    }
  }

  const formatDateTime = (dateTimeString) => {
    if (!dateTimeString) return ''
    const date = new Date(dateTimeString)
    return date.toLocaleString('en-AU', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const formatDuration = (startTime, endTime) => {
    if (!startTime || !endTime) return ''
    const start = new Date(startTime)
    const end = new Date(endTime)
    const minutes = Math.floor((end - start) / 60000)
    const hours = Math.floor(minutes / 60)
    const remainingMinutes = minutes % 60

    if (hours > 0) {
      return `${hours}h ${remainingMinutes}m`
    }
    return `${minutes}m`
  }

  const getStatusBadge = (status) => {
    const badges = {
      scheduled: 'bg-blue-100 text-blue-800',
      in_progress: 'bg-yellow-100 text-yellow-800',
      completed: 'bg-green-100 text-green-800',
      cancelled: 'bg-gray-100 text-gray-800'
    }
    return badges[status] || 'bg-gray-100 text-gray-800'
  }

  const getMeetingTypeLabel = (type) => {
    const labels = {
      site_visit: 'Site Visit',
      client_meeting: 'Client Meeting',
      team_meeting: 'Team Meeting',
      safety_meeting: 'Safety Meeting',
      progress_review: 'Progress Review',
      other: 'Other'
    }
    return labels[type] || type
  }

  // Filter and search meetings
  const filteredMeetings = meetings.filter(meeting => {
    // Status filter
    if (filterStatus !== 'all' && meeting.status !== filterStatus) {
      return false
    }

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      return (
        meeting.title.toLowerCase().includes(query) ||
        meeting.location?.toLowerCase().includes(query) ||
        meeting.construction?.name?.toLowerCase().includes(query) ||
        meeting.description?.toLowerCase().includes(query)
      )
    }

    return true
  })

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-500">Loading meetings...</div>
      </div>
    )
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Meetings</h1>
            <p className="mt-1 text-sm text-gray-600">
              {constructionId ? 'Job meetings' : 'All meetings'}
            </p>
          </div>
          <button
            onClick={() => setShowNewMeetingModal(true)}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
          >
            <PlusIcon className="h-5 w-5 mr-2" />
            New Meeting
          </button>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="mb-4 flex gap-4">
        <div className="flex-1 relative">
          <MagnifyingGlassIcon className="h-5 w-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search meetings..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="all">All Status</option>
          <option value="scheduled">Scheduled</option>
          <option value="in_progress">In Progress</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {/* Meetings List */}
      <div className="bg-white shadow overflow-hidden sm:rounded-md">
        {filteredMeetings.length === 0 ? (
          <div className="text-center py-12">
            <CalendarIcon className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No meetings</h3>
            <p className="mt-1 text-sm text-gray-500">
              {searchQuery || filterStatus !== 'all' ? 'No meetings match your filters' : 'Get started by creating a new meeting'}
            </p>
            {!searchQuery && filterStatus === 'all' && (
              <div className="mt-6">
                <button
                  onClick={() => setShowNewMeetingModal(true)}
                  className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                >
                  <PlusIcon className="h-5 w-5 mr-2" />
                  New Meeting
                </button>
              </div>
            )}
          </div>
        ) : (
          <ul className="divide-y divide-gray-200">
            {filteredMeetings.map((meeting) => (
              <li key={meeting.id} className="hover:bg-gray-50">
                <div className="px-4 py-4 sm:px-6">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-medium text-gray-900">{meeting.title}</h3>
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusBadge(meeting.status)}`}>
                          {meeting.status.replace('_', ' ')}
                        </span>
                        <span className="px-2 py-1 text-xs font-medium bg-purple-100 text-purple-800 rounded-full">
                          {getMeetingTypeLabel(meeting.meeting_type)}
                        </span>
                      </div>

                      <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-gray-600">
                        <div className="flex items-center gap-1">
                          <CalendarIcon className="h-4 w-4" />
                          {formatDateTime(meeting.start_time)}
                        </div>
                        <div className="flex items-center gap-1">
                          <ClockIcon className="h-4 w-4" />
                          {formatDuration(meeting.start_time, meeting.end_time)}
                        </div>
                        {meeting.location && (
                          <div className="flex items-center gap-1">
                            <MapPinIcon className="h-4 w-4" />
                            {meeting.location}
                          </div>
                        )}
                        {meeting.construction && (
                          <div className="flex items-center gap-1">
                            <UserGroupIcon className="h-4 w-4" />
                            {meeting.construction.name}
                          </div>
                        )}
                        {meeting.video_url && (
                          <div className="flex items-center gap-1">
                            <VideoCameraIcon className="h-4 w-4" />
                            <a href={meeting.video_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800">
                              Join Video
                            </a>
                          </div>
                        )}
                        <div className="flex items-center gap-1">
                          <UserGroupIcon className="h-4 w-4" />
                          {meeting.meeting_participants?.length || 0} participants
                        </div>
                      </div>

                      {meeting.description && (
                        <p className="mt-2 text-sm text-gray-600 line-clamp-2">{meeting.description}</p>
                      )}
                    </div>

                    <div className="ml-4 flex items-center gap-2">
                      {meeting.status === 'scheduled' && (
                        <button
                          onClick={() => handleStartMeeting(meeting.id)}
                          className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded text-white bg-green-600 hover:bg-green-700"
                        >
                          <PlayIcon className="h-4 w-4 mr-1" />
                          Start
                        </button>
                      )}
                      {meeting.status === 'in_progress' && (
                        <button
                          onClick={() => handleCompleteMeeting(meeting.id)}
                          className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded text-white bg-blue-600 hover:bg-blue-700"
                        >
                          <CheckCircleIcon className="h-4 w-4 mr-1" />
                          Complete
                        </button>
                      )}
                      {(meeting.status === 'scheduled' || meeting.status === 'in_progress') && (
                        <button
                          onClick={() => handleCancelMeeting(meeting.id)}
                          className="inline-flex items-center px-3 py-1.5 border border-gray-300 text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50"
                        >
                          <XCircleIcon className="h-4 w-4 mr-1" />
                          Cancel
                        </button>
                      )}
                      <button
                        onClick={() => handleDeleteMeeting(meeting.id)}
                        className="inline-flex items-center px-3 py-1.5 border border-red-300 text-xs font-medium rounded text-red-700 bg-white hover:bg-red-50"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Modals */}
      {showNewMeetingModal && (
        <NewMeetingModal
          isOpen={showNewMeetingModal}
          onClose={() => setShowNewMeetingModal(false)}
          onSubmit={handleCreateMeeting}
          constructionId={constructionId}
        />
      )}

      {/* Toast */}
      {toast && (
        <Toast
          type={toast.type}
          message={toast.message}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  )
}
