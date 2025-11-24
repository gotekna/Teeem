import { useState, useEffect } from 'react'
import { XMarkIcon } from '@heroicons/react/24/outline'
import { api } from '../../api'

export default function LookupConfigModal({ column, tableId, onSave, onClose }) {
  const [loading, setLoading] = useState(false)
  const [tables, setTables] = useState([])
  const [targetTableColumns, setTargetTableColumns] = useState([])
  const [formData, setFormData] = useState({
    lookup_table_id: column?.lookup_table_id || '',
    lookup_display_column: column?.lookup_display_column || '',
  })

  // Fetch available tables
  useEffect(() => {
    const fetchTables = async () => {
      try {
        const response = await api.get('/api/v1/tables')
        // Filter out the current table
        const availableTables = response.data.tables.filter(t => t.id !== tableId)
        setTables(availableTables)
      } catch (err) {
        console.error('Error fetching tables:', err)
      }
    }
    fetchTables()
  }, [tableId])

  // Fetch columns from selected target table
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
    fetchTargetColumns()
  }, [formData.lookup_table_id])

  const handleSave = async () => {
    if (!formData.lookup_table_id || !formData.lookup_display_column) {
      alert('Please select both a target table and display field')
      return
    }

    setLoading(true)
    try {
      await onSave(formData)
      onClose()
    } catch (err) {
      console.error('Error saving lookup configuration:', err)
      alert('Failed to save lookup configuration')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Configure Lookup
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Link to table
            </label>
            <select
              value={formData.lookup_table_id}
              onChange={(e) => setFormData({
                ...formData,
                lookup_table_id: e.target.value,
                lookup_display_column: '' // Reset display column when table changes
              })}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            >
              <option value="">Select a table...</option>
              {tables.map((table) => (
                <option key={table.id} value={table.id}>
                  {table.name}
                </option>
              ))}
            </select>
          </div>

          {formData.lookup_table_id && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Display field
              </label>
              <select
                value={formData.lookup_display_column}
                onChange={(e) => setFormData({ ...formData, lookup_display_column: e.target.value })}
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              >
                <option value="">Select field to display...</option>
                {targetTableColumns.map((col) => (
                  <option key={col.id} value={col.column_name}>
                    {col.name}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                This field will be shown when viewing the lookup value
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-600"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={loading || !formData.lookup_table_id || !formData.lookup_display_column}
            className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
