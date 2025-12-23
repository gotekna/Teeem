import { useState, useEffect } from 'react'
import { XMarkIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline'

/**
 * LinkedTasksModal - Modal for selecting multiple tasks to link to the current task
 */
export default function LinkedTasksModal({ isOpen, onClose, currentRow, allRows, onSave }) {
  const [selectedTaskIds, setSelectedTaskIds] = useState(currentRow.linked_task_ids || [])
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    setSelectedTaskIds(currentRow.linked_task_ids || [])
  }, [currentRow.linked_task_ids])

  if (!isOpen) return null

  const handleToggleTask = (taskId) => {
    // Don't allow linking to self
    if (taskId === currentRow.id) return

    setSelectedTaskIds(prev => {
      if (prev.includes(taskId)) {
        return prev.filter(id => id !== taskId)
      } else {
        return [...prev, taskId]
      }
    })
  }

  const handleSave = () => {
    onSave(selectedTaskIds)
    onClose()
  }

  // Filter tasks: exclude current task and apply search
  const filteredRows = allRows.filter(row => {
    if (row.id === currentRow.id) return false // Exclude self

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      return row.name.toLowerCase().includes(query) ||
             (row.supplier_name && row.supplier_name.toLowerCase().includes(query))
    }
    return true
  })

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4" style={{ zIndex: '2147483647' }}>
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">
              Select Linked Tasks
            </h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              For: {currentRow.name}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        {/* Search */}
        <div className="px-6 pt-4">
          <div className="relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search tasks..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white"
              autoFocus
            />
          </div>
          <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
            {selectedTaskIds.length} task{selectedTaskIds.length !== 1 ? 's' : ''} selected
          </p>
        </div>

        {/* Task List */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <div className="space-y-2">
            {filteredRows.length === 0 ? (
              <p className="text-center text-gray-500 dark:text-gray-400 py-8">
                {searchQuery ? 'No tasks match your search.' : 'No other tasks available.'}
              </p>
            ) : (
              filteredRows.map((row, index) => {
                const isSelected = selectedTaskIds.includes(row.id)
                return (
                  <label
                    key={row.id}
                    className={`flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-colors ${
                      isSelected
                        ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20'
                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleToggleTask(row.id)}
                      className="mt-0.5 h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          #{index + 1}
                        </span>
                        <span className="text-sm font-medium text-gray-900 dark:text-white">
                          {row.name}
                        </span>
                      </div>
                      {row.supplier_name && (
                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                          Supplier: {row.supplier_name}
                        </p>
                      )}
                    </div>
                  </label>
                )
              })
            )}
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
            Save Selection
          </button>
        </div>
      </div>
    </div>
  )
}
