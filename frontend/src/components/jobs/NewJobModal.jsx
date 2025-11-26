import { useState, Fragment, useEffect } from 'react'
import { Dialog, Transition, Combobox, RadioGroup } from '@headlessui/react'
import {
  XMarkIcon,
  BriefcaseIcon,
  UserCircleIcon,
  MapPinIcon,
  CurrencyDollarIcon,
  CalendarIcon,
  FlagIcon,
  ChartBarIcon,
  CheckCircleIcon,
  ArrowRightIcon,
  ArrowLeftIcon,
  MagnifyingGlassIcon,
  DocumentTextIcon,
  CheckIcon,
  ChevronUpDownIcon,
  LightBulbIcon,
  FolderIcon,
} from '@heroicons/react/24/outline'
import { api } from '../../api'
import AddressAutocomplete from '../common/AddressAutocomplete'

const LEAD_SOURCES = [
  'Referral',
  'Website',
  'Social Media',
  'Email Campaign',
  'Walk-in',
  'Past Client',
  'Other',
]

const LAND_STATUS_OPTIONS = [
  'Registered',
  'Not Yet Registered',
  'Unconditional',
  'Settled',
  'Under Contract',
]

export default function NewJobModal({ isOpen, onClose, onSuccess }) {
  const [step, setStep] = useState(1)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [, setDirection] = useState('forward')
  const [formData, setFormData] = useState({
    title: '',
    location: '',
    client_id: null,
    client_name: '',
    client_email: '',
    client_phone: '',
    lead_source: '',
    contract_value: '',
    start_date: '',
    end_date: '',
    site_supervisor_name: 'Andrew Clement',
    job_type_id: null,
    job_status_id: null,
    job_stage_id: null,
    has_plans: false,
    has_engineering: false,
    has_soil_report: false,
    has_energy_report: false,
    land_status: '',
    createOneDriveFolders: true,
  })

  // Client lookup state
  const [clients, setClients] = useState([])
  const [clientQuery, setClientQuery] = useState('')
  const [selectedClient, setSelectedClient] = useState(null)
  const [loadingClients, setLoadingClients] = useState(false)

  // Schedule template state
  const [templates, setTemplates] = useState([])
  const [loadingTemplates, setLoadingTemplates] = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState(null)

  // Job configuration state
  const [jobTypes, setJobTypes] = useState([])
  const [jobStatuses, setJobStatuses] = useState([])
  const [jobStages, setJobStages] = useState([])
  const [availableStatuses, setAvailableStatuses] = useState([])
  const [availableStages, setAvailableStages] = useState([])
  const [loadingConfig, setLoadingConfig] = useState(false)

  const totalSteps = 3

  // Load schedule templates and job configuration when modal opens
  useEffect(() => {
    if (isOpen) {
      loadScheduleTemplates()
      loadJobConfiguration()
    }
  }, [isOpen])

  const loadScheduleTemplates = async () => {
    setLoadingTemplates(true)
    try {
      const response = await api.get('/api/v1/schedule_templates')
      setTemplates(response || [])
      // Auto-select default template if exists
      const defaultTemplate = response.find(t => t.is_default)
      if (defaultTemplate) {
        setSelectedTemplate(defaultTemplate)
      }
    } catch (error) {
      console.error('Error fetching templates:', error)
      setTemplates([])
    } finally {
      setLoadingTemplates(false)
    }
  }

  const loadJobConfiguration = async () => {
    setLoadingConfig(true)
    try {
      const [typesRes, statusesRes, stagesRes] = await Promise.all([
        api.get('/api/v1/job_types'),
        api.get('/api/v1/job_status'),
        api.get('/api/v1/job_stages')
      ])
      setJobTypes(typesRes.job_types || [])
      setJobStatuses(statusesRes.job_statuses || [])
      setJobStages(stagesRes.job_stages || [])

      // Auto-select first type if available
      if (typesRes.job_types?.length > 0) {
        setFormData(prev => ({ ...prev, job_type_id: typesRes.job_types[0].id }))
      }
    } catch (error) {
      console.error('Error fetching job configuration:', error)
    } finally {
      setLoadingConfig(false)
    }
  }

  // Load available statuses when type changes
  useEffect(() => {
    const loadAvailableStatuses = async () => {
      if (!formData.job_type_id) {
        setAvailableStatuses([])
        setFormData(prev => ({ ...prev, job_status_id: null, job_stage_id: null }))
        return
      }

      try {
        const response = await api.get(`/api/v1/job_types/${formData.job_type_id}/statuses`)
        const statuses = response.statuses || []
        setAvailableStatuses(statuses)

        // Auto-select first status if available
        if (statuses.length > 0) {
          setFormData(prev => ({ ...prev, job_status_id: statuses[0].id }))
        } else {
          setFormData(prev => ({ ...prev, job_status_id: null, job_stage_id: null }))
        }
      } catch (error) {
        console.error('Error fetching available statuses:', error)
        setAvailableStatuses([])
      }
    }

    loadAvailableStatuses()
  }, [formData.job_type_id])

  // Load available stages when type or status changes
  useEffect(() => {
    const loadAvailableStages = async () => {
      if (!formData.job_type_id || !formData.job_status_id) {
        setAvailableStages([])
        setFormData(prev => ({ ...prev, job_stage_id: null }))
        return
      }

      try {
        const response = await api.get(
          `/api/v1/job_types/${formData.job_type_id}/statuses/${formData.job_status_id}/stages`
        )
        const stages = response.stages || []
        setAvailableStages(stages)

        // Auto-select first stage if available
        if (stages.length > 0) {
          setFormData(prev => ({ ...prev, job_stage_id: stages[0].id }))
        } else {
          setFormData(prev => ({ ...prev, job_stage_id: null }))
        }
      } catch (error) {
        console.error('Error fetching available stages:', error)
        setAvailableStages([])
      }
    }

    loadAvailableStages()
  }, [formData.job_type_id, formData.job_status_id])

  // Debounced client search
  useEffect(() => {
    if (clientQuery.length < 2) {
      setClients([])
      return
    }

    const timer = setTimeout(async () => {
      setLoadingClients(true)
      try {
        const response = await api.get(`/api/v1/contacts?search=${encodeURIComponent(clientQuery)}`)
        setClients(response.data.contacts || [])
      } catch (error) {
        console.error('Error fetching clients:', error)
        setClients([])
      } finally {
        setLoadingClients(false)
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [clientQuery])

  const handleChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const handleClientSelect = (client) => {
    if (!client) {
      setSelectedClient(null)
      setFormData(prev => ({
        ...prev,
        client_id: null,
        client_name: '',
        client_email: '',
        client_phone: ''
      }))
      return
    }

    setSelectedClient(client)
    setFormData(prev => ({
      ...prev,
      client_id: client.id,
      client_name: client.full_name || '',
      client_email: client.email || '',
      client_phone: client.mobile_phone || client.office_phone || ''
    }))
  }

  const handleNext = () => {
    if (step < totalSteps) {
      setDirection('forward')
      setStep(step + 1)
    }
  }

  const handleBack = () => {
    if (step > 1) {
      setDirection('back')
      setStep(step - 1)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      // Convert contract_value to number if it exists
      const submitData = {
        ...formData,
        contract_value: formData.contract_value ? parseFloat(formData.contract_value) : null,
        template_id: selectedTemplate?.id || null,
      }

      await onSuccess(submitData)

      // Reset form
      setFormData({
        title: '',
        location: '',
        client_id: null,
        client_name: '',
        client_email: '',
        client_phone: '',
        lead_source: '',
        contract_value: '',
        start_date: '',
        end_date: '',
        site_supervisor_name: 'Andrew Clement',
        job_type_id: jobTypes.length > 0 ? jobTypes[0].id : null,
        job_status_id: null,
        job_stage_id: null,
        has_plans: false,
        has_engineering: false,
        has_soil_report: false,
        has_energy_report: false,
        land_status: '',
        createOneDriveFolders: true,
      })
      setSelectedClient(null)
      setClientQuery('')
      setSelectedTemplate(null)
      setStep(1)
      onClose()
    } catch (error) {
      console.error('Failed to create job:', error)
      alert('Failed to create job. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const canProceedToNext = () => {
    if (step === 1) {
      return (
        formData.title.trim() !== '' &&
        formData.location.trim() !== '' &&
        formData.client_id !== null
      )
    }
    if (step === 2) {
      return true // All fields optional
    }
    if (step === 3) {
      return (
        formData.title.trim() !== '' &&
        formData.location.trim() !== '' &&
        formData.client_id !== null &&
        formData.site_supervisor_name.trim() !== '' &&
        formData.job_type_id !== null &&
        formData.job_status_id !== null
      )
    }
    return true
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
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" />
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
              <Dialog.Panel className="w-full max-w-2xl transform overflow-hidden rounded-2xl bg-white dark:bg-gray-800 shadow-2xl transition-all">
                {/* Header */}
                <div className="relative bg-gradient-to-r from-indigo-500 to-purple-600 px-6 py-8 text-white">
                  <button
                    onClick={onClose}
                    className="absolute right-4 top-4 rounded-full p-1 hover:bg-white/10 transition-colors"
                  >
                    <XMarkIcon className="h-6 w-6" />
                  </button>

                  <div className="flex items-center gap-4">
                    <div className="rounded-xl bg-white/20 p-3 backdrop-blur-sm">
                      <BriefcaseIcon className="h-8 w-8" />
                    </div>
                    <div>
                      <Dialog.Title className="text-2xl font-bold">
                        Create New Construction Job
                      </Dialog.Title>
                      <p className="mt-1 text-indigo-100">
                        Let's get your project set up in just a few steps
                      </p>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="mt-6">
                    <div className="flex items-center justify-between text-sm font-medium">
                      <span className="text-indigo-100">Step {step} of {totalSteps}</span>
                      <span className="text-indigo-100">{Math.round((step / totalSteps) * 100)}%</span>
                    </div>
                    <div className="mt-2 h-2 w-full rounded-full bg-white/20 overflow-hidden">
                      <div
                        className="h-full bg-white transition-all duration-300 ease-out rounded-full"
                        style={{ width: `${(step / totalSteps) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="px-6 py-6 overflow-hidden">
                  {/* Steps Container with Swipe Animation */}
                  <div className="relative" style={{ minHeight: '400px' }}>
                    <div className="absolute inset-0 w-full">
                      {/* Step 1: Basic Information */}
                      <div
                        className={`absolute inset-0 w-full transition-all duration-400 ease-in-out ${
                          step === 1
                            ? 'translate-x-0 opacity-100'
                            : step > 1
                            ? '-translate-x-full opacity-0'
                            : 'translate-x-full opacity-0'
                        }`}
                        style={{
                          transitionProperty: 'transform, opacity',
                          transitionDuration: '400ms',
                          transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)',
                        }}
                      >
                        {step === 1 && (
                    <div className="space-y-6 animate-fadeIn">
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                          Basic Information
                        </h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                          Start with the essential details about this construction project
                        </p>
                      </div>

                      {/* Job Title */}
                      <div className="group">
                        <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          <div className="rounded-lg bg-indigo-100 dark:bg-indigo-900/30 p-2">
                            <BriefcaseIcon className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                          </div>
                          Job Title <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={formData.title}
                          onChange={(e) => handleChange('title', e.target.value)}
                          placeholder="e.g., Residential Build - 123 Main Street"
                          className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white transition-all"
                          autoFocus
                          required
                        />
                      </div>

                      {/* Location */}
                      <div className="group">
                        <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          <div className="rounded-lg bg-green-100 dark:bg-green-900/30 p-2">
                            <MapPinIcon className="h-4 w-4 text-green-600 dark:text-green-400" />
                          </div>
                          Location / Address <span className="text-red-500">*</span>
                        </label>
                        <AddressAutocomplete
                          value={formData.location}
                          onChange={(value) => handleChange('location', value)}
                          placeholder="e.g., 123 Main Street, Sydney NSW 2000"
                          className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white transition-all"
                          required
                        />
                      </div>

                      {/* Client Lookup */}
                      <div className="group">
                        <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          <div className="rounded-lg bg-blue-100 dark:bg-blue-900/30 p-2">
                            <UserCircleIcon className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                          </div>
                          Client <span className="text-red-500">*</span>
                        </label>
                        <Combobox value={selectedClient} onChange={handleClientSelect}>
                          <div className="relative">
                            <div className="relative w-full">
                              <Combobox.Input
                                className="w-full px-4 py-3 pr-10 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white transition-all"
                                displayValue={(client) => client?.full_name || ''}
                                onChange={(e) => setClientQuery(e.target.value)}
                                placeholder="Search for a client..."
                              />
                              <Combobox.Button className="absolute inset-y-0 right-0 flex items-center pr-3">
                                <ChevronUpDownIcon className="h-5 w-5 text-gray-400" aria-hidden="true" />
                              </Combobox.Button>
                            </div>
                            <Transition
                              as={Fragment}
                              leave="transition ease-in duration-100"
                              leaveFrom="opacity-100"
                              leaveTo="opacity-0"
                              afterLeave={() => setClientQuery('')}
                            >
                              <Combobox.Options className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-lg bg-white dark:bg-gray-800 py-1 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
                                {loadingClients && (
                                  <div className="px-4 py-2 text-sm text-gray-500 dark:text-gray-400">
                                    Searching...
                                  </div>
                                )}
                                {!loadingClients && clientQuery.length >= 2 && clients.length === 0 && (
                                  <div className="px-4 py-2 text-sm text-gray-500 dark:text-gray-400">
                                    No clients found. <button type="button" className="text-indigo-600 hover:text-indigo-500">Create new contact?</button>
                                  </div>
                                )}
                                {clients.map((client) => (
                                  <Combobox.Option
                                    key={client.id}
                                    value={client}
                                    className={({ active }) =>
                                      `relative cursor-pointer select-none py-2 pl-10 pr-4 ${
                                        active ? 'bg-indigo-600 text-white' : 'text-gray-900 dark:text-white'
                                      }`
                                    }
                                  >
                                    {({ selected, active }) => (
                                      <>
                                        <div className="flex flex-col">
                                          <span className={`block truncate ${selected ? 'font-medium' : 'font-normal'}`}>
                                            {client.full_name}
                                          </span>
                                          {client.email && (
                                            <span className={`block truncate text-xs ${active ? 'text-indigo-200' : 'text-gray-500 dark:text-gray-400'}`}>
                                              {client.email}
                                            </span>
                                          )}
                                        </div>
                                        {selected && (
                                          <span className={`absolute inset-y-0 left-0 flex items-center pl-3 ${active ? 'text-white' : 'text-indigo-600'}`}>
                                            <CheckIcon className="h-5 w-5" aria-hidden="true" />
                                          </span>
                                        )}
                                      </>
                                    )}
                                  </Combobox.Option>
                                ))}
                              </Combobox.Options>
                            </Transition>
                          </div>
                        </Combobox>
                        {selectedClient && (
                          <div className="mt-2 text-sm text-gray-600 dark:text-gray-400 space-y-1">
                            {formData.client_email && <p>Email: {formData.client_email}</p>}
                            {formData.client_phone && <p>Phone: {formData.client_phone}</p>}
                          </div>
                        )}
                      </div>

                      {/* Lead Source */}
                      <div className="group">
                        <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          <div className="rounded-lg bg-yellow-100 dark:bg-yellow-900/30 p-2">
                            <LightBulbIcon className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
                          </div>
                          Lead Source
                        </label>
                        <select
                          value={formData.lead_source}
                          onChange={(e) => handleChange('lead_source', e.target.value)}
                          className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white transition-all"
                        >
                          <option value="">Select a source...</option>
                          {LEAD_SOURCES.map(source => (
                            <option key={source} value={source}>{source}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                        )}
                      </div>

                      {/* Step 2: Financial & Timeline */}
                      <div
                        className={`absolute inset-0 w-full transition-all duration-400 ease-in-out ${
                          step === 2
                            ? 'translate-x-0 opacity-100'
                            : step > 2
                            ? '-translate-x-full opacity-0'
                            : 'translate-x-full opacity-0'
                        }`}
                        style={{
                          transitionProperty: 'transform, opacity',
                          transitionDuration: '400ms',
                          transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)',
                        }}
                      >
                        {step === 2 && (
                    <div className="space-y-6 animate-fadeIn">
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                          Project Details
                        </h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                          Set the contract value, timeline, and site supervisor
                        </p>
                      </div>

                      {/* Contract Value */}
                      <div className="group">
                        <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          <div className="rounded-lg bg-green-100 dark:bg-green-900/30 p-2">
                            <CurrencyDollarIcon className="h-4 w-4 text-green-600 dark:text-green-400" />
                          </div>
                          Contract Value
                        </label>
                        <div className="relative">
                          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400">
                            $
                          </span>
                          <input
                            type="number"
                            step="0.01"
                            value={formData.contract_value}
                            onChange={(e) => handleChange('contract_value', e.target.value)}
                            onFocus={(e) => e.target.select()}
                            placeholder="0.00"
                            className="w-full pl-8 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white transition-all"
                          />
                        </div>
                      </div>

                      {/* Date Range */}
                      <div className="grid grid-cols-2 gap-4">
                        <div className="group">
                          <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            <div className="rounded-lg bg-purple-100 dark:bg-purple-900/30 p-2">
                              <CalendarIcon className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                            </div>
                            Start Date
                          </label>
                          <input
                            type="date"
                            value={formData.start_date}
                            onChange={(e) => handleChange('start_date', e.target.value)}
                            className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white transition-all"
                          />
                        </div>

                        <div className="group">
                          <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            <div className="rounded-lg bg-purple-100 dark:bg-purple-900/30 p-2">
                              <CalendarIcon className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                            </div>
                            End Date
                          </label>
                          <input
                            type="date"
                            value={formData.end_date}
                            onChange={(e) => handleChange('end_date', e.target.value)}
                            className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white transition-all"
                          />
                        </div>
                      </div>

                      {/* Site Supervisor */}
                      <div className="group">
                        <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          <div className="rounded-lg bg-yellow-100 dark:bg-yellow-900/30 p-2">
                            <UserCircleIcon className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
                          </div>
                          Site Supervisor <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={formData.site_supervisor_name}
                          onChange={(e) => handleChange('site_supervisor_name', e.target.value)}
                          placeholder="e.g., Andrew Clement"
                          className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white transition-all"
                          required
                        />
                      </div>
                    </div>
                        )}
                      </div>

                      {/* Step 3: Stage & Status */}
                      <div
                        className={`absolute inset-0 w-full transition-all duration-400 ease-in-out ${
                          step === 3
                            ? 'translate-x-0 opacity-100'
                            : step > 3
                            ? '-translate-x-full opacity-0'
                            : 'translate-x-full opacity-0'
                        }`}
                        style={{
                          transitionProperty: 'transform, opacity',
                          transitionDuration: '400ms',
                          transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)',
                        }}
                      >
                        {step === 3 && (
                    <div className="space-y-6 animate-fadeIn">
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                          Documentation & Status
                        </h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                          Track available documents, land status, and project stage
                        </p>
                      </div>

                      {/* Schedule Template Selection */}
                      <div className="group">
                        <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                          <div className="rounded-lg bg-purple-100 dark:bg-purple-900/30 p-2">
                            <ChartBarIcon className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                          </div>
                          Schedule Template
                        </label>
                        {loadingTemplates ? (
                          <div className="text-sm text-gray-500 dark:text-gray-400 p-4 border border-gray-300 dark:border-gray-600 rounded-lg">
                            Loading templates...
                          </div>
                        ) : templates.length === 0 ? (
                          <div className="text-sm text-gray-500 dark:text-gray-400 p-4 border border-gray-300 dark:border-gray-600 rounded-lg">
                            No templates available. Create one in Settings first.
                          </div>
                        ) : (
                          <RadioGroup value={selectedTemplate} onChange={setSelectedTemplate}>
                            <div className="space-y-2">
                              {templates.map((template) => (
                                <RadioGroup.Option
                                  key={template.id}
                                  value={template}
                                  className={({ checked }) =>
                                    `flex items-start gap-3 p-4 border ${
                                      checked
                                        ? 'border-purple-600 bg-purple-50 dark:bg-purple-900/20'
                                        : 'border-gray-300 dark:border-gray-600'
                                    } rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors`
                                  }
                                >
                                  {({ checked }) => (
                                    <>
                                      <div className={`h-4 w-4 rounded-full border-2 flex items-center justify-center mt-0.5 ${
                                        checked ? 'border-purple-600' : 'border-gray-300 dark:border-gray-600'
                                      }`}>
                                        {checked && <div className="h-2 w-2 rounded-full bg-purple-600" />}
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                          <span className={`text-sm font-medium ${
                                            checked ? 'text-purple-900 dark:text-purple-100' : 'text-gray-900 dark:text-white'
                                          }`}>
                                            {template.name}
                                          </span>
                                          {template.is_default && (
                                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300">
                                              Default
                                            </span>
                                          )}
                                        </div>
                                        {template.description && (
                                          <p className={`text-xs mt-1 ${
                                            checked ? 'text-purple-700 dark:text-purple-300' : 'text-gray-600 dark:text-gray-400'
                                          }`}>
                                            {template.description}
                                          </p>
                                        )}
                                        <p className={`text-xs mt-1 ${
                                          checked ? 'text-purple-600 dark:text-purple-400' : 'text-gray-500 dark:text-gray-500'
                                        }`}>
                                          {template.row_count} tasks
                                        </p>
                                      </div>
                                    </>
                                  )}
                                </RadioGroup.Option>
                              ))}
                            </div>
                          </RadioGroup>
                        )}
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                          The selected template will be used to create the initial schedule for this job.
                        </p>
                      </div>

                      {/* Documents Available */}
                      <div className="group">
                        <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                          <div className="rounded-lg bg-green-100 dark:bg-green-900/30 p-2">
                            <DocumentTextIcon className="h-4 w-4 text-green-600 dark:text-green-400" />
                          </div>
                          Documents Available
                        </label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <label className="flex items-center gap-3 p-3 border border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                            <input
                              type="checkbox"
                              checked={formData.has_plans}
                              onChange={(e) => handleChange('has_plans', e.target.checked)}
                              className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                            />
                            <span className="text-sm text-gray-700 dark:text-gray-300">Plans/Drawings</span>
                          </label>
                          <label className="flex items-center gap-3 p-3 border border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                            <input
                              type="checkbox"
                              checked={formData.has_engineering}
                              onChange={(e) => handleChange('has_engineering', e.target.checked)}
                              className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                            />
                            <span className="text-sm text-gray-700 dark:text-gray-300">Engineering</span>
                          </label>
                          <label className="flex items-center gap-3 p-3 border border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                            <input
                              type="checkbox"
                              checked={formData.has_soil_report}
                              onChange={(e) => handleChange('has_soil_report', e.target.checked)}
                              className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                            />
                            <span className="text-sm text-gray-700 dark:text-gray-300">Soil Report</span>
                          </label>
                          <label className="flex items-center gap-3 p-3 border border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                            <input
                              type="checkbox"
                              checked={formData.has_energy_report}
                              onChange={(e) => handleChange('has_energy_report', e.target.checked)}
                              className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                            />
                            <span className="text-sm text-gray-700 dark:text-gray-300">Energy Report</span>
                          </label>
                        </div>
                      </div>

                      {/* OneDrive Folder Creation */}
                      <div className="group">
                        <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                          <div className="rounded-lg bg-blue-100 dark:bg-blue-900/30 p-2">
                            <FolderIcon className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                          </div>
                          OneDrive Integration
                        </label>
                        <label className="flex items-start gap-3 p-4 border border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors bg-blue-50/50 dark:bg-blue-900/10">
                          <input
                            type="checkbox"
                            checked={formData.createOneDriveFolders}
                            onChange={(e) => handleChange('createOneDriveFolders', e.target.checked)}
                            className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded mt-0.5"
                          />
                          <div className="flex-1">
                            <span className="text-sm font-medium text-gray-900 dark:text-white block">
                              Create OneDrive folders automatically
                            </span>
                            <span className="text-xs text-gray-600 dark:text-gray-400 block mt-1">
                              Creates the Tekna Standard folder structure in OneDrive for this job
                            </span>
                          </div>
                        </label>
                      </div>

                      {/* Land Status */}
                      <div className="group">
                        <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                          <div className="rounded-lg bg-teal-100 dark:bg-teal-900/30 p-2">
                            <MapPinIcon className="h-4 w-4 text-teal-600 dark:text-teal-400" />
                          </div>
                          Land Status
                        </label>
                        <RadioGroup value={formData.land_status} onChange={(value) => handleChange('land_status', value)}>
                          <div className="space-y-2">
                            {LAND_STATUS_OPTIONS.map((option) => (
                              <RadioGroup.Option
                                key={option}
                                value={option}
                                className={({ checked }) =>
                                  `flex items-center gap-3 p-3 border ${
                                    checked
                                      ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-900/20'
                                      : 'border-gray-300 dark:border-gray-600'
                                  } rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors`
                                }
                              >
                                {({ checked }) => (
                                  <>
                                    <div className={`h-4 w-4 rounded-full border-2 flex items-center justify-center ${
                                      checked ? 'border-indigo-600' : 'border-gray-300 dark:border-gray-600'
                                    }`}>
                                      {checked && <div className="h-2 w-2 rounded-full bg-indigo-600" />}
                                    </div>
                                    <span className={`text-sm ${
                                      checked ? 'text-indigo-900 dark:text-indigo-100 font-medium' : 'text-gray-700 dark:text-gray-300'
                                    }`}>
                                      {option}
                                    </span>
                                  </>
                                )}
                              </RadioGroup.Option>
                            ))}
                          </div>
                        </RadioGroup>
                      </div>

                      {/* Job Type */}
                      <div className="group">
                        <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          <div className="rounded-lg bg-indigo-100 dark:bg-indigo-900/30 p-2">
                            <BriefcaseIcon className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                          </div>
                          Job Type <span className="text-red-500">*</span>
                        </label>
                        <select
                          value={formData.job_type_id || ''}
                          onChange={(e) => handleChange('job_type_id', parseInt(e.target.value))}
                          className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white transition-all"
                          required
                          disabled={loadingConfig}
                        >
                          <option value="">Select a type...</option>
                          {jobTypes.map(type => (
                            <option key={type.id} value={type.id}>{type.name}</option>
                          ))}
                        </select>
                      </div>

                      {/* Job Status */}
                      <div className="group">
                        <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          <div className="rounded-lg bg-rose-100 dark:bg-rose-900/30 p-2">
                            <ChartBarIcon className="h-4 w-4 text-rose-600 dark:text-rose-400" />
                          </div>
                          Job Status <span className="text-red-500">*</span>
                        </label>
                        <select
                          value={formData.job_status_id || ''}
                          onChange={(e) => handleChange('job_status_id', parseInt(e.target.value))}
                          className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white transition-all"
                          required
                          disabled={!formData.job_type_id || availableStatuses.length === 0}
                        >
                          <option value="">Select a status...</option>
                          {availableStatuses.map(status => (
                            <option key={status.id} value={status.id}>{status.name}</option>
                          ))}
                        </select>
                        {formData.job_type_id && availableStatuses.length === 0 && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                            No statuses configured for this job type. Configure in Settings → Workflow Config.
                          </p>
                        )}
                      </div>

                      {/* Job Stage */}
                      <div className="group">
                        <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          <div className="rounded-lg bg-cyan-100 dark:bg-cyan-900/30 p-2">
                            <FlagIcon className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
                          </div>
                          Job Stage
                        </label>
                        <select
                          value={formData.job_stage_id || ''}
                          onChange={(e) => handleChange('job_stage_id', e.target.value ? parseInt(e.target.value) : null)}
                          className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white transition-all"
                          disabled={!formData.job_type_id || !formData.job_status_id || availableStages.length === 0}
                        >
                          <option value="">Select a stage...</option>
                          {availableStages.map(stage => (
                            <option key={stage.id} value={stage.id}>{stage.name}</option>
                          ))}
                        </select>
                        {formData.job_type_id && formData.job_status_id && availableStages.length === 0 && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                            No stages configured for this combination. Configure in Settings → Workflow Config.
                          </p>
                        )}
                      </div>

                      {/* Summary Card */}
                      <div className="mt-6 rounded-xl bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 border border-indigo-200 dark:border-indigo-800 p-6">
                        <div className="flex items-start gap-3">
                          <CheckCircleIcon className="h-6 w-6 text-indigo-600 dark:text-indigo-400 mt-0.5 flex-shrink-0" />
                          <div className="flex-1">
                            <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
                              Ready to Create
                            </h4>
                            <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                              <p><span className="font-medium">Job:</span> {formData.title || 'Untitled'}</p>
                              <p><span className="font-medium">Location:</span> {formData.location || 'Not specified'}</p>
                              {formData.client_name && <p><span className="font-medium">Client:</span> {formData.client_name}</p>}
                              {formData.lead_source && <p><span className="font-medium">Lead Source:</span> {formData.lead_source}</p>}
                              {formData.contract_value && <p><span className="font-medium">Value:</span> ${parseFloat(formData.contract_value).toLocaleString()}</p>}
                              {formData.site_supervisor_name && <p><span className="font-medium">Site Supervisor:</span> {formData.site_supervisor_name}</p>}
                              {selectedTemplate && <p><span className="font-medium">Schedule Template:</span> {selectedTemplate.name} ({selectedTemplate.row_count} tasks)</p>}
                              {formData.land_status && <p><span className="font-medium">Land:</span> {formData.land_status}</p>}
                              <p>
                                <span className="font-medium">Type:</span> {jobTypes.find(t => t.id === formData.job_type_id)?.name || 'Not selected'} •
                                <span className="font-medium"> Status:</span> {availableStatuses.find(s => s.id === formData.job_status_id)?.name || 'Not selected'}
                                {formData.job_stage_id && <> • <span className="font-medium"> Stage:</span> {availableStages.find(s => s.id === formData.job_stage_id)?.name}</>}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Navigation */}
                  <div className="mt-8 flex items-center justify-between pt-6 border-t border-gray-200 dark:border-gray-700">
                    <div>
                      {step > 1 && (
                        <button
                          type="button"
                          onClick={handleBack}
                          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                        >
                          <ArrowLeftIcon className="h-4 w-4" />
                          Back
                        </button>
                      )}
                    </div>

                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                      >
                        Cancel
                      </button>

                      {step < totalSteps ? (
                        <button
                          type="button"
                          onClick={handleNext}
                          disabled={!canProceedToNext()}
                          className="inline-flex items-center gap-2 px-6 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-indigo-500/30"
                        >
                          Next
                          <ArrowRightIcon className="h-4 w-4" />
                        </button>
                      ) : (
                        <button
                          type="submit"
                          disabled={
                            isSubmitting ||
                            !formData.title.trim() ||
                            !formData.site_supervisor_name.trim() ||
                            !formData.job_type_id ||
                            !formData.job_status_id
                          }
                          className="inline-flex items-center gap-2 px-6 py-2 text-sm font-medium text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-indigo-500/30"
                        >
                          {isSubmitting ? (
                            <>
                              <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                              Creating...
                            </>
                          ) : (
                            <>
                              <CheckCircleIcon className="h-4 w-4" />
                              Create Job
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                </form>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  )
}
