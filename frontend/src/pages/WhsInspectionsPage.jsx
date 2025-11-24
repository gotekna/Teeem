import { useState, useEffect } from 'react'
import { PlusIcon, PlayIcon, CheckCircleIcon } from '@heroicons/react/24/outline'
import TrapidTableView from '../components/documentation/TrapidTableView'
import { api } from '../api'

const INSPECTION_COLUMNS = [
  { key: 'select', label: '', resizable: false, sortable: false, filterable: false, width: 32 },
  { key: 'inspection_number', label: 'Inspection #', resizable: true, sortable: true, filterable: true, filterType: 'text', width: 180, tooltip: 'Unique inspection identifier' },
  { key: 'inspection_type', label: 'Type', resizable: true, sortable: true, filterable: true, filterType: 'dropdown', width: 140, tooltip: 'Inspection type (daily/weekly/monthly/etc)' },
  { key: 'status', label: 'Status', resizable: true, sortable: true, filterable: true, filterType: 'dropdown', width: 140, tooltip: 'Inspection status' },
  { key: 'construction_name', label: 'Construction', resizable: true, sortable: true, filterable: true, filterType: 'text', width: 200, tooltip: 'Associated construction project' },
  { key: 'scheduled_date', label: 'Scheduled Date', resizable: true, sortable: true, filterable: false, width: 140, tooltip: 'Scheduled inspection date' },
  { key: 'compliance_score', label: 'Compliance %', resizable: true, sortable: true, filterable: false, width: 130, tooltip: 'Compliance score percentage' },
  { key: 'overall_pass', label: 'Result', resizable: true, sortable: true, filterable: true, filterType: 'dropdown', width: 100, tooltip: 'Pass/Fail result' },
  { key: 'critical_issues_found', label: 'Critical Issues', resizable: true, sortable: true, filterable: true, filterType: 'dropdown', width: 130, tooltip: 'Critical issues flagged' },
  { key: 'inspector_name', label: 'Inspector', resizable: true, sortable: true, filterable: false, width: 150, tooltip: 'Assigned inspector' },
  { key: 'created_at', label: 'Created', resizable: true, sortable: true, filterable: false, width: 180, tooltip: 'Creation date' },
]

export default function WhsInspectionsPage() {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showAddModal, setShowAddModal] = useState(false)

  useEffect(() => {
    fetchInspections()
  }, [])

  const fetchInspections = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await api.get('/api/v1/whs_inspections')

      if (response.data.success) {
        // Transform data for table display
        const transformedData = response.data.data.map(inspection => ({
          id: inspection.id,
          inspection_number: inspection.inspection_number,
          inspection_type: inspection.inspection_type,
          status: inspection.status,
          construction_name: inspection.construction?.name || 'N/A',
          scheduled_date: inspection.scheduled_date,
          compliance_score: inspection.compliance_score ? `${inspection.compliance_score}%` : 'N/A',
          overall_pass: inspection.overall_pass === true ? 'Pass' : inspection.overall_pass === false ? 'Fail' : 'Pending',
          critical_issues_found: inspection.critical_issues_found,
          inspector_name: inspection.inspector_user?.name || 'Unassigned',
          created_at: inspection.created_at,
          // Store full object for actions
          _raw: inspection
        }))
        setData(transformedData)
      } else {
        setError(response.data.error || 'Failed to load inspections')
      }
    } catch (err) {
      console.error('Error fetching inspections:', err)
      setError('Failed to load inspection data')
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = async (entry) => {
    console.log('Edit inspection:', entry)
    alert('Edit functionality - to be implemented with inspection form modal')
  }

  const handleDelete = async (entry) => {
    if (!confirm(`Are you sure you want to delete inspection ${entry.inspection_number}?`)) return

    try {
      const response = await api.delete(`/api/v1/whs_inspections/${entry.id}`)

      if (response.data.success) {
        setData(prevData => prevData.filter(item => item.id !== entry.id))
      } else {
        alert(response.data.error || 'Failed to delete inspection')
      }
    } catch (err) {
      console.error('Error deleting inspection:', err)
      alert(`Failed to delete inspection: ${err.message}`)
    }
  }

  const handleAddNew = () => {
    setShowAddModal(true)
  }

  const handleImport = () => {
    alert('Import inspections - This would open a file picker')
  }

  const handleExport = () => {
    console.log('Export inspection data:', data)
    alert('Export functionality - see console')
  }

  const handleStartInspection = async (entry) => {
    try {
      const response = await api.post(`/api/v1/whs_inspections/${entry.id}/start`)

      if (response.data.success) {
        await fetchInspections()
      } else {
        alert(response.data.error || 'Failed to start inspection')
      }
    } catch (err) {
      console.error('Error starting inspection:', err)
      alert(`Failed to start inspection: ${err.message}`)
    }
  }

  const handleCompleteInspection = async (entry) => {
    try {
      const response = await api.post(`/api/v1/whs_inspections/${entry.id}/complete`)

      if (response.data.success) {
        await fetchInspections()
      } else {
        alert(response.data.error || 'Failed to complete inspection')
      }
    } catch (err) {
      console.error('Error completing inspection:', err)
      alert(`Failed to complete inspection: ${err.message}`)
    }
  }

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading inspections...</p>
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
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          WHS Site Inspections
        </h1>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          Schedule and conduct site safety inspections with compliance scoring and action tracking.
        </p>
      </div>

      <TrapidTableView
        category="whs_inspections"
        entries={data}
        columns={INSPECTION_COLUMNS}
        onEdit={handleEdit}
        onDelete={handleDelete}
        enableImport={true}
        enableExport={true}
        onImport={handleImport}
        onExport={handleExport}
        customActions={
          <button
            onClick={handleAddNew}
            className="inline-flex items-center gap-2 px-4 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors h-[42px]"
          >
            <PlusIcon className="h-5 w-5" />
            Schedule Inspection
          </button>
        }
      />

      {/* Add Modal - Placeholder */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Schedule New Inspection</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
              >
                ×
              </button>
            </div>

            <div className="px-6 py-4">
              <p className="text-gray-600 dark:text-gray-400">
                Inspection scheduling form will include:
              </p>
              <ul className="mt-4 list-disc list-inside space-y-2 text-sm text-gray-600 dark:text-gray-400">
                <li>Inspection type (daily/weekly/monthly/pre-start/etc)</li>
                <li>Template selection</li>
                <li>Construction project</li>
                <li>Scheduled date and time</li>
                <li>Inspector assignment</li>
                <li>Location and weather conditions</li>
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
