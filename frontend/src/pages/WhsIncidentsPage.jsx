import { useState, useEffect } from 'react'
import { PlusIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline'
import TrapidTableView from '../components/documentation/TrapidTableView'
import { api } from '../api'

const INCIDENT_COLUMNS = [
  { key: 'select', label: '', resizable: false, sortable: false, filterable: false, width: 32 },
  { key: 'incident_number', label: 'Incident #', resizable: true, sortable: true, filterable: true, filterType: 'text', width: 180, tooltip: 'Unique incident identifier' },
  { key: 'incident_date', label: 'Date', resizable: true, sortable: true, filterable: false, width: 140, tooltip: 'Date incident occurred' },
  { key: 'incident_category', label: 'Category', resizable: true, sortable: true, filterable: true, filterType: 'dropdown', width: 160, tooltip: 'Incident category (near miss/LTI/etc)' },
  { key: 'severity_level', label: 'Severity', resizable: true, sortable: true, filterable: true, filterType: 'dropdown', width: 120, tooltip: 'Severity level' },
  { key: 'status', label: 'Status', resizable: true, sortable: true, filterable: true, filterType: 'dropdown', width: 160, tooltip: 'Investigation status' },
  { key: 'construction_name', label: 'Construction', resizable: true, sortable: true, filterable: true, filterType: 'text', width: 200, tooltip: 'Associated construction project' },
  { key: 'what_happened', label: 'Description', resizable: true, sortable: false, filterable: true, filterType: 'text', width: 300, tooltip: 'Incident description' },
  { key: 'reported_by_name', label: 'Reported By', resizable: true, sortable: true, filterable: false, width: 150, tooltip: 'User who reported incident' },
  { key: 'workcov_required', label: 'WorkCover', resizable: true, sortable: true, filterable: true, filterType: 'dropdown', width: 120, tooltip: 'WorkCover notification required' },
  { key: 'created_at', label: 'Reported', resizable: true, sortable: true, filterable: false, width: 180, tooltip: 'Report date' },
]

export default function WhsIncidentsPage() {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showAddModal, setShowAddModal] = useState(false)

  useEffect(() => {
    fetchIncidents()
  }, [])

  const fetchIncidents = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await api.get('/api/v1/whs_incidents')

      if (response.data.success) {
        // Transform data for table display
        const transformedData = response.data.data.map(incident => ({
          id: incident.id,
          incident_number: incident.incident_number,
          incident_date: incident.incident_date,
          incident_category: incident.incident_category,
          severity_level: incident.severity_level,
          status: incident.status,
          construction_name: incident.construction?.name || 'N/A',
          what_happened: incident.what_happened,
          reported_by_name: incident.reported_by_user?.name || 'Unknown',
          workcov_required: incident.workcov_notification_required,
          created_at: incident.created_at,
          // Store full object for actions
          _raw: incident
        }))
        setData(transformedData)
      } else {
        setError(response.data.error || 'Failed to load incidents')
      }
    } catch (err) {
      console.error('Error fetching incidents:', err)
      setError('Failed to load incident data')
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = async (entry) => {
    console.log('Edit incident:', entry)
    alert('Edit functionality - to be implemented with incident form modal')
  }

  const handleDelete = async (entry) => {
    if (!confirm(`Are you sure you want to delete incident ${entry.incident_number}?`)) return

    try {
      const response = await api.delete(`/api/v1/whs_incidents/${entry.id}`)

      if (response.data.success) {
        setData(prevData => prevData.filter(item => item.id !== entry.id))
      } else {
        alert(response.data.error || 'Failed to delete incident')
      }
    } catch (err) {
      console.error('Error deleting incident:', err)
      alert(`Failed to delete incident: ${err.message}`)
    }
  }

  const handleAddNew = () => {
    setShowAddModal(true)
  }

  const handleImport = () => {
    alert('Import incidents - This would open a file picker')
  }

  const handleExport = () => {
    console.log('Export incident data:', data)
    alert('Export functionality - see console')
  }

  const handleInvestigate = async (entry) => {
    try {
      const response = await api.post(`/api/v1/whs_incidents/${entry.id}/investigate`)

      if (response.data.success) {
        await fetchIncidents()
      } else {
        alert(response.data.error || 'Failed to start investigation')
      }
    } catch (err) {
      console.error('Error starting investigation:', err)
      alert(`Failed to start investigation: ${err.message}`)
    }
  }

  const handleClose = async (entry) => {
    const closureNotes = prompt('Please provide closure notes:')
    if (!closureNotes) return

    try {
      const response = await api.post(`/api/v1/whs_incidents/${entry.id}/close`, {
        closure_notes: closureNotes
      })

      if (response.data.success) {
        await fetchIncidents()
      } else {
        alert(response.data.error || 'Failed to close incident')
      }
    } catch (err) {
      console.error('Error closing incident:', err)
      alert(`Failed to close incident: ${err.message}`)
    }
  }

  const handleNotifyWorkcov = async (entry) => {
    const reference = prompt('Enter WorkCover reference number:')
    if (!reference) return

    try {
      const response = await api.post(`/api/v1/whs_incidents/${entry.id}/notify_workcov`, {
        workcov_reference_number: reference
      })

      if (response.data.success) {
        await fetchIncidents()
      } else {
        alert(response.data.error || 'Failed to record WorkCover notification')
      }
    } catch (err) {
      console.error('Error notifying WorkCover:', err)
      alert(`Failed to record WorkCover notification: ${err.message}`)
    }
  }

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading incidents...</p>
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
          <ExclamationTriangleIcon className="h-7 w-7 text-orange-500" />
          WHS Incident Reporting
        </h1>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          Report and investigate workplace incidents with WorkCover Queensland compliance tracking.
        </p>
      </div>

      <TrapidTableView
        category="whs_incidents"
        entries={data}
        columns={INCIDENT_COLUMNS}
        onEdit={handleEdit}
        onDelete={handleDelete}
        enableImport={true}
        enableExport={true}
        onImport={handleImport}
        onExport={handleExport}
        customActions={
          <button
            onClick={handleAddNew}
            className="inline-flex items-center gap-2 px-4 bg-orange-600 hover:bg-orange-700 text-white text-sm font-medium rounded-lg transition-colors h-[42px]"
          >
            <PlusIcon className="h-5 w-5" />
            Report Incident
          </button>
        }
      />

      {/* Add Modal - Placeholder */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Report New Incident</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
              >
                ×
              </button>
            </div>

            <div className="px-6 py-4">
              <p className="text-gray-600 dark:text-gray-400">
                Incident report form will include:
              </p>
              <ul className="mt-4 list-disc list-inside space-y-2 text-sm text-gray-600 dark:text-gray-400">
                <li>Incident date and time</li>
                <li>Category (near miss/first aid/LTI/medical treatment/etc)</li>
                <li>Severity level (low/medium/high/critical)</li>
                <li>What happened (detailed description)</li>
                <li>Where it happened (location)</li>
                <li>Who was involved (injured parties)</li>
                <li>Immediate action taken</li>
                <li>Witnesses (JSONB array)</li>
                <li>Photo uploads</li>
                <li>Construction project link</li>
              </ul>
            </div>

            <div className="sticky bottom-0 bg-gray-50 dark:bg-gray-700 px-6 py-4 flex items-center justify-end gap-3 border-t border-gray-200 dark:border-gray-600">
              <button
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-600 border border-gray-300 dark:border-gray-500 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-500 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
