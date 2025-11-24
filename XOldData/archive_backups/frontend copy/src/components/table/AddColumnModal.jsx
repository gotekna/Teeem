import { useState, useEffect, useRef } from 'react'
import { XMarkIcon } from '@heroicons/react/24/outline'
import {
  DocumentTextIcon,
  HashtagIcon,
  EnvelopeIcon,
  PhoneIcon,
  CalendarIcon,
  ClockIcon,
  CheckCircleIcon,
  CurrencyDollarIcon,
  LinkIcon,
  DocumentIcon,
  PaperClipIcon,
  Bars3BottomLeftIcon,
  UserIcon,
  StarIcon,
  CalculatorIcon,
  ArrowPathIcon,
  MagnifyingGlassIcon,
  RectangleStackIcon,
  ArrowsRightLeftIcon,
} from '@heroicons/react/24/outline'
import LookupConfigSlideout from './LookupConfigSlideout'

const COLUMN_TYPES = [
  // Standard Fields
  { value: 'lookup', label: 'Link to another record', icon: ArrowsRightLeftIcon, category: 'Standard fields', needsConfig: true },
  { value: 'single_line_text', label: 'Single line text', icon: DocumentTextIcon, category: 'Standard fields' },
  { value: 'multi_line_text', label: 'Long text', icon: Bars3BottomLeftIcon, category: 'Standard fields' },
  { value: 'attachment', label: 'Attachment', icon: PaperClipIcon, category: 'Standard fields' },
  { value: 'boolean', label: 'Checkbox', icon: CheckCircleIcon, category: 'Standard fields' },
  { value: 'multiple_select', label: 'Multiple select', icon: RectangleStackIcon, category: 'Standard fields' },
  { value: 'single_select', label: 'Single select', icon: RectangleStackIcon, category: 'Standard fields' },
  { value: 'user', label: 'User', icon: UserIcon, category: 'Standard fields' },
  { value: 'date', label: 'Date', icon: CalendarIcon, category: 'Standard fields' },
  { value: 'phone', label: 'Phone number', icon: PhoneIcon, category: 'Standard fields' },
  { value: 'email', label: 'Email', icon: EnvelopeIcon, category: 'Standard fields' },
  { value: 'url', label: 'URL', icon: LinkIcon, category: 'Standard fields' },
  { value: 'number', label: 'Number', icon: HashtagIcon, category: 'Standard fields' },
  { value: 'currency', label: 'Currency', icon: CurrencyDollarIcon, category: 'Standard fields' },
  { value: 'percentage', label: 'Percent', icon: HashtagIcon, category: 'Standard fields' },
  { value: 'duration', label: 'Duration', icon: ClockIcon, category: 'Standard fields' },
  { value: 'rating', label: 'Rating', icon: StarIcon, category: 'Standard fields' },
  { value: 'formula', label: 'Formula', icon: CalculatorIcon, category: 'Standard fields' },
  { value: 'rollup', label: 'Rollup', icon: ArrowPathIcon, category: 'Standard fields' },
  { value: 'count', label: 'Count', icon: HashtagIcon, category: 'Standard fields' },
  { value: 'lookup_field', label: 'Lookup', icon: MagnifyingGlassIcon, category: 'Standard fields' },
  { value: 'created_time', label: 'Created time', icon: ClockIcon, category: 'Standard fields' },
  { value: 'last_modified_time', label: 'Last modified time', icon: ClockIcon, category: 'Standard fields' },
  { value: 'created_by', label: 'Created by', icon: UserIcon, category: 'Standard fields' },
  { value: 'last_modified_by', label: 'Last modified by', icon: UserIcon, category: 'Standard fields' },
  { value: 'autonumber', label: 'Autonumber', icon: HashtagIcon, category: 'Standard fields' },
]

export default function AddColumnModal({ isOpen, onClose, onAdd, tableId }) {
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

  useEffect(() => {
    if (!isOpen) {
      setStep(1)
      setColumnName('')
      setColumnType('single_line_text')
      setFormulaExpression('')
      setIsSubmitting(false)
      setShowColumnSuggestions(false)
    } else if (isOpen && tableId) {
      // Fetch available columns for autocomplete
      fetchTableColumns()
    }
  }, [isOpen, tableId])

  const fetchTableColumns = async () => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api/v1/tables/${tableId}`)
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
    if (columnType === 'lookup') {
      setShowLookupConfig(true)
      return
    }

    // For formula columns, require a formula expression
    if (columnType === 'formula' && !formulaExpression.trim()) {
      alert('Please enter a formula expression')
      return
    }

    setIsSubmitting(true)
    const columnData = {
      name: columnName.trim(),
      column_type: columnType
    }

    // Add formula expression to settings if it's a formula column
    if (columnType === 'formula') {
      columnData.settings = {
        formula: formulaExpression.trim()
      }
    }

    await onAdd(columnData)
    setIsSubmitting(false)
  }

  const handleLookupSave = async (lookupConfig) => {
    setIsSubmitting(true)
    const columnData = {
      name: columnName.trim(),
      column_type: 'lookup',
      lookup_table_id: lookupConfig.lookup_table_id,
      lookup_display_column: lookupConfig.lookup_display_column
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
                  {/* Category Header */}
                  <div className="px-3 py-2 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0">
                    <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                      Standard fields
                    </span>
                  </div>

                  {/* Column Type Options */}
                  {COLUMN_TYPES.map((type) => {
                    const Icon = type.icon
                    const isSelected = columnType === type.value

                    return (
                      <button
                        key={type.value}
                        type="button"
                        onClick={() => handleColumnTypeSelect(type.value)}
                        className={`w-full flex items-center gap-x-3 px-3 py-2.5 text-sm border-b border-gray-100 dark:border-gray-700 last:border-b-0 transition-colors ${
                          isSelected
                            ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                            : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                        }`}
                      >
                        <Icon className={`h-4 w-4 flex-shrink-0 ${
                          isSelected ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400'
                        }`} />
                        <span className="text-left">{type.label}</span>
                      </button>
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

                {/* Formula Expression (only shown for formula type) */}
                {columnType === 'formula' && (
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

                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      Type {'{'}  to see available columns
                    </p>
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
          tableId={tableId}
          onSave={handleLookupSave}
          onClose={() => setShowLookupConfig(false)}
        />
      )}
    </>
  )
}
