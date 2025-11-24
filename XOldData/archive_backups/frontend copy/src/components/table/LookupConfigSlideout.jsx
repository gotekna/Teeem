import { useState, useEffect } from 'react'
import { XMarkIcon, MagnifyingGlassIcon, ChevronLeftIcon, CheckIcon } from '@heroicons/react/24/outline'
import { api } from '../../api'

export default function LookupConfigSlideout({ column, tableId, onSave, onClose }) {
  const [step, setStep] = useState(1) // 1 = select table, 2 = select fields
  const [loading, setLoading] = useState(false)
  const [tables, setTables] = useState([])
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedTableId, setSelectedTableId] = useState(column?.lookup_table_id || '')
  const [selectedTable, setSelectedTable] = useState(null)
  const [displayColumn, setDisplayColumn] = useState(column?.lookup_display_column || '')
  const [selectedFields, setSelectedFields] = useState(new Set())

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

  // Fetch selected table details
  useEffect(() => {
    const fetchTableDetails = async () => {
      if (!selectedTableId) {
        setSelectedTable(null)
        return
      }

      try {
        const response = await api.get(`/api/v1/tables/${selectedTableId}`)
        setSelectedTable(response.data.table)
      } catch (err) {
        console.error('Error fetching table details:', err)
      }
    }
    fetchTableDetails()
  }, [selectedTableId])

  const filteredTables = tables.filter(table =>
    table.name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const handleTableSelect = (table) => {
    setSelectedTableId(table.id)
    setStep(2)
  }

  const handleBack = () => {
    if (step === 2) {
      setStep(1)
      setDisplayColumn('')
      setSelectedFields(new Set())
    }
  }

  const toggleField = (columnName) => {
    const newSelected = new Set(selectedFields)
    if (newSelected.has(columnName)) {
      newSelected.delete(columnName)
    } else {
      newSelected.add(columnName)
    }
    setSelectedFields(newSelected)
  }

  const handleSave = async () => {
    if (!selectedTableId || !displayColumn) {
      alert('Please select both a table and a display field')
      return
    }

    setLoading(true)
    try {
      await onSave({
        lookup_table_id: selectedTableId,
        lookup_display_column: displayColumn,
      })
      onClose()
    } catch (err) {
      console.error('Error saving lookup configuration:', err)
      alert('Failed to save lookup configuration')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end sm:items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-t-2xl sm:rounded-2xl shadow-xl w-full sm:max-w-2xl mx-0 sm:mx-4 h-[85vh] sm:h-auto sm:max-h-[85vh] flex flex-col overflow-hidden transform transition-all">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
          <div className="flex items-center gap-3">
            {step === 2 && (
              <button
                onClick={handleBack}
                className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 -ml-1"
              >
                <ChevronLeftIcon className="h-5 w-5" />
              </button>
            )}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {step === 1 ? 'Select a table to link' : 'Configure lookup field'}
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                {step === 1 ? 'Choose which table to reference' : selectedTable?.name}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        {/* Step 1: Select Table */}
        {step === 1 && (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Search */}
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
              <div className="relative">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search tables..."
                  className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-300 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  autoFocus
                />
              </div>
            </div>

            {/* Table List */}
            <div className="flex-1 overflow-y-auto px-6 py-4">
              {filteredTables.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-gray-500 dark:text-gray-400">
                    {searchTerm ? 'No tables found' : 'No tables available'}
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredTables.map((table) => (
                    <button
                      key={table.id}
                      onClick={() => handleTableSelect(table)}
                      className="w-full flex items-center justify-between p-4 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-indigo-500 dark:hover:border-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-all group"
                    >
                      <div className="text-left">
                        <p className="font-medium text-gray-900 dark:text-white">
                          {table.name}
                        </p>
                        {table.description && (
                          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                            {table.description}
                          </p>
                        )}
                      </div>
                      <ChevronLeftIcon className="h-5 w-5 text-gray-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 rotate-180 transition-colors" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Step 2: Select Fields */}
        {step === 2 && selectedTable && (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Display Field Selection */}
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Primary display field *
              </label>
              <select
                value={displayColumn}
                onChange={(e) => setDisplayColumn(e.target.value)}
                className="w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              >
                <option value="">Select field to display...</option>
                {selectedTable.columns.map((col) => (
                  <option key={col.id} value={col.column_name}>
                    {col.name}
                  </option>
                ))}
              </select>
              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                This field will be shown as the main value
              </p>
            </div>

            {/* Additional Fields to Show */}
            <div className="flex-1 overflow-y-auto px-6 py-4">
              <div className="mb-3">
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Additional fields to display
                </h4>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Select which fields to show in the search results
                </p>
              </div>

              <div className="space-y-2">
                {selectedTable.columns.map((col) => {
                  const isSelected = selectedFields.has(col.column_name)
                  const isPrimaryDisplay = col.column_name === displayColumn

                  return (
                    <button
                      key={col.id}
                      onClick={() => !isPrimaryDisplay && toggleField(col.column_name)}
                      disabled={isPrimaryDisplay}
                      className={`w-full flex items-center justify-between p-3 rounded-lg border transition-all ${
                        isPrimaryDisplay
                          ? 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50 cursor-not-allowed opacity-50'
                          : isSelected
                          ? 'border-indigo-500 dark:border-indigo-400 bg-indigo-50 dark:bg-indigo-900/20'
                          : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                            isPrimaryDisplay
                              ? 'border-gray-300 bg-gray-100'
                              : isSelected
                              ? 'border-indigo-600 bg-indigo-600'
                              : 'border-gray-300 dark:border-gray-600'
                          }`}
                        >
                          {(isSelected || isPrimaryDisplay) && (
                            <CheckIcon className="h-3 w-3 text-white" />
                          )}
                        </div>
                        <div className="text-left">
                          <p className="text-sm font-medium text-gray-900 dark:text-white">
                            {col.name}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {col.column_type.replace(/_/g, ' ')}
                            {isPrimaryDisplay && ' (Primary display)'}
                          </p>
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Footer with Save Button */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex-shrink-0">
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-600"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={loading || !displayColumn}
                className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Saving...' : 'Save lookup'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
