import { useState, useEffect, useRef, useCallback } from 'react'
import { Link, useLocation } from 'react-router-dom'
import axios from 'axios'
import packageJson from '../../../package.json'
import BackButton from '../common/BackButton'
import FloatingHelpButton from '../FloatingHelpButton'
import InspiringBanner from '../InspiringBanner'
import { api } from '../../api'
import { useAuth } from '../../contexts/AuthContext'
import {
  Dialog,
  DialogBackdrop,
  DialogPanel,
  Menu,
  MenuButton,
  MenuItem,
  MenuItems,
  TransitionChild,
} from '@headlessui/react'
import {
  Bars3Icon,
  BellIcon,
  Cog6ToothIcon,
  CpuChipIcon,
  HomeIcon,
  ArrowUpTrayIcon,
  XMarkIcon,
  UserCircleIcon,
  ArrowRightOnRectangleIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  BriefcaseIcon,
  BookOpenIcon,
  UserGroupIcon,
  UsersIcon,
  PlusIcon,
  EnvelopeIcon,
  DocumentTextIcon,
  CloudIcon,
  ChatBubbleLeftRightIcon,
  AcademicCapIcon,
  BanknotesIcon,
  ChartBarIcon,
  BeakerIcon,
  ShieldCheckIcon,
  CalendarIcon,
  BuildingOfficeIcon,
  ClipboardDocumentListIcon,
  CalendarDaysIcon,
  FolderOpenIcon,
  MagnifyingGlassIcon,
} from '@heroicons/react/24/outline'
import { ChevronDownIcon } from '@heroicons/react/20/solid'

// Job detail tabs for sidebar sub-navigation
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

// Main navigation items
const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: HomeIcon },
  { name: 'Active Jobs', href: '/tables/active-jobs', icon: BriefcaseIcon },
  { name: 'Meetings', href: '/meetings', icon: CalendarIcon },
  { name: 'WHS', href: '/whs', icon: ShieldCheckIcon },
  { name: 'Financial', href: '/financial', icon: BanknotesIcon },
  { name: 'Xest', href: '/xest', icon: BeakerIcon },
  { name: 'Price Books', href: '/tables/205', icon: BookOpenIcon },
  { name: 'All Contacts', href: '/tables/214', icon: UsersIcon },
  //{ name: 'Suppliers', href: '/tables/215', icon: UserGroupIcon },
  { name: 'Purchase Orders', href: '/tables/217', icon: DocumentTextIcon },
  { name: 'Accounts', href: '/accounts', icon: BanknotesIcon },
  { name: 'Corporate', href: '/corporate/companies', icon: BuildingOfficeIcon },
  { name: 'Documents', href: '/documents', icon: DocumentTextIcon },
  { name: 'Training', href: '/training', icon: AcademicCapIcon },
  { name: 'Outlook', href: '/outlook', icon: EnvelopeIcon },
  { name: 'OneDrive', href: '/onedrive', icon: CloudIcon },
  { name: 'Health', href: '/health', icon: PlusIcon },
  { name: 'System Admin', href: '/admin/system', icon: BeakerIcon },
  { name: 'Trinity', href: '/trinity', icon: BookOpenIcon },
  { name: 'DHTMLX Gantt', href: '/admin/system?tab=schedule-master&openGantt=dhtmlx', icon: ChartBarIcon },
  { name: 'SM Gantt', href: '/jobs/20/sm-gantt', icon: ChartBarIcon },
  { name: 'SM Setup', href: '/admin/sm-setup', icon: Cog6ToothIcon },
]

// Bottom navigation items
const bottomNavigation = []

function classNames(...classes) {
  return classes.filter(Boolean).join(' ')
}

// Helper to get a normalized route key for localStorage
const getRouteKey = (pathname) => {
  // Normalize paths like /jobs/123 to /jobs
  if (pathname.startsWith('/jobs/')) return '/jobs'
  if (pathname === '/tables/214' || pathname.startsWith('/contacts/')) return '/tables/214'
  if (pathname.startsWith('/tables/')) return '/tables'
  if (pathname.startsWith('/accounts/')) return '/accounts'
  if (pathname.startsWith('/corporate/')) return '/corporate'
  return pathname
}

// Default sidebar state for routes (collapsed = true means sidebar is closed by default)
const defaultSidebarState = {
  '/active-jobs': true,   // Collapsed
  '/jobs': true,          // Collapsed
  '/settings': true,      // Collapsed
  '/dashboard': false,    // Expanded
}

export default function AppLayout({ children }) {
  const location = useLocation()
  const { user } = useAuth()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [activeJobs, setActiveJobs] = useState([])
  const [jobSearchQuery, setJobSearchQuery] = useState('')
  const [activeJobsExpanded, setActiveJobsExpanded] = useState(() => {
    const saved = localStorage.getItem('activeJobsExpanded')
    return saved === null ? true : saved === 'true'
  })
  const [expandedJobId, setExpandedJobId] = useState(() => {
    const saved = localStorage.getItem('expandedJobId')
    return saved ? parseInt(saved, 10) : null
  })
  const [jobViewMode, setJobViewMode] = useState(() => {
    const saved = localStorage.getItem('jobViewMode')
    return saved || 'list' // 'list' or 'stage'
  })
  const [expandedStages, setExpandedStages] = useState(() => {
    const saved = localStorage.getItem('expandedStages')
    return saved ? JSON.parse(saved) : { 'Construction': true }
  })

  // Resizable sidebar state (per-route)
  const getSidebarWidthForRoute = (pathname) => {
    const routeKey = getRouteKey(pathname)
    const saved = localStorage.getItem(`sidebarWidth:${routeKey}`)
    return saved ? parseInt(saved, 10) : 288 // Default 288px (w-72)
  }

  const [sidebarWidth, setSidebarWidth] = useState(() => {
    return getSidebarWidthForRoute(location.pathname)
  })
  const [isResizing, setIsResizing] = useState(false)
  const sidebarRef = useRef(null)
  const minSidebarWidth = 200
  const maxSidebarWidth = 500

  // Update sidebar width when route changes
  useEffect(() => {
    const newWidth = getSidebarWidthForRoute(location.pathname)
    setSidebarWidth(newWidth)
  }, [location.pathname])

  // Handle sidebar resize
  const startResizing = useCallback((e) => {
    e.preventDefault()
    setIsResizing(true)
  }, [])

  const stopResizing = useCallback(() => {
    setIsResizing(false)
  }, [])

  const resize = useCallback((e) => {
    if (isResizing) {
      const newWidth = e.clientX
      if (newWidth >= minSidebarWidth && newWidth <= maxSidebarWidth) {
        setSidebarWidth(newWidth)
        // Save per-route
        const routeKey = getRouteKey(location.pathname)
        localStorage.setItem(`sidebarWidth:${routeKey}`, newWidth.toString())
      }
    }
  }, [isResizing, location.pathname])

  // Attach mouse event listeners for resizing
  useEffect(() => {
    if (isResizing) {
      window.addEventListener('mousemove', resize)
      window.addEventListener('mouseup', stopResizing)
    }
    return () => {
      window.removeEventListener('mousemove', resize)
      window.removeEventListener('mouseup', stopResizing)
    }
  }, [isResizing, resize, stopResizing])

  // Get sidebar preference for current route
  const getSidebarPreference = (pathname) => {
    const routeKey = getRouteKey(pathname)
    const storageKey = `sidebarCollapsed:${routeKey}`
    const saved = localStorage.getItem(storageKey)

    if (saved !== null) {
      return saved === 'true'
    }

    // Use default for this route, or false (expanded) if no default
    return defaultSidebarState[routeKey] ?? false
  }

  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    return getSidebarPreference(location.pathname)
  })
  const [backendVersion, setBackendVersion] = useState('loading...')
  const [unreadCount, setUnreadCount] = useState(0)
  const [priceBooksPreloadStatus, setPriceBooksPreloadStatus] = useState('idle') // 'idle', 'loading', 'complete'
  const frontendVersion = packageJson.version

  useEffect(() => {
    const fetchVersion = async () => {
      try {
        const response = await axios.get(`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/version`)
        setBackendVersion(response.data.version)
      } catch (error) {
        console.error('Failed to fetch version:', error)
        setBackendVersion('unknown')
      }
    }
    fetchVersion()
  }, [])

  // Load active jobs for sidebar
  useEffect(() => {
    const loadActiveJobs = async () => {
      try {
        const response = await api.get('/api/v1/constructions?status=Active&per_page=20')
        setActiveJobs(response.constructions || [])
      } catch (err) {
        // Silently fail - sidebar will just show empty, user can still navigate
        console.debug('Active jobs unavailable:', err?.message || 'Unknown error')
      }
    }
    loadActiveJobs()
  }, [])

  // Preload Price Books (Table: price-books) for all users
  useEffect(() => {
    console.log('[Preload] Starting background preload for Price Books (price-books)...')
    setPriceBooksPreloadStatus('loading')

    // Wait 3 seconds after app loads to not interfere with initial render
    const timer = setTimeout(async () => {
      try {
        const startTime = Date.now()
        console.log('[Preload] Fetching price-books table data...')

        const response = await api.get('/api/v1/tables/price-books/records', {
          params: {
            per_page: 10000,
            page: 1
          }
        })

        const loadTime = Date.now() - startTime
        console.log(`[Preload] ✅ price-books table preloaded in ${loadTime}ms:`, {
          recordCount: response.records?.length,
          totalCount: response.pagination?.total_count
        })

        // Store in sessionStorage for TablePage to use
        sessionStorage.setItem('preloaded_table_price_books', JSON.stringify({
          data: response,
          timestamp: Date.now()
        }))

        setPriceBooksPreloadStatus('complete')
      } catch (error) {
        console.error('[Preload] Failed to preload price-books table:', error)
        setPriceBooksPreloadStatus('idle')
      }
    }, 3000) // 3 second delay

    return () => clearTimeout(timer)
  }, [])

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
      // Also expand the Active Jobs section
      if (!activeJobsExpanded) {
        setActiveJobsExpanded(true)
        localStorage.setItem('activeJobsExpanded', 'true')
      }
    }
  }, [location.pathname, activeJobsExpanded])

  const toggleActiveJobsExpanded = () => {
    const newValue = !activeJobsExpanded
    setActiveJobsExpanded(newValue)
    localStorage.setItem('activeJobsExpanded', String(newValue))
  }

  const toggleJobExpanded = (jobId) => {
    const newId = expandedJobId === jobId ? null : jobId
    setExpandedJobId(newId)
    localStorage.setItem('expandedJobId', newId ? newId.toString() : '')
  }

  const toggleJobViewMode = () => {
    const newMode = jobViewMode === 'list' ? 'stage' : 'list'
    setJobViewMode(newMode)
    localStorage.setItem('jobViewMode', newMode)
  }

  const toggleStageExpanded = (stage) => {
    const newStages = { ...expandedStages, [stage]: !expandedStages[stage] }
    setExpandedStages(newStages)
    localStorage.setItem('expandedStages', JSON.stringify(newStages))
  }

  // Group jobs by stage for stage view
  const jobsByStage = activeJobs.reduce((acc, job) => {
    const stage = job.stage || 'Unknown'
    if (!acc[stage]) acc[stage] = []
    acc[stage].push(job)
    return acc
  }, {})

  // Poll for unread messages count
  useEffect(() => {
    const fetchUnreadCount = async () => {
      try {
        const response = await axios.get(`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api/v1/chat_messages/unread_count`, {
          withCredentials: true
        })
        setUnreadCount(response.data.count || 0)
      } catch {
        // Silently fail - unread count is not critical
      }
    }

    fetchUnreadCount()
    const interval = setInterval(fetchUnreadCount, 5000) // Poll every 5 seconds

    return () => clearInterval(interval)
  }, [])

  // Update sidebar state when route changes
  useEffect(() => {
    const newPreference = getSidebarPreference(location.pathname)
    setSidebarCollapsed(newPreference)
  }, [location.pathname])

  // Save sidebar preference to localStorage when toggled (per-route)
  const handleSidebarToggle = () => {
    const newValue = !sidebarCollapsed
    setSidebarCollapsed(newValue)
    const routeKey = getRouteKey(location.pathname)
    localStorage.setItem(`sidebarCollapsed:${routeKey}`, String(newValue))
  }

  const isCurrentPath = (href) => {
    // Check Active Jobs first (before Dashboard) to avoid false matches
    if (href === '/tables/active-jobs') {
      return location.pathname === '/tables/active-jobs' ||
             location.pathname.match(/^\/tables\/\d+\/active-jobs/)
    }
    if (href === '/dashboard') {
      // Exclude active-jobs paths from Dashboard matching
      if (location.pathname.match(/\/active-jobs/)) {
        return false
      }
      return location.pathname === '/dashboard' || location.pathname.startsWith('/tables/')
    }
    return location.pathname === href || location.pathname.startsWith(href + '/')
  }

  return (
    <div>
      {/* Mobile sidebar */}
      <Dialog open={sidebarOpen} onClose={setSidebarOpen} className="relative z-50 lg:hidden">
        <DialogBackdrop
          transition
          className="fixed inset-0 bg-gray-900/80 transition-opacity duration-300 ease-linear data-[closed]:opacity-0"
        />

        <div className="fixed inset-0 flex">
          <DialogPanel
            transition
            className="relative mr-16 flex w-full max-w-xs flex-1 transform transition duration-300 ease-in-out data-[closed]:-translate-x-full"
          >
            <TransitionChild>
              <div className="absolute left-full top-0 flex w-16 justify-center pt-5 duration-300 ease-in-out data-[closed]:opacity-0">
                <button type="button" onClick={() => setSidebarOpen(false)} className="-m-2.5 p-2.5">
                  <span className="sr-only">Close sidebar</span>
                  <XMarkIcon aria-hidden="true" className="size-6 text-white" />
                </button>
              </div>
            </TransitionChild>

            {/* Mobile Sidebar content */}
            <div className="relative flex grow flex-col gap-y-5 overflow-y-auto bg-white px-6 pb-4 dark:bg-gray-900 dark:ring dark:ring-white/10 dark:before:pointer-events-none dark:before:absolute dark:before:inset-0 dark:before:bg-black/10">
              <div className="relative flex h-16 shrink-0 items-center">
                <img
                  alt="Trapid"
                  src="https://tailwindcss.com/plus-assets/img/logos/mark.svg?color=indigo&shade=600"
                  className="h-8 w-auto dark:hidden"
                />
                <img
                  alt="Trapid"
                  src="https://tailwindcss.com/plus-assets/img/logos/mark.svg?color=indigo&shade=500"
                  className="hidden h-8 w-auto dark:block"
                />
                <span className="ml-3 text-xl font-bold text-gray-900 dark:text-white">Trapid</span>
              </div>
              <nav className="relative flex flex-1 flex-col">
                <ul role="list" className="flex flex-1 flex-col gap-y-7">
                  <li>
                    <ul role="list" className="-mx-2 space-y-1">
                      {navigation.map((item) => {
                        const current = isCurrentPath(item.href)
                        return (
                          <li key={item.name}>
                            <Link
                              to={item.href}
                              onClick={() => setSidebarOpen(false)}
                              className={classNames(
                                current
                                  ? 'bg-gray-50 text-indigo-600 dark:bg-white/5 dark:text-white'
                                  : 'text-gray-700 hover:bg-gray-50 hover:text-indigo-600 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-white',
                                'group flex gap-x-3 rounded-md p-2 text-sm/6 font-semibold',
                              )}
                            >
                              <item.icon
                                aria-hidden="true"
                                className={classNames(
                                  current
                                    ? 'text-indigo-600 dark:text-white'
                                    : 'text-gray-400 group-hover:text-indigo-600 dark:group-hover:text-white',
                                  'size-6 shrink-0',
                                )}
                              />
                              <span className="flex items-center gap-2 flex-1">
                                {item.name}
                                {item.name === 'Price Books' && priceBooksPreloadStatus === 'loading' && (
                                  <span className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-1.5 py-0.5 rounded font-normal">
                                    Loading...
                                  </span>
                                )}
                                {item.name === 'Price Books' && priceBooksPreloadStatus === 'complete' && (
                                  <span className="text-xs bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 px-1.5 py-0.5 rounded font-normal">
                                    ✓ Ready
                                  </span>
                                )}
                              </span>
                            </Link>
                          </li>
                        )
                      })}
                    </ul>
                  </li>
                  <li className="mt-auto">
                    <ul role="list" className="-mx-2 space-y-1">
                      {bottomNavigation.map((item) => {
                        const current = isCurrentPath(item.href)
                        return (
                          <li key={item.name}>
                            <Link
                              to={item.href}
                              onClick={() => setSidebarOpen(false)}
                              className={classNames(
                                current
                                  ? 'bg-gray-50 text-indigo-600 dark:bg-white/5 dark:text-white'
                                  : 'text-gray-700 hover:bg-gray-50 hover:text-indigo-600 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-white',
                                'group flex gap-x-3 rounded-md p-2 text-sm/6 font-semibold',
                              )}
                            >
                              <item.icon
                                aria-hidden="true"
                                className={classNames(
                                  current
                                    ? 'text-indigo-600 dark:text-white'
                                    : 'text-gray-400 group-hover:text-indigo-600 dark:group-hover:text-white',
                                  'size-6 shrink-0',
                                )}
                              />
                              {item.name}
                            </Link>
                          </li>
                        )
                      })}
                    </ul>
                    <div className="px-2 pt-2">
                      <p className="text-xs text-gray-400 dark:text-gray-500">
                        Frontend: v{frontendVersion}
                      </p>
                      <p className="text-xs text-gray-400 dark:text-gray-500">
                        Backend: {backendVersion}
                      </p>
                    </div>
                  </li>
                </ul>
              </nav>
            </div>
          </DialogPanel>
        </div>
      </Dialog>

      {/* Static sidebar for desktop */}
      <div
        ref={sidebarRef}
        className={classNames(
          "hidden bg-gray-900 lg:fixed lg:inset-y-0 lg:z-50 lg:flex lg:flex-col",
          sidebarCollapsed ? "lg:w-16 transition-all duration-300" : "",
          isResizing ? "select-none" : ""
        )}
        style={sidebarCollapsed ? undefined : { width: sidebarWidth }}
      >
        <div className="flex grow flex-col gap-y-5 overflow-y-auto border-r border-gray-200 bg-white pb-6 dark:border-white/10 dark:bg-black/10">
          {/* Resize handle - only show when not collapsed */}
          {!sidebarCollapsed && (
            <div
              className="absolute right-0 top-0 bottom-0 w-1 cursor-ew-resize hover:bg-indigo-400 active:bg-indigo-500 transition-colors z-50"
              onMouseDown={startResizing}
              title="Drag to resize sidebar"
            />
          )}
          <div className={classNames(
            "flex h-16 shrink-0 items-center relative",
            sidebarCollapsed ? "justify-center px-2" : "px-6"
          )}>
            {!sidebarCollapsed && (
              <>
                <img
                  alt="Trapid"
                  src="https://tailwindcss.com/plus-assets/img/logos/mark.svg?color=indigo&shade=600"
                  className="h-8 w-auto dark:hidden"
                />
                <img
                  alt="Trapid"
                  src="https://tailwindcss.com/plus-assets/img/logos/mark.svg?color=indigo&shade=500"
                  className="hidden h-8 w-auto dark:block"
                />
                <span className="ml-3 text-xl font-bold text-gray-900 dark:text-white">Trapid</span>
              </>
            )}
            {sidebarCollapsed && (
              <img
                alt="Trapid"
                src="https://tailwindcss.com/plus-assets/img/logos/mark.svg?color=indigo&shade=600"
                className="h-8 w-auto dark:hidden"
              />
            )}
            <button
              onClick={handleSidebarToggle}
              className={classNames(
                "absolute p-1 rounded hover:bg-gray-100 dark:hover:bg-white/10 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200",
                sidebarCollapsed ? "-right-3 top-1/2 -translate-y-1/2" : "right-2 top-1/2 -translate-y-1/2"
              )}
              title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {sidebarCollapsed ? (
                <ChevronRightIcon className="h-5 w-5" />
              ) : (
                <ChevronLeftIcon className="h-5 w-5" />
              )}
            </button>
          </div>
          <nav className={classNames("flex flex-1 flex-col", sidebarCollapsed ? "px-2" : "px-6")}>
            <ul role="list" className="flex flex-1 flex-col gap-y-7">
              <li>
                <ul role="list" className="-mx-2 space-y-1">
                  {navigation.map((item) => {
                    const current = isCurrentPath(item.href)

                    // Special handling for Active Jobs - make it expandable
                    if (item.name === 'Active Jobs') {
                      return (
                        <li key={item.name}>
                          {/* Active Jobs header with expand toggle */}
                          <div className="flex items-center">
                            <Link
                              to={item.href}
                              title={sidebarCollapsed ? item.name : undefined}
                              className={classNames(
                                current
                                  ? 'bg-gray-50 text-indigo-600 dark:bg-white/5 dark:text-white'
                                  : 'text-gray-700 hover:bg-gray-50 hover:text-indigo-600 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-white',
                                'group flex gap-x-3 rounded-md p-2 text-sm/6 font-semibold flex-1',
                                sidebarCollapsed && 'justify-center'
                              )}
                            >
                              <item.icon
                                aria-hidden="true"
                                className={classNames(
                                  current
                                    ? 'text-indigo-600 dark:text-white'
                                    : 'text-gray-400 group-hover:text-indigo-600 dark:group-hover:text-white',
                                  'size-6 shrink-0',
                                )}
                              />
                              {!sidebarCollapsed && item.name}
                            </Link>
                            {!sidebarCollapsed && activeJobs.length > 0 && (
                              <button
                                onClick={toggleActiveJobsExpanded}
                                className="p-1 mr-2 hover:bg-gray-100 dark:hover:bg-white/10 rounded transition-colors"
                              >
                                <ChevronRightIcon
                                  className={classNames(
                                    'h-4 w-4 text-gray-400 transition-transform',
                                    activeJobsExpanded && 'rotate-90'
                                  )}
                                />
                              </button>
                            )}
                          </div>

                          {/* Expandable job list */}
                          {!sidebarCollapsed && activeJobsExpanded && activeJobs.length > 0 && (
                            <ul className="mt-1 space-y-0.5">
                              {/* Search and view toggle */}
                              <li className="px-2 pb-1 flex gap-1">
                                <div className="relative flex-1">
                                  <MagnifyingGlassIcon className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                                  <input
                                    type="text"
                                    placeholder="Search jobs..."
                                    value={jobSearchQuery}
                                    onChange={(e) => setJobSearchQuery(e.target.value)}
                                    className="w-full pl-7 pr-2 py-1 text-xs border border-gray-200 dark:border-gray-700 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                                  />
                                </div>
                                <button
                                  onClick={toggleJobViewMode}
                                  className={classNames(
                                    'px-1.5 py-1 text-xs rounded border transition-colors',
                                    jobViewMode === 'stage'
                                      ? 'bg-indigo-100 border-indigo-300 text-indigo-700 dark:bg-indigo-900/40 dark:border-indigo-700 dark:text-indigo-300'
                                      : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-700'
                                  )}
                                  title={jobViewMode === 'stage' ? 'View as list' : 'View by stage'}
                                >
                                  {jobViewMode === 'stage' ? '📋' : '📊'}
                                </button>
                              </li>

                              {/* List View */}
                              {jobViewMode === 'list' && activeJobs
                                .filter(job => {
                                  if (!jobSearchQuery) return true
                                  const query = jobSearchQuery.toLowerCase()
                                  return (job.title || '').toLowerCase().includes(query) ||
                                         String(job.id).includes(query)
                                })
                                .slice(0, 10)
                                .map((job) => (
                                <li key={job.id}>
                                  {/* Job row with expand toggle */}
                                  <div className="flex items-center pl-4">
                                    <button
                                      onClick={() => toggleJobExpanded(job.id)}
                                      className="p-0.5 hover:bg-gray-100 dark:hover:bg-white/10 rounded transition-colors"
                                    >
                                      <ChevronRightIcon
                                        className={classNames(
                                          'h-3 w-3 text-gray-400 transition-transform',
                                          expandedJobId === job.id && 'rotate-90'
                                        )}
                                      />
                                    </button>
                                    <Link
                                      to={`/jobs/${job.id}/overview`}
                                      className={classNames(
                                        location.pathname.startsWith(`/jobs/${job.id}`)
                                          ? 'text-indigo-600 dark:text-indigo-400'
                                          : 'text-gray-600 hover:text-indigo-600 dark:text-gray-400 dark:hover:text-white',
                                        'flex-1 px-2 py-1 text-xs truncate rounded hover:bg-gray-50 dark:hover:bg-white/5'
                                      )}
                                      title={job.title}
                                    >
                                      {job.title || `Job #${job.id}`}
                                    </Link>
                                  </div>

                                  {/* Job tabs - shown when expanded */}
                                  {expandedJobId === job.id && (
                                    <ul className="ml-8 mt-0.5 space-y-0.5 pb-1">
                                      {jobTabs.map((tab) => {
                                        const TabIcon = tab.icon
                                        const isActive = location.pathname === `/jobs/${job.id}/${tab.slug}`
                                        return (
                                          <li key={tab.slug}>
                                            <Link
                                              to={`/jobs/${job.id}/${tab.slug}`}
                                              className={classNames(
                                                isActive
                                                  ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-300'
                                                  : 'text-gray-500 hover:text-indigo-600 hover:bg-gray-50 dark:text-gray-400 dark:hover:text-white dark:hover:bg-white/5',
                                                'flex items-center gap-2 px-2 py-1 text-xs rounded'
                                              )}
                                            >
                                              <TabIcon className="h-3.5 w-3.5" />
                                              {tab.name}
                                            </Link>
                                          </li>
                                        )
                                      })}
                                    </ul>
                                  )}
                                </li>
                              ))}

                              {/* Stage View */}
                              {jobViewMode === 'stage' && Object.entries(jobsByStage)
                                .sort(([a], [b]) => {
                                  // Sort stages: Construction first, then alphabetically
                                  if (a === 'Construction') return -1
                                  if (b === 'Construction') return 1
                                  return a.localeCompare(b)
                                })
                                .map(([stage, jobs]) => {
                                  const filteredJobs = jobs.filter(job => {
                                    if (!jobSearchQuery) return true
                                    const query = jobSearchQuery.toLowerCase()
                                    return (job.title || '').toLowerCase().includes(query) ||
                                           String(job.id).includes(query)
                                  })
                                  if (filteredJobs.length === 0) return null

                                  return (
                                    <li key={stage}>
                                      {/* Stage header */}
                                      <button
                                        onClick={() => toggleStageExpanded(stage)}
                                        className="flex items-center gap-1 px-2 py-1 w-full text-left hover:bg-gray-50 dark:hover:bg-white/5 rounded transition-colors"
                                      >
                                        <ChevronRightIcon
                                          className={classNames(
                                            'h-3 w-3 text-gray-400 transition-transform',
                                            expandedStages[stage] && 'rotate-90'
                                          )}
                                        />
                                        <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                                          {stage}
                                        </span>
                                        <span className="ml-auto text-xs text-gray-400">
                                          {filteredJobs.length}
                                        </span>
                                      </button>

                                      {/* Jobs under this stage */}
                                      {expandedStages[stage] && (
                                        <ul className="ml-4 space-y-0.5">
                                          {filteredJobs.slice(0, 10).map((job) => (
                                            <li key={job.id}>
                                              <Link
                                                to={`/jobs/${job.id}/overview`}
                                                className={classNames(
                                                  location.pathname.startsWith(`/jobs/${job.id}`)
                                                    ? 'text-indigo-600 dark:text-indigo-400'
                                                    : 'text-gray-600 hover:text-indigo-600 dark:text-gray-400 dark:hover:text-white',
                                                  'block px-2 py-1 text-xs truncate rounded hover:bg-gray-50 dark:hover:bg-white/5'
                                                )}
                                                title={job.title}
                                              >
                                                {job.title || `Job #${job.id}`}
                                              </Link>
                                            </li>
                                          ))}
                                        </ul>
                                      )}
                                    </li>
                                  )
                                })}

                              {/* More link for list view */}
                              {jobViewMode === 'list' && (() => {
                                const filteredJobs = activeJobs.filter(job => {
                                  if (!jobSearchQuery) return true
                                  const query = jobSearchQuery.toLowerCase()
                                  return (job.title || '').toLowerCase().includes(query) ||
                                         String(job.id).includes(query)
                                })
                                const remaining = filteredJobs.length - 10
                                if (remaining > 0) {
                                  return (
                                    <li className="pl-6">
                                      <Link
                                        to="/tables/204/active-jobs"
                                        className="text-xs text-gray-500 hover:text-indigo-600 dark:text-gray-400"
                                      >
                                        +{remaining} more...
                                      </Link>
                                    </li>
                                  )
                                }
                                return null
                              })()}
                            </ul>
                          )}
                        </li>
                      )
                    }

                    // Regular navigation item
                    return (
                      <li key={item.name}>
                        <Link
                          to={item.href}
                          title={sidebarCollapsed ? item.name : undefined}
                          className={classNames(
                            current
                              ? 'bg-gray-50 text-indigo-600 dark:bg-white/5 dark:text-white'
                              : 'text-gray-700 hover:bg-gray-50 hover:text-indigo-600 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-white',
                            'group flex gap-x-3 rounded-md p-2 text-sm/6 font-semibold',
                            sidebarCollapsed && 'justify-center'
                          )}
                        >
                          <item.icon
                            aria-hidden="true"
                            className={classNames(
                              current
                                ? 'text-indigo-600 dark:text-white'
                                : 'text-gray-400 group-hover:text-indigo-600 dark:group-hover:text-white',
                              'size-6 shrink-0',
                            )}
                          />
                          {!sidebarCollapsed && (
                            <span className="flex items-center gap-2 flex-1">
                              {item.name}
                              {item.name === 'Price Books' && priceBooksPreloadStatus === 'loading' && (
                                <span className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-1.5 py-0.5 rounded font-normal">
                                  Loading...
                                </span>
                              )}
                              {item.name === 'Price Books' && priceBooksPreloadStatus === 'complete' && (
                                <span className="text-xs bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 px-1.5 py-0.5 rounded font-normal">
                                  ✓ Ready
                                </span>
                              )}
                            </span>
                          )}
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              </li>
              <li className="mt-auto">
                <ul role="list" className="-mx-2 space-y-1">
                  {bottomNavigation.map((item) => {
                    const current = isCurrentPath(item.href)
                    return (
                      <li key={item.name}>
                        <Link
                          to={item.href}
                          title={sidebarCollapsed ? item.name : undefined}
                          className={classNames(
                            current
                              ? 'bg-gray-50 text-indigo-600 dark:bg-white/5 dark:text-white'
                              : 'text-gray-700 hover:bg-gray-50 hover:text-indigo-600 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-white',
                            'group flex gap-x-3 rounded-md p-2 text-sm/6 font-semibold',
                            sidebarCollapsed && 'justify-center'
                          )}
                        >
                          <item.icon
                            aria-hidden="true"
                            className={classNames(
                              current
                                ? 'text-indigo-600 dark:text-white'
                                : 'text-gray-400 group-hover:text-indigo-600 dark:group-hover:text-white',
                              'size-6 shrink-0',
                            )}
                          />
                          {!sidebarCollapsed && item.name}
                        </Link>
                      </li>
                    )
                  })}
                </ul>
                {!sidebarCollapsed && (
                  <div className="px-2 pt-3 pb-2">
                    <p className="text-xs text-gray-400 dark:text-gray-500 leading-relaxed">
                      Frontend: v{frontendVersion}
                    </p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 leading-relaxed mt-1">
                      Backend: {backendVersion}
                    </p>
                  </div>
                )}
              </li>
            </ul>
          </nav>
        </div>
      </div>

      {/* Main content area */}
      <div
        className={classNames(
          "h-screen flex flex-col",
          sidebarCollapsed ? "lg:pl-16 transition-all duration-300" : ""
        )}
        style={sidebarCollapsed ? undefined : { paddingLeft: sidebarWidth }}
      >
        {/* Top bar - always visible with help button */}
        <div className="z-40 flex h-16 shrink-0 items-center gap-x-4 border-b border-gray-200 bg-white px-4 shadow-sm sm:gap-x-6 sm:px-6 lg:px-8 dark:border-white/10 dark:bg-gray-900 dark:shadow-none transition-all duration-300">
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="-m-2.5 p-2.5 text-gray-700 hover:text-gray-900 lg:hidden dark:text-gray-400 dark:hover:text-white"
          >
            <span className="sr-only">Open sidebar</span>
            <Bars3Icon aria-hidden="true" className="size-6" />
          </button>

          {/* Separator */}
          <div aria-hidden="true" className="h-6 w-px bg-gray-200 lg:hidden dark:bg-white/10" />

          <div className="flex flex-1 gap-x-4 self-stretch lg:gap-x-6">
            <div className="flex flex-1 items-center gap-x-4 lg:gap-x-6">
              {/* Back Button - compact icon-only version */}
              <BackButton className="!text-gray-400 hover:!text-gray-500 dark:hover:!text-white !gap-0.5 shrink-0" />

              {/* Only show these icons when sidebar is NOT collapsed */}
              {!sidebarCollapsed && (
                <>
                  {/* Chat Icon */}
                  <Link to="/chat" className="relative -m-2.5 p-2.5 text-gray-400 hover:text-gray-500 dark:hover:text-white">
                    <span className="sr-only">Chat</span>
                    <ChatBubbleLeftRightIcon aria-hidden="true" className="size-6" />
                    {unreadCount > 0 && (
                      <span className="absolute top-0 right-0 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs font-medium text-white">
                        {unreadCount > 9 ? '9+' : unreadCount}
                      </span>
                    )}
                  </Link>

                  {/* Training Icon */}
                  <Link to="/training" className="-m-2.5 p-2.5 text-gray-400 hover:text-gray-500 dark:hover:text-white" title="Training Sessions">
                    <span className="sr-only">Training Sessions</span>
                    <AcademicCapIcon aria-hidden="true" className="size-6" />
                  </Link>

                  <button type="button" className="-m-2.5 p-2.5 text-gray-400 hover:text-gray-500 dark:hover:text-white">
                    <span className="sr-only">View notifications</span>
                    <BellIcon aria-hidden="true" className="size-6" />
                  </button>
                </>
              )}

              {/* Inspiring Banner - centered in top bar */}
              <div className="flex-1 flex justify-center px-4">
                <InspiringBanner />
              </div>

              {/* Help Button - always visible */}
              <FloatingHelpButton inline={true} />

              {/* Separator - only when sidebar not collapsed */}
              {!sidebarCollapsed && (
                <div aria-hidden="true" className="hidden lg:block lg:h-6 lg:w-px lg:bg-gray-200 dark:lg:bg-white/10" />
              )}

              {/* Profile dropdown */}
              <Menu as="div" className="relative">
                <MenuButton className="relative flex items-center">
                  <span className="absolute -inset-1.5" />
                  <span className="sr-only">Open user menu</span>
                  <img
                    alt=""
                    src="https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?ixlib=rb-1.2.1&ixid=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80"
                    className="size-8 rounded-full bg-gray-50 outline outline-1 -outline-offset-1 outline-black/5 dark:bg-gray-800 dark:outline-white/10"
                  />
                  <span className="hidden lg:flex lg:items-center">
                    <span aria-hidden="true" className="ml-4 text-sm/6 font-semibold text-gray-900 dark:text-white">
                      User
                    </span>
                    <ChevronDownIcon aria-hidden="true" className="ml-2 size-5 text-gray-400 dark:text-gray-500" />
                  </span>
                </MenuButton>
                <MenuItems
                  transition
                  className="absolute right-0 z-10 mt-2.5 w-56 origin-top-right divide-y divide-gray-100 rounded-md bg-white shadow-lg outline outline-1 outline-black/5 transition data-[closed]:scale-95 data-[closed]:transform data-[closed]:opacity-0 data-[enter]:duration-100 data-[leave]:duration-75 data-[enter]:ease-out data-[leave]:ease-in dark:divide-white/10 dark:bg-gray-800 dark:shadow-none dark:-outline-offset-1 dark:outline-white/10"
                >
                  <div className="py-1">
                    <MenuItem>
                      <Link
                        to="/profile"
                        className="group flex items-center px-4 py-2 text-sm text-gray-700 data-[focus]:bg-gray-100 data-[focus]:text-gray-900 data-[focus]:outline-none dark:text-gray-300 dark:data-[focus]:bg-white/5 dark:data-[focus]:text-white"
                      >
                        <UserCircleIcon
                          aria-hidden="true"
                          className="mr-3 size-5 text-gray-400 group-data-[focus]:text-gray-500 dark:text-gray-500 dark:group-data-[focus]:text-white"
                        />
                        Your profile
                      </Link>
                    </MenuItem>
                    <MenuItem>
                      <Link
                        to="/settings"
                        className="group flex items-center px-4 py-2 text-sm text-gray-700 data-[focus]:bg-gray-100 data-[focus]:text-gray-900 data-[focus]:outline-none dark:text-gray-300 dark:data-[focus]:bg-white/5 dark:data-[focus]:text-white"
                      >
                        <Cog6ToothIcon
                          aria-hidden="true"
                          className="mr-3 size-5 text-gray-400 group-data-[focus]:text-gray-500 dark:text-gray-500 dark:group-data-[focus]:text-white"
                        />
                        Settings
                      </Link>
                    </MenuItem>
                  </div>
                  <div className="py-1">
                    <MenuItem>
                      <Link
                        to="/logout"
                        className="group flex items-center px-4 py-2 text-sm text-gray-700 data-[focus]:bg-gray-100 data-[focus]:text-gray-900 data-[focus]:outline-none dark:text-gray-300 dark:data-[focus]:bg-white/5 dark:data-[focus]:text-white"
                      >
                        <ArrowRightOnRectangleIcon
                          aria-hidden="true"
                          className="mr-3 size-5 text-gray-400 group-data-[focus]:text-gray-500 dark:text-gray-500 dark:group-data-[focus]:text-white"
                        />
                        Sign out
                      </Link>
                    </MenuItem>
                  </div>
                </MenuItems>
              </Menu>
            </div>
          </div>
        </div>

        {/* Main content */}
        <main className={classNames(
          "py-4 flex-1 flex flex-col min-h-0",
          sidebarCollapsed ? "lg:pt-4" : ""
        )}>
          <div className="px-4 sm:px-6 lg:px-8 flex-1 flex flex-col min-h-0">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
