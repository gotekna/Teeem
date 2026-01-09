import { useState, useEffect } from 'react'
import { XMarkIcon, PlusIcon, TrashIcon } from '@heroicons/react/24/outline'

/**
 * PredecessorEditor Modal
 *
 * Allows editing of task predecessor relationships with support for:
 * - Dependency types: FS (Finish-to-Start), SS (Start-to-Start), FF (Finish-to-Finish), SF (Start-to-Finish)
 * - Lag days (positive or negative)
 * - Multiple predecessors per task
 *
 * Predecessor format: { id: taskNumber, type: 'FS', lag: 0 }
 * Display format: "2FS+3" (task 2, Finish-to-Start, 3 day lag)
 */

const DEPENDENCY_TYPES = [
  { value: 'FS', label: 'FS (Finish → Start)', description: 'Predecessor must finish before this task starts' },
  { value: 'SS', label: 'SS (Start → Start)', description: 'Both tasks start at the same time' },
  { value: 'FF', label: 'FF (Finish → Finish)', description: 'Both tasks finish at the same time' },
  { value: 'SF', label: 'SF (Start → Finish)', description: 'Predecessor starts before this task finishes' }
]

export default function PredecessorEditor({ isOpen, onClose, currentRow, allRows, onSave }) {
  const [predecessors, setPredecessors] = useState([])

  useEffect(() => {
    if (isOpen && currentRow) {
      // Initialize from current row's predecessor_ids
      const initialPreds = (currentRow.predecessor_ids || []).map(pred => {
        // Handle both formats: { id, type, lag } or just a number
        if (typeof pred === 'object' && pred !== null) {
          return {
            id: pred.id || pred.task_id,
            type: pred.type || 'FS',
            lag: pred.lag || 0
          }
        } else {
          // Legacy format: just a number
          return {
            id: pred,
            type: 'FS',
            lag: 0
          }
        }
      })
      setPredecessors(initialPreds)
    }
  }, [isOpen, currentRow])

  const addPredecessor = () => {
    setPredecessors([...predecessors, { id: '', type: 'FS', lag: 0 }])
  }

  const removePredecessor = (index) => {
    setPredecessors(predecessors.filter((_, i) => i !== index))
  }

  const updatePredecessor = (index, field, value) => {
    const updated = [...predecessors]
    if (field === 'id' || field === 'lag') {
      updated[index][field] = parseInt(value) || 0
    } else {
      updated[index][field] = value
    }
    setPredecessors(updated)
  }

  const handleSave = () => {
    // Filter out invalid predecessors (no id selected)
    const validPreds = predecessors.filter(p => p.id && p.id > 0)

    // Validate no circular dependencies
    const currentTaskNumber = allRows.findIndex(r => r.id === currentRow.id) + 1

    // Check direct circular dependency (task can't be its own predecessor)
    const hasDirectCircular = validPreds.some(p => p.id === currentTaskNumber)
    if (hasDirectCircular) {
      alert('Error: A task cannot be a predecessor of itself.')
      return
    }

    // Check for indirect circular dependencies (A -> B -> A)
    const checkCircularDependency = (taskNum, visited = new Set()) => {
      if (visited.has(taskNum)) {
        return true // Found a cycle
      }

      visited.add(taskNum)

      // Find the row for this task number
      const taskRow = allRows[taskNum - 1]
      if (!taskRow || !taskRow.predecessor_ids) return false

      // Check each predecessor of this task
      for (const pred of taskRow.predecessor_ids) {
        const predId = typeof pred === 'object' ? pred.id : pred
        if (predId === currentTaskNumber) {
          return true // Found circular dependency
        }
        if (checkCircularDependency(predId, new Set(visited))) {
          return true
        }
      }

      return false
    }

    // Check if adding these predecessors would create a cycle and auto-remove them
    const nonCircularPreds = []
    const removedDueToCircular = []

    for (const pred of validPreds) {
      if (checkCircularDependency(pred.id)) {
        console.warn(`Circular dependency detected for task ${pred.id} - auto-removing`)
        removedDueToCircular.push(pred.id)
      } else {
        nonCircularPreds.push(pred)
      }
    }

    // Log if we removed any
    if (removedDueToCircular.length > 0) {
      console.log(`Auto-removed ${removedDueToCircular.length} circular dependencies: ${removedDueToCircular.join(', ')}`)
    }

    // Save as array of objects (with circular dependencies removed)
    onSave(nonCircularPreds)
    onClose()
  }

  if (!isOpen) return null

  const currentTaskNumber = allRows.findIndex(r => r.id === currentRow.id) + 1
  const availableTasks = allRows
    .map((row, idx) => ({ ...row, taskNumber: idx + 1 }))
    .filter(row => row.id !== currentRow.id) // Can't be predecessor of itself

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50" style={{ zIndex: '2147483647' }}>
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Edit Predecessors
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Task #{currentTaskNumber}: {currentRow?.name}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Info box */}
          <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
            <h3 className="text-sm font-medium text-blue-900 dark:text-blue-300 mb-2">
              About Dependencies
            </h3>
            <ul className="text-xs text-blue-800 dark:text-blue-400 space-y-1">
              <li><strong>FS (Finish-to-Start):</strong> Most common. Predecessor must finish before this task starts.</li>
              <li><strong>SS (Start-to-Start):</strong> Both tasks can start at the same time.</li>
              <li><strong>FF (Finish-to-Finish):</strong> Both tasks finish at the same time.</li>
              <li><strong>SF (Start-to-Finish):</strong> Rare. Predecessor starts before this task finishes.</li>
              <li><strong>Lag Days:</strong> Positive = delay after predecessor, Negative = overlap/lead time.</li>
            </ul>
          </div>

          {/* Predecessors list */}
          <div className="space-y-3">
            {predecessors.length === 0 ? (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400 text-sm">
                No predecessors defined. This task can start at any time.
              </div>
            ) : (
              predecessors.map((pred, index) => (
                <div key={index} className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
                  {/* Task selector */}
                  <div className="flex-1">
                    <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                      Predecessor Task
                    </label>
                    <select
                      value={pred.id || ''}
                      onChange={(e) => updatePredecessor(index, 'id', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-800 dark:text-white text-sm"
                    >
                      <option value="">Select task...</option>
                      {availableTasks.map(task => (
                        <option key={task.id} value={task.taskNumber}>
                          #{task.taskNumber}: {task.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Dependency type */}
                  <div className="w-48">
                    <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                      Type
                    </label>
                    <select
                      value={pred.type}
                      onChange={(e) => updatePredecessor(index, 'type', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-800 dark:text-white text-sm"
                      title={DEPENDENCY_TYPES.find(t => t.value === pred.type)?.description}
                    >
                      {DEPENDENCY_TYPES.map(type => (
                        <option key={type.value} value={type.value}>
                          {type.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Lag days */}
                  <div className="w-28">
                    <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                      Lag (days)
                    </label>
                    <input
                      type="number"
                      value={pred.lag}
                      onChange={(e) => updatePredecessor(index, 'lag', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-800 dark:text-white text-sm"
                      placeholder="0"
                    />
                  </div>

                  {/* Remove button */}
                  <button
                    onClick={() => removePredecessor(index)}
                    className="mt-5 p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
                    title="Remove predecessor"
                  >
                    <TrashIcon className="h-5 w-5" />
                  </button>
                </div>
              ))
            )}

            {/* Add button */}
            <button
              onClick={addPredecessor}
              className="w-full py-3 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-gray-600 dark:text-gray-400 hover:border-indigo-500 hover:text-indigo-600 dark:hover:text-indigo-400 flex items-center justify-center gap-2 text-sm font-medium"
            >
              <PlusIcon className="h-5 w-5" />
              Add Predecessor
            </button>
          </div>
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
            Save Predecessors
          </button>
        </div>
      </div>
    </div>
  )
}
