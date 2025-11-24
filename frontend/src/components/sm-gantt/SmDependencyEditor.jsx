import { useState, useEffect } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import { Fragment } from 'react'
import { XMarkIcon, PlusIcon, TrashIcon, ArrowRightIcon } from '@heroicons/react/24/outline'

// Dependency types with descriptions
const DEPENDENCY_TYPES = [
  { value: 'FS', label: 'Finish-to-Start', description: 'Successor starts when predecessor finishes', icon: '→' },
  { value: 'SS', label: 'Start-to-Start', description: 'Both tasks start together', icon: '⇉' },
  { value: 'FF', label: 'Finish-to-Finish', description: 'Both tasks finish together', icon: '⇶' },
  { value: 'SF', label: 'Start-to-Finish', description: 'Successor finishes when predecessor starts', icon: '↶' },
]

export default function SmDependencyEditor({
  isOpen,
  onClose,
  task,
  allTasks,
  onSave
}) {
  const [dependencies, setDependencies] = useState([])
  const [saving, setSaving] = useState(false)

  // Initialize dependencies from task
  useEffect(() => {
    if (task?.predecessor_ids) {
      setDependencies(
        task.predecessor_ids.map(pred => ({
          id: pred.id || pred,
          type: pred.type || 'FS',
          lag: pred.lag || 0
        }))
      )
    } else {
      setDependencies([])
    }
  }, [task])

  // Get available tasks (exclude self and current predecessors)
  const availableTasks = allTasks.filter(t =>
    t.task_number !== task?.task_number &&
    !dependencies.find(d => d.id === t.task_number)
  )

  const handleAddDependency = () => {
    if (availableTasks.length === 0) return
    setDependencies([
      ...dependencies,
      { id: availableTasks[0].task_number, type: 'FS', lag: 0 }
    ])
  }

  const handleRemoveDependency = (index) => {
    setDependencies(dependencies.filter((_, i) => i !== index))
  }

  const handleUpdateDependency = (index, field, value) => {
    const updated = [...dependencies]
    updated[index] = { ...updated[index], [field]: value }
    setDependencies(updated)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      // Convert to the format expected by API
      const predecessorIds = dependencies.map(dep => ({
        id: dep.id,
        type: dep.type,
        lag: parseInt(dep.lag) || 0
      }))
      await onSave(task.id, predecessorIds)
      onClose()
    } catch (err) {
      console.error('Failed to save dependencies:', err)
      alert('Failed to save dependencies')
    } finally {
      setSaving(false)
    }
  }

  const getTaskName = (taskNumber) => {
    const t = allTasks.find(t => t.task_number === taskNumber)
    return t ? `${t.task_number}. ${t.name}` : `Task ${taskNumber}`
  }

  if (!task) return null

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
          <div className="fixed inset-0 bg-black/50" />
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
              <Dialog.Panel className="w-full max-w-2xl transform rounded-xl bg-white dark:bg-gray-800 shadow-xl transition-all">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                  <div>
                    <Dialog.Title className="text-lg font-semibold text-gray-900 dark:text-white">
                      Edit Dependencies
                    </Dialog.Title>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                      {task.task_number}. {task.name}
                    </p>
                  </div>
                  <button
                    onClick={onClose}
                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                  >
                    <XMarkIcon className="h-5 w-5 text-gray-500" />
                  </button>
                </div>

                {/* Content */}
                <div className="px-6 py-4 space-y-4 max-h-[60vh] overflow-y-auto">
                  {/* Legend */}
                  <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-3">
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Dependency Types</p>
                    <div className="grid grid-cols-2 gap-2">
                      {DEPENDENCY_TYPES.map(type => (
                        <div key={type.value} className="flex items-center gap-2 text-xs">
                          <span className="w-6 h-6 flex items-center justify-center bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded font-bold">
                            {type.value}
                          </span>
                          <span className="text-gray-600 dark:text-gray-400">{type.description}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Dependencies List */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Predecessors ({dependencies.length})
                      </h4>
                      <button
                        onClick={handleAddDependency}
                        disabled={availableTasks.length === 0}
                        className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <PlusIcon className="h-3.5 w-3.5" />
                        Add Predecessor
                      </button>
                    </div>

                    {dependencies.length === 0 ? (
                      <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                        <p className="text-sm">No predecessors defined</p>
                        <p className="text-xs mt-1">This task will start at the beginning of the schedule</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {dependencies.map((dep, index) => (
                          <div
                            key={index}
                            className="flex items-center gap-3 p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg"
                          >
                            {/* Predecessor Task */}
                            <div className="flex-1">
                              <select
                                value={dep.id}
                                onChange={(e) => handleUpdateDependency(index, 'id', parseInt(e.target.value))}
                                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                              >
                                <option value={dep.id}>{getTaskName(dep.id)}</option>
                                {availableTasks.map(t => (
                                  <option key={t.task_number} value={t.task_number}>
                                    {t.task_number}. {t.name}
                                  </option>
                                ))}
                              </select>
                            </div>

                            {/* Arrow */}
                            <ArrowRightIcon className="h-4 w-4 text-amber-500 flex-shrink-0" />

                            {/* Dependency Type */}
                            <select
                              value={dep.type}
                              onChange={(e) => handleUpdateDependency(index, 'type', e.target.value)}
                              className="w-20 px-2 py-2 text-sm font-medium border border-gray-300 dark:border-gray-600 rounded-lg bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400"
                            >
                              {DEPENDENCY_TYPES.map(type => (
                                <option key={type.value} value={type.value}>
                                  {type.value}
                                </option>
                              ))}
                            </select>

                            {/* Lag Days */}
                            <div className="flex items-center gap-1">
                              <input
                                type="number"
                                value={dep.lag}
                                onChange={(e) => handleUpdateDependency(index, 'lag', e.target.value)}
                                className="w-16 px-2 py-2 text-sm text-center border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                              />
                              <span className="text-xs text-gray-500">days</span>
                            </div>

                            {/* Remove */}
                            <button
                              onClick={() => handleRemoveDependency(index)}
                              className="p-2 text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                            >
                              <TrashIcon className="h-4 w-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Preview */}
                  {dependencies.length > 0 && (
                    <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-3">
                      <p className="text-xs font-medium text-amber-700 dark:text-amber-400 mb-2">Preview</p>
                      <p className="text-sm text-amber-800 dark:text-amber-300">
                        {dependencies.map((dep, i) => {
                          const lagStr = dep.lag > 0 ? `+${dep.lag}` : dep.lag < 0 ? `${dep.lag}` : ''
                          return (
                            <span key={i}>
                              {i > 0 && ', '}
                              <span className="font-medium">{dep.id}{dep.type}{lagStr}</span>
                            </span>
                          )
                        })}
                      </p>
                    </div>
                  )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 rounded-b-xl">
                  <button
                    onClick={onClose}
                    className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors disabled:opacity-50"
                  >
                    {saving ? 'Saving...' : 'Save Dependencies'}
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
