import { useState, useEffect } from 'react'
import { api } from '../../api'

export default function FilterSection({ filters, onFilterChange, stats }) {
  const [constants, setConstants] = useState(null)
  const [loading, setLoading] = useState(true)
  const chapters = Array.from({ length: 21 }, (_, i) => i + 1) // Changed from 0-20 to 1-21 (no Chapter 0)

  // Fetch Trinity constants from API (RULE #1.13 - Single Source of Truth)
  useEffect(() => {
    const fetchConstants = async () => {
      try {
        setLoading(true)
        const response = await api.get('/api/v1/trinity/constants')
        setConstants(response.data)
      } catch (error) {
        console.error('Failed to fetch Trinity constants:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchConstants()
  }, [])

  // Icon mappings for UI presentation (not stored in DB - UI concern only)
  const typeIcons = {
    bug: '🐛',
    architecture: '🏗️',
    test: '📊',
    performance: '📈',
    dev_note: '🎓',
    common_issue: '🔍',
    terminology: '📖'
  }

  const statusIcons = {
    open: '🔴',
    fixed: '✅',
    monitoring: '🔄',
    by_design: '⚠️'
  }

  const severityIcons = {
    critical: '🔴',
    high: '🟠',
    medium: '🟡',
    low: '🟢'
  }

  // Build options from API constants + UI icons + stats counts
  const typeOptions = [
    { value: 'all', label: 'All Types', icon: '📚', count: stats?.total_bugs || 0 },
    ...(constants?.lexicon_types || []).map(type => ({
      value: type,
      label: type.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
      icon: typeIcons[type] || '📝',
      count: stats?.by_type?.[type] || 0
    }))
  ]

  const statusOptions = [
    { value: 'all', label: 'All Status', icon: '⚡' },
    ...(constants?.statuses || []).map(status => ({
      value: status,
      label: status.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
      icon: statusIcons[status] || '⚪'
    }))
  ]

  const severityOptions = [
    { value: 'all', label: 'All Severity', icon: '🔥' },
    ...(constants?.severities || []).map(severity => ({
      value: severity,
      label: severity.charAt(0).toUpperCase() + severity.slice(1),
      icon: severityIcons[severity] || '⚪'
    }))
  ]

  const FilterGroup = ({ title, options, filterKey, currentValue }) => (
    <div className="mb-4">
      <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
        {title}
      </h3>
      <div className="space-y-1">
        {options.map((option) => (
          <button
            key={option.value}
            onClick={() => onFilterChange(filterKey, option.value)}
            className={`w-full text-left px-2 py-1.5 rounded text-xs flex items-center gap-2 transition-colors ${
              currentValue === option.value
                ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 font-medium'
                : 'hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400'
            }`}
          >
            <span className={currentValue === option.value ? 'text-sm' : 'text-xs opacity-70'}>
              {option.icon}
            </span>
            <span className="flex-1">{option.label}</span>
            {option.count !== undefined && (
              <span className="text-xs text-gray-400">({option.count})</span>
            )}
          </button>
        ))}
      </div>
    </div>
  )

  // Show loading skeleton while constants load
  if (loading) {
    return (
      <div className="px-4 pb-4 border-t border-gray-200 dark:border-gray-700 mt-4 pt-4">
        <h2 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
          Filters
        </h2>
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded"></div>
          <div className="space-y-2">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-6 bg-gray-200 dark:bg-gray-700 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="px-4 pb-4 border-t border-gray-200 dark:border-gray-700 mt-4 pt-4">
      <h2 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
        Filters
      </h2>

      {/* Chapter Filter */}
      <div className="mb-4">
        <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
          Chapter
        </h3>
        <select
          value={filters.chapter || 'all'}
          onChange={(e) => onFilterChange('chapter', e.target.value)}
          className="w-full px-2 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
        >
          <option value="all">All Chapters ({stats?.total || 0})</option>
          {chapters
            .filter(num => {
              const chapterStats = stats?.by_chapter?.find(c => c.chapter_number === num)
              return (chapterStats?.bug_count || 0) > 0
            })
            .map(num => {
              const chapterStats = stats?.by_chapter?.find(c => c.chapter_number === num)
              const count = chapterStats?.bug_count || 0
              return (
                <option key={num} value={num}>
                  Chapter {num} ({count})
                </option>
              )
            })}
        </select>
      </div>

      <FilterGroup
        title="Type"
        options={typeOptions}
        filterKey="type"
        currentValue={filters.type || 'all'}
      />

      <FilterGroup
        title="Status"
        options={statusOptions}
        filterKey="status"
        currentValue={filters.status || 'all'}
      />

      <FilterGroup
        title="Severity"
        options={severityOptions}
        filterKey="severity"
        currentValue={filters.severity || 'all'}
      />
    </div>
  )
}
