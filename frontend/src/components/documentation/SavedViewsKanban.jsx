import { useState } from 'react'
import { StarIcon, PencilIcon, TrashIcon, FunnelIcon, EyeIcon } from '@heroicons/react/24/outline'
import { StarIcon as StarIconSolid } from '@heroicons/react/24/solid'
import { api } from '../../api'

/**
 * SavedViewsKanban - Trello-style drag-and-drop list for saved views
 * Cards fill width, stay in bounds, scroll naturally
 * First card automatically becomes default
 */
export default function SavedViewsKanban({
  savedFilters,
  setSavedFilters,
  activeViewId,
  setActiveViewId,
  setCascadeFilters,
  setVisibleColumns,
  setShowCascadeDropdown,
  filterName,
  setFilterName,
  cascadeFilters,
  visibleColumns,
  editingViewId,
  setEditingViewId,
  setVisibilityColumnOrder,
  setColumnOrder,
  setFilterGroups,
  setInterGroupLogic,
  setSortColumns,
  setGroupByColumn,
  setGroupByColumns,
  deleteView,
  hideHeader = false,
  searchParams,
  setSearchParams,
  columns = [],
  showFilters
}) {
  const [draggedIndex, setDraggedIndex] = useState(null)
  const [dragOverIndex, setDragOverIndex] = useState(null)
  const [lastDragEndTime, setLastDragEndTime] = useState(0)

  // Helper to reorder and set default flags in one operation
  // fromIndex and toIndex are based on the FILTERED array (without __default_setup__)
  // We need to adjust them to work with the full savedFilters array
  const reorderFilters = async (fromIndexFiltered, toIndexFiltered) => {
    // Optimistically update UI first
    setSavedFilters(prev => {
      const newFilters = [...prev]

      // Find the index of __default_setup__ in the full array
      const defaultSetupIndex = newFilters.findIndex(v => v.name === '__default_setup__')
      const hasDefaultSetup = defaultSetupIndex !== -1

      // Adjust indices to account for __default_setup__ being filtered out
      // If __default_setup__ exists and is before our target indices, add 1
      const fromIndex = hasDefaultSetup && defaultSetupIndex <= fromIndexFiltered
        ? fromIndexFiltered + 1
        : fromIndexFiltered
      const toIndex = hasDefaultSetup && defaultSetupIndex <= toIndexFiltered
        ? toIndexFiltered + 1
        : toIndexFiltered

      const [draggedItem] = newFilters.splice(fromIndex, 1)
      newFilters.splice(toIndex, 0, draggedItem)

      // Set display_order based on position (no default flag)
      const reordered = newFilters.map((v, idx) => ({
        ...v,
        display_order: idx
      }))

      // Save new order to API in background
      const orders = reordered.map(v => ({
        id: v.id,
        display_order: v.display_order
      }))

      api.post('/api/v1/foundation_views/reorder', { orders })
        .then(() => console.log('View order saved'))
        .catch(err => console.error('Failed to save view order:', err))

      return reordered
    })
  }

  // Edit name is now handled in the parent header - no prompt needed

  const handleDragStart = (e, index) => {
    setDraggedIndex(index)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', index.toString())
  }

  const handleDragOver = (e, index) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'

    if (draggedIndex !== null && draggedIndex !== index) {
      setDragOverIndex(index)
    }
  }

  const handleDrop = (e, index) => {
    e.preventDefault()
    e.stopPropagation()
    if (draggedIndex !== null && draggedIndex !== index) {
      console.log('handleDrop reordering from', draggedIndex, 'to', index)
      reorderFilters(draggedIndex, index)
    }
    // Always clear drag state after drop
    setDraggedIndex(null)
    setDragOverIndex(null)
  }

  const handleDragEnd = (e) => {
    e.stopPropagation()
    // Only reorder if drop didn't fire (draggedIndex still set) and we have a valid target
    if (draggedIndex !== null && dragOverIndex !== null && draggedIndex !== dragOverIndex) {
      console.log('handleDragEnd reordering from', draggedIndex, 'to', dragOverIndex)
      reorderFilters(draggedIndex, dragOverIndex)
    }
    // Always clear drag state to prevent stuck visual states
    setDraggedIndex(null)
    setDragOverIndex(null)
    // Record when drag ended to prevent click from firing
    setLastDragEndTime(Date.now())
  }

  const handleLoadView = (view) => {
    setCascadeFilters(view.filters.map(f => ({
      id: Date.now() + Math.random(),
      column: f.column,
      value: f.value,
      operator: f.operator || '=',
      label: f.label,
      groupId: f.groupId || 'default'
    })))
    // Restore filter groups and inter-group logic
    if (view.filterGroups && setFilterGroups) {
      setFilterGroups(view.filterGroups)
    } else if (setFilterGroups) {
      setFilterGroups([{ id: 'default', logic: 'AND' }])
    }
    if (view.interGroupLogic && setInterGroupLogic) {
      setInterGroupLogic(view.interGroupLogic)
    } else if (setInterGroupLogic) {
      setInterGroupLogic('OR')
    }
    if (view.visibleColumns) {
      // Merge saved visible columns - explicitly set all keys
      // Any key not in the saved view defaults to false (hidden)
      setVisibleColumns(prev => {
        const merged = {}
        // Start with all columns hidden
        Object.keys(prev).forEach(key => {
          merged[key] = false
        })
        // Then apply saved visibility (true values)
        Object.entries(view.visibleColumns).forEach(([key, value]) => {
          merged[key] = value
        })
        return merged
      })
    }
    // Restore column order for both visibility panel and table
    if (view.columnOrder) {
      if (setVisibilityColumnOrder) setVisibilityColumnOrder(view.columnOrder)
      if (setColumnOrder) setColumnOrder(view.columnOrder)
    }
    // Restore sort columns
    if (setSortColumns) {
      setSortColumns(view.sortColumns || [])
    }
    // Restore group by columns - prefer array, fall back to single column
    if (setGroupByColumns) {
      const groupCols = Array.isArray(view.groupByColumns) && view.groupByColumns.length > 0
        ? view.groupByColumns
        : (view.groupByColumn ? [view.groupByColumn] : [])
      setGroupByColumns(groupCols)
      if (setGroupByColumn) {
        setGroupByColumn(groupCols[0] || null)  // Keep legacy single in sync
      }
    }
    setActiveViewId(view.id)
    setEditingViewId(null) // Clear edit mode when loading a view
    // Stay in cascade popup - just load settings into editor
    // Don't close popup or update URL until user explicitly closes
  }

  const handleDeleteView = async (view) => {
    // Protect the "Setup" view from deletion
    if (view.name === 'Setup') {
      alert('The "Setup" view cannot be deleted as it\'s required as the template for new views.')
      return
    }

    if (confirm(`Delete view "${view.name}"?`)) {
      // Call API to delete from database
      // deleteView handles updating savedFilters in parent component
      const success = await deleteView(view.id)
      if (success && activeViewId === view.id) {
        // Clear active view if we just deleted it
        setActiveViewId(null)
      }
    }
  }

  if (savedFilters.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-gray-500 dark:text-gray-400">
        <div className="text-center max-w-xs px-4">
          <div className="text-4xl mb-3">🎯</div>
          <div className="text-sm font-medium mb-1">No Saved Views</div>
          <div className="text-xs">
            Create filters on the left, then save them as a view for quick access
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={`h-full flex flex-col ${hideHeader ? '' : 'bg-gradient-to-b from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 rounded-lg'} overflow-hidden`}>
      {/* Header - only show if not hidden */}
      {!hideHeader && (
        <div className="flex-shrink-0 bg-gradient-to-r from-indigo-500 to-purple-600 text-white px-4 py-3 shadow-lg">
          <div className="flex items-center justify-between gap-2">
            {editingViewId ? (
              // Editing mode - show inline edit
              <>
                <span className="text-xs opacity-90 whitespace-nowrap">Editing:</span>
                <input
                  type="text"
                  autoFocus
                  defaultValue={savedFilters.find(v => v.id === editingViewId)?.name || ''}
                  className="flex-1 min-w-0 text-sm font-semibold px-2 py-1 border-0 rounded bg-white/20 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-white/50"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      const newName = e.target.value.trim()
                      if (newName) {
                        setSavedFilters(savedFilters.map(v =>
                          v.id === editingViewId ? { ...v, name: newName } : v
                        ))
                      }
                      setEditingViewId(null)
                    } else if (e.key === 'Escape') {
                      setEditingViewId(null)
                    }
                  }}
                  onBlur={(e) => {
                    const newName = e.target.value.trim()
                    const editingView = savedFilters.find(v => v.id === editingViewId)

                    // Protect "Setup" view from being renamed
                    if (editingView && editingView.name === 'Setup' && newName !== 'Setup') {
                      alert('The "Setup" view cannot be renamed as it\'s the default template for new views.')
                      setEditingViewId(null)
                      return
                    }

                    if (newName) {
                      setSavedFilters(savedFilters.map(v =>
                        v.id === editingViewId ? { ...v, name: newName } : v
                      ))
                    }
                    setEditingViewId(null)
                  }}
                />
                <button
                  onClick={() => setEditingViewId(null)}
                  className="text-xs px-2 py-1 bg-white/20 hover:bg-white/30 rounded transition-colors whitespace-nowrap"
                >
                  Cancel
                </button>
              </>
            ) : (
              // Normal mode
              <>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold">Saved Views</span>
                  <span className="inline-flex items-center justify-center min-w-[20px] h-[20px] bg-white/20 backdrop-blur-sm text-white rounded-full text-xs font-bold">
                    {savedFilters.filter(v => v.name !== '__default_setup__').length}
                  </span>
                </div>
                <div className="text-xs opacity-90">Drag to reorder</div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Scrollable card list */}
      <div className="flex-1 overflow-y-auto cascade-popup-scroll px-2 py-2 space-y-1">
        {savedFilters.filter(v => v.name !== '__default_setup__').map((view, index) => {
          const isActive = activeViewId === view.id
          const isThisCardDragging = draggedIndex === index
          const isDragOver = dragOverIndex === index
          const isFirst = index === 0

          return (
            <div
              key={view.id}
              draggable
              onDragStart={(e) => handleDragStart(e, index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDrop={(e) => handleDrop(e, index)}
              onDragEnd={handleDragEnd}
              onClick={(e) => {
                // Ignore clicks that happen within 300ms of a drag ending
                // This prevents the click event that fires after dragEnd
                if (Date.now() - lastDragEndTime < 300) {
                  e.preventDefault()
                  e.stopPropagation()
                  return
                }
                handleLoadView(view)
              }}
              className={`
                group relative rounded-md shadow-sm px-2 py-1.5 cursor-pointer
                transition-all duration-200 ease-out
                ${isThisCardDragging ? 'opacity-40 scale-95' : 'opacity-100 scale-100'}
                ${isDragOver ? 'border-t-2 border-indigo-500' : ''}
                ${isActive
                  ? 'bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/30 dark:to-indigo-900/30 border border-blue-400 dark:border-blue-500'
                  : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:border-indigo-300 dark:hover:border-indigo-600 hover:shadow-md'
                }
              `}
            >
              {/* Active indicator - blue bar on left */}
              {isActive && (
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500 rounded-l" />
              )}

              {/* Card content - compact single row layout */}
              <div className="flex items-center gap-2 min-w-0">
                {/* Drag handle */}
                <div className="flex-shrink-0 cursor-grab text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M7 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 2zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 14zm6-8a2 2 0 1 0-.001-4.001A2 2 0 0 0 13 6zm0 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 14z" />
                  </svg>
                </div>
                {/* View name */}
                <h4 className="font-semibold text-sm text-gray-900 dark:text-white truncate flex-shrink-0" style={{ maxWidth: '100px' }}>
                  {view.name === 'Default' && <span className="text-blue-600 dark:text-blue-400">📌 </span>}
                  <span className={view.name === 'Default' ? 'font-bold' : ''}>{view.name}</span>
                </h4>

                {/* Compact metadata badges - all in one row */}
                <div className="flex items-center gap-1 flex-shrink-0">
                  {/* Filters count */}
                  <span className="text-xs px-1 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded font-medium">
                    {view.filters?.length || 0}f
                  </span>
                  {/* Column counts */}
                  {(() => {
                    const validColumnKeys = columns.map(col => col.key).filter(key => key !== 'select' && key !== 'actions')
                    const visibilityMap = isActive && visibleColumns ? visibleColumns : (view.visibleColumns || {})
                    const visibleCount = validColumnKeys.filter(key => visibilityMap[key] !== false).length
                    const hiddenCount = validColumnKeys.filter(key => visibilityMap[key] === false).length
                    return (
                      <>
                        <span className="text-xs px-1 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded font-medium">
                          {visibleCount}c
                        </span>
                        {hiddenCount > 0 && (
                          <span className="text-xs px-1 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 rounded font-medium">
                            -{hiddenCount}
                          </span>
                        )}
                      </>
                    )
                  })()}
                </div>

                {/* Action buttons */}
                <div className="flex items-center gap-0.5 flex-shrink-0 ml-auto">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setCascadeFilters(view.filters.map(f => ({
                        id: Date.now() + Math.random(),
                        column: f.column,
                        value: f.value,
                        operator: f.operator || '=',
                        label: f.label,
                        groupId: f.groupId || 'default'
                      })))
                      if (view.filterGroups && setFilterGroups) {
                        setFilterGroups(view.filterGroups)
                      } else if (setFilterGroups) {
                        setFilterGroups([{ id: 'default', logic: 'AND' }])
                      }
                      if (view.interGroupLogic && setInterGroupLogic) {
                        setInterGroupLogic(view.interGroupLogic)
                      } else if (setInterGroupLogic) {
                        setInterGroupLogic('OR')
                      }
                      if (view.visibleColumns) {
                        setVisibleColumns(view.visibleColumns)
                      }
                      if (view.columnOrder) {
                        if (setVisibilityColumnOrder) setVisibilityColumnOrder(view.columnOrder)
                        if (setColumnOrder) setColumnOrder(view.columnOrder)
                      }
                      if (setSortColumns) {
                        setSortColumns(view.sortColumns || [])
                      }
                      if (setGroupByColumns) {
                        const groupCols = Array.isArray(view.groupByColumns) && view.groupByColumns.length > 0
                          ? view.groupByColumns
                          : (view.groupByColumn ? [view.groupByColumn] : [])
                        setGroupByColumns(groupCols)
                        if (setGroupByColumn) {
                          setGroupByColumn(groupCols[0] || null)
                        }
                      }
                      setActiveViewId(view.id)
                      setEditingViewId(view.id)
                    }}
                    className="p-1 text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                    title="Edit view"
                  >
                    <PencilIcon className="h-3 w-3" />
                  </button>
                  {view.name !== 'Default' && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDeleteView(view)
                      }}
                      className="p-1 text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                      title="Delete view"
                    >
                      <TrashIcon className="h-3 w-3" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Footer hint */}
      {savedFilters.length > 1 && (
        <div className="flex-shrink-0 bg-gray-50 dark:bg-gray-800/50 px-2 py-1 text-center border-t border-gray-200 dark:border-gray-700">
          <div className="text-xs text-gray-500 dark:text-gray-400">
            Top = default • Drag to reorder
          </div>
        </div>
      )}
    </div>
  )
}
