import { useMemo } from 'react'

// Simple bar for progress indicators
const ProgressBar = ({ value, max, color = 'blue', showLabel = true, height = 'h-2' }) => {
  const percent = max > 0 ? Math.min((value / max) * 100, 100) : 0

  const colorClasses = {
    blue: 'bg-blue-500',
    green: 'bg-green-500',
    amber: 'bg-amber-500',
    red: 'bg-red-500',
    indigo: 'bg-indigo-500',
    gray: 'bg-gray-400'
  }

  return (
    <div className="w-full">
      <div className={`w-full bg-gray-200 rounded-full ${height}`}>
        <div
          className={`${colorClasses[color] || colorClasses.blue} ${height} rounded-full transition-all duration-300`}
          style={{ width: `${percent}%` }}
        />
      </div>
      {showLabel && (
        <div className="text-xs text-gray-500 mt-1">{percent.toFixed(0)}%</div>
      )}
    </div>
  )
}

// Circular progress ring
export const ProgressRing = ({ value, size = 120, strokeWidth = 8, color = '#3b82f6' }) => {
  const radius = (size - strokeWidth) / 2
  const circumference = radius * 2 * Math.PI
  const offset = circumference - (value / 100) * circumference

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#e5e7eb"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-500"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-2xl font-bold">{value.toFixed(0)}%</span>
      </div>
    </div>
  )
}

// Stat card component
export const StatCard = ({ title, value, subtitle, icon: Icon, trend, color = 'blue' }) => {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    amber: 'bg-amber-50 text-amber-600',
    red: 'bg-red-50 text-red-600',
    indigo: 'bg-indigo-50 text-indigo-600'
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-500">{title}</p>
          <p className="text-2xl font-bold mt-1">{value}</p>
          {subtitle && <p className="text-sm text-gray-400 mt-1">{subtitle}</p>}
        </div>
        {Icon && (
          <div className={`p-2 rounded-lg ${colorClasses[color]}`}>
            <Icon className="w-5 h-5" />
          </div>
        )}
      </div>
      {trend !== undefined && (
        <div className={`mt-2 text-sm ${trend >= 0 ? 'text-green-600' : 'text-red-600'}`}>
          {trend >= 0 ? '↑' : '↓'} {Math.abs(trend)}% from last period
        </div>
      )}
    </div>
  )
}

// Simple horizontal bar chart
export const HorizontalBarChart = ({ data, valueKey = 'value', labelKey = 'label', maxValue }) => {
  const max = maxValue || Math.max(...data.map(d => d[valueKey]))

  return (
    <div className="space-y-3">
      {data.map((item, i) => (
        <div key={i}>
          <div className="flex justify-between text-sm mb-1">
            <span className="text-gray-700">{item[labelKey]}</span>
            <span className="font-medium">{item[valueKey]}</span>
          </div>
          <ProgressBar
            value={item[valueKey]}
            max={max}
            color={item.color || 'blue'}
            showLabel={false}
            height="h-3"
          />
        </div>
      ))}
    </div>
  )
}

// Weekly trend line chart (using SVG)
export const TrendChart = ({ data, height = 200, valueKey = 'value', labelKey = 'label' }) => {
  const chartData = useMemo(() => {
    if (!data || data.length === 0) return null

    const values = data.map(d => d[valueKey])
    const max = Math.max(...values) || 1
    const min = Math.min(...values, 0)
    const range = max - min || 1

    const width = 100
    const padding = 5

    const points = data.map((d, i) => {
      const x = padding + (i / (data.length - 1 || 1)) * (width - padding * 2)
      const y = height - padding - ((d[valueKey] - min) / range) * (height - padding * 2)
      return { x: `${x}%`, y, value: d[valueKey], label: d[labelKey] }
    })

    // Create path
    const pathD = points.map((p, i) =>
      i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`
    ).join(' ')

    // Create area path
    const areaD = `${pathD} L ${points[points.length - 1].x} ${height - padding} L ${points[0].x} ${height - padding} Z`

    return { points, pathD, areaD, max, min }
  }, [data, height, valueKey])

  if (!chartData) return <div className="h-48 flex items-center justify-center text-gray-400">No data</div>

  return (
    <div className="relative" style={{ height }}>
      <svg width="100%" height={height} className="overflow-visible">
        {/* Grid lines */}
        {[0, 25, 50, 75, 100].map(pct => (
          <line
            key={pct}
            x1="0%"
            x2="100%"
            y1={height - 5 - (pct / 100) * (height - 10)}
            y2={height - 5 - (pct / 100) * (height - 10)}
            stroke="#e5e7eb"
            strokeDasharray="4"
          />
        ))}

        {/* Area fill */}
        <path d={chartData.areaD} fill="url(#gradient)" opacity="0.2" />

        {/* Line */}
        <path
          d={chartData.pathD}
          fill="none"
          stroke="#3b82f6"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Points */}
        {chartData.points.map((p, i) => (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r="4"
            fill="white"
            stroke="#3b82f6"
            strokeWidth="2"
          />
        ))}

        {/* Gradient definition */}
        <defs>
          <linearGradient id="gradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#3b82f6" />
            <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
          </linearGradient>
        </defs>
      </svg>

      {/* X-axis labels */}
      <div className="flex justify-between mt-2 text-xs text-gray-500">
        {data.map((d, i) => (
          <span key={i}>{d[labelKey]}</span>
        ))}
      </div>
    </div>
  )
}

// Donut chart
export const DonutChart = ({ data, size = 150, strokeWidth = 20 }) => {
  const total = data.reduce((sum, d) => sum + d.value, 0)
  const radius = (size - strokeWidth) / 2
  const circumference = radius * 2 * Math.PI

  let currentOffset = 0

  return (
    <div className="flex items-center gap-4">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="transform -rotate-90">
          {data.map((segment, i) => {
            const segmentLength = (segment.value / total) * circumference
            const offset = currentOffset
            currentOffset += segmentLength

            return (
              <circle
                key={i}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke={segment.color}
                strokeWidth={strokeWidth}
                strokeDasharray={`${segmentLength} ${circumference - segmentLength}`}
                strokeDashoffset={-offset}
              />
            )
          })}
        </svg>
        <div className="absolute inset-0 flex items-center justify-center flex-col">
          <span className="text-2xl font-bold">{total}</span>
          <span className="text-xs text-gray-500">Total</span>
        </div>
      </div>

      {/* Legend */}
      <div className="space-y-2">
        {data.map((d, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: d.color }} />
            <span className="text-sm text-gray-600">{d.label}</span>
            <span className="text-sm font-medium">{d.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// Utilization heatmap
export const UtilizationHeatmap = ({ resources, days }) => {
  const getColor = (utilization) => {
    if (utilization === 0) return 'bg-gray-100'
    if (utilization < 50) return 'bg-green-200'
    if (utilization < 80) return 'bg-green-400'
    if (utilization < 100) return 'bg-amber-400'
    return 'bg-red-400'
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full">
        <thead>
          <tr>
            <th className="text-left text-xs font-medium text-gray-500 py-2 px-2">Resource</th>
            {days.map((day, i) => (
              <th key={i} className="text-center text-xs text-gray-500 py-2 px-1 w-8">
                {day.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {resources.map((resource, ri) => (
            <tr key={ri}>
              <td className="text-sm text-gray-700 py-1 px-2">{resource.name}</td>
              {resource.dailyUtilization.map((util, di) => (
                <td key={di} className="py-1 px-1">
                  <div
                    className={`w-6 h-6 rounded ${getColor(util)} cursor-pointer`}
                    title={`${util}%`}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-4 text-xs">
        <span className="text-gray-500">Utilization:</span>
        <div className="flex items-center gap-1">
          <div className="w-4 h-4 bg-gray-100 rounded" />
          <span>0%</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-4 h-4 bg-green-200 rounded" />
          <span>&lt;50%</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-4 h-4 bg-green-400 rounded" />
          <span>50-80%</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-4 h-4 bg-amber-400 rounded" />
          <span>80-100%</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-4 h-4 bg-red-400 rounded" />
          <span>&gt;100%</span>
        </div>
      </div>
    </div>
  )
}

// Cost breakdown table
export const CostBreakdownTable = ({ data, title }) => (
  <div className="bg-white rounded-lg border border-gray-200">
    {title && (
      <div className="px-4 py-3 border-b border-gray-200">
        <h3 className="font-medium">{title}</h3>
      </div>
    )}
    <table className="min-w-full">
      <thead>
        <tr className="bg-gray-50">
          <th className="text-left text-xs font-medium text-gray-500 py-2 px-4">Category</th>
          <th className="text-right text-xs font-medium text-gray-500 py-2 px-4">Hours</th>
          <th className="text-right text-xs font-medium text-gray-500 py-2 px-4">Cost</th>
        </tr>
      </thead>
      <tbody>
        {data.map((row, i) => (
          <tr key={i} className="border-t border-gray-100">
            <td className="text-sm text-gray-700 py-2 px-4">{row.label}</td>
            <td className="text-sm text-gray-600 py-2 px-4 text-right">{row.hours?.toFixed(1) || '-'}</td>
            <td className="text-sm font-medium py-2 px-4 text-right">${row.cost?.toFixed(2) || '0.00'}</td>
          </tr>
        ))}
      </tbody>
      <tfoot>
        <tr className="border-t-2 border-gray-200 bg-gray-50">
          <td className="text-sm font-medium py-2 px-4">Total</td>
          <td className="text-sm font-medium py-2 px-4 text-right">
            {data.reduce((sum, r) => sum + (r.hours || 0), 0).toFixed(1)}
          </td>
          <td className="text-sm font-bold py-2 px-4 text-right">
            ${data.reduce((sum, r) => sum + (r.cost || 0), 0).toFixed(2)}
          </td>
        </tr>
      </tfoot>
    </table>
  </div>
)

export default {
  ProgressBar,
  ProgressRing,
  StatCard,
  HorizontalBarChart,
  TrendChart,
  DonutChart,
  UtilizationHeatmap,
  CostBreakdownTable
}
