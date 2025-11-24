import { useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import {
  BriefcaseIcon,
  CurrencyDollarIcon,
  PlusIcon,
  ChevronRightIcon,
  FolderIcon,
  ArrowUpTrayIcon,
} from '@heroicons/react/24/outline'
import { api } from '../../api'

export default function ExplorerSidebar({ onUploadClick }) {
  const location = useLocation()
  const [activeJobs, setActiveJobs] = useState([])
  const [priceBooks, setPriceBooks] = useState([])
  const [loadingJobs, setLoadingJobs] = useState(true)
  const [loadingPriceBooks, setLoadingPriceBooks] = useState(true)
  const [jobsExpanded, setJobsExpanded] = useState(true)
  const [priceBooksExpanded, setPriceBooksExpanded] = useState(true)

  useEffect(() => {
    loadActiveJobs()
    loadPriceBooks()
  }, [])

  const loadActiveJobs = async () => {
    try {
      setLoadingJobs(true)
      const response = await api.get('/api/v1/tables')
      // Find tables tagged as "Active Jobs" or with name containing "job"
      const jobTables = (response.tables || []).filter(table =>
        table.is_live && (
          table.name.toLowerCase().includes('job') ||
          table.name.toLowerCase().includes('construction')
        )
      )
      setActiveJobs(jobTables)
    } catch (err) {
      console.error('Failed to load active jobs:', err)
    } finally {
      setLoadingJobs(false)
    }
  }

  const loadPriceBooks = async () => {
    try {
      setLoadingPriceBooks(true)
      const response = await api.get('/api/v1/tables')
      // Find tables tagged as "Price Book" or with name containing "price"
      const priceBookTables = (response.tables || []).filter(table =>
        table.is_live && (
          table.name.toLowerCase().includes('price') ||
          table.name.toLowerCase().includes('product') ||
          table.name.toLowerCase().includes('catalog')
        )
      )
      setPriceBooks(priceBookTables)
    } catch (err) {
      console.error('Failed to load price books:', err)
    } finally {
      setLoadingPriceBooks(false)
    }
  }

  const isActiveRoute = (path) => {
    return location.pathname === path
  }

  return (
    <div className="w-64 h-full bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 flex flex-col">
      {/* Upload Button */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-800">
        <button
          onClick={onUploadClick}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors font-medium text-sm"
        >
          <ArrowUpTrayIcon className="h-5 w-5" />
          Upload Spreadsheet
        </button>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto">
        {/* All Tables */}
        <div className="p-4">
          <Link
            to="/dashboard"
            className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
              isActiveRoute('/dashboard')
                ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-400'
                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
            }`}
          >
            <FolderIcon className="h-5 w-5" />
            <span className="font-medium text-sm">All Tables</span>
          </Link>
        </div>

        {/* Active Jobs Section */}
        <div className="border-t border-gray-200 dark:border-gray-800">
          <div className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800">
            <Link
              to="/active-jobs"
              className={`flex items-center gap-3 flex-1 ${
                isActiveRoute('/active-jobs')
                  ? 'text-indigo-700 dark:text-indigo-400'
                  : 'text-gray-900 dark:text-white'
              }`}
            >
              <BriefcaseIcon className={`h-5 w-5 ${
                isActiveRoute('/active-jobs')
                  ? 'text-indigo-600 dark:text-indigo-400'
                  : 'text-gray-500 dark:text-gray-400'
              }`} />
              <span className="font-medium text-sm">
                Active Jobs
              </span>
              <span className="text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-full">
                {activeJobs.length}
              </span>
            </Link>
            <button
              onClick={() => setJobsExpanded(!jobsExpanded)}
              className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
            >
              <ChevronRightIcon
                className={`h-4 w-4 text-gray-400 transition-transform ${
                  jobsExpanded ? 'rotate-90' : ''
                }`}
              />
            </button>
          </div>

          {jobsExpanded && (
            <div className="pb-2">
              {loadingJobs ? (
                <div className="px-4 py-2">
                  <div className="text-xs text-gray-500 dark:text-gray-400">Loading...</div>
                </div>
              ) : activeJobs.length === 0 ? (
                <div className="px-4 py-2">
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    No active jobs yet
                  </div>
                </div>
              ) : (
                <div className="space-y-0.5">
                  {activeJobs.map((job) => (
                    <Link
                      key={job.id}
                      to={`/tables/${job.id}`}
                      className={`flex items-center gap-2 px-4 pl-12 py-2 text-sm transition-colors ${
                        isActiveRoute(`/tables/${job.id}`)
                          ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-400'
                          : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-200'
                      }`}
                    >
                      <span className="truncate">{job.name}</span>
                    </Link>
                  ))}
                </div>
              )}

              <Link
                to="/dashboard?search=job"
                className="flex items-center gap-2 px-4 pl-12 py-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
              >
                <PlusIcon className="h-4 w-4" />
                <span>View all jobs</span>
              </Link>
            </div>
          )}
        </div>

        {/* Price Books Section */}
        <div className="border-t border-gray-200 dark:border-gray-800">
          <button
            onClick={() => setPriceBooksExpanded(!priceBooksExpanded)}
            className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            <div className="flex items-center gap-3">
              <CurrencyDollarIcon className="h-5 w-5 text-gray-500 dark:text-gray-400" />
              <span className="font-medium text-sm text-gray-900 dark:text-white">
                Price Books
              </span>
              <span className="text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-full">
                {priceBooks.length}
              </span>
            </div>
            <ChevronRightIcon
              className={`h-4 w-4 text-gray-400 transition-transform ${
                priceBooksExpanded ? 'rotate-90' : ''
              }`}
            />
          </button>

          {priceBooksExpanded && (
            <div className="pb-2">
              {loadingPriceBooks ? (
                <div className="px-4 py-2">
                  <div className="text-xs text-gray-500 dark:text-gray-400">Loading...</div>
                </div>
              ) : priceBooks.length === 0 ? (
                <div className="px-4 py-2">
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    No price books yet
                  </div>
                </div>
              ) : (
                <div className="space-y-0.5">
                  {priceBooks.map((priceBook) => (
                    <Link
                      key={priceBook.id}
                      to={`/tables/${priceBook.id}`}
                      className={`flex items-center gap-2 px-4 pl-12 py-2 text-sm transition-colors ${
                        isActiveRoute(`/tables/${priceBook.id}`)
                          ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-400'
                          : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-200'
                      }`}
                    >
                      <span className="truncate">{priceBook.name}</span>
                    </Link>
                  ))}
                </div>
              )}

              <Link
                to="/dashboard?search=price"
                className="flex items-center gap-2 px-4 pl-12 py-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
              >
                <PlusIcon className="h-4 w-4" />
                <span>View all price books</span>
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
