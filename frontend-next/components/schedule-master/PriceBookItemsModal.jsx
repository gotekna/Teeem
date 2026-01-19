import { useState, useEffect, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import { XMarkIcon, PlusIcon, TrashIcon, CheckIcon } from '@heroicons/react/24/outline'
import { api } from '@/lib/api'
import { useToast } from '@/components/ui/use-toast'
import { formatCurrency } from '../../utils/formatters'

/**
 * PriceBookItemsModal
 *
 * Modal for selecting price book items to associate with a schedule template row.
 * These items will be automatically included in purchase orders generated for this task.
 *
 * Features:
 * - Add/remove line items like PO form
 * - Autocomplete search by item code or description
 * - Filter by supplier (if task has a supplier assigned)
 * - Shows item details: code, name, price, supplier
 */

export default function PriceBookItemsModal({ isOpen, onClose, currentRow, onSave }) {
  const { toast } = useToast()
  const [lineItems, setLineItems] = useState([])
  const [itemSearchResults, setItemSearchResults] = useState({})
  const [showSearchDropdown, setShowSearchDropdown] = useState({})
  const [showDescriptionDropdown, setShowDescriptionDropdown] = useState({})
  const [dropdownPosition, setDropdownPosition] = useState({})
  const [allSupplierItems, setAllSupplierItems] = useState([])
  const [loading, setLoading] = useState(false)
  const inputRefs = useRef({})
  const dropdownRefs = useRef({})

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      const isClickOnInput = Object.values(inputRefs.current).some(ref => ref && ref.contains(event.target))
      const isClickOnDropdown = Object.values(dropdownRefs.current).some(ref => ref && ref.contains(event.target))

      if (!isClickOnInput && !isClickOnDropdown) {
        setShowSearchDropdown({})
        setShowDescriptionDropdown({})
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const loadSupplierItems = useCallback(async () => {
    if (!currentRow?.supplier_id) {
      // If no supplier, load all items
      setLoading(true)
      try {
        const response = await api.get('/api/v1/pricebook', {
          params: {
            sort_by: 'item_code',
            sort_direction: 'asc',
            limit: 1000
          }
        })
        setAllSupplierItems(response.items || [])
      } catch (error) {
        console.error('Failed to load price book items:', error)
        setAllSupplierItems([])
      } finally {
        setLoading(false)
      }
      return
    }

    // Load all items for the supplier
    setLoading(true)
    try {
      const response = await api.get('/api/v1/pricebook', {
        params: {
          supplier_id: currentRow.supplier_id,
          sort_by: 'item_code',
          sort_direction: 'asc',
          limit: 0 // Unlimited for supplier
        }
      })
      setAllSupplierItems(response.items || [])
    } catch (error) {
      console.error('Failed to load supplier items:', error)
      setAllSupplierItems([])
    } finally {
      setLoading(false)
    }
  }, [currentRow?.supplier_id])

  // Load existing price book items when modal opens
  const loadExistingItems = useCallback(async () => {
    if (!currentRow?.price_book_item_ids || currentRow.price_book_item_ids.length === 0) {
      // No existing items, start with one empty line
      setLineItems([{ item_code: '', description: '', quantity: 1, unit_price: 0 }])
      return
    }

    // Fetch full item data for the IDs we have
    try {
      const itemPromises = currentRow.price_book_item_ids.map(async (itemData) => {
        // If itemData is an object with id, quantity, etc., use it directly
        if (typeof itemData === 'object' && itemData.id) {
          return {
            pricebook_item_id: itemData.id,
            item_code: itemData.item_code,
            description: itemData.item_name,
            quantity: itemData.quantity || 1,
            unit_price: itemData.price || 0
          }
        }

        // Otherwise, itemData is just an ID, fetch the full item
        const itemId = itemData
        const response = await api.get(`/api/v1/pricebook/${itemId}`)
        return {
          pricebook_item_id: response.id,
          item_code: response.item_code,
          description: response.item_name,
          quantity: 1,
          unit_price: response.current_price || 0
        }
      })

      const items = await Promise.all(itemPromises)
      setLineItems(items)
    } catch (error) {
      console.error('Failed to load existing items:', error)
      // Start with empty line on error
      setLineItems([{ item_code: '', description: '', quantity: 1, unit_price: 0 }])
    }
  }, [currentRow?.price_book_item_ids])

  useEffect(() => {
    if (isOpen) {
      // Load existing items
      loadExistingItems()
      // Load supplier items for autocomplete
      loadSupplierItems()
    }
  }, [isOpen, loadExistingItems, loadSupplierItems])

  const searchPricebookItems = (searchTerm, index) => {
    if (!searchTerm) {
      setItemSearchResults(prev => ({ ...prev, [index]: allSupplierItems }))
      return
    }

    const searchLower = searchTerm.toLowerCase()
    const filtered = allSupplierItems.filter(item =>
      item.item_code?.toLowerCase().includes(searchLower) ||
      item.item_name?.toLowerCase().includes(searchLower)
    )
    setItemSearchResults(prev => ({ ...prev, [index]: filtered }))
  }

  const handleItemCodeChange = (index, value) => {
    const newLineItems = [...lineItems]
    newLineItems[index].item_code = value
    setLineItems(newLineItems)

    const inputEl = inputRefs.current[`code-${index}`]
    if (inputEl && !dropdownPosition[`code-${index}`]) {
      const rect = inputEl.getBoundingClientRect()
      setDropdownPosition(prev => ({
        ...prev,
        [`code-${index}`]: {
          top: rect.bottom + window.scrollY,
          left: rect.left + window.scrollX,
          width: rect.width
        }
      }))
    }

    if (value.length >= 2) {
      searchPricebookItems(value, index)
      setShowSearchDropdown(prev => ({ ...prev, [index]: true }))
    } else if (value.length === 0) {
      setItemSearchResults(prev => ({ ...prev, [index]: allSupplierItems }))
      setShowSearchDropdown(prev => ({ ...prev, [index]: true }))
    } else {
      setShowSearchDropdown(prev => ({ ...prev, [index]: false }))
    }
  }

  const handleItemCodeFocus = (index) => {
    setShowDescriptionDropdown(prev => ({ ...prev, [index]: false }))

    const inputEl = inputRefs.current[`code-${index}`]
    if (inputEl) {
      const rect = inputEl.getBoundingClientRect()
      setDropdownPosition(prev => ({
        ...prev,
        [`code-${index}`]: {
          top: rect.bottom + window.scrollY,
          left: rect.left + window.scrollX,
          width: rect.width
        }
      }))
    }

    setItemSearchResults(prev => ({ ...prev, [index]: allSupplierItems }))
    setShowSearchDropdown(prev => ({ ...prev, [index]: true }))
  }

  const handleDescriptionChange = (index, value) => {
    const newLineItems = [...lineItems]
    newLineItems[index].description = value
    setLineItems(newLineItems)

    setShowSearchDropdown(prev => ({ ...prev, [index]: false }))

    const inputEl = inputRefs.current[`desc-${index}`]
    if (inputEl && !dropdownPosition[`desc-${index}`]) {
      const rect = inputEl.getBoundingClientRect()
      setDropdownPosition(prev => ({
        ...prev,
        [`desc-${index}`]: {
          top: rect.bottom + window.scrollY,
          left: rect.left + window.scrollX,
          width: rect.width
        }
      }))
    }

    if (value.length >= 2) {
      searchPricebookItems(value, index)
      setShowDescriptionDropdown(prev => ({ ...prev, [index]: true }))
    } else if (value.length === 0) {
      setItemSearchResults(prev => ({ ...prev, [index]: allSupplierItems }))
      setShowDescriptionDropdown(prev => ({ ...prev, [index]: true }))
    } else {
      setShowDescriptionDropdown(prev => ({ ...prev, [index]: false }))
    }
  }

  const handleDescriptionFocus = (index) => {
    setShowSearchDropdown(prev => ({ ...prev, [index]: false }))

    const inputEl = inputRefs.current[`desc-${index}`]
    if (inputEl) {
      const rect = inputEl.getBoundingClientRect()
      setDropdownPosition(prev => ({
        ...prev,
        [`desc-${index}`]: {
          top: rect.bottom + window.scrollY,
          left: rect.left + window.scrollX,
          width: rect.width
        }
      }))
    }

    setItemSearchResults(prev => ({ ...prev, [index]: allSupplierItems }))
    setShowDescriptionDropdown(prev => ({ ...prev, [index]: true }))
  }

  const handleSelectItem = (index, item) => {
    const newLineItems = [...lineItems]
    newLineItems[index] = {
      ...newLineItems[index],
      pricebook_item_id: item.id,
      item_code: item.item_code,
      description: item.item_name,
      unit_price: item.current_price || 0
    }
    setLineItems(newLineItems)
    setShowSearchDropdown(prev => ({ ...prev, [index]: false }))
    setShowDescriptionDropdown(prev => ({ ...prev, [index]: false }))
  }

  const handleLineItemChange = (index, field, value) => {
    const newLineItems = [...lineItems]
    newLineItems[index][field] = value
    setLineItems(newLineItems)
  }

  const addLineItem = () => {
    setLineItems([...lineItems, { item_code: '', description: '', quantity: 1, unit_price: 0 }])
  }

  const removeLineItem = (index) => {
    const newLineItems = [...lineItems]
    newLineItems.splice(index, 1)
    setLineItems(newLineItems)
  }

  const calculateTotal = () => {
    return lineItems.reduce((sum, item) => {
      return sum + (parseFloat(item.quantity) || 0) * (parseFloat(item.unit_price) || 0)
    }, 0)
  }

  const handleSave = () => {
    // Filter out empty items and convert to expected format
    const validItems = lineItems.filter(item => item.description && item.pricebook_item_id)

    if (validItems.length === 0) {
      toast({ title: "Validation Error", description: "Please add at least one item", variant: "destructive" })
      return
    }

    const items = validItems.map(item => ({
      id: item.pricebook_item_id,
      quantity: item.quantity,
      item_code: item.item_code,
      item_name: item.description,
      price: item.unit_price
    }))

    onSave(items)
    onClose()
  }

  if (!isOpen) return null

  const supplierName = currentRow?.supplier_name || 'No supplier'

  return createPortal(
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50" style={{ zIndex: 99999 }}>
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col" style={{ zIndex: 100000 }}>
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Select Price Book Items
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Task: {currentRow?.name} | Supplier: {supplierName}
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
              <div className="text-gray-500 dark:text-gray-400">Loading price book items...</div>
            </div>
          ) : (
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Line Items</h3>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Click on item code field to see all items, or type to search
                </p>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-900">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-32">
                        Item Code
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Description
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-24">
                        Quantity
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-32">
                        Unit Price
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-32">
                        Total
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-20">
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                    {lineItems.map((item, index) => (
                      <tr key={index}>
                        <td className="px-4 py-3">
                          <div className="relative">
                            <input
                              ref={el => inputRefs.current[`code-${index}`] = el}
                              type="text"
                              value={item.item_code}
                              onChange={(e) => handleItemCodeChange(index, e.target.value)}
                              onFocus={() => handleItemCodeFocus(index)}
                              placeholder="Type code..."
                              className="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                            {showSearchDropdown[index] && dropdownPosition[`code-${index}`] && createPortal(
                              <div
                                ref={el => dropdownRefs.current[`code-${index}`] = el}
                                className="fixed z-[99999] bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-xl max-h-96 overflow-y-auto"
                                style={{
                                  top: `${dropdownPosition[`code-${index}`].top}px`,
                                  left: `${dropdownPosition[`code-${index}`].left}px`,
                                  minWidth: '16rem'
                                }}
                              >
                                {(itemSearchResults[index] !== undefined ? itemSearchResults[index] : allSupplierItems).length > 0 ? (
                                  (itemSearchResults[index] !== undefined ? itemSearchResults[index] : allSupplierItems).map((searchItem) => (
                                    <button
                                      key={searchItem.id}
                                      type="button"
                                      onClick={() => handleSelectItem(index, searchItem)}
                                      className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 border-b border-gray-100 dark:border-gray-700 last:border-b-0"
                                    >
                                      <div className="font-medium text-gray-900 dark:text-white">{searchItem.item_code}</div>
                                      <div className="text-xs text-gray-500 dark:text-gray-400 truncate">{searchItem.item_name}</div>
                                      <div className="text-xs text-gray-600 dark:text-gray-300">{formatCurrency(searchItem.current_price)}</div>
                                    </button>
                                  ))
                                ) : (
                                  <div className="px-3 py-4 text-sm text-gray-500 dark:text-gray-400 text-center">
                                    {allSupplierItems.length === 0 ? 'Loading items...' : 'No items found'}
                                  </div>
                                )}
                              </div>,
                              document.body
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="relative">
                            <input
                              ref={el => inputRefs.current[`desc-${index}`] = el}
                              type="text"
                              value={item.description}
                              onChange={(e) => handleDescriptionChange(index, e.target.value)}
                              onFocus={() => handleDescriptionFocus(index)}
                              placeholder="Description..."
                              className="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                            {showDescriptionDropdown[index] && dropdownPosition[`desc-${index}`] && createPortal(
                              <div
                                ref={el => dropdownRefs.current[`desc-${index}`] = el}
                                className="fixed z-[99999] bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-xl max-h-96 overflow-y-auto"
                                style={{
                                  top: `${dropdownPosition[`desc-${index}`].top}px`,
                                  left: `${dropdownPosition[`desc-${index}`].left}px`,
                                  minWidth: '24rem'
                                }}
                              >
                                {(itemSearchResults[index] !== undefined ? itemSearchResults[index] : allSupplierItems).length > 0 ? (
                                  (itemSearchResults[index] !== undefined ? itemSearchResults[index] : allSupplierItems).map((searchItem) => (
                                    <button
                                      key={searchItem.id}
                                      type="button"
                                      onClick={() => handleSelectItem(index, searchItem)}
                                      className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 border-b border-gray-100 dark:border-gray-700 last:border-b-0"
                                    >
                                      <div className="font-medium text-gray-900 dark:text-white">{searchItem.item_code}</div>
                                      <div className="text-xs text-gray-500 dark:text-gray-400 truncate">{searchItem.item_name}</div>
                                      <div className="text-xs text-gray-600 dark:text-gray-300">{formatCurrency(searchItem.current_price)}</div>
                                    </button>
                                  ))
                                ) : (
                                  <div className="px-3 py-4 text-sm text-gray-500 dark:text-gray-400 text-center">
                                    {allSupplierItems.length === 0 ? 'Loading items...' : 'No items found'}
                                  </div>
                                )}
                              </div>,
                              document.body
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <input
                            type="number"
                            value={item.quantity}
                            onChange={(e) => handleLineItemChange(index, 'quantity', e.target.value)}
                            onFocus={(e) => e.target.select()}
                            min="0"
                            step="1"
                            className="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded text-sm text-right bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <input
                            type="number"
                            value={item.unit_price}
                            onChange={(e) => handleLineItemChange(index, 'unit_price', e.target.value)}
                            onFocus={(e) => e.target.select()}
                            min="0"
                            step="0.01"
                            className="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded text-sm text-right bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                        </td>
                        <td className="px-4 py-3 text-right text-sm font-medium text-gray-900 dark:text-white">
                          {formatCurrency((parseFloat(item.quantity) || 0) * (parseFloat(item.unit_price) || 0))}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button
                            type="button"
                            onClick={() => removeLineItem(index)}
                            className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
                            disabled={lineItems.length === 1}
                          >
                            <TrashIcon className="h-5 w-5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  type="button"
                  onClick={addLineItem}
                  className="inline-flex items-center px-4 py-2 text-sm font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300"
                >
                  <PlusIcon className="h-4 w-4 mr-2" />
                  Add Line Item
                </button>
              </div>
            </div>
          )}

          {/* Total */}
          {!loading && lineItems.length > 0 && (
            <div className="mt-4 bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Total Value:</span>
                <span className="text-lg font-bold text-gray-900 dark:text-white">{formatCurrency(calculateTotal())}</span>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 dark:border-gray-700">
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
            Save Items
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
