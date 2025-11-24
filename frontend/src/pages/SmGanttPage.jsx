import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ChartBarIcon, TableCellsIcon, ArrowLeftIcon, PauseIcon, PlayIcon, PlusIcon, DocumentDuplicateIcon, UserGroupIcon, LinkIcon } from '@heroicons/react/24/outline'
import { api } from '../api'
import Toast from '../components/Toast'
import SmGanttChart from '../components/sm-gantt/SmGanttChart'
import SmTaskModal from '../components/sm-gantt/SmTaskModal'
import SmNewTaskModal from '../components/sm-gantt/SmNewTaskModal'
import SmCopyFromTemplateModal from '../components/sm-gantt/SmCopyFromTemplateModal'
import SmResourcePanel from '../components/sm-gantt/SmResourcePanel'
import SmCascadeModal from '../components/sm-gantt/SmCascadeModal'
import SmDependencyEditor from '../components/sm-gantt/SmDependencyEditor'

const SmTaskList = ({ tasks, onTaskClick, onStatusChange }) => (
  <div className="h-full overflow-auto">
    {tasks?.length > 0 ? (
      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
        <thead className="bg-gray-50 dark:bg-gray-800 sticky top-0">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">#</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Task</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Start</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">End</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Duration</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Lock</th>
          </tr>
        </thead>
        <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
          {tasks.map(task => (
            <tr
              key={task.id}
              onClick={() => onTaskClick?.(task)}
              className={`hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer ${
                task.is_hold_task ? 'bg-red-50 dark:bg-red-900/20' : ''
              }`}
            >
              <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">{task.task_number}</td>
              <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                <div className="flex items-center gap-2">
                  {task.is_hold_task && <PauseIcon className="h-4 w-4 text-red-500" />}
                  <span className={task.is_hold_task ? 'text-red-600 font-medium' : ''}>
                    {task.name}
                  </span>
                </div>
                {task.hold_reason && (
                  <div className="text-xs text-red-500 mt-0.5">{task.hold_reason}</div>
                )}
              </td>
              <td className="px-4 py-3">
                <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                  task.status === 'completed' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' :
                  task.status === 'started' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' :
                  'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                }`}>
                  {task.status?.replace('_', ' ')}
                </span>
              </td>
              <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">{task.start_date}</td>
              <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">{task.end_date}</td>
              <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">{task.duration_days}d</td>
              <td className="px-4 py-3">
                {task.locked && (
                  <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                    task.lock_type === 'supplier_confirm' ? 'bg-purple-100 text-purple-800' :
                    task.lock_type === 'confirm' ? 'bg-blue-100 text-blue-800' :
                    task.lock_type === 'started' ? 'bg-yellow-100 text-yellow-800' :
                    task.lock_type === 'completed' ? 'bg-green-100 text-green-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {task.lock_type?.replace('_', ' ')}
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    ) : (
      <div className="h-full flex items-center justify-center text-gray-500 dark:text-gray-400">
        <div className="text-center">
          <TableCellsIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>No tasks found</p>
          <p className="text-sm mt-2">Create tasks from a schedule template</p>
        </div>
      </div>
    )}
  </div>
)

export default function SmGanttPage() {
  const { id } = useParams() // Get job/construction ID from URL
  const navigate = useNavigate()
  const [construction, setConstruction] = useState(null)
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [viewMode, setViewMode] = useState('table') // 'gantt' or 'table'
  const [toast, setToast] = useState(null)
  const [selectedTask, setSelectedTask] = useState(null)
  const [showTaskModal, setShowTaskModal] = useState(false)
  const [holdReasons, setHoldReasons] = useState([])
  const [showNewTaskModal, setShowNewTaskModal] = useState(false)
  const [showCopyTemplateModal, setShowCopyTemplateModal] = useState(false)
  const [showResourcePanel, setShowResourcePanel] = useState(false)
  const [showCascadeModal, setShowCascadeModal] = useState(false)
  const [cascadeTask, setCascadeTask] = useState(null)
  const [cascadeNewDate, setCascadeNewDate] = useState(null)
  const [showDependencyEditor, setShowDependencyEditor] = useState(false)
  const [dependencies, setDependencies] = useState([])

  // Undo/Redo history
  const [history, setHistory] = useState([])
  const [historyIndex, setHistoryIndex] = useState(-1)
  const maxHistorySize = 50

  useEffect(() => {
    if (id) {
      loadData()
      loadHoldReasons()
    }
  }, [id])

  // Push to history for undo/redo
  const pushToHistory = useCallback((action) => {
    setHistory(prev => {
      const newHistory = prev.slice(0, historyIndex + 1)
      newHistory.push(action)
      if (newHistory.length > maxHistorySize) {
        newHistory.shift()
      }
      return newHistory
    })
    setHistoryIndex(prev => Math.min(prev + 1, maxHistorySize - 1))
  }, [historyIndex])

  // Undo action
  const handleUndo = useCallback(async () => {
    if (historyIndex < 0) return

    const action = history[historyIndex]
    if (action?.type === 'task_update' && action.previousData) {
      try {
        await api.patch(`/api/v1/sm_tasks/${action.taskId}`, { sm_task: action.previousData })
        setToast({ type: 'success', message: 'Undone' })
        loadData()
        setHistoryIndex(prev => prev - 1)
      } catch (err) {
        setToast({ type: 'error', message: 'Failed to undo' })
      }
    }
  }, [history, historyIndex])

  // Redo action
  const handleRedo = useCallback(async () => {
    if (historyIndex >= history.length - 1) return

    const action = history[historyIndex + 1]
    if (action?.type === 'task_update' && action.newData) {
      try {
        await api.patch(`/api/v1/sm_tasks/${action.taskId}`, { sm_task: action.newData })
        setToast({ type: 'success', message: 'Redone' })
        loadData()
        setHistoryIndex(prev => prev + 1)
      } catch (err) {
        setToast({ type: 'error', message: 'Failed to redo' })
      }
    }
  }, [history, historyIndex])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Skip if typing in input/textarea
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return

      // Escape - close modals
      if (e.key === 'Escape') {
        if (showTaskModal) setShowTaskModal(false)
        else if (showNewTaskModal) setShowNewTaskModal(false)
        else if (showCopyTemplateModal) setShowCopyTemplateModal(false)
        else if (showCascadeModal) setShowCascadeModal(false)
        else if (showDependencyEditor) setShowDependencyEditor(false)
        else if (showResourcePanel) setShowResourcePanel(false)
        return
      }

      // Ctrl/Cmd + Z - Undo
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault()
        handleUndo()
        return
      }

      // Ctrl/Cmd + Shift + Z - Redo
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'z') {
        e.preventDefault()
        handleRedo()
        return
      }

      // Ctrl/Cmd + Y - Redo (alternative)
      if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        e.preventDefault()
        handleRedo()
        return
      }

      // N - New task (when no modal open)
      if (e.key === 'n' && !showTaskModal && !showNewTaskModal && !showCopyTemplateModal) {
        e.preventDefault()
        setShowNewTaskModal(true)
        return
      }

      // G - Toggle Gantt/Table view
      if (e.key === 'g' && !showTaskModal && !showNewTaskModal) {
        e.preventDefault()
        setViewMode(prev => prev === 'gantt' ? 'table' : 'gantt')
        return
      }

      // T - Copy from template
      if (e.key === 't' && !showTaskModal && !showNewTaskModal && !showCopyTemplateModal) {
        e.preventDefault()
        setShowCopyTemplateModal(true)
        return
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [showTaskModal, showNewTaskModal, showCopyTemplateModal, showCascadeModal, showDependencyEditor, showResourcePanel, handleUndo, handleRedo])

  const loadData = async () => {
    try {
      setLoading(true)
      setError(null)

      // Load construction details
      const constructionResponse = await api.get(`/api/v1/constructions/${id}`)
      setConstruction(constructionResponse.construction)

      // Load SM tasks and dependencies using gantt_data endpoint
      const ganttResponse = await api.get(`/api/v1/constructions/${id}/sm_tasks/gantt_data`)
      setTasks(ganttResponse.gantt_data?.tasks || [])
      setDependencies(ganttResponse.gantt_data?.dependencies || [])
    } catch (err) {
      console.error('Failed to load SM Gantt data:', err)
      setError('Failed to load schedule data')
    } finally {
      setLoading(false)
    }
  }

  const loadHoldReasons = async () => {
    try {
      const response = await api.get('/api/v1/sm_hold_reasons?active_only=true')
      setHoldReasons(response.hold_reasons || [])
    } catch (err) {
      console.error('Failed to load hold reasons:', err)
    }
  }

  const handleTaskClick = (task) => {
    setSelectedTask(task)
    setShowTaskModal(true)
    // Future: Open task detail modal
  }

  const handleTaskUpdate = async (taskId, updates) => {
    // Store previous state for undo
    const previousTask = tasks.find(t => t.id === taskId)
    const previousData = previousTask ? {
      start_date: previousTask.start_date,
      end_date: previousTask.end_date,
      duration_days: previousTask.duration_days,
      name: previousTask.name,
      trade: previousTask.trade,
      status: previousTask.status
    } : null

    try {
      // If start_date is being changed, use the move endpoint for cascade handling
      if (updates.start_date) {
        const response = await api.post(`/api/v1/sm_tasks/${taskId}/move`, {
          new_start_date: updates.start_date
        })

        // If cascade is blocked, show the cascade modal
        if (response.needs_confirmation) {
          const task = tasks.find(t => t.id === taskId)
          setCascadeTask(task)
          setCascadeNewDate(updates.start_date)
          setShowCascadeModal(true)
          return // Don't refresh yet, wait for modal confirmation
        }

        // Push to history for undo
        if (previousData) {
          pushToHistory({
            type: 'task_update',
            taskId,
            previousData,
            newData: updates
          })
        }

        setToast({ type: 'success', message: response.message || 'Task moved' })
      } else {
        // Regular update (not a date change)
        await api.patch(`/api/v1/sm_tasks/${taskId}`, { sm_task: updates })

        // Push to history for undo
        if (previousData) {
          pushToHistory({
            type: 'task_update',
            taskId,
            previousData,
            newData: updates
          })
        }

        setToast({ type: 'success', message: 'Task updated' })
      }
      await loadData() // Refresh
    } catch (err) {
      // Handle conflict response (409)
      if (err.response?.status === 409 && err.response?.data?.needs_confirmation) {
        const task = tasks.find(t => t.id === taskId)
        setCascadeTask(task)
        setCascadeNewDate(updates.start_date)
        setShowCascadeModal(true)
        return
      }
      console.error('Failed to update task:', err)
      setToast({ type: 'error', message: 'Failed to update task' })
      throw err
    }
  }

  const handleCascadeConfirm = async (result) => {
    setToast({ type: 'success', message: result.message || 'Cascade complete' })
    setShowCascadeModal(false)
    setCascadeTask(null)
    setCascadeNewDate(null)
    await loadData()
  }

  const handleDependencySave = async (taskId, predecessorIds) => {
    try {
      // Update dependencies via API
      await api.patch(`/api/v1/sm_tasks/${taskId}`, {
        sm_task: { predecessor_ids: predecessorIds }
      })
      setToast({ type: 'success', message: 'Dependencies updated' })
      await loadData()
    } catch (err) {
      console.error('Failed to update dependencies:', err)
      throw err
    }
  }

  const handleTaskDelete = async (taskId) => {
    try {
      await api.delete(`/api/v1/sm_tasks/${taskId}`)
      setToast({ type: 'success', message: 'Task deleted' })
      await loadData() // Refresh
    } catch (err) {
      console.error('Failed to delete task:', err)
      setToast({ type: 'error', message: 'Failed to delete task' })
      throw err
    }
  }

  const handleCloseModal = () => {
    setShowTaskModal(false)
    setSelectedTask(null)
  }

  const handleTaskCreate = async (taskData) => {
    try {
      await api.post(`/api/v1/constructions/${id}/sm_tasks`, { sm_task: taskData })
      setToast({ type: 'success', message: 'Task created successfully' })
      await loadData() // Refresh
    } catch (err) {
      console.error('Failed to create task:', err)
      setToast({ type: 'error', message: 'Failed to create task' })
      throw err
    }
  }

  const handleCopyFromTemplate = async (templateRowId) => {
    try {
      await api.post(`/api/v1/constructions/${id}/sm_tasks/copy_from_template`, {
        template_row_id: templateRowId
      })
      setToast({ type: 'success', message: 'Task copied from template' })
      await loadData() // Refresh
    } catch (err) {
      console.error('Failed to copy from template:', err)
      setToast({ type: 'error', message: 'Failed to copy from template' })
      throw err
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-red-500 mb-4">{error}</p>
          <button
            onClick={() => navigate(-1)}
            className="text-indigo-600 hover:text-indigo-800"
          >
            Go back
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate(-1)}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
            >
              <ArrowLeftIcon className="h-5 w-5 text-gray-500" />
            </button>
            <div>
              <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                SM Gantt - {construction?.title || 'Loading...'}
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Schedule Master v2 - {tasks.length} tasks
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* New Task Button */}
            <button
              onClick={() => setShowNewTaskModal(true)}
              className="px-3 py-1.5 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center gap-1.5"
            >
              <PlusIcon className="h-4 w-4" />
              New Task
            </button>

            {/* Copy from Template Button */}
            <button
              onClick={() => setShowCopyTemplateModal(true)}
              className="px-3 py-1.5 text-sm font-medium border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 flex items-center gap-1.5"
            >
              <DocumentDuplicateIcon className="h-4 w-4" />
              From Template
            </button>

            {/* Resources Button */}
            <button
              onClick={() => setShowResourcePanel(!showResourcePanel)}
              className={`px-3 py-1.5 text-sm font-medium rounded-lg flex items-center gap-1.5 transition-colors ${
                showResourcePanel
                  ? 'bg-indigo-600 text-white'
                  : 'border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
              }`}
            >
              <UserGroupIcon className="h-4 w-4" />
              Resources
            </button>

            {/* View Toggle */}
            <div className="flex rounded-lg border border-gray-300 dark:border-gray-600 overflow-hidden">
              <button
                onClick={() => setViewMode('table')}
                className={`px-3 py-1.5 text-sm font-medium flex items-center gap-1.5 transition-colors ${
                  viewMode === 'table'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
              >
                <TableCellsIcon className="h-4 w-4" />
                Table
              </button>
              <button
                onClick={() => setViewMode('gantt')}
                className={`px-3 py-1.5 text-sm font-medium flex items-center gap-1.5 transition-colors ${
                  viewMode === 'gantt'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
              >
                <ChartBarIcon className="h-4 w-4" />
                Gantt
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden p-4 flex gap-4">
        {/* Task View */}
        <div className={`flex-1 overflow-hidden ${showResourcePanel ? 'w-2/3' : 'w-full'}`}>
          {viewMode === 'gantt' ? (
            <SmGanttChart
              tasks={tasks}
              dependencies={dependencies}
              onTaskClick={handleTaskClick}
              onTaskUpdate={handleTaskUpdate}
            />
          ) : (
            <SmTaskList
              tasks={tasks}
              onTaskClick={handleTaskClick}
            />
          )}
        </div>

        {/* Resource Panel (Phase 2) */}
        {showResourcePanel && (
          <div className="w-80 flex-shrink-0">
            <SmResourcePanel
              constructionId={id}
              onClose={() => setShowResourcePanel(false)}
            />
          </div>
        )}
      </div>

      {/* Toast */}
      {toast && (
        <Toast
          type={toast.type}
          message={toast.message}
          onClose={() => setToast(null)}
        />
      )}

      {/* Task Modal */}
      <SmTaskModal
        task={selectedTask}
        holdReasons={holdReasons}
        isOpen={showTaskModal}
        onClose={handleCloseModal}
        onSave={handleTaskUpdate}
        onDelete={handleTaskDelete}
        onEditDependencies={(task) => {
          setShowTaskModal(false)
          setSelectedTask(task)
          setShowDependencyEditor(true)
        }}
      />

      {/* New Task Modal */}
      <SmNewTaskModal
        constructionId={id}
        isOpen={showNewTaskModal}
        onClose={() => setShowNewTaskModal(false)}
        onCreate={handleTaskCreate}
      />

      {/* Copy from Template Modal */}
      <SmCopyFromTemplateModal
        constructionId={id}
        isOpen={showCopyTemplateModal}
        onClose={() => setShowCopyTemplateModal(false)}
        onCopy={handleCopyFromTemplate}
      />

      {/* Cascade Modal */}
      <SmCascadeModal
        isOpen={showCascadeModal}
        onClose={() => {
          setShowCascadeModal(false)
          setCascadeTask(null)
          setCascadeNewDate(null)
        }}
        task={cascadeTask}
        newStartDate={cascadeNewDate}
        onConfirm={handleCascadeConfirm}
      />

      {/* Dependency Editor Modal */}
      <SmDependencyEditor
        isOpen={showDependencyEditor}
        onClose={() => {
          setShowDependencyEditor(false)
          setSelectedTask(null)
        }}
        task={selectedTask}
        allTasks={tasks}
        onSave={handleDependencySave}
      />
    </div>
  )
}
