import { useState, useEffect } from 'react'
import TrapidTableView from '../documentation/TrapidTableView'
import { api } from '../../api'

/**
 * FeaturesTrackingTable - Uses standard TrapidTableView with database-backed table
 * Table ID: 375 (Feature Tracker)
 */
export default function FeaturesTrackingTable() {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)

  // Load stats from feature_trackers API
  useEffect(() => {
    const loadStats = async () => {
      try {
        const response = await api.get('/api/v1/feature_trackers')
        if (response.success && response.stats) {
          setStats(response.stats)
        }
      } catch (err) {
        console.error('Error loading feature stats:', err)
      } finally {
        setLoading(false)
      }
    }
    loadStats()
  }, [])

  return (
    <div className="h-full">
      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3 mb-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Total Features</div>
            <div className="text-xl font-bold text-gray-900 dark:text-white">{stats.total}</div>
          </div>
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800 p-3">
            <div className="text-xs text-blue-600 dark:text-blue-400 mb-1">System Complete</div>
            <div className="text-xl font-bold text-blue-900 dark:text-blue-100">{stats.system_complete}</div>
          </div>
          <div className="bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800 p-3">
            <div className="text-xs text-green-600 dark:text-green-400 mb-1">Dev Checked</div>
            <div className="text-xl font-bold text-green-900 dark:text-green-100">{stats.dev_checked}</div>
          </div>
          <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800 p-3">
            <div className="text-xs text-yellow-600 dark:text-yellow-400 mb-1">Tester Happy</div>
            <div className="text-xl font-bold text-yellow-900 dark:text-yellow-100">{stats.tester_checked}</div>
          </div>
          <div className="bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-200 dark:border-orange-800 p-3">
            <div className="text-xs text-orange-600 dark:text-orange-400 mb-1">UI Checked</div>
            <div className="text-xl font-bold text-orange-900 dark:text-orange-100">{stats.ui_checked}</div>
          </div>
          <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800 p-3">
            <div className="text-xs text-purple-600 dark:text-purple-400 mb-1">User Happy</div>
            <div className="text-xl font-bold text-purple-900 dark:text-purple-100">{stats.user_checked}</div>
          </div>
          <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-lg border border-indigo-200 dark:border-indigo-800 p-3">
            <div className="text-xs text-indigo-600 dark:text-indigo-400 mb-1">Fully Complete</div>
            <div className="text-xl font-bold text-indigo-900 dark:text-indigo-100">{stats.fully_complete}</div>
          </div>
        </div>
      )}

      {/* Standard TrapidTableView - uses database table ID 375 */}
      <TrapidTableView
        tableId={375}
        tableName="Feature Tracker"
        enableExport={true}
        initialGroupByColumn="chapter"
      />
    </div>
  )
}
