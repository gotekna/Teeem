import { useState, useEffect } from 'react'
import { XMarkIcon, CheckIcon } from '@heroicons/react/24/outline'

/**
 * SubtasksModal
 *
 * Allows selecting which tasks from the template should be created as subtasks when this task starts.
 * Subtasks are child tasks that are created automatically and linked to the parent task.
 */

export default function SubtasksModal({ isOpen, onClose, currentRow, allRows, onSave }) {
  const [selectedTaskIds, setSelectedTaskIds] = useState([])

  useEffect(() => {
    if (isOpen && currentRow) {
      // Initialize from current row's subtask_template_ids
      setSelectedTaskIds(currentRow.subtask_template_ids || [])
    }
  }, [isOpen, currentRow])

  const toggleTask = (taskId) => {
    if (selectedTaskIds.includes(taskId)) {
      setSelectedTaskIds(selectedTaskIds.filter(id => id !== taskId))
    } else {
      setSelectedTaskIds([...selectedTaskIds, taskId])
    }
  }

  const handleSave = () => {
    onSave(selectedTaskIds)
    onClose()
  }

  const handleSelectAll = () => {
    const allTaskIds = availableTasks.map(t => t.id)
    setSelectedTaskIds(allTaskIds)
  }

  const handleDeselectAll = () => {
    setSelectedTaskIds([])
  }

  if (!isOpen) return null

  const currentTaskNumber = allRows.findIndex(r => r.id === currentRow.id) + 1
  const availableTasks = allRows
    .map((row, idx) => ({ ...row, taskNumber: idx + 1 }))
    .filter(row => row.id !== currentRow.id) // Can't be a subtask of itself

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50" style={{ zIndex: '2147483647' }}>
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Subtasks
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Select tasks that should be created as subtasks when Task #{currentTaskNumber}: {currentRow?.name} starts
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        {/* Info box */}
        <div className="mx-6 mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <h3 className="text-sm font-medium text-blue-900 dark:text-blue-300 mb-1">
            About Subtasks
          </h3>
          <p className="text-xs text-blue-800 dark:text-blue-400">
            When this task is created in a project, the selected tasks below will automatically be created as
            child subtasks linked to this parent task. This is useful for breaking down complex tasks into
            smaller, manageable steps that need to be tracked separately.
          </p>
        </div>

        {/* Bulk actions */}
        <div className="mx-6 mt-4 flex items-center justify-between">
          <div className="text-sm text-gray-600 dark:text-gray-400">
            {selectedTaskIds.length} of {availableTasks.length} tasks selected
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleSelectAll}
              className="text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-200 underline"
            >
              Select All
            </button>
            <span className="text-gray-300 dark:text-gray-600">|</span>
            <button
              onClick={handleDeselectAll}
              className="text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-200 underline"
            >
              Deselect All
            </button>
          </div>
        </div>

        {/* Content - Task list */}
        <div className="flex-1 overflow-y-auto p-6">
          {availableTasks.length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400 text-sm">
              No other tasks available in this template.
            </div>
          ) : (
            <div className="space-y-2">
              {availableTasks.map((task) => {
                const isSelected = selectedTaskIds.includes(task.id)
                return (
                  <div
                    key={task.id}
                    onClick={() => toggleTask(task.id)}
                    className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                      isSelected
                        ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20'
                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 bg-white dark:bg-gray-900'
                    }`}
                  >
                    {/* Checkbox */}
                    <div className="flex-shrink-0">
                      <div
                        className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                          isSelected
                            ? 'bg-indigo-600 border-indigo-600'
                            : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800'
                        }`}
                      >
                        {isSelected && <CheckIcon className="h-3.5 w-3.5 text-white" />}
                      </div>
                    </div>

                    {/* Task info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                          #{task.taskNumber}
                        </span>
                        <span className="text-sm font-medium text-gray-900 dark:text-white">
                          {task.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        {task.supplier_name && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-400">
                            {task.supplier_name}
                          </span>
                        )}
                        {task.assigned_role && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-400">
                            {task.assigned_role}
                          </span>
                        )}
                        {task.tags && task.tags.length > 0 && (
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {task.tags.join(', ')}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 text-sm text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg"
          >
            Save Selection
          </button>
        </div>
      </div>
    </div>
  )
}
