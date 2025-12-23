import { useState, useEffect } from 'react'
import { XMarkIcon, PlusIcon, TrashIcon } from '@heroicons/react/24/outline'

/**
 * TaskDependencyEditor - Modal editor for managing task dependencies
 * Allows adding, editing, and removing predecessor relationships
 */
export default function TaskDependencyEditor({ task, tasks, onSave, onClose }) {
  const [predecessors, setPredecessors] = useState([])

  useEffect(() => {
    // Initialize with existing predecessors
    if (task.predecessor_ids && task.predecessor_ids.length > 0) {
      const formatted = task.predecessor_ids.map(pred => {
        if (typeof pred === 'object') {
          return {
            id: pred.id,
            type: pred.type || 'FS',
            lag: pred.lag || 0
          }
        }
        return {
          id: pred,
          type: 'FS',
          lag: 0
        }
      })
      setPredecessors(formatted)
    }
  }, [task])

  const addPredecessor = () => {
    setPredecessors([
      ...predecessors,
      { id: '', type: 'FS', lag: 0 }
    ])
  }

  const removePredecessor = (index) => {
    setPredecessors(predecessors.filter((_, i) => i !== index))
  }

  const updatePredecessor = (index, field, value) => {
    const updated = [...predecessors]
    updated[index] = {
      ...updated[index],
      [field]: field === 'lag' ? parseInt(value) || 0 : value
    }
    setPredecessors(updated)
  }

  const handleSave = () => {
    // Filter out empty predecessors and save
    const validPredecessors = predecessors.filter(p => p.id !== '')
    console.log('🐛 TaskDependencyEditor: Saving dependencies')
    console.log('  - Task ID:', task.id)
    console.log('  - Task name:', task.name)
    console.log('  - Original predecessors:', task.predecessor_ids)
    console.log('  - New valid predecessors:', validPredecessors)
    console.log('  - Removed dependencies:', task.predecessor_ids?.length - validPredecessors.length)
    onSave(task.id, validPredecessors)
  }

  // Get available tasks (exclude current task and tasks that would create circular dependencies)
  const availableTasks = tasks.filter(t => t.id !== task.id)

  const dependencyTypes = [
    { value: 'FS', label: 'Finish-to-Start (FS)' },
    { value: 'SS', label: 'Start-to-Start (SS)' },
    { value: 'FF', label: 'Finish-to-Finish (FF)' },
    { value: 'SF', label: 'Start-to-Finish (SF)' }
  ]

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50" style={{ zIndex: 2147483648 }}>
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Edit Dependencies
            </h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Task: {task.name}
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
          <div className="space-y-4">
            {/* Info box */}
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <h3 className="text-sm font-medium text-blue-900 dark:text-blue-300 mb-2">
                About Task Dependencies
              </h3>
              <ul className="text-sm text-blue-800 dark:text-blue-400 space-y-1">
                <li><strong>FS (Finish-to-Start):</strong> Successor task starts when predecessor finishes</li>
                <li><strong>SS (Start-to-Start):</strong> Successor task starts when predecessor starts</li>
                <li><strong>FF (Finish-to-Finish):</strong> Successor task finishes when predecessor finishes</li>
                <li><strong>SF (Start-to-Finish):</strong> Successor task finishes when predecessor starts</li>
                <li><strong>Lag:</strong> Number of days to delay (positive) or overlap (negative)</li>
              </ul>
            </div>

            {/* Predecessors List */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Predecessors
                </label>
                <button
                  onClick={addPredecessor}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-indigo-700 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-200 dark:border-indigo-800 rounded-md hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors"
                >
                  <PlusIcon className="h-4 w-4" />
                  Add Predecessor
                </button>
              </div>

              {predecessors.length === 0 ? (
                <div className="text-center py-8 bg-gray-50 dark:bg-gray-800/50 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600">
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    No predecessors defined. Click "Add Predecessor" to add one.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {predecessors.map((pred, index) => (
                    <div
                      key={index}
                      className="flex items-start gap-3 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700"
                    >
                      <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-3">
                        {/* Task Selection */}
                        <div>
                          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Predecessor Task
                          </label>
                          <select
                            value={pred.id}
                            onChange={(e) => updatePredecessor(index, 'id', parseInt(e.target.value))}
                            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                          >
                            <option value="">Select task...</option>
                            {availableTasks.map((t, idx) => (
                              <option key={t.id} value={idx + 1}>
                                {idx + 1}. {t.name}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Dependency Type */}
                        <div>
                          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Dependency Type
                          </label>
                          <select
                            value={pred.type}
                            onChange={(e) => updatePredecessor(index, 'type', e.target.value)}
                            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                          >
                            {dependencyTypes.map(type => (
                              <option key={type.value} value={type.value}>
                                {type.label}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Lag */}
                        <div>
                          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Lag (days)
                          </label>
                          <input
                            type="number"
                            value={pred.lag}
                            onChange={(e) => updatePredecessor(index, 'lag', e.target.value)}
                            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                            placeholder="0"
                          />
                        </div>
                      </div>

                      {/* Remove Button */}
                      <button
                        onClick={() => removePredecessor(index)}
                        className="mt-6 p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-md transition-colors"
                        title="Remove predecessor"
                      >
                        <TrashIcon className="h-5 w-5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Preview */}
            {predecessors.length > 0 && (
              <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Preview
                </h4>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {predecessors
                    .filter(p => p.id !== '')
                    .map(p => {
                      const lagStr = p.lag !== 0 ? (p.lag > 0 ? `+${p.lag}` : p.lag) : ''
                      return `${p.id}${p.type}${lagStr}`
                    })
                    .join(', ') || 'No valid predecessors'}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            Save Dependencies
          </button>
        </div>
      </div>
    </div>
  )
}
