import { useEffect, useState } from 'react'
import { api } from '../api'
import { formatCurrency, formatPercentage } from '../utils/formatters'
import {
  PlusIcon,
  BriefcaseIcon,
} from '@heroicons/react/24/outline'
import { useNavigate } from 'react-router-dom'

export default function ActiveJobsPage() {
  const navigate = useNavigate()
  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [editingCell, setEditingCell] = useState(null)
  const [editValue, setEditValue] = useState('')

  useEffect(() => {
    loadJobs()
  }, [])

  const loadJobs = async () => {
    try {
      setLoading(true)
      const response = await api.get(
        `/api/v1/constructions?status=Active&per_page=1000`
      )
      setJobs(response.constructions || [])
    } catch (err) {
      setError('Failed to load active jobs')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleCellClick = (jobId, field, currentValue) => {
    setEditingCell({ jobId, field })
    setEditValue(currentValue || '')
  }

  const handleCellBlur = async () => {
    if (!editingCell) return

    const { jobId, field } = editingCell
    const originalJob = jobs.find(j => j.id === jobId)

    if (editValue !== originalJob[field]) {
      try {
        await api.put(`/api/v1/constructions/${jobId}`, {
          construction: {
            [field]: editValue
          }
        })
        await loadJobs()
      } catch (err) {
        console.error('Failed to update job:', err)
        alert('Failed to update job')
      }
    }

    setEditingCell(null)
    setEditValue('')
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.target.blur()
    }
  }

  const handleAddJob = async () => {
    try {
      await api.post('/api/v1/constructions', {
        construction: {
          title: 'New Construction Job',
          status: 'Active',
          stage: 'Planning'
        }
      })
      await loadJobs()
    } catch (err) {
      console.error('Failed to add job:', err)
      alert('Failed to add job')
    }
  }

  if (loading && jobs.length === 0) {
    return (
      <div className="flex h-screen overflow-hidden">
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex h-screen overflow-hidden">
        <div className="flex-1 flex items-center justify-center">
          <div className="text-red-600 dark:text-red-400">{error}</div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <div className="flex-1 overflow-auto bg-white dark:bg-gray-900">
        {/* Header */}
        <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-10">
          <div className="px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <BriefcaseIcon className="h-7 w-7 text-indigo-600 dark:text-indigo-400" />
                <div>
                  <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
                    Active Jobs
                  </h1>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
                    {jobs.length} {jobs.length === 1 ? 'job' : 'jobs'}
                  </p>
                </div>
              </div>
              <button
                onClick={handleAddJob}
                className="inline-flex items-center px-3 py-1.5 border border-transparent rounded-lg text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none shadow-sm transition-colors"
              >
                <PlusIcon className="h-4 w-4 mr-2" />
                Add Job
              </button>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto border-l border-r border-b border-gray-200 dark:border-gray-700 rounded-lg">
          <table className="min-w-full">
            <thead className="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 w-8">
                  #
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
                  Title
                </th>
                <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400">
                  Contract Value
                </th>
                <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400">
                  Live Profit
                </th>
                <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400">
                  Profit %
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
                  Stage
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-900">
              {jobs.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-3 py-8 text-center text-xs text-gray-500 dark:text-gray-400">
                    No active jobs found. Click "Add Job" to create one.
                  </td>
                </tr>
              ) : (
                jobs.map((job, index) => (
                  <tr
                    key={job.id}
                    onClick={() => navigate(`/jobs/${job.id}`)}
                    className="border-b border-gray-200 dark:border-gray-700 hover:bg-blue-50/50 dark:hover:bg-blue-900/10 cursor-pointer"
                  >
                      <td className="px-3 py-1.5 text-xs text-gray-500 dark:text-gray-400">
                        {index + 1}
                      </td>

                      <td className="px-3 py-1.5">
                        {editingCell?.jobId === job.id && editingCell?.field === 'title' ? (
                          <input
                            type="text"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onBlur={handleCellBlur}
                            onKeyDown={handleKeyDown}
                            autoFocus
                            className="w-full px-1.5 py-0.5 text-xs border border-blue-500 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                          />
                        ) : (
                          <div
                            onClick={(e) => {
                              e.stopPropagation()
                              handleCellClick(job.id, 'title', job.title)
                            }}
                            className="text-xs text-gray-900 dark:text-white cursor-pointer hover:bg-blue-50 dark:hover:bg-gray-600 px-1.5 py-0.5 rounded truncate max-w-md"
                            title={job.title}
                          >
                            {job.title || '-'}
                          </div>
                        )}
                      </td>

                      <td className="px-3 py-1.5 text-right">
                        {editingCell?.jobId === job.id && editingCell?.field === 'contract_value' ? (
                          <input
                            type="number"
                            step="0.01"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onBlur={handleCellBlur}
                            onKeyDown={handleKeyDown}
                            autoFocus
                            className="w-full px-1.5 py-0.5 text-xs text-right border border-blue-500 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                          />
                        ) : (
                          <div
                            onClick={(e) => {
                              e.stopPropagation()
                              handleCellClick(job.id, 'contract_value', job.contract_value)
                            }}
                            className="text-xs text-gray-900 dark:text-white cursor-pointer hover:bg-blue-50 dark:hover:bg-gray-600 px-1.5 py-0.5 rounded"
                          >
                            {job.contract_value ? formatCurrency(job.contract_value, false) : '-'}
                          </div>
                        )}
                      </td>

                      <td className="px-3 py-1.5 text-right">
                        {editingCell?.jobId === job.id && editingCell?.field === 'live_profit' ? (
                          <input
                            type="number"
                            step="0.01"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onBlur={handleCellBlur}
                            onKeyDown={handleKeyDown}
                            autoFocus
                            className="w-full px-1.5 py-0.5 text-xs text-right border border-blue-500 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                          />
                        ) : (
                          <div
                            onClick={(e) => {
                              e.stopPropagation()
                              handleCellClick(job.id, 'live_profit', job.live_profit)
                            }}
                            className={`text-xs cursor-pointer hover:bg-blue-50 dark:hover:bg-gray-600 px-1.5 py-0.5 rounded ${
                              job.live_profit >= 0
                                ? 'text-green-600 dark:text-green-400'
                                : 'text-red-600 dark:text-red-400'
                            }`}
                          >
                            {job.live_profit ? formatCurrency(job.live_profit, false) : '-'}
                          </div>
                        )}
                      </td>

                      <td className="px-3 py-1.5 text-right">
                        {editingCell?.jobId === job.id && editingCell?.field === 'profit_percentage' ? (
                          <input
                            type="number"
                            step="0.01"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onBlur={handleCellBlur}
                            onKeyDown={handleKeyDown}
                            autoFocus
                            className="w-full px-1.5 py-0.5 text-xs text-right border border-blue-500 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                          />
                        ) : (
                          <div
                            onClick={(e) => {
                              e.stopPropagation()
                              handleCellClick(job.id, 'profit_percentage', job.profit_percentage)
                            }}
                            className={`text-xs cursor-pointer hover:bg-blue-50 dark:hover:bg-gray-600 px-1.5 py-0.5 rounded ${
                              job.profit_percentage >= 0
                                ? 'text-green-600 dark:text-green-400'
                                : 'text-red-600 dark:text-red-400'
                            }`}
                          >
                            {job.profit_percentage ? formatPercentage(job.profit_percentage, 2) : '-'}
                          </div>
                        )}
                      </td>

                      <td className="px-3 py-1.5">
                        {editingCell?.jobId === job.id && editingCell?.field === 'stage' ? (
                          <input
                            type="text"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onBlur={handleCellBlur}
                            onKeyDown={handleKeyDown}
                            autoFocus
                            className="w-full px-1.5 py-0.5 text-xs border border-blue-500 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                          />
                        ) : (
                          <div
                            onClick={(e) => {
                              e.stopPropagation()
                              handleCellClick(job.id, 'stage', job.stage)
                            }}
                            className="text-xs cursor-pointer hover:bg-blue-50 dark:hover:bg-gray-600 px-1.5 py-0.5 rounded inline-block"
                          >
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100/60 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200">
                              {job.stage || 'Not Set'}
                            </span>
                          </div>
                        )}
                      </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
