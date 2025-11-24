import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { PlusIcon } from '@heroicons/react/24/outline'
import { EllipsisVerticalIcon } from '@heroicons/react/20/solid'
import { Menu, MenuButton, MenuItem, MenuItems } from '@headlessui/react'
import { api } from '../../api'
import CreateTableModal from '../../components/designer/CreateTableModal'
import DeleteTableModal from '../../components/designer/DeleteTableModal'

export default function DesignerHome() {
  const [tables, setTables] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [deleteModal, setDeleteModal] = useState({ isOpen: false, tableId: null, tableName: '' })
  const [isDeleting, setIsDeleting] = useState(false)

  useEffect(() => {
    fetchTables()
  }, [])

  const fetchTables = async () => {
    try {
      setLoading(true)
      const response = await api.get('/api/v1/tables')
      setTables(response.tables || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const openDeleteModal = (tableId, tableName) => {
    setDeleteModal({ isOpen: true, tableId, tableName })
  }

  const closeDeleteModal = () => {
    if (!isDeleting) {
      setDeleteModal({ isOpen: false, tableId: null, tableName: '' })
    }
  }

  const confirmDelete = async () => {
    setIsDeleting(true)

    try {
      await api.delete(`/api/v1/tables/${deleteModal.tableId}`)
      setDeleteModal({ isOpen: false, tableId: null, tableName: '' })
      fetchTables() // Refresh the list
    } catch (err) {
      alert(`Error deleting table: ${err.message}`)
    } finally {
      setIsDeleting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500 dark:text-gray-400">Loading tables...</div>
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
        <div className="text-gray-600 dark:text-gray-400 mb-6">
          <p>You can still create a table - it will be saved once the connection is restored.</p>
        </div>
        <button
          type="button"
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center gap-x-2 rounded-md bg-indigo-600 px-3.5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 dark:bg-indigo-500 dark:shadow-none dark:hover:bg-indigo-400"
        >
          <PlusIcon className="h-5 w-5" />
          Create Table Anyway
        </button>
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Designer</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Manage your table structures and columns
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center gap-x-2 rounded-md bg-indigo-600 px-3.5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 dark:bg-indigo-500 dark:shadow-none dark:hover:bg-indigo-400"
        >
          <PlusIcon className="h-5 w-5" />
          Create Table
        </button>
      </div>

      {/* Tables List */}
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
              d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
            />
          </svg>
          <h3 className="mt-2 text-sm font-semibold text-gray-900 dark:text-white">No tables</h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Get started by creating a new table.</p>
          <div className="mt-6">
            <button
              type="button"
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center gap-x-2 rounded-md bg-indigo-600 px-3.5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 dark:bg-indigo-500 dark:shadow-none dark:hover:bg-indigo-400 dark:focus-visible:outline-indigo-500"
            >
              <PlusIcon className="h-5 w-5" />
              Create Your First Table
            </button>
          </div>
        </div>
      ) : (
        <ul role="list" className="divide-y divide-gray-100 dark:divide-white/5">
          {tables.map((table) => (
            <li key={table.id} className="flex items-center justify-between gap-x-6 py-5">
              <div className="min-w-0">
                <div className="flex items-start gap-x-3">
                  <p className="text-sm/6 font-semibold text-gray-900 dark:text-white">
                    {table.name}
                  </p>
                  {table.record_count > 0 ? (
                    <p className="mt-0.5 rounded-md bg-green-50 px-1.5 py-0.5 text-xs font-medium text-green-700 ring-1 ring-inset ring-green-600/20 dark:bg-green-400/10 dark:text-green-400 dark:ring-green-500/20">
                      {table.record_count} records
                    </p>
                  ) : (
                    <p className="mt-0.5 rounded-md bg-gray-50 px-1.5 py-0.5 text-xs font-medium text-gray-600 ring-1 ring-inset ring-gray-500/10 dark:bg-gray-400/10 dark:text-gray-400 dark:ring-gray-400/20">
                      Empty
                    </p>
                  )}
                </div>
                <div className="mt-1 flex items-center gap-x-2 text-xs/5 text-gray-500 dark:text-gray-400">
                  <p className="whitespace-nowrap">
                    {table.columns?.length || 0} columns
                  </p>
                  {table.description && (
                    <>
                      <svg viewBox="0 0 2 2" className="size-0.5 fill-current">
                        <circle r={1} cx={1} cy={1} />
                      </svg>
                      <p className="truncate">{table.description}</p>
                    </>
                  )}
                </div>
              </div>
              <div className="flex flex-none items-center gap-x-4">
                <Link
                  to={`/tables/${table.id}`}
                  className="hidden rounded-md bg-white px-2.5 py-1.5 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 sm:block dark:bg-white/10 dark:text-white dark:shadow-none dark:ring-white/5 dark:hover:bg-white/20"
                >
                  View table<span className="sr-only">, {table.name}</span>
                </Link>
                <Menu as="div" className="relative flex-none">
                  <MenuButton className="relative block text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white">
                    <span className="absolute -inset-2.5" />
                    <span className="sr-only">Open options</span>
                    <EllipsisVerticalIcon aria-hidden="true" className="size-5" />
                  </MenuButton>
                  <MenuItems
                    transition
                    className="absolute right-0 z-10 mt-2 w-32 origin-top-right rounded-md bg-white py-2 shadow-lg outline outline-1 outline-gray-900/5 transition data-[closed]:scale-95 data-[closed]:transform data-[closed]:opacity-0 data-[enter]:duration-100 data-[leave]:duration-75 data-[enter]:ease-out data-[leave]:ease-in dark:bg-gray-800 dark:shadow-none dark:-outline-offset-1 dark:outline-white/10"
                  >
                    <MenuItem>
                      <Link
                        to={`/designer/tables/${table.id}`}
                        className="block px-3 py-1 text-sm/6 text-gray-900 data-[focus]:bg-gray-50 data-[focus]:outline-none dark:text-white dark:data-[focus]:bg-white/5"
                      >
                        Edit<span className="sr-only">, {table.name}</span>
                      </Link>
                    </MenuItem>
                    <MenuItem>
                      <Link
                        to={`/tables/${table.id}`}
                        className="block px-3 py-1 text-sm/6 text-gray-900 data-[focus]:bg-gray-50 data-[focus]:outline-none dark:text-white dark:data-[focus]:bg-white/5"
                      >
                        View Data<span className="sr-only">, {table.name}</span>
                      </Link>
                    </MenuItem>
                    <MenuItem>
                      <button
                        onClick={() => openDeleteModal(table.id, table.name)}
                        className="block w-full text-left px-3 py-1 text-sm/6 text-red-600 data-[focus]:bg-gray-50 data-[focus]:outline-none dark:text-red-400 dark:data-[focus]:bg-white/5"
                      >
                        Delete<span className="sr-only">, {table.name}</span>
                      </button>
                    </MenuItem>
                  </MenuItems>
                </Menu>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Create Table Modal */}
      <CreateTableModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
      />

      {/* Delete Table Modal */}
      <DeleteTableModal
        isOpen={deleteModal.isOpen}
        onClose={closeDeleteModal}
        onConfirm={confirmDelete}
        tableName={deleteModal.tableName}
        isDeleting={isDeleting}
      />
    </div>
  )
}
