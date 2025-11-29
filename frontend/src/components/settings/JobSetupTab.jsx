import { useState, useEffect } from 'react'
import { api } from '../../api'
import {
  PlusIcon,
  TrashIcon,
  Bars3Icon,
  CheckIcon,
  XMarkIcon,
  PencilIcon
} from '@heroicons/react/24/outline'

// Reusable sortable list component
function SortableList({ items, onReorder, onUpdate, onDelete, onCreate, title, description, colorField = false, parentField = null, parentOptions = [], parentLabel = "Status", multiSelectParent = false }) {
  const [draggedIndex, setDraggedIndex] = useState(null)
  const [editingId, setEditingId] = useState(null)
  const [editValue, setEditValue] = useState('')
  const [editColor, setEditColor] = useState('')
  const [editParentId, setEditParentId] = useState('')
  const [editParentIds, setEditParentIds] = useState([]) // For multi-select
  const [newItemName, setNewItemName] = useState('')
  const [newItemColor, setNewItemColor] = useState('gray')
  const [newItemParentId, setNewItemParentId] = useState('')
  const [newItemParentIds, setNewItemParentIds] = useState([]) // For multi-select
  const [isAdding, setIsAdding] = useState(false)
  const [parentDropdownOpen, setParentDropdownOpen] = useState(null) // Track which dropdown is open
  const [parentSearch, setParentSearch] = useState('')
  // State for inline job type editing (when clicking badge in non-edit mode)
  const [inlineEditId, setInlineEditId] = useState(null)
  const [inlineEditIds, setInlineEditIds] = useState([])

  const colors = [
    { value: 'gray', label: 'Gray', bg: 'bg-gray-100', text: 'text-gray-800' },
    { value: 'yellow', label: 'Yellow', bg: 'bg-yellow-100', text: 'text-yellow-800' },
    { value: 'orange', label: 'Orange', bg: 'bg-orange-100', text: 'text-orange-800' },
    { value: 'blue', label: 'Blue', bg: 'bg-blue-100', text: 'text-blue-800' },
    { value: 'purple', label: 'Purple', bg: 'bg-purple-100', text: 'text-purple-800' },
    { value: 'indigo', label: 'Indigo', bg: 'bg-indigo-100', text: 'text-indigo-800' },
    { value: 'green', label: 'Green', bg: 'bg-green-100', text: 'text-green-800' },
    { value: 'teal', label: 'Teal', bg: 'bg-teal-100', text: 'text-teal-800' },
    { value: 'slate', label: 'Slate', bg: 'bg-slate-100', text: 'text-slate-800' },
    { value: 'red', label: 'Red', bg: 'bg-red-100', text: 'text-red-800' }
  ]

  const getColorClasses = (colorValue) => {
    const color = colors.find(c => c.value === colorValue) || colors[0]
    return `${color.bg} ${color.text}`
  }

  const handleDragStart = (e, index) => {
    setDraggedIndex(index)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e, index) => {
    e.preventDefault()
    if (draggedIndex === null || draggedIndex === index) return

    const newItems = [...items]
    const draggedItem = newItems[draggedIndex]
    newItems.splice(draggedIndex, 1)
    newItems.splice(index, 0, draggedItem)

    // Update positions
    const reorderedIds = newItems.map(item => item.id)
    onReorder(reorderedIds)
    setDraggedIndex(index)
  }

  const handleDragEnd = () => {
    setDraggedIndex(null)
  }

  const startEdit = (item) => {
    setEditingId(item.id)
    setEditValue(item.name)
    setEditColor(item.color || 'gray')
    setEditParentId(item[parentField] || '')
    // For multi-select, parse the job_type_ids array
    if (multiSelectParent && item.job_type_ids) {
      setEditParentIds(Array.isArray(item.job_type_ids) ? item.job_type_ids : [])
    } else {
      setEditParentIds([])
    }
    setParentSearch('')
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditValue('')
    setEditColor('')
    setEditParentId('')
    setEditParentIds([])
    setParentDropdownOpen(null)
    setParentSearch('')
  }

  const saveEdit = async () => {
    // Allow saving if we have a name OR if we're just updating job types in multi-select mode
    if (!editValue.trim() && !multiSelectParent) return
    if (!editingId) return

    await onUpdate(editingId, {
      name: editValue,
      ...(colorField ? { color: editColor } : {}),
      ...(parentField && !multiSelectParent ? { [parentField]: editParentId || null } : {}),
      ...(multiSelectParent ? { job_type_ids: editParentIds } : {})
    })
    setEditingId(null)
    setEditValue('')
    setEditColor('')
    setEditParentId('')
    setEditParentIds([])
    setParentDropdownOpen(null)
    setParentSearch('')
  }

  const handleCreate = async () => {
    if (!newItemName.trim()) return
    await onCreate({
      name: newItemName,
      ...(colorField ? { color: newItemColor } : {}),
      ...(parentField && !multiSelectParent ? { [parentField]: newItemParentId || null } : {}),
      ...(multiSelectParent ? { job_type_ids: newItemParentIds } : {})
    })
    setNewItemName('')
    setNewItemColor('gray')
    setNewItemParentId('')
    setNewItemParentIds([])
    setIsAdding(false)
    setParentSearch('')
  }

  // Multi-select helper functions
  const toggleParentId = (id, isNewItem = false) => {
    if (isNewItem) {
      setNewItemParentIds(prev =>
        prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
      )
    } else {
      setEditParentIds(prev =>
        prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
      )
    }
  }

  const selectAllParents = (isNewItem = false) => {
    const allIds = parentOptions.map(opt => opt.id)
    if (isNewItem) {
      setNewItemParentIds(allIds)
    } else {
      setEditParentIds(allIds)
    }
  }

  const clearAllParents = (isNewItem = false, isInline = false) => {
    if (isNewItem) {
      setNewItemParentIds([])
    } else if (isInline) {
      setInlineEditIds([])
    } else {
      setEditParentIds([])
    }
  }

  // Inline job type editing (from badge click in non-edit mode)
  const startInlineEdit = (item) => {
    setInlineEditId(item.id)
    setInlineEditIds(Array.isArray(item.job_type_ids) ? item.job_type_ids : [])
    setParentSearch('')
  }

  const toggleInlineId = (id) => {
    setInlineEditIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  const selectAllInline = () => {
    setInlineEditIds(parentOptions.map(opt => opt.id))
  }

  const clearAllInline = () => {
    setInlineEditIds([])
  }

  const saveInlineEdit = async () => {
    if (!inlineEditId) return
    await onUpdate(inlineEditId, { job_type_ids: inlineEditIds })
    setInlineEditId(null)
    setInlineEditIds([])
    setParentDropdownOpen(null)
    setParentSearch('')
  }

  const cancelInlineEdit = () => {
    setInlineEditId(null)
    setInlineEditIds([])
    setParentDropdownOpen(null)
    setParentSearch('')
  }

  const filteredParentOptions = parentOptions.filter(opt =>
    opt.name.toLowerCase().includes(parentSearch.toLowerCase())
  )

  // Multi-select dropdown component
  const MultiSelectDropdown = ({ selectedIds, onToggle, onSelectAll, onClearAll, isOpen, onToggleOpen, dropdownId, onSave }) => {
    const selectedCount = selectedIds.length
    const allSelected = selectedCount === parentOptions.length

    return (
      <div className="relative">
        <button
          type="button"
          onClick={() => onToggleOpen(isOpen ? null : dropdownId)}
          className="inline-flex items-center gap-2 rounded-md border-0 px-3 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm dark:bg-white/5 dark:text-white dark:ring-white/10 dark:hover:bg-white/10 min-w-[140px] justify-between"
        >
          <span className="truncate">
            {selectedCount === 0
              ? `Select ${parentLabel}...`
              : selectedCount === parentOptions.length
                ? `All ${parentLabel}s`
                : `${selectedCount} ${parentLabel}${selectedCount > 1 ? 's' : ''}`}
          </span>
          <svg className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {isOpen && (
          <div className="fixed z-50 w-72 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 flex flex-col" style={{ top: '120px', bottom: '40px', right: 'auto', left: 'auto', marginLeft: '-16px' }}>
            {/* Search */}
            <div className="p-2 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
              <input
                type="text"
                value={parentSearch}
                onChange={(e) => setParentSearch(e.target.value)}
                placeholder={`Search ${parentLabel}s...`}
                className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-1 focus:ring-indigo-500"
                onClick={(e) => e.stopPropagation()}
              />
            </div>

            {/* Select All / Clear All */}
            <div className="flex gap-2 p-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50 flex-shrink-0">
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onSelectAll(); }}
                className="flex-1 text-xs px-2 py-1 rounded bg-indigo-100 text-indigo-700 hover:bg-indigo-200 dark:bg-indigo-900/50 dark:text-indigo-300 dark:hover:bg-indigo-900"
              >
                Select All
              </button>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onClearAll(); }}
                className="flex-1 text-xs px-2 py-1 rounded bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-600 dark:text-gray-300 dark:hover:bg-gray-500"
              >
                Clear All
              </button>
            </div>

            {/* Options - scrollable area that expands */}
            <div className="flex-1 overflow-y-auto p-1 min-h-0">
              {filteredParentOptions.length === 0 ? (
                <div className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400 italic">
                  No matches found
                </div>
              ) : (
                filteredParentOptions.map(opt => (
                  <label
                    key={opt.id}
                    className="flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(opt.id)}
                      onChange={() => onToggle(opt.id)}
                      className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-700"
                    />
                    <span className="text-sm text-gray-900 dark:text-white">{opt.name}</span>
                  </label>
                ))
              )}
            </div>

            {/* Save button at bottom */}
            <div className="p-2 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50 flex-shrink-0">
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onSave(); }}
                className="w-full px-3 py-2 rounded-md bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-500 focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
              >
                Save
              </button>
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{title}</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">{description}</p>
        </div>
        <button
          onClick={() => setIsAdding(true)}
          className="inline-flex items-center gap-1 rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500"
        >
          <PlusIcon className="h-4 w-4" />
          Add
        </button>
      </div>

      {isAdding && (
        <div className="mb-4 p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg border border-indigo-200 dark:border-indigo-800">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={newItemName}
              onChange={(e) => setNewItemName(e.target.value)}
              placeholder="Enter name..."
              className="flex-1 rounded-md border-0 px-3 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm dark:bg-white/5 dark:text-white dark:ring-white/10"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreate()
                if (e.key === 'Escape') setIsAdding(false)
              }}
            />
            {colorField && (
              <select
                value={newItemColor}
                onChange={(e) => setNewItemColor(e.target.value)}
                className="rounded-md border-0 px-3 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm dark:bg-white/5 dark:text-white dark:ring-white/10"
              >
                {colors.map(color => (
                  <option key={color.value} value={color.value}>{color.label}</option>
                ))}
              </select>
            )}
            {parentField && parentOptions.length > 0 && !multiSelectParent && (
              <select
                value={newItemParentId}
                onChange={(e) => setNewItemParentId(e.target.value)}
                className="rounded-md border-0 px-3 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm dark:bg-white/5 dark:text-white dark:ring-white/10"
              >
                <option value="">Select {parentLabel}...</option>
                {parentOptions.map(opt => (
                  <option key={opt.id} value={opt.id}>{opt.name}</option>
                ))}
              </select>
            )}
            {multiSelectParent && parentOptions.length > 0 && (
              <MultiSelectDropdown
                selectedIds={newItemParentIds}
                onToggle={(id) => toggleParentId(id, true)}
                onSelectAll={() => selectAllParents(true)}
                onClearAll={() => clearAllParents(true)}
                isOpen={parentDropdownOpen === 'new'}
                onToggleOpen={setParentDropdownOpen}
                dropdownId="new"
                onSave={handleCreate}
              />
            )}
            <button
              onClick={handleCreate}
              className="p-1.5 text-green-600 hover:text-green-700"
            >
              <CheckIcon className="h-5 w-5" />
            </button>
            <button
              onClick={() => setIsAdding(false)}
              className="p-1.5 text-gray-400 hover:text-gray-500"
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>
        </div>
      )}

      <ul className="space-y-2">
        {items.map((item, index) => (
          <li
            key={item.id}
            draggable={editingId !== item.id}
            onDragStart={(e) => handleDragStart(e, index)}
            onDragOver={(e) => handleDragOver(e, index)}
            onDragEnd={handleDragEnd}
            className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
              draggedIndex === index
                ? 'bg-indigo-50 border-indigo-300 dark:bg-indigo-900/20 dark:border-indigo-700'
                : 'bg-gray-50 border-gray-200 dark:bg-gray-700/50 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
          >
            <div className="cursor-grab text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
              <Bars3Icon className="h-5 w-5" />
            </div>

            <span className="w-6 text-center text-sm text-gray-400">{index + 1}</span>

            {editingId === item.id ? (
              <>
                <input
                  type="text"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  className="flex-1 rounded-md border-0 px-3 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm dark:bg-white/5 dark:text-white dark:ring-white/10"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') saveEdit()
                    if (e.key === 'Escape') cancelEdit()
                  }}
                />
                {colorField && (
                  <select
                    value={editColor}
                    onChange={(e) => setEditColor(e.target.value)}
                    className="rounded-md border-0 px-3 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm dark:bg-white/5 dark:text-white dark:ring-white/10"
                  >
                    {colors.map(color => (
                      <option key={color.value} value={color.value}>{color.label}</option>
                    ))}
                  </select>
                )}
                {parentField && parentOptions.length > 0 && !multiSelectParent && (
                  <select
                    value={editParentId}
                    onChange={(e) => setEditParentId(e.target.value)}
                    className="rounded-md border-0 px-3 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm dark:bg-white/5 dark:text-white dark:ring-white/10"
                  >
                    <option value="">No {parentLabel}</option>
                    {parentOptions.map(opt => (
                      <option key={opt.id} value={opt.id}>{opt.name}</option>
                    ))}
                  </select>
                )}
                {multiSelectParent && parentOptions.length > 0 && (
                  <MultiSelectDropdown
                    selectedIds={editParentIds}
                    onToggle={(id) => toggleParentId(id, false)}
                    onSelectAll={() => selectAllParents(false)}
                    onClearAll={() => clearAllParents(false)}
                    isOpen={parentDropdownOpen === `edit-${item.id}`}
                    onToggleOpen={setParentDropdownOpen}
                    dropdownId={`edit-${item.id}`}
                    onSave={saveEdit}
                  />
                )}
                <button onClick={saveEdit} className="p-1.5 text-green-600 hover:text-green-700">
                  <CheckIcon className="h-5 w-5" />
                </button>
                <button onClick={cancelEdit} className="p-1.5 text-gray-400 hover:text-gray-500">
                  <XMarkIcon className="h-5 w-5" />
                </button>
              </>
            ) : (
              <>
                <span className="flex-1 text-gray-900 dark:text-white font-medium">{item.name}</span>
                {parentField && parentOptions.length > 0 && !multiSelectParent && (
                  <span className="px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                    {parentOptions.find(p => p.id === item[parentField])?.name || `No ${parentLabel}`}
                  </span>
                )}
                {multiSelectParent && parentOptions.length > 0 && (
                  <span className="px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                    {item.job_type_ids && item.job_type_ids.length > 0
                      ? item.job_type_ids.length === parentOptions.length
                        ? `All ${parentLabel}s`
                        : `${item.job_type_ids.length} ${parentLabel}${item.job_type_ids.length > 1 ? 's' : ''}`
                      : `No ${parentLabel}`}
                  </span>
                )}
                {colorField && item.color && (
                  <span className={`px-2 py-1 rounded text-xs font-medium ${getColorClasses(item.color)}`}>
                    {item.color}
                  </span>
                )}
                {item.jobs_count > 0 && (
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {item.jobs_count} job{item.jobs_count !== 1 ? 's' : ''}
                  </span>
                )}
                <button
                  onClick={() => startEdit(item)}
                  className="p-1.5 text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400"
                >
                  <PencilIcon className="h-4 w-4" />
                </button>
                <button
                  onClick={() => onDelete(item.id)}
                  disabled={item.jobs_count > 0}
                  className="p-1.5 text-gray-400 hover:text-red-600 dark:hover:text-red-400 disabled:opacity-30 disabled:cursor-not-allowed"
                  title={item.jobs_count > 0 ? 'Cannot delete - in use by jobs' : 'Delete'}
                >
                  <TrashIcon className="h-4 w-4" />
                </button>
              </>
            )}
          </li>
        ))}
      </ul>

      {items.length === 0 && (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
          No items yet. Click "Add" to create one.
        </div>
      )}
    </div>
  )
}

// Cascade Sort Configuration Component
function CascadeSortConfig({ config, onUpdate }) {
  const [draggedIndex, setDraggedIndex] = useState(null)
  const [items, setItems] = useState(config || [
    { key: 'job_type', label: 'Job Type', enabled: true },
    { key: 'job_status', label: 'Job Status', enabled: true },
    { key: 'job_stage', label: 'Job Stage', enabled: false }
  ])

  useEffect(() => {
    if (config) setItems(config)
  }, [config])

  const handleDragStart = (e, index) => {
    setDraggedIndex(index)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e, index) => {
    e.preventDefault()
    if (draggedIndex === null || draggedIndex === index) return

    const newItems = [...items]
    const draggedItem = newItems[draggedIndex]
    newItems.splice(draggedIndex, 1)
    newItems.splice(index, 0, draggedItem)

    setItems(newItems)
    setDraggedIndex(index)
  }

  const handleDragEnd = () => {
    setDraggedIndex(null)
    onUpdate(items)
  }

  const toggleEnabled = (key) => {
    const newItems = items.map(item =>
      item.key === key ? { ...item, enabled: !item.enabled } : item
    )
    setItems(newItems)
    onUpdate(newItems)
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Cascade Sort Order</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Select which fields to group jobs by and drag to set the order. The first enabled field is the primary grouping.
        </p>
      </div>

      <div className="flex gap-4">
        {items.map((item, index) => (
          <div
            key={item.key}
            draggable
            onDragStart={(e) => handleDragStart(e, index)}
            onDragOver={(e) => handleDragOver(e, index)}
            onDragEnd={handleDragEnd}
            className={`flex items-center gap-3 px-4 py-3 rounded-lg border-2 cursor-grab transition-all ${
              draggedIndex === index
                ? 'bg-indigo-50 border-indigo-400 dark:bg-indigo-900/30 dark:border-indigo-500 scale-105'
                : item.enabled
                  ? 'bg-indigo-50 border-indigo-300 dark:bg-indigo-900/20 dark:border-indigo-600'
                  : 'bg-gray-50 border-gray-200 dark:bg-gray-700/50 dark:border-gray-600'
            }`}
          >
            <div className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
              <Bars3Icon className="h-5 w-5" />
            </div>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={item.enabled}
                onChange={() => toggleEnabled(item.key)}
                className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-600 dark:border-gray-600 dark:bg-gray-700"
              />
              <span className={`font-medium ${
                item.enabled
                  ? 'text-gray-900 dark:text-white'
                  : 'text-gray-400 dark:text-gray-500'
              }`}>
                {item.label}
              </span>
            </label>

            <span className={`text-xs px-2 py-0.5 rounded-full ${
              item.enabled && index === items.findIndex(i => i.enabled)
                ? 'bg-indigo-600 text-white'
                : item.enabled
                  ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300'
                  : 'bg-gray-100 text-gray-500 dark:bg-gray-600 dark:text-gray-400'
            }`}>
              {(() => {
                if (!item.enabled) return 'Off'
                const enabledItems = items.filter(i => i.enabled)
                const position = enabledItems.findIndex(i => i.key === item.key)
                return position === 0 ? '1st' : position === 1 ? '2nd' : '3rd'
              })()}
            </span>
          </div>
        ))}
      </div>

      <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
        {(() => {
          const enabled = items.filter(i => i.enabled)
          if (enabled.length === 0) return 'No cascade sorting - jobs will show in default order'
          if (enabled.length === 1) return `Jobs grouped by ${enabled[0]?.label}`
          if (enabled.length === 2) return `Jobs grouped by ${enabled[0]?.label}, then by ${enabled[1]?.label}`
          return `Jobs grouped by ${enabled[0]?.label}, then by ${enabled[1]?.label}, then by ${enabled[2]?.label}`
        })()}
      </p>
    </div>
  )
}

export default function JobSetupTab() {
  const [jobTypes, setJobTypes] = useState([])
  const [jobStatuses, setJobStatuses] = useState([])
  const [jobStages, setJobStages] = useState([])
  const [jobTypeStatuses, setJobTypeStatuses] = useState([])
  const [jobStatusStages, setJobStatusStages] = useState([])
  const [cascadeConfig, setCascadeConfig] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showJunctionTables, setShowJunctionTables] = useState(false)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      const [typesRes, statusesRes, stagesRes, typeStatusesRes, statusStagesRes] = await Promise.all([
        api.get('/api/v1/job_types'),
        api.get('/api/v1/job_status'),
        api.get('/api/v1/job_stages'),
        api.get('/api/v1/records?foundation_id=385').catch(() => ({ records: [] })),
        api.get('/api/v1/records?foundation_id=384').catch(() => ({ records: [] }))
      ])
      setJobTypes(typesRes.job_types || [])
      setJobStatuses(statusesRes.job_statuses || [])
      setJobStages(stagesRes.job_stages || [])
      setJobTypeStatuses(typeStatusesRes.records || [])
      setJobStatusStages(statusStagesRes.records || [])

      // Load cascade config from company settings or use default
      try {
        const settingsRes = await api.get('/api/v1/company_settings')
        if (settingsRes.company_settings?.job_cascade_sort) {
          setCascadeConfig(settingsRes.company_settings.job_cascade_sort)
        } else {
          // Default config
          setCascadeConfig([
            { key: 'job_type', label: 'Job Type', enabled: true },
            { key: 'job_status', label: 'Job Status', enabled: true },
            { key: 'job_stage', label: 'Job Stage', enabled: false }
          ])
        }
      } catch {
        // Default if settings not available
        setCascadeConfig([
          { key: 'job_type', label: 'Job Type', enabled: true },
          { key: 'job_status', label: 'Job Status', enabled: true },
          { key: 'job_stage', label: 'Job Stage', enabled: false }
        ])
      }
    } catch (err) {
      console.error('Failed to load job setup data:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleCascadeConfigUpdate = async (newConfig) => {
    setCascadeConfig(newConfig)
    try {
      await api.patch('/api/v1/company_settings', {
        company_setting: { job_cascade_sort: newConfig }
      })
    } catch (err) {
      console.error('Failed to save cascade config:', err)
    }
  }

  // Job Types handlers
  const handleReorderTypes = async (ids) => {
    // Optimistic update
    const reordered = ids.map(id => jobTypes.find(t => t.id === id))
    setJobTypes(reordered)

    try {
      const res = await api.post('/api/v1/job_types/reorder', { job_type_ids: ids })
      setJobTypes(res.job_types || reordered)
    } catch (err) {
      console.error('Failed to reorder job types:', err)
      loadData() // Reload on error
    }
  }

  const handleUpdateType = async (id, data) => {
    try {
      const res = await api.patch(`/api/v1/job_types/${id}`, { job_type: data })
      setJobTypes(prev => prev.map(t => t.id === id ? res.job_type : t))
    } catch (err) {
      console.error('Failed to update job type:', err)
      alert(err.message || 'Failed to update')
    }
  }

  const handleDeleteType = async (id) => {
    if (!confirm('Are you sure you want to delete this job type?')) return
    try {
      await api.delete(`/api/v1/job_types/${id}`)
      setJobTypes(prev => prev.filter(t => t.id !== id))
    } catch (err) {
      console.error('Failed to delete job type:', err)
      alert(err.message || 'Failed to delete')
    }
  }

  const handleCreateType = async (data) => {
    try {
      const res = await api.post('/api/v1/job_types', { job_type: data })
      setJobTypes(prev => [...prev, res.job_type])
    } catch (err) {
      console.error('Failed to create job type:', err)
      alert(err.message || 'Failed to create')
    }
  }

  // Job Statuses handlers
  const handleReorderStatuses = async (ids) => {
    // Optimistic update
    const reordered = ids.map(id => jobStatuses.find(s => s.id === id))
    setJobStatuses(reordered)

    try {
      const res = await api.post('/api/v1/job_status/reorder', { job_status_ids: ids })
      setJobStatuses(res.job_statuses || reordered)
    } catch (err) {
      console.error('Failed to reorder job statuses:', err)
      loadData() // Reload on error
    }
  }

  const handleUpdateStatus = async (id, data) => {
    try {
      const res = await api.patch(`/api/v1/job_status/${id}`, { job_status: data })
      setJobStatuses(prev => prev.map(s => s.id === id ? res.job_status : s))
    } catch (err) {
      console.error('Failed to update job status:', err)
      alert(err.message || 'Failed to update')
    }
  }

  const handleDeleteStatus = async (id) => {
    if (!confirm('Are you sure you want to delete this job status?')) return
    try {
      await api.delete(`/api/v1/job_status/${id}`)
      setJobStatuses(prev => prev.filter(s => s.id !== id))
    } catch (err) {
      console.error('Failed to delete job status:', err)
      alert(err.message || 'Failed to delete')
    }
  }

  const handleCreateStatus = async (data) => {
    try {
      const res = await api.post('/api/v1/job_status', { job_status: data })
      setJobStatuses(prev => [...prev, res.job_status])
    } catch (err) {
      console.error('Failed to create job status:', err)
      alert(err.message || 'Failed to create')
    }
  }

  // Job Stages handlers
  const handleReorderStages = async (ids) => {
    // Optimistic update
    const reordered = ids.map(id => jobStages.find(s => s.id === id))
    setJobStages(reordered)

    try {
      const res = await api.post('/api/v1/job_stages/reorder', { job_stage_ids: ids })
      setJobStages(res.job_stages || reordered)
    } catch (err) {
      console.error('Failed to reorder job stages:', err)
      loadData() // Reload on error
    }
  }

  const handleUpdateStage = async (id, data) => {
    try {
      const res = await api.patch(`/api/v1/job_stages/${id}`, { job_stage: data })
      setJobStages(prev => prev.map(s => s.id === id ? res.job_stage : s))
    } catch (err) {
      console.error('Failed to update job stage:', err)
      alert(err.message || 'Failed to update')
    }
  }

  const handleDeleteStage = async (id) => {
    if (!confirm('Are you sure you want to delete this job stage?')) return
    try {
      await api.delete(`/api/v1/job_stages/${id}`)
      setJobStages(prev => prev.filter(s => s.id !== id))
    } catch (err) {
      console.error('Failed to delete job stage:', err)
      alert(err.message || 'Failed to delete')
    }
  }

  const handleCreateStage = async (data) => {
    try {
      const res = await api.post('/api/v1/job_stages', { job_stage: data })
      setJobStages(prev => [...prev, res.job_stage])
    } catch (err) {
      console.error('Failed to create job stage:', err)
      alert(err.message || 'Failed to create')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500 dark:text-gray-400">Loading...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-md bg-red-50 dark:bg-red-900/10 p-4">
        <p className="text-sm text-red-800 dark:text-red-400">{error}</p>
        <button onClick={loadData} className="mt-2 text-sm text-indigo-600 hover:text-indigo-500">
          Try again
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Job Setup</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Configure job types and statuses. Drag items to reorder them.
        </p>
      </div>

      {/* Cascade Sort Configuration */}
      <CascadeSortConfig
        config={cascadeConfig}
        onUpdate={handleCascadeConfigUpdate}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <SortableList
          items={jobTypes}
          onReorder={handleReorderTypes}
          onUpdate={handleUpdateType}
          onDelete={handleDeleteType}
          onCreate={handleCreateType}
          title="Job Types"
          description="Types of construction projects (House, Duplex, etc.)"
        />

        <SortableList
          items={jobStatuses}
          onReorder={handleReorderStatuses}
          onUpdate={handleUpdateStatus}
          onDelete={handleDeleteStatus}
          onCreate={handleCreateStatus}
          title="Job Statuses"
          description="Workflow stages for jobs (Enquiry to Archived)"
          colorField={true}
          parentField="job_type_id"
          parentOptions={jobTypes}
          parentLabel="Type"
          multiSelectParent={true}
        />

        <SortableList
          items={jobStages}
          onReorder={handleReorderStages}
          onUpdate={handleUpdateStage}
          onDelete={handleDeleteStage}
          onCreate={handleCreateStage}
          title="Job Stages"
          description="Sub-steps within statuses (Deposit, Slab, Frame, etc.)"
          colorField={true}
          parentField="job_status_id"
          parentOptions={jobStatuses}
          parentLabel="Status"
        />
      </div>

      {/* Junction Tables Section */}
      <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
        <button
          onClick={() => setShowJunctionTables(!showJunctionTables)}
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
        >
          <span className={`transform transition-transform ${showJunctionTables ? 'rotate-90' : ''}`}>▶</span>
          Junction Tables (Advanced)
          <span className="text-xs bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded">
            {jobTypeStatuses.length + jobStatusStages.length} records
          </span>
        </button>

        {showJunctionTables && (
          <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Job Type Status (Table 385) */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="font-medium text-gray-900 dark:text-white">Job Type Status</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Table 385 - Links Job Types to Statuses (many-to-many)</p>
                </div>
                <span className="text-xs bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 px-2 py-1 rounded">
                  {jobTypeStatuses.length} records
                </span>
              </div>
              {jobTypeStatuses.length === 0 ? (
                <p className="text-sm text-gray-400 italic">No records - using direct job_type_id on Job Status instead</p>
              ) : (
                <div className="max-h-48 overflow-y-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-50 dark:bg-gray-700">
                      <tr>
                        <th className="px-2 py-1 text-left text-xs font-medium text-gray-500 dark:text-gray-400">ID</th>
                        <th className="px-2 py-1 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Job Type</th>
                        <th className="px-2 py-1 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Job Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-600">
                      {jobTypeStatuses.map(record => (
                        <tr key={record.id}>
                          <td className="px-2 py-1 text-gray-500">{record.id}</td>
                          <td className="px-2 py-1 text-gray-900 dark:text-white">{record.job_type_id || record.data?.job_type_id || '-'}</td>
                          <td className="px-2 py-1 text-gray-900 dark:text-white">{record.job_status_id || record.data?.job_status_id || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Job Status Stage (Table 384) */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="font-medium text-gray-900 dark:text-white">Job Status Stage</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Table 384 - Links Statuses to Stages (many-to-many)</p>
                </div>
                <span className="text-xs bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 px-2 py-1 rounded">
                  {jobStatusStages.length} records
                </span>
              </div>
              {jobStatusStages.length === 0 ? (
                <p className="text-sm text-gray-400 italic">No records - using direct job_status_id on Job Stage instead</p>
              ) : (
                <div className="max-h-48 overflow-y-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-50 dark:bg-gray-700">
                      <tr>
                        <th className="px-2 py-1 text-left text-xs font-medium text-gray-500 dark:text-gray-400">ID</th>
                        <th className="px-2 py-1 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Job Status</th>
                        <th className="px-2 py-1 text-left text-xs font-medium text-gray-500 dark:text-gray-400">Job Stage</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-600">
                      {jobStatusStages.map(record => (
                        <tr key={record.id}>
                          <td className="px-2 py-1 text-gray-500">{record.id}</td>
                          <td className="px-2 py-1 text-gray-900 dark:text-white">{record.job_status_id || record.data?.job_status_id || '-'}</td>
                          <td className="px-2 py-1 text-gray-900 dark:text-white">{record.job_stage_id || record.data?.job_stage_id || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {showJunctionTables && (
          <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
            <p className="text-sm text-yellow-800 dark:text-yellow-200">
              <strong>Note:</strong> These junction tables are for many-to-many relationships.
              Currently we're using direct links (job_type_id on Status, job_status_id on Stage)
              which is simpler. These tables can be deleted if not needed.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
