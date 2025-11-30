import { useEffect, useState, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom'
import { api } from '../api'
import { ArrowLeftIcon, PlusIcon, TrashIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline'
import { formatCurrency } from '../utils/formatters'
import PODocumentsTab from '../components/purchase-orders/PODocumentsTab'

function classNames(...classes) {
  return classes.filter(Boolean).join(' ')
}

export default function PurchaseOrderEditPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [purchaseOrder, setPurchaseOrder] = useState(null)
  const [lineItems, setLineItems] = useState([])
  const [itemSearchResults, setItemSearchResults] = useState({})
  const [showSearchDropdown, setShowSearchDropdown] = useState({})
  const [showDescriptionDropdown, setShowDescriptionDropdown] = useState({})
  const [dropdownPosition, setDropdownPosition] = useState({})
  const [allSupplierItems, setAllSupplierItems] = useState([])
  const [scheduleTasks, setScheduleTasks] = useState([])
  const [selectedScheduleTaskId, setSelectedScheduleTaskId] = useState(null)
  const searchRefs = useRef({})
  const inputRefs = useRef({})
  const dropdownRefs = useRef({})

  const tabs = ['Line Items', 'Documents']
  const activeTab = searchParams.get('tab') || 'Line Items'

  useEffect(() => {
    loadPurchaseOrder()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      // Check if click is on any input or dropdown
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

  const loadPurchaseOrder = async () => {
    try {
      setLoading(true)
      const response = await api.get(`/api/v1/purchase_orders/${id}`)
      setPurchaseOrder(response)

      // Load all items for this supplier
      if (response.supplier_id) {
        loadAllSupplierItems(response.supplier_id)
      }

      // Load schedule tasks for this construction
      if (response.construction_id) {
        loadScheduleTasks(response.construction_id)
      }

      // Set the currently selected schedule task
      if (response.schedule_tasks && response.schedule_tasks.length > 0) {
        setSelectedScheduleTaskId(response.schedule_tasks[0].id)
      }

      // Initialize line items - if none exist, add one empty row
      if (response.line_items && response.line_items.length > 0) {
        setLineItems(response.line_items.map(item => ({
          id: item.id,
          pricebook_item_id: item.pricebook_item_id,
          item_code: item.pricebook_item?.item_code || '',
          description: item.description || item.pricebook_item?.item_name || '',
          quantity: item.quantity || 1,
          unit_price: item.unit_price || 0,
          _destroy: false
        })))
      } else {
        setLineItems([{ item_code: '', description: '', quantity: 1, unit_price: 0 }])
      }
    } catch (err) {
      setError('Failed to load purchase order')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const loadAllSupplierItems = async (supplierId) => {
    try {
      const response = await api.get('/api/v1/pricebook', {
        params: {
          supplier_id: supplierId,
          per_page: 1000 // Get all items for this supplier
        }
      })
      setAllSupplierItems(response.items || [])
    } catch (err) {
      console.error('Failed to load supplier items:', err)
    }
  }

  const loadScheduleTasks = async (constructionId) => {
    try {
      const response = await api.get(`/api/v1/jobs/${constructionId}/schedule_tasks`)
      setScheduleTasks(response.schedule_tasks || [])
    } catch (err) {
      console.error('Failed to load schedule tasks:', err)
    }
  }

  const searchPricebookItems = (searchTerm, index) => {
    if (!searchTerm) {
      setItemSearchResults(prev => ({ ...prev, [index]: allSupplierItems }))
      return
    }

    // Filter the already-loaded supplier items client-side
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

    // Calculate dropdown position if not already set
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

    // Search as user types
    if (value.length >= 2) {
      searchPricebookItems(value, index)
      setShowSearchDropdown(prev => ({ ...prev, [index]: true }))
    } else if (value.length === 0) {
      // Show all supplier items when field is empty
      setItemSearchResults(prev => ({ ...prev, [index]: allSupplierItems }))
      setShowSearchDropdown(prev => ({ ...prev, [index]: true }))
    } else {
      setShowSearchDropdown(prev => ({ ...prev, [index]: false }))
    }
  }

  const handleItemCodeFocus = (index) => {
    // Close description dropdown
    setShowDescriptionDropdown(prev => ({ ...prev, [index]: false }))

    // Calculate dropdown position
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

    // Always show all supplier items when focusing on item code field
    setItemSearchResults(prev => ({ ...prev, [index]: allSupplierItems }))
    setShowSearchDropdown(prev => ({ ...prev, [index]: true }))
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
    // Close both dropdowns
    setShowSearchDropdown(prev => ({ ...prev, [index]: false }))
    setShowDescriptionDropdown(prev => ({ ...prev, [index]: false }))
  }

  const handleDescriptionChange = (index, value) => {
    const newLineItems = [...lineItems]
    newLineItems[index].description = value
    setLineItems(newLineItems)

    // Close item code dropdown when typing in description
    setShowSearchDropdown(prev => ({ ...prev, [index]: false }))

    // Calculate dropdown position if not already set
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

    // Search as user types in description
    if (value.length >= 2) {
      searchPricebookItems(value, index)
      setShowDescriptionDropdown(prev => ({ ...prev, [index]: true }))
    } else if (value.length === 0) {
      // Show all supplier items when field is empty
      setItemSearchResults(prev => ({ ...prev, [index]: allSupplierItems }))
      setShowDescriptionDropdown(prev => ({ ...prev, [index]: true }))
    } else {
      setShowDescriptionDropdown(prev => ({ ...prev, [index]: false }))
    }
  }

  const handleDescriptionFocus = (index) => {
    // Close item code dropdown
    setShowSearchDropdown(prev => ({ ...prev, [index]: false }))

    // Calculate dropdown position
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

    // Always show all supplier items when focusing on description field
    setItemSearchResults(prev => ({ ...prev, [index]: allSupplierItems }))
    setShowDescriptionDropdown(prev => ({ ...prev, [index]: true }))
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
    if (newLineItems[index].id) {
      // Mark existing items for deletion
      newLineItems[index]._destroy = true
    } else {
      // Remove new items completely
      newLineItems.splice(index, 1)
    }
    setLineItems(newLineItems)
  }

  const calculateSubtotal = () => {
    return lineItems
      .filter(item => !item._destroy)
      .reduce((sum, item) => sum + (parseFloat(item.quantity) || 0) * (parseFloat(item.unit_price) || 0), 0)
  }

  const calculateGST = () => {
    return calculateSubtotal() * 0.1 // 10% GST
  }

  const calculateTotal = () => {
    return calculateSubtotal() + calculateGST()
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    // Validate that we have at least one line item
    const validItems = lineItems.filter(item => !item._destroy && item.description)
    if (validItems.length === 0) {
      setError('Please add at least one line item')
      return
    }

    setSaving(true)
    setError(null)

    try {
      await api.put(`/api/v1/purchase_orders/${id}`, {
        purchase_order: {
          schedule_task_id: selectedScheduleTaskId || null,
          line_items_attributes: lineItems.map(item => ({
            id: item.id,
            pricebook_item_id: item.pricebook_item_id,
            description: item.description,
            quantity: item.quantity,
            unit_price: item.unit_price,
            _destroy: item._destroy || false
          }))
        }
      })
      navigate(`/purchase-orders/${id}`)
    } catch (err) {
      setError(err.message || 'Failed to update purchase order')
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-600 dark:text-gray-400">Loading purchase order...</div>
      </div>
    )
  }

  if (error && !purchaseOrder) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-red-600 dark:text-red-400">{error}</div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden bg-gray-50 dark:bg-gray-900">
      {/* Fixed Header with Tabs */}
      <div className="flex-shrink-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <button
            onClick={() => navigate(-1)}
            className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 mb-4"
          >
            <ArrowLeftIcon className="mr-2 h-4 w-4" />
            Back
          </button>

          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                Purchase Order #{purchaseOrder?.purchase_order_number}
              </h1>
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                Job: {purchaseOrder?.construction?.title || 'Unknown Job'}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Supplier: {purchaseOrder?.supplier?.name || 'No supplier selected'}
              </p>
              <div className="flex items-center gap-x-2 text-sm text-gray-600 dark:text-gray-400">
                <span>Schedule Task:</span>
                <select
                  value={selectedScheduleTaskId || ''}
                  onChange={(e) => setSelectedScheduleTaskId(e.target.value || null)}
                  className="inline-flex px-2 py-0.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">Select schedule task...</option>
                  {scheduleTasks.map((task) => (
                    <option key={task.id} value={task.id}>
                      {task.title} {task.supplier_category && `(${task.supplier_category})`}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="border-b border-gray-200 dark:border-gray-700">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <nav aria-label="Tabs" className="flex space-x-8 -mb-px">
                {tabs.map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setSearchParams({ tab })}
                    type="button"
                    className={classNames(
                      activeTab === tab
                        ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                        : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300',
                      'whitespace-nowrap border-b-2 px-1 py-4 text-sm font-medium'
                    )}
                  >
                    {tab}
                  </button>
                ))}
              </nav>
            </div>
          </div>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 min-h-0 overflow-y-auto overscroll-none">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <form onSubmit={handleSubmit}>
            {/* Error Message */}
          {error && (
            <div className="mb-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg p-4">
              <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
            </div>
          )}

          {/* Line Items Tab Content */}
          {activeTab === 'Line Items' && (
            <>
              {/* Line Items Table */}
          <div className="bg-white dark:bg-gray-800 shadow rounded-lg overflow-visible">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Line Items</h2>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Click on item code field to see all items, or type to search
              </p>
            </div>

            <div className="overflow-x-auto overflow-y-visible">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-900">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-32">
                      Item Code
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Description
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-24">
                      Quantity
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-32">
                      Unit Price
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-32">
                      Total
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-20">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {lineItems.filter(item => !item._destroy).map((item, index) => (
                    <tr key={index} ref={el => searchRefs.current[index] = el}>
                      <td className="px-6 py-4 overflow-visible">
                        <div className="relative">
                          <input
                            ref={el => inputRefs.current[`code-${index}`] = el}
                            type="text"
                            value={item.item_code}
                            onChange={(e) => handleItemCodeChange(index, e.target.value)}
                            onFocus={() => handleItemCodeFocus(index)}
                            placeholder="Type code..."
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                          {showSearchDropdown[index] && dropdownPosition[`code-${index}`] && createPortal(
                            <div
                              ref={el => dropdownRefs.current[`code-${index}`] = el}
                              className="fixed z-[9999] bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-xl max-h-96 overflow-y-auto"
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
                      <td className="px-6 py-4 overflow-visible">
                        <div className="relative">
                          <input
                            ref={el => inputRefs.current[`desc-${index}`] = el}
                            type="text"
                            value={item.description}
                            onChange={(e) => handleDescriptionChange(index, e.target.value)}
                            onFocus={() => handleDescriptionFocus(index)}
                            placeholder="Description..."
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                          {showDescriptionDropdown[index] && dropdownPosition[`desc-${index}`] && createPortal(
                            <div
                              ref={el => dropdownRefs.current[`desc-${index}`] = el}
                              className="fixed z-[9999] bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-xl max-h-96 overflow-y-auto"
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
                      <td className="px-6 py-4">
                        <input
                          type="number"
                          value={item.quantity}
                          onChange={(e) => handleLineItemChange(index, 'quantity', e.target.value)}
                          onFocus={(e) => e.target.select()}
                          min="0"
                          step="1"
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm text-right bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </td>
                      <td className="px-6 py-4">
                        <input
                          type="number"
                          value={item.unit_price}
                          onChange={(e) => handleLineItemChange(index, 'unit_price', e.target.value)}
                          onFocus={(e) => e.target.select()}
                          min="0"
                          step="0.01"
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm text-right bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </td>
                      <td className="px-6 py-4 text-right text-sm font-medium text-gray-900 dark:text-white">
                        {formatCurrency((parseFloat(item.quantity) || 0) * (parseFloat(item.unit_price) || 0))}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <button
                          type="button"
                          onClick={() => removeLineItem(index)}
                          className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
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

          {/* Totals */}
          <div className="mt-6 bg-white dark:bg-gray-800 shadow rounded-lg p-6">
            <div className="max-w-md ml-auto space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">Subtotal (Ex GST)</span>
                <span className="font-medium text-gray-900 dark:text-white">{formatCurrency(calculateSubtotal())}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">GST (10%)</span>
                <span className="font-medium text-gray-900 dark:text-white">{formatCurrency(calculateGST())}</span>
              </div>
              <div className="flex justify-between text-lg font-bold border-t border-gray-200 dark:border-gray-700 pt-3">
                <span className="text-gray-900 dark:text-white">Total (Inc GST)</span>
                <span className="text-gray-900 dark:text-white">{formatCurrency(calculateTotal())}</span>
              </div>
            </div>
          </div>

              {/* Action Buttons */}
              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => navigate(`/purchase-orders/${id}`)}
                  className="px-6 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-6 py-2 border border-transparent rounded-lg text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? 'Saving...' : 'Save Purchase Order'}
                </button>
              </div>
            </>
          )}

          {/* Documents Tab Content */}
          {activeTab === 'Documents' && (
            <PODocumentsTab
              purchaseOrderId={id}
              constructionId={purchaseOrder?.construction_id}
              scheduleTaskId={selectedScheduleTaskId}
              onDocumentsChange={(selectedDocIds) => {
                console.log('Documents updated:', selectedDocIds)
              }}
            />
          )}
          </form>
        </div>
      </div>
    </div>
  )
}
