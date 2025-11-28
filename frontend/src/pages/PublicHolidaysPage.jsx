import { useEffect, useState } from 'react'
import { getTodayInCompanyTimezone } from '../utils/timezoneUtils'
import { api } from '../api'
import { PlusIcon } from '@heroicons/react/24/outline'
import Toast from '../components/Toast'
import TeeemTableView from '../components/documentation/TeeemTableView'

// Table ID for Public Holidays (from foundations table)
const PUBLIC_HOLIDAYS_TABLE_ID = 405

// Column definitions matching the public_holidays table
const buildPublicHolidaysColumns = () => [
  { key: 'select', label: '', resizable: false, sortable: false, filterable: false, width: 32 },
  { key: 'id', label: 'ID', column_type: 'whole_number', resizable: true, sortable: true, filterable: true, filterType: 'text', width: 60 },
  { key: 'name', label: 'Holiday Name', column_type: 'single_line_text', resizable: true, sortable: true, filterable: true, filterType: 'text', width: 250, is_title: true },
  { key: 'date', label: 'Date', column_type: 'date', resizable: true, sortable: true, filterable: true, filterType: 'date', width: 150 },
  { key: 'region', label: 'Region', column_type: 'single_line_text', resizable: true, sortable: true, filterable: true, filterType: 'dropdown', width: 100 },
  { key: 'created_at', label: 'Created', column_type: 'date_and_time', resizable: true, sortable: true, filterable: false, width: 150 },
  { key: 'updated_at', label: 'Updated', column_type: 'date_and_time', resizable: true, sortable: true, filterable: false, width: 150 }
]

export default function PublicHolidaysPage() {
  const [holidays, setHolidays] = useState([])
  const [loading, setLoading] = useState(true)
  const [columns, setColumns] = useState(buildPublicHolidaysColumns())
  const [selectedYear, setSelectedYear] = useState(getTodayInCompanyTimezone().getFullYear())
  const [selectedRegion, setSelectedRegion] = useState('ALL')
  const [showAddModal, setShowAddModal] = useState(false)
  const [toast, setToast] = useState(null)

  // Form state for new holiday
  const [newHoliday, setNewHoliday] = useState({
    name: '',
    date: '',
    region: 'QLD'
  })

  const regions = ['ALL', 'QLD', 'NSW', 'VIC', 'SA', 'WA', 'TAS', 'NT', 'ACT']
  const years = Array.from({ length: 10 }, (_, i) => getTodayInCompanyTimezone().getFullYear() + i - 2)

  useEffect(() => {
    loadHolidays()
    fetchColumnIds()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedYear, selectedRegion])

  const loadHolidays = async () => {
    try {
      setLoading(true)
      const params = { year: selectedYear }
      if (selectedRegion !== 'ALL') {
        params.region = selectedRegion
      }
      const response = await api.get('/api/v1/public_holidays', { params })
      setHolidays(response.holidays || [])
    } catch (err) {
      console.error('Failed to load holidays:', err)
      setToast({ message: 'Failed to load public holidays', type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  // Fetch column IDs from API and merge with static config
  const fetchColumnIds = async () => {
    try {
      const response = await api.get(`/api/v1/foundations/${PUBLIC_HOLIDAYS_TABLE_ID}`)
      const dbColumns = response?.foundation?.columns || []
      console.log('📥 Public Holidays: Received', dbColumns.length, 'columns from API')

      const updatedColumns = buildPublicHolidaysColumns().map(col => {
        const dbCol = dbColumns.find(dc => dc.column_name === col.key)
        if (dbCol) {
          console.log(`🔀 Merged column ${col.key}: id=${dbCol.id}`)
          return {
            ...col,
            id: dbCol.id,
            header_align: dbCol.header_align,
            data_align: dbCol.data_align
          }
        }
        return col
      })

      setColumns(updatedColumns)
    } catch (err) {
      console.error('Failed to fetch column IDs:', err)
    }
  }

  const handleAddHoliday = async (e) => {
    e.preventDefault()

    if (!newHoliday.name || !newHoliday.date) {
      setToast({ message: 'Please fill in all fields', type: 'error' })
      return
    }

    try {
      const response = await api.post('/api/v1/public_holidays', {
        public_holiday: {
          name: newHoliday.name,
          date: newHoliday.date,
          region: newHoliday.region
        }
      })

      setToast({ message: 'Public holiday added successfully', type: 'success' })
      setShowAddModal(false)
      setNewHoliday({ name: '', date: '', region: 'QLD' })

      // Add to list if it matches current filters
      if (selectedRegion === 'ALL' || response.holiday?.region === selectedRegion) {
        setHolidays([...holidays, response.holiday])
      }
    } catch (err) {
      console.error('Failed to add holiday:', err)
      setToast({
        message: err.response?.data?.errors?.join(', ') || 'Failed to add public holiday',
        type: 'error'
      })
    }
  }

  const handleEdit = async (entry) => {
    try {
      const response = await api.patch(`/api/v1/public_holidays/${entry.id}`, {
        public_holiday: {
          name: entry.name,
          date: entry.date,
          region: entry.region
        }
      })
      setHolidays(holidays.map(h => h.id === entry.id ? response.holiday : h))
      setToast({ message: 'Holiday updated successfully', type: 'success' })
    } catch (err) {
      console.error('Failed to update holiday:', err)
      setToast({ message: 'Failed to update holiday', type: 'error' })
    }
  }

  const handleDelete = async (entry) => {
    if (!confirm(`Delete "${entry.name}"?`)) return

    try {
      await api.delete(`/api/v1/public_holidays/${entry.id}`)
      setHolidays(holidays.filter(h => h.id !== entry.id))
      setToast({ message: 'Public holiday deleted successfully', type: 'success' })
    } catch (err) {
      console.error('Failed to delete holiday:', err)
      setToast({ message: 'Failed to delete public holiday', type: 'error' })
    }
  }

  const handleBulkDelete = async (entries) => {
    try {
      const ids = entries.map(e => e.id)
      await Promise.all(ids.map(id => api.delete(`/api/v1/public_holidays/${id}`)))
      setHolidays(holidays.filter(h => !ids.includes(h.id)))
      setToast({ message: `Successfully deleted ${entries.length} holidays`, type: 'success' })
    } catch (err) {
      console.error('Failed to bulk delete holidays:', err)
      setToast({ message: 'Failed to delete holidays', type: 'error' })
    }
  }

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6">
      {/* Header */}
      <div className="sm:flex sm:items-center sm:justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
            Public Holidays
          </h1>
          <p className="mt-2 text-sm text-gray-700 dark:text-gray-300">
            Manage public holidays for business day calculations
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-6 flex flex-wrap gap-4">
        <div>
          <label htmlFor="year" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Year
          </label>
          <select
            id="year"
            value={selectedYear}
            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
            className="block w-40 rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm dark:bg-gray-900 dark:text-white"
          >
            {years.map(year => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="region" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Region
          </label>
          <select
            id="region"
            value={selectedRegion}
            onChange={(e) => setSelectedRegion(e.target.value)}
            className="block w-40 rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm dark:bg-gray-900 dark:text-white"
          >
            {regions.map(region => (
              <option key={region} value={region}>{region === 'ALL' ? 'All Regions' : region}</option>
            ))}
          </select>
        </div>
      </div>

      {/* TeeemTableView */}
      <TeeemTableView
        foundationId="public-holidays"
        foundationIdNumeric={PUBLIC_HOLIDAYS_TABLE_ID}
        tableName="Public Holidays"
        entries={holidays}
        columns={columns}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onBulkDelete={handleBulkDelete}
        enableImport={false}
        enableExport={true}
        enableSchemaEditor={true}
        hideUpdateViewButton={true}
        onColumnUpdate={() => {
          console.log('Public Holidays: Refreshing columns after schema update')
          fetchColumnIds()
        }}
        customActions={
          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-2 px-4 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors h-[42px]"
          >
            <PlusIcon className="h-5 w-5" />
            Add Holiday
          </button>
        }
      />

      {/* Add Holiday Modal */}
      {showAddModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50" style={{ zIndex: 2147483647 }}>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md">
            <div className="p-6">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                Add Public Holiday
              </h3>

              <form onSubmit={handleAddHoliday}>
                <div className="space-y-4">
                  <div>
                    <label htmlFor="holiday-name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Holiday Name
                    </label>
                    <input
                      type="text"
                      id="holiday-name"
                      value={newHoliday.name}
                      onChange={(e) => setNewHoliday({ ...newHoliday, name: e.target.value })}
                      className="block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm dark:bg-gray-900 dark:text-white"
                      placeholder="e.g., Christmas Day"
                      required
                    />
                  </div>

                  <div>
                    <label htmlFor="holiday-date" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Date
                    </label>
                    <input
                      type="date"
                      id="holiday-date"
                      value={newHoliday.date}
                      onChange={(e) => setNewHoliday({ ...newHoliday, date: e.target.value })}
                      className="block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm dark:bg-gray-900 dark:text-white"
                      required
                    />
                  </div>

                  <div>
                    <label htmlFor="holiday-region" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Region
                    </label>
                    <select
                      id="holiday-region"
                      value={newHoliday.region}
                      onChange={(e) => setNewHoliday({ ...newHoliday, region: e.target.value })}
                      className="block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm dark:bg-gray-900 dark:text-white"
                      required
                    >
                      {regions.filter(r => r !== 'ALL').map(region => (
                        <option key={region} value={region}>{region}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="mt-6 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddModal(false)
                      setNewHoliday({ name: '', date: '', region: 'QLD' })
                    }}
                    className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-700"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700"
                  >
                    Add Holiday
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notifications */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  )
}
