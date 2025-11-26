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
  { name: 'Jobs', href: '/tables/204/jobs', icon: BriefcaseIcon },
  { name: 'Meetings', href: '/meetings', icon: CalendarIcon },
  { name: 'WHS', href: '/whs', icon: ShieldCheckIcon },
  { name: 'Financial', href: '/financial', icon: BanknotesIcon },
  { name: 'Xest', href: '/xest', icon: BeakerIcon },
  { name: 'Price Books', href: '/tables/205/pricebook', icon: BookOpenIcon },
  { name: 'All Contacts', href: '/tables/214/contacts', icon: UsersIcon },
  //{ name: 'Suppliers', href: '/tables/215', icon: UserGroupIcon },
  { name: 'Purchase Orders', href: '/tables/217/purchase-orders', icon: DocumentTextIcon },
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
  '/jobs': true,          // Collapsed
  '/settings': true,      // Collapsed
  '/dashboard': false,    // Expanded
}

// Helper function to get Tailwind color classes for job status badges
const getStatusColorClass = (color) => {
  const colorMap = {
    'gray': 'bg-gray-400',
    'yellow': 'bg-yellow-400',
    'orange': 'bg-orange-400',
    'blue': 'bg-blue-400',
    'purple': 'bg-purple-400',
    'indigo': 'bg-indigo-400',
    'green': 'bg-green-400',
    'teal': 'bg-teal-400',
    'slate': 'bg-slate-400',
  }
  return colorMap[color] || 'bg-gray-400'
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

  // Price Books state
  const [priceBooks, setPriceBooks] = useState([])
  const [priceBookSearchQuery, setPriceBookSearchQuery] = useState('')
  const [priceBooksExpanded, setPriceBooksExpanded] = useState(() => {
    const saved = localStorage.getItem('priceBooksExpanded')
    return saved === null ? false : saved === 'true'
  })
  const [groupByCategory, setGroupByCategory] = useState(() => {
    const saved = localStorage.getItem('priceBookGroupByCategory')
    return saved === 'true'
  })
  const [expandedCategoryGroups, setExpandedCategoryGroups] = useState(() => {
    const saved = localStorage.getItem('expandedCategoryGroups')
    return saved ? JSON.parse(saved) : {}
  })

  // Contacts state
  const [contacts, setContacts] = useState([])
  const [contactSearchQuery, setContactSearchQuery] = useState('')
  const [contactsExpanded, setContactsExpanded] = useState(() => {
    const saved = localStorage.getItem('contactsExpanded')
    return saved === null ? false : saved === 'true'
  })
  const [groupByContactType, setGroupByContactType] = useState(() => {
    const saved = localStorage.getItem('contactGroupByType')
    return saved === 'true'
  })
  const [expandedContactTypeGroups, setExpandedContactTypeGroups] = useState(() => {
    const saved = localStorage.getItem('expandedContactTypeGroups')
    return saved ? JSON.parse(saved) : {}
  })

  // Purchase Orders state
  const [purchaseOrders, setPurchaseOrders] = useState([])
  const [purchaseOrderSearchQuery, setPurchaseOrderSearchQuery] = useState('')
  const [purchaseOrdersExpanded, setPurchaseOrdersExpanded] = useState(() => {
    const saved = localStorage.getItem('purchaseOrdersExpanded')
    return saved === null ? false : saved === 'true'
  })
  const [groupByPOJob, setGroupByPOJob] = useState(() => {
    const saved = localStorage.getItem('poGroupByJob')
    return saved === 'true'
  })
  const [expandedPOJobGroups, setExpandedPOJobGroups] = useState(() => {
    const saved = localStorage.getItem('expandedPOJobGroups')
    return saved ? JSON.parse(saved) : {}
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
  const [groupByType, setGroupByType] = useState(() => {
    const saved = localStorage.getItem('jobGroupByType')
    return saved === 'true'
  })
  const [groupByStatus, setGroupByStatus] = useState(() => {
    const saved = localStorage.getItem('jobGroupByStatus')
    return saved === 'true'
  })
  const [groupByStage, setGroupByStage] = useState(() => {
    const saved = localStorage.getItem('jobGroupByStage')
    return saved === 'false' // Default to false
  })
  const [expandedTypeGroups, setExpandedTypeGroups] = useState(() => {
    const saved = localStorage.getItem('expandedTypeGroups')
    return saved ? JSON.parse(saved) : {}
  })
  const [expandedStatusGroups, setExpandedStatusGroups] = useState(() => {
    const saved = localStorage.getItem('expandedStatusGroups')
    return saved ? JSON.parse(saved) : {}
  })
  const [filterButtonOrder, setFilterButtonOrder] = useState(() => {
    const saved = localStorage.getItem('jobFilterButtonOrder')
    return saved ? JSON.parse(saved) : ['type', 'status', 'stage']
  })
  const [draggedButton, setDraggedButton] = useState(null)

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
        const response = await api.get('/api/v1/jobs?status=Active&per_page=20')
        const jobs = response.jobs || response.constructions || []
        console.log('📋 Loaded jobs for sidebar:', jobs.length, 'jobs')
        console.log('📋 Job titles:', jobs.map(j => j.title || `Job #${j.id}`))
        setActiveJobs(jobs)
      } catch (err) {
        // Silently fail - sidebar will just show empty, user can still navigate
        console.debug('Active jobs unavailable:', err?.message || 'Unknown error')
      }
    }
    loadActiveJobs()
  }, [])

  // Load price books for sidebar
  useEffect(() => {
    const loadPriceBooks = async () => {
      try {
        const response = await api.get('/api/v1/pricebook?per_page=50')
        const books = response.items || response.pricebook || []
        console.log('📚 Loaded price books for sidebar:', books.length, 'items')
        setPriceBooks(books)
      } catch (err) {
        console.debug('Price books unavailable:', err?.message || 'Unknown error')
      }
    }
    loadPriceBooks()
  }, [])

  // Load contacts for sidebar
  useEffect(() => {
    const loadContacts = async () => {
      try {
        const response = await api.get('/api/v1/contacts?per_page=50')
        const contactsList = response.contacts || []
        console.log('👥 Loaded contacts for sidebar:', contactsList.length, 'contacts')
        setContacts(contactsList)
      } catch (err) {
        console.debug('Contacts unavailable:', err?.message || 'Unknown error')
      }
    }
    loadContacts()
  }, [])

  // Load purchase orders for sidebar
  useEffect(() => {
    const loadPurchaseOrders = async () => {
      try {
        const response = await api.get('/api/v1/purchase_orders?per_page=50')
        const orders = response.purchase_orders || []
        console.log('📦 Loaded purchase orders for sidebar:', orders.length, 'orders')
        setPurchaseOrders(orders)
      } catch (err) {
        console.debug('Purchase orders unavailable:', err?.message || 'Unknown error')
      }
    }
    loadPurchaseOrders()
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
      // Also expand the Jobs section
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

  const toggleGroupByType = () => {
    console.log('🔵 Type grouping clicked! Current:', groupByType, '→ New:', !groupByType)
    const newValue = !groupByType
    setGroupByType(newValue)
    localStorage.setItem('jobGroupByType', String(newValue))
  }

  const toggleGroupByStatus = () => {
    console.log('🟢 Status grouping clicked! Current:', groupByStatus, '→ New:', !groupByStatus)
    const newValue = !groupByStatus
    setGroupByStatus(newValue)
    localStorage.setItem('jobGroupByStatus', String(newValue))
  }

  const toggleGroupByStage = () => {
    console.log('🟣 Stage grouping clicked! Current:', groupByStage, '→ New:', !groupByStage)
    const newValue = !groupByStage
    setGroupByStage(newValue)
    localStorage.setItem('jobGroupByStage', String(newValue))
  }

  const toggleTypeGroup = (typeName) => {
    const newGroups = { ...expandedTypeGroups, [typeName]: !expandedTypeGroups[typeName] }
    setExpandedTypeGroups(newGroups)
    localStorage.setItem('expandedTypeGroups', JSON.stringify(newGroups))
  }

  const toggleStatusGroup = (typeAndStatus) => {
    const newGroups = { ...expandedStatusGroups, [typeAndStatus]: !expandedStatusGroups[typeAndStatus] }
    setExpandedStatusGroups(newGroups)
    localStorage.setItem('expandedStatusGroups', JSON.stringify(newGroups))
  }

  const handleButtonDragStart = (buttonType) => {
    setDraggedButton(buttonType)
  }

  const handleButtonDragOver = (e) => {
    e.preventDefault()
  }

  const handleButtonDrop = (targetButton) => {
    if (draggedButton && draggedButton !== targetButton) {
      const newOrder = [...filterButtonOrder]
      const draggedIndex = newOrder.indexOf(draggedButton)
      const targetIndex = newOrder.indexOf(targetButton)

      // Swap positions
      newOrder[draggedIndex] = targetButton
      newOrder[targetIndex] = draggedButton

      setFilterButtonOrder(newOrder)
      localStorage.setItem('jobFilterButtonOrder', JSON.stringify(newOrder))
    }
    setDraggedButton(null)
  }

  const handleButtonDragEnd = () => {
    setDraggedButton(null)
  }

  // Price Books toggles
  const togglePriceBooksExpanded = () => {
    const newValue = !priceBooksExpanded
    setPriceBooksExpanded(newValue)
    localStorage.setItem('priceBooksExpanded', String(newValue))
  }

  const toggleGroupByCategory = () => {
    const newValue = !groupByCategory
    setGroupByCategory(newValue)
    localStorage.setItem('priceBookGroupByCategory', String(newValue))
  }

  const toggleCategoryGroup = (categoryName) => {
    const newGroups = { ...expandedCategoryGroups, [categoryName]: !expandedCategoryGroups[categoryName] }
    setExpandedCategoryGroups(newGroups)
    localStorage.setItem('expandedCategoryGroups', JSON.stringify(newGroups))
  }

  // Contacts toggles
  const toggleContactsExpanded = () => {
    const newValue = !contactsExpanded
    setContactsExpanded(newValue)
    localStorage.setItem('contactsExpanded', String(newValue))
  }

  const toggleGroupByContactType = () => {
    const newValue = !groupByContactType
    setGroupByContactType(newValue)
    localStorage.setItem('contactGroupByType', String(newValue))
  }

  const toggleContactTypeGroup = (typeName) => {
    const newGroups = { ...expandedContactTypeGroups, [typeName]: !expandedContactTypeGroups[typeName] }
    setExpandedContactTypeGroups(newGroups)
    localStorage.setItem('expandedContactTypeGroups', JSON.stringify(newGroups))
  }

  // Purchase Orders toggles
  const togglePurchaseOrdersExpanded = () => {
    const newValue = !purchaseOrdersExpanded
    setPurchaseOrdersExpanded(newValue)
    localStorage.setItem('purchaseOrdersExpanded', String(newValue))
  }

  const toggleGroupByPOJob = () => {
    const newValue = !groupByPOJob
    setGroupByPOJob(newValue)
    localStorage.setItem('poGroupByJob', String(newValue))
  }

  const togglePOJobGroup = (jobTitle) => {
    const newGroups = { ...expandedPOJobGroups, [jobTitle]: !expandedPOJobGroups[jobTitle] }
    setExpandedPOJobGroups(newGroups)
    localStorage.setItem('expandedPOJobGroups', JSON.stringify(newGroups))
  }

  // Group jobs by Type, Status, and/or Stage
  const getGroupedJobs = (jobs) => {
    if (!groupByType && !groupByStatus && !groupByStage) {
      return { mode: 'list', jobs }
    }

    // Single-level grouping
    if (groupByType && !groupByStatus && !groupByStage) {
      const byType = {}
      jobs.forEach(job => {
        const typeName = job.job_type?.name || 'No Type'
        if (!byType[typeName]) byType[typeName] = []
        byType[typeName].push(job)
      })
      return { mode: 'type', groups: byType }
    }

    if (!groupByType && groupByStatus && !groupByStage) {
      const byStatus = {}
      jobs.forEach(job => {
        const statusName = job.job_status?.name || 'No Status'
        if (!byStatus[statusName]) byStatus[statusName] = []
        byStatus[statusName].push(job)
      })
      return { mode: 'status', groups: byStatus }
    }

    if (!groupByType && !groupByStatus && groupByStage) {
      const byStage = {}
      jobs.forEach(job => {
        const stageName = job.job_stage?.name || 'No Stage'
        if (!byStage[stageName]) byStage[stageName] = []
        byStage[stageName].push(job)
      })
      return { mode: 'stage', groups: byStage }
    }

    // Two-level grouping
    if (groupByType && groupByStatus && !groupByStage) {
      const byTypeAndStatus = {}
      jobs.forEach(job => {
        const typeName = job.job_type?.name || 'No Type'
        const statusName = job.job_status?.name || 'No Status'
        if (!byTypeAndStatus[typeName]) byTypeAndStatus[typeName] = {}
        if (!byTypeAndStatus[typeName][statusName]) byTypeAndStatus[typeName][statusName] = []
        byTypeAndStatus[typeName][statusName].push(job)
      })
      return { mode: 'type-status', groups: byTypeAndStatus }
    }

    if (groupByType && !groupByStatus && groupByStage) {
      const byTypeAndStage = {}
      jobs.forEach(job => {
        const typeName = job.job_type?.name || 'No Type'
        const stageName = job.job_stage?.name || 'No Stage'
        if (!byTypeAndStage[typeName]) byTypeAndStage[typeName] = {}
        if (!byTypeAndStage[typeName][stageName]) byTypeAndStage[typeName][stageName] = []
        byTypeAndStage[typeName][stageName].push(job)
      })
      return { mode: 'type-stage', groups: byTypeAndStage }
    }

    if (!groupByType && groupByStatus && groupByStage) {
      const byStatusAndStage = {}
      jobs.forEach(job => {
        const statusName = job.job_status?.name || 'No Status'
        const stageName = job.job_stage?.name || 'No Stage'
        if (!byStatusAndStage[statusName]) byStatusAndStage[statusName] = {}
        if (!byStatusAndStage[statusName][stageName]) byStatusAndStage[statusName][stageName] = []
        byStatusAndStage[statusName][stageName].push(job)
      })
      return { mode: 'status-stage', groups: byStatusAndStage }
    }

    // Three-level grouping
    const byTypeStatusStage = {}
    jobs.forEach(job => {
      const typeName = job.job_type?.name || 'No Type'
      const statusName = job.job_status?.name || 'No Status'
      const stageName = job.job_stage?.name || 'No Stage'
      if (!byTypeStatusStage[typeName]) byTypeStatusStage[typeName] = {}
      if (!byTypeStatusStage[typeName][statusName]) byTypeStatusStage[typeName][statusName] = {}
      if (!byTypeStatusStage[typeName][statusName][stageName]) byTypeStatusStage[typeName][statusName][stageName] = []
      byTypeStatusStage[typeName][statusName][stageName].push(job)
    })
    return { mode: 'type-status-stage', groups: byTypeStatusStage }
  }

  const groupedJobs = getGroupedJobs(activeJobs)

  // Group jobs by stage for stage view
  const jobsByStage = activeJobs.reduce((acc, job) => {
    const stage = job.stage || 'Unknown'
    if (!acc[stage]) acc[stage] = []
    acc[stage].push(job)
    return acc
  }, {})

  // Group price books by Category
  const getGroupedPriceBooks = (books) => {
    if (!groupByCategory) {
      return { mode: 'list', items: books }
    }

    const byCategory = {}
    books.forEach(book => {
      const categoryName = book.category || 'Uncategorized'
      if (!byCategory[categoryName]) byCategory[categoryName] = []
      byCategory[categoryName].push(book)
    })
    return { mode: 'category', groups: byCategory }
  }

  const groupedPriceBooks = getGroupedPriceBooks(priceBooks)

  // Group contacts by Contact Type
  const getGroupedContacts = (contactsList) => {
    if (!groupByContactType) {
      return { mode: 'list', items: contactsList }
    }

    const byType = {}
    contactsList.forEach(contact => {
      // Contact type should be "Supplier" or "Customer"
      // API returns contact_types as array like ["supplier", "customer"]
      let typeName = 'Unspecified'
      if (contact.contact_types && contact.contact_types.length > 0) {
        // Capitalize first type in array
        typeName = contact.contact_types[0].charAt(0).toUpperCase() + contact.contact_types[0].slice(1)
      } else if (contact.contact_type) {
        typeName = contact.contact_type
      } else if (contact.type) {
        typeName = contact.type
      }

      if (!byType[typeName]) byType[typeName] = []
      byType[typeName].push(contact)
    })
    return { mode: 'type', groups: byType }
  }

  const groupedContacts = getGroupedContacts(contacts)

  // Group purchase orders by Job
  const getGroupedPurchaseOrders = (orders) => {
    if (!groupByPOJob) {
      return { mode: 'list', items: orders }
    }

    const byJob = {}
    orders.forEach(order => {
      const jobTitle = order.job_title || order.construction?.title || 'No Job'
      if (!byJob[jobTitle]) byJob[jobTitle] = []
      byJob[jobTitle].push(order)
    })
    return { mode: 'job', groups: byJob }
  }

  const groupedPurchaseOrders = getGroupedPurchaseOrders(purchaseOrders)

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
    // Check Jobs first - matches /tables/204/jobs and also /jobs/:id paths
    if (href === '/tables/204/jobs') {
      return location.pathname === '/tables/204/jobs' ||
             location.pathname.startsWith('/tables/204/jobs/') ||
             location.pathname.match(/^\/jobs\/\d+/)
    }
    if (href === '/dashboard') {
      // Dashboard only matches its exact path, not all tables
      return location.pathname === '/dashboard'
    }
    // For table routes, check exact match or detail pages
    if (href.startsWith('/tables/')) {
      return location.pathname === href || location.pathname.startsWith(href + '/')
    }
    // For other routes with potential child paths
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
                              {item.name}
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

                    // Special handling for Jobs - make it expandable
                    if (item.name === 'Jobs') {
                      return (
                        <li key={item.name}>
                          {/* Jobs header with expand toggle */}
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
                                {filterButtonOrder.map((buttonType) => {
                                  const isActive = buttonType === 'type' ? groupByType :
                                                   buttonType === 'status' ? groupByStatus :
                                                   groupByStage
                                  const toggleFn = buttonType === 'type' ? toggleGroupByType :
                                                   buttonType === 'status' ? toggleGroupByStatus :
                                                   toggleGroupByStage
                                  const label = buttonType === 'type' ? 'Type' :
                                                buttonType === 'status' ? 'Status' :
                                                'Stage'

                                  return (
                                    <button
                                      key={buttonType}
                                      type="button"
                                      draggable
                                      onDragStart={() => handleButtonDragStart(buttonType)}
                                      onDragOver={handleButtonDragOver}
                                      onDrop={() => handleButtonDrop(buttonType)}
                                      onDragEnd={handleButtonDragEnd}
                                      onClick={toggleFn}
                                      className={classNames(
                                        'px-1.5 py-1 text-xs rounded border transition-colors cursor-move',
                                        isActive
                                          ? 'bg-indigo-100 border-indigo-300 text-indigo-700 dark:bg-indigo-900/40 dark:border-indigo-700 dark:text-indigo-300'
                                          : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-700',
                                        draggedButton === buttonType && 'opacity-50'
                                      )}
                                      title={`${isActive ? 'Grouped by' : 'Group by'} ${label} (drag to reorder)`}
                                    >
                                      {label}
                                    </button>
                                  )
                                })}
                              </li>

                              {/* Grouped/List View */}
                              {groupedJobs.mode === 'list' && groupedJobs.jobs
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
                                        'flex-1 px-2 py-1 text-xs rounded hover:bg-gray-50 dark:hover:bg-white/5 flex items-center gap-1'
                                      )}
                                      title={`${job.title}${job.job_type ? ` • ${job.job_type.name}` : ''}${job.job_status ? ` • ${job.job_status.name}` : ''}`}
                                    >
                                      {/* Job Type Badge */}
                                      {job.job_type && (
                                        <span
                                          className="w-2 h-2 rounded-sm bg-blue-500 dark:bg-blue-400 flex-shrink-0"
                                          title={job.job_type.name}
                                        />
                                      )}
                                      {/* Job Status Badge */}
                                      {job.job_status && (
                                        <span
                                          className={`w-2 h-2 rounded-sm ${getStatusColorClass(job.job_status.color)} flex-shrink-0`}
                                          title={job.job_status.name}
                                        />
                                      )}
                                      {/* Job Stage Badge */}
                                      {job.job_stage && (
                                        <span
                                          className={`w-2 h-2 rounded-sm ${getStatusColorClass(job.job_stage.color)} flex-shrink-0`}
                                          title={job.job_stage.name}
                                        />
                                      )}
                                      <span className="truncate">{job.title || `Job #${job.id}`}</span>
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

                              {/* Type-only Grouped View */}
                              {groupedJobs.mode === 'type' && Object.entries(groupedJobs.groups)
                                .sort(([a], [b]) => a.localeCompare(b))
                                .map(([typeName, jobs]) => {
                                  const filteredJobs = jobs.filter(job => {
                                    if (!jobSearchQuery) return true
                                    const query = jobSearchQuery.toLowerCase()
                                    return (job.title || '').toLowerCase().includes(query) ||
                                           String(job.id).includes(query)
                                  })
                                  if (filteredJobs.length === 0) return null

                                  return (
                                    <li key={typeName}>
                                      {/* Type group header */}
                                      <button
                                        type="button"
                                        onClick={() => toggleTypeGroup(typeName)}
                                        className="flex items-center gap-1 px-2 py-1 w-full text-left hover:bg-gray-50 dark:hover:bg-white/5 rounded transition-colors"
                                      >
                                        <ChevronRightIcon
                                          className={classNames(
                                            'h-3 w-3 text-gray-400 transition-transform',
                                            (expandedTypeGroups[typeName] !== false) && 'rotate-90'
                                          )}
                                        />
                                        <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                                          {typeName}
                                        </span>
                                        <span className="ml-auto text-xs text-gray-400">
                                          {filteredJobs.length}
                                        </span>
                                      </button>

                                      {/* Jobs under this type */}
                                      {(expandedTypeGroups[typeName] !== false) && (
                                        <ul className="ml-4 space-y-0.5">
                                          {filteredJobs.slice(0, 20).map((job) => (
                                            <li key={job.id}>
                                              <Link
                                                to={`/jobs/${job.id}/overview`}
                                                className={classNames(
                                                  location.pathname.startsWith(`/jobs/${job.id}`)
                                                    ? 'text-indigo-600 dark:text-indigo-400'
                                                    : 'text-gray-600 hover:text-indigo-600 dark:text-gray-400 dark:hover:text-white',
                                                  'px-2 py-1 text-xs rounded hover:bg-gray-50 dark:hover:bg-white/5 flex items-center gap-1'
                                                )}
                                                title={`${job.title}${job.job_status ? ` • ${job.job_status.name}` : ''}`}
                                              >
                                                {job.job_status && (
                                                  <span
                                                    className={`w-2 h-2 rounded-sm ${getStatusColorClass(job.job_status.color)} flex-shrink-0`}
                                                    title={job.job_status.name}
                                                  />
                                                )}
                                                {job.job_stage && (
                                                  <span
                                                    className={`w-2 h-2 rounded-sm ${getStatusColorClass(job.job_stage.color)} flex-shrink-0`}
                                                    title={job.job_stage.name}
                                                  />
                                                )}
                                                <span className="truncate">{job.title || `Job #${job.id}`}</span>
                                              </Link>
                                            </li>
                                          ))}
                                        </ul>
                                      )}
                                    </li>
                                  )
                                })}

                              {/* Status-only Grouped View */}
                              {groupedJobs.mode === 'status' && Object.entries(groupedJobs.groups)
                                .sort(([a], [b]) => a.localeCompare(b))
                                .map(([statusName, jobs]) => {
                                  const filteredJobs = jobs.filter(job => {
                                    if (!jobSearchQuery) return true
                                    const query = jobSearchQuery.toLowerCase()
                                    return (job.title || '').toLowerCase().includes(query) ||
                                           String(job.id).includes(query)
                                  })
                                  if (filteredJobs.length === 0) return null

                                  return (
                                    <li key={statusName}>
                                      {/* Status group header */}
                                      <button
                                        type="button"
                                        onClick={() => toggleStatusGroup(statusName)}
                                        className="flex items-center gap-1 px-2 py-1 w-full text-left hover:bg-gray-50 dark:hover:bg-white/5 rounded transition-colors"
                                      >
                                        <ChevronRightIcon
                                          className={classNames(
                                            'h-3 w-3 text-gray-400 transition-transform',
                                            (expandedStatusGroups[statusName] !== false) && 'rotate-90'
                                          )}
                                        />
                                        <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                                          {statusName}
                                        </span>
                                        <span className="ml-auto text-xs text-gray-400">
                                          {filteredJobs.length}
                                        </span>
                                      </button>

                                      {/* Jobs under this status */}
                                      {(expandedStatusGroups[statusName] !== false) && (
                                        <ul className="ml-4 space-y-0.5">
                                          {filteredJobs.slice(0, 20).map((job) => (
                                            <li key={job.id}>
                                              <Link
                                                to={`/jobs/${job.id}/overview`}
                                                className={classNames(
                                                  location.pathname.startsWith(`/jobs/${job.id}`)
                                                    ? 'text-indigo-600 dark:text-indigo-400'
                                                    : 'text-gray-600 hover:text-indigo-600 dark:text-gray-400 dark:hover:text-white',
                                                  'px-2 py-1 text-xs rounded hover:bg-gray-50 dark:hover:bg-white/5 flex items-center gap-1'
                                                )}
                                                title={`${job.title}${job.job_type ? ` • ${job.job_type.name}` : ''}`}
                                              >
                                                {job.job_type && (
                                                  <span
                                                    className="w-2 h-2 rounded-sm bg-blue-500 dark:bg-blue-400 flex-shrink-0"
                                                    title={job.job_type.name}
                                                  />
                                                )}
                                                {job.job_stage && (
                                                  <span
                                                    className={`w-2 h-2 rounded-sm ${getStatusColorClass(job.job_stage.color)} flex-shrink-0`}
                                                    title={job.job_stage.name}
                                                  />
                                                )}
                                                <span className="truncate">{job.title || `Job #${job.id}`}</span>
                                              </Link>
                                            </li>
                                          ))}
                                        </ul>
                                      )}
                                    </li>
                                  )
                                })}

                              {/* Type + Status Nested Grouped View */}
                              {groupedJobs.mode === 'type-status' && Object.entries(groupedJobs.groups)
                                .sort(([a], [b]) => a.localeCompare(b))
                                .map(([typeName, statusGroups]) => (
                                  <li key={typeName}>
                                    {/* Type group header */}
                                    <button
                                      type="button"
                                      onClick={() => toggleTypeGroup(typeName)}
                                      className="flex items-center gap-1 px-2 py-1 w-full text-left hover:bg-gray-50 dark:hover:bg-white/5 rounded transition-colors"
                                    >
                                      <ChevronRightIcon
                                        className={classNames(
                                          'h-3 w-3 text-gray-400 transition-transform',
                                          (expandedTypeGroups[typeName] !== false) && 'rotate-90'
                                        )}
                                      />
                                      <span className="text-xs font-semibold text-indigo-700 dark:text-indigo-300">
                                        {typeName}
                                      </span>
                                      <span className="ml-auto text-xs text-gray-400">
                                        {Object.values(statusGroups).flat().length}
                                      </span>
                                    </button>

                                    {/* Status groups under this type */}
                                    {(expandedTypeGroups[typeName] !== false) && (
                                      <ul className="ml-3 space-y-0.5 mt-0.5">
                                        {Object.entries(statusGroups)
                                          .sort(([a], [b]) => a.localeCompare(b))
                                          .map(([statusName, jobs]) => {
                                            const filteredJobs = jobs.filter(job => {
                                              if (!jobSearchQuery) return true
                                              const query = jobSearchQuery.toLowerCase()
                                              return (job.title || '').toLowerCase().includes(query) ||
                                                     String(job.id).includes(query)
                                            })
                                            if (filteredJobs.length === 0) return null

                                            const groupKey = `${typeName}:${statusName}`
                                            return (
                                              <li key={statusName}>
                                                {/* Status subgroup header */}
                                                <button
                                                  type="button"
                                                  onClick={() => toggleStatusGroup(groupKey)}
                                                  className="flex items-center gap-1 px-2 py-1 w-full text-left hover:bg-gray-50 dark:hover:bg-white/5 rounded transition-colors"
                                                >
                                                  <ChevronRightIcon
                                                    className={classNames(
                                                      'h-3 w-3 text-gray-400 transition-transform',
                                                      (expandedStatusGroups[groupKey] !== false) && 'rotate-90'
                                                    )}
                                                  />
                                                  <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
                                                    {statusName}
                                                  </span>
                                                  <span className="ml-auto text-xs text-gray-400">
                                                    {filteredJobs.length}
                                                  </span>
                                                </button>

                                                {/* Jobs under this type+status */}
                                                {(expandedStatusGroups[groupKey] !== false) && (
                                                  <ul className="ml-4 space-y-0.5">
                                                    {filteredJobs.slice(0, 20).map((job) => (
                                                      <li key={job.id}>
                                                        <Link
                                                          to={`/jobs/${job.id}/overview`}
                                                          className={classNames(
                                                            location.pathname.startsWith(`/jobs/${job.id}`)
                                                              ? 'text-indigo-600 dark:text-indigo-400 font-medium'
                                                              : 'text-gray-600 hover:text-indigo-600 dark:text-gray-400 dark:hover:text-white',
                                                            'px-2 py-1 text-xs rounded hover:bg-gray-50 dark:hover:bg-white/5 block truncate'
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
                                                  'px-2 py-1 text-xs rounded hover:bg-gray-50 dark:hover:bg-white/5 flex items-center gap-1'
                                                )}
                                                title={`${job.title}${job.job_type ? ` • ${job.job_type.name}` : ''}${job.job_status ? ` • ${job.job_status.name}` : ''}`}
                                              >
                                                {/* Job Type Badge */}
                                                {job.job_type && (
                                                  <span
                                                    className="w-2 h-2 rounded-sm bg-blue-500 dark:bg-blue-400 flex-shrink-0"
                                                    title={job.job_type.name}
                                                  />
                                                )}
                                                {/* Job Status Badge */}
                                                {job.job_status && (
                                                  <span
                                                    className={`w-2 h-2 rounded-sm ${getStatusColorClass(job.job_status.color)} flex-shrink-0`}
                                                    title={job.job_status.name}
                                                  />
                                                )}
                                                {job.job_stage && (
                                                  <span
                                                    className={`w-2 h-2 rounded-sm ${getStatusColorClass(job.job_stage.color)} flex-shrink-0`}
                                                    title={job.job_stage.name}
                                                  />
                                                )}
                                                <span className="truncate">{job.title || `Job #${job.id}`}</span>
                                              </Link>
                                            </li>
                                          ))}
                                        </ul>
                                      )}
                                    </li>
                                  )
                                })}

                              {/* More link for list view */}
                              {groupedJobs.mode === 'list' && (() => {
                                const filteredJobs = groupedJobs.jobs.filter(job => {
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
                                        to="/tables/204/jobs"
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

                    // Special handling for Price Books - make it expandable with grouping
                    if (item.name === 'Price Books') {
                      return (
                        <li key={item.name}>
                          {/* Price Books header with expand toggle */}
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
                            {!sidebarCollapsed && priceBooks.length > 0 && (
                              <button
                                onClick={togglePriceBooksExpanded}
                                className="p-1 mr-2 hover:bg-gray-100 dark:hover:bg-white/10 rounded transition-colors"
                              >
                                <ChevronRightIcon
                                  className={classNames(
                                    'h-4 w-4 text-gray-400 transition-transform',
                                    priceBooksExpanded && 'rotate-90'
                                  )}
                                />
                              </button>
                            )}
                          </div>

                          {/* Expandable price book list */}
                          {!sidebarCollapsed && priceBooksExpanded && priceBooks.length > 0 && (
                            <ul className="mt-1 space-y-0.5">
                              {/* Search and Category button */}
                              <li className="px-2 pb-1 flex gap-1">
                                <div className="relative flex-1">
                                  <MagnifyingGlassIcon className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                                  <input
                                    type="text"
                                    placeholder="Search price books..."
                                    value={priceBookSearchQuery}
                                    onChange={(e) => setPriceBookSearchQuery(e.target.value)}
                                    className="w-full pl-7 pr-2 py-1 text-xs border border-gray-200 dark:border-gray-700 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                                  />
                                </div>
                                <button
                                  type="button"
                                  onClick={toggleGroupByCategory}
                                  className={classNames(
                                    'px-1.5 py-1 text-xs rounded border transition-colors cursor-pointer',
                                    groupByCategory
                                      ? 'bg-indigo-100 border-indigo-300 text-indigo-700 dark:bg-indigo-900/40 dark:border-indigo-700 dark:text-indigo-300'
                                      : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-700'
                                  )}
                                  title={groupByCategory ? 'Grouped by Category' : 'Group by Category'}
                                >
                                  Category
                                </button>
                              </li>

                              {/* List View */}
                              {groupedPriceBooks.mode === 'list' && groupedPriceBooks.items
                                .filter(book => {
                                  if (!priceBookSearchQuery) return true
                                  const query = priceBookSearchQuery.toLowerCase()
                                  return (book.item_code || book.code || '').toLowerCase().includes(query)
                                })
                                .slice(0, 20)
                                .map((book) => (
                                <li key={book.id}>
                                  <Link
                                    to={`/tables/205/pricebook/${book.id}`}
                                    className={classNames(
                                      location.pathname.startsWith(`/tables/205/pricebook/${book.id}`)
                                        ? 'text-indigo-600 dark:text-indigo-400'
                                        : 'text-gray-600 hover:text-indigo-600 dark:text-gray-400 dark:hover:text-white',
                                      'px-4 py-1 text-xs rounded hover:bg-gray-50 dark:hover:bg-white/5 block truncate'
                                    )}
                                  >
                                    {book.item_code || book.code || `Book #${book.id}`}
                                  </Link>
                                </li>
                              ))}

                              {/* Category Grouped View */}
                              {groupedPriceBooks.mode === 'category' && Object.entries(groupedPriceBooks.groups)
                                .sort(([a], [b]) => a.localeCompare(b))
                                .map(([categoryName, books]) => {
                                  const filteredBooks = books.filter(book => {
                                    if (!priceBookSearchQuery) return true
                                    const query = priceBookSearchQuery.toLowerCase()
                                    return (book.item_code || book.code || '').toLowerCase().includes(query)
                                  })
                                  if (filteredBooks.length === 0) return null

                                  return (
                                    <li key={categoryName}>
                                      {/* Category group header */}
                                      <button
                                        type="button"
                                        onClick={() => toggleCategoryGroup(categoryName)}
                                        className="flex items-center gap-1 px-2 py-1 w-full text-left hover:bg-gray-50 dark:hover:bg-white/5 rounded transition-colors"
                                      >
                                        <ChevronRightIcon
                                          className={classNames(
                                            'h-3 w-3 text-gray-400 transition-transform',
                                            (expandedCategoryGroups[categoryName] === true) && 'rotate-90'
                                          )}
                                        />
                                        <span className="text-xs font-semibold text-indigo-700 dark:text-indigo-300">
                                          {categoryName}
                                        </span>
                                        <span className="ml-auto text-xs text-gray-400">
                                          {filteredBooks.length}
                                        </span>
                                      </button>

                                      {/* Books under this category */}
                                      {(expandedCategoryGroups[categoryName] === true) && (
                                        <ul className="ml-4 space-y-0.5">
                                          {filteredBooks.slice(0, 20).map((book) => (
                                            <li key={book.id}>
                                              <Link
                                                to={`/tables/205/pricebook/${book.id}`}
                                                className={classNames(
                                                  location.pathname.startsWith(`/tables/205/pricebook/${book.id}`)
                                                    ? 'text-indigo-600 dark:text-indigo-400 font-medium'
                                                    : 'text-gray-600 hover:text-indigo-600 dark:text-gray-400 dark:hover:text-white',
                                                  'px-2 py-1 text-xs rounded hover:bg-gray-50 dark:hover:bg-white/5 block truncate'
                                                )}
                                              >
                                                {book.item_code || book.code || `Book #${book.id}`}
                                              </Link>
                                            </li>
                                          ))}
                                        </ul>
                                      )}
                                    </li>
                                  )
                                })}
                            </ul>
                          )}
                        </li>
                      )
                    }

                    // Special handling for All Contacts - make it expandable with grouping
                    if (item.name === 'All Contacts') {
                      return (
                        <li key={item.name}>
                          {/* All Contacts header with expand toggle */}
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
                            {!sidebarCollapsed && contacts.length > 0 && (
                              <button
                                onClick={toggleContactsExpanded}
                                className="p-1 mr-2 hover:bg-gray-100 dark:hover:bg-white/10 rounded transition-colors"
                              >
                                <ChevronRightIcon
                                  className={classNames(
                                    'h-4 w-4 text-gray-400 transition-transform',
                                    contactsExpanded && 'rotate-90'
                                  )}
                                />
                              </button>
                            )}
                          </div>

                          {/* Expandable contacts list */}
                          {!sidebarCollapsed && contactsExpanded && contacts.length > 0 && (
                            <ul className="mt-1 space-y-0.5">
                              {/* Search and Type button */}
                              <li className="px-2 pb-1 flex gap-1">
                                <div className="relative flex-1">
                                  <MagnifyingGlassIcon className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                                  <input
                                    type="text"
                                    placeholder="Search contacts..."
                                    value={contactSearchQuery}
                                    onChange={(e) => setContactSearchQuery(e.target.value)}
                                    className="w-full pl-7 pr-2 py-1 text-xs border border-gray-200 dark:border-gray-700 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                                  />
                                </div>
                                <button
                                  type="button"
                                  onClick={toggleGroupByContactType}
                                  className={classNames(
                                    'px-1.5 py-1 text-xs rounded border transition-colors cursor-pointer',
                                    groupByContactType
                                      ? 'bg-indigo-100 border-indigo-300 text-indigo-700 dark:bg-indigo-900/40 dark:border-indigo-700 dark:text-indigo-300'
                                      : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-700'
                                  )}
                                  title={groupByContactType ? 'Grouped by Type' : 'Group by Type'}
                                >
                                  Type
                                </button>
                              </li>

                              {/* List View */}
                              {groupedContacts.mode === 'list' && groupedContacts.items
                                .filter(contact => {
                                  if (!contactSearchQuery) return true
                                  const query = contactSearchQuery.toLowerCase()
                                  return (contact.full_name || contact.name || '').toLowerCase().includes(query)
                                })
                                .slice(0, 20)
                                .map((contact) => (
                                <li key={contact.id}>
                                  <Link
                                    to={`/tables/214/contacts/${contact.id}`}
                                    className={classNames(
                                      location.pathname.startsWith(`/tables/214/contacts/${contact.id}`)
                                        ? 'text-indigo-600 dark:text-indigo-400'
                                        : 'text-gray-600 hover:text-indigo-600 dark:text-gray-400 dark:hover:text-white',
                                      'px-4 py-1 text-xs rounded hover:bg-gray-50 dark:hover:bg-white/5 block truncate'
                                    )}
                                  >
                                    {contact.full_name || contact.name || `Contact #${contact.id}`}
                                  </Link>
                                </li>
                              ))}

                              {/* Type Grouped View */}
                              {groupedContacts.mode === 'type' && Object.entries(groupedContacts.groups)
                                .sort(([a], [b]) => a.localeCompare(b))
                                .map(([typeName, contactsList]) => {
                                  const filteredContacts = contactsList.filter(contact => {
                                    if (!contactSearchQuery) return true
                                    const query = contactSearchQuery.toLowerCase()
                                    return (contact.full_name || contact.name || '').toLowerCase().includes(query)
                                  })
                                  if (filteredContacts.length === 0) return null

                                  return (
                                    <li key={typeName}>
                                      {/* Type group header */}
                                      <button
                                        type="button"
                                        onClick={() => toggleContactTypeGroup(typeName)}
                                        className="flex items-center gap-1 px-2 py-1 w-full text-left hover:bg-gray-50 dark:hover:bg-white/5 rounded transition-colors"
                                      >
                                        <ChevronRightIcon
                                          className={classNames(
                                            'h-3 w-3 text-gray-400 transition-transform',
                                            (expandedContactTypeGroups[typeName] === true) && 'rotate-90'
                                          )}
                                        />
                                        <span className="text-xs font-semibold text-indigo-700 dark:text-indigo-300">
                                          {typeName}
                                        </span>
                                        <span className="ml-auto text-xs text-gray-400">
                                          {filteredContacts.length}
                                        </span>
                                      </button>

                                      {/* Contacts under this type */}
                                      {(expandedContactTypeGroups[typeName] === true) && (
                                        <ul className="ml-4 space-y-0.5">
                                          {filteredContacts.slice(0, 20).map((contact) => (
                                            <li key={contact.id}>
                                              <Link
                                                to={`/tables/214/contacts/${contact.id}`}
                                                className={classNames(
                                                  location.pathname.startsWith(`/tables/214/contacts/${contact.id}`)
                                                    ? 'text-indigo-600 dark:text-indigo-400 font-medium'
                                                    : 'text-gray-600 hover:text-indigo-600 dark:text-gray-400 dark:hover:text-white',
                                                  'px-2 py-1 text-xs rounded hover:bg-gray-50 dark:hover:bg-white/5 block truncate'
                                                )}
                                              >
                                                {contact.full_name || contact.name || `Contact #${contact.id}`}
                                              </Link>
                                            </li>
                                          ))}
                                        </ul>
                                      )}
                                    </li>
                                  )
                                })}
                            </ul>
                          )}
                        </li>
                      )
                    }

                    // Special handling for Purchase Orders - make it expandable with grouping
                    if (item.name === 'Purchase Orders') {
                      return (
                        <li key={item.name}>
                          {/* Purchase Orders header with expand toggle */}
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
                            {!sidebarCollapsed && purchaseOrders.length > 0 && (
                              <button
                                onClick={togglePurchaseOrdersExpanded}
                                className="p-1 mr-2 hover:bg-gray-100 dark:hover:bg-white/10 rounded transition-colors"
                              >
                                <ChevronRightIcon
                                  className={classNames(
                                    'h-4 w-4 text-gray-400 transition-transform',
                                    purchaseOrdersExpanded && 'rotate-90'
                                  )}
                                />
                              </button>
                            )}
                          </div>

                          {/* Expandable purchase orders list */}
                          {!sidebarCollapsed && purchaseOrdersExpanded && purchaseOrders.length > 0 && (
                            <ul className="mt-1 space-y-0.5">
                              {/* Search and Job button */}
                              <li className="px-2 pb-1 flex gap-1">
                                <div className="relative flex-1">
                                  <MagnifyingGlassIcon className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                                  <input
                                    type="text"
                                    placeholder="Search purchase orders..."
                                    value={purchaseOrderSearchQuery}
                                    onChange={(e) => setPurchaseOrderSearchQuery(e.target.value)}
                                    className="w-full pl-7 pr-2 py-1 text-xs border border-gray-200 dark:border-gray-700 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                                  />
                                </div>
                                <button
                                  type="button"
                                  onClick={toggleGroupByPOJob}
                                  className={classNames(
                                    'px-1.5 py-1 text-xs rounded border transition-colors cursor-pointer',
                                    groupByPOJob
                                      ? 'bg-indigo-100 border-indigo-300 text-indigo-700 dark:bg-indigo-900/40 dark:border-indigo-700 dark:text-indigo-300'
                                      : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-700'
                                  )}
                                  title={groupByPOJob ? 'Grouped by Job' : 'Group by Job'}
                                >
                                  Job
                                </button>
                              </li>

                              {/* List View */}
                              {groupedPurchaseOrders.mode === 'list' && groupedPurchaseOrders.items
                                .filter(order => {
                                  if (!purchaseOrderSearchQuery) return true
                                  const query = purchaseOrderSearchQuery.toLowerCase()
                                  return (order.number || order.title || '').toLowerCase().includes(query)
                                })
                                .slice(0, 20)
                                .map((order) => (
                                <li key={order.id}>
                                  <Link
                                    to={`/tables/217/purchase-orders/${order.id}`}
                                    className={classNames(
                                      location.pathname.startsWith(`/tables/217/purchase-orders/${order.id}`)
                                        ? 'text-indigo-600 dark:text-indigo-400'
                                        : 'text-gray-600 hover:text-indigo-600 dark:text-gray-400 dark:hover:text-white',
                                      'px-4 py-1 text-xs rounded hover:bg-gray-50 dark:hover:bg-white/5 block truncate'
                                    )}
                                  >
                                    {order.number ? `PO ${order.number}` : `PO #${order.id}`}
                                  </Link>
                                </li>
                              ))}

                              {/* Job Grouped View */}
                              {groupedPurchaseOrders.mode === 'job' && Object.entries(groupedPurchaseOrders.groups)
                                .sort(([a], [b]) => a.localeCompare(b))
                                .map(([jobName, ordersList]) => {
                                  const filteredOrders = ordersList.filter(order => {
                                    if (!purchaseOrderSearchQuery) return true
                                    const query = purchaseOrderSearchQuery.toLowerCase()
                                    return (order.number || order.title || '').toLowerCase().includes(query)
                                  })
                                  if (filteredOrders.length === 0) return null

                                  return (
                                    <li key={jobName}>
                                      {/* Job group header */}
                                      <button
                                        type="button"
                                        onClick={() => togglePOJobGroup(jobName)}
                                        className="flex items-center gap-1 px-2 py-1 w-full text-left hover:bg-gray-50 dark:hover:bg-white/5 rounded transition-colors"
                                      >
                                        <ChevronRightIcon
                                          className={classNames(
                                            'h-3 w-3 text-gray-400 transition-transform',
                                            (expandedPOJobGroups[jobName] === true) && 'rotate-90'
                                          )}
                                        />
                                        <span className="text-xs font-semibold text-indigo-700 dark:text-indigo-300">
                                          {jobName}
                                        </span>
                                        <span className="ml-auto text-xs text-gray-400">
                                          {filteredOrders.length}
                                        </span>
                                      </button>

                                      {/* Purchase orders under this job */}
                                      {(expandedPOJobGroups[jobName] === true) && (
                                        <ul className="ml-4 space-y-0.5">
                                          {filteredOrders.slice(0, 20).map((order) => (
                                            <li key={order.id}>
                                              <Link
                                                to={`/tables/217/purchase-orders/${order.id}`}
                                                className={classNames(
                                                  location.pathname.startsWith(`/tables/217/purchase-orders/${order.id}`)
                                                    ? 'text-indigo-600 dark:text-indigo-400 font-medium'
                                                    : 'text-gray-600 hover:text-indigo-600 dark:text-gray-400 dark:hover:text-white',
                                                  'px-2 py-1 text-xs rounded hover:bg-gray-50 dark:hover:bg-white/5 block truncate'
                                                )}
                                              >
                                                {order.number ? `PO ${order.number}` : `PO #${order.id}`}
                                              </Link>
                                            </li>
                                          ))}
                                        </ul>
                                      )}
                                    </li>
                                  )
                                })}
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
                          {!sidebarCollapsed && item.name}
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
                      {user ? user.name || user.email : 'Guest'}
                    </span>
                    {user && user.role && (
                      <span className="ml-2 inline-flex items-center rounded-md bg-indigo-50 px-2 py-1 text-xs font-medium text-indigo-700 ring-1 ring-inset ring-indigo-700/10 dark:bg-indigo-400/10 dark:text-indigo-400 dark:ring-indigo-400/30">
                        {user.role}
                      </span>
                    )}
                    {!user && (
                      <span className="ml-2 inline-flex items-center rounded-md bg-gray-50 px-2 py-1 text-xs font-medium text-gray-600 ring-1 ring-inset ring-gray-500/10 dark:bg-gray-400/10 dark:text-gray-400 dark:ring-gray-400/20">
                        Not logged in
                      </span>
                    )}
                    <ChevronDownIcon aria-hidden="true" className="ml-2 size-5 text-gray-400 dark:text-gray-500" />
                  </span>
                </MenuButton>
                <MenuItems
                  transition
                  className="absolute right-0 z-10 mt-2.5 w-56 origin-top-right divide-y divide-gray-100 rounded-md bg-white shadow-lg outline outline-1 outline-black/5 transition data-[closed]:scale-95 data-[closed]:transform data-[closed]:opacity-0 data-[enter]:duration-100 data-[leave]:duration-75 data-[enter]:ease-out data-[leave]:ease-in dark:divide-white/10 dark:bg-gray-800 dark:shadow-none dark:-outline-offset-1 dark:outline-white/10"
                >
                  {user && (
                    <div className="px-4 py-3">
                      <p className="text-sm text-gray-900 dark:text-white font-medium">{user.name || 'User'}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{user.email}</p>
                    </div>
                  )}
                  {!user && (
                    <div className="px-4 py-3">
                      <p className="text-sm text-gray-500 dark:text-gray-400">Not logged in</p>
                    </div>
                  )}
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
