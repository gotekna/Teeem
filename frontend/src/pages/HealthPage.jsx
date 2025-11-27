import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { PlusIcon, ArrowPathIcon, ChevronDownIcon, ChevronRightIcon, MagnifyingGlassIcon, Bars3Icon, ChevronUpIcon, LinkIcon, ExclamationCircleIcon, ExclamationTriangleIcon, CheckCircleIcon, Cog6ToothIcon } from '@heroicons/react/24/outline'
import { api } from '../api'

export default function HealthPage() {
  const [loading, setLoading] = useState(true)
  const [healthChecks, setHealthChecks] = useState({
    totalPricebookItems: 0,
    itemsWithoutDefaultSupplier: {
      count: 0,
      items: []
    },
    suppliersWithIncompleteCategoryPricing: {
      count: 0,
      suppliersWithIssuesCount: 0,
      totalSuppliers: 0,
      suppliers: []
    },
    itemsWithDefaultSupplierButNoPriceHistory: {
      count: 0,
      items: []
    },
    itemsRequiringPhotoWithoutImage: {
      count: 0,
      items: []
    }
  })
  const [priceHealthCheck, setPriceHealthCheck] = useState({
    total_items_checked: 0,
    issues_found: 0,
    issues: []
  })
  const [xeroSyncHealth, setXeroSyncHealth] = useState(null)
  const [expandedSupplierCategory, setExpandedSupplierCategory] = useState(null)
  const [loadingMissingItems, setLoadingMissingItems] = useState(false)
  const [missingItems, setMissingItems] = useState({})
  const [expandedSections, setExpandedSections] = useState({
    itemsWithoutDefaultSupplier: false,
    suppliersWithIncompleteCategoryPricing: false,
    itemsWithDefaultSupplierButNoPriceHistory: false,
    itemsRequiringPhotoWithoutImage: false,
    priceMismatches: false,
    xeroSync: true
  })
  const [searchQueries, setSearchQueries] = useState({
    itemsWithoutDefaultSupplier: '',
    suppliersWithIncompleteCategoryPricing: '',
    itemsWithDefaultSupplierButNoPriceHistory: '',
    itemsRequiringPhotoWithoutImage: '',
    priceMismatches: ''
  })

  // Column order state with localStorage persistence
  const [itemsWithoutSupplierColumnOrder, setItemsWithoutSupplierColumnOrder] = useState(() => {
    const saved = localStorage.getItem('health_itemsWithoutSupplier_columnOrder')
    return saved ? JSON.parse(saved) : ['item_code', 'item_name', 'category', 'current_price']
  })

  const [suppliersColumnOrder, setSuppliersColumnOrder] = useState(() => {
    const saved = localStorage.getItem('health_suppliers_columnOrder')
    return saved ? JSON.parse(saved) : ['supplier', 'category', 'coverage', 'items_priced', 'missing_prices']
  })

  const [itemsWithSupplierColumnOrder, setItemsWithSupplierColumnOrder] = useState(() => {
    const saved = localStorage.getItem('health_itemsWithSupplier_columnOrder')
    return saved ? JSON.parse(saved) : ['item_code', 'item_name', 'category', 'default_supplier', 'current_price']
  })

  const [itemsRequiringPhotoColumnOrder, setItemsRequiringPhotoColumnOrder] = useState(() => {
    const saved = localStorage.getItem('health_itemsRequiringPhoto_columnOrder')
    return saved ? JSON.parse(saved) : ['item_code', 'item_name', 'category', 'current_price']
  })

  const [priceMismatchesColumnOrder, setPriceMismatchesColumnOrder] = useState(() => {
    const saved = localStorage.getItem('health_priceMismatches_columnOrder')
    return saved ? JSON.parse(saved) : ['item_code', 'item_name', 'default_supplier', 'current_price', 'active_price', 'difference']
  })

  // Column widths with localStorage persistence
  const [itemsWithoutSupplierColumnWidths, setItemsWithoutSupplierColumnWidths] = useState(() => {
    const saved = localStorage.getItem('health_itemsWithoutSupplier_columnWidths')
    return saved ? JSON.parse(saved) : {
      item_code: 150,
      item_name: 250,
      category: 150,
      current_price: 150
    }
  })

  const [suppliersColumnWidths, setSuppliersColumnWidths] = useState(() => {
    const saved = localStorage.getItem('health_suppliers_columnWidths')
    return saved ? JSON.parse(saved) : {
      supplier: 200,
      category: 150,
      coverage: 150,
      items_priced: 150,
      missing_prices: 150
    }
  })

  const [itemsWithSupplierColumnWidths, setItemsWithSupplierColumnWidths] = useState(() => {
    const saved = localStorage.getItem('health_itemsWithSupplier_columnWidths')
    return saved ? JSON.parse(saved) : {
      item_code: 150,
      item_name: 250,
      category: 150,
      default_supplier: 200,
      current_price: 150
    }
  })

  const [itemsRequiringPhotoColumnWidths, setItemsRequiringPhotoColumnWidths] = useState(() => {
    const saved = localStorage.getItem('health_itemsRequiringPhoto_columnWidths')
    return saved ? JSON.parse(saved) : {
      item_code: 150,
      item_name: 250,
      category: 150,
      current_price: 150
    }
  })

  const [priceMismatchesColumnWidths, setPriceMismatchesColumnWidths] = useState(() => {
    const saved = localStorage.getItem('health_priceMismatches_columnWidths')
    return saved ? JSON.parse(saved) : {
      item_code: 150,
      item_name: 250,
      default_supplier: 200,
      current_price: 150,
      active_price: 150,
      difference: 150
    }
  })

  // Sort state (primary and secondary)
  const [sortBy, setSortBy] = useState({
    itemsWithoutSupplier: 'item_code',
    suppliers: 'supplier',
    itemsWithSupplier: 'item_code',
    itemsRequiringPhoto: 'item_code',
    priceMismatches: 'item_code'
  })

  const [sortDirection, setSortDirection] = useState({
    itemsWithoutSupplier: 'asc',
    suppliers: 'asc',
    itemsWithSupplier: 'asc',
    itemsRequiringPhoto: 'asc',
    priceMismatches: 'asc'
  })

  // Column resize state
  const [resizingColumn, setResizingColumn] = useState(null)
  const [resizeStartX, setResizeStartX] = useState(0)
  const [resizeStartWidth, setResizeStartWidth] = useState(0)
  const [resizingTable, setResizingTable] = useState(null)

  // Dragged column state
  const [draggedColumn, setDraggedColumn] = useState(null)
  const [draggedTable, setDraggedTable] = useState(null)

  const toggleSection = (sectionName) => {
    setExpandedSections(prev => ({
      ...prev,
      [sectionName]: !prev[sectionName]
    }))
  }

  const updateSearchQuery = (sectionName, value) => {
    setSearchQueries(prev => ({
      ...prev,
      [sectionName]: value
    }))
  }

  const filterItems = (items, sectionName) => {
    const query = searchQueries[sectionName]
    if (!query.trim()) return items

    const queryLower = query.toLowerCase()
    return items.filter(item =>
      item.item_code?.toLowerCase().includes(queryLower) ||
      item.item_name?.toLowerCase().includes(queryLower) ||
      item.category?.toLowerCase().includes(queryLower)
    )
  }

  const filterSuppliers = (suppliers) => {
    const query = searchQueries.suppliersWithIncompleteCategoryPricing
    if (!query.trim()) return suppliers

    const queryLower = query.toLowerCase()
    return suppliers.filter(entry =>
      entry.supplier?.name?.toLowerCase().includes(queryLower) ||
      entry.category?.toLowerCase().includes(queryLower)
    )
  }

  useEffect(() => {
    loadHealthData()
    loadPriceHealthCheck()
    loadXeroSyncHealth()
  }, [])

  // Persist column order to localStorage
  useEffect(() => {
    localStorage.setItem('health_itemsWithoutSupplier_columnOrder', JSON.stringify(itemsWithoutSupplierColumnOrder))
  }, [itemsWithoutSupplierColumnOrder])

  useEffect(() => {
    localStorage.setItem('health_suppliers_columnOrder', JSON.stringify(suppliersColumnOrder))
  }, [suppliersColumnOrder])

  useEffect(() => {
    localStorage.setItem('health_itemsWithSupplier_columnOrder', JSON.stringify(itemsWithSupplierColumnOrder))
  }, [itemsWithSupplierColumnOrder])

  useEffect(() => {
    localStorage.setItem('health_itemsRequiringPhoto_columnOrder', JSON.stringify(itemsRequiringPhotoColumnOrder))
  }, [itemsRequiringPhotoColumnOrder])

  useEffect(() => {
    localStorage.setItem('health_priceMismatches_columnOrder', JSON.stringify(priceMismatchesColumnOrder))
  }, [priceMismatchesColumnOrder])

  // Persist column widths to localStorage
  useEffect(() => {
    localStorage.setItem('health_itemsWithoutSupplier_columnWidths', JSON.stringify(itemsWithoutSupplierColumnWidths))
  }, [itemsWithoutSupplierColumnWidths])

  useEffect(() => {
    localStorage.setItem('health_suppliers_columnWidths', JSON.stringify(suppliersColumnWidths))
  }, [suppliersColumnWidths])

  useEffect(() => {
    localStorage.setItem('health_itemsWithSupplier_columnWidths', JSON.stringify(itemsWithSupplierColumnWidths))
  }, [itemsWithSupplierColumnWidths])

  useEffect(() => {
    localStorage.setItem('health_itemsRequiringPhoto_columnWidths', JSON.stringify(itemsRequiringPhotoColumnWidths))
  }, [itemsRequiringPhotoColumnWidths])

  useEffect(() => {
    localStorage.setItem('health_priceMismatches_columnWidths', JSON.stringify(priceMismatchesColumnWidths))
  }, [priceMismatchesColumnWidths])

  // Add mouse move and mouse up listeners for column resizing
  useEffect(() => {
    if (resizingColumn) {
      window.addEventListener('mousemove', handleResizeMove)
      window.addEventListener('mouseup', handleResizeEnd)
      return () => {
        window.removeEventListener('mousemove', handleResizeMove)
        window.removeEventListener('mouseup', handleResizeEnd)
      }
    }
  }, [resizingColumn, resizeStartX, resizeStartWidth, resizingTable])

  const loadHealthData = async () => {
    try {
      setLoading(true)
      const response = await api.get('/api/v1/health/pricebook')
      setHealthChecks(response)
    } catch (error) {
      console.error('Failed to load health data:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadPriceHealthCheck = async () => {
    try {
      const response = await api.get('/api/v1/pricebook/price_health_check')
      setPriceHealthCheck(response)
    } catch (error) {
      console.error('Failed to load price health check:', error)
    }
  }

  const loadXeroSyncHealth = async () => {
    try {
      const response = await api.get('/api/v1/sync_configurations/health')
      setXeroSyncHealth(response.health)
    } catch (error) {
      console.error('Failed to load Xero sync health:', error)
    }
  }

  const toggleSupplierCategory = async (supplierId, category) => {
    const key = `${supplierId}-${category}`

    if (expandedSupplierCategory === key) {
      // Collapse if already expanded
      setExpandedSupplierCategory(null)
      return
    }

    // Expand and load missing items if not already loaded
    setExpandedSupplierCategory(key)

    if (!missingItems[key]) {
      try {
        setLoadingMissingItems(true)
        const response = await api.get(`/api/v1/health/pricebook/missing_items?supplier_id=${supplierId}&category=${encodeURIComponent(category)}`)
        setMissingItems(prev => ({ ...prev, [key]: response.items }))
      } catch (error) {
        console.error('Failed to load missing items:', error)
      } finally {
        setLoadingMissingItems(false)
      }
    }
  }

  // Column drag and drop handlers
  const handleDragStart = (e, columnKey, tableName) => {
    setDraggedColumn(columnKey)
    setDraggedTable(tableName)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  const handleDrop = (e, targetColumnKey, tableName) => {
    e.preventDefault()

    if (!draggedColumn || draggedColumn === targetColumnKey || draggedTable !== tableName) {
      setDraggedColumn(null)
      setDraggedTable(null)
      return
    }

    let currentOrder, setOrder

    switch (tableName) {
      case 'itemsWithoutSupplier':
        currentOrder = itemsWithoutSupplierColumnOrder
        setOrder = setItemsWithoutSupplierColumnOrder
        break
      case 'suppliers':
        currentOrder = suppliersColumnOrder
        setOrder = setSuppliersColumnOrder
        break
      case 'itemsWithSupplier':
        currentOrder = itemsWithSupplierColumnOrder
        setOrder = setItemsWithSupplierColumnOrder
        break
      case 'itemsRequiringPhoto':
        currentOrder = itemsRequiringPhotoColumnOrder
        setOrder = setItemsRequiringPhotoColumnOrder
        break
      case 'priceMismatches':
        currentOrder = priceMismatchesColumnOrder
        setOrder = setPriceMismatchesColumnOrder
        break
      default:
        setDraggedColumn(null)
        setDraggedTable(null)
        return
    }

    const draggedIndex = currentOrder.indexOf(draggedColumn)
    const targetIndex = currentOrder.indexOf(targetColumnKey)

    const newOrder = [...currentOrder]
    newOrder.splice(draggedIndex, 1)
    newOrder.splice(targetIndex, 0, draggedColumn)

    setOrder(newOrder)
    setDraggedColumn(null)
    setDraggedTable(null)
  }

  // Sort handler
  const handleSort = (columnKey, tableName) => {
    setSortBy(prev => ({ ...prev, [tableName]: columnKey }))
    setSortDirection(prev => ({
      ...prev,
      [tableName]: prev[tableName] === 'asc' && sortBy[tableName] === columnKey ? 'desc' : 'asc'
    }))
  }

  // Column resize handlers
  const handleResizeStart = (e, columnKey, tableName) => {
    e.preventDefault()
    e.stopPropagation()
    setResizingColumn(columnKey)
    setResizingTable(tableName)
    setResizeStartX(e.clientX)

    let widths
    switch (tableName) {
      case 'itemsWithoutSupplier':
        widths = itemsWithoutSupplierColumnWidths
        break
      case 'suppliers':
        widths = suppliersColumnWidths
        break
      case 'itemsWithSupplier':
        widths = itemsWithSupplierColumnWidths
        break
      case 'itemsRequiringPhoto':
        widths = itemsRequiringPhotoColumnWidths
        break
      case 'priceMismatches':
        widths = priceMismatchesColumnWidths
        break
      default:
        return
    }

    setResizeStartWidth(widths[columnKey])
  }

  const handleResizeMove = (e) => {
    if (!resizingColumn || !resizingTable) return
    const diff = e.clientX - resizeStartX
    const newWidth = Math.max(100, resizeStartWidth + diff)

    switch (resizingTable) {
      case 'itemsWithoutSupplier':
        setItemsWithoutSupplierColumnWidths(prev => ({
          ...prev,
          [resizingColumn]: newWidth
        }))
        break
      case 'suppliers':
        setSuppliersColumnWidths(prev => ({
          ...prev,
          [resizingColumn]: newWidth
        }))
        break
      case 'itemsWithSupplier':
        setItemsWithSupplierColumnWidths(prev => ({
          ...prev,
          [resizingColumn]: newWidth
        }))
        break
      case 'itemsRequiringPhoto':
        setItemsRequiringPhotoColumnWidths(prev => ({
          ...prev,
          [resizingColumn]: newWidth
        }))
        break
      case 'priceMismatches':
        setPriceMismatchesColumnWidths(prev => ({
          ...prev,
          [resizingColumn]: newWidth
        }))
        break
    }
  }

  const handleResizeEnd = () => {
    setResizingColumn(null)
    setResizingTable(null)
  }

  // Column configuration objects
  const itemsWithoutSupplierColumns = {
    item_code: { key: 'item_code', label: 'Item Code' },
    item_name: { key: 'item_name', label: 'Item Name' },
    category: { key: 'category', label: 'Category' },
    current_price: { key: 'current_price', label: 'Current Price' }
  }

  const suppliersColumns = {
    supplier: { key: 'supplier', label: 'Supplier' },
    category: { key: 'category', label: 'Category' },
    coverage: { key: 'coverage', label: 'Coverage' },
    items_priced: { key: 'items_priced', label: 'Items Priced' },
    missing_prices: { key: 'missing_prices', label: 'Missing Prices' }
  }

  const itemsWithSupplierColumns = {
    item_code: { key: 'item_code', label: 'Item Code' },
    item_name: { key: 'item_name', label: 'Item Name' },
    category: { key: 'category', label: 'Category' },
    default_supplier: { key: 'default_supplier', label: 'Default Supplier' },
    current_price: { key: 'current_price', label: 'Current Price' }
  }

  const itemsRequiringPhotoColumns = {
    item_code: { key: 'item_code', label: 'Item Code' },
    item_name: { key: 'item_name', label: 'Item Name' },
    category: { key: 'category', label: 'Category' },
    current_price: { key: 'current_price', label: 'Current Price' }
  }

  const priceMismatchesColumns = {
    item_code: { key: 'item_code', label: 'Item Code' },
    item_name: { key: 'item_name', label: 'Item Name' },
    default_supplier: { key: 'default_supplier', label: 'Default Supplier' },
    current_price: { key: 'current_price', label: 'Current Price' },
    active_price: { key: 'active_price', label: 'Active Price' },
    difference: { key: 'difference', label: 'Difference' }
  }

  // Calculate health percentage for each health check
  // Returns the percentage of items that are HEALTHY (correct)
  const calculateHealthPercentage = (issueCount, totalItems) => {
    if (totalItems === 0) return 100 // No items = 100% healthy
    if (issueCount === 0) return 100 // No issues = 100% healthy

    const healthyCount = totalItems - issueCount
    const percentage = (healthyCount / totalItems) * 100

    // If there's at least one issue, cap at 99% (never show 100%)
    return Math.min(99, Math.round(percentage))
  }

  // Use the real total from the backend
  const totalPricebookItems = healthChecks.totalPricebookItems || 0

  // Calculate individual health percentages
  const itemsWithoutDefaultSupplierPct = calculateHealthPercentage(
    healthChecks.itemsWithoutDefaultSupplier.count,
    totalPricebookItems
  )

  const itemsWithDefaultSupplierButNoPriceHistoryPct = calculateHealthPercentage(
    healthChecks.itemsWithDefaultSupplierButNoPriceHistory.count,
    totalPricebookItems
  )

  const itemsRequiringPhotoWithoutImagePct = calculateHealthPercentage(
    healthChecks.itemsRequiringPhotoWithoutImage.count,
    totalPricebookItems
  )

  const priceMismatchesPct = calculateHealthPercentage(
    priceHealthCheck.issues_found,
    priceHealthCheck.total_items_checked
  )

  // Suppliers percentage - calculate health percentage for suppliers
  // Based on unique suppliers with issues vs total suppliers
  const suppliersHealthPct = calculateHealthPercentage(
    healthChecks.suppliersWithIncompleteCategoryPricing.suppliersWithIssuesCount || 0,
    healthChecks.suppliersWithIncompleteCategoryPricing.totalSuppliers || 0
  )

  // Overall health is the average of all health percentages
  const overallHealthPercentage = Math.round(
    (itemsWithoutDefaultSupplierPct +
     suppliersHealthPct +
     itemsWithDefaultSupplierButNoPriceHistoryPct +
     itemsRequiringPhotoWithoutImagePct +
     priceMismatchesPct) / 5
  )

  const getHealthColor = (percentage) => {
    if (percentage === 100) return 'green'
    if (percentage >= 75) return 'orange'
    return 'red'
  }


  const healthPercentage = overallHealthPercentage
  const healthColor = getHealthColor(healthPercentage)

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    )
  }

  return (
    <div className="-mx-4 sm:-mx-6 lg:-mx-8 h-screen flex flex-col bg-white dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center justify-center w-10 h-10 bg-red-100 dark:bg-red-900/30 rounded-lg">
              <PlusIcon className="h-6 w-6 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
                System Health
              </h1>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">
                Monitor data quality and system integrity
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {/* Health Percentage Display */}
            <div className="flex items-center gap-3">
              <div className="text-right">
                <div className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  Overall Health
                </div>
                <div className={`text-3xl font-bold ${
                  healthColor === 'green' ? 'text-green-600 dark:text-green-400' :
                  healthColor === 'yellow' ? 'text-yellow-600 dark:text-yellow-400' :
                  healthColor === 'orange' ? 'text-orange-600 dark:text-orange-400' :
                  'text-red-600 dark:text-red-400'
                }`}>
                  {healthPercentage}%
                </div>
              </div>
              <div className="w-16 h-16">
                <svg className="transform -rotate-90" viewBox="0 0 100 100">
                  {/* Background circle */}
                  <circle
                    cx="50"
                    cy="50"
                    r="42"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="12"
                    className="text-gray-200 dark:text-gray-700"
                  />
                  {/* Progress circle */}
                  <circle
                    cx="50"
                    cy="50"
                    r="42"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="12"
                    strokeDasharray={`${(healthPercentage / 100) * 264} 264`}
                    strokeLinecap="round"
                    className={
                      healthColor === 'green' ? 'text-green-600 dark:text-green-400' :
                      healthColor === 'yellow' ? 'text-yellow-600 dark:text-yellow-400' :
                      healthColor === 'orange' ? 'text-orange-600 dark:text-orange-400' :
                      'text-red-600 dark:text-red-400'
                    }
                  />
                </svg>
              </div>
            </div>
            <button
              onClick={loadHealthData}
              disabled={loading}
              className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <ArrowPathIcon className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4 sm:p-6 lg:p-8">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Pricebook Health Section */}
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Pricebook Data Quality
              </h2>
            </div>

            <div className="p-6 space-y-8">
              {/* Items Without Default Supplier */}
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-start gap-3 p-2 -ml-2">
                    <button
                      onClick={() => toggleSection('itemsWithoutDefaultSupplier')}
                      className="flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-lg transition-colors flex-shrink-0"
                    >
                      <div className={`flex items-center justify-center w-12 h-12 rounded-lg ${
                        getHealthColor(itemsWithoutDefaultSupplierPct) === 'green' ? 'bg-green-100 dark:bg-green-900/30' :
                        getHealthColor(itemsWithoutDefaultSupplierPct) === 'orange' ? 'bg-orange-100 dark:bg-orange-900/30' :
                        'bg-red-100 dark:bg-red-900/30'
                      }`}>
                        <span className={`text-2xl font-bold ${
                          getHealthColor(itemsWithoutDefaultSupplierPct) === 'green' ? 'text-green-600 dark:text-green-400' :
                          getHealthColor(itemsWithoutDefaultSupplierPct) === 'orange' ? 'text-orange-600 dark:text-orange-400' :
                          'text-red-600 dark:text-red-400'
                        }`}>
                          {healthChecks.itemsWithoutDefaultSupplier.count}
                        </span>
                      </div>
                      <div className="flex-1 text-left">
                        <h3 className="text-base font-medium text-gray-900 dark:text-white flex items-center gap-2">
                          Items Without Default Supplier
                          <span className={`text-sm font-bold ${
                            getHealthColor(itemsWithoutDefaultSupplierPct) === 'green' ? 'text-green-600 dark:text-green-400' :
                            getHealthColor(itemsWithoutDefaultSupplierPct) === 'yellow' ? 'text-yellow-600 dark:text-yellow-400' :
                            getHealthColor(itemsWithoutDefaultSupplierPct) === 'orange' ? 'text-orange-600 dark:text-orange-400' :
                            'text-red-600 dark:text-red-400'
                          }`}>
                            ({itemsWithoutDefaultSupplierPct}%)
                          </span>
                          {healthChecks.itemsWithoutDefaultSupplier.count > 0 && (
                            expandedSections.itemsWithoutDefaultSupplier ? (
                              <ChevronDownIcon className="h-5 w-5 text-gray-400" />
                            ) : (
                              <ChevronRightIcon className="h-5 w-5 text-gray-400" />
                            )
                          )}
                        </h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                          Pricebook items that don't have a default supplier assigned
                        </p>
                      </div>
                    </button>
                    {healthChecks.itemsWithoutDefaultSupplier.count > 0 && (
                      <div className="relative flex-1 max-w-xs">
                        <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <input
                          type="text"
                          placeholder="Search..."
                          value={searchQueries.itemsWithoutDefaultSupplier}
                          onChange={(e) => updateSearchQuery('itemsWithoutDefaultSupplier', e.target.value)}
                          onClick={(e) => {
                            e.stopPropagation()
                            if (!expandedSections.itemsWithoutDefaultSupplier) {
                              toggleSection('itemsWithoutDefaultSupplier')
                            }
                          }}
                          className="w-full pl-9 pr-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                        />
                      </div>
                    )}
                  </div>

                  {/* Item List */}
                  {healthChecks.itemsWithoutDefaultSupplier.count > 0 && expandedSections.itemsWithoutDefaultSupplier && (
                    <div className="mt-4 ml-15">
                      <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                          <thead className="bg-gray-50 dark:bg-gray-900 sticky top-0 z-10">
                            <tr>
                              {itemsWithoutSupplierColumnOrder.map((columnKey) => {
                                const column = itemsWithoutSupplierColumns[columnKey]
                                const width = itemsWithoutSupplierColumnWidths[columnKey]
                                const isSorted = sortBy.itemsWithoutSupplier === columnKey
                                return (
                                  <th
                                    key={columnKey}
                                    style={{ width: `${width}px`, minWidth: `${width}px`, position: 'relative' }}
                                    className={`px-4 py-2 text-left border-r border-gray-200 dark:border-gray-700 ${draggedColumn === columnKey && draggedTable === 'itemsWithoutSupplier' ? 'bg-indigo-100 dark:bg-indigo-900/20' : ''}`}
                                    draggable
                                    onDragStart={(e) => handleDragStart(e, columnKey, 'itemsWithoutSupplier')}
                                    onDragOver={handleDragOver}
                                    onDrop={(e) => handleDrop(e, columnKey, 'itemsWithoutSupplier')}
                                  >
                                    <div
                                      className="flex items-center gap-2 cursor-pointer"
                                      onClick={() => handleSort(columnKey, 'itemsWithoutSupplier')}
                                    >
                                      <Bars3Icon className="h-4 w-4 text-gray-400 cursor-move" />
                                      <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                        {column.label}
                                      </span>
                                      {isSorted && (
                                        sortDirection.itemsWithoutSupplier === 'asc' ?
                                          <ChevronUpIcon className="h-4 w-4 text-indigo-600 dark:text-indigo-400" /> :
                                          <ChevronDownIcon className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                                      )}
                                    </div>
                                    {/* Resize handle */}
                                    <div
                                      className="absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-indigo-400 dark:hover:bg-indigo-600 transition-colors z-20"
                                      onMouseDown={(e) => handleResizeStart(e, columnKey, 'itemsWithoutSupplier')}
                                      onClick={(e) => e.stopPropagation()}
                                    />
                                  </th>
                                )
                              })}
                            </tr>
                          </thead>
                          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                            {filterItems(healthChecks.itemsWithoutDefaultSupplier.items, 'itemsWithoutDefaultSupplier').slice(0, 10).map((item) => (
                              <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                {itemsWithoutSupplierColumnOrder.map((columnKey) => {
                                  const width = itemsWithoutSupplierColumnWidths[columnKey]
                                  const cellStyle = { width: `${width}px`, minWidth: `${width}px`, maxWidth: `${width}px` }

                                  switch (columnKey) {
                                    case 'item_code':
                                      return (
                                        <td key={columnKey} style={cellStyle} className="px-4 py-3 text-sm text-gray-900 dark:text-white font-medium">
                                          <Link
                                            to={`/price-books/${item.id}`}
                                            className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 hover:underline"
                                          >
                                            {item.item_code}
                                          </Link>
                                        </td>
                                      )
                                    case 'item_name':
                                      return (
                                        <td key={columnKey} style={cellStyle} className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                                          {item.item_name}
                                        </td>
                                      )
                                    case 'category':
                                      return (
                                        <td key={columnKey} style={cellStyle} className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                                          {item.category || '-'}
                                        </td>
                                      )
                                    case 'current_price':
                                      return (
                                        <td key={columnKey} style={cellStyle} className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                                          {item.current_price ? `$${parseFloat(item.current_price).toFixed(2)}` : '-'}
                                        </td>
                                      )
                                    default:
                                      return null
                                  }
                                })}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {healthChecks.itemsWithoutDefaultSupplier.count > 10 && (
                          <div className="px-4 py-3 bg-gray-50 dark:bg-gray-900 text-sm text-gray-600 dark:text-gray-400 text-center">
                            Showing 10 of {healthChecks.itemsWithoutDefaultSupplier.count} items
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Status Badge */}
                <div>
                  {healthChecks.itemsWithoutDefaultSupplier.count === 0 ? (
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400">
                      Healthy
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-400">
                      Needs Attention
                    </span>
                  )}
                </div>
              </div>

              {/* Suppliers with Incomplete Category Pricing */}
              <div className="flex items-start justify-between pt-8 border-t border-gray-200 dark:border-gray-700">
                <div className="flex-1">
                  <div className="flex items-start gap-3 p-2 -ml-2">
                    <button
                      onClick={() => toggleSection('suppliersWithIncompleteCategoryPricing')}
                      className="flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-lg transition-colors flex-shrink-0"
                    >
                      <div className={`flex items-center justify-center w-12 h-12 rounded-lg ${
                        getHealthColor(suppliersHealthPct) === 'green' ? 'bg-green-100 dark:bg-green-900/30' :
                        getHealthColor(suppliersHealthPct) === 'orange' ? 'bg-orange-100 dark:bg-orange-900/30' :
                        'bg-red-100 dark:bg-red-900/30'
                      }`}>
                        <span className={`text-2xl font-bold ${
                          getHealthColor(suppliersHealthPct) === 'green' ? 'text-green-600 dark:text-green-400' :
                          getHealthColor(suppliersHealthPct) === 'orange' ? 'text-orange-600 dark:text-orange-400' :
                          'text-red-600 dark:text-red-400'
                        }`}>
                          {healthChecks.suppliersWithIncompleteCategoryPricing.count}
                        </span>
                      </div>
                      <div className="flex-1 text-left">
                        <h3 className="text-base font-medium text-gray-900 dark:text-white flex items-center gap-2">
                          Suppliers with Incomplete Category Pricing
                          <span className={`text-sm font-bold ${
                            getHealthColor(suppliersHealthPct) === 'green' ? 'text-green-600 dark:text-green-400' :
                            getHealthColor(suppliersHealthPct) === 'yellow' ? 'text-yellow-600 dark:text-yellow-400' :
                            getHealthColor(suppliersHealthPct) === 'orange' ? 'text-orange-600 dark:text-orange-400' :
                            'text-red-600 dark:text-red-400'
                          }`}>
                            ({suppliersHealthPct}%)
                          </span>
                          {healthChecks.suppliersWithIncompleteCategoryPricing.count > 0 && (
                            expandedSections.suppliersWithIncompleteCategoryPricing ? (
                              <ChevronDownIcon className="h-5 w-5 text-gray-400" />
                            ) : (
                              <ChevronRightIcon className="h-5 w-5 text-gray-400" />
                            )
                          )}
                        </h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                          Suppliers who have price history for some items in a category but not all
                        </p>
                      </div>
                    </button>
                    {healthChecks.suppliersWithIncompleteCategoryPricing.count > 0 && (
                      <div className="relative flex-1 max-w-xs">
                        <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <input
                          type="text"
                          placeholder="Search..."
                          value={searchQueries.suppliersWithIncompleteCategoryPricing}
                          onChange={(e) => updateSearchQuery('suppliersWithIncompleteCategoryPricing', e.target.value)}
                          onClick={(e) => {
                            e.stopPropagation()
                            if (!expandedSections.suppliersWithIncompleteCategoryPricing) {
                              toggleSection('suppliersWithIncompleteCategoryPricing')
                            }
                          }}
                          className="w-full pl-9 pr-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                        />
                      </div>
                    )}
                  </div>

                  {/* Supplier List */}
                  {healthChecks.suppliersWithIncompleteCategoryPricing.count > 0 && expandedSections.suppliersWithIncompleteCategoryPricing && (
                    <div className="mt-4 ml-15">
                      <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                          <thead className="bg-gray-50 dark:bg-gray-900 sticky top-0 z-10">
                            <tr>
                              {suppliersColumnOrder.map((columnKey) => {
                                const column = suppliersColumns[columnKey]
                                const width = suppliersColumnWidths[columnKey]
                                const isSorted = sortBy.suppliers === columnKey
                                return (
                                  <th
                                    key={columnKey}
                                    style={{ width: `${width}px`, minWidth: `${width}px`, position: 'relative' }}
                                    className={`px-4 py-2 ${columnKey === 'coverage' || columnKey === 'items_priced' || columnKey === 'missing_prices' ? 'text-center' : 'text-left'} border-r border-gray-200 dark:border-gray-700 ${draggedColumn === columnKey && draggedTable === 'suppliers' ? 'bg-indigo-100 dark:bg-indigo-900/20' : ''}`}
                                    draggable
                                    onDragStart={(e) => handleDragStart(e, columnKey, 'suppliers')}
                                    onDragOver={handleDragOver}
                                    onDrop={(e) => handleDrop(e, columnKey, 'suppliers')}
                                  >
                                    <div
                                      className="flex items-center gap-2 cursor-pointer justify-center"
                                      onClick={() => handleSort(columnKey, 'suppliers')}
                                    >
                                      <Bars3Icon className="h-4 w-4 text-gray-400 cursor-move" />
                                      <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                        {column.label}
                                      </span>
                                      {isSorted && (
                                        sortDirection.suppliers === 'asc' ?
                                          <ChevronUpIcon className="h-4 w-4 text-indigo-600 dark:text-indigo-400" /> :
                                          <ChevronDownIcon className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                                      )}
                                    </div>
                                    {/* Resize handle */}
                                    <div
                                      className="absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-indigo-400 dark:hover:bg-indigo-600 transition-colors z-20"
                                      onMouseDown={(e) => handleResizeStart(e, columnKey, 'suppliers')}
                                      onClick={(e) => e.stopPropagation()}
                                    />
                                  </th>
                                )
                              })}
                            </tr>
                          </thead>
                          <tbody className="bg-white dark:bg-gray-800">
                            {filterSuppliers(healthChecks.suppliersWithIncompleteCategoryPricing.suppliers).slice(0, 15).map((entry, idx) => {
                              const key = `${entry.supplier.id}-${entry.category}`
                              const isExpanded = expandedSupplierCategory === key
                              const items = missingItems[key] || []

                              return (
                                <>
                                  <tr
                                    key={idx}
                                    onClick={() => toggleSupplierCategory(entry.supplier.id, entry.category)}
                                    className="hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer border-t border-gray-200 dark:border-gray-700"
                                  >
                                    {suppliersColumnOrder.map((columnKey) => {
                                      const width = suppliersColumnWidths[columnKey]
                                      const cellStyle = { width: `${width}px`, minWidth: `${width}px`, maxWidth: `${width}px` }

                                      switch (columnKey) {
                                        case 'supplier':
                                          return (
                                            <td key={columnKey} style={cellStyle} className="px-4 py-3 text-sm text-gray-900 dark:text-white font-medium">
                                              <div className="flex items-center gap-2">
                                                {isExpanded ? (
                                                  <ChevronDownIcon className="h-4 w-4 text-gray-400 flex-shrink-0" />
                                                ) : (
                                                  <ChevronRightIcon className="h-4 w-4 text-gray-400 flex-shrink-0" />
                                                )}
                                                {entry.supplier.name}
                                              </div>
                                            </td>
                                          )
                                        case 'category':
                                          return (
                                            <td key={columnKey} style={cellStyle} className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                                              {entry.category}
                                            </td>
                                          )
                                        case 'coverage':
                                          return (
                                            <td key={columnKey} style={cellStyle} className="px-4 py-3 text-sm text-center">
                                              <div className="flex items-center justify-center gap-2">
                                                <div className="w-24 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                                                  <div
                                                    className={`h-2 rounded-full ${
                                                      entry.coverage_percentage >= 75
                                                        ? 'bg-green-500'
                                                        : entry.coverage_percentage >= 50
                                                          ? 'bg-yellow-500'
                                                          : 'bg-orange-500'
                                                    }`}
                                                    style={{ width: `${entry.coverage_percentage}%` }}
                                                  />
                                                </div>
                                                <span className="text-gray-600 dark:text-gray-400 text-xs font-medium">
                                                  {entry.coverage_percentage}%
                                                </span>
                                              </div>
                                            </td>
                                          )
                                        case 'items_priced':
                                          return (
                                            <td key={columnKey} style={cellStyle} className="px-4 py-3 text-sm text-center text-gray-600 dark:text-gray-400">
                                              {entry.items_with_pricing} / {entry.total_items_in_category}
                                            </td>
                                          )
                                        case 'missing_prices':
                                          return (
                                            <td key={columnKey} style={cellStyle} className="px-4 py-3 text-sm text-center">
                                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-400">
                                                {entry.missing_items_count}
                                              </span>
                                            </td>
                                          )
                                        default:
                                          return null
                                      }
                                    })}
                                  </tr>
                                  {isExpanded && (
                                    <tr className="bg-gray-50 dark:bg-gray-900/50">
                                      <td colSpan={suppliersColumnOrder.length} className="px-4 py-4">
                                        {loadingMissingItems ? (
                                          <div className="flex items-center justify-center py-4">
                                            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600"></div>
                                            <span className="ml-2 text-sm text-gray-600 dark:text-gray-400">Loading missing items...</span>
                                          </div>
                                        ) : items.length > 0 ? (
                                          <div className="space-y-2">
                                            <div className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-3">
                                              Missing Items for {entry.supplier.name} in {entry.category}:
                                            </div>
                                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                                              {items.map((item) => (
                                                <div key={item.id} className="flex items-center gap-2 p-2 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700 text-xs">
                                                  <span className="font-mono text-gray-500 dark:text-gray-400">{item.item_code}</span>
                                                  <span className="text-gray-900 dark:text-white truncate">{item.item_name}</span>
                                                </div>
                                              ))}
                                            </div>
                                          </div>
                                        ) : (
                                          <div className="text-sm text-gray-500 dark:text-gray-400 text-center py-2">
                                            No missing items found
                                          </div>
                                        )}
                                      </td>
                                    </tr>
                                  )}
                                </>
                              )
                            })}
                          </tbody>
                        </table>
                        {healthChecks.suppliersWithIncompleteCategoryPricing.count > 15 && (
                          <div className="px-4 py-3 bg-gray-50 dark:bg-gray-900 text-sm text-gray-600 dark:text-gray-400 text-center">
                            Showing 15 of {healthChecks.suppliersWithIncompleteCategoryPricing.count} supplier-category combinations
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Status Badge */}
                <div>
                  {healthChecks.suppliersWithIncompleteCategoryPricing.count === 0 ? (
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400">
                      Healthy
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-400">
                      Needs Attention
                    </span>
                  )}
                </div>
              </div>

              {/* Items with Default Supplier but No Price History */}
              <div className="flex items-start justify-between pt-8 border-t border-gray-200 dark:border-gray-700">
                <div className="flex-1">
                  <div className="flex items-start gap-3 p-2 -ml-2">
                    <button
                      onClick={() => toggleSection('itemsWithDefaultSupplierButNoPriceHistory')}
                      className="flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-lg transition-colors flex-shrink-0"
                    >
                      <div className={`flex items-center justify-center w-12 h-12 rounded-lg ${
                        getHealthColor(itemsWithDefaultSupplierButNoPriceHistoryPct) === 'green' ? 'bg-green-100 dark:bg-green-900/30' :
                        getHealthColor(itemsWithDefaultSupplierButNoPriceHistoryPct) === 'orange' ? 'bg-orange-100 dark:bg-orange-900/30' :
                        'bg-red-100 dark:bg-red-900/30'
                      }`}>
                        <span className={`text-2xl font-bold ${
                          getHealthColor(itemsWithDefaultSupplierButNoPriceHistoryPct) === 'green' ? 'text-green-600 dark:text-green-400' :
                          getHealthColor(itemsWithDefaultSupplierButNoPriceHistoryPct) === 'orange' ? 'text-orange-600 dark:text-orange-400' :
                          'text-red-600 dark:text-red-400'
                        }`}>
                          {healthChecks.itemsWithDefaultSupplierButNoPriceHistory.count}
                        </span>
                      </div>
                      <div className="flex-1 text-left">
                        <h3 className="text-base font-medium text-gray-900 dark:text-white flex items-center gap-2">
                          Items with Default Supplier but No Price History
                          <span className={`text-sm font-bold ${
                            getHealthColor(itemsWithDefaultSupplierButNoPriceHistoryPct) === 'green' ? 'text-green-600 dark:text-green-400' :
                            getHealthColor(itemsWithDefaultSupplierButNoPriceHistoryPct) === 'yellow' ? 'text-yellow-600 dark:text-yellow-400' :
                            getHealthColor(itemsWithDefaultSupplierButNoPriceHistoryPct) === 'orange' ? 'text-orange-600 dark:text-orange-400' :
                            'text-red-600 dark:text-red-400'
                          }`}>
                            ({itemsWithDefaultSupplierButNoPriceHistoryPct}%)
                          </span>
                          {healthChecks.itemsWithDefaultSupplierButNoPriceHistory.count > 0 && (
                            expandedSections.itemsWithDefaultSupplierButNoPriceHistory ? (
                              <ChevronDownIcon className="h-5 w-5 text-gray-400" />
                            ) : (
                              <ChevronRightIcon className="h-5 w-5 text-gray-400" />
                            )
                          )}
                        </h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                          Items have a default supplier set but no corresponding price history entry
                        </p>
                      </div>
                    </button>
                    {healthChecks.itemsWithDefaultSupplierButNoPriceHistory.count > 0 && (
                      <div className="relative flex-1 max-w-xs">
                        <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <input
                          type="text"
                          placeholder="Search..."
                          value={searchQueries.itemsWithDefaultSupplierButNoPriceHistory}
                          onChange={(e) => updateSearchQuery('itemsWithDefaultSupplierButNoPriceHistory', e.target.value)}
                          onClick={(e) => {
                            e.stopPropagation()
                            if (!expandedSections.itemsWithDefaultSupplierButNoPriceHistory) {
                              toggleSection('itemsWithDefaultSupplierButNoPriceHistory')
                            }
                          }}
                          className="w-full pl-9 pr-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                        />
                      </div>
                    )}
                  </div>

                  {/* Item List */}
                  {healthChecks.itemsWithDefaultSupplierButNoPriceHistory.count > 0 && expandedSections.itemsWithDefaultSupplierButNoPriceHistory && (
                    <div className="mt-4 ml-15">
                      <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                          <thead className="bg-gray-50 dark:bg-gray-900 sticky top-0 z-10">
                            <tr>
                              {itemsWithSupplierColumnOrder.map((columnKey) => {
                                const column = itemsWithSupplierColumns[columnKey]
                                const width = itemsWithSupplierColumnWidths[columnKey]
                                const isSorted = sortBy.itemsWithSupplier === columnKey
                                return (
                                  <th
                                    key={columnKey}
                                    style={{ width: `${width}px`, minWidth: `${width}px`, position: 'relative' }}
                                    className={`px-4 py-2 text-left border-r border-gray-200 dark:border-gray-700 ${draggedColumn === columnKey && draggedTable === 'itemsWithSupplier' ? 'bg-indigo-100 dark:bg-indigo-900/20' : ''}`}
                                    draggable
                                    onDragStart={(e) => handleDragStart(e, columnKey, 'itemsWithSupplier')}
                                    onDragOver={handleDragOver}
                                    onDrop={(e) => handleDrop(e, columnKey, 'itemsWithSupplier')}
                                  >
                                    <div
                                      className="flex items-center gap-2 cursor-pointer"
                                      onClick={() => handleSort(columnKey, 'itemsWithSupplier')}
                                    >
                                      <Bars3Icon className="h-4 w-4 text-gray-400 cursor-move" />
                                      <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                        {column.label}
                                      </span>
                                      {isSorted && (
                                        sortDirection.itemsWithSupplier === 'asc' ?
                                          <ChevronUpIcon className="h-4 w-4 text-indigo-600 dark:text-indigo-400" /> :
                                          <ChevronDownIcon className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                                      )}
                                    </div>
                                    {/* Resize handle */}
                                    <div
                                      className="absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-indigo-400 dark:hover:bg-indigo-600 transition-colors z-20"
                                      onMouseDown={(e) => handleResizeStart(e, columnKey, 'itemsWithSupplier')}
                                      onClick={(e) => e.stopPropagation()}
                                    />
                                  </th>
                                )
                              })}
                            </tr>
                          </thead>
                          <tbody className="bg-white dark:bg-gray-800 divide-y divide-y-gray-200 dark:divide-gray-700">
                            {filterItems(healthChecks.itemsWithDefaultSupplierButNoPriceHistory.items, 'itemsWithDefaultSupplierButNoPriceHistory').slice(0, 15).map((item) => (
                              <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                {itemsWithSupplierColumnOrder.map((columnKey) => {
                                  const width = itemsWithSupplierColumnWidths[columnKey]
                                  const cellStyle = { width: `${width}px`, minWidth: `${width}px`, maxWidth: `${width}px` }

                                  switch (columnKey) {
                                    case 'item_code':
                                      return (
                                        <td key={columnKey} style={cellStyle} className="px-4 py-3 text-sm text-gray-900 dark:text-white font-medium">
                                          <Link
                                            to={`/price-books/${item.id}`}
                                            className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 hover:underline"
                                          >
                                            {item.item_code}
                                          </Link>
                                        </td>
                                      )
                                    case 'item_name':
                                      return (
                                        <td key={columnKey} style={cellStyle} className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                                          {item.item_name}
                                        </td>
                                      )
                                    case 'category':
                                      return (
                                        <td key={columnKey} style={cellStyle} className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                                          {item.category || '-'}
                                        </td>
                                      )
                                    case 'default_supplier':
                                      return (
                                        <td key={columnKey} style={cellStyle} className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                                          {item.default_supplier?.name || '-'}
                                        </td>
                                      )
                                    case 'current_price':
                                      return (
                                        <td key={columnKey} style={cellStyle} className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                                          {item.current_price ? `$${parseFloat(item.current_price).toFixed(2)}` : '-'}
                                        </td>
                                      )
                                    default:
                                      return null
                                  }
                                })}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {healthChecks.itemsWithDefaultSupplierButNoPriceHistory.count > 15 && (
                          <div className="px-4 py-3 bg-gray-50 dark:bg-gray-900 text-sm text-gray-600 dark:text-gray-400 text-center">
                            Showing 15 of {healthChecks.itemsWithDefaultSupplierButNoPriceHistory.count} items
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Status Badge */}
                <div>
                  {healthChecks.itemsWithDefaultSupplierButNoPriceHistory.count === 0 ? (
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400">
                      Healthy
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-400">
                      Needs Attention
                    </span>
                  )}
                </div>
              </div>

              {/* Items Requiring Photo Without Image */}
              <div className="flex items-start justify-between pt-8 border-t border-gray-200 dark:border-gray-700">
                <div className="flex-1">
                  <div className="flex items-start gap-3 p-2 -ml-2">
                    <button
                      onClick={() => toggleSection('itemsRequiringPhotoWithoutImage')}
                      className="flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-lg transition-colors flex-shrink-0"
                    >
                      <div className={`flex items-center justify-center w-12 h-12 rounded-lg ${
                        getHealthColor(itemsRequiringPhotoWithoutImagePct) === 'green' ? 'bg-green-100 dark:bg-green-900/30' :
                        getHealthColor(itemsRequiringPhotoWithoutImagePct) === 'orange' ? 'bg-orange-100 dark:bg-orange-900/30' :
                        'bg-red-100 dark:bg-red-900/30'
                      }`}>
                        <span className={`text-2xl font-bold ${
                          getHealthColor(itemsRequiringPhotoWithoutImagePct) === 'green' ? 'text-green-600 dark:text-green-400' :
                          getHealthColor(itemsRequiringPhotoWithoutImagePct) === 'orange' ? 'text-orange-600 dark:text-orange-400' :
                          'text-red-600 dark:text-red-400'
                        }`}>
                          {healthChecks.itemsRequiringPhotoWithoutImage.count}
                        </span>
                      </div>
                      <div className="flex-1 text-left">
                        <h3 className="text-base font-medium text-gray-900 dark:text-white flex items-center gap-2">
                          Items Requiring Photo Without Image
                          <span className={`text-sm font-bold ${
                            getHealthColor(itemsRequiringPhotoWithoutImagePct) === 'green' ? 'text-green-600 dark:text-green-400' :
                            getHealthColor(itemsRequiringPhotoWithoutImagePct) === 'yellow' ? 'text-yellow-600 dark:text-yellow-400' :
                            getHealthColor(itemsRequiringPhotoWithoutImagePct) === 'orange' ? 'text-orange-600 dark:text-orange-400' :
                            'text-red-600 dark:text-red-400'
                          }`}>
                            ({itemsRequiringPhotoWithoutImagePct}%)
                          </span>
                          {healthChecks.itemsRequiringPhotoWithoutImage.count > 0 && (
                            expandedSections.itemsRequiringPhotoWithoutImage ? (
                              <ChevronDownIcon className="h-5 w-5 text-gray-400" />
                            ) : (
                              <ChevronRightIcon className="h-5 w-5 text-gray-400" />
                            )
                          )}
                        </h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                          Items marked as requiring a photo but have no image attached
                        </p>
                      </div>
                    </button>
                    {healthChecks.itemsRequiringPhotoWithoutImage.count > 0 && (
                      <div className="relative flex-1 max-w-xs">
                        <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <input
                          type="text"
                          placeholder="Search..."
                          value={searchQueries.itemsRequiringPhotoWithoutImage}
                          onChange={(e) => updateSearchQuery('itemsRequiringPhotoWithoutImage', e.target.value)}
                          onClick={(e) => {
                            e.stopPropagation()
                            if (!expandedSections.itemsRequiringPhotoWithoutImage) {
                              toggleSection('itemsRequiringPhotoWithoutImage')
                            }
                          }}
                          className="w-full pl-9 pr-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                        />
                      </div>
                    )}
                  </div>

                  {/* Item List */}
                  {healthChecks.itemsRequiringPhotoWithoutImage.count > 0 && expandedSections.itemsRequiringPhotoWithoutImage && (
                    <div className="mt-4 ml-15">
                      <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                          <thead className="bg-gray-50 dark:bg-gray-900 sticky top-0 z-10">
                            <tr>
                              {itemsRequiringPhotoColumnOrder.map((columnKey) => {
                                const column = itemsRequiringPhotoColumns[columnKey]
                                const width = itemsRequiringPhotoColumnWidths[columnKey]
                                const isSorted = sortBy.itemsRequiringPhoto === columnKey
                                return (
                                  <th
                                    key={columnKey}
                                    style={{ width: `${width}px`, minWidth: `${width}px`, position: 'relative' }}
                                    className={`px-4 py-2 text-left border-r border-gray-200 dark:border-gray-700 ${draggedColumn === columnKey && draggedTable === 'itemsRequiringPhoto' ? 'bg-indigo-100 dark:bg-indigo-900/20' : ''}`}
                                    draggable
                                    onDragStart={(e) => handleDragStart(e, columnKey, 'itemsRequiringPhoto')}
                                    onDragOver={handleDragOver}
                                    onDrop={(e) => handleDrop(e, columnKey, 'itemsRequiringPhoto')}
                                  >
                                    <div
                                      className="flex items-center gap-2 cursor-pointer"
                                      onClick={() => handleSort(columnKey, 'itemsRequiringPhoto')}
                                    >
                                      <Bars3Icon className="h-4 w-4 text-gray-400 cursor-move" />
                                      <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                        {column.label}
                                      </span>
                                      {isSorted && (
                                        sortDirection.itemsRequiringPhoto === 'asc' ?
                                          <ChevronUpIcon className="h-4 w-4 text-indigo-600 dark:text-indigo-400" /> :
                                          <ChevronDownIcon className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                                      )}
                                    </div>
                                    {/* Resize handle */}
                                    <div
                                      className="absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-indigo-400 dark:hover:bg-indigo-600 transition-colors z-20"
                                      onMouseDown={(e) => handleResizeStart(e, columnKey, 'itemsRequiringPhoto')}
                                      onClick={(e) => e.stopPropagation()}
                                    />
                                  </th>
                                )
                              })}
                            </tr>
                          </thead>
                          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                            {filterItems(healthChecks.itemsRequiringPhotoWithoutImage.items, 'itemsRequiringPhotoWithoutImage').slice(0, 10).map((item) => (
                              <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                {itemsRequiringPhotoColumnOrder.map((columnKey) => {
                                  const width = itemsRequiringPhotoColumnWidths[columnKey]
                                  const cellStyle = { width: `${width}px`, minWidth: `${width}px`, maxWidth: `${width}px` }

                                  switch (columnKey) {
                                    case 'item_code':
                                      return (
                                        <td key={columnKey} style={cellStyle} className="px-4 py-3 text-sm text-gray-900 dark:text-white font-medium">
                                          <Link
                                            to={`/price-books/${item.id}`}
                                            className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 hover:underline"
                                          >
                                            {item.item_code}
                                          </Link>
                                        </td>
                                      )
                                    case 'item_name':
                                      return (
                                        <td key={columnKey} style={cellStyle} className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                                          {item.item_name}
                                        </td>
                                      )
                                    case 'category':
                                      return (
                                        <td key={columnKey} style={cellStyle} className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                                          {item.category || '-'}
                                        </td>
                                      )
                                    case 'current_price':
                                      return (
                                        <td key={columnKey} style={cellStyle} className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                                          {item.current_price ? `$${parseFloat(item.current_price).toFixed(2)}` : '-'}
                                        </td>
                                      )
                                    default:
                                      return null
                                  }
                                })}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {healthChecks.itemsRequiringPhotoWithoutImage.count > 10 && (
                          <div className="px-4 py-3 bg-gray-50 dark:bg-gray-900 text-sm text-gray-600 dark:text-gray-400 text-center">
                            Showing 10 of {healthChecks.itemsRequiringPhotoWithoutImage.count} items
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Status Badge */}
                <div>
                  {healthChecks.itemsRequiringPhotoWithoutImage.count === 0 ? (
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400">
                      Healthy
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-400">
                      Needs Attention
                    </span>
                  )}
                </div>
              </div>

              {/* Price Mismatches */}
              <div className="flex items-start justify-between pt-8 border-t border-gray-200 dark:border-gray-700">
                <div className="flex-1">
                  <div className="flex items-start gap-3 p-2 -ml-2">
                    <button
                      onClick={() => toggleSection('priceMismatches')}
                      className="flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-lg transition-colors flex-shrink-0"
                    >
                      <div className={`flex items-center justify-center w-12 h-12 rounded-lg ${
                        getHealthColor(priceMismatchesPct) === 'green' ? 'bg-green-100 dark:bg-green-900/30' :
                        getHealthColor(priceMismatchesPct) === 'orange' ? 'bg-orange-100 dark:bg-orange-900/30' :
                        'bg-red-100 dark:bg-red-900/30'
                      }`}>
                        <span className={`text-2xl font-bold ${
                          getHealthColor(priceMismatchesPct) === 'green' ? 'text-green-600 dark:text-green-400' :
                          getHealthColor(priceMismatchesPct) === 'orange' ? 'text-orange-600 dark:text-orange-400' :
                          'text-red-600 dark:text-red-400'
                        }`}>
                          {priceHealthCheck.issues_found}
                        </span>
                      </div>
                      <div className="flex-1 text-left">
                        <h3 className="text-base font-medium text-gray-900 dark:text-white flex items-center gap-2">
                          Price Mismatches (Active vs Current)
                          <span className={`text-sm font-bold ${
                            getHealthColor(priceMismatchesPct) === 'green' ? 'text-green-600 dark:text-green-400' :
                            getHealthColor(priceMismatchesPct) === 'yellow' ? 'text-yellow-600 dark:text-yellow-400' :
                            getHealthColor(priceMismatchesPct) === 'orange' ? 'text-orange-600 dark:text-orange-400' :
                            'text-red-600 dark:text-red-400'
                          }`}>
                            ({priceMismatchesPct}%)
                          </span>
                          {priceHealthCheck.issues_found > 0 && (
                            expandedSections.priceMismatches ? (
                              <ChevronDownIcon className="h-5 w-5 text-gray-400" />
                            ) : (
                              <ChevronRightIcon className="h-5 w-5 text-gray-400" />
                            )
                          )}
                        </h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                          Items where the active price from default supplier doesn't match the item's current price
                        </p>
                      </div>
                    </button>
                    {priceHealthCheck.issues_found > 0 && (
                      <div className="relative flex-1 max-w-xs">
                        <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <input
                          type="text"
                          placeholder="Search..."
                          value={searchQueries.priceMismatches}
                          onChange={(e) => updateSearchQuery('priceMismatches', e.target.value)}
                          onClick={(e) => {
                            e.stopPropagation()
                            if (!expandedSections.priceMismatches) {
                              toggleSection('priceMismatches')
                            }
                          }}
                          className="w-full pl-9 pr-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                        />
                      </div>
                    )}
                  </div>

                  {/* Item List */}
                  {priceHealthCheck.issues_found > 0 && expandedSections.priceMismatches && (
                    <div className="mt-4 ml-15">
                      <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                          <thead className="bg-gray-50 dark:bg-gray-900 sticky top-0 z-10">
                            <tr>
                              {priceMismatchesColumnOrder.map((columnKey) => {
                                const column = priceMismatchesColumns[columnKey]
                                const width = priceMismatchesColumnWidths[columnKey]
                                const isSorted = sortBy.priceMismatches === columnKey
                                const isRightAlign = ['current_price', 'active_price', 'difference'].includes(columnKey)
                                return (
                                  <th
                                    key={columnKey}
                                    style={{ width: `${width}px`, minWidth: `${width}px`, position: 'relative' }}
                                    className={`px-4 py-2 ${isRightAlign ? 'text-right' : 'text-left'} border-r border-gray-200 dark:border-gray-700 ${draggedColumn === columnKey && draggedTable === 'priceMismatches' ? 'bg-indigo-100 dark:bg-indigo-900/20' : ''}`}
                                    draggable
                                    onDragStart={(e) => handleDragStart(e, columnKey, 'priceMismatches')}
                                    onDragOver={handleDragOver}
                                    onDrop={(e) => handleDrop(e, columnKey, 'priceMismatches')}
                                  >
                                    <div
                                      className={`flex items-center gap-2 cursor-pointer ${isRightAlign ? 'justify-end' : 'justify-start'}`}
                                      onClick={() => handleSort(columnKey, 'priceMismatches')}
                                    >
                                      <Bars3Icon className="h-4 w-4 text-gray-400 cursor-move" />
                                      <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                        {column.label}
                                      </span>
                                      {isSorted && (
                                        sortDirection.priceMismatches === 'asc' ?
                                          <ChevronUpIcon className="h-4 w-4 text-indigo-600 dark:text-indigo-400" /> :
                                          <ChevronDownIcon className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                                      )}
                                    </div>
                                    {/* Resize handle */}
                                    <div
                                      className="absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-indigo-400 dark:hover:bg-indigo-600 transition-colors z-20"
                                      onMouseDown={(e) => handleResizeStart(e, columnKey, 'priceMismatches')}
                                      onClick={(e) => e.stopPropagation()}
                                    />
                                  </th>
                                )
                              })}
                            </tr>
                          </thead>
                          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                            {(() => {
                              const query = searchQueries.priceMismatches.toLowerCase()
                              const filtered = priceHealthCheck.issues.filter(issue =>
                                !query.trim() ||
                                issue.item_code?.toLowerCase().includes(query) ||
                                issue.item_name?.toLowerCase().includes(query) ||
                                issue.default_supplier_name?.toLowerCase().includes(query)
                              )
                              return filtered.slice(0, 15).map((issue) => (
                                <tr key={issue.item_id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                  {priceMismatchesColumnOrder.map((columnKey) => {
                                    const width = priceMismatchesColumnWidths[columnKey]
                                    const cellStyle = { width: `${width}px`, minWidth: `${width}px`, maxWidth: `${width}px` }

                                    switch (columnKey) {
                                      case 'item_code':
                                        return (
                                          <td key={columnKey} style={cellStyle} className="px-4 py-3 text-sm text-gray-900 dark:text-white font-medium">
                                            <Link
                                              to={`/price-books/${issue.item_id}`}
                                              className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 hover:underline"
                                            >
                                              {issue.item_code}
                                            </Link>
                                          </td>
                                        )
                                      case 'item_name':
                                        return (
                                          <td key={columnKey} style={cellStyle} className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                                            {issue.item_name}
                                          </td>
                                        )
                                      case 'default_supplier':
                                        return (
                                          <td key={columnKey} style={cellStyle} className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                                            {issue.default_supplier_name || '-'}
                                          </td>
                                        )
                                      case 'current_price':
                                        return (
                                          <td key={columnKey} style={cellStyle} className="px-4 py-3 text-sm text-right text-gray-600 dark:text-gray-400">
                                            {issue.item_current_price ? `$${parseFloat(issue.item_current_price).toFixed(2)}` : '-'}
                                          </td>
                                        )
                                      case 'active_price':
                                        return (
                                          <td key={columnKey} style={cellStyle} className="px-4 py-3 text-sm text-right text-gray-900 dark:text-white font-medium">
                                            {issue.active_price_value ? `$${parseFloat(issue.active_price_value).toFixed(2)}` : '-'}
                                          </td>
                                        )
                                      case 'difference':
                                        return (
                                          <td key={columnKey} style={cellStyle} className="px-4 py-3 text-sm text-right">
                                            {issue.difference !== null && issue.difference !== undefined ? (
                                              <span className={`font-medium ${
                                                issue.difference > 0 ? 'text-red-600 dark:text-red-400' :
                                                issue.difference < 0 ? 'text-green-600 dark:text-green-400' :
                                                'text-gray-600 dark:text-gray-400'
                                              }`}>
                                                {issue.difference > 0 ? '+' : ''}{issue.difference < 0 ? '-' : ''}${Math.abs(issue.difference).toFixed(2)}
                                              </span>
                                            ) : (
                                              <span className="text-gray-600 dark:text-gray-400">-</span>
                                            )}
                                          </td>
                                        )
                                      default:
                                        return null
                                    }
                                  })}
                                </tr>
                              ))
                            })()}
                          </tbody>
                        </table>
                        {priceHealthCheck.issues_found > 15 && (
                          <div className="px-4 py-3 bg-gray-50 dark:bg-gray-900 text-sm text-gray-600 dark:text-gray-400 text-center">
                            Showing 15 of {priceHealthCheck.issues_found} items
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Status Badge */}
                <div>
                  {priceHealthCheck.issues_found === 0 ? (
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400">
                      Healthy
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-400">
                      Needs Attention
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Xero Sync Health Section */}
          {xeroSyncHealth && (
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
              <button
                onClick={() => toggleSection('xeroSync')}
                className="w-full px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/50"
              >
                <div className="flex items-center gap-3">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Xero Contact Sync Health
                  </h2>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    xeroSyncHealth.overall_status === 'healthy' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                    xeroSyncHealth.overall_status === 'warning' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
                    xeroSyncHealth.overall_status === 'error' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' :
                    'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                  }`}>
                    {xeroSyncHealth.overall_status === 'healthy' ? 'Healthy' :
                     xeroSyncHealth.overall_status === 'warning' ? 'Warning' :
                     xeroSyncHealth.overall_status === 'error' ? 'Errors' : 'Disabled'}
                  </span>
                </div>
                {expandedSections.xeroSync ? (
                  <ChevronDownIcon className="h-5 w-5 text-gray-400" />
                ) : (
                  <ChevronRightIcon className="h-5 w-5 text-gray-400" />
                )}
              </button>

              {expandedSections.xeroSync && (
                <div className="p-6">
                  {/* Overview Stats */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-1">
                        <LinkIcon className="h-4 w-4 text-blue-500" />
                        <span className="text-sm text-gray-500 dark:text-gray-400">Linked Contacts</span>
                      </div>
                      <div className="text-2xl font-semibold text-gray-900 dark:text-white">
                        {xeroSyncHealth.total_linked_contacts || 0}
                      </div>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-1">
                        <ExclamationCircleIcon className="h-4 w-4 text-red-500" />
                        <span className="text-sm text-gray-500 dark:text-gray-400">With Errors</span>
                      </div>
                      <div className={`text-2xl font-semibold ${xeroSyncHealth.total_contacts_with_errors > 0 ? 'text-red-600' : 'text-gray-900 dark:text-white'}`}>
                        {xeroSyncHealth.total_contacts_with_errors || 0}
                      </div>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-1">
                        <ExclamationTriangleIcon className="h-4 w-4 text-yellow-500" />
                        <span className="text-sm text-gray-500 dark:text-gray-400">Conflicts</span>
                      </div>
                      <div className={`text-2xl font-semibold ${xeroSyncHealth.total_contacts_with_conflicts > 0 ? 'text-yellow-600' : 'text-gray-900 dark:text-white'}`}>
                        {xeroSyncHealth.total_contacts_with_conflicts || 0}
                      </div>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-1">
                        <Cog6ToothIcon className="h-4 w-4 text-indigo-500" />
                        <span className="text-sm text-gray-500 dark:text-gray-400">Organizations</span>
                      </div>
                      <div className="text-2xl font-semibold text-gray-900 dark:text-white">
                        {xeroSyncHealth.sync_enabled_count || 0} / {xeroSyncHealth.total_organizations || 0}
                      </div>
                    </div>
                  </div>

                  {/* Organization Health */}
                  {xeroSyncHealth.organizations && xeroSyncHealth.organizations.length > 0 && (
                    <div className="mb-6">
                      <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Organization Status</h4>
                      <div className="space-y-2">
                        {xeroSyncHealth.organizations.map((org) => (
                          <div
                            key={org.xero_tenant_id}
                            className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900/30 rounded-lg"
                          >
                            <div className="flex items-center gap-3">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                org.status === 'healthy' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                                org.status === 'warning' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
                                org.status === 'error' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' :
                                'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                              }`}>
                                {org.status === 'healthy' ? 'Healthy' :
                                 org.status === 'warning' ? 'Warning' :
                                 org.status === 'error' ? 'Errors' : 'Disabled'}
                              </span>
                              <span className="font-medium text-gray-900 dark:text-white">
                                {org.xero_tenant_name || 'Unnamed Organization'}
                              </span>
                            </div>
                            <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                              <span>{org.linked_contacts} linked</span>
                              {org.contacts_with_errors > 0 && (
                                <span className="text-red-600">{org.contacts_with_errors} errors</span>
                              )}
                              {org.contacts_with_conflicts > 0 && (
                                <span className="text-yellow-600">{org.contacts_with_conflicts} conflicts</span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Recent Errors */}
                  {xeroSyncHealth.recent_errors && xeroSyncHealth.recent_errors.length > 0 && (
                    <div className="mb-6">
                      <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Recent Sync Errors</h4>
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                          <thead className="bg-gray-50 dark:bg-gray-900/50">
                            <tr>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Contact</th>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Error</th>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Action</th>
                            </tr>
                          </thead>
                          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                            {xeroSyncHealth.recent_errors.slice(0, 5).map((error, idx) => (
                              <tr key={idx}>
                                <td className="px-4 py-2 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                                  <Link to={`/contacts/${error.contact_id}`} className="text-indigo-600 hover:text-indigo-500">
                                    {error.contact_name || `Contact #${error.contact_id}`}
                                  </Link>
                                </td>
                                <td className="px-4 py-2 text-sm text-red-600 dark:text-red-400 max-w-xs truncate">
                                  {error.error}
                                </td>
                                <td className="px-4 py-2 whitespace-nowrap text-sm">
                                  <Link to={`/contacts/${error.contact_id}?tab=xero`} className="text-indigo-600 hover:text-indigo-500">
                                    View Details
                                  </Link>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* No Issues / Configure Link */}
                  <div className="flex items-center justify-between">
                    {xeroSyncHealth.total_contacts_with_errors === 0 && xeroSyncHealth.total_contacts_with_conflicts === 0 ? (
                      <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                        <CheckCircleIcon className="h-5 w-5" />
                        <span className="text-sm">All contacts syncing correctly</span>
                      </div>
                    ) : (
                      <div />
                    )}
                    <Link
                      to="/contacts/sync-config"
                      className="inline-flex items-center text-sm text-indigo-600 hover:text-indigo-500"
                    >
                      <Cog6ToothIcon className="h-4 w-4 mr-1" />
                      Configure Sync Settings
                    </Link>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
