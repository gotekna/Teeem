import { useState, useEffect, Fragment } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Dialog, Transition } from '@headlessui/react'
import {
  BriefcaseIcon,
  FolderIcon,
  CogIcon,
  ArrowDownTrayIcon,
  ShoppingCartIcon,
  SparklesIcon,
  CheckCircleIcon,
  XMarkIcon,
  ArrowPathIcon,
  LockClosedIcon,
} from '@heroicons/react/24/outline'
import { api } from '../api'
import AiReviewModal from '../components/estimates/AiReviewModal'

const STAGES = [
  'Planning',
  'Design',
  'Preconstruction',
  'Construction',
  'Closeout',
  'Complete',
]

export default function JobSetupPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [job, setJob] = useState(null)
  const [estimates, setEstimates] = useState([])
  const [loading, setLoading] = useState(true)
  const [pollingEstimates, setPollingEstimates] = useState(true)
  const [showDetailsModal, setShowDetailsModal] = useState(false)
  const [showAiReviewModal, setShowAiReviewModal] = useState(false)
  const [selectedEstimate, setSelectedEstimate] = useState(null)
  const [generatingPOs, setGeneratingPOs] = useState(false)

  // Form state for job details
  const [detailsForm, setDetailsForm] = useState({
    site_supervisor_name: '',
    contract_value: '',
    stage: '',
    start_date: '',
  })

  useEffect(() => {
    loadJob()
    loadEstimates()
  }, [id])

  // Poll for OneDrive folder status
  useEffect(() => {
    if (
      job?.onedrive_folder_creation_status === 'pending' ||
      job?.onedrive_folder_creation_status === 'processing'
    ) {
      const interval = setInterval(() => {
        loadJob()
      }, 5000)
      return () => clearInterval(interval)
    }
  }, [job?.onedrive_folder_creation_status])

  // Poll for new estimates
  useEffect(() => {
    if (pollingEstimates && estimates.length === 0) {
      const interval = setInterval(() => {
        loadEstimates()
      }, 10000)
      return () => clearInterval(interval)
    }
  }, [estimates.length, pollingEstimates])

  const loadJob = async () => {
    try {
      const response = await api.get(`/api/v1/jobs/${id}`)
      setJob(response.construction)
      setDetailsForm({
        site_supervisor_name: response.construction.site_supervisor_name || '',
        contract_value: response.construction.contract_value || '',
        stage: response.construction.stage || '',
        start_date: response.construction.start_date || '',
      })
    } catch (error) {
      console.error('Error loading job:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadEstimates = async () => {
    try {
      const response = await api.get(`/api/v1/estimates?construction_id=${id}`)
      setEstimates(response.data || [])
    } catch (error) {
      console.error('Error loading estimates:', error)
    }
  }

  const hasRequiredFields = (job) => {
    return (
      job?.site_supervisor_name &&
      job?.contract_value &&
      job?.stage &&
      job?.start_date
    )
  }

  const handleRetryOneDrive = async () => {
    try {
      await api.post(`/api/v1/jobs/${id}/retry_onedrive_folders`)
      loadJob()
    } catch (error) {
      console.error('Error retrying OneDrive creation:', error)
      alert('Failed to retry OneDrive folder creation')
    }
  }

  const handleSaveDetails = async (e) => {
    e.preventDefault()
    try {
      await api.put(`/api/v1/jobs/${id}`, {
        construction: detailsForm,
      })
      await loadJob()
      setShowDetailsModal(false)
    } catch (error) {
      console.error('Error saving job details:', error)
      alert('Failed to save job details')
    }
  }

  const handleGeneratePOs = async (estimateId) => {
    setGeneratingPOs(true)
    try {
      const response = await api.post(
        `/api/v1/estimates/${estimateId}/generate_purchase_orders`
      )
      await loadEstimates()
      alert(
        `Successfully created ${response.purchase_orders_count || 0} purchase orders`
      )
    } catch (error) {
      console.error('Error generating purchase orders:', error)
      alert('Failed to generate purchase orders')
    } finally {
      setGeneratingPOs(false)
    }
  }

  const handleStartAiReview = (estimate) => {
    setSelectedEstimate(estimate)
    setShowAiReviewModal(true)
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    )
  }

  const steps = [
    { id: 'basics', completed: true }, // Always true
    {
      id: 'onedrive',
      completed: job?.onedrive_folder_creation_status === 'completed',
    },
    { id: 'details', completed: hasRequiredFields(job) },
    { id: 'estimate', completed: estimates.length > 0 },
    {
      id: 'pos',
      completed: estimates.some((e) => e.status === 'imported'),
    },
    { id: 'ai', completed: false, optional: true }, // Optional step
  ]

  const completedCount = steps.filter((s) => s.completed && !s.optional).length
  const totalSteps = steps.filter((s) => !s.optional).length

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-[576px] mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Job Setup
          </h1>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            {completedCount} of {totalSteps} completed
          </p>
        </div>

        {/* Checklist */}
        <div className="space-y-4">
          {/* Step 1: Create job basics */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0">
                <div className="rounded-lg bg-green-100 dark:bg-green-900/30 p-3">
                  <BriefcaseIcon className="h-6 w-6 text-green-600 dark:text-green-400" />
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-semibold text-gray-900 dark:text-white">
                  Create job basics
                </h3>
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                  Job name, location, and client information
                </p>
              </div>
              <div className="flex-shrink-0">
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200">
                  <CheckCircleIcon className="h-4 w-4 mr-1" />
                  Completed
                </span>
              </div>
            </div>
          </div>

          {/* Step 2: OneDrive folders */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0">
                <div className="rounded-lg bg-blue-100 dark:bg-blue-900/30 p-3">
                  <FolderIcon className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-semibold text-gray-900 dark:text-white">
                  Set up OneDrive folders
                </h3>
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                  Auto-creating Tekna Standard folder structure
                </p>
              </div>
              <div className="flex-shrink-0">
                {job?.onedrive_folder_creation_status === 'completed' && (
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200">
                    <CheckCircleIcon className="h-4 w-4 mr-1" />
                    Completed
                  </span>
                )}
                {(job?.onedrive_folder_creation_status === 'processing' ||
                  job?.onedrive_folder_creation_status === 'pending') && (
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200">
                    <ArrowPathIcon className="h-4 w-4 mr-1 animate-spin" />
                    In Progress
                  </span>
                )}
                {job?.onedrive_folder_creation_status === 'failed' && (
                  <button
                    onClick={handleRetryOneDrive}
                    className="inline-flex items-center px-3 py-1 rounded-md text-xs font-medium bg-red-100 text-red-800 hover:bg-red-200 dark:bg-red-900/40 dark:text-red-200"
                  >
                    Retry
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Step 3: Complete job details */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0">
                <div className="rounded-lg bg-purple-100 dark:bg-purple-900/30 p-3">
                  <CogIcon className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-semibold text-gray-900 dark:text-white">
                  Complete job details
                </h3>
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                  Add team members, contract value, dates, and project stage
                </p>
              </div>
              <div className="flex-shrink-0">
                {hasRequiredFields(job) ? (
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200">
                    <CheckCircleIcon className="h-4 w-4 mr-1" />
                    Completed
                  </span>
                ) : (
                  <button
                    onClick={() => setShowDetailsModal(true)}
                    className="inline-flex items-center px-4 py-2 rounded-md text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-700"
                  >
                    Start
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Step 4: Import estimate */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0">
                <div className="rounded-lg bg-yellow-100 dark:bg-yellow-900/30 p-3">
                  <ArrowDownTrayIcon className="h-6 w-6 text-yellow-600 dark:text-yellow-400" />
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-semibold text-gray-900 dark:text-white">
                  Import estimate from Unreal Engine
                </h3>
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                  {estimates.length > 0
                    ? `${estimates.length} estimate${
                        estimates.length > 1 ? 's' : ''
                      } imported`
                    : 'Waiting for quantity estimate from your estimator...'}
                </p>
              </div>
              <div className="flex-shrink-0">
                {estimates.length > 0 ? (
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200">
                    <CheckCircleIcon className="h-4 w-4 mr-1" />
                    Completed
                  </span>
                ) : (
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    Waiting...
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Step 5: Generate purchase orders */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0">
                <div
                  className={`rounded-lg p-3 ${
                    estimates.length === 0
                      ? 'bg-gray-100 dark:bg-gray-700/30'
                      : 'bg-green-100 dark:bg-green-900/30'
                  }`}
                >
                  {estimates.length === 0 ? (
                    <LockClosedIcon className="h-6 w-6 text-gray-400 dark:text-gray-600" />
                  ) : (
                    <ShoppingCartIcon className="h-6 w-6 text-green-600 dark:text-green-400" />
                  )}
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <h3
                  className={`text-base font-semibold ${
                    estimates.length === 0
                      ? 'text-gray-400 dark:text-gray-600'
                      : 'text-gray-900 dark:text-white'
                  }`}
                >
                  Generate purchase orders
                </h3>
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                  Auto-create draft POs from estimate with smart supplier lookup
                </p>
              </div>
              <div className="flex-shrink-0">
                {estimates.length === 0 ? (
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-500 dark:bg-gray-700/40 dark:text-gray-400">
                    <LockClosedIcon className="h-4 w-4 mr-1" />
                    Locked
                  </span>
                ) : estimates.some((e) => e.status === 'imported') ? (
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200">
                    <CheckCircleIcon className="h-4 w-4 mr-1" />
                    Completed
                  </span>
                ) : (
                  <button
                    onClick={() => handleGeneratePOs(estimates[0].id)}
                    disabled={generatingPOs}
                    className="inline-flex items-center px-4 py-2 rounded-md text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {generatingPOs ? 'Generating...' : 'Start'}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Step 6: AI review (optional) */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 opacity-90">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0">
                <div
                  className={`rounded-lg p-3 ${
                    estimates.length === 0
                      ? 'bg-gray-100 dark:bg-gray-700/30'
                      : 'bg-indigo-100 dark:bg-indigo-900/30'
                  }`}
                >
                  {estimates.length === 0 ? (
                    <LockClosedIcon className="h-6 w-6 text-gray-400 dark:text-gray-600" />
                  ) : (
                    <SparklesIcon className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
                  )}
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3
                    className={`text-base font-semibold ${
                      estimates.length === 0
                        ? 'text-gray-400 dark:text-gray-600'
                        : 'text-gray-900 dark:text-white'
                    }`}
                  >
                    AI plan review
                  </h3>
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400">
                    Optional
                  </span>
                </div>
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                  Verify quantities against construction plans using Claude AI
                </p>
              </div>
              <div className="flex-shrink-0">
                {estimates.length === 0 ? (
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-500 dark:bg-gray-700/40 dark:text-gray-400">
                    <LockClosedIcon className="h-4 w-4 mr-1" />
                    Locked
                  </span>
                ) : (
                  <button
                    onClick={() => handleStartAiReview(estimates[0])}
                    className="inline-flex items-center px-4 py-2 rounded-md text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-700"
                  >
                    Start
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Footer buttons */}
        <div className="mt-8 flex items-center justify-between gap-4">
          <button
            onClick={() => navigate(`/jobs/${id}`)}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            Skip for now
          </button>
          <button
            onClick={() => navigate(`/jobs/${id}`)}
            className="inline-flex items-center px-6 py-2 text-sm font-medium text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 rounded-lg transition-all shadow-lg shadow-indigo-500/30"
          >
            Done
          </button>
        </div>
      </div>

      {/* Job Details Modal */}
      <Transition appear show={showDetailsModal} as={Fragment}>
        <Dialog
          as="div"
          className="relative z-50"
          onClose={() => setShowDetailsModal(false)}
        >
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
                <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white dark:bg-gray-800 shadow-2xl transition-all">
                  <div className="relative bg-gradient-to-r from-indigo-500 to-purple-600 px-6 py-6 text-white">
                    <button
                      onClick={() => setShowDetailsModal(false)}
                      className="absolute right-4 top-4 rounded-full p-1 hover:bg-white/10 transition-colors"
                    >
                      <XMarkIcon className="h-5 w-5" />
                    </button>
                    <Dialog.Title className="text-xl font-bold">
                      Complete Job Details
                    </Dialog.Title>
                    <p className="mt-1 text-sm text-indigo-100">
                      Fill in the remaining project information
                    </p>
                  </div>

                  <form onSubmit={handleSaveDetails} className="px-6 py-6 space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Site Supervisor <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={detailsForm.site_supervisor_name}
                        onChange={(e) =>
                          setDetailsForm({
                            ...detailsForm,
                            site_supervisor_name: e.target.value,
                          })
                        }
                        placeholder="e.g., Andrew Clement"
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Contract Value <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400">
                          $
                        </span>
                        <input
                          type="number"
                          step="0.01"
                          value={detailsForm.contract_value}
                          onChange={(e) =>
                            setDetailsForm({
                              ...detailsForm,
                              contract_value: e.target.value,
                            })
                          }
                          onFocus={(e) => e.target.select()}
                          placeholder="0.00"
                          className="w-full pl-8 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white"
                          required
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Start Date <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="date"
                        value={detailsForm.start_date}
                        onChange={(e) =>
                          setDetailsForm({
                            ...detailsForm,
                            start_date: e.target.value,
                          })
                        }
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Project Stage <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={detailsForm.stage}
                        onChange={(e) =>
                          setDetailsForm({
                            ...detailsForm,
                            stage: e.target.value,
                          })
                        }
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white"
                        required
                      >
                        <option value="">Select a stage...</option>
                        {STAGES.map((stage) => (
                          <option key={stage} value={stage}>
                            {stage}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="flex items-center justify-end gap-3 pt-4">
                      <button
                        type="button"
                        onClick={() => setShowDetailsModal(false)}
                        className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="px-6 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors"
                      >
                        Save
                      </button>
                    </div>
                  </form>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>

      {/* AI Review Modal */}
      {showAiReviewModal && selectedEstimate && (
        <AiReviewModal
          isOpen={showAiReviewModal}
          onClose={() => {
            setShowAiReviewModal(false)
            setSelectedEstimate(null)
          }}
          estimateId={selectedEstimate.id}
          constructionId={id}
        />
      )}
    </div>
  )
}
