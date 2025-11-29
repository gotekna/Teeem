import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  BuildingOfficeIcon,
  UserGroupIcon,
  TruckIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ClockIcon,
  DocumentTextIcon,
  CalendarDaysIcon,
  HeartIcon,
  KeyIcon
} from '@heroicons/react/24/outline'
import api from '../api'

export default function CorporateDashboardPage() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({
    totalCompanies: 0,
    activeCompanies: 0,
    totalAssets: 0,
    complianceDueSoon: 0,
    insuranceExpiring: 0,
    healthScore: 0,
    criticalCompanies: 0
  })
  const [recentActivity, setRecentActivity] = useState([])
  const [upcomingCompliance, setUpcomingCompliance] = useState([])
  const [companiesWithHealth, setCompaniesWithHealth] = useState([])

  useEffect(() => {
    loadDashboardData()
  }, [])

  const loadDashboardData = async () => {
    try {
      setLoading(true)

      // Load companies
      const companiesResponse = await api.get('/api/v1/companies')
      const companies = companiesResponse.companies || []

      // Load compliance items due soon
      const complianceResponse = await api.get('/api/v1/company_compliance_items', {
        params: { due_soon: 'true', days: 30 }
      })
      const compliance = complianceResponse.compliance_items || []

      // Load assets
      const assetsResponse = await api.get('/api/v1/assets')
      const assets = assetsResponse.assets || []

      // Load health report
      const healthResponse = await api.get('/api/v1/companies/health_report')
      const healthSummary = healthResponse.summary || {}
      const healthCompanies = healthResponse.companies || []

      // Calculate stats
      setStats({
        totalCompanies: companies.length,
        activeCompanies: companies.filter(c => c.status === 'active').length,
        totalAssets: assets.length,
        complianceDueSoon: compliance.length,
        insuranceExpiring: assets.filter(a => a.needs_attention).length,
        healthScore: healthSummary.average_score || 0,
        criticalCompanies: healthSummary.critical || 0
      })

      // Sort companies by health score (worst first)
      setCompaniesWithHealth(healthCompanies.sort((a, b) => a.health_score - b.health_score))
      setUpcomingCompliance(compliance.slice(0, 5))

    } catch (error) {
      console.error('Failed to load dashboard:', error)
    } finally {
      setLoading(false)
    }
  }

  const statCards = [
    { name: 'Total Companies', value: stats.totalCompanies, icon: BuildingOfficeIcon, href: '/corporate/companies/list' },
    { name: 'Active Companies', value: stats.activeCompanies, icon: CheckCircleIcon, href: '/corporate/companies/list?status=active' },
    { name: 'Health Score', value: `${stats.healthScore}%`, icon: HeartIcon, href: '/corporate/health', alert: stats.criticalCompanies > 0, alertColor: stats.healthScore >= 80 ? 'green' : stats.healthScore >= 60 ? 'yellow' : 'red' },
    { name: 'Critical Companies', value: stats.criticalCompanies, icon: ExclamationTriangleIcon, href: '/corporate/health', alert: stats.criticalCompanies > 0 },
    { name: 'Total Assets', value: stats.totalAssets, icon: TruckIcon, href: '/corporate/assets' },
    { name: 'Compliance Due (30 days)', value: stats.complianceDueSoon, icon: ClockIcon, href: '/corporate/companies/list', alert: stats.complianceDueSoon > 0 }
  ]

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-500">Loading dashboard...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border-b border-gray-200 pb-5">
        <h1 className="text-3xl font-bold text-gray-900">Corporate Dashboard</h1>
        <p className="mt-2 text-sm text-gray-700">
          Manage companies, assets, compliance, and Xero integrations
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-6">
        {statCards.map((stat) => {
          const Icon = stat.icon
          // Determine colors based on alertColor or default
          const getColors = () => {
            if (stat.alertColor === 'green') return { bg: 'bg-green-500', ring: 'ring-green-500' }
            if (stat.alertColor === 'yellow') return { bg: 'bg-yellow-500', ring: 'ring-yellow-500' }
            if (stat.alertColor === 'red') return { bg: 'bg-red-500', ring: 'ring-red-500' }
            if (stat.alert) return { bg: 'bg-orange-500', ring: 'ring-orange-500' }
            return { bg: 'bg-indigo-500', ring: '' }
          }
          const colors = getColors()
          return (
            <div
              key={stat.name}
              onClick={() => navigate(stat.href)}
              className={`relative overflow-hidden rounded-lg bg-white px-4 py-5 shadow cursor-pointer hover:shadow-md transition-shadow ${
                colors.ring ? `ring-2 ${colors.ring}` : ''
              }`}
            >
              <dt>
                <div className={`absolute rounded-md p-3 ${colors.bg}`}>
                  <Icon className="h-6 w-6 text-white" aria-hidden="true" />
                </div>
                <p className="ml-16 truncate text-sm font-medium text-gray-500">{stat.name}</p>
              </dt>
              <dd className="ml-16 flex items-baseline">
                <p className="text-2xl font-semibold text-gray-900">{stat.value}</p>
              </dd>
            </div>
          )
        })}
      </div>

      {/* Quick Actions */}
      <div className="bg-white shadow rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Quick Actions</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <button
              onClick={() => navigate('/corporate/health')}
              className="inline-flex items-center justify-center rounded-md border border-transparent bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
            >
              <HeartIcon className="h-5 w-5 mr-2" />
              Health Report
            </button>
            <button
              onClick={() => navigate('/corporate/companies/new')}
              className="inline-flex items-center justify-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            >
              <BuildingOfficeIcon className="h-5 w-5 mr-2" />
              Add Company
            </button>
            <button
              onClick={() => navigate('/corporate/assets/new')}
              className="inline-flex items-center justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <TruckIcon className="h-5 w-5 mr-2" />
              Add Asset
            </button>
            <button
              onClick={() => navigate('/corporate/directors')}
              className="inline-flex items-center justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <UserGroupIcon className="h-5 w-5 mr-2" />
              View Directors
            </button>
            <button
              onClick={() => navigate('/corporate/compliance-calendar')}
              className="inline-flex items-center justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <CalendarDaysIcon className="h-5 w-5 mr-2" />
              Compliance Calendar
            </button>
            <button
              onClick={() => navigate('/corporate/minute-templates')}
              className="inline-flex items-center justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <DocumentTextIcon className="h-5 w-5 mr-2" />
              Minute Templates
            </button>
            <button
              onClick={() => navigate('/corporate/xero')}
              className="inline-flex items-center justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Xero Integration
            </button>
            <button
              onClick={() => navigate('/corporate/asic-logins')}
              className="inline-flex items-center justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <KeyIcon className="h-5 w-5 mr-2" />
              ASIC Logins
            </button>
          </div>
        </div>
      </div>

      {/* Companies with Health Status */}
      <div className="bg-white shadow rounded-lg">
        <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">All Companies</h3>
          <p className="mt-1 text-sm text-gray-500">Click a company to view details</p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Company</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Health</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ACN</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ABN</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Directors</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Issues</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {companiesWithHealth.map((company) => {
                const getStatusColor = (status) => {
                  if (status === 'excellent') return 'bg-green-100 text-green-800'
                  if (status === 'good') return 'bg-blue-100 text-blue-800'
                  if (status === 'needs_attention') return 'bg-yellow-100 text-yellow-800'
                  return 'bg-red-100 text-red-800'
                }
                const getScoreColor = (score) => {
                  if (score >= 80) return 'text-green-600'
                  if (score >= 60) return 'text-yellow-600'
                  return 'text-red-600'
                }
                return (
                  <tr
                    key={company.id}
                    onClick={() => navigate(`/corporate/companies/${company.id}?tab=health`)}
                    className="hover:bg-gray-50 cursor-pointer"
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <BuildingOfficeIcon className="h-5 w-5 text-gray-400 mr-2" />
                        <span className="text-sm font-medium text-gray-900">{company.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <span className={`text-lg font-bold ${getScoreColor(company.health_score)}`}>
                          {company.health_score}%
                        </span>
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${getStatusColor(company.health_status)}`}>
                          {company.health_status.replace('_', ' ')}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {company.has_acn ? (
                        <CheckCircleIcon className="h-5 w-5 text-green-500" />
                      ) : (
                        <ExclamationTriangleIcon className="h-5 w-5 text-red-500" />
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {company.has_abn ? (
                        <CheckCircleIcon className="h-5 w-5 text-green-500" />
                      ) : (
                        <ExclamationTriangleIcon className="h-5 w-5 text-red-500" />
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`text-sm ${company.director_count > 0 ? 'text-gray-900' : 'text-red-600 font-medium'}`}>
                        {company.director_count || 0}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex gap-1">
                        {company.issues.length > 0 && (
                          <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                            {company.issues.length} issues
                          </span>
                        )}
                        {company.warnings.length > 0 && (
                          <span className="inline-flex items-center rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-700">
                            {company.warnings.length} warnings
                          </span>
                        )}
                        {company.issues.length === 0 && company.warnings.length === 0 && (
                          <span className="text-xs text-green-600">All clear</span>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Upcoming Compliance */}
      {upcomingCompliance.length > 0 && (
        <div className="bg-white shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Upcoming Compliance (Next 30 Days)</h3>
            <div className="space-y-3">
              {upcomingCompliance.map((item) => (
                <div
                  key={item.id}
                  onClick={() => navigate(`/corporate/companies/${item.company.id}?tab=compliance`)}
                  className="flex items-center justify-between p-3 bg-orange-50 rounded-lg cursor-pointer hover:bg-orange-100"
                >
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">{item.title}</p>
                    <p className="text-sm text-gray-500">{item.company.name}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-orange-600">
                      {item.days_until_due} days
                    </p>
                    <p className="text-xs text-gray-500">
                      {new Date(item.due_date).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4">
              <button
                onClick={() => navigate('/corporate/compliance-calendar')}
                className="text-sm text-indigo-600 hover:text-indigo-500"
              >
                View all compliance items →
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
