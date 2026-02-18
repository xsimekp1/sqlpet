'use client'

import { useShoppingListStore } from '@/app/stores/shoppingListStore'
import { useTranslations } from 'next-intl'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Minus,
  Plus,
  Trash2,
  Clipboard,
  Download,
  ShoppingCart,
} from 'lucide-react'
import { getUnitSymbol } from '@/app/lib/constants'
import { useToast } from '@/hooks/use-toast'

export function ShoppingListPanel() {
  const t = useTranslations('shoppingList')
  const tInventory = useTranslations('inventory')
  const { toast } = useToast()
  
  const {
    items,
    isOpen,
    setIsOpen,
    incrementQty,
    decrementQty,
    removeItem,
    clearList,
  } = useShoppingListStore()

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

  const renderContent = () => (
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

      {items.length > 0 && (
        <SheetFooter className="flex flex-row gap-2 pt-2 border-t">
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
        </SheetFooter>
      )}
    </>
  )

  return (
    <>
      {/* Desktop: right sheet - hidden on mobile */}
      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetContent side="right" className="w-full flex flex-col hidden lg:flex">
          {renderContent()}
        </SheetContent>
      </Sheet>

      {/* Mobile: bottom sheet - hidden on lg+ */}
      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetContent side="bottom" className="h-[70vh] flex flex-col lg:hidden">
          {renderContent()}
        </SheetContent>
      </Sheet>
    </>
  )
}
