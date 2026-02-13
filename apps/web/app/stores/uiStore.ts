import { create } from 'zustand'
import { persist } from 'zustand/middleware'

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
  dashboardWidgets: string[]
  setDashboardWidgets: (widgets: string[]) => void

  // Preferences
  weightUnit: 'kg' | 'lbs'
  setWeightUnit: (unit: 'kg' | 'lbs') => void
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

      dashboardWidgets: [
        'medical-today',
        'feeding-today',
        'tasks',
        'shelter-stats',
        'occupancy',
        'recently-admitted'
      ],
      setDashboardWidgets: (widgets) => set({ dashboardWidgets: widgets }),

      weightUnit: 'kg',
      setWeightUnit: (unit) => set({ weightUnit: unit }),
    }),
    {
      name: 'pawshelter-ui-storage',
      partialize: (state) => ({
        sidebarCollapsed: state.sidebarCollapsed,
        dashboardWidgets: state.dashboardWidgets,
        weightUnit: state.weightUnit,
      }),
    }
  )
)
