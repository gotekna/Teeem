import { useEffect, useState } from 'react'
import { api } from '../api'
import { formatCurrency } from '../utils/formatters'
import {
  PlusIcon,
  BriefcaseIcon,
  DocumentArrowUpIcon,
} from '@heroicons/react/24/outline'
import { useNavigate } from 'react-router-dom'
import NewJobModal from '../components/jobs/NewJobModal'
import CsvImportJobModal from '../components/jobs/CsvImportJobModal'
import TrapidTableView from '../components/documentation/TrapidTableView'

export default function ActiveJobsPage() {
  const navigate = useNavigate()
  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showNewJobModal, setShowNewJobModal] = useState(false)
  const [showCsvImportModal, setShowCsvImportModal] = useState(false)

  useEffect(() => {
    console.log('ActiveJobsPage LOADED - TrapidTableView implementation')
    loadJobs()
  }, [])

  const loadJobs = async () => {
    try {
      setLoading(true)
      const response = await api.get(
        `/api/v1/jobs?status=Active&per_page=1000`
      )
      setJobs(response.jobs || [])
    } catch (err) {
      setError('Failed to load active jobs')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateJob = async (jobData) => {
    try {
      const { createOneDriveFolders, ...jobDataFields } = jobData

      const response = await api.post('/api/v1/jobs', {
        job: jobDataFields,
        create_onedrive_folders: createOneDriveFolders,
        template_id: null
      })

      await loadJobs()

      if (createOneDriveFolders) {
        alert('Job created successfully! OneDrive folders are being created in the background.')
      }

      if (response.job && response.job.id) {
        navigate(`/jobs/${response.job.id}/setup`)
      }
    } catch (err) {
      console.error('Failed to create job:', err)
      throw err
    }
  }

  // Transform jobs to TrapidTableView format
  const trinityJobs = jobs.map((job, index) => ({
    id: job.id,
    category: 'jobs',
    chapter_number: 0,
    chapter_name: 'Jobs',
    section_number: String(index + 1),
    title: job.title,
    entry_type: job.stage,
    description: `${formatCurrency(job.contract_value || 0)} contract`,
    status: job.stage,
    severity: job.profit_percentage > 50 ? 'high' : 'medium',
    _original: job
  }))


  if (loading && jobs.length === 0) {
    return (
      <div className="flex h-screen overflow-hidden">
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex h-screen overflow-hidden">
        <div className="flex-1 flex items-center justify-center">
          <div className="text-red-600 dark:text-red-400">{error}</div>
        </div>
      </div>
    )
  }

  return (
    <div className="-mx-4 sm:-mx-6 lg:-mx-8 h-screen flex flex-col bg-white dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 sm:px-6 lg:px-8 py-3">
        <div className="flex items-center justify-between gap-4">
          {/* Left: Title and count */}
          <div className="flex items-center gap-3">
            <BriefcaseIcon className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            <div className="flex items-baseline gap-2">
              <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
                Jobs
              </h1>
              <span className="text-sm text-gray-500 dark:text-gray-400">
                {jobs.length} {jobs.length === 1 ? 'job' : 'jobs'}
              </span>
            </div>
          </div>

          {/* Right: Action buttons */}
          <div className="flex gap-2">
            <button
              onClick={() => setShowCsvImportModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm border border-transparent rounded-lg text-white bg-gradient-to-r from-green-600 to-green-600 hover:from-green-700 hover:to-green-700 transition"
            >
              <DocumentArrowUpIcon className="h-4 w-4" />
              Import CSV
            </button>
            <button
              onClick={() => setShowNewJobModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm border border-transparent rounded-lg text-white bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 transition"
            >
              <PlusIcon className="h-4 w-4" />
              New Job
            </button>
          </div>
        </div>
      </div>

      {/* TrapidTableView */}
      <div className="flex-1 overflow-hidden">
        <TrapidTableView
          entries={trinityJobs}
          onView={(entry) => {
            console.log('View job:', entry._original)
            navigate(`/jobs/${entry._original.id}`)
          }}
          onEdit={(entry) => {
            console.log('Edit job:', entry._original)
            navigate(`/jobs/${entry._original.id}`)
          }}
          onDelete={(entry) => {
            console.log('Delete job:', entry._original)
          }}
          category="jobs"
        />
      </div>

      {/* New Job Modal */}
      <NewJobModal
        isOpen={showNewJobModal}
        onClose={() => setShowNewJobModal(false)}
        onSuccess={handleCreateJob}
      />

      {/* CSV Import Modal */}
      <CsvImportJobModal
        isOpen={showCsvImportModal}
        onClose={() => setShowCsvImportModal(false)}
        onSuccess={() => {
          setShowCsvImportModal(false)
          loadJobs()
        }}
      />
    </div>
  )
}
