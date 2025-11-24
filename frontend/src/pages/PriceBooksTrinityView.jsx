import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PlusIcon } from '@heroicons/react/24/outline'
import { api } from '../api'
import TrapidTableView from '../components/documentation/TrapidTableView'

// Define price book-specific columns
const PRICEBOOK_COLUMNS = [
  { key: 'select', label: '', resizable: false, sortable: false, filterable: false, width: 32 },
  { key: 'actions', label: 'Actions', column_type: 'action_buttons', resizable: true, sortable: false, filterable: false, width: 100 },
  { key: 'section', label: 'Code', resizable: true, sortable: true, filterable: true, filterType: 'text', width: 150, tooltip: 'Item code' },
  { key: 'title', label: 'Item Name', resizable: true, sortable: true, filterable: true, filterType: 'text', width: 300 },
  { key: 'type', label: 'Category', resizable: true, sortable: true, filterable: true, filterType: 'dropdown', width: 180 },
  { key: 'component', label: 'Supplier', resizable: true, sortable: true, filterable: true, filterType: 'dropdown', width: 200 },
  { key: 'price', label: 'Price', column_type: 'currency', resizable: true, sortable: true, filterable: false, width: 120, showSum: true, sumType: 'currency', tooltip: 'Current price in AUD' },
  { key: 'unit', label: 'Unit', resizable: true, sortable: true, filterable: true, filterType: 'dropdown', width: 100 },
  { key: 'status', label: 'Status', resizable: true, sortable: true, filterable: true, filterType: 'dropdown', width: 120 },
  { key: 'severity', label: 'Risk', resizable: true, sortable: true, filterable: true, filterType: 'dropdown', width: 120, tooltip: 'Price risk level' },
  { key: 'content', label: 'Notes', resizable: true, sortable: false, filterable: true, filterType: 'text', width: 300 }
]

export default function PriceBooksTrinityView() {
  const navigate = useNavigate()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadPriceBookItems()
  }, [])

  const loadPriceBookItems = async () => {
    setLoading(true)
    try {
      // Load all items - API supports large limits
      const response = await api.get('/api/v1/pricebook', {
        params: {
          page: 1,
          limit: 20000,  // Increased to load all ~14500 items
        }
      })

      console.log('Price book API response:', response)

      // API returns { items: [...], pagination: {...} }
      const itemsData = response.items || []
      console.log('Price book items loaded:', itemsData.length, 'of', response.pagination?.total_count || 'unknown')
      setItems(itemsData)
    } catch (error) {
      console.error('Failed to load price book items:', error)
    } finally {
      setLoading(false)
    }
  }

  // Transform pricebook items to Trinity format
  const trinityEntries = items.map((item) => ({
    id: item.id,
    category: 'pricebook',
    chapter_number: 0,
    chapter_name: 'Price Book',
    section_number: item.item_code || '',
    section: item.item_code || '',  // Alias for 'section' column key (Code)
    title: item.item_name || '',
    entry_type: item.category || '',
    type: item.category || '',  // Add 'type' field to match column key for Category grouping
    content: item.notes || '',
    description: item.notes || '',
    component: item.supplier?.name || item.default_supplier?.name || '',
    status: item.is_active ? 'active' : 'inactive',
    severity: item.risk?.level || 'low',

    // Price book specific fields
    price: parseFloat(item.current_price) || 0,
    quantity: item.quantity || 0,
    unit: item.unit_of_measure || '',
    brand: item.brand || '',
    gst_code: item.gst_code || '',
    supplier_id: item.supplier_id,
    default_supplier_id: item.default_supplier_id,
    requires_photo: item.requires_photo,
    requires_spec: item.requires_spec,
    photo_attached: item.photo_attached,
    spec_attached: item.spec_attached,
    price_freshness: item.price_freshness?.status || 'unknown',
    risk_score: item.risk?.score || 0,

    // Store original for reference
    _original: item
  }))

  // Log transformation result (use useEffect to avoid setState during render)
  useEffect(() => {
    if (trinityEntries.length > 0) {
      console.log('Trinity entries transformed:', trinityEntries.length, trinityEntries.slice(0, 2))
    }
  }, [trinityEntries.length])

  const handleEdit = (entry) => {
    // Navigate to detail page
    navigate(`/price-books/${entry.id}`)
  }

  const handleDelete = async (entry) => {
    if (!confirm(`Are you sure you want to delete "${entry.title}"?`)) return

    try {
      await api.delete(`/api/v1/pricebook/${entry.id}`)
      // Reload data
      loadPriceBookItems()
    } catch (error) {
      console.error('Failed to delete item:', error)
      alert('Failed to delete item')
    }
  }

  const handleExport = () => {
    console.log('Export price book items')
    alert('Export functionality - see console')
  }

  const handleImport = () => {
    console.log('Import price book items')
    alert('Import functionality - see console')
  }

  const handleAddNew = () => {
    navigate('/price-books/new')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 dark:border-indigo-400 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading price book...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full bg-gray-50 dark:bg-gray-900">
      <TrapidTableView
        tableId="pricebook-trinity"
        tableIdNumeric={205}
        tableName="Price Book Items"
        category="pricebook"
        entries={trinityEntries}
        columns={PRICEBOOK_COLUMNS}
        onEdit={handleEdit}
        onDelete={handleDelete}
        enableImport={true}
        enableExport={true}
        enableSchemaEditor={true}
        onImport={handleImport}
        onExport={handleExport}
        onRowDoubleClick={(entry) => {
          navigate(`/price-books/${entry.id}`)
        }}
        onView={(entry) => {
          navigate(`/price-books/${entry.id}`)
        }}
        customActions={
          <button
            onClick={handleAddNew}
            className="inline-flex items-center gap-2 px-4 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors h-[42px]"
          >
            <PlusIcon className="h-5 w-5" />
            Add Item
          </button>
        }
      />
    </div>
  )
}
