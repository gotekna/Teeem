import { useState, useEffect } from 'react'
import { api } from '../../api'

export default function LookupCell({ column, value, onChange, isEditing }) {
  const [options, setOptions] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  // Fetch lookup options when in edit mode
  useEffect(() => {
    const fetchOptions = async () => {
      if (!isEditing || !column.lookup_table_id) return

      setLoading(true)
      setError(null)

      try {
        const response = await api.get(
          `/api/v1/tables/${column.table_id}/columns/${column.id}/lookup_options`
        )
        setOptions(response.data.options || [])
      } catch (err) {
        console.error('Error fetching lookup options:', err)
        setError('Failed to load options')
        setOptions([])
      } finally {
        setLoading(false)
      }
    }

    fetchOptions()
  }, [isEditing, column.lookup_table_id, column.table_id, column.id])

  // Display mode - show the display value
  if (!isEditing) {
    if (!value) {
      return <span className="text-gray-400 dark:text-gray-600">-</span>
    }

    // Value is an object with { id, display } from backend
    const displayValue = typeof value === 'object' ? value.display : value

    return (
      <span className="text-gray-900 dark:text-gray-100">
        {displayValue}
      </span>
    )
  }

  // Edit mode - show dropdown
  if (loading) {
    return (
      <span className="text-gray-500 dark:text-gray-400 text-sm">
        Loading...
      </span>
    )
  }

  if (error) {
    return (
      <span className="text-red-600 dark:text-red-400 text-sm">
        {error}
      </span>
    )
  }

  // Get the current ID value (handle both object and primitive values)
  const currentId = typeof value === 'object' ? value?.id : value

  return (
    <select
      value={currentId || ''}
      onChange={(e) => onChange(e.target.value || null)}
      className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm dark:bg-white/5 dark:border-white/10 dark:text-white"
    >
      <option value="">Select...</option>
      {options.map((opt) => (
        <option key={opt.id} value={opt.id}>
          {opt.display}
        </option>
      ))}
    </select>
  )
}
