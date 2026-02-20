'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ApiClient } from '@/app/lib/api'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Plus, Package, Eye } from 'lucide-react'
import Link from 'next/link'
import { format } from 'date-fns'

type StatusFilter = 'all' | 'ordered' | 'partially_received' | 'received' | 'cancelled'

export default function PurchasesPage() {
  const t = useTranslations('purchases')
  const router = useRouter()

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [page, setPage] = useState(1)
  const pageSize = 50

  // Fetch purchase orders
  const { data: purchaseOrders, isLoading } = useQuery({
    queryKey: ['purchase-orders', statusFilter, dateFrom, dateTo, page],
    queryFn: () =>
      ApiClient.getPurchaseOrders({
        status: statusFilter !== 'all' ? statusFilter : undefined,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
        page,
        page_size: pageSize,
      }),
  })

  const orders = Array.isArray(purchaseOrders) ? purchaseOrders : []

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: any; className: string }> = {
      ordered: { variant: 'default', className: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300' },
      partially_received: { variant: 'secondary', className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300' },
      received: { variant: 'default', className: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300' },
      cancelled: { variant: 'outline', className: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300' },
    }

    const config = variants[status] || variants.ordered

    return (
      <Badge className={config.className} variant="outline">
        {t(`status.${status}`)}
      </Badge>
    )
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-'
    try {
      return format(new Date(dateString), 'dd.MM.yyyy')
    } catch {
      return dateString
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">{t('loadingOrders')}</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
          <p className="text-muted-foreground">{t('description')}</p>
        </div>
        <Link href="/dashboard/inventory">
          <Button variant="outline">
            <Package className="h-4 w-4 mr-2" />
            {t('backToInventory')}
          </Button>
        </Link>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="space-y-2">
          <Label>{t('filters.status')}</Label>
          <Select
            value={statusFilter}
            onValueChange={(value) => setStatusFilter(value as StatusFilter)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('filters.allStatuses')}</SelectItem>
              <SelectItem value="ordered">{t('status.ordered')}</SelectItem>
              <SelectItem value="partially_received">{t('status.partially_received')}</SelectItem>
              <SelectItem value="received">{t('status.received')}</SelectItem>
              <SelectItem value="cancelled">{t('status.cancelled')}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>{t('filters.dateFrom')}</Label>
          <Input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label>{t('filters.dateTo')}</Label>
          <Input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
          />
        </div>

        <div className="flex items-end">
          <Button
            variant="outline"
            onClick={() => {
              setStatusFilter('all')
              setDateFrom('')
              setDateTo('')
              setPage(1)
            }}
          >
            {t('filters.clear')}
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('table.poNumber')}</TableHead>
              <TableHead>{t('table.supplier')}</TableHead>
              <TableHead>{t('table.status')}</TableHead>
              <TableHead>{t('table.orderedDate')}</TableHead>
              <TableHead>{t('table.expectedDelivery')}</TableHead>
              <TableHead>{t('table.items')}</TableHead>
              <TableHead>{t('table.received')}</TableHead>
              <TableHead className="text-right">{t('table.actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                  {t('noOrders')}
                </TableCell>
              </TableRow>
            ) : (
              orders.map((order: any) => (
                <TableRow key={order.id} className="cursor-pointer hover:bg-muted/50">
                  <TableCell className="font-medium">{order.po_number}</TableCell>
                  <TableCell>{order.supplier_name}</TableCell>
                  <TableCell>{getStatusBadge(order.status)}</TableCell>
                  <TableCell>{formatDate(order.ordered_at)}</TableCell>
                  <TableCell>{formatDate(order.expected_delivery_date)}</TableCell>
                  <TableCell>{order.total_items}</TableCell>
                  <TableCell>
                    {order.received_items} / {order.total_items}
                    {order.received_items > 0 && order.received_items < order.total_items && (
                      <span className="text-xs text-muted-foreground ml-1">
                        ({Math.round((order.received_items / order.total_items) * 100)}%)
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => router.push(`/dashboard/inventory/purchases/${order.id}`)}
                    >
                      <Eye className="h-4 w-4 mr-1" />
                      {t('view')}
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {orders.length >= pageSize && (
        <div className="flex justify-between items-center">
          <Button
            variant="outline"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
          >
            {t('previous')}
          </Button>
          <span className="text-sm text-muted-foreground">
            {t('page')} {page}
          </span>
          <Button
            variant="outline"
            onClick={() => setPage((p) => p + 1)}
            disabled={orders.length < pageSize}
          >
            {t('next')}
          </Button>
        </div>
      )}
    </div>
  )
}
