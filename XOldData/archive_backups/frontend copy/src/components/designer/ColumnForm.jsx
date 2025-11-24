import { useState, useEffect, Fragment } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import { XMarkIcon } from '@heroicons/react/24/outline'
import { api } from '../../api'

const COLUMN_TYPES = [
  { value: 'single_line_text', label: 'Single Line of Text', supportsValidation: true },
  { value: 'multiple_lines_text', label: 'Multiple Lines of Text', supportsValidation: true },
  { value: 'email', label: 'Email', supportsValidation: true },
  { value: 'number', label: 'Number', supportsValidation: true },
  { value: 'whole_number', label: 'Whole Number', supportsValidation: true },
  { value: 'currency', label: 'Currency', supportsValidation: true },
  { value: 'percentage', label: 'Percentage', supportsValidation: true },
  { value: 'date', label: 'Date', supportsValidation: false },
  { value: 'date_and_time', label: 'Date and Time', supportsValidation: false },
  { value: 'boolean', label: 'Yes/No', supportsValidation: false },
  { value: 'choice', label: 'Choice', supportsValidation: false },
  { value: 'lookup', label: 'Lookup', supportsValidation: false },
]

export default function ColumnForm({ table, column, onClose }) {
  const isEditing = !!column
  const [formData, setFormData] = useState({
    name: column?.name || '',
    column_type: column?.column_type || 'single_line_text',
    description: column?.description || '',
    required: column?.required || false,
    searchable: column?.searchable ?? true,
    is_title: column?.is_title || false,
    is_unique: column?.is_unique || false,
    max_length: column?.max_length || '',
    min_length: column?.min_length || '',
    max_value: column?.max_value || '',
    min_value: column?.min_value || '',
    default_value: column?.default_value || '',
    validation_message: column?.validation_message || '',
    lookup_table_id: column?.lookup_table_id || '',
    lookup_display_column: column?.lookup_display_column || '',
    is_multiple: column?.is_multiple || false,
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [tables, setTables] = useState([])
  const [targetTableColumns, setTargetTableColumns] = useState([])

  const selectedType = COLUMN_TYPES.find(t => t.value === formData.column_type)
  const supportsValidation = selectedType?.supportsValidation
  const supportsLength = ['single_line_text', 'multiple_lines_text', 'email'].includes(formData.column_type)
  const supportsMinMax = ['number', 'whole_number', 'currency', 'percentage'].includes(formData.column_type)
  const isLookupType = formData.column_type === 'lookup' || formData.column_type === 'multiple_lookups'

  // Fetch available tables for lookup configuration
  useEffect(() => {
    const fetchTables = async () => {
      try {
        const response = await api.get('/api/v1/tables')
        // Filter out the current table (can't lookup to self)
        setTables(response.data.tables.filter(t => t.id !== table.id))
      } catch (err) {
        console.error('Error fetching tables:', err)
      }
    }

    if (isLookupType) {
      fetchTables()
    }
  }, [isLookupType, table.id])

  // Fetch columns from the selected lookup table
  useEffect(() => {
    const fetchTargetColumns = async () => {
      if (!formData.lookup_table_id) {
        setTargetTableColumns([])
        return
      }

      try {
        const response = await api.get(`/api/v1/tables/${formData.lookup_table_id}`)
        setTargetTableColumns(response.data.table.columns || [])
      } catch (err) {
        console.error('Error fetching target table columns:', err)
        setTargetTableColumns([])
      }
    }

    if (isLookupType && formData.lookup_table_id) {
      fetchTargetColumns()
    }
  }, [isLookupType, formData.lookup_table_id])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setSaving(true)

    try {
      // Generate column_name from name if not editing
      const columnData = { ...formData }
      if (!isEditing && !columnData.column_name) {
        columnData.column_name = formData.name
          .toLowerCase()
          .replace(/\s+/g, '_')
          .replace(/[^a-z0-9_]/g, '')
      }

      if (isEditing) {
        await api.put(`/api/v1/tables/${table.id}/columns/${column.id}`, { column: columnData })
      } else {
        await api.post(`/api/v1/tables/${table.id}/columns`, { column: columnData })
      }
      onClose()
    } catch (err) {
      console.error('Column save error:', err)
      setError(err.response?.data?.errors?.join(', ') || err.response?.data?.error || err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Transition appear show={true} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/25 dark:bg-black/50" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-2xl transform overflow-hidden rounded-2xl bg-white dark:bg-gray-900 p-6 text-left align-middle shadow-xl transition-all">
                <div className="flex items-center justify-between mb-4">
                  <Dialog.Title className="text-lg font-semibold text-gray-900 dark:text-white">
                    {isEditing ? 'Edit Column' : 'Add Column'}
                  </Dialog.Title>
                  <button
                    onClick={onClose}
                    className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
                  >
                    <XMarkIcon className="h-6 w-6" />
                  </button>
                </div>

                {error && (
                  <div className="mb-4 rounded-md bg-red-50 dark:bg-red-900/10 p-4">
                    <div className="text-sm text-red-800 dark:text-red-400">{error}</div>
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                  {/* Column Name */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Column Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm dark:bg-white/5 dark:border-white/10 dark:text-white"
                      placeholder="e.g., Customer Name"
                    />
                  </div>

                  {/* Column Type */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Column Type *
                    </label>
                    <select
                      value={formData.column_type}
                      onChange={(e) => setFormData({ ...formData, column_type: e.target.value })}
                      disabled={isEditing}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm dark:bg-white/5 dark:border-white/10 dark:text-white disabled:opacity-50"
                    >
                      {COLUMN_TYPES.map(type => (
                        <option key={type.value} value={type.value}>
                          {type.label}
                        </option>
                      ))}
                    </select>
                    {isEditing && (
                      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        Column type cannot be changed after creation
                      </p>
                    )}
                  </div>

                  {/* Lookup Configuration */}
                  {isLookupType && (
                    <div className="border border-indigo-200 dark:border-indigo-800 rounded-lg p-4 bg-indigo-50 dark:bg-indigo-900/10">
                      <h4 className="text-sm font-medium text-indigo-900 dark:text-indigo-300 mb-3">
                        Lookup Configuration
                      </h4>

                      {/* Target Table Selector */}
                      <div className="mb-3">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                          Link to Table *
                        </label>
                        <select
                          value={formData.lookup_table_id}
                          onChange={(e) => setFormData({
                            ...formData,
                            lookup_table_id: e.target.value,
                            lookup_display_column: '' // Reset display column when table changes
                          })}
                          required={isLookupType}
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm dark:bg-white/5 dark:border-white/10 dark:text-white"
                        >
                          <option value="">Select a table...</option>
                          {tables.map(t => (
                            <option key={t.id} value={t.id}>{t.name}</option>
                          ))}
                        </select>
                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                          Choose which table this column will link to
                        </p>
                      </div>

                      {/* Display Column Selector */}
                      {formData.lookup_table_id && (
                        <div className="mb-3">
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                            Display Field *
                          </label>
                          <select
                            value={formData.lookup_display_column}
                            onChange={(e) => setFormData({
                              ...formData,
                              lookup_display_column: e.target.value
                            })}
                            required={isLookupType}
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm dark:bg-white/5 dark:border-white/10 dark:text-white"
                          >
                            <option value="">Select field to display...</option>
                            {targetTableColumns.map(col => (
                              <option key={col.id} value={col.column_name}>
                                {col.name}
                              </option>
                            ))}
                          </select>
                          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                            This field will be shown in the dropdown
                          </p>
                        </div>
                      )}

                      {/* Multiple Selection Checkbox */}
                      {formData.column_type === 'multiple_lookups' && (
                        <div className="flex items-center">
                          <input
                            type="checkbox"
                            checked={formData.is_multiple}
                            onChange={(e) => setFormData({ ...formData, is_multiple: e.target.checked })}
                            className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-600"
                          />
                          <label className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
                            Allow multiple selections
                          </label>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Description */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Description
                    </label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      rows={2}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm dark:bg-white/5 dark:border-white/10 dark:text-white"
                      placeholder="Optional description for this column"
                    />
                  </div>

                  {/* Checkboxes */}
                  <div className="space-y-2">
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        checked={formData.required}
                        onChange={(e) => setFormData({ ...formData, required: e.target.checked })}
                        className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-600"
                      />
                      <label className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
                        Required field
                      </label>
                    </div>

                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        checked={formData.searchable}
                        onChange={(e) => setFormData({ ...formData, searchable: e.target.checked })}
                        className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-600"
                      />
                      <label className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
                        Searchable
                      </label>
                    </div>

                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        checked={formData.is_title}
                        onChange={(e) => setFormData({ ...formData, is_title: e.target.checked })}
                        className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-600"
                      />
                      <label className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
                        Use as title column
                      </label>
                    </div>

                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        checked={formData.is_unique}
                        onChange={(e) => setFormData({ ...formData, is_unique: e.target.checked })}
                        className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-600"
                      />
                      <label className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
                        Unique values only
                      </label>
                    </div>
                  </div>

                  {/* Validation Rules */}
                  {supportsValidation && (
                    <div className="border-t border-gray-200 dark:border-white/10 pt-4">
                      <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-3">
                        Validation Rules
                      </h4>

                      {supportsLength && (
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm text-gray-700 dark:text-gray-300">
                              Minimum Length
                            </label>
                            <input
                              type="number"
                              value={formData.min_length}
                              onChange={(e) => setFormData({ ...formData, min_length: e.target.value })}
                              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm dark:bg-white/5 dark:border-white/10 dark:text-white"
                            />
                          </div>
                          <div>
                            <label className="block text-sm text-gray-700 dark:text-gray-300">
                              Maximum Length
                            </label>
                            <input
                              type="number"
                              value={formData.max_length}
                              onChange={(e) => setFormData({ ...formData, max_length: e.target.value })}
                              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm dark:bg-white/5 dark:border-white/10 dark:text-white"
                            />
                          </div>
                        </div>
                      )}

                      {supportsMinMax && (
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm text-gray-700 dark:text-gray-300">
                              Minimum Value
                            </label>
                            <input
                              type="number"
                              step="any"
                              value={formData.min_value}
                              onChange={(e) => setFormData({ ...formData, min_value: e.target.value })}
                              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm dark:bg-white/5 dark:border-white/10 dark:text-white"
                            />
                          </div>
                          <div>
                            <label className="block text-sm text-gray-700 dark:text-gray-300">
                              Maximum Value
                            </label>
                            <input
                              type="number"
                              step="any"
                              value={formData.max_value}
                              onChange={(e) => setFormData({ ...formData, max_value: e.target.value })}
                              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm dark:bg-white/5 dark:border-white/10 dark:text-white"
                            />
                          </div>
                        </div>
                      )}

                      <div className="mt-4">
                        <label className="block text-sm text-gray-700 dark:text-gray-300">
                          Custom Validation Message
                        </label>
                        <input
                          type="text"
                          value={formData.validation_message}
                          onChange={(e) => setFormData({ ...formData, validation_message: e.target.value })}
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm dark:bg-white/5 dark:border-white/10 dark:text-white"
                          placeholder="e.g., Please enter a valid customer name"
                        />
                      </div>
                    </div>
                  )}

                  {/* Default Value */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Default Value
                    </label>
                    <input
                      type="text"
                      value={formData.default_value}
                      onChange={(e) => setFormData({ ...formData, default_value: e.target.value })}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm dark:bg-white/5 dark:border-white/10 dark:text-white"
                      placeholder="Optional default value"
                    />
                  </div>

                  {/* Actions */}
                  <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-white/10">
                    <button
                      type="button"
                      onClick={onClose}
                      className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 dark:bg-white/5 dark:text-white dark:ring-white/10 dark:hover:bg-white/10"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={saving}
                      className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:opacity-50"
                    >
                      {saving ? 'Saving...' : isEditing ? 'Update Column' : 'Create Column'}
                    </button>
                  </div>
                </form>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  )
}
