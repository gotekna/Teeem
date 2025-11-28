import { useState, useEffect } from 'react'
import { getTodayAsString } from '../../utils/timezoneUtils'
import {
  CloudIcon,
  PlusIcon,
  TrashIcon,
  PencilIcon,
  XMarkIcon,
  CheckIcon,
  ArrowPathIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  MapPinIcon
} from '@heroicons/react/24/outline'
import { api } from '../../api'

export default function RainLogTab({ constructionId }) {
  const [rainLogs, setRainLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingLog, setEditingLog] = useState(null)
  const [weatherStatus, setWeatherStatus] = useState(null)
  const [fetchingWeather, setFetchingWeather] = useState(false)
  const [weatherResult, setWeatherResult] = useState(null)
  const [formData, setFormData] = useState({
    date: '',
    rainfall_mm: '',
    hours_affected: '',
    notes: ''
  })

  useEffect(() => {
    loadRainLogs()
    loadWeatherStatus()
  }, [constructionId])

  const loadRainLogs = async () => {
    try {
      setLoading(true)
      const response = await api.get(`/api/v1/jobs/${constructionId}/rain_logs`)
      setRainLogs(response.rain_logs || [])
    } catch (err) {
      console.error('Failed to load rain logs:', err)
    } finally {
      setLoading(false)
    }
  }

  const loadWeatherStatus = async () => {
    try {
      const response = await api.get(`/api/v1/jobs/${constructionId}/rain_logs/weather_status`)
      setWeatherStatus(response)
    } catch (err) {
      console.error('Failed to load weather status:', err)
    }
  }

  const fetchYesterdayWeather = async () => {
    setFetchingWeather(true)
    setWeatherResult(null)
    try {
      const response = await api.post(`/api/v1/jobs/${constructionId}/rain_logs/auto_log`)
      setWeatherResult(response)
      if (response.rain_log_created) {
        await loadRainLogs()
      }
    } catch (err) {
      setWeatherResult({ error: err.response?.data?.error || 'Failed to fetch weather' })
    } finally {
      setFetchingWeather(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    try {
      if (editingLog) {
        // Update existing log
        await api.put(
          `/api/v1/jobs/${constructionId}/rain_logs/${editingLog.id}`,
          { rain_log: formData }
        )
      } else {
        // Create new log
        await api.post(
          `/api/v1/jobs/${constructionId}/rain_logs`,
          { rain_log: formData }
        )
      }

      // Reset form and reload
      setFormData({ date: '', rainfall_mm: '', hours_affected: '', notes: '' })
      setShowAddForm(false)
      setEditingLog(null)
      await loadRainLogs()
    } catch (err) {
      console.error('Failed to save rain log:', err)
      alert(err.response?.data?.errors?.join(', ') || 'Failed to save rain log')
    }
  }

  const handleDelete = async (logId) => {
    if (!confirm('Are you sure you want to delete this rain log?')) return

    try {
      await api.delete(`/api/v1/jobs/${constructionId}/rain_logs/${logId}`)
      await loadRainLogs()
    } catch (err) {
      console.error('Failed to delete rain log:', err)
      alert('Failed to delete rain log')
    }
  }

  const handleEdit = (log) => {
    setEditingLog(log)
    setFormData({
      date: log.date,
      rainfall_mm: log.rainfall_mm || '',
      hours_affected: log.hours_affected || '',
      notes: log.notes || ''
    })
    setShowAddForm(true)
  }

  const handleCancel = () => {
    setShowAddForm(false)
    setEditingLog(null)
    setFormData({ date: '', rainfall_mm: '', hours_affected: '', notes: '' })
  }

  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'light':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400'
      case 'moderate':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400'
      case 'heavy':
        return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400'
    }
  }

  const getSourceBadge = (source) => {
    if (source === 'automatic') {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-indigo-100 text-indigo-800 dark:bg-indigo-900/20 dark:text-indigo-400">
          Auto
        </span>
      )
    }
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400">
        Manual
      </span>
    )
  }

  const formatDate = (dateString) => {
    if (!dateString) return '-'
    return new Date(dateString).toLocaleDateString('en-AU', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Weather Status Card */}
      {weatherStatus && (
        <div className={`rounded-lg p-4 border ${
          weatherStatus.api_configured && weatherStatus.job_has_location
            ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
            : 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800'
        }`}>
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3">
              {weatherStatus.api_configured && weatherStatus.job_has_location ? (
                <CheckCircleIcon className="h-5 w-5 text-green-600 dark:text-green-400 mt-0.5" />
              ) : (
                <ExclamationTriangleIcon className="h-5 w-5 text-yellow-600 dark:text-yellow-400 mt-0.5" />
              )}
              <div>
                <h4 className={`text-sm font-medium ${
                  weatherStatus.api_configured && weatherStatus.job_has_location
                    ? 'text-green-800 dark:text-green-200'
                    : 'text-yellow-800 dark:text-yellow-200'
                }`}>
                  Weather Station Status
                </h4>
                <p className={`text-sm mt-1 ${
                  weatherStatus.api_configured && weatherStatus.job_has_location
                    ? 'text-green-700 dark:text-green-300'
                    : 'text-yellow-700 dark:text-yellow-300'
                }`}>
                  {weatherStatus.message}
                </p>
                {weatherStatus.job_location && (
                  <p className="text-xs mt-1 text-gray-500 dark:text-gray-400 flex items-center gap-1">
                    <MapPinIcon className="h-3 w-3" />
                    Location: {weatherStatus.job_location}
                  </p>
                )}
              </div>
            </div>
            {weatherStatus.api_configured && weatherStatus.job_has_location && (
              <button
                onClick={fetchYesterdayWeather}
                disabled={fetchingWeather}
                className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-green-700 dark:text-green-300 bg-green-100 dark:bg-green-900/40 rounded-lg hover:bg-green-200 dark:hover:bg-green-900/60 disabled:opacity-50"
              >
                <ArrowPathIcon className={`h-4 w-4 mr-1.5 ${fetchingWeather ? 'animate-spin' : ''}`} />
                {fetchingWeather ? 'Checking...' : 'Check Yesterday'}
              </button>
            )}
          </div>
          {weatherResult && (
            <div className={`mt-3 p-3 rounded-lg ${
              weatherResult.error
                ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300'
            }`}>
              {weatherResult.error ? (
                <p className="text-sm">{weatherResult.error}</p>
              ) : weatherResult.rain_log_created ? (
                <p className="text-sm">
                  <CheckCircleIcon className="h-4 w-4 inline mr-1 text-green-600" />
                  Rain log created: {weatherResult.rain_log?.rainfall_mm}mm recorded
                </p>
              ) : (
                <p className="text-sm">
                  <CheckCircleIcon className="h-4 w-4 inline mr-1 text-blue-600" />
                  {weatherResult.message || `No rainfall detected (${weatherResult.rainfall_mm || 0}mm)`}
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <CloudIcon className="h-6 w-6 text-gray-400" />
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Rain Log
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Track rainy days that affect construction
            </p>
          </div>
        </div>
        {!showAddForm && (
          <button
            onClick={() => setShowAddForm(true)}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-lg text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700"
          >
            <PlusIcon className="h-4 w-4 mr-2" />
            Log Rain Day
          </button>
        )}
      </div>

      {/* Add/Edit Form */}
      {showAddForm && (
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6 border border-gray-200 dark:border-gray-700">
          <h4 className="text-base font-semibold text-gray-900 dark:text-white mb-4">
            {editingLog ? 'Edit Rain Log' : 'Log Rain Day'}
          </h4>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Date *
                </label>
                <input
                  type="date"
                  required
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  max={getTodayAsString()}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Rainfall (mm)
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  value={formData.rainfall_mm}
                  onChange={(e) => setFormData({ ...formData, rainfall_mm: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                  placeholder="e.g., 5.2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Hours Affected
                </label>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  max="24"
                  value={formData.hours_affected}
                  onChange={(e) => setFormData({ ...formData, hours_affected: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                  placeholder="e.g., 3.5"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Notes *
              </label>
              <textarea
                required
                rows={3}
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                placeholder="Describe the impact (e.g., 'Heavy rain in the morning, work stopped for 3 hours')"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={handleCancel}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                <XMarkIcon className="h-4 w-4 inline mr-2" />
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 border border-transparent rounded-lg text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700"
              >
                <CheckIcon className="h-4 w-4 inline mr-2" />
                {editingLog ? 'Update' : 'Save'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Rain Logs Table */}
      {rainLogs.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-8 text-center border border-gray-200 dark:border-gray-700">
          <CloudIcon className="h-12 w-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-500 dark:text-gray-400">
            No rain logs recorded yet
          </p>
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
            Add a manual entry or wait for automatic daily checks
          </p>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-900/50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Rainfall
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Severity
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Hours Affected
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Source
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Notes
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Added By
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {rainLogs.map((log) => (
                <tr key={log.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                    {formatDate(log.date)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                    {log.rainfall_mm ? `${log.rainfall_mm} mm` : '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {log.severity ? (
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getSeverityColor(log.severity)}`}>
                        {log.severity}
                      </span>
                    ) : (
                      <span className="text-sm text-gray-400 dark:text-gray-500">-</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                    {log.hours_affected ? `${log.hours_affected}h` : '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {getSourceBadge(log.source)}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400 max-w-xs truncate">
                    {log.notes || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    {log.created_by_user?.name || 'System'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleEdit(log)}
                        className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300"
                        title="Edit"
                      >
                        <PencilIcon className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(log.id)}
                        className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                        title="Delete"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
