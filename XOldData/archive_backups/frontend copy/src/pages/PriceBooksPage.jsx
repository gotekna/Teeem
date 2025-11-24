import { useEffect, useState, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  MagnifyingGlassIcon,
  CurrencyDollarIcon,
  ArrowUpTrayIcon,
  PlusIcon,
  XMarkIcon,
  FunnelIcon,
  ChevronUpIcon,
  ChevronDownIcon,
  Bars3Icon,
} from '@heroicons/react/24/outline'
import { formatCurrency } from '../utils/formatters'
import { api } from '../api'

export default function PriceBooksPage() {
  const navigate = useNavigate()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [supplierFilter, setSupplierFilter] = useState('')
  const [riskFilter, setRiskFilter] = useState('')
  const [categories, setCategories] = useState([])
  const [suppliers, setSuppliers] = useState([])
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    total_count: 0,
    total_pages: 0
  })
  const [hasMore, setHasMore] = useState(true)
  const [sortBy, setSortBy] = useState('item_code')
  const [sortDirection, setSortDirection] = useState('asc')
  const [showItemSearch, setShowItemSearch] = useState(false)
  const [itemSearchQuery, setItemSearchQuery] = useState('')

  const observerTarget = useRef(null)
  const searchTimeoutRef = useRef(null)
  const itemSearchRef = useRef(null)

  // Debounced search
  const debouncedSearch = useCallback((query) => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }

    searchTimeoutRef.current = setTimeout(() => {
      setItems([])
      setPagination(prev => ({ ...prev, page: 1 }))
      loadPriceBook(1, query, categoryFilter, supplierFilter, riskFilter)
    }, 300)
  }, [categoryFilter, supplierFilter, riskFilter])

  useEffect(() => {
    debouncedSearch(searchQuery)
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current)
      }
    }
  }, [searchQuery, debouncedSearch])

  // Load on filter change
  useEffect(() => {
    setItems([])
    setPagination(prev => ({ ...prev, page: 1 }))
    loadPriceBook(1, searchQuery, categoryFilter, supplierFilter, riskFilter)
  }, [categoryFilter, supplierFilter, riskFilter, sortBy, sortDirection])

  // Close item search when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (itemSearchRef.current && !itemSearchRef.current.contains(event.target)) {
        setShowItemSearch(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const loadPriceBook = async (page = 1, search = searchQuery, category = categoryFilter, supplier = supplierFilter, risk = riskFilter, sort = sortBy, direction = sortDirection) => {
    try {
      if (page === 1) {
        setLoading(true)
      } else {
        setLoadingMore(true)
      }

      const response = await api.get('/api/v1/pricebook', {
        params: {
          search: search || undefined,
          category: category || undefined,
          supplier_id: supplier || undefined,
          risk_level: risk || undefined,
          sort_by: sort,
          sort_direction: direction,
          page,
          limit: 50
        }
      })

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
          setSuppliers(response.filters.suppliers)
        }
      }
    } catch (err) {
      console.error('Failed to load price book:', err)
      setItems([])
      setHasMore(false)
    } finally {
      setLoading(false)
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
    setItems([])
    setPagination(prev => ({ ...prev, page: 1 }))
    loadPriceBook(1, '', '', '', '')
  }

  const hasActiveFilters = searchQuery || categoryFilter || supplierFilter || riskFilter

  const getResultsText = () => {
    const { page, limit, total_count } = pagination
    if (total_count === 0) return 'No items'

    const showing = Math.min(page * limit, total_count)
    if (showing === total_count) {
      return `${total_count.toLocaleString()} ${total_count === 1 ? 'item' : 'items'}`
    }
    return `Showing ${showing.toLocaleString()} of ${total_count.toLocaleString()} items`
  }

  // Badge component matching Tailwind UI Catalyst design
  const Badge = ({ color, children }) => {
    const colorClasses = {
      green: 'bg-green-500/15 text-green-700 dark:bg-green-500/10 dark:text-green-400',
      yellow: 'bg-yellow-400/20 text-yellow-700 dark:bg-yellow-400/10 dark:text-yellow-500',
      orange: 'bg-orange-400/20 text-orange-700 dark:bg-orange-400/10 dark:text-orange-500',
      red: 'bg-red-500/15 text-red-700 dark:bg-red-500/10 dark:text-red-400',
      gray: 'bg-gray-400/20 text-gray-700 dark:bg-gray-400/10 dark:text-gray-400'
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
    setItems([])
    setPagination(prev => ({ ...prev, page: 1 }))
  }

  const SortIcon = ({ column }) => {
    if (sortBy !== column) return <Bars3Icon className="h-4 w-4 text-gray-400" />
    return sortDirection === 'asc' ?
      <ChevronUpIcon className="h-4 w-4 text-indigo-600 dark:text-indigo-400" /> :
      <ChevronDownIcon className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
  }

  if (loading && pagination.page === 1) {
    return (
      <div className="flex h-screen overflow-hidden">
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <div className="flex-1 overflow-auto bg-white dark:bg-gray-900">
        <div className="overflow-x-auto border-l border-r border-b border-gray-200 dark:border-gray-700 rounded-lg">
          <table className="min-w-full">
            <thead className="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-10">
              <tr>
                <th
                  onClick={() => handleSort('item_code')}
                  className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span>Code</span>
                    <SortIcon column="item_code" />
                  </div>
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 relative">
                  <div className="flex items-center gap-2">
                    <span>Item Name</span>
                    <div ref={itemSearchRef} className="relative flex items-center">
                      {!showItemSearch ? (
                        <button
                          onClick={() => setShowItemSearch(true)}
                          className="hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
                          title="Search items"
                        >
                          <MagnifyingGlassIcon className="h-4 w-4" />
                        </button>
                      ) : (
                        <div className="absolute left-0 top-1/2 -translate-y-1/2">
                          <input
                            type="text"
                            placeholder="Search items..."
                            value={itemSearchQuery}
                            onChange={(e) => {
                              setItemSearchQuery(e.target.value)
                              setSearchQuery(e.target.value)
                            }}
                            autoFocus
                            className="w-64 px-3 py-1.5 pl-9 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white text-sm shadow-lg animate-in slide-in-from-right-5 duration-200"
                          />
                          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                        </div>
                      )}
                    </div>
                  </div>
                </th>
                <th
                  onClick={() => handleSort('risk_level')}
                  className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span>Status</span>
                    <SortIcon column="risk_level" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('category')}
                  className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span>Category</span>
                    <SortIcon column="category" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('current_price')}
                  className="px-3 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  <div className="flex items-center justify-end gap-2">
                    <span>Price</span>
                    <SortIcon column="current_price" />
                  </div>
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
                  Unit
                </th>
                <th
                  onClick={() => handleSort('supplier')}
                  className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span>Supplier</span>
                    <SortIcon column="supplier" />
                  </div>
                </th>
              </tr>
            </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-100 dark:divide-gray-700">
                  {items.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                        {hasActiveFilters
                          ? 'No items match your filters. Try adjusting your search or clearing filters.'
                          : 'No items found in the price book.'}
                      </td>
                    </tr>
                  ) : (
                    <>
                      {items.map((item) => (
                        <tr
                          key={item.id}
                          onClick={() => navigate(`/price-books/${item.id}`)}
                          className="hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer transition-colors"
                        >
                          <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">
                            {item.item_code}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                            {item.item_name}
                          </td>
                          <td className="px-4 py-3 text-sm">
                            <div className="flex flex-wrap gap-1">
                              {getRiskBadges(item).length > 0 ? (
                                getRiskBadges(item)
                              ) : (
                                <Badge color="green">OK</Badge>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                            {item.category || '-'}
                          </td>
                          <td className="px-4 py-3 text-sm text-right text-gray-900 dark:text-white font-medium">
                            {item.current_price ? formatCurrency(item.current_price, false) : '-'}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                            {item.unit_of_measure}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                            {item.supplier?.name || '-'}
                          </td>
                        </tr>
                      ))}

                      {/* Infinite scroll trigger */}
                      {hasMore && (
                        <tr ref={observerTarget}>
                          <td colSpan="7" className="px-4 py-4 text-center">
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
                          <td colSpan="7" className="px-4 py-4 text-center text-sm text-gray-500 dark:text-gray-400">
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
        </div>
  )
}
