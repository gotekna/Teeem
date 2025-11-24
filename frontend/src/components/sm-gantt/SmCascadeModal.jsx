import { useState, useEffect, Fragment } from 'react'
import { Dialog, Transition, Tab } from '@headlessui/react'
import {
  XMarkIcon,
  ArrowRightIcon,
  ArrowDownIcon,
  LockClosedIcon,
  LockOpenIcon,
  LinkSlashIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ChevronRightIcon,
  Squares2X2Icon,
  ListBulletIcon
} from '@heroicons/react/24/outline'
import { api } from '../../api'

// Kanban-style drop zone component
const DropZone = ({ title, icon: Icon, color, tasks, onDrop, description }) => {
  const [isDragOver, setIsDragOver] = useState(false)

  const handleDragOver = (e) => {
    e.preventDefault()
    setIsDragOver(true)
  }

  const handleDragLeave = () => {
    setIsDragOver(false)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setIsDragOver(false)
    const taskId = e.dataTransfer.getData('taskId')
    if (taskId) onDrop(parseInt(taskId))
  }

  const colorClasses = {
    green: 'border-green-300 bg-green-50 dark:border-green-700 dark:bg-green-900/20',
    red: 'border-red-300 bg-red-50 dark:border-red-700 dark:bg-red-900/20',
    yellow: 'border-yellow-300 bg-yellow-50 dark:border-yellow-700 dark:bg-yellow-900/20',
    gray: 'border-gray-300 bg-gray-50 dark:border-gray-600 dark:bg-gray-800'
  }

  const headerColors = {
    green: 'text-green-700 dark:text-green-400',
    red: 'text-red-700 dark:text-red-400',
    yellow: 'text-yellow-700 dark:text-yellow-500',
    gray: 'text-gray-700 dark:text-gray-400'
  }

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`flex-1 min-h-[200px] rounded-lg border-2 border-dashed p-3 transition-all ${
        isDragOver ? 'ring-2 ring-indigo-500 border-indigo-400' : colorClasses[color]
      }`}
    >
      <div className={`flex items-center gap-2 mb-2 ${headerColors[color]}`}>
        <Icon className="h-5 w-5" />
        <h4 className="font-medium">{title}</h4>
        <span className="ml-auto text-sm opacity-75">{tasks.length}</span>
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">{description}</p>

      <div className="space-y-2 max-h-[300px] overflow-y-auto">
        {tasks.map((task) => (
          <TaskCard key={task.id} task={task} />
        ))}
        {tasks.length === 0 && (
          <div className="text-center py-4 text-gray-400 text-sm">
            Drop tasks here
          </div>
        )}
      </div>
    </div>
  )
}

// Draggable task card
const TaskCard = ({ task, onDragStart }) => {
  const handleDragStart = (e) => {
    e.dataTransfer.setData('taskId', task.id.toString())
    e.dataTransfer.effectAllowed = 'move'
  }

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      className="bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700 p-2 cursor-grab active:cursor-grabbing shadow-sm hover:shadow-md transition-shadow"
    >
      <div className="flex items-start gap-2">
        <span className="text-xs font-mono text-gray-400">#{task.task_number}</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
            {task.name}
          </p>
          <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
            <span>{task.old_start_date} → {task.new_start_date}</span>
            {task.trade && (
              <span className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded capitalize">
                {task.trade}
              </span>
            )}
          </div>
          {task.lock_type && (
            <div className="mt-1 flex items-center gap-1 text-xs text-yellow-600 dark:text-yellow-400">
              <LockClosedIcon className="h-3 w-3" />
              <span className="capitalize">{task.lock_type.replace('_', ' ')}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// Classic list view with checkboxes
const ClassicView = ({ unlockedTasks, blockedTasks, decisions, setDecisions }) => {
  const toggleDecision = (taskId, action) => {
    setDecisions(prev => ({
      ...prev,
      [taskId]: prev[taskId] === action ? null : action
    }))
  }

  return (
    <div className="space-y-4">
      {/* Unlocked successors - auto cascade */}
      {unlockedTasks.length > 0 && (
        <div>
          <h4 className="flex items-center gap-2 text-sm font-medium text-green-700 dark:text-green-400 mb-2">
            <CheckCircleIcon className="h-4 w-4" />
            Will Cascade Automatically ({unlockedTasks.length})
          </h4>
          <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3 space-y-2">
            {unlockedTasks.map(task => (
              <div key={task.id} className="flex items-center gap-3 text-sm">
                <span className="font-mono text-gray-400">#{task.task_number}</span>
                <span className="flex-1 text-gray-900 dark:text-gray-100">{task.name}</span>
                <span className="text-gray-500">
                  {task.old_start_date} → <span className="text-green-600">{task.new_start_date}</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Blocked successors - need decisions */}
      {blockedTasks.length > 0 && (
        <div>
          <h4 className="flex items-center gap-2 text-sm font-medium text-yellow-700 dark:text-yellow-500 mb-2">
            <ExclamationTriangleIcon className="h-4 w-4" />
            Needs Your Decision ({blockedTasks.length})
          </h4>
          <div className="space-y-3">
            {blockedTasks.map(task => (
              <div key={task.id} className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-3">
                <div className="flex items-start gap-3">
                  <span className="font-mono text-gray-400">#{task.task_number}</span>
                  <div className="flex-1">
                    <p className="font-medium text-gray-900 dark:text-gray-100">{task.name}</p>
                    <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                      <LockClosedIcon className="h-3 w-3" />
                      <span className="capitalize">{task.lock_type?.replace('_', ' ')}</span>
                      {task.supplier_name && (
                        <>
                          <span>•</span>
                          <span>{task.supplier_name}</span>
                        </>
                      )}
                    </div>

                    {/* Action buttons */}
                    <div className="flex gap-2 mt-3">
                      {task.unlockable && (
                        <button
                          onClick={() => toggleDecision(task.id, 'unlock')}
                          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                            decisions[task.id] === 'unlock'
                              ? 'bg-green-600 text-white'
                              : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 hover:bg-green-50 dark:hover:bg-green-900/30'
                          }`}
                        >
                          <LockOpenIcon className="h-3.5 w-3.5" />
                          Unlock & Move
                        </button>
                      )}
                      <button
                        onClick={() => toggleDecision(task.id, 'break')}
                        className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                          decisions[task.id] === 'break'
                            ? 'bg-red-600 text-white'
                            : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 hover:bg-red-50 dark:hover:bg-red-900/30'
                        }`}
                      >
                        <LinkSlashIcon className="h-3.5 w-3.5" />
                        Break Link
                      </button>
                      <button
                        onClick={() => toggleDecision(task.id, null)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                          !decisions[task.id]
                            ? 'bg-gray-600 text-white'
                            : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600'
                        }`}
                      >
                        Keep As-Is
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default function SmCascadeModal({
  isOpen,
  onClose,
  task,
  newStartDate,
  onConfirm
}) {
  const [preview, setPreview] = useState(null)
  const [loading, setLoading] = useState(false)
  const [executing, setExecuting] = useState(false)
  const [viewMode, setViewMode] = useState('kanban') // 'kanban' or 'classic'
  const [decisions, setDecisions] = useState({})

  // Kanban state
  const [cascadeTasks, setCascadeTasks] = useState([])
  const [breakTasks, setBreakTasks] = useState([])
  const [keepTasks, setKeepTasks] = useState([])

  // Fetch cascade preview when modal opens
  useEffect(() => {
    if (isOpen && task && newStartDate) {
      fetchPreview()
    }
  }, [isOpen, task?.id, newStartDate])

  const fetchPreview = async () => {
    setLoading(true)
    try {
      const response = await api.post(`/api/v1/sm_tasks/${task.id}/cascade_preview`, {
        new_start_date: newStartDate
      })

      if (response.success) {
        setPreview(response.preview)

        // Initialize Kanban columns
        setCascadeTasks(response.preview.unlocked_successors || [])
        setBreakTasks([])
        setKeepTasks(response.preview.blocked_successors || [])
        setDecisions({})
      }
    } catch (error) {
      console.error('Failed to fetch cascade preview:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleKanbanDrop = (zone, taskId) => {
    // Find the task in any column
    const allTasks = [...cascadeTasks, ...breakTasks, ...keepTasks]
    const task = allTasks.find(t => t.id === taskId)
    if (!task) return

    // Remove from all columns
    setCascadeTasks(prev => prev.filter(t => t.id !== taskId))
    setBreakTasks(prev => prev.filter(t => t.id !== taskId))
    setKeepTasks(prev => prev.filter(t => t.id !== taskId))

    // Add to target column
    switch (zone) {
      case 'cascade':
        setCascadeTasks(prev => [...prev, task])
        break
      case 'break':
        setBreakTasks(prev => [...prev, task])
        break
      case 'keep':
        setKeepTasks(prev => [...prev, task])
        break
    }
  }

  const handleConfirm = async () => {
    setExecuting(true)
    try {
      let tasksToExecute = {}

      if (viewMode === 'kanban') {
        tasksToExecute = {
          tasks_to_cascade: cascadeTasks.map(t => t.id),
          tasks_to_break: breakTasks.map(t => t.id),
          tasks_to_unlock: cascadeTasks.filter(t => t.lock_type).map(t => t.id)
        }
      } else {
        // Classic view
        tasksToExecute = {
          tasks_to_cascade: preview.unlocked_successors.map(t => t.id),
          tasks_to_break: Object.entries(decisions)
            .filter(([_, action]) => action === 'break')
            .map(([id, _]) => parseInt(id)),
          tasks_to_unlock: Object.entries(decisions)
            .filter(([_, action]) => action === 'unlock')
            .map(([id, _]) => parseInt(id))
        }
      }

      const response = await api.post(`/api/v1/sm_tasks/${task.id}/cascade_execute`, {
        new_start_date: newStartDate,
        ...tasksToExecute
      })

      if (response.success) {
        onConfirm?.(response)
        onClose()
      }
    } catch (error) {
      console.error('Failed to execute cascade:', error)
    } finally {
      setExecuting(false)
    }
  }

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/40" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-4xl transform overflow-hidden rounded-xl bg-white dark:bg-gray-900 shadow-xl transition-all">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                  <div>
                    <Dialog.Title className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                      Cascade Preview
                    </Dialog.Title>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                      Moving task #{task?.task_number} will affect these dependent tasks
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    {/* View toggle */}
                    <div className="flex rounded-lg border border-gray-300 dark:border-gray-600 overflow-hidden">
                      <button
                        onClick={() => setViewMode('kanban')}
                        className={`px-3 py-1.5 text-sm font-medium flex items-center gap-1.5 transition-colors ${
                          viewMode === 'kanban'
                            ? 'bg-indigo-600 text-white'
                            : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300'
                        }`}
                      >
                        <Squares2X2Icon className="h-4 w-4" />
                        Kanban
                      </button>
                      <button
                        onClick={() => setViewMode('classic')}
                        className={`px-3 py-1.5 text-sm font-medium flex items-center gap-1.5 transition-colors ${
                          viewMode === 'classic'
                            ? 'bg-indigo-600 text-white'
                            : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300'
                        }`}
                      >
                        <ListBulletIcon className="h-4 w-4" />
                        Classic
                      </button>
                    </div>
                    <button
                      onClick={onClose}
                      className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
                    >
                      <XMarkIcon className="h-5 w-5 text-gray-500" />
                    </button>
                  </div>
                </div>

                {/* Content */}
                <div className="px-6 py-4 max-h-[60vh] overflow-y-auto">
                  {loading ? (
                    <div className="flex items-center justify-center py-12">
                      <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent"></div>
                    </div>
                  ) : preview ? (
                    <>
                      {/* Source task summary */}
                      <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-lg p-4 mb-4">
                        <div className="flex items-center gap-4">
                          <div className="flex-1">
                            <span className="text-xs font-medium text-indigo-600 dark:text-indigo-400">Moving Task</span>
                            <p className="font-medium text-gray-900 dark:text-gray-100">
                              #{preview.moved_task.id} {task?.name}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 text-sm">
                            <span className="text-gray-500">{preview.moved_task.old_start_date}</span>
                            <ArrowRightIcon className="h-4 w-4 text-indigo-500" />
                            <span className="font-medium text-indigo-600 dark:text-indigo-400">
                              {preview.moved_task.new_start_date}
                            </span>
                            <span className="px-2 py-0.5 bg-indigo-100 dark:bg-indigo-800 text-indigo-700 dark:text-indigo-300 rounded text-xs">
                              {preview.summary.direction === 'forward' ? '+' : ''}{preview.summary.days_moved} days
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Summary stats */}
                      <div className="grid grid-cols-3 gap-4 mb-4">
                        <div className="text-center p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                          <p className="text-2xl font-bold text-green-600">{preview.summary.will_cascade}</p>
                          <p className="text-xs text-green-700 dark:text-green-400">Will Cascade</p>
                        </div>
                        <div className="text-center p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                          <p className="text-2xl font-bold text-yellow-600">{preview.summary.blocked}</p>
                          <p className="text-xs text-yellow-700 dark:text-yellow-500">Blocked</p>
                        </div>
                        <div className="text-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                          <p className="text-2xl font-bold text-gray-600">{preview.summary.total_successors}</p>
                          <p className="text-xs text-gray-500">Total Affected</p>
                        </div>
                      </div>

                      {/* View content */}
                      {viewMode === 'kanban' ? (
                        <div className="flex gap-4">
                          <DropZone
                            title="Cascade"
                            icon={ArrowDownIcon}
                            color="green"
                            tasks={cascadeTasks}
                            onDrop={(id) => handleKanbanDrop('cascade', id)}
                            description="Tasks will move with their predecessor"
                          />
                          <DropZone
                            title="Break Link"
                            icon={LinkSlashIcon}
                            color="red"
                            tasks={breakTasks}
                            onDrop={(id) => handleKanbanDrop('break', id)}
                            description="Dependency will be removed"
                          />
                          <DropZone
                            title="Keep As-Is"
                            icon={LockClosedIcon}
                            color="yellow"
                            tasks={keepTasks}
                            onDrop={(id) => handleKanbanDrop('keep', id)}
                            description="No changes will be made"
                          />
                        </div>
                      ) : (
                        <ClassicView
                          unlockedTasks={preview.unlocked_successors}
                          blockedTasks={preview.blocked_successors}
                          decisions={decisions}
                          setDecisions={setDecisions}
                        />
                      )}
                    </>
                  ) : (
                    <div className="text-center py-12 text-gray-500">
                      No cascade preview available
                    </div>
                  )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
                  <button
                    onClick={onClose}
                    className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleConfirm}
                    disabled={executing}
                    className="px-4 py-2 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2"
                  >
                    {executing ? (
                      <>
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                        Executing...
                      </>
                    ) : (
                      <>
                        <CheckCircleIcon className="h-4 w-4" />
                        Confirm Cascade
                      </>
                    )}
                  </button>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  )
}
