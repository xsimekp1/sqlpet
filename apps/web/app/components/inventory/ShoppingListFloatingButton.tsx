'use client'

import { useShoppingListStore } from '@/app/stores/shoppingListStore'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ShoppingCart } from 'lucide-react'

export function ShoppingListFloatingButton() {
  const t = useTranslations('shoppingList')
  
  const { items, setIsOpen } = useShoppingListStore()

  if (items.length === 0) {
    return null
  }

  return (
    <Button
      className="fixed bottom-6 right-6 z-50 gap-2 shadow-lg lg:hidden"
      size="lg"
      onClick={() => setIsOpen(true)}
    >
      <ShoppingCart className="h-5 w-5" />
      {t('title')}
      <Badge variant="secondary" className="ml-1">
        {items.length}
      </Badge>
    </Button>
  )
}
