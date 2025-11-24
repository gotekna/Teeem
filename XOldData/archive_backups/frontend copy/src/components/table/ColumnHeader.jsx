import { useState, useRef, useEffect } from 'react'
import {
  DocumentTextIcon,
  HashtagIcon,
  EnvelopeIcon,
  PhoneIcon,
  CalendarIcon,
  ClockIcon,
  CheckCircleIcon,
  CurrencyDollarIcon,
  ChevronDownIcon,
  LinkIcon,
  DocumentIcon,
  ArrowsRightLeftIcon,
} from '@heroicons/react/24/outline'
import LookupConfigSlideout from './LookupConfigSlideout'

const COLUMN_TYPES = [
  { value: 'single_line_text', label: 'Single line text', icon: DocumentTextIcon },
  { value: 'multi_line_text', label: 'Long text', icon: DocumentIcon },
  { value: 'number', label: 'Number', icon: HashtagIcon },
  { value: 'currency', label: 'Currency', icon: CurrencyDollarIcon },
  { value: 'percentage', label: 'Percentage', icon: HashtagIcon },
  { value: 'email', label: 'Email', icon: EnvelopeIcon },
  { value: 'phone', label: 'Phone', icon: PhoneIcon },
  { value: 'url', label: 'URL', icon: LinkIcon },
  { value: 'date', label: 'Date', icon: CalendarIcon },
  { value: 'date_and_time', label: 'Date & Time', icon: ClockIcon },
  { value: 'boolean', label: 'Checkbox', icon: CheckCircleIcon },
  { value: 'lookup', label: 'Lookup', icon: ArrowsRightLeftIcon, needsConfig: true },
]

export default function ColumnHeader({ column, onTypeChange, tableId }) {
  const [isOpen, setIsOpen] = useState(false)
  const [showLookupConfig, setShowLookupConfig] = useState(false)
  const dropdownRef = useRef(null)

  const currentType = COLUMN_TYPES.find(t => t.value === column.column_type) || COLUMN_TYPES[0]
  const Icon = currentType.icon

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  const handleTypeChange = async (newType) => {
    setIsOpen(false)

    // If changing to lookup, show configuration modal
    if (newType === 'lookup') {
      setShowLookupConfig(true)
      return
    }

    if (newType !== column.column_type) {
      await onTypeChange(column.id, newType)
    }
  }

  const handleLookupSave = async (lookupConfig) => {
    // Update column to lookup type with configuration
    await onTypeChange(column.id, 'lookup', lookupConfig)
    setShowLookupConfig(false)
  }

  return (
    <>
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-x-2 hover:bg-gray-100 dark:hover:bg-gray-700 px-2 py-1 rounded -mx-2 -my-1 transition-colors w-full"
        >
          <Icon className="h-4 w-4 text-gray-500 dark:text-gray-400 flex-shrink-0" />
          <span className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate">
            {column.name}
          </span>
          <ChevronDownIcon className="h-3 w-3 text-gray-400 ml-auto flex-shrink-0" />
        </button>

        {isOpen && (
          <div className="absolute top-full left-0 mt-1 w-56 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-50 py-1">
            <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-700">
              <p className="text-xs font-medium text-gray-900 dark:text-white truncate">
                {column.name}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Change column type
              </p>
            </div>
            <div className="max-h-80 overflow-y-auto py-1">
              {COLUMN_TYPES.map((type) => {
                const TypeIcon = type.icon
                const isSelected = type.value === column.column_type

                return (
                  <button
                    key={type.value}
                    onClick={() => handleTypeChange(type.value)}
                    className={`w-full flex items-center gap-x-3 px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${
                      isSelected ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400' : 'text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    <TypeIcon className={`h-4 w-4 flex-shrink-0 ${
                      isSelected ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400'
                    }`} />
                    <span className="truncate">{type.label}</span>
                    {isSelected && (
                      <CheckCircleIcon className="h-4 w-4 ml-auto text-blue-600 dark:text-blue-400 flex-shrink-0" />
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* Lookup Configuration Slideout */}
      {showLookupConfig && (
        <LookupConfigSlideout
          column={column}
          tableId={tableId}
          onSave={handleLookupSave}
          onClose={() => setShowLookupConfig(false)}
        />
      )}
    </>
  )
}
