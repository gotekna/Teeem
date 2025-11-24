import { useState, useEffect, useRef } from 'react'
import { api } from '../../api'
import { MagnifyingGlassIcon, XMarkIcon } from '@heroicons/react/24/outline'

export default function AutocompleteLookupCell({ column, value, onChange, isEditing }) {
  const [searchTerm, setSearchTerm] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef(null)
  const dropdownRef = useRef(null)
  const searchTimeoutRef = useRef(null)

  // Get current display value
  const displayValue = typeof value === 'object' ? value?.display : value
  const currentId = typeof value === 'object' ? value?.id : value

  // Focus input when entering edit mode
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus()
      // Show recent items when opening
      performSearch('')
    }
  }, [isEditing])

  // Handle search with debouncing
  const performSearch = async (term) => {
    setLoading(true)

    try {
      const response = await api.get(
        `/api/v1/tables/${column.table_id}/columns/${column.id}/lookup_search`,
        { params: { q: term } }
      )
      setResults(response.data.results || [])
      setShowDropdown(true)
      setSelectedIndex(0)
    } catch (err) {
      console.error('Search error:', err)
      setResults([])
    } finally {
      setLoading(false)
    }
  }

  const handleSearchChange = (e) => {
    const term = e.target.value
    setSearchTerm(term)

    // Clear existing timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }

    // Debounce search by 300ms
    searchTimeoutRef.current = setTimeout(() => {
      performSearch(term)
    }, 300)
  }

  const handleSelect = (result) => {
    onChange(result.id)
    setSearchTerm('')
    setShowDropdown(false)
  }

  const handleClear = () => {
    onChange(null)
    setSearchTerm('')
    setResults([])
    setShowDropdown(false)
  }

  const handleKeyDown = (e) => {
    if (!showDropdown) return

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSelectedIndex((prev) => Math.min(prev + 1, results.length - 1))
        break
      case 'ArrowUp':
        e.preventDefault()
        setSelectedIndex((prev) => Math.max(prev - 1, 0))
        break
      case 'Enter':
        e.preventDefault()
        if (results[selectedIndex]) {
          handleSelect(results[selectedIndex])
        }
        break
      case 'Escape':
        e.preventDefault()
        setShowDropdown(false)
        setSearchTerm('')
        break
    }
  }

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target) &&
        inputRef.current &&
        !inputRef.current.contains(event.target)
      ) {
        setShowDropdown(false)
        setSearchTerm('')
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Scroll selected item into view
  useEffect(() => {
    if (showDropdown && dropdownRef.current) {
      const selectedElement = dropdownRef.current.children[selectedIndex]
      if (selectedElement) {
        selectedElement.scrollIntoView({ block: 'nearest' })
      }
    }
  }, [selectedIndex, showDropdown])

  // Display mode - show the display value
  if (!isEditing) {
    if (!displayValue) {
      return <span className="text-gray-400 dark:text-gray-600">-</span>
    }

    return (
      <span className="text-gray-900 dark:text-gray-100">
        {displayValue}
      </span>
    )
  }

  // Edit mode - show autocomplete input
  return (
    <div className="relative w-full">
      <div className="flex items-center gap-1">
        <div className="relative flex-1">
          <MagnifyingGlassIcon className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            ref={inputRef}
            type="text"
            value={searchTerm}
            onChange={handleSearchChange}
            onKeyDown={handleKeyDown}
            onFocus={() => {
              if (results.length > 0) setShowDropdown(true)
            }}
            placeholder={displayValue || 'Search...'}
            className="w-full pl-8 pr-3 py-1.5 text-sm rounded-md border border-gray-300 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:bg-white/5 dark:border-white/10 dark:text-white"
          />
          {loading && (
            <div className="absolute right-2 top-1/2 -translate-y-1/2">
              <div className="animate-spin h-4 w-4 border-2 border-indigo-500 border-t-transparent rounded-full"></div>
            </div>
          )}
        </div>

        {currentId && (
          <button
            onClick={handleClear}
            className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            title="Clear selection"
          >
            <XMarkIcon className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Dropdown with results */}
      {showDropdown && results.length > 0 && (
        <div
          ref={dropdownRef}
          className="absolute z-50 mt-1 w-full max-h-60 overflow-auto rounded-md bg-white dark:bg-gray-800 shadow-lg border border-gray-200 dark:border-gray-700"
        >
          {results.map((result, index) => (
            <div
              key={result.id}
              onClick={() => handleSelect(result)}
              className={`px-3 py-2 cursor-pointer transition-colors ${
                index === selectedIndex
                  ? 'bg-indigo-50 dark:bg-indigo-900/30'
                  : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
              }`}
            >
              <div className="font-medium text-sm text-gray-900 dark:text-gray-100">
                {result.display}
              </div>

              {/* Show context fields */}
              {Object.keys(result.context || {}).length > 0 && (
                <div className="mt-0.5 flex flex-wrap gap-2 text-xs text-gray-500 dark:text-gray-400">
                  {Object.entries(result.context).slice(0, 3).map(([key, val]) => (
                    <span key={key} className="truncate">
                      {key}: <span className="font-medium">{val}</span>
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* No results message */}
      {showDropdown && results.length === 0 && !loading && searchTerm && (
        <div className="absolute z-50 mt-1 w-full rounded-md bg-white dark:bg-gray-800 shadow-lg border border-gray-200 dark:border-gray-700 p-3">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            No results found for "{searchTerm}"
          </p>
        </div>
      )}
    </div>
  )
}
