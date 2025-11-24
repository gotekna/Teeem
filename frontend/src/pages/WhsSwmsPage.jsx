import { useState, useEffect } from 'react'
import { PlusIcon, CheckCircleIcon, XCircleIcon, ClockIcon } from '@heroicons/react/24/outline'
import TrapidTableView from '../components/documentation/TrapidTableView'
import { api } from '../api'

const SWMS_COLUMNS = [
  { key: 'select', label: '', resizable: false, sortable: false, filterable: false, width: 32 },
  { key: 'swms_number', label: 'SWMS Number', resizable: true, sortable: true, filterable: true, filterType: 'text', width: 180, tooltip: 'Unique SWMS identifier (SWMS-YYYYMMDD-XXX)' },
  { key: 'title', label: 'Title', resizable: true, sortable: true, filterable: true, filterType: 'text', width: 300, tooltip: 'SWMS title/description' },
  { key: 'version', label: 'Version', resizable: true, sortable: true, filterable: false, width: 100, tooltip: 'SWMS version number' },
  { key: 'status', label: 'Status', resizable: true, sortable: true, filterable: true, filterType: 'dropdown', width: 140, tooltip: 'Approval status' },
  { key: 'construction_name', label: 'Construction', resizable: true, sortable: true, filterable: true, filterType: 'text', width: 200, tooltip: 'Associated construction project' },
  { key: 'company_wide', label: 'Company Wide', resizable: true, sortable: true, filterable: true, filterType: 'dropdown', width: 130, tooltip: 'Applies to all projects' },
  { key: 'high_risk_work', label: 'High Risk', resizable: true, sortable: true, filterable: true, filterType: 'dropdown', width: 120, tooltip: 'High risk work flag' },
  { key: 'created_by_name', label: 'Created By', resizable: true, sortable: true, filterable: false, width: 150, tooltip: 'User who created SWMS' },
  { key: 'approved_by_name', label: 'Approved By', resizable: true, sortable: true, filterable: false, width: 150, tooltip: 'WPHS Appointee who approved' },
  { key: 'created_at', label: 'Created', resizable: true, sortable: true, filterable: false, width: 180, tooltip: 'Creation date' },
]

export default function WhsSwmsPage() {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [selectedSwms, setSelectedSwms] = useState(null)
  const [showActionModal, setShowActionModal] = useState(false)
  const [actionType, setActionType] = useState(null) // 'approve', 'reject', 'supersede'

  useEffect(() => {
    fetchSwms()
  }, [])

  const fetchSwms = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await api.get('/api/v1/whs_swms')

      if (response.data.success) {
        // Transform data for table display
        const transformedData = response.data.data.map(swms => ({
          id: swms.id,
          swms_number: swms.swms_number,
          title: swms.title,
          version: swms.version,
          status: swms.status,
          construction_name: swms.construction?.name || (swms.company_wide ? 'All Projects' : 'N/A'),
          company_wide: swms.company_wide,
          high_risk_work: swms.high_risk_work,
          created_by_name: swms.created_by?.name || 'Unknown',
          approved_by_name: swms.approved_by?.name || '-',
          created_at: swms.created_at,
          // Store full object for modal actions
          _raw: swms
        }))
        setData(transformedData)
      } else {
        setError(response.data.error || 'Failed to load SWMS')
      }
    } catch (err) {
      console.error('Error fetching SWMS:', err)
      setError('Failed to load SWMS data')
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = async (entry) => {
    try {
      // Open edit modal (to be implemented)
      console.log('Edit SWMS:', entry)
      alert('Edit functionality - to be implemented with full form modal')
    } catch (err) {
      console.error('Error editing SWMS:', err)
      alert(`Failed to update SWMS: ${err.message}`)
    }
  }

  const handleDelete = async (entry) => {
    if (!confirm(`Are you sure you want to delete SWMS ${entry.swms_number}?`)) return

    try {
      const response = await api.delete(`/api/v1/whs_swms/${entry.id}`)

      if (response.data.success) {
        setData(prevData => prevData.filter(item => item.id !== entry.id))
      } else {
        alert(response.data.error || 'Failed to delete SWMS')
      }
    } catch (err) {
      console.error('Error deleting SWMS:', err)
      alert(`Failed to delete SWMS: ${err.message}`)
    }
  }

  const handleAddNew = () => {
    setShowAddModal(true)
  }

  const handleImport = () => {
    alert('Import SWMS - This would open a file picker to import SWMS data')
  }

  const handleExport = () => {
    console.log('Export SWMS data:', data)
    alert('Export functionality - see console for data structure')
  }

  const handleApprove = async (entry) => {
    setSelectedSwms(entry)
    setActionType('approve')
    setShowActionModal(true)
  }

  const handleReject = async (entry) => {
    setSelectedSwms(entry)
    setActionType('reject')
    setShowActionModal(true)
  }

  const handleSupersede = async (entry) => {
    setSelectedSwms(entry)
    setActionType('supersede')
    setShowActionModal(true)
  }

  const executeAction = async () => {
    if (!selectedSwms) return

    try {
      let response
      if (actionType === 'approve') {
        response = await api.post(`/api/v1/whs_swms/${selectedSwms.id}/approve`)
      } else if (actionType === 'reject') {
        const reason = prompt('Please provide a rejection reason:')
        if (!reason) return
        response = await api.post(`/api/v1/whs_swms/${selectedSwms.id}/reject`, { rejection_reason: reason })
      } else if (actionType === 'supersede') {
        const newVersion = prompt('Enter new version number:')
        if (!newVersion) return
        response = await api.post(`/api/v1/whs_swms/${selectedSwms.id}/supersede`, { new_version: newVersion })
      }

      if (response.data.success) {
        setShowActionModal(false)
        setSelectedSwms(null)
        setActionType(null)
        await fetchSwms() // Reload data
      } else {
        alert(response.data.error || 'Action failed')
      }
    } catch (err) {
      console.error('Error executing action:', err)
      alert(`Failed to ${actionType} SWMS: ${err.message}`)
    }
  }

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading SWMS...</p>
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
          Safe Work Method Statements (SWMS)
        </h1>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          Manage SWMS documents with approval workflows, hazard assessments, and worker acknowledgments.
        </p>
      </div>

      <TrapidTableView
        category="whs_swms"
        entries={data}
        columns={SWMS_COLUMNS}
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
            Create SWMS
          </button>
        }
      />

      {/* Add Modal - Placeholder */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Create New SWMS</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
              >
                <XCircleIcon className="h-6 w-6" />
              </button>
            </div>

            <div className="px-6 py-4">
              <p className="text-gray-600 dark:text-gray-400">
                Full SWMS creation form will be implemented here with:
              </p>
              <ul className="mt-4 list-disc list-inside space-y-2 text-sm text-gray-600 dark:text-gray-400">
                <li>Title and description</li>
                <li>Construction selection or company-wide flag</li>
                <li>High risk work type</li>
                <li>PPE requirements</li>
                <li>Required qualifications</li>
                <li>Hazards and control measures</li>
                <li>Expiry date (optional)</li>
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
