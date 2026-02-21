import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type WidgetSize = 'small' | 'large'

export interface WidgetConfig {
  id: string
  size: WidgetSize
}

const DEFAULT_WIDGETS: WidgetConfig[] = [
  { id: 'medical-today', size: 'large' },
  { id: 'feeding-today', size: 'large' },
  { id: 'tasks', size: 'small' },
  { id: 'shelter-stats', size: 'large' },
  { id: 'occupancy', size: 'large' },
  { id: 'recently-admitted', size: 'small' },
  { id: 'my-tasks', size: 'small' },
  { id: 'upcoming-outcomes', size: 'small' },
]

const WIDGET_SIZES: Record<string, WidgetSize> = {
  'medical-today': 'large',
  'feeding-today': 'large',
  'shelter-stats': 'large',
  'occupancy': 'large',
}

interface UIState {
  // Sidebar
  sidebarCollapsed: boolean
  setSidebarCollapsed: (collapsed: boolean) => void
  toggleSidebar: () => void

  // Dashboard
  dashboardEditMode: boolean
  setDashboardEditMode: (editMode: boolean) => void

  // Search
  searchOpen: boolean
  setSearchOpen: (open: boolean) => void

  // Dashboard widget layout (user customization)
  dashboardWidgets: WidgetConfig[]
  setDashboardWidgets: (widgets: WidgetConfig[]) => void

  // Preferences
  weightUnit: 'kg' | 'lbs'
  setWeightUnit: (unit: 'kg' | 'lbs') => void

  currency: 'CZK' | 'EUR'
  setCurrency: (currency: 'CZK' | 'EUR') => void
}

function migrateWidgets(widgets: unknown): WidgetConfig[] {
  if (!Array.isArray(widgets)) return DEFAULT_WIDGETS
  
  // Check if old format (array of strings)
  if (widgets.length > 0 && typeof widgets[0] === 'string') {
    return (widgets as string[]).map(id => ({
      id,
      size: WIDGET_SIZES[id] || 'small'
    }))
  }
  
  return widgets as WidgetConfig[]
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
      toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),

      dashboardEditMode: false,
      setDashboardEditMode: (editMode) => set({ dashboardEditMode: editMode }),

      searchOpen: false,
      setSearchOpen: (open) => set({ searchOpen: open }),

      dashboardWidgets: DEFAULT_WIDGETS,
      setDashboardWidgets: (widgets) => set({ dashboardWidgets: widgets }),

      weightUnit: 'kg',
      setWeightUnit: (unit) => set({ weightUnit: unit }),

      currency: 'CZK',
      setCurrency: (currency) => set({ currency }),
    }),
    {
      name: 'pawshelter-ui-storage',
      partialize: (state) => ({
        sidebarCollapsed: state.sidebarCollapsed,
        dashboardWidgets: state.dashboardWidgets,
        weightUnit: state.weightUnit,
        currency: state.currency,
      }),
      merge: (persisted: unknown, current) => {
        const persistedState = persisted as { dashboardWidgets?: unknown } | undefined
        return {
          ...current,
          ...persistedState,
          dashboardWidgets: migrateWidgets(persistedState?.dashboardWidgets),
        }
      },
    }
  )
)
