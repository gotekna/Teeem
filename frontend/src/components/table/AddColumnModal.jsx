import { useState, useEffect, useRef } from 'react'
import { XMarkIcon } from '@heroicons/react/24/outline'
import LookupConfigSlideout from './LookupConfigSlideout'
import { COLUMN_TYPES } from '../../constants/columnTypes'

export default function AddColumnModal({ isOpen, onClose, onAdd, foundationId }) {
  const [step, setStep] = useState(1) // 1 = column type, 2 = column name + settings
  const [columnName, setColumnName] = useState('')
  const [columnType, setColumnType] = useState('single_line_text')
  const [formulaExpression, setFormulaExpression] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showLookupConfig, setShowLookupConfig] = useState(false)
  const [availableColumns, setAvailableColumns] = useState([])
  const [showColumnSuggestions, setShowColumnSuggestions] = useState(false)
  const [filteredColumns, setFilteredColumns] = useState([])
  const [cursorPosition, setCursorPosition] = useState(0)
  const textareaRef = useRef(null)
  const [testingFormula, setTestingFormula] = useState(false)
  const [testResult, setTestResult] = useState(null)

  useEffect(() => {
    if (!isOpen) {
      setStep(1)
      setColumnName('')
      setColumnType('single_line_text')
      setFormulaExpression('')
      setIsSubmitting(false)
      setShowColumnSuggestions(false)
      setTestResult(null)
    } else if (isOpen && foundationId) {
      // Fetch available columns for autocomplete
      fetchTableColumns()
    }
  }, [isOpen, foundationId])

  const fetchTableColumns = async () => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api/v1/foundations/${foundationId}`)
      const data = await response.json()
      if (data.success && data.table) {
        setAvailableColumns(data.table.columns || [])
      }
    } catch (err) {
      console.error('Failed to fetch columns:', err)
    }
  }

  const handleFormulaChange = (e) => {
    const value = e.target.value
    const cursorPos = e.target.selectionStart

    setFormulaExpression(value)
    setCursorPosition(cursorPos)

    // Check if we're inside a {  } block
    const beforeCursor = value.substring(0, cursorPos)
    const lastOpenBrace = beforeCursor.lastIndexOf('{')
    const lastCloseBrace = beforeCursor.lastIndexOf('}')

    if (lastOpenBrace > lastCloseBrace) {
      // We're inside a { } block
      const searchTerm = beforeCursor.substring(lastOpenBrace + 1)
      const filtered = availableColumns.filter(col =>
        col.name.toLowerCase().includes(searchTerm.toLowerCase())
      )
      setFilteredColumns(filtered)
      setShowColumnSuggestions(filtered.length > 0)
    } else {
      setShowColumnSuggestions(false)
    }
  }

  const insertColumnName = (columnName) => {
    const beforeCursor = formulaExpression.substring(0, cursorPosition)
    const afterCursor = formulaExpression.substring(cursorPosition)
    const lastOpenBrace = beforeCursor.lastIndexOf('{')

    const newValue =
      formulaExpression.substring(0, lastOpenBrace + 1) +
      columnName +
      '}' +
      afterCursor

    setFormulaExpression(newValue)
    setShowColumnSuggestions(false)

    // Focus back on textarea
    if (textareaRef.current) {
      textareaRef.current.focus()
    }
  }

  const handleColumnTypeSelect = (type) => {
    setColumnType(type)
    setStep(2)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!columnName.trim() || isSubmitting) return

    // For lookup columns, show the configuration slideout
    if (columnType === 'lookup' || columnType === 'multiple_lookups') {
      setShowLookupConfig(true)
      return
    }

    // For computed/formula columns, require a formula expression
    if (columnType === 'computed' && !formulaExpression.trim()) {
      alert('Please enter a formula expression')
      return
    }

    setIsSubmitting(true)
    const columnData = {
      name: columnName.trim(),
      column_type: columnType
    }

    // Add formula expression to settings if it's a computed/formula column
    if (columnType === 'computed') {
      columnData.settings = {
        formula: formulaExpression.trim()
      }
    }

    await onAdd(columnData)
    setIsSubmitting(false)
  }

  const handleTestFormula = async () => {
    if (!formulaExpression.trim()) {
      alert('Please enter a formula to test')
      return
    }

    try {
      setTestingFormula(true)
      const response = await fetch(
        `${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api/v1/foundations/${foundationId}/columns/test_formula`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            formula: formulaExpression
          })
        }
      )

      const data = await response.json()

      if (data.success) {
        setTestResult({
          success: true,
          result: data.result,
          uses_cross_table_refs: data.uses_cross_table_refs,
          tested_with_record_id: data.tested_with_record_id
        })
      } else {
        setTestResult({
          success: false,
          error: data.error
        })
      }
    } catch (err) {
      console.error('Formula test error:', err)
      setTestResult({
        success: false,
        error: err.message || 'Failed to test formula'
      })
    } finally {
      setTestingFormula(false)
    }
  }

  const handleLookupSave = async (lookupConfig) => {
    setIsSubmitting(true)
    const columnData = {
      name: columnName.trim(),
      column_type: columnType, // Use the selected columnType (lookup or multiple_lookups)
      lookup_foundation_id: lookupConfig.lookup_foundation_id,
      lookup_display_column: lookupConfig.lookup_display_column
    }

    // For multiple lookups, set is_multiple flag
    if (columnType === 'multiple_lookups') {
      columnData.is_multiple = true
    }

    await onAdd(columnData)
    setShowLookupConfig(false)
    setIsSubmitting(false)
  }

  if (!isOpen) return null

  return (
    <>
      <div className="fixed inset-0 z-50 overflow-y-auto">
        {/* Backdrop */}
        <div
          className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
          onClick={onClose}
        />

        {/* Modal */}
        <div className="flex min-h-full items-center justify-center p-4">
          <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-x-3">
              {step === 2 && (
                <button
                  onClick={() => setStep(1)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
              )}
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                {step === 1 ? 'Select Column Type' : 'Configure Column'}
              </h2>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>

          {/* Form */}
          <div className="relative">
            <div
              className="flex transition-transform duration-300 ease-in-out"
              style={{ transform: `translateX(-${(step - 1) * 100}%)` }}
            >
              {/* Step 1: Column Type Selection */}
              <div className="w-full flex-shrink-0 p-6">
                <div className="border border-gray-300 dark:border-gray-600 rounded-lg max-h-96 overflow-y-auto">
                  {/* Group column types by category */}
                  {['Text', 'Numbers', 'Date & Time', 'Selection', 'Relationships', 'Computed'].map((category) => {
                    const typesInCategory = COLUMN_TYPES.filter(t => t.category === category)
                    if (typesInCategory.length === 0) return null

                    return (
                      <div key={category}>
                        {/* Category Header */}
                        <div className="px-3 py-2 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0">
                          <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                            {category}
                          </span>
                        </div>

                        {/* Column Type Options */}
                        {typesInCategory.map((type) => {
                          const Icon = type.icon
                          const isSelected = columnType === type.value

                          return (
                            <button
                              key={type.value}
                              type="button"
                              onClick={() => handleColumnTypeSelect(type.value)}
                              className={`w-full flex items-start gap-x-3 px-3 py-2.5 text-sm border-b border-gray-100 dark:border-gray-700 transition-colors ${
                                isSelected
                                  ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300'
                                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                              }`}
                            >
                              <Icon className={`h-5 w-5 flex-shrink-0 mt-0.5 ${
                                isSelected ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-400'
                              }`} />
                              <div className="flex-1 text-left">
                                <div className="font-medium">{type.label}</div>
                                {type.description && (
                                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                    {type.description}
                                  </div>
                                )}
                              </div>
                            </button>
                          )
                        })}
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Step 2: Column Name + Settings */}
              <form onSubmit={handleSubmit} className="w-full flex-shrink-0 p-6 space-y-4">
                {/* Column Name */}
                <div>
                  <label htmlFor="column-name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Column Name
                  </label>
                  <input
                    type="text"
                    id="column-name"
                    value={columnName}
                    onChange={(e) => setColumnName(e.target.value)}
                    placeholder="Enter column name"
                    autoFocus={step === 2}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                    required
                  />
                </div>

                {/* Formula Expression (only shown for computed type) */}
                {columnType === 'computed' && (
                  <div className="relative">
                    <label htmlFor="formula-expression" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Formula
                    </label>
                    <textarea
                      ref={textareaRef}
                      id="formula-expression"
                      value={formulaExpression}
                      onChange={handleFormulaChange}
                      onKeyDown={(e) => {
                        if (e.key === 'Escape' && showColumnSuggestions) {
                          setShowColumnSuggestions(false)
                          e.preventDefault()
                        }
                      }}
                      placeholder="e.g., {Price} * {Quantity} or {Amount} * 0.1"
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white font-mono text-sm"
                      required
                    />

                    {/* Column suggestions dropdown */}
                    {showColumnSuggestions && filteredColumns.length > 0 && (
                      <div className="absolute z-10 mt-1 w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                        {filteredColumns.map((column) => (
                          <button
                            key={column.id}
                            type="button"
                            onClick={() => insertColumnName(column.name)}
                            className="w-full text-left px-3 py-2 hover:bg-blue-50 dark:hover:bg-blue-900/20 text-sm text-gray-900 dark:text-gray-100 border-b border-gray-100 dark:border-gray-700 last:border-b-0"
                          >
                            <span className="font-medium">{column.name}</span>
                            <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">
                              ({column.column_type})
                            </span>
                          </button>
                        ))}
                      </div>
                    )}

                    <div className="mt-2 space-y-2">
                      {/* Test Formula Button */}
                      <button
                        type="button"
                        onClick={handleTestFormula}
                        disabled={testingFormula || !formulaExpression.trim()}
                        className="px-3 py-1.5 text-sm font-medium text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 hover:bg-indigo-100 dark:hover:bg-indigo-900/30 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {testingFormula ? 'Testing...' : 'Test Formula'}
                      </button>

                      {/* Test Result Display */}
                      {testResult && (
                        <div className={`p-3 rounded-lg border ${
                          testResult.success
                            ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                            : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                        }`}>
                          {testResult.success ? (
                            <div className="space-y-1">
                              <p className="text-sm font-medium text-green-800 dark:text-green-300">
                                Test Result: <span className="font-mono">{testResult.result}</span>
                              </p>
                              {testResult.uses_cross_table_refs && (
                                <p className="text-xs text-green-700 dark:text-green-400">
                                  ✓ This formula uses cross-table references
                                </p>
                              )}
                              <p className="text-xs text-green-600 dark:text-green-500">
                                Tested with record #{testResult.tested_with_record_id}
                              </p>
                            </div>
                          ) : (
                            <p className="text-sm text-red-800 dark:text-red-300">
                              Error: {testResult.error}
                            </p>
                          )}
                        </div>
                      )}

                      <div className="space-y-1 text-xs text-gray-500 dark:text-gray-400">
                        <p className="font-medium">Tips:</p>
                        <p>• Type {'{'}  to see available columns from this table</p>
                        <p>• Use dot notation for cross-table references: {'{'}<span className="font-mono">lookup_column.field_name</span>{'}'}</p>
                        <p className="font-medium mt-2">Examples:</p>
                        <p className="font-mono">• {'{'}Price{'}'} * {'{'}Quantity{'}'}</p>
                        <p className="font-mono">• {'{'}Category.Tax Rate{'}'} * {'{'}Subtotal{'}'}</p>
                        <p className="font-mono">• ({'{'}Subtotal{'}'} + {'{'}Shipping{'}'}) * 1.1</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center justify-end gap-x-3 pt-4">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={!columnName.trim() || isSubmitting}
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSubmitting ? 'Adding...' : 'Add Column'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>

      {/* Lookup Configuration Slideout */}
      {showLookupConfig && (
        <LookupConfigSlideout
          column={{ name: columnName }}
          foundationId={foundationId}
          onSave={handleLookupSave}
          onClose={() => setShowLookupConfig(false)}
        />
      )}
    </>
  )
}
