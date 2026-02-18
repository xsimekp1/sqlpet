import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type ShoppingItem = {
  inventoryItemId: string
  name: string
  categoryName?: string
  unit?: string
  desiredQty: number
  currentQty?: number
  reorderLimit?: number | null
}

interface InventoryItemWithStock {
  item: {
    id: string
    name: string
    category: string
    unit?: string | null
    reorder_threshold?: number | null
  }
  total_quantity: number
}

interface ShoppingListState {
  items: ShoppingItem[]
  isOpen: boolean
  addItem: (item: Omit<ShoppingItem, 'desiredQty'> & { desiredQty?: number }) => void
  removeItem: (id: string) => void
  updateQty: (id: string, qty: number) => void
  incrementQty: (id: string) => void
  decrementQty: (id: string) => void
  clearList: () => void
  setIsOpen: (open: boolean) => void
  toggleOpen: () => void
  addLowStockItems: (items: InventoryItemWithStock[]) => void
  isInList: (id: string) => boolean
  getItemQty: (id: string) => number
}

const calculateDefaultQty = (
  currentQty: number | undefined,
  reorderLimit: number | null | undefined
): number => {
  if (reorderLimit && currentQty !== undefined && currentQty < reorderLimit) {
    return reorderLimit - currentQty
  }
  return 1
}

export const useShoppingListStore = create<ShoppingListState>()(
  persist(
    (set, get) => ({
      items: [],
      isOpen: false,

      addItem: (item) => {
        const existing = get().items.find((i) => i.inventoryItemId === item.inventoryItemId)
        
        if (existing) {
          set((state) => ({
            items: state.items.map((i) =>
              i.inventoryItemId === item.inventoryItemId
                ? { ...i, desiredQty: i.desiredQty + 1 }
                : i
            ),
            isOpen: true,
          }))
        } else {
          const desiredQty = item.desiredQty ?? calculateDefaultQty(item.currentQty, item.reorderLimit)
          
          set((state) => ({
            items: [
              ...state.items,
              {
                ...item,
                desiredQty,
              },
            ],
            isOpen: true,
          }))
        }
      },

      removeItem: (id) => {
        set((state) => ({
          items: state.items.filter((i) => i.inventoryItemId !== id),
        }))
      },

      updateQty: (id, qty) => {
        set((state) => ({
          items: state.items.map((i) =>
            i.inventoryItemId === id ? { ...i, desiredQty: Math.max(1, qty) } : i
          ),
        }))
      },

      incrementQty: (id) => {
        set((state) => ({
          items: state.items.map((i) =>
            i.inventoryItemId === id ? { ...i, desiredQty: i.desiredQty + 1 } : i
          ),
        }))
      },

      decrementQty: (id) => {
        set((state) => ({
          items: state.items.map((i) =>
            i.inventoryItemId === id ? { ...i, desiredQty: Math.max(1, i.desiredQty - 1) } : i
          ),
        }))
      },

      clearList: () => {
        set({ items: [] })
      },

      setIsOpen: (open) => {
        set({ isOpen: open })
      },

      toggleOpen: () => {
        set((state) => ({ isOpen: !state.isOpen }))
      },

      addLowStockItems: (items) => {
        const newItems: ShoppingItem[] = items
          .filter((stock) => {
            const threshold = stock.item.reorder_threshold
            return threshold && stock.total_quantity < threshold
          })
          .map((stock) => ({
            inventoryItemId: stock.item.id,
            name: stock.item.name,
            categoryName: stock.item.category,
            unit: stock.item.unit ?? undefined,
            currentQty: stock.total_quantity,
            reorderLimit: stock.item.reorder_threshold,
            desiredQty: calculateDefaultQty(stock.total_quantity, stock.item.reorder_threshold),
          }))

        set((state) => {
          const existingIds = new Set(state.items.map((i) => i.inventoryItemId))
          const itemsToAdd = newItems.filter((i) => !existingIds.has(i.inventoryItemId))
          
          return {
            items: [...state.items, ...itemsToAdd],
            isOpen: true,
          }
        })
      },

      isInList: (id) => {
        return get().items.some((i) => i.inventoryItemId === id)
      },

      getItemQty: (id) => {
        const item = get().items.find((i) => i.inventoryItemId === id)
        return item?.desiredQty ?? 0
      },
    }),
    {
      name: 'shopping_list_v1',
      partialize: (state) => ({
        items: state.items,
      }),
    }
  )
)
