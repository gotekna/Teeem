import { Fragment, useState, useEffect } from 'react'
import { Dialog, Transition, Menu } from '@headlessui/react'
import {
  XMarkIcon,
  EllipsisVerticalIcon,
  TrashIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  UserIcon,
  UserCircleIcon,
  BuildingOfficeIcon,
  CalendarIcon,
} from '@heroicons/react/24/outline'
import { api } from '../../api'
import { formatCurrency } from '../../utils/formatters'
import CalendarPicker from '../CalendarPicker'

const STATUSES = ['Active', 'On Hold', 'Cancelled', 'Complete']
const STAGES = ['Planning', 'Design', 'Preconstruction', 'Construction', 'Closeout', 'Complete']

export default function EditJobDrawer({ isOpen, onClose, job, onSuccess }) {
  const [formData, setFormData] = useState({
    title: '',
    client_name: '',
    client_email: '',
    client_phone: '',
    site_supervisor_name: '',
    site_supervisor_email: '',
    site_supervisor_phone: '',
    contract_value: '',
    status: 'Active',
    stage: 'Planning',
    start_date: '',
    ted_number: '',
    certifier_job_no: '',
  })

  const [isSaving, setIsSaving] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [errors, setErrors] = useState({})
  const [showCalendar, setShowCalendar] = useState(false)

  // Close calendar when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showCalendar && !event.target.closest('.calendar-container')) {
        setShowCalendar(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showCalendar])

  useEffect(() => {
    if (job) {
      setFormData({
        title: job.title || '',
        client_name: job.client_name || '',
        client_email: job.client_email || '',
        client_phone: job.client_phone || '',
        site_supervisor_name: job.site_supervisor_name || '',
        site_supervisor_email: job.site_supervisor_email || '',
        site_supervisor_phone: job.site_supervisor_phone || '',
        contract_value: job.contract_value || '',
        status: job.status || 'Active',
        stage: job.stage || 'Planning',
        start_date: job.start_date || '',
        ted_number: job.ted_number || '',
        certifier_job_no: job.certifier_job_no || '',
      })
      setErrors({})
    }
  }, [job])

  const handleChange = (field, value) => {
    setFormData({ ...formData, [field]: value })
    if (errors[field]) {
      setErrors({ ...errors, [field]: null })
    }
  }

  const validateForm = () => {
    const newErrors = {}
    if (!formData.title?.trim()) newErrors.title = 'Job title is required'
    if (formData.contract_value && isNaN(parseFloat(formData.contract_value))) {
      newErrors.contract_value = 'Contract value must be a number'
    }
    if (formData.site_supervisor_email && !formData.site_supervisor_email.includes('@')) {
      newErrors.site_supervisor_email = 'Invalid email address'
    }
    if (formData.client_email && !formData.client_email.includes('@')) {
      newErrors.client_email = 'Invalid email address'
    }
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSave = async () => {
    if (!validateForm()) return
    setIsSaving(true)
    try {
      await api.put(`/api/v1/jobs/${job.id}`, { construction: formData })
      if (onSuccess) await onSuccess()
      onClose()
    } catch (err) {
      console.error('Failed to update job:', err)
      alert('Failed to update job. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async () => {
    setIsDeleting(true)
    try {
      await api.delete(`/api/v1/jobs/${job.id}`)
      if (onSuccess) await onSuccess()
      onClose()
    } catch (err) {
      console.error('Failed to delete job:', err)
      alert('Failed to delete job. Please try again.')
    } finally {
      setIsDeleting(false)
      setShowDeleteConfirm(false)
    }
  }

  const getStatusColor = (status) => {
    const colors = {
      'Active': 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
      'On Hold': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
      'Cancelled': 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
      'Complete': 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
    }
    return colors[status] || 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400'
  }

  if (!job) return null

  return (
    <Transition.Root show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-in-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in-out duration-300"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-gray-500 bg-opacity-75 dark:bg-gray-900 dark:bg-opacity-75 transition-opacity" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-hidden">
          <div className="absolute inset-0 overflow-hidden">
            <div className="pointer-events-none fixed inset-y-0 right-0 flex max-w-full pl-10">
              <Transition.Child
                as={Fragment}
                enter="transform transition ease-in-out duration-300"
                enterFrom="translate-x-full"
                enterTo="translate-x-0"
                leave="transform transition ease-in-out duration-300"
                leaveFrom="translate-x-0"
                leaveTo="translate-x-full"
              >
                <Dialog.Panel className="pointer-events-auto w-screen max-w-2xl">
                  <div className="flex h-full flex-col bg-white dark:bg-gray-900">
                    {/* Header Section with Avatar */}
                    <div className="flex flex-col px-6 py-6 border-b border-gray-200 dark:border-gray-700">
                      <div className="flex w-full items-start gap-4">
                        {/* Avatar */}
                        <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-600 to-purple-600 text-2xl font-bold text-white shadow-lg">
                          {job.title?.charAt(0)?.toUpperCase() || 'J'}
                        </div>

                        {/* Title and Info Grid */}
                        <div className="flex flex-1 flex-col gap-6 pt-2">
                          {/* Title Row with Badge and Menu */}
                          <div className="flex w-full items-center justify-between">
                            <div className="flex items-center gap-2">
                              <input
                                type="text"
                                value={formData.title}
                                onChange={(e) => handleChange('title', e.target.value)}
                                className={`text-2xl font-semibold text-gray-900 dark:text-white bg-transparent border-b-2 border-transparent hover:border-gray-300 focus:border-indigo-500 focus:outline-none ${
                                  errors.title ? 'border-red-500' : ''
                                }`}
                                placeholder="Job title"
                              />
                              <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${getStatusColor(formData.status)}`}>
                                {formData.status}
                              </span>
                            </div>

                            {/* Actions Menu */}
                            <Menu as="div" className="relative">
                              <Menu.Button className="flex h-8 w-8 items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-500">
                                <EllipsisVerticalIcon className="h-5 w-5" />
                              </Menu.Button>
                              <Transition
                                as={Fragment}
                                enter="transition ease-out duration-100"
                                enterFrom="transform opacity-0 scale-95"
                                enterTo="transform opacity-100 scale-100"
                                leave="transition ease-in duration-75"
                                leaveFrom="transform opacity-100 scale-100"
                                leaveTo="transform opacity-0 scale-95"
                              >
                                <Menu.Items className="absolute right-0 mt-2 w-56 origin-top-right rounded-md bg-white dark:bg-gray-800 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none z-10">
                                  <div className="py-1">
                                    <Menu.Item>
                                      {({ active }) => (
                                        <button
                                          onClick={() => setShowDeleteConfirm(true)}
                                          className={`${
                                            active ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400' : 'text-red-600 dark:text-red-400'
                                          } group flex w-full items-center gap-2 px-4 py-2 text-sm`}
                                        >
                                          <TrashIcon className="h-4 w-4" />
                                          Delete Job
                                        </button>
                                      )}
                                    </Menu.Item>
                                  </div>
                                </Menu.Items>
                              </Transition>
                            </Menu>
                          </div>
                          {errors.title && <p className="text-sm text-red-600 dark:text-red-400 -mt-4">{errors.title}</p>}

                          {/* Info Grid */}
                          <div className="grid grid-cols-2 gap-6">
                            <div className="flex flex-col gap-1">
                              <span className="text-sm font-semibold text-gray-900 dark:text-white">Status</span>
                              <select
                                value={formData.status}
                                onChange={(e) => handleChange('status', e.target.value)}
                                className="text-sm text-gray-600 dark:text-gray-400 bg-transparent border-b border-gray-200 dark:border-gray-700 hover:border-indigo-500 focus:border-indigo-500 focus:outline-none py-1"
                              >
                                {STATUSES.map((status) => (
                                  <option key={status} value={status}>{status}</option>
                                ))}
                              </select>
                            </div>

                            <div className="flex flex-col gap-1">
                              <span className="text-sm font-semibold text-gray-900 dark:text-white">Stage</span>
                              <select
                                value={formData.stage}
                                onChange={(e) => handleChange('stage', e.target.value)}
                                className="text-sm text-gray-600 dark:text-gray-400 bg-transparent border-b border-gray-200 dark:border-gray-700 hover:border-indigo-500 focus:border-indigo-500 focus:outline-none py-1"
                              >
                                {STAGES.map((stage) => (
                                  <option key={stage} value={stage}>{stage}</option>
                                ))}
                              </select>
                            </div>

                            <div className="flex flex-col gap-1">
                              <span className="text-sm font-semibold text-gray-900 dark:text-white">Contract Value</span>
                              <input
                                type="number"
                                step="0.01"
                                value={formData.contract_value}
                                onChange={(e) => handleChange('contract_value', e.target.value)}
                                onFocus={(e) => e.target.select()}
                                className={`text-sm text-gray-600 dark:text-gray-400 bg-transparent border-b border-gray-200 dark:border-gray-700 hover:border-indigo-500 focus:border-indigo-500 focus:outline-none py-1 ${
                                  errors.contract_value ? 'border-red-500' : ''
                                }`}
                                placeholder="0.00"
                              />
                              {formData.contract_value && !errors.contract_value && (
                                <span className="text-xs text-gray-500 dark:text-gray-500">{formatCurrency(formData.contract_value)}</span>
                              )}
                              {errors.contract_value && <span className="text-xs text-red-600 dark:text-red-400">{errors.contract_value}</span>}
                            </div>

                            <div className="flex flex-col gap-1 relative calendar-container">
                              <span className="text-sm font-semibold text-gray-900 dark:text-white">Start Date</span>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.preventDefault()
                                  e.stopPropagation()
                                  setShowCalendar(!showCalendar)
                                }}
                                className="text-sm text-gray-600 dark:text-gray-400 bg-transparent border-b border-gray-200 dark:border-gray-700 hover:border-indigo-500 focus:border-indigo-500 focus:outline-none py-1 text-left flex items-center gap-2"
                              >
                                <CalendarIcon className="h-4 w-4" />
                                {formData.start_date ? new Date(formData.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Select date'}
                              </button>
                              {showCalendar && (
                                <div className="absolute top-full left-0 mt-2 z-50">
                                  <CalendarPicker
                                    value={formData.start_date}
                                    onChange={(date) => {
                                      handleChange('start_date', date)
                                      setShowCalendar(false)
                                    }}
                                  />
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Close Button */}
                        <button
                          type="button"
                          className="rounded-md text-gray-400 hover:text-gray-500 focus:outline-none"
                          onClick={onClose}
                        >
                          <XMarkIcon className="h-6 w-6" />
                        </button>
                      </div>
                    </div>

                    {/* Scrollable Content Area */}
                    <div className="flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-800/50 px-8 py-8">
                      <div className="space-y-8">
                        {/* Client Details Section */}
                        <div className="space-y-4">
                          <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                            <BuildingOfficeIcon className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                            Client Details
                          </h3>

                          <div className="space-y-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 shadow-sm">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                Client Name
                              </label>
                              <input
                                type="text"
                                value={formData.client_name}
                                onChange={(e) => handleChange('client_name', e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:bg-gray-800 dark:text-white"
                                placeholder="Client or company name"
                              />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                  Email
                                </label>
                                <input
                                  type="email"
                                  value={formData.client_email}
                                  onChange={(e) => handleChange('client_email', e.target.value)}
                                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:bg-gray-800 dark:text-white ${
                                    errors.client_email ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
                                  }`}
                                  placeholder="client@example.com"
                                />
                                {errors.client_email && (
                                  <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.client_email}</p>
                                )}
                              </div>

                              <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                  Phone
                                </label>
                                <input
                                  type="tel"
                                  value={formData.client_phone}
                                  onChange={(e) => handleChange('client_phone', e.target.value)}
                                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:bg-gray-800 dark:text-white"
                                  placeholder="04XX XXX XXX"
                                />
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Site Supervisor Section */}
                        <div className="space-y-4">
                          <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                            <UserCircleIcon className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                            Site Supervisor
                          </h3>

                          <div className="space-y-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 shadow-sm">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                Name
                              </label>
                              <input
                                type="text"
                                value={formData.site_supervisor_name}
                                onChange={(e) => handleChange('site_supervisor_name', e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:bg-gray-800 dark:text-white"
                                placeholder="Site supervisor name"
                              />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                  Email
                                </label>
                                <input
                                  type="email"
                                  value={formData.site_supervisor_email}
                                  onChange={(e) => handleChange('site_supervisor_email', e.target.value)}
                                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:bg-gray-800 dark:text-white ${
                                    errors.site_supervisor_email ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
                                  }`}
                                  placeholder="supervisor@example.com"
                                />
                                {errors.site_supervisor_email && (
                                  <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.site_supervisor_email}</p>
                                )}
                              </div>

                              <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                  Phone
                                </label>
                                <input
                                  type="tel"
                                  value={formData.site_supervisor_phone}
                                  onChange={(e) => handleChange('site_supervisor_phone', e.target.value)}
                                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:bg-gray-800 dark:text-white"
                                  placeholder="04XX XXX XXX"
                                />
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Project Details Section */}
                        <div className="space-y-4">
                          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Project Details</h3>

                          <div className="space-y-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 shadow-sm">
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                  TED Number
                                </label>
                                <input
                                  type="text"
                                  value={formData.ted_number}
                                  onChange={(e) => handleChange('ted_number', e.target.value)}
                                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:bg-gray-800 dark:text-white"
                                  placeholder="TED-XXXX"
                                />
                              </div>

                              <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                  Certifier Job No
                                </label>
                                <input
                                  type="text"
                                  value={formData.certifier_job_no}
                                  onChange={(e) => handleChange('certifier_job_no', e.target.value)}
                                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent dark:bg-gray-800 dark:text-white"
                                  placeholder="CERT-XXXX"
                                />
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Danger Zone */}
                        <div className="space-y-4">
                          <h3 className="text-lg font-semibold text-red-900 dark:text-red-400 flex items-center gap-2">
                            <ExclamationTriangleIcon className="h-5 w-5" />
                            Danger Zone
                          </h3>

                          <div className="rounded-lg border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-900/20 p-4">
                            <p className="text-sm text-red-700 dark:text-red-300 mb-3">
                              Once you delete this job, there is no going back. This action cannot be undone.
                            </p>
                            {!showDeleteConfirm ? (
                              <button
                                type="button"
                                onClick={() => setShowDeleteConfirm(true)}
                                className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                              >
                                <TrashIcon className="h-4 w-4" />
                                Delete Job
                              </button>
                            ) : (
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-medium text-red-900 dark:text-red-400">Are you sure?</p>
                                <button
                                  type="button"
                                  onClick={handleDelete}
                                  disabled={isDeleting}
                                  className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  {isDeleting ? (
                                    <>
                                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                      Deleting...
                                    </>
                                  ) : (
                                    <>
                                      <TrashIcon className="h-4 w-4" />
                                      Yes, Delete
                                    </>
                                  )}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setShowDeleteConfirm(false)}
                                  disabled={isDeleting}
                                  className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white text-sm font-medium rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  Cancel
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Sticky Footer with Save Button */}
                    <div className="sticky bottom-0 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 px-6 py-4 shadow-lg">
                      <button
                        type="button"
                        onClick={handleSave}
                        disabled={isSaving}
                        className="h-10 w-full flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600 px-4 py-2 text-sm font-medium text-white hover:from-indigo-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-indigo-500/30"
                      >
                        {isSaving ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                            Saving...
                          </>
                        ) : (
                          <>
                            <CheckCircleIcon className="h-5 w-5" />
                            Save Changes
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </div>
      </Dialog>
    </Transition.Root>
  )
}
