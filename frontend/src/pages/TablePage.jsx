import { useState, useEffect, useRef, useCallback, startTransition } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { api } from '../api'
import TrapidTableView from '../components/documentation/TrapidTableView'
import { PlusIcon } from '@heroicons/react/24/outline'

// Default width mappings for column types
const COLUMN_TYPE_DEFAULTS = {
  'single_line_text': { width: 150, filterable: true, filterType: 'text' },
  'email': { width: 200, filterable: true, filterType: 'text' },
  'phone': { width: 150, filterable: true, filterType: 'text' },
  'mobile': { width: 150, filterable: true, filterType: 'text' },
  'url': { width: 180, sortable: false, filterable: false },
  'date': { width: 140, filterable: false },
  'date_and_time': { width: 180, filterable: false },
  'gps_coordinates': { width: 280, sortable: false, filterable: false },
  'color_picker': { width: 320, sortable: false, filterable: false },
  'file_upload': { width: 300, sortable: false, filterable: false },
  'action_buttons': { width: 180, sortable: false, filterable: false },
  'lookup': { width: 150, filterable: true, filterType: 'dropdown' },
  'boolean': { width: 100, filterable: true, filterType: 'boolean' },
  'percentage': { width: 120, filterable: false },
  'choice': { width: 140, filterable: true, filterType: 'dropdown' },
  'currency': { width: 120, filterable: false, showSum: true, sumType: 'currency' },
  'number': { width: 100, filterable: false, showSum: true, sumType: 'number' },
  'whole_number': { width: 120, filterable: false, showSum: true, sumType: 'number' },
  'multiple_lines_text': { width: 300, sortable: false, filterable: true, filterType: 'text' },
  'multiple_lookups': { width: 200, sortable: false, filterable: false },
  'user': { width: 120, filterable: true, filterType: 'dropdown' },
  'computed': { width: 140, filterable: false, showSum: true, sumType: 'number' },
}

// Convert API column format to TrapidTableView column format
function convertColumnsToTrapidFormat(apiColumns, tableSlug) {
  // Start with select column for bulk actions
  const columns = [
    { key: 'select', label: '', resizable: false, sortable: false, filterable: false, width: 32, tooltip: 'Select rows for bulk actions' }
  ]

  // Convert each API column
  apiColumns.forEach(col => {
    // Skip system/hidden columns
    if (isSystemOrHiddenColumn(col.column_name)) return

    const defaults = COLUMN_TYPE_DEFAULTS[col.column_type] || { width: 150 }

    columns.push({
      id: col.id, // Database column ID for schema editor
      key: col.column_name,
      label: col.name,
      column_type: col.column_type,
      resizable: true,
      sortable: defaults.sortable !== false,
      filterable: defaults.filterable || false,
      filterType: defaults.filterType,
      width: defaults.width,
      showSum: defaults.showSum,
      sumType: defaults.sumType,
      tooltip: col.description || `${col.column_type} column`,
      // Pass lookup info if available
      lookup_table_id: col.lookup_table_id,
      lookup_display_column: col.lookup_display_column,
    })
  })

  return columns
}

// Check if a column is a system column that's typically hidden
function isSystemOrHiddenColumn(columnName) {
  const systemColumns = [
    'sys_type_id', 'deleted', 'drive_id', 'folder_id',  // Removed 'id' - users want to see it!
    'parent_id', 'parent$type', 'range$type', 'colour_spec$type',
    'tedmodel$type', 'pricebook$type'
  ]

  if (systemColumns.includes(columnName)) return true
  if (columnName.endsWith('$type')) return true
  if (columnName.endsWith('_id') && !['product_id', 'contact_id', 'job_id'].includes(columnName)) return true

  return false
}

export default function TablePage({ embedded = false }) {
  const { id, slug } = useParams() // Get both ID and slug from URL
  const navigate = useNavigate()
  const [table, setTable] = useState(null)
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [trapidColumns, setTrapidColumns] = useState([])
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [loadingProgress, setLoadingProgress] = useState(0) // Track loading progress (0-100)
  const [loadingPhase, setLoadingPhase] = useState('loading') // 'loading' | 'processing' | 'rendering' | 'setup' | 'views' | 'finalizing'
  const [loadingPhaseMessage, setLoadingPhaseMessage] = useState('Initializing...')
  const PAGE_SIZE = 500 // Load 500 rows per page for better data visibility
  const scrollObserverRef = useRef(null)
  const tableContainerRef = useRef(null)
  const isLoadingRef = useRef(false) // Prevent infinite scroll loop
  const hasAutoFocusedRef = useRef(false) // Track if we've auto-focused search
  const activeTimersRef = useRef({ intervals: [], timeouts: [] }) // Track all active timers for cleanup
  const loadInProgressRef = useRef(false) // Prevent duplicate loads
  const lastLoadStartTimeRef = useRef(0) // Track when last load started (for duplicate detection)

  // Progressive loading for Table 205 (Price Books) - DISABLED: Now loads full table directly
  const [viewMode, setViewMode] = useState('full') // minimal | full
  const [fullDataLoaded, setFullDataLoaded] = useState(false)
  const [fullDataLoading, setFullDataLoading] = useState(false)
  const [fullRecords, setFullRecords] = useState([])
  const [minimalRecords, setMinimalRecords] = useState([])
  const [showNotification, setShowNotification] = useState(false)
  const [preloadedViews, setPreloadedViews] = useState(null) // Pre-loaded views for parallel loading
  const [viewsLoaded, setViewsLoaded] = useState(false) // Track if views are loaded (for progressive loading)
  const [viewsLoading, setViewsLoading] = useState(false) // Track if views are currently loading

  // Reset progressive loading state when table changes
  useEffect(() => {
    setViewMode('full')
    setFullDataLoaded(false)
    setFullDataLoading(false)
    setFullRecords([])
    setMinimalRecords([])
    setShowNotification(false)
    setLoadingProgress(0)
    setLoadingPhase('loading')
    setPreloadedViews(null) // Reset preloaded views
  }, [id])

  // DISABLED: Background load is no longer needed - we load full table directly
  // useEffect(() => {
  //   if (id === '205' && minimalRecords.length > 0 && !loading && !fullDataLoading && !fullDataLoaded) {
  //     console.log('[Progressive Loading] Minimal view rendered, starting background load...')
  //     // Use setTimeout to ensure this happens after browser paint
  //     setTimeout(() => {
  //       loadFullDataInBackground()
  //     }, 500) // 500ms delay to ensure user sees quick view first
  //   }
  // }, [id, minimalRecords.length, loading, fullDataLoading, fullDataLoaded]) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-focus search bar for Price Books after rendering (with retry logic)
  useEffect(() => {
    if ((id === '205' || id === 'price-books') && !loading && records.length > 0 && !hasAutoFocusedRef.current) {
      // Try multiple times with increasing delays (accounts for startTransition rendering)
      const tryFocus = (attempt = 0) => {
        const searchInput = document.querySelector('input[type="text"][placeholder*="Search"], input[type="search"]')
        if (searchInput) {
          searchInput.focus()
          searchInput.select() // Also select any existing text
          hasAutoFocusedRef.current = true
          console.log(`[Progressive Loading] ✅ Search bar focused (attempt ${attempt + 1})`)
        } else if (attempt < 10) {
          // Retry up to 10 times with exponential backoff (100ms, 200ms, 400ms, ...)
          const delay = Math.min(100 * Math.pow(1.5, attempt), 1000)
          setTimeout(() => tryFocus(attempt + 1), delay)
          console.log(`[Progressive Loading] 🔍 Retrying search focus in ${delay}ms (attempt ${attempt + 1})`)
        } else {
          console.log('[Progressive Loading] ❌ Failed to focus search after 10 attempts')
        }
      }

      // Start trying after a brief initial delay
      setTimeout(() => tryFocus(), 200)
    }
  }, [id, loading, records.length])

  // Reset auto-focus flag when table changes
  useEffect(() => {
    hasAutoFocusedRef.current = false
  }, [id])

  // Preserve search focus during rendering (Price Books)
  useEffect(() => {
    if ((id === '205' || id === 'price-books') && !loading && records.length > 0 && hasAutoFocusedRef.current) {
      // Continuously restore focus if it gets lost during rendering
      const timer = setTimeout(() => {
        const searchInput = document.querySelector('input[type="text"][placeholder*="Search"], input[type="search"]')
        if (searchInput && document.activeElement !== searchInput) {
          // Only restore if user hasn't explicitly clicked elsewhere
          const activeTag = document.activeElement?.tagName
          if (!activeTag || activeTag === 'BODY' || activeTag === 'HTML') {
            searchInput.focus()
            console.log('[Progressive Loading] 🔄 Restored search focus')
          }
        }
      }, 150)
      return () => clearTimeout(timer)
    }
  }, [id, loading, records.length])

  // Load table metadata
  useEffect(() => {
    loadTable()
  }, [id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Cleanup function to clear all active timers (but preserve loadInProgress flag)
  const clearAllTimers = useCallback(() => {
    console.log('[PROGRESS SYNC] 🧹 Cleaning up timers:', {
      intervals: activeTimersRef.current.intervals.length,
      timeouts: activeTimersRef.current.timeouts.length,
      loadInProgress: loadInProgressRef.current
    })
    activeTimersRef.current.intervals.forEach(id => clearInterval(id))
    activeTimersRef.current.timeouts.forEach(id => clearTimeout(id))
    activeTimersRef.current.intervals = []
    activeTimersRef.current.timeouts = []
    // DON'T reset loadInProgressRef here - let loadRecords manage it
  }, [])

  // PROGRESSIVE LOADING: Load views FIRST, then records in background
  useEffect(() => {
    if (table) {
      console.log('[Progressive Loading] 🚀 Step 1: Loading views first...')
      loadViewsFirst()
    }
    // Cleanup timers on unmount or when table/id changes
    return () => {
      console.log('[PROGRESS SYNC] 🧹 useEffect cleanup running')
      clearAllTimers()
      // Reset flag to allow fresh load on remount
      loadInProgressRef.current = false
      setViewsLoaded(false)
      setViewsLoading(false)
      // CRITICAL: Clear records to prevent cross-table contamination
      setRecords([])
    }
  }, [table, id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Step 2: Load records after views are loaded
  useEffect(() => {
    if (viewsLoaded && table && records.length === 0) {
      console.log('[Progressive Loading] 📊 Step 2: Loading records in background...')
      loadRecords()
    }
  }, [viewsLoaded, table]) // eslint-disable-line react-hooks/exhaustive-deps

  // Track when loading state changes
  useEffect(() => {
    console.log(`[PROGRESS SYNC] 🔄 Loading state changed: ${loading}`)
  }, [loading])

  // Track when records are actually rendered
  useEffect(() => {
    if (!loading && records.length > 0) {
      console.log(`[PROGRESS SYNC] ✅ Component rendered with ${records.length} records`)
    }
  }, [loading, records.length])

  // Convert columns when table data changes
  useEffect(() => {
    if (table && table.columns) {
      const startTime = performance.now()
      let converted = convertColumnsToTrapidFormat(table.columns, table.slug)

      const endTime = performance.now()

      if (id === '205' || id === 'price-books') {
        console.log('[Progressive Loading] Column conversion:', {
          columnCount: converted.length,
          conversionTime: `${(endTime - startTime).toFixed(2)}ms`,
          viewMode
        })
      }

      setTrapidColumns(converted)
    }
  }, [table, id, viewMode])

  // Load more records when scrolling near bottom
  const loadMoreRecords = useCallback(() => {
    if (!loadingMore && !loading && hasMore) {
      console.log('[Infinite Scroll] Loading more records, next page:', currentPage + 1)
      loadRecords(currentPage + 1, true).finally(() => {
        if (isLoadingRef.current) {
          isLoadingRef.current = false
        }
      })
    } else {
      isLoadingRef.current = false
    }
  }, [loadingMore, loading, hasMore, currentPage])

  // Store loadMoreRecords in a ref to avoid recreating observer
  const loadMoreRecordsRef = useRef(loadMoreRecords)
  loadMoreRecordsRef.current = loadMoreRecords

  // Set up IntersectionObserver for infinite scroll
  useEffect(() => {
    if (!tableContainerRef.current || loading || !hasMore) return

    const options = {
      root: null,
      rootMargin: '200px', // Start loading 200px before reaching bottom
      threshold: 0.1
    }

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting && !isLoadingRef.current && hasMore) {
          isLoadingRef.current = true
          loadMoreRecordsRef.current()
        }
      })
    }, options)

    if (scrollObserverRef.current) {
      observer.observe(scrollObserverRef.current)
    }

    return () => {
      if (scrollObserverRef.current) {
        observer.unobserve(scrollObserverRef.current)
      }
    }
  }, [loading, hasMore])

  const loadTable = async () => {
    try {
      console.log('[Load Table] Loading table with ID/slug:', id)
      const response = await api.get(`/api/v1/tables/${id}`)
      console.log('[Load Table] ✅ Table loaded:', response.table?.name)
      setTable(response.table)

      // If URL only has ID (not ID/slug), redirect to include both
      if (response.table && !slug && response.table.slug) {
        const newUrl = `/tables/${response.table.id}/${response.table.slug}`
        console.log('[Load Table] 🔄 Redirecting to combined ID/slug URL:', newUrl)
        navigate(newUrl, { replace: true }) // replace: true keeps browser history clean
      }
    } catch (err) {
      console.error('[Load Table] ❌ Failed to load table:', {
        id,
        error: err.response?.data || err.message,
        status: err.response?.status
      })
      setError(err.response?.data?.error || 'Failed to load table')
    }
  }

  // PROGRESSIVE LOADING: Load views independently BEFORE records
  // This makes the UI feel faster by showing saved views immediately
  const loadViewsFirst = async () => {
    if (viewsLoading || viewsLoaded || !table?.id) return

    setViewsLoading(true)
    console.log('[Progressive Loading] 🎯 Loading views for table:', table.id)

    try {
      const data = await api.get(`/api/v1/table_views`, {
        params: { table_id: table.id }
      })

      if (data && data.success && data.views) {
        console.log('[Progressive Loading] ✅ Views loaded!', data.views.length, 'views')
        setPreloadedViews(data.views)
        setViewsLoaded(true)
        // Views are ready - users can now interact with saved views
        // while records load in the background
      }
    } catch (error) {
      console.error('[Progressive Loading] ❌ Error loading views:', error)
      // Even if views fail, continue loading - don't block the page
      setViewsLoaded(true) // Set to true anyway so records can start loading
    } finally {
      setViewsLoading(false)
    }
  }

  const loadRecords = async (page = 1, append = false) => {
    // Prevent duplicate loads (React Strict Mode protection)
    const now = Date.now()
    const timeSinceLastLoad = now - lastLoadStartTimeRef.current

    if (!append && loadInProgressRef.current) {
      console.log('[PROGRESS SYNC] ⚠️ Load already in progress, skipping duplicate call')
      return
    }

    // Also prevent rapid duplicate loads within 100ms (React Strict Mode double-mount)
    if (!append && timeSinceLastLoad < 100 && timeSinceLastLoad > 0) {
      console.log(`[PROGRESS SYNC] ⚠️ Duplicate load detected within ${timeSinceLastLoad}ms, skipping`)
      return
    }

    let progressInterval = null
    let simulatedProgress = 0 // Track simulated progress for download

    try {
      // For Price Books table (ID: 205, slug: price-books), load ALL items with full data
      const isPriceBooks = id === '205' || id === 'price-books'

      // Check for preloaded data in sessionStorage (Price Books only)
      if (isPriceBooks && !append) {
        const preloadedData = sessionStorage.getItem('preloaded_table_price_books')
        if (preloadedData) {
          try {
            const { data, timestamp } = JSON.parse(preloadedData)
            const age = Date.now() - timestamp
            const maxAge = 5 * 60 * 1000 // 5 minutes

            if (age < maxAge) {
              console.log(`[Preload] ✅ Using preloaded data (age: ${Math.round(age / 1000)}s)`)
              setRecords(data.records || [])
              setCurrentPage(data.pagination?.page || 1)
              setTotalPages(data.pagination?.total_pages || 1)
              setTotalCount(data.pagination?.total_count || 0)
              setHasMore(false)
              setLoading(false)
              loadInProgressRef.current = false
              return // Skip API call entirely!
            } else {
              console.log(`[Preload] ⚠️ Preloaded data expired (age: ${Math.round(age / 1000)}s), loading fresh data`)
              sessionStorage.removeItem('preloaded_table_price_books')
            }
          } catch (error) {
            console.error('[Preload] Failed to parse preloaded data:', error)
            sessionStorage.removeItem('preloaded_table_price_books')
          }
        }
      }

      if (append) {
        setLoadingMore(true)
      } else {
        // Record start time and set flag FIRST to prevent race conditions
        lastLoadStartTimeRef.current = now
        loadInProgressRef.current = true
        // Now clear any existing timers
        clearAllTimers()
        // Don't show loading screen - data loads fast enough
        setLoading(false)
      }
      const perPage = isPriceBooks && !append ? 10000 : PAGE_SIZE // Load all items for Price Books

      // PHASE 2/3: Use minimal fields on initial load for better performance
      const useMinimalFields = !append && page === 1 // First page only
      const fieldsParam = useMinimalFields ? '&fields=minimal' : ''

      // PHASE 3: Pass view_id if we have a default view
      const defaultView = preloadedViews?.find(v => v.display_order === 0)
      const viewParam = useMinimalFields && defaultView ? `&view_id=${defaultView.id}` : ''

      console.log('[Progressive Loading] loadRecords called:', {
        id,
        viewMode,
        page,
        append,
        isPriceBooks,
        perPage,
        fieldsMode: useMinimalFields ? 'minimal' : 'full',
        viewId: defaultView?.id,
        viewName: defaultView?.name
      })

      // No loading screen for Price Books - preload handles it or loads fast
      const startTime = Date.now()

      // Views are already loaded by loadViewsFirst() - no need to load them here

      const response = await api.get(`/api/v1/tables/${id}/records?per_page=${perPage}&page=${page}${fieldsParam}${viewParam}`, {
        onDownloadProgress: (progressEvent) => {
          // Just update progress if we have real data
          if (progressEvent.total) {
            const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total)
            const downloadProgress = Math.min(Math.round(percentCompleted * 0.7), 70)
            setLoadingProgress(Math.max(simulatedProgress, downloadProgress))
            console.log(`[Loading Progress] ${percentCompleted}% (mapped to ${downloadProgress}%)`)
          }
        }
      })

      // Clear interval now that data is received (only for table 205)
      if (progressInterval) {
        clearInterval(progressInterval)
        progressInterval = null
      }

      const loadEndTime = performance.now()
      console.log('[Progressive Loading] Response received:', {
        recordCount: response.records?.length,
        totalCount: response.pagination?.total_count,
        totalPages: response.pagination?.total_pages,
        currentPage: response.pagination?.page,
        loadTime: `${(loadEndTime - performance.now() + 1000).toFixed(0)}ms` // Approximate
      })

      // Log sample record to see column structure
      if ((id === '205' || id === 'price-books') && response.records?.length > 0 && !append) {
        console.log('[Progressive Loading] Sample record:', {
          columns: Object.keys(response.records[0]),
          firstRecord: response.records[0]
        })
      }

      if (append) {
        // When appending, filter out duplicates by ID
        setRecords(prev => {
          const existingIds = new Set(prev.map(r => r.id))
          const newRecords = (response.records || []).filter(r => !existingIds.has(r.id))
          return [...prev, ...newRecords]
        })
      } else {
        // When not appending, use startTransition to make render non-blocking
        const recordsSetStartTime = Date.now()
        console.log(`[PROGRESS SYNC] 📊 Setting ${response.records?.length} records in state (non-blocking)...`)

        // startTransition marks this update as non-urgent, keeping UI responsive
        startTransition(() => {
          setRecords(response.records || [])
        })

        const recordsSetTime = Date.now() - recordsSetStartTime
        console.log(`[PROGRESS SYNC] 📊 startTransition() call completed in ${recordsSetTime}ms (render will happen in background)`)
      }

      console.log('[Progressive Loading] Records state updated:', {
        append,
        responseCount: response.records?.length,
        totalInState: append ? 'appended' : response.records?.length
      })

      setCurrentPage(page)
      setTotalPages(response.pagination?.total_pages || 1)
      setTotalCount(response.pagination?.total_count || 0)

      // For Price Books, disable infinite scroll since we load everything at once
      if (isPriceBooks && !append) {
        setHasMore(false)
      } else {
        setHasMore(page < (response.pagination?.total_pages || 1))
      }

      // Views were already loaded by loadViewsFirst() - they're ready to use

      // Data is loaded - clean up
      if (!append) {
        const totalTime = Date.now() - startTime
        console.log(`[PROGRESS SYNC] 🎉 Load complete in ${totalTime}ms`)
        loadInProgressRef.current = false

        // PHASE 4: Background load full fields if we just loaded minimal
        if (response.progressive_loading && useMinimalFields) {
          console.log('[Progressive Loading] 🔄 Minimal load complete, scheduling background full load...')
          setTimeout(() => {
            loadFullFieldsInBackground(page, perPage)
          }, 500) // Small delay to let UI render
        }
      } else {
        setLoadingMore(false)
      }
    } catch (err) {
      // Clean up all timers on error
      clearAllTimers()
      loadInProgressRef.current = false
      setError('Failed to load records')
      console.error(err)
      setLoading(false)
      setLoadingMore(false)
    }
  }

  // Background loader for full data (Price Books)
  const loadFullDataInBackground = async () => {
    if ((id !== '205' && id !== 'price-books') || fullDataLoading || fullDataLoaded) return

    setFullDataLoading(true)
    console.log('[Progressive Loading] Starting background load of full data...')

    try {
      // Save current focused element before state updates
      const activeElement = document.activeElement

      // Load all items with full data (no fields=minimal param)
      const response = await api.get(`/api/v1/tables/${id}/records?per_page=10000&page=1`)

      setFullRecords(response.records || [])
      setFullDataLoaded(true)
      setShowNotification(true)
      console.log('[Progressive Loading] Full data loaded! ', response.records?.length, 'items')

      // Restore focus to search input if it was focused
      setTimeout(() => {
        if (activeElement && activeElement.tagName === 'INPUT' && activeElement.type === 'text') {
          activeElement.focus()
          console.log('[Progressive Loading] Restored focus to search input')
        }
      }, 50)
    } catch (err) {
      console.error('[Progressive Loading] Failed to load full data:', err)
    } finally {
      setFullDataLoading(false)
    }
  }

  // PHASE 4: Background loader for full fields (all tables)
  const loadFullFieldsInBackground = async (page, perPage) => {
    console.log('[Progressive Loading] 🔄 Starting background load of full fields...')

    try {
      // Save current scroll position and focused element
      const scrollY = window.scrollY
      const activeElement = document.activeElement

      // Load full fields (no fields=minimal param)
      const response = await api.get(`/api/v1/tables/${id}/records?per_page=${perPage}&page=${page}`)

      if (response.records && response.records.length > 0) {
        console.log('[Progressive Loading] ✅ Full fields loaded:', {
          recordCount: response.records.length,
          sampleColumns: Object.keys(response.records[0])
        })

        // INTELLIGENT MERGE: Preserve any user edits that happened during background load
        startTransition(() => {
          setRecords(prevRecords => {
            // Create a map of current records by ID for fast lookup
            const currentMap = new Map(prevRecords.map(r => [r.id, r]))

            // Merge full data with current state
            return response.records.map(fullRecord => {
              const currentRecord = currentMap.get(fullRecord.id)

              // If record doesn't exist in current state, use full record
              if (!currentRecord) return fullRecord

              // If record exists, merge: preserve any fields that might have changed
              // during background load, but add missing fields from full record
              return {
                ...fullRecord, // Full record with all fields
                ...Object.fromEntries(
                  Object.entries(currentRecord).filter(([key, value]) => {
                    // Keep user-modified fields (if updated_at is newer)
                    return currentRecord.updated_at > fullRecord.updated_at
                  })
                )
              }
            })
          })
        })

        // Restore scroll position and focus
        setTimeout(() => {
          window.scrollTo(0, scrollY)
          if (activeElement && activeElement.tagName === 'INPUT') {
            activeElement.focus()
          }
        }, 0)

        console.log('[Progressive Loading] 🎉 Full fields merged successfully!')
      }
    } catch (err) {
      console.error('[Progressive Loading] ❌ Failed to load full fields:', err)
      // Fail silently - user already has minimal data
    }
  }

  // Switch from minimal to full view
  const switchToFullView = () => {
    if (fullDataLoaded) {
      setRecords(fullRecords)
      setViewMode('full')
      setShowNotification(false)
      console.log('[Progressive Loading] Switched to full view')
    }
  }

  // Switch from full to minimal view
  const switchToMinimalView = () => {
    if (minimalRecords.length > 0) {
      setRecords(minimalRecords)
      setViewMode('minimal')
      console.log('[Progressive Loading] Switched to minimal view')
    }
  }

  // CRUD handlers for TrapidTableView
  const handleEdit = async (entry) => {
    try {
      // Filter out UI-only columns (select, actions, etc.) before sending to backend
      const { select, actions, ...recordData } = entry

      // Also filter out any empty string values that were added by the UI
      const cleanedData = Object.fromEntries(
        Object.entries(recordData).filter(([_, v]) => v !== '')
      )

      const response = await api.put(`/api/v1/tables/${id}/records/${entry.id}`, {
        record: cleanedData
      })
      if (response.success) {
        await loadRecords()
      }
    } catch (err) {
      console.error('Failed to update record:', err)
      alert('Failed to update record')
    }
  }

  const handleDelete = async (entry) => {
    try {
      const response = await api.delete(`/api/v1/tables/${id}/records/${entry.id}`)
      if (response.success) {
        await loadRecords()
      }
    } catch (err) {
      console.error('Failed to delete record:', err)
      alert('Failed to delete record')
    }
  }

  const handleBulkDelete = async (entries) => {
    try {
      await Promise.all(
        entries.map(entry =>
          api.delete(`/api/v1/tables/${id}/records/${entry.id}`)
        )
      )
      await loadRecords()
    } catch (err) {
      console.error('Failed to bulk delete records:', err)
      alert('Failed to delete records')
    }
  }

  const handleAddNew = async () => {
    if (!table || !table.columns || table.columns.length === 0) {
      alert('This table has no columns yet. Please add columns before adding records.')
      return
    }

    try {
      const newRecordData = {}
      table.columns.forEach(col => {
        newRecordData[col.column_name] = ''
      })

      const response = await api.post(`/api/v1/tables/${id}/records`, {
        record: newRecordData
      })

      if (response.success) {
        await loadRecords()
      }
    } catch (err) {
      console.error('Failed to add record:', err)
      alert('Failed to add record')
    }
  }

  const handleImport = () => {
    alert('Import functionality coming soon')
  }

  const handleExport = () => {
    // Export current records as CSV
    if (!records.length) {
      alert('No records to export')
      return
    }

    const visibleColumns = table.columns.filter(col => !isSystemOrHiddenColumn(col.column_name))
    const headers = visibleColumns.map(col => col.name)
    const rows = records.map(record =>
      visibleColumns.map(col => {
        const value = record[col.column_name]
        if (value === null || value === undefined) return ''
        if (typeof value === 'object') return value.display || ''
        return String(value)
      })
    )

    const csv = [headers.join(','), ...rows.map(row => row.map(cell => `"${cell}"`).join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${table.slug || 'export'}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <div className="text-red-600 dark:text-red-400">{error}</div>
        <Link to="/dashboard" className="text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 mt-4 inline-block">
          Back to Dashboard
        </Link>
      </div>
    )
  }

  if (!table) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 dark:border-indigo-400 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading table...</p>
        </div>
      </div>
    )
  }

  // Debug: Log records count before render
  if (id === '205' || id === 'price-books') {
    console.log('[Progressive Loading] Render state:', {
      recordsCount: records.length,
      totalCount,
      viewMode,
      hasMore,
      loading,
      columnsCount: trapidColumns.length
    })
  }

  return (
    <div className={`${embedded ? '' : '-mx-4 sm:-mx-6 lg:-mx-8 -my-4'} flex-1 flex flex-col min-h-0 bg-white dark:bg-gray-900`} ref={tableContainerRef}>

      {/* Progressive Loading Notification Banner (Table 205) */}
      {showNotification && fullDataLoaded && (
        <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border-b border-green-200 dark:border-green-800 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex-shrink-0">
                <svg className="h-6 w-6 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-green-900 dark:text-green-100">
                  Full Price Book Loaded!
                </h3>
                <p className="text-sm text-green-700 dark:text-green-300 mt-0.5">
                  All {totalCount.toLocaleString()} items with all columns are now available.
                  Currently showing: <span className="font-medium">{viewMode === 'minimal' ? 'Quick View (3 columns)' : 'Full View (all columns)'}</span>
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {viewMode === 'minimal' && (
                <button
                  onClick={switchToFullView}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 dark:bg-green-500 dark:hover:bg-green-600 text-white text-sm font-medium rounded-lg transition-colors shadow-sm"
                >
                  View All Columns
                </button>
              )}
              <button
                onClick={() => setShowNotification(false)}
                className="px-4 py-2 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm font-medium rounded-lg transition-colors border border-gray-300 dark:border-gray-600"
              >
                {viewMode === 'minimal' ? 'Stay in Quick View' : 'Dismiss'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Background Loading Indicator (Table 205) */}
      {id === '205' && fullDataLoading && !fullDataLoaded && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border-b border-blue-200 dark:border-blue-800 px-6 py-3">
          <div className="flex items-center gap-3">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600 dark:border-blue-400"></div>
            <p className="text-sm text-blue-800 dark:text-blue-300">
              Loading full data in background... You can search and work with the current quick view now.
            </p>
          </div>
        </div>
      )}

      {/* TrapidTableView - The Gold Standard */}
      <div className="flex-1 min-h-0 overflow-auto">
        {trapidColumns.length > 0 ? (
          <TrapidTableView
            tableId={`table-${table.slug || id}`}
            tableIdNumeric={table.id}
            tableName={table.name}
            entries={records}
            columns={trapidColumns}
            preloadedViews={preloadedViews}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onBulkDelete={handleBulkDelete}
            enableImport={true}
            enableExport={true}
            enableSchemaEditor={true}
            onImport={handleImport}
            onExport={handleExport}
            onRowDoubleClick={(entry) => {
              // Store current table view URL for "Back" button
              const currentTableUrl = window.location.pathname + window.location.search
              sessionStorage.setItem('contactsTableView', currentTableUrl)

              // Navigate to detail page based on table type
              if (table.slug === 'contacts' || table.database_table_name === 'contacts') {
                navigate(`/contacts/${entry.id}?returnTo=${encodeURIComponent(currentTableUrl)}`)
              } else if (table.slug === 'jobs' || table.slug === 'active-jobs' || table.database_table_name === 'jobs' || table.database_table_name === 'constructions') {
                navigate(`/jobs/${entry.id}?returnTo=${encodeURIComponent(currentTableUrl)}`)
              } else if (table.slug === 'pricebook-items' || table.database_table_name === 'pricebook_items') {
                navigate(`/price-books/${entry.id}?returnTo=${encodeURIComponent(currentTableUrl)}`)
              }
              // For other tables, default edit modal opens
            }}
            onView={(entry) => {
              // Store current table view URL for "Back" button
              const currentTableUrl = window.location.pathname + window.location.search
              sessionStorage.setItem('contactsTableView', currentTableUrl)

              // View button navigates to detail page
              if (table.slug === 'contacts' || table.database_table_name === 'contacts') {
                navigate(`/contacts/${entry.id}?returnTo=${encodeURIComponent(currentTableUrl)}`)
              } else if (table.slug === 'jobs' || table.slug === 'active-jobs' || table.database_table_name === 'jobs' || table.database_table_name === 'constructions') {
                navigate(`/jobs/${entry.id}?returnTo=${encodeURIComponent(currentTableUrl)}`)
              } else if (table.slug === 'pricebook-items' || table.database_table_name === 'pricebook_items') {
                navigate(`/price-books/${entry.id}?returnTo=${encodeURIComponent(currentTableUrl)}`)
              }
            }}
            onColumnUpdate={() => {
              // Reload table data when column schema is updated
              loadTable()
            }}
            viewOnly={
              table.slug === 'pricebook-items' ||
              table.database_table_name === 'pricebook_items' ||
              table.slug === 'contacts' ||
              table.database_table_name === 'contacts'
            }
            onEditRelationships={
              (table.slug === 'contacts' || table.database_table_name === 'contacts')
                ? (entry) => {
                    // Navigate to relationships tab in edit mode
                    const currentTableUrl = window.location.pathname + window.location.search
                    sessionStorage.setItem('contactsTableView', currentTableUrl)
                    navigate(`/contacts/${entry.id}?tab=relationships&edit=true&returnTo=${encodeURIComponent(currentTableUrl)}`)
                  }
                : null
            }
            customActions={
              <div className="flex items-center gap-3">
                {/* View Mode Switcher for Table 205 */}
                {id === '205' && fullDataLoaded && (
                  <button
                    onClick={() => {
                      if (viewMode === 'minimal') {
                        switchToFullView()
                      } else {
                        switchToMinimalView()
                      }
                    }}
                    className="inline-flex items-center gap-2 px-4 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 text-sm font-medium rounded-lg transition-colors h-[42px] border border-gray-300 dark:border-gray-600"
                    title={viewMode === 'minimal' ? 'Switch to full view with all columns' : 'Switch to quick view with 3 columns'}
                  >
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                    </svg>
                    {viewMode === 'minimal' ? 'Full View' : 'Quick View'}
                  </button>
                )}

                <button
                  onClick={handleAddNew}
                  className="inline-flex items-center gap-2 px-4 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors h-[42px]"
                >
                  <PlusIcon className="h-5 w-5" />
                  Add Record
                </button>
              </div>
            }
          />
        ) : null}
      </div>

      {/* Infinite Scroll Status */}
      <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
        <div className="text-sm text-gray-600 dark:text-gray-400">
          Showing {records.length.toLocaleString()} of {totalCount.toLocaleString()} records
        </div>
        {loadingMore && (
          <div className="flex items-center gap-2">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
            <span className="text-sm text-gray-500 dark:text-gray-400">Loading more...</span>
          </div>
        )}
        {!hasMore && records.length > 0 && (
          <div className="text-sm text-gray-500 dark:text-gray-400">
            All records loaded
          </div>
        )}
      </div>

      {/* Infinite Scroll Observer Element */}
      {hasMore && !loading && (
        <div
          ref={scrollObserverRef}
          className="h-20 flex items-center justify-center"
        >
          {loadingMore && (
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
          )}
        </div>
      )}
    </div>
  )
}
