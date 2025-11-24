import { useState } from 'react'
import { formatCurrency } from '../../utils/formatters'

export default function CurrencyCell({ value }) {
  const [showFull, setShowFull] = useState(false)

  if (value === null || value === undefined || value === '') {
    return <span className="text-gray-400">-</span>
  }

  const displayValue = formatCurrency(value, showFull)

  return (
    <button
      onClick={() => setShowFull(!showFull)}
      className="text-left hover:bg-gray-50 px-2 py-1 rounded transition-colors cursor-pointer font-mono"
      title={showFull ? 'Click to hide cents' : 'Click to show cents'}
    >
      {displayValue}
    </button>
  )
}
