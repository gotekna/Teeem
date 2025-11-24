import { useEffect, useState, useRef, useCallback } from 'react'
import { getTodayAsString } from '../utils/timezoneUtils'
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom'
import {
  MagnifyingGlassIcon,
  CurrencyDollarIcon,
  ArrowUpTrayIcon,
  ArrowDownTrayIcon,
  PlusIcon,
  XMarkIcon,
  FunnelIcon,
  ChevronUpIcon,
  ChevronDownIcon,
  Bars3Icon,
  AdjustmentsHorizontalIcon,
  BuildingStorefrontIcon,
  EyeIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline'
import { formatCurrency } from '../utils/formatters'
import { api } from '../api'
import PriceBookImportModal from '../components/pricebook/PriceBookImportModal'

export default function PriceBooksPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()

  // Initialize state from URL params
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [searching, setSearching] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || '')
  const [categoryFilter, setCategoryFilter] = useState(searchParams.get('category') || '')
  const [supplierFilter, setSupplierFilter] = useState(searchParams.get('supplier_id') || '')
  const [riskFilter, setRiskFilter] = useState(searchParams.get('risk_level') || '')
  const [minPrice, setMinPrice] = useState(searchParams.get('min_price') || '')
  const [maxPrice, setMaxPrice] = useState(searchParams.get('max_price') || '')
  const [showPricedOnly, setShowPricedOnly] = useState(searchParams.get('needs_pricing') === 'true')
  const [requiresPhotoFilter, setRequiresPhotoFilter] = useState(searchParams.get('requires_photo') || '')
  const [requiresSpecFilter, setRequiresSpecFilter] = useState(searchParams.get('requires_spec') || '')
  const [photoAttachedFilter, setPhotoAttachedFilter] = useState(searchParams.get('photo_attached') || '')
  const [specAttachedFilter, setSpecAttachedFilter] = useState(searchParams.get('spec_attached') || '')
  const [needsPricingReviewFilter, setNeedsPricingReviewFilter] = useState(searchParams.get('needs_pricing_review') || '')
  const [showFilters, setShowFilters] = useState(false)
  const [categories, setCategories] = useState([])
  const [suppliers, setSuppliers] = useState([])
  const [allSuppliers, setAllSuppliers] = useState([]) // Store all suppliers for filtering
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 200,
    total_count: 0,
    total_pages: 0
  })
  const [hasMore, setHasMore] = useState(true)
  const [sortBy, setSortBy] = useState(searchParams.get('sort_by') || 'category')
  const [sortDirection, setSortDirection] = useState(searchParams.get('sort_direction') || 'asc')
  const [editingCategory, setEditingCategory] = useState(null) // Track which item's category is being edited
  const [editingGstCode, setEditingGstCode] = useState(null) // Track which item's GST code is being edited
  const [taxRates, setTaxRates] = useState([]) // Store available tax rates
  const [showImportModal, setShowImportModal] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [selectedItems, setSelectedItems] = useState(() => {
    // Initialize from URL params
    const selected = searchParams.get('selected')
    return selected ? new Set(selected.split(',').map(id => parseInt(id))) : new Set()
  }) // Track selected item IDs
  const [showSetDefaultSupplierModal, setShowSetDefaultSupplierModal] = useState(false)
  const [settingDefaultSupplier, setSettingDefaultSupplier] = useState(false)
  const [selectedSupplierId, setSelectedSupplierId] = useState(null)
  const [showConfirmationModal, setShowConfirmationModal] = useState(false)
  const [loadingPriceHistories, setLoadingPriceHistories] = useState(false)
  const [itemsWithPriceHistories, setItemsWithPriceHistories] = useState([])
  const [updatePricesToCurrentDefault, setUpdatePricesToCurrentDefault] = useState(false)
  const [selectedItemsForUpdate, setSelectedItemsForUpdate] = useState(new Set())
  const [itemsToCreateUpdatePrice, setItemsToCreateUpdatePrice] = useState({}) // { itemId: { shouldUpdate: true, newPrice: 0 } }
  const [showColumnSettings, setShowColumnSettings] = useState(false)
  const [draggedColumn, setDraggedColumn] = useState(null)
  const [pendingBooleanUpdates, setPendingBooleanUpdates] = useState({}) // { itemId: { requires_photo: true, ... } }
  const [savingBooleanUpdates, setSavingBooleanUpdates] = useState(false)
  const [showBulkGstModal, setShowBulkGstModal] = useState(false)
  const [selectedGstCode, setSelectedGstCode] = useState('')
  const [updatingGstCode, setUpdatingGstCode] = useState(false)

  // Column configuration with defaults
  const defaultColumnConfig = {
    checkbox: { visible: true, width: 50, label: 'Select', resizable: false, order: 0 },
    image: { visible: false, width: 60, label: 'Image', resizable: false, order: 1 },
    itemCode: { visible: true, width: 200, label: 'Code', resizable: true, order: 2 },
    itemName: { visible: true, width: 250, label: 'Item Name', resizable: true, order: 3 },
    status: { visible: false, width: 150, label: 'Status', resizable: true, order: 4 },
    category: { visible: true, width: 200, label: 'Category', resizable: true, order: 5 },
    price: { visible: true, width: 150, label: 'Price', resizable: true, order: 6 },
    gstCode: { visible: true, width: 120, label: 'GST Code', resizable: true, order: 7 },
    unit: { visible: true, width: 100, label: 'Unit', resizable: true, order: 8 },
    supplier: { visible: true, width: 200, label: 'Supplier', resizable: true, order: 9 },
    brand: { visible: true, width: 150, label: 'Brand', resizable: true, order: 10 },
    requiresPhoto: { visible: false, width: 120, label: 'Needs Photo', resizable: true, order: 11 },
    requiresSpec: { visible: false, width: 120, label: 'Needs Spec', resizable: true, order: 12 },
    photoAttached: { visible: false, width: 120, label: 'Photo Added', resizable: true, order: 13 },
    specAttached: { visible: false, width: 120, label: 'Spec Added', resizable: true, order: 14 },
    needsPricingReview: { visible: false, width: 140, label: 'Pricing Review', resizable: true, order: 15 },
    notes: { visible: true, width: 200, label: 'Notes', resizable: true, order: 16 },
  }

  const [columnConfig, setColumnConfig] = useState(() => {
    // Load from localStorage or use defaults
    const saved = localStorage.getItem('pricebookColumnConfig')
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        // Merge with defaults to ensure all columns have all required properties
        const merged = {}
        Object.keys(defaultColumnConfig).forEach(key => {
          merged[key] = {
            ...defaultColumnConfig[key],
            ...(parsed[key] || {})
          }
        })
        return merged
      } catch (e) {
        return defaultColumnConfig
      }
    }
    return defaultColumnConfig
  })

  // Column widths with localStorage persistence (separate from columnConfig for unified pattern)
  const [columnWidths, setColumnWidths] = useState(() => {
    const saved = localStorage.getItem('pricebooks_columnWidths')
    return saved ? JSON.parse(saved) : {
      checkbox: 50,
      image: 60,
      itemCode: 200,
      itemName: 250,
      status: 150,
      category: 200,
      price: 150,
      gstCode: 120,
      unit: 100,
      supplier: 200,
      brand: 150,
      requiresPhoto: 120,
      requiresSpec: 120,
      photoAttached: 120,
      specAttached: 120,
      needsPricingReview: 140,
      notes: 200,
    }
  })

  // Column resize state
  const [resizingColumn, setResizingColumn] = useState(null)
  const [resizeStartX, setResizeStartX] = useState(0)
  const [resizeStartWidth, setResizeStartWidth] = useState(0)

  const observerTarget = useRef(null)
  const searchTimeoutRef = useRef(null)

  // Persist column widths to localStorage
  useEffect(() => {
    localStorage.setItem('pricebooks_columnWidths', JSON.stringify(columnWidths))
  }, [columnWidths])

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
  }, [resizingColumn])

  // Clear supplier filter if it's no longer in the filtered suppliers list
  // Load tax rates on mount
  useEffect(() => {
    loadTaxRates()
  }, [])

  useEffect(() => {
    if (supplierFilter && suppliers.length > 0) {
      const supplierStillExists = suppliers.some(s => s.id.toString() === supplierFilter.toString())
      if (!supplierStillExists) {
        setSupplierFilter('')
      }
    }
  }, [suppliers])

  // Sync selectedItems state from URL params (one-way sync: URL -> state)
  useEffect(() => {
    const selected = searchParams.get('selected')
    if (selected) {
      const selectedIds = selected.split(',').map(id => parseInt(id))
      setSelectedItems(new Set(selectedIds))
    } else {
      setSelectedItems(new Set())
    }
  }, [searchParams])

  // Update URL params when filters change (NOT including selectedItems)
  useEffect(() => {
    const params = new URLSearchParams()

    if (searchQuery) params.set('search', searchQuery)
    if (categoryFilter) params.set('category', categoryFilter)
    if (supplierFilter) params.set('supplier_id', supplierFilter)
    if (riskFilter) params.set('risk_level', riskFilter)
    if (minPrice) params.set('min_price', minPrice)
    if (maxPrice) params.set('max_price', maxPrice)
    if (showPricedOnly) params.set('needs_pricing', 'true')
    if (requiresPhotoFilter) params.set('requires_photo', requiresPhotoFilter)
    if (requiresSpecFilter) params.set('requires_spec', requiresSpecFilter)
    if (photoAttachedFilter) params.set('photo_attached', photoAttachedFilter)
    if (specAttachedFilter) params.set('spec_attached', specAttachedFilter)
    if (needsPricingReviewFilter) params.set('needs_pricing_review', needsPricingReviewFilter)
    if (sortBy !== 'category') params.set('sort_by', sortBy)
    if (sortDirection !== 'asc') params.set('sort_direction', sortDirection)

    // Preserve selected items from current URL
    const currentSelected = searchParams.get('selected')
    if (currentSelected) {
      params.set('selected', currentSelected)
    }

    setSearchParams(params, { replace: true })
  }, [searchQuery, categoryFilter, supplierFilter, riskFilter, minPrice, maxPrice, showPricedOnly, requiresPhotoFilter, requiresSpecFilter, photoAttachedFilter, specAttachedFilter, needsPricingReviewFilter, sortBy, sortDirection, setSearchParams])

  // Debounced search - reload when filters change
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }

    searchTimeoutRef.current = setTimeout(() => {
      loadPriceBook(1)
    }, 300) // 300ms debounce

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current)
      }
    }
  }, [searchQuery, categoryFilter, supplierFilter, riskFilter, minPrice, maxPrice, showPricedOnly, requiresPhotoFilter, requiresSpecFilter, needsPricingReviewFilter, sortBy, sortDirection])

  // Auto-select all items when filters are applied
  useEffect(() => {
    const hasActiveFilters = categoryFilter || supplierFilter || riskFilter || searchQuery || minPrice || maxPrice || showPricedOnly || requiresPhotoFilter || requiresSpecFilter || needsPricingReviewFilter

    if (hasActiveFilters && items.length > 0) {
      // Automatically select all filtered items
      setSelectedItems(new Set(items.map(item => item.id)))
    } else {
      // Clear selection when filters are cleared
      setSelectedItems(new Set())
    }
  }, [items, categoryFilter, supplierFilter, riskFilter, searchQuery, minPrice, maxPrice, showPricedOnly, requiresPhotoFilter, requiresSpecFilter, needsPricingReviewFilter])

  const loadPriceBook = async (page = 1) => {
    try {
      if (page === 1) {
        setLoading(true)
      } else {
        setLoadingMore(true)
      }

      // Build query params
      // Check if Status column is visible - if so, we need risk data
      // Default to FALSE - only load expensive risk calculations when Status column is visible
      const needsRiskData = columnConfig?.status?.visible === true

      const params = {
        page,
        limit: 200,
        include_risk: needsRiskData ? 'true' : 'false', // Only load risk data if Status column visible
        sort_by: sortBy,
        sort_direction: sortDirection,
      }

      if (searchQuery) params.search = searchQuery
      if (categoryFilter) params.category = categoryFilter
      if (supplierFilter) params.supplier_id = supplierFilter
      if (riskFilter) params.risk_level = riskFilter
      if (minPrice) params.min_price = minPrice
      if (maxPrice) params.max_price = maxPrice
      if (!showPricedOnly) params.needs_pricing = 'false'
      if (requiresPhotoFilter) params.requires_photo = requiresPhotoFilter
      if (requiresSpecFilter) params.requires_spec = requiresSpecFilter
      if (photoAttachedFilter) params.photo_attached = photoAttachedFilter
      if (specAttachedFilter) params.spec_attached = specAttachedFilter
      if (needsPricingReviewFilter) params.needs_pricing_review = needsPricingReviewFilter

      const response = await api.get('/api/v1/pricebook', { params })

      const newItems = response.items || []

      if (page === 1) {
        setItems(newItems)
      } else {
        setItems(prev => [...prev, ...newItems])
      }

      setPagination(response.pagination || {})
      setHasMore(page < (response.pagination?.total_pages || 0))

      // Set filters on first load
      if (page === 1) {
        if (response.filters?.categories) {
          setCategories(response.filters.categories)
        }
        if (response.filters?.suppliers) {
          const supplierList = response.filters.suppliers.map(([id, name]) => ({ id, name }))
          setAllSuppliers(supplierList)
          setSuppliers(supplierList)
        }
      }
    } catch (err) {
      console.error('Failed to load price book:', err)
      setItems([])
      setHasMore(false)
    } finally {
      setLoading(false)
      setSearching(false)
      setLoadingMore(false)
    }
  }

  // Infinite scroll observer
  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting && hasMore && !loadingMore && !loading) {
          const nextPage = pagination.page + 1
          loadPriceBook(nextPage)
        }
      },
      { threshold: 0.1 }
    )

    const currentTarget = observerTarget.current
    if (currentTarget) {
      observer.observe(currentTarget)
    }

    return () => {
      if (currentTarget) {
        observer.unobserve(currentTarget)
      }
    }
  }, [hasMore, loadingMore, loading, pagination.page])

  const clearFilters = () => {
    setSearchQuery('')
    setCategoryFilter('')
    setSupplierFilter('')
    setRiskFilter('')
    setMinPrice('')
    setMaxPrice('')
    setShowPricedOnly(false)
    setRequiresPhotoFilter('')
    setRequiresSpecFilter('')
    setNeedsPricingReviewFilter('')
  }

  const hasActiveFilters = searchQuery || categoryFilter || supplierFilter || riskFilter || minPrice || maxPrice || showPricedOnly || requiresPhotoFilter || requiresSpecFilter || needsPricingReviewFilter

  const handleItemClick = (itemId) => {
    // Navigate to the item detail page
    // The browser will automatically preserve the current URL in history
    navigate(`/price-books/${itemId}`)
  }

  const getResultsText = () => {
    const { page, limit, total_count } = pagination
    if (total_count === 0) return 'No items'

    const showing = Math.min(page * limit, total_count)
    if (showing === total_count) {
      return `${total_count.toLocaleString()} ${total_count === 1 ? 'item' : 'items'}`
    }
    return `Showing ${showing.toLocaleString()} of ${total_count.toLocaleString()} items`
  }

  // Badge component matching Tailwind UI standard design
  const Badge = ({ color, children }) => {
    const colorClasses = {
      green: 'bg-green-100 text-green-700 dark:bg-green-400/10 dark:text-green-400',
      yellow: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-400/10 dark:text-yellow-500',
      red: 'bg-red-100 text-red-700 dark:bg-red-400/10 dark:text-red-400',
      gray: 'bg-gray-100 text-gray-600 dark:bg-gray-400/10 dark:text-gray-400'
    }

    return (
      <span className={`inline-flex items-center gap-x-1.5 rounded-md px-2 py-1 text-xs font-medium ${colorClasses[color] || colorClasses.gray}`}>
        <svg className={`h-1.5 w-1.5 fill-current`} viewBox="0 0 6 6" aria-hidden="true">
          <circle cx={3} cy={3} r={3} />
        </svg>
        {children}
      </span>
    )
  }

  const getRiskBadges = (item) => {
    const badges = []

    // Price Freshness Badge
    if (item.price_freshness) {
      badges.push(
        <Badge key="freshness" color={item.price_freshness.color}>
          {item.price_freshness.label}
        </Badge>
      )
    }

    // Overall Risk Badge (if medium or higher)
    if (item.risk && ['medium', 'high', 'critical'].includes(item.risk.level)) {
      badges.push(
        <Badge key="risk" color={item.risk.color}>
          {item.risk.label}
        </Badge>
      )
    }

    return badges
  }

  const handleSort = (column) => {
    if (sortBy === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(column)
      setSortDirection('asc')
    }
    // Don't clear items - the useEffect will reload and pagination reset happens in loadPriceBook
    setPagination(prev => ({ ...prev, page: 1 }))
  }

  // Column resize handlers
  const handleResizeStart = (e, columnKey) => {
    e.preventDefault()
    e.stopPropagation()
    setResizingColumn(columnKey)
    setResizeStartX(e.clientX)
    setResizeStartWidth(columnWidths[columnKey])
  }

  const handleResizeMove = useCallback((e) => {
    if (!resizingColumn) return
    const diff = e.clientX - resizeStartX
    const newWidth = Math.max(100, resizeStartWidth + diff)
    setColumnWidths(prev => ({
      ...prev,
      [resizingColumn]: newWidth
    }))
  }, [resizingColumn, resizeStartX, resizeStartWidth])

  const handleResizeEnd = useCallback(() => {
    setResizingColumn(null)
  }, [])

  const handleColumnFilter = (column, value) => {
    switch (column) {
      case 'category':
        setCategoryFilter(value)
        break
      case 'supplier':
        setSupplierFilter(value)
        break
      case 'risk_level':
        setRiskFilter(value)
        break
      case 'current_price':
        if (value && typeof value === 'object') {
          setMinPrice(value.min || '')
          setMaxPrice(value.max || '')
        } else {
          setMinPrice('')
          setMaxPrice('')
        }
        break
      case 'item_code':
      case 'item_name':
        // These are handled by the main search
        setSearchQuery(value)
        break
    }
  }

  const handleCategoryUpdate = async (itemId, newCategory) => {
    try {
      await api.patch(`/api/v1/pricebook/${itemId}`, {
        pricebook_item: {
          category: newCategory
        }
      })

      // Update local state
      setItems(items.map(item =>
        item.id === itemId ? { ...item, category: newCategory } : item
      ))

      setEditingCategory(null)
    } catch (error) {
      console.error('Failed to update category:', error)
      alert('Failed to update category')
    }
  }

  const handleGstCodeUpdate = async (itemId, newGstCode) => {
    try {
      await api.patch(`/api/v1/pricebook/${itemId}`, {
        pricebook_item: {
          gst_code: newGstCode
        }
      })

      // Update local state
      setItems(items.map(item =>
        item.id === itemId ? { ...item, gst_code: newGstCode } : item
      ))

      setEditingGstCode(null)
    } catch (error) {
      console.error('Failed to update GST code:', error)
      alert('Failed to update GST code')
    }
  }

  const loadTaxRates = async () => {
    try {
      const response = await api.get('/api/v1/xero/tax_rates')
      setTaxRates(response.tax_rates || [])
    } catch (err) {
      console.error('Failed to load tax rates:', err)
      // Don't show error to user, just log it
    }
  }

  const handleBooleanFieldToggle = (itemId, fieldName, currentValue) => {
    const newValue = !currentValue

    // Update local state immediately (optimistic update)
    setItems(items.map(item =>
      item.id === itemId ? { ...item, [fieldName]: newValue } : item
    ))

    // Track pending update
    setPendingBooleanUpdates(prev => ({
      ...prev,
      [itemId]: {
        ...(prev[itemId] || {}),
        [fieldName]: newValue
      }
    }))
  }

  const saveBooleanUpdates = async () => {
    if (Object.keys(pendingBooleanUpdates).length === 0) {
      return
    }

    try {
      setSavingBooleanUpdates(true)

      // Prepare bulk update payload
      const updates = Object.entries(pendingBooleanUpdates).map(([itemId, fields]) => ({
        id: parseInt(itemId),
        ...fields
      }))

      // Send bulk update request
      await api.patch('/api/v1/pricebook/bulk_update', {
        updates
      })

      // Clear pending updates on success
      setPendingBooleanUpdates({})

      // Show success message
      const updateCount = updates.length
      alert(`Successfully updated ${updateCount} item${updateCount === 1 ? '' : 's'}`)
    } catch (error) {
      console.error('Failed to save boolean updates:', error)
      alert('Failed to save updates. Please try again.')

      // Reload to get correct state from server
      await loadPriceBook()
      setPendingBooleanUpdates({})
    } finally {
      setSavingBooleanUpdates(false)
    }
  }

  const discardBooleanUpdates = async () => {
    setPendingBooleanUpdates({})
    await loadPriceBook()
  }

  const handleBulkBooleanToggle = (fieldName, newValue) => {
    // Get all visible item IDs
    const visibleItemIds = items.map(item => item.id)

    // Update local state for all visible items
    setItems(items.map(item => ({
      ...item,
      [fieldName]: newValue
    })))

    // Track pending updates for all visible items
    const updates = {}
    visibleItemIds.forEach(itemId => {
      updates[itemId] = {
        ...(pendingBooleanUpdates[itemId] || {}),
        [fieldName]: newValue
      }
    })
    setPendingBooleanUpdates(prev => ({ ...prev, ...updates }))
  }

  const handleSelectItem = (itemId) => {
    const newSet = new Set(selectedItems)
    if (newSet.has(itemId)) {
      newSet.delete(itemId)
    } else {
      newSet.add(itemId)
    }

    // Update state immediately for responsive UI
    setSelectedItems(newSet)

    // Update URL with new selection
    const params = new URLSearchParams(searchParams)
    if (newSet.size > 0) {
      params.set('selected', Array.from(newSet).join(','))
    } else {
      params.delete('selected')
    }
    setSearchParams(params, { replace: true })
  }

  const handleSelectAll = () => {
    const newSet = selectedItems.size === items.length
      ? new Set()
      : new Set(items.map(item => item.id))

    // Update state immediately for responsive UI
    setSelectedItems(newSet)

    // Update URL with new selection
    const params = new URLSearchParams(searchParams)
    if (newSet.size > 0) {
      params.set('selected', Array.from(newSet).join(','))
    } else {
      params.delete('selected')
    }
    setSearchParams(params, { replace: true })
  }

  const handleClearSelection = () => {
    // Update state immediately for responsive UI
    setSelectedItems(new Set())

    // Update URL to remove selection
    const params = new URLSearchParams(searchParams)
    params.delete('selected')
    setSearchParams(params, { replace: true })
  }

  const handleSelectSupplier = async (supplierId) => {
    if (!supplierId) return

    try {
      setSelectedSupplierId(supplierId)
      setLoadingPriceHistories(true)
      setUpdatePricesToCurrentDefault(false) // Reset checkbox
      setSelectedItemsForUpdate(new Set()) // Reset selected items for update
      setItemsToCreateUpdatePrice({}) // Reset price update data

      // Get all item IDs to review (either selected or all filtered)
      const itemIds = selectedItems.size > 0
        ? Array.from(selectedItems)
        : items.map(item => item.id)

      // Load detailed information for each item including price histories
      const itemsWithDetails = await Promise.all(
        itemIds.map(async (id) => {
          const response = await api.get(`/api/v1/pricebook/${id}`)
          return response
        })
      )

      setItemsWithPriceHistories(itemsWithDetails)
      // By default, select all items
      setSelectedItemsForUpdate(new Set(itemsWithDetails.map(item => item.id)))

      // Initialize price update data - default to using selected supplier's price (or current price if no supplier price)
      const priceUpdateData = {}
      itemsWithDetails.forEach(item => {
        // Find the most recent price for the selected supplier
        const mostRecentPrice = item.price_histories
          ?.filter(h => h.supplier?.id === supplierId)
          ?.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0]

        const hasSupplierPrice = !!mostRecentPrice
        const supplierPrice = parseFloat(mostRecentPrice?.new_price || 0)
        const currentItemPrice = parseFloat(item.current_price || 0)
        const pricesDiffer = Math.abs(supplierPrice - currentItemPrice) > 0.009 // Account for floating point precision

        // If prices differ, use supplier's price; otherwise use current default
        const defaultPrice = (hasSupplierPrice && pricesDiffer) ? supplierPrice : currentItemPrice

        if (!hasSupplierPrice && item.current_price) {
          // Auto-select items that need price history created, default to current price
          priceUpdateData[item.id] = {
            shouldUpdate: true,
            newPrice: parseFloat(defaultPrice.toFixed(2))
          }
        } else if (hasSupplierPrice) {
          // Items with existing prices: only auto-select if supplier's price differs from current default
          priceUpdateData[item.id] = {
            shouldUpdate: pricesDiffer, // Only auto-check if prices differ
            newPrice: parseFloat(defaultPrice.toFixed(2))
          }
        }
      })
      setItemsToCreateUpdatePrice(priceUpdateData)

      setShowSetDefaultSupplierModal(false)
      setShowConfirmationModal(true)
    } catch (err) {
      console.error('Failed to load price histories:', err)
      alert('Failed to load price history data')
    } finally {
      setLoadingPriceHistories(false)
    }
  }

  const handleSetDefaultSupplier = async (supplierId) => {
    try {
      setSettingDefaultSupplier(true)

      // Only update items that are selected in the confirmation modal
      const itemIds = Array.from(selectedItemsForUpdate)

      if (itemIds.length === 0) {
        alert('Please select at least one item to update')
        return
      }

      // Bulk update default supplier
      const response = await api.patch('/api/v1/pricebook/bulk_update', {
        updates: itemIds.map(id => {
          const priceUpdate = itemsToCreateUpdatePrice[id]
          return {
            id,
            default_supplier_id: supplierId,
            update_price_to_current_default: updatePricesToCurrentDefault,
            // Include price update data if checkbox is checked
            create_or_update_price: priceUpdate?.shouldUpdate || false,
            new_price: priceUpdate?.newPrice || null
          }
        })
      })

      // Reload the items
      await loadPriceBook()

      setShowConfirmationModal(false)
      setSelectedSupplierId(null)
      setItemsWithPriceHistories([])
      setUpdatePricesToCurrentDefault(false)
      setSelectedItemsForUpdate(new Set())
      setItemsToCreateUpdatePrice({})

      const priceUpdateMsg = response.prices_updated > 0
        ? ` and created/updated ${response.prices_updated} price ${response.prices_updated === 1 ? 'history' : 'histories'}`
        : ''
      alert(`Successfully set default supplier for ${itemIds.length} items${priceUpdateMsg}`)
    } catch (error) {
      console.error('Failed to set default supplier:', error)
      alert('Failed to set default supplier')
    } finally {
      setSettingDefaultSupplier(false)
    }
  }

  const confirmSetDefaultSupplier = async () => {
    if (!selectedSupplierId) return
    await handleSetDefaultSupplier(selectedSupplierId)
  }

  const handleBulkGstUpdate = async () => {
    try {
      if (!selectedGstCode) {
        alert('Please select a GST code')
        return
      }

      setUpdatingGstCode(true)

      // Get item IDs to update (either selected or all filtered)
      const itemIds = selectedItems.size > 0
        ? Array.from(selectedItems)
        : items.map(item => item.id)

      if (itemIds.length === 0) {
        alert('No items to update')
        return
      }

      // Bulk update GST code
      await api.patch('/api/v1/pricebook/bulk_update', {
        updates: itemIds.map(id => ({
          id,
          gst_code: selectedGstCode
        }))
      })

      // Update local state
      setItems(items.map(item =>
        itemIds.includes(item.id)
          ? { ...item, gst_code: selectedGstCode }
          : item
      ))

      // Close modal and reset
      setShowBulkGstModal(false)
      setSelectedGstCode('')
      setSelectedItems(new Set())

      alert(`Successfully updated GST code for ${itemIds.length} items`)
    } catch (error) {
      console.error('Failed to update GST code:', error)
      alert('Failed to update GST code')
    } finally {
      setUpdatingGstCode(false)
    }
  }

  const formatDate = (dateString) => {
    if (!dateString) return '-'
    const date = new Date(dateString)
    return date.toLocaleDateString('en-AU', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  const handleExport = async () => {
    try {
      setExporting(true)

      // Build query params with current filters or selected items
      const params = new URLSearchParams()

      // If items are selected, export only those
      if (selectedItems.size > 0) {
        params.append('item_ids', Array.from(selectedItems).join(','))
      } else {
        // Otherwise use filters
        if (supplierFilter) params.append('supplier_id', supplierFilter)
        if (categoryFilter) params.append('category', categoryFilter)
      }

      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'
      const url = `${API_URL}/api/v1/pricebook/export_price_history?${params.toString()}`

      // Fetch the file
      const response = await fetch(url, {
        method: 'GET',
        credentials: 'include',
      })

      if (!response.ok) throw new Error('Export failed')

      // Get the blob and create download
      const blob = await response.blob()
      const downloadUrl = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = downloadUrl

      // Create filename with date and filters or selection
      const date = getTodayAsString()
      let filename = `price_history_${date}`
      if (selectedItems.size > 0) {
        filename += `_selected_${selectedItems.size}_items`
      } else {
        if (supplierFilter) {
          const supplier = suppliers.find(s => s.id.toString() === supplierFilter.toString())
          if (supplier) filename += `_${supplier.name.replace(/[^a-z0-9]/gi, '_')}`
        }
        if (categoryFilter) filename += `_${categoryFilter.replace(/[^a-z0-9]/gi, '_')}`
      }
      a.download = `${filename}.xlsx`

      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(downloadUrl)
      document.body.removeChild(a)
    } catch (error) {
      console.error('Export failed:', error)
      alert('Failed to export data. Please try again.')
    } finally {
      setExporting(false)
    }
  }

  const handleImportSuccess = () => {
    // Refresh the pricebook data
    loadPriceBook(1)
  }

  const handleColumnVisibilityChange = (columnKey, visible) => {
    const newConfig = {
      ...columnConfig,
      [columnKey]: { ...columnConfig[columnKey], visible }
    }
    setColumnConfig(newConfig)
    localStorage.setItem('pricebookColumnConfig', JSON.stringify(newConfig))

    // If showing Status column and we don't have risk data, reload with risk data
    if (columnKey === 'status' && visible && items.length > 0 && !items[0].risk) {
      console.log('Status column enabled - reloading with risk data...')
      loadPriceBook(1)
    }
  }

  const handleColumnWidthChange = (columnKey, width) => {
    const newConfig = {
      ...columnConfig,
      [columnKey]: { ...columnConfig[columnKey], width: parseInt(width) || 50 }
    }
    setColumnConfig(newConfig)
    localStorage.setItem('pricebookColumnConfig', JSON.stringify(newConfig))
  }

  const handleResetColumns = () => {
    setColumnConfig(defaultColumnConfig)
    localStorage.removeItem('pricebookColumnConfig')
  }

  const handleDragStart = (e, columnKey) => {
    // Don't start drag if clicking on interactive elements
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'LABEL') {
      e.preventDefault()
      return
    }

    e.stopPropagation()
    setDraggedColumn(columnKey)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', columnKey)
  }

  const handleDragOver = (e) => {
    e.preventDefault()
    e.stopPropagation()
    e.dataTransfer.dropEffect = 'move'
  }

  const handleDragEnter = (e) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const handleDrop = (e, targetColumnKey) => {
    e.preventDefault()
    e.stopPropagation()

    console.log('Drop event:', { draggedColumn, targetColumnKey })

    if (!draggedColumn || draggedColumn === targetColumnKey) {
      setDraggedColumn(null)
      return
    }

    // Get current orders
    const draggedOrder = columnConfig[draggedColumn].order
    const targetOrder = columnConfig[targetColumnKey].order

    console.log('Swapping orders:', { draggedColumn, draggedOrder, targetColumnKey, targetOrder })

    // Create new config with swapped orders
    const newConfig = { ...columnConfig }

    // Swap the orders
    newConfig[draggedColumn] = { ...newConfig[draggedColumn], order: targetOrder }
    newConfig[targetColumnKey] = { ...newConfig[targetColumnKey], order: draggedOrder }

    setColumnConfig(newConfig)
    localStorage.setItem('pricebookColumnConfig', JSON.stringify(newConfig))
    setDraggedColumn(null)

    console.log('Updated config:', newConfig)
  }

  const handleDragEnd = (e) => {
    e.preventDefault()
    setDraggedColumn(null)
  }

  // Get sorted column entries by order
  const getSortedColumns = () => {
    return Object.entries(columnConfig)
      .sort(([, a], [, b]) => a.order - b.order)
  }

  // Render table cell based on column key
  const renderTableCell = (key, config, item) => {
    if (!config.visible) return null

    const cellWidth = columnWidths[key]
    const cellStyle = { width: `${cellWidth}px`, minWidth: `${cellWidth}px`, maxWidth: `${cellWidth}px` }

    switch (key) {
      case 'checkbox':
        return (
          <td key={key} style={cellStyle} className="px-3 py-3 border-r border-gray-200 dark:border-gray-700" onClick={(e) => e.stopPropagation()}>
            <input type="checkbox" checked={selectedItems.has(item.id)} onChange={() => handleSelectItem(item.id)} className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
          </td>
        )
      case 'image':
        return (
          <td key={key} style={cellStyle} className="px-2 py-2 border-r border-gray-200 dark:border-gray-700">
            {item.image_url ? (
              <div className="flex justify-center">
                <img src={item.image_url} alt={item.item_name} className="w-10 h-10 object-cover rounded border border-gray-200 dark:border-gray-600" onError={(e) => { e.target.style.display = 'none' }} />
              </div>
            ) : (
              <div className="flex justify-center">
                <div className="w-10 h-10 bg-gray-100 dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-600 flex items-center justify-center">
                  <span className="text-xs text-gray-400">-</span>
                </div>
              </div>
            )}
          </td>
        )
      case 'itemCode':
        return (
          <td key={key} style={cellStyle} className="px-4 py-3 border-r border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-900 dark:text-white">
            {item.item_code}
          </td>
        )
      case 'itemName':
        return (
          <td key={key} style={cellStyle} className="px-4 py-3 border-r border-gray-200 dark:border-gray-700 text-sm text-gray-900 dark:text-white">
            {item.item_name}
          </td>
        )
      case 'status':
        return (
          <td key={key} style={cellStyle} className="px-4 py-3 border-r border-gray-200 dark:border-gray-700 text-sm">
            <div className="flex flex-wrap gap-1">
              {getRiskBadges(item).length > 0 ? getRiskBadges(item) : <Badge color="green">OK</Badge>}
            </div>
          </td>
        )
      case 'category':
        return (
          <td key={key} style={cellStyle} className="px-4 py-3 border-r border-gray-200 dark:border-gray-700 text-sm text-gray-600 dark:text-gray-400" onClick={(e) => { e.stopPropagation(); setEditingCategory(item.id) }}>
            {editingCategory === item.id ? (
              <select autoFocus value={item.category || ''} onChange={(e) => handleCategoryUpdate(item.id, e.target.value)} onBlur={() => setEditingCategory(null)} className="w-full px-2 py-1 text-sm border border-indigo-500 rounded focus:ring-2 focus:ring-indigo-500 dark:bg-gray-700 dark:text-white dark:border-indigo-400" onClick={(e) => e.stopPropagation()}>
                <option value="">Select category...</option>
                {categories.map((cat) => (<option key={cat} value={cat}>{cat}</option>))}
              </select>
            ) : (
              <span className="cursor-pointer hover:text-indigo-600 dark:hover:text-indigo-400">{item.category || '-'}</span>
            )}
          </td>
        )
      case 'price':
        return (
          <td key={key} style={cellStyle} className="px-4 py-3 border-r border-gray-200 dark:border-gray-700 text-sm text-right text-gray-900 dark:text-white font-medium">
            {item.current_price ? formatCurrency(item.current_price, true) : '-'}
          </td>
        )
      case 'gstCode':
        return (
          <td key={key} style={cellStyle} className="px-4 py-3 border-r border-gray-200 dark:border-gray-700 text-sm text-gray-600 dark:text-gray-400" onClick={(e) => { e.stopPropagation(); setEditingGstCode(item.id) }}>
            {editingGstCode === item.id ? (
              <select autoFocus value={item.gst_code || ''} onChange={(e) => handleGstCodeUpdate(item.id, e.target.value)} onBlur={() => setEditingGstCode(null)} onFocus={(e) => e.target.select()} className="w-full px-2 py-1 text-sm border border-indigo-500 rounded focus:ring-2 focus:ring-indigo-500 dark:bg-gray-700 dark:text-white dark:border-indigo-400" onClick={(e) => e.stopPropagation()}>
                <option value="">Select GST code...</option>
                {taxRates.map((rate) => (
                  <option key={rate.code} value={rate.code}>
                    {rate.name} ({rate.display_rate})
                  </option>
                ))}
              </select>
            ) : (
              <span className="cursor-pointer hover:text-indigo-600 dark:hover:text-indigo-400">{item.gst_code || '-'}</span>
            )}
          </td>
        )
      case 'unit':
        return (
          <td key={key} style={cellStyle} className="px-4 py-3 border-r border-gray-200 dark:border-gray-700 text-sm text-gray-600 dark:text-gray-400">
            {item.unit_of_measure}
          </td>
        )
      case 'supplier':
        return (
          <td key={key} style={cellStyle} className="px-4 py-3 border-r border-gray-200 dark:border-gray-700 text-sm text-gray-600 dark:text-gray-400">
            {item.default_supplier?.name || '-'}
          </td>
        )
      case 'brand':
        return (
          <td key={key} style={cellStyle} className="px-4 py-3 border-r border-gray-200 dark:border-gray-700 text-sm text-gray-600 dark:text-gray-400">
            {item.brand || '-'}
          </td>
        )
      case 'requiresPhoto':
        const hasPhotoChange = pendingBooleanUpdates[item.id]?.hasOwnProperty('requires_photo')
        return (
          <td key={key} style={cellStyle} className={`px-4 py-3 border-r border-gray-200 dark:border-gray-700 text-center ${hasPhotoChange ? 'bg-orange-50 dark:bg-orange-900/20' : ''}`} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-center gap-1">
              <input
                type="checkbox"
                checked={item.requires_photo || false}
                onChange={() => handleBooleanFieldToggle(item.id, 'requires_photo', item.requires_photo)}
                className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              />
              {hasPhotoChange && <span className="text-xs text-orange-600 dark:text-orange-400">*</span>}
            </div>
          </td>
        )
      case 'requiresSpec':
        const hasSpecChange = pendingBooleanUpdates[item.id]?.hasOwnProperty('requires_spec')
        return (
          <td key={key} style={cellStyle} className={`px-4 py-3 border-r border-gray-200 dark:border-gray-700 text-center ${hasSpecChange ? 'bg-orange-50 dark:bg-orange-900/20' : ''}`} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-center gap-1">
              <input
                type="checkbox"
                checked={item.requires_spec || false}
                onChange={() => handleBooleanFieldToggle(item.id, 'requires_spec', item.requires_spec)}
                className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              />
              {hasSpecChange && <span className="text-xs text-orange-600 dark:text-orange-400">*</span>}
            </div>
          </td>
        )
      case 'needsPricingReview':
        const hasPricingChange = pendingBooleanUpdates[item.id]?.hasOwnProperty('needs_pricing_review')
        return (
          <td key={key} style={cellStyle} className={`px-4 py-3 border-r border-gray-200 dark:border-gray-700 text-center ${hasPricingChange ? 'bg-orange-50 dark:bg-orange-900/20' : ''}`} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-center gap-1">
              <input
                type="checkbox"
                checked={item.needs_pricing_review || false}
                onChange={() => handleBooleanFieldToggle(item.id, 'needs_pricing_review', item.needs_pricing_review)}
                className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              />
              {hasPricingChange && <span className="text-xs text-orange-600 dark:text-orange-400">*</span>}
            </div>
          </td>
        )
      case 'notes':
        return (
          <td key={key} style={cellStyle} className="px-4 py-3 border-r border-gray-200 dark:border-gray-700 text-sm text-gray-600 dark:text-gray-400">
            <div className="truncate max-w-xs" title={item.notes}>{item.notes || '-'}</div>
          </td>
        )
      default:
        return null
    }
  }

  const SortIcon = ({ column }) => {
    if (sortBy !== column) return <Bars3Icon className="h-4 w-4 text-gray-400" />
    return sortDirection === 'asc' ?
      <ChevronUpIcon className="h-4 w-4 text-indigo-600 dark:text-indigo-400" /> :
      <ChevronDownIcon className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
  }

  // Only show full page loading on initial load (no items yet)
  if (loading && items.length === 0) {
    return (
      <div className="flex h-screen overflow-hidden">
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="-mx-4 sm:-mx-6 lg:-mx-8 -my-10 flex flex-col bg-white dark:bg-gray-900" style={{ height: 'calc(100vh - 4rem)' }}>
      {/* Header with search */}
      <div className="flex-shrink-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 sm:px-6 lg:px-8 py-4">
        <div>
            <div className="flex items-center justify-between gap-4 mb-4">
              <div className="flex items-center gap-3">
                <CurrencyDollarIcon className="h-7 w-7 text-indigo-600 dark:text-indigo-400" />
                <div>
                  <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
                    Price Book <span className="text-sm font-normal text-gray-500 dark:text-gray-400">(pricebook_items)</span>
                  </h1>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
                    {getResultsText()}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {/* Selection Indicator */}
                {/* Pending Boolean Updates Save/Discard Bar */}
                {Object.keys(pendingBooleanUpdates).length > 0 && (
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-orange-100 dark:bg-orange-900/30 rounded-lg border border-orange-300 dark:border-orange-700">
                    <span className="text-sm font-medium text-orange-700 dark:text-orange-300">
                      {Object.keys(pendingBooleanUpdates).length} unsaved change{Object.keys(pendingBooleanUpdates).length === 1 ? '' : 's'}
                    </span>
                    <button
                      onClick={saveBooleanUpdates}
                      disabled={savingBooleanUpdates}
                      className="inline-flex items-center px-2 py-1 bg-orange-600 hover:bg-orange-700 text-white text-xs font-medium rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {savingBooleanUpdates ? 'Saving...' : 'Save Changes'}
                    </button>
                    <button
                      onClick={discardBooleanUpdates}
                      disabled={savingBooleanUpdates}
                      className="text-xs text-orange-600 dark:text-orange-400 hover:text-orange-800 dark:hover:text-orange-200 underline disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Discard
                    </button>
                  </div>
                )}

                {selectedItems.size > 0 && (
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg">
                    <span className="text-sm font-medium text-indigo-700 dark:text-indigo-300">
                      {selectedItems.size} selected
                    </span>
                    <button
                      onClick={() => setShowSetDefaultSupplierModal(true)}
                      className="text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-200 underline"
                    >
                      Set Supplier
                    </button>
                    <button
                      onClick={() => setShowBulkGstModal(true)}
                      className="text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-200 underline"
                    >
                      Set GST Code
                    </button>
                    <button
                      onClick={handleClearSelection}
                      className="text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-200 underline"
                    >
                      Clear
                    </button>
                  </div>
                )}

                {/* Set Default Supplier button when filters active but nothing selected */}
                {selectedItems.size === 0 && !loading && (hasActiveFilters || items.length > 0) && (
                  <button
                    onClick={() => setShowSetDefaultSupplierModal(true)}
                    className="inline-flex items-center px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    <BuildingStorefrontIcon className="h-4 w-4 mr-2" />
                    Set Default Supplier
                  </button>
                )}

                {/* Export Button */}
                <button
                  onClick={handleExport}
                  disabled={exporting}
                  className="inline-flex items-center px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {exporting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600 mr-2"></div>
                      Exporting...
                    </>
                  ) : (
                    <>
                      <ArrowDownTrayIcon className="h-4 w-4 mr-2" />
                      Export
                    </>
                  )}
                </button>

                {/* Import Button */}
                <button
                  onClick={() => setShowImportModal(true)}
                  className="inline-flex items-center px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  <ArrowUpTrayIcon className="h-4 w-4 mr-2" />
                  Import
                </button>

                {/* Filters Button */}
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className={`inline-flex items-center px-3 py-1.5 border rounded-lg text-sm font-medium transition-colors ${
                    hasActiveFilters
                      ? 'border-indigo-600 text-indigo-600 bg-indigo-50 dark:bg-indigo-900/20 dark:border-indigo-400 dark:text-indigo-400'
                      : 'border-gray-300 text-gray-700 bg-white hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
                  }`}
                >
                  <AdjustmentsHorizontalIcon className="h-4 w-4 mr-2" />
                  Filters
                  {hasActiveFilters && (
                    <span className="ml-2 inline-flex items-center justify-center w-5 h-5 text-xs font-bold text-white bg-indigo-600 dark:bg-indigo-500 rounded-full">
                      {[searchQuery, categoryFilter, supplierFilter, riskFilter, minPrice, maxPrice, showPricedOnly, requiresPhotoFilter, requiresSpecFilter, needsPricingReviewFilter].filter(Boolean).length}
                    </span>
                  )}
                </button>

                {/* Column Settings Button */}
                <button
                  onClick={() => setShowColumnSettings(!showColumnSettings)}
                  className="inline-flex items-center px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  <EyeIcon className="h-4 w-4 mr-2" />
                  Columns
                </button>
              </div>
            </div>

            {/* Main search bar */}
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder={`Search ${pagination.total_count?.toLocaleString() || ''} items by code, name, category, or supplier...`}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-10 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white text-sm"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <XMarkIcon className="h-5 w-5" />
                </button>
              )}
            </div>

            {/* Column Settings Panel */}
            {showColumnSettings && (
              <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-sm font-medium text-gray-900 dark:text-white">
                      Column Configuration
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Drag columns to reorder • Check to show/hide • Adjust width
                    </p>
                  </div>
                  <button
                    onClick={handleResetColumns}
                    className="text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-200 underline"
                  >
                    Reset to Defaults
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {getSortedColumns().map(([key, config]) => {
                    // Don't show checkbox and image in settings
                    if (key === 'checkbox' || key === 'image') return null

                    return (
                      <div
                        key={key}
                        draggable="true"
                        onDragStart={(e) => handleDragStart(e, key)}
                        onDragEnd={handleDragEnd}
                        onDragOver={handleDragOver}
                        onDragEnter={handleDragEnter}
                        onDrop={(e) => handleDrop(e, key)}
                        className={`flex items-center gap-3 p-3 bg-white dark:bg-gray-800 rounded border-2 transition-all cursor-move ${
                          draggedColumn === key
                            ? 'border-indigo-500 opacity-50 scale-95'
                            : 'border-gray-200 dark:border-gray-700 hover:border-indigo-300 dark:hover:border-indigo-600'
                        }`}
                      >
                        <div className="flex items-center gap-2 flex-shrink-0 pointer-events-none">
                          <svg
                            className="h-5 w-5 text-gray-400"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
                          </svg>
                          <input
                            type="checkbox"
                            checked={config.visible}
                            onChange={(e) => handleColumnVisibilityChange(key, e.target.checked)}
                            className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 pointer-events-auto"
                            onClick={(e) => e.stopPropagation()}
                          />
                        </div>
                        <div className="flex-1 min-w-0 pointer-events-none">
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            {config.label}
                          </label>
                          {config.resizable && (
                            <div className="flex items-center gap-2">
                              <input
                                type="number"
                                min="50"
                                max="500"
                                step="10"
                                value={config.width}
                                onChange={(e) => handleColumnWidthChange(key, e.target.value)}
                                onFocus={(e) => e.target.select()}
                                disabled={!config.visible}
                                className="w-20 px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white disabled:opacity-50 disabled:cursor-not-allowed pointer-events-auto"
                                onClick={(e) => e.stopPropagation()}
                              />
                              <span className="text-xs text-gray-500 dark:text-gray-400">px</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Expanded filters */}
            {showFilters && (
              <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-200 dark:border-gray-700">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* Category filter */}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Category
                    </label>
                    <select
                      value={categoryFilter}
                      onChange={(e) => setCategoryFilter(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white"
                    >
                      <option value="">All Categories</option>
                      {categories.map((category) => (
                        <option key={category} value={category}>
                          {category}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Supplier filter */}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Supplier
                    </label>
                    <select
                      value={supplierFilter}
                      onChange={(e) => setSupplierFilter(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white"
                    >
                      <option value="">All Suppliers</option>
                      {suppliers.map((supplier) => (
                        <option key={supplier.id} value={supplier.id}>
                          {supplier.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Needs Photo filter */}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Needs Photo
                    </label>
                    <select
                      value={requiresPhotoFilter}
                      onChange={(e) => setRequiresPhotoFilter(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white"
                    >
                      <option value="">All Items</option>
                      <option value="true">Yes</option>
                      <option value="false">No</option>
                    </select>
                  </div>

                  {/* Needs Spec filter */}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Needs Spec
                    </label>
                    <select
                      value={requiresSpecFilter}
                      onChange={(e) => setRequiresSpecFilter(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white"
                    >
                      <option value="">All Items</option>
                      <option value="true">Yes</option>
                      <option value="false">No</option>
                    </select>
                  </div>

                  {/* Photo Attached filter */}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Photo Attached
                    </label>
                    <select
                      value={photoAttachedFilter}
                      onChange={(e) => setPhotoAttachedFilter(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white"
                    >
                      <option value="">All Items</option>
                      <option value="true">Yes</option>
                      <option value="false">No</option>
                    </select>
                  </div>

                  {/* Spec Attached filter */}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Spec Attached
                    </label>
                    <select
                      value={specAttachedFilter}
                      onChange={(e) => setSpecAttachedFilter(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white"
                    >
                      <option value="">All Items</option>
                      <option value="true">Yes</option>
                      <option value="false">No</option>
                    </select>
                  </div>

                  {/* Pricing Review filter */}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Pricing Review
                    </label>
                    <select
                      value={needsPricingReviewFilter}
                      onChange={(e) => setNeedsPricingReviewFilter(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white"
                    >
                      <option value="">All Items</option>
                      <option value="true">Yes</option>
                      <option value="false">No</option>
                    </select>
                  </div>

                  {/* Price range */}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Min Price
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="$0"
                      value={minPrice}
                      onChange={(e) => setMinPrice(e.target.value)}
                      onFocus={(e) => e.target.select()}
                      className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Max Price
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="$999,999"
                      value={maxPrice}
                      onChange={(e) => setMaxPrice(e.target.value)}
                      onFocus={(e) => e.target.select()}
                      className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white"
                    />
                  </div>
                </div>

                {/* Toggles and actions */}
                <div className="mt-4 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={showPricedOnly}
                        onChange={(e) => setShowPricedOnly(e.target.checked)}
                        className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-700"
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300">
                        Only show items with prices
                      </span>
                    </label>
                  </div>

                  {hasActiveFilters && (
                    <button
                      onClick={clearFilters}
                      className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
                    >
                      <XMarkIcon className="h-4 w-4 mr-1" />
                      Clear filters
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

      {/* Scroll container for table */}
      <div className="flex-1 overflow-auto bg-white dark:bg-gray-900" style={{
        scrollbarWidth: 'thin',
        scrollbarColor: '#9CA3AF #E5E7EB'
      }}>
        <div className="w-full h-full">
          <table className="border-collapse" style={{ minWidth: '100%', width: 'max-content' }}>
            <thead className="bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 sticky top-0 z-10">
              <tr>
                {getSortedColumns().map(([key, config]) => {
                  if (!config.visible) return null

                  // Render each column header based on its key
                  switch (key) {
                    case 'checkbox':
                      const checkboxWidth = columnWidths[key]
                      return (
                        <th key={key} style={{ width: `${checkboxWidth}px`, minWidth: `${checkboxWidth}px`, position: 'relative' }} className="px-3 py-2 border-r border-gray-200 dark:border-gray-700">
                          <input
                            type="checkbox"
                            checked={items.length > 0 && selectedItems.size === items.length}
                            onChange={handleSelectAll}
                            className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                          />
                        </th>
                      )
                    case 'image':
                      const imageWidth = columnWidths[key]
                      return (
                        <th key={key} style={{ width: `${imageWidth}px`, minWidth: `${imageWidth}px`, position: 'relative' }} className="px-3 py-2 border-r border-gray-200 dark:border-gray-700 text-center text-xs font-medium text-gray-500 dark:text-gray-400">
                          Image
                        </th>
                      )
                    case 'itemCode':
                      const width = columnWidths[key]
                      const isSorted = sortBy === 'item_code'
                      return (
                        <th
                          key={key}
                          style={{ width: `${width}px`, minWidth: `${width}px`, position: 'relative' }}
                          className={`px-3 py-2 border-r border-gray-200 dark:border-gray-700 text-left ${draggedColumn === key ? 'bg-indigo-100 dark:bg-indigo-900/20' : ''}`}
                          draggable
                          onDragStart={(e) => handleDragStart(e, key)}
                          onDragOver={handleDragOver}
                          onDrop={(e) => handleDrop(e, key)}
                        >
                          <div
                            className="flex items-center gap-2 cursor-pointer"
                            onClick={() => handleSort('item_code')}
                          >
                            <Bars3Icon className="h-4 w-4 text-gray-400 cursor-move" />
                            <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Code</span>
                            {isSorted && (
                              sortDirection === 'asc' ?
                                <ChevronUpIcon className="h-4 w-4 text-indigo-600 dark:text-indigo-400" /> :
                                <ChevronDownIcon className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                            )}
                          </div>
                          <input
                            type="text"
                            placeholder="Search..."
                            value={searchQuery}
                            onChange={(e) => handleColumnFilter('item_code', e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                            className="mt-1 w-full text-xs px-2 py-1 border border-gray-300 dark:border-gray-600 rounded focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white"
                          />
                          {/* Resize handle */}
                          <div
                            className="absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-indigo-400 dark:hover:bg-indigo-600 transition-colors z-20"
                            onMouseDown={(e) => handleResizeStart(e, key)}
                            onClick={(e) => e.stopPropagation()}
                          />
                        </th>
                      )
                    case 'itemName':
                      const itemNameWidth = columnWidths[key]
                      const itemNameSorted = sortBy === 'item_name'
                      return (
                        <th
                          key={key}
                          style={{ width: `${itemNameWidth}px`, minWidth: `${itemNameWidth}px`, position: 'relative' }}
                          className={`px-3 py-2 border-r border-gray-200 dark:border-gray-700 text-left ${draggedColumn === key ? 'bg-indigo-100 dark:bg-indigo-900/20' : ''}`}
                          draggable
                          onDragStart={(e) => handleDragStart(e, key)}
                          onDragOver={handleDragOver}
                          onDrop={(e) => handleDrop(e, key)}
                        >
                          <div
                            className="flex items-center gap-2 cursor-pointer"
                            onClick={() => handleSort('item_name')}
                          >
                            <Bars3Icon className="h-4 w-4 text-gray-400 cursor-move" />
                            <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Item Name</span>
                            {itemNameSorted && (
                              sortDirection === 'asc' ?
                                <ChevronUpIcon className="h-4 w-4 text-indigo-600 dark:text-indigo-400" /> :
                                <ChevronDownIcon className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                            )}
                          </div>
                          <input
                            type="text"
                            placeholder="Search..."
                            value={searchQuery}
                            onChange={(e) => handleColumnFilter('item_name', e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                            className="mt-1 w-full text-xs px-2 py-1 border border-gray-300 dark:border-gray-600 rounded focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white"
                          />
                          {/* Resize handle */}
                          <div
                            className="absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-indigo-400 dark:hover:bg-indigo-600 transition-colors z-20"
                            onMouseDown={(e) => handleResizeStart(e, key)}
                            onClick={(e) => e.stopPropagation()}
                          />
                        </th>
                      )
                    case 'status':
                      const statusWidth = columnWidths[key]
                      const statusSorted = sortBy === 'risk_level'
                      return (
                        <th
                          key={key}
                          style={{ width: `${statusWidth}px`, minWidth: `${statusWidth}px`, position: 'relative' }}
                          className={`px-3 py-2 border-r border-gray-200 dark:border-gray-700 text-left ${draggedColumn === key ? 'bg-indigo-100 dark:bg-indigo-900/20' : ''}`}
                          draggable
                          onDragStart={(e) => handleDragStart(e, key)}
                          onDragOver={handleDragOver}
                          onDrop={(e) => handleDrop(e, key)}
                        >
                          <div
                            className="flex items-center gap-2 cursor-pointer"
                            onClick={() => handleSort('risk_level')}
                          >
                            <Bars3Icon className="h-4 w-4 text-gray-400 cursor-move" />
                            <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</span>
                            {statusSorted && (
                              sortDirection === 'asc' ?
                                <ChevronUpIcon className="h-4 w-4 text-indigo-600 dark:text-indigo-400" /> :
                                <ChevronDownIcon className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                            )}
                          </div>
                          <select
                            value={riskFilter}
                            onChange={(e) => handleColumnFilter('risk_level', e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                            className="mt-1 w-full text-xs px-2 py-1 border border-gray-300 dark:border-gray-600 rounded focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white"
                          >
                            <option value="">All Status</option>
                            <option value="low">Low Risk</option>
                            <option value="medium">Medium Risk</option>
                            <option value="high">High Risk</option>
                            <option value="critical">Critical</option>
                          </select>
                          {/* Resize handle */}
                          <div
                            className="absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-indigo-400 dark:hover:bg-indigo-600 transition-colors z-20"
                            onMouseDown={(e) => handleResizeStart(e, key)}
                            onClick={(e) => e.stopPropagation()}
                          />
                        </th>
                      )
                    case 'category':
                      const categoryWidth = columnWidths[key]
                      const categorySorted = sortBy === 'category'
                      return (
                        <th
                          key={key}
                          style={{ width: `${categoryWidth}px`, minWidth: `${categoryWidth}px`, position: 'relative' }}
                          className={`px-3 py-2 border-r border-gray-200 dark:border-gray-700 text-left ${draggedColumn === key ? 'bg-indigo-100 dark:bg-indigo-900/20' : ''}`}
                          draggable
                          onDragStart={(e) => handleDragStart(e, key)}
                          onDragOver={handleDragOver}
                          onDrop={(e) => handleDrop(e, key)}
                        >
                          <div
                            className="flex items-center gap-2 cursor-pointer"
                            onClick={() => handleSort('category')}
                          >
                            <Bars3Icon className="h-4 w-4 text-gray-400 cursor-move" />
                            <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Category</span>
                            {categorySorted && (
                              sortDirection === 'asc' ?
                                <ChevronUpIcon className="h-4 w-4 text-indigo-600 dark:text-indigo-400" /> :
                                <ChevronDownIcon className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                            )}
                          </div>
                          <select
                            value={categoryFilter}
                            onChange={(e) => handleColumnFilter('category', e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                            className="mt-1 w-full text-xs px-2 py-1 border border-gray-300 dark:border-gray-600 rounded focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white"
                          >
                            <option value="">All Categories</option>
                            {categories.map(cat => (
                              <option key={cat} value={cat}>{cat}</option>
                            ))}
                          </select>
                          {/* Resize handle */}
                          <div
                            className="absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-indigo-400 dark:hover:bg-indigo-600 transition-colors z-20"
                            onMouseDown={(e) => handleResizeStart(e, key)}
                            onClick={(e) => e.stopPropagation()}
                          />
                        </th>
                      )
                    case 'price':
                      const priceWidth = columnWidths[key]
                      const priceSorted = sortBy === 'current_price'
                      return (
                        <th
                          key={key}
                          style={{ width: `${priceWidth}px`, minWidth: `${priceWidth}px`, position: 'relative' }}
                          className={`px-3 py-2 border-r border-gray-200 dark:border-gray-700 text-right ${draggedColumn === key ? 'bg-indigo-100 dark:bg-indigo-900/20' : ''}`}
                          draggable
                          onDragStart={(e) => handleDragStart(e, key)}
                          onDragOver={handleDragOver}
                          onDrop={(e) => handleDrop(e, key)}
                        >
                          <div
                            className="flex items-center gap-2 cursor-pointer justify-end"
                            onClick={() => handleSort('current_price')}
                          >
                            <Bars3Icon className="h-4 w-4 text-gray-400 cursor-move" />
                            <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Price</span>
                            {priceSorted && (
                              sortDirection === 'asc' ?
                                <ChevronUpIcon className="h-4 w-4 text-indigo-600 dark:text-indigo-400" /> :
                                <ChevronDownIcon className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                            )}
                          </div>
                          <div className="flex gap-1 mt-1">
                            <input
                              type="number"
                              placeholder="Min"
                              value={minPrice}
                              onChange={(e) => setMinPrice(e.target.value)}
                              onClick={(e) => e.stopPropagation()}
                              className="w-1/2 text-xs px-2 py-1 border border-gray-300 dark:border-gray-600 rounded focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white"
                            />
                            <input
                              type="number"
                              placeholder="Max"
                              value={maxPrice}
                              onChange={(e) => setMaxPrice(e.target.value)}
                              onClick={(e) => e.stopPropagation()}
                              className="w-1/2 text-xs px-2 py-1 border border-gray-300 dark:border-gray-600 rounded focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white"
                            />
                          </div>
                          {/* Resize handle */}
                          <div
                            className="absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-indigo-400 dark:hover:bg-indigo-600 transition-colors z-20"
                            onMouseDown={(e) => handleResizeStart(e, key)}
                            onClick={(e) => e.stopPropagation()}
                          />
                        </th>
                      )
                    case 'gstCode':
                      const gstCodeWidth = columnWidths[key]
                      return (
                        <th
                          key={key}
                          style={{ width: `${gstCodeWidth}px`, minWidth: `${gstCodeWidth}px`, position: 'relative' }}
                          className={`px-3 py-2 border-r border-gray-200 dark:border-gray-700 text-left ${draggedColumn === key ? 'bg-indigo-100 dark:bg-indigo-900/20' : ''}`}
                          draggable
                          onDragStart={(e) => handleDragStart(e, key)}
                          onDragOver={handleDragOver}
                          onDrop={(e) => handleDrop(e, key)}
                        >
                          <div className="flex items-center gap-2">
                            <Bars3Icon className="h-4 w-4 text-gray-400 cursor-move" />
                            <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">GST Code</span>
                          </div>
                          {/* Resize handle */}
                          <div
                            className="absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-indigo-400 dark:hover:bg-indigo-600 transition-colors z-20"
                            onMouseDown={(e) => handleResizeStart(e, key)}
                            onClick={(e) => e.stopPropagation()}
                          />
                        </th>
                      )
                    case 'unit':
                      const unitWidth = columnWidths[key]
                      return (
                        <th
                          key={key}
                          style={{ width: `${unitWidth}px`, minWidth: `${unitWidth}px`, position: 'relative' }}
                          className={`px-3 py-2 border-r border-gray-200 dark:border-gray-700 text-left ${draggedColumn === key ? 'bg-indigo-100 dark:bg-indigo-900/20' : ''}`}
                          draggable
                          onDragStart={(e) => handleDragStart(e, key)}
                          onDragOver={handleDragOver}
                          onDrop={(e) => handleDrop(e, key)}
                        >
                          <div className="flex items-center gap-2">
                            <Bars3Icon className="h-4 w-4 text-gray-400 cursor-move" />
                            <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Unit</span>
                          </div>
                          {/* Resize handle */}
                          <div
                            className="absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-indigo-400 dark:hover:bg-indigo-600 transition-colors z-20"
                            onMouseDown={(e) => handleResizeStart(e, key)}
                            onClick={(e) => e.stopPropagation()}
                          />
                        </th>
                      )
                    case 'supplier':
                      const supplierWidth = columnWidths[key]
                      const supplierSorted = sortBy === 'supplier'
                      return (
                        <th
                          key={key}
                          style={{ width: `${supplierWidth}px`, minWidth: `${supplierWidth}px`, position: 'relative' }}
                          className={`px-3 py-2 border-r border-gray-200 dark:border-gray-700 text-left ${draggedColumn === key ? 'bg-indigo-100 dark:bg-indigo-900/20' : ''}`}
                          draggable
                          onDragStart={(e) => handleDragStart(e, key)}
                          onDragOver={handleDragOver}
                          onDrop={(e) => handleDrop(e, key)}
                        >
                          <div
                            className="flex items-center gap-2 cursor-pointer"
                            onClick={() => handleSort('supplier')}
                          >
                            <Bars3Icon className="h-4 w-4 text-gray-400 cursor-move" />
                            <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Supplier</span>
                            {supplierSorted && (
                              sortDirection === 'asc' ?
                                <ChevronUpIcon className="h-4 w-4 text-indigo-600 dark:text-indigo-400" /> :
                                <ChevronDownIcon className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                            )}
                          </div>
                          <select
                            value={supplierFilter}
                            onChange={(e) => handleColumnFilter('supplier', e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                            className="mt-1 w-full text-xs px-2 py-1 border border-gray-300 dark:border-gray-600 rounded focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white"
                          >
                            <option value="">All Suppliers</option>
                            {suppliers.map(sup => (
                              <option key={sup.id} value={sup.id.toString()}>{sup.name}</option>
                            ))}
                          </select>
                          {/* Resize handle */}
                          <div
                            className="absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-indigo-400 dark:hover:bg-indigo-600 transition-colors z-20"
                            onMouseDown={(e) => handleResizeStart(e, key)}
                            onClick={(e) => e.stopPropagation()}
                          />
                        </th>
                      )
                    case 'brand':
                      const brandWidth = columnWidths[key]
                      return (
                        <th
                          key={key}
                          style={{ width: `${brandWidth}px`, minWidth: `${brandWidth}px`, position: 'relative' }}
                          className={`px-3 py-2 border-r border-gray-200 dark:border-gray-700 text-left ${draggedColumn === key ? 'bg-indigo-100 dark:bg-indigo-900/20' : ''}`}
                          draggable
                          onDragStart={(e) => handleDragStart(e, key)}
                          onDragOver={handleDragOver}
                          onDrop={(e) => handleDrop(e, key)}
                        >
                          <div className="flex items-center gap-2">
                            <Bars3Icon className="h-4 w-4 text-gray-400 cursor-move" />
                            <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Brand</span>
                          </div>
                          {/* Resize handle */}
                          <div
                            className="absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-indigo-400 dark:hover:bg-indigo-600 transition-colors z-20"
                            onMouseDown={(e) => handleResizeStart(e, key)}
                            onClick={(e) => e.stopPropagation()}
                          />
                        </th>
                      )
                    case 'requiresPhoto':
                      const allRequirePhoto = items.length > 0 && items.every(item => item.requires_photo)
                      const someRequirePhoto = items.some(item => item.requires_photo) && !allRequirePhoto
                      return (
                        <th key={key} style={{ width: `${config.width}px`, minWidth: `${config.width}px`, maxWidth: `${config.width}px` }} className="px-3 py-2 border-r border-gray-200 dark:border-gray-700 text-center text-xs font-medium text-gray-500 dark:text-gray-400">
                          <div className="flex flex-col items-center gap-1">
                            <span>Needs Photo</span>
                            <input
                              type="checkbox"
                              checked={allRequirePhoto}
                              ref={el => el && (el.indeterminate = someRequirePhoto)}
                              onChange={(e) => handleBulkBooleanToggle('requires_photo', e.target.checked)}
                              className="h-3 w-3 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                              title="Toggle all visible items"
                            />
                          </div>
                        </th>
                      )
                    case 'requiresSpec':
                      const allRequireSpec = items.length > 0 && items.every(item => item.requires_spec)
                      const someRequireSpec = items.some(item => item.requires_spec) && !allRequireSpec
                      return (
                        <th key={key} style={{ width: `${config.width}px`, minWidth: `${config.width}px`, maxWidth: `${config.width}px` }} className="px-3 py-2 border-r border-gray-200 dark:border-gray-700 text-center text-xs font-medium text-gray-500 dark:text-gray-400">
                          <div className="flex flex-col items-center gap-1">
                            <span>Needs Spec</span>
                            <input
                              type="checkbox"
                              checked={allRequireSpec}
                              ref={el => el && (el.indeterminate = someRequireSpec)}
                              onChange={(e) => handleBulkBooleanToggle('requires_spec', e.target.checked)}
                              className="h-3 w-3 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                              title="Toggle all visible items"
                            />
                          </div>
                        </th>
                      )
                    case 'needsPricingReview':
                      const allNeedReview = items.length > 0 && items.every(item => item.needs_pricing_review)
                      const someNeedReview = items.some(item => item.needs_pricing_review) && !allNeedReview
                      return (
                        <th key={key} style={{ width: `${config.width}px`, minWidth: `${config.width}px`, maxWidth: `${config.width}px` }} className="px-3 py-2 border-r border-gray-200 dark:border-gray-700 text-center text-xs font-medium text-gray-500 dark:text-gray-400">
                          <div className="flex flex-col items-center gap-1">
                            <span>Pricing Review</span>
                            <input
                              type="checkbox"
                              checked={allNeedReview}
                              ref={el => el && (el.indeterminate = someNeedReview)}
                              onChange={(e) => handleBulkBooleanToggle('needs_pricing_review', e.target.checked)}
                              className="h-3 w-3 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                              title="Toggle all visible items"
                            />
                          </div>
                        </th>
                      )
                    case 'notes':
                      const notesWidth = columnWidths[key]
                      return (
                        <th
                          key={key}
                          style={{ width: `${notesWidth}px`, minWidth: `${notesWidth}px`, position: 'relative' }}
                          className={`px-3 py-2 border-r border-gray-200 dark:border-gray-700 text-left ${draggedColumn === key ? 'bg-indigo-100 dark:bg-indigo-900/20' : ''}`}
                          draggable
                          onDragStart={(e) => handleDragStart(e, key)}
                          onDragOver={handleDragOver}
                          onDrop={(e) => handleDrop(e, key)}
                        >
                          <div className="flex items-center gap-2">
                            <Bars3Icon className="h-4 w-4 text-gray-400 cursor-move" />
                            <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Notes</span>
                          </div>
                          {/* Resize handle */}
                          <div
                            className="absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-indigo-400 dark:hover:bg-indigo-600 transition-colors z-20"
                            onMouseDown={(e) => handleResizeStart(e, key)}
                            onClick={(e) => e.stopPropagation()}
                          />
                        </th>
                      )
                    default:
                      return null
                  }
                })}
              </tr>
            </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-100 dark:divide-gray-700">
                  {items.length === 0 && !loading ? (
                    <tr>
                      <td colSpan="10" className="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                        {hasActiveFilters
                          ? 'No items match your filters. Try adjusting your search criteria.'
                          : 'No items found in the price book.'}
                      </td>
                    </tr>
                  ) : (
                    <>
                      {items.map((item) => (
                        <tr
                          key={item.id}
                          onClick={() => handleItemClick(item.id)}
                          className={`hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer transition-colors ${
                            selectedItems.has(item.id) ? 'bg-indigo-50 dark:bg-indigo-900/20' : ''
                          }`}
                        >
                          {getSortedColumns().map(([key, config]) => renderTableCell(key, config, item))}
                        </tr>
                      ))}

                      {/* Infinite scroll trigger */}
                      {hasMore && (
                        <tr ref={observerTarget}>
                          <td colSpan="10" className="px-4 py-4 text-center">
                            {loadingMore ? (
                              <div className="flex items-center justify-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-indigo-600"></div>
                                Loading more items...
                              </div>
                            ) : (
                              <div className="text-sm text-gray-500 dark:text-gray-400">
                                Scroll for more...
                              </div>
                            )}
                          </td>
                        </tr>
                      )}

                      {/* End of results */}
                      {!hasMore && items.length > 0 && (
                        <tr>
                          <td colSpan="10" className="px-4 py-4 text-center text-sm text-gray-500 dark:text-gray-400">
                            End of results
                          </td>
                        </tr>
                      )}
                    </>
                  )}
                </tbody>
              </table>
            </div>
          </div>

        {/* Import Modal */}
        <PriceBookImportModal
          isOpen={showImportModal}
          onClose={() => setShowImportModal(false)}
          onImportSuccess={handleImportSuccess}
        />

        {/* Set Default Supplier Modal */}
        {showSetDefaultSupplierModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4">
              <div className="p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Set Default Supplier
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  {selectedItems.size > 0
                    ? `Set default supplier for ${selectedItems.size} selected items`
                    : `Set default supplier for ${items.length} filtered items`}
                </p>
                <select
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white mb-4"
                  onChange={(e) => {
                    if (e.target.value) {
                      handleSelectSupplier(parseInt(e.target.value))
                    }
                  }}
                  disabled={loadingPriceHistories}
                >
                  <option value="">Select a supplier...</option>
                  {suppliers.map((supplier) => (
                    <option key={supplier.id} value={supplier.id}>
                      {supplier.name}
                    </option>
                  ))}
                </select>
                {loadingPriceHistories && (
                  <div className="text-sm text-gray-600 dark:text-gray-400 mb-4 text-center">
                    Loading price history data...
                  </div>
                )}
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowSetDefaultSupplierModal(false)}
                    disabled={loadingPriceHistories}
                    className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Bulk GST Code Update Modal */}
        {showBulkGstModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4">
              <div className="p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Set GST Code
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  {selectedItems.size > 0
                    ? `Update GST code for ${selectedItems.size} selected items`
                    : `Update GST code for ${items.length} filtered items`}
                </p>
                <select
                  value={selectedGstCode}
                  onChange={(e) => setSelectedGstCode(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white mb-4"
                  disabled={updatingGstCode}
                >
                  <option value="">Select GST code...</option>
                  {taxRates.map((rate) => (
                    <option key={rate.code} value={rate.code}>
                      {rate.name} ({rate.display_rate})
                    </option>
                  ))}
                </select>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setShowBulkGstModal(false)
                      setSelectedGstCode('')
                    }}
                    disabled={updatingGstCode}
                    className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleBulkGstUpdate}
                    disabled={!selectedGstCode || updatingGstCode}
                    className="flex-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {updatingGstCode ? 'Updating...' : 'Update'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Confirmation Modal with Price History Review */}
        {showConfirmationModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto p-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-6xl w-full my-8">
              <div className="p-6 max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="flex items-start gap-4 mb-6">
                  <div className="flex-shrink-0 w-12 h-12 rounded-full bg-indigo-100 dark:bg-indigo-500/10 flex items-center justify-center">
                    <CheckCircleIcon className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                      Confirm Set Default Supplier
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      You are about to set <span className="font-medium text-gray-900 dark:text-white">
                        {suppliers.find(s => s.id === selectedSupplierId)?.name}
                      </span> as the default supplier for <span className="font-medium">{itemsWithPriceHistories.length}</span> items.
                      Please review all price history data below to ensure nothing is missing.
                    </p>
                  </div>
                </div>

                {/* Summary Stats */}
                <div className="grid grid-cols-5 gap-4 mb-6">
                  <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-lg p-4">
                    <div className="text-xs text-indigo-600 dark:text-indigo-400 mb-1">Selected to Update</div>
                    <div className="text-2xl font-semibold text-indigo-900 dark:text-indigo-300">
                      {selectedItemsForUpdate.size}
                    </div>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
                    <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Total Items</div>
                    <div className="text-2xl font-semibold text-gray-900 dark:text-white">
                      {itemsWithPriceHistories.length}
                    </div>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
                    <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">With Current Price</div>
                    <div className="text-2xl font-semibold text-gray-900 dark:text-white">
                      {itemsWithPriceHistories.filter(item => item.current_price).length}
                    </div>
                  </div>
                  <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
                    <div className="text-xs text-green-600 dark:text-green-400 mb-1">With Supplier Price</div>
                    <div className="text-2xl font-semibold text-green-900 dark:text-green-300">
                      {itemsWithPriceHistories.filter(item =>
                        item.price_histories?.some(h => h.supplier?.id === selectedSupplierId)
                      ).length}
                    </div>
                  </div>
                  <div className="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-4">
                    <div className="text-xs text-orange-600 dark:text-orange-400 mb-1">Missing Price</div>
                    <div className="text-2xl font-semibold text-orange-900 dark:text-orange-300">
                      {itemsWithPriceHistories.filter(item =>
                        !item.price_histories?.some(h => h.supplier?.id === selectedSupplierId)
                      ).length}
                    </div>
                  </div>
                </div>

                {/* Items Grid - Simplified Price Comparison */}
                <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                  <div className="bg-gray-50 dark:bg-gray-900 px-4 py-2 border-b border-gray-200 dark:border-gray-700">
                    <h4 className="text-sm font-medium text-gray-900 dark:text-white">Price Comparison</h4>
                  </div>
                  <div className="max-h-96 overflow-y-auto">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                      <thead className="bg-gray-50 dark:bg-gray-900 sticky top-0">
                        <tr>
                          <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 w-12">
                            <input
                              type="checkbox"
                              checked={itemsWithPriceHistories.length > 0 && selectedItemsForUpdate.size === itemsWithPriceHistories.length}
                              onChange={() => {
                                if (selectedItemsForUpdate.size === itemsWithPriceHistories.length) {
                                  setSelectedItemsForUpdate(new Set())
                                } else {
                                  setSelectedItemsForUpdate(new Set(itemsWithPriceHistories.map(item => item.id)))
                                }
                              }}
                              className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                            />
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Item</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Category</th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400">Current Default Price</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Current Supplier</th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-indigo-600 dark:text-indigo-400">Selected Supplier Price</th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400">Difference</th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-blue-600 dark:text-blue-400">Create/Update Price</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-gray-800">
                        {itemsWithPriceHistories.map((item, idx) => {
                          // Find the currently active (live) price for the selected supplier based on effective date
                          const today = new Date()
                          today.setHours(0, 0, 0, 0) // Reset to midnight for date comparison

                          const selectedSupplierPrice = item.price_histories
                            ?.filter(h => h.supplier?.id === selectedSupplierId)
                            ?.filter(h => {
                              // Only include prices with effective date <= today (currently active/live prices)
                              if (!h.date_effective) return true // If no date_effective, include it
                              const effectiveDate = new Date(h.date_effective)
                              effectiveDate.setHours(0, 0, 0, 0)
                              return effectiveDate <= today
                            })
                            ?.sort((a, b) => {
                              // Sort by date_effective (most recent first), fallback to created_at if no date_effective
                              const dateA = a.date_effective ? new Date(a.date_effective) : new Date(a.created_at)
                              const dateB = b.date_effective ? new Date(b.date_effective) : new Date(b.created_at)
                              return dateB - dateA
                            })[0]

                          // Current default is the item's current_price
                          const currentDefaultPrice = item.current_price

                          // Current default supplier
                          const currentDefaultSupplier = item.default_supplier?.name || '-'

                          // Calculate difference
                          const selectedPrice = selectedSupplierPrice?.new_price
                          const priceDiff = selectedPrice && currentDefaultPrice
                            ? selectedPrice - currentDefaultPrice
                            : null
                          const priceDiffPercent = priceDiff && currentDefaultPrice
                            ? ((priceDiff / currentDefaultPrice) * 100).toFixed(1)
                            : null

                          return (
                            <tr key={idx} className={`hover:bg-gray-50 dark:hover:bg-gray-700/50 ${selectedItemsForUpdate.has(item.id) ? 'bg-indigo-50 dark:bg-indigo-900/10' : ''}`}>
                              <td className="px-3 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                                <input
                                  type="checkbox"
                                  checked={selectedItemsForUpdate.has(item.id)}
                                  onChange={() => {
                                    const newSet = new Set(selectedItemsForUpdate)
                                    if (newSet.has(item.id)) {
                                      newSet.delete(item.id)
                                    } else {
                                      newSet.add(item.id)
                                    }
                                    setSelectedItemsForUpdate(newSet)
                                  }}
                                  className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                />
                              </td>
                              <td className="px-4 py-3 text-sm">
                                <div className="font-medium text-gray-900 dark:text-white">{item.item_name}</div>
                                <div className="text-xs text-gray-500 dark:text-gray-400">{item.item_code}</div>
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                                {item.category || '-'}
                              </td>
                              <td className="px-4 py-3 text-sm text-right font-medium text-gray-900 dark:text-white">
                                {currentDefaultPrice ? formatCurrency(currentDefaultPrice, true) : <span className="text-gray-400">-</span>}
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                                {currentDefaultSupplier}
                              </td>
                              <td className="px-4 py-3 text-sm text-right">
                                {selectedPrice ? (
                                  <span className="font-medium text-indigo-900 dark:text-indigo-300">
                                    {formatCurrency(selectedPrice, true)}
                                  </span>
                                ) : (
                                  <span className="text-orange-600 dark:text-orange-400">No price</span>
                                )}
                              </td>
                              <td className="px-4 py-3 text-sm text-right">
                                {priceDiff !== null ? (
                                  <span className={
                                    priceDiff > 0
                                      ? 'text-red-600 dark:text-red-400 font-medium'
                                      : priceDiff < 0
                                      ? 'text-green-600 dark:text-green-400 font-medium'
                                      : 'text-gray-600 dark:text-gray-400'
                                  }>
                                    {priceDiff > 0 ? '+' : ''}{formatCurrency(priceDiff, true)}
                                    {priceDiffPercent !== null && priceDiffPercent !== '0.0' && (
                                      <span className="text-xs ml-1">
                                        ({priceDiff > 0 ? '+' : ''}{priceDiffPercent}%)
                                      </span>
                                    )}
                                  </span>
                                ) : (
                                  <span className="text-gray-400">-</span>
                                )}
                              </td>
                              <td className="px-4 py-3 text-sm" onClick={(e) => e.stopPropagation()}>
                                <div className="flex items-center gap-2">
                                  <input
                                    type="checkbox"
                                    checked={itemsToCreateUpdatePrice[item.id]?.shouldUpdate || false}
                                    onChange={(e) => {
                                      setItemsToCreateUpdatePrice(prev => ({
                                        ...prev,
                                        [item.id]: {
                                          shouldUpdate: e.target.checked,
                                          newPrice: prev[item.id]?.newPrice || item.current_price || 0
                                        }
                                      }))
                                    }}
                                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                  />
                                  {itemsToCreateUpdatePrice[item.id]?.shouldUpdate && (
                                    <div className="flex items-center gap-1">
                                      <span className="text-xs text-gray-500 dark:text-gray-400">$</span>
                                      <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        value={(itemsToCreateUpdatePrice[item.id]?.newPrice || 0).toFixed(2)}
                                        onChange={(e) => {
                                          setItemsToCreateUpdatePrice(prev => ({
                                            ...prev,
                                            [item.id]: {
                                              ...prev[item.id],
                                              newPrice: parseFloat(e.target.value) || 0
                                            }
                                          }))
                                        }}
                                        onFocus={(e) => e.target.select()}
                                        className="w-24 px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                                      />
                                    </div>
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

                {/* Warning if missing supplier prices */}
                {itemsWithPriceHistories.some(item => !item.price_histories?.some(h => h.supplier?.id === selectedSupplierId)) && (
                  <div className="mt-6 rounded-md bg-orange-50 dark:bg-orange-900/20 p-4">
                    <div className="flex">
                      <div className="flex-shrink-0">
                        <ExclamationTriangleIcon className="h-5 w-5 text-orange-400" />
                      </div>
                      <div className="ml-3">
                        <h3 className="text-sm font-medium text-orange-800 dark:text-orange-300">
                          Missing Supplier Prices Detected
                        </h3>
                        <div className="mt-2 text-sm text-orange-700 dark:text-orange-400">
                          <p>
                            Some items do not have a price from the selected supplier. You can uncheck these items if you don't want to set this supplier as their default yet.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-3 mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
                  <button
                    type="button"
                    onClick={confirmSetDefaultSupplier}
                    disabled={settingDefaultSupplier}
                    className="flex-1 inline-flex justify-center items-center rounded-md bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-indigo-500 dark:hover:bg-indigo-400"
                  >
                    {settingDefaultSupplier ? 'Setting...' : 'Confirm & Set as Default'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowConfirmationModal(false)
                      setSelectedSupplierId(null)
                      setItemsWithPriceHistories([])
                      setShowSetDefaultSupplierModal(true)
                    }}
                    disabled={settingDefaultSupplier}
                    className="flex-1 inline-flex justify-center rounded-md bg-white px-4 py-2.5 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-white/10 dark:text-white dark:ring-white/5 dark:hover:bg-white/20"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
  )
}
