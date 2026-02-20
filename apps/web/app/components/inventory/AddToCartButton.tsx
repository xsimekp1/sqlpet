'use client'

import { useShoppingListStore, type ShoppingItem } from '@/app/stores/shoppingListStore'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Plus, Check, Trash2 } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

interface AddToCartButtonProps {
  item: {
    id: string
    name: string
    category: string
    unit?: string | null
    reorder_threshold?: number | null
  }
  totalQuantity: number
}

export function AddToCartButton({ item, totalQuantity }: AddToCartButtonProps) {
  const t = useTranslations('shoppingList')
  const { toast } = useToast()
  
  const { addItem, isInList, getItemQty, removeItem, setIsOpen } = useShoppingListStore()

  const isInShoppingList = isInList(item.id)
  const qtyInList = getItemQty(item.id)

  const handleAddToCart = () => {
    const itemData: Omit<ShoppingItem, 'desiredQty'> = {
      inventoryItemId: item.id,
      name: item.name,
      categoryName: item.category,
      unit: item.unit ?? undefined,
      currentQty: totalQuantity,
      reorderLimit: item.reorder_threshold,
    }

    addItem(itemData)
    setIsOpen(true)
    
    toast({
      title: t('added'),
      description: `${item.name}`,
    })
  }

  const handleRemoveFromCart = (e: React.MouseEvent) => {
    e.stopPropagation()
    removeItem(item.id)
  }

  if (isInShoppingList) {
    return (
      <div className="flex items-center gap-1">
        <Button
          size="sm"
          variant="outline"
          className="h-8 gap-1 text-green-600 border-green-600 hover:bg-green-50"
          onClick={() => setIsOpen(true)}
        >
          <Check className="h-3 w-3" />
          <span className="text-xs">
            {t('inCart')} ({qtyInList})
          </span>
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-8 px-2 text-destructive hover:text-destructive"
          onClick={handleRemoveFromCart}
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
    )
  }

  return (
    <Button
      size="sm"
      variant="filter"
      className="h-8 gap-1"
      onClick={handleAddToCart}
    >
      <Plus className="h-3 w-3" />
      {t('addToCart')}
    </Button>
  )
}
