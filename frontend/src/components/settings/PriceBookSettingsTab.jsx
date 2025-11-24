import { useState, useEffect } from 'react'
import { Tab, TabGroup, TabList, TabPanel, TabPanels } from '@headlessui/react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  FolderIcon,
  TagIcon,
  PlusIcon,
  PencilIcon,
  TrashIcon,
  ArrowsUpDownIcon,
  CheckIcon,
  XMarkIcon
} from '@heroicons/react/24/outline'
import { api } from '../../api'

// Categories management component
function CategoriesTab() {
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [editingId, setEditingId] = useState(null)
  const [editForm, setEditForm] = useState({ name: '', display_name: '', color: '#6B7280', icon: '', is_active: true })
  const [newCategory, setNewCategory] = useState({ name: '', display_name: '', color: '#6B7280', icon: '' })
  const [showNewForm, setShowNewForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [reordering, setReordering] = useState(false)

  useEffect(() => {
    loadCategories()
  }, [])

  const loadCategories = async () => {
    try {
      setLoading(true)
      const response = await api.get('/api/v1/pricebook_categories?include_counts=true')
      // api.get returns JSON directly, not wrapped in response.data
      setCategories(response.categories || [])
      setError(null)
    } catch (err) {
      setError(err.message || 'Failed to load categories')
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = async () => {
    if (!newCategory.name.trim()) return

    try {
      setSaving(true)
      const response = await api.post('/api/v1/pricebook_categories', {
        pricebook_category: newCategory
      })
      setCategories([...categories, response.category])
      setNewCategory({ name: '', display_name: '', color: '#6B7280', icon: '' })
      setShowNewForm(false)
    } catch (err) {
      setError(err.message || 'Failed to create category')
    } finally {
      setSaving(false)
    }
  }

  const handleUpdate = async (id) => {
    try {
      setSaving(true)
      const response = await api.patch(`/api/v1/pricebook_categories/${id}`, {
        pricebook_category: editForm
      })
      setCategories(categories.map(c => c.id === id ? response.category : c))
      setEditingId(null)
    } catch (err) {
      setError(err.message || 'Failed to update category')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id, name, itemsCount) => {
    const confirmMsg = itemsCount > 0
      ? `Delete "${name}"? This category has ${itemsCount} items. They will have no category after deletion.`
      : `Delete "${name}"?`

    if (!confirm(confirmMsg)) return

    try {
      await api.delete(`/api/v1/pricebook_categories/${id}?force=true`)
      setCategories(categories.filter(c => c.id !== id))
    } catch (err) {
      setError(err.message || 'Failed to delete category')
    }
  }

  const handleToggleActive = async (category) => {
    try {
      const response = await api.patch(`/api/v1/pricebook_categories/${category.id}`, {
        pricebook_category: { is_active: !category.is_active }
      })
      setCategories(categories.map(c => c.id === category.id ? response.category : c))
    } catch (err) {
      setError(err.message || 'Failed to update category')
    }
  }

  const startEdit = (category) => {
    setEditingId(category.id)
    setEditForm({
      name: category.name,
      display_name: category.display_name || '',
      color: category.color || '#6B7280',
      icon: category.icon || '',
      is_active: category.is_active
    })
  }

  const moveCategory = async (index, direction) => {
    const newCategories = [...categories]
    const targetIndex = index + direction

    if (targetIndex < 0 || targetIndex >= newCategories.length) return

    // Swap positions
    [newCategories[index], newCategories[targetIndex]] = [newCategories[targetIndex], newCategories[index]]

    // Update positions
    const positions = {}
    newCategories.forEach((cat, i) => {
      positions[cat.id] = i + 1
    })

    setCategories(newCategories)
    setReordering(true)

    try {
      await api.post('/api/v1/pricebook_categories/reorder', { positions })
    } catch {
      setError('Failed to reorder categories')
      loadCategories() // Reload to restore original order
    } finally {
      setReordering(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500 dark:text-gray-400">Loading categories...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg p-4">
          <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
          <button
            onClick={() => setError(null)}
            className="mt-2 text-xs text-red-600 dark:text-red-400 hover:underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Header with Add button */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">Price Book Categories</h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Manage categories for organizing price book items. Categories can be renamed without affecting existing items.
          </p>
        </div>
        <button
          onClick={() => setShowNewForm(true)}
          className="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500"
        >
          <PlusIcon className="h-4 w-4" />
          Add Category
        </button>
      </div>

      {/* New category form */}
      {showNewForm && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-lg p-4">
          <div className="flex items-center gap-4">
            <input
              type="text"
              value={newCategory.name}
              onChange={(e) => setNewCategory({ ...newCategory, name: e.target.value })}
              placeholder="Category name (e.g., ELECTRICAL)"
              className="flex-1 rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm"
              autoFocus
            />
            <input
              type="text"
              value={newCategory.display_name}
              onChange={(e) => setNewCategory({ ...newCategory, display_name: e.target.value })}
              placeholder="Display name (optional)"
              className="flex-1 rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm"
            />
            <input
              type="color"
              value={newCategory.color}
              onChange={(e) => setNewCategory({ ...newCategory, color: e.target.value })}
              className="h-9 w-12 rounded border-gray-300 dark:border-gray-600 cursor-pointer"
              title="Category color"
            />
            <button
              onClick={handleCreate}
              disabled={saving || !newCategory.name.trim()}
              className="inline-flex items-center gap-1 rounded-md bg-green-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-green-500 disabled:opacity-50"
            >
              <CheckIcon className="h-4 w-4" />
              Save
            </button>
            <button
              onClick={() => {
                setShowNewForm(false)
                setNewCategory({ name: '', display_name: '', color: '#6B7280', icon: '' })
              }}
              className="inline-flex items-center gap-1 rounded-md bg-gray-100 dark:bg-gray-700 px-3 py-2 text-sm font-semibold text-gray-700 dark:text-gray-300 shadow-sm hover:bg-gray-200 dark:hover:bg-gray-600"
            >
              <XMarkIcon className="h-4 w-4" />
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Categories table */}
      <div className="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-800">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-12">
                Order
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Name
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Display Name
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-20">
                Color
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-24">
                Items
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-20">
                Active
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-32">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
            {categories.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                  No categories yet. Click "Add Category" to create one.
                </td>
              </tr>
            ) : (
              categories.map((category, index) => (
                <tr key={category.id} className={!category.is_active ? 'opacity-50' : ''}>
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-1">
                      <button
                        onClick={() => moveCategory(index, -1)}
                        disabled={index === 0 || reordering}
                        className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 disabled:opacity-30"
                        title="Move up"
                      >
                        <ArrowsUpDownIcon className="h-3 w-3 rotate-180" />
                      </button>
                      <button
                        onClick={() => moveCategory(index, 1)}
                        disabled={index === categories.length - 1 || reordering}
                        className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 disabled:opacity-30"
                        title="Move down"
                      >
                        <ArrowsUpDownIcon className="h-3 w-3" />
                      </button>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {editingId === category.id ? (
                      <input
                        type="text"
                        value={editForm.name}
                        onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                        className="w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm"
                      />
                    ) : (
                      <div className="flex items-center gap-2">
                        <FolderIcon className="h-4 w-4 text-gray-400" />
                        <span className="text-sm font-medium text-gray-900 dark:text-white">{category.name}</span>
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {editingId === category.id ? (
                      <input
                        type="text"
                        value={editForm.display_name}
                        onChange={(e) => setEditForm({ ...editForm, display_name: e.target.value })}
                        className="w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm"
                        placeholder="Same as name"
                      />
                    ) : (
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        {category.display_name || '-'}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {editingId === category.id ? (
                      <input
                        type="color"
                        value={editForm.color}
                        onChange={(e) => setEditForm({ ...editForm, color: e.target.value })}
                        className="h-8 w-10 rounded border-gray-300 dark:border-gray-600 cursor-pointer"
                      />
                    ) : (
                      <div
                        className="h-6 w-6 rounded"
                        style={{ backgroundColor: category.color || '#6B7280' }}
                        title={category.color}
                      />
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center rounded-full bg-gray-100 dark:bg-gray-700 px-2.5 py-0.5 text-xs font-medium text-gray-800 dark:text-gray-200">
                      {category.items_count || 0}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => handleToggleActive(category)}
                      className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${
                        category.is_active ? 'bg-indigo-600' : 'bg-gray-200 dark:bg-gray-600'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                          category.is_active ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {editingId === category.id ? (
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleUpdate(category.id)}
                          disabled={saving}
                          className="text-green-600 hover:text-green-700 dark:text-green-400 dark:hover:text-green-300"
                          title="Save"
                        >
                          <CheckIcon className="h-5 w-5" />
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                          title="Cancel"
                        >
                          <XMarkIcon className="h-5 w-5" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => startEdit(category)}
                          className="text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400"
                          title="Edit"
                        >
                          <PencilIcon className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(category.id, category.name, category.items_count)}
                          className="text-gray-400 hover:text-red-600 dark:hover:text-red-400"
                          title="Delete"
                        >
                          <TrashIcon className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Summary */}
      <div className="text-sm text-gray-500 dark:text-gray-400">
        {categories.length} categories • {categories.filter(c => c.is_active).length} active
      </div>
    </div>
  )
}

export default function PriceBookSettingsTab() {
  const location = useLocation()
  const navigate = useNavigate()

  // Map sub-tab names to indices
  const subTabs = ['categories']

  // Get initial sub-tab index from URL query parameter
  const getInitialSubTabIndex = () => {
    const params = new URLSearchParams(location.search)
    const subtab = params.get('pricebook_subtab')
    const index = subTabs.indexOf(subtab)
    return index >= 0 ? index : 0
  }

  const [selectedSubIndex, setSelectedSubIndex] = useState(getInitialSubTabIndex())

  // Update URL when sub-tab changes
  const handleSubTabChange = (index) => {
    setSelectedSubIndex(index)
    const params = new URLSearchParams(location.search)
    params.set('pricebook_subtab', subTabs[index])
    navigate(`${location.pathname}?${params.toString()}`, { replace: true })
  }

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6">
      <div>
        <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-2">Price Book Settings</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
          Manage lookup tables and settings for the Price Book system.
        </p>

        <TabGroup selectedIndex={selectedSubIndex} onChange={handleSubTabChange}>
          <TabList className="flex space-x-1 rounded-xl bg-indigo-900/20 p-1 mb-6 max-w-md">
            <Tab
              className={({ selected }) =>
                `w-full rounded-lg py-2.5 text-sm font-medium leading-5 transition-all whitespace-nowrap flex items-center justify-center gap-2
                ${
                  selected
                    ? 'bg-white dark:bg-gray-700 text-indigo-700 dark:text-indigo-400 shadow'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-white/[0.12] hover:text-gray-900 dark:hover:text-white'
                }`
              }
            >
              <TagIcon className="h-4 w-4" />
              Categories
            </Tab>
            {/* Future tabs can be added here:
            <Tab>Units of Measure</Tab>
            <Tab>Brands</Tab>
            */}
          </TabList>

          <TabPanels>
            <TabPanel>
              <CategoriesTab />
            </TabPanel>
          </TabPanels>
        </TabGroup>
      </div>
    </div>
  )
}
