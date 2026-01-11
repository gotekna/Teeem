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
        <div className="text-lg dark:text-white">Loading price histories...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg text-red-600 dark:text-red-400">{error}</div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2 dark:text-white">Price Histories</h1>
        <p className="text-muted-foreground dark:text-muted-foreground">
          Showing {histories.length.toLocaleString()} of {totalCount.toLocaleString()} total price changes
        </p>
      </div>

      <div className="bg-card rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <Table className="min-w-full">
            <TableHeader className="bg-muted dark:bg-muted">
              <TableRow>
                <TableHead className="px-6 py-3 text-left text-xs font-medium text-muted-foreground dark:text-muted-foreground uppercase tracking-wider">
                  Item
                </TableHead>
                <TableHead className="px-6 py-3 text-left text-xs font-medium text-muted-foreground dark:text-muted-foreground uppercase tracking-wider">
                  Code
                </TableHead>
                <TableHead className="px-6 py-3 text-left text-xs font-medium text-muted-foreground dark:text-muted-foreground uppercase tracking-wider">
                  Supplier
                </TableHead>
                <TableHead className="px-6 py-3 text-left text-xs font-medium text-muted-foreground dark:text-muted-foreground uppercase tracking-wider">
                  Old Price
                </TableHead>
                <TableHead className="px-6 py-3 text-left text-xs font-medium text-muted-foreground dark:text-muted-foreground uppercase tracking-wider">
                  New Price
                </TableHead>
                <TableHead className="px-6 py-3 text-left text-xs font-medium text-muted-foreground dark:text-muted-foreground uppercase tracking-wider">
                  Change
                </TableHead>
                <TableHead className="px-6 py-3 text-left text-xs font-medium text-muted-foreground dark:text-muted-foreground uppercase tracking-wider">
                  Reason
                </TableHead>
                <TableHead className="px-6 py-3 text-left text-xs font-medium text-muted-foreground dark:text-muted-foreground uppercase tracking-wider">
                  LGA
                </TableHead>
                <TableHead className="px-6 py-3 text-left text-xs font-medium text-muted-foreground dark:text-muted-foreground uppercase tracking-wider">
                  Date
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="bg-card divide-y divide-border dark:divide-border">
              {histories.map((history) => (
                <TableRow key={history.id} className="hover:bg-muted dark:hover:bg-muted">
                  <TableCell className="px-6 py-4 whitespace-nowrap text-sm font-medium text-foreground dark:text-white">
                    {history.pricebook_item_name || 'N/A'}
                  </TableCell>
                  <TableCell className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground dark:text-muted-foreground">
                    {history.pricebook_item_code || 'N/A'}
                  </TableCell>
                  <TableCell className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground dark:text-muted-foreground">
                    {history.supplier_name || 'N/A'}
                  </TableCell>
                  <TableCell className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground dark:text-muted-foreground">
                    {formatPrice(history.old_price)}
                  </TableCell>
                  <TableCell className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground dark:text-muted-foreground">
                    {formatPrice(history.new_price)}
                  </TableCell>
                  <TableCell className={`px-6 py-4 whitespace-nowrap text-sm font-medium ${
                    history.price_change && history.price_change > 0
                      ? 'text-red-600 dark:text-red-400'
                      : history.price_change && history.price_change < 0
                      ? 'text-green-600 dark:text-green-400'
                      : 'text-muted-foreground dark:text-muted-foreground'
                  }`}>
                    {formatChange(history.price_change, history.price_change_percentage)}
                  </TableCell>
                  <TableCell className="px-6 py-4 text-sm text-muted-foreground dark:text-muted-foreground max-w-xs truncate">
                    {history.change_reason || 'N/A'}
                  </TableCell>
                  <TableCell className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground dark:text-muted-foreground">
                    {history.lga || 'N/A'}
                  </TableCell>
                  <TableCell className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground dark:text-muted-foreground">
                    {formatDate(history.created_at)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      {histories.length === 0 && (
        <div className="text-center py-12 text-muted-foreground dark:text-muted-foreground">
          No price histories found
        </div>
      )}
    </div>
  )
}
