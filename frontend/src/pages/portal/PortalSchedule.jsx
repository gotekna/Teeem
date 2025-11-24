import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  CalendarDaysIcon,
  ClockIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ChatBubbleLeftIcon,
  CameraIcon,
  ChevronRightIcon,
  ArrowPathIcon,
  FunnelIcon,
  CalendarIcon
} from '@heroicons/react/24/outline'
import { portalApi } from '../../services/portalApi'

// Status badge component
const StatusBadge = ({ status }) => {
  const styles = {
    not_started: 'bg-gray-100 text-gray-700',
    started: 'bg-blue-100 text-blue-700',
    completed: 'bg-green-100 text-green-700'
  }
  const labels = {
    not_started: 'Not Started',
    started: 'In Progress',
    completed: 'Completed'
  }

  return (
    <span className={`px-2 py-1 rounded text-xs font-medium ${styles[status] || styles.not_started}`}>
      {labels[status] || status}
    </span>
  )
}

// Task card component
const TaskCard = ({ task, onClick }) => {
  const isOverdue = task.status !== 'completed' && new Date(task.end_date) < new Date()

  return (
    <div
      onClick={() => onClick(task)}
      className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow cursor-pointer"
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-gray-900 truncate">{task.name}</h3>
          <p className="text-sm text-gray-500 mt-1">{task.trade}</p>
        </div>
        <StatusBadge status={task.status} />
      </div>

      <div className="mt-3 flex items-center gap-4 text-sm text-gray-500">
        <div className="flex items-center gap-1">
          <CalendarIcon className="w-4 h-4" />
          {new Date(task.start_date).toLocaleDateString()}
        </div>
        {task.duration_days && (
          <div className="flex items-center gap-1">
            <ClockIcon className="w-4 h-4" />
            {task.duration_days} days
          </div>
        )}
      </div>

      {/* Construction info */}
      <div className="mt-2 text-xs text-gray-400">
        {task.construction?.name}
      </div>

      {/* Stats row */}
      <div className="mt-3 flex items-center gap-3 text-xs">
        {task.photos_count > 0 && (
          <div className="flex items-center gap-1 text-gray-500">
            <CameraIcon className="w-3 h-3" />
            {task.photos_count}
          </div>
        )}
        {task.comments_count > 0 && (
          <div className="flex items-center gap-1 text-gray-500">
            <ChatBubbleLeftIcon className="w-3 h-3" />
            {task.comments_count}
          </div>
        )}
        {isOverdue && (
          <div className="flex items-center gap-1 text-red-500">
            <ExclamationTriangleIcon className="w-3 h-3" />
            Overdue
          </div>
        )}
        {task.supplier_confirmed_at && (
          <div className="flex items-center gap-1 text-green-500">
            <CheckCircleIcon className="w-3 h-3" />
            Confirmed
          </div>
        )}
      </div>
    </div>
  )
}

// Task detail modal
const TaskDetailModal = ({ task, onClose, onUpdate }) => {
  const [loading, setLoading] = useState(true)
  const [detail, setDetail] = useState(null)
  const [newComment, setNewComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [activeTab, setActiveTab] = useState('details')

  useEffect(() => {
    const fetchDetail = async () => {
      try {
        const res = await portalApi.get(`/api/v1/portal/sm_tasks/${task.id}`)
        setDetail(res.data.data)
      } catch (err) {
        console.error('Failed to fetch task detail:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchDetail()
  }, [task.id])

  const handleConfirm = async () => {
    try {
      await portalApi.patch(`/api/v1/portal/sm_tasks/${task.id}`, {
        confirm_schedule: true
      })
      setDetail(prev => ({ ...prev, supplier_confirmed_at: new Date().toISOString() }))
      onUpdate?.()
    } catch (err) {
      console.error('Failed to confirm:', err)
    }
  }

  const handleAddComment = async () => {
    if (!newComment.trim()) return
    setSubmitting(true)
    try {
      await portalApi.post(`/api/v1/portal/sm_tasks/${task.id}/add_comment`, {
        body: newComment
      })
      setNewComment('')
      // Refresh comments
      const res = await portalApi.get(`/api/v1/portal/sm_tasks/${task.id}`)
      setDetail(res.data.data)
    } catch (err) {
      console.error('Failed to add comment:', err)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={onClose} />

        <div className="relative transform overflow-hidden rounded-lg bg-white text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-2xl">
          {/* Header */}
          <div className="bg-white px-4 pb-4 pt-5 sm:p-6">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">{task.name}</h3>
                <p className="text-sm text-gray-500">{task.trade}</p>
              </div>
              <button onClick={onClose} className="text-gray-400 hover:text-gray-500">
                <span className="sr-only">Close</span>
                &times;
              </button>
            </div>

            {/* Tabs */}
            <div className="mt-4 border-b border-gray-200">
              <nav className="-mb-px flex space-x-8">
                {['details', 'comments', 'photos'].map(tab => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`pb-3 text-sm font-medium capitalize ${
                      activeTab === tab
                        ? 'border-b-2 border-indigo-600 text-indigo-600'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </nav>
            </div>
          </div>

          {/* Content */}
          <div className="px-4 pb-4 sm:px-6 sm:pb-6 max-h-96 overflow-y-auto">
            {loading ? (
              <div className="flex justify-center py-8">
                <ArrowPathIcon className="w-6 h-6 animate-spin text-gray-400" />
              </div>
            ) : (
              <>
                {activeTab === 'details' && detail && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs text-gray-500">Start Date</label>
                        <p className="font-medium">{new Date(detail.start_date).toLocaleDateString()}</p>
                      </div>
                      <div>
                        <label className="text-xs text-gray-500">End Date</label>
                        <p className="font-medium">{new Date(detail.end_date).toLocaleDateString()}</p>
                      </div>
                      <div>
                        <label className="text-xs text-gray-500">Status</label>
                        <p><StatusBadge status={detail.status} /></p>
                      </div>
                      <div>
                        <label className="text-xs text-gray-500">Duration</label>
                        <p className="font-medium">{detail.duration_days} days</p>
                      </div>
                    </div>

                    {detail.description && (
                      <div>
                        <label className="text-xs text-gray-500">Description</label>
                        <p className="text-sm text-gray-700">{detail.description}</p>
                      </div>
                    )}

                    {/* Confirm button */}
                    {!detail.supplier_confirmed_at && (
                      <button
                        onClick={handleConfirm}
                        className="w-full py-2 bg-green-600 text-white rounded-md hover:bg-green-700 flex items-center justify-center gap-2"
                      >
                        <CheckCircleIcon className="w-5 h-5" />
                        Confirm Schedule
                      </button>
                    )}
                    {detail.supplier_confirmed_at && (
                      <div className="flex items-center gap-2 text-green-600 text-sm">
                        <CheckCircleIcon className="w-5 h-5" />
                        Confirmed on {new Date(detail.supplier_confirmed_at).toLocaleDateString()}
                      </div>
                    )}

                    {/* Dependencies */}
                    {detail.predecessors?.length > 0 && (
                      <div>
                        <label className="text-xs text-gray-500">Waiting on</label>
                        <div className="mt-1 space-y-1">
                          {detail.predecessors.map(p => (
                            <div key={p.id} className="flex items-center gap-2 text-sm">
                              <StatusBadge status={p.status} />
                              <span>{p.name}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'comments' && detail && (
                  <div className="space-y-4">
                    {/* Comment list */}
                    <div className="space-y-3">
                      {detail.comments?.length === 0 ? (
                        <p className="text-gray-400 text-sm text-center py-4">No comments yet</p>
                      ) : (
                        detail.comments?.map(comment => (
                          <div key={comment.id} className="bg-gray-50 rounded-lg p-3">
                            <div className="flex items-center gap-2 text-sm">
                              <span className="font-medium text-gray-900">{comment.author_name}</span>
                              <span className="text-gray-400">
                                {new Date(comment.created_at).toLocaleDateString()}
                              </span>
                            </div>
                            <p className="mt-1 text-sm text-gray-700">{comment.body}</p>
                          </div>
                        ))
                      )}
                    </div>

                    {/* Add comment */}
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        placeholder="Add a comment..."
                        className="flex-1 text-sm border-gray-300 rounded-md"
                        onKeyDown={(e) => e.key === 'Enter' && handleAddComment()}
                      />
                      <button
                        onClick={handleAddComment}
                        disabled={submitting || !newComment.trim()}
                        className="px-4 py-2 bg-indigo-600 text-white rounded-md text-sm disabled:opacity-50"
                      >
                        {submitting ? '...' : 'Send'}
                      </button>
                    </div>
                  </div>
                )}

                {activeTab === 'photos' && detail && (
                  <div>
                    {detail.photos?.length === 0 ? (
                      <p className="text-gray-400 text-sm text-center py-4">No photos yet</p>
                    ) : (
                      <div className="grid grid-cols-3 gap-2">
                        {detail.photos?.map(photo => (
                          <div key={photo.id} className="aspect-square rounded-lg overflow-hidden">
                            <img
                              src={photo.thumbnail_url || photo.url}
                              alt={photo.caption || 'Task photo'}
                              className="w-full h-full object-cover"
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function PortalSchedule() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [tasks, setTasks] = useState({ all_tasks: [], upcoming: [], in_progress: [], completed: [] })
  const [summary, setSummary] = useState(null)
  const [filter, setFilter] = useState('all')
  const [selectedTask, setSelectedTask] = useState(null)

  const fetchTasks = useCallback(async () => {
    try {
      const params = {}
      if (filter !== 'all') params.status = filter

      const res = await portalApi.get('/api/v1/portal/sm_tasks', { params })
      setTasks(res.data.data)
      setSummary(res.data.summary)
    } catch (err) {
      console.error('Failed to fetch tasks:', err)
      if (err.response?.status === 401) {
        navigate('/portal/login')
      }
    } finally {
      setLoading(false)
    }
  }, [filter, navigate])

  useEffect(() => {
    fetchTasks()
  }, [fetchTasks])

  const displayTasks = filter === 'all'
    ? tasks.all_tasks
    : filter === 'not_started'
    ? tasks.upcoming
    : filter === 'started'
    ? tasks.in_progress
    : tasks.completed

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <ArrowPathIcon className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Schedule</h1>
        <p className="text-gray-500">Your assigned tasks and schedule</p>
      </div>

      {/* Summary cards */}
      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="text-2xl font-bold text-gray-900">{summary.total}</div>
            <div className="text-sm text-gray-500">Total Tasks</div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="text-2xl font-bold text-gray-900">{summary.not_started}</div>
            <div className="text-sm text-gray-500">Upcoming</div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="text-2xl font-bold text-blue-600">{summary.started}</div>
            <div className="text-sm text-gray-500">In Progress</div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="text-2xl font-bold text-green-600">{summary.completed}</div>
            <div className="text-sm text-gray-500">Completed</div>
          </div>
        </div>
      )}

      {/* Filter */}
      <div className="mb-4 flex items-center gap-2">
        <FunnelIcon className="w-5 h-5 text-gray-400" />
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="text-sm border-gray-300 rounded-md"
        >
          <option value="all">All Tasks</option>
          <option value="not_started">Upcoming</option>
          <option value="started">In Progress</option>
          <option value="completed">Completed</option>
        </select>
      </div>

      {/* Task list */}
      {displayTasks.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center text-gray-400">
          <CalendarDaysIcon className="w-12 h-12 mx-auto mb-2" />
          No tasks found
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {displayTasks.map(task => (
            <TaskCard
              key={task.id}
              task={task}
              onClick={setSelectedTask}
            />
          ))}
        </div>
      )}

      {/* Task detail modal */}
      {selectedTask && (
        <TaskDetailModal
          task={selectedTask}
          onClose={() => setSelectedTask(null)}
          onUpdate={fetchTasks}
        />
      )}
    </div>
  )
}
