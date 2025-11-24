import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  PlusIcon,
  TrashIcon,
  ChevronDownIcon,
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
  ArrowPathRoundedSquareIcon,
  UserIcon,
  CalculatorIcon,
  FunnelIcon,
} from '@heroicons/react/24/outline'
import { Menu, MenuButton, MenuItem, MenuItems } from '@headlessui/react'
import { api } from '../../api'

const COLUMN_TYPES = [
  // Text Types
  { value: 'single_line_text', label: 'Single line of Text', icon: DocumentTextIcon, category: 'Text' },
  { value: 'email', label: 'Email', icon: EnvelopeIcon, category: 'Text' },
  { value: 'multiple_lines_text', label: 'Multiple lines of Text', icon: DocumentIcon, category: 'Text' },
  { value: 'phone', label: 'Phone', icon: PhoneIcon, category: 'Text' },
  { value: 'url', label: 'URL', icon: LinkIcon, category: 'Text' },

  // Date/Time Types
  { value: 'date', label: 'Date', icon: CalendarIcon, category: 'Date/Time' },
  { value: 'date_and_time', label: 'Date and Time', icon: ClockIcon, category: 'Date/Time' },

  // Selection Types
  { value: 'choice', label: 'Choice', icon: ChevronDownIcon, category: 'Selection' },
  { value: 'boolean', label: 'Boolean', icon: CheckCircleIcon, category: 'Selection' },

  // Number Types
  { value: 'number', label: 'Number', icon: HashtagIcon, category: 'Number' },
  { value: 'whole_number', label: 'Whole Number', icon: HashtagIcon, category: 'Number' },
  { value: 'percentage', label: 'Percentage', icon: HashtagIcon, category: 'Number' },
  { value: 'currency', label: 'Currency', icon: CurrencyDollarIcon, category: 'Number' },

  // Relationship Types
  { value: 'lookup', label: 'Lookup', icon: ArrowPathRoundedSquareIcon, category: 'Relationship' },
  { value: 'multiple_lookups', label: 'Multiple Lookups', icon: ArrowPathRoundedSquareIcon, category: 'Relationship' },
  { value: 'user', label: 'User', icon: UserIcon, category: 'Relationship' },

  // Advanced Types
  { value: 'computed', label: 'Computed', icon: CalculatorIcon, category: 'Advanced' },
  { value: 'subquery', label: 'Subquery', icon: FunnelIcon, category: 'Advanced' },
]

export default function TableBuilder() {
  const navigate = useNavigate()
  const [tableName, setTableName] = useState('Untitled Table')
  const [isEditingName, setIsEditingName] = useState(false)
  const [columns, setColumns] = useState([
    { id: 1, name: 'Name', column_type: 'single_line_text', is_title: true },
    { id: 2, name: 'Email', column_type: 'email', is_title: false },
    { id: 3, name: 'Phone', column_type: 'single_line_text', is_title: false },
    { id: 4, name: 'Status', column_type: 'single_line_text', is_title: false },
    { id: 5, name: 'Created Date', column_type: 'date', is_title: false },
  ])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const addColumn = () => {
    const newColumn = {
      id: Date.now(),
      name: `Column ${columns.length}`,
      column_type: 'single_line_text',
      is_title: false
    }
    setColumns([...columns, newColumn])
  }

  const removeColumn = (id) => {
    if (columns.length === 1) {
      alert('Tables must have at least one column')
      return
    }
    setColumns(columns.filter(col => col.id !== id))
  }

  const updateColumn = (id, updates) => {
    setColumns(columns.map(col =>
      col.id === id ? { ...col, ...updates } : col
    ))
  }

  const getTypeIcon = (type) => {
    const IconComponent = COLUMN_TYPES.find(t => t.value === type)?.icon || DocumentTextIcon
    return <IconComponent className="h-4 w-4 text-gray-500 dark:text-gray-400" />
  }

  const getTypeLabel = (type) => {
    return COLUMN_TYPES.find(t => t.value === type)?.label || 'Text'
  }

  const handleSave = async () => {
    if (!tableName.trim()) {
      setError('Table name is required')
      return
    }

    if (columns.length === 0) {
      setError('At least one column is required')
      return
    }

    setSaving(true)
    setError(null)

    try {
      // Step 1: Create the table
      const tableResponse = await api.post('/api/v1/tables', {
        table: {
          name: tableName,
          searchable: true
        }
      })

      if (!tableResponse.success || !tableResponse.table) {
        setError('Failed to create table')
        return
      }

      const tableId = tableResponse.table.id

      // Step 2: Create each column
      for (let index = 0; index < columns.length; index++) {
        const col = columns[index]
        const columnData = {
          name: col.name,
          column_name: col.name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, ''),
          column_type: col.column_type,
          is_title: index === 0, // First column is title
          searchable: true,
          required: false
        }

        const columnResponse = await api.post(`/api/v1/tables/${tableId}/columns`, {
          column: columnData
        })

        if (!columnResponse.success) {
          setError(`Failed to create column: ${col.name}`)
          return
        }
      }

      // Step 3: Navigate to the spreadsheet view
      navigate(`/tables/${tableId}`)
    } catch (err) {
      console.error('Table creation error:', err)
      setError(err.response?.data?.error || err.message || 'Failed to create table')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="h-full flex flex-col bg-white dark:bg-gray-900">
      {/* Header - Google Sheets style */}
      <div className="border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-x-4">
            {isEditingName ? (
              <input
                type="text"
                value={tableName}
                onChange={(e) => setTableName(e.target.value)}
                onBlur={() => setIsEditingName(false)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') setIsEditingName(false)
                }}
                autoFocus
                className="text-lg font-normal text-gray-900 dark:text-white bg-transparent border-b border-blue-500 focus:outline-none"
              />
            ) : (
              <h1
                onClick={() => setIsEditingName(true)}
                className="text-lg font-normal text-gray-900 dark:text-white cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 px-2 py-1 rounded"
              >
                {tableName}
              </h1>
            )}
          </div>
          <div className="flex items-center gap-x-2">
            <button
              onClick={() => navigate('/designer')}
              className="px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-3 py-1.5 text-sm bg-blue-600 text-white hover:bg-blue-700 rounded disabled:opacity-50"
            >
              {saving ? 'Creating...' : 'Create Table'}
            </button>
          </div>
        </div>
        {error && (
          <div className="mt-2 text-sm text-red-600 dark:text-red-400">
            {error}
          </div>
        )}
      </div>

      {/* Spreadsheet Grid - Google Sheets style */}
      <div className="flex-1 overflow-auto bg-white dark:bg-gray-900">
        <div className="inline-block min-w-full align-middle">
          <table className="min-w-full border-collapse">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-800/50">
                {/* Row number header */}
                <th className="sticky left-0 z-20 bg-gray-50 dark:bg-gray-800/50 border-r border-b border-gray-200 dark:border-gray-700 w-12">
                  <span className="text-xs font-medium text-gray-500 dark:text-gray-400"></span>
                </th>
                {columns.map((column) => (
                  <th
                    key={column.id}
                    className="border-r border-b border-gray-200 dark:border-gray-700 px-3 py-2.5 text-left min-w-[200px] group relative"
                  >
                    <div className="flex items-center gap-x-2">
                      {/* Column Type Dropdown */}
                      <Menu as="div" className="relative">
                        <MenuButton className="flex items-center gap-x-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded px-1.5 py-1">
                          {getTypeIcon(column.column_type)}
                          <ChevronDownIcon className="h-3 w-3 text-gray-500 dark:text-gray-400" />
                        </MenuButton>
                        <MenuItems className="absolute left-0 z-30 mt-2 w-64 origin-top-left rounded-md bg-white dark:bg-gray-800 py-1 shadow-lg ring-1 ring-black/5 dark:ring-white/10 focus:outline-none max-h-96 overflow-y-auto">
                          {['Text', 'Date/Time', 'Selection', 'Number', 'Relationship', 'Advanced'].map((category) => (
                            <div key={category}>
                              <div className="px-3 py-1.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                {category}
                              </div>
                              {COLUMN_TYPES.filter(type => type.category === category).map((type) => {
                                const Icon = type.icon
                                return (
                                  <MenuItem key={type.value}>
                                    <button
                                      onClick={() => updateColumn(column.id, { column_type: type.value })}
                                      className="flex items-center gap-x-2 w-full px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                                    >
                                      <Icon className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                                      <span>{type.label}</span>
                                    </button>
                                  </MenuItem>
                                )
                              })}
                            </div>
                          ))}
                        </MenuItems>
                      </Menu>

                      {/* Column Name Input */}
                      <input
                        type="text"
                        value={column.name}
                        onChange={(e) => updateColumn(column.id, { name: e.target.value })}
                        placeholder="Column name"
                        className="flex-1 bg-transparent border-none focus:outline-none focus:ring-0 text-sm font-medium text-gray-700 dark:text-gray-300 p-0"
                      />

                      {/* Delete Button */}
                      <button
                        onClick={() => removeColumn(column.id)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
                      >
                        <TrashIcon className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                      </button>
                    </div>
                  </th>
                ))}

                {/* Add Column Button */}
                <th className="border-r border-b border-gray-200 dark:border-gray-700 px-3 py-2 w-12">
                  <button
                    onClick={addColumn}
                    className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
                    title="Add column"
                  >
                    <PlusIcon className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                  </button>
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-900">
              {/* Sample Rows */}
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((rowNum) => (
                <tr key={rowNum} className="group hover:bg-blue-50/50 dark:hover:bg-blue-900/10">
                  <td className="sticky left-0 z-10 bg-gray-50 dark:bg-gray-800/50 group-hover:bg-blue-100/50 dark:group-hover:bg-blue-900/20 border-r border-b border-gray-200 dark:border-gray-700 px-3 text-center h-11">
                    <span className="text-xs text-gray-500 dark:text-gray-400">{rowNum}</span>
                  </td>
                  {columns.map((column) => (
                    <td
                      key={column.id}
                      className="border-r border-b border-gray-200 dark:border-gray-700 px-3 text-sm text-gray-400 dark:text-gray-600 bg-white dark:bg-gray-900 group-hover:bg-blue-50/50 dark:group-hover:bg-blue-900/10 h-11"
                    >

                    </td>
                  ))}
                  <td className="border-r border-b border-gray-200 dark:border-gray-700 h-11"></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Footer hint */}
      <div className="border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-4 py-2">
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Click column headers to edit names and types. Add data after creating the table.
        </p>
      </div>
    </div>
  )
}
