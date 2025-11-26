import { useState, useMemo } from 'react'
import { ChevronUpIcon, ChevronDownIcon } from '@heroicons/react/24/outline'

/**
 * DataTable - Standard table component for TEEEM
 *
 * This is THE standard table component for all data tables in TEEEM.
 * It follows Tailwind UI Application UI patterns with full dark mode support,
 * sortable columns, and responsive design.
 *
 * @example
 * ```jsx
 * <DataTable
 *   title="Users"
 *   description="A list of all users in your account"
 *   data={users}
 *   columns={[
 *     {
 *       key: 'name',
 *       label: 'Name',
 *       sortable: true,
 *       render: (user) => (
 *         <div className="flex items-center">
 *           <img src={user.avatar} className="h-11 w-11 rounded-full" />
 *           <div className="ml-4">
 *             <div className="font-medium text-gray-900 dark:text-white">{user.name}</div>
 *             <div className="mt-1 text-gray-500 dark:text-gray-400">{user.email}</div>
 *           </div>
 *         </div>
 *       )
 *     },
 *     {
 *       key: 'status',
 *       label: 'Status',
 *       sortable: true,
 *       render: (user) => (
 *         <span className="inline-flex items-center rounded-md bg-green-50 px-2 py-1 text-xs font-medium text-green-700 ring-1 ring-inset ring-green-600/20 dark:bg-green-900/30 dark:text-green-400 dark:ring-green-500/50">
 *           {user.status}
 *         </span>
 *       )
 *     }
 *   ]}
 *   actionButton={{
 *     label: 'Add user',
 *     onClick: () => console.log('Add user')
 *   }}
 *   onRowClick={(user) => console.log('Clicked', user)}
 * />
 * ```
 */
export default function DataTable({
  // Header props
  title,
  description,
  actionButton,

  // Data props
  data = [],
  columns = [],

  // Row props
  onRowClick,
  rowClassName,

  // Empty state props
  emptyStateTitle = 'No data',
  emptyStateDescription = 'Get started by adding a new record.',
  emptyStateAction,

  // Table props
  className = '',
  loading = false,

  // Default sort config
  defaultSortKey,
  defaultSortDirection = 'asc',
}) {
  const [sortConfig, setSortConfig] = useState({
    key: defaultSortKey || null,
    direction: defaultSortDirection,
  })

  // Sort data based on current sort configuration
  const sortedData = useMemo(() => {
    if (!sortConfig.key) return data

    const sorted = [...data].sort((a, b) => {
      const column = columns.find(col => col.key === sortConfig.key)

      // Use custom sort function if provided
      if (column?.sortFn) {
        return column.sortFn(a, b, sortConfig.direction)
      }

      // Get values to compare
      let aValue = column?.getValue ? column.getValue(a) : a[sortConfig.key]
      let bValue = column?.getValue ? column.getValue(b) : b[sortConfig.key]

      // Handle null/undefined values
      if (aValue == null && bValue == null) return 0
      if (aValue == null) return 1
      if (bValue == null) return -1

      // Handle dates
      if (aValue instanceof Date && bValue instanceof Date) {
        aValue = aValue.getTime()
        bValue = bValue.getTime()
      }

      // Handle strings (case-insensitive)
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        aValue = aValue.toLowerCase()
        bValue = bValue.toLowerCase()
      }

      // Compare values
      if (aValue < bValue) {
        return sortConfig.direction === 'asc' ? -1 : 1
      }
      if (aValue > bValue) {
        return sortConfig.direction === 'asc' ? 1 : -1
      }
      return 0
    })

    return sorted
  }, [data, sortConfig, columns])

  // Handle sort click
  const handleSort = (columnKey) => {
    const column = columns.find(col => col.key === columnKey)
    if (!column?.sortable) return

    setSortConfig(prevConfig => {
      // If clicking the same column, cycle through: asc -> desc -> none
      if (prevConfig.key === columnKey) {
        if (prevConfig.direction === 'asc') {
          return { key: columnKey, direction: 'desc' }
        } else if (prevConfig.direction === 'desc') {
          return { key: null, direction: 'asc' }
        }
      }
      // If clicking a different column, start with asc
      return { key: columnKey, direction: 'asc' }
    })
  }

  // Loading state
  if (loading) {
    return (
      <div className={`px-4 sm:px-6 lg:px-8 ${className}`}>
        {(title || actionButton) && (
          <div className="sm:flex sm:items-center">
            {title && (
              <div className="sm:flex-auto">
                <h1 className="text-base font-semibold text-gray-900 dark:text-white">{title}</h1>
                {description && (
                  <p className="mt-2 text-sm text-gray-700 dark:text-gray-300">
                    {description}
                  </p>
                )}
              </div>
            )}
          </div>
        )}
        <div className="mt-8 flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 dark:border-indigo-400 mx-auto"></div>
            <p className="mt-4 text-gray-600 dark:text-gray-400">Loading...</p>
          </div>
        </div>
      </div>
    )
  }

  // Empty state
  if (data.length === 0) {
    return (
      <div className={`px-4 sm:px-6 lg:px-8 ${className}`}>
        {(title || actionButton) && (
          <div className="sm:flex sm:items-center">
            {title && (
              <div className="sm:flex-auto">
                <h1 className="text-base font-semibold text-gray-900 dark:text-white">{title}</h1>
                {description && (
                  <p className="mt-2 text-sm text-gray-700 dark:text-gray-300">
                    {description}
                  </p>
                )}
              </div>
            )}
            {actionButton && (
              <div className="mt-4 sm:ml-16 sm:mt-0 sm:flex-none">
                <button
                  type="button"
                  onClick={actionButton.onClick}
                  className="block rounded-md bg-indigo-600 px-3 py-2 text-center text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 dark:bg-indigo-500 dark:hover:bg-indigo-400 dark:focus-visible:outline-indigo-500"
                >
                  {actionButton.label}
                </button>
              </div>
            )}
          </div>
        )}
        <div className="mt-8 text-center py-12">
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
              d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z"
            />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">{emptyStateTitle}</h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{emptyStateDescription}</p>
          {emptyStateAction && (
            <div className="mt-6">
              <button
                type="button"
                onClick={emptyStateAction.onClick}
                className="inline-flex items-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 dark:bg-indigo-500 dark:hover:bg-indigo-400"
              >
                {emptyStateAction.label}
              </button>
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className={`px-4 sm:px-6 lg:px-8 ${className}`}>
      {/* Header Section */}
      {(title || actionButton) && (
        <div className="sm:flex sm:items-center">
          {title && (
            <div className="sm:flex-auto">
              <h1 className="text-base font-semibold text-gray-900 dark:text-white">{title}</h1>
              {description && (
                <p className="mt-2 text-sm text-gray-700 dark:text-gray-300">
                  {description}
                </p>
              )}
            </div>
          )}
          {actionButton && (
            <div className="mt-4 sm:ml-16 sm:mt-0 sm:flex-none">
              <button
                type="button"
                onClick={actionButton.onClick}
                className="block rounded-md bg-indigo-600 px-3 py-2 text-center text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 dark:bg-indigo-500 dark:hover:bg-indigo-400 dark:focus-visible:outline-indigo-500"
              >
                {actionButton.label}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Table */}
      <div className="mt-8 flex-1 overflow-auto bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700" style={{
        scrollbarWidth: 'thin',
        scrollbarColor: '#9CA3AF #E5E7EB'
      }}>
        <table className="min-w-full divide-y divide-gray-300 dark:divide-white/15">
          {/* Table Header */}
          <thead className="bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 sticky top-0 z-10">
                <tr>
                  {columns.map((column) => {
                    const isSorted = sortConfig.key === column.key
                    const isAsc = isSorted && sortConfig.direction === 'asc'
                    const isDesc = isSorted && sortConfig.direction === 'desc'
                    const isSortable = column.sortable !== false

                    return (
                      <th
                        key={column.key}
                        scope="col"
                        onClick={() => isSortable && handleSort(column.key)}
                        className={`py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-white ${
                          column.headerClassName || ''
                        } ${
                          column.key === columns[0].key
                            ? 'pl-4 pr-3 sm:pl-0'
                            : column.key === columns[columns.length - 1].key
                            ? 'pl-3 pr-4 sm:pr-0'
                            : 'px-3'
                        } ${
                          isSortable
                            ? 'cursor-pointer select-none hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors'
                            : ''
                        }`}
                      >
                        <div className="flex items-center gap-2 group">
                          <span>{column.label}</span>
                          {isSortable && (
                            <span className="relative w-4 h-4 flex items-center justify-center">
                              {!isSorted && (
                                <div className="opacity-0 group-hover:opacity-40 transition-opacity flex flex-col items-center justify-center">
                                  <ChevronUpIcon className="h-3 w-3 text-gray-400 -mb-1" />
                                  <ChevronDownIcon className="h-3 w-3 text-gray-400 -mt-1" />
                                </div>
                              )}
                              {isAsc && (
                                <ChevronUpIcon className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                              )}
                              {isDesc && (
                                <ChevronDownIcon className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                              )}
                            </span>
                          )}
                        </div>
                      </th>
                    )
                  })}
                </tr>
              </thead>

              {/* Table Body */}
              <tbody className="divide-y divide-gray-200 bg-white dark:divide-white/10 dark:bg-gray-900">
                {sortedData.map((row, rowIndex) => (
                  <tr
                    key={row.id || rowIndex}
                    onClick={() => onRowClick?.(row)}
                    className={`${
                      onRowClick ? 'cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50' : ''
                    } ${
                      typeof rowClassName === 'function' ? rowClassName(row) : rowClassName || ''
                    }`}
                  >
                    {columns.map((column) => (
                      <td
                        key={column.key}
                        className={`whitespace-nowrap py-5 text-sm ${
                          column.cellClassName || ''
                        } ${
                          column.key === columns[0].key
                            ? 'pl-4 pr-3 sm:pl-0'
                            : column.key === columns[columns.length - 1].key
                            ? 'pl-3 pr-4 text-right sm:pr-0'
                            : 'px-3'
                        } ${
                          column.align === 'right'
                            ? 'text-right'
                            : column.align === 'center'
                            ? 'text-center'
                            : 'text-left'
                        }`}
                      >
                        {column.render
                          ? column.render(row, rowIndex)
                          : row[column.key] != null
                          ? String(row[column.key])
                          : '-'}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
      </div>
    </div>
  )
}
