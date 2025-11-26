/**
 * Gold Standard Table API Service
 * Centralized API calls for Gold Standard table operations
 *
 * Features:
 * - Consistent error handling
 * - Automatic response parsing
 * - Pagination support
 * - Type-safe responses
 */

const BASE_URL = '/api/v1/gold_standard_table'

/**
 * Fetch all gold standard items with optional pagination and filtering
 * @param {Object} options - Query options
 * @param {number} options.page - Page number (default: 1)
 * @param {number} options.per_page - Items per page (default: 250, max: 250)
 * @param {Object} options.filters - Filter object (key-value pairs for server-side filtering)
 * @returns {Promise<{success: boolean, items: Array, pagination: Object, filters_applied: boolean}>}
 */
export async function fetchItems({ page = 1, per_page = 250, filters = null } = {}) {
  const params = new URLSearchParams({ page, per_page })

  // Add filters as nested parameters if provided
  if (filters && Object.keys(filters).length > 0) {
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== null && value !== undefined && value !== '') {
        params.append(`filters[${key}]`, value)
      }
    })
  }

  const response = await fetch(`${BASE_URL}?${params}`)

  if (!response.ok) {
    throw new Error(`Failed to fetch items: ${response.status} ${response.statusText}`)
  }

  return await response.json()
}

/**
 * Create a new gold standard item
 * @param {Object} itemData - Item data to create
 * @returns {Promise<{success: boolean, item: Object}>}
 */
export async function createItem(itemData) {
  const response = await fetch(BASE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ gold_standard_table: itemData })
  })

  if (!response.ok) {
    const errorData = await response.json()
    const errorMessage = errorData.errors?.join(', ') || 'Failed to create item'
    throw new Error(errorMessage)
  }

  return await response.json()
}

/**
 * Update an existing gold standard item
 * @param {number} id - Item ID
 * @param {Object} itemData - Updated item data
 * @returns {Promise<{success: boolean, item: Object}>}
 */
export async function updateItem(id, itemData) {
  const response = await fetch(`${BASE_URL}/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ gold_standard_table: itemData })
  })

  if (!response.ok) {
    const errorData = await response.json()
    const errorMessage = errorData.errors?.join(', ') || 'Failed to update item'
    throw new Error(errorMessage)
  }

  return await response.json()
}

/**
 * Delete a gold standard item
 * @param {number} id - Item ID
 * @returns {Promise<{success: boolean, message: string}>}
 */
export async function deleteItem(id) {
  const response = await fetch(`${BASE_URL}/${id}`, {
    method: 'DELETE'
  })

  if (!response.ok) {
    throw new Error('Failed to delete item')
  }

  return await response.json()
}

/**
 * Delete multiple gold standard items
 * @param {Array<number>} ids - Array of item IDs to delete
 * @returns {Promise<{success: boolean, deleted_count: number}>}
 */
export async function bulkDeleteItems(ids) {
  const responses = await Promise.all(
    ids.map(id => fetch(`${BASE_URL}/${id}`, { method: 'DELETE' }))
  )

  const failed = responses.filter(r => !r.ok)
  if (failed.length > 0) {
    throw new Error(`Failed to delete ${failed.length} of ${ids.length} items`)
  }

  return {
    success: true,
    deleted_count: ids.length
  }
}

/**
 * Sync column metadata with the columns table
 * Requires authentication
 * @returns {Promise<{success: boolean, columns: Array}>}
 */
export async function syncColumns() {
  const response = await fetch('/api/v1/gold_standard_table/sync_with_columns')

  if (!response.ok) {
    throw new Error('Failed to sync columns')
  }

  return await response.json()
}
