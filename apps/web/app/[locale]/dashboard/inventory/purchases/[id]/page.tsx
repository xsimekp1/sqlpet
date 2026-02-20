'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ApiClient } from '@/app/lib/api'
import { useTranslations } from 'next-intl'
import { useRouter, useParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { ArrowLeft, Package, XCircle, Printer } from 'lucide-react'
import Link from 'next/link'
import { format } from 'date-fns'
import { useToast } from '@/hooks/use-toast'
import { Progress } from '@/components/ui/progress'

export default function PurchaseOrderDetailPage() {
  const t = useTranslations('purchases')
  const router = useRouter()
  const params = useParams()
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const [showReceiveModal, setShowReceiveModal] = useState(false)
  const [isReceiving, setIsReceiving] = useState(false)

  const purchaseOrderId = purchaseOrderId as string

  // Fetch purchase order
  const { data: po, isLoading } = useQuery({
    queryKey: ['purchase-order', purchaseOrderId],
    queryFn: () => ApiClient.getPurchaseOrder(purchaseOrderId),
  })

  // Cancel mutation
  const cancelMutation = useMutation({
    mutationFn: () => ApiClient.cancelPurchaseOrder(purchaseOrderId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-order', purchaseOrderId] })
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] })
      toast({
        title: t('orderCancelled'),
        description: t('orderCancelledDesc'),
      })
    },
    onError: (error: any) => {
      toast({
        title: t('error'),
        description: error.message || t('failedToCancel'),
        variant: 'destructive',
      })
    },
  })

  const handleReceiveGoods = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsReceiving(true)

    const formData = new FormData(e.currentTarget)
    const items = po.items
      .filter((item: any) => item.quantity_received < item.quantity_ordered)
      .map((item: any) => {
        const quantityReceived = formData.get(`quantity_${item.id}`)
        const lotNumber = formData.get(`lot_${item.id}`) as string
        const expirationDate = formData.get(`expiry_${item.id}`) as string

        if (!quantityReceived || Number(quantityReceived) === 0) {
          return null
        }

        return {
          item_id: item.id,
          quantity_received: Number(quantityReceived),
          lot_number: lotNumber || undefined,
          expiration_date: expirationDate || undefined,
        }
      })
      .filter(Boolean)

    if (items.length === 0) {
      toast({
        title: t('error'),
        description: t('noItemsToReceive'),
        variant: 'destructive',
      })
      setIsReceiving(false)
      return
    }

    try {
      await ApiClient.receivePurchaseOrder(purchaseOrderId, { items })

      queryClient.invalidateQueries({ queryKey: ['purchase-order', purchaseOrderId] })
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] })
      queryClient.invalidateQueries({ queryKey: ['inventory-items'] })

      toast({
        title: t('goodsReceived'),
        description: t('goodsReceivedDesc'),
      })

      setShowReceiveModal(false)
    } catch (error: any) {
      toast({
        title: t('error'),
        description: error.message || t('failedToReceive'),
        variant: 'destructive',
      })
    } finally {
      setIsReceiving(false)
    }
  }

  const handleCancel = () => {
    if (confirm(t('confirmCancel'))) {
      cancelMutation.mutate()
    }
  }

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { className: string }> = {
      ordered: { className: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300' },
      partially_received: { className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300' },
      received: { className: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300' },
      cancelled: { className: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300' },
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
      return format(new Date(dateString), 'dd.MM.yyyy HH:mm')
    } catch {
      return dateString
    }
  }

  const formatDateOnly = (dateString: string | null) => {
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
        <div className="text-muted-foreground">{t('loadingOrder')}</div>
      </div>
    )
  }

  if (!po) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <div className="text-muted-foreground mb-4">{t('orderNotFound')}</div>
        <Link href="/dashboard/inventory/purchases">
          <Button variant="outline">
            <ArrowLeft className="h-4 w-4 mr-2" />
            {t('backToOrders')}
          </Button>
        </Link>
      </div>
    )
  }

  const canReceive = po.status === 'ordered' || po.status === 'partially_received'
  const canCancel = po.status === 'ordered' && po.received_items === 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <Link href="/dashboard/inventory/purchases">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">{po.po_number}</h1>
              <p className="text-muted-foreground">{po.supplier_name}</p>
            </div>
            {getStatusBadge(po.status)}
          </div>
        </div>

        <div className="flex gap-2">
          {canReceive && (
            <Button onClick={() => setShowReceiveModal(true)}>
              <Package className="h-4 w-4 mr-2" />
              {t('receiveGoods')}
            </Button>
          )}
          {canCancel && (
            <Button
              variant="destructive"
              onClick={handleCancel}
              disabled={cancelMutation.isPending}
            >
              <XCircle className="h-4 w-4 mr-2" />
              {t('cancel')}
            </Button>
          )}
        </div>
      </div>

      {/* Order Info */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-lg border p-4">
          <div className="text-sm font-medium text-muted-foreground mb-1">{t('orderedDate')}</div>
          <div className="text-lg font-semibold">{formatDate(po.ordered_at)}</div>
        </div>
        <div className="rounded-lg border p-4">
          <div className="text-sm font-medium text-muted-foreground mb-1">{t('expectedDelivery')}</div>
          <div className="text-lg font-semibold">{formatDateOnly(po.expected_delivery_date)}</div>
        </div>
        <div className="rounded-lg border p-4">
          <div className="text-sm font-medium text-muted-foreground mb-1">{t('progress')}</div>
          <div className="text-lg font-semibold">
            {po.received_items} / {po.total_items} {t('items')}
          </div>
          <Progress
            value={(po.received_items / po.total_items) * 100}
            className="mt-2"
          />
        </div>
      </div>

      {/* Notes */}
      {po.notes && (
        <div className="rounded-lg border p-4">
          <div className="text-sm font-medium mb-2">{t('notes')}</div>
          <div className="text-sm text-muted-foreground whitespace-pre-wrap">{po.notes}</div>
        </div>
      )}

      {/* Items Table */}
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('table.item')}</TableHead>
              <TableHead className="text-right">{t('table.quantityOrdered')}</TableHead>
              <TableHead className="text-right">{t('table.quantityReceived')}</TableHead>
              <TableHead className="text-right">{t('table.remaining')}</TableHead>
              <TableHead className="text-right">{t('table.unitPrice')}</TableHead>
              <TableHead>{t('table.progress')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {po.items.map((item: any) => {
              const remaining = Number(item.quantity_ordered) - Number(item.quantity_received)
              const progress = (Number(item.quantity_received) / Number(item.quantity_ordered)) * 100

              return (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.inventory_item_name}</TableCell>
                  <TableCell className="text-right">{Number(item.quantity_ordered).toFixed(2)}</TableCell>
                  <TableCell className="text-right">{Number(item.quantity_received).toFixed(2)}</TableCell>
                  <TableCell className="text-right">
                    {remaining > 0 ? (
                      <span className="text-orange-600 dark:text-orange-400">{remaining.toFixed(2)}</span>
                    ) : (
                      <span className="text-green-600 dark:text-green-400">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {item.unit_price ? `$${Number(item.unit_price).toFixed(2)}` : '-'}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Progress value={progress} className="flex-1" />
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {Math.round(progress)}%
                      </span>
                    </div>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      {/* Receive Goods Modal */}
      <Dialog open={showReceiveModal} onOpenChange={setShowReceiveModal}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('receiveGoods')} - {po.po_number}</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleReceiveGoods}>
            <div className="space-y-4 py-4">
              {po.items
                .filter((item: any) => Number(item.quantity_received) < Number(item.quantity_ordered))
                .map((item: any) => {
                  const remaining = Number(item.quantity_ordered) - Number(item.quantity_received)

                  return (
                    <div key={item.id} className="border rounded-lg p-4 space-y-3">
                      <div className="font-medium">{item.inventory_item_name}</div>
                      <div className="text-sm text-muted-foreground">
                        {t('ordered')}: {Number(item.quantity_ordered).toFixed(2)} | {t('received')}: {Number(item.quantity_received).toFixed(2)} | {t('remaining')}: {remaining.toFixed(2)}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div className="space-y-2">
                          <Label htmlFor={`quantity_${item.id}`}>
                            {t('quantityReceived')} <span className="text-destructive">*</span>
                          </Label>
                          <Input
                            id={`quantity_${item.id}`}
                            name={`quantity_${item.id}`}
                            type="number"
                            step="0.01"
                            min="0"
                            max={remaining}
                            placeholder="0.00"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor={`lot_${item.id}`}>{t('lotNumber')}</Label>
                          <Input
                            id={`lot_${item.id}`}
                            name={`lot_${item.id}`}
                            placeholder={t('lotNumberPlaceholder')}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor={`expiry_${item.id}`}>{t('expirationDate')}</Label>
                          <Input
                            id={`expiry_${item.id}`}
                            name={`expiry_${item.id}`}
                            type="date"
                          />
                        </div>
                      </div>
                    </div>
                  )
                })}
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowReceiveModal(false)}
                disabled={isReceiving}
              >
                {t('cancel')}
              </Button>
              <Button type="submit" disabled={isReceiving}>
                {isReceiving ? t('receiving') : t('receive')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
