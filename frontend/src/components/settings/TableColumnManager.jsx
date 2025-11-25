import { useState, useEffect } from 'react'
import { api } from '../../api'
import {
  XMarkIcon,
  PlusIcon,
  PencilIcon,
  TrashIcon,
  CheckIcon,
} from '@heroicons/react/24/outline'
import AddColumnModal from '../table/AddColumnModal'
import { EDITABLE_COLUMN_TYPES } from '../../constants/columnTypes'

export default function TableColumnManager({ table, onClose, onUpdate }) {
  const [columns, setColumns] = useState([])
  const [loading, setLoading] = useState(true)
  const [editingColumn, setEditingColumn] = useState(null)
  const [editingName, setEditingName] = useState('')
  const [editingType, setEditingType] = useState('')
  const [editingRequired, setEditingRequired] = useState(false)
  const [saving, setSaving] = useState(false)
  const [showAddModal, setShowAddModal] = useState(false)

  useEffect(() => {
    if (table) {
      loadColumns()
    }
  }, [table])

  const loadColumns = async () => {
    try {
      setLoading(true)
      const response = await api.get(`/api/v1/tables/${table.id}`)
      setColumns(response.table.columns || [])
    } catch (err) {
      console.error('Failed to load columns:', err)
      alert('Failed to load columns')
    } finally {
      setLoading(false)
    }
  }

  const handleStartEdit = (column) => {
    setEditingColumn(column.id)
    setEditingName(column.name)
    setEditingType(column.column_type)
    setEditingRequired(column.required || false)
  }

  const handleCancelEdit = () => {
    setEditingColumn(null)
    setEditingName('')
    setEditingType('')
    setEditingRequired(false)
  }

  const handleSaveEdit = async (columnId) => {
    if (!editingName.trim()) {
      alert('Column name is required')
      return
    }

    try {
      setSaving(true)

      // Optimistic update - update UI immediately
      const updatedColumns = columns.map(col =>
        col.id === columnId
          ? { ...col, name: editingName.trim(), column_type: editingType, required: editingRequired }
          : col
      )
      setColumns(updatedColumns)
      setEditingColumn(null)
      setEditingName('')
      setEditingType('')
      setEditingRequired(false)

      // Then update on server
      const response = await api.put(`/api/v1/tables/${table.id}/columns/${columnId}`, {
        column: {
          name: editingName.trim(),
          column_type: editingType,
          required: editingRequired
        }
      })

      if (response.success) {
        if (onUpdate) onUpdate()
      } else {
        // Revert on failure
        await loadColumns()
        alert('Failed to update column')
      }
    } catch (err) {
      console.error('Failed to update column:', err)
      // Revert on error
      await loadColumns()
      alert(err.message || 'Failed to update column')
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteColumn = async (column) => {
    if (!confirm(`Are you sure you want to delete the column "${column.name}"? This cannot be undone.`)) {
      return
    }

    try {
      const response = await api.delete(`/api/v1/tables/${table.id}/columns/${column.id}`)

      if (response.success) {
        // Remove from UI after successful delete
        setColumns(columns.filter(col => col.id !== column.id))
        if (onUpdate) onUpdate()
      } else {
        alert(response.errors?.join(', ') || 'Failed to delete column')
      }
    } catch (err) {
      console.error('Failed to delete column:', err)

      // Check if deletion was blocked due to references
      if (err.response?.blocked && err.response?.references) {
        const refMessages = err.response.references.map(r => `• ${r.message}`).join('\n')
        alert(
          `Cannot delete "${column.name}" because it is referenced by:\n\n${refMessages}\n\n` +
          `Please remove these references first before deleting this column.`
        )
        return
      }

      alert(err.message || 'Failed to delete column')
    }
  }

  const handleAddColumn = async (columnData) => {
    try {
      const response = await api.post(`/api/v1/tables/${table.id}/columns`, {
        column: columnData
      })

      if (response.success) {
        await loadColumns()
        setShowAddModal(false)
        if (onUpdate) onUpdate()
      }
    } catch (err) {
      console.error('Failed to add column:', err)
      alert(err.message || 'Failed to add column')
    }
  }

  const getColumnTypeLabel = (type) => {
    const typeObj = EDITABLE_COLUMN_TYPES.find(t => t.value === type)
    return typeObj ? typeObj.label : type
  }

  return (
    <>
      <div className="fixed inset-0 z-50 overflow-y-auto" onClick={onClose}>
        <div className="flex min-h-screen items-center justify-center p-4">
          {/* Backdrop */}
          <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity dark:bg-gray-900 dark:bg-opacity-80" />

          {/* Modal */}
          <div
            className="relative transform overflow-hidden rounded-lg bg-white dark:bg-gray-800 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-4xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="bg-white dark:bg-gray-800 px-6 pt-6 pb-4 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Manage Columns - {table.name}
                  </h3>
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    Add, edit, or remove columns from this table
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowAddModal(true)}
                    className="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500"
                  >
                    <PlusIcon className="h-4 w-4" />
                    Add Column
                  </button>
                  <button
                    onClick={onClose}
                    className="rounded-md text-gray-400 hover:text-gray-500 focus:outline-none dark:hover:text-gray-300"
                  >
                    <XMarkIcon className="h-6 w-6" />
                  </button>
                </div>
              </div>
            </div>

            {/* Body */}
            <div className="px-6 py-4 max-h-[60vh] overflow-y-auto">
              {loading ? (
                <div className="flex justify-center items-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                </div>
              ) : columns.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    No columns yet. Add your first column to get started.
                  </p>
                </div>
              ) : (
                <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 sm:rounded-lg">
                  <table className="min-w-full divide-y divide-gray-300 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-900">
                      <tr>
                        <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 dark:text-white sm:pl-6">
                          Column Name
                        </th>
                        <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-white">
                          Database Name
                        </th>
                        <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-white">
                          Type
                        </th>
                        <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-white">
                          Required
                        </th>
                        <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-6">
                          <span className="sr-only">Actions</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-gray-800">
                      {columns.map((column) => (
                        <tr key={column.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                          <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm sm:pl-6">
                            {editingColumn === column.id ? (
                              <input
                                type="text"
                                value={editingName}
                                onChange={(e) => setEditingName(e.target.value)}
                                className="block w-full rounded-md bg-white px-3 py-1.5 text-sm text-gray-900 outline outline-1 -outline-offset-1 outline-gray-300 focus:outline-2 focus:outline-indigo-600 dark:bg-gray-700 dark:text-white dark:outline-gray-600"
                                autoFocus
                              />
                            ) : (
                              <div className="font-medium text-gray-900 dark:text-white">
                                {column.name}
                              </div>
                            )}
                          </td>
                          <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-400">
                            <code className="text-xs bg-gray-100 dark:bg-gray-900 px-2 py-1 rounded">
                              {column.column_name}
                            </code>
                          </td>
                          <td className="whitespace-nowrap px-3 py-4 text-sm">
                            {editingColumn === column.id ? (
                              <select
                                value={editingType}
                                onChange={(e) => setEditingType(e.target.value)}
                                className="block w-full rounded-md bg-white px-3 py-1.5 text-sm text-gray-900 outline outline-1 -outline-offset-1 outline-gray-300 focus:outline-2 focus:outline-indigo-600 dark:bg-gray-700 dark:text-white dark:outline-gray-600"
                              >
                                {EDITABLE_COLUMN_TYPES.map(type => (
                                  <option key={type.value} value={type.value}>
                                    {type.label}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <span className="inline-flex items-center rounded-md bg-blue-50 dark:bg-blue-500/10 px-2 py-1 text-xs font-medium text-blue-700 dark:text-blue-400">
                                {getColumnTypeLabel(column.column_type)}
                              </span>
                            )}
                          </td>
                          <td className="whitespace-nowrap px-3 py-4 text-sm">
                            {editingColumn === column.id ? (
                              <input
                                type="checkbox"
                                checked={editingRequired}
                                onChange={(e) => setEditingRequired(e.target.checked)}
                                className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-600"
                              />
                            ) : column.required ? (
                              <CheckIcon className="h-5 w-5 text-green-600 dark:text-green-400" />
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>
                          <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                            {editingColumn === column.id ? (
                              <div className="flex items-center gap-2 justify-end">
                                <button
                                  onClick={() => handleSaveEdit(column.id)}
                                  disabled={saving}
                                  className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300 disabled:opacity-50"
                                >
                                  {saving ? 'Saving...' : 'Save'}
                                </button>
                                <button
                                  onClick={handleCancelEdit}
                                  disabled={saving}
                                  className="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-300 disabled:opacity-50"
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2 justify-end">
                                <button
                                  onClick={() => handleStartEdit(column)}
                                  className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300"
                                  title="Edit column"
                                >
                                  <PencilIcon className="h-5 w-5" />
                                </button>
                                <button
                                  onClick={() => handleDeleteColumn(column)}
                                  className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                                  title="Delete column"
                                >
                                  <TrashIcon className="h-5 w-5" />
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="bg-gray-50 dark:bg-gray-700 px-6 py-3 flex justify-end">
              <button
                onClick={onClose}
                className="rounded-md bg-white dark:bg-gray-800 px-3 py-2 text-sm font-semibold text-gray-900 dark:text-white shadow-sm ring-1 ring-inset ring-gray-300 dark:ring-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Add Column Modal */}
      {showAddModal && (
        <AddColumnModal
          isOpen={showAddModal}
          onClose={() => setShowAddModal(false)}
          onAdd={handleAddColumn}
          tableId={table.id}
        />
      )}
    </>
  )
}
