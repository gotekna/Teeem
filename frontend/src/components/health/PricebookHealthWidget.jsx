import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { ArrowPathIcon, ChevronDownIcon, ChevronRightIcon, ExclamationTriangleIcon, CheckCircleIcon } from '@heroicons/react/24/outline'
import { api } from '../../api'

/**
 * PricebookHealthWidget - Reusable component showing pricebook data quality stats
 * Used on: HealthPage, Price Histories table page
 */
export default function PricebookHealthWidget({ compact = false }) {
  const [loading, setLoading] = useState(true)
  const [healthData, setHealthData] = useState({
    totalPricebookItems: 0,
    itemsWithoutDefaultSupplier: { count: 0 },
    itemsWithDefaultSupplierButNoPriceHistory: { count: 0 },
    itemsRequiringPhotoWithoutImage: { count: 0 },
    suppliersWithIncompleteCategoryPricing: { count: 0, suppliersWithIssuesCount: 0, totalSuppliers: 0 }
  })
  const [priceHealthCheck, setPriceHealthCheck] = useState({
    total_items_checked: 0,
    issues_found: 0
  })
  const [expanded, setExpanded] = useState(!compact)

  useEffect(() => {
    loadHealthData()
  }, [])

  const loadHealthData = async () => {
    try {
      setLoading(true)
      const [pricebookRes, priceCheckRes] = await Promise.all([
        api.get('/api/v1/health/pricebook'),
        api.get('/api/v1/pricebook/price_health_check')
      ])
      setHealthData(pricebookRes)
      setPriceHealthCheck(priceCheckRes)
    } catch (error) {
      console.error('Failed to load pricebook health data:', error)
    } finally {
      setLoading(false)
    }
  }

  const calculateHealthPercentage = (issueCount, totalItems) => {
    if (totalItems === 0) return 100
    if (issueCount === 0) return 100
    const healthyCount = totalItems - issueCount
    const percentage = (healthyCount / totalItems) * 100
    return Math.min(99, Math.round(percentage))
  }

  const getHealthColor = (percentage) => {
    if (percentage === 100) return 'green'
    if (percentage >= 75) return 'orange'
    return 'red'
  }

  const totalItems = healthData.totalPricebookItems || 0

  const checks = [
    {
      label: 'Items Without Default Supplier',
      count: healthData.itemsWithoutDefaultSupplier?.count || 0,
      percentage: calculateHealthPercentage(healthData.itemsWithoutDefaultSupplier?.count || 0, totalItems),
      link: '/system-health'
    },
    {
      label: 'Items Without Price History',
      count: healthData.itemsWithDefaultSupplierButNoPriceHistory?.count || 0,
      percentage: calculateHealthPercentage(healthData.itemsWithDefaultSupplierButNoPriceHistory?.count || 0, totalItems),
      link: '/system-health'
    },
    {
      label: 'Items Missing Photos',
      count: healthData.itemsRequiringPhotoWithoutImage?.count || 0,
      percentage: calculateHealthPercentage(healthData.itemsRequiringPhotoWithoutImage?.count || 0, totalItems),
      link: '/system-health'
    },
    {
      label: 'Suppliers Missing Prices',
      count: healthData.suppliersWithIncompleteCategoryPricing?.suppliersWithIssuesCount || 0,
      percentage: calculateHealthPercentage(
        healthData.suppliersWithIncompleteCategoryPricing?.suppliersWithIssuesCount || 0,
        healthData.suppliersWithIncompleteCategoryPricing?.totalSuppliers || 0
      ),
      link: '/system-health'
    },
    {
      label: 'Price Mismatches',
      count: priceHealthCheck.issues_found || 0,
      percentage: calculateHealthPercentage(priceHealthCheck.issues_found || 0, priceHealthCheck.total_items_checked || 0),
      link: '/system-health'
    }
  ]

  const overallPercentage = Math.round(
    checks.reduce((sum, check) => sum + check.percentage, 0) / checks.length
  )
  const overallColor = getHealthColor(overallPercentage)

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex items-center justify-center py-4">
          <ArrowPathIcon className="h-5 w-5 animate-spin text-gray-400" />
          <span className="ml-2 text-sm text-gray-500">Loading health data...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
      {/* Header */}
      <div
        className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3">
          <div className={`flex items-center justify-center w-10 h-10 rounded-lg ${
            overallColor === 'green' ? 'bg-green-100 dark:bg-green-900/30' :
            overallColor === 'orange' ? 'bg-orange-100 dark:bg-orange-900/30' :
            'bg-red-100 dark:bg-red-900/30'
          }`}>
            {overallColor === 'green' ? (
              <CheckCircleIcon className="h-6 w-6 text-green-600 dark:text-green-400" />
            ) : (
              <ExclamationTriangleIcon className={`h-6 w-6 ${
                overallColor === 'orange' ? 'text-orange-600 dark:text-orange-400' : 'text-red-600 dark:text-red-400'
              }`} />
            )}
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
              Pricebook Health
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {totalItems.toLocaleString()} items tracked
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className={`text-2xl font-bold ${
            overallColor === 'green' ? 'text-green-600 dark:text-green-400' :
            overallColor === 'orange' ? 'text-orange-600 dark:text-orange-400' :
            'text-red-600 dark:text-red-400'
          }`}>
            {overallPercentage}%
          </span>
          <button
            onClick={(e) => {
              e.stopPropagation()
              loadHealthData()
            }}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
          >
            <ArrowPathIcon className="h-4 w-4 text-gray-400" />
          </button>
          {expanded ? (
            <ChevronDownIcon className="h-5 w-5 text-gray-400" />
          ) : (
            <ChevronRightIcon className="h-5 w-5 text-gray-400" />
          )}
        </div>
      </div>

      {/* Expanded Details */}
      {expanded && (
        <div className="p-4 space-y-3">
          {checks.map((check, idx) => {
            const color = getHealthColor(check.percentage)
            return (
              <div key={idx} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${
                    color === 'green' ? 'bg-green-500' :
                    color === 'orange' ? 'bg-orange-500' :
                    'bg-red-500'
                  }`} />
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    {check.label}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {check.count > 0 ? (
                    <span className={`text-sm font-medium ${
                      color === 'green' ? 'text-green-600 dark:text-green-400' :
                      color === 'orange' ? 'text-orange-600 dark:text-orange-400' :
                      'text-red-600 dark:text-red-400'
                    }`}>
                      {check.count} issues
                    </span>
                  ) : (
                    <span className="text-sm text-green-600 dark:text-green-400 font-medium">
                      OK
                    </span>
                  )}
                  <span className={`text-xs px-1.5 py-0.5 rounded ${
                    color === 'green' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                    color === 'orange' ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' :
                    'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                  }`}>
                    {check.percentage}%
                  </span>
                </div>
              </div>
            )
          })}

          {/* Link to full health page */}
          <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
            <Link
              to="/system-health"
              className="text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 hover:underline"
            >
              View full health report →
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
