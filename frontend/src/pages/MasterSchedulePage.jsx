import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ChartBarIcon, TableCellsIcon, ArrowLeftIcon } from '@heroicons/react/24/outline'
import { api } from '../api'
import DHtmlxGanttView from '../components/schedule-master/DHtmlxGanttView'
import ScheduleTaskList from '../components/schedule-master/ScheduleTaskList'
import Toast from '../components/Toast'

export default function MasterSchedulePage() {
  const { id } = useParams() // Get job/construction ID from URL
  const [construction, setConstruction] = useState(null)
  const [project, setProject] = useState(null)
  const [scheduleData, setScheduleData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [viewMode, setViewMode] = useState('gantt') // 'gantt' or 'table'
  const [showGanttView, setShowGanttView] = useState(false)
  const [toast, setToast] = useState(null)
  const [saving, setSaving] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    loadConstructionAndSchedule()
  }, [id])

  const loadConstructionAndSchedule = async () => {
    try {
      setLoading(true)

      // Load construction/job details
      const constructionResponse = await api.get(`/api/v1/jobs/${id}`)
      setConstruction(constructionResponse.construction)

      // Find the project for this construction
      const projectsResponse = await api.get('/api/v1/projects')
      const jobProject = projectsResponse.projects?.find(p => p.construction_id === parseInt(id))

      if (jobProject) {
        setProject(jobProject)

        // Load the Gantt schedule for this project
        const scheduleResponse = await api.get(`/api/v1/projects/${jobProject.id}/gantt`)
        setScheduleData(scheduleResponse)
      } else {
        setError('No schedule found for this job')
      }
    } catch (err) {
      console.error('Failed to load schedule:', err)
      setError('Failed to load schedule')
    } finally {
      setLoading(false)
    }
  }

  const handleTaskUpdate = async (taskId, fieldOrUpdates, valueOrOptions, maybeOptions) => {
    if (!project || saving) return

    // Support both old signature (field, value) and new signature (updates, options)
    let updates
    let options = {}

    if (typeof fieldOrUpdates === 'object') {
      // New signature: handleTaskUpdate(taskId, updates, options)
      updates = fieldOrUpdates
      options = valueOrOptions || {}
    } else {
      // Old signature: handleTaskUpdate(taskId, field, value)
      updates = { [fieldOrUpdates]: valueOrOptions }
      options = maybeOptions || {}
    }

    // Store original data for rollback
    const originalTasks = [...scheduleData.tasks]

    // Map frontend field names to backend field names if needed
    const fieldMapping = {
      'planned_start_date': 'start_date',
      'planned_end_date': 'end_date',
      'duration_days': 'duration',
      'progress_percentage': 'progress',
      'assigned_to': 'assigned_to',
      'supplier': 'supplier'
    }

    // Apply field mapping to updates
    const mappedUpdates = {}
    for (const [field, value] of Object.entries(updates)) {
      const displayField = fieldMapping[field] || field
      mappedUpdates[displayField] = value
    }

    // Optimistic update - ONLY if not skipping reload
    // When skipReload is true (drag operations), Gantt handles the UI update internally
    // Updating parent state here causes background page to re-render and shake
    if (!options.skipReload) {
      const updatedTasks = scheduleData.tasks.map(task => {
        if (task.id === taskId) {
          return { ...task, ...mappedUpdates }
        }
        return task
      })
      setScheduleData({ ...scheduleData, tasks: updatedTasks })
    }

    try {
      // Only set saving state for table edits (not drag operations)
      // setSaving causes parent re-render which creates flicker
      if (!options.skipReload) {
        setSaving(true)
      }

      // Make API call with all updates at once
      const response = await api.patch(`/api/v1/projects/${project.id}/tasks/${taskId}`, {
        project_task: updates
      })

      if (response.success) {
        // Only show toast for table edits (drag operations are silent)
        if (!options.skipReload) {
          setToast({ type: 'success', message: 'Task updated successfully' })
        }

        // Only re-fetch if skipReload is not set (eliminates flicker on drag)
        if (!options.skipReload) {
          const scheduleResponse = await api.get(`/api/v1/projects/${project.id}/gantt`)
          setScheduleData(scheduleResponse)
        }
        // else: Completely silent background save - no flicker!
      } else {
        throw new Error(response.errors?.join(', ') || 'Update failed')
      }
    } catch (err) {
      console.error('Failed to update task:', err)

      // Rollback on error - only if we did an optimistic update
      if (!options.skipReload) {
        setScheduleData({ ...scheduleData, tasks: originalTasks })
      } else {
        // For drag operations, trigger a full reload to sync with backend
        // since Gantt has already updated internally
        const scheduleResponse = await api.get(`/api/v1/projects/${project.id}/gantt`)
        setScheduleData(scheduleResponse)
      }

      // Show error toast
      setToast({
        type: 'error',
        message: err.message || 'Failed to update task. Please try again.'
      })
    } finally {
      // Only clear saving state if we set it
      if (!options.skipReload) {
        setSaving(false)
      }
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
          <p className="mt-2 text-sm text-gray-500">Loading schedule...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600">{error}</p>
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="mt-4 inline-flex items-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500"
          >
            Back
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
      <div className="py-6">
        <header>
          <div className="px-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => navigate(-1)}
                className="inline-flex items-center justify-center rounded-md p-2 text-gray-700 hover:bg-gray-100 transition-colors"
                title="Back"
              >
                <ArrowLeftIcon className="h-5 w-5" />
              </button>
              <div className="flex-1">
                <h1 className="text-xl font-semibold text-gray-900">
                  Master Schedule
                </h1>
              </div>
            </div>
          </div>
        </header>
        <main>
          <div className="px-4 sm:px-6 lg:px-8">
            {/* View Toggle */}
            <div className="mt-8 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setViewMode('gantt')
                    setShowGanttView(true)
                  }}
                  className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                    viewMode === 'gantt'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <ChartBarIcon className="h-5 w-5" />
                  Gantt Chart
                </button>
                <button
                  onClick={() => setViewMode('table')}
                  className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                    viewMode === 'table'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <TableCellsIcon className="h-5 w-5" />
                  Table View
                </button>
              </div>
              <div className="flex items-center gap-3">
                <p className="text-sm text-gray-500">
                  {scheduleData?.tasks?.length || 0} tasks
                </p>
              </div>
            </div>

            {/* Table View */}
            <div className="mt-4">
              {scheduleData && scheduleData.tasks && viewMode === 'table' && (
                <ScheduleTaskList
                  tasks={scheduleData.tasks}
                  onTaskUpdate={handleTaskUpdate}
                  saving={saving}
                />
              )}
            </div>
          </div>
        </main>
      </div>

      {/* DHtmlx Gantt View Modal */}
      {showGanttView && scheduleData && scheduleData.tasks && (
        <DHtmlxGanttView
          isOpen={showGanttView}
          onClose={() => {
            setShowGanttView(false)
            setViewMode('table')
          }}
          tasks={scheduleData.tasks}
          onUpdateTask={async (taskId, updates, options) => {
            // Handle task updates from Gantt - pass all updates at once
            await handleTaskUpdate(taskId, updates, options)
          }}
        />
      )}

      {/* Toast */}
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  )
}
