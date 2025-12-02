import { useState, useEffect, lazy, Suspense } from 'react'
import { Tab, TabGroup, TabList, TabPanel, TabPanels } from '@headlessui/react'
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowTopRightOnSquareIcon, ShieldCheckIcon, KeyIcon } from '@heroicons/react/24/outline'
import { api } from '../../api'
import PublicHolidaysPage from '../../pages/PublicHolidaysPage'
import { setCompanySettings } from '../../utils/timezoneUtils'

// Lazy load integration components
const OneDriveConnection = lazy(() => import('./OneDriveConnection'))
const OutlookConnection = lazy(() => import('./OutlookConnection'))
const TwilioConfiguration = lazy(() => import('./TwilioConfiguration'))

// Lazy load operational setup tabs
const XeroTab = lazy(() => import('./XeroTab'))
const ContactRolesManagement = lazy(() => import('./ContactRolesManagement'))
const WorkflowAdminPage = lazy(() => import('../../pages/WorkflowAdminPage'))
const FolderTemplatesTab = lazy(() => import('./FolderTemplatesTab'))
const CompaniesPage = lazy(() => import('../../pages/CompaniesPage'))
const RolesAndGroupsTab = lazy(() => import('./RolesAndGroupsTab'))
const PermissionsPage = lazy(() => import('../../pages/PermissionsPage'))
const JobSetupTab = lazy(() => import('./JobSetupTab'))
const DependencyConfigTab = lazy(() => import('./DependencyConfigTab'))
const DocumentationCategoriesTab = lazy(() => import('./DocumentationCategoriesTab'))

const TIMEZONES = [
  { value: 'Australia/Brisbane', label: 'Brisbane (AEST/AEDT)' },
  { value: 'Australia/Sydney', label: 'Sydney (AEST/AEDT)' },
  { value: 'Australia/Melbourne', label: 'Melbourne (AEST/AEDT)' },
  { value: 'Australia/Perth', label: 'Perth (AWST)' },
  { value: 'Australia/Adelaide', label: 'Adelaide (ACST/ACDT)' },
  { value: 'Australia/Darwin', label: 'Darwin (ACST)' },
  { value: 'Australia/Hobart', label: 'Hobart (AEST/AEDT)' },
  { value: 'Pacific/Auckland', label: 'Auckland (NZST/NZDT)' },
  { value: 'America/New_York', label: 'New York (EST/EDT)' },
  { value: 'America/Los_Angeles', label: 'Los Angeles (PST/PDT)' },
  { value: 'Europe/London', label: 'London (GMT/BST)' },
  { value: 'UTC', label: 'UTC' }
]

const TAB_NAMES = [
  'info',
  'security',
  'permissions',
  'corporate',
  'holidays',
  'connections',
  'xero',
  'contact-roles',
  'workflows',
  'folders',
  'job-setup',
  'workflow-config',
  'doc-setup'
]

export default function CompanySettingsTab() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [selectedTabIndex, setSelectedTabIndex] = useState(() => {
    const subtab = searchParams.get('subtab')
    const index = TAB_NAMES.indexOf(subtab)
    return index >= 0 ? index : 0
  })

  const [settings, setSettings] = useState({
    company_name: '',
    abn: '',
    email: '',
    phone: '',
    address: '',
    timezone: 'Australia/Brisbane',
    working_days: {
      monday: true,
      tuesday: true,
      wednesday: true,
      thursday: true,
      friday: true,
      saturday: false,
      sunday: false
    }
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState(null)

  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    try {
      const response = await api.get('/api/v1/company_settings')
      const loadedSettings = response.data || response
      setSettings(loadedSettings)
      // Initialize timezone utilities with company settings
      setCompanySettings(loadedSettings)
    } catch (error) {
      console.debug('Company settings unavailable:', error?.message || 'Unknown error')
      setMessage({ type: 'error', text: 'Failed to load settings' })
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setMessage(null)

    try {
      await api.put('/api/v1/company_settings', {
        company_setting: settings
      })
      // Update timezone utilities with new settings
      setCompanySettings(settings)
      setMessage({ type: 'success', text: 'Settings saved successfully!' })
    } catch (error) {
      console.error('Failed to save settings:', error)
      setMessage({ type: 'error', text: error?.response?.data?.error || 'Failed to save settings' })
    } finally {
      setSaving(false)
    }
  }

  const handleChange = (field, value) => {
    setSettings(prev => ({ ...prev, [field]: value }))
  }

  const handleTabChange = (index) => {
    setSelectedTabIndex(index)
    const tabName = TAB_NAMES[index]
    setSearchParams({ tab: 'company', subtab: tabName })
  }

  if (loading) {
    return (
      <div>
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]" />
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Loading settings...</p>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">Company Settings</h2>
          <Link
            to="/corporate"
            className="inline-flex items-center gap-1.5 text-sm text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300"
          >
            Go to Corporate Dashboard
            <ArrowTopRightOnSquareIcon className="h-4 w-4" />
          </Link>
        </div>

        <TabGroup selectedIndex={selectedTabIndex} onChange={handleTabChange}>
          <TabList className="flex space-x-1 rounded-xl bg-indigo-900/20 p-1 mb-6 overflow-x-auto">
            <Tab
              className={({ selected }) =>
                `rounded-lg py-2.5 px-3 text-sm font-medium leading-5 transition-all whitespace-nowrap
                ${
                  selected
                    ? 'bg-white dark:bg-gray-700 text-indigo-700 dark:text-indigo-400 shadow'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-white/[0.12] hover:text-gray-900 dark:hover:text-white'
                }`
              }
            >
              Info
            </Tab>
            <Tab
              className={({ selected }) =>
                `rounded-lg py-2.5 px-3 text-sm font-medium leading-5 transition-all whitespace-nowrap
                ${
                  selected
                    ? 'bg-white dark:bg-gray-700 text-indigo-700 dark:text-indigo-400 shadow'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-white/[0.12] hover:text-gray-900 dark:hover:text-white'
                }`
              }
            >
              Security
            </Tab>
            <Tab
              className={({ selected }) =>
                `rounded-lg py-2.5 px-3 text-sm font-medium leading-5 transition-all whitespace-nowrap
                ${
                  selected
                    ? 'bg-white dark:bg-gray-700 text-indigo-700 dark:text-indigo-400 shadow'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-white/[0.12] hover:text-gray-900 dark:hover:text-white'
                }`
              }
            >
              Permissions
            </Tab>
            <Tab
              className={({ selected }) =>
                `rounded-lg py-2.5 px-3 text-sm font-medium leading-5 transition-all whitespace-nowrap
                ${
                  selected
                    ? 'bg-white dark:bg-gray-700 text-indigo-700 dark:text-indigo-400 shadow'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-white/[0.12] hover:text-gray-900 dark:hover:text-white'
                }`
              }
            >
              Corporate
            </Tab>
            <Tab
              className={({ selected }) =>
                `rounded-lg py-2.5 px-3 text-sm font-medium leading-5 transition-all whitespace-nowrap
                ${
                  selected
                    ? 'bg-white dark:bg-gray-700 text-indigo-700 dark:text-indigo-400 shadow'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-white/[0.12] hover:text-gray-900 dark:hover:text-white'
                }`
              }
            >
              Holidays
            </Tab>
            <Tab
              className={({ selected }) =>
                `rounded-lg py-2.5 px-3 text-sm font-medium leading-5 transition-all whitespace-nowrap
                ${
                  selected
                    ? 'bg-white dark:bg-gray-700 text-indigo-700 dark:text-indigo-400 shadow'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-white/[0.12] hover:text-gray-900 dark:hover:text-white'
                }`
              }
            >
              Connections
            </Tab>
            <Tab
              className={({ selected }) =>
                `rounded-lg py-2.5 px-3 text-sm font-medium leading-5 transition-all whitespace-nowrap
                ${
                  selected
                    ? 'bg-white dark:bg-gray-700 text-indigo-700 dark:text-indigo-400 shadow'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-white/[0.12] hover:text-gray-900 dark:hover:text-white'
                }`
              }
            >
              Xero
            </Tab>
            <Tab
              className={({ selected }) =>
                `rounded-lg py-2.5 px-3 text-sm font-medium leading-5 transition-all whitespace-nowrap
                ${
                  selected
                    ? 'bg-white dark:bg-gray-700 text-indigo-700 dark:text-indigo-400 shadow'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-white/[0.12] hover:text-gray-900 dark:hover:text-white'
                }`
              }
            >
              Contact Roles
            </Tab>
            <Tab
              className={({ selected }) =>
                `rounded-lg py-2.5 px-3 text-sm font-medium leading-5 transition-all whitespace-nowrap
                ${
                  selected
                    ? 'bg-white dark:bg-gray-700 text-indigo-700 dark:text-indigo-400 shadow'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-white/[0.12] hover:text-gray-900 dark:hover:text-white'
                }`
              }
            >
              Workflows
            </Tab>
            <Tab
              className={({ selected }) =>
                `rounded-lg py-2.5 px-3 text-sm font-medium leading-5 transition-all whitespace-nowrap
                ${
                  selected
                    ? 'bg-white dark:bg-gray-700 text-indigo-700 dark:text-indigo-400 shadow'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-white/[0.12] hover:text-gray-900 dark:hover:text-white'
                }`
              }
            >
              Folders
            </Tab>
            <Tab
              className={({ selected }) =>
                `rounded-lg py-2.5 px-3 text-sm font-medium leading-5 transition-all whitespace-nowrap
                ${
                  selected
                    ? 'bg-white dark:bg-gray-700 text-indigo-700 dark:text-indigo-400 shadow'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-white/[0.12] hover:text-gray-900 dark:hover:text-white'
                }`
              }
            >
              Job Setup
            </Tab>
            <Tab
              className={({ selected }) =>
                `rounded-lg py-2.5 px-3 text-sm font-medium leading-5 transition-all whitespace-nowrap
                ${
                  selected
                    ? 'bg-white dark:bg-gray-700 text-indigo-700 dark:text-indigo-400 shadow'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-white/[0.12] hover:text-gray-900 dark:hover:text-white'
                }`
              }
            >
              Workflow Config
            </Tab>
            <Tab
              className={({ selected }) =>
                `rounded-lg py-2.5 px-3 text-sm font-medium leading-5 transition-all whitespace-nowrap
                ${
                  selected
                    ? 'bg-white dark:bg-gray-700 text-indigo-700 dark:text-indigo-400 shadow'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-white/[0.12] hover:text-gray-900 dark:hover:text-white'
                }`
              }
            >
              Doc Setup
            </Tab>
          </TabList>

          <TabPanels>
            {/* Company Info Tab */}
            <TabPanel>
              {message && (
          <div
            className={`mb-6 rounded-md p-4 ${
              message.type === 'success'
                ? 'bg-green-50 dark:bg-green-900/10'
                : 'bg-red-50 dark:bg-red-900/10'
            }`}
          >
            <p
              className={`text-sm ${
                message.type === 'success'
                  ? 'text-green-800 dark:text-green-400'
                  : 'text-red-800 dark:text-red-400'
              }`}
            >
              {message.text}
            </p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Company Name */}
          <div>
            <label htmlFor="company_name" className="block text-sm font-medium text-gray-900 dark:text-white">
              Company Name
            </label>
            <input
              type="text"
              id="company_name"
              value={settings.company_name || ''}
              onChange={(e) => handleChange('company_name', e.target.value)}
              className="mt-2 block w-full rounded-md border-0 px-3 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6 dark:bg-white/5 dark:text-white dark:ring-white/10"
            />
          </div>

          {/* ABN */}
          <div>
            <label htmlFor="abn" className="block text-sm font-medium text-gray-900 dark:text-white">
              ABN
            </label>
            <input
              type="text"
              id="abn"
              value={settings.abn || ''}
              onChange={(e) => handleChange('abn', e.target.value)}
              className="mt-2 block w-full rounded-md border-0 px-3 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6 dark:bg-white/5 dark:text-white dark:ring-white/10"
            />
          </div>

          {/* Timezone */}
          <div>
            <label htmlFor="timezone" className="block text-sm font-medium text-gray-900 dark:text-white">
              Timezone
            </label>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              This timezone will be used for calculating working days, displaying dates, and scheduling tasks.
            </p>
            <select
              id="timezone"
              value={settings.timezone || 'Australia/Brisbane'}
              onChange={(e) => handleChange('timezone', e.target.value)}
              className="mt-2 block w-full rounded-md border-0 px-3 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6 dark:bg-white/5 dark:text-white dark:ring-white/10"
            >
              {TIMEZONES.map(tz => (
                <option key={tz.value} value={tz.value}>
                  {tz.label}
                </option>
              ))}
            </select>
          </div>

          {/* Working Days */}
          <div>
            <label className="block text-sm font-medium text-gray-900 dark:text-white">
              Working Days
            </label>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Select which days are considered working days. Tasks will be scheduled only on selected days (unless locked).
              Holidays are managed in the Holidays tab above.
            </p>
            <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3">
              {['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].map((day) => (
                <label key={day} className="relative flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.working_days?.[day] ?? true}
                    onChange={(e) => {
                      const newWorkingDays = { ...settings.working_days, [day]: e.target.checked }
                      handleChange('working_days', newWorkingDays)
                    }}
                    className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-600 dark:border-gray-600 dark:bg-gray-700"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300 capitalize">{day}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Email */}
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-900 dark:text-white">
              Email
            </label>
            <input
              type="email"
              id="email"
              value={settings.email || ''}
              onChange={(e) => handleChange('email', e.target.value)}
              className="mt-2 block w-full rounded-md border-0 px-3 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6 dark:bg-white/5 dark:text-white dark:ring-white/10"
            />
          </div>

          {/* Phone */}
          <div>
            <label htmlFor="phone" className="block text-sm font-medium text-gray-900 dark:text-white">
              Phone
            </label>
            <input
              type="tel"
              id="phone"
              value={settings.phone || ''}
              onChange={(e) => handleChange('phone', e.target.value)}
              className="mt-2 block w-full rounded-md border-0 px-3 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6 dark:bg-white/5 dark:text-white dark:ring-white/10"
            />
          </div>

          {/* Address */}
          <div>
            <label htmlFor="address" className="block text-sm font-medium text-gray-900 dark:text-white">
              Address
            </label>
            <textarea
              id="address"
              rows={3}
              value={settings.address || ''}
              onChange={(e) => handleChange('address', e.target.value)}
              className="mt-2 block w-full rounded-md border-0 px-3 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6 dark:bg-white/5 dark:text-white dark:ring-white/10"
            />
          </div>

          {/* Save Button */}
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        </form>
            </TabPanel>

            {/* Security Tab */}
            <TabPanel>
              <Suspense fallback={<div className="flex items-center justify-center h-64"><div className="text-gray-500 dark:text-gray-400">Loading...</div></div>}>
                <RolesAndGroupsTab />
              </Suspense>
            </TabPanel>

            {/* Permissions Tab */}
            <TabPanel>
              <Suspense fallback={<div className="flex items-center justify-center h-64"><div className="text-gray-500 dark:text-gray-400">Loading...</div></div>}>
                <PermissionsPage />
              </Suspense>
            </TabPanel>

            {/* Corporate Tab */}
            <TabPanel>
              <Suspense fallback={<div className="flex items-center justify-center h-64"><div className="text-gray-500 dark:text-gray-400">Loading...</div></div>}>
                <CompaniesPage />
              </Suspense>
            </TabPanel>

            {/* Holidays Tab */}
            <TabPanel>
              <PublicHolidaysPage />
            </TabPanel>

            {/* Connections Tab */}
            <TabPanel>
              <div className="space-y-6">
                <Suspense fallback={<div className="flex items-center justify-center h-64"><div className="text-gray-500 dark:text-gray-400">Loading...</div></div>}>
                  <OutlookConnection />
                  <OneDriveConnection />
                  <TwilioConfiguration />
                </Suspense>
              </div>
            </TabPanel>

            {/* Xero Tab */}
            <TabPanel>
              <Suspense fallback={<div className="flex items-center justify-center h-64"><div className="text-gray-500 dark:text-gray-400">Loading...</div></div>}>
                <XeroTab />
              </Suspense>
            </TabPanel>

            {/* Contact Roles Tab */}
            <TabPanel>
              <Suspense fallback={<div className="flex items-center justify-center h-64"><div className="text-gray-500 dark:text-gray-400">Loading...</div></div>}>
                <ContactRolesManagement />
              </Suspense>
            </TabPanel>

            {/* Workflows Tab */}
            <TabPanel>
              <Suspense fallback={<div className="flex items-center justify-center h-64"><div className="text-gray-500 dark:text-gray-400">Loading...</div></div>}>
                <WorkflowAdminPage />
              </Suspense>
            </TabPanel>

            {/* Folder Templates Tab */}
            <TabPanel>
              <Suspense fallback={<div className="flex items-center justify-center h-64"><div className="text-gray-500 dark:text-gray-400">Loading...</div></div>}>
                <FolderTemplatesTab />
              </Suspense>
            </TabPanel>

            {/* Job Setup Tab */}
            <TabPanel>
              <Suspense fallback={<div className="flex items-center justify-center h-64"><div className="text-gray-500 dark:text-gray-400">Loading...</div></div>}>
                <JobSetupTab />
              </Suspense>
            </TabPanel>

            {/* Workflow Config Tab */}
            <TabPanel>
              <Suspense fallback={<div className="flex items-center justify-center h-64"><div className="text-gray-500 dark:text-gray-400">Loading...</div></div>}>
                <DependencyConfigTab />
              </Suspense>
            </TabPanel>

            {/* Doc Setup Tab */}
            <TabPanel>
              <Suspense fallback={<div className="flex items-center justify-center h-64"><div className="text-gray-500 dark:text-gray-400">Loading...</div></div>}>
                <DocumentationCategoriesTab />
              </Suspense>
            </TabPanel>
          </TabPanels>
        </TabGroup>
      </div>
    </div>
  )
}
