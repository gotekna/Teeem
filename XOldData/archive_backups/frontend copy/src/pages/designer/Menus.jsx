import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronDownIcon, PlusIcon } from '@heroicons/react/20/solid'
import { api } from '../../api'

export default function Menus() {
  const [tables, setTables] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetchTables()
  }, [])

  const fetchTables = async () => {
    try {
      setLoading(true)
      const response = await api.get('/api/v1/tables')
      // Add is_live property to each table (defaults to false)
      const tablesWithLiveStatus = (response.tables || []).map(table => ({
        ...table,
        is_live: table.is_live || false
      }))
      setTables(tablesWithLiveStatus)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const toggleLiveStatus = async (tableId, currentStatus) => {
    // Optimistically update the UI
    setTables(tables.map(table =>
      table.id === tableId ? { ...table, is_live: !currentStatus } : table
    ))

    try {
      // Update via API
      await api.patch(`/api/v1/tables/${tableId}`, {
        table: { is_live: !currentStatus }
      })
    } catch (err) {
      console.error('Error toggling live status:', err)
      // Revert on error
      fetchTables()
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500 dark:text-gray-400">Loading menus...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <div className="rounded-md bg-yellow-50 dark:bg-yellow-900/10 p-4 mb-6 max-w-lg mx-auto">
          <div className="text-sm text-yellow-800 dark:text-yellow-400">
            <p className="font-medium">Could not connect to backend</p>
            <p className="mt-1 text-xs">{error}</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="px-4 sm:px-6 lg:px-8">
      <div className="sm:flex sm:items-center">
        <div className="sm:flex-auto">
          <h1 className="text-base font-semibold text-gray-900 dark:text-white">Menus</h1>
          <p className="mt-2 text-sm text-gray-700 dark:text-gray-300">
            Manage which tables appear as menus in your application. Toggle the live status to show or hide them.
          </p>
        </div>
        <div className="mt-4 sm:ml-16 sm:mt-0 sm:flex-none">
          <Link
            to="/designer"
            className="block rounded-md bg-indigo-600 px-3 py-2 text-center text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 dark:bg-indigo-500 dark:hover:bg-indigo-400 dark:focus-visible:outline-indigo-500"
          >
            Add table
          </Link>
        </div>
      </div>

      {tables.length === 0 ? (
        <div className="text-center py-12">
          <svg
            className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 6h16M4 12h16M4 18h16"
            />
          </svg>
          <h3 className="mt-2 text-sm font-semibold text-gray-900 dark:text-white">No tables</h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Create a table first to add it as a menu.
          </p>
          <div className="mt-6">
            <Link
              to="/designer"
              className="inline-flex items-center gap-x-2 rounded-md bg-indigo-600 px-3.5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 dark:bg-indigo-500 dark:shadow-none dark:hover:bg-indigo-400 dark:focus-visible:outline-indigo-500"
            >
              <PlusIcon className="h-5 w-5" />
              Create Your First Table
            </Link>
          </div>
        </div>
      ) : (
        <div className="mt-8 flow-root">
          <div className="-mx-4 -my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
            <div className="inline-block min-w-full py-2 align-middle sm:px-6 lg:px-8">
              <table className="relative min-w-full divide-y divide-gray-300 dark:divide-white/15">
                <thead>
                  <tr>
                    <th
                      scope="col"
                      className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-0 dark:text-white"
                    >
                      <a href="#" className="group inline-flex">
                        Name
                        <span className="invisible ml-2 flex-none rounded text-gray-400 group-hover:visible group-focus:visible dark:text-gray-500">
                          <ChevronDownIcon aria-hidden="true" className="size-5" />
                        </span>
                      </a>
                    </th>
                    <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-white">
                      Columns
                    </th>
                    <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-white">
                      Records
                    </th>
                    <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-white">
                      Status
                    </th>
                    <th scope="col" className="py-3.5 pl-3 pr-4 sm:pr-0">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white dark:divide-white/10 dark:bg-gray-900">
                  {tables.map((table) => (
                    <tr key={table.id}>
                      <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-0 dark:text-white">
                        {table.name}
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-400">
                        {table.columns?.length || 0} columns
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-400">
                        {table.record_count || 0} records
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm">
                        <button
                          onClick={() => toggleLiveStatus(table.id, table.is_live)}
                          className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:ring-offset-2 dark:focus:ring-offset-gray-900 ${
                            table.is_live ? 'bg-indigo-600 dark:bg-indigo-500' : 'bg-gray-200 dark:bg-gray-700'
                          }`}
                          role="switch"
                          aria-checked={table.is_live}
                          aria-label={`Toggle live status for ${table.name}`}
                        >
                          <span
                            className={`inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                              table.is_live ? 'translate-x-5' : 'translate-x-0'
                            }`}
                          />
                        </button>
                        <span className="ml-3 text-sm text-gray-500 dark:text-gray-400">
                          {table.is_live ? 'Live' : 'Hidden'}
                        </span>
                      </td>
                      <td className="whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm sm:pr-0">
                        <Link
                          to={`/designer/tables/${table.id}`}
                          className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300"
                        >
                          Edit<span className="sr-only">, {table.name}</span>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
