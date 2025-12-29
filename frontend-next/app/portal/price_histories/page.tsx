'use client'

import { useState, useEffect } from 'react'
import { api } from '@/lib/api'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

interface PriceHistory {
  id: number
  pricebook_item_id: number
  pricebook_item_name: string
  pricebook_item_code: string
  supplier_id: number | null
  supplier_name: string | null
  old_price: number | null
  new_price: number | null
  price_change: number | null
  price_change_percentage: number | null
  change_reason: string | null
  quote_reference: string | null
  lga: string | null
  date_effective: string | null
  user_name: string | null
  changed_by_user_id: number | null
  created_at: string
  updated_at: string
}

interface ApiResponse {
  success: boolean
  data: PriceHistory[]
  total_count?: number
}

export default function PriceHistoriesPage() {
  const [histories, setHistories] = useState<PriceHistory[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [totalCount, setTotalCount] = useState(0)

  useEffect(() => {
    fetchPriceHistories()
  }, [])

  const fetchPriceHistories = async () => {
    try {
      setLoading(true)
      const response = await api.get<ApiResponse>('/pricebook/all_price_histories')
      if (response.success) {
        setHistories(response.data)
        setTotalCount(response.total_count || response.data.length)
      } else {
        setError('Failed to load price histories')
      }
    } catch (err) {
      console.error('Error fetching price histories:', err)
      setError('An error occurred while loading price histories')
    } finally {
      setLoading(false)
    }
  }

  const formatPrice = (price: number | null) => {
    if (price === null) return 'N/A'
    return `$${price.toFixed(2)}`
  }

  const formatChange = (change: number | null, percentage: number | null) => {
    if (change === null || percentage === null) return 'N/A'
    const sign = change >= 0 ? '+' : ''
    return `${sign}${formatPrice(change)} (${sign}${percentage.toFixed(2)}%)`
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-AU', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading price histories...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg text-red-600">{error}</div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Price Histories</h1>
        <p className="text-gray-600">
          Showing {histories.length.toLocaleString()} of {totalCount.toLocaleString()} total price changes
        </p>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <Table className="min-w-full">
            <TableHeader className="bg-gray-50">
              <TableRow>
                <TableHead className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Item
                </TableHead>
                <TableHead className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Code
                </TableHead>
                <TableHead className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Supplier
                </TableHead>
                <TableHead className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Old Price
                </TableHead>
                <TableHead className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  New Price
                </TableHead>
                <TableHead className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Change
                </TableHead>
                <TableHead className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Reason
                </TableHead>
                <TableHead className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  LGA
                </TableHead>
                <TableHead className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="bg-white divide-y divide-gray-200">
              {histories.map((history) => (
                <TableRow key={history.id} className="hover:bg-gray-50">
                  <TableCell className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {history.pricebook_item_name || 'N/A'}
                  </TableCell>
                  <TableCell className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {history.pricebook_item_code || 'N/A'}
                  </TableCell>
                  <TableCell className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {history.supplier_name || 'N/A'}
                  </TableCell>
                  <TableCell className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatPrice(history.old_price)}
                  </TableCell>
                  <TableCell className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatPrice(history.new_price)}
                  </TableCell>
                  <TableCell className={`px-6 py-4 whitespace-nowrap text-sm font-medium ${
                    history.price_change && history.price_change > 0
                      ? 'text-red-600'
                      : history.price_change && history.price_change < 0
                      ? 'text-green-600'
                      : 'text-gray-500'
                  }`}>
                    {formatChange(history.price_change, history.price_change_percentage)}
                  </TableCell>
                  <TableCell className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate">
                    {history.change_reason || 'N/A'}
                  </TableCell>
                  <TableCell className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {history.lga || 'N/A'}
                  </TableCell>
                  <TableCell className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatDate(history.created_at)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      {histories.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          No price histories found
        </div>
      )}
    </div>
  )
}
