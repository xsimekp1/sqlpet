'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useShoppingListStore } from '@/app/stores/shoppingListStore'
import { useTranslations } from 'next-intl'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from '@/components/ui/sheet'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Minus,
  Plus,
  Trash2,
  Clipboard,
  Download,
  ShoppingCart,
  Package,
} from 'lucide-react'
import { getUnitSymbol } from '@/app/lib/constants'
import { useToast } from '@/hooks/use-toast'

export function ShoppingListPanel() {
  const t = useTranslations('shoppingList')
  const tInventory = useTranslations('inventory')
  const { toast } = useToast()
  const router = useRouter()

  const {
    items,
    isOpen,
    setIsOpen,
    incrementQty,
    decrementQty,
    removeItem,
    clearList,
    createPurchaseOrder,
  } = useShoppingListStore()

  const [showCreatePOModal, setShowCreatePOModal] = useState(false)
  const [isCreatingPO, setIsCreatingPO] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 1024)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  const handleCopyToClipboard = async () => {
    const text = items
      .map((item) => {
        const qty = item.desiredQty
        const unit = getUnitSymbol(item.unit) || ''
        return `${item.name} - ${qty} ${unit}`
      })
      .join('\n')

    try {
      await navigator.clipboard.writeText(text)
      toast({
        title: t('copied'),
      })
    } catch {
      console.error('Failed to copy')
    }
  }

  const handleExportJSON = () => {
    const json = JSON.stringify(items, null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'nakupni-seznam.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleCreatePO = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsCreatingPO(true)

    const formData = new FormData(e.currentTarget)
    const supplierName = formData.get('supplier_name') as string
    const expectedDeliveryDate = formData.get('expected_delivery_date') as string
    const notes = formData.get('notes') as string

    try {
      const po = await createPurchaseOrder(
        supplierName,
        expectedDeliveryDate || undefined,
        notes || undefined
      )

      toast({
        title: t('purchaseOrderCreated'),
        description: `${t('poNumber')}: ${po.po_number}`,
      })

      setShowCreatePOModal(false)

      // Navigate to PO detail page
      router.push(`/dashboard/inventory/purchases/${po.id}`)
    } catch (error: any) {
      console.error('Failed to create purchase order:', error)
      toast({
        title: t('error'),
        description: error.message || t('failedToCreatePO'),
        variant: 'destructive',
      })
    } finally {
      setIsCreatingPO(false)
    }
  }

  const renderListItems = () => (
    <div className="flex-1 overflow-y-auto space-y-2 py-2">
      {items.length === 0 ? (
        <div className="text-center text-muted-foreground py-8">
          <ShoppingCart className="h-12 w-12 mx-auto mb-2 opacity-50" />
          <p>{t('empty')}</p>
        </div>
      ) : (
        items.map((item) => (
          <div
            key={item.inventoryItemId}
            className="flex items-center justify-between gap-2 p-2 rounded-md border bg-card"
          >
            <div className="flex-1 min-w-0">
              <div className="font-medium text-sm truncate">
                {item.name}
              </div>
              {item.categoryName && (
                <div className="text-xs text-muted-foreground">
                  {tInventory(`categories.${item.categoryName}`)}
                </div>
              )}
            </div>
            
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon-xs"
                onClick={() => decrementQty(item.inventoryItemId)}
                disabled={item.desiredQty <= 1}
              >
                <Minus className="h-3 w-3" />
              </Button>
              
              <span className="w-8 text-center text-sm font-medium">
                {item.desiredQty}
              </span>
              
              <Button
                variant="outline"
                size="icon-xs"
                onClick={() => incrementQty(item.inventoryItemId)}
              >
                <Plus className="h-3 w-3" />
              </Button>
              
              <span className="text-xs text-muted-foreground ml-1 w-8">
                {getUnitSymbol(item.unit)}
              </span>
              
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={() => removeItem(item.inventoryItemId)}
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          </div>
        ))
      )}
    </div>
  )

  const renderFooter = () => (
    items.length > 0 && (
      <div className="flex flex-col gap-2 pt-2 border-t">
        {/* Create Purchase Order button - prominent */}
        <Button
          onClick={() => setShowCreatePOModal(true)}
          className="w-full"
        >
          <Package className="h-4 w-4 mr-2" />
          {t('createPurchaseOrder')} ({items.length})
        </Button>

        {/* Other actions */}
        <div className="flex flex-row gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={clearList}
            className="flex-1"
          >
            <Trash2 className="h-4 w-4 mr-1" />
            {t('clear')}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopyToClipboard}
            className="flex-1"
          >
            <Clipboard className="h-4 w-4 mr-1" />
            {t('copy')}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportJSON}
            className="flex-1"
          >
            <Download className="h-4 w-4 mr-1" />
            {t('export')}
          </Button>
        </div>
      </div>
    )
  )

  // Desktop: Non-modal sticky panel
  const renderDesktopPanel = () => (
    <div className="hidden lg:flex fixed right-0 top-16 bottom-0 w-80 flex-col border-l bg-background z-30">
      <div className="flex flex-col h-full p-4">
        {/* Header - plain HTML, not Sheet components */}
        <div className="flex flex-row items-center justify-between pb-2">
          <div className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            <h2 className="text-lg font-semibold">{t('title')}</h2>
          </div>
          <Badge variant="secondary">
            {t('itemsCount', { count: items.length })}
          </Badge>
        </div>

        {renderListItems()}
        {renderFooter()}
      </div>
    </div>
  )

  // Mobile: Sheet content
  const renderMobileSheetContent = () => (
    <>
      <SheetHeader className="flex flex-row items-center justify-between pb-2">
        <SheetTitle className="flex items-center gap-2">
          <ShoppingCart className="h-5 w-5" />
          {t('title')}
        </SheetTitle>
        <Badge variant="secondary">
          {items.length} {t('itemsCount', { count: items.length })}
        </Badge>
      </SheetHeader>

      {renderListItems()}
      {renderFooter()}
    </>
  )

  return (
    <>
      {items.length > 0 && renderDesktopPanel()}

      {/* Mobile: Bottom sheet - only on small screens */}
      <Sheet open={isOpen && isMobile} onOpenChange={setIsOpen}>
        <SheetContent side="bottom" className="h-[70vh] flex flex-col lg:hidden">
          {renderMobileSheetContent()}
        </SheetContent>
      </Sheet>

      {/* Create Purchase Order Modal */}
      <Dialog open={showCreatePOModal} onOpenChange={setShowCreatePOModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('createPurchaseOrder')}</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleCreatePO}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="supplier_name">
                  {t('supplierName')} <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="supplier_name"
                  name="supplier_name"
                  required
                  placeholder={t('supplierNamePlaceholder')}
                  autoFocus
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="expected_delivery_date">
                  {t('expectedDeliveryDate')}
                </Label>
                <Input
                  id="expected_delivery_date"
                  name="expected_delivery_date"
                  type="date"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">{t('notes')}</Label>
                <Textarea
                  id="notes"
                  name="notes"
                  placeholder={t('notesPlaceholder')}
                  rows={3}
                />
              </div>

              <div className="rounded-md border p-3 bg-muted/50">
                <div className="text-sm font-medium mb-2">
                  {t('itemsSummary')}:
                </div>
                <div className="text-sm text-muted-foreground">
                  {t('itemsCount', { count: items.length })}
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowCreatePOModal(false)}
                disabled={isCreatingPO}
              >
                {t('cancel')}
              </Button>
              <Button type="submit" disabled={isCreatingPO}>
                {isCreatingPO ? t('creating') : t('create')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
