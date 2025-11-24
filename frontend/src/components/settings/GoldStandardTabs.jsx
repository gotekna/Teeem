import { Tab, TabGroup, TabList, TabPanel, TabPanels } from '@headlessui/react'
import GoldStandardTableTab from './GoldStandardTableTab'
import ColumnInfoTab from './ColumnInfoTab'
import GoldTableSyncCheckTab from './GoldTableSyncCheckTab'

export default function GoldStandardTabs() {
  return (
    <div className="px-4 sm:px-6 lg:px-8 py-10">
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
            Gold Standard Table
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
            Column Info
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
            Sync Check
          </Tab>
        </TabList>

        <TabPanels>
          {/* Gold Standard Table Tab */}
          <TabPanel>
            <GoldStandardTableTab />
          </TabPanel>

          {/* Column Info Tab */}
          <TabPanel>
            <ColumnInfoTab />
          </TabPanel>

          {/* Gold Table Sync Check Tab */}
          <TabPanel>
            <GoldTableSyncCheckTab />
          </TabPanel>
        </TabPanels>
      </TabGroup>
    </div>
  )
}
