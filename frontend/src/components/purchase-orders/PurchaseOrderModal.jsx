import { useState, useEffect, useRef } from 'react'
import { XMarkIcon, SparklesIcon, ExclamationTriangleIcon, UserIcon, MagnifyingGlassIcon, CheckIcon, ChevronUpDownIcon } from '@heroicons/react/24/outline'
import { api } from '../../api'

export default function PurchaseOrderModal({ isOpen, onClose, onSave, purchaseOrder, suppliers, constructionId, construction }) {
  const isMountedRef = useRef(true)
  const [formData, setFormData] = useState({
    construction_id: constructionId,
    supplier_id: '',
    schedule_task_id: '',
    status: 'draft'
  })
  const [saving, setSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState(null)
  const [supplierSearch, setSupplierSearch] = useState('')
  const [showSupplierDropdown, setShowSupplierDropdown] = useState(false)
  const [scheduleTaskSearch, setScheduleTaskSearch] = useState('')
  const [showScheduleTaskDropdown, setShowScheduleTaskDropdown] = useState(false)
  const [scheduleTasks, setScheduleTasks] = useState([])
  const [loadingTasks, setLoadingTasks] = useState(false)
  const supplierDropdownRef = useRef(null)
  const scheduleTaskDropdownRef = useRef(null)

  useEffect(() => {
    isMountedRef.current = true

    if (purchaseOrder) {
      setFormData({
        construction_id: constructionId,
        supplier_id: purchaseOrder.supplier_id || '',
        schedule_task_id: purchaseOrder.schedule_task_id || '',
        status: purchaseOrder.status || 'draft'
      })
    }

    return () => {
      isMountedRef.current = false
    }
  }, [purchaseOrder, constructionId])

  // Load schedule tasks when modal opens
  useEffect(() => {
    if (isOpen) {
      loadScheduleTasks()
    }
  }, [isOpen, constructionId])

  const loadScheduleTasks = async () => {
    try {
      setLoadingTasks(true)
      const response = await api.get(`/api/v1/jobs/${constructionId}/schedule_tasks`)
      // Show unmatched tasks OR the task currently assigned to this PO (if editing)
      const currentPoTaskId = purchaseOrder?.schedule_task_id
      const filtered = (response.schedule_tasks || []).filter(task =>
        !task.purchase_order_id || task.id === currentPoTaskId
      )
      setScheduleTasks(filtered)
    } catch (err) {
      console.error('Failed to load schedule tasks:', err)
    } finally {
      setLoadingTasks(false)
    }
  }

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (supplierDropdownRef.current && !supplierDropdownRef.current.contains(event.target)) {
        setShowSupplierDropdown(false)
      }
      if (scheduleTaskDropdownRef.current && !scheduleTaskDropdownRef.current.contains(event.target)) {
        setShowScheduleTaskDropdown(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleSupplierSelect = (supplierId) => {
    handleChange('supplier_id', supplierId)
    setSupplierSearch('')
    setShowSupplierDropdown(false)
  }

  const handleScheduleTaskSelect = (taskId) => {
    handleChange('schedule_task_id', taskId)
    setScheduleTaskSearch('')
    setShowScheduleTaskDropdown(false)
  }

  const filteredSuppliers = suppliers?.filter(supplier =>
    supplier.name.toLowerCase().includes(supplierSearch.toLowerCase())
  ) || []

  const filteredScheduleTasks = scheduleTasks?.filter(task =>
    task.title?.toLowerCase().includes(scheduleTaskSearch.toLowerCase()) ||
    task.supplier_category?.toLowerCase().includes(scheduleTaskSearch.toLowerCase())
  ) || []

  const selectedSupplier = suppliers?.find(s => s.id === formData.supplier_id)
  const selectedScheduleTask = scheduleTasks?.find(t => t.id === formData.schedule_task_id)

  const handleSubmit = async (e) => {
    e.preventDefault()

    // Validate required fields
    if (!formData.supplier_id) {
      setErrorMessage('Please select a supplier')
      return
    }

    if (!formData.schedule_task_id) {
      setErrorMessage('Please select a schedule task')
      return
    }

    setSaving(true)
    setErrorMessage(null)
    try {
      await onSave(formData)
      if (isMountedRef.current) {
        onClose()
      }
    } catch (error) {
      console.error('Error saving PO:', error)
      // Display the error message to the user
      if (isMountedRef.current) {
        setErrorMessage(`Failed to save purchase order: ${error.message}`)
      }
    } finally {
      if (isMountedRef.current) {
        setSaving(false)
      }
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 dark:bg-gray-900 dark:bg-opacity-75 transition-opacity" onClick={onClose} />

        <div className="inline-block align-bottom bg-white dark:bg-gray-800 rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-4xl sm:w-full">
          <div className="bg-white dark:bg-gray-800 px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                {purchaseOrder ? 'Edit Purchase Order' : 'New Purchase Order'}
              </h3>
              <button onClick={onClose} className="text-gray-400 hover:text-gray-500">
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Error Message Banner */}
              {errorMessage && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg p-4">
                  <div className="flex">
                    <ExclamationTriangleIcon className="h-5 w-5 text-red-600 dark:text-red-400 mr-2 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="text-sm text-red-800 dark:text-red-200">{errorMessage}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setErrorMessage(null)}
                      className="text-red-400 hover:text-red-600 dark:hover:text-red-300"
                    >
                      <XMarkIcon className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              )}

              <div className="space-y-4">

                <div ref={supplierDropdownRef} className="relative">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Supplier
                  </label>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setShowSupplierDropdown(!showSupplierDropdown)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-900 dark:text-white text-left flex items-center justify-between"
                    >
                      <span className={selectedSupplier ? 'text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400'}>
                        {selectedSupplier ? selectedSupplier.name : 'Search for supplier...'}
                      </span>
                      <ChevronUpDownIcon className="h-5 w-5 text-gray-400" />
                    </button>

                    {showSupplierDropdown && (
                      <div className="absolute z-10 mt-1 w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg max-h-60 overflow-hidden">
                        <div className="p-2 border-b border-gray-200 dark:border-gray-700">
                          <div className="relative">
                            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                            <input
                              type="text"
                              value={supplierSearch}
                              onChange={(e) => setSupplierSearch(e.target.value)}
                              placeholder="Search suppliers..."
                              className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                              autoFocus
                            />
                          </div>
                        </div>
                        <div className="max-h-48 overflow-y-auto">
                          {filteredSuppliers.length > 0 ? (
                            filteredSuppliers.map((supplier) => (
                              <button
                                key={supplier.id}
                                type="button"
                                onClick={() => handleSupplierSelect(supplier.id)}
                                className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center justify-between group"
                              >
                                <span className="text-gray-900 dark:text-white">{supplier.name}</span>
                                {formData.supplier_id === supplier.id && (
                                  <CheckIcon className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                                )}
                              </button>
                            ))
                          ) : (
                            <div className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">
                              No suppliers found
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Schedule Task Dropdown */}
                <div ref={scheduleTaskDropdownRef} className="relative">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Schedule Task
                  </label>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setShowScheduleTaskDropdown(!showScheduleTaskDropdown)}
                      disabled={loadingTasks}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-900 dark:text-white text-left flex items-center justify-between disabled:opacity-50"
                    >
                      <span className={selectedScheduleTask ? 'text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400'}>
                        {loadingTasks ? 'Loading tasks...' : selectedScheduleTask ? selectedScheduleTask.title : 'Search for schedule task...'}
                      </span>
                      <ChevronUpDownIcon className="h-5 w-5 text-gray-400" />
                    </button>

                    {showScheduleTaskDropdown && !loadingTasks && (
                      <div className="absolute z-10 mt-1 w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg max-h-60 overflow-hidden">
                        <div className="p-2 border-b border-gray-200 dark:border-gray-700">
                          <div className="relative">
                            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                            <input
                              type="text"
                              value={scheduleTaskSearch}
                              onChange={(e) => setScheduleTaskSearch(e.target.value)}
                              placeholder="Search schedule tasks..."
                              className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                              autoFocus
                            />
                          </div>
                        </div>
                        <div className="max-h-48 overflow-y-auto">
                          {filteredScheduleTasks.length > 0 ? (
                            filteredScheduleTasks.map((task) => (
                              <button
                                key={task.id}
                                type="button"
                                onClick={() => handleScheduleTaskSelect(task.id)}
                                className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center justify-between group"
                              >
                                <div className="flex-1">
                                  <div className="text-gray-900 dark:text-white font-medium">{task.title}</div>
                                  {task.supplier_category && (
                                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{task.supplier_category}</div>
                                  )}
                                </div>
                                {formData.schedule_task_id === task.id && (
                                  <CheckIcon className="h-5 w-5 text-indigo-600 dark:text-indigo-400 flex-shrink-0 ml-2" />
                                )}
                              </button>
                            ))
                          ) : (
                            <div className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">
                              {scheduleTasks.length === 0 ? 'No schedule tasks available' : 'No tasks found'}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex gap-3 justify-end pt-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={saving}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 border border-transparent rounded-lg text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
                >
                  {saving ? 'Creating...' : 'Create Purchase Order'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}
