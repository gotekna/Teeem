/**
 * Format currency with thousands separators
 * @param {number|string} value - The currency value
 * @param {boolean} showCents - Whether to show cents (default: true)
 * @param {string} currency - Currency symbol (default: '$')
 * @returns {string} Formatted currency string
 */
export function formatCurrency(value, showCents = true, currency = '$') {
  if (value === null || value === undefined || value === '') {
    return '-'
  }

  const numValue = typeof value === 'string' ? parseFloat(value) : value

  if (isNaN(numValue)) {
    return '-'
  }

  // Format with thousands separators
  const options = {
    minimumFractionDigits: showCents ? 2 : 0,
    maximumFractionDigits: showCents ? 2 : 0,
  }

  const formatted = numValue.toLocaleString('en-US', options)

  return `${currency}${formatted}`
}

/**
 * Format percentage with proper symbol
 * @param {number|string} value - The percentage value
 * @param {number} decimals - Number of decimal places (default: 0)
 * @returns {string} Formatted percentage string
 */
export function formatPercentage(value, decimals = 0) {
  if (value === null || value === undefined || value === '') {
    return '-'
  }

  const numValue = typeof value === 'string' ? parseFloat(value) : value

  if (isNaN(numValue)) {
    return '-'
  }

  return `${numValue.toFixed(decimals)}%`
}

/**
 * Format number with thousands separators
 * @param {number|string} value - The number value
 * @param {number} decimals - Number of decimal places (default: 0)
 * @returns {string} Formatted number string
 */
export function formatNumber(value, decimals = 0) {
  if (value === null || value === undefined || value === '') {
    return '-'
  }

  const numValue = typeof value === 'string' ? parseFloat(value) : value

  if (isNaN(numValue)) {
    return '-'
  }

  const options = {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }

  return numValue.toLocaleString('en-US', options)
}
