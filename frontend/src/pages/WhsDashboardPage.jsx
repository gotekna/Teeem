import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  DocumentTextIcon,
  ClipboardDocumentCheckIcon,
  ExclamationTriangleIcon,
  AcademicCapIcon,
  CheckCircleIcon,
  ShieldCheckIcon
} from '@heroicons/react/24/outline'
import { api } from '../api'

export default function WhsDashboardPage() {
  const [stats, setStats] = useState({
    swms: { total: 0, approved: 0, pending: 0 },
    inspections: { total: 0, completed: 0, upcoming: 0 },
    incidents: { total: 0, lti: 0, nearMiss: 0 },
    inductions: { total: 0, valid: 0, expiring: 0 },
    actionItems: { total: 0, open: 0, overdue: 0 }
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchDashboardStats()
  }, [])

  const fetchDashboardStats = async () => {
    try {
      setLoading(true)

      // Fetch all data in parallel
      const [swmsRes, inspectionsRes, incidentsRes, inductionsRes, actionsRes] = await Promise.all([
        api.get('/api/v1/whs_swms'),
        api.get('/api/v1/whs_inspections'),
        api.get('/api/v1/whs_incidents'),
        api.get('/api/v1/whs_inductions'),
        api.get('/api/v1/whs_action_items')
      ])

      // Calculate statistics
      const swmsData = swmsRes.data.data || []
      const inspectionsData = inspectionsRes.data.data || []
      const incidentsData = incidentsRes.data.data || []
      const inductionsData = inductionsRes.data.data || []
      const actionsData = actionsRes.data.data || []

      setStats({
        swms: {
          total: swmsData.length,
          approved: swmsData.filter(s => s.status === 'approved').length,
          pending: swmsData.filter(s => s.status === 'pending_approval').length
        },
        inspections: {
          total: inspectionsData.length,
          completed: inspectionsData.filter(i => i.status === 'completed').length,
          upcoming: inspectionsData.filter(i => i.status === 'scheduled').length
        },
        incidents: {
          total: incidentsData.length,
          lti: incidentsData.filter(i => i.incident_category === 'lti').length,
          nearMiss: incidentsData.filter(i => i.incident_category === 'near_miss').length
        },
        inductions: {
          total: inductionsData.length,
          valid: inductionsData.filter(i => i.status === 'valid').length,
          expiring: inductionsData.filter(i => i.status === 'expiring_soon').length
        },
        actionItems: {
          total: actionsData.length,
          open: actionsData.filter(a => a.status === 'open').length,
          overdue: actionsData.filter(a => a.status === 'overdue').length
        }
      })
    } catch (err) {
      console.error('Error fetching dashboard stats:', err)
    } finally {
      setLoading(false)
    }
  }

  const StatCard = ({ title, total, subtitle, subtitleValue, icon: Icon, color, link }) => (
    <Link
      to={link}
      className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 hover:shadow-lg transition-shadow"
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600 dark:text-gray-400">{title}</p>
          <p className={`text-3xl font-bold mt-2 ${color}`}>{total}</p>
          {subtitle && (
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
              {subtitle}: <span className="font-semibold">{subtitleValue}</span>
            </p>
          )}
        </div>
        <Icon className={`h-12 w-12 ${color} opacity-50`} />
      </div>
    </Link>
  )

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
          <ShieldCheckIcon className="h-8 w-8 text-blue-600" />
          WHS Dashboard
        </h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          Queensland Construction Workplace Health & Safety Management
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        <StatCard
          title="SWMS Documents"
          total={stats.swms.total}
          subtitle="Approved"
          subtitleValue={stats.swms.approved}
          icon={DocumentTextIcon}
          color="text-blue-600"
          link="/whs/swms"
        />

        <StatCard
          title="Site Inspections"
          total={stats.inspections.total}
          subtitle="Completed"
          subtitleValue={stats.inspections.completed}
          icon={ClipboardDocumentCheckIcon}
          color="text-green-600"
          link="/whs/inspections"
        />

        <StatCard
          title="Incidents Reported"
          total={stats.incidents.total}
          subtitle="LTI / Near Miss"
          subtitleValue={`${stats.incidents.lti} / ${stats.incidents.nearMiss}`}
          icon={ExclamationTriangleIcon}
          color="text-orange-600"
          link="/whs/incidents"
        />

        <StatCard
          title="Worker Inductions"
          total={stats.inductions.total}
          subtitle="Valid Certificates"
          subtitleValue={stats.inductions.valid}
          icon={AcademicCapIcon}
          color="text-purple-600"
          link="/whs/inductions"
        />

        <StatCard
          title="Action Items"
          total={stats.actionItems.total}
          subtitle="Open / Overdue"
          subtitleValue={`${stats.actionItems.open} / ${stats.actionItems.overdue}`}
          icon={CheckCircleIcon}
          color="text-indigo-600"
          link="/whs/action-items"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Quick Actions</h2>
          <div className="space-y-3">
            <Link
              to="/whs/swms"
              className="block px-4 py-3 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
            >
              <p className="font-medium text-blue-900 dark:text-blue-200">Create New SWMS</p>
              <p className="text-sm text-blue-700 dark:text-blue-300">Safe Work Method Statement</p>
            </Link>
            <Link
              to="/whs/inspections"
              className="block px-4 py-3 bg-green-50 dark:bg-green-900/20 hover:bg-green-100 dark:hover:bg-green-900/30 rounded-lg transition-colors"
            >
              <p className="font-medium text-green-900 dark:text-green-200">Schedule Inspection</p>
              <p className="text-sm text-green-700 dark:text-green-300">Site safety inspection</p>
            </Link>
            <Link
              to="/whs/incidents"
              className="block px-4 py-3 bg-orange-50 dark:bg-orange-900/20 hover:bg-orange-100 dark:hover:bg-orange-900/30 rounded-lg transition-colors"
            >
              <p className="font-medium text-orange-900 dark:text-orange-200">Report Incident</p>
              <p className="text-sm text-orange-700 dark:text-orange-300">Log workplace incident</p>
            </Link>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">WHS Modules</h2>
          <div className="grid grid-cols-2 gap-3">
            <Link
              to="/whs/swms"
              className="p-4 bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-lg transition-colors text-center"
            >
              <DocumentTextIcon className="h-8 w-8 mx-auto mb-2 text-blue-600" />
              <p className="text-sm font-medium text-gray-900 dark:text-white">SWMS</p>
            </Link>
            <Link
              to="/whs/inspections"
              className="p-4 bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-lg transition-colors text-center"
            >
              <ClipboardDocumentCheckIcon className="h-8 w-8 mx-auto mb-2 text-green-600" />
              <p className="text-sm font-medium text-gray-900 dark:text-white">Inspections</p>
            </Link>
            <Link
              to="/whs/incidents"
              className="p-4 bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-lg transition-colors text-center"
            >
              <ExclamationTriangleIcon className="h-8 w-8 mx-auto mb-2 text-orange-600" />
              <p className="text-sm font-medium text-gray-900 dark:text-white">Incidents</p>
            </Link>
            <Link
              to="/whs/inductions"
              className="p-4 bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-lg transition-colors text-center"
            >
              <AcademicCapIcon className="h-8 w-8 mx-auto mb-2 text-purple-600" />
              <p className="text-sm font-medium text-gray-900 dark:text-white">Inductions</p>
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
