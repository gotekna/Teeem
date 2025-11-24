import { useState, useEffect, lazy, Suspense } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { Tab, TabGroup, TabList, TabPanel, TabPanels } from '@headlessui/react'
import {
  RocketLaunchIcon,
  ArrowDownTrayIcon,
  BuildingOfficeIcon,
  ShieldCheckIcon,
  CalendarDaysIcon,
  CalendarIcon,
  DocumentTextIcon,
  ClipboardDocumentCheckIcon,
  StarIcon,
  WrenchScrewdriverIcon,
  BoltIcon,
  BookOpenIcon,
  SparklesIcon,
  ChartBarIcon,
  KeyIcon,
  ExclamationTriangleIcon,
  AcademicCapIcon,
  CheckCircleIcon,
  BanknotesIcon,
  UserGroupIcon,
  CurrencyDollarIcon
} from '@heroicons/react/24/outline'
import { api } from '../api'

// Lazy load tab components to reduce initial bundle size
const ScheduleMasterTabs = lazy(() => import('../components/schedule-master/ScheduleMasterTabs'))
const DocumentationCategoriesTab = lazy(() => import('../components/settings/DocumentationCategoriesTab'))
const RolesAndGroupsTab = lazy(() => import('../components/settings/RolesAndGroupsTab'))
const SupervisorChecklistTab = lazy(() => import('../components/settings/SupervisorChecklistTab'))
const CompanySettingsTab = lazy(() => import('../components/settings/CompanySettingsTab'))
const AgentShortcutsTab = lazy(() => import('../components/settings/AgentShortcutsTab'))
const UserManualTab = lazy(() => import('../components/settings/UserManualTab'))
const InspiringQuotesTab = lazy(() => import('../components/settings/InspiringQuotesTab'))
const GoldStandardTabs = lazy(() => import('../components/settings/GoldStandardTabs'))
const SystemPerformancePage = lazy(() => import('./SystemPerformancePage'))
const PermissionsPage = lazy(() => import('./PermissionsPage'))
const MeetingTypesPage = lazy(() => import('./MeetingTypesPage'))
const TablesTab = lazy(() => import('../components/settings/TablesTab'))
const SchemaPage = lazy(() => import('./SchemaPage'))
const GitBranchVisualization = lazy(() => import('../components/settings/GitBranchVisualization'))
const AgentStatus = lazy(() => import('../components/settings/AgentStatus'))
const SmGanttSetupTab = lazy(() => import('../components/sm-gantt/SmGanttSetupTab'))
const PriceBookSettingsTab = lazy(() => import('../components/settings/PriceBookSettingsTab'))

// Loading fallback component for lazy-loaded tabs
function TabLoadingFallback() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="text-gray-500 dark:text-gray-400">Loading...</div>
    </div>
  )
}

// Security Tab Component with nested sub-tabs
function SecurityTab() {
  return (
    <div className="px-4 sm:px-6 lg:px-8 py-10">
      <div className="max-w-4xl">
        <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-6">Security Settings</h2>

        <TabGroup>
          <TabList className="flex space-x-1 rounded-xl bg-indigo-900/20 p-1 mb-6">
            <Tab
              className={({ selected }) =>
                `w-full rounded-lg py-2.5 text-sm font-medium leading-5 transition-all
                ${
                  selected
                    ? 'bg-white dark:bg-gray-700 text-indigo-700 dark:text-indigo-400 shadow'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-white/[0.12] hover:text-gray-900 dark:hover:text-white'
                }`
              }
            >
              Users & Permissions
            </Tab>
            <Tab
              className={({ selected }) =>
                `w-full rounded-lg py-2.5 text-sm font-medium leading-5 transition-all
                ${
                  selected
                    ? 'bg-white dark:bg-gray-700 text-indigo-700 dark:text-indigo-400 shadow'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-white/[0.12] hover:text-gray-900 dark:hover:text-white'
                }`
              }
            >
              Permissions Management
            </Tab>
          </TabList>

          <TabPanels>
            {/* Users & Permissions Tab */}
            <TabPanel>
              <Suspense fallback={<TabLoadingFallback />}>
                <RolesAndGroupsTab />
              </Suspense>
            </TabPanel>

            {/* Permissions Management Tab */}
            <TabPanel>
              <div className="rounded-lg bg-white dark:bg-gray-800 shadow-sm ring-1 ring-gray-900/5 dark:ring-white/10 p-6">
                <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-4">Advanced Permissions</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                  Manage detailed permission settings and access controls for your organization.
                </p>
                <Link
                  to="/admin/system?tab=permissions"
                  className="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-3.5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
                >
                  Go to Permissions Tab
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                  </svg>
                </Link>
              </div>
            </TabPanel>
          </TabPanels>
        </TabGroup>
      </div>
    </div>
  )
}

// Developer Tools Tab Component with nested sub-tabs
function DeveloperToolsTab() {
  const location = useLocation()
  const navigate = useNavigate()

  // Map sub-tab names to indices
  const devSubTabs = ['tables', 'schema', 'branches', 'agents']

  // Get initial sub-tab index from URL query parameter
  const getInitialSubTabIndex = () => {
    const params = new URLSearchParams(location.search)
    const subtab = params.get('subtab')
    const index = devSubTabs.indexOf(subtab)
    return index >= 0 ? index : 0
  }

  const [selectedSubIndex, setSelectedSubIndex] = useState(getInitialSubTabIndex())

  // Update URL when sub-tab changes
  const handleSubTabChange = (index) => {
    setSelectedSubIndex(index)
    const params = new URLSearchParams(location.search)
    params.set('subtab', devSubTabs[index])
    navigate(`${location.pathname}?${params.toString()}`, { replace: true })
  }

  // Update selected sub-tab when URL changes
  useEffect(() => {
    const newIndex = getInitialSubTabIndex()
    if (newIndex !== selectedSubIndex) {
      setSelectedSubIndex(newIndex)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.search])

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6">
      <div>
        <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-4">Developer Tools</h2>

        <TabGroup selectedIndex={selectedSubIndex} onChange={handleSubTabChange}>
          <TabList className="flex space-x-1 rounded-xl bg-indigo-900/20 p-1 mb-6">
            <Tab
              className={({ selected }) =>
                `w-full rounded-lg py-2.5 text-sm font-medium leading-5 transition-all whitespace-nowrap
                ${
                  selected
                    ? 'bg-white dark:bg-gray-700 text-indigo-700 dark:text-indigo-400 shadow'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-white/[0.12] hover:text-gray-900 dark:hover:text-white'
                }`
              }
            >
              Database Tables
            </Tab>
            <Tab
              className={({ selected }) =>
                `w-full rounded-lg py-2.5 text-sm font-medium leading-5 transition-all whitespace-nowrap
                ${
                  selected
                    ? 'bg-white dark:bg-gray-700 text-indigo-700 dark:text-indigo-400 shadow'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-white/[0.12] hover:text-gray-900 dark:hover:text-white'
                }`
              }
            >
              Database Schema
            </Tab>
            <Tab
              className={({ selected }) =>
                `w-full rounded-lg py-2.5 text-sm font-medium leading-5 transition-all whitespace-nowrap
                ${
                  selected
                    ? 'bg-white dark:bg-gray-700 text-indigo-700 dark:text-indigo-400 shadow'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-white/[0.12] hover:text-gray-900 dark:hover:text-white'
                }`
              }
            >
              Git Branches
            </Tab>
            <Tab
              className={({ selected }) =>
                `w-full rounded-lg py-2.5 text-sm font-medium leading-5 transition-all whitespace-nowrap
                ${
                  selected
                    ? 'bg-white dark:bg-gray-700 text-indigo-700 dark:text-indigo-400 shadow'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-white/[0.12] hover:text-gray-900 dark:hover:text-white'
                }`
              }
            >
              Agent Status
            </Tab>
          </TabList>

          <TabPanels>
            {/* Database Tables Tab */}
            <TabPanel>
              <Suspense fallback={<TabLoadingFallback />}>
                <TablesTab />
              </Suspense>
            </TabPanel>

            {/* Database Schema Tab */}
            <TabPanel>
              <Suspense fallback={<TabLoadingFallback />}>
                <SchemaPage />
              </Suspense>
            </TabPanel>

            {/* Git Branches Tab */}
            <TabPanel>
              <Suspense fallback={<TabLoadingFallback />}>
                <GitBranchVisualization />
              </Suspense>
            </TabPanel>

            {/* Agent Status Tab */}
            <TabPanel>
              <Suspense fallback={<TabLoadingFallback />}>
                <AgentStatus />
              </Suspense>
            </TabPanel>
          </TabPanels>
        </TabGroup>
      </div>
    </div>
  )
}

// Company Tab Component - simply wraps CompanySettingsTab which already has Info and Holidays sub-tabs
// The CompanySettingsTab already has its own nested sub-tabs structure
function CompanyTab() {
  return (
    <Suspense fallback={<TabLoadingFallback />}>
      <CompanySettingsTab />
    </Suspense>
  )
}

export default function SettingsPage() {
  const navigate = useNavigate()
  const location = useLocation()

  // Map tab names to indices - REORGANIZED: 18 tabs (added pricebook)
  const tabs = [
    'company',
    'security',
    'schedule-master',
    'sm-gantt-v2',
    'meeting-types',
    'whs',
    'financial',
    'pricebook',
    'documentation',
    'supervisor-checklist',
    'gold-standard',
    'developer-tools',
    'claude-shortcuts',
    'user-manual',
    'inspiring-quotes',
    'performance',
    'permissions',
    'deployment'
  ]

  // Get initial tab index from URL query parameter
  const getInitialTabIndex = () => {
    const params = new URLSearchParams(location.search)
    const tab = params.get('tab')
    const index = tabs.indexOf(tab)
    return index >= 0 ? index : 0
  }

  const [selectedIndex, setSelectedIndex] = useState(getInitialTabIndex())
  const [isPullingData, setIsPullingData] = useState(false)
  const [pullStatus, setPullStatus] = useState(null)
  const [syncingType, setSyncingType] = useState(null) // Track which individual sync is in progress
  const [syncStatus, setSyncStatus] = useState({}) // Track status for each sync type

  // Update URL when tab changes
  const handleTabChange = (index) => {
    setSelectedIndex(index)
    const tabName = tabs[index]
    navigate(`/admin/system?tab=${tabName}`, { replace: true })
  }

  // Update selected tab when URL changes (e.g., browser back/forward)
  useEffect(() => {
    const newIndex = getInitialTabIndex()
    if (newIndex !== selectedIndex) {
      setSelectedIndex(newIndex)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.search])

  // Handle pull from local
  const handlePullFromLocal = async () => {
    if (!confirm('This will delete existing documentation categories, supervisor checklists, and schedule templates, and update/create users from your local development environment. Are you sure?')) {
      return
    }

    setIsPullingData(true)
    setPullStatus(null)

    try {
      const response = await api.post('/api/v1/setup/pull_from_local')
      setPullStatus({
        type: 'success',
        message: response.data.message,
        counts: response.data.counts
      })
    } catch (error) {
      console.error('Error pulling setup data:', error)
      setPullStatus({
        type: 'error',
        message: error?.response?.data?.error || error?.message || 'Failed to pull setup data from local'
      })
    } finally {
      setIsPullingData(false)
    }
  }

  // Handle individual sync
  const handleIndividualSync = async (type, endpoint, confirmMessage) => {
    if (!confirm(confirmMessage)) {
      return
    }

    setSyncingType(type)
    setSyncStatus(prev => ({ ...prev, [type]: null }))

    try {
      const response = await api.post(endpoint)
      setSyncStatus(prev => ({
        ...prev,
        [type]: {
          type: 'success',
          message: response.data.message,
          count: response.data.count || response.data.counts
        }
      }))
    } catch (error) {
      console.error(`Error syncing ${type}:`, error)
      setSyncStatus(prev => ({
        ...prev,
        [type]: {
          type: 'error',
          message: error?.response?.data?.error || error?.message || `Failed to sync ${type}`
        }
      }))
    } finally {
      setSyncingType(null)
    }
  }

  return (
    <main>
      <TabGroup selectedIndex={selectedIndex} onChange={handleTabChange}>
        <div className="mb-4">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">System Administration</h1>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            Configure system settings, integrations, and developer tools
          </p>
        </div>
        <div>
          <TabList className="flex flex-wrap gap-1 rounded-xl bg-gray-100 dark:bg-gray-800 p-1 w-full">
            <Tab
              className={({ selected }) =>
                `rounded-lg py-2 px-3 text-sm font-medium leading-5 transition-all whitespace-nowrap flex items-center gap-1.5
                ${
                  selected
                    ? 'bg-white dark:bg-gray-700 text-indigo-700 dark:text-indigo-400 shadow'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-white/[0.12] hover:text-gray-900 dark:hover:text-white'
                }`
              }
            >
              <BuildingOfficeIcon className="h-4 w-4" />
              Company
            </Tab>
            <Tab
              className={({ selected }) =>
                `rounded-lg py-2 px-3 text-sm font-medium leading-5 transition-all whitespace-nowrap flex items-center gap-1.5
                ${
                  selected
                    ? 'bg-white dark:bg-gray-700 text-indigo-700 dark:text-indigo-400 shadow'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-white/[0.12] hover:text-gray-900 dark:hover:text-white'
                }`
              }
            >
              <ShieldCheckIcon className="h-4 w-4" />
              Security
            </Tab>
            <Tab
              className={({ selected }) =>
                `rounded-lg py-2 px-3 text-sm font-medium leading-5 transition-all whitespace-nowrap flex items-center gap-1.5
                ${
                  selected
                    ? 'bg-white dark:bg-gray-700 text-indigo-700 dark:text-indigo-400 shadow'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-white/[0.12] hover:text-gray-900 dark:hover:text-white'
                }`
              }
            >
              <CalendarDaysIcon className="h-4 w-4" />
              Schedule Master
            </Tab>
            <Tab
              className={({ selected }) =>
                `rounded-lg py-2 px-3 text-sm font-medium leading-5 transition-all whitespace-nowrap flex items-center gap-1.5
                ${
                  selected
                    ? 'bg-white dark:bg-gray-700 text-indigo-700 dark:text-indigo-400 shadow'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-white/[0.12] hover:text-gray-900 dark:hover:text-white'
                }`
              }
            >
              <UserGroupIcon className="h-4 w-4" />
              SM Gantt v2
            </Tab>
            <Tab
              className={({ selected }) =>
                `rounded-lg py-2 px-3 text-sm font-medium leading-5 transition-all whitespace-nowrap flex items-center gap-1.5
                ${
                  selected
                    ? 'bg-white dark:bg-gray-700 text-indigo-700 dark:text-indigo-400 shadow'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-white/[0.12] hover:text-gray-900 dark:hover:text-white'
                }`
              }
            >
              <CalendarIcon className="h-4 w-4" />
              Meeting Types
            </Tab>
            <Tab
              className={({ selected }) =>
                `rounded-lg py-2 px-3 text-sm font-medium leading-5 transition-all whitespace-nowrap flex items-center gap-1.5
                ${
                  selected
                    ? 'bg-white dark:bg-gray-700 text-indigo-700 dark:text-indigo-400 shadow'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-white/[0.12] hover:text-gray-900 dark:hover:text-white'
                }`
              }
            >
              <ShieldCheckIcon className="h-4 w-4" />
              WHS
            </Tab>
            <Tab
              className={({ selected }) =>
                `rounded-lg py-2 px-3 text-sm font-medium leading-5 transition-all whitespace-nowrap flex items-center gap-1.5
                ${
                  selected
                    ? 'bg-white dark:bg-gray-700 text-indigo-700 dark:text-indigo-400 shadow'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-white/[0.12] hover:text-gray-900 dark:hover:text-white'
                }`
              }
            >
              <BanknotesIcon className="h-4 w-4" />
              Financial
            </Tab>
            <Tab
              className={({ selected }) =>
                `rounded-lg py-2 px-3 text-sm font-medium leading-5 transition-all whitespace-nowrap flex items-center gap-1.5
                ${
                  selected
                    ? 'bg-white dark:bg-gray-700 text-indigo-700 dark:text-indigo-400 shadow'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-white/[0.12] hover:text-gray-900 dark:hover:text-white'
                }`
              }
            >
              <CurrencyDollarIcon className="h-4 w-4" />
              Price Book
            </Tab>
            <Tab
              className={({ selected }) =>
                `rounded-lg py-2 px-3 text-sm font-medium leading-5 transition-all whitespace-nowrap flex items-center gap-1.5
                ${
                  selected
                    ? 'bg-white dark:bg-gray-700 text-indigo-700 dark:text-indigo-400 shadow'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-white/[0.12] hover:text-gray-900 dark:hover:text-white'
                }`
              }
            >
              <DocumentTextIcon className="h-4 w-4" />
              Documentation
            </Tab>
            <Tab
              className={({ selected }) =>
                `rounded-lg py-2 px-3 text-sm font-medium leading-5 transition-all whitespace-nowrap flex items-center gap-1.5
                ${
                  selected
                    ? 'bg-white dark:bg-gray-700 text-indigo-700 dark:text-indigo-400 shadow'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-white/[0.12] hover:text-gray-900 dark:hover:text-white'
                }`
              }
            >
              <ClipboardDocumentCheckIcon className="h-4 w-4" />
              Supervisor Checklist
            </Tab>
            <Tab
              className={({ selected }) =>
                `rounded-lg py-2 px-3 text-sm font-medium leading-5 transition-all whitespace-nowrap flex items-center gap-1.5
                ${
                  selected
                    ? 'bg-white dark:bg-gray-700 text-indigo-700 dark:text-indigo-400 shadow'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-white/[0.12] hover:text-gray-900 dark:hover:text-white'
                }`
              }
            >
              <StarIcon className="h-4 w-4" />
              Gold Standard View
            </Tab>
            <Tab
              className={({ selected }) =>
                `rounded-lg py-2 px-3 text-sm font-medium leading-5 transition-all whitespace-nowrap flex items-center gap-1.5
                ${
                  selected
                    ? 'bg-white dark:bg-gray-700 text-indigo-700 dark:text-indigo-400 shadow'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-white/[0.12] hover:text-gray-900 dark:hover:text-white'
                }`
              }
            >
              <WrenchScrewdriverIcon className="h-4 w-4" />
              Developer Tools
            </Tab>
            <Tab
              className={({ selected }) =>
                `rounded-lg py-2 px-3 text-sm font-medium leading-5 transition-all whitespace-nowrap flex items-center gap-1.5
                ${
                  selected
                    ? 'bg-white dark:bg-gray-700 text-indigo-700 dark:text-indigo-400 shadow'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-white/[0.12] hover:text-gray-900 dark:hover:text-white'
                }`
              }
            >
              <BoltIcon className="h-4 w-4" />
              Claude Shortcuts
            </Tab>
            <Tab
              className={({ selected }) =>
                `rounded-lg py-2 px-3 text-sm font-medium leading-5 transition-all whitespace-nowrap flex items-center gap-1.5
                ${
                  selected
                    ? 'bg-white dark:bg-gray-700 text-indigo-700 dark:text-indigo-400 shadow'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-white/[0.12] hover:text-gray-900 dark:hover:text-white'
                }`
              }
            >
              <BookOpenIcon className="h-4 w-4" />
              User Manual
            </Tab>
            <Tab
              className={({ selected }) =>
                `rounded-lg py-2 px-3 text-sm font-medium leading-5 transition-all whitespace-nowrap flex items-center gap-1.5
                ${
                  selected
                    ? 'bg-white dark:bg-gray-700 text-indigo-700 dark:text-indigo-400 shadow'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-white/[0.12] hover:text-gray-900 dark:hover:text-white'
                }`
              }
            >
              <SparklesIcon className="h-4 w-4" />
              Inspiring Quotes
            </Tab>
            <Tab
              className={({ selected }) =>
                `rounded-lg py-2 px-3 text-sm font-medium leading-5 transition-all whitespace-nowrap flex items-center gap-1.5
                ${
                  selected
                    ? 'bg-white dark:bg-gray-700 text-indigo-700 dark:text-indigo-400 shadow'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-white/[0.12] hover:text-gray-900 dark:hover:text-white'
                }`
              }
            >
              <ChartBarIcon className="h-4 w-4" />
              Performance
            </Tab>
            <Tab
              className={({ selected }) =>
                `rounded-lg py-2 px-3 text-sm font-medium leading-5 transition-all whitespace-nowrap flex items-center gap-1.5
                ${
                  selected
                    ? 'bg-white dark:bg-gray-700 text-indigo-700 dark:text-indigo-400 shadow'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-white/[0.12] hover:text-gray-900 dark:hover:text-white'
                }`
              }
            >
              <KeyIcon className="h-4 w-4" />
              Permissions
            </Tab>
            <Tab
              className={({ selected }) =>
                `rounded-lg py-2 px-3 text-sm font-medium leading-5 transition-all whitespace-nowrap flex items-center gap-1.5
                ${
                  selected
                    ? 'bg-white dark:bg-gray-700 text-indigo-700 dark:text-indigo-400 shadow'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-white/[0.12] hover:text-gray-900 dark:hover:text-white'
                }`
              }
            >
              <RocketLaunchIcon className="h-4 w-4" />
              Deployment
            </Tab>
          </TabList>
        </div>

        <TabPanels>
          {/* 1. Company Tab with nested sub-tabs */}
          <TabPanel>
            <Suspense fallback={<TabLoadingFallback />}>
              <CompanyTab />
            </Suspense>
          </TabPanel>

          {/* 2. Security Tab with nested sub-tabs */}
          <TabPanel>
            <Suspense fallback={<TabLoadingFallback />}>
              <SecurityTab />
            </Suspense>
          </TabPanel>

          {/* 3. Schedule Master Tab with nested sub-tabs */}
          <TabPanel>
            <Suspense fallback={<TabLoadingFallback />}>
              <ScheduleMasterTabs />
            </Suspense>
          </TabPanel>

          {/* 4. SM Gantt v2 Setup Tab */}
          <TabPanel>
            <Suspense fallback={<TabLoadingFallback />}>
              <SmGanttSetupTab />
            </Suspense>
          </TabPanel>

          {/* 5. Meeting Types Tab */}
          <TabPanel>
            <Suspense fallback={<TabLoadingFallback />}>
              <MeetingTypesPage />
            </Suspense>
          </TabPanel>

          {/* 5. WHS Tab */}
          <TabPanel>
            <div className="grid max-w-7xl grid-cols-1 gap-x-8 gap-y-10">
              <div>
                <h2 className="text-base font-semibold leading-7 text-gray-900 dark:text-white">
                  Workplace Health & Safety
                </h2>
                <p className="mt-1 text-sm leading-6 text-gray-600 dark:text-gray-400">
                  Configure WHS templates, settings, and compliance requirements for Queensland construction projects.
                </p>

                <dl className="mt-6 space-y-6 divide-y divide-gray-100 dark:divide-gray-700 border-t border-gray-200 dark:border-gray-700 text-sm leading-6">
                  <div className="pt-6">
                    <dt className="font-semibold text-gray-900 dark:text-white mb-3">WHS Modules</dt>
                    <dd className="space-y-2">
                      <Link
                        to="/whs/swms"
                        className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300"
                      >
                        <DocumentTextIcon className="h-5 w-5" />
                        SWMS Management
                      </Link>
                      <Link
                        to="/whs/inspections"
                        className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300"
                      >
                        <ClipboardDocumentCheckIcon className="h-5 w-5" />
                        Site Inspections & Templates
                      </Link>
                      <Link
                        to="/whs/incidents"
                        className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300"
                      >
                        <ExclamationTriangleIcon className="h-5 w-5" />
                        Incident Reporting
                      </Link>
                      <Link
                        to="/whs/inductions"
                        className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300"
                      >
                        <AcademicCapIcon className="h-5 w-5" />
                        Worker Inductions & Templates
                      </Link>
                      <Link
                        to="/whs/action-items"
                        className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300"
                      >
                        <CheckCircleIcon className="h-5 w-5" />
                        Action Items
                      </Link>
                    </dd>
                  </div>

                  <div className="pt-6">
                    <dt className="font-semibold text-gray-900 dark:text-white mb-3">WPHS Appointee</dt>
                    <dd className="text-gray-600 dark:text-gray-400">
                      <p className="mb-2">
                        The Workplace Health & Safety Appointee is responsible for approving SWMS,
                        investigating incidents, and managing compliance.
                      </p>
                      <p className="text-sm">
                        Configure WPHS Appointee permissions in the{' '}
                        <button
                          onClick={() => handleTabChange(tabs.indexOf('permissions'))}
                          className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 underline"
                        >
                          Permissions
                        </button>
                        {' '}tab.
                      </p>
                    </dd>
                  </div>

                  <div className="pt-6">
                    <dt className="font-semibold text-gray-900 dark:text-white mb-3">WorkCover Queensland</dt>
                    <dd className="text-gray-600 dark:text-gray-400">
                      <p>
                        Incidents marked as requiring WorkCover notification will track compliance
                        with Queensland workplace safety reporting requirements.
                      </p>
                    </dd>
                  </div>
                </dl>
              </div>
            </div>
          </TabPanel>

          {/* 6. Financial Tab */}
          <TabPanel>
            <div className="grid max-w-7xl grid-cols-1 gap-x-8 gap-y-10">
              <div>
                <h2 className="text-base font-semibold leading-7 text-gray-900 dark:text-white">
                  Financial Tracking & Reporting
                </h2>
                <p className="mt-1 text-sm leading-6 text-gray-600 dark:text-gray-400">
                  Track income and expenses, generate financial reports, and export data for your accountant.
                  Built on double-entry bookkeeping (Keepr gem) for accuracy.
                </p>

                <dl className="mt-6 space-y-6 divide-y divide-gray-100 dark:divide-gray-700 border-t border-gray-200 dark:border-gray-700 text-sm leading-6">
                  <div className="pt-6">
                    <dt className="font-semibold text-gray-900 dark:text-white mb-3">Financial Modules</dt>
                    <dd className="space-y-2">
                      <Link
                        to="/financial"
                        className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300"
                      >
                        <BanknotesIcon className="h-5 w-5" />
                        Transactions (Income & Expenses)
                      </Link>
                      <Link
                        to="/financial/reports"
                        className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300"
                      >
                        <ChartBarIcon className="h-5 w-5" />
                        Financial Reports (Balance Sheet, P&L, Job Profitability)
                      </Link>
                    </dd>
                  </div>

                  <div className="pt-6">
                    <dt className="font-semibold text-gray-900 dark:text-white mb-3">Chart of Accounts Setup</dt>
                    <dd className="text-gray-600 dark:text-gray-400">
                      <p className="mb-3">
                        The Chart of Accounts provides the foundation for double-entry bookkeeping.
                        You must set up your accounts before recording transactions.
                      </p>
                      <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg p-4">
                        <h4 className="font-semibold text-yellow-800 dark:text-yellow-200 mb-2">Setup Required</h4>
                        <p className="text-sm text-yellow-700 dark:text-yellow-300 mb-3">
                          Run this command in your backend terminal to create default accounts:
                        </p>
                        <code className="block bg-gray-900 text-green-400 p-3 rounded font-mono text-xs">
                          cd backend && bin/rails trapid:financial:setup_simple
                        </code>
                        <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-2">
                          This creates 20 essential accounts (Bank, Revenue, Expenses, etc.)
                        </p>
                      </div>
                    </dd>
                  </div>

                  <div className="pt-6">
                    <dt className="font-semibold text-gray-900 dark:text-white mb-3">Documentation</dt>
                    <dd className="text-gray-600 dark:text-gray-400 space-y-2">
                      <p>
                        See <code className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded text-xs">FINANCIAL_TRACKING_IMPLEMENTATION.md</code> for backend details
                      </p>
                      <p>
                        See <code className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded text-xs">FRONTEND_FINANCIAL_IMPLEMENTATION.md</code> for frontend details
                      </p>
                      <p>
                        See <code className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded text-xs">TESTING_GUIDE.md</code> for testing instructions
                      </p>
                    </dd>
                  </div>

                  <div className="pt-6">
                    <dt className="font-semibold text-gray-900 dark:text-white mb-3">Important Notes</dt>
                    <dd className="text-gray-600 dark:text-gray-400">
                      <ul className="list-disc list-inside space-y-1">
                        <li>This is for <strong>project financial tracking</strong>, not compliance-grade accounting</li>
                        <li>Always export to CSV for your accountant (built-in export functionality)</li>
                        <li>Transactions auto-post to Keepr journals for proper double-entry bookkeeping</li>
                        <li>All amounts are in AUD (Australian Dollars)</li>
                        <li>Receipt uploads supported (max 5MB)</li>
                      </ul>
                    </dd>
                  </div>
                </dl>
              </div>
            </div>
          </TabPanel>

          {/* 7. Price Book Settings Tab */}
          <TabPanel>
            <Suspense fallback={<TabLoadingFallback />}>
              <PriceBookSettingsTab />
            </Suspense>
          </TabPanel>

          {/* 8. Documentation Categories Tab */}
          <TabPanel>
            <Suspense fallback={<TabLoadingFallback />}>
              <DocumentationCategoriesTab />
            </Suspense>
          </TabPanel>

          {/* 7. Supervisor Checklist Tab */}
          <TabPanel>
            <Suspense fallback={<TabLoadingFallback />}>
              <SupervisorChecklistTab />
            </Suspense>
          </TabPanel>

          {/* 8. Gold Standard View Tab */}
          <TabPanel>
            <Suspense fallback={<TabLoadingFallback />}>
              <GoldStandardTabs />
            </Suspense>
          </TabPanel>

          {/* 9. Developer Tools Tab with nested sub-tabs */}
          <TabPanel>
            <Suspense fallback={<TabLoadingFallback />}>
              <DeveloperToolsTab />
            </Suspense>
          </TabPanel>

          {/* 10. Claude Shortcuts Tab */}
          <TabPanel>
            <Suspense fallback={<TabLoadingFallback />}>
              <AgentShortcutsTab />
            </Suspense>
          </TabPanel>

          {/* 11. User Manual Tab */}
          <TabPanel>
            <Suspense fallback={<TabLoadingFallback />}>
              <UserManualTab />
            </Suspense>
          </TabPanel>

          {/* 12. Inspiring Quotes Tab */}
          <TabPanel>
            <Suspense fallback={<TabLoadingFallback />}>
              <InspiringQuotesTab />
            </Suspense>
          </TabPanel>

          {/* 13. Performance Tab */}
          <TabPanel>
            <Suspense fallback={<TabLoadingFallback />}>
              <SystemPerformancePage />
            </Suspense>
          </TabPanel>

          {/* 14. Permissions Tab */}
          <TabPanel>
            <Suspense fallback={<TabLoadingFallback />}>
              <PermissionsPage />
            </Suspense>
          </TabPanel>

          {/* 15. Deployment Tab */}
          <TabPanel>
            <div className="grid max-w-7xl grid-cols-1 gap-x-8 gap-y-10 md:grid-cols-3">
              <div>
                <h2 className="text-base/7 font-semibold text-gray-900 dark:text-white">Deployment</h2>
                <p className="mt-1 text-sm/6 text-gray-500 dark:text-gray-400">
                  Manage your application deployments and view deployment status.
                </p>
              </div>

              <div className="md:col-span-2 space-y-6">
                {/* Setup Data Sync Card */}
                <div className="rounded-lg bg-white dark:bg-gray-800 shadow-sm ring-1 ring-gray-900/5 dark:ring-white/10">
                  <dl className="flex flex-wrap">
                    <div className="flex-auto pl-6 pt-6">
                      <dt className="text-sm/6 font-semibold text-gray-900 dark:text-white">Setup Data Sync</dt>
                      <dd className="mt-1 text-base/6 font-semibold text-gray-900 dark:text-white">Pull from Local</dd>
                    </div>
                    <div className="flex-none self-end px-6 pt-4">
                      <ArrowDownTrayIcon className="h-6 w-6 text-green-600 dark:text-green-400" />
                    </div>
                    <div className="mt-6 flex w-full flex-none gap-x-4 border-t border-gray-900/5 dark:border-white/10 px-6 pt-6">
                      <dt className="flex-none">
                        <span className="sr-only">Description</span>
                      </dt>
                      <dd className="text-sm/6 text-gray-500 dark:text-gray-400">
                        Sync setup data from your local development environment to staging. This will delete existing documentation categories, supervisor checklists, and schedule templates, and update/create users from local data.
                      </dd>
                    </div>
                    {pullStatus && (
                      <div className="mt-4 flex w-full flex-none gap-x-4 px-6">
                        <div className={`rounded-md p-4 w-full ${pullStatus.type === 'success' ? 'bg-green-50 dark:bg-green-900/20' : 'bg-red-50 dark:bg-red-900/20'}`}>
                          <div className="flex">
                            <div className="flex-shrink-0">
                              {pullStatus.type === 'success' ? (
                                <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                </svg>
                              ) : (
                                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                                </svg>
                              )}
                            </div>
                            <div className="ml-3">
                              <p className={`text-sm font-medium ${pullStatus.type === 'success' ? 'text-green-800 dark:text-green-200' : 'text-red-800 dark:text-red-200'}`}>
                                {pullStatus.message}
                              </p>
                              {pullStatus.counts && (
                                <div className="mt-2 text-sm text-green-700 dark:text-green-300">
                                  <ul className="list-disc list-inside space-y-1">
                                    <li>Users: {pullStatus.counts.users}</li>
                                    <li>Documentation Categories: {pullStatus.counts.documentation_categories}</li>
                                    <li>Supervisor Checklists: {pullStatus.counts.supervisor_checklist_templates}</li>
                                    <li>Schedule Templates: {pullStatus.counts.schedule_templates}</li>
                                    <li>Template Rows: {pullStatus.counts.schedule_template_rows}</li>
                                  </ul>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                    <div className="mt-4 flex w-full flex-none gap-x-4 px-6 pb-6">
                      <button
                        onClick={handlePullFromLocal}
                        disabled={isPullingData}
                        className="inline-flex items-center gap-2 rounded-md bg-green-600 px-3.5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-green-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-600 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isPullingData ? (
                          <>
                            <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Pulling Data...
                          </>
                        ) : (
                          <>
                            <ArrowDownTrayIcon className="h-4 w-4" />
                            Pull All Data
                          </>
                        )}
                      </button>
                    </div>
                  </dl>
                </div>

                {/* Individual Sync Cards */}
                <div className="rounded-lg bg-white dark:bg-gray-800 shadow-sm ring-1 ring-gray-900/5 dark:ring-white/10">
                  <div className="px-6 py-6">
                    <h3 className="text-sm/6 font-semibold text-gray-900 dark:text-white mb-4">Individual Data Sync</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                      Sync specific data types individually from your local development environment.
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Users Sync */}
                      <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <h4 className="text-sm font-medium text-gray-900 dark:text-white">Users</h4>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Update/create users</p>
                          </div>
                        </div>
                        {syncStatus.users && (
                          <div className={`mb-3 text-xs p-2 rounded ${syncStatus.users.type === 'success' ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300' : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300'}`}>
                            {syncStatus.users.message}
                            {syncStatus.users.count && <span className="ml-1 font-medium">({syncStatus.users.count})</span>}
                          </div>
                        )}
                        <button
                          onClick={() => handleIndividualSync('users', '/api/v1/setup/sync_users', 'This will update existing users and create new ones from local data. Continue?')}
                          disabled={syncingType === 'users'}
                          className="w-full inline-flex items-center justify-center gap-2 rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {syncingType === 'users' ? (
                            <>
                              <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                              </svg>
                              Syncing...
                            </>
                          ) : (
                            <>
                              <ArrowDownTrayIcon className="h-4 w-4" />
                              Sync Users
                            </>
                          )}
                        </button>
                      </div>

                      {/* Documentation Categories Sync */}
                      <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <h4 className="text-sm font-medium text-gray-900 dark:text-white">Documentation Categories</h4>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Replace all categories</p>
                          </div>
                        </div>
                        {syncStatus.documentation_categories && (
                          <div className={`mb-3 text-xs p-2 rounded ${syncStatus.documentation_categories.type === 'success' ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300' : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300'}`}>
                            {syncStatus.documentation_categories.message}
                            {syncStatus.documentation_categories.count && <span className="ml-1 font-medium">({syncStatus.documentation_categories.count})</span>}
                          </div>
                        )}
                        <button
                          onClick={() => handleIndividualSync('documentation_categories', '/api/v1/setup/sync_documentation_categories', 'This will DELETE all existing documentation categories and replace them with local data. Continue?')}
                          disabled={syncingType === 'documentation_categories'}
                          className="w-full inline-flex items-center justify-center gap-2 rounded-md bg-purple-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {syncingType === 'documentation_categories' ? (
                            <>
                              <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                              </svg>
                              Syncing...
                            </>
                          ) : (
                            <>
                              <ArrowDownTrayIcon className="h-4 w-4" />
                              Sync Categories
                            </>
                          )}
                        </button>
                      </div>

                      {/* Supervisor Checklists Sync */}
                      <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <h4 className="text-sm font-medium text-gray-900 dark:text-white">Supervisor Checklists</h4>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Replace all templates</p>
                          </div>
                        </div>
                        {syncStatus.supervisor_checklists && (
                          <div className={`mb-3 text-xs p-2 rounded ${syncStatus.supervisor_checklists.type === 'success' ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300' : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300'}`}>
                            {syncStatus.supervisor_checklists.message}
                            {syncStatus.supervisor_checklists.count && <span className="ml-1 font-medium">({syncStatus.supervisor_checklists.count})</span>}
                          </div>
                        )}
                        <button
                          onClick={() => handleIndividualSync('supervisor_checklists', '/api/v1/setup/sync_supervisor_checklists', 'This will DELETE all existing supervisor checklist templates and replace them with local data. Continue?')}
                          disabled={syncingType === 'supervisor_checklists'}
                          className="w-full inline-flex items-center justify-center gap-2 rounded-md bg-orange-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-orange-500 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {syncingType === 'supervisor_checklists' ? (
                            <>
                              <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                              </svg>
                              Syncing...
                            </>
                          ) : (
                            <>
                              <ArrowDownTrayIcon className="h-4 w-4" />
                              Sync Checklists
                            </>
                          )}
                        </button>
                      </div>

                      {/* Schedule Templates Sync */}
                      <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <h4 className="text-sm font-medium text-gray-900 dark:text-white">Schedule Templates</h4>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Replace all templates & rows</p>
                          </div>
                        </div>
                        {syncStatus.schedule_templates && (
                          <div className={`mb-3 text-xs p-2 rounded ${syncStatus.schedule_templates.type === 'success' ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300' : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300'}`}>
                            {syncStatus.schedule_templates.message}
                            {syncStatus.schedule_templates.count && (
                              <div className="mt-1">
                                {typeof syncStatus.schedule_templates.count === 'object' ? (
                                  <>Templates: {syncStatus.schedule_templates.count.templates}, Rows: {syncStatus.schedule_templates.count.rows}</>
                                ) : (
                                  <span className="ml-1 font-medium">({syncStatus.schedule_templates.count})</span>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                        <button
                          onClick={() => handleIndividualSync('schedule_templates', '/api/v1/setup/sync_schedule_templates', 'This will DELETE all existing schedule templates and rows and replace them with local data. Continue?')}
                          disabled={syncingType === 'schedule_templates'}
                          className="w-full inline-flex items-center justify-center gap-2 rounded-md bg-teal-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-teal-500 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {syncingType === 'schedule_templates' ? (
                            <>
                              <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                              </svg>
                              Syncing...
                            </>
                          ) : (
                            <>
                              <ArrowDownTrayIcon className="h-4 w-4" />
                              Sync Templates
                            </>
                          )}
                        </button>
                      </div>

                      {/* Folder Templates Sync */}
                      <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <h4 className="text-sm font-medium text-gray-900 dark:text-white">Folder Templates</h4>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Replace all templates & items</p>
                          </div>
                        </div>
                        {syncStatus.folder_templates && (
                          <div className={`mb-3 text-xs p-2 rounded ${syncStatus.folder_templates.type === 'success' ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300' : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300'}`}>
                            {syncStatus.folder_templates.message}
                            {syncStatus.folder_templates.count && (
                              <div className="mt-1">
                                {typeof syncStatus.folder_templates.count === 'object' ? (
                                  <>Templates: {syncStatus.folder_templates.count.templates}, Items: {syncStatus.folder_templates.count.items}</>
                                ) : (
                                  <span className="ml-1 font-medium">({syncStatus.folder_templates.count})</span>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                        <button
                          onClick={() => handleIndividualSync('folder_templates', '/api/v1/setup/sync_folder_templates', 'This will DELETE all existing folder templates and items and replace them with local data. Continue?')}
                          disabled={syncingType === 'folder_templates'}
                          className="w-full inline-flex items-center justify-center gap-2 rounded-md bg-yellow-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-yellow-500 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {syncingType === 'folder_templates' ? (
                            <>
                              <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                              </svg>
                              Syncing...
                            </>
                          ) : (
                            <>
                              <ArrowDownTrayIcon className="h-4 w-4" />
                              Sync Folder Templates
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Vercel Dashboard Card */}
                <div className="rounded-lg bg-white dark:bg-gray-800 shadow-sm ring-1 ring-gray-900/5 dark:ring-white/10">
                  <dl className="flex flex-wrap">
                    <div className="flex-auto pl-6 pt-6">
                      <dt className="text-sm/6 font-semibold text-gray-900 dark:text-white">Vercel Dashboard</dt>
                      <dd className="mt-1 text-base/6 font-semibold text-gray-900 dark:text-white">Frontend Deployment</dd>
                    </div>
                    <div className="flex-none self-end px-6 pt-4">
                      <RocketLaunchIcon className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
                    </div>
                    <div className="mt-6 flex w-full flex-none gap-x-4 border-t border-gray-900/5 dark:border-white/10 px-6 pt-6">
                      <dt className="flex-none">
                        <span className="sr-only">Status</span>
                      </dt>
                      <dd className="text-sm/6 text-gray-500 dark:text-gray-400">
                        View deployment status, build logs, and manage your frontend deployments on Vercel.
                      </dd>
                    </div>
                    <div className="mt-4 flex w-full flex-none gap-x-4 px-6 pb-6">
                      <a
                        href="https://vercel.com/abodable-dev/trapid"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-3.5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
                      >
                        Open Vercel Dashboard
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                        </svg>
                      </a>
                    </div>
                  </dl>
                </div>
              </div>
            </div>
          </TabPanel>
        </TabPanels>
      </TabGroup>
    </main>
  )
}
