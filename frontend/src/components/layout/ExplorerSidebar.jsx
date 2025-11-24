import { useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import {
  BriefcaseIcon,
  CurrencyDollarIcon,
  PlusIcon,
  ChevronRightIcon,
  FolderIcon,
  ArrowUpTrayIcon,
  CalendarIcon,
  ChevronDoubleLeftIcon,
  ChevronDoubleRightIcon,
  UserIcon,
  DocumentTextIcon,
  ClipboardDocumentListIcon,
  CalendarDaysIcon,
  CloudIcon,
  FolderOpenIcon,
  ChatBubbleLeftRightIcon,
  UserGroupIcon,
  Cog6ToothIcon,
} from '@heroicons/react/24/outline'
import { api } from '../../api'

// Job detail tabs for sub-navigation
const jobTabs = [
  { name: 'Overview', slug: 'overview', icon: BriefcaseIcon },
  { name: 'Purchase Orders', slug: 'purchase-orders', icon: DocumentTextIcon },
  { name: 'Estimates', slug: 'estimates', icon: ClipboardDocumentListIcon },
  { name: 'Schedule Master', slug: 'schedule-master', icon: CalendarDaysIcon },
  { name: 'Rain Log', slug: 'rain-log', icon: CloudIcon },
  { name: 'Documents', slug: 'documents', icon: FolderOpenIcon },
  { name: 'Coms', slug: 'coms', icon: ChatBubbleLeftRightIcon },
  { name: 'Team', slug: 'team', icon: UserGroupIcon },
]

export default function ExplorerSidebar({ onUploadClick }) {
  const location = useLocation()
  const [activeJobs, setActiveJobs] = useState([])
  const [priceBooks, setPriceBooks] = useState([])
  const [loadingJobs, setLoadingJobs] = useState(true)
  const [loadingPriceBooks, setLoadingPriceBooks] = useState(true)
  const [jobsExpanded, setJobsExpanded] = useState(() => {
    const saved = localStorage.getItem('jobsExpanded')
    return saved === null ? true : saved === 'true'
  })
  const [expandedJobId, setExpandedJobId] = useState(() => {
    const saved = localStorage.getItem('expandedJobId')
    return saved ? parseInt(saved, 10) : null
  })
  const [priceBooksExpanded, setPriceBooksExpanded] = useState(() => {
    const saved = localStorage.getItem('priceBooksExpanded')
    return saved === null ? true : saved === 'true'
  })
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    // Load from localStorage on mount
    const saved = localStorage.getItem('sidebarCollapsed')
    return saved === 'true'
  })

  useEffect(() => {
    loadActiveJobs()
    loadPriceBooks()
  }, [])

  const loadActiveJobs = async () => {
    try {
      setLoadingJobs(true)
      // Load actual construction jobs with Active status
      const response = await api.get('/api/v1/constructions?status=Active&per_page=50')
      setActiveJobs(response.constructions || [])
    } catch (err) {
      console.error('Failed to load active jobs:', err)
    } finally {
      setLoadingJobs(false)
    }
  }

  const toggleJobExpanded = (jobId) => {
    const newId = expandedJobId === jobId ? null : jobId
    setExpandedJobId(newId)
    localStorage.setItem('expandedJobId', newId ? newId.toString() : '')
  }

  // Auto-expand job if we're on a job detail page
  useEffect(() => {
    const match = location.pathname.match(/^\/jobs\/(\d+)/)
    if (match) {
      const jobId = parseInt(match[1], 10)
      setExpandedJobId(prevId => {
        if (prevId !== jobId) {
          localStorage.setItem('expandedJobId', jobId.toString())
          return jobId
        }
        return prevId
      })
    }
  }, [location.pathname])

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

  const toggleSidebar = () => {
    const newState = !sidebarCollapsed
    setSidebarCollapsed(newState)
    localStorage.setItem('sidebarCollapsed', newState.toString())
  }

  const toggleJobsExpanded = () => {
    const newState = !jobsExpanded
    setJobsExpanded(newState)
    localStorage.setItem('jobsExpanded', newState.toString())
  }

  const togglePriceBooksExpanded = () => {
    const newState = !priceBooksExpanded
    setPriceBooksExpanded(newState)
    localStorage.setItem('priceBooksExpanded', newState.toString())
  }

  return (
    <div className={`h-full bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 flex flex-col transition-all duration-300 ${
      sidebarCollapsed ? 'w-16' : 'w-64'
    }`}>
      {/* Toggle Button */}
      <div className="p-3 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
        {!sidebarCollapsed && <div className="text-xs font-semibold text-gray-500 dark:text-gray-400">MENU</div>}
        <button
          onClick={toggleSidebar}
          className={`p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors ${
            sidebarCollapsed ? 'mx-auto' : ''
          }`}
          title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {sidebarCollapsed ? (
            <ChevronDoubleRightIcon className="h-5 w-5 text-gray-500" />
          ) : (
            <ChevronDoubleLeftIcon className="h-5 w-5 text-gray-500" />
          )}
        </button>
      </div>

      {/* Upload Button */}
      {!sidebarCollapsed && (
        <div className="p-4 border-b border-gray-200 dark:border-gray-800">
          <button
            onClick={onUploadClick}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors font-medium text-sm"
          >
            <ArrowUpTrayIcon className="h-5 w-5" />
            Upload Spreadsheet
          </button>
        </div>
      )}
      {sidebarCollapsed && (
        <div className="p-2 border-b border-gray-200 dark:border-gray-800">
          <button
            onClick={onUploadClick}
            className="w-full flex items-center justify-center p-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors"
            title="Upload Spreadsheet"
          >
            <ArrowUpTrayIcon className="h-5 w-5" />
          </button>
        </div>
      )}

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto">
        {/* All Tables */}
        <div className={sidebarCollapsed ? 'p-2' : 'p-4'}>
          <Link
            to="/dashboard"
            className={`flex items-center ${sidebarCollapsed ? 'justify-center p-2.5' : 'gap-3 px-3 py-2'} rounded-lg transition-colors ${
              isActiveRoute('/dashboard')
                ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-400'
                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
            }`}
            title={sidebarCollapsed ? 'All Tables' : ''}
          >
            <FolderIcon className="h-5 w-5 flex-shrink-0" />
            {!sidebarCollapsed && <span className="font-medium text-sm">All Tables</span>}
          </Link>
        </div>

        {/* Meetings */}
        <div className={sidebarCollapsed ? 'px-2 pb-2' : 'px-4 pb-4'}>
          <Link
            to="/meetings"
            className={`flex items-center ${sidebarCollapsed ? 'justify-center p-2.5' : 'gap-3 px-3 py-2'} rounded-lg transition-colors ${
              isActiveRoute('/meetings')
                ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-400'
                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
            }`}
            title={sidebarCollapsed ? 'Meetings' : ''}
          >
            <CalendarIcon className="h-5 w-5 flex-shrink-0" />
            {!sidebarCollapsed && <span className="font-medium text-sm">Meetings</span>}
          </Link>
        </div>

        {/* Settings Header */}
        {!sidebarCollapsed && (
          <div className="border-t border-gray-200 dark:border-gray-800 pt-4 pb-2 px-4">
            <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Settings
            </h3>
          </div>
        )}
        {sidebarCollapsed && (
          <div className="border-t border-gray-200 dark:border-gray-800 my-2"></div>
        )}

        {/* Active Jobs Section */}
        <div>
          {sidebarCollapsed ? (
            <Link
              to="/active-jobs"
              className={`flex items-center justify-center p-2.5 mx-2 mb-2 rounded-lg transition-colors ${
                isActiveRoute('/active-jobs')
                  ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-400'
                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
              }`}
              title="Active Jobs"
            >
              <BriefcaseIcon className="h-5 w-5 flex-shrink-0" />
            </Link>
          ) : (
            <>
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
                  onClick={toggleJobsExpanded}
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
                        <div key={job.id}>
                          {/* Job row with expand toggle */}
                          <div className="flex items-center">
                            <button
                              onClick={() => toggleJobExpanded(job.id)}
                              className="p-1 ml-8 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
                            >
                              <ChevronRightIcon
                                className={`h-3 w-3 text-gray-400 transition-transform ${
                                  expandedJobId === job.id ? 'rotate-90' : ''
                                }`}
                              />
                            </button>
                            <Link
                              to={`/jobs/${job.id}/overview`}
                              className={`flex-1 flex items-center gap-2 px-2 py-1.5 text-sm transition-colors ${
                                location.pathname.startsWith(`/jobs/${job.id}`)
                                  ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-400'
                                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-200'
                              }`}
                            >
                              <span className="truncate">{job.title || `Job #${job.id}`}</span>
                            </Link>
                          </div>
                          {/* Job tabs - shown when expanded */}
                          {expandedJobId === job.id && (
                            <div className="ml-12 space-y-0.5 py-1">
                              {jobTabs.map((tab) => {
                                const TabIcon = tab.icon
                                const isActive = location.pathname === `/jobs/${job.id}/${tab.slug}`
                                return (
                                  <Link
                                    key={tab.slug}
                                    to={`/jobs/${job.id}/${tab.slug}`}
                                    className={`flex items-center gap-2 px-3 py-1.5 text-xs rounded transition-colors ${
                                      isActive
                                        ? 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300'
                                        : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-700 dark:hover:text-gray-300'
                                    }`}
                                  >
                                    <TabIcon className="h-3.5 w-3.5" />
                                    <span>{tab.name}</span>
                                  </Link>
                                )
                              })}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  <Link
                    to="/active-jobs"
                    className="flex items-center gap-2 px-4 pl-12 py-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
                  >
                    <PlusIcon className="h-4 w-4" />
                    <span>View all jobs</span>
                  </Link>
                </div>
              )}
            </>
          )}
        </div>

        {/* Sam */}
        <div>
          {sidebarCollapsed ? (
            <Link
              to="/sam"
              className={`flex items-center justify-center p-2.5 mx-2 mb-2 rounded-lg transition-colors ${
                isActiveRoute('/sam')
                  ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-400'
                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
              }`}
              title="Sam"
            >
              <UserIcon className="h-5 w-5 flex-shrink-0" />
            </Link>
          ) : (
            <div className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800">
              <Link
                to="/sam"
                className={`flex items-center gap-3 flex-1 ${
                  isActiveRoute('/sam')
                    ? 'text-indigo-700 dark:text-indigo-400'
                    : 'text-gray-900 dark:text-white'
                }`}
              >
                <UserIcon className={`h-5 w-5 ${
                  isActiveRoute('/sam')
                    ? 'text-indigo-600 dark:text-indigo-400'
                    : 'text-gray-500 dark:text-gray-400'
                }`} />
                <span className="font-medium text-sm">
                  Sam
                </span>
              </Link>
            </div>
          )}
        </div>

        {/* Price Books Section */}
        <div>
          {sidebarCollapsed ? (
            <Link
              to="/price-books"
              className={`flex items-center justify-center p-2.5 mx-2 mb-2 rounded-lg transition-colors ${
                isActiveRoute('/price-books')
                  ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-400'
                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
              }`}
              title="Price Books"
            >
              <CurrencyDollarIcon className="h-5 w-5 flex-shrink-0" />
            </Link>
          ) : (
            <>
              <button
                onClick={togglePriceBooksExpanded}
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
            </>
          )}
        </div>
      </div>
    </div>
  )
}
