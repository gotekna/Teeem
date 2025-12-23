import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { XMarkIcon, CheckIcon, FolderIcon } from '@heroicons/react/24/outline'
import { api } from '@/lib/api'

/**
 * DocumentationTabsModal
 *
 * Modal for assigning documentation tabs to a schedule template task.
 * Allows multi-select so a task can belong to multiple documentation categories.
 */

export default function DocumentationTabsModal({ isOpen, onClose, currentRow, constructionId, onSave }) {
  const [availableTabs, setAvailableTabs] = useState([])
  const [selectedTabIds, setSelectedTabIds] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (isOpen) {
      loadDocumentationTabs()
      // Initialize selected tabs from current row
      setSelectedTabIds(currentRow?.documentation_category_ids || [])
    }
  }, [isOpen, currentRow])

  const loadDocumentationTabs = async () => {
    setLoading(true)
    try {
      const response = await api.get('/api/v1/documentation_categories')
      setAvailableTabs(response.documentation_categories || [])
    } catch (error) {
      console.error('Failed to load documentation tabs:', error)
      setAvailableTabs([])
    } finally {
      setLoading(false)
    }
  }

  const toggleTab = (tabId) => {
    setSelectedTabIds(prev => {
      if (prev.includes(tabId)) {
        return prev.filter(id => id !== tabId)
      } else {
        return [...prev, tabId]
      }
    })
  }

  const toggleAll = () => {
    if (selectedTabIds.length === availableTabs.length) {
      setSelectedTabIds([])
    } else {
      setSelectedTabIds(availableTabs.map(tab => tab.id))
    }
  }

  const handleSave = () => {
    onSave(selectedTabIds)
    onClose()
  }

  if (!isOpen) return null

  return createPortal(
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50" style={{ zIndex: 99999 }}>
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col" style={{ zIndex: 100000 }}>
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Assign Documentation Tabs
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Task: {currentRow?.name}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-gray-500 dark:text-gray-400">Loading documentation tabs...</div>
            </div>
          ) : availableTabs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64">
              <FolderIcon className="h-16 w-16 text-gray-300 dark:text-gray-600 mb-4" />
              <p className="text-gray-500 dark:text-gray-400 text-center">
                No documentation tabs found for this job.
              </p>
              <p className="text-sm text-gray-400 dark:text-gray-500 mt-2 text-center">
                Create tabs in the job's Documentation settings first.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Select All */}
              <div className="flex items-center gap-3 pb-3 border-b border-gray-200 dark:border-gray-700">
                <input
                  type="checkbox"
                  id="select-all"
                  checked={selectedTabIds.length === availableTabs.length && availableTabs.length > 0}
                  onChange={toggleAll}
                  className="h-5 w-5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <label
                  htmlFor="select-all"
                  className="text-sm font-medium text-gray-700 dark:text-gray-300 cursor-pointer"
                >
                  Select All ({availableTabs.length} tabs)
                </label>
              </div>

              {/* Tab List */}
              {availableTabs.map(tab => {
                const isSelected = selectedTabIds.includes(tab.id)
                return (
                  <div
                    key={tab.id}
                    onClick={() => toggleTab(tab.id)}
                    className={`flex items-center gap-4 p-4 rounded-lg border-2 cursor-pointer transition-colors ${
                      isSelected
                        ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20'
                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => {}} // Handled by div onClick
                      className="h-5 w-5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        {tab.color && (
                          <div
                            className="w-4 h-4 rounded"
                            style={{ backgroundColor: tab.color }}
                          />
                        )}
                        <span className="font-medium text-gray-900 dark:text-white">
                          {tab.name}
                        </span>
                      </div>
                      {tab.description && (
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                          {tab.description}
                        </p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200 dark:border-gray-700">
          <div className="text-sm text-gray-600 dark:text-gray-400">
            {selectedTabIds.length} tab(s) selected
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-2 text-sm text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg flex items-center gap-2"
            >
              <CheckIcon className="h-4 w-4" />
              Save Selection
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}
