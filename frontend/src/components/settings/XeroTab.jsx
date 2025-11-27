import { lazy, Suspense } from 'react'
import { Tab, TabGroup, TabList, TabPanel, TabPanels } from '@headlessui/react'

const XeroConnection = lazy(() => import('./XeroConnection'))
const XeroFieldMappingTab = lazy(() => import('./XeroFieldMappingTab'))
const SyncConfigPage = lazy(() => import('../../pages/SyncConfigPage'))

export default function XeroTab() {
  return (
    <div>
      <TabGroup>
        <TabList className="flex space-x-1 rounded-xl bg-purple-900/20 p-1 mb-6">
          <Tab
            className={({ selected }) =>
              `rounded-lg py-2.5 px-4 text-sm font-medium leading-5 transition-all whitespace-nowrap
              ${
                selected
                  ? 'bg-white dark:bg-gray-700 text-purple-700 dark:text-purple-400 shadow'
                  : 'text-gray-700 dark:text-gray-300 hover:bg-white/[0.12] hover:text-gray-900 dark:hover:text-white'
              }`
            }
          >
            Connection
          </Tab>
          <Tab
            className={({ selected }) =>
              `rounded-lg py-2.5 px-4 text-sm font-medium leading-5 transition-all whitespace-nowrap
              ${
                selected
                  ? 'bg-white dark:bg-gray-700 text-purple-700 dark:text-purple-400 shadow'
                  : 'text-gray-700 dark:text-gray-300 hover:bg-white/[0.12] hover:text-gray-900 dark:hover:text-white'
              }`
            }
          >
            Field Mapping
          </Tab>
          <Tab
            className={({ selected }) =>
              `rounded-lg py-2.5 px-4 text-sm font-medium leading-5 transition-all whitespace-nowrap
              ${
                selected
                  ? 'bg-white dark:bg-gray-700 text-purple-700 dark:text-purple-400 shadow'
                  : 'text-gray-700 dark:text-gray-300 hover:bg-white/[0.12] hover:text-gray-900 dark:hover:text-white'
              }`
            }
          >
            Contact Sync
          </Tab>
        </TabList>

        <TabPanels>
          <TabPanel>
            <Suspense fallback={<div className="flex items-center justify-center h-64"><div className="text-gray-500 dark:text-gray-400">Loading...</div></div>}>
              <XeroConnection />
            </Suspense>
          </TabPanel>

          <TabPanel>
            <Suspense fallback={<div className="flex items-center justify-center h-64"><div className="text-gray-500 dark:text-gray-400">Loading...</div></div>}>
              <XeroFieldMappingTab />
            </Suspense>
          </TabPanel>

          <TabPanel>
            <Suspense fallback={<div className="flex items-center justify-center h-64"><div className="text-gray-500 dark:text-gray-400">Loading...</div></div>}>
              <SyncConfigPage embedded={true} />
            </Suspense>
          </TabPanel>
        </TabPanels>
      </TabGroup>
    </div>
  )
}
