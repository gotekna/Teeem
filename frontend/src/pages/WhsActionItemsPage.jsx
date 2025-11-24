import { useState, useEffect } from 'react'
import { PlusIcon, CheckCircleIcon } from '@heroicons/react/24/outline'
import TrapidTableView from '../components/documentation/TrapidTableView'
import { api } from '../api'

const ACTION_ITEM_COLUMNS = [
  { key: 'select', label: '', resizable: false, sortable: false, filterable: false, width: 32 },
  { key: 'title', label: 'Title', resizable: true, sortable: true, filterable: true, filterType: 'text', width: 300, tooltip: 'Action item title' },
  { key: 'action_type', label: 'Type', resizable: true, sortable: true, filterable: true, filterType: 'dropdown', width: 140, tooltip: 'Action type (immediate/short_term/etc)' },
  { key: 'priority', label: 'Priority', resizable: true, sortable: true, filterable: true, filterType: 'dropdown', width: 120, tooltip: 'Priority level' },
  { key: 'status', label: 'Status', resizable: true, sortable: true, filterable: true, filterType: 'dropdown', width: 140, tooltip: 'Current status' },
  { key: 'source_description', label: 'Source', resizable: true, sortable: false, filterable: false, width: 250, tooltip: 'Source (inspection/incident/hazard)' },
  { key: 'assigned_to_name', label: 'Assigned To', resizable: true, sortable: true, filterable: false, width: 150, tooltip: 'Assigned user' },
  { key: 'due_date', label: 'Due Date', resizable: true, sortable: true, filterable: false, width: 140, tooltip: 'Due date' },
  { key: 'days_until_due', label: 'Days Remaining', resizable: true, sortable: true, filterable: false, width: 140, tooltip: 'Days until due' },
  { key: 'created_at', label: 'Created', resizable: true, sortable: true, filterable: false, width: 180, tooltip: 'Creation date' },
]

export default function WhsActionItemsPage() {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetchActionItems()
  }, [])

  const fetchActionItems = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await api.get('/api/v1/whs_action_items')

      if (response.data.success) {
        const transformedData = response.data.data.map(item => ({
          id: item.id,
          title: item.title,
          action_type: item.action_type,
          priority: item.priority,
          status: item.status,
          source_description: item.actionable?.source_description || 'N/A',
          assigned_to_name: item.assigned_to_user?.name || 'Unassigned',
          due_date: item.due_date || 'No deadline',
          days_until_due: item.days_until_due !== null ? item.days_until_due : 'N/A',
          created_at: item.created_at,
          _raw: item
        }))
        setData(transformedData)
      } else {
        setError(response.data.error || 'Failed to load action items')
      }
    } catch (err) {
      console.error('Error fetching action items:', err)
      setError('Failed to load action items')
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = (entry) => {
    alert('Edit functionality - to be implemented')
  }

  const handleDelete = async (entry) => {
    if (!confirm(`Delete action item "${entry.title}"?`)) return

    try {
      const response = await api.delete(`/api/v1/whs_action_items/${entry.id}`)
      if (response.data.success) {
        setData(prevData => prevData.filter(item => item.id !== entry.id))
      } else {
        alert(response.data.error || 'Failed to delete action item')
      }
    } catch (err) {
      alert(`Failed to delete: ${err.message}`)
    }
  }

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading action items...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-red-800 dark:text-red-200">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <CheckCircleIcon className="h-7 w-7 text-green-500" />
          WHS Action Items
        </h1>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          Track corrective actions from inspections, incidents, and hazard assessments.
        </p>
      </div>

      <TrapidTableView
        category="whs_action_items"
        entries={data}
        columns={ACTION_ITEM_COLUMNS}
        onEdit={handleEdit}
        onDelete={handleDelete}
        enableImport={true}
        enableExport={true}
        customActions={
          <button
            onClick={() => alert('Create action item - to be implemented')}
            className="inline-flex items-center gap-2 px-4 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors h-[42px]"
          >
            <PlusIcon className="h-5 w-5" />
            Create Action Item
          </button>
        }
      />
    </div>
  )
}
