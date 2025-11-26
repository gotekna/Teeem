import { useState, useEffect } from 'react'
import { api } from '../api'
import DataTable from '../components/DataTable'
import TeeemTableView from '../components/documentation/TeeemTableView'
import { PlusIcon } from '@heroicons/react/24/outline'

export default function TableStandardTest() {
  const [quotes, setQuotes] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadQuotes()
  }, [])

  const loadQuotes = async () => {
    setLoading(true)
    try {
      const response = await api.get('/api/v1/inspiring_quotes')
      if (response.success) {
        setQuotes(response.data)
      }
    } catch (error) {
      console.error('Failed to load quotes:', error)
    } finally {
      setLoading(false)
    }
  }

  // Transform quotes for TeeemTableView with dummy currency/number data
  const trinityQuotes = quotes.map((quote, index) => ({
    id: quote.id,
    category: 'inspiring_quotes',
    chapter_number: 0,
    chapter_name: 'Quotes',
    section_number: String(quote.display_order),
    title: quote.aussie_slang || quote.quote,
    entry_type: quote.category || 'general',
    description: quote.original_quote || quote.quote,
    component: quote.author || '',
    status: quote.is_active ? 'active' : 'inactive',
    severity: 'low',
    // Add dummy currency and number fields for testing
    price: (index + 1) * 12.50,  // $12.50, $25.00, $37.50, etc.
    quantity: Math.floor(Math.random() * 50) + 1,  // Random 1-50
    _original: quote
  }))

  const handleEdit = (entry) => {
    console.log('Edit:', entry)
    alert('Edit functionality - see console')
  }

  const handleDelete = (entry) => {
    console.log('Delete:', entry)
    alert('Delete functionality - see console')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-gray-500">Loading quotes...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Table Standard Comparison
          </h1>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            Compare different table implementations to decide on THE standard for TEEEM
          </p>
        </div>

        {/* Comparison Grid */}
        <div className="space-y-12">
          {/* Option B: TeeemTableView (Current Advanced) */}
          <section className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 border-4 border-blue-500 dark:border-blue-400">
            <div className="mb-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                    Option B: TeeemTableView (Advanced)
                  </h2>
                  <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                    Current enterprise table - 1,739 lines, blue header, all advanced features
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Power
                  </div>
                  <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                    🚀🚀🚀🚀🚀
                  </div>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <span className="inline-flex items-center rounded-md bg-green-50 px-2 py-1 text-xs font-medium text-green-700 ring-1 ring-inset ring-green-600/20">
                  ✓ Column resize
                </span>
                <span className="inline-flex items-center rounded-md bg-green-50 px-2 py-1 text-xs font-medium text-green-700 ring-1 ring-inset ring-green-600/20">
                  ✓ Column reorder
                </span>
                <span className="inline-flex items-center rounded-md bg-green-50 px-2 py-1 text-xs font-medium text-green-700 ring-1 ring-inset ring-green-600/20">
                  ✓ Show/hide columns
                </span>
                <span className="inline-flex items-center rounded-md bg-green-50 px-2 py-1 text-xs font-medium text-green-700 ring-1 ring-inset ring-green-600/20">
                  ✓ Inline editing
                </span>
                <span className="inline-flex items-center rounded-md bg-green-50 px-2 py-1 text-xs font-medium text-green-700 ring-1 ring-inset ring-green-600/20">
                  ✓ Bulk actions
                </span>
                <span className="inline-flex items-center rounded-md bg-green-50 px-2 py-1 text-xs font-medium text-green-700 ring-1 ring-inset ring-green-600/20">
                  ✓ Advanced filters
                </span>
                <span className="inline-flex items-center rounded-md bg-green-50 px-2 py-1 text-xs font-medium text-green-700 ring-1 ring-inset ring-green-600/20">
                  ✓ State persistence
                </span>
                <span className="inline-flex items-center rounded-md bg-green-50 px-2 py-1 text-xs font-medium text-green-700 ring-1 ring-inset ring-green-600/20">
                  ✓ Sticky headers
                </span>
                <span className="inline-flex items-center rounded-md bg-yellow-50 px-2 py-1 text-xs font-medium text-yellow-700 ring-1 ring-inset ring-yellow-600/20">
                  ⚠ Trinity-specific (needs data transformation)
                </span>
              </div>
            </div>
            <div className="border-2 border-dashed border-blue-300 dark:border-blue-600 rounded-lg p-4 h-[800px] overflow-auto">
              <TeeemTableView
                category="inspiring_quotes"
                entries={trinityQuotes}
                onEdit={handleEdit}
                onDelete={handleDelete}
                enableImport={true}
                enableExport={true}
                onImport={() => {
                  console.log('Import clicked')
                  alert('Import functionality - see console')
                }}
                onExport={() => {
                  console.log('Export clicked')
                  alert('Export functionality - see console')
                }}
                customActions={
                  <button
                    onClick={() => alert('Add Quote')}
                    className="inline-flex items-center gap-2 px-4 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors h-[42px]"
                  >
                    <PlusIcon className="h-5 w-5" />
                    Add Quote
                  </button>
                }
              />
            </div>
          </section>

          {/* Testing Instructions for Multi-Select Filters */}
          <section className="bg-gradient-to-r from-green-50 to-teal-50 dark:from-green-900/20 dark:to-teal-900/20 rounded-xl shadow-lg p-8 border-2 border-green-400 dark:border-green-600">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
              🧪 WHERE ARE THE FILTER DROPDOWNS?
            </h2>
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow mb-4">
              <h3 className="font-bold text-lg text-gray-900 dark:text-white mb-3">
                👆 Look in the BLUE TABLE HEADER above!
              </h3>
              <div className="space-y-4 text-sm text-gray-600 dark:text-gray-400">
                <p className="text-base font-semibold text-blue-600 dark:text-blue-400">
                  The filters are INSIDE the blue column headers - right below each column name!
                </p>
                <ol className="space-y-3 list-decimal list-inside">
                  <li><strong>Scroll up to the table with the BLUE header</strong></li>
                  <li><strong>Look at the "Component" column</strong> - below the column name you'll see a button that says "Filter..."</li>
                  <li><strong>Click that button</strong> - you'll see checkboxes for multi-select (this is the pattern we want!)</li>
                  <li><strong>Now look at "Status", "Type", or "Severity" columns</strong> - they have dropdown boxes (single-select, old pattern)</li>
                  <li><strong>Try "Title" or "Content" columns</strong> - they have text input filters</li>
                </ol>
                <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/30 rounded border border-blue-300 dark:border-blue-600">
                  <p className="font-semibold text-blue-900 dark:text-blue-200">
                    The filters are built INTO the header cells - they're not in a separate toolbar!
                  </p>
                </div>
              </div>
            </div>
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg p-4">
              <p className="text-sm text-yellow-800 dark:text-yellow-200">
                <strong>Question:</strong> Should ALL filter dropdowns (Status, Type, Category, etc.) work like Component
                with checkboxes and multi-select? This would let users filter by multiple statuses at once
                (e.g., show "Active" OR "Inactive" rows together).
              </p>
            </div>
          </section>

          {/* Decision Helper */}
          <section className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-xl shadow-lg p-8 border-2 border-purple-300 dark:border-purple-600">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
              ✅ TeeemTableView Features
            </h2>
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow">
              <h3 className="font-bold text-lg text-gray-900 dark:text-white mb-4">
                Test These Features Above:
              </h3>
              <div className="grid md:grid-cols-2 gap-4">
                <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                  <li>✓ <strong>Column Resize</strong> - Drag column borders</li>
                  <li>✓ <strong>Column Reorder</strong> - Drag column headers</li>
                  <li>✓ <strong>Show/Hide Columns</strong> - Click "Columns" button</li>
                  <li>✓ <strong>Advanced Sorting</strong> - 3-state (asc/desc/none)</li>
                  <li>✓ <strong>Multi-Select Filters</strong> - Component dropdown has checkboxes</li>
                </ul>
                <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                  <li>✓ <strong>Inline Editing</strong> - Toggle edit mode</li>
                  <li>✓ <strong>Bulk Selection</strong> - Checkbox column</li>
                  <li>✓ <strong>Bulk Actions</strong> - Delete/Export selected</li>
                  <li>✓ <strong>State Persistence</strong> - Settings saved to localStorage</li>
                  <li>✓ <strong>Sticky Headers</strong> - Headers stay visible when scrolling</li>
                </ul>
              </div>
            </div>

            <div className="mt-6 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-4">
              <p className="text-sm text-blue-800 dark:text-blue-200">
                <strong>Next Step:</strong> Test the Component filter (multi-select with checkboxes) and decide if ALL
                filter dropdowns should work this way. This will define RULE #20.11 for the table standard.
              </p>
            </div>
          </section>

        </div>
      </div>
    </div>
  )
}
