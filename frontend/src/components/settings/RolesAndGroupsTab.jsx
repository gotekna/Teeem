import { useState, useEffect } from 'react'
import { Tab, TabGroup, TabList, TabPanel, TabPanels } from '@headlessui/react'
import { useSearchParams } from 'react-router-dom'
import UserManagementTab from './UserManagementTab'
import RolesManagement from './RolesManagement'
import GroupsManagement from './GroupsManagement'
import ContactRolesManagement from './ContactRolesManagement'

// Map tab index to table ID for URL sync
const TAB_TABLE_IDS = {
  0: 212,  // Users
  1: 413,  // User Roles
  2: 364,  // Groups
  3: 211   // Contact Roles
}

export default function RolesAndGroupsTab() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [selectedIndex, setSelectedIndex] = useState(() => {
    // Initialize from URL foundationId if present
    const foundationId = searchParams.get('foundationId')
    if (foundationId) {
      const index = Object.entries(TAB_TABLE_IDS).find(([_, id]) => id === parseInt(foundationId))?.[0]
      return index ? parseInt(index) : 0
    }
    return 0
  })

  // Update URL when tab changes
  const handleTabChange = (index) => {
    setSelectedIndex(index)
    const foundationId = TAB_TABLE_IDS[index]
    setSearchParams(prev => {
      const newParams = new URLSearchParams(prev)
      newParams.set('foundationId', foundationId.toString())
      return newParams
    })
  }

  // Set initial foundationId in URL if not present
  useEffect(() => {
    if (!searchParams.get('foundationId')) {
      const foundationId = TAB_TABLE_IDS[selectedIndex]
      setSearchParams(prev => {
        const newParams = new URLSearchParams(prev)
        newParams.set('foundationId', foundationId.toString())
        return newParams
      })
    }
  }, [])

  return (
    <TabGroup selectedIndex={selectedIndex} onChange={handleTabChange}>
      <TabList className="flex space-x-1 rounded-xl bg-gray-100 dark:bg-gray-800 p-1 mb-6">
        <Tab
          className={({ selected }) =>
            `w-full rounded-lg py-2.5 px-4 text-sm font-medium leading-5 transition-all
            ${
              selected
                ? 'bg-white dark:bg-gray-700 text-indigo-700 dark:text-indigo-400 shadow'
                : 'text-gray-700 dark:text-gray-300 hover:bg-white/[0.12] hover:text-gray-900 dark:hover:text-white'
            }`
          }
        >
          Users
        </Tab>
        <Tab
          className={({ selected }) =>
            `w-full rounded-lg py-2.5 px-4 text-sm font-medium leading-5 transition-all
            ${
              selected
                ? 'bg-white dark:bg-gray-700 text-indigo-700 dark:text-indigo-400 shadow'
                : 'text-gray-700 dark:text-gray-300 hover:bg-white/[0.12] hover:text-gray-900 dark:hover:text-white'
            }`
          }
        >
          User Roles
        </Tab>
        <Tab
          className={({ selected }) =>
            `w-full rounded-lg py-2.5 px-4 text-sm font-medium leading-5 transition-all
            ${
              selected
                ? 'bg-white dark:bg-gray-700 text-indigo-700 dark:text-indigo-400 shadow'
                : 'text-gray-700 dark:text-gray-300 hover:bg-white/[0.12] hover:text-gray-900 dark:hover:text-white'
            }`
          }
        >
          Groups
        </Tab>
        <Tab
          className={({ selected }) =>
            `w-full rounded-lg py-2.5 px-4 text-sm font-medium leading-5 transition-all
            ${
              selected
                ? 'bg-white dark:bg-gray-700 text-indigo-700 dark:text-indigo-400 shadow'
                : 'text-gray-700 dark:text-gray-300 hover:bg-white/[0.12] hover:text-gray-900 dark:hover:text-white'
            }`
          }
        >
          Contact Roles
        </Tab>
      </TabList>

      <TabPanels>
        <TabPanel>
          <UserManagementTab />
        </TabPanel>
        <TabPanel>
          <RolesManagement />
        </TabPanel>
        <TabPanel>
          <GroupsManagement />
        </TabPanel>
        <TabPanel>
          <ContactRolesManagement />
        </TabPanel>
      </TabPanels>
    </TabGroup>
  )
}
