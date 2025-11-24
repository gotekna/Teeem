import { useState, useEffect } from 'react'
import { PlusIcon, AcademicCapIcon } from '@heroicons/react/24/outline'
import TrapidTableView from '../components/documentation/TrapidTableView'
import { api } from '../api'

const INDUCTION_COLUMNS = [
  { key: 'select', label: '', resizable: false, sortable: false, filterable: false, width: 32 },
  { key: 'certificate_number', label: 'Certificate #', resizable: true, sortable: true, filterable: true, filterType: 'text', width: 180, tooltip: 'Unique certificate number' },
  { key: 'template_name', label: 'Induction Type', resizable: true, sortable: true, filterable: true, filterType: 'dropdown', width: 200, tooltip: 'Induction template name' },
  { key: 'worker_name', label: 'Worker', resizable: true, sortable: true, filterable: true, filterType: 'text', width: 180, tooltip: 'Worker who completed induction' },
  { key: 'status', label: 'Status', resizable: true, sortable: true, filterable: true, filterType: 'dropdown', width: 120, tooltip: 'Certificate status' },
  { key: 'completion_date', label: 'Completed', resizable: true, sortable: true, filterable: false, width: 140, tooltip: 'Completion date' },
  { key: 'expiry_date', label: 'Expires', resizable: true, sortable: true, filterable: false, width: 140, tooltip: 'Expiry date (if applicable)' },
  { key: 'quiz_score', label: 'Quiz Score', resizable: true, sortable: true, filterable: false, width: 110, tooltip: 'Quiz score (if applicable)' },
  { key: 'construction_name', label: 'Construction', resizable: true, sortable: true, filterable: true, filterType: 'text', width: 200, tooltip: 'Associated project' },
  { key: 'created_at', label: 'Issued', resizable: true, sortable: true, filterable: false, width: 180, tooltip: 'Issue date' },
]

export default function WhsInductionsPage() {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetchInductions()
  }, [])

  const fetchInductions = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await api.get('/api/v1/whs_inductions')

      if (response.data.success) {
        const transformedData = response.data.data.map(induction => ({
          id: induction.id,
          certificate_number: induction.certificate_number,
          template_name: induction.whs_induction_template?.name || 'N/A',
          worker_name: induction.user?.name || 'Unknown',
          status: induction.status,
          completion_date: induction.completion_date || 'Pending',
          expiry_date: induction.expiry_date || 'Never',
          quiz_score: induction.quiz_score ? `${induction.quiz_score}%` : 'N/A',
          construction_name: induction.construction?.name || 'N/A',
          created_at: induction.created_at,
          _raw: induction
        }))
        setData(transformedData)
      } else {
        setError(response.data.error || 'Failed to load inductions')
      }
    } catch (err) {
      console.error('Error fetching inductions:', err)
      setError('Failed to load induction data')
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = (entry) => {
    alert('Edit functionality - to be implemented')
  }

  const handleDelete = async (entry) => {
    if (!confirm(`Delete induction ${entry.certificate_number}?`)) return

    try {
      const response = await api.delete(`/api/v1/whs_inductions/${entry.id}`)
      if (response.data.success) {
        setData(prevData => prevData.filter(item => item.id !== entry.id))
      } else {
        alert(response.data.error || 'Failed to delete induction')
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
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading inductions...</p>
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
          <AcademicCapIcon className="h-7 w-7 text-blue-500" />
          Worker Inductions
        </h1>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          Track worker safety inductions with quiz validation and expiry management.
        </p>
      </div>

      <TrapidTableView
        category="whs_inductions"
        entries={data}
        columns={INDUCTION_COLUMNS}
        onEdit={handleEdit}
        onDelete={handleDelete}
        enableImport={true}
        enableExport={true}
        customActions={
          <button
            onClick={() => alert('Create induction - to be implemented')}
            className="inline-flex items-center gap-2 px-4 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors h-[42px]"
          >
            <PlusIcon className="h-5 w-5" />
            Record Induction
          </button>
        }
      />
    </div>
  )
}
