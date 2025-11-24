import { useState } from 'react'
import { PlusIcon, PencilIcon, TrashIcon } from '@heroicons/react/24/outline'
import ColumnForm from './ColumnForm'

export default function ColumnManager({ table, onUpdate }) {
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingColumn, setEditingColumn] = useState(null)

  const columnTypes = {
    single_line_text: 'Text',
    multiple_lines_text: 'Long Text',
    email: 'Email',
    number: 'Number',
    whole_number: 'Whole Number',
    currency: 'Currency',
    percentage: 'Percentage',
    date: 'Date',
    date_and_time: 'Date & Time',
    boolean: 'Yes/No',
    lookup: 'Lookup',
    choice: 'Choice',
  }

  const handleAddColumn = () => {
    setEditingColumn(null)
    setIsFormOpen(true)
  }

  const handleEditColumn = (column) => {
    setEditingColumn(column)
    setIsFormOpen(true)
  }

  const handleFormClose = () => {
    setIsFormOpen(false)
    setEditingColumn(null)
    onUpdate()
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Columns</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Manage the fields in this table
          </p>
        </div>
        <button
          onClick={handleAddColumn}
          className="inline-flex items-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500"
        >
          <PlusIcon className="h-4 w-4 mr-1" />
          Add Column
        </button>
      </div>

      {/* Columns List */}
      {!table.columns || table.columns.length === 0 ? (
        <div className="text-center py-12 border border-gray-200 dark:border-white/10 rounded-lg">
          <p className="text-sm text-gray-500 dark:text-gray-400">No columns yet</p>
          <button
            onClick={handleAddColumn}
            className="mt-4 inline-flex items-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 dark:bg-white/5 dark:text-white dark:ring-white/10 dark:hover:bg-white/10"
          >
            <PlusIcon className="h-4 w-4 mr-1" />
            Add First Column
          </button>
        </div>
      ) : (
        <div className="overflow-hidden bg-white shadow-sm ring-1 ring-gray-900/5 sm:rounded-lg dark:bg-white/5 dark:ring-white/10">
          <table className="min-w-full divide-y divide-gray-300 dark:divide-white/10">
            <thead className="bg-gray-50 dark:bg-white/5">
              <tr>
                <th className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 dark:text-white sm:pl-6">
                  Name
                </th>
                <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-white">
                  Type
                </th>
                <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-white">
                  Required
                </th>
                <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-white">
                  Searchable
                </th>
                <th className="relative py-3.5 pl-3 pr-4 sm:pr-6">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-white/10 bg-white dark:bg-transparent">
              {table.columns.map((column) => (
                <tr key={column.id}>
                  <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 dark:text-white sm:pl-6">
                    {column.name}
                    {column.is_title && (
                      <span className="ml-2 inline-flex items-center rounded-md bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-700/10 dark:bg-blue-400/10 dark:text-blue-400 dark:ring-blue-400/30">
                        Title
                      </span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-400">
                    {columnTypes[column.column_type] || column.column_type}
                  </td>
                  <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-400">
                    {column.required ? (
                      <span className="inline-flex items-center rounded-md bg-green-50 px-2 py-1 text-xs font-medium text-green-700 ring-1 ring-inset ring-green-600/20 dark:bg-green-500/10 dark:text-green-400 dark:ring-green-500/20">
                        Yes
                      </span>
                    ) : (
                      <span className="text-gray-400">No</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-400">
                    {column.searchable ? 'Yes' : 'No'}
                  </td>
                  <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                    <button
                      onClick={() => handleEditColumn(column)}
                      className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300 mr-4"
                    >
                      <PencilIcon className="h-4 w-4 inline" />
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(`Delete column "${column.name}"? This will delete all data in this column.`)) {
                          // TODO: Implement delete
                        }
                      }}
                      className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                    >
                      <TrashIcon className="h-4 w-4 inline" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Column Form Modal */}
      {isFormOpen && (
        <ColumnForm
          table={table}
          column={editingColumn}
          onClose={handleFormClose}
        />
      )}
    </div>
  )
}
