import { useState, useEffect, Fragment } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import {
  XMarkIcon,
  PlayIcon,
  CheckIcon,
  PauseIcon,
  LockClosedIcon,
  LockOpenIcon,
  TrashIcon,
  LinkIcon
} from '@heroicons/react/24/outline'
import { api } from '../../api'

export default function SmTaskModal({
  task,
  holdReasons = [],
  isOpen,
  onClose,
  onSave,
  onDelete,
  onEditDependencies
}) {
  const [formData, setFormData] = useState({
    name: '',
    start_date: '',
    end_date: '',
    duration_days: 1,
    trade: '',
    description: '',
    progress_percentage: 0,
    confirm: false,
    supplier_confirm: false,
    manually_positioned: false
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [showHoldModal, setShowHoldModal] = useState(false)
  const [holdReasonId, setHoldReasonId] = useState('')
  const [holdNotes, setHoldNotes] = useState('')

  useEffect(() => {
    if (task) {
      setFormData({
        name: task.name || '',
        start_date: task.start_date || '',
        end_date: task.end_date || '',
        duration_days: task.duration_days || 1,
        trade: task.trade || '',
        description: task.description || '',
        progress_percentage: task.progress_percentage || 0,
        confirm: task.confirm || false,
        supplier_confirm: task.supplier_confirm || false,
        manually_positioned: task.manually_positioned || false
      })
    }
  }, [task])

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      await onSave(task.id, formData)
      onClose()
    } catch (err) {
      setError(err.message || 'Failed to save task')
    } finally {
      setLoading(false)
    }
  }

  const handleStart = async () => {
    setLoading(true)
    try {
      await api.post(`/api/v1/sm_tasks/${task.id}/start`)
      onSave(task.id, { status: 'started' })
      onClose()
    } catch (err) {
      setError(err.message || 'Failed to start task')
    } finally {
      setLoading(false)
    }
  }

  const handleComplete = async () => {
    setLoading(true)
    try {
      await api.post(`/api/v1/sm_tasks/${task.id}/complete`)
      onSave(task.id, { status: 'completed' })
      onClose()
    } catch (err) {
      setError(err.message || 'Failed to complete task')
    } finally {
      setLoading(false)
    }
  }

  const handleHold = async () => {
    if (!holdReasonId) {
      setError('Please select a hold reason')
      return
    }
    setLoading(true)
    try {
      await api.post(`/api/v1/sm_tasks/${task.id}/hold`, {
        hold_reason_id: holdReasonId,
        hold_notes: holdNotes
      })
      onSave(task.id, { is_hold_task: true })
      setShowHoldModal(false)
      onClose()
    } catch (err) {
      setError(err.message || 'Failed to hold task')
    } finally {
      setLoading(false)
    }
  }

  const handleReleaseHold = async () => {
    setLoading(true)
    try {
      await api.post(`/api/v1/sm_tasks/${task.id}/release_hold`)
      onSave(task.id, { is_hold_task: false })
      onClose()
    } catch (err) {
      setError(err.message || 'Failed to release hold')
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteClick = async () => {
    if (!confirm('Are you sure you want to delete this task?')) return
    setLoading(true)
    try {
      await onDelete(task.id)
      onClose()
    } catch (err) {
      setError(err.message || 'Failed to delete task')
    } finally {
      setLoading(false)
    }
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
          <div className="fixed inset-0 bg-black/30" />
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
              <Dialog.Panel className="w-full max-w-lg transform overflow-hidden rounded-xl bg-white dark:bg-gray-900 shadow-xl transition-all">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                  <Dialog.Title className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                    Task #{task.task_number}: {task.name}
                  </Dialog.Title>
                  <button
                    onClick={onClose}
                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
                  >
                    <XMarkIcon className="h-5 w-5" />
                  </button>
                </div>

                {/* Status badges */}
                <div className="px-6 py-3 bg-gray-50 dark:bg-gray-800 flex items-center gap-2 flex-wrap">
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                    task.status === 'completed' ? 'bg-green-100 text-green-800' :
                    task.status === 'started' ? 'bg-blue-100 text-blue-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {task.status?.replace('_', ' ')}
                  </span>
                  {task.is_hold_task && (
                    <span className="px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-800">
                      On Hold: {task.hold_reason}
                    </span>
                  )}
                  {task.locked && (
                    <span className="px-2 py-1 text-xs font-medium rounded-full bg-yellow-100 text-yellow-800">
                      Locked: {task.lock_type?.replace('_', ' ')}
                    </span>
                  )}
                </div>

                {/* Error message */}
                {error && (
                  <div className="mx-6 mt-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm">
                    {error}
                  </div>
                )}

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                  {/* Name */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Task Name
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => handleChange('name', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      disabled={task.locked}
                    />
                  </div>

                  {/* Dates */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Start Date
                      </label>
                      <input
                        type="date"
                        value={formData.start_date}
                        onChange={(e) => handleChange('start_date', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        disabled={task.locked}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Duration (days)
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={formData.duration_days}
                        onChange={(e) => handleChange('duration_days', parseInt(e.target.value) || 1)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        disabled={task.locked}
                      />
                    </div>
                  </div>

                  {/* Trade */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Trade
                    </label>
                    <input
                      type="text"
                      value={formData.trade}
                      onChange={(e) => handleChange('trade', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    />
                  </div>

                  {/* Progress */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Progress: {formData.progress_percentage}%
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={formData.progress_percentage}
                      onChange={(e) => handleChange('progress_percentage', parseInt(e.target.value))}
                      className="w-full"
                    />
                  </div>

                  {/* Description */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Description
                    </label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => handleChange('description', e.target.value)}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    />
                  </div>

                  {/* Lock checkboxes */}
                  <div className="flex items-center gap-6">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={formData.confirm}
                        onChange={(e) => handleChange('confirm', e.target.checked)}
                        className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                        disabled={task.status !== 'not_started'}
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300">Confirm</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={formData.supplier_confirm}
                        onChange={(e) => handleChange('supplier_confirm', e.target.checked)}
                        className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                        disabled={task.status !== 'not_started'}
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300">Supplier Confirm</span>
                    </label>
                  </div>
                </form>

                {/* Action buttons */}
                <div className="px-6 py-4 bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {task.status === 'not_started' && !task.is_hold_task && (
                      <>
                        <button
                          onClick={handleStart}
                          disabled={loading}
                          className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                        >
                          <PlayIcon className="h-4 w-4" />
                          Start
                        </button>
                        <button
                          onClick={() => setShowHoldModal(true)}
                          disabled={loading}
                          className="flex items-center gap-1.5 px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                        >
                          <PauseIcon className="h-4 w-4" />
                          Hold
                        </button>
                      </>
                    )}
                    {task.status === 'started' && (
                      <button
                        onClick={handleComplete}
                        disabled={loading}
                        className="flex items-center gap-1.5 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                      >
                        <CheckIcon className="h-4 w-4" />
                        Complete
                      </button>
                    )}
                    {task.is_hold_task && (
                      <button
                        onClick={handleReleaseHold}
                        disabled={loading}
                        className="flex items-center gap-1.5 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                      >
                        <LockOpenIcon className="h-4 w-4" />
                        Release Hold
                      </button>
                    )}
                    {!task.locked && task.status === 'not_started' && (
                      <button
                        onClick={handleDeleteClick}
                        disabled={loading}
                        className="flex items-center gap-1.5 px-3 py-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg disabled:opacity-50"
                      >
                        <TrashIcon className="h-4 w-4" />
                        Delete
                      </button>
                    )}
                    {onEditDependencies && (
                      <button
                        onClick={() => onEditDependencies(task)}
                        disabled={loading}
                        className="flex items-center gap-1.5 px-3 py-2 text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg disabled:opacity-50"
                      >
                        <LinkIcon className="h-4 w-4" />
                        Dependencies
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={onClose}
                      className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSubmit}
                      disabled={loading || task.locked}
                      className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                    >
                      {loading ? 'Saving...' : 'Save'}
                    </button>
                  </div>
                </div>

                {/* Hold reason modal */}
                {showHoldModal && (
                  <div className="absolute inset-0 bg-white dark:bg-gray-900 z-10 flex flex-col">
                    <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                      <h3 className="text-lg font-semibold">Select Hold Reason</h3>
                    </div>
                    <div className="p-6 flex-1 space-y-4">
                      <div>
                        <label className="block text-sm font-medium mb-2">Reason</label>
                        <select
                          value={holdReasonId}
                          onChange={(e) => setHoldReasonId(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800"
                        >
                          <option value="">Select a reason...</option>
                          {holdReasons.map(hr => (
                            <option key={hr.id} value={hr.id}>{hr.name}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-2">Notes</label>
                        <textarea
                          value={holdNotes}
                          onChange={(e) => setHoldNotes(e.target.value)}
                          rows={3}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800"
                          placeholder="Optional notes about this hold..."
                        />
                      </div>
                    </div>
                    <div className="px-6 py-4 bg-gray-50 dark:bg-gray-800 flex justify-end gap-2">
                      <button
                        onClick={() => setShowHoldModal(false)}
                        className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleHold}
                        disabled={!holdReasonId || loading}
                        className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                      >
                        {loading ? 'Holding...' : 'Put on Hold'}
                      </button>
                    </div>
                  </div>
                )}
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  )
}
