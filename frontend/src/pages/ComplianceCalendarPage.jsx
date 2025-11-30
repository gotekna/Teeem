import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  CalendarIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ClockIcon,
  BuildingOfficeIcon,
  FunnelIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ArrowPathIcon
} from '@heroicons/react/24/outline'
import { api } from '../api'

export default function ComplianceCalendarPage() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [calendarData, setCalendarData] = useState(null)
  const [viewMode, setViewMode] = useState('calendar') // calendar, list, by_company
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [filters, setFilters] = useState({
    company_group_id: '',
    include_completed: false
  })
  const [companyGroups, setCompanyGroups] = useState([])
  const [generating, setGenerating] = useState(false)

  useEffect(() => {
    loadCompanyGroups()
    loadCalendarData()
  }, [filters, currentMonth])

  const loadCompanyGroups = async () => {
    try {
      const response = await api.get('/api/v1/company_groups')
      setCompanyGroups(response.company_groups || [])
    } catch (error) {
      console.error('Failed to load company groups:', error)
    }
  }

  const loadCalendarData = async () => {
    try {
      setLoading(true)
      const startDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1)
      const endDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 3, 0)

      const params = new URLSearchParams({
        start_date: startDate.toISOString().split('T')[0],
        end_date: endDate.toISOString().split('T')[0],
        include_completed: filters.include_completed.toString()
      })

      if (filters.company_group_id) {
        params.append('company_group_id', filters.company_group_id)
      }

      const response = await api.get(`/api/v1/compliance_calendar?${params}`)
      setCalendarData(response)
    } catch (error) {
      console.error('Failed to load calendar data:', error)
    } finally {
      setLoading(false)
    }
  }

  const generateComplianceItems = async () => {
    try {
      setGenerating(true)
      const response = await api.post('/api/v1/compliance_calendar/generate')
      alert(`Generated ${response.generated} compliance items`)
      loadCalendarData()
    } catch (error) {
      console.error('Failed to generate compliance items:', error)
      alert('Failed to generate compliance items')
    } finally {
      setGenerating(false)
    }
  }

  const navigateMonth = (direction) => {
    setCurrentMonth(prev => {
      const newMonth = new Date(prev)
      newMonth.setMonth(newMonth.getMonth() + direction)
      return newMonth
    })
  }

  // Generate calendar days
  const calendarDays = useMemo(() => {
    if (!calendarData?.items_by_date) return []

    const year = currentMonth.getFullYear()
    const month = currentMonth.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const startPadding = firstDay.getDay()

    const days = []

    // Add padding for days before the first of the month
    for (let i = 0; i < startPadding; i++) {
      days.push({ day: null, items: [] })
    }

    // Add each day of the month
    for (let day = 1; day <= lastDay.getDate(); day++) {
      const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
      const items = calendarData.items_by_date[dateKey] || []
      days.push({
        day,
        date: new Date(year, month, day),
        items,
        isToday: new Date().toDateString() === new Date(year, month, day).toDateString()
      })
    }

    return days
  }, [calendarData, currentMonth])

  const summary = calendarData?.summary || {}

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Compliance Calendar</h1>
          <p className="text-sm text-gray-500">Track compliance deadlines across all companies</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={generateComplianceItems}
            disabled={generating}
            className="inline-flex items-center px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
          >
            <ArrowPathIcon className={`w-4 h-4 mr-2 ${generating ? 'animate-spin' : ''}`} />
            Generate Items
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-red-50 rounded-lg p-4 border border-red-200">
          <div className="flex items-center gap-2 text-red-600">
            <ExclamationTriangleIcon className="w-5 h-5" />
            <span className="text-sm font-medium">Overdue</span>
          </div>
          <p className="text-2xl font-bold text-red-700 mt-1">{summary.overdue || 0}</p>
        </div>
        <div className="bg-orange-50 rounded-lg p-4 border border-orange-200">
          <div className="flex items-center gap-2 text-orange-600">
            <ClockIcon className="w-5 h-5" />
            <span className="text-sm font-medium">This Week</span>
          </div>
          <p className="text-2xl font-bold text-orange-700 mt-1">{summary.due_this_week || 0}</p>
        </div>
        <div className="bg-yellow-50 rounded-lg p-4 border border-yellow-200">
          <div className="flex items-center gap-2 text-yellow-600">
            <CalendarIcon className="w-5 h-5" />
            <span className="text-sm font-medium">This Month</span>
          </div>
          <p className="text-2xl font-bold text-yellow-700 mt-1">{summary.due_this_month || 0}</p>
        </div>
        <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
          <div className="flex items-center gap-2 text-blue-600">
            <ClockIcon className="w-5 h-5" />
            <span className="text-sm font-medium">Pending</span>
          </div>
          <p className="text-2xl font-bold text-blue-700 mt-1">{summary.pending || 0}</p>
        </div>
        <div className="bg-green-50 rounded-lg p-4 border border-green-200">
          <div className="flex items-center gap-2 text-green-600">
            <CheckCircleIcon className="w-5 h-5" />
            <span className="text-sm font-medium">Completed</span>
          </div>
          <p className="text-2xl font-bold text-green-700 mt-1">{summary.completed || 0}</p>
        </div>
      </div>

      {/* Filters and View Toggle */}
      <div className="flex items-center justify-between bg-white rounded-lg p-4 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <FunnelIcon className="w-4 h-4 text-gray-400" />
            <select
              value={filters.company_group_id}
              onChange={(e) => setFilters(prev => ({ ...prev, company_group_id: e.target.value }))}
              className="text-sm border-gray-300 rounded-md"
            >
              <option value="">All Groups</option>
              {companyGroups.map(group => (
                <option key={group.id} value={group.id}>{group.name}</option>
              ))}
            </select>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={filters.include_completed}
              onChange={(e) => setFilters(prev => ({ ...prev, include_completed: e.target.checked }))}
              className="rounded text-indigo-600"
            />
            Show Completed
          </label>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewMode('calendar')}
            className={`px-3 py-1.5 text-sm rounded-md ${viewMode === 'calendar' ? 'bg-indigo-100 text-indigo-700' : 'text-gray-600 hover:bg-gray-100'}`}
          >
            Calendar
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`px-3 py-1.5 text-sm rounded-md ${viewMode === 'list' ? 'bg-indigo-100 text-indigo-700' : 'text-gray-600 hover:bg-gray-100'}`}
          >
            List
          </button>
          <button
            onClick={() => setViewMode('by_company')}
            className={`px-3 py-1.5 text-sm rounded-md ${viewMode === 'by_company' ? 'bg-indigo-100 text-indigo-700' : 'text-gray-600 hover:bg-gray-100'}`}
          >
            By Company
          </button>
        </div>
      </div>

      {/* Calendar View */}
      {viewMode === 'calendar' && (
        <div className="bg-white rounded-lg shadow-sm p-4">
          {/* Month Navigation */}
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={() => navigateMonth(-1)}
              className="p-2 hover:bg-gray-100 rounded-full"
            >
              <ChevronLeftIcon className="w-5 h-5" />
            </button>
            <h2 className="text-lg font-semibold">
              {currentMonth.toLocaleDateString('en-AU', { month: 'long', year: 'numeric' })}
            </h2>
            <button
              onClick={() => navigateMonth(1)}
              className="p-2 hover:bg-gray-100 rounded-full"
            >
              <ChevronRightIcon className="w-5 h-5" />
            </button>
          </div>

          {/* Calendar Grid */}
          <div className="grid grid-cols-7 gap-px bg-gray-200 rounded-lg overflow-hidden">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div key={day} className="bg-gray-50 px-2 py-2 text-center text-sm font-medium text-gray-500">
                {day}
              </div>
            ))}
            {calendarDays.map((day, index) => (
              <div
                key={index}
                className={`bg-white min-h-[100px] p-2 ${day.isToday ? 'ring-2 ring-indigo-500 ring-inset' : ''}`}
              >
                {day.day && (
                  <>
                    <span className={`text-sm ${day.isToday ? 'font-bold text-indigo-600' : 'text-gray-500'}`}>
                      {day.day}
                    </span>
                    <div className="mt-1 space-y-1">
                      {day.items.slice(0, 3).map((item, i) => (
                        <div
                          key={i}
                          onClick={() => navigate(`/corporate/companies/${item.company_id}?tab=compliance`)}
                          className={`text-xs p-1 rounded cursor-pointer truncate ${
                            item.is_overdue
                              ? 'bg-red-100 text-red-800'
                              : item.completed
                              ? 'bg-green-100 text-green-800'
                              : 'bg-blue-100 text-blue-800'
                          }`}
                          title={`${item.company_name}: ${item.title}`}
                        >
                          {item.company_code || item.company_name?.slice(0, 10)}
                        </div>
                      ))}
                      {day.items.length > 3 && (
                        <div className="text-xs text-gray-500">+{day.items.length - 3} more</div>
                      )}
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* List View */}
      {viewMode === 'list' && (
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Due Date</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Company</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Title</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-500">Loading...</td>
                </tr>
              ) : calendarData?.items?.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-500">No compliance items found</td>
                </tr>
              ) : (
                calendarData?.items?.map(item => (
                  <tr
                    key={item.id}
                    onClick={() => navigate(`/corporate/companies/${item.company_id}?tab=compliance`)}
                    className="hover:bg-gray-50 cursor-pointer"
                  >
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={item.is_overdue ? 'text-red-600 font-medium' : 'text-gray-900'}>
                        {new Date(item.due_date).toLocaleDateString('en-AU')}
                      </span>
                      {item.is_overdue && (
                        <span className="ml-2 text-xs text-red-500">({Math.abs(item.days_until_due)} days overdue)</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <BuildingOfficeIcon className="w-4 h-4 text-gray-400" />
                        <span className="text-sm font-medium text-gray-900">{item.company_name}</span>
                        {item.company_code && (
                          <span className="text-xs text-gray-500">({item.company_code})</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-gray-900">{item.title}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-gray-500 capitalize">{item.item_type?.replace(/_/g, ' ')}</span>
                      {item.asic_related && <span className="ml-2 text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded">ASIC</span>}
                      {item.ato_related && <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">ATO</span>}
                    </td>
                    <td className="px-4 py-3">
                      {item.completed ? (
                        <span className="inline-flex items-center gap-1 text-green-600">
                          <CheckCircleIcon className="w-4 h-4" />
                          Completed
                        </span>
                      ) : item.is_overdue ? (
                        <span className="inline-flex items-center gap-1 text-red-600">
                          <ExclamationTriangleIcon className="w-4 h-4" />
                          Overdue
                        </span>
                      ) : (
                        <span className="text-gray-500">Pending</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* By Company View */}
      {viewMode === 'by_company' && (
        <div className="space-y-4">
          {loading ? (
            <div className="text-center text-gray-500 py-8">Loading...</div>
          ) : (
            Object.entries(
              (calendarData?.items || []).reduce((acc, item) => {
                if (!acc[item.company_id]) {
                  acc[item.company_id] = {
                    company_name: item.company_name,
                    company_code: item.company_code,
                    company_group: item.company_group,
                    items: []
                  }
                }
                acc[item.company_id].items.push(item)
                return acc
              }, {})
            ).map(([companyId, data]) => (
              <div key={companyId} className="bg-white rounded-lg shadow-sm p-4">
                <div
                  onClick={() => navigate(`/corporate/companies/${companyId}?tab=compliance`)}
                  className="flex items-center justify-between mb-3 cursor-pointer hover:text-indigo-600"
                >
                  <div className="flex items-center gap-2">
                    <BuildingOfficeIcon className="w-5 h-5 text-gray-400" />
                    <h3 className="font-medium text-gray-900">{data.company_name}</h3>
                    {data.company_code && (
                      <span className="text-sm text-gray-500">({data.company_code})</span>
                    )}
                    {data.company_group && (
                      <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                        {data.company_group}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    {data.items.some(i => i.is_overdue) && (
                      <span className="text-red-600">
                        {data.items.filter(i => i.is_overdue).length} overdue
                      </span>
                    )}
                    <span className="text-gray-500">{data.items.length} items</span>
                  </div>
                </div>
                <div className="space-y-2">
                  {data.items.slice(0, 5).map(item => (
                    <div key={item.id} className="flex items-center justify-between py-2 border-t border-gray-100">
                      <div className="flex items-center gap-3">
                        <span className={`text-sm ${item.is_overdue ? 'text-red-600' : 'text-gray-500'}`}>
                          {new Date(item.due_date).toLocaleDateString('en-AU')}
                        </span>
                        <span className="text-sm text-gray-900">{item.title}</span>
                      </div>
                      {item.completed ? (
                        <CheckCircleIcon className="w-4 h-4 text-green-500" />
                      ) : item.is_overdue ? (
                        <ExclamationTriangleIcon className="w-4 h-4 text-red-500" />
                      ) : (
                        <ClockIcon className="w-4 h-4 text-gray-400" />
                      )}
                    </div>
                  ))}
                  {data.items.length > 5 && (
                    <div className="text-sm text-gray-500 pt-2 border-t border-gray-100">
                      +{data.items.length - 5} more items
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
