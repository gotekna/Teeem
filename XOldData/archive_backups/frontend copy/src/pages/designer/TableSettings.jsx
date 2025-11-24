import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { ArrowLeftIcon } from '@heroicons/react/24/outline'
import { api } from '../../api'
import ColumnManager from '../../components/designer/ColumnManager'

export default function TableSettings() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [table, setTable] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState('columns')

  useEffect(() => {
    fetchTable()
  }, [id])

  const fetchTable = async () => {
    try {
      setLoading(true)
      const response = await api.get(`/api/v1/tables/${id}`)
      if (response.success && response.table) {
        setTable(response.table)
      } else {
        setError('Failed to load table')
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleTableUpdate = async (updates) => {
    try {
      setSaving(true)
      const response = await api.put(`/api/v1/tables/${id}`, { table: updates })
      if (response.success && response.table) {
        setTable(response.table)
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteTable = async () => {
    if (!confirm(`Are you sure you want to delete "${table.name}"? This will delete all data in this table. This action cannot be undone.`)) {
      return
    }

    try {
      await api.delete(`/api/v1/tables/${id}`)
      navigate('/designer')
    } catch (err) {
      setError(err.message)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading table settings...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-md bg-red-50 p-4">
        <div className="text-sm text-red-800">Error: {error}</div>
      </div>
    )
  }

  if (!table) {
    return (
      <div className="rounded-md bg-yellow-50 p-4">
        <div className="text-sm text-yellow-800">Table not found</div>
      </div>
    )
  }

  const tabs = [
    { name: 'Columns', value: 'columns' },
    { name: 'Settings', value: 'settings' },
    { name: 'Relationships', value: 'relationships' },
  ]

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <Link
          to="/designer"
          className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
        >
          <ArrowLeftIcon className="h-4 w-4 mr-1" />
          Back to Designer
        </Link>
        <div className="mt-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{table.name}</h1>
            {table.description && (
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{table.description}</p>
            )}
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {table.record_count || 0} records • {table.columns?.length || 0} columns
            </p>
          </div>
          <button
            onClick={handleDeleteTable}
            className="rounded-md bg-red-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-500"
          >
            Delete Table
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-white/10">
        <nav className="-mb-px flex space-x-8">
          {tabs.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setActiveTab(tab.value)}
              className={`
                whitespace-nowrap border-b-2 px-1 pb-4 text-sm font-medium
                ${activeTab === tab.value
                  ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                  : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                }
              `}
            >
              {tab.name}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="mt-6">
        {activeTab === 'columns' && (
          <ColumnManager table={table} onUpdate={fetchTable} />
        )}

        {activeTab === 'settings' && (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Table Name
              </label>
              <input
                type="text"
                value={table.name}
                onChange={(e) => setTable({ ...table, name: e.target.value })}
                onBlur={() => handleTableUpdate({ name: table.name })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm dark:bg-white/5 dark:border-white/10 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Description
              </label>
              <textarea
                value={table.description || ''}
                onChange={(e) => setTable({ ...table, description: e.target.value })}
                onBlur={() => handleTableUpdate({ description: table.description })}
                rows={3}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm dark:bg-white/5 dark:border-white/10 dark:text-white"
              />
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                checked={table.searchable}
                onChange={(e) => {
                  setTable({ ...table, searchable: e.target.checked })
                  handleTableUpdate({ searchable: e.target.checked })
                }}
                className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-600"
              />
              <label className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
                Make this table searchable
              </label>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Database Table Name
              </label>
              <input
                type="text"
                value={table.database_table_name}
                disabled
                className="mt-1 block w-full rounded-md border-gray-300 bg-gray-50 shadow-sm sm:text-sm dark:bg-white/5 dark:border-white/10 dark:text-gray-400"
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                The actual database table name (cannot be changed)
              </p>
            </div>
          </div>
        )}

        {activeTab === 'relationships' && (
          <div className="text-center py-12">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Relationships feature coming soon
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
